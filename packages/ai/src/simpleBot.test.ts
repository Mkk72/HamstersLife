import { BALANCE, getMap } from '@hamsters/content';
import { Simulation, setGarrison } from '@hamsters/core';
import { describe, expect, it } from 'vitest';
import { SimpleBot } from './simpleBot';

function arena() {
  return new Simulation(getMap('arena-duel'), BALANCE, 7);
}

describe('SimpleBot («Боец»)', () => {
  it('бьёт слабого нейтрала при перевесе', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 0);

    const attack = commands.find((command) => command.type === 'SendFleet');
    expect(attack).toBeDefined();
    if (!attack || attack.type !== 'SendFleet') return;
    expect(attack.fromPlanetIds).toEqual([0]);
    expect(attack.ratio).toBe(75);
    expect(attack.toPlanetId).not.toBe(0);
  });

  it('решает не каждый тик, а раз в интервал', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    expect(bot.decide(sim.state, 0).length).toBeGreaterThan(0);
    expect(bot.decide(sim.state, 0)).toEqual([]);

    sim.advance(10);
    expect(bot.decide(sim.state, 0).length).toBeGreaterThan(0);
  });

  it('оставляет резерв и не атакует малым гарнизоном', () => {
    const sim = arena();
    const home = sim.state.planets[0];
    if (!home) throw new Error('нет дома');
    setGarrison(home, 3000);

    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'SendFleet')).toBe(false);
  });

  it('ставит «Колесо ускорения», когда хватает семечек', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    const boost = bot.decide(sim.state, 0).find((command) => command.type === 'ApplyBoost');

    expect(boost?.type).toBe('ApplyBoost');
    if (boost?.type !== 'ApplyBoost') return;
    expect(boost.boost).toBe('production');
    expect(boost.planetId).toBe(0);
  });

  it('не тратит семечки, которых нет', () => {
    const sim = arena();
    const player = sim.state.players[0];
    if (!player) throw new Error('нет игрока');
    player.seeds = 0;

    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'ApplyBoost')).toBe(false);
  });

  it('не атакует, если у цели сильный гарнизон', () => {
    const sim = arena();
    for (const planet of sim.state.planets) {
      if (planet.ownerId === 0) continue;
      setGarrison(planet, 400_000);
    }

    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'SendFleet')).toBe(false);
  });

  it('ставит обучение, когда есть семечки и свободная очередь', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    const training = bot.decide(sim.state, 0).find((command) => command.type === 'TrainTroops');

    expect(training?.type).toBe('TrainTroops');
    if (training?.type !== 'TrainTroops') return;
    expect(training.kind).toBe('swordsman');
    expect(training.amount).toBeGreaterThan(0);
  });

  it('клан задаёт, кого тренирует бот', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    const training = bot.decide(sim.state, 1).find((command) => command.type === 'TrainTroops');

    expect(training?.type).toBe('TrainTroops');
    if (training?.type !== 'TrainTroops') return;
    // игрок 1 — Джунгарские Звёздные, тренирует конницу
    expect(training.kind).toBe('cavalry');
  });

  it('не учит, если семечек хватает только на буст', () => {
    const sim = arena();
    const player = sim.state.players[0];
    if (!player) throw new Error('нет игрока');
    player.seeds = BALANCE.troops.swordsman.costSeeds * 2;

    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 0);
    expect(commands.some((command) => command.type === 'TrainTroops')).toBe(false);
  });

  it('молчит, если игрок выбыл', () => {
    const sim = arena();
    const player = sim.state.players[0];
    if (!player) throw new Error('нет игрока');
    player.alive = false;
    const bot = new SimpleBot(BALANCE);
    expect(bot.decide(sim.state, 0)).toEqual([]);
  });

  it('не считает чужие планеты своими', () => {
    const sim = arena();
    const bot = new SimpleBot(BALANCE);
    const commands = bot.decide(sim.state, 1);
    for (const command of commands) {
      if (command.type !== 'SendFleet') continue;
      for (const id of command.fromPlanetIds) {
        expect(sim.state.planets[id]?.ownerId).toBe(1);
      }
    }
  });
});
