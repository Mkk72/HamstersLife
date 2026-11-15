# Разработка: окружение, команды, известные ограничения

Документ для людей и агентов: что нужно на машине, как запускать и на какие грабли уже наступили.

## 1. Требуется на машине

| Что | Версия | Зачем |
|---|---|---|
| Node.js | 24.x | всё: сборка, тесты, клиент |
| pnpm | 11.22+ | монорепозиторий |
| git | 2.50+ | история; push — нужен доступ к GitHub (см. §4) |
| Браузер Chromium | актуальный | проверка клиента глазами |

Проверка: `node -v`, `pnpm -v`, `git --version`.

## 2. Разовые настройки репозитория

```bash
pnpm install
```

Уже настроено и не требует повторения:

- `pnpm-workspace.yaml`: `nodeLinker: hoisted` — иначе на этой машине Node не разворачивает junction-ссылки pnpm и падают `tsc` и `vitest` (подробности в §3).
- Корневой `.gitignore`, `.editorconfig`, CI в `.github/workflows/ci.yml`.

## 3. Известные ограничения среды

### 3.1 Junction'ы pnpm не работают

На Windows-машинах разработки Node не разворачивает junction-ссылки pnpm: `lstat` не видит symlink, `realpath.native` видит, а обычный `realpath` — нет. Симптомы:

- `tsc`: `Unable to resolve @typescript/typescript-win32-x64`;
- `vitest`: `Cannot find package 'std-env'`.

Лечение: `nodeLinker: hoisted` в `pnpm-workspace.yaml` (уже включено). Переход между линкерами требует удалить `node_modules` и выполнить `pnpm install` заново.

### 3.2 Vitest только с пулом потоков

Песочница DSH запрещает дочерним процессам с перехватом вывода (`spawn` с pipe) — форк-пул Vitest падает с `spawn EPERM`. Поэтому в пакетах скрипт тестов выглядит так:

```json
"test": "vitest run --pool=threads"
```

Не возвращать `--pool=forks` и не добавлять `--no-file-parallelism` «для надёжности».

### 3.3 Медленный реестр npm

Иногда `pnpm install` ловит `error (23)` и повторяет запросы по 70 секунд. Помогает повторный запуск. Если совсем не идёт — проверить сеть/прокси, не менять lock-файл руками.

### 3.4 Playwright и браузеры

Запуск браузера из-под песочницы упирается в тот же запрет на spawn. E2E-тесты гонять в режиме полного доступа, а не из песочницы агента.

## 4. Доступ к GitHub

Репозиторий: `https://github.com/Mkk72/HamstersLife.git`.

На машине агента `git ls-remote` падает с `SEC_E_NO_CREDENTIALS` — нужен один из вариантов:

1. Personal Access Token (classic, права `repo`; fine-grained — `contents: write`) и `git credential-manager` / `GCM`;
2. `gh auth login` (если установлен GitHub CLI);
3. SSH-ключ и remote вида `git@github.com:Mkk72/HamstersLife.git`.

Пока доступ не настроен, коммиты делаются локально в `main`.

## 5. Команды

```bash
pnpm install        # зависимости
pnpm verify         # типы + границы пакетов + тесты + сборка (то же, что CI)
pnpm typecheck      # только типы
pnpm test           # тесты всех пакетов
pnpm boundaries     # проверка границ пакетов (core/levelgen/ai без DOM, Node, Pixi)
pnpm lint           # ESLint
pnpm dev:web        # клиент в браузере (после появления apps/client)
```

Запуск только одного пакета:

```bash
pnpm --filter @hamsters/core test
```

## 6. Правила кодирования

- Язык кода и имён — английский; строки интерфейса — русские (позже выносятся в локализацию).
- В `packages/core` нет чисел с плавающей точкой: только целые milli-единицы и permille (см. `docs/ARCHITECTURE.md` §10).
- Новый `.ts`-файл с кириллицей в комментариях — UTF-8 без BOM (репозиторий целиком в UTF-8, LF).
- Коммиты — небольшими логическими фрагментами, сообщение по-русски, в теле — что и зачем.
