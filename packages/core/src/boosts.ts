/**
 * Бусты как данные, а не как три поля у планеты.
 *
 * Новый вид буста добавляется в `BOOST_KINDS` (types.ts), в схему контента и в
 * место, где он меняет правило (производство, скорость или защита). Планета и
 * хэш при этом не меняются — таймеры хранятся записью по видам.
 */
import type { BoostKind, Planet, Tick } from './types';
import { BOOST_KINDS } from './types';

/** Пустые таймеры: ни один буст не действует. */
export function createBoosts(): Record<BoostKind, Tick> {
  const boosts = {} as Record<BoostKind, Tick>;
  for (const kind of BOOST_KINDS) boosts[kind] = 0;
  return boosts;
}

export function isBoostActive(planet: Planet, kind: BoostKind, tick: Tick): boolean {
  return (planet.boosts[kind] ?? 0) > tick;
}

/** Остаток действия в тиках; 0 — не действует. */
export function boostRemainingTicks(planet: Planet, kind: BoostKind, tick: Tick): number {
  return Math.max(0, (planet.boosts[kind] ?? 0) - tick);
}

export function setBoost(planet: Planet, kind: BoostKind, untilTick: Tick): void {
  planet.boosts[kind] = untilTick;
}

/** Сбросить все бусты (например, при захвате планеты). */
export function clearBoosts(planet: Planet): void {
  for (const kind of BOOST_KINDS) planet.boosts[kind] = 0;
}
