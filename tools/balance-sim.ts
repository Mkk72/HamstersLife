/**
 * Симулятор баланса: прогоняет матчи ботов по кланам и проверяет составы
 * фазовым боем. Числа берутся из `@hamsters/content`, поэтому после правки
 * баланса достаточно перезапустить:
 *
 *   pnpm balance:sim              # 24 матча на пару кланов, 21 соотношение бюджетов
 *   pnpm balance:sim -- --matches 60
 */
import {
  CLAN_IDS,
  Simulation,
  createTroopStack,
  resolveFieldBattle,
  troopTotal,
} from '@hamsters/core';
import type { ClanId, TroopKind } from '@hamsters/core';
import { SimpleBot } from '@hamsters/ai';
import { BALANCE, getMap } from '@hamsters/content';
import { generateDuelMap } from '@hamsters/levelgen';

interface Options {
  readonly matches: number;
  readonly seed: number;
  readonly limitTicks: number;
  readonly clans: boolean;
  readonly compositions: boolean;
}

function parseOptions(argv: readonly string[]): Options {
  let matches = 24;
  let seed = 1;
  let only: 'clans' | 'compositions' | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--matches' && next) matches = Math.max(1, Number(next));
    if (arg === '--seed' && next) seed = Number(next);
    if (arg === '--only' && next) only = next === 'clans' ? 'clans' : 'compositions';
  }
  return {
    matches,
    seed,
    limitTicks: 20 * 60 * 15,
    clans: only === null || only === 'clans',
    compositions: only === null || only === 'compositions',
  };
}

interface MatchOutcome {
  readonly winner: number | null;
  readonly ticks: number;
}

/** Один матч ботов на сгенерированной карте; кланы назначаются до старта. */
function playMatch(
  seed: number,
  clans: readonly ClanId[],
  limitTicks: number,
  firstPlayer: 0 | 1,
): MatchOutcome {
  const map = seed % 3 === 0 ? getMap('arena-duel') : generateDuelMap(seed);
  const sim = new Simulation(map, BALANCE, seed);

  for (let playerId = 0; playerId < sim.state.players.length; playerId += 1) {
    const player = sim.state.players[playerId];
    const clanId = clans[playerId];
    if (player && clanId) player.clanId = clanId;
  }

  const bots = sim.state.players.map(() => new SimpleBot(BALANCE));
  const order = [firstPlayer, firstPlayer === 0 ? 1 : 0];

  while (sim.tick < limitTicks) {
    for (const playerId of order) {
      const bot = bots[playerId];
      if (!bot) continue;
      for (const command of bot.decide(sim.state, playerId)) {
        sim.applyCommand(command);
      }
    }
    sim.step();
    const outcome = sim.outcome();
    if (outcome.finished) return { winner: outcome.winnerId, ticks: sim.tick };
  }

  return { winner: null, ticks: sim.tick };
}

function clanTable(options: Options): void {
  const stats = new Map<ClanId, { games: number; wins: number }>(
    CLAN_IDS.map((clan) => [clan, { games: 0, wins: 0 }]),
  );

  console.log(`\nКланы: ${options.matches} матчей на пару в обеих посадках (сид ${options.seed})\n`);

  for (let left = 0; left < CLAN_IDS.length; left += 1) {
    for (let right = left + 1; right < CLAN_IDS.length; right += 1) {
      const first = CLAN_IDS[left];
      const second = CLAN_IDS[right];
      if (!first || !second) continue;

      let firstWins = 0;
      let secondWins = 0;
      let draws = 0;

      for (let match = 0; match < options.matches; match += 1) {
        const seed = options.seed * 100_003 + match * 7919;
        const seatings: readonly (readonly [ClanId, ClanId])[] = [
          [first, second],
          [second, first],
        ];

        // Обе посадки и оба порядка хода: иначе побеждает место за столом,
        // а не клан.
        for (let seatIndex = 0; seatIndex < seatings.length; seatIndex += 1) {
          const seating = seatings[seatIndex];
          if (!seating) continue;

          for (const firstPlayer of [0, 1] as const) {
            const outcome = playMatch(
              seed + seatIndex * 2 + firstPlayer,
              seating,
              options.limitTicks,
              firstPlayer,
            );
            const firstStats = stats.get(first);
            const secondStats = stats.get(second);
            if (firstStats) firstStats.games += 1;
            if (secondStats) secondStats.games += 1;

            if (outcome.winner === null) {
              draws += 1;
              continue;
            }
            const winner = seating[outcome.winner] ?? null;
            if (winner === first) {
              firstWins += 1;
              if (firstStats) firstStats.wins += 1;
            } else if (winner === second) {
              secondWins += 1;
              if (secondStats) secondStats.wins += 1;
            }
          }
        }
      }

      const total = firstWins + secondWins + draws;
      const firstRate = Math.round((firstWins / total) * 100);
      const secondRate = Math.round((secondWins / total) * 100);
      console.log(
        `  ${first.padEnd(16)} ${String(firstRate).padStart(3)}%  vs  ${second.padEnd(16)} ${String(secondRate).padStart(3)}%  (ничьих ${draws}/${total})`,
      );
    }
  }

  console.log('\nИтог по кланам:');
  for (const [clan, clanStats] of stats) {
    const rate = clanStats.games === 0 ? 0 : Math.round((clanStats.wins / clanStats.games) * 100);
    console.log(
      `  ${clan.padEnd(16)} ${String(rate).padStart(3)}% (${clanStats.wins}/${clanStats.games})`,
    );
  }
}

interface Army {
  readonly name: string;
  readonly troops: Record<TroopKind, number>;
}

function compositionTable(): void {
  const budgetSeeds = 200_000;
  const single = (kind: TroopKind, name: string): Army => ({
    name,
    troops: createTroopStack({
      [kind]: Math.floor(budgetSeeds / BALANCE.troops[kind].costSeeds) * 1000,
    }),
  });

  const armies: Army[] = [
    single('swordsman', 'мечники'),
    single('archer', 'лучники'),
    single('cannon', 'пушки'),
    single('cavalry', 'конница'),
    single('mage', 'маги'),
    {
      name: 'смешанный 40/30/30',
      troops: createTroopStack({
        swordsman: Math.floor((budgetSeeds * 0.4) / BALANCE.troops.swordsman.costSeeds) * 1000,
        archer: Math.floor((budgetSeeds * 0.3) / BALANCE.troops.archer.costSeeds) * 1000,
        cavalry: Math.floor((budgetSeeds * 0.3) / BALANCE.troops.cavalry.costSeeds) * 1000,
      }),
    },
  ];

  console.log(`\nСоставы равной стоимости (бюджет ${budgetSeeds / 1000} семечек), бой при защите 1.0\n`);
  const header = ['атакующий \\ защитник', ...armies.map((army) => army.name)];
  console.log(`  ${header.map((cell) => cell.padEnd(18)).join('')}`);

  for (const attacker of armies) {
    const cells: string[] = [];
    for (const defender of armies) {
      const result = resolveFieldBattle(
        attacker.troops,
        defender.troops,
        1000,
        BALANCE,
      );
      const attackerLeft = troopTotal(result.attacker);
      const defenderLeft = troopTotal(result.defender);
      const mark = result.captured ? `+${Math.round(attackerLeft / 1000)}` : `−${Math.round(defenderLeft / 1000)}`;
      cells.push(mark.padEnd(18));
    }
    console.log(`  ${attacker.name.padEnd(18)}${cells.join('')}`);
  }
  console.log('\n  +N — атакующий захватил планету с N хомяками; −N — защитник удержал с N.');
}

export function runBalanceSim(argv: readonly string[]): void {
  const options = parseOptions(argv);
  console.log('Hamsters Life — симулятор баланса');
  console.log(`  правила ${BALANCE.rulesVersion}, данные ${BALANCE.contentVersion}`);
  if (options.clans) clanTable(options);
  if (options.compositions) compositionTable();
}
