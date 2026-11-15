import { formatMilli } from '@hamsters/core';
import type { BoostKind, Ratio, TroopKind } from '@hamsters/core';
import { For, Index, Show } from 'solid-js';
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
  readonly onBoost: (kind: BoostKind) => void;
  readonly onTrain: (kind: TroopKind) => void;
  readonly onComposition: (id: string) => void;
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
  const compositionHint = (): string => {
    const mode = hud()?.composition.mode ?? 'all';
    if (mode === 'all') return 'по составу гарнизона';
    if (mode === 'mixed') return '40% меч · 30% лук · 30% кон';
    const unit = hud()?.composition.units.find((item) => item.kind === mode);
    return unit ? `только ${unit.name}` : '';
  };

  return (
    <>
      <div class="hud hud--top">
        <div class="top-left">
          <div class="seeds" title="Семечки">
            <span class="seeds__icon" aria-hidden="true" />
            <span class="seeds__value">{formatMilli(hud()?.seeds ?? 0, 0)}</span>
            <Show when={hud()?.tampered}>
              <span class="tamper" title="Защищённые значения изменены извне">
                !
              </span>
            </Show>
          </div>
          <div class="clan">
            {hud()?.clanName}
            <Show when={props.difficulty()}>{(label) => <> · {label()}</>}</Show>
          </div>
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
          <Show when={hud()?.message}>
            {(message) => (
              <div
                class="toast"
                classList={{ 'toast--error': message().startsWith('!') }}
                role="status"
              >
                {message().replace(/^! /, '')}
              </div>
            )}
          </Show>

          <div class="panel">
            <div class="panel__title">
              <span>Гарнизон</span>
              <span class="panel__meta">
                {hud()?.garrison.capacity
                  ? `${formatMilli(hud()?.garrison.total ?? 0, 0)} / ${formatMilli(
                      hud()?.garrison.capacity ?? 0,
                      0,
                    )}`
                  : 'выбери планету'}
              </span>
            </div>
            <Show when={!hud()?.garrison.capacity}>
              <div class="panel__hint">Клик по своей планете покажет состав и предел.</div>
            </Show>
            <div class="composition__units">
              <Index each={hud()?.composition.units ?? []}>
                {(unit) => (
                  <span
                    class="composition__unit"
                    classList={{ 'composition__unit--empty': unit().count === 0 }}
                    title={unit().name}
                  >
                    {unit().short} {Math.floor(unit().count / 1000)}
                  </span>
                )}
              </Index>
            </div>
          </div>

          <div class="panel">
            <div class="panel__title">
              <span>Отправка</span>
              <span class="panel__meta">{compositionHint()}</span>
            </div>
            <div class="composition__templates" role="group" aria-label="Состав отряда">
              <Index each={hud()?.composition.templates ?? []}>
                {(template) => (
                  <button
                    class="chip"
                    classList={{ 'chip--active': template().active }}
                    type="button"
                    title="Каким составом пойдёт следующий отряд"
                    onClick={() => props.onComposition(template().id)}
                  >
                    {template().label}
                  </button>
                )}
              </Index>
            </div>
            <div class="panel__hint">
              Доля — {props.ratio()}% гарнизона, меняется колесом или клавишами 1–4.
            </div>
          </div>

          <div class="panel">
            <div class="panel__title">
              <span>Казарма</span>
              <span class="panel__meta">
                очередь {hud()?.queue.used ?? 0}/{hud()?.queue.max ?? 0}
              </span>
            </div>
            <div class="training" role="group" aria-label="Обучение войск">
              <Index each={hud()?.training ?? []}>
                {(troop) => (
                  <button
                    class="train"
                    type="button"
                    disabled={!troop().ready}
                    title={
                      troop().blocked ??
                      `${troop().name}: ${formatMilli(troop().cost, 0)} семечек, один за ${troop().trainSeconds} с`
                    }
                    onClick={() => props.onTrain(troop().kind)}
                  >
                    <span class="train__top">
                      <span class="train__name">{troop().short}</span>
                      <Show when={troop().queued > 0}>
                        <span class="train__badge">×{troop().queued}</span>
                      </Show>
                    </span>
                    <span class="train__cost">{formatMilli(troop().cost, 0)}</span>
                    <Show when={troop().progress > 0}>
                      <span class="train__bar">
                        <span style={{ width: `${Math.round(troop().progress * 100)}%` }} />
                      </span>
                    </Show>
                  </button>
                )}
              </Index>
            </div>
            <div class="panel__hint">
              Клик — один хомяк в очередь. Если гарнизон полон, обучение ждёт места.
            </div>
          </div>

          <div class="panel">
            <div class="panel__title">
              <span>Бусты</span>
              <span class="panel__meta">семечки</span>
            </div>
            <div class="boosts">
              <Index each={hud()?.boosts ?? []}>
                {(boost) => (
                  <button
                    class="boost"
                    type="button"
                    disabled={!boost().ready}
                    title={
                      boost().blocked ??
                      `${BOOST_LABEL[boost().kind]} — ${formatMilli(boost().cost, 0)} семечек`
                    }
                    onClick={() => props.onBoost(boost().kind)}
                  >
                    <BoostIcon kind={boost().kind} />
                    <span class="boost__text">
                      <span class="boost__name">{BOOST_LABEL[boost().kind]}</span>
                      <span class="boost__cost">
                        <Show
                          when={boost().cooldownSeconds > 0}
                          fallback={<>{formatMilli(boost().cost, 0)}</>}
                        >
                          {Math.ceil(boost().cooldownSeconds)} с
                        </Show>
                      </span>
                    </span>
                  </button>
                )}
              </Index>
            </div>
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
