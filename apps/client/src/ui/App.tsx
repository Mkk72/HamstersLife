import { createSignal, onCleanup } from 'solid-js';
import type { Application } from 'pixi.js';

/** Временная заглушка интерфейса: сцена, счётчик FPS, название. */
export function App(props: { app: Application }) {
  const [fps, setFps] = createSignal(0);
  let frames = 0;
  let last = performance.now();

  const sample = (): void => {
    frames += 1;
    const now = performance.now();
    if (now - last >= 500) {
      setFps(Math.round((frames * 1000) / (now - last)));
      frames = 0;
      last = now;
    }
  };

  props.app.ticker.add(sample);
  onCleanup(() => props.app.ticker.remove(sample));

  return (
    <>
      <div class="hud hud--top">
        <div class="fps">
          <span class="fps__value">{fps()}</span> FPS
        </div>
      </div>
      <div class="brand">
        Hamsters Life
        <span class="brand__stage">этап 0 · сцена</span>
      </div>
    </>
  );
}
