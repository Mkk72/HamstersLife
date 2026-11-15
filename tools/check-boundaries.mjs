#!/usr/bin/env node
// Проверка границ пакетов по компиляции и по импортам.
// Запуск: node tools/check-boundaries.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const HEADLESS = ['packages/core', 'packages/levelgen', 'packages/ai'];

const FORBIDDEN = [
  /^pixi\.js(\/|$)/,
  /^solid-js(\/|$)/,
  /^howler(\/|$)/,
  /^node:/,
  /^(fs|path|os|crypto)$/,
  /^@hamsters\/client(\/|$)/,
  /^\.{1,2}\/.*apps\//,
];

const errors = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

for (const pkg of HEADLESS) {
  const tsconfigPath = join(ROOT, pkg, 'tsconfig.json');
  let tsconfig;
  try {
    tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  } catch {
    errors.push(`${pkg}: нет tsconfig.json — граница по компиляции не задана`);
    continue;
  }
  const lib = tsconfig?.compilerOptions?.lib ?? [];
  if (!Array.isArray(lib) || lib.some((item) => /^dom/i.test(item))) {
    errors.push(`${pkg}: в compilerOptions.lib не должно быть DOM (сейчас: ${JSON.stringify(lib)})`);
  }
  const types = tsconfig?.compilerOptions?.types;
  if (!Array.isArray(types) || types.length !== 0) {
    errors.push(`${pkg}: в compilerOptions.types должен быть пустой массив`);
  }

  const srcDir = join(ROOT, pkg, 'src');
  let files = [];
  try {
    files = walk(srcDir);
  } catch {
    continue;
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const spec = match[1];
      const bad = FORBIDDEN.find((rule) => rule.test(spec));
      if (bad) {
        errors.push(`${normalize(relative(ROOT, file))}: запрещённый импорт "${spec}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Границы пакетов нарушены:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('Границы пакетов в порядке: core/levelgen/ai без DOM, Node, Pixi и интерфейса.');
