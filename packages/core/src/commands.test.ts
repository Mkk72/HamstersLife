import { describe, expect, it } from 'vitest';
import { troopTotal } from './troops';
import { testBalance } from './__fixtures__/balance';
import { mapFour, mapThree } from './__fixtures__/maps';
import { applyCommand } from './commands';
import { createGameState, garrisonOfPlanet, getPlanet, setGarrison } from './state';
import type { Command } from './types';

function freshMapThree() {
  return createGameState(mapThree, testBalance, 7);
}

function freshMapFour() {
  return createGameState(mapFour, testBalance, 7);
}

describe('SendFleet', () => {
  it('снимает войска с планеты и ставит флот на карту', () => {
    const state = freshMapThree();
    const command: Command = {
      type: 'SendFleet',
      playerId: 0,
      fromPlanetIds: [0],
      toPlanetId: 1,
      ratio: 100,
    };

    const result = applyCommand(state, command, testBalance);

    expect(result).toEqual({ ok: true, fleetIds: [1] });
    expect(garrisonOfPlanet(state, 0)).toBe(0);
    expect(state.fleets).toHaveLength(1);
    expect(state.fleets[0]).toMatchObject({
      id: 1,
      ownerId: 0,
      fromPlanetId: 0,
      toPlanetId: 1,
      departTick: 0,
      arriveTick: 20,
    });
    expect(troopTotal(state.fleets[0]!.troops)).toBe(10_000);
    expect(state.routes).toHaveLength(1);
    expect(state.routes[0]?.weightPermille).toBe(1000);
  });

  it('делит гарнизон по доле', () => {
    const state = freshMapThree();
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 50 },
      testBalance,
    );
    expect(garrisonOfPlanet(state, 0)).toBe(5000);
    expect(troopTotal(state.fleets[0]!.troops)).toBe(5000);
  });

  it('отправляет с нескольких планет отдельными флотами', () => {
    const state = freshMapFour();
    const result = applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0, 1], toPlanetId: 3, ratio: 100 },
      testBalance,
    );

    expect(result.ok).toBe(true);
    expect(state.fleets).toHaveLength(2);
    // порядок флотов — порядок источников; с планеты 1 ближе (50 единиц против 111)
    expect(state.fleets[0]?.fromPlanetId).toBe(0);
    expect(state.fleets[0]?.arriveTick).toBe(23);
    expect(state.fleets[1]?.fromPlanetId).toBe(1);
    expect(state.fleets[1]?.arriveTick).toBe(10);
  });

  it('один и тот же id в списке источников не дублируется', () => {
    const state = freshMapThree();
    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0, 0], toPlanetId: 1, ratio: 50 },
      testBalance,
    );
    expect(state.fleets).toHaveLength(1);
    expect(garrisonOfPlanet(state, 0)).toBe(5000);
  });

  it('ускоряет флот под «Реактивными щеками»', () => {
    const state = freshMapThree();
    const boost = applyCommand(
      state,
      { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'speed' },
      testBalance,
    );
    expect(boost.ok).toBe(true);

    applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 100 },
      testBalance,
    );
    // 100 единиц при 100/с — 20 тиков; при ×1.6 — ceil(2000/160) = 13
    expect(state.fleets[0]?.arriveTick).toBe(13);
  });

  it('отказывает: чужая планета', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [1], toPlanetId: 2, ratio: 100 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'not-your-planet' });
  });

  it('отказывает: неизвестная планета и цель', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [9], toPlanetId: 1, ratio: 100 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'unknown-planet' });
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 9, ratio: 100 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'unknown-planet' });
  });

  it('отказывает: отправка планете себя', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 0, ratio: 100 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'same-planet' });
  });

  it('отказывает: доля вне набора', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 42 as unknown as 25 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'invalid-ratio' });
  });

  it('создаёт маршрут даже если сейчас отряд меньше хомяка', () => {
    const state = freshMapThree();
    const planet = getPlanet(state, 0);
    if (!planet) throw new Error('нет планеты');
    setGarrison(planet, 1000);
    const result = applyCommand(
      state,
      { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 25 },
      testBalance,
    );
    // отряд не сформирован, но стрелка поставлена: дальше пойдёт производство
    expect(result).toEqual({ ok: true, fleetIds: [] });
    expect(state.fleets).toHaveLength(0);
    expect(state.routes).toHaveLength(1);
    expect(state.routes[0]?.weightPermille).toBe(250);
    expect(garrisonOfPlanet(state, 0)).toBe(1000);
  });

  it('отказывает выбывшему игроку', () => {
    const state = freshMapThree();
    const player = state.players[0];
    if (!player) throw new Error('нет игрока');
    player.alive = false;
    expect(
      applyCommand(
        state,
        { type: 'SendFleet', playerId: 0, fromPlanetIds: [0], toPlanetId: 1, ratio: 100 },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'player-dead' });
  });
});

describe('ApplyBoost', () => {
  it('списывает семечки и ставит таймер', () => {
    const state = freshMapThree();
    const result = applyCommand(
      state,
      { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'production' },
      testBalance,
    );

    expect(result.ok).toBe(true);
    expect(state.players[0]?.seeds).toBe(testBalance.startingSeeds - testBalance.boosts.production.cost);
    expect(getPlanet(state, 0)?.boosts.production).toBe(testBalance.boosts.production.durationTicks);
    expect(state.players[0]?.boostCooldownUntilTick.production).toBe(
      testBalance.boosts.production.cooldownTicks,
    );
  });

  it('держит перезарядку', () => {
    const state = freshMapThree();
    const command: Command = { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'production' };
    expect(applyCommand(state, command, testBalance).ok).toBe(true);
    expect(applyCommand(state, command, testBalance)).toEqual({ ok: false, error: 'cooldown' });
  });

  it('не хватает семечек — отказ без списания', () => {
    const state = freshMapThree();
    const player = state.players[0];
    if (!player) throw new Error('нет игрока');
    player.seeds = 0;
    expect(
      applyCommand(
        state,
        { type: 'ApplyBoost', playerId: 0, planetId: 0, boost: 'defense' },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'not-enough-seeds' });
    expect(getPlanet(state, 0)?.boosts.defense).toBe(0);
  });

  it('отказывает на чужой планете', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'ApplyBoost', playerId: 0, planetId: 2, boost: 'production' },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'wrong-boost-target' });
  });

  it('отказывает на нейтральной планете', () => {
    const state = freshMapThree();
    expect(
      applyCommand(
        state,
        { type: 'ApplyBoost', playerId: 0, planetId: 1, boost: 'production' },
        testBalance,
      ),
    ).toEqual({ ok: false, error: 'wrong-boost-target' });
  });
});
