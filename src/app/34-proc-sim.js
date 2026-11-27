/* ========== Этап 2: запасы и уровни, расчёт перекачки во времени, блокировки по уровням, поток ГСМ в трубах, звук ==========
   Подача — номинальная по паспорту насоса (АК-004), без гидравлического расчёта сети. Начальные объёмы, вместимость ВЦ/АЦ
   и расходных ёмкостей — модельные значения (задаются пользователем). Уставки LSA и диапазоны LT — по АК-004. */
const procSim = (() => {
  const L = procLogic, N = L.N;
  const RVS_D = 10.43, RVS_H = 12.0, RVS_A = Math.PI * RVS_D * RVS_D / 4;
  const RGS_R = 3.24 / 2, RGS_L = 9.36;
  const rgsV = h => { h = Math.min(2 * RGS_R, Math.max(0, h)); const r = RGS_R, d = r - h; return RGS_L * (r * r * Math.acos(d / r) - d * Math.sqrt(Math.max(0, 2 * r * h - h * h))); };
  const RGS_CAP = rgsV(2 * RGS_R);
  const rgsH = v => { let a = 0, b = 2 * RGS_R; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (rgsV(m) < v) a = m; else b = m; } return (a + b) / 2; };
  const PN = { L: 'ДТ летнее', Z: 'ДТ зимнее', B: 'бензин' };
  /* ёмкости модели */
  const V = {};
  const tank = (k, nm, kind, prod, vol, tagH, tagL, extra = {}) => V[k] = { k, n: nm, kind, prod, vol, tagH, tagL, ...extra };
  tank('RVS1', 'РВС-109.1', 'rvs', 'L', 520, 'LSA109-01', 'LSA109-02', { lt: 'LT109-07', obj: '109.1' });
  tank('RVS2', 'РВС-109.2', 'rvs', 'L', 340, 'LSA109-03', 'LSA109-04', { lt: 'LT109-08', obj: '109.2' });
  tank('RVS3', 'РВС-109.3', 'rvs', 'L', 780, 'LSA109-05', 'LSA109-06', { lt: 'LT109-09', obj: '109.3' });
  tank('RGSZ1', 'РГС-116.1', 'rgs', 'Z', 30, 'LSA116-01', 'LSA116-02', { lt: 'LT116-09' });
  tank('RGSZ2', 'РГС-116.2', 'rgs', 'Z', 52, 'LSA116-03', 'LSA116-04', { lt: 'LT116-10' });
  tank('RGSB1', 'РГС-116.3', 'rgs', 'B', 24, 'LSA116-05', 'LSA116-06', { lt: 'LT116-11' });
  tank('RGSB2', 'РГС-116.4', 'rgs', 'B', 47, 'LSA116-07', 'LSA116-08', { lt: 'LT116-12' });
  tank('VC1', 'ВЦ-1', 'car', 'L', 58, null, null, { cap: 60, est: 2 });   // этап 6.3: ВЦ-N — под УСН-N (АК-045: восток)
  tank('VC2', 'ВЦ-2', 'car', 'L', 58, null, null, { cap: 60, est: 0 });   // запад
  tank('VC3', 'ВЦ-3', 'car', null, 0, null, null, { cap: 60, est: 1 });   // середина (под УНЖ-N1)
  tank('AC', 'Автоцистерна у АСН-N1', 'ac', null, 0, null, null, { cap: 20 });
  tank('KOT_T', 'Расходная ёмкость котельной', 'day', 'L', 1.5, null, null, { cap: 5 });
  tank('DES_T', 'Расходная ёмкость ДЭС', 'day', 'L', 1.0, null, null, { cap: 3 });
  tank('LSC_X', 'ЛСЦ (существующий трубопровод)', 'inf', 'L', 0, null, null, {});
  tank('TRK_X', 'Отпуск через ТРК-1', 'inf', null, 0, null, null, {});
  for (const k of ['RVS1', 'RVS2', 'RVS3']) Object.assign(V[k], { cap: RVS_A * RVS_H, hH: 10.8, hL: 0.7, lt0: 0.7, lt1: 10.7 });
  for (const k of ['RGSZ1', 'RGSZ2', 'RGSB1', 'RGSB2']) Object.assign(V[k], { cap: RGS_CAP, hH: 2.7, hL: 0.3, lt0: 0.3, lt1: 2.7 });
  const INIT = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, { vol: v.vol, prod: v.prod, cap: v.cap }]))));
  const NV = { RVS1: 'RVS1', RVS2: 'RVS2', RVS3: 'RVS3', RGSZ1: 'RGSZ1', RGSZ2: 'RGSZ2', RGSB1: 'RGSB1', RGSB2: 'RGSB2',
    USN1: 'VC1', UPVS: 'VC1', USN2: 'VC2', USN3: 'VC3', UNZH: 'VC3', ASN: 'AC', KOT: 'KOT_T', DES: 'DES_T', LSC: 'LSC_X', TRK: 'TRK_X' };
  const FQ = { USN1: 'FQIT177-01', UPVS: 'FQIT177-01', USN2: 'FQIT177-02', USN3: 'FQIT177-03', UNZH: 'FQIT177-03', ASN: 'FQIT186-01', KOT: 'FQIT200-22', DES: 'FQIT200-22', TRK: 'счётчик ТРК-1' };
  const level = v => v.kind === 'rvs' ? v.vol / RVS_A : v.kind === 'rgs' ? rgsH(v.vol) : null;
  const full = v => v.kind === 'rvs' || v.kind === 'rgs' ? (!v.lsaHFail && level(v) >= v.hH - 1e-4) :   // v0.19: lsaHFail — отказ сигнализатора LSA H (аварийная ситуация)
    (v.kind === 'car' || v.kind === 'ac') ? v.vol >= v.cap * 0.97 - 1e-6 : v.kind === 'day' ? v.vol >= v.cap * 0.9 - 1e-6 : false;
  const low = v => v.kind === 'rvs' || v.kind === 'rgs' ? level(v) <= v.hL + 1e-4 : v.kind === 'car' ? v.vol <= 0.02 : false;
  const pumpQ = id => { const q = L.PU[id].Q; return typeof q === 'number' ? q : id === 'ТРК-1' ? 3.0 : 0; };   // ТРК: 50 л/мин ≈ 3 м³/ч
  const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const S = { t: 0, speed: 60, flows: [], dirty: true, events: [], tasks: {}, cut: false };

  /* дерево достижимости по открытой арматуре (без насосов), с направлением потока по каждому участку */
  function tree(from, dir) {
    const par = new Map([[from, null]]), q = [from], term = [];
    while (q.length) {
      const u = q.shift();
      for (const [e, v, d] of L.adj[u] || []) {
        if (e.k === 'pump' || e.prod === 'D' || e.prod === 'G' || (e.k === 'valve' && !L.st.valve[e.v])) continue;
        if (e.k === 'check' && d !== dir) continue;
        if (par.has(v)) continue;
        par.set(v, [u, e, dir === 1 ? d : -d]);
        if (L.TERM.has(v)) { term.push(v); continue; }
        q.push(v);
      }
    }
    return { par, term };
  }
  /* потоки: по каждой группе работающих насосов с общими узлами всаса/нагнетания */
  function computeFlows() {
    const groups = new Map();
    for (const pid in L.st.pump) if (L.st.pump[pid]) {
      const e = L.E.find(x => x.k === 'pump' && x.pump === pid); const key = e.a + '>' + e.b;
      if (!groups.has(key)) groups.set(key, { a: e.a, b: e.b, pumps: [], pe: [] });
      const g = groups.get(key); g.pumps.push(pid); g.pe.push(e);
    }
    const flows = [];
    for (const g of groups.values()) {
      const Q = g.pumps.reduce((s, p) => s + pumpQ(p), 0);
      const bt = L.TERM.has(g.a) ? { par: new Map([[g.a, null]]), term: [g.a] } : tree(g.a, -1);
      const ft = L.TERM.has(g.b) ? { par: new Map([[g.b, null]]), term: [g.b] } : tree(g.b, 1);
      const srcs = bt.term.filter(L.isSrc), sinks = ft.term.filter(L.isSink);
      if (!srcs.length || !sinks.length) continue;
      const edges = new Map();
      const addE = (e, q, dir, side) => { const o = edges.get(e.id) || { e, q: 0, dir, side }; o.q += q; edges.set(e.id, o); };   // side: s — всас, d — нагнетание, p — насос
      for (const s of srcs) { let n = s; while (bt.par.get(n)) { const [u, e, fd] = bt.par.get(n); addE(e, Q / srcs.length, fd, 's'); n = u; } }
      for (const k of sinks) { let n = k; while (ft.par.get(n)) { const [u, e, fd] = ft.par.get(n); addE(e, Q / sinks.length, fd, 'd'); n = u; } }
      g.pe.forEach((e, i) => addE(e, pumpQ(g.pumps[i]), 1, 'p'));
      flows.push({ pumps: g.pumps, Q, srcs, sinks, edges, moved: 0 });
    }
    return flows;
  }
  /* проверки при пуске: уровни и совместимость продуктов */
  L.onStart((pid, lk) => {
    const sv = lk.suc.map(n => V[NV[n]]).filter(Boolean), kv = lk.dis.map(n => V[NV[n]]).filter(Boolean);
    for (const v of sv) {
      if (v.kind === 'car' && v.vol <= 0.02) return `${v.n} пуста — сливать нечего`;
      if (low(v)) return `в ${v.n} уровень на нижнем аварийном (${v.tagL}, ${fmt(v.hL * 1000, 0)} мм)`;
    }
    for (const v of kv) if (full(v)) return v.tagH ? `в ${v.n} уровень на верхнем аварийном (${v.tagH}, ${fmt(v.hH * 1000, 0)} мм)` : `${v.n} заполнена до предельного уровня`;
    const sp = new Set(sv.map(v => v.prod).filter(Boolean));
    if (sp.size > 1) return 'всасывание открыто сразу из ёмкостей с разными продуктами';
    const p = [...sp][0];
    for (const v of kv) if (p && v.prod && v.vol > 0.02 && v.prod !== p && v.kind !== 'inf') return `смешение продуктов: ${PN[p]} → ${v.n} (${PN[v.prod]})`;
    return null;
  });
  const log = (txt, lvl = 'info') => { S.events.unshift({ t: S.t, txt, lvl }); if (S.events.length > 60) S.events.pop(); if (prTab === 'model' && procP.style.display === 'flex') renderModel(true); };
  const hms = t => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  function trip(f, msg, close) {
    for (const p of f.pumps) L.st.pump[p] = false;
    if (close) L.st.valve[close] = false;
    log(msg, 'alarm'); procAudio.alarm(); L.emit(msg, 'err');
  }
  function stopNormal(f, msg) { for (const p of f.pumps) L.st.pump[p] = false; log(msg, 'ok'); procAudio.chime(); L.emit(msg, 'ok'); }
  L.on(msg => { if (msg && (!S.events[0] || S.events[0].txt !== msg) && /в работе|остановлен|запрещён|собран|закрыта/.test(msg)) log(msg, /запрещён|остановлен:/.test(msg) ? 'warn' : 'info'); });

  function step(dtReal) {
    if (S.dirty) { S.flows = computeFlows(); S.dirty = false; flowViz.build(S.flows); procAudio.update(S.flows); }
    if (!S.flows.length) return;
    // шаг модели дробится (≤ 5 с), чтобы уставки срабатывали без перелива при большом ускорении
    let rem = Math.min(dtReal, 0.25) * S.speed;
    while (rem > 1e-9 && !S.dirty) { const h = Math.min(5, rem); rem -= h; S.t += h; substep(h); }
  }
  function substep(dt) {
    for (const f of S.flows) {
      if (!f.pumps.some(p => L.st.pump[p])) continue;
      const dv = f.Q / 3600 * dt;
      const srcV = f.srcs.map(n => V[NV[n]]), dstV = f.sinks.map(n => V[NV[n]]);
      const prod = srcV.map(v => v.prod).find(Boolean);
      srcV.forEach((v, i) => { v.vol = Math.max(0, v.vol - dv * (f.shS ? f.shS[i] : 1 / srcV.length)); });   // v0.35: доли — по гидравлике
      for (const [i, v] of dstV.entries()) { v.vol += dv * (f.shD ? f.shD[i] : 1 / dstV.length); if (!v.prod && v.kind !== 'inf') v.prod = prod; if (v.kind === 'inf' && v.k === 'TRK_X') v.prod = prod;
        if ((v.kind === 'rvs' || v.kind === 'rgs') && v.vol > v.cap) { const ov = v.vol - v.cap; v.vol = v.cap; if (window.__EMG) window.__EMG.overflow(v, ov, prod); } }   // v0.19: перелив выше стенки
      f.moved += dv;
      for (const p of f.pumps) if (S.tasks[p]) S.tasks[p].moved += dv / f.pumps.length;
    }
    // блокировки и окончание операций
    for (const f of S.flows) {
      if (!f.pumps.some(p => L.st.pump[p])) continue;
      const pn = f.pumps.join(', ');
      for (const n of f.srcs) { const v = V[NV[n]];
        if (v.kind === 'car' && v.vol <= 0.02) { v.vol = 0; stopNormal(f, `${v.n} опорожнена — слив завершён, ${pn} остановлен.`); break; }
        if ((v.kind === 'rvs' || v.kind === 'rgs') && low(v)) { trip(f, `${v.tagL}: нижний аварийный уровень в ${v.n} (${fmt(level(v), 2)} м) — ${pn} отключён (АК-004).`); break; } }
      if (!f.pumps.some(p => L.st.pump[p])) continue;
      for (const n of f.sinks) { const v = V[NV[n]];
        if ((v.kind === 'rvs' || v.kind === 'rgs') && full(v)) { trip(f, `${v.tagH}: верхний аварийный уровень в ${v.n} (${fmt(level(v), 2)} м) — ${pn} отключён (АК-004).`); break; }
        if (v.kind === 'car' && full(v)) { trip(f, `Датчик «СЖУ» УНЖ-N1: предельный уровень в ${v.n} — налив остановлен, клапан «СЕНС» закрыт, ${pn} отключён.`, 'СЕНС-УНЖ'); break; }
        if (v.kind === 'ac' && full(v)) { trip(f, `Датчик «СЖУ» АСН-N1: предельный уровень в автоцистерне — налив остановлен, КО-1 закрыт, ${pn} отключён.`, 'КО-1'); break; }
        if (v.kind === 'day' && full(v)) { trip(f, `Верхний аварийный уровень в ёмкости ${n === 'KOT' ? 'котельной' : 'ДЭС'} — ${pn} отключён (АК-004).`); break; } }
      if (!f.pumps.some(p => L.st.pump[p])) continue;
      for (const p of f.pumps) { const tk = S.tasks[p]; if (tk && tk.limit > 0 && tk.moved >= tk.limit - 1e-6) { delete S.tasks[p]; stopNormal(f, `Задание выполнено: перекачано ${fmt(tk.limit, 2)} м³, ${pn} остановлен.`); break; } }
    }
  }
  function setTask(p, limit) { S.tasks[p] = { limit, moved: 0 }; if (limit > 0) log(`Задание для ${p}: ${fmt(limit, 2)} м³.`); }

  /* ---------- Визуализация потока (v0.18): продукт движется внутри физических труб (модуль PFLOW), стенка трубы на работающем
     маршруте показана в разрезе; скорость рисунка — расчётная по Q и внутреннему диаметру участка. Если сопоставление с трубами
     недоступно — прежний вариант v0.10 по оси графа ТП («прозрачный участок трубы»). ---------- */
  const flowGrp = new THREE.Group(); flowGrp.name = 'procFlow'; scene.add(flowGrp);
  flowGrp.add(procAct);   // выбранный маршрут — по физическим трубам, вместе с потоком (слой «Поток ГСМ»)
  const LIQ = { L: 0xc79a2a, Z: 0xd9c46a, B: 0xe4dca8, LZ: 0xcfae4a, LZB: 0xc9a84a };
  const dnID = s => { if (!s) return null; let m = s.match(/⌀(\d+)×([\d,]+)/); if (m) return (+m[1] - 2 * parseFloat(m[2].replace(',', '.'))) / 1000; m = s.match(/(?:DN|Ду)(\d+)/); return m ? +m[1] / 1000 : null; };
  const edgeID = e => dnID(e.dn) || (e.k === 'pump' ? 0.15 : e.prod === 'LZB' ? 0.1 : 0.15);
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aS; attribute float aL; attribute float aV; attribute vec3 aC;
      varying float vS; varying float vV; varying vec3 vC; varying vec3 vN; varying vec3 vP; varying float vA;
      void main(){ vS = aS + uv.y * aL; vV = aV; vC = aC; vA = uv.x;
        mat4 m = modelMatrix * instanceMatrix; vec4 wp = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uT; varying float vS; varying float vV; varying vec3 vC; varying vec3 vN; varying vec3 vP; varying float vA;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){ float s = vS - uT * vV; float a = abs(fract(vA) - 0.5) * 2.0;
        float n = noise(vec2(s * 1.8, a * 6.0)) * 0.6 + noise(vec2(s * 5.0, a * 14.0)) * 0.4;
        float streak = smoothstep(0.45, 0.85, n);
        float bub = step(0.985, hash(floor(vec2(s * 7.0, a * 9.0))));
        vec3 V = normalize(cameraPosition - vP); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        vec3 col = vC * (0.62 + 0.55 * streak) + vec3(1.0) * (fr * 0.38 + bub * 0.5);
        gl_FragColor = vec4(col, 0.9);
        #include <colorspace_fragment>
      }`
  });
  const mmss = t => { t = Math.round(t); const m = Math.floor(t / 60), s = t % 60; return m ? `${m} мин ${String(s).padStart(2, '0')} с` : `${s} с`; };
  const flowViz = {
    meshes: [], logged: new Set(),
    build(flows) {
      for (const m of this.meshes) { flowGrp.remove(m); m.geometry.dispose(); if (m.userData.own) m.dispose(); }
      this.meshes = [];
      const PF = window.__PFLOW;
      if (PF) {
        try { PF.buildFlow(flowGrp, flows, f => (V[NV[f.srcs[0]]] || {}).prod); this.report(flows); return; }
        catch (e) { console.error('PFLOW: поток', e); PF.clearFlow(flowGrp); }
      }
      this.legacy(flows);
    },
    /* сводка в журнал при пуске: длина трассы по трубам, заполнение, время прохода, скорость; превышение ориентиров */
    report(flows) {
      const keys = new Set();
      for (const f of flows) {
        const R = f.pf; if (!R) continue;
        const key = f.pumps.join('+') + '|' + f.srcs.join(',') + '>' + f.sinks.join(','); keys.add(key);
        if (this.logged.has(key)) continue; this.logged.add(key);
        const sd = { s: 'всас', d: 'нагнетание' }, PFv = window.__PFLOW.VN;
        log(`Поток ${f.pumps.join(' + ')}: по трубам ${fmt(R.len, 0)} м${R.gap > 0.05 ? ` (+ условно ${fmt(R.gap, 1)} м)` : ''}, заполнение трассы ${fmt(R.vol, 2)} м³, проход продукта ≈ ${mmss(R.tt)}` +
          (R.vmax ? `; наибольшая скорость ${fmt(R.vmax.v, 2)} м/с — ${R.vmax.p.id} ${R.vmax.D.txt} (${sd[R.vmax.side] || ''})` : '') + '.');
        if (R.overMax.length) log(`Скорость более ${fmt(PFv.max, 0)} м/с (ВНТП 5-95, табл. 8): ${[...new Set(R.overMax.map(r => r.p.id))].join(', ')} — для ДТ/бензина допустимая скорость определяется расчётом; проверить по разделу ТХ.`, 'warn');
        else if (R.over.length) log(`Скорость выше справочного ориентира (всас ${fmt(PFv.suc, 1)}, нагнетание ${fmt(PFv.dis, 1)} м/с): ${[...new Set(R.over.map(r => `${r.p.id} ${fmt(r.v, 2)}`))].slice(0, 5).join('; ')} м/с. Не блокировка — сверка Ø с гидравлическим расчётом ТХ.`, 'warn');
        if (f.sinks.some(n => n === 'UNZH' || n === 'ASN')) log(`Налив ${f.sinks.includes('UNZH') ? 'в ВЦ (УНЖ-N1)' : 'в автоцистерну (АСН-N1)'}: начальное заполнение — не более ${fmt(PFv.fill0, 0)} м/с до затопления конца наливной трубы на 0,4–0,5 м (ВНТП 5-95 п. 5.1.6). Ступенчатый режим налива в модели не задан (нет данных) — подача номинальная.`, 'warn');
      }
      for (const k of [...this.logged]) if (!keys.has(k)) this.logged.delete(k);
    },
    legacy(flows) {
      const segs = [], cones = [];
      for (const f of flows) {
        const prod = (V[NV[f.srcs[0]]] || {}).prod || 'LZB';
        const col = new THREE.Color(LIQ[prod] || LIQ.LZB);
        for (const { e, q, dir } of f.edges.values()) {
          let p = L.pts3(e); if (dir === -1) p = [...p].reverse();
          const id = edgeID(e), vel = Math.max(0.3, q / 3600 / (Math.PI * id * id / 4));
          let s = 0;
          for (let i = 1; i < p.length; i++) { const len = p[i - 1].distanceTo(p[i]); if (len < 0.005) continue; segs.push([p[i - 1], p[i], s, len, vel, col]); s += len; }
          let acc = 1.5;
          for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], len = a.distanceTo(b); while (acc < len) { cones.push([a.clone().lerp(b, acc / len), b.clone().sub(a).normalize()]); acc += 5; } acc -= len; }
        }
      }
      if (!segs.length) return;
      const geo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
      const aS = new Float32Array(segs.length), aL = new Float32Array(segs.length), aV = new Float32Array(segs.length), aC = new Float32Array(segs.length * 3);
      const im = new THREE.InstancedMesh(geo, flowMat, segs.length);
      segs.forEach(([a, b, s, len, vel, c], i) => { im.setMatrixAt(i, L.segMatrix(a, b, 0.145)); aS[i] = s; aL[i] = len; aV[i] = vel; aC.set([c.r, c.g, c.b], i * 3); });
      geo.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 1)); geo.setAttribute('aL', new THREE.InstancedBufferAttribute(aL, 1));
      geo.setAttribute('aV', new THREE.InstancedBufferAttribute(aV, 1)); geo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
      im.frustumCulled = false; im.renderOrder = 4; im.userData.own = 1; flowGrp.add(im); this.meshes.push(im);
      if (cones.length) {
        const cg = new THREE.ConeGeometry(0.16, 0.42, 10), cm = new THREE.InstancedMesh(cg, procMat(0x1d2a36, 1), cones.length);
        const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
        cones.forEach(([p, d], i) => { q.setFromUnitVectors(up, d); m4.compose(p.clone().add(new THREE.Vector3(0, 0.3, 0)), q, one); cm.setMatrixAt(i, m4); });
        cm.userData.own = 1; flowGrp.add(cm); this.meshes.push(cm);
      }
    }
  };

  /* ---------- Продукт в резервуарах: уровень, технический разрез, подписи ---------- */
  const liqGrp = new THREE.Group(); liqGrp.name = 'procLiq'; scene.add(liqGrp);
  renderer.localClippingEnabled = true;
  const lvlLbl = new THREE.Group(); liqGrp.add(lvlLbl);
  const liqMat = {}; const getLiqMat = p => liqMat[p] || (liqMat[p] = new THREE.MeshStandardMaterial({ color: LIQ[p] || LIQ.LZB, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.86, side: THREE.DoubleSide }));
  const objOf = id => OBJ.find(o => o.id === id);
  const RGSX = { RGSZ1: N.RGSZ1.p, RGSZ2: N.RGSZ2.p, RGSB1: N.RGSB1.p, RGSB2: N.RGSB2.p };
  const rgsObj = k => objOf(Math.abs(RGSX[k][0] - N.RGSB1.p[0]) < 5.5 ? '116.1–2' : '116.3–4');
  const liq = {};
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 48);
  for (const k of ['RVS1', 'RVS2', 'RVS3']) {
    const o = objOf(V[k].obj), c = N[k].p, me = new THREE.Mesh(unitCyl, getLiqMat('L'));
    me.position.set(c[0], 0, c[1]); liqGrp.add(me); liq[k] = { me, o, c, kind: 'rvs' };
  }
  for (const k of ['RGSZ1', 'RGSZ2', 'RGSB1', 'RGSB2']) {
    const me = new THREE.Mesh(new THREE.BufferGeometry(), getLiqMat(V[k].prod)); liqGrp.add(me);
    liq[k] = { me, o: rgsObj(k), c: RGSX[k], kind: 'rgs', h: -1 };
  }
  const rgsSegGeo = h => {
    const r = RGS_R * 0.985, yc = Math.min(r, Math.max(-r, h - r)), xr = Math.sqrt(Math.max(0, r * r - yc * yc));
    const sh = new THREE.Shape(), phR = Math.asin(yc / r), n = 40;
    sh.moveTo(xr, yc);
    for (let i = 1; i <= n; i++) { const ph = phR - (Math.PI + 2 * phR) * i / n; sh.lineTo(r * Math.cos(ph), r * Math.sin(ph)); }
    sh.lineTo(xr, yc);
    const g = new THREE.ExtrudeGeometry(sh, { depth: RGS_L, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -RGS_L / 2); return g;
  };
  function updateLiquids() {
    for (const [k, q] of Object.entries(liq)) {
      const v = V[k], h = level(v), useM = q.o.gM && q.o.gM.visible, gy = q.o.g.position.y;
      const mat = getLiqMat(v.prod || 'LZB');
      if (S.cut) { if (!q.ownMat) q.ownMat = mat.clone(); q.ownMat.color.copy(mat.color); q.ownMat.clippingPlanes = [cutPlanes[k]]; q.me.material = q.ownMat; }
      else q.me.material = mat;
      if (q.kind === 'rvs') { const base = gy + (useM ? (RVSD.on(q.o) ? RVSD.Y_BOT : 0.02) : 0.45); const hh = Math.max(0.01, h - 0.02); q.me.scale.set(5.13, hh, 5.13); q.me.position.y = base + 0.02 + hh / 2; /* v0.37: без z-fighting с днищем */ q.me.visible = h > 0.005; }
      else {   // v0.20: при детальной модели РГС-75 — ось и форма продукта по корпусу с коническими днищами (уровень — прежний, модели ТП)
        const det = useM && RGSD.on(q.o), ay = gy + (det ? RGSD.AXIS : useM ? 2.68 : 2.32);
        if (Math.abs(h - q.h) > 0.01 || q.det !== det) { q.me.geometry.dispose(); q.me.geometry = h > 0.005 ? (det ? RGSD.liqGeo(h) : rgsSegGeo(h)) : new THREE.BufferGeometry(); q.h = h; q.det = det; }
        q.me.position.set(q.c[0], ay, q.c[1]); q.me.visible = h > 0.005;
      }
    }
  }
  /* технический разрез: плоскость через ось резервуара, ближняя к камере половина оболочки не рисуется (поворачивается вслед за камерой) */
  const cutPlanes = {}; const cutSaved = new Map();
  for (const k of Object.keys(liq)) cutPlanes[k] = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  function tankMeshes(k) {
    const q = liq[k], out = [];
    for (const grp of [q.o.gS, q.o.gM]) if (grp) grp.traverse(m => { if (m.isMesh && !m.isInstancedMesh && !m.userData.noCut) {
      const p = new THREE.Vector3(); m.getWorldPosition(p);
      if (q.kind === 'rvs' ? Math.hypot(p.x - q.c[0], p.z - q.c[1]) < 6 : Math.abs(p.x - q.c[0]) < 1.9 && Math.abs(p.z - q.c[1]) < 5.6) out.push(m);
    } });
    return out;
  }
  function setCut(on) {
    S.cut = on;
    for (const [m, mat] of cutSaved) { m.material.dispose(); m.material = mat; } cutSaved.clear();
    for (const q of Object.values(liq)) { if (q.ownMat) q.ownMat.dispose(); q.ownMat = null; }
    if (on) for (const k of Object.keys(liq)) {
      for (const m of tankMeshes(k)) { if (cutSaved.has(m)) continue; cutSaved.set(m, m.material); const c = m.material.clone(); c.clippingPlanes = [cutPlanes[k]]; c.clipShadows = true; c.side = THREE.DoubleSide; m.material = c; }
    }
    S.cutModels = modelsOn; updateCut(); updateLiquids();
  }
  const _cv = new THREE.Vector3();
  function updateCut() {
    if (!S.cut) return;
    if (S.cutModels !== modelsOn) setCut(true);
    for (const [k, q] of Object.entries(liq)) {
      _cv.set(q.c[0] - camera.position.x, 0, q.c[1] - camera.position.z);
      if (q.kind === 'rgs') _cv.z = 0;
      if (_cv.lengthSq() < 1e-6) _cv.set(1, 0, 0);
      _cv.normalize(); cutPlanes[k].normal.copy(_cv); cutPlanes[k].constant = -(_cv.x * q.c[0] + _cv.z * q.c[1]);
    }
  }
  /* подписи уровней (модель) */
  const LBL = [];
  const mkLbl = (k, pos) => { const el = document.createElement('div'); el.className = 'lb lv'; labelsEl.appendChild(el); const it = { el, pos, grp: liqGrp, k }; PROC_LBL.push(it); LBL.push(it); el.onclick = () => { openPanel('proc'); procShow(); prSetTab('tanks'); }; };
  for (const k of ['RVS1', 'RVS2', 'RVS3']) mkLbl(k, new THREE.Vector3(N[k].p[0], 0, N[k].p[1]));
  for (const [k, dz] of [['RGSB1', 3.6], ['RGSB2', -3.6], ['RGSZ1', 3.6], ['RGSZ2', -3.6]]) mkLbl(k, new THREE.Vector3(RGSX[k][0], 0, RGSX[k][1] + dz));   // в шахматном порядке, чтобы подписи не перекрывались
  { const o177 = objOf('177'); const cp = o177.gS.userData.carPos; ['VC1', 'VC2', 'VC3'].forEach(k => { const i = V[k].est; mkLbl(k, new THREE.Vector3(cp[i][0], cp[i][1] + 6.1, cp[i][2] + 0.5)); }); }
  mkLbl('AC', new THREE.Vector3(-56.4, 0, -6.5)); mkLbl('KOT_T', new THREE.Vector3(N.KOT.p[0], 0, N.KOT.p[1])); mkLbl('DES_T', new THREE.Vector3(N.DES.p[0], 0, N.DES.p[1]));
  function vText(v) {
    const h = level(v);
    if (v.kind === 'rvs' || v.kind === 'rgs') return `${v.n.replace('РВС-', '').replace('РГС-', '')} · ${fmt(h, 2)} м · ${fmt(v.vol, 0)} м³`;
    if (v.kind === 'inf') return '';
    return `${v.n.replace('Расходная ёмкость ', '').replace('Автоцистерна у АСН-N1', 'АЦ')} · ${fmt(v.vol, 1)} / ${fmt(v.cap, 0)} м³`;
  }
  function updateLabels() {
    for (const it of LBL) {
      const v = V[it.k], q = liq[it.k];
      if (q) { const top = q.kind === 'rvs' ? (q.o.gM && q.o.gM.visible ? 14.2 : 13.8) : 5.8; it.pos.y = q.o.g.position.y + top; }
      else if (it.k === 'AC') it.pos.y = hAt(it.pos.x, it.pos.z) + 3.4;
      else if (it.k === 'KOT_T' || it.k === 'DES_T') it.pos.y = hAt(it.pos.x, it.pos.z) + 4.2;
      it.el.textContent = vText(v);
      it.el.classList.toggle('al', full(v) || ((v.kind === 'rvs' || v.kind === 'rgs') && low(v)));
      it.el.classList.toggle('fl', S.flows.some(f => f.srcs.concat(f.sinks).some(n => NV[n] === it.k)));
    }
  }

  /* ---------- Панель: живые параметры, ёмкости, модель ---------- */
  function renderLive() {
    const el = document.getElementById('prLive'); if (!el || !prSel.r) return;
    const f = S.flows.find(f => f.pumps.includes(prSel.pump));
    if (!f) { el.innerHTML = ''; return; }
    const sv = f.srcs.map(n => V[NV[n]]), dv = f.sinks.map(n => V[NV[n]]);
    const main = [...f.edges.values()].filter(x => x.e.k === 'pipe' && x.e.dn).sort((a, b) => edgeID(b.e) - edgeID(a.e))[0];
    const vel = main ? main.q / 3600 / (Math.PI * edgeID(main.e) ** 2 / 4) : null;
    const tk = S.tasks[prSel.pump];
    let eta = Infinity, why = '';
    const clampEta = () => { if (eta < 0) eta = 0; };
    const qs = f.Q / 3600;
    for (const v of sv) { let rem = v.kind === 'car' ? v.vol : (v.kind === 'rvs' ? (level(v) - v.hL) * RVS_A : v.kind === 'rgs' ? v.vol - rgsV(v.hL) : Infinity); rem *= sv.length; if (rem / qs < eta) { eta = rem / qs; why = v.kind === 'car' ? `опорожнение ${v.n}` : `${v.tagL} в ${v.n}`; } }
    for (const v of dv) { let rem = v.kind === 'rvs' ? (v.hH - level(v)) * RVS_A : v.kind === 'rgs' ? rgsV(v.hH) - v.vol : (v.kind === 'car' || v.kind === 'ac') ? v.cap * 0.97 - v.vol : v.kind === 'day' ? v.cap * 0.9 - v.vol : Infinity; rem *= dv.length; if (rem / qs < eta) { eta = rem / qs; why = v.tagH ? `${v.tagH} в ${v.n}` : `предельный уровень: ${v.n}`; } }
    if (tk && tk.limit > 0) { const rem = (tk.limit - tk.moved) / qs; if (rem < eta) { eta = rem; why = 'задание'; } }
    clampEta();
    const vv = v => (v.kind === 'rvs' || v.kind === 'rgs') ? `${fmt(level(v) * 1000, 0)} мм · ${fmt(v.vol, 1)} м³` : v.kind === 'inf' ? `отпущено ${fmt(v.vol, 2)} м³` : `${fmt(v.vol, 2)} из ${fmt(v.cap, 0)} м³`;
    const fq = f.srcs.concat(f.sinks).map(n => FQ[n]).find(Boolean);
    const pis = f.pumps.map(p => L.PU[p].pis !== '—' ? `${L.PU[p].pis}: ${L.PU[p].P.split(' / ')[0]} МПа` : '').filter(Boolean).join('; ');
    el.innerHTML = `<div class="live"><div><span>Подача</span><b>${fmt(f.Q, f.Q < 10 ? 1 : 0)} м³/ч</b>${fq ? `<i>${fq}</i>` : ''}</div>` +
      (f.pf && f.pf.vmax ? `<div><span>Скорость, наибольшая</span><b>${fmt(f.pf.vmax.v, 2)} м/с</b><i>${f.pf.vmax.p.id} ${f.pf.vmax.D.txt}</i></div>` +
        `<div><span>Трасса по трубам</span><b>${fmt(f.pf.len, 0)} м</b>${f.pf.gap > 0.05 ? `<i>+ условно ${fmt(f.pf.gap, 1)} м</i>` : ''}</div><div><span>Заполнение трассы</span><b>${fmt(f.pf.vol, 2)} м³</b><i>проход ≈ ${mmss(f.pf.tt)}</i></div>`
        : vel ? `<div><span>Скорость в ${main.e.dn}</span><b>${fmt(vel, 2)} м/с</b></div>` : '') +
      `<div><span>Перекачано</span><b>${fmt(tk ? tk.moved : f.moved, 2)} м³</b>${tk && tk.limit ? `<i>задание ${fmt(tk.limit, 2)}</i>` : ''}</div>` +
      `<div><span>Источник</span><b>${sv.map(v => v.n + ': ' + vv(v)).join('<br>')}</b></div><div><span>Приёмник</span><b>${dv.map(v => v.n + ': ' + vv(v)).join('<br>')}</b></div>` +
      (pis ? `<div><span>Давление на напоре (Рном АК-004)</span><b>${pis}</b></div>` : '') +
      `<div><span>До остановки</span><b>${isFinite(eta) ? hms(eta) : '—'}</b>${why ? `<i>${why}</i>` : ''}</div>` +
      (window.__HYDX ? window.__HYDX.liveHTML(f) : '') + `<div class="mt">Модельное время ${hms(S.t)} · ускорение ×${S.speed}. Подача — ${f.hyd && !f.hyd.fallback ? 'расчётная (рабочая точка насоса на сети, v0.35)' : 'номинальная по паспорту насоса'}.</div></div>`;
  }
  const TLIST = ['RVS1', 'RVS2', 'RVS3', 'RGSZ1', 'RGSZ2', 'RGSB1', 'RGSB2', 'VC1', 'VC2', 'VC3', 'AC', 'KOT_T', 'DES_T'];
  function renderTanks(rebuild) {
    const box = document.getElementById('prTanks');
    if (rebuild) {
      let h = '<div class="rn" style="margin-top:2px">Начальные объёмы, вместимость ВЦ, автоцистерны и расходных ёмкостей — <b>модельные данные</b> (реальные показания не поступают). Уставки LSA и диапазоны LT — по АК-004.</div>';
      for (const k of TLIST) {
        const v = V[k], tankish = v.kind === 'rvs' || v.kind === 'rgs';
        h += `<div class="tk" data-k="${k}"><div class="tkh"><b>${v.n}</b><span class="tp"></span></div><div class="bar"><i></i>${tankish ? '<s class="h"></s><s class="l"></s>' : ''}</div><div class="tkv"></div>` +
          `<div class="tke"><label>V, м³ <input type="number" step="0.5" min="0" data-f="vol"></label>` +
          (v.kind === 'car' ? `<label>продукт <select data-f="prod"><option value="">—</option><option value="L">ДТ(Л)</option><option value="Z">ДТ(З)</option><option value="B">бензин</option></select></label>` : '') +
          (!tankish ? `<label>вместимость <input type="number" step="1" min="1" data-f="cap"></label>` : '') + '</div></div>';
      }
      box.innerHTML = h;
      box.querySelectorAll('input,select').forEach(inp => {
        inp.onkeydown = e => e.stopPropagation();
        inp.onchange = () => {
          const v = V[inp.closest('.tk').dataset.k], f = inp.dataset.f;
          if (f === 'prod') { v.prod = inp.value || null; }
          else { let x = Math.max(0, parseFloat(String(inp.value).replace(',', '.')) || 0); if (f === 'vol') x = Math.min(x, v.cap || x); if (f === 'cap') x = Math.max(1, x); v[f] = x; if (f === 'vol' && v.kind === 'car' && x > 0 && !v.prod) v.prod = 'L'; }
          log(`Модельное значение изменено: ${v.n} — ${f === 'vol' ? 'объём ' + fmt(v.vol, 1) + ' м³' : f === 'cap' ? 'вместимость ' + fmt(v.cap, 0) + ' м³' : 'продукт ' + (PN[v.prod] || '—')}.`);
          renderTanks(false);
        };
      });
    }
    for (const el of box.querySelectorAll('.tk')) {
      const v = V[el.dataset.k], tankish = v.kind === 'rvs' || v.kind === 'rgs', h = level(v);
      const frac = tankish ? h / (v.kind === 'rvs' ? RVS_H : 2 * RGS_R) : v.vol / v.cap;
      el.querySelector('.bar i').style.width = Math.min(100, frac * 100).toFixed(1) + '%';
      el.querySelector('.bar i').style.background = '#' + new THREE.Color(LIQ[v.prod] || 0xbfc5ca).getHexString(THREE.SRGBColorSpace);
      if (tankish) { const top = v.kind === 'rvs' ? RVS_H : 2 * RGS_R; el.querySelector('.bar .h').style.left = (v.hH / top * 100) + '%'; el.querySelector('.bar .l').style.left = (v.hL / top * 100) + '%'; }
      el.querySelector('.tp').textContent = PN[v.prod] || 'пусто';
      const st = full(v) ? (tankish ? ` · ${v.tagH} — верхний аварийный` : ' · предельный уровень') : (tankish && low(v)) ? ` · ${v.tagL} — нижний аварийный` : '';
      el.querySelector('.tkv').innerHTML = (tankish ? `${v.lt}: ${fmt(h * 1000, 0)} мм (диапазон ${fmt(v.lt0 * 1000, 0)}…${fmt(v.lt1 * 1000, 0)}) · ${fmt(v.vol, 1)} м³ из ${fmt(v.cap, 0)}` : `${fmt(v.vol, 2)} м³ из ${fmt(v.cap, 0)} м³ (${fmt(frac * 100, 0)} %)`) + `<b class="al">${st}</b>`;
      el.classList.toggle('flow', S.flows.some(f => f.srcs.concat(f.sinks).some(n => NV[n] === el.dataset.k)));
      for (const inp of el.querySelectorAll('input,select')) if (document.activeElement !== inp) inp.value = inp.dataset.f === 'prod' ? (v.prod || '') : inp.dataset.f === 'vol' ? +v.vol.toFixed(2) : +v.cap.toFixed(1);
    }
  }
  function renderModel(rebuild) {
    const box = document.getElementById('prModel');
    if (rebuild) {
      box.innerHTML = `<div class="oc">Модельное время</div><div class="mtime"><b id="pmT"></b><span>ускорение:</span>` +
        [1, 10, 60, 300, 1200].map(x => `<button class="pbtn sm${x === S.speed ? ' grn' : ''}" data-sp="${x}">×${x}</button>`).join('') + `</div>` +
        `<div class="oc">Вид</div><label class="chk"><input type="checkbox" id="pmCut" ${S.cut ? 'checked' : ''}> Технический разрез резервуаров (видно продукт внутри)</label>` +
        `<label class="chk"><input type="checkbox" id="pmPCut" ${window.__PFLOW && window.__PFLOW.cutOn ? 'checked' : ''}> Разрез труб на работающем маршруте (видно движение продукта)</label>` +
        `<div class="oc">Звук</div><label class="chk"><input type="checkbox" id="pmSnd" ${procAudio.on ? 'checked' : ''}> Звук включён</label>` +
        `<label class="chk">Громкость <input type="range" id="pmVol" min="0" max="1" step="0.05" value="${procAudio.vol}"></label>` +
        ['pump:Насосы', 'flow:Движение жидкости', 'alarm:Сигналы и тревоги', 'voice:Голосовые сообщения ПАЗ', 'steps:Шаги (обход)'].map(s => { const [k, n] = s.split(':'); return `<label class="chk"><input type="checkbox" data-ch="${k}" ${procAudio.ch[k] ? 'checked' : ''}> ${n}</label>`; }).join('') +
        `<div class="pbar" style="margin-top:8px"><button class="pbtn" id="pmReset">Сбросить модель к исходным значениям</button></div>` +
        `<div class="oc">Журнал событий</div><div id="pmLog"></div>`;
      box.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.speed = +b.dataset.sp; log(`Ускорение модельного времени ×${S.speed}.`); renderModel(true); });
      box.querySelector('#pmCut').onchange = e => { setCut(e.target.checked); if (e.target.checked && !layerApi.isOn('proclvl')) layerApi.setVis('proclvl', true); };
      { const c = box.querySelector('#pmPCut'); if (c) c.onchange = e => { if (window.__PFLOW) { window.__PFLOW.cutOn = e.target.checked; log(e.target.checked ? 'Разрез труб на работающем маршруте включён.' : 'Разрез труб выключен: продукт внутри труб не виден.'); } }; }
      box.querySelector('#pmSnd').onchange = e => procAudio.enable(e.target.checked);
      box.querySelector('#pmVol').oninput = e => procAudio.setVol(+e.target.value);
      box.querySelectorAll('[data-ch]').forEach(c => c.onchange = () => { procAudio.ch[c.dataset.ch] = c.checked; procAudio.update(S.flows); });
      box.querySelector('#pmReset').onclick = () => {
        L.closeAll(true);   // v0.35: сброс — мгновенно, без хода арматуры
        for (const [k, i] of Object.entries(INIT)) Object.assign(V[k], i);
        S.t = 0; S.tasks = {}; S.events.length = 0; log('Модель сброшена к исходным значениям.'); renderModel(true);
      };
      if (window.__HYDX) try { window.__HYDX.modelUI(box); } catch (e) { console.error('HYDX: вкладка «Модель»', e); }   // v0.35
    }
    const t = document.getElementById('pmT'); if (t) t.textContent = hms(S.t);
    const lg = document.getElementById('pmLog');
    if (lg && rebuild) lg.innerHTML = S.events.length ? S.events.map(e => `<div class="ev ${e.lvl}"><b>${hms(e.t)}</b> ${e.txt}</div>`).join('') : '<div class="empty">Событий пока нет.</div>';
  }
  /* индикатор идущей перекачки */
  const chip = document.getElementById('simChip');
  chip.onclick = () => { openPanel('proc'); procShow(); prSetTab('routes'); };
  function renderChip() {
    if (!S.flows.length) { chip.style.display = 'none'; return; }
    chip.style.display = '';
    chip.innerHTML = '▶ ' + S.flows.map(f => `${f.pumps.join('+')}: ${fmt(f.Q, f.Q < 10 ? 1 : 0)} м³/ч`).join(' · ') + ` · ×${S.speed} · ${hms(S.t)}`;
  }
  let uiT = 0;
  function tick(now, dtReal) {
    step(dtReal);
    flowMat.uniforms.uT.value = now / 1000;
    if (window.__PFLOW) window.__PFLOW.tick(now, flowGrp.visible);
    updateCut();
    for (const [k, r] of Object.entries(L.pRing)) if (L.st.pump[k]) r.rotation.z += dtReal * 4;
    if (now - uiT > 250) {
      uiT = now;
      try {   // ошибка интерфейса не должна останавливать цикл отрисовки
        updateLiquids(); updateLabels(); renderChip(); procAudio.listen();
        if (procP.style.display === 'flex') { if (prTab === 'routes') renderLive(); else if (prTab === 'tanks') renderTanks(false); else renderModel(false); }
      } catch (e) { console.error('Модель ТП (интерфейс):', e); }
    }
  }
  updateLiquids();
  return { V, S, liqGrp, flowGrp, flowViz, tick, setTask, renderLive, renderTanks, renderModel, setCut, level, log, full, cutPlanes, get dirty() { return S.dirty; }, set dirty(x) { S.dirty = x; } };
})();

