/**
 * Локальная симуляция в браузере: тот же `Simulation`, что и в тестах, но
 * время двигает планировщик. Скорость игры — множитель частоты тиков:
 * 0 — пауза, 1 — обычная, 2 — вдвое быстрее.
 */
import type { Command, CommandResult, GameState, SimSource, Scheduler } from '@hamsters/core';
import { MS_PER_TICK } from '@hamsters/core';
import type { Simulation } from '@hamsters/core';

export class LocalSimSource implements SimSource {
  readonly #sim: Simulation;
  readonly #scheduler: Scheduler;
  #listener: ((snapshot: GameState) => void) | null = null;
  #cancel: (() => void) | null = null;
  #speed = 1;

  constructor(sim: Simulation, scheduler: Scheduler) {
    this.#sim = sim;
    this.#scheduler = scheduler;
  }

  get simulation(): Simulation {
    return this.#sim;
  }

  get speed(): number {
    return this.#speed;
  }

  getSnapshot(): GameState {
    return this.#sim.state;
  }

  sendCommand(command: Command): CommandResult {
    const result = this.#sim.applyCommand(command);
    if (result.ok) this.#emit();
    return result;
  }

  start(onTick: (snapshot: GameState) => void): void {
    this.#listener = onTick;
    this.#reschedule();
    this.#emit();
  }

  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
    this.#listener = null;
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
    if (!this.#listener) return;
    this.#reschedule();
  }

  #reschedule(): void {
    this.#cancel?.();
    this.#cancel = null;
    if (!this.#listener) return;
    const interval = MS_PER_TICK / this.#speed;
    if (!Number.isFinite(interval) || interval <= 0) return; // пауза
    this.#cancel = this.#scheduler.every(interval, () => {
      this.#sim.step();
      this.#emit();
    });
  }

  #emit(): void {
    this.#listener?.(this.#sim.state);
  }
}
