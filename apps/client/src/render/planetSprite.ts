/**
 * Одна планета: тело, лицо, кольцо выбора, значок боя и постоянные иконки
 * родов с числами «задано / есть». Всё рисуется кодом.
 */
import type { PlanetId } from '@hamsters/core';
import { Container, Graphics, Text } from 'pixi.js';
import type { PlanetView } from '../presenter/viewModel';
import { PLANET_RADIUS, THEME, colorForOwner, darkColorForOwner } from './theme';
import { drawUnitIcon } from './unitIcon';

const BADGE_FONT = {
  fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
  fontSize: 9,
  fontWeight: '600',
  fill: THEME.text,
  stroke: { color: 0x0a0f22, width: 2 },
} as const;

export class PlanetSprite extends Container {
  readonly id: PlanetId;

  readonly #ring = new Graphics();
  readonly #body = new Graphics();
  readonly #badges = new Container();
  readonly #label = new Text({
    text: '',
    style: {
      fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
      fontSize: 16,
      fontWeight: '700',
      fill: THEME.text,
      stroke: { color: 0x0a0f22, width: 3 },
    },
  });
  readonly #caption = new Text({
    text: 'моя',
    style: {
      fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
      fontSize: 11,
      fontWeight: '600',
      fill: THEME.arrow,
      stroke: { color: 0x0a0f22, width: 3 },
    },
  });

  #radius = 0;
  #drawnKey = '';
  #badgeKey = '';
  #lastGarrison = -1;

  constructor(id: PlanetId) {
    super();
    this.id = id;
    this.#label.anchor.set(0.5);
    this.#caption.anchor.set(0.5);
    this.addChild(this.#ring, this.#body, this.#badges, this.#label, this.#caption);
  }

  get radius(): number {
    return this.#radius;
  }

  update(view: PlanetView): void {
    this.position.set(view.x, view.y);
    this.#radius = PLANET_RADIUS[view.size] ?? 28;

    const key = [
      view.size,
      view.ownerId,
      view.selected ? 'sel' : '',
      view.highlighted ? 'target' : '',
      view.battleId !== null ? 'battle' : '',
    ].join('|');

    if (key !== this.#drawnKey) {
      this.#draw(view);
      this.#drawnKey = key;
    }

    const garrison = view.total;
    if (garrison !== this.#lastGarrison) {
      this.#label.text = String(garrison);
      this.#label.position.set(0, this.#radius * 0.34);
      this.#lastGarrison = garrison;
    }

    const badgeKey = view.units.map((unit) => `${unit.kind}:${unit.plan}/${unit.have}`).join('|');
    if (badgeKey !== this.#badgeKey) {
      this.#drawBadges(view);
      this.#badgeKey = badgeKey;
    }

    this.#caption.visible = false;
    this.#caption.position.set(0, -this.#radius - 12);
  }

  tick(timeMs: number): void {
    if (this.#ring.alpha === 0) return;
    this.#ring.alpha = 0.55 + 0.45 * Math.sin(timeMs / 220);
  }

  #draw(view: PlanetView): void {
    const radius = this.#radius;
    const body = this.#body;
    const ring = this.#ring;
    body.clear();
    ring.clear();

    const base = colorForOwner(view.ownerId);
    const dark = darkColorForOwner(view.ownerId);

    body.circle(0, 0, radius).fill({ color: base });
    body.arc(0, 0, radius, 0.15, Math.PI - 0.15).fill({ color: dark, alpha: 0.85 });
    body.circle(-radius * 0.3, -radius * 0.35, radius * 0.28).fill({ color: 0xffffff, alpha: 0.18 });
    body.circle(0, 0, radius).stroke({ width: 2, color: 0x0a0f22, alpha: 0.55 });

    const eyeY = -radius * 0.46;
    const eyeX = radius * 0.24;
    const eyeR = Math.max(1.6, radius * 0.1);
    for (const sign of [-1, 1]) {
      body.circle(sign * eyeX, eyeY, eyeR).fill({ color: 0x101528 });
      body.circle(sign * eyeX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.4).fill({ color: 0xffffff });
    }
    body.arc(0, -radius * 0.16, radius * 0.26, 0.4, Math.PI - 0.4).stroke({
      width: Math.max(1.4, radius * 0.055),
      color: 0x101528,
      alpha: 0.55,
    });

    if (view.selected) {
      ring.circle(0, 0, radius + 6).stroke({ width: 3, color: THEME.arrow, alpha: 0.9 });
    }

    if (view.highlighted) {
      const targetRadius = radius + 11;
      const segments = 16;
      for (let index = 0; index < segments; index += 2) {
        const start = (Math.PI * 2 * index) / segments;
        const end = (Math.PI * 2 * (index + 1)) / segments;
        ring.arc(0, 0, targetRadius, start, end).stroke({ width: 4, color: 0xffd166, alpha: 0.95 });
      }
    }

    if (view.battleId !== null) {
      ring.circle(0, 0, radius + 9).stroke({ width: 3, color: 0xff5d5d, alpha: 0.95 });
      ring.circle(0, 0, radius + 14).stroke({ width: 1, color: 0xff5d5d, alpha: 0.4 });
    }
  }

  #drawBadges(view: PlanetView): void {
    this.#badges.removeChildren();
    const shown = view.units.filter((unit) => unit.plan > 0 || unit.have > 0);
    const gap = 44;
    const start = -((shown.length - 1) * gap) / 2;
    shown.forEach((unit, index) => {
      const x = start + index * gap;
      const icon = new Graphics();
      drawUnitIcon(icon, unit.kind, 7, unit.producing ? 0xffd166 : THEME.arrow);
      icon.position.set(x - 10, this.#radius + 16);
      const value = new Text({
        text: `${unit.plan}/${unit.have}`,
        style: {
          ...BADGE_FONT,
          fill: unit.plan > unit.have ? 0xffd166 : unit.have > unit.plan ? 0x9ad1ff : THEME.text,
        },
      });
      value.anchor.set(0, 0.5);
      value.position.set(x - 2, this.#radius + 16);
      this.#badges.addChild(icon, value);
    });
  }
}

