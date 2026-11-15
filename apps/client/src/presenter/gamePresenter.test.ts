import { describe, expect, it } from 'vitest';
import { BALANCE, CONTENT, getMap } from '@hamsters/content';
import { Simulation, garrisonOf, troopTotal } from '@hamsters/core';
import type { BoostKind, Command, CommandResult, GameState, PlanetId, SimSource } from '@hamsters/core';
import type { BoardView, GameView, QualityLevel } from './viewModel';
import { GamePresenter } from './gamePresenter';

/** Тестовый источник: та же партия, но время двигает тест. */
class TestSimSource implements SimSource {
  #listener: ((snapshot: GameState) => void) | null = null;

  constructor(readonly sim: Simulation) {}

  getSnapshot(): GameState {
    return this.sim.state;
  }

  sendCommand(command: Command): CommandResult {
    const result = this.sim.applyCommand(command);
    if (result.ok) this.#listener?.(this.sim.state);
    return result;
  }

  start(onTick: (snapshot: GameState) => void): void {
    this.#listener = onTick;
    onTick(this.sim.state);
  }

  stop(): void {
    this.#listener = null;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  speed = 1;

  advance(ticks: number): void {
    this.sim.advance(ticks);
    this.#listener?.(this.sim.state);
  }
}

/** Тестовый вид: ничего не рисует, запоминает последнюю модель. */
class TestView implements GameView {
  last: BoardView | null = null;
  quality: QualityLevel = 'high';
  captures: PlanetId[] = [];
  boosts: BoostKind[] = [];
  sends = 0;
  errors = 0;
  selects = 0;
  outcomes: boolean[] = [];
  cuts = 0;
  trains = 0;

  render(view: BoardView): void {
    this.last = view;
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
  }

  playCapture(planetId: PlanetId): void {
    this.captures.push(planetId);
  }

  playBoost(_planetId: PlanetId, kind: BoostKind): void {
    this.boosts.push(kind);
  }

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

  playTrain(): void {
    this.trains += 1;
  }
}

function setup(options: { ratio?: 25 | 50 | 75 | 100 } = {}) {
  const sim = new Simulation(getMap('arena-duel'), BALANCE, 42);
  const source = new TestSimSource(sim);
  const view = new TestView();
  const presenter = new GamePresenter({
    sim: source,
    view,
    content: CONTENT,
    humanPlayerId: 0,
    ...(options.ratio ? { initialRatio: options.ratio } : {}),
  });
  presenter.start();
  return { sim, source, view, presenter };
}

describe('выбор планет', () => {
  it('выбирает свою планету и показывает это виду', () => {
    const { presenter, view } = setup();
    presenter.pointerDown(0);

    expect(presenter.selectedIds).toEqual([0]);
    expect(view.last?.planets.find((planet) => planet.id === 0)?.selected).toBe(true);
    expect(view.selects).toBe(1);
  });

  it('не выбирает чужую и нейтральную', () => {
    const { presenter } = setup();
    presenter.pointerDown(1);
    presenter.pointerDown(2);
    expect(presenter.selectedIds).toEqual([]);
  });

  it('простое нажатие заменяет выбор, Shift добавляет и снимает', () => {
    const { presenter } = setup();
    presenter.pointerDown(0);
    presenter.pointerDown(8, true);
    // 8 — нейтрал, добавить нельзя
    expect(presenter.selectedIds).toEqual([0]);
    presenter.pointerDown(0, true);
    expect(presenter.selectedIds).toEqual([]);
    presenter.pointerDown(0);
    presenter.pointerDown(0, true);
    expect(presenter.selectedIds).toEqual([]);
  });
});

describe('отправка флота', () => {
  it('отправляет отряд из выбранной планеты в цель', () => {
    const { presenter, source, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerHover(8);
    const result = presenter.pointerUp();

    expect(result?.ok).toBe(true);
    expect(view.sends).toBe(1);
    expect(source.sim.state.fleets).toHaveLength(1);
    expect(source.sim.state.fleets[0]?.fromPlanetId).toBe(0);
    expect(source.sim.state.fleets[0]?.toPlanetId).toBe(8);
  });

  it('без цели ничего не отправляет', () => {
    const { presenter, source } = setup();
    presenter.pointerDown(0);
    expect(presenter.pointerUp()).toBeNull();
    expect(source.sim.state.fleets).toHaveLength(0);
  });

  it('не отправляет на свою же планету', () => {
    const { presenter, source } = setup();
    presenter.pointerDown(0);
    presenter.pointerHover(0);
    expect(presenter.pointerUp()).toBeNull();
    expect(source.sim.state.fleets).toHaveLength(0);
  });

  it('использует выбранную долю и меняет её', () => {
    const { presenter, source } = setup();
    const home = source.sim.state.planets[0];
    if (!home) throw new Error('нет планеты');
    const expected = Math.floor((garrisonOf(home) * 25) / 100);

    presenter.setRatio(25);
    expect(presenter.ratio).toBe(25);
    presenter.pointerDown(0);
    presenter.pointerHover(8);
    presenter.pointerUp();
    expect(troopTotal(source.sim.state.fleets[0]!.troops)).toBe(expected);
  });

  it('строит стрелку с временем полёта при наведении', () => {
    const { presenter, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerHover(8);

    const arrows = view.last?.arrows ?? [];
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.travelSeconds).toBeGreaterThan(0);
    expect(arrows[0]?.valid).toBe(true);
  });
});

describe('маршруты и скорость', () => {
  it('показывает постоянный маршрут в модели', () => {
    const { presenter, view } = setup();
    presenter.pointerDown(0);
    presenter.pointerHover(8);
    presenter.pointerUp();

    const route = view.last?.routes[0];
    expect(view.last?.routes).toHaveLength(1);
    expect(route?.weightPermille).toBe(500);
    expect(route?.toX).toBeGreaterThan(route?.fromX ?? 0);
  });

  it('отрезает маршрут по id', () => {
    const { presenter, view, source } = setup();
    presenter.pointerDown(0);
    presenter.pointerHover(8);
    presenter.pointerUp();
    const routeId = view.last?.routes[0]?.id;
    if (routeId === undefined) throw new Error('нет маршрута');

    const result = presenter.cutRoute(routeId);

    expect(result?.ok).toBe(true);
    expect(source.sim.state.routes).toHaveLength(0);
    expect(view.cuts).toBe(1);
  });

  it('передаёт скорость в источник состояния', () => {
    const { presenter, source } = setup();
    presenter.setSpeed(0.4);
    expect(presenter.speed).toBe(0.4);
    expect(source.speed).toBe(0.4);
  });
});

describe('обучение войск', () => {
  it('кнопки обучения активны только при выбранной своей планете', () => {
    const { presenter, view } = setup();
    expect(view.last?.hud.training.every((troop) => !troop.ready)).toBe(true);

    presenter.pointerDown(0);
    const training = view.last?.hud.training ?? [];
    expect(training).toHaveLength(5);
    expect(training.every((troop) => troop.ready)).toBe(true);
    expect(training.map((troop) => troop.kind)).toContain('cavalry');
  });

  it('заказывает обучение и просит звук', () => {
    const { presenter, view, source } = setup();
    presenter.pointerDown(0);

    const result = presenter.train('cavalry', 2);

    expect(result?.ok).toBe(true);
    expect(view.trains).toBe(1);
    expect(source.sim.state.planets[0]?.training).toHaveLength(1);
    expect(source.sim.state.planets[0]?.training[0]?.kind).toBe('cavalry');
  });

  it('без выбора не заказывает обучение', () => {
    const { presenter } = setup();
    expect(presenter.train('swordsman')).toBeNull();
  });
});

describe('бусты', () => {
  it('применяет буст к выбранной планете и просит эффект', () => {
    const { presenter, view, source } = setup();
    presenter.pointerDown(0);
    const result = presenter.applyBoost('production');

    expect(result?.ok).toBe(true);
    expect(view.boosts).toEqual(['production']);
    expect(source.sim.state.planets[0]?.boosts.production).toBeGreaterThan(0);
  });

  it('без выбора ничего не делает', () => {
    const { presenter } = setup();
    expect(presenter.applyBoost('production')).toBeNull();
  });

  it('сообщает об отказе звуком', () => {
    const { presenter, view, source } = setup();
    const player = source.sim.state.players[0];
    if (!player) throw new Error('нет игрока');
    player.seeds = 0;
    presenter.pointerDown(0);

    const result = presenter.applyBoost('production');
    expect(result?.ok).toBe(false);
    expect(view.errors).toBe(1);
  });

  it('показывает доступность в HUD', () => {
    const { view } = setup();
    const buttons = view.last?.hud.boosts ?? [];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.affordable)).toBe(true);
  });
});

describe('HUD', () => {
  it('считает планеты по владельцам и семечки', () => {
    const { view } = setup();
    const hud = view.last?.hud;
    expect(hud?.mine).toBe(1);
    expect(hud?.enemy).toBe(1);
    expect(hud?.neutral).toBe(11);
    expect(hud?.seeds).toBe(BALANCE.startingSeeds);
  });

  it('подсказывает управление в начале партии', () => {
    const { view } = setup();
    expect(view.last?.hud.hint).toMatch(/Тяни стрелку/);
  });

  it('показывает итог, когда противник выбыл', () => {
    const { view, source } = setup();
    const enemy = source.sim.state.planets[1];
    if (!enemy) throw new Error('нет планеты');
    enemy.ownerId = 0;
    source.advance(1);

    expect(view.last?.hud.outcome).toMatchObject({ finished: true, youWon: true });
    expect(view.outcomes).toEqual([true]);
  });

  it('просит эффект захвата при смене владельца', () => {
    const { view, source } = setup();
    const neutral = source.sim.state.planets[2];
    if (!neutral) throw new Error('нет планеты');
    neutral.ownerId = 0;
    source.advance(1);

    expect(view.captures).toContain(2);
  });
});
