/**
 * Схемы контента. Данные (баланс, карты) лежат в JSON и проверяются здесь при
 * загрузке: ошибка в числе — падение на старте, а не расхождение в игре.
 * `strictObject` не пропускает лишние поля: опечатка в JSON тоже ловится.
 */
import { z } from 'zod';

export const planetSizeSchema = z.enum(['S', 'M', 'L', 'XL']);

export const boostKindSchema = z.enum(['production', 'speed', 'defense']);

export const sizeStatsSchema = z.strictObject({
  capacity: z.number().int().positive(),
  /** Кратно 20: производство превращается в «за тик» делением нацело. */
  productionPerSecond: z.number().int().positive().multipleOf(20),
});

export const boostStatsSchema = z.strictObject({
  cost: z.number().int().nonnegative(),
  durationTicks: z.number().int().positive(),
  cooldownTicks: z.number().int().positive(),
  factorPermille: z.number().int().min(1000),
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
  seedsPerPlanetPerSecond: z.number().int().nonnegative().multipleOf(20),
  startingSeeds: z.number().int().nonnegative(),
  boosts: z.strictObject({
    production: boostStatsSchema,
    speed: boostStatsSchema,
    defense: boostStatsSchema,
  }),
  minCaptureGarrison: z.number().int().positive(),
  maxRoutesPerPlanet: z.number().int().positive(),
  minRouteFleet: z.number().int().positive(),
});

export const mapPlanetSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  size: planetSizeSchema,
  x: z.number().int(),
  y: z.number().int(),
  ownerId: z.number().int().min(-1),
  garrisonHamsters: z.number().int().nonnegative(),
  defensePermille: z.number().int().min(1000).optional(),
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
