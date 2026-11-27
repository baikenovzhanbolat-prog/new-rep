#!/usr/bin/env node
/*
 * Профиль запуска и отрисовки (headless Chromium, программный рендер — абсолютные числа завышены,
 * важны доли и сравнение «до/после»).
 *
 *   node tools/profile.mjs [имя]    → dist/profile/<имя>.json и сводка в консоль
 *
 * Собирает вариант эталонной сборки с отметкой времени в начале каждого раздела src/app/NN-*.js
 * (разделы начинаются на верхнем уровне скрипта — вставка безопасна), затем измеряет:
 *  - время выполнения каждого раздела (синхронная инициализация);
 *  - время до первого кадра, до загрузки моделей; кучу JS;
 *  - вызовы отрисовки и треугольники за кадр (renderer.info), в т. ч. проход теней;
 *  - вклад верхних групп сцены: видимые меши, теневые меши, треугольники.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, expand } from './build.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const name = process.argv[2] || 'now';
const OUT = path.join(ROOT, 'dist/profile');
fs.mkdirSync(OUT, { recursive: true });

/* сборка с отметками */
const dir = path.join(ROOT, 'src/app');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
let app = '';
files.forEach((f, i) => {
  let t = expand(fs.readFileSync(path.join(dir, f), 'utf8'), 1);
  if (i === 0) {   // import должны идти первыми
    const lines = t.split('\n'); let k = 0; while (/^import /.test(lines[k])) k++;
    t = lines.slice(0, k).join('\n') + `\n(window.__T = window.__T || []).push(['${f}', performance.now()]);\n` + lines.slice(k).join('\n');
  } else t = `(window.__T = window.__T || []).push(['${f}', performance.now()]);\n` + t;
  app += t;
});
app += `window.__T.push(['конец', performance.now()]);\n`;
const shell = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8').replace('<!--@concat src/app-->', () => '<!--@inline dist/profile/app.js-->');
fs.writeFileSync(path.join(OUT, 'app.js'), app);
const html = expand(shell);
const file = path.join(OUT, 'profile.html');
fs.writeFileSync(file, html);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__t0 = performance.now();
  let a = 12345; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { if (!window.__firstFrame) window.__firstFrame = performance.now(); cb(t); });
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + file + '?debug', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__genplan && performance.now() > 16000, null, { timeout: 300000, polling: 500 });
// средние вызовы отрисовки за реальные кадры (камера неподвижна), 40 кадров
const avg = await page.evaluate(() => new Promise(res => {
  const { renderer } = window.__genplan, L = [];
  renderer.info.autoReset = false; renderer.info.reset();   // накопление за весь кадр (в кадре может быть несколько render())
  const step = () => {
    L.push([renderer.info.render.calls, renderer.info.render.triangles]); renderer.info.reset();
    if (L.length < 41) requestAnimationFrame(step);
    else { renderer.info.autoReset = true; L.shift(); const m = i => Math.round(L.reduce((x, v) => x + v[i], 0) / L.length); res({ frames: L.length, calls: m(0), tris: m(1), max: Math.max(...L.map(v => v[0])), min: Math.min(...L.map(v => v[0])) }); }
  };
  requestAnimationFrame(step);
}));
const r = await page.evaluate(() => {
  const G = window.__genplan, { renderer, scene, camera } = G;
  // замер одного кадра
  renderer.info.autoReset = false; renderer.info.reset();
  renderer.render(scene, camera);
  const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
  renderer.info.autoReset = true;
  const shadowOn = renderer.shadowMap.enabled;
  // вклад верхних групп (видимые меши в пирамиде камеры не учитываются — оценка сверху)
  const groups = [];
  const visible = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  for (const c of scene.children) {
    let meshes = 0, shadow = 0, tri = 0, inst = 0;
    c.traverse(m => {
      if (!(m.isMesh || m.isLine || m.isPoints) || !visible(m)) return;
      meshes++; if (m.castShadow) shadow++;
      const g = m.geometry; const n = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      tri += n * (m.isInstancedMesh ? m.count : 1); if (m.isInstancedMesh) inst++;
    });
    if (meshes) {
      const o = G.OBJ.find(q => q.g === c);
      groups.push({ name: o ? 'OBJ ' + o.id + ' ' + (o.name || '').slice(0, 40) : (c.name || c.type), meshes, shadow, tri: Math.round(tri), inst });
    }
  }
  groups.sort((a, b) => b.meshes - a.meshes);
  const T = window.__T, sec = [];
  for (let i = 0; i < T.length - 1; i++) sec.push([T[i][0], +(T[i + 1][1] - T[i][1]).toFixed(1)]);
  let objs = 0; scene.traverse(() => objs++);
  return {
    sync: +(T[T.length - 1][1] - T[0][1]).toFixed(0), firstFrame: +(window.__firstFrame || 0).toFixed(0), scriptStart: +T[0][1].toFixed(0),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    calls, tris, shadowOn, objs, sec, groups,
    purged: window.__purgeOld ? window.__purgeOld.n : null,
  };
});
r.avg = avg;
await browser.close();
fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(r, null, 1));
console.log(`синхронная инициализация ${r.sync} мс (скрипт начат на ${r.scriptStart} мс), первый кадр ${r.firstFrame} мс, куча ${r.heapMB} МБ`);
console.log(`кадр: ${r.calls} вызовов отрисовки, ${(r.tris / 1e6).toFixed(2)} млн треугольников (с тенями: ${r.shadowOn}); объектов сцены ${r.objs}; purgeOld удалил ${r.purged}`);
console.log(`в среднем за кадр (камера неподвижна): ${r.avg.calls} вызовов (от ${r.avg.min} до ${r.avg.max}), ${(r.avg.tris / 1e6).toFixed(2)} млн тр.`);
console.log('самые долгие разделы:');
for (const [f, ms] of [...r.sec].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(ms).padStart(8)} мс  ${f}`);
console.log('верхние группы по числу видимых мешей:');
for (const g of r.groups.slice(0, 18)) console.log(`  ${String(g.meshes).padStart(5)} мешей (${String(g.shadow).padStart(4)} с тенью, ${String(g.inst).padStart(3)} inst) ${String(g.tri).padStart(8)} тр.  ${g.name}`);
if (errors.length) console.error('ОШИБКИ JS:\n' + errors.join('\n'));
