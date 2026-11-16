/**
 * Генератор симметричных карт: дуэль 1×1 и «все против всех» 1×3.
 * Стартовые планеты M: армия 18/6 и план 36/24. Нейтралы — только мечники.
 */
import { createRng } from '@hamsters/core';
import type { MapDefinition, MapPlanet, Plan, PlanetSize } from '@hamsters/core';

export interface MapGenerator {
  generate(seed: number): MapDefinition;
}

export interface DuelMapOptions {
  readonly width?: number;
  readonly height?: number;
  readonly playerCount?: 2 | 4;
  readonly neutralPairs?: number;
  readonly minDistance?: number;
  readonly startClearance?: number;
}

const DEFAULTS = {
  width: 1200,
  height: 800,
  playerCount: 2 as 2 | 4,
  neutralPairs: 5,
  minDistance: 120,
  startClearance: 220,
} satisfies Required<DuelMapOptions>;

function plan(partial: Partial<Plan>): Plan {
  return { swordsman: 0, archer: 0, cavalry: 0, cannon: 0, ...partial };
}
const START_GARRISON = plan({ swordsman: 18, archer: 6 });
const START_PLAN = plan({ swordsman: 36, archer: 24 });

function neutralGarrison(size: PlanetSize): Plan {
  const count = size === 'S' ? 6 : size === 'M' ? 10 : size === 'L' ? 16 : 24;
  return plan({ swordsman: count });
}

function startsFor(playerCount: 2 | 4, width: number, height: number): MapPlanet[] {
  if (playerCount === 2) {
    return [
      {
        id: 0,
        size: 'M',
        x: 150,
        y: height / 2,
        ownerId: 0,
        garrison: START_GARRISON,
        plan: START_PLAN,
      },
      {
        id: 1,
        size: 'M',
        x: width - 150,
        y: height / 2,
        ownerId: 1,
        garrison: START_GARRISON,
        plan: START_PLAN,
      },
    ];
  }
  return [
    { id: 0, size: 'M', x: 150, y: 170, ownerId: 0, garrison: START_GARRISON, plan: START_PLAN },
    {
      id: 1,
      size: 'M',
      x: width - 150,
      y: 170,
      ownerId: 1,
      garrison: START_GARRISON,
      plan: START_PLAN,
    },
    {
      id: 2,
      size: 'M',
      x: 150,
      y: height - 170,
      ownerId: 2,
      garrison: START_GARRISON,
      plan: START_PLAN,
    },
    {
      id: 3,
      size: 'M',
      x: width - 150,
      y: height - 170,
      ownerId: 3,
      garrison: START_GARRISON,
      plan: START_PLAN,
    },
  ];
}

export class DuelMapGenerator implements MapGenerator {
  readonly #options: Required<DuelMapOptions>;

  constructor(options: DuelMapOptions = {}) {
    const base =
      options.playerCount === 4
        ? { ...DEFAULTS, minDistance: 95, startClearance: 150 }
        : DEFAULTS;
    this.#options = { ...base, ...options };
  }

  generate(seed: number): MapDefinition {
    return this.#options.playerCount === 4
      ? this.#generateFour(seed)
      : this.#generateDuel(seed);
  }

  #basePlanets(): MapPlanet[] {
    const { width, height, playerCount } = this.#options;
    const starts = startsFor(playerCount, width, height);
    return [
      ...starts,
      {
        id: starts.length,
        size: 'XL',
        x: width / 2,
        y: height / 2,
        ownerId: -1,
        garrison: neutralGarrison('XL'),
      },
    ];
  }

  #generateDuel(seed: number): MapDefinition {
    const { width, height, neutralPairs, minDistance, startClearance } = this.#options;
    const rng = createRng(seed);
    const planets = this.#basePlanets();
    let attempts = 0;

    while (planets.length < 3 + neutralPairs * 2 && attempts < 4000) {
      attempts += 1;
      const x = rng.nextInt(80, Math.floor(width / 2) - 30);
      const y = rng.nextInt(80, height - 80);
      if (!this.#canPlace(planets, x, y, minDistance, startClearance)) continue;

      const size = this.#sizeFor(x, y);
      this.#addNeutral(planets, size, x, y);
      this.#addNeutral(planets, size, width - x, y);
    }

    return { name: `duel-${seed}`, width, height, playerCount: 2, planets };
  }

  #generateFour(seed: number): MapDefinition {
    const { width, height, neutralPairs, minDistance, startClearance } = this.#options;
    const rng = createRng(seed);
    const planets = this.#basePlanets();
    let attempts = 0;

    while (planets.length < 5 + neutralPairs * 4 && attempts < 6000) {
      attempts += 1;
      const x = rng.nextInt(180, Math.floor(width / 2) - 30);
      const y = rng.nextInt(130, Math.floor(height / 2) - 30);
      if (!this.#canPlace(planets, x, y, minDistance, startClearance)) continue;

      const size = this.#sizeFor(x, y);
      for (const corner of [
        { x, y },
        { x: width - x, y },
        { x, y: height - y },
        { x: width - x, y: height - y },
      ]) {
        this.#addNeutral(planets, size, corner.x, corner.y);
      }
    }

    return { name: `four-${seed}`, width, height, playerCount: 4, planets };
  }

  #canPlace(
    planets: readonly MapPlanet[],
    x: number,
    y: number,
    minDistance: number,
    startClearance: number,
  ): boolean {    for (const planet of planets) {
      const distance = Math.hypot(planet.x - x, planet.y - y);
      if (distance < minDistance) return false;
      if (planet.ownerId !== -1 && distance < startClearance) return false;
    }
    return true;
  }

  /** Ближе к старту — мелкие и дешёвые, ближе к центру — крупные и ценные. */
  #sizeFor(x: number, y: number): PlanetSize {
    const dx = x - this.#options.width / 2;
    const dy = y - this.#options.height / 2;
    const fromCenter = Math.hypot(dx, dy);
    if (fromCenter > 260) return 'S';
    if (fromCenter > 150) return 'M';
    return 'L';
  }

  #addNeutral(planets: MapPlanet[], size: PlanetSize, x: number, y: number): void {    planets.push({
      id: planets.length,
      size,
      x,
      y,
      ownerId: -1,
      garrison: neutralGarrison(size),
    });
  }
}

export function generateDuelMap(seed: number, options: DuelMapOptions = {}): MapDefinition {
  return new DuelMapGenerator(options).generate(seed);
}
