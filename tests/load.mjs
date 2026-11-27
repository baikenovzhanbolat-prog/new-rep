/*
 * Загрузка чистых модулей приложения в Node (без браузера, DOM и Three.js).
 * Модули — части одного скрипта с общей областью видимости, поэтому выполняются в отдельном контексте vm
 * вместе с нужными данными.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ядро гидравлики HYD35 (47-hyd35.js) */
export function loadHyd35() {
  const ctx = vm.createContext({});
  vm.runInContext(rd('src/app/47-hyd35.js'), ctx, { filename: '47-hyd35.js' });
  return ctx.HYD35;
}

/* логика технологического графа procLogic (31-proc-logic.js) на данных PROC */
export function loadProcLogic() {
  const ctx = vm.createContext({ console });
  const code = 'const PROC = ' + rd('data/26-proc-graph.PROC.json') + ';\n' + rd('src/app/31-proc-logic.js') + '\nglobalThis.procLogic = procLogic; globalThis.PROC = PROC;';
  vm.runInContext(code, ctx, { filename: '31-proc-logic.js' });
  return { L: ctx.procLogic, PROC: ctx.PROC };
}
