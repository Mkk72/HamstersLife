/**
 * Генератор симметричных карт: дуэль 1×1 и «все против всех» 1×3.
 *
 * Зеркальная симметрия даёт равные расстояния и гарнизоны: честный старт без
 * проверочных симуляций (полная проверка баланса — этап 3 ROADMAP).
 * Одинаковый seed всегда даёт одинаковую карту: используется PRNG ядра.
 */
import { createRng } from '@hamsters/core';
import type { MapDefinition, MapPlanet, PlanetSize } from '@hamsters/core';

/** Порт: генератор карт можно заменить (ручная, сгенерированная, из файла). */
export interface MapGenerator {
  generate(seed: number): MapDefinition;
}

export interface DuelMapOptions {
  readonly width?: number;
  readonly height?: number;
  /** 2 — дуэль, 4 — «все против всех». */
  readonly playerCount?: 2 | 4;
  /** Сколько пар (2 игрока) или четвёрок (4 игрока) нейтралов. */
  readonly neutralPairs?: number;
  /** Минимальное расстояние между планетами в единицах карты. */
  readonly minDistance?: number;
  /** Минимальное расстояние от стартовых планет. */
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

const NEUTRAL_SIZES: readonly PlanetSize[] = ['S', 'S', 'S', 'M'];

function startsFor(playerCount: 2 | 4, width: number, height: number): MapPlanet[] {
  if (playerCount === 2) {
    return [
      { id: 0, size: 'M', x: 150, y: height / 2, ownerId: 0, garrisonHamsters: 12 },
      { id: 1, size: 'M', x: width - 150, y: height / 2, ownerId: 1, garrisonHamsters: 12 },
    ];
  }
  return [
    { id: 0, size: 'M', x: 150, y: 170, ownerId: 0, garrisonHamsters: 12 },
    { id: 1, size: 'M', x: width - 150, y: 170, ownerId: 1, garrisonHamsters: 12 },
    { id: 2, size: 'M', x: 150, y: height - 170, ownerId: 2, garrisonHamsters: 12 },
    { id: 3, size: 'M', x: width - 150, y: height - 170, ownerId: 3, garrisonHamsters: 12 },
  ];
}

export class DuelMapGenerator implements MapGenerator {
  readonly #options: Required<DuelMapOptions>;

  constructor(options: DuelMapOptions = {}) {
    // На четверых точек вчетверо больше, поэтому зазор меньше: иначе пять
    // четвёрок нейтралов физически не помещаются и карта выходит бедной.
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
    return [...starts, { id: starts.length, size: 'XL', x: width / 2, y: height / 2, ownerId: -1, garrisonHamsters: 12 }];
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

      const size = NEUTRAL_SIZES[rng.nextInt(0, NEUTRAL_SIZES.length)] ?? 'S';
      const garrison = rng.nextIntInclusive(4, 6);
      this.#addNeutral(planets, size, x, y, garrison);
      this.#addNeutral(planets, size, width - x, y, garrison);
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

      const size = NEUTRAL_SIZES[rng.nextInt(0, NEUTRAL_SIZES.length)] ?? 'S';
      const garrison = rng.nextIntInclusive(4, 6);
      for (const corner of [
        { x, y },
        { x: width - x, y },
        { x, y: height - y },
        { x: width - x, y: height - y },
      ]) {
        this.#addNeutral(planets, size, corner.x, corner.y, garrison);
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
  ): boolean {
    for (const planet of planets) {
      const distance = Math.hypot(planet.x - x, planet.y - y);
      if (distance < minDistance) return false;
      if (planet.ownerId !== -1 && distance < startClearance) return false;
    }
    return true;
  }

  #addNeutral(
    planets: MapPlanet[],
    size: PlanetSize,
    x: number,
    y: number,
    garrison: number,
  ): void {
    planets.push({ id: planets.length, size, x, y, ownerId: -1, garrisonHamsters: garrison });
  }
}

export function generateDuelMap(seed: number, options: DuelMapOptions = {}): MapDefinition {
  return new DuelMapGenerator(options).generate(seed);
}
