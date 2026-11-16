import type { Ratio, UnitKind } from '@hamsters/core';
import { BOT_PRESETS } from '@hamsters/ai';
import type { BotDifficulty } from '@hamsters/ai';
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
  readonly difficulty: () => BotDifficulty;
  readonly started: () => boolean;
  readonly audioEnabled: () => boolean;
  readonly speed: () => number;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onQuality: (quality: QualityLevel) => void;
  readonly onMap: (choice: string) => void;
  readonly onDifficulty: (difficulty: BotDifficulty) => void;
  readonly onSpeed: (speed: number) => void;
  readonly onTogglePause: () => void;
  readonly onStart: () => void;
  readonly onAudio: (enabled: boolean) => void;
  readonly onRestart: () => void;
  readonly onDownloadReplay: () => void;
  readonly onPlanDelta: (kind: UnitKind, delta: number) => void;
  readonly onPlanSet: (kind: UnitKind, value: number) => void;
  readonly onResetPlan: () => void;
  readonly onUndoReset: () => void;
  readonly onTemplate: (templateId: string) => void;
  readonly onToggleSupply: (routeId: number) => void;
}

export function App(props: AppProps) {
  const [fps, setFps] = createSignal(0);
  const sample = (): void => {
    setFps(Math.round(props.app.ticker.FPS));
  };
  props.app.ticker.add(sample);
  onCleanup(() => props.app.ticker.remove(sample));

  return (
    <Show
      when={props.started()}
      fallback={
        <MainMenu
          mapChoice={props.mapChoice}
          difficulty={props.difficulty}
          onMap={props.onMap}
          onDifficulty={props.onDifficulty}
          onStart={props.onStart}
        />
      }
    >
      <GameHud
        board={props.board}
        ratio={props.ratio}
        quality={props.quality}
        fps={fps}
        mapChoice={props.mapChoice}
        difficulty={() => BOT_PRESETS[props.difficulty()].label}
        audioEnabled={props.audioEnabled}
        speed={props.speed}
        onRatio={props.onRatio}
        onQuality={props.onQuality}
        onMap={props.onMap}
        onSpeed={props.onSpeed}
        onTogglePause={props.onTogglePause}
        onAudio={props.onAudio}
        onRestart={props.onRestart}
        onDownloadReplay={props.onDownloadReplay}
        onPlanDelta={props.onPlanDelta}
        onPlanSet={props.onPlanSet}
        onResetPlan={props.onResetPlan}
        onUndoReset={props.onUndoReset}
        onTemplate={props.onTemplate}
        onToggleSupply={props.onToggleSupply}
      />
      <Show when={props.board()?.hud.outcome}>
        {(outcome) => <OutcomeOverlay outcome={outcome()} onRestart={props.onRestart} />}
      </Show>
    </Show>
  );
}

