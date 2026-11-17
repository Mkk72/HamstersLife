/**
 * Производство по плану гарнизона.
 *
 * У планеты одна общая мощность. Она делится между недостающими родами
 * пропорционально оставшейся работе (недостача × работа − прогресс). Готовые
 * юниты появляются целыми; незавершённый прогресс сохраняется, но не копится
 * сверх одного готового юнита. При заполненной вместимости прогресс замирает.
 */
import type { Balance, Battle, GameState, Plan, Planet, UnitKind, UnitStats } from './types';
import { UNIT_KINDS } from './types';
import { clonePlan, countsOf, emptyPlan, planSum } from './army';
import { createUnit } from './army';

export interface TickContext {
  readonly tick: number;
  readonly balance: Balance;
}

export function capacityOf(planet: Planet, balance: Balance): number {
  return balance.planetSizes[planet.size].capacity;
}

/** Проценты шаблона → точные числа по вместимости (наибольшие остатки). */
export function planFromPercents(percents: Plan, capacity: number): Plan {
  const totalPercent = planSum(percents);
  if (totalPercent <= 0) return emptyPlan();
  const quotas = UNIT_KINDS.map((kind, index) => ({
    kind,
    index,
    value: Math.floor((capacity * percents[kind]) / totalPercent),
    remainder: (capacity * percents[kind]) % totalPercent,
  }));
  let assigned = quotas.reduce((sum, quota) => sum + quota.value, 0);
  const order = [...quotas].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let cursor = 0;
  while (assigned < capacity && order.length > 0) {
    const quota = order[cursor % order.length];
    if (!quota) break;
    quota.value += 1;
    assigned += 1;
    cursor += 1;
  }
  const plan = emptyPlan();
  for (const quota of quotas) plan[quota.kind] = quota.value;
  return plan;
}

function battleOf(state: GameState, planet: Planet): Battle | undefined {
  return planet.battleId === null
    ? undefined
    : state.battles.find((battle) => battle.id === planet.battleId);
}

function currentArmy(planet: Planet, battle: Battle | undefined) {
  return battle ? battle.defender : planet.army;
}

/** Учесть новый юнит: в бою он вступает со следующего раунда. */
function addProducedUnit(
  planet: Planet,
  battle: Battle | undefined,
  kind: UnitKind,
  state: GameState,
  stats: Record<UnitKind, UnitStats>,
): void {
  const unit = createUnit(state.nextUnitId, kind, stats[kind]);
  state.nextUnitId += 1;
  if (battle) {
    unit.nextAttackTick = state.tick + stats[kind].firstAttackTicks;
    battle.defender.push(unit);
    battle.defender.sort((a, b) => a.id - b.id);
  } else {
    planet.army.push(unit);
    planet.army.sort((a, b) => a.id - b.id);
  }
}

/** Ограничить прогресс: не копить скрытый запас готовых юнитов. */
function clampProgress(planet: Planet, balance: Balance): void {
  const counts = planet.battleId !== null ? null : countsOf(planet.army);
  for (const kind of UNIT_KINDS) {
    const actual = counts ? counts[kind] : 0;
    const missing = Math.max(0, planet.plan[kind] - actual);
    const maxProgress = missing * balance.troops[kind].work;
    if (planet.production[kind] > maxProgress) planet.production[kind] = maxProgress;
  }
}

export function productionSystem(state: GameState, context: TickContext): void {
  const { balance } = context;
  for (const planet of state.planets) {
    if (planet.ownerId < 0) continue;
    // Осаждённая планета не производит: иначе гарнизон восполняется быстрее,
    // чем атакующий успевает его уничтожить, и захват становится невозможным.
    if (planet.battleId !== null) continue;
    const battle = battleOf(state, planet);
    const army = currentArmy(planet, battle);
    const capacity = capacityOf(planet, balance);

    // Прогресс не должен превышать оставшуюся работу после смены плана.
    clampProgress(planet, balance);

    if (army.length >= capacity) {
      // Мест нет: прогресс замирает, но готовый юнит не теряется.
      for (const kind of UNIT_KINDS) {
        const work = balance.troops[kind].work;
        if (planet.production[kind] >= work) planet.production[kind] = work;
      }
      continue;
    }

    const counts = countsOf(army);
    const remainingWork = emptyPlan();
    let totalRemaining = 0;
    for (const kind of UNIT_KINDS) {
      const missing = Math.max(0, planet.plan[kind] - counts[kind]);
      const work = Math.max(0, missing * balance.troops[kind].work - planet.production[kind]);
      remainingWork[kind] = work;
      totalRemaining += work;
    }
    if (totalRemaining <= 0) continue;

    const power = balance.planetSizes[planet.size].powerPerTick;
    const shares = UNIT_KINDS.map((kind, index) => {
      const exact = power * remainingWork[kind];
      return {
        kind,
        index,
        share: Math.floor(exact / totalRemaining),
        remainder: exact % totalRemaining,
      };
    });
    let assigned = shares.reduce((sum, share) => sum + share.share, 0);
    shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    let cursor = 0;
    while (assigned < power && shares.length > 0) {
      const share = shares[cursor % shares.length];
      if (!share) break;
      share.share += 1;
      assigned += 1;
      cursor += 1;
    }
    for (const share of shares) planet.production[share.kind] += share.share;

    // Целые юниты. При нехватке мест первыми получают место рода в
    // фиксированном порядке UNIT_KINDS; остальные остаются готовыми (progress=work).
    let free = capacity - army.length;
    for (const kind of UNIT_KINDS) {
      const work = balance.troops[kind].work;
      while (planet.production[kind] >= work && free > 0) {
        planet.production[kind] -= work;
        addProducedUnit(planet, battle, kind, state, balance.troops);
        free -= 1;
      }
      if (free <= 0 && planet.production[kind] >= work) planet.production[kind] = work;
    }
  }
}

/** План после захвата: 60% мечников / 40% лучников по вместимости. */
export function capturePlan(planet: Planet, balance: Balance): Plan {
  return planFromPercents(balance.capturePercents, capacityOf(planet, balance));
}

export function resetProduction(planet: Planet): void {
  planet.production = clonePlan(emptyPlan());
}

export function clampProductionToPlan(planet: Planet, balance: Balance): void {
  const counts = countsOf(planet.army);
  for (const kind of UNIT_KINDS) {
    const missing = Math.max(0, planet.plan[kind] - counts[kind]);
    const maxProgress = missing * balance.troops[kind].work;
    if (planet.production[kind] > maxProgress) planet.production[kind] = maxProgress;
  }
}
