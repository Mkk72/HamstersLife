import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapThree } from './__fixtures__/maps';
import { addUnits, planFrom } from './army';
import { createGameState } from './state';
import { runTicks } from './tick';
import { launchFleet } from './fleets';
import type { GameState, UnitKind } from './types';

function setup(): GameState {
  return createGameState(mapThree, testBalance, 1);
}

function launch(state: GameState, ownerId: number, fromId: number, toId: number, troops: Partial<Record<UnitKind, number>>) {
  const from = state.planets[fromId];
  const army: GameState['fleets'][number]['army'] = [];
  addUnits(army, planFrom(troops), () => state.nextUnitId++, testBalance.troops);
  if (!from) throw new Error('нет планеты');
  return launchFleet(state, testBalance, ownerId, from, toId, army);
}

describe('полевой перехват', () => {
  it('встречные флоты начинают бой в точке встречи, а не исчезают', () => {
    const state = setup();
    launch(state, 0, 0, 2, { swordsman: 10 });
    launch(state, 1, 2, 0, { swordsman: 10 });

    runTicks(state, testBalance, 21);
    expect(state.fleets).toHaveLength(0);
    expect(state.battles).toHaveLength(1);
    expect(state.battles[0]?.kind).toBe('field');
  });

  it('победитель продолжает путь из точки встречи с ненулевым прогрессом', () => {
    const state = setup();
    state.planets[2]!.army = [];
    addUnits(
      state.planets[2]!.army,
      planFrom({ swordsman: 5 }),
      () => state.nextUnitId++,
      testBalance.troops,
    );

    launch(state, 0, 0, 2, { swordsman: 40 });
    launch(state, 1, 2, 0, { swordsman: 5 });

    runTicks(state, testBalance, 60);
    const survivor = state.fleets.find((fleet) => fleet.ownerId === 0);
    expect(survivor).toBeDefined();
    if (!survivor) return;
    expect(survivor.startProgressPermille).toBeGreaterThan(0);
    expect(survivor.army.length).toBeGreaterThan(0);
  });

  it('идущие в одну сторону не сталкиваются', () => {
    const state = setup();
    launch(state, 0, 0, 1, { swordsman: 5 });
    launch(state, 1, 2, 1, { swordsman: 5 });

    runTicks(state, testBalance, 3);
    expect(state.battles).toHaveLength(0);
  });
});

