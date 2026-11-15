/**
 * Геометрия полёта: расстояние и время в тиках.
 *
 * Только целые числа: расстояние — целочисленный корень, время — деление с
 * округлением вверх. Никакого Math.sqrt, чтобы результат не зависел от
 * платформы (см. ARCHITECTURE.md §10).
 */
import { TICKS_PER_SECOND, ceilDiv } from './units';

/** Целочисленный квадратный корень (метод Ньютона), вниз. */
export function integerSqrt(value: number): number {
  if (value < 0) throw new Error('integerSqrt: отрицательное значение');
  if (value < 2) return value;
  let x = value;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(value / x)) / 2);
  }
  return x;
}

/** Расстояние между точками карты в целых единицах. */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return integerSqrt(dx * dx + dy * dy);
}

/**
 * Время полёта в тиках: округление вверх, минимум один тик.
 * Медленнее — значит дольше: скорость в permille уже учтена вызывающим.
 */
export function flightTicks(distanceUnits: number, speedUnitsPerSecond: number): number {
  if (speedUnitsPerSecond <= 0) throw new Error('flightTicks: скорость должна быть больше нуля');
  return Math.max(1, ceilDiv(distanceUnits * TICKS_PER_SECOND, speedUnitsPerSecond));
}
