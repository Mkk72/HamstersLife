/**
 * Презентер: жесты → команды, состояние → модель вида. Ни Pixi, ни DOM.
 * Вся логика плана, отправки и снабжения проверяется тестами без окна.
 */
import {
  UNIT_KINDS,
  countsOf,
  evaluateOutcome,
  garrisonOf,
  planSum,
  distance,
  flightTicks,
  splitArmy,
  TICKS_PER_SECOND,
} from '@hamsters/core';
import type {
  Balance,
  CommandResult,
  ContentProvider,
  GameState,
  Planet,
  PlanetId,
  PlayerId,
  Ratio,
  SimSource,
  UnitKind,
} from '@hamsters/core';
import type {
  ArrowView,
  BattleBeamView,
  BattleSideView,
  BattleUnitView,
  BattleView,
  BoardView,
  FleetView,
  GameView,
  HudView,
  PlanPanelView,
  PlanetView,
  QualityLevel,
  RouteToggleView,
  RouteView,
  TemplateView,
  UnitCountView,
} from './viewModel';

const RATIOS: readonly Ratio[] = [25, 50, 75, 100];

export interface PresenterDeps {
  readonly sim: SimSource;
  readonly view: GameView;
  readonly content: ContentProvider;
  readonly humanPlayerId: PlayerId;
  readonly initialRatio?: Ratio;
}

export class GamePresenter {
  readonly #sim: SimSource;
  readonly #view: GameView;
  readonly #playerId: PlayerId;
  readonly #balance: Balance;
  #ratio: Ratio;
  #quality: QualityLevel = 'high';
  #speed = 1;
  #selected: PlanetId | null = null;
  #hover: PlanetId | null = null;
  #cursor: { x: number; y: number } | null = null;
  #dragging = false;
  #running = false;
  #outcomePlayed = false;
  #message: { readonly text: string; readonly untilTick: number } | null = null;
  #resetBackup: { readonly planetId: PlanetId; readonly plan: Record<UnitKind, number>; readonly untilTick: number } | null =
    null;
  #seenClashes = new Set<string>();
  #seenBattles = new Set<string>();

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

  get selectedId(): PlanetId | null {
    return this.#selected;
  }

  setRatio(ratio: Ratio): void {
    if (!RATIOS.includes(ratio)) return;
    this.#ratio = ratio;
    this.render();
  }

  setQuality(quality: QualityLevel): void {
    this.#quality = quality;
    this.#view.setQuality(quality);
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
    this.#sim.setSpeed(speed);
  }

  get speed(): number {
    return this.#speed;
  }

  /** Выбор планеты: панель плана только для своей. */
  pointerDown(planetId: PlanetId): void {
    const state = this.#sim.getSnapshot();
    const planet = state.planets[planetId];
    if (!planet) return;
    if (planet.ownerId === this.#playerId) {
      this.#selected = planetId;
      this.#dragging = true;
      this.#cursor = { x: planet.x, y: planet.y };
      this.#view.playSelect();
    } else {
      this.#hover = planetId;
    }
    this.render();
  }

  pointerMove(x: number, y: number, planetId: PlanetId | null): void {
    this.#cursor = { x, y };
    this.#hover = planetId;
    this.render();
  }

  pointerHover(planetId: PlanetId | null): void {
    this.#hover = planetId;
    this.render();
  }

  clearSelection(): void {
    this.#dragging = false;
    this.#cursor = null;
    if (this.#selected === null) return;
    this.#selected = null;
    this.render();
  }

  pointerUp(): CommandResult | null {
    const target = this.#hover;
    const source = this.#selected;
    this.#hover = null;
    this.#dragging = false;
    this.#cursor = null;
    if (target === null || source === null || target === source) {
      this.render();
      return null;
    }
    const result = this.#sim.sendCommand({
      type: 'SendFleet',
      playerId: this.#playerId,
      fromPlanetIds: [source],
      toPlanetId: target,
      ratio: this.#ratio,
    });
    if (result.ok) {
      this.#view.playSend();
      this.#notify(`Отряд отправлен (${this.#ratio}%)`);
    } else {
      this.#view.playError();
      this.#notify(errorText(result.error), true);
    }
    this.render();
    return result;
  }

  /** Изменить задание рода: ±1, Shift ±5; сумма не больше вместимости. */
  changePlan(kind: UnitKind, delta: number): void {
    const state = this.#sim.getSnapshot();
    const planet = this.#selectedPlanet(state);
    if (!planet) return;
    const capacity = this.#balance.planetSizes[planet.size].capacity;
    const next = { ...planet.plan };
    next[kind] = Math.max(0, next[kind] + delta);
    if (planSum(next) > capacity) {
      this.#notify('Все ячейки распределены — уменьши другой род', true);
      this.#view.playError();
      this.render();
      return;
    }
    this.#applyPlan(planet, next);
  }

  /** Ввести число вручную. */
  setPlanValue(kind: UnitKind, value: number): void {
    const state = this.#sim.getSnapshot();
    const planet = this.#selectedPlanet(state);
    if (!planet) return;
    if (!Number.isInteger(value) || value < 0) {
      this.#notify('Нужно целое неотрицательное число', true);
      this.#view.playError();
      this.render();
      return;
    }
    const capacity = this.#balance.planetSizes[planet.size].capacity;
    const next = { ...planet.plan, [kind]: value };
    if (planSum(next) > capacity) {
      this.#notify('План больше вместимости', true);
      this.#view.playError();
      this.render();
      return;
    }
    this.#applyPlan(planet, next);
  }

  /** Сброс плана: армия сохраняется, производство останавливается. */
  resetPlan(): void {
    const state = this.#sim.getSnapshot();
    const planet = this.#selectedPlanet(state);
    if (!planet) return;
    const previous = { ...planet.plan };
    const result = this.#sim.sendCommand({
      type: 'ResetPlan',
      playerId: this.#playerId,
      planetId: planet.id,
    });
    if (!result.ok) {
      this.#notify(errorText(result.error), true);
      this.#view.playError();
    } else {
      this.#resetBackup = { planetId: planet.id, plan: previous, untilTick: state.tick + 100 };
      this.#notify('План сброшен');
    }
    this.render();
  }

  undoReset(): void {
    const state = this.#sim.getSnapshot();
    const backup = this.#resetBackup;
    if (!backup || state.tick >= backup.untilTick) return;
    this.#sim.sendCommand({
      type: 'SetPlan',
      playerId: this.#playerId,
      planetId: backup.planetId,
      plan: backup.plan,
    });
    this.#resetBackup = null;
    this.#notify('План восстановлен');
    this.render();
  }

  applyTemplate(templateId: string): void {
    const state = this.#sim.getSnapshot();
    const planet = this.#selectedPlanet(state);
    if (!planet) return;
    const result = this.#sim.sendCommand({
      type: 'ApplyTemplate',
      playerId: this.#playerId,
      planetId: planet.id,
      templateId,
    });
    if (result.ok) this.#notify('Шаблон применён');
    else {
      this.#notify(errorText(result.error), true);
      this.#view.playError();
    }
    this.render();
  }

  toggleSupply(routeId: number): void {
    const state = this.#sim.getSnapshot();
    const route = state.routes.find((item) => item.id === routeId);
    if (!route || route.ownerId !== this.#playerId) return;
    const result = this.#sim.sendCommand({
      type: 'EnableSupply',
      playerId: this.#playerId,
      routeId,
      enabled: !route.supplyEnabled,
    });
    if (result.ok) this.#notify(route.supplyEnabled ? 'Снабжение выключено' : 'Снабжение включено');
    else {
      this.#notify(errorText(result.error), true);
      this.#view.playError();
    }
    this.render();
  }

  cutRoute(routeId: number): void {
    const result = this.#sim.sendCommand({
      type: 'RemoveRoute',
      playerId: this.#playerId,
      routeId,
    });
    if (result.ok) this.#view.playCut();
    else this.#view.playError();
    this.render();
  }

  #selectedPlanet(state: GameState): Planet | null {
    if (this.#selected === null) return null;
    const planet = state.planets[this.#selected];
    if (!planet || planet.ownerId !== this.#playerId) return null;
    return planet;
  }

  #applyPlan(planet: Planet, next: Record<UnitKind, number>): void {
    const result = this.#sim.sendCommand({
      type: 'SetPlan',
      playerId: this.#playerId,
      planetId: planet.id,
      plan: next,
    });
    if (!result.ok) {
      this.#notify(errorText(result.error), true);
      this.#view.playError();
    }
    this.render();
  }

  #notify(text: string, isError = false): void {
    const tick = this.#sim.getSnapshot().tick;
    this.#message = { text: isError ? `! ${text}` : text, untilTick: tick + 60 };
  }

  render(): void {
    const view = this.buildView();
    this.#view.render(view);
    this.#detectOutcome(view);
    this.#detectBattles(view);
  }

  #detectOutcome(view: BoardView): void {
    if (this.#outcomePlayed) return;
    const outcome = view.hud.outcome;
    if (!outcome) return;
    this.#outcomePlayed = true;
    this.#view.playOutcome(outcome.youWon);
    this.#sim.stop();
  }

  #detectBattles(view: BoardView): void {
    for (const planet of view.planets) {
      const key = `${planet.id}:${planet.battleId ?? 0}`;
      if (planet.battleId !== null && !this.#seenBattles.has(key)) {
        this.#seenBattles.add(key);
      }
    }
    void this.#seenClashes;
  }

  buildView(): BoardView {
    const state = this.#sim.getSnapshot();
    const tick = state.tick;
    const selectedPlanet = this.#selected !== null ? state.planets[this.#selected] : undefined;
    const panel = this.#panelView(state, selectedPlanet);

    return {
      tick,
      planets: state.planets.map((planet) => this.#planetView(planet, selectedPlanet?.id ?? null)),
      fleets: state.fleets.map((fleet) => this.#fleetView(state, fleet, tick)),
      routes: state.routes.map((route) => this.#routeView(state, route)),
      arrows: this.#arrowViews(state),
      battles: state.battles.map((battle) => this.#battleView(state, battle)),
      hud: this.#hudView(state, panel),
    };
  }

  #battleView(state: GameState, battle: GameState['battles'][number]): BattleView {
    let x = 0;
    let y = 0;
    if (battle.planetId !== null) {
      const planet = state.planets[battle.planetId];
      x = planet?.x ?? 0;
      y = planet?.y ?? 0;
    } else if (battle.attackerRoute) {
      const from = state.planets[battle.attackerRoute.fromPlanetId];
      const to = state.planets[battle.attackerRoute.toPlanetId];
      if (from && to) {
        const share = battle.attackerRoute.progressPermille / 1000;
        x = from.x + (to.x - from.x) * share;
        y = from.y + (to.y - from.y) * share;
      }
    }

    const side = (ownerId: number, army: GameState['battles'][number]['attacker']): BattleSideView => {
      const counts = countsOf(army);
      const units: BattleUnitView[] = UNIT_KINDS.filter((kind) => counts[kind] > 0).map((kind) => ({
        kind,
        short: this.#balance.troops[kind].shortName,
        count: counts[kind],
      }));
      return { ownerId, units };
    };
    const attacker = side(battle.attackerOwnerId, battle.attacker);
    const defender = side(battle.defenderOwnerId, battle.defender);
    const defenderCounts = countsOf(battle.defender);
    const attackerCounts = countsOf(battle.attacker);
    const beams: BattleBeamView[] = [];
    for (const kind of UNIT_KINDS) {
      if (attackerCounts[kind] <= 0) continue;
      const target = this.#balance.troops[kind].priority.find((enemy) => defenderCounts[enemy] > 0);
      if (target) beams.push({ from: 'attacker', fromKind: kind, toKind: target, strength: attackerCounts[kind] });
    }
    for (const kind of UNIT_KINDS) {
      if (defenderCounts[kind] <= 0) continue;
      const target = this.#balance.troops[kind].priority.find((enemy) => attackerCounts[enemy] > 0);
      if (target) beams.push({ from: 'defender', fromKind: kind, toKind: target, strength: defenderCounts[kind] });
    }

    return {
      id: battle.id,
      planetId: battle.planetId,
      kind: battle.kind,
      x,
      y,
      round: battle.round,
      attacker,
      defender,
      beams,
    };
  }

  #planetView(planet: Planet, selectedId: PlanetId | null): PlanetView {
    const counts = countsOf(planet.army);
    const units: UnitCountView[] = UNIT_KINDS.map((kind) => ({
      kind,
      short: this.#balance.troops[kind].shortName,
      plan: planet.plan[kind],
      have: counts[kind],
      producing: planet.production[kind] > 0 && counts[kind] < planet.plan[kind],
    }));
    const screen = this.#view.toScreen(planet.x, planet.y);
    return {
      id: planet.id,
      x: planet.x,
      y: planet.y,
      size: planet.size,
      ownerId: planet.ownerId,
      total: garrisonOf(planet),
      units,
      selected: selectedId === planet.id,
      highlighted: this.#dragging && this.#hover === planet.id && this.#selected !== planet.id,
      battleId: planet.battleId,
      screenX: screen.x,
      screenY: screen.y,
    };
  }

  #fleetView(state: GameState, fleet: GameState['fleets'][number], tick: number): FleetView {
    const from = state.planets[fleet.fromPlanetId];
    const to = state.planets[fleet.toPlanetId];
    const span = Math.max(1, fleet.arriveTick - fleet.departTick);
    const elapsed = Math.min(span, Math.max(0, tick - fleet.departTick));
    const start = fleet.startProgressPermille;
    const progress = Math.min(1, (start + ((1000 - start) * elapsed) / span) / 1000);
    const counts = countsOf(fleet.army);
    const units = UNIT_KINDS.filter((kind) => counts[kind] > 0).map((kind) => ({
      kind,
      count: counts[kind],
    }));
    return {
      id: fleet.id,
      ownerId: fleet.ownerId,
      fromX: from?.x ?? 0,
      fromY: from?.y ?? 0,
      toX: to?.x ?? 0,
      toY: to?.y ?? 0,
      progress,
      total: fleet.army.length,
      units,
    };
  }

  #routeView(state: GameState, route: GameState['routes'][number]): RouteView {
    const from = state.planets[route.fromPlanetId];
    const to = state.planets[route.toPlanetId];
    return {
      id: route.id,
      ownerId: route.ownerId,
      fromX: from?.x ?? 0,
      fromY: from?.y ?? 0,
      toX: to?.x ?? 0,
      toY: to?.y ?? 0,
      supplyEnabled: route.supplyEnabled,
    };
  }

  #arrowViews(state: GameState): ArrowView[] {
    if (this.#selected === null) return [];
    const source = state.planets[this.#selected];
    if (!source) return [];
    const target = this.#hover !== null ? state.planets[this.#hover] : undefined;
    const end = target ?? this.#cursor;
    if (!end || (target && target.id === source.id)) return [];
    const ticks = flightTicks(
      distance(source.x, source.y, end.x, end.y),
      this.#balance.flightSpeedUnitsPerSecond,
    );
    return [
      {
        fromX: source.x,
        fromY: source.y,
        toX: end.x,
        toY: end.y,
        travelSeconds: ticks / TICKS_PER_SECOND,
        valid: source.army.length > 0 && source.battleId === null,
      },
    ];
  }

  #panelView(state: GameState, planet: Planet | undefined): PlanPanelView | null {
    if (!planet || planet.ownerId !== this.#playerId) return null;
    const counts = countsOf(planet.army);
    const units: UnitCountView[] = UNIT_KINDS.map((kind) => ({
      kind,
      short: this.#balance.troops[kind].shortName,
      plan: planet.plan[kind],
      have: counts[kind],
      producing: planet.production[kind] > 0 && counts[kind] < planet.plan[kind],
    }));
    const templates: TemplateView[] = this.#balance.templates.map((template) => ({
      id: template.id,
      name: template.name,
    }));
    const routes: RouteToggleView[] = state.routes
      .filter((route) => route.fromPlanetId === planet.id && route.ownerId === this.#playerId)
      .map((route) => ({
        id: route.id,
        label: `→ ${route.toPlanetId}`,
        enabled: route.supplyEnabled,
      }));
    const screen = this.#view.toScreen(planet.x, planet.y);
    const message =
      this.#message && state.tick < this.#message.untilTick ? this.#message.text : null;
    return {
      planetId: planet.id,
      screenX: screen.x,
      screenY: screen.y,
      size: planet.size,
      total: planet.army.length,
      capacity: this.#balance.planetSizes[planet.size].capacity,
      planTotal: planSum(planet.plan),
      units,
      templates,
      routes,
      message,
      canUndoReset:
        this.#resetBackup !== null &&
        this.#resetBackup.planetId === planet.id &&
        state.tick < this.#resetBackup.untilTick,
    };
  }

  #hudView(state: GameState, panel: PlanPanelView | null): HudView {
    let mine = 0;
    let enemy = 0;
    let neutral = 0;
    for (const planet of state.planets) {
      if (planet.ownerId === -1) neutral += 1;
      else if (planet.ownerId === this.#playerId) mine += 1;
      else enemy += 1;
    }
    const outcome = evaluateOutcome(state);
    return {
      mine,
      enemy,
      neutral,
      ratio: this.#ratio,
      panel,
      sendPreview: this.#sendPreview(state),
      outcome: outcome.finished
        ? { finished: true, winnerId: outcome.winnerId, youWon: outcome.winnerId === this.#playerId }
        : null,
      hint: this.#hint(state),
      battleCount: state.battles.length,
    };
  }

  #hint(state: GameState): string | null {
    if (state.tick < 200 && this.#selected === null) {
      return 'Клик по своей планете — план гарнизона и отправка';
    }
    if (this.#selected !== null && this.#hover === null) {
      return 'Тяни стрелку к цели и отпусти — уйдёт разовый отряд';
    }
    return null;
  }

  /** Точный состав разового отряда для подсказки до отпускания. */
  #sendPreview(state: GameState): { short: string; count: number }[] | null {
    if (this.#selected === null || this.#hover === null) return null;
    const source = state.planets[this.#selected];
    if (!source || source.id === this.#hover) return null;
    const split = splitArmy(source.army, this.#ratio);
    const counts = countsOf(split.taken);
    return UNIT_KINDS.filter((kind) => counts[kind] > 0).map((kind) => ({
      short: this.#balance.troops[kind].shortName,
      count: counts[kind],
    }));
  }
}

function errorText(code: string): string {
  const map: Record<string, string> = {
    'invalid-plan': 'План больше вместимости',
    'in-battle': 'Из боя отправлять нельзя',
    'too-many-routes': 'Слишком много маршрутов',
    'no-troops': 'Нет войск для отправки',
    'not-your-planet': 'Только своя планета',
    'unknown-template': 'Неизвестный шаблон',
    'invalid-ratio': 'Недопустимая доля',
  };
  return map[code] ?? 'Команда отклонена';
}

export { RATIOS };
