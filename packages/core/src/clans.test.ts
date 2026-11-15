import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { hashState } from './hash';
import { createGameState, garrisonOf, getPlanet } from './state';
import { runTicks } from './tick';
import type { Balance, ClanId } from './types';

/** Баланс с усиленными кланами: удобно проверить, что бонусы вообще работают. */
function clanBalance(clanId: ClanId, bonuses: Partial<Balance['clans'][ClanId]>): Balance {
  return {
    ...testBalance,
    clans: {
      ...testBalance.clans,
      [clanId]: { ...testBalance.clans[clanId], ...bonuses },
    },
  };
}

describe('кланы', () => {
  it('игроки получают кланы по порядку', () => {
    const state = createGameState(mapFour, testBalance, 1);
    expect(state.players.map((player) => player.clanId)).toEqual([
      'goldenCheeks',
      'jungarian',
    ]);
  });

  it('бонус производства ускоряет рост гарнизона', () => {
    const balance = clanBalance('goldenCheeks', { productionPermille: 1200 });
    const state = createGameState(mapFour, balance, 1);
    const home = getPlanet(state, 0);
    if (!home) throw new Error('нет планеты');
    const before = garrisonOf(home);

    runTicks(state, balance, 1);

    // M: 50 за тик, клан ×1.2 → 60
    expect(garrisonOf(home)).toBe(before + 60);
  });

  it('бонус защиты снижает потери обороняющегося', () => {
    const balance = clanBalance('jungarian', { defensePermille: 2000 });
    const state = createGameState(mapFour, balance, 1);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 2, ratio: 50 },
      balance,
    );
    runTicks(state, balance, 40);

    // игрок 1 (клан с защитой ×2) держит планету; без бонуса потери были бы выше
    const defended = getPlanet(state, 2);
    expect(defended?.ownerId).toBe(1);
    expect(defended ? garrisonOf(defended) : 0).toBeGreaterThan(0);
  });

  it('бонус скорости сокращает время полёта', () => {
    const balance = clanBalance('goldenCheeks', { speedPermille: 1500 });
    const state = createGameState(mapFour, balance, 1);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 50 },
      balance,
    );

    // 111 единиц при 100/с = 23 тика; при ×1.5 скорость 150 → 15
    expect(state.fleets[0]?.arriveTick).toBe(15);
  });

  it('клан входит в хэш состояния', () => {
    const first = createGameState(mapFour, testBalance, 1);
    const second = createGameState(mapFour, testBalance, 1);
    const player = second.players[0];
    if (!player) throw new Error('нет игрока');
    (player as { clanId: ClanId }).clanId = 'syrian';

    expect(hashState(first)).not.toBe(hashState(second));
  });
});
