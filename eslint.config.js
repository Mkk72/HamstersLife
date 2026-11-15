import tsParser from '@typescript-eslint/parser';

const HEADLESS = [
  'packages/core/**/*.ts',
  'packages/levelgen/**/*.ts',
  'packages/ai/**/*.ts',
];

const UI_IMPORTS = [
  'pixi.js',
  'pixi.js/*',
  'solid-js',
  'solid-js/*',
  'howler',
  '@hamsters/client',
  '@hamsters/client/*',
];

const NODE_IMPORTS = ['node:*', 'fs', 'path', 'os', 'crypto', 'worker_threads'];

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'fetch',
  'WebSocket',
  'Worker',
  'requestAnimationFrame',
  'performance',
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../apps/*', '../../../apps/*'],
              message: 'Пакет не может импортировать приложение: зависимость только в одну сторону.',
            },
          ],
        },
      ],
    },
  },
  {
    files: HEADLESS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: UI_IMPORTS,
              message: 'Headless-пакет не импортирует рендер и интерфейс: логика должна тестироваться без окна.',
            },
            {
              group: NODE_IMPORTS,
              message: 'Headless-пакет не зависит от Node: тот же код исполняется в браузере и на сервере.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({
          name,
          message: 'Браузерный глобал недоступен в headless-пакете.',
        })),
      ],
    },
  },
];
