import { describe, expect, it } from 'vitest';
import { defenseForce, resolveBattle, resolveCapture } from './combat';

const MIN_CAPTURE = 1000;

describe('combat', () => {
  it('считает силу защиты с permille', () => {
    expect(defenseForce(10_000, 1000)).toBe(10_000);
    expect(defenseForce(10_000, 1800)).toBe(18_000);
    expect(defenseForce(1234, 1800)).toBe(2221);
  });

  it('захватывает, когда атакующих больше силы защиты', () => {
    const result = resolveCapture({
      garrison: 5000,
      defensePermille: 1000,
      attackers: 8000,
      minCaptureGarrison: MIN_CAPTURE,
    });
    expect(result).toEqual({ captured: true, garrison: 3000 });
  });

  it('не захватывает, когда сил не хватило, и считает остаток обратно через защиту', () => {
    const result = resolveCapture({
      garrison: 10_000,
      defensePermille: 1800,
      attackers: 12_000,
      minCaptureGarrison: MIN_CAPTURE,
    });
    // сила защиты 18000, остаток 6000 → 6000 / 1.8 = 3333
    expect(result).toEqual({ captured: false, garrison: 3333 });
  });

  it('оставляет гарнизон 0 при точном равенстве — планета удержана', () => {
    const result = resolveCapture({
      garrison: 5000,
      defensePermille: 1000,
      attackers: 5000,
      minCaptureGarrison: MIN_CAPTURE,
    });
    expect(result).toEqual({ captured: false, garrison: 0 });
  });

  it('держит минимум гарнизона после захвата', () => {
    const result = resolveCapture({
      garrison: 0,
      defensePermille: 1000,
      attackers: 400,
      minCaptureGarrison: MIN_CAPTURE,
    });
    expect(result).toEqual({ captured: true, garrison: MIN_CAPTURE });
  });

  it('сводит равные силы в ноль', () => {
    expect(resolveBattle(500, 500)).toEqual({ winner: 'none', remaining: 0 });
    expect(resolveBattle(900, 500)).toEqual({ winner: 'attacker', remaining: 400 });
    expect(resolveBattle(500, 900)).toEqual({ winner: 'defender', remaining: 400 });
  });
});
