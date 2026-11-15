import { BALANCE, getMap } from '@hamsters/content';
import { Simulation } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { LocalSimSource } from '../sim/localSimSource';
import { ManualScheduler } from '../sim/scheduler';
import { MatchRecorder } from './matchRecorder';
import { RecordingSimSource } from './recordingSimSource';

function setup() {
  const scheduler = new ManualScheduler();
  const sim = new Simulation(getMap('arena-duel'), BALANCE, 11);
  const local = new LocalSimSource(sim, scheduler);
  const recorder = new MatchRecorder({
    rulesVersion: BALANCE.rulesVersion,
    contentVersion: BALANCE.contentVersion,
    seed: 11,
    mapName: 'arena-duel',
  });
  const source = new RecordingSimSource(local, recorder);
  return { scheduler, sim, local, recorder, source };
}

describe('MatchRecorder', () => {
  it('пишет команду с номером тика', () => {
    const { source, recorder, sim } = setup();
    source.sendCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 8,
      ratio: 50,
    });

    const replay = recorder.toReplay();
    expect(replay.commands).toHaveLength(1);
    expect(replay.commands[0]?.tick).toBe(0);
    expect(replay.seed).toBe(11);
    expect(replay.mapName).toBe('arena-duel');
    expect(sim.state.fleets).toHaveLength(1);
  });

  it('не пишет отклонённые команды', () => {
    const { source, recorder } = setup();
    const result = source.sendCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [1],
      toPlanetId: 8,
      ratio: 50,
    });
    expect(result.ok).toBe(false);
    expect(recorder.size).toBe(0);
  });

  it('пишет команду на текущем тике источника', () => {
    const { source, recorder, local, scheduler } = setup();
    local.start(() => undefined);
    scheduler.advance(200); // 4 тика по 50 мс
    source.sendCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 8,
      ratio: 25,
    });
    expect(recorder.toReplay().commands[0]?.tick).toBe(4);
  });

  it('отдаёт JSON, который можно прочитать обратно', () => {
    const { source, recorder } = setup();
    source.sendCommand({
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 8,
      ratio: 75,
    });
    const parsed = JSON.parse(recorder.toJson()) as { commands: unknown[] };
    expect(parsed.commands).toHaveLength(1);
  });
});
