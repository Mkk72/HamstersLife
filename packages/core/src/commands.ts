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
import { garrisonOf, getPlanet, getPlayer } from './state';
import { createTroopStack, resizeTroops, subtractTroops, TROOP_KINDS } from './troops';
import type { Balance, Command, CommandResult, GameState, Planet, Route } from './types';
import { BOOST_KINDS } from './types';
import { HAMSTER } from './units';

const ALLOWED_RATIOS: readonly number[] = [25, 50, 75, 100];

export function applyCommand(state: GameState, command: Command, balance: Balance): CommandResult {
  switch (command.type) {
    case 'SendFleet':
      return sendFleet(state, command, balance);
    case 'ApplyBoost':
      return applyBoost(state, command, balance);
    case 'RemoveRoute':
      return removeRoute(state, command);
    case 'TrainTroops':
      return trainTroops(state, command, balance);
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
      pending: createTroopStack(),
    };
    state.nextRouteId += 1;
    state.routes.push(route);

    const amount = Math.floor((garrisonOf(planet) * command.ratio) / 100);
    if (amount < MIN_FLEET_SIZE) continue;
    const part = resizeTroops(planet.troops, amount);
    planet.troops = subtractTroops(planet.troops, part);
    const fleet = launchFleet(state, balance, command.playerId, planet, target.id, part);
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

/** Поставить заказ на обучение: семечки списываются сразу, время — в очереди. */
function trainTroops(
  state: GameState,
  command: Extract<Command, { type: 'TrainTroops' }>,
  balance: Balance,
): CommandResult {
  const player = getPlayer(state, command.playerId);
  if (!player || !player.alive) return { ok: false, error: 'player-dead' };

  const planet = getPlanet(state, command.planetId);
  if (!planet) return { ok: false, error: 'unknown-planet' };
  if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };
  if (!TROOP_KINDS.includes(command.kind)) return { ok: false, error: 'unknown-troop' };
  if (!Number.isInteger(command.amount) || command.amount < 1) {
    return { ok: false, error: 'invalid-amount' };
  }
  if (planet.training.length >= balance.maxTrainingQueue) {
    return { ok: false, error: 'queue-full' };
  }

  const stats = balance.troops[command.kind];
  const cost = command.amount * stats.costSeeds;
  if (player.seeds < cost) return { ok: false, error: 'not-enough-seeds' };

  player.seeds -= cost;
  planet.training.push({
    kind: command.kind,
    remaining: command.amount * HAMSTER,
    progressTicks: 0,
  });
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
