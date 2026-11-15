/**
 * Запуск флота между планетами — общий помощник для команд и постоянных
 * маршрутов: одна формула времени полёта, один счётчик id.
 */
import { distance, flightTicks } from './flight';
import { speedUnitsPerSecond } from './modifiers';
import type { Balance, Fleet, GameState, Planet } from './types';
import type { MilliUnits } from './units';

export function launchFleet(
  state: GameState,
  balance: Balance,
  ownerId: number,
  from: Planet,
  toPlanetId: number,
  troops: MilliUnits,
): Fleet | null {
  const target = state.planets[toPlanetId];
  if (!target || troops <= 0) return null;

  const speed = speedUnitsPerSecond(from, state.tick, balance);
  const ticks = flightTicks(distance(from.x, from.y, target.x, target.y), speed);
  const fleet: Fleet = {
    id: state.nextFleetId,
    ownerId,
    fromPlanetId: from.id,
    toPlanetId: target.id,
    troops,
    departTick: state.tick,
    arriveTick: state.tick + ticks,
  };
  state.nextFleetId += 1;
  state.fleets.push(fleet);
  return fleet;
}
