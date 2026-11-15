import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { resolveFieldBattle } from './battle';
import { createTroopStack, troopTotal } from './troops';

function battle(attacker: Record<string, number>, defender: Record<string, number>, defense = 1000) {
  const result = resolveFieldBattle(
    createTroopStack(attacker),
    createTroopStack(defender),
    defense,
    testBalance,
  );
  return {
    ...result,
    attackerTotal: troopTotal(result.attacker),
    defenderTotal: troopTotal(result.defender),
  };
}

describe('фазовый бой', () => {
  it('равные силы по мечникам не захватывают планету', () => {
    const result = battle({ swordsman: 10_000 }, { swordsman: 10_000 });
    expect(result.captured).toBe(false);
    expect(result.defenderTotal).toBe(0);
    expect(result.attackerTotal).toBe(0);
  });

  it('конница бьёт пушки — камень-ножницы-бумага работает', () => {
    const result = battle({ cavalry: 10_000 }, { cannon: 10_000 });
    expect(result.captured).toBe(true);
    expect(result.attackerTotal).toBeGreaterThan(0);
  });

  it('мечники держат конницу', () => {
    const result = battle({ cavalry: 10_000 }, { swordsman: 10_000 });
    expect(result.captured).toBe(false);
    expect(result.defenderTotal).toBeGreaterThan(0);
  });

  it('пушки сильны против плотных мечников', () => {
    const withCannons = battle({ cannon: 6000 }, { swordsman: 6000 });
    const withSwords = battle({ swordsman: 6000 }, { swordsman: 6000 });
    expect(withCannons.attackerTotal).toBeGreaterThan(withSwords.attackerTotal);
  });

  it('лучники стреляют до ближнего боя — мечники несут потери заранее', () => {
    const result = battle({ archer: 10_000 }, { swordsman: 10_000 });
    // мечники сильнее в ближнем бою и удерживают планету, но теряют людей
    // ещё в дальнем обмене, пока лучники не подпустили их
    expect(result.captured).toBe(false);
    expect(result.defenderTotal).toBeLessThan(10_000);
  });

  it('защита планеты снижает потери обороняющегося', () => {
    const plain = battle({ swordsman: 20_000 }, { swordsman: 10_000 }, 1000);
    const fortified = battle({ swordsman: 20_000 }, { swordsman: 10_000 }, 1800);
    expect(fortified.defenderTotal).toBeGreaterThanOrEqual(plain.defenderTotal);
    expect(fortified.attackerTotal).toBeLessThanOrEqual(plain.attackerTotal);
  });

  it('одинаковый вход даёт одинаковый исход', () => {
    const first = battle({ swordsman: 7000, archer: 3000 }, { cavalry: 5000, cannon: 2000 });
    const second = battle({ swordsman: 7000, archer: 3000 }, { cavalry: 5000, cannon: 2000 });
    expect(first).toEqual(second);
  });

  it('пустой защитник не оказывает сопротивления', () => {
    const result = battle({ swordsman: 5000 }, {});
    expect(result.captured).toBe(true);
    expect(result.attackerTotal).toBe(5000);
  });
});
