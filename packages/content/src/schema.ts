/**
 * Схемы контента нового первого этапа. Данные (баланс, рода, шаблоны, карты)
 * лежат в JSON и проверяются здесь при загрузке: ошибка в числе — падение на
 * старте, а не расхождение в игре. `strictObject` не пропускает лишние поля.
 */
import { z } from 'zod';

export const planetSizeSchema = z.enum(['S', 'M', 'L', 'XL']);

export const unitKindSchema = z.enum(['swordsman', 'archer', 'cavalry', 'cannon']);

export const sizeStatsSchema = z.strictObject({
  /** Сколько юнитов влезает: одна ячейка на юнита. */
  capacity: z.number().int().positive(),
  /** Работа производства за тик (20 тиков = 1 секунда). */
  powerPerTick: z.number().int().positive(),
});

export const unitStatsSchema = z.strictObject({
  name: z.string().min(1),
  shortName: z.string().min(1),
  role: z.enum(['melee', 'ranged']),
  hp: z.number().int().positive(),
  damage: z.number().int().positive(),
  /** Интервал атак в тиках: 4 = 0,2 с. */
  attackIntervalTicks: z.number().int().positive(),
  /** Задержка первой атаки после вступления в бой, в тиках. */
  firstAttackTicks: z.number().int().nonnegative(),
  /** Работа на одного юнита (M: 1000 работы = 20 тиков = 1 с). */
  work: z.number().int().positive(),
  /** Порядок целей: рода по убыванию приоритета. */
  priority: z.array(unitKindSchema).length(4),
  /** Контр-множитель урона в permille против конкретного рода. */
  counters: z.partialRecord(unitKindSchema, z.number().int().positive()).default({}),
});

export const templateSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Проценты по родам; сумма должна быть 100 (проверяется в content-тесте). */
  percents: z.strictObject({
    swordsman: z.number().int().min(0).max(100),
    archer: z.number().int().min(0).max(100),
    cavalry: z.number().int().min(0).max(100),
    cannon: z.number().int().min(0).max(100),
  }),
});

export const balanceSchema = z.strictObject({
  rulesVersion: z.number().int().positive(),
  contentVersion: z.number().int().positive(),
  planetSizes: z.strictObject({
    S: sizeStatsSchema,
    M: sizeStatsSchema,
    L: sizeStatsSchema,
    XL: sizeStatsSchema,
  }),
  flightSpeedUnitsPerSecond: z.number().int().positive(),
  maxRoutesPerPlanet: z.number().int().positive(),
  supply: z.strictObject({
    /** Резерв от задания каждого рода, permille: 500 = 50%. */
    reservePermille: z.number().int().min(0).max(1000),
    /** Как часто проверять снабжение, в тиках. */
    intervalTicks: z.number().int().positive(),
  }),
  defense: z.strictObject({
    /** Входящий урон по защитникам планеты игрока, permille: 850 = −15%. */
    damagePermille: z.number().int().positive().max(1000),
  }),
  capturePercents: z.strictObject({
    swordsman: z.number().int().min(0).max(100),
    archer: z.number().int().min(0).max(100),
    cavalry: z.number().int().min(0).max(100),
    cannon: z.number().int().min(0).max(100),
  }),
  startingArmy: z.strictObject({
    swordsman: z.number().int().nonnegative(),
    archer: z.number().int().nonnegative(),
    cavalry: z.number().int().nonnegative(),
    cannon: z.number().int().nonnegative(),
  }),
  startingPlan: z.strictObject({
    swordsman: z.number().int().nonnegative(),
    archer: z.number().int().nonnegative(),
    cavalry: z.number().int().nonnegative(),
    cannon: z.number().int().nonnegative(),
  }),
  neutralGarrison: z.strictObject({
    S: z.number().int().nonnegative(),
    M: z.number().int().nonnegative(),
    L: z.number().int().nonnegative(),
    XL: z.number().int().nonnegative(),
  }),
  troops: z.strictObject({
    swordsman: unitStatsSchema,
    archer: unitStatsSchema,
    cavalry: unitStatsSchema,
    cannon: unitStatsSchema,
  }),
  templates: z.array(templateSchema).min(1),
});

export const mapPlanetSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  size: planetSizeSchema,
  x: z.number().int(),
  y: z.number().int(),
  ownerId: z.number().int().min(-1),
  garrison: z.strictObject({
    swordsman: z.number().int().nonnegative(),
    archer: z.number().int().nonnegative(),
    cavalry: z.number().int().nonnegative(),
    cannon: z.number().int().nonnegative(),
  }),
  plan: z
    .strictObject({
      swordsman: z.number().int().nonnegative(),
      archer: z.number().int().nonnegative(),
      cavalry: z.number().int().nonnegative(),
      cannon: z.number().int().nonnegative(),
    })
    .optional(),
});

export const mapDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  playerCount: z.number().int().min(2),
  planets: z.array(mapPlanetSchema).min(2),
});

export type ParsedBalance = z.infer<typeof balanceSchema>;
export type ParsedMap = z.infer<typeof mapDefinitionSchema>;
export type ParsedTemplate = z.infer<typeof templateSchema>;
