/**
 * Состав отряда: рода войск и их количество.
 *
 * Пока игра считает гарнизон одним числом, но модель состава уже заведена:
 * этап 2 переводит планеты и флоты на `TroopStack`. Все величины — целые
 * milli-единицы, как и остальное ядро.
 */
import type { MilliUnits } from './units';

export const TROOP_KINDS = ['swordsman', 'archer', 'cannon', 'cavalry', 'mage'] as const;

export type TroopKind = (typeof TROOP_KINDS)[number];

/** Количество каждого рода войск; отсутствующие в отряде виды — нули. */
export type TroopStack = Record<TroopKind, MilliUnits>;

export function createTroopStack(initial?: Partial<TroopStack>): TroopStack {
  const stack = {} as TroopStack;
  for (const kind of TROOP_KINDS) stack[kind] = initial?.[kind] ?? 0;
  return stack;
}

export function cloneTroops(stack: TroopStack): TroopStack {
  return createTroopStack(stack);
}

export function troopTotal(stack: TroopStack): MilliUnits {
  let total = 0;
  for (const kind of TROOP_KINDS) total += stack[kind];
  return total;
}

export function isEmptyTroops(stack: TroopStack): boolean {
  return troopTotal(stack) === 0;
}

/** Сложение составов (новый объект). */
export function mergeTroops(left: TroopStack, right: TroopStack): TroopStack {
  const merged = createTroopStack();
  for (const kind of TROOP_KINDS) merged[kind] = left[kind] + right[kind];
  return merged;
}

/** Умножить состав на permille с округлением вниз по каждому виду. */
export function scaleTroops(stack: TroopStack, permille: number): TroopStack {
  const scaled = createTroopStack();
  for (const kind of TROOP_KINDS) {
    scaled[kind] = Math.floor((stack[kind] * permille) / 1000);
  }
  return scaled;
}

/** Вычесть состав; отрицательных значений не остаётся. */
export function subtractTroops(stack: TroopStack, amount: TroopStack): TroopStack {
  const rest = createTroopStack();
  for (const kind of TROOP_KINDS) rest[kind] = Math.max(0, stack[kind] - amount[kind]);
  return rest;
}

/** Сколько каждого вида приходится на долю `amount / total` (вниз). */
export function splitTroops(stack: TroopStack, amount: MilliUnits): TroopStack {
  const total = troopTotal(stack);
  if (total <= 0 || amount <= 0) return createTroopStack();
  const take = Math.min(amount, total);
  const part = createTroopStack();
  for (const kind of TROOP_KINDS) {
    part[kind] = Math.floor((stack[kind] * take) / total);
  }
  return part;
}

/**
 * Взять отряд заданной численности, по возможности из выбранных родов.
 *
 * `weights` — желаемые доли родов (например, 40/30/30). Если веса не заданы
 * или пусты, отряд забирается пропорционально составу. Если выбранного рода
 * не хватает, берётся сколько есть; недостача не добирается другими родами —
 * игрок сам выбрал состав.
 */
export function allocateTroops(
  stack: TroopStack,
  amount: MilliUnits,
  weights?: Partial<Record<TroopKind, number>>,
): TroopStack {
  const total = troopTotal(stack);
  if (total <= 0 || amount <= 0) return createTroopStack();
  const take = Math.min(amount, total);

  const entries = weights
    ? (TROOP_KINDS.filter((kind) => (weights[kind] ?? 0) > 0).map((kind) => ({
        kind,
        weight: weights[kind] ?? 0,
      })) as { kind: TroopKind; weight: number }[])
    : [];

  if (entries.length === 0) return resizeTroops(stack, take);

  const sumWeights = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const part = createTroopStack();
  for (const entry of entries) {
    const want = Math.floor((take * entry.weight) / sumWeights);
    part[entry.kind] = Math.min(want, stack[entry.kind]);
  }
  return part;
}

/**
 * Пересчитать состав на точное количество, сохранив пропорции.
 *
 * В отличие от `scaleTroops`, сумма результата ровно `targetTotal`: остаток
 * раздаётся по крупнейшему остатку, поэтому потери массы при округлении нет.
 * Если состава не было, всё становится базовыми бойцами (мечниками).
 */
export function resizeTroops(stack: TroopStack, targetTotal: MilliUnits): TroopStack {
  if (targetTotal <= 0) return createTroopStack();

  const total = troopTotal(stack);
  if (total <= 0) return createTroopStack({ swordsman: targetTotal });

  const parts = TROOP_KINDS.map((kind, index) => {
    const exact = stack[kind] * targetTotal;
    return {
      kind,
      index,
      share: Math.floor(exact / total),
      remainder: exact % total,
    };
  });

  let assigned = parts.reduce((sum, part) => sum + part.share, 0);
  let left = targetTotal - assigned;

  parts.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let cursor = 0;
  while (left > 0) {
    const part = parts[cursor % parts.length];
    if (!part) break;
    part.share += 1;
    left -= 1;
    cursor += 1;
  }

  const resized = createTroopStack();
  for (const part of parts) resized[part.kind] = part.share;
  return resized;
}
