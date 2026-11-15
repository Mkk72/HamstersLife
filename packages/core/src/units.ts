/**
 * Единицы измерения ядра.
 *
 * Правило детерминизма (см. ARCHITECTURE.md §10): в `core` нет чисел с
 * плавающей точкой. Все величины — целые:
 *  - войска и семечки — в milli-единицах: 1 хомяк = 1000 mH;
 *  - проценты (защита, бусты, кланы) — в permille: 1.0 = 1000.
 *
 * Умножение на permille выполняется делением нацело (floor), поэтому один и
 * тот же вход даёт один и тот же результат в браузере, в Node и на сервере.
 */

/** Milli-единицы: войска и семечки. 1 хомяк = 1000 mH. */
export type MilliUnits = number;

export const HAMSTER: MilliUnits = 1000;
export const PERMILLE = 1000;

export const TICKS_PER_SECOND = 20;
export const MS_PER_TICK = 50;
export const MS_PER_SECOND = 1000;
export const TICKS_PER_MINUTE = TICKS_PER_SECOND * 60;

/** Умножение на permille с округлением вниз. */
export function mulPermille(value: number, permille: number): number {
  return Math.floor((value * permille) / PERMILLE);
}

/** Умножение на permille с округлением вверх (для времени полёта). */
export function mulPermilleCeil(value: number, permille: number): number {
  return Math.ceil((value * permille) / PERMILLE);
}

/** Деление нацело с округлением вверх для неотрицательных чисел. */
export function ceilDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Целые «хомяки» без дробной части — для отображения и проверок. */
export function toHamsters(value: MilliUnits): number {
  return Math.floor(value / HAMSTER);
}

/** Секунды в тиках. */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** Целые в строку для интерфейса: 1234 → «1», 1234 mH → «1.2». */
export function formatMilli(value: MilliUnits, fractionDigits = 1): string {
  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / HAMSTER);
  const fraction = absolute % HAMSTER;
  if (fractionDigits <= 0 || fraction === 0) return `${negative ? '-' : ''}${whole}`;
  const divisor = 10 ** (3 - fractionDigits);
  const padded = String(Math.floor(fraction / divisor)).padStart(fractionDigits, '0');
  return `${negative ? '-' : ''}${whole}.${padded}`;
}
