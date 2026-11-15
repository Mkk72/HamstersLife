import type { BoostKind, Ratio } from '@hamsters/core';
import { Show, createSignal, onCleanup } from 'solid-js';
import type { Application } from 'pixi.js';
import type { BoardView, QualityLevel } from '../presenter/viewModel';
import { GameHud } from './GameHud';
import { MainMenu } from './MainMenu';
import { OutcomeOverlay } from './OutcomeOverlay';

export interface AppProps {
  readonly app: Application;
  readonly board: () => BoardView | null;
  readonly ratio: () => Ratio;
  readonly quality: () => QualityLevel;
  readonly mapChoice: () => string;
  readonly started: () => boolean;
  readonly audioEnabled: () => boolean;
  readonly speed: () => number;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onBoost: (kind: BoostKind) => void;
  readonly onQuality: (quality: QualityLevel) => void;
  readonly onMap: (choice: string) => void;
  readonly onSpeed: (speed: number) => void;
  readonly onStart: () => void;
  readonly onAudio: (enabled: boolean) => void;
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
      <Show
        when={props.started()}
        fallback={
          <MainMenu mapChoice={props.mapChoice} onMap={props.onMap} onStart={props.onStart} />
        }
      >
        <GameHud
          board={props.board}
          ratio={props.ratio}
          quality={props.quality}
          fps={fps}
          mapChoice={props.mapChoice}
          audioEnabled={props.audioEnabled}
          speed={props.speed}
          onRatio={props.onRatio}
          onBoost={props.onBoost}
          onQuality={props.onQuality}
          onMap={props.onMap}
          onSpeed={props.onSpeed}
          onAudio={props.onAudio}
          onRestart={props.onRestart}
          onDownloadReplay={props.onDownloadReplay}
        />
        <Show when={props.board()?.hud.outcome}>
          {(outcome) => <OutcomeOverlay outcome={outcome()} onRestart={props.onRestart} />}
        </Show>
      </Show>
    </>
  );
}
