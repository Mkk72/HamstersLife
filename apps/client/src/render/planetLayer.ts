/**
 * Слой планет: создаёт спрайты по модели, убирает исчезнувшие, отвечает на
 * попадание курсором. Новые виды планет не требуют правок сцены — только
 * `PlanetSprite`.
 */
import type { PlanetId } from '@hamsters/core';
import { Container } from 'pixi.js';
import type { PlanetView } from '../presenter/viewModel';
import { PlanetSprite } from './planetSprite';

export class PlanetLayer {
  readonly view = new Container();
  readonly #sprites = new Map<PlanetId, PlanetSprite>();

  update(planets: readonly PlanetView[]): void {
    const alive = new Set<PlanetId>();
    for (const planet of planets) {
      alive.add(planet.id);
      let sprite = this.#sprites.get(planet.id);
      if (!sprite) {
        sprite = new PlanetSprite(planet.id);
        this.#sprites.set(planet.id, sprite);
        this.view.addChild(sprite);
      }
      sprite.update(planet);
    }
    for (const [id, sprite] of this.#sprites) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.#sprites.delete(id);
    }
  }

  tick(timeMs: number): void {
    for (const sprite of this.#sprites.values()) sprite.tick(timeMs);
  }

  sprite(id: PlanetId): PlanetSprite | undefined {
    return this.#sprites.get(id);
  }

  /** Планета под точкой мира или null. */
  hitTest(x: number, y: number): PlanetId | null {
    let best: PlanetId | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const sprite of this.#sprites.values()) {
      const dx = sprite.x - x;
      const dy = sprite.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance <= sprite.radius + 10 && distance < bestDistance) {
        best = sprite.id;
        bestDistance = distance;
      }
    }
    return best;
  }
}
