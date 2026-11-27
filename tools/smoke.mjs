#!/usr/bin/env node
/*
 * Смоук-тест собранного файла в headless Chromium (Playwright):
 * страница загружается, сцена рисуется, панели открываются — без ошибок JS.
 *
 *   node tools/smoke.mjs [dist/genplan-3d-oskemen.html]
 *
 * Нужен пакет playwright (npm i -D playwright && npx playwright install chromium).
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './build.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Нет пакета playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const file = path.resolve(ROOT, process.argv[2] || 'dist/genplan-3d-oskemen.html');
const PANELS = ['bObj', 'bNet', 'bProc', 'bUG', 'bPipe', 'bGP', 'bTop', 'b3d'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const t0 = Date.now();
await page.goto('file://' + file, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => /выз\./.test(document.getElementById('perf')?.textContent || ''), null, { timeout: 120000 });
const loadMs = Date.now() - t0;
const perf0 = await page.textContent('#perf');

for (const id of PANELS) {
  // клик через DOM: в программном рендере кадр идёт секунды, обычный клик Playwright ждёт «стабильности»
  await page.evaluate(id => document.getElementById(id)?.click(), id);
  await page.waitForTimeout(1500);
  await page.evaluate(id => document.getElementById(id)?.click(), id);
  await page.waitForTimeout(300);
}
await browser.close();

console.log(`загрузка ${loadMs} мс; ${perf0.trim()}`);
if (errors.length) { console.error('ОШИБКИ:\n' + errors.join('\n')); process.exit(1); }
console.log('смоук-тест пройден: ошибок JS нет, панели: ' + PANELS.join(', '));
