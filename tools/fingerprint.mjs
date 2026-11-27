#!/usr/bin/env node
/*
 * «Отпечаток» собранного файла: полное состояние после инициализации — для проверки,
 * что рефакторинг не изменил ни сцену, ни данные.
 *
 *   node tools/fingerprint.mjs файл.html [имя]          → dist/fp/<имя>.json
 *   node tools/fingerprint.mjs --diff A.json B.json      → различия (код выхода 1, если есть)
 *
 * Что входит:
 *  - каждый видимый/невидимый объект сцены с геометрией: тип, имя, путь из имён родителей, видимость,
 *    мировая матрица, хеш атрибутов и индексов геометрии, материал (тип, цвет, прозрачность, сторона, текстура),
 *    для InstancedMesh — число экземпляров и хеш матриц;
 *  - данные после всех правок: NETS, PH, UG_DATA, PHX_DATA, PROC, WELLS_DATA, GP5V, PIPEREG, реестр объектов OBJ;
 *  - журналы модулей F24…F34 (.log), число объектов выбора (pickables).
 * Анимированные свойства (меняются между двумя снимками с интервалом 1,5 с) помечаются «~» и не сравниваются.
 * Порядок объектов не важен (записи сортируются), важен только итоговый набор.
 * Math.random детерминирован (одинаковое зерно), чтобы декоративные объекты совпадали.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { ROOT } from './build.mjs';

const OUT = path.join(ROOT, 'dist/fp');
const args = process.argv.slice(2);

if (args[0] === '--diff') process.exit(diff(args[1], args[2]) ? 1 : 0);

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = path.resolve(ROOT, args[0] || 'dist/genplan-3d-oskemen.html');
const name = args[1] || path.basename(file, '.html');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { let s = 12345; Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + file + '?debug', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__genplan && performance.now() > 16000, null, { timeout: 240000, polling: 500 });

const snap = () => page.evaluate(() => {
  const G = window.__genplan, { scene } = G;
  scene.updateMatrixWorld(true);
  const r4 = x => Math.round(x * 1e4);
  const h = (arr) => {   // FNV-1a по округлённым значениям
    let a = 0x811c9dc5;
    for (let i = 0; i < arr.length; i++) { const v = Math.round(arr[i] * 1e4) | 0; a = Math.imul(a ^ (v & 0xffff), 16777619); a = Math.imul(a ^ (v >>> 16), 16777619); }
    return (a >>> 0).toString(36) + ':' + arr.length;
  };
  const geoCache = new Map();
  const geoSig = g => {
    if (geoCache.has(g)) return geoCache.get(g);
    const at = Object.keys(g.attributes).sort().map(k => k + '=' + h(g.attributes[k].array));
    const s = at.join(',') + (g.index ? ' i=' + h(g.index.array) : '') + ' dr=' + g.drawRange.start + '/' + g.drawRange.count;
    geoCache.set(g, s); return s;
  };
  const col = c => c && c.isColor ? c.getHexString() : '';
  const tex = t => t ? (t.image ? (t.image.width || 0) + 'x' + (t.image.height || 0) : 'tex') : '';
  const matSig = m => [m.type, col(m.color), col(m.emissive), r4(m.opacity ?? 1), m.transparent ? 't' : '', m.visible ? '' : 'H', m.side, m.wireframe ? 'w' : '',
    tex(m.map), r4(m.roughness ?? 0), r4(m.metalness ?? 0), m.depthWrite ? '' : 'nz', m.vertexColors ? 'vc' : ''].join('/');
  const pathOf = o => { const p = []; for (let q = o; q && q !== scene; q = q.parent) p.push(q.name || q.type); return p.reverse().join(' › '); };
  const recs = {};
  scene.traverse(o => {
    if (!o.geometry) return;
    let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) { vis = false; break; }
    recs[o.uuid] = {
      k: o.type + ' | ' + pathOf(o),
      vis: vis ? 'V' : 'h',
      m: o.matrixWorld.elements.map(r4).join(','),
      g: geoSig(o.geometry),
      mat: [].concat(o.material || []).map(matSig).join(';'),
      inst: o.isInstancedMesh ? o.count + ':' + h(o.instanceMatrix.array.subarray(0, o.count * 16)) : '',
    };
  });
  const seen = new WeakSet(), objSet = new Set(G.OBJ);
  const rep = function (k, v) {
    const raw = k === '' ? v : this[k];   // исходное значение (до toJSON у объектов Three.js)
    if (raw && typeof raw === 'object' && (raw.isObject3D || raw.isMaterial || raw.isBufferGeometry || raw.isTexture)) return '[THREE]';
    if (v && typeof v === 'object') {
      if (v.isObject3D || v.isMaterial || v.isBufferGeometry || v.isTexture || v instanceof Node) return '[THREE]';
      if (ArrayBuffer.isView(v)) return 'TA ' + h(v);
      if (objSet.has(v)) return '[OBJ ' + v.id + ']';   // ссылки на объекты генплана — по номеру
      if (seen.has(v)) return '[цикл]';
      seen.add(v);
    }
    if (typeof v === 'function') return undefined;
    if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
    return v;
  };
  const js = o => { try { return String(JSON.stringify(o, rep)); } catch (e) { return 'ERR ' + e.message; } };
  const data = {};
  for (const [k, v] of Object.entries(G.data)) data[k] = js(v);
  data.PIPEREG = js(G.PIPEREG);
  data.OBJ = js(G.OBJ.map(o => ({ ...o })));   // поверхностные копии: вложенные ссылки на объекты — по номеру
  for (const [k, v] of Object.entries(G.logs)) data['log.' + k] = js(v && v.log);
  data.pickables = String(G.pickables.length);
  return { recs, data };
});

const A = await snap();
await page.waitForTimeout(1500);
const B = await snap();
await browser.close();

/* анимированные поля → «~» */
const recs = [];
for (const [id, a] of Object.entries(A.recs)) {
  const b = B.recs[id] || {};
  const r = {};
  for (const f of Object.keys(a)) r[f] = a[f] === b[f] ? a[f] : '~';
  recs.push(Object.values(r).join(' ¦ '));
}
recs.sort();
const data = {};
for (const [k, v] of Object.entries(A.data)) data[k] = v === B.data[k] ? v : '~' + v;
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const res = {
  file: path.relative(ROOT, file), errors,
  summary: { objects: recs.length, scene: sha(recs.join('\n')), data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, sha(v)])) },
  recs, data,
};
fs.mkdirSync(OUT, { recursive: true });
const outFile = path.join(OUT, name + '.json');
fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
console.log(`${path.relative(ROOT, outFile)}: объектов ${recs.length}, сцена ${res.summary.scene}, ошибок JS ${errors.length}`);
if (errors.length) console.error(errors.join('\n'));

function diff(fa, fb) {
  const a = JSON.parse(fs.readFileSync(path.resolve(ROOT, fa))), b = JSON.parse(fs.readFileSync(path.resolve(ROOT, fb)));
  let bad = false;
  for (const k of new Set([...Object.keys(a.data), ...Object.keys(b.data)])) {
    if (a.data[k] === b.data[k]) continue;
    bad = true;
    const x = a.data[k] || '', y = b.data[k] || '';
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    console.log(`ДАННЫЕ ${k}: различие с позиции ${i}\n  A: …${x.slice(Math.max(0, i - 80), i + 120)}\n  B: …${y.slice(Math.max(0, i - 80), i + 120)}`);
  }
  const cnt = arr => { const m = new Map(); for (const r of arr) m.set(r, (m.get(r) || 0) + 1); return m; };
  const ca = cnt(a.recs), cb = cnt(b.recs), onlyA = [], onlyB = [];
  for (const [r, n] of ca) for (let i = 0; i < n - (cb.get(r) || 0); i++) onlyA.push(r);
  for (const [r, n] of cb) for (let i = 0; i < n - (ca.get(r) || 0); i++) onlyB.push(r);
  if (onlyA.length || onlyB.length) {
    bad = true;
    console.log(`СЦЕНА: объектов A ${a.recs.length}, B ${b.recs.length}; только в A: ${onlyA.length}, только в B: ${onlyB.length}`);
    const short = r => r.length > 260 ? r.slice(0, 260) + '…' : r;
    for (const r of onlyA.slice(0, 15)) console.log('  − ' + short(r));
    for (const r of onlyB.slice(0, 15)) console.log('  + ' + short(r));
  }
  if (!bad) console.log(`отпечатки совпадают: ${a.recs.length} объектов сцены, ${Object.keys(a.data).length} наборов данных`);
  return bad;
}
