import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { createGameState, garrisonOf, getPlanet, setGarrison } from './state';
import { runTicks } from './tick';
import type { Balance, Command } from './types';
import type { TroopKind } from './troops';

function fresh(balance: Balance = testBalance) {
  return createGameState(mapFour, balance, 5);
}

function train(
  state: ReturnType<typeof fresh>,
  kind: TroopKind,
  amount: number,
  balance: Balance = testBalance,
) {
  return applyCommand(
    state,
    { type: 'TrainTroops', playerId: 0, planetId: 0, kind, amount },
    balance,
  );
}

describe('обучение в казармах', () => {
  it('списывает семечки и ставит заказ в очередь', () => {
    const state = fresh();
    const result = train(state, 'swordsman', 2);

    expect(result).toEqual({ ok: true });
    expect(state.players[0]?.seeds).toBe(testBalance.startingSeeds - 2 * 20_000);
    expect(getPlanet(state, 0)?.training).toHaveLength(1);
    expect(getPlanet(state, 0)?.training[0]).toMatchObject({
      kind: 'swordsman',
      remaining: 2000,
      progressTicks: 0,
    });
  });

  it('обучает одного хомяка за trainTicks тиков', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    setGarrison(home, 0);
    train(state, 'cavalry', 2);

    runTicks(state, testBalance, 79);
    expect(home.troops.cavalry).toBe(0);

    runTicks(state, testBalance, 1);
    expect(home.troops.cavalry).toBe(1000);
    expect(home.training[0]?.remaining).toBe(1000);

    runTicks(state, testBalance, 80);
    expect(home.troops.cavalry).toBe(2000);
    expect(home.training).toHaveLength(0);
  });

  it('ждёт, пока гарнизон упрётся в предел', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    setGarrison(home, testBalance.planetSizes.M.capacity);
    train(state, 'archer', 1);

    runTicks(state, testBalance, 100);
    expect(home.training[0]?.progressTicks).toBe(0);
    expect(home.troops.archer).toBe(0);

    setGarrison(home, 0);
    runTicks(state, testBalance, 70);
    expect(home.troops.archer).toBe(1000);
  });

  it('держит очередь не длиннее лимита', () => {
    const state = fresh();
    for (let index = 0; index < testBalance.maxTrainingQueue; index += 1) {
      expect(train(state, 'swordsman', 1).ok).toBe(true);
    }
    expect(train(state, 'swordsman', 1)).toEqual({ ok: false, error: 'queue-full' });
  });

  it('отказывает без семечек, на чужой планете и с плохим числом', () => {
    const state = fresh();
    const player = state.players[0];
    if (!player) throw new Error('нет игрока');
    player.seeds = 0;
    expect(train(state, 'swordsman', 1)).toEqual({ ok: false, error: 'not-enough-seeds' });

    player.seeds = testBalance.startingSeeds;
    expect(
      applyCommand(
        state,
        { type: 'TrainTroops', playerId: 0, planetId: 2, kind: 'swordsman', amount: 1 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'not-your-planet' });

    expect(train(state, 'swordsman', 0)).toEqual({ ok: false, error: 'invalid-amount' });
    expect(train(state, 'swordsman', 1.5)).toEqual({ ok: false, error: 'invalid-amount' });
  });

  it('отказывает на неизвестном роде войск', () => {
    const state = fresh();
    const command = {
      type: 'TrainTroops',
      playerId: 0,
      planetId: 0,
      kind: 'dragon' as unknown as TroopKind,
      amount: 1,
    } satisfies Command;
    expect(applyCommand(state, command, testBalance)).toEqual({
      ok: false,
      error: 'unknown-troop',
    });
  });

  it('при захвате очередь прежнего владельца сгорает', () => {
    const state = fresh();
    const victim = getPlanet(state, 2);
    if (!victim) throw new Error('нет планеты');
    setGarrison(victim, 1000);
    victim.training.push({ kind: 'archer', remaining: 1000, progressTicks: 0 });

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 2, ratio: 100 },
      testBalance,
    );
    runTicks(state, testBalance, 40);

    expect(getPlanet(state, 2)?.ownerId).toBe(0);
    expect(getPlanet(state, 2)?.training).toHaveLength(0);
  });

  it('обучение не мешает производству и сумме', () => {
    const state = fresh();
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    setGarrison(home, 0);
    train(state, 'mage', 1);
    runTicks(state, testBalance, 120);

    // 120 тиков производства по 50 + один маг за 120 тиков
    expect(garrisonOf(home)).toBe(120 * 50 + 1000);
    expect(home.troops.mage).toBe(1000);
  });
});
