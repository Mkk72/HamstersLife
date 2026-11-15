/**
 * Ручной прогон симулятора баланса через Vitest (без отдельного раннера):
 *
 *   pnpm balance:sim
 *   $env:BALANCE_ARGS='--matches 40 --only comps'; pnpm balance:sim
 *
 * Файл лежит вне пакетов, поэтому обычный `pnpm test` его не запускает.
 */
import { describe, expect, it } from 'vitest';
import { runBalanceSim } from './balance-sim';

describe('симулятор баланса', () => {
  it('печатает отчёт', () => {
    const args = (process.env.BALANCE_ARGS ?? '')
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    runBalanceSim(args);
    expect(true).toBe(true);
  });
});
