import type { Ratio, UnitKind } from '@hamsters/core';
import { For, Show, Index } from 'solid-js';
import type { BoardView, HudView, QualityLevel, UnitCountView } from '../presenter/viewModel';
import { SPEEDS } from './speeds';

const RATIOS: readonly Ratio[] = [25, 50, 75, 100];

const QUALITIES: readonly { value: QualityLevel; label: string }[] = [
  { value: 'low', label: 'Низкое' },
  { value: 'medium', label: 'Среднее' },
  { value: 'high', label: 'Высокое' },
];

const MAP_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'arena-duel', label: 'Арена' },
  { value: 'random', label: 'Случайная' },
];

const SPEED_LABEL = (value: number): string => (value === 0 ? 'Пауза' : `×${value}`);

export interface GameHudProps {
  readonly board: () => BoardView | null;
  readonly ratio: () => Ratio;
  readonly quality: () => QualityLevel;
  readonly fps: () => number;
  readonly mapChoice: () => string;
  readonly difficulty: () => string;
  readonly audioEnabled: () => boolean;
  readonly speed: () => number;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onQuality: (quality: QualityLevel) => void;
  readonly onMap: (choice: string) => void;
  readonly onSpeed: (speed: number) => void;
  readonly onTogglePause: () => void;
  readonly onAudio: (enabled: boolean) => void;
  readonly onRestart: () => void;
  readonly onDownloadReplay: () => void;
  readonly onPlanDelta: (kind: UnitKind, delta: number) => void;
  readonly onPlanSet: (kind: UnitKind, value: number) => void;
  readonly onResetPlan: () => void;
  readonly onUndoReset: () => void;
  readonly onTemplate: (templateId: string) => void;
  readonly onToggleSupply: (routeId: number) => void;
}

export function GameHud(props: GameHudProps) {
  const hud = (): HudView | null => props.board()?.hud ?? null;
  const total = (): number => {
    const current = hud();
    if (!current) return 1;
    return Math.max(1, current.mine + current.enemy + current.neutral);
  };
  const percent = (count: number): string => `${(count / total()) * 100}%`;

  /** Нажатие меняет на 1, удержание — ускоряет; Shift даёт шаг 5. */
  const holdRepeat = (action: () => void): void => {
    action();
    let repeat: number | undefined;
    const timeout = window.setTimeout(() => {
      repeat = window.setInterval(action, 80);
    }, 350);
    const stop = (): void => {
      window.clearTimeout(timeout);
      if (repeat !== undefined) window.clearInterval(repeat);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  return (
    <>
      <div class="hud hud--top">
        <div class="control" title="Контроль карты">
          <div class="control__track">
            <div class="control__mine" style={{ width: percent(hud()?.mine ?? 0) }} />
            <div class="control__neutral" style={{ width: percent(hud()?.neutral ?? 0) }} />
            <div class="control__enemy" style={{ width: percent(hud()?.enemy ?? 0) }} />
          </div>
          <div class="control__labels">
            <span>{hud()?.mine ?? 0}</span>
            <span class="control__muted">{hud()?.neutral ?? 0} нейтр.</span>
            <span>{hud()?.enemy ?? 0}</span>
            <Show when={(hud()?.battleCount ?? 0) > 0}>
              <span class="control__muted">боёв: {hud()?.battleCount}</span>
            </Show>
          </div>
        </div>

        <div class="top-actions">
          <span class="difficulty-label">{props.difficulty()}</span>
          <button class="button" type="button" title="Пауза (пробел)" onClick={props.onTogglePause}>
            {props.speed() === 0 ? '▶' : '⏸'}
          </button>
          <select
            class="select"
            aria-label="Скорость игры"
            value={String(props.speed() === 0 ? 1 : props.speed())}
            onChange={(event) => props.onSpeed(Number(event.currentTarget.value))}
          >
            <For each={SPEEDS}>
              {(value) => <option value={String(value)}>{SPEED_LABEL(value)}</option>}
            </For>
          </select>
          <select
            class="select"
            aria-label="Карта"
            value={props.mapChoice()}
            onChange={(event) => props.onMap(event.currentTarget.value)}
          >
            <For each={MAP_OPTIONS}>
              {(item) => <option value={item.value}>{item.label}</option>}
            </For>
          </select>
          <select
            class="select"
            aria-label="Качество графики"
            value={props.quality()}
            onChange={(event) => props.onQuality(event.currentTarget.value as QualityLevel)}
          >
            <For each={QUALITIES}>
              {(item) => <option value={item.value}>{item.label}</option>}
            </For>
          </select>
          <button class="button" type="button" title="Звук и музыка" onClick={() => props.onAudio(!props.audioEnabled())}>
            {props.audioEnabled() ? 'Звук' : 'Тихо'}
          </button>
          <button class="button" type="button" title="Скачать повтор" onClick={props.onDownloadReplay}>
            Повтор
          </button>
          <button class="button" type="button" onClick={props.onRestart}>
            Новый матч
          </button>
        </div>
      </div>

      <div class="hud hud--bottom">
        <div class="ratios" role="group" aria-label="Доля отправки">
          <For each={RATIOS}>
            {(value) => (
              <button
                class="ratio"
                classList={{ 'ratio--active': props.ratio() === value }}
                type="button"
                onClick={() => props.onRatio(value)}
              >
                {value}%
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={hud()?.sendPreview && (hud()?.sendPreview?.length ?? 0) > 0}>
        <div class="send-preview">
          Уйдёт:{' '}
          <For each={hud()?.sendPreview ?? []}>
            {(unit) => <span>{unit.short} {unit.count} </span>}
          </For>
        </div>
      </Show>

      <Show when={hud()?.panel}>
        {(panel) => (
          <div
            class="plan-panel"
            style={{
              left: `${Math.min(panel().screenX + 28, Math.max(18, window.innerWidth - 330))}px`,
              top: `${Math.min(panel().screenY + 20, Math.max(18, window.innerHeight - 360))}px`,
            }}
          >
            <div class="plan-panel__title">
              <span>
                Планета {panel().size} · {panel().total}/{panel().capacity}
              </span>
              <span class="plan-panel__plan">
                План: {panel().planTotal}/{panel().capacity}
              </span>
            </div>
            <div class="plan-panel__grid">
              <Index each={panel().units}>
                {(unit) => (
                  <div class="plan-row">
                    <span class="plan-row__name">{unit().short}</span>
                    <button
                      class="plan-btn"
                      type="button"
                      title="−1 (Shift — −5); удержание ускоряет"
                      onPointerDown={(event) =>
                        holdRepeat(() => props.onPlanDelta(unit().kind, event.shiftKey ? -5 : -1))
                      }
                    >
                      −
                    </button>
                    <input
                      class="plan-input"
                      type="number"
                      min="0"
                      value={unit().plan}
                      onChange={(event) => props.onPlanSet(unit().kind, Number(event.currentTarget.value))}
                    />
                    <span class="plan-row__have">/ {unit().have}</span>
                    <button
                      class="plan-btn"
                      type="button"
                      title="+1 (Shift — +5); удержание ускоряет"
                      onPointerDown={(event) =>
                        holdRepeat(() => props.onPlanDelta(unit().kind, event.shiftKey ? 5 : 1))
                      }
                    >
                      +
                    </button>
                  </div>
                )}
              </Index>
            </div>
            <div class="plan-panel__actions">
              <button class="chip" type="button" onClick={props.onResetPlan}>
                Сбросить план
              </button>
              <Show when={panel().canUndoReset}>
                <button class="chip" type="button" onClick={props.onUndoReset}>
                  Вернуть
                </button>
              </Show>
              <select
                class="select select--small"
                aria-label="Шаблон плана"
                value=""
                onChange={(event) => {
                  if (event.currentTarget.value) props.onTemplate(event.currentTarget.value);
                  event.currentTarget.value = '';
                }}
              >
                <option value="">Шаблоны…</option>
                <For each={panel().templates}>
                  {(template) => <option value={template.id}>{template.name}</option>}
                </For>
              </select>
            </div>
            <Show when={panel().routes.length > 0}>
              <div class="plan-panel__routes">
                <span class="plan-panel__label">Снабжение:</span>
                <For each={panel().routes}>
                  {(route) => (
                    <button
                      class="chip"
                      classList={{ 'chip--active': route.enabled }}
                      type="button"
                      onClick={() => props.onToggleSupply(route.id)}
                    >
                      {route.label} {route.enabled ? 'вкл' : 'выкл'}
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={panel().message}>
              {(message) => (
                <div
                  class="plan-panel__message"
                  classList={{ 'plan-panel__message--error': message().startsWith('!') }}
                >
                  {message().replace(/^! /, '')}
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>

      <Show when={hud()?.hint}>
        {(hint) => <div class="hint">{hint()}</div>}
      </Show>

      <div class="fps">
        <span class="fps__value">{props.fps() > 0 ? props.fps() : '—'}</span> FPS · тик{' '}
        {props.board()?.tick ?? 0}
      </div>
    </>
  );
}

export type { UnitCountView };
