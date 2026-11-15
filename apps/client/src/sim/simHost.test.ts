import { BALANCE, getMap } from '@hamsters/content';
import type { Command } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { SimHost } from './simHost';

const map = getMap('arena-duel');

describe('SimHost (протокол Worker)', () => {
  it('на init отвечает ready и создаёт партию', () => {
    const host = new SimHost(map, BALANCE, 1);
    const out = host.handle({ type: 'init', map, balance: BALANCE, seed: 9 });
    expect(out).toEqual([{ type: 'ready' }]);
    expect(host.state.tick).toBe(0);
    expect(host.state.seed).toBe(9);
  });

  it('на start отдаёт снимок', () => {
    const host = new SimHost(map, BALANCE, 1);
    const out = host.handle({ type: 'start' });
    expect(out[0]?.type).toBe('snapshot');
  });

  it('применяет команду и сообщает результат', () => {
    const host = new SimHost(map, BALANCE, 1);
    const command: Command = {
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 8,
      ratio: 50,
    };
    const out = host.handle({ type: 'command', command });
    expect(out[0]).toMatchObject({ type: 'result', result: { ok: true } });
    expect(host.state.fleets).toHaveLength(1);
  });

  it('отклонённая команда не меняет состояние', () => {
    const host = new SimHost(map, BALANCE, 1);
    const command: Command = {
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [1],
      toPlanetId: 8,
      ratio: 50,
    };
    const out = host.handle({ type: 'command', command });
    expect(out[0]).toMatchObject({ type: 'result', result: { ok: false } });
    expect(host.state.fleets).toHaveLength(0);
  });

  it('tick-request двигает время на один тик', () => {
    const host = new SimHost(map, BALANCE, 1);
    const out = host.handle({ type: 'tick-request' });
    const snapshot = out[0];
    expect(snapshot?.type).toBe('snapshot');
    if (snapshot?.type === 'snapshot') expect(snapshot.state.tick).toBe(1);
  });

  it('останавливается по stop без изменений', () => {
    const host = new SimHost(map, BALANCE, 1);
    expect(host.handle({ type: 'stop' })).toEqual([]);
    expect(host.state.tick).toBe(0);
  });
});
