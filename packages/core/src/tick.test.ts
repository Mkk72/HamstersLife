import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapThree } from './__fixtures__/maps';
import { createGameState } from './state';
import { runTicks, step } from './tick';

describe('тик', () => {
  it('шаг увеличивает время и очищает события', () => {
    const state = createGameState(mapThree, testBalance, 1);
    state.events.push({
      kind: 'interception',
      tick: 0,
      fromPlanetId: 0,
      toPlanetId: 1,
      progressPermille: 500,
      fleetIds: [1, 2],
    });
    step(state, testBalance);
    expect(state.tick).toBe(1);
    expect(state.events).toHaveLength(0);
  });

  it('производство идёт после тика, а не до', () => {
    const state = createGameState(mapThree, testBalance, 1);
    const home = state.planets[0];
    if (!home) throw new Error('нет планеты');
    home.army = [];
    home.plan = { swordsman: 1, archer: 0, cavalry: 0, cannon: 0 };
    runTicks(state, testBalance, 20);
    expect(home.army).toHaveLength(1);
  });
});
