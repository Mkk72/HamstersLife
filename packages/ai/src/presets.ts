/**
 * Пресеты сложности бота. Лёгкий — тренировочный: только нейтралы, без
 * снабжения и без давления; средний — аккуратные атаки; тяжёлый — контр-состав
 * и постоянное снабжение.
 */
import type { SimpleBotOptions } from './simpleBot';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotPreset {
  readonly label: string;
  readonly intervalMs: number;
  readonly options: SimpleBotOptions;
}

export const BOT_PRESETS: Readonly<Record<BotDifficulty, BotPreset>> = {
  easy: {
    label: 'Лёгкий',
    intervalMs: 1000,
    options: {
      decideEveryTicks: 20,
      attackMargin: 1.5,
      attackRatio: 50,
      useSupply: false,
      targetPlayers: false,
      templateId: 'swords-archers',
      adaptTemplate: false,
    },
  },
  normal: {
    label: 'Обычный',
    intervalMs: 500,
    options: {
      decideEveryTicks: 10,
      attackMargin: 1.25,
      attackRatio: 75,
      useSupply: true,
      targetPlayers: true,
      templateId: 'balanced',
      adaptTemplate: false,
    },
  },
  hard: {
    label: 'Сложный',
    intervalMs: 300,
    options: {
      decideEveryTicks: 5,
      attackMargin: 1.1,
      attackRatio: 100,
      useSupply: true,
      targetPlayers: true,
      templateId: 'balanced',
      adaptTemplate: true,
    },
  },
};

export const DEFAULT_DIFFICULTY: BotDifficulty = 'easy';
