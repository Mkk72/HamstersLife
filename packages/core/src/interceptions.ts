/**
 * Перехват на маршруте: два враждебных отряда, идущих по одной стрелке
 * навстречу друг другу, сталкиваются и уничтожаются полностью — без остатка
 * и без учёта численности.
 *
 * Считаем без координат: у встречных флотов совпадают концы (A→B и B→A),
 * значит они движутся по одному отрезку. Позиция — доля пройденного пути;
 * встреча происходит, когда разность позиций меняет знак за тик. Всё целыми
 * числами, чтобы правило оставалось детерминированным.
 */
import type { Fleet, GameState } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Знак разности «прогресс первого минус прогресс второго» на отрезке A→B:
 * < 0 — первый ещё позади, > 0 — уже прошёл, 0 — встретились.
 */
function gapSign(first: Fleet, second: Fleet, tick: number): number {
  const firstDuration = first.arriveTick - first.departTick;
  const secondDuration = second.arriveTick - second.departTick;
  if (firstDuration <= 0 || secondDuration <= 0) return 1;

  const firstElapsed = clamp(tick - first.departTick, 0, firstDuration);
  const secondElapsed = clamp(tick - second.departTick, 0, secondDuration);

  // first: A→B, progress = firstElapsed / firstDuration
  // second: B→A, progress по A→B = 1 − secondElapsed / secondDuration
  return (
    firstElapsed * secondDuration +
    secondElapsed * firstDuration -
    firstDuration * secondDuration
  );
}

/** Уничтожает столкнувшиеся пары и возвращает число погибших флотов. */
export function resolveInterceptions(state: GameState, tick: number): number {
  const destroyed = new Set<number>();
  const fleets = state.fleets;

  for (let left = 0; left < fleets.length; left += 1) {
    const first = fleets[left];
    if (!first) continue;
    for (let right = left + 1; right < fleets.length; right += 1) {
      const second = fleets[right];
      if (!second) continue;
      if (first.ownerId === second.ownerId) continue;
      // Одна и та же стрелка: A→B и B→A.
      if (first.fromPlanetId !== second.toPlanetId) continue;
      if (first.toPlanetId !== second.fromPlanetId) continue;

      const before = gapSign(first, second, tick - 1);
      const after = gapSign(first, second, tick);
      if (before <= 0 && after >= 0) {
        destroyed.add(first.id);
        destroyed.add(second.id);
        const duration = first.arriveTick - first.departTick;
        const elapsed = clamp(tick - first.departTick, 0, Math.max(0, duration));
        state.events.push({
          kind: 'interception',
          tick,
          fromPlanetId: first.fromPlanetId,
          toPlanetId: first.toPlanetId,
          progressPermille: duration > 0 ? Math.floor((elapsed * 1000) / duration) : 1000,
          fleetIds: [first.id, second.id],
        });
      }
    }
  }

  if (destroyed.size === 0) return 0;

  let removed = 0;
  for (let index = fleets.length - 1; index >= 0; index -= 1) {
    const fleet = fleets[index];
    if (fleet && destroyed.has(fleet.id)) {
      fleets.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}
