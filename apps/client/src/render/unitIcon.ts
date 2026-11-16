/**
 * Мини-иконки родов войск: рисуются кодом, без ассетов. Один размер и стиль
 * для планет, жетонов флотов и панели.
 */
import type { UnitKind } from '@hamsters/core';
import { Graphics } from 'pixi.js';

export function drawUnitIcon(
  gfx: Graphics,
  kind: UnitKind,
  size: number,
  color: number,
): void {
  const s = size;
  if (kind === 'swordsman') {
    // Меч: клинок, гарда, рукоять.
    gfx.moveTo(-s * 0.5, s * 0.5).lineTo(s * 0.5, -s * 0.5).stroke({ width: 1.6, color });
    gfx.moveTo(-s * 0.6, s * 0.1).lineTo(-s * 0.1, s * 0.6).stroke({ width: 1.6, color });
    gfx.moveTo(s * 0.1, s * 0.7).lineTo(s * 0.6, s * 0.2).stroke({ width: 1.2, color });
    return;
  }
  if (kind === 'archer') {
    // Лук: дуга и тетива.
    gfx.arc(0, 0, s * 0.55, -1.2, 1.2).stroke({ width: 1.6, color });
    gfx.moveTo(s * 0.2, -s * 0.52).lineTo(s * 0.2, s * 0.52).stroke({ width: 1, color });
    gfx.moveTo(-s * 0.35, 0).lineTo(s * 0.55, 0).stroke({ width: 1, color });
    return;
  }
  if (kind === 'cavalry') {
    // Конь: корпус, голова, ноги.
    gfx.ellipse(0, s * 0.1, s * 0.5, s * 0.28).fill({ color });
    gfx.circle(s * 0.45, -s * 0.22, s * 0.2).fill({ color });
    gfx.moveTo(-s * 0.3, s * 0.35).lineTo(-s * 0.4, s * 0.65).stroke({ width: 1.4, color });
    gfx.moveTo(s * 0.2, s * 0.35).lineTo(s * 0.3, s * 0.65).stroke({ width: 1.4, color });
    return;
  }
  // Пушка: ствол и колесо.
  gfx.roundRect(-s * 0.55, -s * 0.2, s * 0.8, s * 0.3, 1.5).fill({ color });
  gfx.circle(-s * 0.35, s * 0.3, s * 0.18).fill({ color });
  gfx.moveTo(s * 0.2, -s * 0.12).lineTo(s * 0.6, -s * 0.32).stroke({ width: 2, color });
}
