import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour } from './__fixtures__/maps';
import { hashState } from './hash';
import { applyReplay, validateReplay } from './replay';
import type { MatchReplay, ReplayCommand } from './replay';
import { Simulation } from './simulation';
import type { Command } from './types';

const log: readonly { tick: number; command: Command }[] = [
  { tick: 0, command: { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 50 } },
  { tick: 10, command: { type: 'ApplyBoost', playerId: 0, planetId: 1, boost: 'production' } },
  { tick: 30, command: { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 3, ratio: 100 } },
  { tick: 60, command: { type: 'ApplyBoost', playerId: 1, planetId: 2, boost: 'defense' } },
];

function recordLive(): { replay: MatchReplay; hash: number } {
  const sim = new Simulation(mapFour, testBalance, 31);
  const commands: ReplayCommand[] = [];
  for (const entry of log) {
    sim.advance(entry.tick - sim.tick);
    // применить команду на нужном тике
    sim.applyCommand(entry.command);
    commands.push({ tick: entry.tick, command: entry.command });
  }
  sim.advance(200 - sim.tick);
  return {
    replay: {
      rulesVersion: testBalance.rulesVersion,
      contentVersion: testBalance.contentVersion,
      seed: 31,
      mapName: 'four',
      commands,
    },
    hash: hashState(sim.state),
  };
}

describe('повтор матча', () => {
  it('проигрывает ленту команд в тот же хэш', () => {
    const { replay, hash } = recordLive();
    const restored = new Simulation(mapFour, testBalance, replay.seed);
    applyReplay(restored.state, testBalance, replay.commands);
    restored.advance(200 - restored.tick);
    expect(hashState(restored.state)).toBe(hash);
  });

  it('лента команд воспроизводится детерминированно на копии', () => {
    const { replay } = recordLive();
    const first = new Simulation(mapFour, testBalance, replay.seed);
    const second = new Simulation(mapFour, testBalance, replay.seed);
    applyReplay(first.state, testBalance, replay.commands);
    applyReplay(second.state, testBalance, replay.commands);
    expect(hashState(first.state)).toBe(hashState(second.state));
  });

  it('не считает совместимым повтор другой версии правил', () => {
    const { replay } = recordLive();
    const errors = validateReplay(replay, { ...testBalance, rulesVersion: 2 });
    expect(errors.join(' ')).toMatch(/версии правил/);
  });

  it('не считает совместимым повтор другой версии данных', () => {
    const { replay } = recordLive();
    const errors = validateReplay(replay, { ...testBalance, contentVersion: 7 });
    expect(errors.join(' ')).toMatch(/версии данных/);
  });

  it('ловит команды не по порядку тиков', () => {
    const { replay } = recordLive();
    const broken = { ...replay, commands: [...replay.commands].reverse() };
    expect(validateReplay(broken, testBalance).join(' ')).toMatch(/не по порядку/);
  });

  it('совместимый повтор не даёт ошибок', () => {
    const { replay } = recordLive();
    expect(validateReplay(replay, testBalance)).toEqual([]);
  });
});
