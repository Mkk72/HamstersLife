import { CONTENT, getMap } from '@hamsters/content';
import { SimpleBot } from '@hamsters/ai';
import { Simulation } from '@hamsters/core';
import type { BoostKind, Ratio } from '@hamsters/core';
import { Application } from 'pixi.js';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { BotRunner } from './ai/botRunner';
import { KeyboardInput } from './input/keyboardInput';
import { PointerInput } from './input/pointerInput';
import { GamePresenter } from './presenter/gamePresenter';
import type { BoardView, QualityLevel } from './presenter/viewModel';
import { GameScene } from './render/gameScene';
import { THEME } from './render/theme';
import { LocalSimSource } from './sim/localSimSource';
import { BrowserScheduler } from './sim/scheduler';
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

const scene = new GameScene(app, CONTENT, { onBoard: (view) => setBoard(view) });

let presenter: GamePresenter | null = null;
let botRunner: BotRunner | null = null;
let matchCounter = 0;

function startMatch(): void {
  presenter?.stop();
  botRunner?.stop();
  matchCounter += 1;
  const sim = new Simulation(getMap(CONTENT.defaultMapName), CONTENT.balance, matchCounter * 7919);
  const source = new LocalSimSource(sim, new BrowserScheduler());
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

render(
  () => (
    <App
      app={app}
      board={board}
      ratio={ratio}
      quality={quality}
      onRatio={(value) => {
        setRatio(value);
        presenter?.setRatio(value);
      }}
      onBoost={(kind: BoostKind) => presenter?.applyBoost(kind)}
      onQuality={(value) => {
        setQuality(value);
        presenter?.setQuality(value);
      }}
      onRestart={startMatch}
    />
  ),
  host,
);

startMatch();
