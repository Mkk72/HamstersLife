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

const params = new URLSearchParams(window.location.search);

const [board, setBoard] = createSignal<BoardView | null>(null);
const [ratio, setRatio] = createSignal<Ratio>(50);
const [quality, setQuality] = createSignal<QualityLevel>('high');
const [mapChoice, setMapChoice] = createSignal(params.get('map') ?? 'arena-duel');
const [started, setStarted] = createSignal(false);
const [audioEnabled, setAudioEnabled] = createSignal(true);
const [speed, setSpeed] = createSignal(1);

const scene = new GameScene(app, getMap(CONTENT.defaultMapName), {
  onBoard: (view) => setBoard(view),
});

// Флаги для проверок: ?worker=1 — считать в Worker, ?stress=1 — карта на 40 планет
// и 300 флотов в полёте (дымовая проверка бюджета кадра).
const useWorker = params.has('worker');
const stressMode = params.has('stress');

let presenter: GamePresenter | null = null;
let bots: BotRunner[] = [];
let recorder: MatchRecorder | null = null;
let matchCounter = 0;

function mapFor(choice: string, seed: number): MapDefinition {
  if (choice === 'three') return generateDuelMap(seed, { playerCount: 4 });
  if (stressMode) return generateDuelMap(seed, { neutralPairs: 18 });
  return choice === 'random' ? generateDuelMap(seed) : getMap(CONTENT.defaultMapName);
}

/** Нагрузочный режим: 300 флотов в полёте, чтобы проверить отрисовку глазами. */
function injectStressFleets(sim: Simulation): void {
  const planets = sim.state.planets;
  if (planets.length === 0) return;
  for (let index = 0; index < 300; index += 1) {
    const from = planets[index % planets.length];
    const to = planets[(index * 7 + 3) % planets.length];
    if (!from || !to) continue;
    sim.state.fleets.push({
      id: 100_000 + index,
      ownerId: index % 2,
      fromPlanetId: from.id,
      toPlanetId: to.id,
      troops: 500,
      departTick: 0,
      arriveTick: 1_000_000,
    });
  }
}

function startMatch(choice: string = mapChoice()): void {
  presenter?.stop();
  for (const bot of bots) bot.stop();
  bots = [];
  matchCounter += 1;
  const seed = matchCounter * 7919 + (Date.now() % 1000);
  const map = mapFor(choice, seed);
  scene.setMap(map);

  const sim = new Simulation(map, CONTENT.balance, seed);
  if (stressMode && !useWorker) injectStressFleets(sim);
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
  presenter.setSpeed(speed());
  presenter.start();

  for (let playerId = 1; playerId < map.playerCount; playerId += 1) {
    const runner = new BotRunner(
      source,
      new SimpleBot(CONTENT.balance),
      playerId,
      new BrowserScheduler(),
    );
    runner.setSpeed(speed());
    runner.start();
    bots.push(runner);
  }
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
      speed={speed}
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
      onSpeed={(value) => {
        setSpeed(value);
        presenter?.setSpeed(value);
        for (const bot of bots) bot.setSpeed(value);
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
