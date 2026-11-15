/**
 * ESLint проверяет служебные JS/MJS-файлы (tools/, конфиг).
 *
 * TypeScript-файлы здесь сознательно не линтуются: typescript-eslint 8.72 не
 * поддерживает TypeScript 7 (нативный компилятор), а границы пакетов в проекте
 * держатся надёжнее — на компиляции (`lib: ["ES2022"]`, `types: []`) и на
 * `tools/check-boundaries.mjs`. Решение записано в ARCHITECTURE.md §11.
 */
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
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pixi.js', 'pixi.js/*', 'solid-js', 'solid-js/*'],
              message: 'Служебные скрипты не должны тянуть рендер и интерфейс.',
            },
          ],
        },
      ],
    },
  },
];
