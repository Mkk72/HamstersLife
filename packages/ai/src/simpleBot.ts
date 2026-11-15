/**
 * Бот «Боец» — первый уровень сложности.
 *
 * Работает на тех же правилах, что игрок: видит только состояние и отдаёт
 * команды. Никакого чтения скрытых данных. Решения принимаются не каждый тик,
 * а раз в `decideEveryTicks`, иначе бот превращается в шум для сервера.
 *
 * Характер: осторожный. Оставляет резерв (не отправляет планету с малым
 * гарнизоном), бьёт только при перевесе, раз в перезарядку ставит «Колесо».
 */
import {
  defenseForce,
  defensePermille,
  distance,
  type Balance,
  type Bot,
  type Command,
  type GameState,
  type MilliUnits,
  type Planet,
  type PlayerId,
  type Ratio,
} from '@hamsters/core';

export interface SimpleBotOptions {
  /** Как часто принимать решения, в тиках. По умолчанию раз в 10 (0.5 с). */
  readonly decideEveryTicks?: number;
  /** Ниже какого гарнизона планета не атакует (резерв). */
  readonly minAttackGarrison?: MilliUnits;
  /** Насколько attacker должен превышать защиту. 1.15 = +15% запаса. */
  readonly attackMargin?: number;
  readonly attackRatio?: Ratio;
  readonly useBoosts?: boolean;
}

const DEFAULT_OPTIONS = {
  decideEveryTicks: 10,
  minAttackGarrison: 5000,
  attackMargin: 1.15,
  attackRatio: 75 as Ratio,
  useBoosts: true,
} satisfies Required<SimpleBotOptions>;

const SIZE_VALUE: Readonly<Record<Planet['size'], number>> = { S: 1, M: 2, L: 3, XL: 4 };

export class SimpleBot implements Bot {
  readonly name = 'Боец';
  readonly #balance: Balance;
  readonly #options: Required<SimpleBotOptions>;
  #lastDecisionTick = Number.NEGATIVE_INFINITY;

  constructor(balance: Balance, options: SimpleBotOptions = {}) {
    this.#balance = balance;
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  decide(state: Readonly<GameState>, playerId: PlayerId): readonly Command[] {
    const player = state.players[playerId];
    if (!player || !player.alive) return [];
    if (state.tick - this.#lastDecisionTick < this.#options.decideEveryTicks) return [];
    this.#lastDecisionTick = state.tick;

    const commands: Command[] = [];
    const cleanup = this.#decideCleanup(state, playerId);
    if (cleanup) commands.push(cleanup);
    const boost = this.#decideBoost(state, playerId);
    if (boost) commands.push(boost);
    const attack = this.#decideAttack(state, playerId);
    if (attack) commands.push(attack);
    return commands;
  }

  /** Маршрут, который кормит уже свою планету, только мешает — отрезаем. */
  #decideCleanup(state: Readonly<GameState>, playerId: PlayerId): Command | null {
    const route = state.routes.find(
      (candidate) =>
        candidate.ownerId === playerId &&
        state.planets[candidate.toPlanetId]?.ownerId === playerId,
    );
    if (!route) return null;
    return { type: 'RemoveRoute', playerId, routeId: route.id };
  }

  #decideBoost(state: Readonly<GameState>, playerId: PlayerId): Command | null {
    if (!this.#options.useBoosts) return null;
    const player = state.players[playerId];
    if (!player) return null;
    const stats = this.#balance.boosts.production;
    if (player.seeds < stats.cost) return null;
    if (player.boostCooldownUntilTick.production > state.tick) return null;

    const own = state.planets.filter((planet) => planet.ownerId === playerId);
    const best = own.reduce<Planet | null>((current, planet) => {
      if (!current) return planet;
      return SIZE_VALUE[planet.size] > SIZE_VALUE[current.size] ? planet : current;
    }, null);
    if (!best) return null;
    if (planetHasBoost(best, 'production', state.tick)) return null;

    return { type: 'ApplyBoost', playerId, planetId: best.id, boost: 'production' };
  }

  #decideAttack(state: Readonly<GameState>, playerId: PlayerId): Command | null {
    const own = state.planets
      .filter((planet) => planet.ownerId === playerId)
      .filter((planet) => planet.garrison >= this.#options.minAttackGarrison);
    if (own.length === 0) return null;

    const candidates = state.planets
      .filter((planet) => planet.ownerId !== playerId)
      .map((target) => {
        const force = defenseForce(
          target.garrison,
          defensePermille(target, state.tick, this.#balance),
        );
        const value = SIZE_VALUE[target.size] * (target.ownerId === -1 ? 1.2 : 1.5);
        return { target, force, value };
      })
      .sort((a, b) => b.value - a.value);

    for (const candidate of candidates) {
      const need = candidate.force * this.#options.attackMargin;
      const sources: Planet[] = [];
      let troops = 0;

      const byDistance = [...own].sort(
        (a, b) =>
          distance(a.x, a.y, candidate.target.x, candidate.target.y) -
          distance(b.x, b.y, candidate.target.x, candidate.target.y),
      );

      for (const source of byDistance) {
        if (troops > need) break;
        sources.push(source);
        troops += Math.floor((source.garrison * this.#options.attackRatio) / 100);
      }

      if (troops <= need || sources.length === 0) continue;

      return {
        type: 'SendFleet',
        playerId,
        fromPlanetIds: sources.map((source) => source.id),
        toPlanetId: candidate.target.id,
        ratio: this.#options.attackRatio,
      };
    }

    return null;
  }
}

function planetHasBoost(planet: Planet, kind: 'production' | 'speed' | 'defense', tick: number): boolean {
  return (planet.boosts[kind] ?? 0) > tick;
}
