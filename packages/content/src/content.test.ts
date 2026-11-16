import { describe, expect, it } from 'vitest';
import { createGameState } from '@hamsters/core';
import { BALANCE, DEFAULT_MAP, MAPS, getMap } from './index';
import { balanceSchema, mapDefinitionSchema } from './schema';

describe('баланс', () => {
  it('загружается и проходит схему', () => {
    expect(BALANCE.rulesVersion).toBeGreaterThan(0);
    expect(BALANCE.planetSizes.M.capacity).toBe(60);
  });

  it('вместимость и мощность растут с размером', () => {
    const sizes = ['S', 'M', 'L', 'XL'] as const;
    for (let index = 1; index < sizes.length; index += 1) {
      expect(BALANCE.planetSizes[sizes[index]!].capacity).toBeGreaterThan(
        BALANCE.planetSizes[sizes[index - 1]!].capacity,
      );
      expect(BALANCE.planetSizes[sizes[index]!].powerPerTick).toBeGreaterThan(
        BALANCE.planetSizes[sizes[index - 1]!].powerPerTick,
      );
    }
  });

  it('четыре рода войск: мечники, лучники, конница, пушки', () => {
    expect(Object.keys(BALANCE.troops).sort()).toEqual([
      'archer',
      'cannon',
      'cavalry',
      'swordsman',
    ]);
    expect(BALANCE.troops.cannon.damage).toBeGreaterThan(BALANCE.troops.swordsman.damage);
    expect(BALANCE.troops.cannon.attackIntervalTicks).toBeGreaterThan(
      BALANCE.troops.swordsman.attackIntervalTicks,
    );
    expect(BALANCE.troops.cavalry.hp).toBeGreaterThan(BALANCE.troops.archer.hp);
  });

  it('у каждого рода есть приоритеты всех четырёх родов и контр-множители', () => {
    for (const [kind, stats] of Object.entries(BALANCE.troops)) {
      expect(stats.priority, kind).toHaveLength(4);
      expect(new Set(stats.priority).size, kind).toBe(4);
      expect(Object.keys(stats.counters).length, kind).toBeGreaterThan(0);
    }
    expect(BALANCE.troops.swordsman.counters.cavalry).toBe(2000);
    expect(BALANCE.troops.cannon.counters.swordsman).toBe(2000);
  });

  it('шаблоны дают ровно вместимость и сумму 100%', () => {
    for (const template of BALANCE.templates) {
      const sum = Object.values(template.percents).reduce((total, value) => total + value, 0);
      expect(sum, template.id).toBe(100);
    }
  });

  it('стартовые планеты помещаются в предел', () => {
    const total = Object.values(BALANCE.startingPlan).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(BALANCE.planetSizes.M.capacity);
  });

  it('схема отклоняет лишнее поле у рода войск', () => {
    const broken = {
      ...BALANCE,
      troops: {
        ...BALANCE.troops,
        swordsman: { ...BALANCE.troops.swordsman, extra: 1 },
      },
    };
    expect(() => balanceSchema.parse(broken)).toThrow();
  });
});

describe('карта арены', () => {
  it('единственная доступная карта — arena-duel', () => {
    expect(DEFAULT_MAP).toBe('arena-duel');
    expect(getMap('arena-duel').name).toBe('arena-duel');
    expect(() => getMap('нет такой')).toThrow(/Неизвестная карта/);
  });

  it('симметрична относительно центра: старты, гарнизоны и планы совпадают', () => {
    const map = MAPS['arena-duel'];
    expect(map).toBeDefined();
    if (!map) return;
    for (const planet of map.planets) {
      const mirrored = map.planets.find(
        (candidate) => candidate.x === map.width - planet.x && candidate.y === planet.y,
      );
      expect(mirrored, `нет зеркала для планеты ${planet.id}`).toBeDefined();
      if (!mirrored) continue;
      expect(mirrored.size).toBe(planet.size);
      expect(mirrored.garrison).toEqual(planet.garrison);
      expect(mirrored.plan).toEqual(planet.plan);
      if (mirrored.id !== planet.id) {
        if (planet.ownerId === 0) expect(mirrored.ownerId).toBe(1);
        if (planet.ownerId === 1) expect(mirrored.ownerId).toBe(0);
      }
    }
  });

  it('нейтралы вооружены только мечниками', () => {
    const map = getMap(DEFAULT_MAP);
    for (const planet of map.planets.filter((item) => item.ownerId === -1)) {
      expect(planet.garrison.archer, `планета ${planet.id}`).toBe(0);
      expect(planet.garrison.cavalry, `планета ${planet.id}`).toBe(0);
      expect(planet.garrison.cannon, `планета ${planet.id}`).toBe(0);
    }
  });

  it('принимается ядром как партия', () => {
    const map = getMap(DEFAULT_MAP);
    const state = createGameState(map, BALANCE, 42);
    expect(state.planets).toHaveLength(map.planets.length);
    expect(state.players).toHaveLength(2);
    const home = state.planets[0];
    expect(home?.army.filter((unit) => unit.kind === 'swordsman')).toHaveLength(18);
    expect(home?.army.filter((unit) => unit.kind === 'archer')).toHaveLength(6);
    expect(home?.plan.swordsman).toBe(36);
  });

  it('отклоняет карту с лишним полем — схема строгая', () => {
    const map = getMap(DEFAULT_MAP);
    const withExtra = { ...map, oops: true };
    expect(() => mapDefinitionSchema.parse(withExtra)).toThrow();
  });
});
