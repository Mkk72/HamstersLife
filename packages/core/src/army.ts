/**
 * Армия: целые юниты с постоянными id. Никаких milli-единиц: один юнит —
 * одна ячейка гарнизона. Все операции детерминированы и не теряют бойцов.
 */
import type { Army, Plan, Tick, Unit, UnitKind, UnitStats } from './types';
import { UNIT_KINDS } from './types';

export function emptyPlan(): Plan {
  return { swordsman: 0, archer: 0, cavalry: 0, cannon: 0 };
}

export function clonePlan(plan: Plan): Plan {
  return { ...plan };
}

export function planSum(plan: Plan): number {
  return UNIT_KINDS.reduce((sum, kind) => sum + plan[kind], 0);
}

export function planFrom(partial: Partial<Plan>): Plan {
  const plan = emptyPlan();
  for (const kind of UNIT_KINDS) plan[kind] = Math.max(0, Math.floor(partial[kind] ?? 0));
  return plan;
}

export function countsOf(army: readonly Unit[]): Plan {
  const counts = emptyPlan();
  for (const unit of army) counts[unit.kind] += 1;
  return counts;
}

export function armySize(army: readonly Unit[]): number {
  return army.length;
}

export function createUnit(
  id: number,
  kind: UnitKind,
  stats: UnitStats,
  hp = stats.hp,
): Unit {
  return { id, kind, hp: Math.min(stats.hp, Math.max(1, hp)), healAtTick: 0, nextAttackTick: 0 };
}

export function addUnits(
  army: Army,
  counts: Plan,
  nextId: () => number,
  stats: Record<UnitKind, UnitStats>,
): void {
  for (const kind of UNIT_KINDS) {
    for (let index = 0; index < counts[kind]; index += 1) {
      army.push(createUnit(nextId(), kind, stats[kind]));
    }
  }
  army.sort((a, b) => a.id - b.id);
}

export function mergeArmies(target: Army, incoming: readonly Unit[]): void {
  target.push(...incoming);
  target.sort((a, b) => a.id - b.id);
}

export function removeUnits(army: Army, ids: readonly number[]): void {
  if (ids.length === 0) return;
  const remove = new Set(ids);
  let write = 0;
  for (const unit of army) {
    if (remove.has(unit.id)) continue;
    army[write] = unit;
    write += 1;
  }
  army.length = write;
}

export function maxHp(unit: Unit, stats: Record<UnitKind, UnitStats>): number {
  return stats[unit.kind].hp;
}

export function healUnit(unit: Unit, stats: Record<UnitKind, UnitStats>): void {
  unit.hp = stats[unit.kind].hp;
  unit.healAtTick = 0;
}

/** Нанести урон юниту; вернуть true, если он погиб. */
export function damageUnit(
  unit: Unit,
  damage: number,
  tick: Tick,
): boolean {
  if (damage <= 0) return false;
  unit.hp -= damage;
  if (unit.hp <= 0) return true;
  unit.healAtTick = tick + 200;
  return false;
}

export interface SplitResult {
  readonly taken: Army;
  readonly remaining: Army;
}

/**
 * Взять долю армии. Сначала общее количество с округлением вверх, затем
 * распределение по родам методом наибольших остатков с фиксированным порядком.
 * Если задан род — доля считается только от него.
 */
export function splitArmy(
  army: readonly Unit[],
  ratio: number,
  kind?: UnitKind,
): SplitResult {
  const counts = countsOf(army);
  const total = army.length;
  if (total === 0 || ratio <= 0) return { taken: [], remaining: [...army] };

  const quotas = emptyPlan();
  if (kind) {
    const ofKind = counts[kind];
    if (ofKind === 0) return { taken: [], remaining: [...army] };
    quotas[kind] = Math.min(ofKind, Math.ceil((ofKind * ratio) / 100));
  } else {
    const take = Math.min(total, Math.ceil((total * ratio) / 100));
    const shares = UNIT_KINDS.map((unitKind, index) => {
      const exact = counts[unitKind] * take;
      return {
        kind: unitKind,
        index,
        share: Math.floor(exact / total),
        remainder: exact % total,
      };
    });
    let assigned = shares.reduce((sum, share) => sum + share.share, 0);
    shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    let cursor = 0;
    while (assigned < take && shares.length > 0) {
      const share = shares[cursor % shares.length];
      if (!share) break;
      if (share.share < counts[share.kind]) {
        share.share += 1;
        assigned += 1;
      }
      cursor += 1;
      if (cursor > shares.length * take) break;
    }
    for (const share of shares) quotas[share.kind] = share.share;
  }

  const taken: Army = [];
  const remaining: Army = [];
  const used = emptyPlan();
  for (const unit of army) {
    if (used[unit.kind] < quotas[unit.kind]) {
      taken.push(unit);
      used[unit.kind] += 1;
    } else {
      remaining.push(unit);
    }
  }
  return { taken, remaining };
}

/** Забрать из армии заданное число юнитов каждого рода (самые младшие id). */
export function takeUnits(army: Army, counts: Plan): Army {
  const taken: Army = [];
  const used = emptyPlan();
  for (let index = 0; index < army.length; index += 1) {
    const unit = army[index];
    if (!unit) continue;
    if (used[unit.kind] < counts[unit.kind]) {
      taken.push(unit);
      used[unit.kind] += 1;
    }
  }
  const takeIds = new Set(taken.map((unit) => unit.id));
  let write = 0;
  for (const unit of army) {
    if (takeIds.has(unit.id)) continue;
    army[write] = unit;
    write += 1;
  }
  army.length = write;
  return taken;
}

/** Точный состав гарнизона после производства/потерь — для плана и UI. */
export function planCapacityUsed(plan: Plan): number {
  return planSum(plan);
}
