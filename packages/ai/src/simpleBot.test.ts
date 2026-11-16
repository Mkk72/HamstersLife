import { describe, expect, it } from 'vitest';
import { BALANCE, getMap } from '@hamsters/content';
import { Simulation, addUnits, planFrom } from '@hamsters/core';
import { BOT_PRESETS } from './presets';
import { SimpleBot } from './simpleBot';

function arena() {
  return new Simulation(getMap('arena-duel'), BALANCE, 1);
}

describe('бот первого этапа', () => {
  it('ставит шаблон плана, если план пуст', () => {
    const sim = arena();
    const planet = sim.state.planets[0];
    if (!planet) throw new Error('нет планеты');
    planet.plan = { swordsman: 0, archer: 0, cavalry: 0, cannon: 0 };
    const bot = new SimpleBot(BALANCE, BOT_PRESETS.normal.options);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'ApplyTemplate')).toBe(true);
  });

  it('нападает на слабого нейтрала', () => {
    const sim = arena();
    const neutral = sim.state.planets.find((planet) => planet.ownerId === -1);
    if (!neutral) throw new Error('нет нейтрала');
    neutral.army = [];
    const bot = new SimpleBot(BALANCE, BOT_PRESETS.normal.options);
    const commands = bot.decide(sim.state, 0);
    const attack = commands.find((command) => command.type === 'SendFleet');
    expect(attack).toBeDefined();
    if (attack?.type !== 'SendFleet') return;
    expect(attack.toPlanetId).toBe(neutral.id);
  });

  it('лёгкий бот не атакует игрока, пока есть нейтралы', () => {
    const sim = arena();
    const playerPlanet = sim.state.planets[1];
    if (!playerPlanet) throw new Error('нет планеты игрока');
    playerPlanet.army = [];
    for (const planet of sim.state.planets) {
      if (planet.ownerId !== -1) continue;
      planet.army = [];
      addUnits(
        planet.army,
        planFrom({ swordsman: 100 }),
        () => sim.state.nextUnitId++,
        BALANCE.troops,
      );
    }

    const easy = new SimpleBot(BALANCE, BOT_PRESETS.easy.options);
    const easyAttacks = easy
      .decide(sim.state, 0)
      .filter((command) => command.type === 'SendFleet');
    expect(easyAttacks).toHaveLength(0);

    const normal = new SimpleBot(BALANCE, BOT_PRESETS.normal.options);
    const normalAttacks = normal
      .decide(sim.state, 0)
      .filter((command) => command.type === 'SendFleet');
    expect(normalAttacks.some((command) => command.type === 'SendFleet' && command.toPlanetId === 1)).toBe(
      true,
    );
  });

  it('включает снабжение на своём выключенном маршруте', () => {
    const sim = arena();
    sim.state.routes.push({
      id: 1,
      ownerId: 0,
      fromPlanetId: 0,
      toPlanetId: 6,
      weightPermille: 1000,
      supplyEnabled: false,
      supplyKinds: ['swordsman', 'archer', 'cavalry', 'cannon'],
    });
    const bot = new SimpleBot(BALANCE, BOT_PRESETS.normal.options);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'EnableSupply')).toBe(true);
  });
});
