/**
 * Тестовые карты. Расстояния подобраны так, чтобы полёты занимали целое число
 * тиков и проверки не зависели от округления.
 */
import type { MapDefinition } from '../types';
import { NEUTRAL_OWNER } from '../types';

/** Три планеты в линию: своя, нейтральная, вражеская. 0→1 и 1→2 — по 20 тиков. */
export const mapThree: MapDefinition = {
  name: 'three',
  width: 300,
  height: 100,
  playerCount: 2,
  planets: [
    { id: 0, size: 'M', x: 0, y: 0, ownerId: 0, garrisonHamsters: 10 },
    { id: 1, size: 'M', x: 100, y: 0, ownerId: NEUTRAL_OWNER, garrisonHamsters: 5 },
    { id: 2, size: 'M', x: 200, y: 0, ownerId: 1, garrisonHamsters: 10 },
  ],
};

/**
 * Четыре планеты: две свои (0, 1), вражеская (2), нейтрал (3).
 * Планеты 0 и 2 равноудалены от нейтрала 3 (111 единиц ≈ 23 тика) — это даёт
 * корректную проверку одновременного прибытия двух врагов.
 */
export const mapFour: MapDefinition = {
  name: 'four',
  width: 300,
  height: 200,
  playerCount: 2,
  planets: [
    { id: 0, size: 'M', x: 0, y: 0, ownerId: 0, garrisonHamsters: 10 },
    { id: 1, size: 'S', x: 100, y: 0, ownerId: 0, garrisonHamsters: 5 },
    { id: 2, size: 'M', x: 200, y: 0, ownerId: 1, garrisonHamsters: 10 },
    { id: 3, size: 'S', x: 100, y: 50, ownerId: NEUTRAL_OWNER, garrisonHamsters: 5 },
  ],
};
