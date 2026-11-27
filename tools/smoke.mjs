#!/usr/bin/env node
/*
 * Смоук-тест собранного файла в headless Chromium (Playwright):
 * страница загружается, сцена рисуется, панели открываются — без ошибок JS.
 *
 *   node tools/smoke.mjs [файл.html]            — по умолчанию dist/genplan-3d-oskemen.html (сборка Vite)
 *   node tools/smoke.mjs A.html B.html          — плюс сравнение двух сборок: тексты интерфейса
 *                                                 после каждой панели и статистика отрисовки должны совпасть
 *
 * Нужен пакет playwright (npm i -D playwright && npx playwright install chromium).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './build.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Нет пакета playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const files = (process.argv.slice(2).length ? process.argv.slice(2) : ['dist/genplan-3d-oskemen.html']).map(f => path.resolve(ROOT, f));
const PANELS = ['bObj', 'bNet', 'bProc', 'bUG', 'bPipe', 'bGP', 'bTop', 'b3d'];
const SHOTS = path.join(ROOT, 'dist/smoke');

async function run(browser, file, idx) {
  if (!fs.existsSync(file)) throw new Error('нет файла ' + file);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // одинаковая «случайность» во всех прогонах — для сравнения сборок
  await page.addInitScript(() => { let s = 12345; Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  const t0 = Date.now();
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => /выз\./.test(document.getElementById('perf')?.textContent || ''), null, { timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(3000);
  const perf = (await page.textContent('#perf')).replace(/^.*?к\/с · /, '').trim();   // без к/с
  const texts = {};
  // видимый текст интерфейса (innerText учитывает CSS: скрытые панели не попадают)
  const uiText = () => page.evaluate(() => {
    const perf = document.getElementById('perf'), keep = perf.textContent;
    perf.textContent = '';
    const t = document.body.innerText;
    perf.textContent = keep;
    return t.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '<время>').replace(/\d+(,\d+)? мс/g, '<N> мс');   // часы и замеры времени
  });
  texts.start = await uiText();
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${idx}-start.png`) });
  for (const id of PANELS) {
    // клик через DOM: в программном рендере кадр идёт секунды, обычный клик Playwright ждёт «стабильности»
    await page.evaluate(id => document.getElementById(id)?.click(), id);
    await page.waitForTimeout(1500);
    texts[id] = await uiText();
    fs.writeFileSync(path.join(SHOTS, `${idx}-${id}.txt`), texts[id]);
    await page.evaluate(id => document.getElementById(id)?.click(), id);
    await page.waitForTimeout(300);
  }
  await page.close();
  return { file: path.relative(ROOT, file), loadMs, perf, texts, errors };
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const res = [];
for (let i = 0; i < files.length; i++) res.push(await run(browser, files[i], i));
await browser.close();

let fail = false;
for (const r of res) {
  console.log(`${r.file}: загрузка ${r.loadMs} мс; ${r.perf}`);
  if (r.errors.length) { fail = true; console.error('  ОШИБКИ:\n  ' + r.errors.join('\n  ')); }
}
if (res.length === 2) {
  const [a, b] = res;
  if (a.perf !== b.perf) { fail = true; console.error(`  РАЗЛИЧИЕ статистики отрисовки: ${a.perf} ≠ ${b.perf}`); }
  for (const k of Object.keys(a.texts)) {
    if (a.texts[k] === b.texts[k]) continue;
    fail = true;
    const la = a.texts[k].split('\n'), lb = b.texts[k].split('\n');
    const d = la.findIndex((l, i) => l !== lb[i]);
    console.error(`  РАЗЛИЧИЕ текста интерфейса [${k}], строка ${d + 1}:\n    A: ${la[d]}\n    B: ${lb[d]}`);
  }
  if (!fail) console.log(`сборки совпадают: статистика отрисовки и тексты интерфейса (${Object.keys(a.texts).length} состояний)`);
}
if (fail) process.exit(1);
console.log('смоук-тест пройден: ошибок JS нет, панели: ' + PANELS.join(', ') + `; скриншоты — ${path.relative(ROOT, SHOTS)}/`);
