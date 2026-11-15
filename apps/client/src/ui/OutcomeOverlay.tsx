import type { OutcomeView } from '../presenter/viewModel';

export interface OutcomeOverlayProps {
  readonly outcome: OutcomeView;
  readonly onRestart: () => void;
}

/** Итог партии: одна строка результата и кнопка новой игры. */
export function OutcomeOverlay(props: OutcomeOverlayProps) {
  const title = (): string => {
    if (props.outcome.winnerId === null) return 'Ничья';
    return props.outcome.youWon ? 'Победа!' : 'Поражение';
  };

  const subtitle = (): string => {
    if (props.outcome.winnerId === null) return 'Все хомяки разбежались';
    return props.outcome.youWon ? 'Галактика твоя — на сегодня' : 'В другой раз повезёт';
  };

  return (
    <div class="overlay">
      <div class="overlay__card">
        <h1 class="overlay__title">{title()}</h1>
        <p class="overlay__subtitle">{subtitle()}</p>
        <button class="button button--primary" type="button" onClick={props.onRestart}>
          Ещё раз
        </button>
      </div>
    </div>
  );
}
