import { describe, expect, it } from 'vitest';
import { BALANCE, getMap } from '@hamsters/content';
import { Simulation } from '@hamsters/core';
import { LocalSimSource } from './localSimSource';
import { ManualScheduler } from './scheduler';

function setup() {
  const scheduler = new ManualScheduler();
  const sim = new Simulation(getMap('arena-duel'), BALANCE, 3);
  const source = new LocalSimSource(sim, scheduler);
  source.start(() => undefined);
  return { scheduler, sim, source };
}

describe('скорость локальной симуляции', () => {
  it('обычная скорость — один тик за 50 мс', () => {
    const { scheduler, sim } = setup();
    scheduler.advance(50);
    expect(sim.tick).toBe(1);
  });

  it('×2 — два тика за 50 мс', () => {
    const { scheduler, sim, source } = setup();
    source.setSpeed(2);
    scheduler.advance(50);
    expect(sim.tick).toBe(2);
  });

  it('×0.5 — тик раз в 100 мс', () => {
    const { scheduler, sim, source } = setup();
    source.setSpeed(0.5);
    scheduler.advance(100);
    expect(sim.tick).toBe(1);
    scheduler.advance(100);
    expect(sim.tick).toBe(2);
  });

  it('×0.2 — медленнее всех', () => {
    const { scheduler, sim, source } = setup();
    source.setSpeed(0.2);
    scheduler.advance(250);
    expect(sim.tick).toBe(1);
  });

  it('пауза останавливает время, но не теряет состояние', () => {
    const { scheduler, sim, source } = setup();
    scheduler.advance(50);
    source.setSpeed(0);
    scheduler.advance(5000);
    expect(sim.tick).toBe(1);
    source.setSpeed(1);
    scheduler.advance(50);
    expect(sim.tick).toBe(2);
  });
});
