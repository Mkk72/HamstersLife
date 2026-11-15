import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { hashState, hashToHex } from './hash';
import { createGameState } from './state';
import { createTroopStack } from './troops';
import { runTicks } from './tick';
import type { Command } from './types';

/**
 * Одна и та же лента команд, применённая к двум независимым партиям, должна
 * дать одинаковый хэш. Это и есть тест детерминизма этапа 1.
 */
function runScenario(seed: number, log: readonly Command[]): number {
  const state = createGameState(mapFour, testBalance, seed);
  for (const command of log) {
    applyCommand(state, command, testBalance);
    runTicks(state, testBalance, 5);
  }
  runTicks(state, testBalance, 200);
  return hashState(state);
}

const trainingLog: readonly Command[] = [
  { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 50 },
  { type: 'ApplyBoost', playerId: 0, planetId: 1, boost: 'production' },
  { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 3, ratio: 75 },
  { type: 'ApplyBoost', playerId: 1, planetId: 2, boost: 'defense' },
];

describe('детерминизм', () => {
  it('одинаковая лента команд даёт одинаковый хэш', () => {
    const first = runScenario(2024, trainingLog);
    const second = runScenario(2024, trainingLog);
    expect(hashToHex(first)).toBe(hashToHex(second));
  });

  it('хэш зависит от seed', () => {
    const first = runScenario(2024, trainingLog);
    const second = runScenario(2025, trainingLog);
    expect(first).not.toBe(second);
  });

  it('хэш меняется от изменения одной команды', () => {
    const boostDifferentPlanet: readonly Command[] = [
      { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'production' },
      ...trainingLog.slice(1),
    ];
    expect(runScenario(2024, trainingLog)).not.toBe(runScenario(2024, boostDifferentPlanet));
  });

  it('хэш учитывает маршруты и их вес', () => {
    const first = createGameState(mapFour, testBalance, 3);
    const second = createGameState(mapFour, testBalance, 3);
    first.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: 0,
      toPlanetId: 3,
      weightPermille: 500,
      pending: createTroopStack(),
    });
    second.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: 0,
      toPlanetId: 3,
      weightPermille: 250,
      pending: createTroopStack(),
    });
    expect(hashState(first)).not.toBe(hashState(second));
  });

  it('хэш — 32-битное беззнаковое число в hex из восьми знаков', () => {
    const hex = hashToHex(runScenario(1, trainingLog));
    expect(hex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('партия без команд доходит до одинакового состояния за 1000 тиков', () => {
    const first = createGameState(mapFour, testBalance, 99);
    const second = createGameState(mapFour, testBalance, 99);
    runTicks(first, testBalance, 1000);
    runTicks(second, testBalance, 1000);
    expect(hashState(first)).toBe(hashState(second));
    expect(first.tick).toBe(1000);
  });
});
