import { Application, Container } from 'pixi.js';
import { render } from 'solid-js/web';
import { Starfield } from './render/starfield';
import { THEME } from './render/theme';
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

const world = new Container();
app.stage.addChild(world);

const starfield = new Starfield(app.renderer.width, app.renderer.height, 2024);
world.addChild(starfield.view);
app.ticker.add(() => starfield.update(app.ticker.deltaMS));

window.addEventListener('resize', () => {
  starfield.resize(app.renderer.width, app.renderer.height);
});

render(() => <App app={app} />, host);
