import { CONTENT, getMap } from '@hamsters/content';
import { SimpleBot } from '@hamsters/ai';
import { Simulation } from '@hamsters/core';
import type { BoostKind, MapDefinition, Ratio } from '@hamsters/core';
import { generateDuelMap } from '@hamsters/levelgen';
import { Application } from 'pixi.js';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { BotRunner } from './ai/botRunner';
import { KeyboardInput } from './input/keyboardInput';
import { PointerInput } from './input/pointerInput';
import { WheelInput } from './input/wheelInput';
import { GamePresenter } from './presenter/gamePresenter';
import type { BoardView, QualityLevel } from './presenter/viewModel';
import { GameScene } from './render/gameScene';
import { THEME } from './render/theme';
import { MatchRecorder } from './replay/matchRecorder';
import { RecordingSimSource } from './replay/recordingSimSource';
import { LocalSimSource } from './sim/localSimSource';
import { BrowserScheduler } from './sim/scheduler';
import SimWorker from './sim/simWorker?worker';
import { WorkerSimSource } from './sim/workerSimSource';
import { App } from './ui/App';
import './styles.css';

const host = document.getElementById('app');
if (!host) throw new Error('Не найден контейнер #app');

const app = new Application();
await app.init({
  background: THEME.space,
  resizeTo: window,
  antialias: true,
  preference: 'webgpu',
  powerPreference: 'high-performance',
});
app.canvas.classList.add('scene');
host.appendChild(app.canvas);

const [board, setBoard] = createSignal<BoardView | null>(null);
const [ratio, setRatio] = createSignal<Ratio>(50);
const [quality, setQuality] = createSignal<QualityLevel>('high');
const [mapChoice, setMapChoice] = createSignal('arena-duel');
const [started, setStarted] = createSignal(false);
const [audioEnabled, setAudioEnabled] = createSignal(true);

const scene = new GameScene(app, getMap(CONTENT.defaultMapName), {
  onBoard: (view) => setBoard(view),
});

// Worker включается флагом ?worker=1: по умолчанию считаем в главном потоке,
// пока планет мало; переключение не меняет ни презентер, ни HUD.
const useWorker = new URLSearchParams(window.location.search).has('worker');

let presenter: GamePresenter | null = null;
let botRunner: BotRunner | null = null;
let recorder: MatchRecorder | null = null;
let matchCounter = 0;

function mapFor(choice: string, seed: number): MapDefinition {
  return choice === 'random' ? generateDuelMap(seed) : getMap(CONTENT.defaultMapName);
}

function startMatch(choice: string = mapChoice()): void {
  presenter?.stop();
  botRunner?.stop();
  matchCounter += 1;
  const seed = matchCounter * 7919 + (Date.now() % 1000);
  const map = mapFor(choice, seed);
  scene.setMap(map);

  const sim = new Simulation(map, CONTENT.balance, seed);
  recorder = new MatchRecorder({
    rulesVersion: CONTENT.balance.rulesVersion,
    contentVersion: CONTENT.balance.contentVersion,
    seed,
    mapName: map.name,
  });
  const source = new RecordingSimSource(
    useWorker
      ? new WorkerSimSource(map, CONTENT.balance, seed, { create: () => new SimWorker() })
      : new LocalSimSource(sim, new BrowserScheduler()),
    recorder,
  );

  presenter = new GamePresenter({
    sim: source,
    view: scene,
    content: CONTENT,
    humanPlayerId: 0,
    initialRatio: ratio(),
  });
  presenter.setQuality(quality());
  presenter.start();

  botRunner = new BotRunner(source, new SimpleBot(CONTENT.balance), 1, new BrowserScheduler());
  botRunner.start();
  setStarted(true);
}

function downloadReplay(): void {
  if (!recorder || recorder.size === 0) return;
  const blob = new Blob([recorder.toJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hamsters-replay-${recorder.toReplay().seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

const pointer = new PointerInput(app.canvas, scene, () => presenter);
pointer.attach();

// Браузер разрешает звук только после действия пользователя.
window.addEventListener('pointerdown', () => scene.unlockAudio(), { once: true });

const keyboard = new KeyboardInput(
  () => presenter,
  (value) => setRatio(value),
);
keyboard.attach();

const wheel = new WheelInput(app.canvas, () => presenter, (value) => setRatio(value));
wheel.attach();

render(
  () => (
    <App
      app={app}
      board={board}
      ratio={ratio}
      quality={quality}
      mapChoice={mapChoice}
      started={started}
      audioEnabled={audioEnabled}
      onRatio={(value) => {
        setRatio(value);
        presenter?.setRatio(value);
      }}
      onBoost={(kind: BoostKind) => presenter?.applyBoost(kind)}
      onQuality={(value) => {
        setQuality(value);
        presenter?.setQuality(value);
      }}
      onMap={(choice) => {
        setMapChoice(choice);
        // В меню выбор только запоминается; в игре — начинается новый матч.
        if (started()) startMatch(choice);
      }}
      onStart={() => {
        scene.unlockAudio();
        startMatch();
      }}
      onAudio={(value) => {
        setAudioEnabled(value);
        scene.setAudioEnabled(value);
      }}
      onRestart={() => startMatch()}
      onDownloadReplay={downloadReplay}
    />
  ),
  host,
);

// ?play=1 — сразу в бой: удобно для скриншотов и дымовых проверок.
if (new URLSearchParams(window.location.search).has('play')) startMatch();
