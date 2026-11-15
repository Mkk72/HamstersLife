import { For } from 'solid-js';

const MAP_OPTIONS: readonly { value: string; label: string; hint: string }[] = [
  { value: 'arena-duel', label: 'Арена', hint: 'ручная карта, 13 планет' },
  { value: 'random', label: 'Случайная', hint: 'симметричная, по seed' },
  { value: 'three', label: '1×3', hint: 'четыре игрока, все против всех' },
];

export interface MainMenuProps {
  readonly mapChoice: () => string;
  readonly onMap: (choice: string) => void;
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
          Хомяки расселились по галактике. Тяни стрелку от своей планеты к чужой —
          прилетело больше, чем защищает, планета твоя.
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

        <button class="button button--primary menu__start" type="button" onClick={props.onStart}>
          Играть
        </button>

        <ul class="menu__controls">
          <li>Перетащи стрелку от своей планеты к цели</li>
          <li>
            Доля отправки — <kbd>1</kbd>–<kbd>4</kbd> или колесо
          </li>
          <li>
            Бусты — <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> или панель снизу
          </li>
          <li>
            <kbd>Shift</kbd> — добавить планету к выбору
          </li>
        </ul>
      </div>
    </div>
  );
}
