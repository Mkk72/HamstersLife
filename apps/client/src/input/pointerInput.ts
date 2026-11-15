/**
 * Ввод с мыши/тача. Класс только переводит координаты в попадание по планете
 * и зовёт методы презентера — правил игры здесь нет.
 */
import type { PlanetId } from '@hamsters/core';
import type { GamePresenter } from '../presenter/gamePresenter';

/** Минимум от сцены: умеет сказать, какая планета под точкой. */
export interface PlanetPicker {
  hitTest(screenX: number, screenY: number): PlanetId | null;
}

export class PointerInput {
  readonly #canvas: HTMLCanvasElement;
  readonly #picker: PlanetPicker;
  readonly #presenter: () => GamePresenter | null;
  #dragging = false;

  constructor(canvas: HTMLCanvasElement, picker: PlanetPicker, presenter: () => GamePresenter | null) {
    this.#canvas = canvas;
    this.#picker = picker;
    this.#presenter = presenter;
  }

  attach(): void {
    this.#canvas.addEventListener('pointerdown', this.#onDown);
    window.addEventListener('pointermove', this.#onMove);
    window.addEventListener('pointerup', this.#onUp);
    window.addEventListener('pointercancel', this.#onUp);
  }

  detach(): void {
    this.#canvas.removeEventListener('pointerdown', this.#onDown);
    window.removeEventListener('pointermove', this.#onMove);
    window.removeEventListener('pointerup', this.#onUp);
    window.removeEventListener('pointercancel', this.#onUp);
  }

  #onDown = (event: PointerEvent): void => {
    const presenter = this.#presenter();
    if (!presenter) return;
    const planetId = this.#picker.hitTest(event.offsetX, event.offsetY);
    if (planetId === null) {
      presenter.clearSelection();
      return;
    }
    this.#dragging = true;
    presenter.pointerDown(planetId, event.shiftKey);
  };

  #onMove = (event: PointerEvent): void => {
    const presenter = this.#presenter();
    if (!presenter) return;
    const planetId = this.#picker.hitTest(event.offsetX, event.offsetY);
    presenter.pointerHover(planetId);
  };

  #onUp = (): void => {
    if (!this.#dragging) return;
    this.#dragging = false;
    this.#presenter()?.pointerUp();
  };
}
