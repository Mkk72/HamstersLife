/**
 * Презентер партии: превращает жесты в команды, проверяет доступность и
 * собирает модель представления. Ни Pixi, ни DOM здесь нет — поэтому тесты
 * идут без окна, а вид можно заменить (Pixi, отладочный текстовый, скриншот).
 */
import {
  BOOST_KINDS,
  MIN_FLEET_SIZE,
  TICKS_PER_SECOND,
  boostRemainingTicks,
  distance,
  evaluateOutcome,
  flightTicks,
  speedUnitsPerSecond,
} from '@hamsters/core';
import type {
  Balance,
  BoostKind,
  CommandResult,
  ContentProvider,
  GameState,
  Planet,
  PlanetId,
  PlayerId,
  Ratio,
  SimSource,
} from '@hamsters/core';
import type {
  ArrowView,
  BoardView,
  BoostButtonView,
  GameView,
  HudView,
  PlanetView,
  QualityLevel,
} from './viewModel';

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
  #ratio: Ratio;
  #quality: QualityLevel = 'high';
  #running = false;

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
    this.render();
  }

  /** Курсор над планетой (или мимо): отсюда берётся цель для стрелки. */
  pointerHover(planetId: PlanetId | null): void {
    this.#hover = planetId;
    this.render();
  }

  /** Отпускание: если есть выбор и цель — отправить флот. */
  pointerUp(): CommandResult | null {
    const target = this.#hover;
    this.#hover = null;
    if (target === null) {
      this.render();
      return null;
    }
    const result = this.#sendFleet(target);
    this.render();
    return result;
  }

  /** Буст применяется к первой выбранной планете. */
  applyBoost(kind: BoostKind): CommandResult | null {
    const planetId = this.#firstSelected();
    if (planetId === null) return null;
    const result = this.#sim.sendCommand({
      type: 'ApplyBoost',
      playerId: this.#playerId,
      planetId,
      boost: kind,
    });
    if (result.ok) this.#view.playBoost(planetId, kind);
    this.render();
    return result;
  }

  render(): void {
    this.#view.render(this.buildView());
  }

  /** Снимок для отладки и тестов: тот же объект, что уходит в вид. */
  buildView(): BoardView {
    const state = this.#sim.getSnapshot();
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
          troops: fleet.troops,
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
    return this.#sim.sendCommand({
      type: 'SendFleet',
      playerId: this.#playerId,
      fromPlanetIds: sources,
      toPlanetId: target,
      ratio: this.#ratio,
    });
  }

  #planetView(planet: Planet, tick: number): PlanetView {
    return {
      id: planet.id,
      x: planet.x,
      y: planet.y,
      size: planet.size,
      ownerId: planet.ownerId,
      garrison: planet.garrison,
      selected: this.#selected.has(planet.id),
      boosts: {
        production: boostRemainingTicks(planet, 'production', tick) / TICKS_PER_SECOND,
        speed: boostRemainingTicks(planet, 'speed', tick) / TICKS_PER_SECOND,
        defense: boostRemainingTicks(planet, 'defense', tick) / TICKS_PER_SECOND,
      },
    };
  }

  #arrowViews(state: GameState, tick: number): ArrowView[] {
    const targetId = this.#hover;
    if (targetId === null || this.#selected.size === 0) return [];
    const target = state.planets[targetId];
    if (!target || this.#selected.has(targetId)) return [];
    const arrows: ArrowView[] = [];
    for (const sourceId of this.#selected) {
      const source = state.planets[sourceId];
      if (!source) continue;
      const ticks = flightTicks(
        distance(source.x, source.y, target.x, target.y),
        speedUnitsPerSecond(source, tick, this.#balance),
      );
      arrows.push({
        fromX: source.x,
        fromY: source.y,
        toX: target.x,
        toY: target.y,
        travelSeconds: ticks / TICKS_PER_SECOND,
        valid: this.#canSend(source),
      });
    }
    return arrows;
  }

  #canSend(source: Planet): boolean {
    const troops = Math.floor((source.garrison * this.#ratio) / 100);
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
      return {
        kind,
        cost: stats.cost,
        affordable,
        cooldownSeconds: cooldownTicks / TICKS_PER_SECOND,
        ready: cooldownTicks === 0 && affordable && planetId !== null,
        planetId,
      };
    });

    const outcome = evaluateOutcome(state);

    return {
      seeds: me?.seeds ?? 0,
      mine,
      enemy,
      neutral,
      boosts,
      outcome: outcome.finished
        ? { finished: true, winnerId: outcome.winnerId, youWon: outcome.winnerId === this.#playerId }
        : null,
      hint: this.#hint(state, mine, planetId),
    };
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
