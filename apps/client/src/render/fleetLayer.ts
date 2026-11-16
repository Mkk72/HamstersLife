/**
 * Флоты: капсула с до трёх иконок родов и общей цифрой. Позиция сглаживается
 * между тиками, состав обновляется из модели.
 */
import type { UnitKind } from '@hamsters/core';
import { Container, Graphics, Text } from 'pixi.js';
import type { FleetView } from '../presenter/viewModel';
import { colorForOwner } from './theme';
import { drawUnitIcon } from './unitIcon';

const SMOOTHING = 0.35;

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

class FleetSprite extends Container {
  readonly id: number;
  readonly #capsule = new Graphics();
  readonly #icons = new Container();
  readonly #count = new Text({
    text: '',
    style: {
      fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
      fontSize: 10,
      fontWeight: '700',
      fill: 0xffffff,
      stroke: { color: 0x0a0f22, width: 2 },
    },
  });
  fromX = 0;
  fromY = 0;
  toX = 0;
  toY = 0;
  target = 0;
  progress = 0;
  #signature = '';

  constructor(id: number, ownerId: number) {
    super();
    this.id = id;
    const color = colorForOwner(ownerId);
    this.#capsule.roundRect(-14, -8, 28, 16, 8).fill({ color });
    this.#capsule.roundRect(-14, -8, 28, 16, 8).stroke({ width: 1.2, color: 0x0a0f22, alpha: 0.6 });
    this.#count.anchor.set(0.5);
    this.#count.position.set(0, 13);
    this.addChild(this.#capsule, this.#icons, this.#count);
  }

  setTarget(view: FleetView): void {
    this.fromX = view.fromX;
    this.fromY = view.fromY;
    this.toX = view.toX;
    this.toY = view.toY;
    this.target = view.progress;

    const signature = view.units.map((unit) => `${unit.kind}:${unit.count}`).join('|');
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#drawIcons(view);
    }
  }

  #drawIcons(view: FleetView): void {
    this.#icons.removeChildren();
    const shown = view.units.slice(0, 3);
    const gap = 9;
    const start = -((shown.length - 1) * gap) / 2;
    shown.forEach((unit, index) => {
      const icon = new Graphics();
      drawUnitIcon(icon, unit.kind, 5, 0xffffff);
      icon.position.set(start + index * gap, 0);
      this.#icons.addChild(icon);
    });
    this.#count.text = formatCount(view.total);
  }

  tick(deltaMs: number): void {
    const step = Math.min(1, (deltaMs / 16.7) * SMOOTHING);
    this.progress += (this.target - this.progress) * step;
    const x = this.fromX + (this.toX - this.fromX) * this.progress;
    const y = this.fromY + (this.toY - this.fromY) * this.progress;
    this.position.set(x, y);
    this.rotation = Math.atan2(this.toY - this.fromY, this.toX - this.fromX);
    this.#count.rotation = -this.rotation;
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

export type { UnitKind };
