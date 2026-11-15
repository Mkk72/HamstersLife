/**
 * Запись матча: только вход, без состояния. Повтор — это `seed` + версии +
 * лента принятых команд с тиками. Хранится в килобайтах, воспроизводится ядром.
 */
import type { Command, MatchReplay, ReplayCommand } from '@hamsters/core';

export interface RecorderMeta {
  readonly rulesVersion: number;
  readonly contentVersion: number;
  readonly seed: number;
  readonly mapName: string;
}

export class MatchRecorder {
  readonly #meta: RecorderMeta;
  readonly #commands: ReplayCommand[] = [];

  constructor(meta: RecorderMeta) {
    this.#meta = meta;
  }

  record(tick: number, command: Command): void {
    this.#commands.push({ tick, command });
  }

  get size(): number {
    return this.#commands.length;
  }

  toReplay(): MatchReplay {
    return { ...this.#meta, commands: [...this.#commands] };
  }

  toJson(): string {
    return JSON.stringify(this.toReplay(), null, 2);
  }
}
