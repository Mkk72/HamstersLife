/**
 * Бой во времени: раунд раз в 0,2 с, одновременные удары, перелив урона и
 * контр-множители. Бой — состояние симуляции: его нельзя разрешить заранее.
 *
 * Полевой бой заканчивается продолжением полёта победителя из точки встречи.
 * Планетарный бой — захватом или обороной; производство на планете идёт, а
 * подкрепления вступают со следующего раунда.
 */
import type {
  Army,
  Balance,
  Battle,
  FieldRoute,
  Fleet,
  GameState,
  Planet,
  PlayerId,
  Tick,
  Unit,
  UnitKind,
  UnitStats,
} from './types';
import { distance, flightTicks } from './flight';
import { capturePlan, resetProduction } from './production';

const ROUND_TICKS = 4;

function statsOf(balance: Balance): Record<UnitKind, UnitStats> {
  return balance.troops;
}

function alive(army: readonly Unit[]): Unit[] {
  return army.filter((unit) => unit.hp > 0);
}

function prepare(army: readonly Unit[], tick: Tick, stats: Record<UnitKind, UnitStats>): void {
  for (const unit of army) {
    unit.nextAttackTick = tick + stats[unit.kind].firstAttackTicks;
  }
}

/** Цель по приоритету рода: первый живой род, внутри — раненый, затем id. */
function pickTarget(
  army: readonly Unit[],
  hp: ReadonlyMap<number, number>,
  kind: UnitKind,
  stats: Record<UnitKind, UnitStats>,
): Unit | null {
  for (const targetKind of stats[kind].priority) {
    let best: Unit | null = null;
    for (const unit of army) {
      if (unit.kind !== targetKind) continue;
      const currentHp = hp.get(unit.id) ?? 0;
      if (currentHp <= 0) continue;
      if (!best) {
        best = unit;
        continue;
      }
      const bestHp = hp.get(best.id) ?? 0;
      if (currentHp < bestHp || (currentHp === bestHp && unit.id < best.id)) best = unit;
    }
    if (best) return best;
  }
  return null;
}

interface DamageResult {
  readonly damage: Map<number, number>;
  readonly attacked: Set<number>;
}

/**
 * Урон одной стороны по снимку HP противника. Перелив: остаток базовой силы
 * пересчитывается против нового рода, старый бонус не переносится.
 */
function computeDamage(
  attackers: readonly Unit[],
  defenders: readonly Unit[],
  tick: Tick,
  stats: Record<UnitKind, UnitStats>,
  damagePermille = 1000,
): DamageResult {
  const hp = new Map<number, number>();
  for (const unit of defenders) hp.set(unit.id, unit.hp);
  const damage = new Map<number, number>();
  const attacked = new Set<number>();

  for (const attacker of attackers) {
    if (attacker.hp <= 0 || attacker.nextAttackTick > tick) continue;
    attacked.add(attacker.id);
    let base = Math.max(
      1,
      Math.floor((stats[attacker.kind].damage * damagePermille) / 1000),
    );
    let guard = 0;
    while (base > 0 && guard <= defenders.length) {
      guard += 1;
      const target = pickTarget(defenders, hp, attacker.kind, stats);
      if (!target) break;
      const multiplier = stats[attacker.kind].counters[target.kind] ?? 1000;
      const effective = Math.max(1, Math.floor((base * multiplier) / 1000));
      const targetHp = hp.get(target.id) ?? 0;
      const applied = Math.min(targetHp, effective);
      if (applied <= 0) {
        hp.set(target.id, 0);
        continue;
      }
      hp.set(target.id, targetHp - applied);
      damage.set(target.id, (damage.get(target.id) ?? 0) + applied);
      if (targetHp - applied <= 0) {
        base -= Math.min(base, Math.ceil((applied * 1000) / multiplier));
      } else {
        base = 0;
      }
    }
  }

  return { damage, attacked };
}

function applyDamage(
  army: Army,
  damage: ReadonlyMap<number, number>,
  tick: Tick,
): void {
  for (const unit of army) {
    const incoming = damage.get(unit.id) ?? 0;
    if (incoming <= 0) continue;
    unit.hp -= incoming;
    if (unit.hp > 0) unit.healAtTick = tick + 200;
  }
  for (let index = army.length - 1; index >= 0; index -= 1) {
    const unit = army[index];
    if (unit && unit.hp <= 0) army.splice(index, 1);
  }
}

function removeRoutesForPlanet(state: GameState, planetId: number): void {
  for (let index = state.routes.length - 1; index >= 0; index -= 1) {
    const route = state.routes[index];
    if (route && (route.fromPlanetId === planetId || route.toPlanetId === planetId)) {
      state.routes.splice(index, 1);
    }
  }
}

function resetTimers(army: readonly Unit[]): void {
  for (const unit of army) unit.nextAttackTick = 0;
}

function continueFlight(
  state: GameState,
  winner: Army,
  ownerId: PlayerId,
  route: FieldRoute | null,
  balance: Balance,
): void {
  if (!route || winner.length === 0) return;
  const from = state.planets[route.fromPlanetId];
  const to = state.planets[route.toPlanetId];
  if (!from || !to) return;
  const full = distance(from.x, from.y, to.x, to.y);
  const remaining = Math.max(0, full - Math.floor((full * route.progressPermille) / 1000));
  const ticks = Math.max(1, flightTicks(remaining, balance.flightSpeedUnitsPerSecond));
  const fleet: Fleet = {
    id: state.nextFleetId,
    ownerId,
    fromPlanetId: route.fromPlanetId,
    toPlanetId: route.toPlanetId,
    army: winner,
    departTick: state.tick,
    arriveTick: state.tick + ticks,
    startProgressPermille: route.progressPermille,
  };
  state.nextFleetId += 1;
  state.fleets.push(fleet);
}

export function startPlanetBattle(
  state: GameState,
  planet: Planet,
  fleet: Fleet,
  balance: Balance,
): Battle {
  const battle: Battle = {
    id: state.nextBattleId,
    kind: 'planet',
    planetId: planet.id,
    attackerOwnerId: fleet.ownerId,
    defenderOwnerId: planet.ownerId,
    attacker: fleet.army,
    defender: planet.army,
    round: 0,
    nextRoundTick: state.tick + ROUND_TICKS,
    attackerRoute: null,
    defenderRoute: null,
  };
  state.nextBattleId += 1;
  planet.army = [];
  planet.battleId = battle.id;
  prepare(battle.attacker, state.tick, statsOf(balance));
  prepare(battle.defender, state.tick, statsOf(balance));
  state.battles.push(battle);
  state.events.push({
    kind: 'battle-start',
    tick: state.tick,
    battleId: battle.id,
    planetId: planet.id,
    attackerOwnerId: battle.attackerOwnerId,
    defenderOwnerId: battle.defenderOwnerId,
  });
  return battle;
}

export function startFieldBattle(
  state: GameState,
  first: Fleet,
  second: Fleet,
  progressPermille: number,
  balance: Balance,
): Battle {
  const battle: Battle = {
    id: state.nextBattleId,
    kind: 'field',
    planetId: null,
    attackerOwnerId: first.ownerId,
    defenderOwnerId: second.ownerId,
    attacker: first.army,
    defender: second.army,
    round: 0,
    nextRoundTick: state.tick + ROUND_TICKS,
    attackerRoute: {
      fromPlanetId: first.fromPlanetId,
      toPlanetId: first.toPlanetId,
      progressPermille,
    },
    defenderRoute: {
      fromPlanetId: second.fromPlanetId,
      toPlanetId: second.toPlanetId,
      progressPermille,
    },
  };
  state.nextBattleId += 1;
  prepare(battle.attacker, state.tick, statsOf(balance));
  prepare(battle.defender, state.tick, statsOf(balance));
  state.battles.push(battle);
  state.events.push({
    kind: 'interception',
    tick: state.tick,
    fromPlanetId: first.fromPlanetId,
    toPlanetId: first.toPlanetId,
    progressPermille,
    fleetIds: [first.id, second.id],
  });
  return battle;
}

/** Присоединить подошедший флот к своей стороне боя. */
export function joinBattle(state: GameState, battle: Battle, fleet: Fleet, balance: Balance): void {
  const side =
    fleet.ownerId === battle.attackerOwnerId
      ? battle.attacker
      : fleet.ownerId === battle.defenderOwnerId
        ? battle.defender
        : null;
  if (!side) return;
  for (const unit of fleet.army) {
    unit.nextAttackTick = state.tick + statsOf(balance)[unit.kind].firstAttackTicks;
  }
  side.push(...fleet.army);
  side.sort((a, b) => a.id - b.id);
}

function endEvent(state: GameState, battle: Battle, captured: boolean): void {
  state.events.push({
    kind: 'battle-end',
    tick: state.tick,
    battleId: battle.id,
    planetId: battle.planetId,
    attackerOwnerId: battle.attackerOwnerId,
    defenderOwnerId: battle.defenderOwnerId,
    captured,
  });
}

function finishBattle(state: GameState, battle: Battle, balance: Balance): void {
  const attackerAlive = alive(battle.attacker);
  const defenderAlive = alive(battle.defender);
  const index = state.battles.indexOf(battle);
  if (index < 0) return;

  if (battle.kind === 'planet' && battle.planetId !== null) {
    const planet = state.planets[battle.planetId];
    if (!planet) {
      state.battles.splice(index, 1);
      return;
    }

    if (attackerAlive.length > 0 && defenderAlive.length === 0) {
      planet.ownerId = battle.attackerOwnerId;
      planet.army = attackerAlive;
      resetTimers(planet.army);
      planet.plan = capturePlan(planet, balance);
      resetProduction(planet);
      planet.battleId = null;
      removeRoutesForPlanet(state, planet.id);
      state.battles.splice(index, 1);
      endEvent(state, battle, true);
      return;
    }

    planet.army = defenderAlive;
    resetTimers(planet.army);
    planet.battleId = null;
    state.battles.splice(index, 1);
    endEvent(state, battle, false);
    return;
  }

  if (attackerAlive.length > 0 && defenderAlive.length === 0) {
    continueFlight(state, attackerAlive, battle.attackerOwnerId, battle.attackerRoute, balance);
  } else if (defenderAlive.length > 0 && attackerAlive.length === 0) {
    continueFlight(state, defenderAlive, battle.defenderOwnerId, battle.defenderRoute, balance);
  }
  state.battles.splice(index, 1);
  endEvent(state, battle, false);
}

function resolveRound(state: GameState, battle: Battle, balance: Balance): void {
  const stats = statsOf(balance);
  // Защитники занятой игроком планеты получают меньше входящего урона.
  const defendingPlayer =
    battle.kind === 'planet' &&
    battle.planetId !== null &&
    (state.planets[battle.planetId]?.ownerId ?? -1) >= 0;
  const attackerDamage = computeDamage(
    battle.attacker,
    battle.defender,
    state.tick,
    stats,
    defendingPlayer ? balance.defense.damagePermille : 1000,
  );
  const defenderDamage = computeDamage(battle.defender, battle.attacker, state.tick, stats);

  for (const unit of battle.attacker) {
    if (attackerDamage.attacked.has(unit.id)) {
      unit.nextAttackTick = state.tick + stats[unit.kind].attackIntervalTicks;
    }
  }
  for (const unit of battle.defender) {
    if (defenderDamage.attacked.has(unit.id)) {
      unit.nextAttackTick = state.tick + stats[unit.kind].attackIntervalTicks;
    }
  }

  applyDamage(battle.defender, attackerDamage.damage, state.tick);
  applyDamage(battle.attacker, defenderDamage.damage, state.tick);

  battle.round += 1;
}

export function battleSystem(
  state: GameState,
  context: { readonly tick: number; readonly balance: Balance },
): void {
  const battles = [...state.battles];
  for (const battle of battles) {
    if (state.tick < battle.nextRoundTick) continue;
    if (!state.battles.includes(battle)) continue;
    resolveRound(state, battle, context.balance);
    battle.nextRoundTick = state.tick + ROUND_TICKS;
    if (alive(battle.attacker).length === 0 || alive(battle.defender).length === 0) {
      finishBattle(state, battle, context.balance);
    }
  }
}

export function planetInBattle(planet: Planet): boolean {
  return planet.battleId !== null;
}

export { ROUND_TICKS };
