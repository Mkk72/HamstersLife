/**
 * Типы состояния нового первого этапа.
 *
 * Войска — целые юниты (не milli-единицы): один юнит занимает одну ячейку,
 * имеет собственные HP и таймеры. Это упрощает план гарнизона, бой и снабжение.
 */

export const NEUTRAL_OWNER = -1;

export const UNIT_KINDS = ['swordsman', 'archer', 'cavalry', 'cannon'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export type PlayerId = number;
export type PlanetId = number;
export type FleetId = number;
export type RouteId = number;
export type BattleId = number;
export type Tick = number;
export type PlanetSize = 'S' | 'M' | 'L' | 'XL';

export type Plan = Record<UnitKind, number>;

/** Один боец. `id` постоянный: по нему детерминированно выбирается цель. */
export interface Unit {
  readonly id: number;
  readonly kind: UnitKind;
  hp: number;
  /** Когда юнит полностью восстановится, если не в бою; 0 — уже целый. */
  healAtTick: Tick;
  /** Когда ударит в следующий раз в текущем бою; 0 — вне боя. */
  nextAttackTick: Tick;
}

export type Army = Unit[];

export interface Planet {
  readonly id: PlanetId;
  readonly size: PlanetSize;
  readonly x: number;
  readonly y: number;
  ownerId: PlayerId;
  /** Фактический гарнизон. */
  army: Army;
  /** План гарнизона: сколько каждого рода нужно. */
  plan: Plan;
  /** Накопленная работа производства по родам. */
  production: Plan;
  /** Активный бой на планете, если есть. */
  battleId: BattleId | null;
}

export interface Fleet {
  readonly id: FleetId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  readonly army: Army;
  readonly departTick: Tick;
  readonly arriveTick: Tick;
  /** Доля пути, с которой начался полёт (после полевого боя). */
  readonly startProgressPermille: number;
}

export interface Route {
  readonly id: RouteId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  /** Вес деления снабжения, обычно 1000. */
  weightPermille: number;
  supplyEnabled: boolean;
  /** Рода, которые разрешено отправлять; пусто — никакие. */
  supplyKinds: UnitKind[];
}

/** Информация для продолжения полёта после полевого боя. */
export interface FieldRoute {
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  readonly progressPermille: number;
}

export interface Battle {
  readonly id: BattleId;
  readonly kind: 'planet' | 'field';
  /** Планета, за которую идёт бой; null для полевого. */
  readonly planetId: PlanetId | null;
  readonly attackerOwnerId: PlayerId;
  readonly defenderOwnerId: PlayerId;
  attacker: Army;
  defender: Army;
  round: number;
  /** Тик, на котором случится следующий раунд. */
  nextRoundTick: Tick;
  /** Куда продолжить путь победителю; null у планетарного боя. */
  readonly attackerRoute: FieldRoute | null;
  readonly defenderRoute: FieldRoute | null;
}

export interface PlayerState {
  readonly id: PlayerId;
  alive: boolean;
}

export interface UnitStats {
  readonly name: string;
  readonly shortName: string;
  readonly role: 'melee' | 'ranged';
  readonly hp: number;
  readonly damage: number;
  readonly attackIntervalTicks: number;
  readonly firstAttackTicks: number;
  /** Работа на одного юнита. */
  readonly work: number;
  /** Порядок целей. */
  readonly priority: readonly UnitKind[];
  /** Контр-множитель урона против рода, permille. */
  readonly counters: Partial<Record<UnitKind, number>>;
}

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly percents: Plan;
}

export interface SizeStats {
  readonly capacity: number;
  readonly powerPerTick: number;
}

export interface SupplyStats {
  readonly reservePermille: number;
  readonly intervalTicks: number;
}

export interface DefenseStats {
  readonly damagePermille: number;
}

export interface Balance {
  readonly rulesVersion: number;
  readonly contentVersion: number;
  readonly planetSizes: Readonly<Record<PlanetSize, SizeStats>>;
  readonly flightSpeedUnitsPerSecond: number;
  readonly maxRoutesPerPlanet: number;
  readonly supply: SupplyStats;
  readonly defense: DefenseStats;
  readonly capturePercents: Plan;
  readonly startingArmy: Plan;
  readonly startingPlan: Plan;
  readonly neutralGarrison: Readonly<Record<PlanetSize, number>>;
  readonly troops: Readonly<Record<UnitKind, UnitStats>>;
  readonly templates: readonly Template[];
}

export interface MapPlanet {
  readonly id: PlanetId;
  readonly size: PlanetSize;
  readonly x: number;
  readonly y: number;
  readonly ownerId: PlayerId;
  readonly garrison: Plan;
  readonly plan?: Plan | undefined;
}

export interface MapDefinition {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly playerCount: number;
  readonly planets: readonly MapPlanet[];
}

export type Ratio = 25 | 50 | 75 | 100;

export type Command =
  | {
      readonly type: 'SendFleet';
      readonly playerId: PlayerId;
      readonly fromPlanetIds: readonly PlanetId[];
      readonly toPlanetId: PlanetId;
      readonly ratio: Ratio;
      /** Если задан — доля считается только от этого рода. */
      readonly kind?: UnitKind;
    }
  | {
      readonly type: 'SetPlan';
      readonly playerId: PlayerId;
      readonly planetId: PlanetId;
      readonly plan: Partial<Plan>;
    }
  | {
      readonly type: 'ResetPlan';
      readonly playerId: PlayerId;
      readonly planetId: PlanetId;
    }
  | {
      readonly type: 'ApplyTemplate';
      readonly playerId: PlayerId;
      readonly planetId: PlanetId;
      readonly templateId: string;
    }
  | {
      readonly type: 'EnableSupply';
      readonly playerId: PlayerId;
      readonly routeId: RouteId;
      readonly enabled: boolean;
      readonly kinds?: readonly UnitKind[];
    }
  | {
      readonly type: 'RemoveRoute';
      readonly playerId: PlayerId;
      readonly routeId: RouteId;
    };

export type CommandErrorCode =
  | 'player-dead'
  | 'unknown-planet'
  | 'not-your-planet'
  | 'same-planet'
  | 'no-troops'
  | 'invalid-ratio'
  | 'invalid-plan'
  | 'in-battle'
  | 'too-many-routes'
  | 'unknown-route'
  | 'not-your-route'
  | 'unknown-template'
  | 'unknown-kind';

export type CommandResult =
  | { readonly ok: true; readonly fleetIds?: readonly FleetId[] }
  | { readonly ok: false; readonly error: CommandErrorCode };

/** Событие для вида: не входит в хэш и не влияет на исход. */
export interface InterceptionEvent {
  readonly kind: 'interception';
  readonly tick: Tick;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  readonly progressPermille: number;
  readonly fleetIds: readonly [FleetId, FleetId];
}

export interface BattleEvent {
  readonly kind: 'battle-start' | 'battle-end';
  readonly tick: Tick;
  readonly battleId: BattleId;
  readonly planetId: PlanetId | null;
  readonly attackerOwnerId: PlayerId;
  readonly defenderOwnerId: PlayerId;
  readonly captured?: boolean;
}

export type GameEvent = InterceptionEvent | BattleEvent;

export interface GameState {
  tick: Tick;
  readonly seed: number;
  readonly rulesVersion: number;
  readonly planets: Planet[];
  readonly fleets: Fleet[];
  readonly routes: Route[];
  readonly battles: Battle[];
  readonly players: PlayerState[];
  readonly events: GameEvent[];
  nextUnitId: number;
  nextFleetId: FleetId;
  nextRouteId: RouteId;
  nextBattleId: BattleId;
}
