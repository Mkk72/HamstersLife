import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { addUnits, countsOf, planFrom } from './army';
import { applyCommand } from './commands';
import { createGameState } from './state';
import { runTicks } from './tick';
import type { GameState, Planet, UnitKind } from './types';

function setup(): { state: GameState; home: Planet; target: Planet } {
  const state = createGameState(mapFour, testBalance, 1);
  const home = state.planets[0];
  const target = state.planets[2];
  if (!home || !target) throw new Error('нет планет');
  return { state, home, target };
}

function setArmy(state: GameState, planet: Planet, counts: Partial<Record<UnitKind, number>>): void {
  planet.army = [];
  addUnits(planet.army, planFrom(counts), () => state.nextUnitId++, testBalance.troops);
  planet.plan = planFrom(counts);
}

describe('команды плана', () => {
  it('шаблон заполняет вместимость ровно', () => {
    const { state, home } = setup();
    const result = applyCommand(
      state,
      { type: 'ApplyTemplate', playerId: 0, planetId: home.id, templateId: 'balanced' },
      testBalance,
    );
    expect(result.ok).toBe(true);
    expect(home.plan).toEqual({ swordsman: 27, archer: 18, cavalry: 12, cannon: 3 });
  });

  it('нельзя задать план больше вместимости', () => {
    const { state, home } = setup();
    const result = applyCommand(
      state,
      { type: 'SetPlan', playerId: 0, planetId: home.id, plan: { swordsman: 61 } },
      testBalance,
    );
    expect(result).toEqual({ ok: false, error: 'invalid-plan' });
  });

  it('сброс плана сохраняет армию и останавливает производство', () => {
    const { state, home } = setup();
    setArmy(state, home, { swordsman: 12 });
    const result = applyCommand(
      state,
      { type: 'ResetPlan', playerId: 0, planetId: home.id },
      testBalance,
    );
    expect(result.ok).toBe(true);
    expect(home.army).toHaveLength(12);
    expect(home.plan).toEqual({ swordsman: 0, archer: 0, cavalry: 0, cannon: 0 });
    runTicks(state, testBalance, 40);
    expect(home.army).toHaveLength(12);
  });
});

describe('разовая отправка', () => {
  it('половина от 22 — ровно 11, распределение крупнейшими остатками', () => {
    const { state, home, target } = setup();
    setArmy(state, home, { swordsman: 10, archer: 8, cavalry: 3, cannon: 1 });

    const result = applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [home.id], toPlanetId: target.id, ratio: 50 },
      testBalance,
    );
    expect(result.ok).toBe(true);
    const fleet = state.fleets[0];
    expect(fleet).toBeDefined();
    expect(fleet ? countsOf(fleet.army) : null).toEqual({
      swordsman: 5,
      archer: 4,
      cavalry: 2,
      cannon: 0,
    });
    expect(countsOf(home.army)).toEqual({ swordsman: 5, archer: 4, cavalry: 1, cannon: 1 });
  });

  it('доля конкретного рода считается от него', () => {
    const { state, home, target } = setup();
    setArmy(state, home, { archer: 8 });

    applyCommand(
      state,
      {
        type: 'SendFleet',
        playerId: 0,
        fromPlanetIds: [home.id],
        toPlanetId: target.id,
        ratio: 50,
        kind: 'archer',
      },
      testBalance,
    );
    expect(state.fleets[0] ? countsOf(state.fleets[0]!.army) : null).toEqual({
      swordsman: 0,
      archer: 4,
      cavalry: 0,
      cannon: 0,
    });
  });

  it('создаёт выключенное снабжение и не трогает план', () => {
    const { state, home, target } = setup();
    setArmy(state, home, { swordsman: 10 });
    home.plan = planFrom({ swordsman: 20 });

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [home.id], toPlanetId: target.id, ratio: 50 },
      testBalance,
    );
    expect(state.routes[0]?.supplyEnabled).toBe(false);
    expect(home.plan.swordsman).toBe(20);
  });

  it('из боя отправлять нельзя', () => {
    const { state, home, target } = setup();
    setArmy(state, home, { swordsman: 10 });
    home.battleId = 1;
    const result = applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [home.id], toPlanetId: target.id, ratio: 50 },
      testBalance,
    );
    expect(result).toEqual({ ok: false, error: 'in-battle' });
  });
});

describe('снабжение', () => {
  it('включается и выключается только на своём маршруте', () => {
    const { state, home, target } = setup();
    setArmy(state, home, { swordsman: 10 });
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [home.id], toPlanetId: target.id, ratio: 50 },
      testBalance,
    );
    const route = state.routes[0];
    if (!route) throw new Error('нет маршрута');

    const foreign = applyCommand(
      state,
      { type: 'EnableSupply', playerId: 1, routeId: route.id, enabled: true },
      testBalance,
    );
    expect(foreign).toEqual({ ok: false, error: 'not-your-route' });

    const own = applyCommand(
      state,
      { type: 'EnableSupply', playerId: 0, routeId: route.id, enabled: true },
      testBalance,
    );
    expect(own.ok).toBe(true);
    expect(route.supplyEnabled).toBe(true);

    const removed = applyCommand(
      state,
      { type: 'RemoveRoute', playerId: 0, routeId: route.id },
      testBalance,
    );
    expect(removed.ok).toBe(true);
    expect(state.routes).toHaveLength(0);
  });
});
