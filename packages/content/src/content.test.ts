import { describe, expect, it } from 'vitest';
import { BALANCE, DEFAULT_MAP, MAPS, getMap } from './index';
import { balanceSchema, mapDefinitionSchema } from './schema';
import { createGameState } from '@hamsters/core';

describe('баланс', () => {
  it('загружается и проходит схему', () => {
    expect(BALANCE.rulesVersion).toBeGreaterThan(0);
    expect(BALANCE.planetSizes.M.capacity).toBeGreaterThan(0);
  });

  it('производство делится на 20 без остатка — иначе теряется точность за тик', () => {
    for (const [size, stats] of Object.entries(BALANCE.planetSizes)) {
      expect(stats.productionPerSecond % 20, `размер ${size}`).toBe(0);
    }
  });

  it('вместимость больше стартового гарнизона средней планеты', () => {
    expect(BALANCE.planetSizes.M.capacity).toBeGreaterThan(10_000);
  });

  it('бусты имеют смысл: множитель выше 1, перезарядка длиннее действия', () => {
    for (const stats of Object.values(BALANCE.boosts)) {
      expect(stats.factorPermille).toBeGreaterThan(1000);
      expect(stats.cooldownTicks).toBeGreaterThan(stats.durationTicks);
    }
  });

  it('пять родов войск с осмысленными ролями', () => {
    expect(Object.keys(BALANCE.troops).sort()).toEqual([
      'archer',
      'cannon',
      'cavalry',
      'mage',
      'swordsman',
    ]);
    expect(BALANCE.troops.swordsman.defense).toBeGreaterThan(BALANCE.troops.archer.defense);
    expect(BALANCE.troops.mage.range).toBeGreaterThan(0);
    expect(BALANCE.troops.cannon.speedPermille).toBeLessThan(
      BALANCE.troops.swordsman.speedPermille,
    );
    expect(BALANCE.troops.cannon.costSeeds).toBeGreaterThan(BALANCE.troops.swordsman.costSeeds);
  });

  it('четыре клана с бонусами не ниже базовых', () => {
    expect(Object.keys(BALANCE.clans)).toHaveLength(4);
    for (const clan of Object.values(BALANCE.clans)) {
      expect(clan.productionPermille).toBeGreaterThanOrEqual(1000);
      expect(clan.defensePermille).toBeGreaterThanOrEqual(1000);
      expect(clan.speedPermille).toBeGreaterThanOrEqual(1000);
      expect(clan.spellCostPermille).toBeGreaterThanOrEqual(900);
    }
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

  it('на карте есть обе стартовые планеты', () => {
    const map = MAPS['arena-duel'];
    expect(map).toBeDefined();
    if (!map) return;
    const owners = new Set(map.planets.map((planet) => planet.ownerId));
    expect(owners.has(0)).toBe(true);
    expect(owners.has(1)).toBe(true);
    expect(owners.has(-1)).toBe(true);
  });

  it('симметрична относительно центра — честный старт для PvP', () => {
    const map = getMap(DEFAULT_MAP);
    for (const planet of map.planets) {
      const mirrored = map.planets.find(
        (candidate) => candidate.x === map.width - planet.x && candidate.y === planet.y,
      );
      expect(mirrored, `нет зеркала для планеты ${planet.id}`).toBeDefined();
      if (!mirrored) continue;
      expect(mirrored.size).toBe(planet.size);
      expect(mirrored.garrisonHamsters).toBe(planet.garrisonHamsters);
      if (mirrored.id !== planet.id) {
        if (planet.ownerId === 0) expect(mirrored.ownerId).toBe(1);
        if (planet.ownerId === 1) expect(mirrored.ownerId).toBe(0);
      }
    }
  });

  it('принимается ядром как партия', () => {
    const state = createGameState(getMap(DEFAULT_MAP), BALANCE, 42);
    expect(state.planets).toHaveLength(getMap(DEFAULT_MAP).planets.length);
    expect(state.players).toHaveLength(2);
    expect(state.players[0]?.seeds).toBe(BALANCE.startingSeeds);
  });

  it('отклоняет карту с лишним полем — схема строгая', () => {
    const map = getMap(DEFAULT_MAP);
    const withExtra = { ...map, oops: true };
    expect(() => mapDefinitionSchema.parse(withExtra)).toThrow();
  });
});
