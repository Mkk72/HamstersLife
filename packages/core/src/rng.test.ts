import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  it('одинаковый seed даёт одинаковую последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    const left = Array.from({ length: 8 }, () => a.nextUint32());
    const right = Array.from({ length: 8 }, () => b.nextUint32());
    expect(left).toEqual(right);
    expect(a.seed).toBe(42);
  });

  it('разные seed дают разные последовательности', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.nextUint32()).not.toBe(b.nextUint32());
  });

  it('держит диапазоны', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.nextIntInclusive(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      const permille = rng.nextPermille();
      expect(permille).toBeGreaterThanOrEqual(0);
      expect(permille).toBeLessThanOrEqual(999);
    }
  });

  it('пустой диапазон возвращает нижнюю границу', () => {
    const rng = createRng(0);
    expect(rng.nextInt(5, 5)).toBe(5);
    expect(rng.nextInt(5, 2)).toBe(5);
  });
});
