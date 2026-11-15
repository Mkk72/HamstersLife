import { describe, expect, it } from 'vitest';
import { distance, flightTicks, integerSqrt } from './flight';

describe('integerSqrt', () => {
  it('считает корень вниз', () => {
    expect(integerSqrt(0)).toBe(0);
    expect(integerSqrt(1)).toBe(1);
    expect(integerSqrt(2)).toBe(1);
    expect(integerSqrt(9)).toBe(3);
    expect(integerSqrt(10)).toBe(3);
    expect(integerSqrt(24)).toBe(4);
    expect(integerSqrt(25)).toBe(5);
    expect(integerSqrt(1_000_000)).toBe(1000);
  });

  it('не превышает точный корень на длинном диапазоне', () => {
    for (let n = 0; n < 5000; n += 1) {
      const root = integerSqrt(n);
      expect(root * root).toBeLessThanOrEqual(n);
      expect((root + 1) * (root + 1)).toBeGreaterThan(n);
    }
  });
});

describe('distance', () => {
  it('считает пифагоровы расстояния целыми', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(distance(10, 10, 10, 10)).toBe(0);
    expect(distance(0, 0, 1, 1)).toBe(1);
  });
});

describe('flightTicks', () => {
  it('переводит скорость в тики с округлением вверх', () => {
    // 100 единиц при 100/с — ровно 1 секунда = 20 тиков
    expect(flightTicks(100, 100)).toBe(20);
    // 101 единица — чуть больше секунды
    expect(flightTicks(101, 100)).toBe(21);
    // минимум один тик
    expect(flightTicks(0, 100)).toBe(1);
  });

  it('удвоенная скорость сокращает время вдвое', () => {
    expect(flightTicks(200, 200)).toBe(flightTicks(200, 100) / 2);
  });

  it('падает на нулевой скорости', () => {
    expect(() => flightTicks(10, 0)).toThrow();
  });
});
