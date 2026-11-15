/**
 * Тестовый баланс. Числа — эталон для тестов ядра; рабочие значения живут в
 * пакете `@hamsters/content` и не должны расходиться с этими проверками по
 * смыслу (производство кратно 20, чтобы делиться на тики без дробей).
 */
import type { Balance } from '../types';

export const testBalance: Balance = {
  rulesVersion: 1,
  contentVersion: 1,
  planetSizes: {
    S: { capacity: 6000, productionPerSecond: 600 },
    M: { capacity: 12_000, productionPerSecond: 1000 },
    L: { capacity: 24_000, productionPerSecond: 1600 },
    XL: { capacity: 40_000, productionPerSecond: 2400 },
  },
  flightSpeedUnitsPerSecond: 100,
  seedsPerPlanetPerSecond: 4000,
  startingSeeds: 60_000,
  boosts: {
    production: { cost: 40_000, durationTicks: 300, cooldownTicks: 600, factorPermille: 2000 },
    speed: { cost: 30_000, durationTicks: 200, cooldownTicks: 500, factorPermille: 1600 },
    defense: { cost: 50_000, durationTicks: 240, cooldownTicks: 600, factorPermille: 1800 },
  },
  minCaptureGarrison: 1000,
};
