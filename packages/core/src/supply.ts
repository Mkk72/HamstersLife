/**
 * Постоянное снабжение по стрелкам. Включается отдельно на маршруте.
 *
 * Резерв — половина задания каждого рода (вверх). Всё сверх резерва доступно
 * автоматической отправке раз в `supply.intervalTicks`. Деление между
 * маршрутами — по весам, целыми юнитами, с сохранением количества.
 */
import type { Balance, GameState, Plan, Planet, Route, UnitKind } from './types';
import { UNIT_KINDS } from './types';
import { countsOf, emptyPlan, takeUnits } from './army';
import { launchFleet } from './fleets';
import type { TickContext } from './production';

function reserveFor(planet: Planet, balance: Balance): Plan {
  const reserve = emptyPlan();
  for (const kind of UNIT_KINDS) {
    reserve[kind] = Math.ceil((planet.plan[kind] * balance.supply.reservePermille) / 1000);
  }
  return reserve;
}

/** Раздать целое количество между маршрутами по весам (крупнейшие остатки). */
function distribute(
  routes: readonly Route[],
  total: number,
  kind: UnitKind,
): Map<number, number> {
  const result = new Map<number, number>();
  if (total <= 0 || routes.length === 0) return result;
  const sumWeights = routes.reduce((sum, route) => sum + Math.max(1, route.weightPermille), 0);
  const shares = routes.map((route) => {
    const weight = Math.max(1, route.weightPermille);
    const exact = total * weight;
    return {
      route,
      share: Math.floor(exact / sumWeights),
      remainder: exact % sumWeights,
    };
  });
  let assigned = shares.reduce((sum, share) => sum + share.share, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.route.id - b.route.id);
  let cursor = 0;
  while (assigned < total && shares.length > 0) {
    const share = shares[cursor % shares.length];
    if (!share) break;
    share.share += 1;
    assigned += 1;
    cursor += 1;
  }
  for (const share of shares) if (share.share > 0) result.set(share.route.id, share.share);
  void kind;
  return result;
}

export function supplySystem(state: GameState, context: TickContext): void {
  const { balance } = context;
  if (state.tick % balance.supply.intervalTicks !== 0) return;

  for (const planet of state.planets) {
    if (planet.ownerId < 0 || planet.battleId !== null) continue;
    const routes = state.routes.filter(
      (route) =>
        route.fromPlanetId === planet.id &&
        route.ownerId === planet.ownerId &&
        route.supplyEnabled &&
        route.supplyKinds.length > 0,
    );
    if (routes.length === 0) continue;

    const counts = countsOf(planet.army);
    const reserve = reserveFor(planet, balance);
    const available = emptyPlan();
    let totalAvailable = 0;
    for (const kind of UNIT_KINDS) {
      available[kind] = Math.max(0, counts[kind] - reserve[kind]);
      totalAvailable += available[kind];
    }
    if (totalAvailable <= 0) continue;

    const allocations = new Map<number, Plan>();
    for (const kind of UNIT_KINDS) {
      if (available[kind] <= 0) continue;
      const allowed = routes.filter((route) => route.supplyKinds.includes(kind));
      if (allowed.length === 0) continue;
      const shares = distribute(allowed, available[kind], kind);
      for (const [routeId, count] of shares) {
        const plan = allocations.get(routeId) ?? emptyPlan();
        plan[kind] += count;
        allocations.set(routeId, plan);
      }
    }

    for (const route of routes) {
      const plan = allocations.get(route.id);
      if (!plan) continue;
      const total = UNIT_KINDS.reduce((sum, kind) => sum + plan[kind], 0);
      if (total <= 0) continue;
      const army = takeUnits(planet.army, plan);
      if (army.length === 0) continue;
      launchFleet(state, balance, planet.ownerId, planet, route.toPlanetId, army);
    }
  }
}
