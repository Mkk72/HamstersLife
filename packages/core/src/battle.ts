/**
 * Фазовый бой: дальний обмен → сближение → ближний бой.
 *
 * Чистая функция: на вход составы и настройки, на выход — выжившие и исход.
 * Три фазы идут по порядку, внутри фазы действуют только те рода войск,
 * которые достреливают/доезжают до противника:
 *  - дальний обмен — все, у кого `range >= 1`;
 *  - сближение — конница (быстрая, успевает врубиться);
 *  - ближний бой — все, включая стрелков.
 *
 * Потери стороны за фазу ограничены `phaseLossPermille` и зависят от того,
 * насколько её наступательная мощь превышает защитную мощь противника.
 * Взаимные множители рода против рода берутся из `strongAgainst`/`weakAgainst`.
 */
import { createTroopStack, resizeTroops, troopTotal, TROOP_KINDS } from './troops';
import type { TroopKind } from './troops';
import type { CombatStats, TroopStats, TroopStack } from './types';

export interface FieldBattleResult {
  readonly attacker: TroopStack;
  readonly defender: TroopStack;
  readonly captured: boolean;
}

type Phase = 'ranged' | 'approach' | 'melee';

const PHASE_ACTORS: Readonly<Record<Phase, readonly TroopKind[]>> = {
  ranged: ['archer', 'cannon', 'mage'],
  // На сближении конница врубается, а мечники успевают её встретить.
  approach: ['swordsman', 'cavalry'],
  melee: TROOP_KINDS,
};

const PHASE_EFFICIENCY: Readonly<Record<Phase, keyof CombatStats>> = {
  ranged: 'rangedEfficiencyPermille',
  approach: 'approachEfficiencyPermille',
  melee: 'meleeEfficiencyPermille',
};

function effectiveness(
  kind: TroopKind,
  enemy: TroopStack,
  troops: Readonly<Record<TroopKind, TroopStats>>,
  combat: CombatStats,
): number {
  const stats = troops[kind];
  const enemyTotal = troopTotal(enemy);
  if (enemyTotal <= 0) return 1000;

  let weighted = 0;
  for (const target of TROOP_KINDS) {
    const count = enemy[target];
    if (count <= 0) continue;
    let multiplier = 1000;
    if (stats.strongAgainst.includes(target)) multiplier = combat.strongPermille;
    else if (stats.weakAgainst.includes(target)) multiplier = combat.weakPermille;
    weighted += count * multiplier;
  }
  return Math.floor(weighted / enemyTotal);
}

/** Наступательная мощь стороны в фазе: только действующие рода, с множителями. */
function attackPower(
  actors: readonly TroopKind[],
  stack: TroopStack,
  enemy: TroopStack,
  troops: Readonly<Record<TroopKind, TroopStats>>,
  combat: CombatStats,
  efficiencyPermille: number,
): number {
  let power = 0;
  for (const kind of actors) {
    const count = stack[kind];
    if (count <= 0) continue;
    const stats = troops[kind];
    const eff = effectiveness(kind, enemy, troops, combat);
    // count (mH) × атака × множитель × КПД фазы / 1000 / 1000
    power += Math.floor((count * stats.attack * eff * efficiencyPermille) / (1000 * 1000));
  }
  return power;
}

/** Защитная мощь стороны: весь состав, с бонусом защиты планеты. */
function defensePool(
  stack: TroopStack,
  troops: Readonly<Record<TroopKind, TroopStats>>,
  defensePermille: number,
): number {
  let pool = 0;
  for (const kind of TROOP_KINDS) {
    const count = stack[kind];
    if (count <= 0) continue;
    pool += Math.floor((count * troops[kind].defense * defensePermille) / 1000);
  }
  return pool;
}

export function resolveFieldBattle(
  attackerInput: TroopStack,
  defenderInput: TroopStack,
  defenderDefensePermille: number,
  balance: { readonly troops: Readonly<Record<TroopKind, TroopStats>>; readonly combat: CombatStats },
): FieldBattleResult {  let attacker = attackerInput;
  let defender = defenderInput;
  const { troops, combat } = balance;

  for (const phase of ['ranged', 'approach', 'melee'] as const) {
    const attackerTotal = troopTotal(attacker);
    const defenderTotal = troopTotal(defender);
    if (attackerTotal <= 0 || defenderTotal <= 0) break;

    const actors = PHASE_ACTORS[phase];
    const efficiency = combat[PHASE_EFFICIENCY[phase]];

    const attackA = attackPower(actors, attacker, defender, troops, combat, efficiency);
    const attackD = attackPower(actors, defender, attacker, troops, combat, efficiency);
    const defenseA = defensePool(attacker, troops, 1000);
    const defenseD = defensePool(defender, troops, defenderDefensePermille);

    const shareA = Math.floor((attackA * 1000) / Math.max(1, attackA + defenseD));
    const shareD = Math.floor((attackD * 1000) / Math.max(1, attackD + defenseA));

    const lossPermilleD = Math.min(combat.phaseLossPermille, Math.floor((combat.phaseLossPermille * shareA) / 1000));
    const lossPermilleA = Math.min(combat.phaseLossPermille, Math.floor((combat.phaseLossPermille * shareD) / 1000));

    const lostD = Math.floor((defenderTotal * lossPermilleD) / 1000);
    const lostA = Math.floor((attackerTotal * lossPermilleA) / 1000);

    defender = resizeTroops(defender, defenderTotal - lostD);
    attacker = resizeTroops(attacker, attackerTotal - lostA);
  }

  const attackerLeft = troopTotal(attacker);
  const defenderLeft = troopTotal(defender);

  if (attackerLeft > defenderLeft) {
    return {
      captured: true,
      attacker: resizeTroops(attacker, attackerLeft - defenderLeft),
      defender: createTroopStack(),
    };
  }

  return {
    captured: false,
    attacker: createTroopStack(),
    defender: resizeTroops(defender, defenderLeft - attackerLeft),
  };
}
