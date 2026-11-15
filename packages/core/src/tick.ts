/**
 * Один тик симуляции — 50 мс игрового времени.
 *
 * Порядок внутри тика зафиксирован и не меняется без повышения rulesVersion:
 *   1. производство войск;
 *   2. приток семечек;
 *   3. продвижение флотов и сбор прибывших;
 *   4. разрешение прибытий (сортировка по id флота);
 *   5. выбывание игроков без планет и флотов.
 *
 * Одновременные прибытия разрешаются в порядке id флота: он растёт монотонно и
 * не зависит от скорости машины. Это и есть документированный tie-break.
 */
import { resolveBattle, resolveCapture } from './combat';
import { defensePermille, productionPerTick, seedsPerTick } from './modifiers';
import { hasForces } from './state';
import type { Balance, Fleet, GameState, PlanetId, PlayerId } from './types';
import { NEUTRAL_OWNER } from './types';

export function step(state: GameState, balance: Balance): void {
  state.tick += 1;
  const tick = state.tick;

  applyProduction(state, tick, balance);
  applySeeds(state, balance);

  const arrivals = advanceFleets(state, tick);
  resolveArrivals(state, arrivals, balance, tick);

  updateElimination(state);
}

export function runTicks(state: GameState, balance: Balance, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) step(state, balance);
}

function applyProduction(state: GameState, tick: number, balance: Balance): void {
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const capacity = balance.planetSizes[planet.size].capacity;
    if (planet.garrison >= capacity) continue;
    const grown = planet.garrison + productionPerTick(planet, tick, balance);
    planet.garrison = Math.min(capacity, grown);
  }
}

function applySeeds(state: GameState, balance: Balance): void {
  const perPlanet = seedsPerTick(balance);
  if (perPlanet === 0) return;
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const player = state.players[planet.ownerId];
    if (!player || !player.alive) continue;
    player.seeds += perPlanet;
  }
}

/** Снимает прибывшие флоты с карты и группирует их по цели. */
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
  balance: Balance,
  tick: number,
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
      // Подкрепление своей планеты: гарнизон складывается.
      planet.garrison += incumbent.troops;
      continue;
    }

    const outcome = resolveCapture({
      garrison: planet.garrison,
      defensePermille: defensePermille(planet, tick, balance),
      attackers: incumbent.troops,
      minCaptureGarrison: balance.minCaptureGarrison,
    });

    if (outcome.captured) {
      planet.ownerId = incumbent.ownerId;
      planet.garrison = outcome.garrison;
      // Бусты прежнего владельца сгорают вместе с планетой.
      planet.productionBoostUntilTick = 0;
      planet.speedBoostUntilTick = 0;
      planet.defenseBoostUntilTick = 0;
    } else {
      planet.garrison = outcome.garrison;
    }
  }
}

function updateElimination(state: GameState): void {
  for (const player of state.players) {
    if (player.alive && !hasForces(state, player.id)) player.alive = false;
  }
}

export interface Outcome {
  readonly finished: boolean;
  readonly winnerId: PlayerId | null;
}

/** Итог партии: последний игрок с планетами или флотами. */
export function evaluateOutcome(state: GameState): Outcome {
  const alive = state.players.filter((player) => player.alive && hasForces(state, player.id));
  const only = alive[0];
  if (alive.length === 1 && only) return { finished: true, winnerId: only.id };
  if (alive.length === 0) return { finished: true, winnerId: null };
  return { finished: false, winnerId: null };
}
