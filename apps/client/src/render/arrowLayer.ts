/**
 * Стрелка отправки: линия от выбранных планет к цели, наконечник и время
 * полёта. Рисуется под планетами, поэтому линия «входит» в край планеты и не
 * мешает читать цифры.
 */
import type { ArrowView } from '../presenter/viewModel';
import { Container, Graphics, Text } from 'pixi.js';
import { THEME } from './theme';

const HEAD_LENGTH = 16;

export class ArrowLayer {
  readonly view = new Container();
  readonly #line = new Graphics();
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
    this.view.addChild(this.#line, this.#label);
  }

  update(arrows: readonly ArrowView[]): void {
    this.#line.clear();
    const first = arrows[0];
    if (!first) {
      this.#label.text = '';
      return;
    }

    for (const arrow of arrows) {
      const color = arrow.valid ? THEME.arrow : THEME.arrowInvalid;
      this.#line
        .moveTo(arrow.fromX, arrow.fromY)
        .lineTo(arrow.toX, arrow.toY)
        .stroke({ width: arrow.valid ? 3 : 2, color, alpha: 0.8 });

      const angle = Math.atan2(arrow.toY - arrow.fromY, arrow.toX - arrow.fromX);
      const tipX = arrow.toX;
      const tipY = arrow.toY;
      const leftX = tipX - Math.cos(angle - 0.42) * HEAD_LENGTH;
      const leftY = tipY - Math.sin(angle - 0.42) * HEAD_LENGTH;
      const rightX = tipX - Math.cos(angle + 0.42) * HEAD_LENGTH;
      const rightY = tipY - Math.sin(angle + 0.42) * HEAD_LENGTH;
      this.#line
        .poly([tipX, tipY, leftX, leftY, rightX, rightY])
        .fill({ color, alpha: 0.95 });
    }

    const midX = (first.fromX + first.toX) / 2;
    const midY = (first.fromY + first.toY) / 2;
    this.#label.text = `${first.travelSeconds.toFixed(1)} с`;
    this.#label.position.set(midX, midY - 14);
  }
}
