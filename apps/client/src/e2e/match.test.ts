/**
 * Сквозной сценарий без окна: два бота играют матч до результата.
 *
 * Проверяет три вещи сразу: правила не ломаются (нет отрицательных гарнизонов),
 * партия действительно заканчивается, а одинаковый seed даёт одинаковый хэш.
 */
import { SimpleBot } from '@hamsters/ai';
import { BALANCE, getMap } from '@hamsters/content';
import { Simulation, hashState } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { BotRunner } from '../ai/botRunner';
import { LocalSimSource } from '../sim/localSimSource';
import { ManualScheduler } from '../sim/scheduler';

interface MatchResult {
  readonly ticks: number;
  readonly hash: number;
  readonly winner: number | null;
  readonly minGarrison: number;
}

const TICK_LIMIT = 20 * 60 * 12;

function playOut(seed: number): MatchResult {
  const scheduler = new ManualScheduler();
  const sim = new Simulation(getMap('arena-duel'), BALANCE, seed);
  const source = new LocalSimSource(sim, scheduler);
  const bots = [
    new BotRunner(source, new SimpleBot(BALANCE), 0, scheduler, 500),
    new BotRunner(source, new SimpleBot(BALANCE), 1, scheduler, 500),
  ];

  source.start(() => undefined);
  for (const bot of bots) bot.start();

  let minGarrison = Number.POSITIVE_INFINITY;
  while (sim.tick < TICK_LIMIT) {
    scheduler.advance(50);
    for (const planet of sim.state.planets) {
      minGarrison = Math.min(minGarrison, planet.garrison);
    }
    const outcome = sim.outcome();
    if (outcome.finished) {
      return { ticks: sim.tick, hash: hashState(sim.state), winner: outcome.winnerId, minGarrison };
    }
  }
  return { ticks: sim.tick, hash: hashState(sim.state), winner: null, minGarrison };
}

describe('матч ботов до результата', () => {
  it('заканчивается победой за отведённое время', () => {
    const result = playOut(1);
    expect(result.winner).not.toBeNull();
    expect(result.ticks).toBeLessThan(TICK_LIMIT);
  });

  it('не допускает отрицательных гарнизонов', () => {
    for (const seed of [2, 3, 4]) {
      const result = playOut(seed);
      expect(result.minGarrison).toBeGreaterThanOrEqual(0);
    }
  });

  it('одинаковый seed даёт тот же ход партии', () => {
    const first = playOut(7);
    const second = playOut(7);
    expect(second.ticks).toBe(first.ticks);
    expect(second.hash).toBe(first.hash);
    expect(second.winner).toBe(first.winner);
  });

  it('партия длится разумное время — не мгновенно и не вечно', () => {
    const result = playOut(5);
    expect(result.ticks).toBeGreaterThan(20 * 5);
    expect(result.ticks).toBeLessThan(TICK_LIMIT);
  });
});
