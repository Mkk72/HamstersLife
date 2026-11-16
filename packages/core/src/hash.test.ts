import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapThree } from './__fixtures__/maps';
import { Simulation } from './simulation';
import { hashState } from './hash';
import { applyReplay, validateReplay, type MatchReplay } from './replay';

describe('хэш нового состояния', () => {
  it('одинаковая лента команд даёт одинаковый хэш', () => {
    const first = new Simulation(mapThree, testBalance, 7);
    const second = new Simulation(mapThree, testBalance, 7);
    const commands = [
      { type: 'ApplyTemplate' as const, playerId: 0, planetId: 0, templateId: 'balanced' },
      { type: 'SendFleet' as const, playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 50 as const },
    ];
    for (const command of commands) {
      first.applyCommand(command);
      second.applyCommand(command);
    }
    first.advance(120);
    second.advance(120);
    expect(hashState(first.state)).toBe(hashState(second.state));
  });

  it('ранения и прогресс производства входят в хэш', () => {
    const first = new Simulation(mapThree, testBalance, 7);
    const second = new Simulation(mapThree, testBalance, 7);
    const unit = first.state.planets[0]?.army[0];
    if (unit) unit.hp -= 1;
    first.state.planets[0]!.production.swordsman = 500;
    expect(hashState(first.state)).not.toBe(hashState(second.state));
  });

  it('смена плана меняет хэш', () => {
    const first = new Simulation(mapThree, testBalance, 7);
    const second = new Simulation(mapThree, testBalance, 7);
    first.applyCommand({ type: 'SetPlan', playerId: 0, planetId: 0, plan: { swordsman: 10 } });
    second.applyCommand({ type: 'SetPlan', playerId: 0, planetId: 0, plan: { swordsman: 11 } });
    expect(hashState(first.state)).not.toBe(hashState(second.state));
  });

  it('повтор проигрывает ту же ленту в тот же хэш', () => {
    const source = new Simulation(mapThree, testBalance, 7);
    const replay: MatchReplay = {
      rulesVersion: testBalance.rulesVersion,
      contentVersion: testBalance.contentVersion,
      seed: 7,
      mapName: 'three',
      commands: [
        { tick: 0, command: { type: 'ApplyTemplate', playerId: 0, planetId: 0, templateId: 'balanced' } },
        { tick: 10, command: { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 50 } },
      ],
    };
    const first = replay.commands[0];
    const second = replay.commands[1];
    if (!first || !second) throw new Error('нет команд');
    source.applyCommand(first.command);
    source.advance(10);
    source.applyCommand(second.command);
    source.advance(190);

    const restored = new Simulation(mapThree, testBalance, 7);    expect(validateReplay(replay, testBalance)).toEqual([]);
    applyReplay(restored.state, testBalance, replay.commands);
    restored.advance(190);
    expect(hashState(restored.state)).toBe(hashState(source.state));
  });

  it('несовместимый повтор отклоняется явно', () => {
    const replay: MatchReplay = {
      rulesVersion: 6,
      contentVersion: 5,
      seed: 1,
      mapName: 'three',
      commands: [],
    };
    const errors = validateReplay(replay, testBalance);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
