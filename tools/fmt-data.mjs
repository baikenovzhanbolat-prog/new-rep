#!/usr/bin/env node
/*
 * Форматирование data/*.json для чтения и осмысленных git-diff.
 *   node tools/fmt-data.mjs          — переформатировать все файлы (идемпотентно)
 *   node tools/fmt-data.mjs --check  — только проверить (код выхода 1, если что-то не отформатировано)
 *
 * Правила: объекты и массивы составных значений — по одному элементу в строке; массивы из чисел/строк —
 * в одну строку, длинные — с переносом по ширине. В сборке файл сжимается обратно (маркер /*@json …*\/null).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './build.mjs';

const WIDTH = 120;
const prim = x => x === null || typeof x !== 'object';

export function pretty(v, ind = '') {
  if (prim(v)) return JSON.stringify(v);
  const ni = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(prim)) {
      const one = JSON.stringify(v);
      if (one.length + ind.length <= WIDTH) return one;
      const lines = []; let cur = '';
      for (const x of v.map(x => JSON.stringify(x))) {
        if (cur && ni.length + cur.length + x.length + 1 > WIDTH) { lines.push(cur); cur = ''; }
        cur += (cur ? ',' : '') + x;
      }
      lines.push(cur);
      return '[\n' + lines.map(l => ni + l).join(',\n') + '\n' + ind + ']';
    }
    return '[\n' + v.map(x => ni + pretty(x, ni)).join(',\n') + '\n' + ind + ']';
  }
  const ks = Object.keys(v);
  if (!ks.length) return '{}';
  return '{\n' + ks.map(k => ni + JSON.stringify(k) + ': ' + pretty(v[k], ni)).join(',\n') + '\n' + ind + '}';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const dir = path.join(ROOT, 'data');
  let bad = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const p = path.join(dir, f), txt = fs.readFileSync(p, 'utf8'), out = pretty(JSON.parse(txt)) + '\n';
    if (txt === out) continue;
    bad++;
    if (check) console.error('не отформатирован: data/' + f);
    else { fs.writeFileSync(p, out); console.log('отформатирован: data/' + f); }
  }
  if (check && bad) process.exit(1);
  if (!bad) console.log('data/*.json — в порядке');
}
