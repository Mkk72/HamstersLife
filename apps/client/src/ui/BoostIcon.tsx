import type { BoostKind } from '@hamsters/core';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.7',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

/** Иконки бустов нарисованы кодом: внешних файлов нет. */
export function BoostIcon(props: { kind: BoostKind }) {
  return (
    <svg class="boost-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {props.kind === 'production' && (
        <g {...STROKE}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
        </g>
      )}
      {props.kind === 'speed' && (
        <g {...STROKE}>
          <path d="M4 12h11" />
          <path d="M11 6l6 6-6 6" />
          <path d="M19 6v12" />
        </g>
      )}
      {props.kind === 'defense' && (
        <g {...STROKE}>
          <path d="M12 2.8l7.2 2.7v5.8c0 4.6-3.1 7.9-7.2 10-4.1-2.1-7.2-5.4-7.2-10V5.5z" />
          <path d="M9 12l2.1 2.1L15.4 10" />
        </g>
      )}
    </svg>
  );
}
