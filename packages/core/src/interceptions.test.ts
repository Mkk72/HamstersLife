import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { resolveInterceptions } from './interceptions';
import { createGameState } from './state';
import { runTicks } from './tick';
import { createTroopStack } from './troops';
import type { Fleet, GameState } from './types';

function stateWith(fleets: Fleet[]): GameState {
  const state = createGameState(mapFour, testBalance, 1);
  state.fleets.push(...fleets);
  return state;
}

function fleet(overrides: Partial<Fleet> & Pick<Fleet, 'id'>): Fleet {
  return {
    ownerId: 0,
    fromPlanetId: 0,
    toPlanetId: 2,
    departTick: 0,
    arriveTick: 20,
    troops: createTroopStack({ swordsman: 10_000 }),
    ...overrides,
  };
}

/** Прогоняет перехват по тикам 1..last, как в симуляции. */
function run(state: GameState, last: number): void {
  for (let tick = 1; tick <= last; tick += 1) resolveInterceptions(state, tick);
}

describe('перехват на одной стрелке', () => {
  it('встречные флоты уничтожают друг друга полностью', () => {
    const state = stateWith([
      fleet({ id: 1, ownerId: 0, fromPlanetId: 0, toPlanetId: 2, arriveTick: 20 }),
      fleet({ id: 2, ownerId: 1, fromPlanetId: 2, toPlanetId: 0, arriveTick: 20 }),
    ]);

    run(state, 9);
    expect(state.fleets).toHaveLength(2);

    run(state, 10);
    expect(state.fleets).toHaveLength(0);
    // событие для вида: встреча ровно посередине стрелки
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.progressPermille).toBe(500);
    expect(state.events[0]?.fleetIds).toEqual([1, 2]);
  });

  it('уничтожает оба, даже если один в десятки раз больше', () => {
    const state = stateWith([
      fleet({ id: 1, ownerId: 0, troops: createTroopStack({ swordsman: 1 }) }),
      fleet({
        id: 2,
        ownerId: 1,
        fromPlanetId: 2,
        toPlanetId: 0,
        troops: createTroopStack({ swordsman: 50_000 }),
      }),
    ]);

    run(state, 12);
    expect(state.fleets).toHaveLength(0);
  });

  it('флоты в одну сторону не сталкиваются', () => {
    const state = stateWith([
      fleet({ id: 1, ownerId: 0 }),
      fleet({ id: 2, ownerId: 1 }),
    ]);

    run(state, 20);
    expect(state.fleets).toHaveLength(2);
  });

  it('свои флоты друг друга не трогают', () => {
    const state = stateWith([
      fleet({ id: 1, ownerId: 0 }),
      fleet({ id: 2, ownerId: 0, fromPlanetId: 2, toPlanetId: 0 }),
    ]);

    run(state, 20);
    expect(state.fleets).toHaveLength(2);
  });

  it('разные стрелки не пересекаются', () => {
    const state = stateWith([
      fleet({ id: 1, fromPlanetId: 0, toPlanetId: 2 }),
      fleet({ id: 2, ownerId: 1, fromPlanetId: 1, toPlanetId: 0 }),
    ]);

    run(state, 20);
    expect(state.fleets).toHaveLength(2);
  });

  it('встреча учитывает разную скорость: перехват до прибытия', () => {
    // первый летит 20 тиков, второй — 10; встречаются на 7-м тике,
    // то есть до того, как второй долетит до цели
    const state = stateWith([
      fleet({ id: 1, ownerId: 0, arriveTick: 20 }),
      fleet({ id: 2, ownerId: 1, fromPlanetId: 2, toPlanetId: 0, arriveTick: 10 }),
    ]);

    run(state, 6);
    expect(state.fleets).toHaveLength(2);

    run(state, 7);
    expect(state.fleets).toHaveLength(0);
  });

  it('в симуляции встречные флоты исчезают до прибытия', () => {
    const state = createGameState(mapFour, testBalance, 1);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 2, ratio: 50 },
      testBalance,
    );
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 0, ratio: 50 },
      testBalance,
    );

    const arrivals = state.fleets.map((item) => item.arriveTick);
    expect(arrivals).toHaveLength(2);
    const earliest = Math.min(...arrivals);

    let destroyedAt = 0;
    for (let step = 0; step < 200 && state.fleets.length > 0; step += 1) {
      runTicks(state, testBalance, 1);
      destroyedAt = state.tick;
    }

    expect(state.fleets).toHaveLength(0);
    expect(destroyedAt).toBeLessThan(earliest);
    expect(state.planets[0]?.ownerId).toBe(0);
    expect(state.planets[2]?.ownerId).toBe(1);
  });
});
