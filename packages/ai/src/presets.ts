/**
 * Пресеты сложности бота. Лёгкий — честный, но неторопливый: без тренировки,
 * без бустов, решения раз в секунду и только нейтралы в приоритете. Так игрок
 * успевает освоиться и выиграть, не глядя на «бешеную генерацию».
 */
import type { SimpleBotOptions } from './simpleBot';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotPreset {
  readonly label: string;
  /** Интервал решений в миллисекундах. */
  readonly intervalMs: number;
  readonly options: SimpleBotOptions;
}

export const BOT_PRESETS: Readonly<Record<BotDifficulty, BotPreset>> = {
  easy: {
    label: 'Лёгкий',
    intervalMs: 1000,
    options: {
      decideEveryTicks: 20,
      minAttackGarrison: 8000,
      attackMargin: 1.5,
      attackRatio: 50,
      useBoosts: false,
      useTraining: false,
      targetPlayers: false,
    },
  },
  normal: {
    label: 'Обычный',
    intervalMs: 500,
    options: {
      decideEveryTicks: 10,
      minAttackGarrison: 5000,
      attackMargin: 1.15,
      attackRatio: 75,
      useBoosts: true,
      useTraining: true,
      targetPlayers: true,
    },
  },
  hard: {
    label: 'Сложный',
    intervalMs: 300,
    options: {
      decideEveryTicks: 5,
      minAttackGarrison: 4000,
      attackMargin: 1.1,
      attackRatio: 100,
      useBoosts: true,
      useTraining: true,
      targetPlayers: true,
    },
  },
};

export const DEFAULT_DIFFICULTY: BotDifficulty = 'easy';
