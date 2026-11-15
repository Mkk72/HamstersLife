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
    // защита успела вырасти до 3000 (1000 стартовых + производство),
    // 12 000 атакующих → остаётся 9000, пропорционально 4500/4500
    expect(troopTotal(captured?.troops ?? createTroopStack())).toBe(9000);
    expect(captured?.troops.swordsman).toBe(4500);
    expect(captured?.troops.archer).toBe(4500);
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
});
