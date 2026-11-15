import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { createGameState, getPlanet, setGarrison } from './state';
import { runTicks } from './tick';
import { createTroopStack, troopTotal } from './troops';

function fresh() {
  return createGameState(mapFour, testBalance, 5);
}

describe('состав отряда в правилах', () => {
  it('делит состав пропорционально доле при отправке', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    home.troops = createTroopStack({ swordsman: 6000, archer: 4000 });

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 50 },
      testBalance,
    );

    const fleet = state.fleets[0];
    expect(fleet?.troops.swordsman).toBe(3000);
    expect(fleet?.troops.archer).toBe(2000);
    expect(troopTotal(home.troops)).toBe(5000);
    expect(home.troops.swordsman).toBe(3000);
    expect(home.troops.archer).toBe(2000);
  });

  it('поток маршрута — только базовые бойцы производства', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    home.troops = createTroopStack({ swordsman: 5000, archer: 5000 });

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 50 },
      testBalance,
    );
    runTicks(state, testBalance, 1);

    const route = state.routes[0];
    expect(route?.pending.swordsman).toBe(25);
    expect(route?.pending.archer).toBe(0);
  });

  it('захват сохраняет пропорции состава победителя', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    const victim = getPlanet(state, 2);
    if (!home || !victim) throw new Error('нет планет');
    home.troops = createTroopStack({ swordsman: 6000, archer: 6000 });
    setGarrison(victim, 1000);

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 2, ratio: 100 },
      testBalance,
    );
    runTicks(state, testBalance, 40);

    const captured = getPlanet(state, 2);
    expect(captured?.ownerId).toBe(0);
    // фазовый бой: защита успела вырасти до 3000, атакующие потеряли часть
    // и забрали разницу — состав остаётся пополам
    expect(troopTotal(captured?.troops ?? createTroopStack())).toBe(9202);
    expect(captured?.troops.swordsman).toBe(4601);
    expect(captured?.troops.archer).toBe(4601);
  });

  it('подкрепление складывает состав', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    const target = getPlanet(state, 1);
    if (!home || !target) throw new Error('нет планет');
    home.troops = createTroopStack({ swordsman: 6000, archer: 4000 });
    target.troops = createTroopStack({ swordsman: 1000, cavalry: 2000 });

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 50 },
      testBalance,
    );
    runTicks(state, testBalance, 20);

    // цель успела произвести 30 × 20 = 600 мечников, затем пришло подкрепление
    expect(target.troops.swordsman).toBe(4600);
    expect(target.troops.archer).toBe(2000);
    expect(target.troops.cavalry).toBe(2000);
  });

  it('берёт выбранный род войск, если игрок задал состав', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    home.troops = createTroopStack({ swordsman: 6000, archer: 4000 });

    applyCommand(
      state,
      {
        type: 'SendFleet',
        playerId: 0,
        fromPlanetIds: [0],
        toPlanetId: 3,
        ratio: 50,
        composition: { archer: 1000 },
      },
      testBalance,
    );

    const fleet = state.fleets[0];
    expect(fleet?.troops.archer).toBe(4000);
    expect(fleet?.troops.swordsman).toBe(0);
    expect(home.troops.swordsman).toBe(6000);
    expect(home.troops.archer).toBe(0);
  });

  it('смешанный выбор 40/30/30 соблюдает пропорции состава', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    home.troops = createTroopStack({ swordsman: 6000, archer: 4000, cavalry: 2000 });

    applyCommand(
      state,
      {
        type: 'SendFleet',
        playerId: 0,
        fromPlanetIds: [0],
        toPlanetId: 3,
        ratio: 50,
        composition: { swordsman: 40, archer: 30, cavalry: 30 },
      },
      testBalance,
    );

    const fleet = state.fleets[0];
    expect(fleet?.troops.swordsman).toBe(2400);
    expect(fleet?.troops.archer).toBe(1800);
    expect(fleet?.troops.cavalry).toBe(1800);
    expect(home.troops.swordsman).toBe(3600);
    expect(home.troops.archer).toBe(2200);
    expect(home.troops.cavalry).toBe(200);
  });

  it('если выбранного рода мало — берёт сколько есть, не добирая другими', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    home.troops = createTroopStack({ swordsman: 5000, archer: 1000 });

    applyCommand(
      state,
      {
        type: 'SendFleet',
        playerId: 0,
        fromPlanetIds: [0],
        toPlanetId: 3,
        ratio: 50,
        composition: { archer: 1000 },
      },
      testBalance,
    );

    expect(troopTotal(state.fleets[0]?.troops ?? createTroopStack())).toBe(1000);
    expect(home.troops.swordsman).toBe(5000);
  });
});
