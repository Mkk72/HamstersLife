/**
 * Системы тика. Порядок входит в контракт детерминизма:
 * производство → восстановление → снабжение → бои → полёты и прибытия → выбывание.
 */
import type { Balance, Fleet, GameState, PlanetId, PlayerId } from './types';
import { NEUTRAL_OWNER } from './types';
import { productionSystem, type TickContext } from './production';
import { supplySystem } from './supply';
import { battleSystem, joinBattle, startFieldBattle, startPlanetBattle } from './battle';
import { mergeArmies } from './army';
import { healUnit } from './army';
import { hasForces } from './state';

export type { TickContext } from './production';
export type TickSystem = (state: GameState, context: TickContext) => void;

/** Восстановление: 10 секунд без боя — и юнит снова целый. */
export const healSystem: TickSystem = (state, context) => {
  for (const planet of state.planets) {
    if (planet.battleId !== null) continue;
    for (const unit of planet.army) {
      if (unit.hp < context.balance.troops[unit.kind].hp && unit.healAtTick > 0 && state.tick >= unit.healAtTick) {
        healUnit(unit, context.balance.troops);
      }
    }
  }
  for (const fleet of state.fleets) {
    for (const unit of fleet.army) {
      if (unit.hp < context.balance.troops[unit.kind].hp && unit.healAtTick > 0 && state.tick >= unit.healAtTick) {
        healUnit(unit, context.balance.troops);
      }
    }
  }
};

function progressAt(fleet: Fleet, tick: number): number {
  const span = Math.max(1, fleet.arriveTick - fleet.departTick);
  const elapsed = Math.min(span, Math.max(0, tick - fleet.departTick));
  const start = fleet.startProgressPermille;
  return Math.min(1000, start + Math.floor(((1000 - start) * elapsed) / span));
}

/** Разность позиций двух встречных флотов на общей стрелке A→B. */
function gap(first: Fleet, second: Fleet, tick: number): number {
  const firstProgress = progressAt(first, tick);
  const secondProgress = progressAt(second, tick);
  return firstProgress - (1000 - secondProgress);
}

function isOpposite(first: Fleet, second: Fleet): boolean {
  return (
    first.ownerId !== second.ownerId &&
    first.fromPlanetId === second.toPlanetId &&
    first.toPlanetId === second.fromPlanetId
  );
}

function resolveArrivals(
  state: GameState,
  arrivals: readonly Fleet[],
  balance: Balance,
): void {
  const sorted = [...arrivals].sort((a, b) => a.id - b.id);
  for (const fleet of sorted) {
    const planet = state.planets[fleet.toPlanetId];
    if (!planet) continue;

    if (planet.battleId !== null) {
      const battle = state.battles.find((item) => item.id === planet.battleId);
      if (battle) joinBattle(state, battle, fleet, balance);
      continue;
    }

    if (planet.ownerId === fleet.ownerId) {
      mergeArmies(planet.army, fleet.army);
      continue;
    }

    startPlanetBattle(state, planet, fleet, balance);
  }
}

/** Флоты: движение, честный перехват на одной стрелке и прибытия. */
export const fleetsSystem: TickSystem = (state, context) => {
  const arrivals: Fleet[] = [];
  for (const fleet of state.fleets) {
    if (fleet.arriveTick <= state.tick) arrivals.push(fleet);
  }
  if (arrivals.length > 0) {
    const arriving = new Set(arrivals.map((fleet) => fleet.id));
    const remaining = state.fleets.filter((fleet) => !arriving.has(fleet.id));
    state.fleets.splice(0, state.fleets.length, ...remaining);
  }

  const flying = [...state.fleets].sort((a, b) => a.id - b.id);
  const removed = new Set<number>();
  for (let left = 0; left < flying.length; left += 1) {
    const first = flying[left];
    if (!first || removed.has(first.id)) continue;
    for (let right = left + 1; right < flying.length; right += 1) {
      const second = flying[right];
      if (!second || removed.has(second.id)) continue;
      if (!isOpposite(first, second)) continue;
      const before = gap(first, second, state.tick - 1);
      const after = gap(first, second, state.tick);
      if (!(before <= 0 && after >= 0)) continue;
      const progress = Math.min(1000, Math.max(0, progressAt(first, state.tick)));
      removed.add(first.id);
      removed.add(second.id);
      startFieldBattle(state, first, second, progress, context.balance);
      break;
    }
  }
  if (removed.size > 0) {
    const remaining = state.fleets.filter((fleet) => !removed.has(fleet.id));
    state.fleets.splice(0, state.fleets.length, ...remaining);
  }

  resolveArrivals(state, arrivals, context.balance);
};

export const eliminationSystem: TickSystem = (state) => {
  for (const player of state.players) {
    if (player.alive && !hasForces(state, player.id)) player.alive = false;
  }
};

export const TICK_SYSTEMS: readonly TickSystem[] = [
  productionSystem,
  healSystem,
  supplySystem,
  battleSystem,
  fleetsSystem,
  eliminationSystem,
];

/** Совместимость с тестами/старым API: планета нейтрала не производит. */
export function isNeutral(ownerId: PlayerId): boolean {
  return ownerId === NEUTRAL_OWNER;
}

export function planetIds(planets: readonly { id: PlanetId }[]): PlanetId[] {
  return planets.map((planet) => planet.id);
}

export type { Balance };
