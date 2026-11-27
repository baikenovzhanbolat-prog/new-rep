#!/usr/bin/env node
/*
 * Проверка мобильного вида (эмуляция iPhone 13, портрет и альбом):
 *  - верхняя панель занимает не больше 15 % высоты экрана;
 *  - видимые подписи не пересекаются;
 *  - меню «☰» открывается и показывает все кнопки режимов; выбор пункта закрывает меню и открывает панель под верхней полосой.
 *
 *   node tools/mobile-check.mjs [файл.html]     — по умолчанию dist/genplan-3d-oskemen.html
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './build.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const file = path.resolve(ROOT, process.argv[2] || 'dist/genplan-3d-oskemen.html');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
const fail = msg => { bad++; console.error('  ✗ ' + msg); };
for (const [nm, dev] of [['портрет', devices['iPhone 13']], ['альбом', devices['iPhone 13 landscape']]]) {
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => performance.now() > 16000, null, { timeout: 300000, polling: 500 });
  const m = await page.evaluate(() => {
    const t = document.getElementById('top').getBoundingClientRect();
    const L = [...document.querySelectorAll('#labels .lb')].filter(e => e.style.display !== 'none' && e.offsetWidth).map(e => e.getBoundingClientRect());
    let ov = 0;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) ov++; }
    return { share: t.bottom / innerHeight, labels: L.length, ov, all: document.querySelectorAll('#top .btn:not(#bMenu)').length };
  });
  const hasMenu = await page.evaluate(() => { const b = document.getElementById('bMenu'); if (b) b.click(); return !!b; });
  await page.waitForTimeout(800);
  const open = await page.evaluate(() => ({ on: document.body.classList.contains('menuOpen'), shown: [...document.querySelectorAll('#top .btn:not(#bMenu)')].filter(b => b.offsetWidth).length }));
  await page.evaluate(() => document.getElementById('bObj').click());
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ on: document.body.classList.contains('menuOpen'), objp: getComputedStyle(document.getElementById('objp')).display, objTop: document.getElementById('objp').getBoundingClientRect().top, topBottom: document.getElementById('top').getBoundingClientRect().bottom }));
  await ctx.close();
  console.log(`${nm}: панель ${(m.share * 100).toFixed(0)} % высоты, подписей ${m.labels}, пересечений ${m.ov}; в меню ${open.shown} кнопок`);
  if (m.share > 0.15) fail(`${nm}: верхняя панель ${(m.share * 100).toFixed(0)} % высоты (> 15 %)`);
  if (m.ov) fail(`${nm}: ${m.ov} пересечений подписей`);
  if (!hasMenu) fail(`${nm}: нет кнопки «☰ Меню»`);
  else if (!open.on || open.shown < 10) fail(`${nm}: меню не открылось или показывает ${open.shown} кнопок`);
  if (hasMenu && after.on) fail(`${nm}: меню не закрылось после выбора пункта`);
  if (after.objp !== 'flex' || after.objTop < after.topBottom - 1) fail(`${nm}: панель «Объекты» не открылась под верхней полосой`);
  if (errors.length) fail(`${nm}: ошибки JS: ${errors.join('; ')}`);
}
await browser.close();
if (bad) process.exit(1);
console.log('мобильный вид в порядке');
