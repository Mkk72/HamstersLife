import { formatMilli } from '@hamsters/core';
import type { BoostKind, Ratio, TroopKind } from '@hamsters/core';
import { For, Show } from 'solid-js';
import type { BoardView, HudView, QualityLevel } from '../presenter/viewModel';
import { BoostIcon } from './BoostIcon';
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
  { value: 'three', label: '1×3' },
];

/** Скорость игры: шаг 0.2 до 1, затем 1.5 и 2. */
const SPEED_LABEL = (value: number): string => (value === 0 ? 'Пауза' : `×${value}`);

const BOOST_LABEL: Readonly<Record<BoostKind, string>> = {
  production: 'Колесо',
  speed: 'Щёки',
  defense: 'Скорлупа',
};

/** Короткие подписи родов войск для панели обучения. */
const TROOP_SHORT: Readonly<Record<TroopKind, string>> = {
  swordsman: 'Меч',
  archer: 'Лук',
  cannon: 'Пуш',
  cavalry: 'Кон',
  mage: 'Маг',
};

export interface GameHudProps {
  readonly board: () => BoardView | null;
  readonly ratio: () => Ratio;
  readonly quality: () => QualityLevel;
  readonly fps: () => number;
  readonly mapChoice: () => string;
  readonly audioEnabled: () => boolean;
  readonly speed: () => number;
  readonly onRatio: (ratio: Ratio) => void;
  readonly onBoost: (kind: BoostKind) => void;
  readonly onTrain: (kind: TroopKind) => void;
  readonly onQuality: (quality: QualityLevel) => void;
  readonly onMap: (choice: string) => void;
  readonly onSpeed: (speed: number) => void;
  readonly onTogglePause: () => void;
  readonly onAudio: (enabled: boolean) => void;
  readonly onRestart: () => void;
  readonly onDownloadReplay: () => void;
}

/** HUD: семечки, контроль карты, доли, бусты, качество, подсказка. */
export function GameHud(props: GameHudProps) {
  const hud = (): HudView | null => props.board()?.hud ?? null;
  const total = (): number => {
    const current = hud();
    if (!current) return 1;
    return Math.max(1, current.mine + current.enemy + current.neutral);
  };
  const percent = (count: number): string => `${(count / total()) * 100}%`;

  return (
    <>
      <div class="hud hud--top">
        <div class="seeds" title="Семечки">
          <span class="seeds__icon" aria-hidden="true" />
          <span class="seeds__value">{formatMilli(hud()?.seeds ?? 0, 0)}</span>
          <Show when={hud()?.tampered}>
            <span class="tamper" title="Защищённые значения изменены извне">
              !
            </span>
          </Show>
        </div>

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
          </div>
        </div>

        <div class="top-actions">
          <button
            class="button"
            type="button"
            title="Пауза (пробел)"
            onClick={props.onTogglePause}
          >
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
          <button
            class="button"
            type="button"
            title="Звук и музыка"
            onClick={() => props.onAudio(!props.audioEnabled())}
          >
            {props.audioEnabled() ? 'Звук' : 'Тихо'}
          </button>
          <button class="button" type="button" title="Скачать повтор матча" onClick={props.onDownloadReplay}>
            Повтор
          </button>
          <button class="button" type="button" onClick={props.onRestart}>
            Новый матч
          </button>
        </div>
      </div>

      <div class="hud hud--bottom">
        <div class="bottom-left">
          <div class="training" role="group" aria-label="Обучение войск">
            <For each={hud()?.training ?? []}>
              {(troop) => (
                <button
                  class="train"
                  classList={{ 'train--disabled': !troop.ready }}
                  type="button"
                  title={`${troop.name} — ${formatMilli(troop.cost, 0)} семечек за одного`}
                  onClick={() => props.onTrain(troop.kind)}
                >
                  <span class="train__name">{TROOP_SHORT[troop.kind]}</span>
                  <span class="train__cost">{formatMilli(troop.cost, 0)}</span>
                </button>
              )}
            </For>
          </div>

          <div class="boosts">
          <For each={hud()?.boosts ?? []}>
            {(boost) => (
              <button
                class="boost"
                classList={{ 'boost--disabled': !boost.ready }}
                type="button"
                title={`${BOOST_LABEL[boost.kind]} — ${formatMilli(boost.cost, 0)} семечек`}
                onClick={() => props.onBoost(boost.kind)}
              >
                <BoostIcon kind={boost.kind} />
                <span class="boost__text">
                  <span class="boost__name">{BOOST_LABEL[boost.kind]}</span>
                  <span class="boost__cost">
                    <Show
                      when={boost.cooldownSeconds > 0}
                      fallback={<>{formatMilli(boost.cost, 0)}</>}
                    >
                      {Math.ceil(boost.cooldownSeconds)} с
                    </Show>
                  </span>
                </span>
              </button>
            )}
          </For>
          </div>
        </div>

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
