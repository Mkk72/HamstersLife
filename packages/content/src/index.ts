/**
 * Точка входа контента: провалидированные баланс, рода, шаблоны и карты.
 *
 * Валидация выполняется один раз при импорте. Клиент и сервер получают один и
 * тот же объект, поэтому числа не могут разъехаться между ними.
 */
import type { Balance, ContentProvider, MapDefinition } from '@hamsters/core';
import arenaDuelJson from './data/arena-duel.json';
import balanceJson from './data/balance.json';
import templatesJson from './data/templates.json';
import troopsJson from './data/troops.json';
import { balanceSchema, mapDefinitionSchema } from './schema';

export const BALANCE: Balance = balanceSchema.parse({
  ...balanceJson,
  troops: troopsJson,
  templates: templatesJson,
});

const arenaDuel: MapDefinition = mapDefinitionSchema.parse(arenaDuelJson);

export const MAPS: Readonly<Record<string, MapDefinition>> = {
  'arena-duel': arenaDuel,
};

export const DEFAULT_MAP = 'arena-duel';

export function getMap(name: string): MapDefinition {
  const map = MAPS[name];
  if (!map) throw new Error(`Неизвестная карта: ${name}`);
  return map;
}

/**
 * Реализация порта `ContentProvider` из ядра. Клиент и бот берут данные только
 * через этот интерфейс, поэтому в тестах его можно заменить фикстурой.
 */
export const CONTENT: ContentProvider = {
  balance: BALANCE,
  defaultMapName: DEFAULT_MAP,
  getMap,
};

export * from './schema';
