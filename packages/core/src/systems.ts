/**
 * Системы тика. Каждая — маленькая функция «состояние + контекст → изменение
 * состояния». Состав и порядок задаёт `TICK_SYSTEMS`: добавить правило — значит
 * написать систему, вставить её в список и покрыть тестом. Порядок входит в
 * контракт детерминизма, поэтому меняется только с повышением `rulesVersion`.
 */
import { resolveBattle, resolveCapture } from './combat';
import { MIN_FLEET_SIZE } from './combat';
import { clearBoosts } from './boosts';
import { launchFleet } from './fleets';
import { defensePermille, productionPerTick, seedsPerTick } from './modifiers';
import { hasForces } from './state';
import type { Balance, Fleet, GameState, PlanetId, PlayerId, Route } from './types';
import { NEUTRAL_OWNER } from './types';
import { PERMILLE, mulPermille } from './units';

export interface TickContext {
  readonly tick: number;
  readonly balance: Balance;
}

export type TickSystem = (state: GameState, context: TickContext) => void;

/**
 * 1. Рост планет и постоянные маршруты.
 *
 * Если у планеты есть живые маршруты, часть производства уходит в них:
 *  - ниже вместимости экспортируется доля `min(100%, Σвесов)`;
 *  - на вместимости экспортируется всё производство.
 * Между маршрутами экспорт делится пропорционально весам (три по 50% → по 1/3).
 * Накопленные milli-единицы превращаются в отряд, когда набирается 1 хомяк.
 */
export const productionSystem: TickSystem = (state, context) => {
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const capacity = context.balance.planetSizes[planet.size].capacity;
    const produced = productionPerTick(planet, context.tick, context.balance);
    const routes = state.routes.filter(
      (route) => route.fromPlanetId === planet.id && route.ownerId === planet.ownerId,
    );

    if (routes.length === 0) {
      planet.garrison = Math.min(capacity, planet.garrison + produced);
      continue;
    }

    const sumWeights = routes.reduce((sum, route) => sum + route.weightPermille, 0);
    let exported: number;
    if (planet.garrison >= capacity) {
      exported = produced;
      planet.garrison = capacity;
    } else {
      exported = mulPermille(produced, Math.min(PERMILLE, sumWeights));
      planet.garrison = Math.min(capacity, planet.garrison + produced - exported);
    }
    distributeExported(routes, exported, sumWeights);
  }

  flushRoutes(state, context);
};

/** Раздать экспорт по маршрутам без потери milli-единиц (крупнейшие остатки). */
function distributeExported(
  routes: readonly Route[],
  exported: number,
  sumWeights: number,
): void {
  if (exported <= 0 || sumWeights <= 0) return;

  const parts = routes.map((route) => {
    const exact = exported * route.weightPermille;
    return { route, share: Math.floor(exact / sumWeights), remainder: exact % sumWeights };
  });

  const assigned = parts.reduce((sum, part) => sum + part.share, 0);
  let left = exported - assigned;
  parts.sort((a, b) => b.remainder - a.remainder || a.route.id - b.route.id);

  let index = 0;
  while (left > 0 && parts.length > 0) {
    const part = parts[index % parts.length];
    if (!part) break;
    part.share += 1;
    left -= 1;
    index += 1;
  }

  for (const part of parts) part.route.pending += part.share;
}

/** Маршруты, накопившие хотя бы одного хомяка, выпускают отряд. */
function flushRoutes(state: GameState, context: TickContext): void {
  for (const route of state.routes) {
    if (route.pending < MIN_FLEET_SIZE) continue;
    const from = state.planets[route.fromPlanetId];
    if (!from || from.ownerId !== route.ownerId) {
      route.pending = 0;
      continue;
    }
    const troops = route.pending;
    route.pending = 0;
    launchFleet(state, context.balance, route.ownerId, from, route.toPlanetId, troops);
  }
}

/** 2. Семечки капают с каждой своей планеты живому игроку. */
export const seedsSystem: TickSystem = (state, context) => {
  const perPlanet = seedsPerTick(context.balance);
  if (perPlanet === 0) return;
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const player = state.players[planet.ownerId];
    if (!player || !player.alive) continue;
    player.seeds += perPlanet;
  }
};

/** 3. Флоты летят, прибывшие снимаются с карты и разрешаются. */
export const fleetsSystem: TickSystem = (state, context) => {
  const arrivals = advanceFleets(state, context.tick);
  resolveArrivals(state, arrivals, context);
};

/** 4. Игрок без планет и флотов выбывает. */
export const eliminationSystem: TickSystem = (state) => {
  for (const player of state.players) {
    if (player.alive && !hasForces(state, player.id)) player.alive = false;
  }
};

/** Канонический порядок: он же записан в IDEA.md §3.4.1 и ARCHITECTURE.md §10. */
export const TICK_SYSTEMS: readonly TickSystem[] = [
  productionSystem,
  seedsSystem,
  fleetsSystem,
  eliminationSystem,
];

function advanceFleets(state: GameState, tick: number): Map<PlanetId, Fleet[]> {
  const stillFlying: Fleet[] = [];
  const arrivals = new Map<PlanetId, Fleet[]>();

  for (const fleet of state.fleets) {
    if (fleet.arriveTick > tick) {
      stillFlying.push(fleet);
      continue;
    }
    const group = arrivals.get(fleet.toPlanetId);
    if (group) group.push(fleet);
    else arrivals.set(fleet.toPlanetId, [fleet]);
  }

  state.fleets.length = 0;
  state.fleets.push(...stillFlying);
  return arrivals;
}

function resolveArrivals(
  state: GameState,
  arrivals: Map<PlanetId, Fleet[]>,
  context: TickContext,
): void {
  const targetIds = [...arrivals.keys()].sort((a, b) => a - b);

  for (const planetId of targetIds) {
    const planet = state.planets[planetId];
    if (!planet) continue;

    const fleets = [...(arrivals.get(planetId) ?? [])].sort((a, b) => a.id - b.id);
    let incumbent: { ownerId: PlayerId; troops: number } | null = null;

    for (const fleet of fleets) {
      if (incumbent === null) {
        incumbent = { ownerId: fleet.ownerId, troops: fleet.troops };
        continue;
      }
      if (incumbent.ownerId === fleet.ownerId) {
        incumbent.troops += fleet.troops;
        continue;
      }
      const battle = resolveBattle(incumbent.troops, fleet.troops);
      if (battle.winner === 'none') {
        incumbent = null;
      } else {
        incumbent = {
          ownerId: battle.winner === 'attacker' ? incumbent.ownerId : fleet.ownerId,
          troops: battle.remaining,
        };
      }
    }

    if (!incumbent || incumbent.troops <= 0) continue;

    if (planet.ownerId === incumbent.ownerId) {
      planet.garrison += incumbent.troops;
      continue;
    }

    const outcome = resolveCapture({
      garrison: planet.garrison,
      defensePermille: defensePermille(planet, context.tick, context.balance),
      attackers: incumbent.troops,
      minCaptureGarrison: context.balance.minCaptureGarrison,
    });

    if (outcome.captured) {
      planet.ownerId = incumbent.ownerId;
      planet.garrison = outcome.garrison;
      clearBoosts(planet);
      // Маршруты прежнего владельца сгорают вместе с планетой.
      removeRoutesForPlanet(state, planet.id);
    } else {
      planet.garrison = outcome.garrison;
    }
  }
}

function removeRoutesForPlanet(state: GameState, planetId: PlanetId): void {
  for (let index = state.routes.length - 1; index >= 0; index -= 1) {
    const route = state.routes[index];
    if (!route) continue;
    if (route.fromPlanetId === planetId || route.toPlanetId === planetId) {
      state.routes.splice(index, 1);
    }
  }
}
