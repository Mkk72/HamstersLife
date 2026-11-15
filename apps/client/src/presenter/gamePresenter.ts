/**
 * Презентер партии: превращает жесты в команды, проверяет доступность и
 * собирает модель представления. Ни Pixi, ни DOM здесь нет — поэтому тесты
 * идут без окна, а вид можно заменить (Pixi, отладочный текстовый, скриншот).
 */
import {
  BOOST_KINDS,
  MIN_FLEET_SIZE,
  TICKS_PER_SECOND,
  TROOP_KINDS,
  boostRemainingTicks,
  distance,
  evaluateOutcome,
  flightTicks,
  formatMilli,
  garrisonOf,
  speedUnitsPerSecond,
  troopTotal,
} from '@hamsters/core';
import type {
  Balance,
  BoostKind,
  CommandErrorCode,
  CommandResult,
  ContentProvider,
  GameState,
  Planet,
  PlanetId,
  PlayerId,
  Ratio,
  SimSource,
  TroopKind,
} from '@hamsters/core';
import type {
  ArrowView,
  BoardView,
  BoostButtonView,
  CompositionMode,
  CompositionTemplateView,
  GameView,
  HudView,
  PlanetView,
  QualityLevel,
  TrainingButtonView,
  TroopCountView,
} from './viewModel';

const BOOST_NAMES: Readonly<Record<BoostKind, string>> = {
  production: 'Колесо',
  speed: 'Щёки',
  defense: 'Скорлупа',
};

const TRAIN_ERRORS: Partial<Record<CommandErrorCode, string>> = {
  'queue-full': 'Очередь казармы заполнена',
  'not-enough-seeds': 'Не хватает семечек',
  'not-your-planet': 'Только своя планета',
  'unknown-planet': 'Планета не найдена',
  'unknown-troop': 'Такого рода войск нет',
};

const BOOST_ERRORS: Partial<Record<CommandErrorCode, string>> = {
  cooldown: 'Ещё перезарядка',
  'not-enough-seeds': 'Не хватает семечек',
  'wrong-boost-target': 'Нужна своя планета',
  'not-your-planet': 'Только своя планета',
};
import { ProtectedInt } from '../security/protectedInt';

export interface PresenterDeps {
  readonly sim: SimSource;
  readonly view: GameView;
  readonly content: ContentProvider;
  readonly humanPlayerId: PlayerId;
  readonly initialRatio?: Ratio;
}

const RATIO_VALUES: readonly Ratio[] = [25, 50, 75, 100];

export class GamePresenter {
  readonly #sim: SimSource;
  readonly #view: GameView;
  readonly #playerId: PlayerId;
  readonly #balance: Balance;

  #selected = new Set<PlanetId>();
  #hover: PlanetId | null = null;
  #owners = new Map<PlanetId, PlayerId>();
  #ratio: Ratio;
  #quality: QualityLevel = 'high';
  #composition: CompositionMode = 'all';
  #speed = 1;
  #seenClashes = new Set<string>();
  /** Курсор в мировых координатах, пока тянем стрелку. */
  #cursor: { x: number; y: number } | null = null;
  /** ЛКМ зажата: рисуем «резиновую» стрелку сразу. */
  #dragging = false;
  #running = false;
  /** Значения HUD замаскированы: правка картинки извне видна по контрольной сумме. */
  readonly #guarded = {
    seeds: new ProtectedInt(),
    mine: new ProtectedInt(),
    enemy: new ProtectedInt(),
    neutral: new ProtectedInt(),
  };
  #tampered = false;
  #lastMaskTick = -1000;
  #outcomePlayed = false;
  /** Короткое сообщение игроку: «заказ принят», «не хватает семечек» и т.п. */
  #message: { readonly text: string; readonly untilTick: number } | null = null;

  constructor(deps: PresenterDeps) {
    this.#sim = deps.sim;
    this.#view = deps.view;
    this.#playerId = deps.humanPlayerId;
    this.#balance = deps.content.balance;
    this.#ratio = deps.initialRatio ?? 50;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#sim.start(() => this.render());
    this.#view.setQuality(this.#quality);
  }

  stop(): void {
    this.#running = false;
    this.#sim.stop();
  }

  get ratio(): Ratio {
    return this.#ratio;
  }

  get selectedIds(): readonly PlanetId[] {
    return [...this.#selected];
  }

  get humanPlayerId(): PlayerId {
    return this.#playerId;
  }

  setRatio(ratio: Ratio): void {
    if (!RATIO_VALUES.includes(ratio)) return;
    this.#ratio = ratio;
    this.render();
  }

  setQuality(quality: QualityLevel): void {
    this.#quality = quality;
    this.#view.setQuality(quality);
  }

  get quality(): QualityLevel {
    return this.#quality;
  }

  /** Скорость игры: 0 — пауза, 1 — обычная, 2 — быстрее. */
  setSpeed(speed: number): void {
    this.#speed = speed;
    this.#sim.setSpeed(speed);
  }

  get speed(): number {
    return this.#speed;
  }

  /** Желаемый состав следующего отряда. */
  setComposition(mode: CompositionMode): void {
    this.#composition = mode;
    this.render();
  }

  get composition(): CompositionMode {
    return this.#composition;
  }

  /** Отрезать постоянный маршрут (ПКМ-протяжка). */
  cutRoute(routeId: number): CommandResult | null {
    const result = this.#sim.sendCommand({
      type: 'RemoveRoute',
      playerId: this.#playerId,
      routeId,
    });
    if (result.ok) this.#view.playCut();
    else this.#view.playError();
    this.render();
    return result;
  }

  /** Нажатие на планету: своя — выбор, чужая — цель (если что-то выбрано). */
  pointerDown(planetId: PlanetId, additive = false): void {
    const state = this.#sim.getSnapshot();
    const planet = state.planets[planetId];
    if (!planet) return;
    if (planet.ownerId !== this.#playerId) return;

    if (additive && this.#selected.size > 0) {
      if (this.#selected.has(planetId)) this.#selected.delete(planetId);
      else this.#selected.add(planetId);
    } else {
      this.#selected = new Set([planetId]);
    }
    this.#dragging = true;
    this.#cursor = { x: planet.x, y: planet.y };
    this.#view.playSelect();
    this.render();
  }

  /** Снять выбор (клик по пустому месту). */
  clearSelection(): void {
    this.#dragging = false;
    this.#cursor = null;
    if (this.#selected.size === 0) return;
    this.#selected.clear();
    this.render();
  }

  /** Курсор над планетой (или мимо): отсюда берётся цель для стрелки. */
  pointerHover(planetId: PlanetId | null): void {
    this.#hover = planetId;
    this.render();
  }

  /** Движение с зажатой ЛКМ: стрелка тянется за курсором. */
  pointerMove(x: number, y: number, planetId: PlanetId | null): void {
    this.#cursor = { x, y };
    this.#hover = planetId;
    this.render();
  }

  /** Отпускание: если есть выбор и цель — отправить флот. */
  pointerUp(): CommandResult | null {
    const target = this.#hover;
    this.#hover = null;
    this.#dragging = false;
    this.#cursor = null;
    if (target === null) {
      this.render();
      return null;
    }
    const result = this.#sendFleet(target);
    if (result?.ok) this.#view.playSend();
    else if (result) this.#view.playError();
    this.render();
    return result;
  }

  /** Заказ на обучение для первой выбранной планеты. */
  train(kind: TroopKind, amount = 1): CommandResult | null {
    const planetId = this.#firstSelected();
    if (planetId === null) {
      this.#notify('Сначала выбери свою планету');
      this.#view.playError();
      this.render();
      return null;
    }
    const result = this.#sim.sendCommand({
      type: 'TrainTroops',
      playerId: this.#playerId,
      planetId,
      kind,
      amount,
    });
    const stats = this.#balance.troops[kind];
    if (result.ok) {
      const planet = this.#sim.getSnapshot().planets[planetId];
      const used = planet?.training.length ?? 1;
      const max = this.#balance.maxTrainingQueue;
      this.#notify(`${stats.shortName}: заказ принят · очередь ${used}/${max}`);
      this.#view.playTrain();
    } else {
    this.#notify(TRAIN_ERRORS[result.error] ?? 'Заказ не принят', true);
      this.#view.playError();
    }
    this.render();
    return result;
  }

  /** Буст применяется к первой выбранной планете. */
  applyBoost(kind: BoostKind): CommandResult | null {
    const planetId = this.#firstSelected();
    if (planetId === null) {
      this.#notify('Сначала выбери свою планету');
      this.#view.playError();
      this.render();
      return null;
    }
    const result = this.#sim.sendCommand({
      type: 'ApplyBoost',
      playerId: this.#playerId,
      planetId,
      boost: kind,
    });
    if (result.ok) {
      this.#notify(`${BOOST_NAMES[kind]}: включён`);
      this.#view.playBoost(planetId, kind);
    } else {
      this.#notify(BOOST_ERRORS[result.error] ?? 'Буст не сработал', true);
      this.#view.playError();
    }
    this.render();
    return result;
  }

  #notify(text: string, isError = false): void {
    const tick = this.#sim.getSnapshot().tick;
    this.#message = { text: isError ? `! ${text}` : text, untilTick: tick + 60 };
  }

  render(): void {
    const view = this.buildView();
    this.#view.render(view);
    this.#detectCaptures(view);
    this.#detectOutcome(view);
  }

  /** Один раз сообщаем виду, что партия кончилась — для финальной фразы. */
  #detectOutcome(view: BoardView): void {
    if (this.#outcomePlayed) return;
    const outcome = view.hud.outcome;
    if (!outcome) return;
    this.#outcomePlayed = true;
    this.#view.playOutcome(outcome.youWon);
    // Мир замирает на экране итогов: дальше считать нечего.
    this.#sim.stop();
  }

  /** Смена владельца между отрисовками — повод для эффекта захвата. */
  #detectCaptures(view: BoardView): void {
    for (const planet of view.planets) {
      const previous = this.#owners.get(planet.id);
      this.#owners.set(planet.id, planet.ownerId);
      if (previous !== undefined && previous !== planet.ownerId) {
        this.#view.playCapture(planet.id);
      }
    }
  }

  /** Встреча флотов: вспышка ровно в точке перехвата на отрезке. */
  #detectInterceptions(state: GameState): void {
    for (const event of state.events) {
      if (event.kind !== 'interception') continue;
      const key = `${event.tick}:${event.fleetIds[0]}:${event.fleetIds[1]}`;
      if (this.#seenClashes.has(key)) continue;
      this.#seenClashes.add(key);
      if (this.#seenClashes.size > 64) this.#seenClashes.clear();

      const from = state.planets[event.fromPlanetId];
      const to = state.planets[event.toPlanetId];
      if (!from || !to) continue;
      const share = event.progressPermille / 1000;
      this.#view.playInterception(
        from.x + (to.x - from.x) * share,
        from.y + (to.y - from.y) * share,
      );
    }
  }

  /** Снимок для отладки и тестов: тот же объект, что уходит в вид. */
  buildView(): BoardView {
    const state = this.#sim.getSnapshot();
    this.#detectInterceptions(state);
    const tick = state.tick;
    return {
      tick,
      planets: state.planets.map((planet) => this.#planetView(planet, tick)),
      fleets: state.fleets.map((fleet) => {
        const from = state.planets[fleet.fromPlanetId];
        const to = state.planets[fleet.toPlanetId];
        const span = Math.max(1, fleet.arriveTick - fleet.departTick);
        const progress = Math.min(1, Math.max(0, (tick - fleet.departTick) / span));
        return {
          id: fleet.id,
          ownerId: fleet.ownerId,
          fromX: from?.x ?? 0,
          fromY: from?.y ?? 0,
          toX: to?.x ?? 0,
          toY: to?.y ?? 0,
          progress,
          troops: troopTotal(fleet.troops),
        };
      }),
      routes: state.routes.map((route) => {
        const from = state.planets[route.fromPlanetId];
        const to = state.planets[route.toPlanetId];
        return {
          id: route.id,
          ownerId: route.ownerId,
          fromX: from?.x ?? 0,
          fromY: from?.y ?? 0,
          toX: to?.x ?? 0,
          toY: to?.y ?? 0,
          weightPermille: route.weightPermille,
          pending: troopTotal(route.pending),
        };
      }),
      arrows: this.#arrowViews(state, tick),
      hud: this.#hudView(state, tick),
    };
  }

  #firstSelected(): PlanetId | null {
    for (const id of this.#selected) return id;
    return null;
  }

  #sendFleet(target: PlanetId): CommandResult | null {
    const sources = [...this.#selected];
    if (sources.length === 0) return null;
    if (sources.includes(target)) return null;
    const weights = this.#compositionWeights();
    return this.#sim.sendCommand({
      type: 'SendFleet',
      playerId: this.#playerId,
      fromPlanetIds: sources,
      toPlanetId: target,
      ratio: this.#ratio,
      ...(weights ? { composition: weights } : {}),
    });
  }

  #compositionWeights(): Partial<Record<TroopKind, number>> | undefined {
    if (this.#composition === 'all') return undefined;
    if (this.#composition === 'mixed') return { swordsman: 40, archer: 30, cavalry: 30 };
    return { [this.#composition]: 1000 };
  }

  #planetView(planet: Planet, tick: number): PlanetView {
    return {
      id: planet.id,
      x: planet.x,
      y: planet.y,
      size: planet.size,
      ownerId: planet.ownerId,
      garrison: garrisonOf(planet),
      selected: this.#selected.has(planet.id),
      highlighted:
        this.#dragging &&
        this.#hover === planet.id &&
        this.#selected.size > 0 &&
        !this.#selected.has(planet.id),
      mine: planet.ownerId === this.#playerId && tick < 20 * 10,
      boosts: {
        production: boostRemainingTicks(planet, 'production', tick) / TICKS_PER_SECOND,
        speed: boostRemainingTicks(planet, 'speed', tick) / TICKS_PER_SECOND,
        defense: boostRemainingTicks(planet, 'defense', tick) / TICKS_PER_SECOND,
      },
    };
  }

  #arrowViews(state: GameState, tick: number): ArrowView[] {
    if (this.#selected.size === 0) return [];
    const targetId = this.#hover;
    const target = targetId !== null ? state.planets[targetId] : undefined;
    // Пока ЛКМ зажата — конец стрелки у курсора; над планетой — прилипает к ней.
    const end = target ?? this.#cursor;
    if (!end) return [];
    if (!this.#dragging && targetId === null) return [];

    const arrows: ArrowView[] = [];
    for (const sourceId of this.#selected) {
      const source = state.planets[sourceId];
      if (!source) continue;
      if (targetId !== null && sourceId === targetId) continue;
      const ticks = flightTicks(
        distance(source.x, source.y, end.x, end.y),
        speedUnitsPerSecond(source, tick, this.#balance),
      );
      arrows.push({
        fromX: source.x,
        fromY: source.y,
        toX: end.x,
        toY: end.y,
        travelSeconds: ticks / TICKS_PER_SECOND,
        valid: this.#canSend(source),
      });
    }
    return arrows;
  }

  #canSend(source: Planet): boolean {
    const troops = Math.floor((garrisonOf(source) * this.#ratio) / 100);
    return troops >= MIN_FLEET_SIZE;
  }

  #hudView(state: GameState, tick: number): HudView {
    const me = state.players[this.#playerId];
    let mine = 0;
    let enemy = 0;
    let neutral = 0;
    for (const planet of state.planets) {
      if (planet.ownerId === -1) neutral += 1;
      else if (planet.ownerId === this.#playerId) mine += 1;
      else enemy += 1;
    }

    const planetId = this.#firstSelected();
    const boosts: BoostButtonView[] = BOOST_KINDS.map((kind) => {
      const stats = this.#balance.boosts[kind];
      const cooldownTicks = Math.max(0, (me?.boostCooldownUntilTick[kind] ?? 0) - tick);
      const affordable = (me?.seeds ?? 0) >= stats.cost;
      const cooldownSeconds = cooldownTicks / TICKS_PER_SECOND;
      let blocked: string | null = null;
      if (planetId === null) blocked = 'Выбери планету';
      else if (cooldownTicks > 0) blocked = `Перезарядка ${Math.ceil(cooldownSeconds)} с`;
      else if (!affordable) blocked = `Нужно ${formatMilli(stats.cost, 0)} семечек`;
      return {
        kind,
        cost: stats.cost,
        affordable,
        cooldownSeconds,
        ready: blocked === null,
        blocked,
        planetId,
      };
    });

    const outcome = evaluateOutcome(state);

    const selectedPlanet = planetId !== null ? state.planets[planetId] : undefined;
    const queueMax = this.#balance.maxTrainingQueue;
    const queueUsed = selectedPlanet?.training.length ?? 0;
    const activeOrder = selectedPlanet?.training[0];
    const training: TrainingButtonView[] = TROOP_KINDS.map((kind) => {
      const stats = this.#balance.troops[kind];
      const affordable = (me?.seeds ?? 0) >= stats.costSeeds;
      const orders = selectedPlanet?.training.filter((order) => order.kind === kind) ?? [];
      const progress =
        activeOrder && activeOrder.kind === kind
          ? Math.min(1, activeOrder.progressTicks / Math.max(1, stats.trainTicks))
          : 0;

      let blocked: string | null = null;
      if (!selectedPlanet) blocked = 'Выбери свою планету';
      else if (selectedPlanet.ownerId !== this.#playerId) blocked = 'Только своя планета';
      else if (queueUsed >= queueMax) blocked = `Очередь заполнена (${queueUsed}/${queueMax})`;
      else if (!affordable) blocked = `Нужно ${formatMilli(stats.costSeeds, 0)} семечек`;

      return {
        kind,
        name: stats.name,
        short: stats.shortName,
        cost: stats.costSeeds,
        trainSeconds: stats.trainTicks / TICKS_PER_SECOND,
        affordable,
        ready: blocked === null,
        queued: orders.length,
        progress,
        blocked,
      };
    });

    const selected = selectedPlanet;
    const units: TroopCountView[] = TROOP_KINDS.map((kind) => {
      const stats = this.#balance.troops[kind];
      return {
        kind,
        name: stats.name,
        short: stats.shortName,
        count: selected?.troops[kind] ?? 0,
      };
    });
    const templates: CompositionTemplateView[] = [
      { id: 'all', label: 'Все', active: this.#composition === 'all' },
      { id: 'mixed', label: 'Смеш', active: this.#composition === 'mixed' },
      ...TROOP_KINDS.map((kind) => ({
        id: kind as string,
        label: this.#balance.troops[kind].shortName,
        active: this.#composition === kind,
      })),
    ];

    const garrison = {
      total: selected ? garrisonOf(selected) : 0,
      capacity: selected ? this.#balance.planetSizes[selected.size].capacity : 0,
    };
    const message =
      this.#message && tick < this.#message.untilTick ? this.#message.text : null;

    this.#rotateMasks(tick);
    this.#guarded.seeds.set(me?.seeds ?? 0);
    this.#guarded.mine.set(mine);
    this.#guarded.enemy.set(enemy);
    this.#guarded.neutral.set(neutral);
    if (Object.values(this.#guarded).some((guarded) => guarded.tampered)) {
      this.#tampered = true;
    }

    return {
      seeds: this.#guarded.seeds.value,
      mine: this.#guarded.mine.value,
      enemy: this.#guarded.enemy.value,
      neutral: this.#guarded.neutral.value,
      clanName: me ? (this.#balance.clans[me.clanId]?.name ?? '') : '',
      boosts,
      training,
      composition: { units, templates, mode: this.#composition },
      garrison,
      queue: { used: queueUsed, max: queueMax },
      message,
      outcome: outcome.finished
        ? { finished: true, winnerId: outcome.winnerId, youWon: outcome.winnerId === this.#playerId }
        : null,
      hint: this.#hint(state, mine, planetId),
      tampered: this.#tampered,
    };
  }

  /** Раз в 5 секунд меняем ключ маскировки, перешифровав значения. */
  #rotateMasks(tick: number): void {
    if (tick - this.#lastMaskTick < 100) return;
    this.#lastMaskTick = tick;
    const mask = (Math.imul(tick + 1, 2654435761) ^ (this.#playerId + 1)) >>> 0;
    for (const guarded of Object.values(this.#guarded)) guarded.rotate(mask);
  }

  #hint(state: GameState, mine: number, selected: PlanetId | null): string | null {
    if (state.tick < 20 * 10 && mine > 0 && selected === null) {
      return 'Тяни стрелку от своей планеты к другой — отправишь войска';
    }
    if (selected !== null && this.#hover === null) {
      return 'Отпусти на планете, чтобы отправить отряд';
    }
    return null;
  }
}
