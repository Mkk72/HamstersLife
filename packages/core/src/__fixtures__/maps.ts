/** Тестовые карты: расстояния кратны скорости, чтобы полёт занимал целые тики. */
import type { MapDefinition, Plan } from '../types';
import { NEUTRAL_OWNER } from '../types';

function plan(partial: Partial<Plan>): Plan {
  return { swordsman: 0, archer: 0, cavalry: 0, cannon: 0, ...partial };
}

/** Три планеты в линию: своя, нейтральная, вражеская. 100 единиц = 20 тиков. */
export const mapThree: MapDefinition = {
  name: 'three',
  width: 300,
  height: 100,
  playerCount: 2,
  planets: [
    { id: 0, size: 'M', x: 0, y: 0, ownerId: 0, garrison: plan({ swordsman: 10 }), plan: plan({ swordsman: 20 }) },
    { id: 1, size: 'M', x: 100, y: 0, ownerId: NEUTRAL_OWNER, garrison: plan({ swordsman: 5 }) },
    { id: 2, size: 'M', x: 200, y: 0, ownerId: 1, garrison: plan({ swordsman: 10 }), plan: plan({ swordsman: 20 }) },
  ],
};

/** Четыре планеты: две свои, вражеская и нейтрал. */
export const mapFour: MapDefinition = {
  name: 'four',
  width: 300,
  height: 200,
  playerCount: 2,
  planets: [
    { id: 0, size: 'M', x: 0, y: 0, ownerId: 0, garrison: plan({ swordsman: 10 }), plan: plan({ swordsman: 20 }) },
    { id: 1, size: 'S', x: 100, y: 0, ownerId: 0, garrison: plan({ swordsman: 5 }), plan: plan({ swordsman: 10 }) },
    { id: 2, size: 'M', x: 200, y: 0, ownerId: 1, garrison: plan({ swordsman: 10 }), plan: plan({ swordsman: 20 }) },
    { id: 3, size: 'S', x: 100, y: 50, ownerId: NEUTRAL_OWNER, garrison: plan({ swordsman: 5 }) },
  ],
};
