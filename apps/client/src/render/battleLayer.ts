/**
 * Бой: два отряда-иконки у планеты (или в точке перехвата) и лучи «кто кого
 * бьёт». Лучи строятся по приоритетам родов из данных, поэтому показывают
 * реальную цель, а не случайную линию.
 */
import type { BattleView, BattleUnitView } from '../presenter/viewModel';
import { Container, Graphics, Text } from 'pixi.js';
import { drawUnitIcon } from './unitIcon';

const KIND_COLOR: Readonly<Record<string, number>> = {
  swordsman: 0xffd166,
  archer: 0x7ee081,
  cavalry: 0x7cb7ff,
  cannon: 0xff8a65,
};

interface Anchor {
  readonly x: number;
  readonly y: number;
}

class BattleSprite extends Container {
  readonly id: number;
  readonly #beamGraphics = new Graphics();
  readonly #units = new Container();
  readonly #title = new Text({
    text: 'БОЙ',
    style: {
      fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
      fontSize: 10,
      fontWeight: '700',
      fill: 0xff8a65,
      stroke: { color: 0x0a0f22, width: 3 },
    },
  });
  #signature = '';
  readonly #anchors = new Map<string, Anchor>();

  constructor(id: number) {
    super();
    this.id = id;
    this.#title.anchor.set(0.5);
    this.addChild(this.#beamGraphics, this.#units, this.#title);
  }

  update(view: BattleView): void {
    this.position.set(view.x, view.y);
    const signature = [
      view.attacker.units.map((unit) => `${unit.kind}:${unit.count}`).join(','),
      view.defender.units.map((unit) => `${unit.kind}:${unit.count}`).join(','),
    ].join('|');
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#rebuild(view);
    }
    this.#drawBeams(view);
  }

  #rebuild(view: BattleView): void {
    this.#units.removeChildren();
    this.#anchors.clear();
    this.#title.text = view.kind === 'planet' ? 'БОЙ' : 'ПЕРЕХВАТ';
    this.#title.position.set(0, view.kind === 'planet' ? 52 : -52);

    this.#placeSide(view.attacker.units, 'attacker', -58);
    this.#placeSide(view.defender.units, 'defender', 58);
  }

  #placeSide(units: readonly BattleUnitView[], side: 'attacker' | 'defender', x: number): void {
    units.slice(0, 4).forEach((unit, index) => {
      const y = -30 + index * 20;
      const icon = new Graphics();
      drawUnitIcon(icon, unit.kind, 8, KIND_COLOR[unit.kind] ?? 0xffffff);
      icon.position.set(x, y);
      const label = new Text({
        text: String(unit.count),
        style: {
          fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
          fontSize: 10,
          fontWeight: '600',
          fill: 0xffffff,
          stroke: { color: 0x0a0f22, width: 2 },
        },
      });
      label.anchor.set(0, 0.5);
      label.position.set(x + (side === 'attacker' ? 9 : -9 - 12), y);
      this.#units.addChild(icon, label);
      this.#anchors.set(`${side}:${unit.kind}`, { x, y });
    });
  }

  #drawBeams(view: BattleView): void {
    const g = this.#beamGraphics;
    g.clear();
    for (const beam of view.beams) {
      const from = this.#anchors.get(`${beam.from}:${beam.fromKind}`);
      const to = this.#anchors.get(
        `${beam.from === 'attacker' ? 'defender' : 'attacker'}:${beam.toKind}`,
      );
      if (!from || !to) continue;
      const color = KIND_COLOR[beam.fromKind] ?? 0xffffff;
      g.moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: 1 + Math.min(3, beam.strength / 15), color, alpha: 0.55 });
    }
  }

  tick(timeMs: number): void {
    this.#beamGraphics.alpha = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(timeMs / 180));
  }
}

export class BattleLayer {
  readonly view = new Container();
  readonly #sprites = new Map<number, BattleSprite>();

  update(battles: readonly BattleView[]): void {
    const alive = new Set<number>();
    for (const battle of battles) {
      alive.add(battle.id);
      let sprite = this.#sprites.get(battle.id);
      if (!sprite) {
        sprite = new BattleSprite(battle.id);
        this.#sprites.set(battle.id, sprite);
        this.view.addChild(sprite);
      }
      sprite.update(battle);
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
}
