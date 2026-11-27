/* Модульные тесты логики технологического графа procLogic на данных data/26-proc-graph.PROC.json */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProcLogic } from './load.mjs';

const { L, PROC } = loadProcLogic();

test('граф: рёбра ссылаются на существующие узлы, арматуру и насосы', () => {
  for (const e of PROC.edges) {
    assert.ok(PROC.nodes[e.a] && PROC.nodes[e.b], `ребро ${e.id}: нет узла ${e.a} или ${e.b}`);
    if (e.k === 'valve') assert.ok(PROC.valves[e.v], `ребро ${e.id}: нет арматуры ${e.v}`);
    if (e.k === 'pump') assert.ok(PROC.pumps[e.pump], `ребро ${e.id}: нет насоса ${e.pump}`);
  }
});

test('исходно вся арматура закрыта — ни один насос не пускается', () => {
  L.closeAll && L.closeAll();
  for (const p of Object.keys(PROC.pumps)) {
    const r = L.canStart(p);
    assert.equal(r.ok, false, `${p} пускается при закрытой арматуре`);
  }
});

/* для маршрута — первый вариант «источник × приёмник × насос», по которому есть путь в графе */
function firstPath(r) {
  for (const p of r.pump) for (const s of r.src) for (const d of r.dst) {
    const path = L.findPath(s, d, p, r.prod, false);
    if (path && path.length) return { p, s, d, path };
  }
  return null;
}

for (const r of PROC.routes) {
  test(`маршрут ${r.id} «${r.n}»: путь есть, после сборки насос пускается, после закрытия — нет`, () => {
    const f = firstPath(r);
    assert.ok(f, `нет пути ни для одного варианта (${r.src} → ${r.dst} через ${r.pump})`);
    L.assemble(f.path);
    const ok = L.canStart(f.p);
    assert.equal(ok.ok, true, `${f.p}: ${ok.why}`);
    L.closeAll();
    assert.equal(L.canStart(f.p).ok, false);
  });
}
