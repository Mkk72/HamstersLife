/**
 * Хэш состояния: короткий отпечаток всей партии.
 *
 * Им проверяется детерминизм: один seed и одна лента команд должны давать
 * одинаковый хэш на клиенте, на сервере и в тестах. Порядок обхода — порядок
 * массивов состояния, а он задаётся только правилами, не машиной.
 */
import type { GameState } from './types';
import { BOOST_KINDS } from './types';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mix(hash: number, value: number): number {
  let next = hash ^ (value | 0);
  next = Math.imul(next, FNV_PRIME);
  next ^= next >>> 13;
  return next >>> 0;
}

export function hashState(state: GameState): number {
  let hash = FNV_OFFSET;
  hash = mix(hash, state.rulesVersion);
  hash = mix(hash, state.seed);
  hash = mix(hash, state.tick);
  hash = mix(hash, state.nextFleetId);
  hash = mix(hash, state.nextRouteId);
  hash = mix(hash, state.planets.length);
  hash = mix(hash, state.fleets.length);
  hash = mix(hash, state.routes.length);
  hash = mix(hash, state.players.length);

  for (const planet of state.planets) {
    hash = mix(hash, planet.id);
    hash = mix(hash, planet.ownerId);
    hash = mix(hash, planet.garrison);
    hash = mix(hash, planet.defensePermille);
    for (const kind of BOOST_KINDS) hash = mix(hash, planet.boosts[kind] ?? 0);
  }

  for (const fleet of state.fleets) {
    hash = mix(hash, fleet.id);
    hash = mix(hash, fleet.ownerId);
    hash = mix(hash, fleet.fromPlanetId);
    hash = mix(hash, fleet.toPlanetId);
    hash = mix(hash, fleet.troops);
    hash = mix(hash, fleet.departTick);
    hash = mix(hash, fleet.arriveTick);
  }

  for (const route of state.routes) {
    hash = mix(hash, route.id);
    hash = mix(hash, route.ownerId);
    hash = mix(hash, route.fromPlanetId);
    hash = mix(hash, route.toPlanetId);
    hash = mix(hash, route.weightPermille);
    hash = mix(hash, route.pending);
  }

  for (const player of state.players) {
    hash = mix(hash, player.id);
    hash = mix(hash, player.seeds);
    hash = mix(hash, player.alive ? 1 : 0);
    hash = mix(hash, player.boostCooldownUntilTick.production);
    hash = mix(hash, player.boostCooldownUntilTick.speed);
    hash = mix(hash, player.boostCooldownUntilTick.defense);
  }

  return hash >>> 0;
}

/** Хэш в hex — так его удобнее сравнивать в отчётах и логах. */
export function hashToHex(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}
