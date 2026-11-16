import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapThree } from './__fixtures__/maps';
import { createGameState } from './state';
import { runTicks } from './tick';

describe('дымовая производительность', () => {
  it('1000 тиков небольшой партии укладываются в разумное время', () => {
    const state = createGameState(mapThree, testBalance, 1);
    const started = Date.now();
    runTicks(state, testBalance, 1000);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(2000);
  });
});

