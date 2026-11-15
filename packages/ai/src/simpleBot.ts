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
    const boost = this.#decideBoost(state, playerId);
    if (boost) commands.push(boost);
    const attack = this.#decideAttack(state, playerId);
    if (attack) commands.push(attack);
    return commands;
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
      .filter((planet) => planet.garrison >= this.#options.minAttackGarrison)
      .sort((a, b) => b.garrison - a.garrison);

    const targets = state.planets.filter((planet) => planet.ownerId !== playerId);
    if (targets.length === 0) return null;

    for (const source of own) {
      const troops = Math.floor((source.garrison * this.#options.attackRatio) / 100);
      if (troops <= 0) continue;

      let best: { target: Planet; score: number } | null = null;
      for (const target of targets) {
        const force = defenseForce(
          target.garrison,
          defensePermille(target, state.tick, this.#balance),
        );
        if (troops <= force * this.#options.attackMargin) continue;

        const value = SIZE_VALUE[target.size] * (target.ownerId === -1 ? 1.2 : 1.5);
        const travel = distance(source.x, source.y, target.x, target.y) + 1;
        const score = value / travel;
        if (!best || score > best.score) best = { target, score };
      }

      if (best) {
        return {
          type: 'SendFleet',
          playerId,
          fromPlanetIds: [source.id],
          toPlanetId: best.target.id,
          ratio: this.#options.attackRatio,
        };
      }
    }

    return null;
  }
}

function planetHasBoost(planet: Planet, kind: 'production' | 'speed' | 'defense', tick: number): boolean {
  return (planet.boosts[kind] ?? 0) > tick;
}
