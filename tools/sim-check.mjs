#!/usr/bin/env node
/*
 * Проверка: расчёт не зависит от отображения.
 * Граничные условия гидравлики (отметки зеркала в ёмкостях) снимаются при показанных моделях склада,
 * затем при скрытых (как при выключении слоя «Модели склада») — должны совпасть.
 *
 *   node tools/sim-check.mjs [файл.html]     — по умолчанию dist/genplan-3d-oskemen.html
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './build.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const file = path.resolve(ROOT, process.argv[2] || 'dist/genplan-3d-oskemen.html');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + file + '?debug', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__genplan && window.__HYDX && performance.now() > 16000, null, { timeout: 300000, polling: 500 });

const res = await page.evaluate(() => {
  const KEYS = ['RVS1', 'RVS2', 'RVS3', 'RGSZ1', 'RGSZ2', 'RGSB1', 'RGSB2', 'USN1', 'USN2', 'USN3', 'UPVS', 'UNZH', 'ASN', 'KOT', 'DES', 'TRK'];
  const snap = () => Object.fromEntries(KEYS.map(k => { const b = window.__HYDX.boundary(k); return [k, b ? b.kind + ' ' + b.z.toFixed(4) : 'нет']; }));
  const shown = snap();
  const objs = window.__genplan.OBJ.filter(o => o.gM);
  const vis = objs.map(o => o.gM.visible);
  objs.forEach(o => { o.gM.visible = false; });   // слой «Модели склада» выключен
  const hidden = snap();
  objs.forEach((o, i) => { o.gM.visible = vis[i]; });
  return { shown, hidden, models: objs.length };
});
await browser.close();

let bad = 0;
console.log(`моделей склада: ${res.models}`);
for (const k of Object.keys(res.shown)) {
  const same = res.shown[k] === res.hidden[k];
  if (!same) bad++;
  console.log(`${same ? '  ' : '≠ '}${k.padEnd(6)} модели показаны: ${res.shown[k].padEnd(14)} скрыты: ${res.hidden[k]}`);
}
if (errors.length) { console.error('ОШИБКИ JS:\n' + errors.join('\n')); process.exit(1); }
if (bad) { console.error(`расчёт зависит от отображения: ${bad} граничных условий меняются при скрытии моделей`); process.exit(1); }
console.log('расчёт не зависит от отображения моделей');
