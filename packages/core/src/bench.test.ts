/**
 * Дымовой бенчмарк ядра: 40 планет и 300 флотов в полёте.
 *
 * Это не микро-оптимизация, а страховка бюджета: тик обязан укладываться в
 * кадр с большим запасом. Порог намеренно щедрый, чтобы тест не «мигал» на
 * слабых машинах CI, но ловил порядковые регрессии (например, O(n²) в тике).
 */
import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { Simulation } from './simulation';
import type { MapDefinition } from './types';

function bigMap(): MapDefinition {
  const planets = Array.from({ length: 40 }, (_, index) => ({
    id: index,
    size: index % 5 === 0 ? ('L' as const) : ('M' as const),
    x: 80 + (index % 8) * 140,
    y: 80 + Math.floor(index / 8) * 130,
    ownerId: index < 20 ? 0 : 1,
    garrisonHamsters: 12,
  }));
  return { name: 'bench', width: 1200, height: 700, playerCount: 2, planets };
}

describe('производительность тика', () => {
  it('40 планет и 300 флотов: 1000 тиков заметно быстрее реального времени', () => {
    const sim = new Simulation(bigMap(), testBalance, 1);
    const fleets = sim.state.fleets;
    for (let index = 0; index < 300; index += 1) {
      fleets.push({
        id: 10_000 + index,
        ownerId: index % 2,
        fromPlanetId: index % 40,
        toPlanetId: (index + 7) % 40,
        troops: 1000,
        departTick: 0,
        arriveTick: 10_000,
      });
    }

    const started = Date.now();
    sim.advance(1000);
    const elapsed = Date.now() - started;

    expect(sim.state.fleets).toHaveLength(300);
    // 1000 тиков = 50 секунд игрового времени; даже 5 секунд реального — порядок нормы.
    expect(elapsed).toBeLessThan(5000);
  });
});
