/**
 * Модель представления: то, что вид получает на отрисовку. Здесь нет ни Pixi,
 * ни DOM — только числа и строки, поэтому презентер и его тесты живут без окна.
 */
import type { BoostKind, MilliUnits, PlanetId, PlanetSize, PlayerId } from '@hamsters/core';

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

export interface BoostButtonView {
  readonly kind: BoostKind;
  readonly cost: MilliUnits;
  readonly affordable: boolean;
  readonly cooldownSeconds: number;
  readonly ready: boolean;
  /** Планета, к которой применится буст; null — нет выбора. */
  readonly planetId: PlanetId | null;
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
  readonly outcome: OutcomeView | null;
  readonly hint: string | null;
}

export interface BoardView {
  readonly tick: number;
  readonly planets: readonly PlanetView[];
  readonly fleets: readonly FleetView[];
  readonly arrows: readonly ArrowView[];
  readonly hud: HudView;
}

/** Вид, который реализует Pixi-сцена. Презентер не знает её класса. */
export interface GameView {
  render(view: BoardView): void;
  setQuality(level: QualityLevel): void;
  playCapture(planetId: PlanetId): void;
  playBoost(planetId: PlanetId, kind: BoostKind): void;
}
