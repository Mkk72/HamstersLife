/**
 * Одна планета: тело, лицо, цифра гарнизона, кольцо выбора и метки бустов.
 * Рисуется кодом (`Graphics`), без текстур: цвет владельца и размер — данные.
 * Класс не знает о правилах игры, только о `PlanetView`.
 */
import type { PlanetId } from '@hamsters/core';
import { formatMilli } from '@hamsters/core';
import { Container, Graphics, Text } from 'pixi.js';
import type { PlanetView } from '../presenter/viewModel';
import { PLANET_RADIUS, THEME, colorForOwner, darkColorForOwner } from './theme';

const BOOST_ANGLES: Readonly<Record<string, number>> = {
  production: -Math.PI / 2.4,
  speed: 0,
  defense: Math.PI / 2.4,
};

const BOOST_COLORS: Readonly<Record<string, number>> = {
  production: 0xffd166,
  speed: 0x9ad1ff,
  defense: 0x06d6a0,
};

export class PlanetSprite extends Container {
  readonly id: PlanetId;

  readonly #ring = new Graphics();
  readonly #body = new Graphics();
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
  #lastGarrison = -1;

  constructor(id: PlanetId) {
    super();
    this.id = id;
    this.#label.anchor.set(0.5);
    this.#caption.anchor.set(0.5);
    this.addChild(this.#ring, this.#body, this.#label, this.#caption);
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
      view.boosts.production > 0 ? 'p' : '',
      view.boosts.speed > 0 ? 's' : '',
      view.boosts.defense > 0 ? 'd' : '',
    ].join('|');

    if (key !== this.#drawnKey) {
      this.#draw(view);
      this.#drawnKey = key;
    }

    const garrison = Math.floor(view.garrison / 1000);
    if (garrison !== this.#lastGarrison) {
      this.#label.text = formatMilli(view.garrison, 0);
      this.#label.position.set(0, this.#radius * 0.34);
      this.#lastGarrison = garrison;
    }

    this.#caption.visible = view.mine;
    this.#caption.position.set(0, -this.#radius - 12);
  }

  /** Пульс кольца выбора; время в миллисекундах. */
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

    // Тело: круг, снизу тень-полумесяц, сверху блик.
    body.circle(0, 0, radius).fill({ color: base });
    body.arc(0, 0, radius, 0.15, Math.PI - 0.15).fill({ color: dark, alpha: 0.85 });
    body.circle(-radius * 0.3, -radius * 0.35, radius * 0.28).fill({ color: 0xffffff, alpha: 0.18 });
    body.circle(0, 0, radius).stroke({ width: 2, color: 0x0a0f22, alpha: 0.55 });

    // Лицо: глаза и улыбка — «хомячья морда» без ассетов.
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

    for (const [kind, angle] of Object.entries(BOOST_ANGLES)) {
      const remaining = view.boosts[kind as keyof PlanetView['boosts']];
      if (remaining <= 0) continue;
      const distance = radius + 11;
      ring
        .circle(Math.cos(angle) * distance, Math.sin(angle) * distance, 4)
        .fill({ color: BOOST_COLORS[kind] ?? THEME.boost });
    }
  }
}
