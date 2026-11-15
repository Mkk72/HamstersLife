/**
 * Сцена: единственное место, где правила встречаются с Pixi. Сцена реализует
 * интерфейс вида (`GameView`), поэтому презентер не знает ни о Pixi, ни о
 * масштабе карты. Слои (фон, планеты, флоты, эффекты) — отдельные классы.
 */
import type { MapDefinition } from '@hamsters/core';
import type { BoostKind, PlanetId } from '@hamsters/core';
import { Application, Container } from 'pixi.js';
import { Sfx } from '../audio/sfx';
import type { BoardView, GameView, QualityLevel } from '../presenter/viewModel';
import { ArrowLayer } from './arrowLayer';
import { EffectsLayer } from './effectsLayer';
import { FleetLayer } from './fleetLayer';
import { PlanetLayer } from './planetLayer';
import { Starfield } from './starfield';
import { WORLD_PADDING, colorForOwner } from './theme';

export interface GameSceneOptions {
  /** Вызывается после каждой отрисовки — для HUD на Solid. */
  readonly onBoard?: (view: BoardView) => void;
}

interface Pulse {
  readonly planetId: PlanetId;
  readonly until: number;
}

export class GameScene implements GameView {
  readonly app: Application;
  /** Мир карты: масштабируется и центрируется под экран. */
  readonly world = new Container();

  readonly #planetLayer = new PlanetLayer();
  readonly #fleetLayer = new FleetLayer();
  readonly #arrowLayer = new ArrowLayer();
  readonly #effectsLayer = new EffectsLayer();
  readonly #starfield: Starfield;
  readonly #sfx = new Sfx();
  #mapWidth: number;
  #mapHeight: number;
  readonly #onBoard: ((view: BoardView) => void) | undefined;
  #quality: QualityLevel = 'high';
  #pulses: Pulse[] = [];
  #board: BoardView | null = null;
  #baseX = 0;
  #baseY = 0;
  #shakeUntil = 0;

  constructor(app: Application, map: MapDefinition, options: GameSceneOptions = {}) {
    this.app = app;
    this.#mapWidth = map.width;
    this.#mapHeight = map.height;
    this.#onBoard = options.onBoard;
    this.#starfield = new Starfield(app.renderer.width, app.renderer.height, 2024);

    app.stage.addChild(this.#starfield.view, this.world);
    this.world.addChild(
      this.#arrowLayer.view,
      this.#planetLayer.view,
      this.#fleetLayer.view,
      this.#effectsLayer.view,
    );

    this.fit();

    window.addEventListener('resize', () => {
      this.#starfield.resize(app.renderer.width, app.renderer.height);
      this.fit();
    });

    app.ticker.add(() => {
      const time = app.ticker.lastTime;
      this.#planetLayer.tick(time);
      this.#fleetLayer.tick(app.ticker.deltaMS);
      this.#effectsLayer.tick(app.ticker.deltaMS);
      this.#tickPulses(time);
      this.#applyShake(time);
    });
  }

  /** Сменить карту перед новым матчем: пересчитывает масштаб. */
  setMap(map: MapDefinition): void {
    this.#mapWidth = map.width;
    this.#mapHeight = map.height;
    this.fit();
  }

  /** Разбудить звук — вызывать на первом действии пользователя. */
  unlockAudio(): void {
    this.#sfx.ensure();
  }

  render(view: BoardView): void {
    this.#board = view;
    this.#arrowLayer.update(view.arrows);
    this.#planetLayer.update(view.planets);
    this.#fleetLayer.update(view.fleets);
    this.#onBoard?.(view);
  }

  setQuality(level: QualityLevel): void {
    this.#quality = level;
    this.#starfield.setQuality(level);
  }

  get quality(): QualityLevel {
    return this.#quality;
  }

  playCapture(planetId: PlanetId): void {
    this.#pulses.push({ planetId, until: this.app.ticker.lastTime + 260 });
    const sprite = this.#planetLayer.sprite(planetId);
    if (sprite) {
      const planet = this.#board?.planets.find((item) => item.id === planetId);
      const color = planet ? colorForOwner(planet.ownerId) : 0xffffff;
      this.#effectsLayer.burst(sprite.x, sprite.y, color);
    }
    this.#sfx.capture();
    this.#shakeUntil = this.app.ticker.lastTime + 180;
  }

  playBoost(planetId: PlanetId, _kind: BoostKind): void {
    this.#pulses.push({ planetId, until: this.app.ticker.lastTime + 160 });
    this.#sfx.boost();
  }

  playSend(): void {
    this.#sfx.send();
  }

  /** Планета под экранной точкой — для ввода. */
  hitTest(screenX: number, screenY: number): PlanetId | null {
    const point = this.world.toLocal({ x: screenX, y: screenY });
    return this.#planetLayer.hitTest(point.x, point.y);
  }

  get board(): BoardView | null {
    return this.#board;
  }

  private fit(): void {
    const width = this.app.renderer.width;
    const height = this.app.renderer.height;
    const scale = Math.min(
      (width - WORLD_PADDING * 2) / this.#mapWidth,
      (height - WORLD_PADDING * 2) / this.#mapHeight,
    );
    this.world.scale.set(scale);
    this.#baseX = (width - this.#mapWidth * scale) / 2;
    this.#baseY = (height - this.#mapHeight * scale) / 2;
    this.world.position.set(this.#baseX, this.#baseY);
  }

  #applyShake(time: number): void {
    if (time >= this.#shakeUntil) {
      this.world.position.set(this.#baseX, this.#baseY);
      return;
    }
    const power = 3;
    this.world.position.set(
      this.#baseX + (Math.random() - 0.5) * power,
      this.#baseY + (Math.random() - 0.5) * power,
    );
  }

  #tickPulses(time: number): void {
    this.#pulses = this.#pulses.filter((pulse) => {
      const sprite = this.#planetLayer.sprite(pulse.planetId);
      if (!sprite) return false;
      if (time >= pulse.until) {
        sprite.scale.set(1);
        return false;
      }
      sprite.scale.set(1.08);
      return true;
    });
  }
}
