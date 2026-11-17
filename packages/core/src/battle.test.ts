import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { addUnits, planFrom } from './army';
import { joinBattle, startPlanetBattle } from './battle';
import { createGameState } from './state';
import { runTicks } from './tick';
import type { Fleet, GameState, Planet, UnitKind } from './types';

function setup(): GameState {
  return createGameState(mapFour, testBalance, 1);
}

function setArmy(state: GameState, planet: Planet, counts: Partial<Record<UnitKind, number>>): void {
  planet.army = [];
  addUnits(planet.army, planFrom(counts), () => state.nextUnitId++, testBalance.troops);
  // В тестах боя производство выключено: иначе защитник получает подкрепления.
  planet.plan = planFrom({});
}

function attackerFleet(state: GameState, ownerId: number, planet: Planet, counts: Partial<Record<UnitKind, number>>): Fleet {
  const army: Fleet['army'] = [];
  addUnits(army, planFrom(counts), () => state.nextUnitId++, testBalance.troops);
  return {
    id: 100,
    ownerId,
    fromPlanetId: 2,
    toPlanetId: planet.id,
    army,
    departTick: 0,
    arriveTick: 10,
    startProgressPermille: 0,
  };
}

describe('бой во времени', () => {
  it('атакующий с перевесом захватывает планету и получает план 60/40', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    setArmy(state, planet, { swordsman: 5 });
    const fleet = attackerFleet(state, 1, planet, { swordsman: 20 });
    const battle = startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 400);
    expect(state.battles).toHaveLength(0);
    expect(planet.ownerId).toBe(1);
    expect(planet.army.length).toBeGreaterThan(0);
    expect(planet.plan).toEqual({ swordsman: 36, archer: 24, cavalry: 0, cannon: 0 });
    expect(battle.round).toBeGreaterThan(0);
  });

  it('равные армии на нейтрале уничтожают друг друга, планета остаётся ничьей', () => {
    const state = setup();
    const planet = state.planets[3];
    if (!planet) throw new Error('нет нейтрала');
    planet.ownerId = -1;
    setArmy(state, planet, { swordsman: 10 });
    const fleet = attackerFleet(state, 1, planet, { swordsman: 10 });
    startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 400);
    expect(state.battles).toHaveLength(0);
    expect(planet.ownerId).toBe(-1);
    expect(planet.army).toHaveLength(0);
  });

  it('мечники держат конницу при равной стоимости производства', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    // 10 конников = 30 мечников по работе (3000 против 1000).
    setArmy(state, planet, { swordsman: 30 });
    const fleet = attackerFleet(state, 1, planet, { cavalry: 10 });
    startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 400);
    expect(planet.ownerId).toBe(0);
    expect(planet.army.length).toBeGreaterThan(0);
  });

  it('подкрепление вступает в идущий бой и меняет исход', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    setArmy(state, planet, { swordsman: 30 });
    const fleet = attackerFleet(state, 1, planet, { swordsman: 10 });
    const battle = startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 6);
    const reinforcement = attackerFleet(state, 1, planet, { swordsman: 40 });
    joinBattle(state, battle, reinforcement, testBalance);

    runTicks(state, testBalance, 400);
    expect(planet.ownerId).toBe(1);
  });

  it('защита планеты игрока снижает входящий урон', () => {
    const playerState = setup();
    const playerPlanet = playerState.planets[0];
    if (!playerPlanet) throw new Error('нет планеты');
    setArmy(playerState, playerPlanet, { swordsman: 20 });
    const playerBattle = startPlanetBattle(
      playerState,
      playerPlanet,
      attackerFleet(playerState, 1, playerPlanet, { swordsman: 20 }),
      testBalance,
    );
    runTicks(playerState, testBalance, 40);

    const neutralState = createGameState(mapFour, testBalance, 1);
    const neutralPlanet = neutralState.planets[3];
    if (!neutralPlanet) throw new Error('нет нейтрала');
    neutralPlanet.ownerId = -1;
    setArmy(neutralState, neutralPlanet, { swordsman: 20 });
    const neutralBattle = startPlanetBattle(
      neutralState,
      neutralPlanet,
      attackerFleet(neutralState, 1, neutralPlanet, { swordsman: 20 }),
      testBalance,
    );
    runTicks(neutralState, testBalance, 40);

    const playerDefenderHp = playerBattle.defender.reduce((sum, unit) => sum + unit.hp, 0);
    const neutralDefenderHp = neutralBattle.defender.reduce((sum, unit) => sum + unit.hp, 0);
    expect(playerDefenderHp).toBeGreaterThan(neutralDefenderHp);
  });

  it('ранения восстанавливаются через 10 секунд вне боя', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    setArmy(state, planet, { swordsman: 1 });
    const unit = planet.army[0];
    if (!unit) throw new Error('нет юнита');
    unit.hp = 1;
    unit.healAtTick = 5;

    runTicks(state, testBalance, 5);
    expect(unit.hp).toBe(36);
  });

  it('одиночный юнит не уничтожает большую армию', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    setArmy(state, planet, { swordsman: 20 });
    const fleet = attackerFleet(state, 1, planet, { swordsman: 1 });
    startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 200);
    expect(planet.ownerId).toBe(0);
    expect(planet.army.length).toBeGreaterThan(15);
  });

  it('производство защитника не мешает захвату', () => {
    const state = setup();
    const planet = state.planets[0];
    if (!planet) throw new Error('нет планеты');
    setArmy(state, planet, { swordsman: 5 });
    planet.plan = planFrom({ swordsman: 30, archer: 20 });
    const fleet = attackerFleet(state, 1, planet, { swordsman: 20 });
    startPlanetBattle(state, planet, fleet, testBalance);

    runTicks(state, testBalance, 200);
    expect(planet.ownerId).toBe(1);
    expect(planet.plan).toEqual({ swordsman: 36, archer: 24, cavalry: 0, cannon: 0 });
  });
});

