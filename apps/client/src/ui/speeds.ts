/**
 * Допустимые скорости игры. Один список для HUD, клавиатуры и тестов,
 * чтобы подписи и шаг не разъезжались.
 */
export const SPEEDS = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2] as const;

export type GameSpeed = (typeof SPEEDS)[number];

/** Следующая/предыдущая скорость в списке; 0 (пауза) — не участвует. */
export function stepSpeed(current: number, direction: 1 | -1): number {
  if (current <= 0) return direction > 0 ? 1 : 0.2;
  const index = SPEEDS.findIndex((value) => value === current);
  if (index < 0) return stepSpeed(1, direction);
  const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, index + direction))];
  return next ?? current;
}
