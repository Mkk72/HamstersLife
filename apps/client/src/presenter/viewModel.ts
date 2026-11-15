/**
 * Модель представления: то, что вид получает на отрисовку. Здесь нет ни Pixi,
 * ни DOM — только числа и строки, поэтому презентер и его тесты живут без окна.
 */
import type { BoostKind, MilliUnits, PlanetId, PlanetSize, PlayerId, TroopKind } from '@hamsters/core';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface BoostsView {
  /** Остаток действия в секундах; 0 — не действует. */
  readonly production: number;
  readonly speed: number;
  readonly defense: number;
}

export interface PlanetView {
  readonly id: PlanetId;
  readonly x: number;
  readonly y: number;
  readonly size: PlanetSize;
  readonly ownerId: PlayerId;
  readonly garrison: MilliUnits;
  readonly selected: boolean;
  /** Планета человека и партия только началась — повод для подписи «моя». */
  readonly mine: boolean;
  readonly boosts: BoostsView;
}

export interface FleetView {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  /** 0 — только вылетел, 1 — прилетел. */
  readonly progress: number;
  readonly troops: MilliUnits;
}

export interface ArrowView {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly travelSeconds: number;
  readonly valid: boolean;
}

/** Постоянный маршрут: стрелка, по которой непрерывно течёт производство. */
export interface RouteView {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly weightPermille: number;
  readonly pending: MilliUnits;
}

export interface BoostButtonView {
  readonly kind: BoostKind;
  readonly cost: MilliUnits;
  readonly affordable: boolean;
  readonly cooldownSeconds: number;
  readonly ready: boolean;
  /** Планета, к которой применится буст; null — нет выбора. */
  readonly planetId: PlanetId | null;
}

/** Кнопка обучения в казарме: цена за одного хомяка. */
export interface TrainingButtonView {
  readonly kind: TroopKind;
  readonly name: string;
  readonly cost: MilliUnits;
  readonly affordable: boolean;
  readonly ready: boolean;
}

export interface OutcomeView {
  readonly finished: boolean;
  readonly winnerId: PlayerId | null;
  readonly youWon: boolean;
}

export interface HudView {
  readonly seeds: MilliUnits;
  readonly mine: number;
  readonly enemy: number;
  readonly neutral: number;
  readonly boosts: readonly BoostButtonView[];
  readonly training: readonly TrainingButtonView[];
  readonly outcome: OutcomeView | null;
  readonly hint: string | null;
  /** Обнаружена правка защищённых значений в клиенте. */
  readonly tampered: boolean;
}

export interface BoardView {
  readonly tick: number;
  readonly planets: readonly PlanetView[];
  readonly fleets: readonly FleetView[];
  readonly routes: readonly RouteView[];
  readonly arrows: readonly ArrowView[];
  readonly hud: HudView;
}

/** Вид, который реализует Pixi-сцена. Презентер не знает её класса. */
export interface GameView {
  render(view: BoardView): void;
  setQuality(level: QualityLevel): void;
  playCapture(planetId: PlanetId): void;
  playBoost(planetId: PlanetId, kind: BoostKind): void;
  /** Отряд ушёл с планеты — короткий звук и вспышка, без знания правил. */
  playSend(): void;
  /** Команда отклонена: короткий сигнал, чтобы игрок понял причину. */
  playError(): void;
  /** Выбрана планета. */
  playSelect(): void;
  /** Партия закончилась: короткая музыкальная фраза. */
  playOutcome(won: boolean): void;
  /** Маршрут отрезан. */
  playCut(): void;
  /** Заказ на обучение принят. */
  playTrain(): void;
}
