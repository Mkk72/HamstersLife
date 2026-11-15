/**
 * Раннер бота: раз в интервал спрашивает у бота команды и отправляет их в
 * источник состояния. Интервал масштабируется скоростью игры, чтобы при
 * замедлении бот не «обгонял» время и не решал чаще игрока.
 */
import { evaluateOutcome } from '@hamsters/core';
import type { Bot, PlayerId, Scheduler, SimSource } from '@hamsters/core';

const BASE_INTERVAL_MS = 500;

export class BotRunner {
  readonly #source: SimSource;
  readonly #bot: Bot;
  readonly #playerId: PlayerId;
  readonly #scheduler: Scheduler;
  readonly #baseIntervalMs: number;
  #cancel: (() => void) | null = null;
  #speed = 1;

  constructor(
    source: SimSource,
    bot: Bot,
    playerId: PlayerId,
    scheduler: Scheduler,
    intervalMs = BASE_INTERVAL_MS,
  ) {
    this.#source = source;
    this.#bot = bot;
    this.#playerId = playerId;
    this.#scheduler = scheduler;
    this.#baseIntervalMs = intervalMs;
  }

  start(): void {
    this.#cancel?.();
    this.#cancel = null;
    const interval = this.#baseIntervalMs / this.#speed;
    if (!Number.isFinite(interval) || interval <= 0) return; // пауза
    this.#cancel = this.#scheduler.every(interval, () => this.decide());
  }

  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
    this.start();
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
