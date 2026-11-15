/**
 * Звёздный фон: процедурный, никаких текстур. Позиции берутся из
 * детерминированного PRNG, поэтому фон одинаков при каждом запуске seed.
 *
 * Все звёзды рисуются в одну `Graphics`: сотня отдельных объектов стоила
 * сотню draw call'ов и пересчёта альфы каждый кадр — на слабых GPU это и было
 * главной просадкой. Теперь мерцает одна общая прозрачность.
 */
import { createRng } from '@hamsters/core';
import { Container, Graphics } from 'pixi.js';
import type { QualityLevel } from '../presenter/viewModel';
import { THEME } from './theme';

/** Доля звёзд по уровню качества: низкое — меньше объектов в кадре. */
const QUALITY_FACTOR: Readonly<Record<QualityLevel, number>> = {
  low: 0.35,
  medium: 0.65,
  high: 1,
};

export class Starfield {
  readonly view = new Container();
  readonly #nebula = new Graphics();
  readonly #stars = new Graphics();

  #width: number;
  #height: number;
  #seed: number;
  #time = 0;
  #quality: QualityLevel = 'high';

  constructor(width: number, height: number, seed: number) {
    this.#width = width;
    this.#height = height;
    this.#seed = seed;
    this.view.addChild(this.#nebula, this.#stars);
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
    // Одна запись альфы вместо перебора всех звёзд каждый кадр.
    this.#stars.alpha = 0.7 + 0.2 * Math.sin(this.#time / 1400);
  }

  setQuality(level: QualityLevel): void {
    if (level === this.#quality) return;
    this.#quality = level;
    this.#build();
  }

  #build(): void {
    const rng = createRng(this.#seed);
    const nebula = this.#nebula;
    nebula.clear();
    for (let index = 0; index < 4; index += 1) {
      const cx = rng.nextInt(0, this.#width);
      const cy = rng.nextInt(0, this.#height);
      const radius = rng.nextInt(180, 420);
      nebula.circle(cx, cy, radius).fill({
        color: index % 2 === 0 ? THEME.nebula : THEME.spaceDeep,
        alpha: 0.16,
      });
    }

    const stars = this.#stars;
    stars.clear();
    const count = Math.max(
      40,
      Math.round(((this.#width * this.#height) / 9000) * QUALITY_FACTOR[this.#quality]),
    );
    for (let index = 0; index < count; index += 1) {
      const x = rng.nextInt(0, this.#width);
      const y = rng.nextInt(0, this.#height);
      const radius = rng.nextPermille() < 850 ? 1 : 1.8;
      stars.circle(x, y, radius).fill({ color: THEME.star, alpha: 1 });
      // Пропускаем фазу/скорость — они больше не нужны при общей альфе.
      rng.nextPermille();
      rng.nextInt(0, 1200);
    }
    stars.alpha = 0.8;
  }
}
