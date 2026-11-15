/**
 * Детерминированный генератор псевдослучайных чисел (mulberry32).
 *
 * Свой PRNG, а не Math.random: seed входит в состояние, повтор матча должен
 * воспроизводиться на клиенте, на сервере и в тестах.
 */
export interface Rng {
  /** Следующее 32-битное беззнаковое число. */
  nextUint32(): number;
  /** Целое в диапазоне [min, maxExclusive). */
  nextInt(min: number, maxExclusive: number): number;
  /** Целое в диапазоне [min, max] включительно. */
  nextIntInclusive(min: number, max: number): number;
  /** Permille-доля в диапазоне [0, 1000]. */
  nextPermille(): number;
  /** Копия начального seed. */
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  const initialSeed = seed >>> 0;
  let state = initialSeed;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextInt = (min: number, maxExclusive: number): number => {
    const span = maxExclusive - min;
    if (span <= 0) return min;
    return min + (nextUint32() % span);
  };

  return {
    seed: initialSeed,
    nextUint32,
    nextInt,
    nextIntInclusive: (min, max) => nextInt(min, max + 1),
    nextPermille: () => nextUint32() % 1000,
  };
}
