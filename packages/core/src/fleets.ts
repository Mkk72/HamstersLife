/**
 * Запуск флота между планетами — общий помощник для команд и постоянных
 * маршрутов: одна формула времени полёта, один счётчик id. Отряд несёт состав,
 * а не одно число.
 */
import { distance, flightTicks } from './flight';
import { speedUnitsPerSecond } from './modifiers';
import { troopTotal } from './troops';
import type { Balance, Fleet, GameState, Planet, TroopStack } from './types';

export function launchFleet(
  state: GameState,
  balance: Balance,
  ownerId: number,
  from: Planet,
  toPlanetId: number,
  troops: TroopStack,
): Fleet | null {
  const target = state.planets[toPlanetId];
  if (!target || troopTotal(troops) <= 0) return null;

  const owner = state.players[ownerId];
  const clanSpeed = owner ? (balance.clans[owner.clanId]?.speedPermille ?? 1000) : 1000;
  const speed = speedUnitsPerSecond(from, state.tick, balance, clanSpeed);
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
