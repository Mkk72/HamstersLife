/**
 * Обёртка источника состояния, которая записывает принятые команды. Работает
 * с любой реализацией `SimSource` (локальной или сетевой), а презентер о записи
 * не знает.
 */
import type { Command, CommandResult, GameState, SimSource } from '@hamsters/core';
import type { MatchRecorder } from './matchRecorder';

export class RecordingSimSource implements SimSource {
  readonly #source: SimSource;
  readonly #recorder: MatchRecorder;

  constructor(source: SimSource, recorder: MatchRecorder) {
    this.#source = source;
    this.#recorder = recorder;
  }

  getSnapshot(): GameState {
    return this.#source.getSnapshot();
  }

  start(onTick: (snapshot: GameState) => void): void {
    this.#source.start(onTick);
  }

  stop(): void {
    this.#source.stop();
  }

  setSpeed(speed: number): void {
    this.#source.setSpeed(speed);
  }

  sendCommand(command: Command): CommandResult {
    const result = this.#source.sendCommand(command);
    if (result.ok) {
      this.#recorder.record(this.#source.getSnapshot().tick, command);
    }
    return result;
  }
}
