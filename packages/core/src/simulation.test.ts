import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour, mapThree } from './__fixtures__/maps';
import { Simulation } from './simulation';

function duel() {
  return new Simulation(mapThree, testBalance, 11);
}

describe('Simulation', () => {
  it('создаёт партию из карты и баланса', () => {
    const sim = duel();
    expect(sim.tick).toBe(0);
    expect(sim.state.planets).toHaveLength(3);
    expect(sim.seed).toBe(11);
  });

  it('принимает команду и двигает время', () => {
    const sim = duel();
    const result = sim.applyCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 1,
      ratio: 100,
    });

    expect(result.ok).toBe(true);
    sim.advance(20);

    expect(sim.tick).toBe(20);
    expect(sim.state.planets[1]?.ownerId).toBe(0);
  });

  it('одинаковые партии дают одинаковый хэш', () => {
    const first = new Simulation(mapFour, testBalance, 5);
    const second = new Simulation(mapFour, testBalance, 5);

    for (const sim of [first, second]) {
      sim.applyCommand({
        type: 'SendFleet',
        playerId: 0,
        fromPlanetIds: [0, 1],
        toPlanetId: 3,
        ratio: 50,
      });
      sim.applyCommand({
        type: 'ApplyBoost',
        playerId: 0,
        planetId: 0,
        boost: 'production',
      });
      sim.advance(120);
    }

    expect(first.hash()).toBe(second.hash());
  });

  it('сообщает итог партии', () => {
    const sim = new Simulation(mapThree, testBalance, 5);
    expect(sim.outcome()).toEqual({ finished: false, winnerId: null });
  });
});
