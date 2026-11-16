import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { addUnits, countsOf, planFrom } from './army';
import { createGameState } from './state';
import { runTicks } from './tick';
import { planFromPercents } from './production';
import { startPlanetBattle } from './battle';
import type { GameState, Planet, UnitKind } from './types';

function state(): GameState {
  return createGameState(mapFour, testBalance, 1);
}

function setArmy(stateValue: GameState, planet: Planet, counts: Partial<Record<UnitKind, number>>): void {
  planet.army = [];
  addUnits(planet.army, planFrom(counts), () => stateValue.nextUnitId++, testBalance.troops);
  planet.plan = planFrom(counts);
}

describe('производство по плану', () => {
  it('один мечник на M за 20 тиков', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    home.army = [];
    home.plan = planFrom({ swordsman: 1 });

    runTicks(game, testBalance, 19);
    expect(home.army).toHaveLength(0);
    runTicks(game, testBalance, 1);
    expect(home.army).toHaveLength(1);
    expect(home.army[0]?.kind).toBe('swordsman');
  });

  it('лучник на M за 30 тиков: работа 1,5', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    home.army = [];
    home.plan = planFrom({ archer: 1 });

    runTicks(game, testBalance, 29);
    expect(home.army).toHaveLength(0);
    runTicks(game, testBalance, 1);
    expect(home.army).toHaveLength(1);
  });

  it('мощность делится по оставшейся работе, а не по числу родов', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    home.army = [];
    home.plan = planFrom({ swordsman: 10, archer: 10 });

    runTicks(game, testBalance, 20);
    expect(home.production.swordsman).toBe(400);
    expect(home.production.archer).toBe(600);
    expect(home.army).toHaveLength(0);
  });

  it('на заполненной вместимости производство стоит', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    setArmy(game, home, { swordsman: 60 });
    home.plan = planFrom({ swordsman: 60 });

    runTicks(game, testBalance, 40);
    expect(home.army).toHaveLength(60);
    expect(home.production.swordsman).toBe(0);
  });

  it('при нехватке мест готовые рода получают место в фиксированном порядке', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    home.army = [];
    addUnits(home.army, planFrom({ cannon: 59 }), () => game.nextUnitId++, testBalance.troops);
    home.plan = planFrom({ swordsman: 1, archer: 1, cannon: 0 });
    home.production = planFrom({ swordsman: 999, archer: 1499 });

    runTicks(game, testBalance, 1);
    const counts = countsOf(home.army);
    expect(counts.swordsman).toBe(1);
    expect(counts.archer).toBe(0);
    expect(home.production.archer).toBe(1500);
  });

  it('уменьшение плана не удаляет войска, но срезает скрытый прогресс', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    setArmy(game, home, { swordsman: 5 });
    home.production = planFrom({ swordsman: 900 });

    home.plan = planFrom({ swordsman: 5 });
    runTicks(game, testBalance, 1);
    expect(home.army).toHaveLength(5);
    expect(home.production.swordsman).toBe(0);
  });

  it('шаблон даёт ровно вместимость на всех размерах', () => {
    for (const size of ['S', 'M', 'L', 'XL'] as const) {
      const capacity = testBalance.planetSizes[size].capacity;
      const plan = planFromPercents(
        { swordsman: 45, archer: 30, cavalry: 20, cannon: 5 },
        capacity,
      );
      expect(Object.values(plan).reduce((sum, value) => sum + value, 0)).toBe(capacity);
    }
  });

  it('производство во время боя пополняет защитников, а не планету', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    setArmy(game, home, { swordsman: 5 });
    home.plan = planFrom({ archer: 1 });
    home.production = planFrom({ archer: 1499 });
    const fleetArmy: Planet['army'] = [];
    addUnits(fleetArmy, planFrom({ swordsman: 1 }), () => game.nextUnitId++, testBalance.troops);
    const battle = startPlanetBattle(
      game,
      home,
      {
        id: 1,
        ownerId: 1,
        fromPlanetId: 2,
        toPlanetId: home.id,
        army: fleetArmy,
        departTick: 0,
        arriveTick: 1,
        startProgressPermille: 0,
      },
      testBalance,
    );

    runTicks(game, testBalance, 2);
    expect(battle.defender.some((unit) => unit.kind === 'archer')).toBe(true);
    expect(home.army).toHaveLength(0);
  });

  it('изменение плана не создаёт и не удаляет армию', () => {
    const game = state();
    const home = game.planets[0];
    if (!home) throw new Error('нет планеты');
    setArmy(game, home, { swordsman: 7, archer: 3 });
    home.plan = planFrom({ swordsman: 30, archer: 20 });
    const before = countsOf(home.army);
    home.plan = planFrom({ swordsman: 1, archer: 1 });
    runTicks(game, testBalance, 1);
    expect(countsOf(home.army)).toEqual(before);
  });
});
