/**
 * Порты (интерфейсы) между слоями. Ядро не знает, кто его вызывает: тест,
 * локальная симуляция в браузере, Worker или сервер. Каждая зависимость
 * приходит снаружи и в тестах подменяется.
 */
import type { Balance, Command, CommandResult, GameState, MapDefinition, PlayerId } from './types';

/** Источник данных: баланс и карты. Реализация — пакет `@hamsters/content`. */
export interface ContentProvider {
  readonly balance: Balance;
  readonly defaultMapName: string;
  getMap(name: string): MapDefinition;
}

/**
 * Источник состояния для презентера. Не важно, где считается игра: в этом же
 * потоке, в Worker или на сервере, — презентер видит только этот интерфейс.
 */
export interface SimSource {
  getSnapshot(): GameState;
  sendCommand(command: Command): CommandResult;
  start(onTick: (snapshot: GameState) => void): void;
  stop(): void;
  /** Скорость игры: 0 — пауза, 1 — обычная, 2 — вдвое быстрее. */
  setSpeed(speed: number): void;
}

/** Планировщик времени: браузерный rAF/интервал или ручной в тестах. */
export interface Scheduler {
  /** Вызывать callback каждые `intervalMs`; вернуть функцию отмены. */
  every(intervalMs: number, callback: () => void): () => void;
}

/** Бот: чистая функция «состояние → команды». Скрытое состояние не читает. */
export interface Bot {
  readonly name: string;
  decide(state: Readonly<GameState>, playerId: PlayerId): readonly Command[];
}
