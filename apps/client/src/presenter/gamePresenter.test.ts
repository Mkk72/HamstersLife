import { describe, expect, it } from 'vitest';
import { BALANCE, CONTENT, getMap } from '@hamsters/content';
import { Simulation } from '@hamsters/core';
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
    presenter.setRatio(25);
    expect(presenter.ratio).toBe(25);
    presenter.pointerDown(0);
    presenter.pointerHover(8);
    presenter.pointerUp();
    // M: 12 000 mH, 25% = 3000
    expect(source.sim.state.fleets[0]?.troops).toBe(3000);
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
