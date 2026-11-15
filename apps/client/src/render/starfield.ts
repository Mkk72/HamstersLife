/**
 * Звёздный фон: процедурный, никаких текстур. Позиции берутся из
 * детерминированного PRNG, поэтому фон одинаков при каждом запуске seed.
 * Класс сам управляет своими объектами и умеет перестраиваться при resize.
 */
import { createRng } from '@hamsters/core';
import { Container, Graphics } from 'pixi.js';
import type { QualityLevel } from '../presenter/viewModel';
import { THEME } from './theme';

interface Star {
  readonly gfx: Graphics;
  readonly phase: number;
  readonly speed: number;
}

/** Доля звёзд по уровню качества: низкое — меньше объектов в кадре. */
const QUALITY_FACTOR: Readonly<Record<QualityLevel, number>> = {
  low: 0.35,
  medium: 0.65,
  high: 1,
};

export class Starfield {
  readonly view = new Container();

  #width: number;
  #height: number;
  #seed: number;
  #stars: Star[] = [];
  #time = 0;
  #quality: QualityLevel = 'high';

  constructor(width: number, height: number, seed: number) {
    this.#width = width;
    this.#height = height;
    this.#seed = seed;
    this.#build();
  }

  resize(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return;
    this.#width = width;
    this.#height = height;
    this.#build();
  }

  update(deltaMs: number): void {
    this.#time += deltaMs;
    for (const star of this.#stars) {
      star.gfx.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(this.#time / star.speed + star.phase));
    }
  }

  setQuality(level: QualityLevel): void {
    if (level === this.#quality) return;
    this.#quality = level;
    this.#build();
  }

  #build(): void {
    this.view.removeChildren();
    this.#stars = [];

    const rng = createRng(this.#seed);
    const nebula = new Graphics();
    for (let index = 0; index < 4; index += 1) {
      const cx = rng.nextInt(0, this.#width);
      const cy = rng.nextInt(0, this.#height);
      const radius = rng.nextInt(180, 420);
      nebula.circle(cx, cy, radius).fill({
        color: index % 2 === 0 ? THEME.nebula : THEME.spaceDeep,
        alpha: 0.16,
      });
    }
    this.view.addChild(nebula);

    const count = Math.max(
      40,
      Math.round(((this.#width * this.#height) / 9000) * QUALITY_FACTOR[this.#quality]),
    );
    for (let index = 0; index < count; index += 1) {
      const star = new Graphics();
      const x = rng.nextInt(0, this.#width);
      const y = rng.nextInt(0, this.#height);
      const radius = rng.nextPermille() < 850 ? 1 : 1.8;
      star.circle(x, y, radius).fill({ color: THEME.star, alpha: 1 });
      star.alpha = 0.3;
      this.#stars.push({
        gfx: star,
        phase: (rng.nextPermille() / 1000) * Math.PI * 2,
        speed: 900 + rng.nextInt(0, 1200),
      });
      this.view.addChild(star);
    }
  }
}
