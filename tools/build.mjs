#!/usr/bin/env node
/*
 * Сборка автономного HTML из исходников.
 *
 *   node tools/build.mjs [--out dist/genplan-3d-oskemen.html]
 *
 * Маркеры (обрабатываются рекурсивно во всех подключаемых текстовых файлах):
 *   <!--@inline путь-->      — текст файла как есть
 *   <!--@base64 путь-->      — содержимое файла в base64 (картинки, PDF, библиотеки для data:URL)
 *   <!--@concat каталог-->   — склейка всех *.js каталога по порядку имён
 *   /*@base64 путь*\/         — то же внутри JS-строки
 *   /*@inline путь*\/null     — JSON-литерал как есть
 *   /*@json путь*\/null       — JSON-файл, сжатый в одну строку (JSON.stringify)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = rel => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`сборка: нет файла ${rel}`);
  return fs.readFileSync(p);
};

function expand(text, depth = 0) {
  if (depth > 4) throw new Error('сборка: слишком глубокая вложенность маркеров');
  return text.replace(
    /<!--@(inline|base64|concat) ([^>]+?)-->|\/\*@(base64) ([^*]+?)\*\/|\/\*@(inline|json) ([^*]+?)\*\/null/g,
    (m, k1, p1, k2, p2, k3, p3) => {
      const kind = k1 || k2 || k3, rel = (p1 || p2 || p3).trim();
      if (kind === 'base64') return rd(rel).toString('base64');
      if (kind === 'json') return JSON.stringify(JSON.parse(rd(rel).toString('utf8')));
      if (kind === 'concat') {
        const dir = path.join(ROOT, rel);
        return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
          .map(f => expand(fs.readFileSync(path.join(dir, f), 'utf8'), depth + 1)).join('');
      }
      return expand(rd(rel).toString('utf8'), depth + 1);   // inline
    });
}

export function build() {
  return expand(rd('src/index.html').toString('utf8'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  const outRel = i > 0 ? process.argv[i + 1] : 'dist/genplan-3d-oskemen.html';
  const html = build();
  const outPath = path.resolve(ROOT, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  const sha = crypto.createHash('sha256').update(html).digest('hex');
  console.log(`${path.relative(ROOT, outPath)}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} МБ  sha256 ${sha}`);
}
