/**
 * Генератор симметричных карт 1×1.
 *
 * Половина карты заполняется нейтралами, вторая — зеркало. Так у обоих игроков
 * одинаковые расстояния и гарнизоны: честный старт без проверочных симуляций
 * (полная проверка баланса — этап 3 ROADMAP).
 *
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
  /** Сколько пар нейтралов вокруг центра. */
  readonly neutralPairs?: number;
  /** Минимальное расстояние между планетами в единицах карты. */
  readonly minDistance?: number;
  /** Минимальное расстояние от стартовых планет. */
  readonly startClearance?: number;
}

const DEFAULTS = {
  width: 1200,
  height: 800,
  neutralPairs: 5,
  minDistance: 120,
  startClearance: 220,
} satisfies Required<DuelMapOptions>;

const NEUTRAL_SIZES: readonly PlanetSize[] = ['S', 'S', 'S', 'M'];

export class DuelMapGenerator implements MapGenerator {
  readonly #options: Required<DuelMapOptions>;

  constructor(options: DuelMapOptions = {}) {
    this.#options = { ...DEFAULTS, ...options };
  }

  generate(seed: number): MapDefinition {
    const { width, height, neutralPairs, minDistance, startClearance } = this.#options;
    const rng = createRng(seed);
    const marginX = 80;
    const marginY = 80;

    const planets: MapPlanet[] = [
      { id: 0, size: 'M', x: marginX + 70, y: height / 2, ownerId: 0, garrisonHamsters: 12 },
      { id: 1, size: 'M', x: width - marginX - 70, y: height / 2, ownerId: 1, garrisonHamsters: 12 },
      { id: 2, size: 'XL', x: width / 2, y: height / 2, ownerId: -1, garrisonHamsters: 12 },
    ];

    const leftPoints: { x: number; y: number }[] = [];
    const attemptsLimit = 4000;
    let attempts = 0;

    while (leftPoints.length < neutralPairs && attempts < attemptsLimit) {
      attempts += 1;
      const x = rng.nextInt(marginX, Math.floor(width / 2) - 30);
      const y = rng.nextInt(marginY, height - marginY);

      const tooClose = planets.some(
        (planet) => Math.hypot(planet.x - x, planet.y - y) < minDistance,
      );
      if (tooClose) continue;
      const tooCloseToStart = planets
        .filter((planet) => planet.ownerId !== -1)
        .some((planet) => Math.hypot(planet.x - x, planet.y - y) < startClearance);
      if (tooCloseToStart) continue;

      leftPoints.push({ x, y });
      const size = NEUTRAL_SIZES[rng.nextInt(0, NEUTRAL_SIZES.length)] ?? 'S';
      const garrison = rng.nextIntInclusive(4, 6);
      planets.push({ id: planets.length, size, x, y, ownerId: -1, garrisonHamsters: garrison });
      planets.push({
        id: planets.length,
        size,
        x: width - x,
        y,
        ownerId: -1,
        garrisonHamsters: garrison,
      });
    }

    return {
      name: `duel-${seed}`,
      width,
      height,
      playerCount: 2,
      planets,
    };
  }
}

export function generateDuelMap(seed: number, options: DuelMapOptions = {}): MapDefinition {
  return new DuelMapGenerator(options).generate(seed);
}
