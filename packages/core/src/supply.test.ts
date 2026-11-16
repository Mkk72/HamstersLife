import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { addUnits, countsOf, planFrom } from './army';
import { createGameState } from './state';
import { runTicks } from './tick';
import type { GameState, Planet, UnitKind } from './types';

function setup(): { state: GameState; home: Planet } {
  const state = createGameState(mapFour, testBalance, 1);
  const home = state.planets[0];
  if (!home) throw new Error('нет планеты');
  return { state, home };
}

function setArmy(state: GameState, planet: Planet, counts: Partial<Record<UnitKind, number>>): void {
  planet.army = [];
  addUnits(planet.army, planFrom(counts), () => state.nextUnitId++, testBalance.troops);
}

describe('постоянное снабжение', () => {
  it('резерв — половина задания, остальное уходит раз в две секунды', () => {
    const { state, home } = setup();
    setArmy(state, home, { swordsman: 20 });
    home.plan = planFrom({ swordsman: 10 });
    state.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: home.id,
      toPlanetId: 1,
      weightPermille: 1000,
      supplyEnabled: true,
      supplyKinds: ['swordsman', 'archer', 'cavalry', 'cannon'],
    });

    runTicks(state, testBalance, 39);
    expect(state.fleets).toHaveLength(0);
    runTicks(state, testBalance, 1);
    expect(countsOf(home.army).swordsman).toBe(5);
    expect(state.fleets[0] ? countsOf(state.fleets[0]!.army).swordsman : 0).toBe(15);
  });

  it('несколько маршрутов делят целых юнитов по весам', () => {
    const { state, home } = setup();
    setArmy(state, home, { swordsman: 20 });
    home.plan = planFrom({ swordsman: 10 });
    state.routes.push(
      {
        id: 1,
        ownerId: 0,
        fromPlanetId: home.id,
        toPlanetId: 1,
        weightPermille: 1000,
        supplyEnabled: true,
        supplyKinds: ['swordsman'],
      },
      {
        id: 2,
        ownerId: 0,
        fromPlanetId: home.id,
        toPlanetId: 2,
        weightPermille: 1000,
        supplyEnabled: true,
        supplyKinds: ['swordsman'],
      },
    );

    runTicks(state, testBalance, 40);
    const sent = state.fleets.reduce((sum, fleet) => sum + fleet.army.length, 0);
    expect(sent).toBe(15);
    expect(state.fleets[0]?.army.length).toBe(8);
    expect(state.fleets[1]?.army.length).toBe(7);
  });

  it('исключённый род не отправляется', () => {
    const { state, home } = setup();
    setArmy(state, home, { swordsman: 20 });
    home.plan = planFrom({ swordsman: 10 });
    state.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: home.id,
      toPlanetId: 1,
      weightPermille: 1000,
      supplyEnabled: true,
      supplyKinds: ['archer'],
    });

    runTicks(state, testBalance, 40);
    expect(state.fleets).toHaveLength(0);
    expect(home.army).toHaveLength(20);
  });

  it('во время боя исходящее снабжение стоит', () => {
    const { state, home } = setup();
    setArmy(state, home, { swordsman: 20 });
    home.plan = planFrom({ swordsman: 10 });
    home.battleId = 99;
    state.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: home.id,
      toPlanetId: 1,
      weightPermille: 1000,
      supplyEnabled: true,
      supplyKinds: ['swordsman'],
    });

    runTicks(state, testBalance, 40);
    expect(state.fleets).toHaveLength(0);
  });
});
