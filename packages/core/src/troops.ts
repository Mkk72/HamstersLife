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
