import { describe, expect, it } from 'vitest';
import { generateDuelMap } from './duelMapGenerator';

describe('генератор карт', () => {
  it('дуэль симметрична и стартует по новым правилам', () => {
    const map = generateDuelMap(42);
    expect(map.playerCount).toBe(2);
    expect(map.planets.length).toBeGreaterThan(5);

    const starts = map.planets.filter((planet) => planet.ownerId !== -1);
    expect(starts).toHaveLength(2);
    for (const planet of starts) {
      expect(planet.size).toBe('M');
      expect(planet.garrison.swordsman).toBe(18);
      expect(planet.garrison.archer).toBe(6);
      expect(planet.plan?.swordsman).toBe(36);
      expect(planet.plan?.archer).toBe(24);
    }

    for (const planet of map.planets) {
      const mirrored = map.planets.find(
        (candidate) => candidate.x === map.width - planet.x && candidate.y === planet.y,
      );
      expect(mirrored, `нет зеркала для ${planet.id}`).toBeDefined();
      if (mirrored) expect(mirrored.garrison).toEqual(planet.garrison);
    }
  });

  it('нейтралы содержат только мечников', () => {
    const map = generateDuelMap(7);
    for (const planet of map.planets.filter((item) => item.ownerId === -1)) {
      expect(planet.garrison.archer).toBe(0);
      expect(planet.garrison.cavalry).toBe(0);
      expect(planet.garrison.cannon).toBe(0);
      expect(planet.garrison.swordsman).toBeGreaterThan(0);
    }
  });

  it('одинаковый seed даёт одинаковую карту', () => {
    expect(generateDuelMap(5)).toEqual(generateDuelMap(5));
  });

  it('карта на четверых тоже собирается', () => {
    const map = generateDuelMap(11, { playerCount: 4 });
    expect(map.playerCount).toBe(4);
    expect(map.planets.filter((planet) => planet.ownerId !== -1)).toHaveLength(4);
  });
});
