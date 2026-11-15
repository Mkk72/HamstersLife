/**
 * Чистая математика схватки отрядов в полёте и защиты планеты.
 *
 * Захват планеты считает фазовый бой (`battle.ts`); здесь остаются формулы,
 * которые нужны и бою, и боту: сила защиты и схватка двух отрядов без бонусов.
 */
import { HAMSTER, PERMILLE, mulPermille } from './units';

export interface DefenseResult {
  /** Сила гарнизона в milli-единицах: garrison × защита. */
  readonly force: number;
}

/** Сила защиты планеты: гарнизон × защита (permille), вниз. */
export function defenseForce(garrison: number, defensePermille: number): number {
  return mulPermille(garrison, defensePermille);
}

export type BattleWinner = 'attacker' | 'defender' | 'none';

export interface BattleResult {
  readonly winner: BattleWinner;
  /** Сколько milli-единиц осталось у победителя. */
  readonly remaining: number;
}

/**
 * Схватка двух сил «по той же формуле», что и захват, но без защиты (1.0).
 * Равные силы уничтожают друг друга.
 */
export function resolveBattle(attacker: number, defender: number): BattleResult {
  if (attacker > defender) return { winner: 'attacker', remaining: attacker - defender };
  if (defender > attacker) return { winner: 'defender', remaining: defender - attacker };
  return { winner: 'none', remaining: 0 };
}

/** Половина хомяка — порог, ниже которого отряд не формируется. */
export const MIN_FLEET_SIZE = HAMSTER;

/** Пригодится снаружи: 1000 permille = 1.0. */
export const FULL_DEFENSE = PERMILLE;
