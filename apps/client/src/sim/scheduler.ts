/**
 * Планировщики. Браузерный — на setInterval; ручной — для тестов, где время
 * двигает сам тест, а не реальные миллисекунды.
 */
import type { Scheduler } from '@hamsters/core';

export class BrowserScheduler implements Scheduler {
  every(intervalMs: number, callback: () => void): () => void {
    const handle = window.setInterval(callback, intervalMs);
    return () => window.clearInterval(handle);
  }
}

export class ManualScheduler implements Scheduler {
  #tasks: { intervalMs: number; callback: () => void; elapsed: number }[] = [];

  every(intervalMs: number, callback: () => void): () => void {
    const task = { intervalMs, callback, elapsed: 0 };
    this.#tasks.push(task);
    return () => {
      this.#tasks = this.#tasks.filter((candidate) => candidate !== task);
    };
  }

  /** Прокрутить время: выполняются задачи, у которых наступил интервал. */
  advance(ms: number): void {
    for (const task of this.#tasks) {
      task.elapsed += ms;
      while (task.elapsed >= task.intervalMs) {
        task.elapsed -= task.intervalMs;
        task.callback();
      }
    }
  }

  get active(): number {
    return this.#tasks.length;
  }
}
