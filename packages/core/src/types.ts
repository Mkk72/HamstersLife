import type { MilliUnits } from './units';

/** Владелец планеты «нейтрал». Игроки нумеруются с 0. */
export const NEUTRAL_OWNER = -1;

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

export interface Planet {
  readonly id: PlanetId;
  readonly size: PlanetSize;
  readonly x: number;
  readonly y: number;
  /** Базовая защита в permille: 1000 = 1.0. */
  readonly defensePermille: number;
  ownerId: PlayerId;
  garrison: MilliUnits;
  /** До какого тика действует каждый буст. Новый вид — новая запись. */
  boosts: Record<BoostKind, Tick>;
}

export interface Fleet {
  readonly id: FleetId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  readonly troops: MilliUnits;
  readonly departTick: Tick;
  readonly arriveTick: Tick;
}

/**
 * Постоянный маршрут переброски: стрелка, которая живёт, пока её не отрежут.
 * `weightPermille` — выбранная доля (250…1000), `pending` — накопленные
 * milli-единицы, ещё не превратившиеся в отряд (минимум 1 хомяк).
 */
export interface Route {
  readonly id: RouteId;
  readonly ownerId: PlayerId;
  readonly fromPlanetId: PlanetId;
  readonly toPlanetId: PlanetId;
  weightPermille: number;
  pending: MilliUnits;
}

export interface PlayerState {
  readonly id: PlayerId;
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
  | 'not-your-route';

export type CommandResult =
  | { readonly ok: true; readonly fleetIds?: readonly FleetId[] }
  | { readonly ok: false; readonly error: CommandErrorCode };
