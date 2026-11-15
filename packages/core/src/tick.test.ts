import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour, mapThree } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { createGameState, getPlanet } from './state';
import { evaluateOutcome, runTicks, step } from './tick';

describe('производство и семечки', () => {
  it('растит гарнизон каждый тик и не трогает нейтралов', () => {
    const state = createGameState(mapThree, testBalance, 3);
    runTicks(state, testBalance, 10);
    // M: 1000/с → 50 за тик
    expect(getPlanet(state, 0)?.garrison).toBe(10_500);
    expect(getPlanet(state, 1)?.garrison).toBe(5000);
    expect(state.tick).toBe(10);
  });

  it('останавливается на вместимости', () => {
    const state = createGameState(mapFour, testBalance, 3);
    runTicks(state, testBalance, 100);
    // S: 600/с → 30 за тик, вместимость 6000, старт 5000
    expect(getPlanet(state, 1)?.garrison).toBe(6000);
    expect(getPlanet(state, 0)?.garrison).toBe(12_000);
  });

  it('капает семечки с каждой своей планеты', () => {
    const state = createGameState(mapFour, testBalance, 3);
    const before = state.players[0]?.seeds ?? 0;
    runTicks(state, testBalance, 20);
    // 4 семечка/с при 2 планетах = 8/с → 200 milli-семечка за тик на планету
    expect(state.players[0]?.seeds).toBe(before + 2 * 200 * 20);
  });
});

describe('захват и оборона', () => {
  it('захватывает нейтрала и оставляет остаток', () => {
    const state = createGameState(mapThree, testBalance, 3);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 20);

    const target = getPlanet(state, 1);
    expect(target?.ownerId).toBe(0);
    expect(target?.garrison).toBe(5000);
    // вся продукция уходит в маршрут: гарнизон остаётся нулевым,
    // к 20-му тику маршрут накопил 1000 mH и выпустил отряд;
    // при захвате планеты маршрут на неё сгорает, а отряд остаётся в полёте
    expect(getPlanet(state, 0)?.garrison).toBe(0);
    expect(state.routes).toHaveLength(0);
    expect(state.fleets).toHaveLength(1);
    expect(state.fleets[0]?.troops).toBe(1000);
  });

  it('складывает гарнизон при подкреплении своей планеты', () => {
    const state = createGameState(mapFour, testBalance, 3);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 20);

    // 5000 + 30 × 20 = 5600, затем + 10 000 подкрепления сверх вместимости
    expect(getPlanet(state, 1)?.garrison).toBe(15_600);
  });

  it('уничтожает равные одновременные флоты — планета остаётся нейтральной', () => {
    const state = createGameState(mapFour, testBalance, 3);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 100 },
      testBalance,
    );
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 3, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 23);

    const target = getPlanet(state, 3);
    expect(target?.ownerId).toBe(-1);
    expect(target?.garrison).toBe(5000);
  });

  it('побеждает сильнейший из одновременных, затем упирается в гарнизон', () => {
    const state = createGameState(mapFour, testBalance, 3);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 3, ratio: 100 },
      testBalance,
    );
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 3, ratio: 50 },
      testBalance,
    );

    runTicks(state, testBalance, 23);

    const target = getPlanet(state, 3);
    // 10 000 против 5000 → у атакующего остаётся 5000, ровно столько же в гарнизоне
    expect(target?.ownerId).toBe(-1);
    expect(target?.garrison).toBe(0);
  });

  it('«Ореховая скорлупа» спасает планету от превосходящего отряда', () => {
    const state = createGameState(mapFour, testBalance, 3);
    applyCommand(
      state,
      { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'defense' },
      testBalance,
    );
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 0, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 40);

    const planet = getPlanet(state, 0);
    expect(planet?.ownerId).toBe(0);
    // гарнизон дорос до 12 000, защита ×1.8 = 21 600; остаток (21 600 − 10 000) / 1.8
    expect(planet?.garrison).toBe(6444);
  });

  it('без буста тот же штурм заканчивается иначе', () => {
    const state = createGameState(mapFour, testBalance, 3);
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 1, fromPlanetIds: [2], toPlanetId: 0, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 40);

    const planet = getPlanet(state, 0);
    expect(planet?.ownerId).toBe(0);
    expect(planet?.garrison).toBe(2000);
  });

  it('снимает бусты с захваченной планеты', () => {
    const state = createGameState(mapFour, testBalance, 3);
    const target = getPlanet(state, 2);
    if (!target) throw new Error('нет планеты');
    target.garrison = 1000;
    applyCommand(
      state,
      { type: 'ApplyBoost', playerId: 1, planetId: 2, boost: 'production' },
      testBalance,
    );
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 2, ratio: 100 },
      testBalance,
    );

    runTicks(state, testBalance, 40);

    const planet = getPlanet(state, 2);
    expect(planet?.ownerId).toBe(0);
    expect(planet?.boosts.production).toBe(0);
  });
});

describe('шаги и итог партии', () => {
  it('шаг увеличивает тик ровно на один', () => {
    const state = createGameState(mapThree, testBalance, 3);
    step(state, testBalance);
    expect(state.tick).toBe(1);
    step(state, testBalance);
    expect(state.tick).toBe(2);
  });

  it('выбывает игрок без планет и флотов', () => {
    const state = createGameState(mapThree, testBalance, 3);
    const planet = getPlanet(state, 2);
    if (!planet) throw new Error('нет планеты');
    planet.ownerId = 0;

    step(state, testBalance);

    expect(state.players[1]?.alive).toBe(false);
    expect(evaluateOutcome(state)).toEqual({ finished: true, winnerId: 0 });
  });

  it('идёт, пока живы двое', () => {
    const state = createGameState(mapThree, testBalance, 3);
    step(state, testBalance);
    expect(evaluateOutcome(state)).toEqual({ finished: false, winnerId: null });
  });
});
