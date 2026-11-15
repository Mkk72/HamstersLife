import { describe, expect, it } from 'vitest';
import {
  HAMSTER,
  ceilDiv,
  formatMilli,
  mulPermille,
  mulPermilleCeil,
  secondsToTicks,
  toHamsters,
} from './units';

describe('units', () => {
  it('переводит хомяков и секунды', () => {
    expect(HAMSTER).toBe(1000);
    expect(toHamsters(12_345)).toBe(12);
    expect(secondsToTicks(15)).toBe(300);
    expect(secondsToTicks(0.5)).toBe(10);
  });

  it('умножает на permille вниз и вверх', () => {
    expect(mulPermille(1000, 1800)).toBe(1800);
    expect(mulPermille(1234, 1600)).toBe(1974);
    expect(mulPermilleCeil(1234, 1600)).toBe(1975);
    expect(mulPermille(0, 2000)).toBe(0);
  });

  it('делит нацело вверх', () => {
    expect(ceilDiv(10, 20)).toBe(1);
    expect(ceilDiv(20, 20)).toBe(1);
    expect(ceilDiv(21, 20)).toBe(2);
    expect(ceilDiv(0, 20)).toBe(0);
  });

  it('форматирует milli-единицы для интерфейса', () => {
    expect(formatMilli(1234)).toBe('1.2');
    expect(formatMilli(1000)).toBe('1');
    expect(formatMilli(0)).toBe('0');
    expect(formatMilli(12_500, 1)).toBe('12.5');
    expect(formatMilli(-1500, 1)).toBe('-1.5');
  });
});
