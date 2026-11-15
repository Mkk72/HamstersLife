import { BALANCE, mapDefinitionSchema } from '@hamsters/content';
import { createGameState } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { DuelMapGenerator, generateDuelMap } from './duelMapGenerator';

describe('DuelMapGenerator', () => {
  it('одинаковый seed даёт одинаковую карту', () => {
    expect(generateDuelMap(1234)).toEqual(generateDuelMap(1234));
  });

  it('разные seed дают разные карты', () => {
    expect(generateDuelMap(1)).not.toEqual(generateDuelMap(2));
  });

  it('строит ожидаемое число планет', () => {
    const map = generateDuelMap(7);
    expect(map.planets).toHaveLength(3 + 5 * 2);
    expect(map.playerCount).toBe(2);
  });

  it('карта симметрична относительно центра', () => {
    const map = generateDuelMap(99);
    for (const planet of map.planets) {
      const mirror = map.planets.find(
        (candidate) => candidate.x === map.width - planet.x && candidate.y === planet.y,
      );
      expect(mirror, `нет зеркала для ${planet.id}`).toBeDefined();
      if (!mirror) continue;
      expect(mirror.size).toBe(planet.size);
      expect(mirror.garrisonHamsters).toBe(planet.garrisonHamsters);
    }
  });

  it('держит минимальные расстояния от стартов и друг от друга', () => {
    const map = generateDuelMap(2024);
    for (const planet of map.planets) {
      if (planet.ownerId === -1) continue;
      for (const other of map.planets) {
        if (other.id === planet.id) continue;
        if (other.ownerId === planet.ownerId) continue;
        const distance = Math.hypot(planet.x - other.x, planet.y - other.y);
        expect(distance).toBeGreaterThan(200);
      }
    }
  });

  it('проходит схему контента и принимается ядром на 200 seed', () => {
    const generator = new DuelMapGenerator();
    for (let seed = 0; seed < 200; seed += 1) {
      const map = generator.generate(seed);
      expect(() => mapDefinitionSchema.parse(map)).not.toThrow();
      expect(map.planets).toHaveLength(13);
      expect(() => createGameState(map, BALANCE, seed)).not.toThrow();
    }
  });

  it('уважает настройки размера и числа пар', () => {
    const map = generateDuelMap(5, { width: 800, height: 600, neutralPairs: 2 });
    expect(map.width).toBe(800);
    expect(map.planets).toHaveLength(3 + 2 * 2);
  });

  it('строит карту на четверых с четырьмя стартами', () => {
    const map = generateDuelMap(77, { playerCount: 4 });
    expect(map.playerCount).toBe(4);
    expect(map.name).toBe('four-77');
    const owners = new Map<number, number>();
    for (const planet of map.planets) {
      if (planet.ownerId === -1) continue;
      owners.set(planet.ownerId, (owners.get(planet.ownerId) ?? 0) + 1);
    }
    expect([...owners.keys()].sort()).toEqual([0, 1, 2, 3]);
    expect(map.planets).toHaveLength(5 + 5 * 4);
  });

  it('карта на четверых симметрична по обеим осям', () => {
    const map = generateDuelMap(123, { playerCount: 4 });
    for (const planet of map.planets) {
      for (const mirror of [
        { x: map.width - planet.x, y: planet.y },
        { x: planet.x, y: map.height - planet.y },
        { x: map.width - planet.x, y: map.height - planet.y },
      ]) {
        const found = map.planets.find(
          (candidate) => candidate.x === mirror.x && candidate.y === mirror.y,
        );
        expect(found, `нет зеркала для ${planet.id}`).toBeDefined();
        if (!found) continue;
        expect(found.size).toBe(planet.size);
        expect(found.garrisonHamsters).toBe(planet.garrisonHamsters);
      }
    }
  });

  it('карта на четверых принимается ядром на 100 seed', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const map = generateDuelMap(seed, { playerCount: 4 });
      expect(() => mapDefinitionSchema.parse(map)).not.toThrow();
      expect(() => createGameState(map, BALANCE, seed)).not.toThrow();
    }
  });
});
