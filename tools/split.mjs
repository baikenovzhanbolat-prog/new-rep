#!/usr/bin/env node
/*
 * Одноразовое разбиение монолитного genplan-3d-oskemen_vX.html на исходники.
 *
 *   node tools/split.mjs <исходный.html>
 *
 * Результат (в корне репозитория):
 *   src/index.html      — разметка-оболочка с маркерами сборки
 *   src/styles.css      — стили
 *   src/app/NN-*.js     — код приложения по разделам (склеиваются по порядку имён)
 *   vendor/             — three.module.js, OrbitControls.js, mp4-muxer.js
 *   assets/scans/       — сканы листов (WebP), assets/docs/ — PDF и страницы
 *   assets/bin/         — двоичные данные из кода (3D-модели zlib, текстуры, рельеф)
 *   data/               — крупные JSON-литералы из кода
 *
 * Сборка обратно — tools/build.mjs; разбиение проверено побайтовым совпадением.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/split.mjs <file.html>'); process.exit(1); }
const html = fs.readFileSync(src, 'utf8');
const lines = html.split('\n');             // lines[i] — строка i+1; последняя — '' (файл кончается \n)
const L = n => lines[n - 1];

const out = (rel, data) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return rel;
};
const used = new Set();
const uniq = (dir, base, ext) => {
  let name = `${dir}/${base}${ext}`, i = 2;
  while (used.has(name)) name = `${dir}/${base}_${i++}${ext}`;
  used.add(name);
  return name;
};

/* ---------- определение типа двоичных данных ---------- */
function extOf(buf) {
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.slice(1, 4).toString('latin1') === 'PNG') return '.png';
  if (buf.slice(0, 4).toString('latin1') === '%PDF') return '.pdf';
  if (buf[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(buf[1])) return '.zlib';
  return '.bin';
}
/* base64 → Buffer только если обратное кодирование даёт ту же строку */
function b64exact(s) {
  const b = Buffer.from(s, 'base64');
  return b.toString('base64') === s ? b : null;
}

/* ---------- поиск конца JSON-литерала (строки/скобки) ---------- */
function jsonEnd(s, i) {
  let depth = 0, inStr = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { if (--depth === 0) return k + 1; }
    else if (depth === 0) return -1;
  }
  return -1;
}

/* ---------- JSON с переносами: массивы из примитивов — в одну строку ---------- */
function pretty(v, ind = '') {
  const prim = x => x === null || typeof x !== 'object';
  if (prim(v)) return JSON.stringify(v);
  const ni = ind + '  ';
  if (Array.isArray(v)) {
    if (v.every(prim)) return JSON.stringify(v);
    if (!v.length) return '[]';
    return '[\n' + v.map(x => ni + pretty(x, ni)).join(',\n') + '\n' + ind + ']';
  }
  const ks = Object.keys(v);
  if (!ks.length) return '{}';
  return '{\n' + ks.map(k => ni + JSON.stringify(k) + ': ' + pretty(v[k], ni)).join(',\n') + '\n' + ind + '}';
}

/* ---------- вынос крупных литералов из кода ---------- */
const MIN_DATA = 3000;
function extractFromJs(text, tag) {
  const res = [];
  for (const line of text.split('\n')) {
    if (line.length < MIN_DATA) { res.push(line); continue; }
    let s = line;
    // 1) строки base64 в одинарных кавычках (в т. ч. data:URL) → двоичные файлы; base64 внутри JSON остаётся в JSON
    s = s.replace(/(')(data:[a-z/+.-]+;base64,)?([A-Za-z0-9+/]{2000,}={0,2})'/g, (m, q, pre, b64, off) => {
      const buf = b64exact(b64);
      if (!buf) return m;
      const nm = (/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^=]*$/.exec(s.slice(Math.max(0, off - 200), off)) || [])[1];
      const rel = uniq('assets/bin', (nm || tag).toLowerCase(), extOf(buf));
      out(rel, buf);
      return `${q}${pre || ''}/*@base64 ${rel}*/${q}`;
    });
    // 2) JSON-литералы после «=» → data/*.json
    let pos = 0, acc = '';
    const re = /(?:(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*)([{[])/g;
    let m;
    while ((m = re.exec(s))) {
      const st = m.index + m[0].length - 1, en = jsonEnd(s, st);
      if (en < 0 || en - st < MIN_DATA) continue;
      const lit = s.slice(st, en);
      let val; try { val = JSON.parse(lit); } catch { continue; }
      const canon = JSON.stringify(val) === lit;
      const rel = uniq('data', `${tag}.${m[1]}`, '.json');
      out(rel, canon ? pretty(val) + '\n' : lit);
      acc += s.slice(pos, st) + `/*@${canon ? 'json' : 'inline'} ${rel}*/null`;
      pos = en; re.lastIndex = en;
    }
    res.push(acc + s.slice(pos));
  }
  return res.join('\n');
}

/* ---------- разделы основного модуля (номер строки исходного файла → имя) ---------- */
const CHUNKS = [
  [2227, 'bootstrap-scene'], [2259, 'vis-quality'], [2341, 'materials-primitives'], [2742, 'terrain-relief'],
  [2870, 'environment'], [3022, 'rail-estakada177'], [3123, 'objects-facades'], [3278, 'dx3-models'],
  [3484, 'gk-tcar'], [3673, 'f24-fire-towers'], [4158, 'f25'], [4849, 'f27'], [5238, 'obj-registry'],
  [5356, 'nets-f28-audit'], [5511, 'f34-fixes'], [5596, 'f32-connectivity'], [5687, 'f29-ph200-piping'],
  [5814, 'f31-supports'], [6078, 'pipe-registry-data'], [6153, 'piped'], [6296, 'ugn-underground'],
  [6748, 'lighting-ph200'], [6854, 'models-loading'], [6957, 'rvsd'], [8090, 'f26'], [8166, 'proc-graph'],
  [8179, 'dxd'], [8766, 'reservoir-data'], [8906, 'rgsd'], [9337, 'estq'], [9848, 'proc-logic'],
  [9959, 'phx-pumphall'], [10518, 'proc-ui'], [10900, 'proc-sim'], [11352, 'sound'], [11396, 'select-camera'],
  [11473, 'estops'], [11636, 'matr'], [11866, 'panels-hud-keys'], [12014, 'pnet'], [13527, 'pflow'],
  [14167, 'emg'], [14680, 'walk'], [15105, 'geo'], [15306, 'rgsp'], [15725, 'dxp'], [16065, 'hyd35'],
  [16870, 'hydx'], [17437, 'ughl'], [17689, 'cine'], [19172, 'loop'],
];

/* ---------- проверки опорных строк ---------- */
const expect = (n, re) => { if (!re.test(L(n))) throw new Error(`строка ${n} не совпадает с ожидаемой: ${L(n).slice(0, 80)}`); };
expect(7, /^<style>$/); expect(161, /^<\/style>$/);
expect(164, /^<script>\/\* mp4-muxer/); expect(2092, /^<\/script>$/);
expect(2226, /^<script type="module">$/); expect(19197, /^<\/script>$/);
if (/@(inline|base64|json|concat) /.test(html)) throw new Error('в исходнике уже есть маркеры сборки');

const shell = [];
/* шапка и стили */
for (let n = 1; n <= 7; n++) shell.push(L(n));
out('src/styles.css', lines.slice(7, 160).join('\n') + '\n');
shell.push('<!--@inline src/styles.css--></style>');   // содержимое кончается \n
shell.push(L(162), L(163));
/* mp4-muxer: всё между <script> и </script> */
{
  const body = L(164).slice('<script>'.length) + '\n' + lines.slice(164, 2091).join('\n') + '\n';
  out('vendor/mp4-muxer.js', body);
  shell.push('<script><!--@inline vendor/mp4-muxer.js--></script>');
}
/* importmap: three и OrbitControls */
for (let n = 2093; n <= 2225; n++) {
  let s = L(n);
  s = s.replace(/("(three|three\/addons\/controls\/OrbitControls\.js)":"data:text\/javascript;base64,)([A-Za-z0-9+/=]+)"/, (m, pre, key, b64) => {
    const buf = b64exact(b64); if (!buf) throw new Error('importmap: base64 не канонический');
    const rel = key === 'three' ? 'vendor/three.module.js' : 'vendor/OrbitControls.js';
    out(rel, buf);
    return `${pre}<!--@base64 ${rel}-->"`;
  });
  s = s.replace(/^(<script type="text\/plain" id="([^"]+)">)([A-Za-z0-9+/=]+)(<\/script>)$/, (m, open, id, b64, close) => {
    const buf = b64exact(b64); if (!buf) return m;
    const rel = uniq(id.startsWith('dxP_') ? 'assets/scans' : 'assets/docs', id, extOf(buf));
    out(rel, buf);
    return `${open}<!--@base64 ${rel}-->${close}`;
  });
  shell.push(s);
}
/* основной модуль */
shell.push(L(2226));
for (let i = 0; i < CHUNKS.length; i++) {
  const [a, name] = CHUNKS[i], b = (CHUNKS[i + 1] || [19197])[0];
  const tag = String(i + 1).padStart(2, '0');
  const text = lines.slice(a - 1, b - 1).join('\n') + '\n';
  out(`src/app/${tag}-${name}.js`, extractFromJs(text, `${tag}-${name}`));
}
shell.push('<!--@concat src/app-->' + L(19197));   // каждый раздел кончается \n
for (let n = 19198; n <= lines.length; n++) shell.push(L(n));
out('src/index.html', shell.join('\n'));
console.log('готово:', CHUNKS.length, 'разделов кода');
