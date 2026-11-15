/**
 * Worker-обёртка вокруг хоста. Вся логика — в `SimHost`; здесь только связь с
 * потоком и таймер. Ошибки команд не бросают исключение: они уходят в
 * `onRejected`, потому что команда из главного потока уже отправлена («оптимистично»).
 */
import { MS_PER_TICK, createGameState } from '@hamsters/core';
import type {
  Balance,
  Command,
  CommandResult,
  GameState,
  MapDefinition,
  SimSource,
} from '@hamsters/core';
import type { FromWorker, ToWorker } from './workerProtocol';

export interface WorkerFactory {
  create(): Worker;
}

export class WorkerSimSource implements SimSource {
  readonly #worker: Worker;
  readonly #onRejected: ((result: CommandResult) => void) | undefined;
  #snapshot: GameState;
  #listener: ((snapshot: GameState) => void) | null = null;
  #timer: number | null = null;

  constructor(
    map: MapDefinition,
    balance: Balance,
    seed: number,
    factory: WorkerFactory,
    onRejected?: (result: CommandResult) => void,
  ) {
    this.#onRejected = onRejected;
    this.#snapshot = createGameState(map, balance, seed);
    this.#worker = factory.create();
    this.#worker.onmessage = (event: MessageEvent<FromWorker>) => this.#receive(event.data);
    this.#post({ type: 'init', map, balance, seed });
  }

  getSnapshot(): GameState {
    return this.#snapshot;
  }

  sendCommand(command: Command): CommandResult {
    // Результат придёт сообщением; для интерфейса команда уже принята.
    this.#post({ type: 'command', command });
    return { ok: true };
  }

  start(onTick: (snapshot: GameState) => void): void {
    this.#listener = onTick;
    this.#post({ type: 'start' });
    this.#timer ??= window.setInterval(() => this.#post({ type: 'tick-request' }), MS_PER_TICK);
  }

  stop(): void {
    this.#listener = null;
    if (this.#timer !== null) {
      window.clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#post({ type: 'stop' });
    this.#worker.terminate();
  }

  #post(message: ToWorker): void {
    this.#worker.postMessage(message);
  }

  #receive(message: FromWorker): void {
    if (message.type === 'snapshot') {
      this.#snapshot = message.state;
      this.#listener?.(message.state);
      return;
    }
    if (message.type === 'result' && !message.result.ok) {
      this.#onRejected?.(message.result);
    }
  }
}
