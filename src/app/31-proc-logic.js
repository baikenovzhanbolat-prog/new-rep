/* ---------- Логика ---------- */
const procLogic = (() => {
  const N = PROC.nodes, E = PROC.edges, V = PROC.valves, PU = PROC.pumps;
  const st = { valve: {}, pump: {} };
  for (const k in V) st.valve[k] = false;
  for (const k in PU) st.pump[k] = false;
  const adj = {};
  for (const e of E) { (adj[e.a] = adj[e.a] || []).push([e, e.b, 1]); (adj[e.b] = adj[e.b] || []).push([e, e.a, -1]); }
  const TERM = new Set(Object.keys(N).filter(k => ['tank', 'src', 'cons'].includes(N[k].t)));
  const isSrc = k => N[k].t === 'tank' || N[k].t === 'src', isSink = k => N[k].t === 'tank' || N[k].t === 'cons';
  const prodOf = k => N[k].prod || 'LZB';
  const prodOk = (e, prod) => prod === 'LZB' || e.prod === prod || e.prod === 'LZB' || (e.prod === 'LZ' && 'LZ'.includes(prod));
  const vOpen = e => e.k !== 'valve' || st.valve[e.v];

  /* Путь src → dst через заданный насос (по направлению насоса и обратных клапанов), не проходя через другие ёмкости/потребители */
  function findPath(src, dst, pump, prod, useState) {
    const key = (u, f) => u + '|' + f, prev = new Map([[key(src, 0), null]]), q = [[src, 0]];
    while (q.length) {
      const [u, f] = q.shift();
      if (u === dst && f) break;
      if (TERM.has(u) && u !== src) continue;
      for (const [e, v, d] of adj[u] || []) {
        if (e.prod === 'D' || e.prod === 'G' || !prodOk(e, prod)) continue;
        let nf = f;
        if (e.k === 'pump') { if (d !== 1 || e.pump !== pump || f) continue; nf = 1; }
        else if (e.k === 'check' && d !== 1) continue;
        if (useState && !vOpen(e)) continue;
        if (TERM.has(v) && v !== dst) continue;
        const kk = key(v, nf); if (prev.has(kk)) continue;
        prev.set(kk, [u, f, e, d]); q.push([v, nf]);
      }
    }
    let s = key(dst, 1); if (!prev.has(s)) return null;
    const path = [];
    while (prev.get(s)) { const [u, f, e, d] = prev.get(s); path.push({ e, d }); s = key(u, f); }
    return path.reverse();
  }
  /* Ёмкости/потребители, связанные с узлом через открытую арматуру (без прохода через насосы). dir: +1 — по потоку, −1 — против */
  function reach(from, dir) {
    const seen = new Set([from]), q = [from], term = new Set();
    while (q.length) {
      const u = q.shift();
      for (const [e, v, d] of adj[u] || []) {
        if (e.k === 'pump' || e.prod === 'D' || e.prod === 'G' || !vOpen(e)) continue;
        if (e.k === 'check' && d !== dir) continue;
        if (seen.has(v)) continue; seen.add(v);
        if (TERM.has(v)) { term.add(v); continue; }
        q.push(v);
      }
    }
    return [...term];
  }
  const pumpEdges = id => E.filter(e => e.k === 'pump' && e.pump === id);
  function pumpLinks(id) {
    const e = pumpEdges(id)[0]; if (!e) return { suc: [], dis: [] };
    const suc = TERM.has(e.a) ? [e.a] : reach(e.a, -1).filter(isSrc), dis = TERM.has(e.b) ? [e.b] : reach(e.b, 1).filter(isSink);
    return { suc, dis };
  }
  function canStart(id) {
    const L = pumpLinks(id);
    if (!L.suc.length) return { ok: false, why: 'на всасывании нет открытой связи с резервуаром или устройством слива (закрыта арматура)' };
    if (!L.dis.length) return { ok: false, why: 'на нагнетании нет открытой связи с приёмником (работа на закрытую задвижку недопустима)' };
    for (const h of startHooks) { const r = h(id, L); if (r) return { ok: false, why: r }; }
    return { ok: true, L };
  }
  const listeners = [], startHooks = [];
  const emit = (msg, lvl) => listeners.forEach(f => f(msg, lvl));
  function guard() {   // модельная защита: насос без связи на всасе/нагнетании останавливается
    for (const k in st.pump) if (st.pump[k]) { const c = canStart(k); if (!c.ok) { st.pump[k] = false; emit(`${PU[k].n} остановлен: ${c.why}.`, 'err'); } }
  }
  function setValve(id, open) { st.valve[id] = !!open; guard(); emit(null); }
  function setPump(id, run) {
    if (run) { const c = canStart(id); if (!c.ok) { emit(`Пуск ${PU[id].n} запрещён: ${c.why}.`, 'err'); return false; } }
    st.pump[id] = !!run; emit(run ? `${PU[id].n} в работе (модель).` : `${PU[id].n} остановлен.`, run ? 'ok' : 'info'); return true;
  }
  function closeAll() { for (const k in st.pump) st.pump[k] = false; for (const k in st.valve) st.valve[k] = false; emit('Вся арматура закрыта, насосы остановлены.', 'info'); }
  function assemble(path) {
    for (const k in st.pump) st.pump[k] = false;
    for (const k in st.valve) st.valve[k] = false;
    for (const { e } of path) if (e.k === 'valve') st.valve[e.v] = true;
    emit('Маршрут собран: прочая арматура закрыта.', 'ok');
  }
  /* Оценка выбранной операции по текущему состоянию */
  function evaluate(src, dst, pump, prod) {
    const ideal = findPath(src, dst, pump, prod, false);
    if (!ideal) return { lvl: 'err', text: 'Такая комбинация по схеме невозможна.', ideal: null };
    const need = ideal.filter(x => x.e.k === 'valve').map(x => x.e.v);
    const real = findPath(src, dst, pump, prod, true);
    const res = { ideal, need, real, warn: [] };
    if (!real) {
      const closed = need.filter(v => !st.valve[v]);
      res.lvl = 'err'; res.closed = closed;
      res.text = 'Маршрут не собран. Закрыто: ' + closed.join(', ') + '.';
      return res;
    }
    const pe = ideal.find(x => x.e.k === 'pump').e;
    const dis = reach(pe.b, 1).filter(t => t !== dst), suc = reach(pe.a, -1).filter(t => t !== src);
    if (dis.length) res.warn.push('Нагнетание открыто также в: ' + dis.map(t => N[t].n.split(' (')[0]).join(', ') + ' — продукт пойдёт в несколько приёмников.');
    if (suc.length) res.warn.push('Всасывание открыто также из: ' + suc.map(t => N[t].n.split(' (')[0]).join(', ') + '.');
    const prods = new Set([src, dst, ...dis, ...suc].map(prodOf).filter(p => p !== 'LZB' && p !== 'D'));
    if (prods.size > 1) res.warn.push('Внимание: смешение продуктов (' + [...prods].map(p => PROD[p].n).join(' / ') + ').');
    const others = Object.keys(st.pump).filter(k => st.pump[k] && k !== pump);
    if (others.length) res.warn.push('Работают и другие насосы: ' + others.join(', ') + '.');
    if (st.pump[pump]) { res.lvl = res.warn.length ? 'warn' : 'run'; res.text = `Идёт перекачка (модель): ${N[src].n.split(' (')[0]} → ${N[dst].n.split(' (')[0]}, насос ${pump}. Движение продукта будет показано на этапе 2.`; }
    else { res.lvl = res.warn.length ? 'warn' : 'ok'; res.text = `Маршрут собран. Насос ${pump} остановлен — можно запускать.`; }
    return res;
  }
  return { N, E, V, PU, st, adj, TERM, findPath, reach, pumpLinks, canStart, setValve, setPump, closeAll, assemble, evaluate, prodOf, isSrc, isSink, emit,
    on: f => listeners.push(f), onStart: f => startHooks.push(f) };
})();

