/**
 * Системы тика. Каждая — маленькая функция «состояние + контекст → изменение
 * состояния». Состав и порядок задаёт `TICK_SYSTEMS`: добавить правило — значит
 * написать систему, вставить её в список и покрыть тестом. Порядок входит в
 * контракт детерминизма, поэтому меняется только с повышением `rulesVersion`.
 */
import { resolveBattle, resolveCapture } from './combat';
import { clearBoosts } from './boosts';
import { defensePermille, productionPerTick, seedsPerTick } from './modifiers';
import { hasForces } from './state';
import type { Balance, Fleet, GameState, PlanetId, PlayerId } from './types';
import { NEUTRAL_OWNER } from './types';

export interface TickContext {
  readonly tick: number;
  readonly balance: Balance;
}

export type TickSystem = (state: GameState, context: TickContext) => void;

/** 1. Свои планеты растут, пока не упрутся во вместимость. */
export const productionSystem: TickSystem = (state, context) => {
  for (const planet of state.planets) {
    if (planet.ownerId === NEUTRAL_OWNER) continue;
    const capacity = context.balance.planetSizes[planet.size].capacity;
    if (planet.garrison >= capacity) continue;
    const grown = planet.garrison + productionPerTick(planet, context.tick, context.balance);
    planet.garrison = Math.min(capacity, grown);
  }
};

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
    } else {
      planet.garrison = outcome.garrison;
    }
  }
}
