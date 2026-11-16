/**
 * Клавиатура: доли 1–4, пауза — пробел, скорость — [ и ].
 */
import type { Ratio } from '@hamsters/core';
import type { GamePresenter } from '../presenter/gamePresenter';
import { stepSpeed } from '../ui/speeds';

const RATIO_KEYS: Readonly<Record<string, Ratio>> = {
  '1': 25,
  '2': 50,
  '3': 75,
  '4': 100,
};

export interface KeyboardInputOptions {
  readonly presenter: () => GamePresenter | null;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onSpeed: (speed: number) => void;
  readonly onTogglePause: () => void;
}

export class KeyboardInput {
  readonly #options: KeyboardInputOptions;

  constructor(options: KeyboardInputOptions) {
    this.#options = options;
  }

  attach(): void {
    window.addEventListener('keydown', this.#onKeyDown);
  }

  detach(): void {
    window.removeEventListener('keydown', this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const presenter = this.#options.presenter();
    if (!presenter) return;

    if (event.code === 'Space') {
      event.preventDefault();
      this.#options.onTogglePause();
      return;
    }

    if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
      const direction = event.code === 'BracketRight' ? 1 : -1;
      this.#options.onSpeed(stepSpeed(presenter.speed, direction));
      return;
    }

    const key = event.key.toLowerCase();
    const ratio = RATIO_KEYS[key];
    if (ratio !== undefined) {
      presenter.setRatio(ratio);
      this.#options.onRatio(ratio);
    }
  };
}
