/**
 * Симулятор баланса нового первого этапа.
 *
 * 1. Бои равной производственной стоимости: чистые рода против смешанного.
 * 2. Матчи ботов: кто выигрывает, сколько длится партия.
 *
 * Запуск: pnpm balance:sim
 * Аргументы: BALANCE_ARGS='--matches 6 --only battles'
 */
import {
  Simulation,
  UNIT_KINDS,
  addUnits,
  createGameState,
  planFrom,
  startPlanetBattle,
  runTicks,
} from '@hamsters/core';
import type { Army, GameState, MapDefinition, Plan, UnitKind } from '@hamsters/core';
import { SimpleBot } from '@hamsters/ai';
import { BALANCE } from '@hamsters/content';
import { generateDuelMap } from '@hamsters/levelgen';

interface Options {
  readonly matches: number;
  readonly seed: number;
  readonly bots: boolean;
  readonly battles: boolean;
}

function parseOptions(argv: readonly string[]): Options {
  let matches = 6;
  let seed = 1;
  let only: 'bots' | 'battles' | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--matches' && next) matches = Math.max(1, Number(next));
    if (arg === '--seed' && next) seed = Number(next);
    if (arg === '--only' && next) only = next === 'bots' ? 'bots' : 'battles';
  }
  return {
    matches,
    seed,
    bots: only === null || only === 'bots',
    battles: only === null || only === 'battles',
  };
}

const TOTAL_WORK = 120_000;

/** Равная производственная стоимость: одинаковое количество работы. */
function armyByWork(parts: Partial<Record<UnitKind, number>>): Plan {
  const plan: Plan = { swordsman: 0, archer: 0, cavalry: 0, cannon: 0 };
  let spend = 0;
  for (const kind of UNIT_KINDS) {
    const share = parts[kind] ?? 0;
    if (share <= 0) continue;
    const work = Math.floor((TOTAL_WORK * share) / 100);
    plan[kind] = Math.floor(work / BALANCE.troops[kind].work);
    spend += plan[kind] * BALANCE.troops[kind].work;
  }
  // Остаток работы добираем мечниками, чтобы стоимость была равна.
  plan.swordsman += Math.floor((TOTAL_WORK - spend) / BALANCE.troops.swordsman.work);
  return planFrom(plan);
}

function testMap(): MapDefinition {
  return {
    name: 'balance-field',
    width: 300,
    height: 200,
    playerCount: 2,
    planets: [
      { id: 0, size: 'M', x: 0, y: 0, ownerId: -1, garrison: planFrom({}) },
      { id: 1, size: 'M', x: 100, y: 0, ownerId: 0, garrison: planFrom({}) },
      { id: 2, size: 'M', x: 200, y: 0, ownerId: 1, garrison: planFrom({}) },
    ],
  };
}

interface BattleReport {
  readonly captured: boolean;
  readonly ticks: number;
  readonly attackerLeft: number;
  readonly defenderLeft: number;
}

function fight(attackerPlan: Plan, defenderPlan: Plan): BattleReport {
  const state: GameState = createGameState(testMap(), BALANCE, 1);
  const planet = state.planets[0];
  if (!planet) throw new Error('нет планеты');
  planet.ownerId = -1;
  const defender: Army = [];
  addUnits(defender, defenderPlan, () => state.nextUnitId++, BALANCE.troops);
  planet.army = defender;
  planet.plan = planFrom({});
  const attacker: Army = [];
  addUnits(attacker, attackerPlan, () => state.nextUnitId++, BALANCE.troops);
  const fleet = {
    id: 1,
    ownerId: 0,
    fromPlanetId: 1,
    toPlanetId: 0,
    army: attacker,
    departTick: 0,
    arriveTick: 1,
    startProgressPermille: 0,
  };
  startPlanetBattle(state, planet, fleet, BALANCE);
  const started = state.tick;
  for (let step = 0; step < 2000 && state.battles.length > 0; step += 1) {
    runTicks(state, BALANCE, 1);
  }
  return {
    captured: planet.ownerId === 0,
    ticks: state.tick - started,
    attackerLeft: state.planets[0]?.army.length ?? 0,
    defenderLeft: planet.ownerId === 0 ? 0 : planet.army.length,
  };
}

function battlesTable(): void {
  const armies: { name: string; army: Plan }[] = [
    { name: 'мечники', army: armyByWork({ swordsman: 100 }) },
    { name: 'лучники', army: armyByWork({ archer: 100 }) },
    { name: 'конница', army: armyByWork({ cavalry: 100 }) },
    { name: 'пушки', army: armyByWork({ cannon: 100 }) },
    { name: 'смешанный 45/30/20/5', army: armyByWork({ swordsman: 45, archer: 30, cavalry: 20, cannon: 5 }) },
  ];
  console.log(`\nБои равной производственной стоимости (${TOTAL_WORK} работы):\n`);
  console.log('  атакующий \\ защитник   ' + armies.map((army) => army.name.padEnd(22)).join(''));
  for (const attacker of armies) {
    const row: string[] = [];
    for (const defender of armies) {
      const result = fight(attacker.army, defender.army);
      row.push(
        `${result.captured ? 'победа' : 'пораж.'} ${(result.ticks / 20).toFixed(1)}с`.padEnd(22),
      );
    }
    console.log(`  ${attacker.name.padEnd(22)}${row.join('')}`);
  }
  console.log('\n  Время — длительность боя в секундах; защитник без планетарного бонуса (нейтрал).');
}

interface MatchReport {
  readonly winner: number | null;
  readonly ticks: number;
}

function playMatch(seed: number): MatchReport {
  const map = generateDuelMap(seed);
  const sim = new Simulation(map, BALANCE, seed);
  const bots = [new SimpleBot(BALANCE, { decideEveryTicks: 5 }), new SimpleBot(BALANCE, { decideEveryTicks: 5 })];
  const limit = 20 * 60 * 10;
  while (sim.tick < limit) {
    for (let playerId = 0; playerId < bots.length; playerId += 1) {
      const bot = bots[playerId];
      if (!bot) continue;
      for (const command of bot.decide(sim.state, playerId)) sim.applyCommand(command);
    }
    sim.step();
    const outcome = sim.outcome();
    if (outcome.finished) return { winner: outcome.winnerId, ticks: sim.tick };
  }
  return { winner: null, ticks: sim.tick };
}

function botsTable(options: Options): void {
  let winsFirst = 0;
  let winsSecond = 0;
  let draws = 0;
  let totalTicks = 0;
  for (let index = 0; index < options.matches; index += 1) {
    const result = playMatch(options.seed + index * 7919);
    totalTicks += result.ticks;
    if (result.winner === 0) winsFirst += 1;
    else if (result.winner === 1) winsSecond += 1;
    else draws += 1;
  }
  console.log(`\nМатчи ботов (${options.matches}, сложный профиль):`);
  console.log(`  побед игрока 0: ${winsFirst}, игрока 1: ${winsSecond}, ничьих: ${draws}`);
  console.log(`  средняя длительность: ${(totalTicks / options.matches / 20).toFixed(1)} с`);
  if (draws > 0) console.log('  Ограничение: боты не всегда добивают — ничьи по лимиту времени.');
}

export function runBalanceSim(argv: readonly string[]): void {
  const options = parseOptions(argv);
  console.log('Hamsters Life — симулятор баланса');
  console.log(`  правила ${BALANCE.rulesVersion}, данные ${BALANCE.contentVersion}`);
  if (options.battles) battlesTable();
  if (options.bots) botsTable(options);
}
