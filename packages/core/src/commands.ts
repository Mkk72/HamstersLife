/**
 * Команды игрока. Все проверки — здесь, потому что та же функция вызывается
 * сервером: клиент присылает намерение, сервер применяет или отказывает.
 * Исход зависит только от состояния и контента — никаких Date, Math.random.
 *
 * `SendFleet` теперь создаёт постоянный маршрут: сразу уходит выбранная доля
 * гарнизона, а дальше по стрелке течёт производство (см. systems.ts).
 * Повторная стрелка на ту же цель меняет вес, не списывая войска заново.
 */
import { MIN_FLEET_SIZE } from './combat';
import { setBoost } from './boosts';
import { launchFleet } from './fleets';
import { getPlanet, getPlayer } from './state';
import type { Balance, Command, CommandResult, GameState, Planet, Route } from './types';
import { BOOST_KINDS } from './types';

const ALLOWED_RATIOS: readonly number[] = [25, 50, 75, 100];

export function applyCommand(state: GameState, command: Command, balance: Balance): CommandResult {
  switch (command.type) {
    case 'SendFleet':
      return sendFleet(state, command, balance);
    case 'ApplyBoost':
      return applyBoost(state, command, balance);
    case 'RemoveRoute':
      return removeRoute(state, command);
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

  // Лимит маршрутов проверяем до изменений, чтобы команда была атомарной.
  for (const planet of sources) {
    if (findRoute(state, planet.id, target.id)) continue;
    const used = state.routes.filter((route) => route.fromPlanetId === planet.id).length;
    if (used >= balance.maxRoutesPerPlanet) return { ok: false, error: 'too-many-routes' };
  }

  const fleetIds: number[] = [];

  for (const planet of sources) {
    const existing = findRoute(state, planet.id, target.id);
    if (existing) {
      // Повторная стрелка меняет вес, войска заново не списываются.
      existing.weightPermille = command.ratio * 10;
      continue;
    }

    const route: Route = {
      id: state.nextRouteId,
      ownerId: command.playerId,
      fromPlanetId: planet.id,
      toPlanetId: target.id,
      weightPermille: command.ratio * 10,
      pending: 0,
    };
    state.nextRouteId += 1;
    state.routes.push(route);

    const troops = Math.floor((planet.garrison * command.ratio) / 100);
    if (troops < MIN_FLEET_SIZE) continue;
    planet.garrison -= troops;
    const fleet = launchFleet(state, balance, command.playerId, planet, target.id, troops);
    if (fleet) fleetIds.push(fleet.id);
  }

  return { ok: true, fleetIds };
}

function findRoute(state: GameState, fromPlanetId: number, toPlanetId: number): Route | undefined {
  return state.routes.find(
    (route) => route.fromPlanetId === fromPlanetId && route.toPlanetId === toPlanetId,
  );
}

function removeRoute(
  state: GameState,
  command: Extract<Command, { type: 'RemoveRoute' }>,
): CommandResult {
  const player = getPlayer(state, command.playerId);
  if (!player || !player.alive) return { ok: false, error: 'player-dead' };

  const index = state.routes.findIndex((route) => route.id === command.routeId);
  if (index < 0) return { ok: false, error: 'unknown-route' };
  const route = state.routes[index];
  if (!route || route.ownerId !== command.playerId) {
    return { ok: false, error: 'not-your-route' };
  }
  state.routes.splice(index, 1);
  return { ok: true };
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
  setBoost(planet, command.boost, untilTick);

  return { ok: true };
}
