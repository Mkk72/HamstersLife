/**
 * Клавиатура: доли 1–4, бусты Q/W/E. Раскладка собрана таблицей, поэтому
 * добавление горячей клавиши — одна строка, а не ветка в обработчике.
 */
import type { BoostKind, Ratio } from '@hamsters/core';
import type { GamePresenter } from '../presenter/gamePresenter';

const RATIO_KEYS: Readonly<Record<string, Ratio>> = {
  '1': 25,
  '2': 50,
  '3': 75,
  '4': 100,
};

const BOOST_KEYS: Readonly<Record<string, BoostKind>> = {
  q: 'production',
  w: 'speed',
  e: 'defense',
  й: 'production',
  ц: 'speed',
  у: 'defense',
};

export class KeyboardInput {
  readonly #presenter: () => GamePresenter | null;
  readonly #onRatio: (ratio: Ratio) => void;

  constructor(presenter: () => GamePresenter | null, onRatio: (ratio: Ratio) => void) {
    this.#presenter = presenter;
    this.#onRatio = onRatio;
  }

  attach(): void {
    window.addEventListener('keydown', this.#onKeyDown);
  }

  detach(): void {
    window.removeEventListener('keydown', this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const presenter = this.#presenter();
    if (!presenter) return;
    const key = event.key.toLowerCase();

    const ratio = RATIO_KEYS[key];
    if (ratio !== undefined) {
      presenter.setRatio(ratio);
      this.#onRatio(ratio);
      return;
    }

    const boost = BOOST_KEYS[key];
    if (boost !== undefined) presenter.applyBoost(boost);
  };
}
