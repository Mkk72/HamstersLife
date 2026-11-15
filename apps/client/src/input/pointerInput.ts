/**
 * Ввод с мыши/тача. Класс только переводит координаты в попадание по планете
 * или маршруту и зовёт методы презентера — правил игры здесь нет.
 *
 * Левая кнопка: выбор планеты и протяжка стрелки (создание маршрута).
 * Правая кнопка: протяжка «ножом» — режет маршруты, по которым провели.
 */
import type { PlanetId } from '@hamsters/core';
import type { GamePresenter } from '../presenter/gamePresenter';

/** Минимум от сцены: что под точкой. */
export interface PlanetPicker {
  hitTest(screenX: number, screenY: number): PlanetId | null;
  hitTestRoute(screenX: number, screenY: number): number | null;
  /** Экранная точка → мир, чтобы стрелка тянулась за курсором. */
  toWorld(screenX: number, screenY: number): { x: number; y: number };
}

export class PointerInput {
  readonly #canvas: HTMLCanvasElement;
  readonly #picker: PlanetPicker;
  readonly #presenter: () => GamePresenter | null;
  #dragging = false;
  #cutting = false;
  #lastCutRoute: number | null = null;

  constructor(canvas: HTMLCanvasElement, picker: PlanetPicker, presenter: () => GamePresenter | null) {
    this.#canvas = canvas;
    this.#picker = picker;
    this.#presenter = presenter;
  }

  attach(): void {
    this.#canvas.addEventListener('pointerdown', this.#onDown);
    this.#canvas.addEventListener('contextmenu', this.#onContextMenu);
    window.addEventListener('pointermove', this.#onMove);
    window.addEventListener('pointerup', this.#onUp);
    window.addEventListener('pointercancel', this.#onUp);
  }

  detach(): void {
    this.#canvas.removeEventListener('pointerdown', this.#onDown);
    this.#canvas.removeEventListener('contextmenu', this.#onContextMenu);
    window.removeEventListener('pointermove', this.#onMove);
    window.removeEventListener('pointerup', this.#onUp);
    window.removeEventListener('pointercancel', this.#onUp);
  }

  #onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  #onDown = (event: PointerEvent): void => {
    const presenter = this.#presenter();
    if (!presenter) return;

    if (event.button === 2) {
      this.#cutting = true;
      this.#lastCutRoute = null;
      this.#tryCut(event.offsetX, event.offsetY);
      return;
    }

    const planetId = this.#picker.hitTest(event.offsetX, event.offsetY);
    if (planetId === null) {
      presenter.clearSelection();
      return;
    }
    this.#dragging = true;
    presenter.pointerDown(planetId, event.shiftKey);
    const point = this.#picker.toWorld(event.offsetX, event.offsetY);
    presenter.pointerMove(point.x, point.y, planetId);
  };

  #onMove = (event: PointerEvent): void => {
    const presenter = this.#presenter();
    if (!presenter) return;

    if (this.#cutting) {
      this.#tryCut(event.offsetX, event.offsetY);
      return;
    }

    const planetId = this.#picker.hitTest(event.offsetX, event.offsetY);
    const point = this.#picker.toWorld(event.offsetX, event.offsetY);
    presenter.pointerMove(point.x, point.y, planetId);
  };

  #onUp = (): void => {
    this.#cutting = false;
    this.#lastCutRoute = null;
    if (!this.#dragging) return;
    this.#dragging = false;
    this.#presenter()?.pointerUp();
  };

  #tryCut(x: number, y: number): void {
    const presenter = this.#presenter();
    if (!presenter) return;
    const routeId = this.#picker.hitTestRoute(x, y);
    if (routeId === null || routeId === this.#lastCutRoute) return;
    this.#lastCutRoute = routeId;
    presenter.cutRoute(routeId);
  }
}
