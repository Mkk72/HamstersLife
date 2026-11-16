import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { addUnits, planFrom } from './army';
import { launchFleet } from './fleets';
import { createGameState } from './state';
import { runTicks } from './tick';

describe('подкрепления сверх предела', () => {
  it('прибывшие сверх вместимости сохраняются', () => {
    const state = createGameState(mapFour, testBalance, 1);
    const home = state.planets[0];
    const target = state.planets[1];
    if (!home || !target) throw new Error('нет планет');
    target.army = [];
    addUnits(target.army, planFrom({ swordsman: 40 }), () => state.nextUnitId++, testBalance.troops);

    const fleetArmy: typeof target.army = [];
    addUnits(fleetArmy, planFrom({ swordsman: 10 }), () => state.nextUnitId++, testBalance.troops);
    launchFleet(state, testBalance, 0, home, target.id, fleetArmy);

    runTicks(state, testBalance, 21);
    expect(target.army.length).toBe(50);
  });
});
