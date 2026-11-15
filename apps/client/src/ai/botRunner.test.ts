import { describe, expect, it } from 'vitest';
import { BALANCE, getMap } from '@hamsters/content';
import { SimpleBot } from '@hamsters/ai';
import { Simulation } from '@hamsters/core';
import { BotRunner } from './botRunner';
import { LocalSimSource } from '../sim/localSimSource';
import { ManualScheduler } from '../sim/scheduler';

function setup() {
  const scheduler = new ManualScheduler();
  const sim = new Simulation(getMap('arena-duel'), BALANCE, 5);
  const source = new LocalSimSource(sim, scheduler);
  const runner = new BotRunner(source, new SimpleBot(BALANCE), 1, scheduler, 500);
  return { scheduler, sim, source, runner };
}

describe('BotRunner', () => {
  it('отправляет команды бота в источник состояния', () => {
    const { runner, sim } = setup();
    runner.decide();
    // бот 1-го игрока на первом решении ставит буст и отправляет флот
    expect(sim.state.fleets.length).toBeGreaterThan(0);
  });

  it('работает по расписанию и останавливается', () => {
    const { scheduler, runner } = setup();
    runner.start();
    expect(scheduler.active).toBe(1);
    scheduler.advance(500);
    runner.stop();
    expect(scheduler.active).toBe(0);
  });

  it('молчит после конца партии', () => {
    const { runner, sim } = setup();
    const enemy = sim.state.planets[1];
    if (!enemy) throw new Error('нет планеты');
    enemy.ownerId = 0;
    sim.advance(1);

    const before = sim.state.fleets.length;
    runner.decide();
    expect(sim.state.fleets.length).toBe(before);
  });
});
