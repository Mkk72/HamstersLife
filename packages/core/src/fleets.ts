/**
 * Запуск флота: одна скорость для всех капсул, один счётчик id.
 * `startProgressPermille` позволяет продолжить путь после полевого боя.
 */
import { distance, flightTicks } from './flight';
import type { Army, Balance, Fleet, GameState, Planet } from './types';

export function launchFleet(
  state: GameState,
  balance: Balance,
  ownerId: number,
  from: Planet,
  toPlanetId: number,
  army: Army,
  startProgressPermille = 0,
): Fleet | null {
  const target = state.planets[toPlanetId];
  if (!target || army.length === 0) return null;
  const progress = Math.min(1000, Math.max(0, startProgressPermille));
  const fullDistance = distance(from.x, from.y, target.x, target.y);
  const remaining = Math.max(0, fullDistance - Math.floor((fullDistance * progress) / 1000));
  const ticks = Math.max(
    1,
    flightTicks(remaining, balance.flightSpeedUnitsPerSecond),
  );
  const fleet: Fleet = {
    id: state.nextFleetId,
    ownerId,
    fromPlanetId: from.id,
    toPlanetId: target.id,
    army,
    departTick: state.tick,
    arriveTick: state.tick + ticks,
    startProgressPermille: progress,
  };
  state.nextFleetId += 1;
  state.fleets.push(fleet);
  return fleet;
}
