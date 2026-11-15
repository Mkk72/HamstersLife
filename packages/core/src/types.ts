import type { MilliUnits } from './units';
import type { TroopKind, TroopStack } from './troops';

export type { TroopStack } from './troops';

/** Владелец планеты «нейтрал». Игроки нумеруются с 0. */
export const NEUTRAL_OWNER = -1;

/** Кланы: небольшие бонусы, чтобы PvP оставался честным. */
export const CLAN_IDS = ['goldenCheeks', 'jungarian', 'syrian', 'darkRoborowski'] as const;

export type ClanId = (typeof CLAN_IDS)[number];

export type TroopRole = 'melee' | 'ranged' | 'siege' | 'support';

/** Характеристики рода войск: числа для фазового боя и тренировки. */
export interface TroopStats {
  readonly name: string;
  /** Короткая подпись для панелей: «Меч», «Лук» и т.п. */
  readonly shortName: string;
  readonly role: TroopRole;
  readonly attack: number;
  readonly defense: number;
  /** Множитель скорости отряда в permille: 1000 — обычная. */
  readonly speedPermille: number;
  /** Дальность в «шагах» фазы: 0 — только ближний бой. */
  readonly range: number;
  readonly trainTicks: number;
  readonly costSeeds: MilliUnits;
  /** Против кого род войск сильнее (множитель из `combat.strongPermille`). */
  readonly strongAgainst: readonly TroopKind[];
  /** Против кого род войск слабее (множитель из `combat.weakPermille`). */
  readonly weakAgainst: readonly TroopKind[];
}

/** Настройки фазового боя. */
export interface CombatStats {
  readonly strongPermille: number;
  readonly weakPermille: number;
  /** Максимальная доля потерь стороны за одну фазу, permille. */
  readonly phaseLossPermille: number;
  readonly rangedEfficiencyPermille: number;
  readonly approachEfficiencyPermille: number;
  readonly meleeEfficiencyPermille: number;
}

export interface ClanStats {
  readonly name: string;
  readonly productionPermille: number;
  readonly defensePermille: number;
  readonly speedPermille: number;
  readonly spellCostPermille: number;
}

export type PlayerId = number;
export type PlanetId = number;
export type FleetId = number;
export type RouteId = number;

export type PlanetSize = 'S' | 'M' | 'L' | 'XL';

/**
 * Виды бустов. Порядок массива — канонический: по нему строится хэш и сброс
 * таймеров, поэтому новые виды добавляются только в конец.
 */
export const BOOST_KINDS = ['production', 'speed', 'defense'] as const;

export type BoostKind = (typeof BOOST_KINDS)[number];

/** Тик, начиная с которого буст больше не действует (0 — не действовал). */
export type Tick = number;

/** Заказ на обучение в очереди планеты. */
export interface TrainingOrder {
  readonly kind: TroopKind;
  /** Сколько ещё милли-единиц нужно обучить. */
  remaining: MilliUnits;
  /** Накопленные тики текущего хомяка. */
  progressTicks: number;
}

export interface Planet {
  readonly id: PlanetId;
  readonly size: PlanetSize;
  readonly x: number;
  readonly y: number;
  /** Базовая защита в permille: 1000 = 1.0. */
  readonly defensePermille: number;
  ownerId: PlayerId;
  /** Состав гарнизона по родам войск. */
  troops: TroopStack;
  /** Очередь обучения: первый заказ тренируется, остальные ждут. */
  training: TrainingOrder[];
  /** До какого тика действует каждый буст. Новый вид — новая запись. */
  boosts: Record<BoostKind, Tick>;
}

export interface Fleet {
  readonly id: FleetId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  readonly troops: TroopStack;
  readonly departTick: Tick;
  readonly arriveTick: Tick;
}

/**
 * Постоянный маршрут переброски: стрелка, которая живёт, пока её не отрежут.
 * `weightPermille` — выбранная доля (250…1000), `pending` — накопленный состав,
 * ещё не превратившийся в отряд (минимум — `minRouteFleet` суммарно).
 */
export interface Route {
  readonly id: RouteId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  weightPermille: number;
  pending: TroopStack;
}

export interface PlayerState {
  readonly id: PlayerId;
  /** Клан игрока. Назначается до старта (место за столом или выбор в меню). */
  clanId: ClanId;
  seeds: MilliUnits;
  alive: boolean;
  /** До какого тика буст недоступен (перезарядка). */
  boostCooldownUntilTick: Record<BoostKind, Tick>;
}

export interface GameState {
  tick: Tick;
  readonly seed: number;
  readonly rulesVersion: number;
  readonly planets: Planet[];
  readonly fleets: Fleet[];
  readonly routes: Route[];
  readonly players: PlayerState[];
  nextFleetId: FleetId;
  nextRouteId: RouteId;
}

export interface SizeStats {
  /** Вместимость в milli-единицах. */
  readonly capacity: MilliUnits;
  /** Производство в milli-единицах за секунду. */
  readonly productionPerSecond: MilliUnits;
}

export interface BoostStats {
  /** Стоимость в milli-семечках. */
  readonly cost: MilliUnits;
  readonly durationTicks: number;
  readonly cooldownTicks: number;
  /** Множитель в permille: 2000 = ×2. */
  readonly factorPermille: number;
}

export interface Balance {
  readonly rulesVersion: number;
  /** Версия набора данных: меняется при правке баланса или карт. */
  readonly contentVersion: number;
  readonly planetSizes: Readonly<Record<PlanetSize, SizeStats>>;
  /** Скорость флотов в целых единицах карты за секунду. */
  readonly flightSpeedUnitsPerSecond: number;
  /** Приток семечек с одной своей планеты за секунду. */
  readonly seedsPerPlanetPerSecond: MilliUnits;
  readonly startingSeeds: MilliUnits;
  readonly boosts: Readonly<Record<BoostKind, BoostStats>>;
  /** Минимальный гарнизон после захвата. */
  readonly minCaptureGarrison: MilliUnits;
  /** Сколько постоянных маршрутов можно держать с одной планеты. */
  readonly maxRoutesPerPlanet: number;
  /** Минимальный накопленный отряд маршрута, после которого он вылетает. */
  readonly minRouteFleet: MilliUnits;
  /** Характеристики родов войск. */
  readonly troops: Readonly<Record<TroopKind, TroopStats>>;
  /** Бонусы кланов. */
  readonly clans: Readonly<Record<ClanId, ClanStats>>;
  /** Сколько заказов обучения можно держать в очереди одной планеты. */
  readonly maxTrainingQueue: number;
  /** Настройки фазового боя. */
  readonly combat: CombatStats;
}

/** Планета в описании карты: данные, а не состояние. */
export interface MapPlanet {
  readonly id: PlanetId;
  readonly size: PlanetSize;
  readonly x: number;
  readonly y: number;
  readonly ownerId: PlayerId;
  readonly garrisonHamsters: number;
  readonly defensePermille?: number | undefined;
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
      /**
       * Желаемый состав отряда: веса родов. Если не задан — отряд забирается
       * пропорционально составу планеты (текущее поведение).
       */
      readonly composition?: Partial<Record<TroopKind, number>>;
    }
  | {
      readonly type: 'ApplyBoost';
      readonly playerId: PlayerId;
      readonly planetId: PlanetId;
      readonly boost: BoostKind;
    }
  | {
      readonly type: 'RemoveRoute';
      readonly playerId: PlayerId;
      readonly routeId: RouteId;
    }
  | {
      readonly type: 'TrainTroops';
      readonly playerId: PlayerId;
      readonly planetId: PlanetId;
      readonly kind: TroopKind;
      /** Сколько хомяков обучить (целое число, минимум 1). */
      readonly amount: number;
    };

export type CommandErrorCode =
  | 'player-dead'
  | 'unknown-planet'
  | 'not-your-planet'
  | 'wrong-boost-target'
  | 'same-planet'
  | 'no-troops'
  | 'invalid-ratio'
  | 'not-enough-seeds'
  | 'cooldown'
  | 'too-many-routes'
  | 'unknown-route'
  | 'not-your-route'
  | 'invalid-amount'
  | 'queue-full'
  | 'unknown-troop';

export type CommandResult =
  | { readonly ok: true; readonly fleetIds?: readonly FleetId[] }
  | { readonly ok: false; readonly error: CommandErrorCode };
