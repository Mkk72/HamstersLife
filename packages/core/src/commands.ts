/**
 * Команды игрока. Все проверки здесь: та же функция работает на клиенте,
 * сервере и в повторе. Исход зависит только от состояния и контента.
 */
import type {
  Balance,
  Command,
  CommandResult,
  GameState,
  Planet,
  Plan,
  Route,
  UnitKind,
} from './types';
import { UNIT_KINDS } from './types';
import { clonePlan, countsOf, emptyPlan, planFrom, planSum, splitArmy, takeUnits } from './army';
import { capacityOf, planFromPercents } from './production';
import { launchFleet } from './fleets';

const ALLOWED_RATIOS: readonly number[] = [25, 50, 75, 100];

export function applyCommand(state: GameState, command: Command, balance: Balance): CommandResult {
  switch (command.type) {
    case 'SendFleet':
      return sendFleet(state, command, balance);
    case 'SetPlan':
      return setPlan(state, command, balance);
    case 'ResetPlan':
      return resetPlan(state, command);
    case 'ApplyTemplate':
      return applyTemplate(state, command, balance);
    case 'EnableSupply':
      return enableSupply(state, command);
    case 'RemoveRoute':
      return removeRoute(state, command);
  }
}

function validatePlayer(state: GameState, playerId: number): CommandResult | null {
  const player = state.players[playerId];
  if (!player || !player.alive) return { ok: false, error: 'player-dead' };
  return null;
}

function findRoute(state: GameState, from: number, to: number): Route | undefined {
  return state.routes.find(
    (route) => route.fromPlanetId === from && route.toPlanetId === to,
  );
}

function sendFleet(
  state: GameState,
  command: Extract<Command, { type: 'SendFleet' }>,
  balance: Balance,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  if (!ALLOWED_RATIOS.includes(command.ratio)) return { ok: false, error: 'invalid-ratio' };
  if (command.kind !== undefined && !UNIT_KINDS.includes(command.kind)) {
    return { ok: false, error: 'unknown-kind' };
  }

  const target = state.planets[command.toPlanetId];
  if (!target) return { ok: false, error: 'unknown-planet' };

  const sources: Planet[] = [];
  const seen = new Set<number>();
  for (const planetId of command.fromPlanetIds) {
    const planet = state.planets[planetId];
    if (!planet) return { ok: false, error: 'unknown-planet' };
    if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };
    if (planet.battleId !== null) return { ok: false, error: 'in-battle' };
    if (seen.has(planetId)) continue;
    seen.add(planetId);
    sources.push(planet);
  }
  if (seen.has(command.toPlanetId)) return { ok: false, error: 'same-planet' };
  if (sources.length === 0) return { ok: false, error: 'no-troops' };

  // Лимит маршрутов — до изменений, чтобы команда была атомарной.
  for (const planet of sources) {
    if (findRoute(state, planet.id, target.id)) continue;
    const used = state.routes.filter((route) => route.fromPlanetId === planet.id).length;
    if (used >= balance.maxRoutesPerPlanet) return { ok: false, error: 'too-many-routes' };
  }

  const fleetIds: number[] = [];
  for (const planet of sources) {
    if (!findRoute(state, planet.id, target.id)) {
      state.routes.push({
        id: state.nextRouteId,
        ownerId: command.playerId,
        fromPlanetId: planet.id,
        toPlanetId: target.id,
        weightPermille: command.ratio * 10,
        supplyEnabled: false,
        supplyKinds: [...UNIT_KINDS],
      });
      state.nextRouteId += 1;
    }

    const split = splitArmy(planet.army, command.ratio, command.kind);
    if (split.taken.length === 0) continue;
    planet.army = split.remaining;
    const fleet = launchFleet(
      state,
      balance,
      command.playerId,
      planet,
      target.id,
      split.taken,
    );
    if (fleet) fleetIds.push(fleet.id);
  }

  if (fleetIds.length === 0) return { ok: false, error: 'no-troops' };
  return { ok: true, fleetIds };
}

function setPlan(
  state: GameState,
  command: Extract<Command, { type: 'SetPlan' }>,
  balance: Balance,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  const planet = state.planets[command.planetId];
  if (!planet) return { ok: false, error: 'unknown-planet' };
  if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };

  for (const key of Object.keys(command.plan)) {
    if (!UNIT_KINDS.includes(key as UnitKind)) return { ok: false, error: 'unknown-kind' };
  }
  const next = clonePlan(planet.plan);
  for (const kind of UNIT_KINDS) {
    const value = command.plan[kind];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) return { ok: false, error: 'invalid-plan' };
    next[kind] = value;
  }
  if (planSum(next) > capacityOf(planet, balance)) {
    return { ok: false, error: 'invalid-plan' };
  }
  planet.plan = next;
  clampProgress(planet, balance);
  return { ok: true };
}

function resetPlan(
  state: GameState,
  command: Extract<Command, { type: 'ResetPlan' }>,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  const planet = state.planets[command.planetId];
  if (!planet) return { ok: false, error: 'unknown-planet' };
  if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };
  planet.plan = emptyPlan();
  planet.production = emptyPlan();
  return { ok: true };
}

function applyTemplate(
  state: GameState,
  command: Extract<Command, { type: 'ApplyTemplate' }>,
  balance: Balance,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  const planet = state.planets[command.planetId];
  if (!planet) return { ok: false, error: 'unknown-planet' };
  if (planet.ownerId !== command.playerId) return { ok: false, error: 'not-your-planet' };
  const template = balance.templates.find((item) => item.id === command.templateId);
  if (!template) return { ok: false, error: 'unknown-template' };
  planet.plan = planFromPercents(template.percents, capacityOf(planet, balance));
  clampProgress(planet, balance);
  return { ok: true };
}

function enableSupply(
  state: GameState,
  command: Extract<Command, { type: 'EnableSupply' }>,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  const route = state.routes.find((item) => item.id === command.routeId);
  if (!route) return { ok: false, error: 'unknown-route' };
  if (route.ownerId !== command.playerId) return { ok: false, error: 'not-your-route' };
  if (command.kinds) {
    for (const kind of command.kinds) {
      if (!UNIT_KINDS.includes(kind)) return { ok: false, error: 'unknown-kind' };
    }
    route.supplyKinds = [...new Set(command.kinds)];
  }
  route.supplyEnabled = command.enabled;
  return { ok: true };
}

function removeRoute(
  state: GameState,
  command: Extract<Command, { type: 'RemoveRoute' }>,
): CommandResult {
  const dead = validatePlayer(state, command.playerId);
  if (dead) return dead;
  const index = state.routes.findIndex((route) => route.id === command.routeId);
  if (index < 0) return { ok: false, error: 'unknown-route' };
  const route = state.routes[index];
  if (!route || route.ownerId !== command.playerId) {
    return { ok: false, error: 'not-your-route' };
  }
  state.routes.splice(index, 1);
  return { ok: true };
}

function clampProgress(planet: Planet, balance: Balance): void {
  const counts = countsOf(planet.army);
  for (const kind of UNIT_KINDS) {
    const missing = Math.max(0, planet.plan[kind] - counts[kind]);
    const maxProgress = missing * balance.troops[kind].work;
    if (planet.production[kind] > maxProgress) planet.production[kind] = maxProgress;
  }
}

/** Экспорт для тестов: сколько юнитов уйдёт при отправке. */
export function plannedSendCounts(planet: Planet, ratio: number, kind?: UnitKind): Plan {
  const split = splitArmy(planet.army, ratio, kind);
  return countsOf(split.taken);
}

export { takeUnits, planFrom };
