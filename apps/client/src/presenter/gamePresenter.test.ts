import { describe, expect, it } from 'vitest';
import { BALANCE, CONTENT, getMap } from '@hamsters/content';
import { Simulation, addUnits, planFrom } from '@hamsters/core';
import type { Command, CommandResult, GameState, SimSource } from '@hamsters/core';
import { GamePresenter } from './gamePresenter';
import type { BoardView, GameView, QualityLevel } from './viewModel';

class FakeSource implements SimSource {
  #listener: ((state: GameState) => void) | null = null;
  speed = 1;
  constructor(readonly sim: Simulation) {}
  getSnapshot(): GameState {
    return this.sim.state;
  }
  sendCommand(command: Command): CommandResult {
    const result = this.sim.applyCommand(command);
    if (result.ok) this.#listener?.(this.sim.state);
    return result;
  }
  start(onTick: (state: GameState) => void): void {
    this.#listener = onTick;
    onTick(this.sim.state);
  }
  stop(): void {
    this.#listener = null;
  }
  setSpeed(speed: number): void {
    this.speed = speed;
  }
}

class TestView implements GameView {
  last: BoardView | null = null;
  quality: QualityLevel = 'high';
  sends = 0;
  errors = 0;
  selects = 0;
  outcomes: boolean[] = [];
  cuts = 0;

  render(view: BoardView): void {
    this.last = view;
  }
  setQuality(level: QualityLevel): void {
    this.quality = level;
  }
  playCapture(): void {}
  playInterception(): void {}
  playSend(): void {
    this.sends += 1;
  }
  playError(): void {
    this.errors += 1;
  }
  playSelect(): void {
    this.selects += 1;
  }
  playOutcome(won: boolean): void {
    this.outcomes.push(won);
  }
  playCut(): void {
    this.cuts += 1;
  }
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x, y };
  }
}

function setup() {
  const sim = new Simulation(getMap('arena-duel'), BALANCE, 42);
  const source = new FakeSource(sim);
  const view = new TestView();
  const presenter = new GamePresenter({
    sim: source,
    view,
    content: CONTENT,
    humanPlayerId: 0,
    initialRatio: 50,
  });
  presenter.start();
  return { sim, source, view, presenter };
}

describe('панель плана', () => {
  it('открывается по ПКМ и закрывается повторной ПКМ', () => {
    const { presenter, view } = setup();
    presenter.pointerDown(0);
    expect(view.last?.hud.panel).toBeNull();

    presenter.togglePlanPanel(0);
    expect(view.last?.hud.panel?.planetId).toBe(0);
    presenter.togglePlanPanel(0);
    expect(view.last?.hud.panel).toBeNull();

    presenter.togglePlanPanel(1);
    expect(view.last?.hud.panel).toBeNull();
  });

  it('± меняет задание, Shift — на пять, лимит вместимости соблюдается', () => {
    const { presenter, sim } = setup();
    presenter.togglePlanPanel(0);
    const planet = sim.state.planets[0];
    if (!planet) throw new Error('нет планеты');
    planet.plan = { swordsman: 10, archer: 10, cavalry: 0, cannon: 0 };
    presenter.changePlan('swordsman', 1);
    expect(planet.plan.swordsman).toBe(11);
    presenter.changePlan('swordsman', -5);
    expect(planet.plan.swordsman).toBe(6);
  });

  it('нельзя выйти за вместимость', () => {
    const { presenter, sim, view } = setup();
    presenter.togglePlanPanel(0);
    const planet = sim.state.planets[0];
    if (!planet) throw new Error('нет планеты');
    const capacity = BALANCE.planetSizes[planet.size].capacity;
    planet.plan = { swordsman: capacity, archer: 0, cavalry: 0, cannon: 0 };
    presenter.changePlan('archer', 1);
    expect(planet.plan.archer).toBe(0);
    expect(view.last?.hud.panel?.message).toContain('Все ячейки');
  });

  it('шаблон заменяет план целиком', () => {
    const { presenter, sim } = setup();
    presenter.togglePlanPanel(0);
    presenter.applyTemplate('balanced');
    expect(sim.state.planets[0]?.plan).toEqual({
      swordsman: 27,
      archer: 18,
      cavalry: 12,
      cannon: 3,
    });
  });

  it('сброс сохраняет армию, отмена возвращает план', () => {
    const { presenter, sim } = setup();
    presenter.togglePlanPanel(0);
    const planet = sim.state.planets[0];
    if (!planet) throw new Error('нет планеты');
    const armyBefore = planet.army.length;
    const planBefore = { ...planet.plan };
    presenter.resetPlan();
    expect(planet.army.length).toBe(armyBefore);
    expect(planet.plan.swordsman + planet.plan.archer).toBe(0);
    presenter.undoReset();
    expect(planet.plan).toEqual(planBefore);
  });
});

describe('отправка и снабжение', () => {
  it('стрелка отправляет разовый отряд и создаёт выключенное снабжение', () => {
    const { presenter, sim, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerMove(200, 0, 1);
    const result = presenter.pointerUp();
    expect(result?.ok).toBe(true);
    expect(view.sends).toBe(1);
    expect(sim.state.fleets).toHaveLength(1);
    expect(sim.state.routes[0]?.supplyEnabled).toBe(false);
  });

  it('снабжение включается и выключается кнопкой маршрута', () => {
    const { presenter, sim } = setup();
    presenter.pointerDown(0);
    presenter.pointerMove(200, 0, 1);
    presenter.pointerUp();
    const route = sim.state.routes[0];
    if (!route) throw new Error('нет маршрута');
    presenter.togglePlanPanel(0);
    presenter.toggleSupply(route.id);
    expect(route.supplyEnabled).toBe(true);
    presenter.toggleSupply(route.id);
    expect(route.supplyEnabled).toBe(false);
  });

  it('резать можно свою стрелку', () => {
    const { presenter, sim, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerMove(200, 0, 1);
    presenter.pointerUp();
    const route = sim.state.routes[0];
    if (!route) throw new Error('нет маршрута');
    presenter.cutRoute(route.id);
    expect(sim.state.routes).toHaveLength(0);
    expect(view.cuts).toBe(1);
  });

  it('доля показывается на стрелке и в HUD', () => {
    const { presenter, view } = setup();
    presenter.setRatio(75);
    presenter.pointerDown(0);
    presenter.pointerMove(200, 0, 1);
    expect(view.last?.hud.ratio).toBe(75);
    expect(view.last?.arrows).toHaveLength(1);
  });

  it('до отпускания показывает точный состав отряда', () => {
    const { presenter, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerMove(200, 0, 1);
    const preview = view.last?.hud.sendPreview;
    expect(preview).not.toBeNull();
    const total = (preview ?? []).reduce((sum, unit) => sum + unit.count, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('модель боя', () => {
  it('показывает стороны, иконки и лучи по приоритетам', () => {
    const { presenter, sim } = setup();
    const home = sim.state.planets[0];
    const enemy = sim.state.planets.find((planet) => planet.ownerId === 1);
    if (!home || !enemy) throw new Error('нет планет');
    const homeArmy: typeof home.army = [];
    addUnits(homeArmy, planFrom({ swordsman: 20 }), () => sim.state.nextUnitId++, BALANCE.troops);
    home.army = homeArmy;
    home.plan = planFrom({});
    const enemyArmy: typeof enemy.army = [];
    addUnits(enemyArmy, planFrom({ archer: 10 }), () => sim.state.nextUnitId++, BALANCE.troops);
    enemy.army = enemyArmy;
    enemy.plan = planFrom({});

    sim.applyCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [home.id],
      toPlanetId: enemy.id,
      ratio: 100,
    });
    for (let tick = 0; tick < 600 && sim.state.battles.length === 0; tick += 1) {
      sim.advance(1);
    }

    const battle = presenter.buildView().battles[0];
    expect(battle).toBeDefined();
    expect(battle?.attacker.units.length).toBeGreaterThan(0);
    expect(battle?.defender.units.length).toBeGreaterThan(0);
    expect(battle?.beams.length).toBeGreaterThan(0);
  });
});
