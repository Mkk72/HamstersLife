/**
 * Раннер бота: раз в интервал спрашивает у бота команды и отправляет их в
 * источник состояния. Бот не знает, локальная это игра или сетевая, а клиент
 * не знает, как бот думает.
 */
import { evaluateOutcome } from '@hamsters/core';
import type { Bot, PlayerId, Scheduler, SimSource } from '@hamsters/core';

const DEFAULT_INTERVAL_MS = 500;

export class BotRunner {
  readonly #source: SimSource;
  readonly #bot: Bot;
  readonly #playerId: PlayerId;
  readonly #scheduler: Scheduler;
  readonly #intervalMs: number;
  #cancel: (() => void) | null = null;

  constructor(
    source: SimSource,
    bot: Bot,
    playerId: PlayerId,
    scheduler: Scheduler,
    intervalMs = DEFAULT_INTERVAL_MS,
  ) {
    this.#source = source;
    this.#bot = bot;
    this.#playerId = playerId;
    this.#scheduler = scheduler;
    this.#intervalMs = intervalMs;
  }

  start(): void {
    this.stop();
    this.#cancel = this.#scheduler.every(this.#intervalMs, () => this.decide());
  }

  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
  }

  /** Один шаг бота: вынесен отдельно, чтобы тест не ждал таймер. */
  decide(): void {
    const state = this.#source.getSnapshot();
    if (evaluateOutcome(state).finished) return;
    for (const command of this.#bot.decide(state, this.#playerId)) {
      this.#source.sendCommand(command);
    }
  }
}
