import { describe, expect, it } from 'vitest';
import { testBalance } from './__fixtures__/balance';
import { mapFour, mapThree } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { hashState } from './hash';
import { createGameState, getPlanet } from './state';
import { runTicks, step } from './tick';
import type { Balance } from './types';

function fresh() {
  return createGameState(mapFour, testBalance, 5);
}

function send(
  state: ReturnType<typeof fresh>,
  fromPlanetIds: number[],
  toPlanetId: number,
  ratio: 25 | 50 | 75 | 100,
  balance: Balance = testBalance,
) {
  return applyCommand(
    state,
    { type: 'SendFleet', playerId: 0, fromPlanetIds, toPlanetId, ratio },
    balance,
  );
}

describe('маршруты: создание и вес', () => {
  it('создаёт маршрут и сразу отправляет выбранную долю', () => {
    const state = fresh();
    const result = send(state, [0], 3, 50);

    expect(result.ok).toBe(true);
    expect(state.routes).toHaveLength(1);
    expect(state.routes[0]).toMatchObject({
      ownerId: 0,
      fromPlanetId: 0,
      toPlanetId: 3,
      weightPermille: 500,
      pending: 0,
    });
    expect(getPlanet(state, 0)?.garrison).toBe(5000);
    expect(state.fleets).toHaveLength(1);
    expect(state.fleets[0]?.troops).toBe(5000);
  });

  it('повторная стрелка меняет вес и не списывает войска снова', () => {
    const state = fresh();
    send(state, [0], 3, 50);
    const garrison = getPlanet(state, 0)?.garrison;

    send(state, [0], 3, 75);

    expect(state.routes).toHaveLength(1);
    expect(state.routes[0]?.weightPermille).toBe(750);
    expect(getPlanet(state, 0)?.garrison).toBe(garrison);
    expect(state.fleets).toHaveLength(1);
  });

  it('держит лимит маршрутов с планеты', () => {
    const limitTwo: Balance = { ...testBalance, maxRoutesPerPlanet: 2 };
    const state = createGameState(mapFour, limitTwo, 5);
    expect(send(state, [0], 1, 25, limitTwo).ok).toBe(true);
    expect(send(state, [0], 2, 25, limitTwo).ok).toBe(true);
    expect(send(state, [0], 3, 25, limitTwo)).toEqual({ ok: false, error: 'too-many-routes' });
  });
});

describe('маршруты: поток производства', () => {
  it('половина производства уходит в маршрут, половина остаётся', () => {
    const state = fresh();
    send(state, [0], 3, 50); // гарнизон 5000, вес 50%
    step(state, testBalance);

    // M: 50 mH за тик; в маршрут 25, в гарнизон 25
    expect(state.routes[0]?.pending).toBe(25);
    expect(getPlanet(state, 0)?.garrison).toBe(5025);
  });

  it('накапливает отряд на один хомяк и выпускает его', () => {
    const state = fresh();
    send(state, [0], 3, 50);
    runTicks(state, testBalance, 39);
    expect(state.routes[0]?.pending).toBe(25 * 39);
    // первый отряд уже прилетел и разбился о равный гарнизон
    expect(state.fleets).toHaveLength(0);

    runTicks(state, testBalance, 1);
    expect(state.routes[0]?.pending).toBe(0);
    expect(state.fleets).toHaveLength(1);
  });

  it('три стрелки по 50% делят поток по трети (нормализация)', () => {
    const state = fresh();
    send(state, [0], 1, 50);
    send(state, [0], 2, 50);
    send(state, [0], 3, 50);
    step(state, testBalance);

    // всего 50 mH на три маршрута: 17 + 17 + 16 (крупнейшие остатки)
    expect(state.routes.map((route) => route.pending)).toEqual([17, 17, 16]);
    expect(getPlanet(state, 0)?.garrison).toBe(1250);
  });

  it('100/100/50 делится как 40/40/20 процентов', () => {
    const state = fresh();
    send(state, [0], 1, 100);
    send(state, [0], 2, 100);
    send(state, [0], 3, 50);
    step(state, testBalance);

    expect(state.routes.map((route) => route.pending)).toEqual([20, 20, 10]);
  });

  it('на вместимости в маршрут уходит всё производство', () => {
    const state = fresh();
    send(state, [0], 3, 50);
    const planet = getPlanet(state, 0);
    if (!planet) throw new Error('нет планеты');
    planet.garrison = testBalance.planetSizes.M.capacity;

    step(state, testBalance);

    expect(planet.garrison).toBe(testBalance.planetSizes.M.capacity);
    expect(state.routes[0]?.pending).toBe(50);
  });

  it('подкрепление сверх вместимости не вытекает в маршрут', () => {
    const state = fresh();
    send(state, [0], 3, 50); // маршрут с планеты 0
    const planet = getPlanet(state, 0);
    if (!planet) throw new Error('нет планеты');
    const capacity = testBalance.planetSizes.M.capacity;

    // пришло подкрепление, гарнизон выше предела
    planet.garrison = capacity + 5000;
    step(state, testBalance);

    // ушла только генерация (50 mH), весь излишек остался в гарнизоне
    expect(planet.garrison).toBe(capacity + 5000);
    expect(state.routes[0]?.pending).toBe(50);
  });

  it('без маршрутов излишек подкрепления тоже сохраняется', () => {
    const state = createGameState(mapThree, testBalance, 5);
    const planet = getPlanet(state, 0);
    if (!planet) throw new Error('нет планеты');
    planet.garrison = testBalance.planetSizes.M.capacity + 7000;

    runTicks(state, testBalance, 10);

    expect(planet.garrison).toBe(testBalance.planetSizes.M.capacity + 7000);
  });

  it('без маршрутов производство копится до вместимости', () => {
    const state = createGameState(mapThree, testBalance, 5);
    runTicks(state, testBalance, 100);
    expect(getPlanet(state, 0)?.garrison).toBe(testBalance.planetSizes.M.capacity);
  });
});

describe('маршруты: удаление', () => {
  it('отрезает маршрут командой', () => {
    const state = fresh();
    send(state, [0], 3, 50);
    const routeId = state.routes[0]?.id;
    if (routeId === undefined) throw new Error('нет маршрута');

    const result = applyCommand(
      state,
      { type: 'RemoveRoute', playerId: 0, routeId },
      testBalance,
    );
    expect(result.ok).toBe(true);
    expect(state.routes).toHaveLength(0);
  });

  it('отказывает на чужом и неизвестном маршруте', () => {
    const state = fresh();
    send(state, [0], 3, 50);
    const routeId = state.routes[0]?.id ?? 0;

    expect(
      applyCommand(state, { type: 'RemoveRoute', playerId: 1, routeId }, testBalance),
    ).toEqual({ ok: false, error: 'not-your-route' });
    expect(
      applyCommand(state, { type: 'RemoveRoute', playerId: 0, routeId: 999 }, testBalance),
    ).toEqual({ ok: false, error: 'unknown-route' });
  });

  it('сгорают при захвате планеты', () => {
    const state = fresh();
    const victim = getPlanet(state, 2);
    if (!victim) throw new Error('нет планеты');
    victim.garrison = 1000;

    send(state, [0], 2, 100); // маршрут на вражескую планету
    send(state, [1], 3, 50); // маршрут в сторону, его не должно задеть
    runTicks(state, testBalance, 40);

    expect(getPlanet(state, 2)?.ownerId).toBe(0);
    expect(state.routes).toHaveLength(1);
    expect(state.routes[0]?.toPlanetId).toBe(3);
  });
});

describe('маршруты и детерминизм', () => {
  it('состояние маршрутов входит в хэш', () => {
    const first = fresh();
    const second = fresh();
    send(first, [0], 3, 50);
    send(second, [0], 3, 50);
    step(first, testBalance);
    step(second, testBalance);
    expect(hashState(first)).toBe(hashState(second));

    runTicks(first, testBalance, 10);
    expect(hashState(first)).not.toBe(hashState(second));
  });
});
