/**
 * Класс партии: состояние + баланс + операции над ними.
 *
 * Зачем класс, а не набор функций: клиенту, боту и тестам нужен один объект с
 * понятным жизненным циклом (`applyCommand`, `step`, `hash`), куда баланс и
 * карта приходят снаружи. Так партию можно создать в тесте без окна, без
 * файлов и без сети.
 */
import { hashState } from './hash';
import { applyCommand } from './commands';
import { createGameState } from './state';
import { evaluateOutcome, runTicks, step } from './tick';
import type { Outcome } from './tick';
import type { Balance, Command, CommandResult, GameState, MapDefinition } from './types';

export class Simulation {
  readonly balance: Balance;
  readonly map: MapDefinition;
  readonly seed: number;
  #state: GameState;

  constructor(map: MapDefinition, balance: Balance, seed: number) {
    this.map = map;
    this.balance = balance;
    this.seed = seed;
    this.#state = createGameState(map, balance, seed);
  }

  /** Текущее состояние. Читать можно, менять — только через команды и step. */
  get state(): GameState {
    return this.#state;
  }

  get tick(): number {
    return this.#state.tick;
  }

  applyCommand(command: Command): CommandResult {
    return applyCommand(this.#state, command, this.balance);
  }

  step(): void {
    step(this.#state, this.balance);
  }

  advance(ticks: number): void {
    runTicks(this.#state, this.balance, ticks);
  }

  hash(): number {
    return hashState(this.#state);
  }

  outcome(): Outcome {
    return evaluateOutcome(this.#state);
  }
}
