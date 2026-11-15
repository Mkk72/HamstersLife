/**
 * Повтор матча: seed, версии и лента принятых команд с номерами тиков.
 *
 * Повтор не хранит состояние — только вход. Если правила или данные изменились,
 * повтор честно не воспроизводится: `validateReplay` сообщает об этом, а не
 * подгоняет результат.
 */
import type { Balance, Command, GameState } from './types';
import { applyCommand } from './commands';
import { runTicks } from './tick';

export interface ReplayCommand {
  /** Тик, на котором команда была принята. */
  readonly tick: number;
  readonly command: Command;
}

export interface MatchReplay {
  readonly rulesVersion: number;
  readonly contentVersion: number;
  readonly seed: number;
  readonly mapName: string;
  readonly commands: readonly ReplayCommand[];
}

/** Ошибки несовместимости; пустой массив — повтор можно проигрывать. */
export function validateReplay(replay: MatchReplay, balance: Balance): string[] {
  const errors: string[] = [];
  if (replay.rulesVersion !== balance.rulesVersion) {
    errors.push(
      `Повтор снят на версии правил ${replay.rulesVersion}, сейчас ${balance.rulesVersion}`,
    );
  }
  if (replay.contentVersion !== balance.contentVersion) {
    errors.push(
      `Повтор снят на версии данных ${replay.contentVersion}, сейчас ${balance.contentVersion}`,
    );
  }
  let previousTick = -1;
  for (const entry of replay.commands) {
    if (entry.tick < previousTick) errors.push('Команды в повторе идут не по порядку тиков');
    previousTick = entry.tick;
  }
  return errors;
}

/**
 * Проиграть ленту команд на состоянии: команды применяются перед шагом того
 * тика, на котором были приняты. Функция чистая по отношению к ленте — состояние
 * меняется только через `applyCommand` и `runTicks`.
 */
export function applyReplay(state: GameState, balance: Balance, commands: readonly ReplayCommand[]): void {
  let index = 0;
  while (index < commands.length) {
    const entry = commands[index];
    if (!entry) break;
    const current = state.tick;
    if (entry.tick > current) {
      runTicks(state, balance, entry.tick - current);
      continue;
    }
    applyCommand(state, entry.command, balance);
    index += 1;
  }
}
