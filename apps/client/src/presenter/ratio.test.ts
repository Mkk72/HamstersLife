import { describe, expect, it } from 'vitest';
import { BALANCE, CONTENT, getMap } from '@hamsters/content';
import { Simulation } from '@hamsters/core';
import type { BoostKind, Command, CommandResult, GameState, SimSource } from '@hamsters/core';
import { GamePresenter } from './gamePresenter';
import type { BoardView, GameView, QualityLevel } from './viewModel';

class FakeSource implements SimSource {
  #listener: ((state: GameState) => void) | null = null;
  constructor(readonly sim: Simulation) {}
  getSnapshot(): GameState {
    return this.sim.state;
  }
  sendCommand(command: Command): CommandResult {
    const result = this.sim.applyCommand(command);
    if (result.ok) this.#listener?.(this.sim.state);
    return result;
  }
  start(onTick: (state: GameState) => void): void {
    this.#listener = onTick;
    onTick(this.sim.state);
  }
  stop(): void {
    this.#listener = null;
  }
}

class SilentView implements GameView {
  render(_view: BoardView): void {}
  setQuality(_level: QualityLevel): void {}
  playCapture(_id: number): void {}
  playBoost(_id: number, _kind: BoostKind): void {}
  playSend(): void {}
  playError(): void {}
  playSelect(): void {}
  playOutcome(_won: boolean): void {}
}

describe('выбор доли', () => {
  it('по умолчанию 50%', () => {
    const presenter = new GamePresenter({
      sim: new FakeSource(new Simulation(getMap('arena-duel'), BALANCE, 1)),
      view: new SilentView(),
      content: CONTENT,
      humanPlayerId: 0,
    });
    expect(presenter.ratio).toBe(50);
  });

  it('принимает только допустимые доли', () => {
    const presenter = new GamePresenter({
      sim: new FakeSource(new Simulation(getMap('arena-duel'), BALANCE, 1)),
      view: new SilentView(),
      content: CONTENT,
      humanPlayerId: 0,
    });
    presenter.setRatio(75);
    expect(presenter.ratio).toBe(75);
    presenter.setRatio(42 as unknown as 25);
    expect(presenter.ratio).toBe(75);
  });
});
