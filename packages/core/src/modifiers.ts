/**
 * Действующие значения с учётом бустов.
 *
 * Единственное место, где буст превращается в число. Тик только спрашивает
 * «сколько произвести / какова защита / какова скорость», а не разбирает
 * таймеры сам.
 */
import type { Balance, Planet } from './types';
import { MS_PER_TICK, PERMILLE, TICKS_PER_SECOND, mulPermille } from './units';

/** Буст действует, пока тик меньше момента окончания. */
export function isActive(untilTick: number, tick: number): boolean {
  return untilTick > tick;
}

function boostFactor(active: boolean, factorPermille: number): number {
  return active ? factorPermille : PERMILLE;
}

/** Производство планеты за один тик в milli-единицах. */
export function productionPerTick(planet: Planet, tick: number, balance: Balance): number {
  const perSecond = balance.planetSizes[planet.size].productionPerSecond;
  const base = Math.floor(perSecond / TICKS_PER_SECOND);
  const factor = boostFactor(
    isActive(planet.productionBoostUntilTick, tick),
    balance.boosts.production.factorPermille,
  );
  return mulPermille(base, factor);
}

/** Защита планеты в permille с учётом «Ореховой скорлупы». */
export function defensePermille(planet: Planet, tick: number, balance: Balance): number {
  const factor = boostFactor(
    isActive(planet.defenseBoostUntilTick, tick),
    balance.boosts.defense.factorPermille,
  );
  return mulPermille(planet.defensePermille, factor);
}

/** Скорость флота, вылетающего с планеты, в целых единицах карты за секунду. */
export function speedUnitsPerSecond(planet: Planet, tick: number, balance: Balance): number {
  const factor = boostFactor(
    isActive(planet.speedBoostUntilTick, tick),
    balance.boosts.speed.factorPermille,
  );
  return mulPermille(balance.flightSpeedUnitsPerSecond, factor);
}

/** Приток семечек за тик (одинаков для всех игроков с одинаковым числом планет). */
export function seedsPerTick(balance: Balance): number {
  return Math.floor((balance.seedsPerPlanetPerSecond * MS_PER_TICK) / 1000);
}
