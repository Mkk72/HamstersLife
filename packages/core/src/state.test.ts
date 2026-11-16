import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapThree } from './__fixtures__/maps';
import { countsOf } from './army';
import { createGameState } from './state';
import type { MapDefinition } from './types';

describe('создание партии', () => {
  it('армия и план приходят из карты', () => {
    const state = createGameState(mapThree, testBalance, 1);
    const home = state.planets[0];
    expect(home ? countsOf(home.army) : null).toEqual({
      swordsman: 10,
      archer: 0,
      cavalry: 0,
      cannon: 0,
    });
    expect(home?.plan.swordsman).toBe(20);
    expect(state.nextUnitId).toBeGreaterThan(10);
    expect(state.players[0]?.alive).toBe(true);
  });

  it('нейтрал с конницей отклоняется', () => {
    const broken: MapDefinition = {
      ...mapThree,
      planets: mapThree.planets.map((planet) =>
        planet.ownerId === -1
          ? { ...planet, garrison: { swordsman: 0, archer: 0, cavalry: 1, cannon: 0 } }
          : planet,
      ),
    };
    expect(() => createGameState(broken, testBalance, 1)).toThrow(/только мечников/);
  });

  it('план больше вместимости отклоняется', () => {
    const broken: MapDefinition = {
      ...mapThree,
      planets: mapThree.planets.map((planet) =>
        planet.id === 0
          ? { ...planet, plan: { swordsman: 100, archer: 0, cavalry: 0, cannon: 0 } }
          : planet,
      ),
    };
    expect(() => createGameState(broken, testBalance, 1)).toThrow(/план больше вместимости/);
  });
});
