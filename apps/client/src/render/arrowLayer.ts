/**
 * Слой стрелок: постоянные маршруты рисуются цепочкой «галочек» направления,
 * а предпросмотр при перетаскивании — яркой линией с крупным наконечником и
 * временем полёта. Маршруты не исчезают: их отрезают ПКМ-протяжкой.
 */
import type { ArrowView, RouteView } from '../presenter/viewModel';
import { Container, Graphics, Text } from 'pixi.js';
import { THEME, colorForOwner } from './theme';

const CHEVRON_SPACING = 24;
const CHEVRON_SIZE = 4.6;
const HEAD_LENGTH = 16;

export class ArrowLayer {
  readonly view = new Container();
  readonly #routes = new Graphics();
  readonly #preview = new Graphics();
  readonly #label = new Text({
    text: '',
    style: {
      fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
      fontSize: 13,
      fontWeight: '600',
      fill: THEME.text,
      stroke: { color: 0x0a0f22, width: 3 },
    },
  });

  constructor() {
    this.#label.anchor.set(0.5);
    this.view.addChild(this.#routes, this.#preview, this.#label);
  }

  update(routes: readonly RouteView[], preview: readonly ArrowView[]): void {
    this.#drawRoutes(routes);
    this.#drawPreview(preview);
  }

  #drawRoutes(routes: readonly RouteView[]): void {
    const g = this.#routes;
    g.clear();

    for (const route of routes) {
      const dx = route.toX - route.fromX;
      const dy = route.toY - route.fromY;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;

      const ux = dx / length;
      const uy = dy / length;
      const color = colorForOwner(route.ownerId);
      const alpha = 0.45 + (route.weightPermille / 1000) * 0.3;

      for (let travelled = 20; travelled < length - 20; travelled += CHEVRON_SPACING) {
        const x = route.fromX + ux * travelled;
        const y = route.fromY + uy * travelled;
        const tipX = x + ux * 5;
        const tipY = y + uy * 5;
        const baseX = x - ux * 4;
        const baseY = y - uy * 4;
        g.poly([
          tipX,
          tipY,
          baseX - uy * CHEVRON_SIZE,
          baseY + ux * CHEVRON_SIZE,
          baseX + uy * CHEVRON_SIZE,
          baseY - ux * CHEVRON_SIZE,
        ]).fill({ color, alpha });
      }
    }
  }

  #drawPreview(preview: readonly ArrowView[]): void {
    const g = this.#preview;
    g.clear();
    const first = preview[0];
    if (!first) {
      this.#label.text = '';
      return;
    }

    for (const arrow of preview) {
      const color = arrow.valid ? THEME.arrow : THEME.arrowInvalid;
      g.moveTo(arrow.fromX, arrow.fromY)
        .lineTo(arrow.toX, arrow.toY)
        .stroke({ width: arrow.valid ? 3 : 2, color, alpha: 0.85 });

      const angle = Math.atan2(arrow.toY - arrow.fromY, arrow.toX - arrow.fromX);
      const leftX = arrow.toX - Math.cos(angle - 0.42) * HEAD_LENGTH;
      const leftY = arrow.toY - Math.sin(angle - 0.42) * HEAD_LENGTH;
      const rightX = arrow.toX - Math.cos(angle + 0.42) * HEAD_LENGTH;
      const rightY = arrow.toY - Math.sin(angle + 0.42) * HEAD_LENGTH;
      g.poly([arrow.toX, arrow.toY, leftX, leftY, rightX, rightY]).fill({ color, alpha: 0.95 });
    }

    const midX = (first.fromX + first.toX) / 2;
    const midY = (first.fromY + first.toY) / 2;
    this.#label.text = `${first.travelSeconds.toFixed(1)} с`;
    this.#label.position.set(midX, midY - 14);
  }
}
