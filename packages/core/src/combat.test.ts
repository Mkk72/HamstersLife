import { describe, expect, it } from 'vitest';
import { defenseForce, resolveBattle } from './combat';

describe('combat', () => {
  it('считает силу защиты с permille', () => {
    expect(defenseForce(10_000, 1000)).toBe(10_000);
    expect(defenseForce(10_000, 1800)).toBe(18_000);
    expect(defenseForce(1234, 1800)).toBe(2221);
  });

  it('сводит равные силы в ноль', () => {
    expect(resolveBattle(500, 500)).toEqual({ winner: 'none', remaining: 0 });
    expect(resolveBattle(900, 500)).toEqual({ winner: 'attacker', remaining: 400 });
    expect(resolveBattle(500, 900)).toEqual({ winner: 'defender', remaining: 400 });
  });
});
