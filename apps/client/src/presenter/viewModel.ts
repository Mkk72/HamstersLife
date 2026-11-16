/**
 * Модель представления: только числа и строки, без Pixi и DOM.
 */
import type { BattleId, PlanetId, PlanetSize, PlayerId, Ratio, UnitKind } from '@hamsters/core';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface UnitCountView {
  readonly kind: UnitKind;
  readonly short: string;
  readonly plan: number;
  readonly have: number;
  /** Род сейчас производится (есть прогресс и недостача). */
  readonly producing: boolean;
}

export interface PlanetView {
  readonly id: PlanetId;
  readonly x: number;
  readonly y: number;
  readonly size: PlanetSize;
  readonly ownerId: PlayerId;
  readonly total: number;
  readonly units: readonly UnitCountView[];
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly battleId: BattleId | null;
  /** Экранная позиция для панели плана; null, если вне экрана. */
  readonly screenX: number;
  readonly screenY: number;
}

export interface FleetView {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly progress: number;
  readonly total: number;
  readonly units: readonly { readonly kind: UnitKind; readonly count: number }[];
}

export interface ArrowView {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly travelSeconds: number;
  readonly valid: boolean;
}

export interface RouteView {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly supplyEnabled: boolean;
}

export interface TemplateView {
  readonly id: string;
  readonly name: string;
}

export interface RouteToggleView {
  readonly id: number;
  readonly label: string;
  readonly enabled: boolean;
}

export interface PlanPanelView {
  readonly planetId: PlanetId;
  readonly screenX: number;
  readonly screenY: number;
  readonly size: PlanetSize;
  readonly total: number;
  readonly capacity: number;
  readonly planTotal: number;
  readonly units: readonly UnitCountView[];
  readonly templates: readonly TemplateView[];
  readonly routes: readonly RouteToggleView[];
  readonly message: string | null;
  readonly canUndoReset: boolean;
}

export interface OutcomeView {
  readonly finished: boolean;
  readonly winnerId: PlayerId | null;
  readonly youWon: boolean;
}

export interface SendPreviewView {
  readonly short: string;
  readonly count: number;
}

export interface HudView {
  readonly mine: number;
  readonly enemy: number;
  readonly neutral: number;
  readonly ratio: Ratio;
  readonly panel: PlanPanelView | null;
  /** Точный состав отряда до отпускания стрелки. */
  readonly sendPreview: readonly SendPreviewView[] | null;
  readonly outcome: OutcomeView | null;
  readonly hint: string | null;
  readonly battleCount: number;
}

export interface BoardView {
  readonly tick: number;
  readonly planets: readonly PlanetView[];
  readonly fleets: readonly FleetView[];
  readonly routes: readonly RouteView[];
  readonly arrows: readonly ArrowView[];
  readonly hud: HudView;
}

export interface GameView {
  render(view: BoardView): void;
  setQuality(level: QualityLevel): void;
  playCapture(planetId: PlanetId): void;
  playInterception(x: number, y: number): void;
  playSend(): void;
  playError(): void;
  playSelect(): void;
  playOutcome(won: boolean): void;
  playCut(): void;
  /** Мировые координаты → экранные (для панели рядом с планетой). */
  toScreen(x: number, y: number): { x: number; y: number };
}
