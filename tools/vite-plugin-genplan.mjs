/*
 * Плагин Vite для генплана.
 *
 * Код приложения — 51 часть одного скрипта с общей областью видимости (src/app/NN-*.js),
 * поэтому Vite получает его не как набор ES-модулей, а как один виртуальный модуль,
 * склеенный тем же механизмом маркеров, что и эталонная сборка (tools/build.mjs).
 *
 *  - '/@genplan/app.js'  → склейка src/app/*.js с подстановкой data/ и assets/bin/
 *  - 'three', OrbitControls → vendor/ (та же сборка r160, что и в эталоне; importmap не нужен)
 *  - index.html: маркеры стилей, mp4-muxer, сканов и документов раскрываются в разметке
 *  - режим разработки: любое изменение в src/, data/, assets/, vendor/ → полная перезагрузка страницы
 *    (частичная горячая замена невозможна: все разделы делят одну область видимости)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, expand } from './build.mjs';

export const APP_URL = '/@genplan/app.js';
const APP_ID = '\0genplan-app.js';
const WATCH = ['src', 'data', 'assets', 'vendor'].map(d => path.join(ROOT, d));

/* ---------- склейка src/app с картой исходников: строка склейки → файл и строка раздела ----------
   Маркеры данных раскрываются в пределах своей строки, поэтому строки разделов соответствуют 1:1. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const vlq = n => { let v = n < 0 ? (-n << 1) | 1 : n << 1, s = ''; do { let d = v & 31; v >>>= 5; if (v) d |= 32; s += B64[d]; } while (v); return s; };
function appWithMap() {
  const dir = path.join(ROOT, 'src/app');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  let code = '', maps = [], prevSrc = 0, prevLine = 0;
  const sources = [], sourcesContent = [];
  files.forEach((f, si) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8'), part = expand(raw, 1);
    const n = part.split('\n').length - 1;
    if (n !== raw.split('\n').length - 1) throw new Error(`genplan: маркер в ${f} изменил число строк`);
    sources.push(path.join(dir, f)); sourcesContent.push(raw);
    for (let l = 0; l < n; l++) { maps.push('A' + vlq(si - prevSrc) + vlq(l - prevLine) + 'A'); prevSrc = si; prevLine = l; }
    code += part;
  });
  return { code, map: { version: 3, sources, sourcesContent, names: [], mappings: maps.join(';') } };
}

export default function genplan({ outName = 'genplan-3d-oskemen.html' } = {}) {
  let outDir = null;
  return {
    name: 'genplan',
    enforce: 'pre',

    configResolved(cfg) { outDir = path.resolve(cfg.root, cfg.build.outDir); },

    resolveId(id) {
      if (id === APP_URL || id.endsWith('@genplan/app.js')) return APP_ID;
      if (id === 'three') return path.join(ROOT, 'vendor/three.module.js');
      if (id === 'three/addons/controls/OrbitControls.js') return path.join(ROOT, 'vendor/OrbitControls.js');
      return null;
    },

    load(id) {
      if (id !== APP_ID) return null;
      return appWithMap();
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const imp = /<script type="importmap">[\s\S]*?<\/script>\n/;
        const app = '<script type="module">\n<!--@concat src/app--></script>';
        if (!imp.test(html) || !html.includes(app)) throw new Error('genplan: в src/index.html не найден importmap или маркер кода приложения');
        html = html.replace(imp, '').replace(app, `<script type="module" src="${APP_URL}"></script>`);
        return expand(html);
      },
    },

    configureServer(server) {
      server.watcher.add(WATCH);
      const reload = file => {
        if (!WATCH.some(d => file.startsWith(d + path.sep))) return;
        const m = server.moduleGraph.getModuleById(APP_ID);
        if (m) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: 'full-reload', path: '*' });
      };
      for (const ev of ['change', 'add', 'unlink']) server.watcher.on(ev, reload);
    },

    // собственная перезагрузка (выше) вместо стандартной обработки Vite
    handleHotUpdate({ file }) {
      if (WATCH.some(d => file.startsWith(d + path.sep))) return [];
    },

    // итоговый файл — под постоянным именем, как и раньше
    closeBundle() {
      if (!outDir) return;
      const from = path.join(outDir, 'index.html');
      if (fs.existsSync(from)) fs.renameSync(from, path.join(outDir, outName));
    },
  };
}
