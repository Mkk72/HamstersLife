/**
 * Создание партии из описания карты.
 *
 * id планет плотные от 0 до n−1; массивы обходятся в этом порядке — важно для
 * хэша и детерминизма. Армия собирается из целых юнитов с постоянными id.
 */
import type {
  Army,
  Balance,
  GameState,
  MapDefinition,
  MapPlanet,
  Planet,
  PlayerState,
  UnitKind,
  UnitStats,
} from './types';
import { NEUTRAL_OWNER, UNIT_KINDS } from './types';
import { addUnits, clonePlan, emptyPlan, planFrom, planSum } from './army';

export class MapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapValidationError';
  }
}

function capacityFor(size: Planet['size'], balance: Balance): number {
  return balance.planetSizes[size].capacity;
}

function validateMap(map: MapDefinition, balance: Balance): void {
  if (map.playerCount < 2) throw new MapValidationError('нужно хотя бы два игрока');
  if (map.planets.length === 0) throw new MapValidationError('на карте нет планет');

  const seen = new Set<number>();
  for (const planet of map.planets) {
    if (seen.has(planet.id)) throw new MapValidationError(`повторяющийся id планеты: ${planet.id}`);
    seen.add(planet.id);
    if (planet.ownerId !== NEUTRAL_OWNER) {
      if (planet.ownerId < 0 || planet.ownerId >= map.playerCount) {
        throw new MapValidationError(`планета ${planet.id}: владелец ${planet.ownerId} вне диапазона`);
      }
    }
    const capacity = capacityFor(planet.size, balance);
    const plan = planet.plan ?? planet.garrison;
    if (planSum(plan) > capacity) {
      throw new MapValidationError(`планета ${planet.id}: план больше вместимости`);
    }
    for (const kind of UNIT_KINDS) {
      if (!Number.isInteger(planet.garrison[kind] ?? 0) || (planet.garrison[kind] ?? 0) < 0) {
        throw new MapValidationError(`планета ${planet.id}: гарнизон должен быть целым`);
      }
      if ((plan[kind] ?? 0) < 0) {
        throw new MapValidationError(`планета ${planet.id}: план не может быть отрицательным`);
      }
    }
    if (planet.ownerId === NEUTRAL_OWNER && planet.garrison.cavalry + planet.garrison.cannon > 0) {
      throw new MapValidationError(`нейтральная планета ${planet.id} может иметь только мечников`);
    }
  }

  for (let index = 0; index < map.planets.length; index += 1) {
    if (!seen.has(index)) throw new MapValidationError(`id планет должны идти подряд с 0, нет ${index}`);
  }

  for (let playerId = 0; playerId < map.playerCount; playerId += 1) {
    if (!map.planets.some((planet) => planet.ownerId === playerId)) {
      throw new MapValidationError(`у игрока ${playerId} нет стартовой планеты`);
    }
  }
}

export function createGameState(map: MapDefinition, balance: Balance, seed: number): GameState {
  validateMap(map, balance);

  let nextUnitId = 1;
  const nextId = (): number => {
    const id = nextUnitId;
    nextUnitId += 1;
    return id;
  };

  const planets: Planet[] = map.planets
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((planet: MapPlanet) => {
      const army: Army = [];
      addUnits(army, planFrom(planet.garrison), nextId, balance.troops);
      return {
        id: planet.id,
        size: planet.size,
        x: planet.x,
        y: planet.y,
        ownerId: planet.ownerId,
        army,
        plan:
          planet.ownerId === NEUTRAL_OWNER
            ? emptyPlan()
            : clonePlan(planet.plan ?? planet.garrison),
        production: emptyPlan(),
        battleId: null,
      };
    });

  const players: PlayerState[] = Array.from({ length: map.playerCount }, (_, id) => ({
    id,
    alive: true,
  }));

  return {
    tick: 0,
    seed,
    rulesVersion: balance.rulesVersion,
    planets,
    fleets: [],
    routes: [],
    battles: [],
    players,
    events: [],
    nextUnitId,
    nextFleetId: 1,
    nextRouteId: 1,
    nextBattleId: 1,
  };
}

export function getPlanet(state: GameState, planetId: number): Planet | undefined {
  return state.planets[planetId];
}

export function getPlayer(state: GameState, playerId: number): PlayerState | undefined {
  return state.players[playerId];
}

/** Жив ли игрок: планеты, флоты или незавершённые бои. */
export function hasForces(state: GameState, playerId: number): boolean {
  return (
    state.planets.some((planet) => planet.ownerId === playerId) ||
    state.fleets.some((fleet) => fleet.ownerId === playerId) ||
    state.battles.some(
      (battle) => battle.attackerOwnerId === playerId || battle.defenderOwnerId === playerId,
    )
  );
}

/** Численность гарнизона планеты. */
export function garrisonOf(planet: Planet): number {
  return planet.army.length;
}

export function garrisonOfPlanet(state: GameState, planetId: number): number | undefined {
  const planet = state.planets[planetId];
  return planet ? planet.army.length : undefined;
}

export function totalArmy(army: readonly { kind: UnitKind }[]): Record<UnitKind, number> {
  const counts = emptyPlan();
  for (const unit of army) counts[unit.kind] += 1;
  return counts;
}

/** Тестовая/диагностическая замена гарнизона: базовые юниты одного рода. */
export function setGarrison(planet: Planet, total: number, stats: Record<UnitKind, UnitStats>): void {
  planet.army = [];
  const army: Army = [];
  addUnits(army, { ...emptyPlan(), swordsman: total }, () => planet.id * 100_000 + army.length + 1, stats);
  planet.army = army;
}
