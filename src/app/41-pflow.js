/* =====================================================================================
   v0.18 — ИТЕРАЦИЯ 6: ПОТОК ГСМ И МАРШРУТЫ М1–М9 ПО ФИЗИЧЕСКИМ ТРУБАМ (модуль PFLOW)
   Технологический граф (АК-004/006) задаёт логику: какие задвижки открыты, какой насос работает, куда идёт продукт.
   Модуль PFLOW сопоставляет каждое ребро графа с цепочкой физических труб модели сети PNET
   (трассы ГП-005, обвязка цеха 200 по АК-041, эстакада 177 по АК-045, обвязка РВС):
   кратчайший путь по трубам того же продукта в коридоре ±1,5 м от оси ребра, с учётом врезок и подъёмов;
   отклонение от оси ребра штрафуется, поэтому соседняя параллельная линия не подменяет свою.
   Ось потока — фактическая осевая линия трубы (с подъёмами над пересечениями, v0.15), повороты — дугой ≈ 1,5 Dн, как у отводов.
   Где физической трубы нет (патрубки внутри ёмкостей, подводы ТРК и АСН, обвязка без трассы в документах) —
   связь показывается как УСЛОВНАЯ (пунктир) и отдельно учитывается в паспорте маршрута.
   Внутренний диаметр — Dн − 2s; s — по подписи на листе или легенде ГП-005 (⌀57×3,0; 89×3,5; 108×4,0; 159×4,5; 219×6,0;
   273×7), для прочих Ø — условно по ряду ГОСТ 10704. Скорость v = Q / (π·Dвн²/4), Q — номинальная подача насоса (АК-004).
   Ориентиры скорости (справочно, не блокировки): всас ≤ 1,5 м/с, нагнетание ≤ 2,5 м/с при ν = 1…11,4 мм²/с
   («Технологические трубопроводы нефтебаз», табл. 7.1); ≤ 5 м/с — ВНТП 5-95 табл. 8 (для ДТ и бензина с ρv > 10⁹ Ом·м
   и tвсп < 61 °С допустимая скорость определяется расчётом); начальный налив ВЦ — ≤ 1 м/с до затопления конца трубы
   на 0,4–0,5 м (ВНТП 5-95 п. 5.1.6); налив под уровень, равномерной струёй (Приказ МИР РК № 342, п. 15, 508).
   ===================================================================================== */
window.__PFLOW = null;
const PFLOW = (() => {
  const P = PNET, L = procLogic, V3 = THREE.Vector3;
  if (!P || !P.segs || !P.arcOf) return null;
  const fmt = (v, d = 2) => (+v).toFixed(d).replace('.', ',');
  const VN = { suc: 1.5, dis: 2.5, max: 5.0, fill0: 1.0 };
  const PCOL = { L: 0xc79a2a, Z: 0xd9c46a, B: 0xe4dca8, LZ: 0xcfae4a, LZB: 0xc9a84a };
  const ST = { V: 'по листу', P: 'условно', R: 'требует уточнения' };

  /* ---------- 1. размеры труб: Dн, s, Dвн ---------- */
  const WT = { 57: 3.0, 76: 3.5, 89: 3.5, 108: 4.0, 114: 4.0, 133: 4.0, 159: 4.5, 168: 5.0, 219: 6.0, 273: 7.0 };
  const LEG = new Set([57, 89, 108, 159, 219, 273]), STD = Object.keys(WT).map(Number);
  const parseDN = s => { if (!s) return null; let m = String(s).match(/[⌀Ø](\d+)\s*[×x]\s*([\d,.]+)/); if (m) return { od: +m[1], wt: parseFloat(m[2].replace(',', '.')) }; m = String(s).match(/(?:DN|Ду)\s*(\d+)/); return m ? { dn: +m[1] } : null; };
  const dimC = new Map();
  function dims(p) {
    let o = dimC.get(p); if (o) return o;
    let od = p.od ? Math.round(p.od * 1000) : null, wt = null, st = 'P', basis = '';
    const nm = parseDN(p.name);
    if (nm && nm.od && (!od || Math.abs(nm.od - od) < 4)) { od = nm.od; wt = nm.wt; st = 'V'; basis = 'Ø×s по подписи участка'; }
    if (!od) { od = Math.round(p.r * 2000); st = 'R'; basis = 'Ø на листе не указан — принят по легенде сети'; }
    const near = STD.reduce((a, b) => Math.abs(b - od) < Math.abs(a - od) ? b : a);
    if (wt == null) {
      wt = WT[near];
      if (!basis) { basis = p.cf && p.cf.dn === 'V' ? 'Ø по листу' : 'Ø условно (обмер листа)'; if (p.cf && p.cf.dn === 'V' && LEG.has(near) && Math.abs(near - od) <= 2) st = 'V'; }
      basis += LEG.has(near) && Math.abs(near - od) <= 2 ? `; s = ${fmt(wt, 1)} мм по легенде ГП-005` : `; s = ${fmt(wt, 1)} мм условно (ГОСТ 10704)`;
    }
    const id = Math.max(0.02, (od - 2 * wt) / 1000);
    o = { od, wt, id, A: Math.PI * id * id / 4, st, basis, rOut: p.r, txt: `⌀${od}×${fmt(wt, 1)}` };
    dimC.set(p, o); return o;
  }

  /* ---------- 2. осевая линия участка: u — длина по оси (3D) от начала участка ---------- */
  const geoC = new Map();
  function G(p) {
    let g = geoC.get(p); if (g) return g;
    const Q = p.pts, U = [0];
    for (let i = 1; i < Q.length; i++) U.push(U[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1], Q[i][2] - Q[i - 1][2]));
    const A = p.arcs && p.arcs.length === Q.length ? p.arcs : p.cum;
    g = { Q, U, A, Lc: p.cum[p.cum.length - 1], Ut: U[U.length - 1] }; geoC.set(p, g); return g;
  }
  function uOfArc(p, a) {
    const g = G(p), A = g.A;
    if (a <= 1e-6) return 0; if (a >= g.Lc - 1e-6) return g.Ut;
    for (let j = 0; j < A.length - 1; j++) if (A[j] <= a && A[j + 1] > a) { const d = A[j + 1] - A[j]; return g.U[j] + (d > 1e-9 ? (a - A[j]) / d : 0) * (g.U[j + 1] - g.U[j]); }
    return g.Ut;
  }
  function ptAtU(p, u) {
    const g = G(p), U = g.U, Q = g.Q;
    if (u <= 0) return Q[0].slice(); if (u >= g.Ut) return Q[Q.length - 1].slice();
    let j = 0; while (j < U.length - 2 && U[j + 1] < u) j++;
    const d = U[j + 1] - U[j], k = d > 1e-9 ? (u - U[j]) / d : 0;
    return [Q[j][0] + (Q[j + 1][0] - Q[j][0]) * k, Q[j][1] + (Q[j + 1][1] - Q[j][1]) * k, Q[j][2] + (Q[j + 1][2] - Q[j][2]) * k];
  }
  function subPts(p, u0, u1) {
    const g = G(p), out = [ptAtU(p, u0)];
    if (u1 >= u0) { for (let j = 0; j < g.U.length; j++) if (g.U[j] > u0 + 1e-6 && g.U[j] < u1 - 1e-6) out.push(g.Q[j].slice()); }
    else { for (let j = g.U.length - 1; j >= 0; j--) if (g.U[j] < u0 - 1e-6 && g.U[j] > u1 + 1e-6) out.push(g.Q[j].slice()); }
    out.push(ptAtU(p, u1)); return out;
  }
  const uOf = (s, t) => uOfArc(s.pipe, P.arcOf(s, t));
  const posOf = v => v.split ? ptAtU(v.s.pipe, uOf(v.s, v.t)) : [v.x, v.y, v.z];

  /* ---------- 3. связи вне узлов графа PNET: врезки, подъёмы/опуски, перемычки через арматуру/оборудование ---------- */
  const isProc = s => !!(s && s.on && s.fam === 'proc' && s.pipe);
  const near = (x, z, r) => { const o = []; for (const s of P.nearSegs(x, z, r)) if (isProc(s)) o.push(s); return o; };
  const tapsBy = new Map(), linkOf = new Map();
  const addLink = (a, b, w, kind) => { for (const [u, v] of [[a, b], [b, a]]) { let l = linkOf.get(u); if (!l) linkOf.set(u, l = []); l.push({ to: v, w, kind }); } };
  const ST3 = { tap: 0, rise: 0, jump: 0 };
  const outD = n => { const { s, e } = n.ends[0], A = e === 0 ? s.b : s.a, B = e === 0 ? s.a : s.b, d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...d) || 1; return d.map(x => x / l); };
  {
    const dead = [];
    for (const n of P.nodes) {
      if (n.fam !== 'proc' || n.ends.length !== 1 || !isProc(n.ends[0].s)) continue;
      let c = null; try { c = P.classifyEnd(n); } catch (e) { c = null; }
      if (c && c.kind === 'врезка' && isProc(c.ref)) { const t = P.segPt(c.ref, n.x, n.z)[1]; let l = tapsBy.get(c.ref); if (!l) tapsBy.set(c.ref, l = []); l.push({ t, n }); ST3.tap++; continue; }
      if (c && c.kind === 'подъём/опуск' && isProc(c.ref)) {
        const r = c.ref, da = r.na.ends.length === 1 ? Math.hypot(r.a[0] - n.x, r.a[2] - n.z) : 9, db = r.nb.ends.length === 1 ? Math.hypot(r.b[0] - n.x, r.b[2] - n.z) : 9;
        if (Math.min(da, db) <= 0.45) { const m = da <= db ? r.na : r.nb; addLink(n, m, Math.hypot(m.x - n.x, m.y - n.y, m.z - n.z) + 0.05, 'rise'); }
        else { const t = P.segPt(r, n.x, n.z)[1]; let l = tapsBy.get(r); if (!l) tapsBy.set(r, l = []); l.push({ t, n }); }
        ST3.rise++; continue;
      }
      dead.push(n);
    }
    // концы, обращённые друг к другу (корпус задвижки, фильтра, счётчика между фланцами): перемычка
    for (let i = 0; i < dead.length; i++) for (let j = i + 1; j < dead.length; j++) {
      const a = dead[i], b = dead[j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
      if (d < 0.02 || d > 1.2 || !P.compat(a.ends[0].s.prod, b.ends[0].s.prod)) continue;
      const oa = outD(a), ob = outD(b);
      if ((oa[0] * dx + oa[1] * dy + oa[2] * dz) / d < 0.8 || -(ob[0] * dx + ob[1] * dy + ob[2] * dz) / d < 0.8) continue;
      addLink(a, b, 1.5 * d + 0.3, 'jump'); ST3.jump++;
    }
  }

  /* ---------- 4. геометрия в плане ---------- */
  const dPtSeg = (x, z, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez, t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0; return Math.hypot(x - ax - ex * t, z - az - ez * t); };
  const dPoly = (x, z, pl) => { let m = Infinity; for (let i = 0; i < pl.length - 1; i++) m = Math.min(m, dPtSeg(x, z, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return pl.length === 1 ? Math.hypot(x - pl[0][0], z - pl[0][1]) : m; };
  function dSegPoly(s, pl) {
    let m = Infinity; const ax = s.a[0], az = s.a[2], bx = s.b[0], bz = s.b[2];
    for (let i = 0; i < pl.length - 1; i++) {
      const cx = pl[i][0], cz = pl[i][1], ex = pl[i + 1][0], ez = pl[i + 1][1];
      const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax), d2 = (bx - ax) * (ez - az) - (bz - az) * (ex - ax), d3 = (ex - cx) * (az - cz) - (ez - cz) * (ax - cx), d4 = (ex - cx) * (bz - cz) - (ez - cz) * (bx - cx);
      if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
      m = Math.min(m, dPtSeg(ax, az, cx, cz, ex, ez), dPtSeg(bx, bz, cx, cz, ex, ez), dPtSeg(cx, cz, ax, az, bx, bz), dPtSeg(ex, ez, ax, az, bx, bz));
    }
    return m;
  }

  /* ---------- 5. привязка узла графа к трубе ---------- */
  const W = 1.5, SNAP = 1.2, KDEV = 2.5, KMIX = 3;
  // продукт трубы и ребра: 1 — совместим; KMIX — оба нефтепродукты, но по ГП-005 у трубы другой (расхождение АК-041 ↔ ГП-005 у цеха 200); 0 — нельзя (дренаж, Гу)
  const FUEL = new Set(['L', 'Z', 'B', 'LZ', 'LZB']);
  const prodK = (sp, ep) => P.compat(sp, ep) ? 1 : FUEL.has(sp) && FUEL.has(ep) ? KMIX : 0;
  const snapC = new Map();
  // ближайшая точка элемента: в плане, а если у узла задана высота (устройства эстакады, стояки) — в пространстве
  function segPt3(s, x, y, z) {
    const ax = s.a[0], ay = s.a[1], az = s.a[2], ex = s.b[0] - ax, ey = s.b[1] - ay, ez = s.b[2] - az, l2 = ex * ex + ey * ey + ez * ez;
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) / l2)) : 0;
    return [Math.hypot(x - ax - ex * t, z - az - ez * t), t, Math.abs(y - ay - ey * t)];
  }
  function snapNode(k, yh) {
    const key = k + '|' + (yh == null ? '' : yh.toFixed(2));
    if (snapC.has(key)) return snapC.get(key);
    const N = L.N[k]; let r = null;
    if (N && N.t !== 'tank' && !N.noSnap) {   // v0.27: noSnap — условный узел графа без своей трубы (TJ у ТРК-1: продукты подходят к ТРК раздельно)
      const [x, z] = N.p, prod = N.prod || 'LZB';
      let best = null, bd = Infinity;
      for (const s of near(x, z, SNAP)) {
        const kk = prodK(s.prod, prod); if (!kk) continue;
        const [d, t, dy] = yh == null ? [...P.segPt(s, x, z).slice(0, 2), 0] : segPt3(s, x, yh, z), sc = Math.hypot(d, 0.5 * dy) + (kk > 1 ? 0.25 : 0) + 0.02 * Math.max(0, 0.219 - 2 * s.r) / 0.219;   // при равном расстоянии — больший Ø (дубли трасс)
        if (sc < bd) { bd = sc; best = { s, t, d, mix: kk > 1 }; }
      }
      if (best && best.d <= SNAP) r = best;
    }
    snapC.set(key, r); return r;
  }
  const yHint = (e, atB) => { const k = atB ? e.b : e.a, N = L.N[k], q = e.pts[atB ? e.pts.length - 1 : 0]; return N && N.y != null && N.t !== 'tank' ? (q.length > 2 ? q[2] : N.y) : (q.length > 2 && N && N.t !== 'tank' ? q[2] : null); };

  /* ---------- 6. ребро графа → цепочка труб (Дейкстра в коридоре) ---------- */
  function heapPush(h, it) { h.push(it); let i = h.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (h[j][0] <= h[i][0]) break; [h[i], h[j]] = [h[j], h[i]]; i = j; } }
  function heapPop(h) { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m; } } return top; }
  function dijkstra(adj, src) {
    const dist = new Map([[src, 0]]), prev = new Map(), h = [[0, src]];
    while (h.length) {
      const [d, u] = heapPop(h); if (d > dist.get(u)) continue;
      for (const ed of adj.get(u) || []) { const nd = d + ed.w; if (nd < (dist.has(ed.v) ? dist.get(ed.v) : Infinity)) { dist.set(ed.v, nd); prev.set(ed.v, [u, ed]); heapPush(h, [nd, ed.v]); } }
    }
    return { dist, prev };
  }
  const chainTo = (D, v) => { const out = []; while (D.prev.has(v)) { const [u, ed] = D.prev.get(v); out.push({ u, v, ed }); v = u; } return out.reverse(); };
  const EDGE = new Map();
  let nSplit = 0;
  function mapEdge(e) {
    const pl = e.pts.map(q => [q[0], q[1]]);
    // ось ребра доводится до фактических узлов (узлы эстакады перенесены по АК-045 — этап 6.3)
    for (const [k, atB] of [[e.a, false], [e.b, true]]) { const N = L.N[k]; if (!N) continue; const q = atB ? pl[pl.length - 1] : pl[0]; if (Math.hypot(N.p[0] - q[0], N.p[1] - q[1]) > 0.05) { if (atB) pl.push([N.p[0], N.p[1]]); else pl.unshift([N.p[0], N.p[1]]); } }
    let gl = 0; for (let i = 1; i < pl.length; i++) gl += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    const res = { e, kind: 'none', pieces: [], len: 0, gap: 0, glen: gl, maxDev: 0 };
    if (e.k === 'pump') { res.kind = 'pump'; return res; }
    const C = new Set(), tested = new Set();
    for (let i = 0; i < pl.length - 1 || i === 0; i++) {
      const a = pl[i], b = pl[Math.min(i + 1, pl.length - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(l / 1.0));
      for (let j = 0; j <= n; j++) { const x = a[0] + (b[0] - a[0]) * j / n, z = a[1] + (b[1] - a[1]) * j / n; for (const s of near(x, z, W + 0.5)) { if (tested.has(s)) continue; tested.add(s); if (prodK(s.prod, e.prod) && dSegPoly(s, pl) <= W) C.add(s); } }
      if (pl.length < 2) break;
    }
    const sa = snapNode(e.a, yHint(e, false)), sb = snapNode(e.b, yHint(e, true));
    for (const sn of [sa, sb]) if (sn) C.add(sn.s);
    // труба с другим продуктом по ГП-005 допускается только та, к которой привязан узел графа (выходы цеха 200)
    const mixOK = new Set([sa, sb].filter(q => q && q.mix).map(q => q.s.pipe));
    for (const k of [e.a, e.b]) { const N = L.N[k]; if (N && N.t !== 'tank' && !N.noSnap) for (const s of near(N.p[0], N.p[1], 0.3)) if (prodK(s.prod, e.prod) && Math.min(Math.hypot(s.a[0] - N.p[0], s.a[2] - N.p[1]), Math.hypot(s.b[0] - N.p[0], s.b[2] - N.p[1])) <= 0.12) { mixOK.add(s.pipe); C.add(s); } }
    for (const s of [...C]) if (!P.compat(s.prod, e.prod) && !mixOK.has(s.pipe) && !(sa && sa.s === s) && !(sb && sb.s === s)) C.delete(s);
    // касания: узел одной трубы лежит на другой трубе того же продукта (дубли, тройники без узла) — местная врезка
    const lTaps = new Map(), Cn = new Set(); for (const s of C) { Cn.add(s.na); Cn.add(s.nb); }
    for (const n of Cn) for (const t of C) {
      if (t.na === n || t.nb === n || !n.ends.length || !P.compat(n.ends[0].s.prod, t.prod)) continue;
      const [d, tt] = P.segPt(t, n.x, n.z); if (d > 0.04 || tt < 1e-3 || tt > 1 - 1e-3 || Math.abs(P.yOn(t, tt) - n.y) > 0.15) continue;
      let l = lTaps.get(t); if (!l) lTaps.set(t, l = []); l.push({ t: tt, n });
    }
    // вершины: узлы PNET и точки на элементах (привязки, врезки)
    const adj = new Map(), addE = (u, v, w, ed) => { for (const [x, y] of [[u, v], [v, u]]) { let l = adj.get(x); if (!l) adj.set(x, l = []); l.push({ v: y, w, ...ed, rev: x === v }); } };
    let vA = null, vB = null;
    for (const s of C) {
      const it = [{ t: 0, v: s.na }, { t: 1, v: s.nb }];
      for (const tp of tapsBy.get(s) || []) it.push({ t: tp.t, tap: tp.n });
      for (const tp of lTaps.get(s) || []) it.push({ t: tp.t, tap: tp.n });
      if (sa && sa.s === s) it.push({ t: sa.t, A: 1 });
      if (sb && sb.s === s) it.push({ t: sb.t, B: 1 });
      it.sort((a, b) => a.t - b.t);
      let last = null;
      for (const q of it) {
        if (!q.v) q.v = q.t < 1e-4 ? s.na : q.t > 1 - 1e-4 ? s.nb : (last && Math.abs(last.t - q.t) < 1e-5 ? last.v : { split: 1, s, t: q.t, id: 'x' + (++nSplit) });
        if (q.A) vA = q.v; if (q.B) vB = q.v;
        if (q.tap) addE(q.v, q.tap, 0.02, { kind: 'tap' });
        last = q;
      }
      for (let i = 0; i < it.length - 1; i++) {
        const a = it[i], b = it[i + 1]; if (a.v === b.v) continue;
        const tm = (a.t + b.t) / 2, mx = s.a[0] + (s.b[0] - s.a[0]) * tm, mz = s.a[2] + (s.b[2] - s.a[2]) * tm, dev = dPoly(mx, mz, pl);
        addE(a.v, b.v, s.len * (b.t - a.t) * (1 + KDEV * dev) * prodK(s.prod, e.prod) * (1 + 0.04 * Math.max(0, 0.219 - 2 * s.r) / 0.219) + 1e-4, { kind: 'seg', s, t0: a.t, t1: b.t });
      }
    }
    for (const v of [...adj.keys()]) if (v.ends) for (const lk of linkOf.get(v) || []) if (adj.has(lk.to) && !(adj.get(v) || []).some(x => x.v === lk.to)) addE(v, lk.to, lk.w, { kind: lk.kind });
    // путь
    const PC = new Map(), pos = v => { let q = PC.get(v); if (!q) PC.set(v, q = posOf(v)); return q; };
    const Apos = pl[0], Bpos = pl[pl.length - 1];
    const dXZ = (v, q) => { const p = pos(v); return Math.hypot(p[0] - q[0], p[2] - q[1]); };
    let steps = null, gapAt = null;
    if (vA && vB && vA === vB) { res.kind = 'phys'; res.zero = 1; return res; }   // арматура на трубе: оба узла в одной точке
    if (vA && vB) {
      const DA = dijkstra(adj, vA);
      if (DA.dist.has(vB)) steps = chainTo(DA, vB);
      else {   // разрыв в середине: ближайшая пара достижимых вершин со стороны A и B
        const DB = dijkstra(adj, vB); let best = null, bd = Infinity;
        for (const [x] of DA.dist) for (const [y] of DB.dist) { const px = pos(x), py = pos(y), d = Math.hypot(px[0] - py[0], px[1] - py[1], px[2] - py[2]) + 0.05 * (DA.dist.get(x) + DB.dist.get(y)); if (d < bd) { bd = d; best = [x, y]; } }
        steps = chainTo(DA, best[0]); gapAt = steps.length; const back = chainTo(DB, best[1]).reverse().map(st => ({ u: st.v, v: st.u, ed: { ...st.ed, rev: !st.ed.rev } }));
        steps.push({ u: best[0], v: best[1], ed: { kind: 'gap' } }); steps.push(...back);
      }
    } else if (vA || vB) {   // один конец без трубы (ёмкость, условная связь): до ближайшей к нему достижимой вершины
      const from = vA || vB, D = dijkstra(adj, from), tgt = vA ? Bpos : Apos;
      let best = from, bd = dXZ(from, tgt);
      for (const [x] of D.dist) { const d = dXZ(x, tgt); if (d < bd - 1e-6) { bd = d; best = x; } }
      steps = chainTo(D, best);
      if (!vA) steps = steps.reverse().map(st => ({ u: st.v, v: st.u, ed: { ...st.ed, rev: !st.ed.rev } }));
      const endN = vA ? L.N[e.b] : L.N[e.a];
      res.open = vA ? 'b' : 'a'; res.openTank = !!(endN && endN.t === 'tank'); res.openGap = bd;
    }
    if (!steps) return res;
    // геометрия
    for (const st of steps) {
      const ed = st.ed;
      if (ed.kind === 'seg') {
        const [t0, t1] = ed.rev ? [ed.t1, ed.t0] : [ed.t0, ed.t1], s = ed.s;
        const pts = subPts(s.pipe, uOf(s, t0), uOf(s, t1));
        const lp = res.pieces[res.pieces.length - 1];
        if (lp && lp.p === s.pipe && lp.kind === 'pipe') { for (let i = 1; i < pts.length; i++) lp.pts.push(pts[i]); }
        else res.pieces.push({ kind: 'pipe', p: s.pipe, pts, mix: !P.compat(s.prod, e.prod) });
      } else res.pieces.push({ kind: ed.kind, p: null, pts: [pos(st.u), pos(st.v)] });
    }
    const len3 = q => { let l = 0; for (let i = 1; i < q.length; i++) l += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]); return l; };
    for (const pc of res.pieces) { pc.len = len3(pc.pts); if (pc.kind === 'gap') res.gap += pc.len; else res.len += pc.len; for (const q of pc.pts) res.maxDev = Math.max(res.maxDev, dPoly(q[0], q[2], pl)); }
    if (res.open) {   // конец без трубы: до ёмкости/устройства — условная связь пунктиром (у РВС — только если труба не доходит до стенки)
      const endK = res.open === 'b' ? e.b : e.a, N = L.N[endK], qe = e.pts[res.open === 'b' ? e.pts.length - 1 : 0];
      const from = res.pieces.length ? (res.open === 'b' ? res.pieces[res.pieces.length - 1].pts.slice(-1)[0] : res.pieces[0].pts[0]) : pos(vA || vB);
      let to = [qe[0], qe.length > 2 ? qe[2] : from[1], qe[1]], need = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) > 0.3;
      if (N && N.t === 'tank' && (N.D || 0) > 5) {   // РВС: точка на стенке по направлению на центр
        const dx = from[0] - N.p[0], dz = from[2] - N.p[1], dd = Math.hypot(dx, dz) || 1, R = N.D / 2;
        need = dd > R + 1.0; to = [N.p[0] + dx / dd * R, from[1], N.p[1] + dz / dd * R];
      } else if (N && N.t === 'tank' && !(N.D > 0) && Math.hypot(from[0] - N.p[0], from[2] - N.p[1]) <= 6) need = false;   // дренажные ёмкости ДЕ: труба подходит к ёмкости
      if (need) { const g = { kind: 'gap', p: null, pts: res.open === 'b' ? [from, to] : [to, from] }; g.len = len3(g.pts); res.gap += g.len; if (res.open === 'b') res.pieces.push(g); else res.pieces.unshift(g); }
      res.openNeed = need;
    }
    const hasPipe = res.pieces.some(q => q.kind === 'pipe');
    res.mix = res.pieces.some(q => q.mix);
    res.kind = res.open && res.openTank && !res.openNeed ? 'noz' : !hasPipe ? (res.open || (vA && vB) ? 'cond' : 'none') : res.gap > 0.05 ? 'part' : 'phys';
    return res;
  }
  function edgeInfo(e) {
    let r = EDGE.get(e.id);
    if (!r) {
      try { r = mapEdge(e); } catch (err) { console.error('PFLOW: ребро', e.id, err); r = { e, kind: 'none', pieces: [], len: 0, gap: 0, glen: 0, maxDev: 0, err: String(err) }; }
      if (r.kind === 'none' && e.k !== 'pump') {   // ни один узел не привязан к трубе — условная связь по оси графа (пунктир)
        r.kind = 'cond';
        const p3 = L.pts3(e).map(v => v.toArray()); if (p3.length > 1) { const g = { kind: 'gap', p: null, pts: p3 }; let l = 0; for (let i = 1; i < p3.length; i++) l += Math.hypot(p3[i][0] - p3[i - 1][0], p3[i][1] - p3[i - 1][1], p3[i][2] - p3[i - 1][2]); g.len = l; r.pieces = [g]; r.gap = l; }
      }
      EDGE.set(e.id, r);
    }
    return r;
  }
  let built = false, buildMs = 0;
  const STAT = { phys: 0, part: 0, noz: 0, cond: 0, mix: 0 };
  function ensure() {
    if (built) return true;
    const t0 = performance.now();
    for (const e of L.E) { if (e.k === 'pump') continue; const r = edgeInfo(e); if (e.k !== 'valve') { STAT[r.kind] = (STAT[r.kind] || 0) + 1; if (r.mix) STAT.mix++; } }
    built = true; buildMs = performance.now() - t0; return true;
  }
  const edgePts = e => { const r = edgeInfo(e), o = []; for (const pc of r.pieces) for (const q of pc.pts) o.push(new V3(q[0], q[1], q[2])); return o.length ? o : L.pts3(e); };

  /* ---------- 7. маршрут: участки по потоку, длины, объём, скорости ---------- */
  const pumpQ = id => { const q = L.PU[id] && L.PU[id].Q; return typeof q === 'number' ? q : id === 'ТРК-1' ? 3.0 : 0; };
  function orient(e, d) {   // куски ребра по направлению потока
    const r = edgeInfo(e); if (d !== -1) return r.pieces;
    return r.pieces.slice().reverse().map(pc => ({ ...pc, pts: pc.pts.slice().reverse() }));
  }
  function routeInfo(path, Q) {
    const rows = []; let side = 's', len = 0, gap = 0, vol = 0, tt = 0, vmax = null;
    if (!path) return null;
    for (const { e, d } of path) {
      if (e.k === 'pump') { side = 'd'; continue; }
      for (const pc of orient(e, d)) {
        if (pc.len < 1e-4) continue;
        if (pc.kind === 'gap') { gap += pc.len; rows.push({ kind: 'gap', e, len: pc.len, side }); continue; }
        const p = pc.p || null, D = p ? dims(p) : null;
        const last = rows[rows.length - 1];
        if (p && last && last.p === p) { last.len += pc.len; continue; }
        if (!p || (pc.len < 0.2 && last && last.kind === 'pipe')) { if (last && last.kind === 'pipe') last.len += pc.len; else len += pc.len; continue; }   // врезка/перемычка, короткий заход на пересекаемую трубу — к соседнему участку
        rows.push({ kind: 'pipe', p, D, e, len: pc.len, side, mix: !!pc.mix });
      }
    }
    for (const r of rows) {
      if (r.kind !== 'pipe') continue;
      len += r.len; r.vol = r.D.A * r.len; vol += r.vol;
      r.v = Q > 0 ? Q / 3600 / r.D.A : null;
      if (r.v) { tt += r.len / r.v; if (!vmax || r.v > vmax.v) vmax = r; }
      r.lim = r.side === 's' ? VN.suc : VN.dis; r.over = r.v && r.v > r.lim; r.overMax = r.v && r.v > VN.max;
    }
    return { rows, len, gap, vol, tt, vmax, Q };
  }
  const mmss = t => { t = Math.round(t); const m = Math.floor(t / 60), s = t % 60; return m ? `${m} мин ${String(s).padStart(2, '0')} с` : `${s} с`; };
  const SIDE = { s: 'всас', d: 'нагнетание' };
  function statText() { ensure(); return `Рёбра сопоставлены с цепочками физических труб (модуль PFLOW): полностью — ${STAT.phys}, до патрубка ёмкости — ${STAT.noz}, с условным участком — ${STAT.part}, целиком условно — ${STAT.cond}; по трубе, продукт которой по листу другой (у цеха 200) — ${STAT.mix}.`; }

  /* ---------- 8. паспорт трассы маршрута (панель «Технология») ---------- */
  const UI = { open: false };
  function renderPass(el, path, pump) {
    if (!el) return;
    if (!path) { el.innerHTML = ''; return; }
    ensure();
    const Q = pumpQ(pump), R = routeInfo(path, Q); if (!R) { el.innerHTML = ''; return; }
    const pipes = [...new Set(R.rows.filter(r => r.p).map(r => r.p))];
    const warn = R.rows.filter(r => r.over);
    let h = `<details class="pfp"${UI.open ? ' open' : ''}><summary><b>Трасса по трубам</b>: ${fmt(R.len, 1)} м` + (R.gap > 0.05 ? ` + условно ${fmt(R.gap, 1)} м` : '') +
      ` · заполнение ${fmt(R.vol, 2)} м³` + (Q ? ` · проход ${mmss(R.tt)}` : '') + (R.vmax ? ` · v<sub>max</sub> ${fmt(R.vmax.v, 2)} м/с` : '') + (warn.length ? ' <span class="pfw">⚠</span>' : '') + `</summary>` +
      `<div class="rn" style="margin:4px 0">Участки физической модели сети по потоку. Q = ${fmt(Q, Q < 10 ? 1 : 0)} м³/ч (номинальная подача ${pump}, АК-004); Dвн = Dн − 2s; v = Q / (π·Dвн²/4). Ориентиры: всас ≤ ${fmt(VN.suc, 1)} м/с, нагнетание ≤ ${fmt(VN.dis, 1)} м/с (справочно, ν = 1…11,4 мм²/с).</div>` +
      `<table class="pft"><tr><th>Участок</th><th>Ø×s, мм</th><th class="r">L, м</th><th class="r">V, м³</th><th class="r">v, м/с</th><th></th></tr>`;
    let lastSide = null;
    for (const r of R.rows) {
      if (r.side !== lastSide) { h += `<tr class="sd"><td colspan="6">${SIDE[r.side]}</td></tr>`; lastSide = r.side; }
      if (r.kind === 'gap') { h += `<tr class="cg"><td colspan="2">условная связь «${(r.e.n || r.e.id).slice(0, 38)}» — трассы в документах нет</td><td class="r">${fmt(r.len, 1)}</td><td></td><td></td><td></td></tr>`; continue; }
      const pp = (r.p.segs[0] || {}).prod, mixT = r.mix ? ` <span class="pfw" title="По листу (${r.p.src}) труба — ${(PROD[pp] || {}).n || pp}; по графу ТП (АК-041/004) — ${(PROD[r.e.prod] || {}).n || r.e.prod}. Расхождение листов, требует ТХ насосной.">⚠ продукт</span>` : '';
      h += `<tr><td title="${r.D.basis}">${r.p.id}<i class="st ${r.D.st}">${r.D.st === 'V' ? '' : r.D.st === 'P' ? 'усл.' : 'уточн.'}</i>${mixT}</td><td>${r.D.txt}</td><td class="r">${fmt(r.len, 1)}</td><td class="r">${fmt(r.vol, 3)}</td>` +
        `<td class="r${r.over ? ' ov' : ''}">${r.v ? fmt(r.v, 2) : '—'}</td><td><span class="lk" data-pp="${r.p.id}">показать</span></td></tr>`;
    }
    h += `</table>`;
    if (R.rows.some(r => r.mix)) h += `<div class="rn pfw">⚠ «продукт»: у цеха 200 продукт трубы по листу (ГП-005 на выходах, АК-041 в обвязке) не совпадает с продуктом линии по графу ТП — известное расхождение, вопрос к ТХ насосной. Поток показан по трубе, которая физически соединяет узлы; логика маршрута — по графу ТП.</div>`;
    if (warn.length) h += `<div class="rn pfw">⚠ Скорость выше справочного ориентира: ${[...new Set(warn.map(r => `${r.p.id} (${SIDE[r.side]}, ${fmt(r.v, 2)} м/с)`))].slice(0, 6).join('; ')}. Это не блокировка — проверка выбора Ø по гидравлическому расчёту (раздел ТХ в комплекте отсутствует).</div>`;
    const lastE = path[path.length - 1], dk = lastE ? (lastE.d === -1 ? lastE.e.a : lastE.e.b) : null;
    if (dk === 'UNZH' || dk === 'ASN') {
      const dn = dk === 'UNZH' ? 0.1 : 0.08, v0 = Q / 3600 / (Math.PI * dn * dn / 4);
      h += `<div class="rn">Налив ${dk === 'UNZH' ? 'в ВЦ через УНЖ 6-100АС (Ду 100 по обозначению устройства)' : 'в автоцистерну через АСН-80 (Ду 80 по обозначению устройства)'}: при номинальной подаче скорость в наливной трубе ≈ ${fmt(v0, 1)} м/с. ВНТП 5-95 п. 5.1.6: начальное заполнение — не более 1 м/с до затопления конца трубы на 0,4–0,5 м; Приказ МИР РК № 342 п. 508 — налив под уровень, равномерной струёй. Ступенчатый режим налива (малый/большой расход) в документах не задан — в модели не реализован, требует уточнения.</div>`;
    }
    h += `<div class="pbar"><button class="pbtn" id="pfShow">Показать трубы маршрута (${pipes.length})</button><button class="pbtn" id="pfHide">Снять подсветку</button></div>` +
      `<div class="rn">Сопоставление графа ТП с трубами — модуль PFLOW: путь по трубам того же продукта в коридоре ±1,5 м от оси ребра. Условные связи (пунктир) — участки без трассы в документах: патрубки внутри ёмкостей, подводы ТРК и АСН и т. п.</div></details>`;
    el.innerHTML = h;
    const det = el.querySelector('details'); det.ontoggle = () => { UI.open = det.open; };
    el.querySelector('#pfShow').onclick = () => { P.highlight(pipes, `${pipes.length} участков маршрута`); };
    el.querySelector('#pfHide').onclick = () => P.clearHL();
    el.querySelectorAll('[data-pp]').forEach(a => a.onclick = () => { const p = P.pipes.find(q => q.id === a.dataset.pp); if (!p) return; P.highlight([p], p.id); const m = p.pts[Math.floor(p.pts.length / 2)]; flyTo([m[0] + 5, m[1] + 6, m[2] + 7], m); });
  }

  /* ---------- 9. сборка непрерывных линий потока, скругление поворотов, протяжка сечения ---------- */
  // ст.: { p:[x,y,z], a: атрибуты входа, b: атрибуты выхода } — атрибуты { r, v, k (0 — труба, 1 — условно, 2 — «рукав» поверх трубы), ro }
  function addStation(run, p, at) {
    const l = run[run.length - 1];
    if (l && Math.hypot(l.p[0] - p[0], l.p[1] - p[1], l.p[2] - p[2]) < 1e-4) { l.b = at; return; }
    run.push({ p: p.slice(), a: at, b: at });
  }
  function rounded(run) {   // точки пути: {p:V3, t:V3, at}
    const out = [], P3 = run.map(s => new V3(...s.p));
    if (P3.length < 2) return out;
    out.push({ p: P3[0].clone(), t: P3[1].clone().sub(P3[0]).normalize(), at: run[0].b });
    for (let i = 1; i < P3.length - 1; i++) {
      const d1 = P3[i].clone().sub(P3[i - 1]), d2 = P3[i + 1].clone().sub(P3[i]), l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
      const cs = Math.max(-1, Math.min(1, d1.dot(d2))), th = Math.acos(cs), st = run[i];
      if (th < 0.14 || l1 < 1e-4 || l2 < 1e-4) { const t = d1.clone().add(d2); if (t.lengthSq() < 1e-8) t.copy(d2); out.push({ p: P3[i].clone(), t: t.normalize(), at: st.a }); if (st.b !== st.a) out.push({ p: P3[i].clone(), t: t.clone(), at: st.b }); continue; }
      const ro = Math.max(st.a.ro, st.b.ro), Rb = Math.max(3 * ro, 0.12);
      const tl = Math.min(Rb * Math.tan(th / 2), 0.45 * l1, 0.45 * l2), R = tl / Math.tan(th / 2);
      const nr = d2.clone().addScaledVector(d1, -cs).normalize(), p1 = P3[i].clone().addScaledVector(d1, -tl), C = p1.clone().addScaledVector(nr, R);
      const n = Math.max(2, Math.ceil(th / (Math.PI / 14)));
      for (let k = 0; k <= n; k++) { const ph = th * k / n; out.push({ p: C.clone().addScaledVector(nr, -R * Math.cos(ph)).addScaledVector(d1, R * Math.sin(ph)), t: d1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(nr, Math.sin(ph)).normalize(), at: k * 2 < n ? st.a : st.b }); }
    }
    const n = P3.length; out.push({ p: P3[n - 1].clone(), t: P3[n - 1].clone().sub(P3[n - 2]).normalize(), at: run[n - 1].a });
    return out;
  }
  // протяжка: rFn(at) → радиус; attr — заполнять ли атрибуты шейдера потока
  function sweepInto(B, path, rFn, col, withAttr) {
    if (path.length < 2) return;
    const N = rFn(path[0].at) > 0.07 ? 16 : 12;
    let nv = new V3(0, 1, 0); if (Math.abs(nv.dot(path[0].t)) > 0.9) nv.set(1, 0, 0); nv.addScaledVector(path[0].t, -nv.dot(path[0].t)).normalize();
    const q = new THREE.Quaternion(); let prevT = path[0].t, s = 0, tau = 0, prev = null;
    const base0 = B.pos.length / 3;
    for (let k = 0; k < path.length; k++) {
      const P_ = path[k];
      q.setFromUnitVectors(prevT, P_.t); nv.applyQuaternion(q); nv.addScaledVector(P_.t, -nv.dot(P_.t)).normalize(); prevT = P_.t;
      const bv = new V3().crossVectors(P_.t, nv);
      if (prev) { const ds = P_.p.distanceTo(prev.p); s += ds; tau += ds / Math.max(0.05, prev.at.v || 0.5); }
      const r = rFn(P_.at);
      for (let a = 0; a <= N; a++) {
        const an = a / N * Math.PI * 2, cx = Math.cos(an), sx = Math.sin(an), dx = nv.x * cx + bv.x * sx, dy = nv.y * cx + bv.y * sx, dz = nv.z * cx + bv.z * sx;
        B.pos.push(P_.p.x + dx * r, P_.p.y + dy * r, P_.p.z + dz * r); B.nor.push(dx, dy, dz);
        if (withAttr) { B.aT.push(tau); B.aS.push(s); B.aU.push(a / N); B.aC.push(col.r, col.g, col.b); B.aK.push(P_.at.k); }
      }
      if (k > 0) { const i0 = base0 + (k - 1) * (N + 1), i1 = base0 + k * (N + 1); for (let a = 0; a < N; a++) B.idx.push(i0 + a, i1 + a + 1, i1 + a, i0 + a, i0 + a + 1, i1 + a + 1); }
      prev = P_;
    }
  }
  const newBuf = () => ({ pos: [], nor: [], idx: [], aT: [], aS: [], aU: [], aC: [], aK: [] });
  function bufGeo(B, withAttr) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
    if (withAttr) { g.setAttribute('aT', new THREE.Float32BufferAttribute(B.aT, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(B.aS, 1)); g.setAttribute('aU', new THREE.Float32BufferAttribute(B.aU, 1)); g.setAttribute('aC', new THREE.Float32BufferAttribute(B.aC, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(B.aK, 1)); }
    g.setIndex(B.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
    g.computeBoundingSphere(); return g;
  }
  // труба отрисована построителем PGEO (её можно «разрезать»)? иначе продукт показывается полупрозрачным рукавом поверх трубы
  const cuttable = p => { const R = p && P.rendOf ? P.rendOf(p) : null; return !!(R && !R.heat && !R.under); };
  // линии потока по ориентированным рёбрам: склейка в узлах с одним входом и одним выходом
  function runsOf(list, attrOf) {   // list: [{e, d, q}]
    const segs = list.map(x => ({ ...x, from: x.d === -1 ? x.e.b : x.e.a, to: x.d === -1 ? x.e.a : x.e.b }));
    const inC = new Map(), outC = new Map(); for (const s of segs) { inC.set(s.to, (inC.get(s.to) || 0) + 1); outC.set(s.from, (outC.get(s.from) || 0) + 1); }
    const byFrom = new Map(); for (const s of segs) { if (!byFrom.has(s.from)) byFrom.set(s.from, []); byFrom.get(s.from).push(s); }
    const used = new Set(), runs = [];
    const head = s => !(inC.get(s.from) === 1 && outC.get(s.from) === 1 && segs.some(t => t.to === s.from && t.e.k !== 'pump'));
    const walk = s0 => {
      const run = []; let s = s0;
      while (s && !used.has(s)) {
        used.add(s);
        for (const pc of orient(s.e, s.d)) { const at = attrOf(s, pc); if (!at) continue; for (const q of pc.pts) addStation(run, q, at); }
        const nx = byFrom.get(s.to); s = inC.get(s.to) === 1 && nx && nx.length === 1 && nx[0].e.k !== 'pump' ? nx[0] : null;
      }
      return run;
    };
    for (const s of segs) if (s.e.k !== 'pump' && head(s) && !used.has(s)) runs.push(walk(s));
    for (const s of segs) if (s.e.k !== 'pump' && !used.has(s)) runs.push(walk(s));
    // разделение линии там, где меняется вид (труба / рукав / условно) — у каждого свой материал
    return runs;
  }

  /* ---------- 10. материал потока: движущийся продукт, шевроны по направлению, пунктир у условных связей ---------- */
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 1 }, uChev: { value: 1 }, uK: { value: 1 }, uSpec: { value: 0 }, uSunD: { value: new THREE.Vector3(0, 1, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) } },   // v0.37: шевроны, яркость, блик — для кинорежима (по умолчанию — как было)
    vertexShader: `attribute float aT; attribute float aS; attribute float aU; attribute vec3 aC; attribute float aK;
      varying float vT; varying float vS; varying float vU; varying vec3 vC; varying float vK; varying vec3 vN; varying vec3 vP;
      void main(){ vT = aT; vS = aS; vU = aU; vC = aC; vK = aK; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uT; uniform float uA; uniform float uChev; uniform float uK; uniform float uSpec; uniform vec3 uSunD; uniform vec3 uTint; varying float vT; varying float vS; varying float vU; varying vec3 vC; varying float vK; varying vec3 vN; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        if (vK > 0.5 && vK < 1.5 && fract(vS * 2.2) > 0.55) discard;            // условная связь — пунктир
        float ph = vT - uT;                                                      // фаза по времени движения: рисунок идёт с местной скоростью
        float w = abs(fract(vU + 0.5) - 0.5);                                     // 0 — верх сечения
        float chev = smoothstep(0.80, 0.86, fract(ph * 1.3 + w * 2.2)) * (1.0 - smoothstep(0.93, 0.99, fract(ph * 1.3 + w * 2.2)));
        float n = noise(vec2(ph * 3.0, vU * 12.0)) * 0.6 + noise(vec2(ph * 9.0, vU * 30.0)) * 0.4;
        vec3 V = normalize(cameraPosition - vP); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        vec3 col = vC * (0.95 + 0.55 * smoothstep(0.35, 0.85, n)) + vec3(1.0, 0.96, 0.8) * chev * 0.85 * uChev + vec3(1.0) * fr * 0.22;   // продукт светлее стенки трубы — виден в разрезе
        if (vK > 0.5 && vK < 1.5) col = mix(col, vec3(0.62, 0.66, 0.7), 0.45);
        col *= uK * uTint; if (uSpec > 0.0) col += vec3(1.0, 0.93, 0.8) * pow(max(dot(reflect(-normalize(uSunD), normalize(vN)), V), 0.0), 48.0) * uSpec;
        gl_FragColor = vec4(col, vK > 1.5 ? uA : vK > 0.5 ? 0.72 : 1.0);
        #include <colorspace_fragment>
      }`
  });
  const shellMat = flowMat.clone(); shellMat.uniforms = { uT: flowMat.uniforms.uT, uA: { value: 0.55 }, uChev: flowMat.uniforms.uChev, uK: flowMat.uniforms.uK, uSpec: flowMat.uniforms.uSpec, uSunD: flowMat.uniforms.uSunD, uTint: flowMat.uniforms.uTint }; shellMat.transparent = true; shellMat.depthWrite = false;
  const coneGeo = new THREE.ConeGeometry(1, 2.6, 10), coneMat = new THREE.MeshStandardMaterial({ color: 0x1d2a36, emissive: 0x1d2a36, emissiveIntensity: 0.6, roughness: 0.6 });

  /* ---------- 11. разрез труб на работающем маршруте: верхняя часть стенки не рисуется — виден продукт ----------
     Признак «разрезать» — атрибут вершин aCut в блоках геометрии PGEO (по участкам, v0.18); материал труб дополняется
     отбрасыванием фрагментов (один раз, при первом пуске). Число вызовов отрисовки не меняется. */
  const cutMats = new Set(), cutState = new Map(), cutSet = new Set();
  const cutable = mt => !!(mt && !Array.isArray(mt) && (mt.isMeshStandardMaterial || mt.isMeshPhongMaterial || mt.isMeshLambertMaterial) && !mt.flatShading);
  function prepMat(mt) {
    if (cutMats.has(mt)) return; cutMats.add(mt);
    const prev = mt.onBeforeCompile, key = mt.customProgramCacheKey ? mt.customProgramCacheKey.bind(mt) : null;
    mt.side = THREE.DoubleSide; mt.shadowSide = THREE.BackSide;   // тень — как прежде (FrontSide → BackSide в проходе теней)
    mt.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mt, sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCut; varying float vCut;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = aCut;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCut;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float pfCutY = -1.0;
          if (vCut > 0.5) { vec3 cwn = inverseTransformDirection(normalize(vNormal), viewMatrix); pfCutY = cwn.y; if (cwn.y > 0.22) discard; } else if (!gl_FrontFacing) discard;`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
          if (!gl_FrontFacing) gl_FragColor.rgb *= 0.42;
          else if (pfCutY > 0.13) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.38, 0.08), 0.6);   // кромка разреза`);
    };
    mt.customProgramCacheKey = () => (key ? key() : '') + '|pflowcut';
    mt.needsUpdate = true;
  }
  const hitP = (p, set) => Array.isArray(p) ? p.some(q => set.has(q)) : (p && set.has(p));
  // set: Map(участок → [ломаные оси, по которым идёт продукт]) — разрезается только эта часть трубы (± отвод), а не весь участок
  const _pv = new V3();
  function nearPolys(polys, x, y, z, tol) {
    for (const pl of polys) {
      if (x < pl.bb[0] - tol || x > pl.bb[3] + tol || y < pl.bb[1] - tol || y > pl.bb[4] + tol || z < pl.bb[2] - tol || z > pl.bb[5] + tol) continue;
      const P_ = pl.pts;
      for (let i = 1; i < P_.length; i++) {
        const a = P_[i - 1], b = P_[i], ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], l2 = ex * ex + ey * ey + ez * ez;
        const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / l2)) : 0;
        if (Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t, z - a[2] - ez * t) <= tol) return true;
      }
    }
    return false;
  }
  function setCut(set) {
    cutSet.clear(); if (set) for (const p of set.keys()) cutSet.add(p);
    const polysOf = p => { const l = set && set.get(p); if (!l) return null; if (!l.bbDone) { for (const pl of l) { const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const q of pl.pts) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], q[k]); bb[k + 3] = Math.max(bb[k + 3], q[k]); } pl.bb = bb; } l.bbDone = 1; } return l; };
    for (const me of P.newMeshes) {
      const pr = me.userData.pr; if (!pr || !cutable(me.material)) continue;
      const g = me.geometry, has = !!(cutSet.size && pr.some(r => hitP(r.p, cutSet)));
      if (!has && !cutState.get(me)) continue;
      if (has) prepMat(me.material);
      let A = g.getAttribute('aCut');
      if (!A) { A = new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1); g.setAttribute('aCut', A); }
      A.array.fill(0);
      if (has) {
        const idx = g.index.array, pos = g.attributes.position.array, nTri = g.index.count / 3;
        for (let i = 0; i < pr.length; i++) {
          if (!hitP(pr[i].p, cutSet)) continue;
          const ps = (Array.isArray(pr[i].p) ? pr[i].p : [pr[i].p]).filter(q => cutSet.has(q)), polys = [].concat(...ps.map(polysOf).filter(Boolean)), tol = 2.05 * Math.max(...ps.map(q => q.r)) + 0.03;
          const f1 = i + 1 < pr.length ? pr[i + 1].f0 : nTri;
          for (let f = pr[i].f0 * 3; f < f1 * 3; f++) { const v = idx[f]; if (A.array[v]) continue; if (nearPolys(polys, pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], tol)) A.array[v] = 1; }
        }
      }
      A.needsUpdate = true; cutState.set(me, has);
    }
  }

  /* ---------- 12. построение потока по результатам модели procSim ---------- */
  // v0.19: несколько независимых «каналов» потока: main — перекачка насосами (procSim), drain — сток пролива в дренаж (ПАЗ)
  const chMeshes = new Map(), chUsed = new Map();
  const meshesOf = key => { let a = chMeshes.get(key); if (!a) chMeshes.set(key, a = []); return a; };
  const flowMeshes = meshesOf('main');
  const anyMeshes = () => { for (const a of chMeshes.values()) if (a.length) return true; return false; };
  function mergedUsed() { const m = new Map(); for (const u of chUsed.values()) for (const [p, l] of u) { const a = m.get(p); m.set(p, a ? a.concat(l) : l.slice()); } return m; }
  let cutOn = true;
  function clearFlow(grp, key = 'main') { const a = meshesOf(key); for (const m of a) { grp.remove(m); m.geometry.dispose(); } a.length = 0; chUsed.delete(key); }
  function buildFlow(grp, flows, prodOf, key = 'main') {
    ensure(); clearFlow(grp, key); const flowMeshes = meshesOf(key);
    const Bin = newBuf(), Bsh = newBuf(), cones = [], used = new Map(), stats = [];
    for (const f of flows) {
      const prod = prodOf(f) || 'LZB', col = new THREE.Color(PCOL[prod] || PCOL.LZB);
      const list = [...f.edges.values()].map(x => ({ e: x.e, d: x.dir, q: x.q, side: x.side }));
      const attrOf = (s, pc) => {
        if (pc.kind === 'gap') return { r: 0.042, ro: 0.05, v: 1.0, k: 1 };
        const p = pc.p || null, D = p ? dims(p) : null;
        if (!p) return null;   // врезка/перемычка — внутри детали; линия идёт напрямую
        const v = s.q > 0 ? s.q / 3600 / D.A : 0.5, sh = !cuttable(p);
        if (pc.len >= 0.25) { let l = used.get(p); if (!l) used.set(p, l = []); if (!l.includes(pc.pl)) l.push(pc.pl || (pc.pl = { pts: pc.pts })); }   // короткий заход на пересекаемую трубу не разрезается
        return sh ? { r: D.rOut * 1.07 + 0.006, ro: D.rOut, v, k: 2, p } : { r: Math.max(0.012, D.id / 2 * 0.93), ro: D.rOut, v, k: 0, p };
      };
      const runs = runsOf(list, attrOf);
      for (const run of runs) {
        if (run.length < 2) continue;
        const path = rounded(run); if (path.length < 2) continue;
        // делится на куски одного вида (внутри трубы / рукав) — разные буферы
        let i0 = 0;
        for (let i = 1; i <= path.length; i++) {
          if (i < path.length && (path[i].at.k === 0) === (path[i0].at.k === 0)) continue;
          const part = path.slice(Math.max(0, i0 - (i0 ? 1 : 0)), i);
          sweepInto(path[i0].at.k === 0 ? Bin : Bsh, part, at => at.r, col, true);   // продукт в трубе — непрозрачный; рукав и условная связь — полупрозрачные
          i0 = i;
        }
        // стрелки над трубой каждые ~8 м
        let acc = 3;
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i], l = a.p.distanceTo(b.p); if (l < 1e-4) continue;
          const dir = b.p.clone().sub(a.p).normalize();
          while (acc < l) { if (Math.abs(dir.y) < 0.7 && a.at.k !== 1) cones.push([a.p.clone().lerp(b.p, acc / l), dir.clone(), a.at.ro]); acc += 8; }
          acc -= l;
        }
      }
      const R = routeInfoFlow(list, f);
      stats.push(R);
      f.pf = R;
    }
    if (Bin.pos.length) { const m = new THREE.Mesh(bufGeo(Bin, true), flowMat); m.name = 'поток ГСМ (в трубе)'; m.renderOrder = 4; m.frustumCulled = false; grp.add(m); flowMeshes.push(m); }
    if (Bsh.pos.length) { const m = new THREE.Mesh(bufGeo(Bsh, true), shellMat); m.name = 'поток ГСМ (рукав)'; m.renderOrder = 5; m.frustumCulled = false; grp.add(m); flowMeshes.push(m); }
    if (cones.length) {
      const cm = new THREE.InstancedMesh(coneGeo, coneMat, cones.length), up = new V3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = new V3();
      cones.forEach(([p, d, ro], i) => { const k = Math.max(0.05, Math.min(0.13, ro * 1.1)); q.setFromUnitVectors(up, d); m4.compose(p.clone().add(new V3(0, ro + 0.1 + k * 1.3, 0)), q, sc.set(k, k, k)); cm.setMatrixAt(i, m4); });
      cm.name = 'направление потока'; grp.add(cm); flowMeshes.push(cm);
    }
    chUsed.set(key, used); lastUsed = mergedUsed(); cutApplied = !!(cutOn && grp.visible && lastUsed.size);
    setCut(cutApplied ? lastUsed : null);
    return stats;
  }
  // сводка по потоку модели (дерево: несколько источников/приёмников)
  function routeInfoFlow(list, f) {
    let len = 0, gap = 0, vol = 0, vmax = null; const rows = [];
    for (const x of list) {
      if (x.e.k === 'pump') continue;
      for (const pc of edgeInfo(x.e).pieces) {
        if (pc.kind === 'gap') { gap += pc.len; continue; }
        if (!pc.p || pc.len < 0.2) { len += pc.len; continue; }
        const D = dims(pc.p), v = x.q / 3600 / D.A; len += pc.len; vol += D.A * pc.len;
        const r = { p: pc.p, D, v, side: x.side === 'p' ? 'd' : x.side, len: pc.len }; rows.push(r); if (!vmax || v > vmax.v) vmax = r;
      }
    }
    const over = rows.filter(r => r.v > (r.side === 's' ? VN.suc : VN.dis)), overMax = rows.filter(r => r.v > VN.max);
    return { len, gap, vol, vmax, over, overMax, Q: f.Q, tt: rows.reduce((a, r) => a + r.len / Math.max(1e-6, r.v), 0) };
  }
  let lastUsed = new Map(), cutApplied = false;
  function tick(now, vis) {
    flowMat.uniforms.uT.value = now / 1000;
    const want = cutOn && vis && anyMeshes() && lastUsed.size > 0;
    if (!want && cutApplied) { setCut(null); cutApplied = false; }
    else if (want && !cutApplied) { setCut(lastUsed); cutApplied = true; }
  }

  /* ---------- 13. выбранный маршрут: подсветка по физическим трубам ---------- */
  function routeMeshes(path, col, op) {
    ensure();
    const list = path.map(({ e, d }) => ({ e, d, q: 0 }));
    const runs = runsOf(list, (s, pc) => { if (pc.kind === 'gap') return { r: 0.07, ro: 0.05, v: 1, k: 1 }; if (!pc.p) return null; const D = dims(pc.p); return { r: D.rOut + 0.035, ro: D.rOut, v: 1, k: 0 }; });
    const Bp = newBuf(), Bc = newBuf(), arr = [];
    for (const run of runs) {
      const path3 = rounded(run); if (path3.length < 2) continue;
      let i0 = 0;
      for (let i = 1; i <= path3.length; i++) { if (i < path3.length && (path3[i].at.k === 1) === (path3[i0].at.k === 1)) continue; sweepInto(path3[i0].at.k === 1 ? Bc : Bp, path3.slice(Math.max(0, i0 - (i0 ? 1 : 0)), i), at => at.r, null, false); i0 = i; }
      let acc = 2;
      for (let i = 1; i < path3.length; i++) { const a = path3[i - 1], b = path3[i], l = a.p.distanceTo(b.p); if (l < 1e-4) continue; const dir = b.p.clone().sub(a.p).normalize(); while (acc < l) { if (Math.abs(dir.y) < 0.7) arr.push([a.p.clone().lerp(b.p, acc / l), dir.clone(), a.at.ro]); acc += 4; } acc -= l; }
    }
    const out = [];
    if (Bp.pos.length) { const m = new THREE.Mesh(bufGeo(Bp, false), procMat(col, Math.min(op, 0.55))); m.renderOrder = 3; out.push(m); }
    if (Bc.pos.length) { const m = new THREE.Mesh(bufGeo(Bc, false), procMat(col, Math.min(op, 0.35))); m.renderOrder = 3; out.push(m); }
    return { meshes: out, arrows: arr };
  }

  const api = { ok: ensure, edgeInfo, edgePts, routeInfo, renderPass, buildFlow, clearFlow, tick, setCut, routeMeshes, dims, statText, STAT, ST3, VN, flowMat,
    get cutOn() { return cutOn; }, set cutOn(v) { cutOn = !!v; }, get buildMs() { return buildMs; }, cutSet };
  window.__PFLOW = api;
  setTimeout(() => { try { ensure(); } catch (e) { console.error('PFLOW:', e); } }, 2500);
  return api;
})();

