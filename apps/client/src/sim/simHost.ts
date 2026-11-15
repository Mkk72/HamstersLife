/**
 * Хост симуляции для Worker: принимает сообщения, отдаёт сообщения. Сам не
 * владеет таймером — тик приходит снаружи, поэтому хост тестируется в обычном
 * Node без Worker и без браузера.
 */
import { Simulation } from '@hamsters/core';
import type { Balance, GameState, MapDefinition } from '@hamsters/core';
import type { FromWorker, ToWorker } from './workerProtocol';

export class SimHost {
  #sim: Simulation;

  constructor(map: MapDefinition, balance: Balance, seed: number) {
    this.#sim = new Simulation(map, balance, seed);
  }

  get simulation(): Simulation {
    return this.#sim;
  }

  get state(): GameState {
    return this.#sim.state;
  }

  /** Обработать входящее сообщение; вернуть, что отправить обратно. */
  handle(message: ToWorker): FromWorker[] {
    switch (message.type) {
      case 'init':
        this.#sim = new Simulation(message.map, message.balance, message.seed);
        return [{ type: 'ready' }];
      case 'start':
        return [{ type: 'snapshot', state: this.#sim.state }];
      case 'stop':
        return [];
      case 'tick-request':
        return this.tick();
      case 'command':
        return [{ type: 'result', result: this.#sim.applyCommand(message.command) }];
    }
  }

  /** Один тик симуляции; отдаёт снимок для главного потока. */
  tick(): FromWorker[] {
    this.#sim.step();
    return [{ type: 'snapshot', state: this.#sim.state }];
  }
}
