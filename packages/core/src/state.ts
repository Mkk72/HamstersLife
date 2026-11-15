/**
 * Создание партии из описания карты.
 *
 * Правило: id планет — плотные от 0 до n−1, массив планет индексируется по id.
 * Это даёт прямой доступ без Map и одинаковый порядок обхода (важно для хэша).
 */
import type { Balance, GameState, MapDefinition, Planet, PlayerState } from './types';
import { createBoosts } from './boosts';
import { NEUTRAL_OWNER } from './types';
import { HAMSTER, PERMILLE } from './units';

export class MapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapValidationError';
  }
}

function validateMap(map: MapDefinition): void {
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
    if (!Number.isInteger(planet.garrisonHamsters) || planet.garrisonHamsters < 0) {
      throw new MapValidationError(`планета ${planet.id}: гарнизон должен быть целым и неотрицательным`);
    }
    if (planet.defensePermille !== undefined && planet.defensePermille < PERMILLE) {
      throw new MapValidationError(`планета ${planet.id}: защита не может быть ниже 1.0`);
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
  validateMap(map);

  const planets: Planet[] = map.planets
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((planet) => ({
      id: planet.id,
      size: planet.size,
      x: planet.x,
      y: planet.y,
      defensePermille: planet.defensePermille ?? PERMILLE,
      ownerId: planet.ownerId,
      garrison: planet.garrisonHamsters * HAMSTER,
      boosts: createBoosts(),
    }));

  const players: PlayerState[] = Array.from({ length: map.playerCount }, (_, id) => ({
    id,
    seeds: balance.startingSeeds,
    alive: true,
    boostCooldownUntilTick: { production: 0, speed: 0, defense: 0 },
  }));

  return {
    tick: 0,
    seed,
    rulesVersion: balance.rulesVersion,
    planets,
    fleets: [],
    routes: [],
    players,
    nextFleetId: 1,
    nextRouteId: 1,
  };
}

/** Планета по id; undefined, если такого id нет. */
export function getPlanet(state: GameState, planetId: number): Planet | undefined {
  return state.planets[planetId];
}

/** Игрок по id; undefined, если id вне диапазона. */
export function getPlayer(state: GameState, playerId: number): PlayerState | undefined {
  return state.players[playerId];
}

/** Жив ли игрок (есть планеты или флоты). */
export function hasForces(state: GameState, playerId: number): boolean {
  return (
    state.planets.some((planet) => planet.ownerId === playerId) ||
    state.fleets.some((fleet) => fleet.ownerId === playerId)
  );
}
