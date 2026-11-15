/**
 * Сквозная проверка повтора: боты играют матч с постоянными маршрутами,
 * запись команд проигрывается заново и обязана дать тот же хэш.
 *
 * Это последнее звено детерминизма: правила, маршруты, бот, запись и
 * воспроизведение работают вместе.
 */
import { SimpleBot } from '@hamsters/ai';
import { BALANCE, getMap } from '@hamsters/content';
import { Simulation, applyReplay, hashState, validateReplay } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { BotRunner } from '../ai/botRunner';
import { MatchRecorder } from '../replay/matchRecorder';
import { RecordingSimSource } from '../replay/recordingSimSource';
import { LocalSimSource } from '../sim/localSimSource';
import { ManualScheduler } from '../sim/scheduler';

const TICK_LIMIT = 20 * 60 * 15;

function recordMatch(seed: number) {
  const scheduler = new ManualScheduler();
  const map = getMap('arena-duel');
  const sim = new Simulation(map, BALANCE, seed);
  const recorder = new MatchRecorder({
    rulesVersion: BALANCE.rulesVersion,
    contentVersion: BALANCE.contentVersion,
    seed,
    mapName: map.name,
  });
  const source = new RecordingSimSource(new LocalSimSource(sim, scheduler), recorder);
  const bots = [0, 1].map(
    (playerId) => new BotRunner(source, new SimpleBot(BALANCE), playerId, scheduler, 500),
  );

  source.start(() => undefined);
  for (const bot of bots) bot.start();
  while (sim.tick < TICK_LIMIT && !sim.outcome().finished) scheduler.advance(50);

  return { sim, recorder, ticks: sim.tick, hash: hashState(sim.state) };
}

describe('повтор матча с маршрутами', () => {
  it('воспроизводит записанный матч в тот же хэш', () => {
    const { recorder, ticks, hash } = recordMatch(42);
    const replay = recorder.toReplay();

    expect(replay.commands.length).toBeGreaterThan(0);
    expect(validateReplay(replay, BALANCE)).toEqual([]);

    const restored = new Simulation(getMap('arena-duel'), BALANCE, replay.seed);
    applyReplay(restored.state, BALANCE, replay.commands);
    restored.advance(ticks - restored.tick);

    expect(restored.tick).toBe(ticks);
    expect(hashState(restored.state)).toBe(hash);
  });

  it('повтор другого seed даёт другую партию', () => {
    const first = recordMatch(42);
    const second = recordMatch(43);
    expect(first.hash).not.toBe(second.hash);
  });
});
