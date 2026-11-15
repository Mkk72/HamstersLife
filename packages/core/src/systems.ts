/**
 * Системы тика. Каждая — маленькая функция «состояние + контекст → изменение
 * состояния». Состав и порядок задаёт `TICK_SYSTEMS`: добавить правило — значит
 * написать систему, вставить её в список и покрыть тестом. Порядок входит в
 * контракт детерминизма, поэтому меняется только с повышением `rulesVersion`.
 */
import { resolveBattle, resolveCapture } from './combat';
import { clearBoosts } from './boosts';
import { launchFleet } from './fleets';
import { defensePermille, productionPerTick, seedsPerTick } from './modifiers';
import { garrisonOf, hasForces } from './state';
import { createTroopStack, mergeTroops, resizeTroops, subtractTroops, troopTotal } from './troops';
import type { Balance, Fleet, GameState, PlanetId, PlayerId, Route, TroopStack } from './types';
import { NEUTRAL_OWNER } from './types';
import { PERMILLE, mulPermille, HAMSTER } from './units';

export interface TickContext {
  readonly tick: number;
  readonly balance: Balance;
}

export type TickSystem = (state: GameState, context: TickContext) => void;

/** Базовые бойцы, которые даёт производство планеты. */
function baseTroops(amount: number): TroopStack {
  return createTroopStack({ swordsman: amount });
}

function addBaseTroops(planet: { troops: TroopStack }, amount: number): void {
  if (amount <= 0) return;
  planet.troops.swordsman += amount;
}

/**
 * 0. Обучение в казармах: первый заказ очереди тренирует одного хомяка за
 * `trainTicks` тиков. Если гарнизон заполнил предел, обучение ждёт: сначала
 * освободите место (излишек сам уходит по маршрутам).
 */
export const trainingSystem: TickSystem = (state, context) => {
  for (const planet of state.planets) {
    const order = planet.training[0];
    if (!order) continue;
    const capacity = context.balance.planetSizes[planet.size].capacity;
    if (garrisonOf(planet) >= capacity) continue;

    const stats = context.balance.troops[order.kind];
    if (!stats) {
      planet.training.shift();
      continue;
    }

    order.progressTicks += 1;
    if (order.progressTicks < stats.trainTicks) continue;

    order.progressTicks = 0;
    const batch = Math.min(HAMSTER, order.remaining);
    planet.troops[order.kind] += batch;
    order.remaining -= batch;
    if (order.remaining <= 0) planet.training.shift();
  }
};

/**
 * 1. Рост планет и постоянные маршруты.
 *
 * Производство даёт базовых бойцов. Если у планеты есть живые маршруты:
 *  - ниже вместимости экспортируется доля `min(100%, Σвесов)` производства;
 *  - ровно на вместимости — всё производство;
 *  - выше вместимости — излишек сбрасывается по стрелкам сверх генерации.
 * Состав при этом сохраняется: поток производства — базовые бойцы, излишек
 * уходит пропорционально текущему составу гарнизона.
 */
export const productionSystem: TickSystem = (state, context) => {
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const capacity = context.balance.planetSizes[planet.size].capacity;
    const produced = productionPerTick(planet, context.tick, context.balance);
    const routes = state.routes.filter(
      (route) => route.fromPlanetId === planet.id && route.ownerId === planet.ownerId,
    );
    const total = garrisonOf(planet);

    if (routes.length === 0) {
      addBaseTroops(planet, Math.min(produced, Math.max(0, capacity - total)));
      continue;
    }

    const sumWeights = routes.reduce((sum, route) => sum + route.weightPermille, 0);
    const exported = buildExport(planet, total, capacity, produced, sumWeights);
    if (exported.amount <= 0) continue;
    distributeStack(routes, exported.troops, exported.amount, sumWeights);
  }

  flushRoutes(state, context);
};

interface ExportResult {
  readonly amount: number;
  readonly troops: TroopStack;
}

function buildExport(
  planet: { troops: TroopStack },
  total: number,
  capacity: number,
  produced: number,
  sumWeights: number,
): ExportResult {
  if (total > capacity) {
    const overflow = total - capacity;
    const overflowTroops = resizeTroops(planet.troops, overflow);
    planet.troops = resizeTroops(planet.troops, capacity);
    return {
      amount: overflow + produced,
      troops: mergeTroops(overflowTroops, baseTroops(produced)),
    };
  }

  if (total === capacity) {
    return { amount: produced, troops: baseTroops(produced) };
  }

  const exported = mulPermille(produced, Math.min(PERMILLE, sumWeights));
  const free = capacity - total;
  let retain = produced - exported;
  let extra = 0;
  if (retain > free) {
    extra = retain - free;
    retain = free;
  }
  addBaseTroops(planet, retain);
  return { amount: exported + extra, troops: baseTroops(exported + extra) };
}

/** Раздать состав по маршрутам без потери milli-единиц (крупнейшие остатки). */
function distributeStack(
  routes: readonly Route[],
  stack: TroopStack,
  amount: number,
  sumWeights: number,
): void {
  if (amount <= 0 || sumWeights <= 0) return;

  const shares = routes.map((route) => {
    const exact = amount * route.weightPermille;
    return {
      route,
      index: route.id,
      share: Math.floor(exact / sumWeights),
      remainder: exact % sumWeights,
    };
  });

  const assigned = shares.reduce((sum, part) => sum + part.share, 0);
  let left = amount - assigned;
  shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let cursor = 0;
  while (left > 0 && shares.length > 0) {
    const part = shares[cursor % shares.length];
    if (!part) break;
    part.share += 1;
    left -= 1;
    cursor += 1;
  }

  let remaining = stack;
  for (const part of shares) {
    if (part.share <= 0) continue;
    const piece = resizeTroops(remaining, Math.min(troopTotal(remaining), part.share));
    remaining = subtractTroops(remaining, piece);
    part.route.pending = mergeTroops(part.route.pending, piece);
  }
}

/** Маршруты, накопившие минимальный отряд, выпускают его. */
function flushRoutes(state: GameState, context: TickContext): void {
  const threshold = context.balance.minRouteFleet;
  for (const route of state.routes) {
    if (troopTotal(route.pending) < threshold) continue;
    const from = state.planets[route.fromPlanetId];
    if (!from || from.ownerId !== route.ownerId) {
      route.pending = createTroopStack();
      continue;
    }
    const troops = route.pending;
    route.pending = createTroopStack();
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
  trainingSystem,
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

interface Incumbent {
  readonly ownerId: PlayerId;
  troops: TroopStack;
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
    let incumbent: Incumbent | null = null;

    for (const fleet of fleets) {
      if (incumbent === null) {
        incumbent = { ownerId: fleet.ownerId, troops: fleet.troops };
        continue;
      }
      if (incumbent.ownerId === fleet.ownerId) {
        incumbent.troops = mergeTroops(incumbent.troops, fleet.troops);
        continue;
      }
      const battle = resolveBattle(troopTotal(incumbent.troops), troopTotal(fleet.troops));
      if (battle.winner === 'none') {
        incumbent = null;
      } else if (battle.winner === 'attacker') {
        incumbent = {
          ownerId: incumbent.ownerId,
          troops: resizeTroops(incumbent.troops, battle.remaining),
        };
      } else {
        incumbent = {
          ownerId: fleet.ownerId,
          troops: resizeTroops(fleet.troops, battle.remaining),
        };
      }
    }

    if (!incumbent || troopTotal(incumbent.troops) <= 0) continue;

    if (planet.ownerId === incumbent.ownerId) {
      // Подкрепление: состав складывается, излишек сверх вместимости сохраняется.
      planet.troops = mergeTroops(planet.troops, incumbent.troops);
      continue;
    }

    const outcome = resolveCapture({
      garrison: garrisonOf(planet),
      defensePermille: defensePermille(planet, context.tick, context.balance),
      attackers: troopTotal(incumbent.troops),
      minCaptureGarrison: context.balance.minCaptureGarrison,
    });

    if (outcome.captured) {
      planet.ownerId = incumbent.ownerId;
      planet.troops = resizeTroops(incumbent.troops, outcome.garrison);
      planet.training.length = 0; // заказы прежнего владельца сгорают
      clearBoosts(planet);
      // Маршруты прежнего владельца сгорают вместе с планетой.
      removeRoutesForPlanet(state, planet.id);
    } else {
      planet.troops = resizeTroops(planet.troops, outcome.garrison);
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
