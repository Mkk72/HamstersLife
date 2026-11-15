import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour, mapThree } from './__fixtures__/maps';
import { createGameState, garrisonOfPlanet, getPlanet, hasForces, MapValidationError } from './state';
import { NEUTRAL_OWNER } from './types';

describe('createGameState', () => {
  it('создаёт партию из карты', () => {
    const state = createGameState(mapThree, testBalance, 1234);
    expect(state.tick).toBe(0);
    expect(state.seed).toBe(1234);
    expect(state.planets).toHaveLength(3);
    expect(state.fleets).toHaveLength(0);
    expect(state.players).toHaveLength(2);
    expect(state.players[0]?.seeds).toBe(testBalance.startingSeeds);
    expect(state.players[0]?.alive).toBe(true);
    expect(state.nextFleetId).toBe(1);
  });

  it('переводит гарнизон карты в milli-единицы', () => {
    const state = createGameState(mapThree, testBalance, 1);
    expect(garrisonOfPlanet(state, 0)).toBe(10_000);
    expect(getPlanet(state, 1)?.ownerId).toBe(NEUTRAL_OWNER);
    expect(garrisonOfPlanet(state, 1)).toBe(5000);
  });

  it('ставит защиту 1.0 по умолчанию', () => {
    const state = createGameState(mapThree, testBalance, 1);
    expect(getPlanet(state, 0)?.defensePermille).toBe(1000);
  });

  it('видит силы игрока', () => {
    const state = createGameState(mapFour, testBalance, 1);
    expect(hasForces(state, 0)).toBe(true);
    expect(hasForces(state, 1)).toBe(true);
    expect(hasForces(state, 7)).toBe(false);
  });

  it('отклоняет карту с дырой в id', () => {
    const broken = { ...mapThree, planets: mapThree.planets.filter((p) => p.id !== 1) };
    expect(() => createGameState(broken, testBalance, 1)).toThrow(MapValidationError);
  });

  it('отклоняет карту без планеты игрока', () => {
    const broken = {
      ...mapThree,
      planets: mapThree.planets.map((planet) =>
        planet.ownerId === 1 ? { ...planet, ownerId: NEUTRAL_OWNER } : planet,
      ),
    };
    expect(() => createGameState(broken, testBalance, 1)).toThrow(/нет стартовой планеты/);
  });

  it('отклоняет карту с чужим владельцем', () => {
    const broken = {
      ...mapThree,
      planets: mapThree.planets.map((planet) =>
        planet.id === 0 ? { ...planet, ownerId: 5 } : planet,
      ),
    };
    expect(() => createGameState(broken, testBalance, 1)).toThrow(/вне диапазона/);
  });
});
