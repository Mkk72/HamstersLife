import { For } from 'solid-js';

import { BOT_PRESETS } from '@hamsters/ai';
import type { BotDifficulty } from '@hamsters/ai';
const MAP_OPTIONS: readonly { value: string; label: string; hint: string }[] = [
  { value: 'arena-duel', label: 'Арена', hint: 'ручная карта, 13 планет' },
  { value: 'random', label: 'Случайная', hint: 'симметричная, по seed' },
];

const DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'normal', 'hard'];

export interface MainMenuProps {
  readonly mapChoice: () => string;
  readonly difficulty: () => BotDifficulty;
  readonly onMap: (choice: string) => void;
  readonly onDifficulty: (difficulty: BotDifficulty) => void;
  readonly onStart: () => void;
}

/** Главное меню: выбор карты и старт. Одна кнопка — играть. */
export function MainMenu(props: MainMenuProps) {
  return (
    <div class="menu">
      <div class="menu__card">
        <div class="menu__badge">этап 1 · «Захват» против бота</div>
        <h1 class="menu__title">Hamsters Life</h1>
        <p class="menu__tagline">
          Хомяки расселились по галактике. Собери план гарнизона, отправь отряд стрелкой
          и удержи снабжение — планета твоя, если в бою уцелел атакующий.
        </p>

        <div class="menu__maps" role="group" aria-label="Карта">
          <For each={MAP_OPTIONS}>
            {(option) => (
              <button
                class="menu__map"
                classList={{ 'menu__map--active': props.mapChoice() === option.value }}
                type="button"
                onClick={() => props.onMap(option.value)}
              >
                <span class="menu__map-name">{option.label}</span>
                <span class="menu__map-hint">{option.hint}</span>
              </button>
            )}
          </For>
        </div>

        <div class="menu__difficulty" role="group" aria-label="Сложность бота">
          <span class="menu__difficulty-label">Сложность:</span>
          <For each={DIFFICULTIES}>
            {(value) => (
              <button
                class="chip"
                classList={{ 'chip--active': props.difficulty() === value }}
                type="button"
                onClick={() => props.onDifficulty(value)}
              >
                {BOT_PRESETS[value].label}
              </button>
            )}
          </For>
        </div>

        <button class="button button--primary menu__start" type="button" onClick={props.onStart}>
          Играть
        </button>

        <ul class="menu__controls">
          <li>ПКМ по своей планете — таблица плана; повторная ПКМ закрывает</li>
          <li>ЛКМ по своей планете — выбор и стрелка отправки</li>
          <li>Протяни стрелку к цели и отпусти — уйдёт разовый отряд</li>
          <li>
            Доля отправки — <kbd>1</kbd>–<kbd>4</kbd> или колесо
          </li>
          <li>Снабжение включается на маршруте в панели планеты</li>
          <li>
            Пауза — <kbd>Space</kbd>, скорость — <kbd>[</kbd> и <kbd>]</kbd>
          </li>
          <li>Правая кнопка по пустому месту/стрелке — отрезать маршрут</li>
        </ul>
      </div>
    </div>
  );
}
