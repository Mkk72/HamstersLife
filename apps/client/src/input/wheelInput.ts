/**
 * Колесо мыши меняет долю отправки, пока выбрана планета — привычный жест
 * жанра. Отдельный класс, чтобы ввод не разрастался в один «бог-обработчик».
 */
import type { Ratio } from '@hamsters/core';
import type { GamePresenter } from '../presenter/gamePresenter';

const RATIOS: readonly Ratio[] = [25, 50, 75, 100];

export class WheelInput {
  readonly #target: HTMLElement;
  readonly #presenter: () => GamePresenter | null;
  readonly #onRatio: (ratio: Ratio) => void;

  constructor(
    target: HTMLElement,
    presenter: () => GamePresenter | null,
    onRatio: (ratio: Ratio) => void,
  ) {
    this.#target = target;
    this.#presenter = presenter;
    this.#onRatio = onRatio;
  }

  attach(): void {
    this.#target.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  detach(): void {
    this.#target.removeEventListener('wheel', this.#onWheel);
  }

  #onWheel = (event: WheelEvent): void => {
    const presenter = this.#presenter();
    if (!presenter || presenter.selectedId === null) return;
    event.preventDefault();

    const index = RATIOS.indexOf(presenter.ratio);
    const step = event.deltaY > 0 ? 1 : -1;
    const next = RATIOS[(index + step + RATIOS.length) % RATIOS.length];
    if (next === undefined) return;
    presenter.setRatio(next);
    this.#onRatio(next);
  };
}
