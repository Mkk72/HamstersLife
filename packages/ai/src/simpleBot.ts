/**
 * Бот первого этапа: играет теми же командами и экономикой, что человек.
 * План гарнизона, разовые атаки, включение снабжения — без семечек и бустов.
 */
import type {
  Army,
  Balance,
  Bot,
  Command,
  GameState,
  Planet,
  PlayerId,
  Ratio,
  UnitKind,
} from '@hamsters/core';
import { countsOf, planSum } from '@hamsters/core';

export interface SimpleBotOptions {
  readonly decideEveryTicks?: number;
  /** Насколько своя сила должна превышать защиту цели. */
  readonly attackMargin?: number;
  readonly attackRatio?: Ratio;
  readonly useSupply?: boolean;
  /** Атаковать ли игрока; иначе только нейтралов. */
  readonly targetPlayers?: boolean;
  /** Шаблон плана для новых планет. */
  readonly templateId?: string;
  /** Менять шаблон под состав врага (сильный бот). */
  readonly adaptTemplate?: boolean;
}

const DEFAULTS = {
  decideEveryTicks: 10,
  attackMargin: 1.25,
  attackRatio: 75 as Ratio,
  useSupply: true,
  targetPlayers: true,
  templateId: 'balanced',
  adaptTemplate: false,
} satisfies Required<SimpleBotOptions>;

const SIZE_VALUE: Readonly<Record<Planet['size'], number>> = { S: 1, M: 2, L: 3, XL: 4 };

/** Грубая сила армии: запас HP × урон в секунду. */
function armyPower(army: readonly Army[number][], balance: Balance): number {
  let hp = 0;
  let damage = 0;
  for (const unit of army) {
    const stats = balance.troops[unit.kind];
    hp += Math.max(0, unit.hp);
    damage += (stats.damage * 20) / stats.attackIntervalTicks;
  }
  return Math.max(1, hp + damage * 4);
}

function countsOfArmy(army: readonly Army[number][]): Record<UnitKind, number> {
  return countsOf(army);
}

export class SimpleBot implements Bot {
  readonly name = 'Боец';
  readonly #balance: Balance;
  readonly #options: Required<SimpleBotOptions>;
  #lastDecisionTick = Number.NEGATIVE_INFINITY;
  #lastTemplate = '';

  constructor(balance: Balance, options: SimpleBotOptions = {}) {
    this.#balance = balance;
    this.#options = { ...DEFAULTS, ...options };
  }

  decide(state: Readonly<GameState>, playerId: PlayerId): readonly Command[] {
    const player = state.players[playerId];
    if (!player || !player.alive) return [];
    if (state.tick - this.#lastDecisionTick < this.#options.decideEveryTicks) return [];
    this.#lastDecisionTick = state.tick;

    const commands: Command[] = [];
    commands.push(...this.#decidePlans(state, playerId));
    const supply = this.#decideSupply(state, playerId);
    if (supply) commands.push(supply);
    const attack = this.#decideAttack(state, playerId);
    if (attack) commands.push(attack);
    return commands;
  }

  #templateFor(state: Readonly<GameState>, playerId: PlayerId): string {
    if (!this.#options.adaptTemplate) return this.#options.templateId;
    const enemyUnits: Record<UnitKind, number> = {
      swordsman: 0,
      archer: 0,
      cavalry: 0,
      cannon: 0,
    };
    for (const planet of state.planets) {
      if (planet.ownerId === playerId || planet.ownerId === -1) continue;
      const counts = countsOfArmy(planet.army);
      for (const kind of Object.keys(enemyUnits) as UnitKind[]) enemyUnits[kind] += counts[kind];
    }
    const dominant = (Object.keys(enemyUnits) as UnitKind[]).reduce((best, kind) =>
      enemyUnits[kind] > enemyUnits[best] ? kind : best,
    );
    if (dominant === 'swordsman') return 'siege';
    if (dominant === 'cavalry') return 'swords-archers';
    if (dominant === 'cannon') return 'raid';
    return 'balanced';
  }

  /** Раздать план всем своим планетам, если план ещё пуст. */
  #decidePlans(state: Readonly<GameState>, playerId: PlayerId): Command[] {
    const templateId = this.#templateFor(state, playerId);
    if (templateId === this.#lastTemplate) {
      return [];
    }
    const planets = state.planets.filter(
      (planet) => planet.ownerId === playerId && planSum(planet.plan) === 0,
    );
    if (planets.length === 0) return [];
    this.#lastTemplate = templateId;
    return planets.map((planet) => ({
      type: 'ApplyTemplate' as const,
      playerId,
      planetId: planet.id,
      templateId,
    }));
  }

  /** Включить снабжение на первом выгодном маршруте. */
  #decideSupply(state: Readonly<GameState>, playerId: PlayerId): Command | null {
    if (!this.#options.useSupply) return null;
    const route = state.routes.find(
      (candidate) =>
        candidate.ownerId === playerId &&
        !candidate.supplyEnabled &&
        state.planets[candidate.fromPlanetId]?.ownerId === playerId,
    );
    if (!route) return null;
    return {
      type: 'EnableSupply',
      playerId,
      routeId: route.id,
      enabled: true,
    };
  }

  #decideAttack(state: Readonly<GameState>, playerId: PlayerId): Command | null {
    const own = state.planets.filter(
      (planet) => planet.ownerId === playerId && planet.battleId === null,
    );
    if (own.length === 0) return null;

    const allTargets = state.planets.filter(
      (planet) => planet.ownerId !== playerId && planet.battleId === null,
    );
    const targets = this.#options.targetPlayers
      ? allTargets
      : allTargets.filter((planet) => planet.ownerId === -1);
    const source = targets.length > 0 ? targets : allTargets;

    const candidates = source
      .map((target) => {
        const defense = armyPower(target.army, this.#balance);
        const value = SIZE_VALUE[target.size] * (target.ownerId === -1 ? 1.1 : 1.3);
        return { target, defense, value };
      })
      .sort((a, b) => b.value / b.defense - a.value / a.defense);

    for (const candidate of candidates) {
      const need = candidate.defense * this.#options.attackMargin;
      const byDistance = [...own].sort(
        (a, b) =>
          Math.hypot(a.x - candidate.target.x, a.y - candidate.target.y) -
          Math.hypot(b.x - candidate.target.x, b.y - candidate.target.y),
      );
      const sourcePlanet = byDistance[0];
      if (!sourcePlanet) continue;
      const available = armyPower(sourcePlanet.army, this.#balance) * (this.#options.attackRatio / 100);
      if (available < need) continue;
      return {
        type: 'SendFleet',
        playerId,
        fromPlanetIds: [sourcePlanet.id],
        toPlanetId: candidate.target.id,
        ratio: this.#options.attackRatio,
      };
    }

    return null;
  }
}
