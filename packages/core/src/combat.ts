/**
 * Чистая математика боя и захвата (IDEA.md §3.4, уточнено в §3.4.1).
 *
 * Никакого состояния: вход — числа, выход — числа. Здесь живёт единственное
 * место, где решается исход, поэтому его проверяют тесты и тест детерминизма.
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

export interface CaptureInput {
  /** Текущий гарнизон планеты. */
  readonly garrison: number;
  /** Защита планеты в permille с учётом бустов и бонусов. */
  readonly defensePermille: number;
  /** Прибывшие войска атакующего. */
  readonly attackers: number;
  /** Минимальный гарнизон после захвата. */
  readonly minCaptureGarrison: number;
}

export type CaptureOutcome =
  | { readonly captured: true; readonly garrison: number }
  | { readonly captured: false; readonly garrison: number };

/**
 * Захват по численности.
 *
 *   сила_защиты = floor(гарнизон × защита / 1000)
 *   атакующие > сила_защиты → захват, гарнизон = max(минимум, атакующие − сила_защиты)
 *   иначе                   → гарнизон = floor((сила_защиты − атакующие) × 1000 / защита)
 *
 * Во второй ветви допускается гарнизон 0: планета удержана, но её защищать
 * некому — следующий отряд заберёт её без боя. Это осознанное правило.
 */
export function resolveCapture(input: CaptureInput): CaptureOutcome {
  const defense = defenseForce(input.garrison, input.defensePermille);
  if (input.attackers > defense) {
    const survivors = input.attackers - defense;
    return {
      captured: true,
      garrison: Math.max(input.minCaptureGarrison, survivors),
    };
  }
  const rest = defense - input.attackers;
  const garrison = Math.floor((rest * PERMILLE) / input.defensePermille);
  return { captured: false, garrison: Math.max(0, garrison) };
}

/** Половина хомяка — порог, ниже которого отряд не формируется. */
export const MIN_FLEET_SIZE = HAMSTER;
