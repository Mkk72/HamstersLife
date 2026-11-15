/**
 * Слой флотов: капсулы с хомяками. Позиция считается по прогрессу из модели,
 * а между тиками она сглаживается (lerp), чтобы 20 Гц симуляции выглядели
 * плавно на 60–144 Гц отрисовки. Сглаживание — только визуальное.
 */
import type { FleetView } from '../presenter/viewModel';
import { Container, Graphics } from 'pixi.js';
import { colorForOwner } from './theme';

/** Скорость сглаживания: доля пути до цели за кадр при 60 FPS. */
const SMOOTHING = 0.35;

class FleetSprite extends Container {
  readonly id: number;
  readonly #shape = new Graphics();
  fromX = 0;
  fromY = 0;
  toX = 0;
  toY = 0;
  target = 0;
  progress = 0;

  constructor(id: number, ownerId: number) {
    super();
    this.id = id;
    const color = colorForOwner(ownerId);
    this.#shape.roundRect(-10, -5, 20, 10, 5).fill({ color });
    this.#shape.roundRect(-10, -5, 20, 10, 5).stroke({ width: 1.5, color: 0x0a0f22, alpha: 0.6 });
    this.#shape.circle(7, 0, 4).fill({ color: 0xffffff, alpha: 0.85 });
    this.addChild(this.#shape);
  }

  setTarget(view: FleetView): void {
    this.fromX = view.fromX;
    this.fromY = view.fromY;
    this.toX = view.toX;
    this.toY = view.toY;
    this.target = view.progress;
  }

  tick(deltaMs: number): void {
    const step = Math.min(1, (deltaMs / 16.7) * SMOOTHING);
    this.progress += (this.target - this.progress) * step;
    const x = this.fromX + (this.toX - this.fromX) * this.progress;
    const y = this.fromY + (this.toY - this.fromY) * this.progress;
    this.position.set(x, y);
    this.rotation = Math.atan2(this.toY - this.fromY, this.toX - this.fromX);
  }
}

export class FleetLayer {
  readonly view = new Container();
  readonly #sprites = new Map<number, FleetSprite>();

  update(fleets: readonly FleetView[]): void {
    const alive = new Set<number>();
    for (const fleet of fleets) {
      alive.add(fleet.id);
      let sprite = this.#sprites.get(fleet.id);
      if (!sprite) {
        sprite = new FleetSprite(fleet.id, fleet.ownerId);
        sprite.setTarget(fleet);
        sprite.progress = fleet.progress;
        this.#sprites.set(fleet.id, sprite);
        this.view.addChild(sprite);
      } else {
        sprite.setTarget(fleet);
      }
    }
    for (const [id, sprite] of this.#sprites) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.#sprites.delete(id);
    }
  }

  tick(deltaMs: number): void {
    for (const sprite of this.#sprites.values()) sprite.tick(deltaMs);
  }
}
