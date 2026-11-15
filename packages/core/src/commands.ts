/**
 * Команды игрока. Все проверки — здесь, потому что та же функция вызывается
 * сервером: клиент присылает намерение, сервер применяет или отказывает.
 * Исход зависит только от состояния и контента — никаких Date, Math.random.
 */
import { MIN_FLEET_SIZE } from './combat';
import { distance, flightTicks } from './flight';
import { speedUnitsPerSecond } from './modifiers';
import { getPlanet, getPlayer } from './state';
import type { Balance, BoostKind, Command, CommandResult, GameState, Planet } from './types';

const ALLOWED_RATIOS: readonly number[] = [25, 50, 75, 100];

const BOOST_KINDS: readonly BoostKind[] = ['production', 'speed', 'defense'];

export function applyCommand(state: GameState, command: Command, balance: Balance): CommandResult {
  switch (command.type) {
    case 'SendFleet':
      return sendFleet(state, command, balance);
    case 'ApplyBoost':
      return applyBoost(state, command, balance);
  }
}

function sendFleet(
  state: GameState,
  command: Extract<Command, { type: 'SendFleet' }>,
  balance: Balance,
): CommandResult {
  const player = getPlayer(state, command.playerId);
  if (!player || !player.alive) return { ok: false, error: 'player-dead' };
  if (!ALLOWED_RATIOS.includes(command.ratio)) return { ok: false, error: 'invalid-ratio' };

  const target = getPlanet(state, command.toPlanetId);
  if (!target) return { ok: false, error: 'unknown-planet' };

  const sources: Planet[] = [];
  const seen = new Set<number>();
  for (const planetId of command.fromPlanetIds) {
    const planet = getPlanet(state, planetId);
    if (!planet) return { ok: false, error: 'unknown-planet' };
    if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };
    if (seen.has(planetId)) continue;
    seen.add(planetId);
    sources.push(planet);
  }

  if (seen.has(command.toPlanetId)) return { ok: false, error: 'same-planet' };
  if (sources.length === 0) return { ok: false, error: 'no-troops' };

  const now = state.tick;
  const parts: { planet: Planet; troops: number }[] = [];
  for (const planet of sources) {
    const troops = Math.floor((planet.garrison * command.ratio) / 100);
    if (troops < MIN_FLEET_SIZE) continue;
    parts.push({ planet, troops });
  }
  if (parts.length === 0) return { ok: false, error: 'no-troops' };

  const fleetIds: number[] = [];
  for (const part of parts) {
    const speed = speedUnitsPerSecond(part.planet, now, balance);
    const ticks = flightTicks(
      distance(part.planet.x, part.planet.y, target.x, target.y),
      speed,
    );
    part.planet.garrison -= part.troops;
    const fleetId = state.nextFleetId;
    state.nextFleetId += 1;
    state.fleets.push({
      id: fleetId,
      ownerId: command.playerId,
      fromPlanetId: part.planet.id,
      toPlanetId: target.id,
      troops: part.troops,
      departTick: now,
      arriveTick: now + ticks,
    });
    fleetIds.push(fleetId);
  }

  return { ok: true, fleetIds };
}

function applyBoost(
  state: GameState,
  command: Extract<Command, { type: 'ApplyBoost' }>,
  balance: Balance,
): CommandResult {
  const player = getPlayer(state, command.playerId);
  if (!player || !player.alive) return { ok: false, error: 'player-dead' };
  if (!BOOST_KINDS.includes(command.boost)) return { ok: false, error: 'wrong-boost-target' };

  const planet = getPlanet(state, command.planetId);
  if (!planet) return { ok: false, error: 'unknown-planet' };
  if (planet.ownerId !== command.playerId) return { ok: false, error: 'wrong-boost-target' };

  const stats = balance.boosts[command.boost];
  const now = state.tick;
  if (player.boostCooldownUntilTick[command.boost] > now) return { ok: false, error: 'cooldown' };
  if (player.seeds < stats.cost) return { ok: false, error: 'not-enough-seeds' };

  player.seeds -= stats.cost;
  player.boostCooldownUntilTick[command.boost] = now + stats.cooldownTicks;

  const untilTick = now + stats.durationTicks;
  switch (command.boost) {
    case 'production':
      planet.productionBoostUntilTick = untilTick;
      break;
    case 'speed':
      planet.speedBoostUntilTick = untilTick;
      break;
    case 'defense':
      planet.defenseBoostUntilTick = untilTick;
      break;
  }

  return { ok: true };
}
