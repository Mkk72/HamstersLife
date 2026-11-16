/**
 * Хэш состояния: FNV-1a по полям в порядке массивов.
 * Входят планы, прогресс производства, армии с HP и таймерами, бои и снабжение.
 * События отображения не входят.
 */
import type { Army, Battle, Fleet, GameState, Planet } from './types';
import { UNIT_KINDS } from './types';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mix(hash: number, value: number): number {
  let next = hash ^ (value | 0);
  next = Math.imul(next, FNV_PRIME);
  next ^= next >>> 13;
  return next >>> 0;
}

function hashArmy(hash: number, army: readonly Army[number][]): number {
  hash = mix(hash, army.length);
  for (const unit of army) {
    hash = mix(hash, unit.id);
    hash = mix(hash, UNIT_KINDS.indexOf(unit.kind));
    hash = mix(hash, unit.hp);
    hash = mix(hash, unit.healAtTick);
    hash = mix(hash, unit.nextAttackTick);
  }
  return hash;
}

function hashPlan(hash: number, plan: Planet['plan']): number {
  for (const kind of UNIT_KINDS) hash = mix(hash, plan[kind]);
  return hash;
}

function hashPlanet(hash: number, planet: Planet): number {
  hash = mix(hash, planet.id);
  hash = mix(hash, planet.ownerId);
  hash = hashPlan(hash, planet.plan);
  hash = hashPlan(hash, planet.production);
  hash = mix(hash, planet.battleId ?? -1);
  hash = hashArmy(hash, planet.army);
  return hash;
}

function hashFleet(hash: number, fleet: Fleet): number {
  hash = mix(hash, fleet.id);
  hash = mix(hash, fleet.ownerId);
  hash = mix(hash, fleet.fromPlanetId);
  hash = mix(hash, fleet.toPlanetId);
  hash = mix(hash, fleet.departTick);
  hash = mix(hash, fleet.arriveTick);
  hash = mix(hash, fleet.startProgressPermille);
  hash = hashArmy(hash, fleet.army);
  return hash;
}

function hashBattle(hash: number, battle: Battle): number {
  hash = mix(hash, battle.id);
  hash = mix(hash, battle.kind === 'planet' ? 0 : 1);
  hash = mix(hash, battle.planetId ?? -1);
  hash = mix(hash, battle.attackerOwnerId);
  hash = mix(hash, battle.defenderOwnerId);
  hash = mix(hash, battle.round);
  hash = mix(hash, battle.nextRoundTick);
  hash = hashArmy(hash, battle.attacker);
  hash = hashArmy(hash, battle.defender);
  for (const route of [battle.attackerRoute, battle.defenderRoute]) {
    if (!route) {
      hash = mix(hash, -1);
      continue;
    }
    hash = mix(hash, route.fromPlanetId);
    hash = mix(hash, route.toPlanetId);
    hash = mix(hash, route.progressPermille);
  }
  return hash;
}

export function hashState(state: GameState): number {
  let hash = FNV_OFFSET;
  hash = mix(hash, state.rulesVersion);
  hash = mix(hash, state.seed);
  hash = mix(hash, state.tick);
  hash = mix(hash, state.nextUnitId);
  hash = mix(hash, state.nextFleetId);
  hash = mix(hash, state.nextRouteId);
  hash = mix(hash, state.nextBattleId);
  hash = mix(hash, state.planets.length);
  hash = mix(hash, state.fleets.length);
  hash = mix(hash, state.routes.length);
  hash = mix(hash, state.battles.length);
  hash = mix(hash, state.players.length);

  for (const planet of state.planets) hash = hashPlanet(hash, planet);
  for (const fleet of state.fleets) hash = hashFleet(hash, fleet);

  for (const route of state.routes) {
    hash = mix(hash, route.id);
    hash = mix(hash, route.ownerId);
    hash = mix(hash, route.fromPlanetId);
    hash = mix(hash, route.toPlanetId);
    hash = mix(hash, route.weightPermille);
    hash = mix(hash, route.supplyEnabled ? 1 : 0);
    for (const kind of UNIT_KINDS) {
      hash = mix(hash, route.supplyKinds.includes(kind) ? 1 : 0);
    }
  }

  for (const battle of state.battles) hash = hashBattle(hash, battle);

  for (const player of state.players) {
    hash = mix(hash, player.id);
    hash = mix(hash, player.alive ? 1 : 0);
  }

  return hash >>> 0;
}

export function hashToHex(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}
