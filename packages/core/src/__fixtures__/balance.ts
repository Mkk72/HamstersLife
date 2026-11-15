/**
 * Тестовый баланс. Числа — эталон для тестов ядра; рабочие значения живут в
 * пакете `@hamsters/content` и не должны расходиться с этими проверками по
 * смыслу (производство кратно 20, чтобы делиться на тики без дробей).
 */
import type { Balance } from '../types';

export const testBalance: Balance = {
  rulesVersion: 1,
  contentVersion: 1,  planetSizes: {
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
  maxRoutesPerPlanet: 4,
  minRouteFleet: 1000,
  maxTrainingQueue: 3,
  combat: {
    strongPermille: 1400,
    weakPermille: 700,
    phaseLossPermille: 300,
    rangedEfficiencyPermille: 1000,
    approachEfficiencyPermille: 800,
    meleeEfficiencyPermille: 1200,
  },
  troops: {
    swordsman: { name: 'Мечник', role: 'melee', attack: 1000, defense: 1400, speedPermille: 1000, range: 0, trainTicks: 60, costSeeds: 20_000, strongAgainst: ['archer'], weakAgainst: ['cannon'] },
    archer: { name: 'Лучник', role: 'ranged', attack: 900, defense: 700, speedPermille: 1000, range: 1, trainTicks: 70, costSeeds: 22_000, strongAgainst: ['cavalry'], weakAgainst: ['cannon'] },
    cannon: { name: 'Пушка', role: 'siege', attack: 1600, defense: 500, speedPermille: 600, range: 2, trainTicks: 110, costSeeds: 35_000, strongAgainst: ['swordsman'], weakAgainst: ['cavalry'] },
    cavalry: { name: 'Конница', role: 'melee', attack: 1300, defense: 900, speedPermille: 1600, range: 0, trainTicks: 80, costSeeds: 26_000, strongAgainst: ['cannon', 'archer'], weakAgainst: ['swordsman'] },
    mage: { name: 'Маг', role: 'support', attack: 700, defense: 600, speedPermille: 1000, range: 2, trainTicks: 120, costSeeds: 40_000, strongAgainst: ['swordsman', 'archer'], weakAgainst: ['cavalry'] },
  },
  clans: {
    goldenCheeks: { name: 'Золотые Щёки', productionPermille: 1100, defensePermille: 1000, speedPermille: 1000, spellCostPermille: 1000 },
    jungarian: { name: 'Джунгарские', productionPermille: 1000, defensePermille: 1000, speedPermille: 1100, spellCostPermille: 1000 },
    syrian: { name: 'Сирийская Броня', productionPermille: 1000, defensePermille: 1100, speedPermille: 1000, spellCostPermille: 1000 },
    darkRoborowski: { name: 'Тёмный Роборовски', productionPermille: 1000, defensePermille: 1000, speedPermille: 1000, spellCostPermille: 900 },
  },
};
