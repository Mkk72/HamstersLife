import { describe, expect, it } from 'vitest';
import { SPEEDS, stepSpeed } from './speeds';

describe('скорости игры', () => {
  it('шаг 0.2 до 1, затем 1.5 и 2', () => {
    expect([...SPEEDS]).toEqual([0.2, 0.4, 0.6, 0.8, 1, 1.5, 2]);
  });

  it('шагает вверх и вниз по списку', () => {
    expect(stepSpeed(1, 1)).toBe(1.5);
    expect(stepSpeed(1, -1)).toBe(0.8);
    expect(stepSpeed(0.2, -1)).toBe(0.2);
    expect(stepSpeed(2, 1)).toBe(2);
  });

  it('из паузы возвращает к обычной скорости', () => {
    expect(stepSpeed(0, 1)).toBe(1);
    expect(stepSpeed(0, -1)).toBe(0.2);
  });

  it('неизвестную скорость считает обычной', () => {
    expect(stepSpeed(0.7, 1)).toBe(1.5);
  });
});
