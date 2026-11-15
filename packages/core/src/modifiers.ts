/**
 * Действующие значения с учётом бустов.
 *
 * Единственное место, где буст превращается в число. Тик только спрашивает
 * «сколько произвести / какова защита / какова скорость», а не разбирает
 * таймеры сам. Новый вид буста подключается здесь в одном месте.
 */
import { isBoostActive } from './boosts';
import type { Balance, Planet } from './types';
import { MS_PER_TICK, PERMILLE, TICKS_PER_SECOND, mulPermille } from './units';

function factorFor(
  planet: Planet,
  kind: keyof Balance['boosts'],
  tick: number,
  balance: Balance,
): number {
  return isBoostActive(planet, kind, tick) ? balance.boosts[kind].factorPermille : PERMILLE;
}

/** Производство планеты за один тик в milli-единицах. */
export function productionPerTick(planet: Planet, tick: number, balance: Balance): number {
  const perSecond = balance.planetSizes[planet.size].productionPerSecond;
  const base = Math.floor(perSecond / TICKS_PER_SECOND);
  return mulPermille(base, factorFor(planet, 'production', tick, balance));
}

/** Защита планеты в permille с учётом «Ореховой скорлупы» и бонуса клана. */
export function defensePermille(
  planet: Planet,
  tick: number,
  balance: Balance,
  clanDefensePermille = PERMILLE,
): number {
  const withBoost = mulPermille(
    planet.defensePermille,
    factorFor(planet, 'defense', tick, balance),
  );
  return mulPermille(withBoost, clanDefensePermille);
}

/** Скорость флота, вылетающего с планеты, с учётом буста и бонуса клана. */
export function speedUnitsPerSecond(
  planet: Planet,
  tick: number,
  balance: Balance,
  clanSpeedPermille = PERMILLE,
): number {
  const withBoost = mulPermille(
    balance.flightSpeedUnitsPerSecond,
    factorFor(planet, 'speed', tick, balance),
  );
  return mulPermille(withBoost, clanSpeedPermille);
}

/** Приток семечек за тик (одинаков для игроков с одинаковым числом планет). */
export function seedsPerTick(balance: Balance): number {
  return Math.floor((balance.seedsPerPlanetPerSecond * MS_PER_TICK) / 1000);
}
