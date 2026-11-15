/**
 * Тик партии: набор систем из `systems.ts` в каноническом порядке.
 *
 * Здесь нет правил — только время и итог. Чтобы добавить правило, правится
 * `TICK_SYSTEMS`, а не этот файл.
 */
import { hasForces } from './state';
import { TICK_SYSTEMS } from './systems';
import type { Balance, GameState, PlayerId } from './types';

export function step(state: GameState, balance: Balance): void {
  state.tick += 1;
  const context = { tick: state.tick, balance };
  for (const system of TICK_SYSTEMS) system(state, context);
}

export function runTicks(state: GameState, balance: Balance, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) step(state, balance);
}

export interface Outcome {
  readonly finished: boolean;
  readonly winnerId: PlayerId | null;
}

/** Итог партии: последний игрок с планетами или флотами. */
export function evaluateOutcome(state: GameState): Outcome {
  const alive = state.players.filter((player) => player.alive && hasForces(state, player.id));
  const only = alive[0];
  if (alive.length === 1 && only) return { finished: true, winnerId: only.id };
  if (alive.length === 0) return { finished: true, winnerId: null };
  return { finished: false, winnerId: null };
}
