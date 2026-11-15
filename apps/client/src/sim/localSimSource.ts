/**
 * Локальная симуляция в браузере: тот же `Simulation`, что и в тестах, но
 * время двигает планировщик. Позже эту реализацию заменит Worker-источник —
 * презентер разницы не заметит, потому что работает через `SimSource`.
 */
import type { Command, CommandResult, GameState, SimSource, Scheduler } from '@hamsters/core';
import { MS_PER_TICK } from '@hamsters/core';
import type { Simulation } from '@hamsters/core';

export class LocalSimSource implements SimSource {
  readonly #sim: Simulation;
  readonly #scheduler: Scheduler;
  #listener: ((snapshot: GameState) => void) | null = null;
  #cancel: (() => void) | null = null;

  constructor(sim: Simulation, scheduler: Scheduler) {
    this.#sim = sim;
    this.#scheduler = scheduler;
  }

  get simulation(): Simulation {
    return this.#sim;
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
    this.#cancel?.();
    this.#cancel = this.#scheduler.every(MS_PER_TICK, () => {
      this.#sim.step();
      this.#emit();
    });
    this.#emit();
  }

  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
    this.#listener = null;
  }

  #emit(): void {
    this.#listener?.(this.#sim.state);
  }
}
