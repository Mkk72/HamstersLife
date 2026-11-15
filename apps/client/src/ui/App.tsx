import type { BoostKind, Ratio } from '@hamsters/core';
import { Show, createSignal, onCleanup } from 'solid-js';
import type { Application } from 'pixi.js';
import type { BoardView, QualityLevel } from '../presenter/viewModel';
import { GameHud } from './GameHud';
import { OutcomeOverlay } from './OutcomeOverlay';

export interface AppProps {
  readonly app: Application;
  readonly board: () => BoardView | null;
  readonly ratio: () => Ratio;
  readonly quality: () => QualityLevel;
  readonly mapChoice: () => string;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onBoost: (kind: BoostKind) => void;
  readonly onQuality: (quality: QualityLevel) => void;
  readonly onMap: (choice: string) => void;
  readonly onRestart: () => void;
  readonly onDownloadReplay: () => void;
}

export function App(props: AppProps) {
  const [fps, setFps] = createSignal(0);

  const sample = (): void => {
    // Pixi сам считает FPS; не дублируем свою статистику.
    setFps(Math.round(props.app.ticker.FPS));
  };

  props.app.ticker.add(sample);
  onCleanup(() => props.app.ticker.remove(sample));

  return (
    <>
      <GameHud
        board={props.board}
        ratio={props.ratio}
        quality={props.quality}
        fps={fps}
        mapChoice={props.mapChoice}
        onRatio={props.onRatio}
        onBoost={props.onBoost}
        onQuality={props.onQuality}
        onMap={props.onMap}
        onRestart={props.onRestart}
        onDownloadReplay={props.onDownloadReplay}
      />
      <Show when={props.board()?.hud.outcome}>
        {(outcome) => <OutcomeOverlay outcome={outcome()} onRestart={props.onRestart} />}
      </Show>
    </>
  );
}
