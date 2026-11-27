/* =====================================================================================
   v0.35 — HYDX: состояния насосов, ход арматуры, гидравлика маршрутов
   Ядро расчёта — HYD35 (window.HYD35, выше). Модуль подключается к procLogic, procSim,
   PFLOW и EMG через перехватчики (как EMG в v0.19). Граф ТП, маршруты М1–М9, координаты,
   трассы и ПАЗ не меняются.
   - Арматура: время хода, «в движении», промежуточное положение, «Стоп» в ходе.
     Маршрут собирается из полностью открытой арматуры; при закрытии в ходе продукт идёт,
     пока задвижка не закрылась (дросселирование).
   - Насосы: стоит → пуск → работа → останов (выбег); неисправность; недоступен; ЧП Н-1/Н-2.
   - Гидравлика: рабочая точка насоса на сети по физическим трубам (PFLOW): длины, Dвн,
     повороты, перепад отметок, местные сопротивления, СППК на байпасе, NPSHa, PI/PIS.
   Все условные параметры — в HYD35.DATA (статус PROVISIONAL), видны во вкладке «Модель».
   ===================================================================================== */
const HYDX = (() => {
  const H = window.HYD35;
  if (!H || typeof procLogic === 'undefined' || typeof procSim === 'undefined') return null;
  const L = procLogic, PS = procSim, S = PS.S, PF = window.__PFLOW, E = typeof EMG !== 'undefined' ? EMG : null;
  const D = H.DATA;
  const fmt = (x, d = 2) => (+x).toFixed(d).replace('.', ',').replace('-', '−');
  const FLC = { L: 'DTL', Z: 'DTZ', B: 'B' };
  const cfg = { T: 20 };

  /* ---------- 1. Арматура: автомат хода ---------- */
  const vKind = id => {
    const v = L.V[id];
    if (/^N[1-5]$/.test(id)) return 'ball_e';   // краны шаровые F190F с приводом Biffi (177-ТХ.С, v0.22)
    if (/^N[6-8]$/.test(id)) return 'gate_e';   // 30с941нж DN200/150 (АК-004)
    if (v.typ === 'КО') return 'ko';
    if (v.typ === 'КЛ') return 'sol';
    if (v.typ === 'КШ' || /^Кран/i.test(v.n)) return 'ball_m';
    if (v.typ === 'М') return 'gate_e';
    return 'gate_m';
  };
  const KIND_N = { gate_e: 'задвижка с электроприводом', ball_e: 'кран шаровой с электроприводом', ko: 'клапан отсечной', sol: 'клапан электромагнитный', gate_m: 'задвижка ручная', ball_m: 'кран шаровой ручной' };
  const VS = new H.ValveSM({});
  for (const id in L.V) VS.add(id, { kind: vKind(id), pos: L.st.valve[id] ? 1 : 0 });
  const lastW = {}; for (const id in L.V) lastW[id] = !!L.st.valve[id];
  const forced = {};                 // закрыта внешней командой (ПАЗ, «СЖУ»): признак «закрыта» держится до конца хода
  const single = new Set();          // одиночные команды — в журнал по окончании хода
  let group = null;                  // групповая операция: { kind: 'asm'|'close', ids, bad, stuck }
  const isMoving = id => { const x = VS.get(id); return !!x && (x.state === 'opening' || x.state === 'closing'); };
  const anyMoving = () => Object.keys(VS.v).some(isMoving);
  const pct = id => Math.round(VS.pos(id) * 100);
  const vShort = id => `${id} (${VS.label(id)}${isMoving(id) || VS.get(id).state === 'stopped' ? ', ' + pct(id) + ' %' : ''})`;
  window.__VPOS = (id, fb) => (VS.get(id) ? VS.pos(id) : fb);

  const setValveChain = L.setValve, assembleChain = L.assemble, closeAllChain = L.closeAll, setPumpChain = L.setPump, evaluate0 = L.evaluate;
  let kickF = true; const kick = () => { kickF = true; };
  function commit(id, open) {                       // итоговое состояние — через цепочку (EMG → исходная логика: защита, события)
    if (!!L.st.valve[id] !== !!open) setValveChain(id, open);
    lastW[id] = !!L.st.valve[id];
  }
  const jammed = id => !!(E && E.F && E.F.valve[id]);

  L.setValve = (id, open) => {
    if (!VS.get(id) || jammed(id)) return setValveChain(id, open);   // заклинивание: отказ и сообщение — модуль ПАЗ
    delete forced[id];
    const r = open ? VS.cmdOpen(id) : VS.cmdClose(id);
    if (!r.ok) { L.emit(r.reason, 'err'); return; }
    if (r.time == null) { commit(id, VS.legacyOpen(id)); L.emit(null); return; }
    single.add(id);
    PS.log(`${id}: «${open ? 'Открыть' : 'Закрыть'}» — ${KIND_N[VS.get(id).kind]}, ход ≈ ${Math.round(r.time)} с (модельное время).`);
    L.emit(null); kick();
  };
  // команда на промежуточное положение (дросселирование) и «Стоп» в ходе
  function valveTo(id, pos) {
    if (!VS.get(id)) return;
    if (jammed(id)) { setValveChain(id, pos > 0.5); return; }
    delete forced[id];
    const r = VS.cmdTo(id, pos);
    if (!r.ok) { L.emit(r.reason, 'err'); return; }
    single.add(id);
    if (r.time != null) PS.log(`${id}: установить открытие ${Math.round(pos * 100)} % — ход ≈ ${Math.round(r.time)} с.`);
    L.emit(null); kick();
  }
  function valveStop(id) { if (!VS.get(id)) return; VS.cmdStop(id); PS.log(`${id}: «Стоп» — остановлена в положении ${pct(id)} %.`); L.emit(null); kick(); }

  L.assemble = path => {
    const need = new Set(path.filter(x => x.e.k === 'valve').map(x => x.e.v));
    for (const k in L.st.pump) L.st.pump[k] = false;           // как в исходной сборке: насосы остановлены
    const op = [], cl = [], bad = [], stuck = [];
    for (const id in L.V) {
      const want = need.has(id);
      if (jammed(id)) { const m = E.F.valve[id]; if (want && m === 'closed') bad.push(id); if (!want && m === 'open') stuck.push(id); continue; }
      delete forced[id]; single.delete(id);
      if (want && !VS.fullyOpen(id)) { VS.cmdOpen(id); op.push(id); }
      else if (!want && (VS.passable(id) || VS.get(id).state === 'opening')) { VS.cmdClose(id); cl.push(id); }
    }
    const tmax = Math.max(0, ...op.concat(cl).map(id => Math.abs(VS.get(id).target - VS.pos(id)) * VS.get(id).travel));
    group = op.length || cl.length ? { kind: 'asm', ids: op.concat(cl), bad, stuck } : null;
    if (group) L.emit(`Сборка маршрута: открываются ${op.join(', ') || '—'}; закрываются ${cl.join(', ') || '—'}. Ход арматуры — до ${Math.round(tmax)} с модельного времени.`, 'info');
    else asmDone(bad, stuck);
    kick();
  };
  function asmDone(bad, stuck) {
    if (bad.length) L.emit(`Маршрут не собран полностью: ${bad.join(', ')} не открылась (заклинивание).`, 'err');
    else if (stuck.length) L.emit(`Маршрут собран, но ${stuck.join(', ')} осталась открытой (заклинивание).`, 'warn');
    else L.emit('Маршрут собран: прочая арматура закрыта.', 'ok');
  }
  L.closeAll = instant => {
    if (instant === true) {                      // сброс модели: мгновенно
      for (const id in L.V) if (!jammed(id)) { VS.setPos(id, 0); delete forced[id]; }
      group = null; single.clear();
      closeAllChain();
      for (const id in L.V) lastW[id] = !!L.st.valve[id];
      for (const id in L.PU) { const x = PSM.get(id); if (x && x.state !== 'fault' && x.state !== 'na') { x.state = 'stop'; x.s = 0; } lastP[id] = !!L.st.pump[id]; }
      kick(); return;
    }
    for (const k in L.st.pump) L.st.pump[k] = false;
    const cl = [], stuck = [];
    for (const id in L.V) {
      if (jammed(id)) { if (E.F.valve[id] === 'open') stuck.push(id); continue; }
      delete forced[id]; single.delete(id);
      if (VS.passable(id) || VS.get(id).state === 'opening') { VS.cmdClose(id); cl.push(id); }
    }
    group = cl.length ? { kind: 'close', ids: cl, bad: [], stuck } : null;
    if (group) L.emit(`Закрытие всей арматуры: в ходе ${cl.length} шт.; насосы остановлены.`, 'info');
    else L.emit(stuck.length ? `Не закрылись: ${stuck.join(', ')} (заклинивание).` : 'Вся арматура закрыта, насосы остановлены.', stuck.length ? 'err' : 'info');
    kick();
  };
  L.evaluate = (...a) => {
    const r = evaluate0(...a);
    try {
      if (r && r.lvl === 'err' && r.closed && r.closed.length) {
        const mv = r.closed.filter(v => VS.get(v) && VS.get(v).state === 'opening'), rest = r.closed.filter(v => !mv.includes(v));
        if (mv.length) { r.text = `Маршрут собирается: в ходе — ${mv.map(vShort).join(', ')}` + (rest.length ? `; закрыто: ${rest.join(', ')}` : '') + '.'; r.lvl = 'warn'; }
      }
    } catch (e) { }
    return r;
  };

  /* ---------- 2. Насосы: автомат состояний ---------- */
  const PSM = new H.PumpSM(Object.keys(L.PU));
  const lastP = {};
  for (const id in L.PU) { lastP[id] = !!L.st.pump[id]; if (lastP[id]) { const x = PSM.get(id); x.state = 'run'; x.s = 1; } }
  if (L.PU['Н-4']) PSM.get('Н-4').reason = '';
  L.setPump = (id, run) => {
    if (run) {
      const x = PSM.get(id);
      if (x && (x.state === 'fault' || x.state === 'na')) { L.emit(`Пуск ${L.PU[id].n} запрещён: ${PSM.label(id)}${x.reason ? ' — ' + x.reason : ''}.`, 'err'); return false; }
      const c = L.canStart(id);
      if (!c.ok) {
        const mv = Object.keys(VS.v).filter(v => VS.get(v).state === 'opening');
        if (mv.length) { L.emit(`Пуск ${L.PU[id].n} запрещён: арматура в ходе — ${mv.map(vShort).join(', ')}. Дождитесь окончания хода.`, 'err'); return false; }
      }
    }
    const ok = setPumpChain(id, run);
    if (ok) { if (run) PSM.cmdStart(id); else PSM.cmdStop(id, 'команда «Стоп»'); lastP[id] = !!L.st.pump[id]; }
    kick(); return ok;
  };
  function setSpeed(id, frac) {
    if (!PSM.setSpeed(id, frac)) return;
    PS.log(`${id}: задание частоты ЧП ${Math.round(PSM.get(id).sp * 50)} Гц (${Math.round(PSM.get(id).sp * 100)} %).`);
    L.emit(null); kick();
  }

  /* ---------- 3. Согласование с прямыми записями состояния (ПАЗ, уровни, СЖУ, исходная логика) ---------- */
  function reconcile() {
    for (const id in L.V) {
      const x = VS.get(id); if (!x) continue;
      const j = jammed(id); if (x.jam !== j) VS.setJam(id, j);
      const st = !!L.st.valve[id];
      if (st === lastW[id]) continue;
      if (x.jam) { lastW[id] = st; continue; }
      if (!st) { if (x.pos > 1e-3) { VS.cmdClose(id); forced[id] = true; } }
      else { VS.cmdOpen(id); L.st.valve[id] = VS.legacyOpen(id); }
      lastW[id] = !!L.st.valve[id]; kick();
    }
    for (const id in L.PU) {
      const st = !!L.st.pump[id];
      if (st !== lastP[id]) { if (st) PSM.cmdStart(id); else PSM.trip(id, 'отключение'); lastP[id] = st; kick(); }
      if (E && E.F) {
        const f = E.F.pump[id], x = PSM.get(id);
        if (f && x.state !== 'fault' && !x.faultPending) PSM.setFault(id, f);
        else if (!f && (x.state === 'fault' || x.faultPending)) PSM.clearFault(id);
      }
    }
  }
  function applyValves() {
    let ch = false;
    for (const id in L.V) {
      const x = VS.get(id); if (!x || x.jam) continue;
      if (forced[id]) { if (x.state === 'closed') delete forced[id]; continue; }
      const want = VS.legacyOpen(id);
      if (want !== !!L.st.valve[id]) { commit(id, want); ch = true; }
      else lastW[id] = !!L.st.valve[id];
    }
    return ch;
  }
  function onValveEvents(ev) {
    for (const e of ev) if (single.has(e.id) && (e.to === 'open' || e.to === 'closed' || e.to === 'stopped')) {
      single.delete(e.id);
      PS.log(`${e.id}: ${e.to === 'open' ? 'открыта' : e.to === 'closed' ? 'закрыта' : 'остановлена в положении ' + Math.round(e.pos * 100) + ' %'}.`, 'info');
    }
    if (group && !group.ids.some(isMoving)) {
      const g = group; group = null;
      if (g.kind === 'asm') asmDone(g.bad, g.stuck);
      else L.emit(g.stuck.length ? `Не закрылись: ${g.stuck.join(', ')} (заклинивание).` : 'Вся арматура закрыта, насосы остановлены.', g.stuck.length ? 'err' : 'info');
    }
  }
  function onPumpEvents(ev) {
    for (const e of ev) {
      if (e.from === 'start' && e.to === 'run') PS.log(`${e.id}: разгон завершён — работа.`);
      if (e.to === 'stop' && e.from === 'stopping') PS.log(`${e.id}: выбег завершён — насос стоит.`);
    }
  }

  /* ---------- 4. Гидравлика: дерево маршрута по физическим трубам ---------- */
  const NVK = { RVS1: 'RVS1', RVS2: 'RVS2', RVS3: 'RVS3', RGSZ1: 'RGSZ1', RGSZ2: 'RGSZ2', RGSB1: 'RGSB1', RGSB2: 'RGSB2',
    USN1: 'VC1', UPVS: 'VC1', USN2: 'VC2', USN3: 'VC3', UNZH: 'VC3', ASN: 'AC', KOT: 'KOT_T', DES: 'DES_T', LSC: 'LSC_X', TRK: 'TRK_X' };
  const CAR = SIMGEO.CAR;          // котёл ВЦ (модель вагона — DEMONSTRATION ONLY, тип вагона не указан)
  const carLevel = v => { const cap = v.cap || 60, Lq = cap / (Math.PI * CAR.R * CAR.R), R = CAR.R, seg = h => Lq * (R * R * Math.acos((R - h) / R) - (R - h) * Math.sqrt(Math.max(0, 2 * R * h - h * h)));
    const vol = Math.min(cap, Math.max(0, v.vol)); let a = 0, b = 2 * R; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (seg(m) < vol) a = m; else b = m; } return (a + b) / 2; };
  const BSRC = {};
  /* Граничное условие ёмкости: отметка зеркала (м, система сцены) */
  function boundary(k) {
    const N = L.N[k], v = PS.V[NVK[k]];
    if (!N) return null;
    if (/^RVS\d$/.test(k)) {
      BSRC[k] = 'днище РВС по размерам РВС-1000 + уровень (модель)';
      return { kind: 'tank', z: SIMGEO.rvsBottom(N.obj) + PS.level(v) };
    }
    if (/^RGS/.test(k)) {
      const ax = SIMGEO.rgsAxis(Math.abs(N.p[0] - L.N.RGSB1.p[0]) < 5.5 ? '116.1–2' : '116.3–4');
      BSRC[k] = 'ось РГС-75 по размерам модели − R + уровень (модель)';
      return { kind: 'tank', z: ax - 1.62 + PS.level(v) };
    }
    if (/^USN\d$|^UPVS$|^UNZH$/.test(k)) {
      const bot = SIMGEO.carBottom(v.est), h = carLevel(v);
      BSRC[k] = 'котёл ВЦ по модели вагона (тип вагона не указан — условно) + уровень (модель)';
      return { kind: 'tank', z: k === 'UNZH' ? Math.max(bot + h, bot + 0.2) : bot + h };   // налив: наливная труба до дна котла
    }
    if (k === 'ASN') {
      const y0 = SIMGEO.ground(-56.4, -6.5); BSRC[k] = 'автоцистерна: низ котла +1,2 м от земли, высота 1,9 м — условно';
      return { kind: 'tank', z: Math.max(y0 + 1.2 + 1.9 * Math.min(1, v.vol / (v.cap || 20)), y0 + 1.4) };
    }
    if (k === 'KOT' || k === 'DES') { BSRC[k] = 'расходная ёмкость: отметка не указана в документах — принято +2,0 м от земли (условно)'; return { kind: 'free', z: SIMGEO.ground(N.p[0], N.p[1]) + 2.0 }; }
    if (k === 'TRK') { BSRC[k] = 'раздаточный кран ТРК: излив +1,0 м от земли (условно)'; return { kind: 'free', z: SIMGEO.ground(N.p[0], N.p[1]) + 1.0 }; }
    return null;   // ЛСЦ: давление в существующем трубопроводе неизвестно
  }
  const DEV = {   // местные сопротивления устройств у ёмкостей (по составу узлов АК-004; коэффициенты — справочные)
    USN1: { usn: 1, filter: 1, meter: 1, inlet: 1 }, USN2: { usn: 1, filter: 1, meter: 1, inlet: 1 }, USN3: { usn: 1, filter: 1, meter: 1, inlet: 1 }, UPVS: { usn: 1, inlet: 1 },
    UNZH: { usn: 1, meter: 1, outlet: 1 }, ASN: { usn: 1, meter: 1, outlet: 1 }, KOT: { meter: 1, outlet: 1 }, DES: { meter: 1, outlet: 1 }, TRK: { meter: 1, outlet: 1 }
  };
  const DEVN = { usn: 'шарнирное устройство', filter: 'фильтр', meter: 'расходомер', inlet: 'вход', outlet: 'выход' };
  const dnOf = e => { const s = e && e.dn; if (!s) return null; let m = String(s).match(/[⌀Ø](\d+)×([\d,]+)/); if (m) return (+m[1] - 2 * parseFloat(m[2].replace(',', '.'))) / 1000; m = String(s).match(/(?:DN|Ду)(\d+)/); return m ? +m[1] / 1000 : null; };
  const edgeDin = e => dnOf(e) || (e.prod === 'LZB' ? 0.1 : 0.15);
  function bendZeta(P) {
    let th = 0;
    for (let i = 1; i < P.length - 1; i++) {
      const a = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]], b = [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1], P[i + 1][2] - P[i][2]];
      const la = Math.hypot(...a), lb = Math.hypot(...b); if (la < 1e-3 || lb < 1e-3) continue;
      th += Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
    }
    return D.zeta.elbow90 * th / (Math.PI / 2);
  }
  const OVR = {};   // временное положение арматуры для подбора открытия (не меняет состояние)
  const vref = id => ({ type: VS.hydType(id), get pos() { return OVR[id] != null ? OVR[id] : VS.pos(id); } });
  function edgeSegs(e, fwd, side, prevDin) {
    if (e.k === 'valve') { const q = H.seg({ id: e.v, Din: prevDin || edgeDin(e), L: 0, valves: [vref(e.v)] }); q.vid = e.v; return [q]; }
    const chk = e.k === 'check' ? (side === 's' ? -1 : 1) : 0;
    let pcs = PF ? PF.edgeInfo(e).pieces : [];
    if (!fwd) pcs = pcs.slice().reverse().map(pc => ({ ...pc, pts: pc.pts.slice().reverse() }));
    const out = []; let din = prevDin, cond = 0;
    for (const pc of pcs) {
      const len = pc.len || 0; if (len < 1e-3 || !pc.pts || pc.pts.length < 2) continue;
      let dd = null; if (pc.kind === 'pipe' && pc.p) { dd = PF.dims(pc.p); din = dd.id; }
      const Din = dd ? dd.id : (din || edgeDin(e));
      if (pc.kind === 'gap') cond += len;
      out.push(H.seg({ id: pc.p ? pc.p.id : (pc.kind === 'gap' ? 'условно: ' + (e.n || e.id).slice(0, 30) : e.id + ' · ' + pc.kind), Din, Dn: dd ? dd.od : null, s: dd ? dd.wt : null, L: len,
        zeta: bendZeta(pc.pts) + (pc.kind === 'tap' ? D.zeta.teeBranch : 0), zA: pc.pts[0][1], zB: pc.pts[pc.pts.length - 1][1], cond: pc.kind === 'gap', check: out.length ? 0 : chk }));
    }
    if (!out.length && chk) out.push(H.seg({ id: e.id + ' · обратный клапан', Din: din || edgeDin(e), L: 0, check: chk }));
    out.cond = cond;
    return out;
  }
  function buildRoute(f) {
    const pes = f.pumps.map(p => L.E.find(e => e.k === 'pump' && e.pump === p)).filter(Boolean);
    if (!pes.length) return { why: 'нет ребра насоса' };
    const pid = f.pumps[0], def = D.pumps[pid];
    if (!def) return { why: `нет паспорта насоса ${pid}` };
    const a = pes[0].a, b = pes[0].b;
    const kids = { s: new Map(), d: new Map() }, push = (m, k, x) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(x); };
    for (const x of f.edges.values()) {
      if (x.side === 'p') continue;
      const from = x.dir === 1 ? x.e.a : x.e.b, to = x.dir === 1 ? x.e.b : x.e.a;
      if (x.side === 'd') push(kids.d, from, { e: x.e, fwd: x.dir === 1, next: to });
      else push(kids.s, to, { e: x.e, fwd: x.dir !== 1, next: from });
    }
    const meta = { cond: 0, edges: new Map(), leaves: [], undefinedB: [], disValves: [], pipes: { s: new Set(), d: new Set() } };
    let nb = 0;
    function leafNode(k, side, br, din) {
      const bd = boundary(k);
      if (!bd) { meta.undefinedB.push(k); return { kind: 'free', id: k, zOut: 1e4 }; }   // граница не определена — расход в эту ветвь не идёт
      const dv = Object.assign({}, DEV[k] || (side === 's' ? { inlet: 1 } : { outlet: 1 }));
      br.segs.push(H.seg({ id: `${L.N[k].n.split(' (')[0]}: ${Object.keys(dv).map(q => DEVN[q]).join(', ')}`, Din: din, L: 0, fittings: dv }));
      meta.leaves.push(k);
      return bd.kind === 'free' ? { kind: 'free', id: k, zOut: bd.z } : { kind: 'tank', id: k, zSurf: bd.z };
    }
    function mkBranch(c, side) {
      const br = { id: 'b' + (++nb), segs: [], to: null, edges: [] };
      let cur = c, din = null;
      for (let guard = 0; guard < 400; guard++) {
        br.edges.push(cur.e.id); meta.edges.set(cur.e.id, br.id);
        const ss = edgeSegs(cur.e, cur.fwd, side, din); meta.cond += ss.cond || 0;
        for (const q of ss) { br.segs.push(q); din = q.Din; if (q.vid && side === 'd') meta.disValves.push(q.vid); if (q.Dn && q.L > 0.2 && !q.cond) meta.pipes[side].add(q.id); }
        const nk = cur.next;
        if (L.TERM.has(nk)) { br.to = leafNode(nk, side, br, din || 0.1); break; }
        const ch = (side === 'd' ? kids.d : kids.s).get(nk) || [];
        if (ch.length === 1) { cur = ch[0]; continue; }
        br.to = { kind: 'junction', branches: ch.map(x => mkBranch(x, side)) };
        break;
      }
      return br;
    }
    const firstDin = br => { for (const q of br.segs) if (q.L > 0) return q.Din; return 0.1; };
    function root(nodeK, side) {
      let inner, din = 0.1;
      if (L.TERM.has(nodeK)) { const br0 = { id: 'b' + (++nb), segs: [], to: null, edges: [] }; br0.to = leafNode(nodeK, side, br0, 0.05); inner = { kind: 'junction', branches: [br0] }; din = 0.05; }
      else { const brs = ((side === 'd' ? kids.d : kids.s).get(nodeK) || []).map(x => mkBranch(x, side)); inner = { kind: 'junction', branches: brs }; if (brs.length) din = firstDin(brs[0]); }
      return { inner, din };
    }
    const R0s = root(a, 's'), R0d = root(b, 'd');
    const pp = L.pts3(pes[0]); let zMin = Infinity, zMax = -Infinity; for (const p of pp) { zMin = Math.min(zMin, p.y); zMax = Math.max(zMax, p.y); }
    const zAx = zMin, zPIS = zMax + 0.27;
    const isTRK = pid === 'ТРК-1';
    const locS = H.seg({ id: `фильтр всаса ${pid}`, Din: R0s.din, L: 0.6, fittings: isTRK ? {} : { filter: 1 }, zA: zAx, zB: zAx });
    const locD = H.seg({ id: `обратный клапан ${pid}`, Din: R0d.din, L: 0.6, fittings: isTRK ? {} : { check: 1 }, check: !isTRK, zA: zAx, zB: zAx });
    const suction = { kind: 'junction', branches: [{ id: 'вс-' + pid, segs: [locS], to: R0s.inner }] };
    const discharge = { kind: 'junction', branches: [{ id: 'нг-' + pid, segs: [locD], to: R0d.inner }] };
    const sv = PS.V[NVK[f.srcs[0]]], prod = (sv && sv.prod) || 'L';
    const sp = f.pumps.map(p => PSM.speed(p)), s = sp.reduce((x, y) => x + y, 0) / sp.length;
    return { route: { fluid: FLC[prod] || 'DTL', T: cfg.T, pump: { id: pid, s, n: f.pumps.length, z: zAx, zPIS, zPI: zAx + 0.2 }, suction, discharge }, meta, pid, prod };
  }
  const nomQ = f => f.pumps.reduce((q, p) => { const x = L.PU[p].Q; return q + (typeof x === 'number' ? x : p === 'ТРК-1' ? 3.0 : 0); }, 0);
  function hydFlow(f) {
    if (f.Q0 == null) f.Q0 = f.Q;
    let B = null, res = null, why = null;
    try {
      B = buildRoute(f);
      if (B.why) why = B.why;
      else if (f.sinks.every(k => B.meta.undefinedB.includes(k)) || f.srcs.every(k => B.meta.undefinedB.includes(k))) why = `граничное условие не определено (${[...new Set(B.meta.undefinedB)].map(k => L.N[k].n.split(' (')[0]).join(', ')}): давление в существующем трубопроводе неизвестно`;
      else res = H.solveRoute(B.route);
    } catch (e) { console.error('HYDX: расчёт', e); why = 'ошибка расчёта: ' + e.message; }
    const sAvg = f.pumps.reduce((x, p) => x + PSM.speed(p), 0) / f.pumps.length;
    if (!res) {
      f.Q = Math.max(0.001, f.Q0 * Math.max(0.01, sAvg));
      f.hyd = { fallback: true, why, s: sAvg };
      for (const x of f.edges.values()) { if (x.q0 == null) x.q0 = x.q; x.q = x.q0 * Math.max(0.01, sAvg); }
      f.shS = f.shD = null;
      return f.hyd;
    }
    const both = [...B.meta.pipes.s].filter(q => B.meta.pipes.d.has(q));
    if (both.length) res.warnings.push({ code: 'PIPE_BOTH', level: 2, text: `Сопоставление графа ТП с трубами: ${both.slice(0, 5).join(', ')}${both.length > 5 ? ' и др.' : ''} учтены и на всасе, и на нагнетании — потери в обвязке цеха 200 недостоверны (замечание P54, проверить по 200-ТХ-002)` });
    f.hyd = { res, meta: B.meta, pid: B.pid, prod: B.prod, route: B.route, t: S.t, s: sAvg };
    f.Q = Math.max(0, res.Q);
    // доли источников и приёмников, расход по рёбрам графа
    const lq = {}; for (const b of res.branches) if (b.leaf) lq[b.leaf] = (lq[b.leaf] || 0) + b.Q;
    const share = (keys, sgn) => { const q = keys.map(k => Math.max(0, sgn * (lq[k] || 0))), t = q.reduce((x, y) => x + y, 0); return t > 1e-6 ? q.map(x => x / t) : null; };
    f.shS = share(f.srcs, -1); f.shD = share(f.sinks, 1);
    const bq = {}; for (const b of res.branches) bq[b.id] = Math.abs(b.Q);
    for (const x of f.edges.values()) {
      if (x.q0 == null) x.q0 = x.q;
      if (x.side === 'p') { x.q = Math.max(1e-6, res.Qpump / f.pumps.length); continue; }
      const bid = B.meta.edges.get(x.e.id); x.q = Math.max(1e-6, bid ? bq[bid] || 0 : f.Q);
    }
    return f.hyd;
  }
  /* Подбор открытия ближайшей задвижки на нагнетании, при котором подача = номинальной (дросселирование, как при пуске
     центробежного насоса на прикрытую задвижку). Расчёт на копии положений — состояние арматуры не меняется. */
  function throttleFor(f) {
    const y = f.hyd; if (!y || y.fallback) return null;
    const def = D.pumps[y.pid]; if (!def || def.type !== 'cf') return null;
    const vid = y.meta.disValves.find(v => VS.get(v) && !VS.get(v).jam); if (!vid) return null;
    const Qt = def.Qn * f.pumps.length * Math.max(0.01, y.s);
    const qAt = p => { OVR[vid] = p; try { return H.solveRoute(y.route).Q; } finally { delete OVR[vid]; } };
    if (qAt(1) <= Qt * 1.02) return null;
    let a = 0.02, b = 1;
    if (qAt(a) > Qt) return null;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (qAt(m) > Qt) b = m; else a = m; }
    return { vid, pos: Math.round((a + b) / 2 * 100) / 100, Qt };
  }
  function throttleNow(pid) {
    const f = flowOf(pid); if (!f) return;
    const t = throttleFor(f);
    if (!t) { L.emit('Подбор открытия не требуется или невозможен (нет задвижки на нагнетании / подача не выше номинальной).', 'info'); return; }
    PS.log(`${pid}: вывод на номинальную подачу ${fmt(t.Qt, 0)} м³/ч — прикрыть ${t.vid} до ≈ ${Math.round(t.pos * 100)} % (расчёт).`);
    valveTo(t.vid, t.pos);
  }
  // перерасчёт при сборке потоков (procSim: после computeFlows)
  const FV = PS.flowViz, build0 = FV.build;
  FV.build = function (flows) {
    try { for (const f of flows) { hydFlow(f); f.visQ = f.Q; } } catch (e) { console.error('HYDX:', e); }
    return build0.call(this, flows);
  };
  function updateHyd() {
    let rebuild = false;
    for (const f of S.flows) {
      if (!f.pumps.some(p => L.st.pump[p])) continue;
      hydFlow(f);
      const a = f.Q, b = f.visQ || 0;
      if (Math.abs(a - b) > Math.max(0.3, 0.08 * Math.max(a, b))) rebuild = true;
    }
    if (rebuild) PS.dirty = true;
  }

  /* ---------- 5. Такт ---------- */
  const tick0 = PS.tick;
  let hydT = 0, cardT = 0;
  PS.tick = (now, dtReal) => {
    try {
      const dtm = Math.min(dtReal || 0, 0.25) * S.speed;
      reconcile();
      if (dtm > 0) {
        const ve = VS.tick(dtm), pe = PSM.tick(dtm);
        const ch = applyValves();
        if (ve.length) onValveEvents(ve);
        if (pe.length) { onPumpEvents(pe); kick(); }
        if (ch || ve.length) kick();
      }
      const ramp = Object.values(PSM.p).some(x => x.state === 'start' || (x.kind === 'vfd' && x.state === 'run' && Math.abs(x.s - x.sp) > 1e-6));
      if (kickF || now - hydT > 500 || (ramp && now - hydT > 120)) { hydT = now; kickF = false; updateHyd(); }
      if ((anyMoving() || ramp) && now - cardT > 450) {
        cardT = now;
        if (typeof curSel !== 'undefined' && curSel && (curSel.proc || Object.values(L.PU).some(p => p.mesh && p.mesh === curSel.id))) select(curSel);
        if (procP.style.display === 'flex' && prTab === 'routes') for (const el of prDet.querySelectorAll('[data-hxv]')) { const x = VS.get(el.dataset.hxv); if (!x) continue; const st = x.jam ? 'jammed' : x.state; el.style.color = STC[st]; el.textContent = st === 'open' || st === 'closed' ? '' : ` · ${VS.label(el.dataset.hxv)} ${pct(el.dataset.hxv)} %`; }
      }
    } catch (e) { console.error('HYDX: такт', e); }
    return tick0(now, dtReal);
  };

  /* ---------- 6. Интерфейс ---------- */
  const STC = { closed: '#b02a2a', open: '#1f7a3d', opening: '#b07a00', closing: '#b07a00', stopped: '#1d4e7a', jammed: '#b02a2a' };
  function vtag(id) {
    const x = VS.get(id); if (!x) return '';
    const st = x.jam ? 'jammed' : x.state;
    const t = st === 'open' || st === 'closed' ? '' : ` · ${VS.label(id)} ${pct(id)} %`;
    return ` <span class="hxv" data-hxv="${id}" style="color:${STC[st]};font-weight:600">${t}</span>`;
  }
  const btn = (attrs, txt, cls = '') => `<button class="pbtn ${cls}" ${attrs}>${txt}</button>`;
  function valveCard(id) {
    const v = L.V[id], x = VS.get(id), st = x.jam ? 'jammed' : x.state;
    const big = st === 'open' ? 'ОТКРЫТА' : st === 'closed' ? 'ЗАКРЫТА' : VS.label(id).toUpperCase() + ' · ' + pct(id) + ' %';
    const on = st !== 'closed';
    let h = `<div class="n">${VTYP[v.typ] || v.typ}${v.tag ? ' · ' + v.tag : ''}. Положение: ${SRCN[v.src] || v.src}.</div>` + (v.note ? `<div class="n">${v.note}</div>` : '') +
      `<div class="pst ${on ? 'on' : 'off'}">Состояние (модель): <b>${big}</b></div>` +
      (/^N[1-5]$/.test(id) ? `<div class="n">По 177-ТХ.С-001-0 и ОЛ-004 — кран шаровой DN150 с приводом Biffi; в графе АК-004 обозначен как электрозадвижка.</div>` : '') +
      `<div class="n">Ход: ${KIND_N[x.kind]}, полный ход ${Math.round(x.travel)} с модельного времени — <i>условно</i> (паспорта привода нет). ` +
      `Положение ${pct(id)} %; ζ = ${isFinite(H.valveZeta(VS.hydType(id), x.pos)) ? fmt(H.valveZeta(VS.hydType(id), x.pos), 2) : '∞'} (справочно, ${VS.hydType(id) === 'ball' ? 'кран' : 'задвижка'}). ` +
      `Маршрут собирается только из полностью открытой арматуры; при закрытии в ходе продукт идёт, пока арматура не закрылась.</div>`;
    h += `<div class="pbar">` + (isMoving(id) ? btn(`data-hv="stop" data-id="${id}"`, 'Стоп', 'red') : '') +
      btn(`data-hv="open" data-id="${id}"`, 'Открыть', 'grn') + btn(`data-hv="close" data-id="${id}"`, 'Закрыть', 'red') + `</div>` +
      `<div class="pbar"><span class="n" style="margin:0 6px 0 0">Открытие:</span>` + [10, 25, 50, 75].map(p => btn(`data-hv="to" data-id="${id}" data-pos="${p / 100}"`, p + ' %', 'sm')).join('') + `</div>`;
    return h;
  }
  const PSTC = { stop: 'off', start: 'on', run: 'on', stopping: 'off', fault: 'off', na: 'off' };
  function flowOf(pid) { return S.flows.find(f => f.pumps.includes(pid) && L.st.pump[pid]); }
  function pumpExtra(pid) {
    const x = PSM.get(pid), def = D.pumps[pid]; if (!x) return '';
    let h = `<div class="pst ${PSTC[x.state]}">Состояние агрегата: <b>${PSM.label(pid).toUpperCase()}</b>${x.s > 0 && x.s < 0.999 ? ` · ${Math.round(x.s * 100)} % оборотов` : ''}${x.reason && (x.state === 'fault' || x.state === 'na' || x.state === 'stopping') ? ` · ${x.reason}` : ''}</div>`;
    if (x.kind === 'vfd') h += `<div class="pbar"><span class="n" style="margin:0 6px 0 0">Частота ЧП (задание ${Math.round(x.sp * 50)} Гц):</span>` + [15, 25, 35, 45, 50].map(hz => btn(`data-hp="spd" data-id="${pid}" data-f="${hz / 50}"`, hz + ' Гц', 'sm' + (Math.abs(x.sp * 50 - hz) < 0.5 ? ' grn' : ''))).join('') + `</div>` +
      `<div class="n">Алгоритм регулирования ЧП (поддержание давления/расхода) в документах не указан — частота задаётся вручную; характеристика — по законам подобия (условно).</div>`;
    if (def) h += `<div class="n">Характеристика H(Q) в модели: через паспортную точку АК-004 (${def.Qn} м³/ч; ${def.Hn != null ? def.Hn + ' м' : 'объёмный'})` +
      (def.type === 'cf' ? `; напор при закрытой задвижке H0 = 1,2·Hн = ${fmt(1.2 * def.Hn, 1)} м — по расчёту СППК проекта (давление 1,2·ρ·g·Hн при ρ = 850 кг/м³); рабочая часть до 1,3·Qн. Кривой изготовителя нет — <i>условно</i>.` : '; объёмный насос — подача не зависит от сети, ограничение давления — СППК.') +
      (def.Pset ? ` СППК на байпасе: настройка ${fmt(def.Pset, 3)} МПа.` : '') + `</div>`;
    const f = flowOf(pid);
    if (f && f.hyd) h += `<div class="n"><b>Расчёт сейчас:</b> ${liveText(f)}</div>`;
    return h;
  }
  const sWhy = f => f.pumps.some(p => PSM.get(p).state === 'start') ? 'разгон' : 'частота ЧП, подобие Q ~ n';
  function liveText(f) {
    const y = f.hyd; if (!y) return '';
    if (y.fallback) return `гидравлический расчёт не выполнен — ${y.why}; подача номинальная${y.s < 0.999 ? ' × ' + Math.round(y.s * 100) + ' % (' + sWhy(f) + ')' : ''}.`;
    const r = y.res;
    return `Q = ${fmt(r.Q, 1)} м³/ч, H = ${fmt(r.Hpump, 1)} м, PIS = ${fmt(r.PIS, 3)} МПа, NPSHa = ${fmt(r.NPSHa, 1)} м.`;
  }
  const MODE = { ok: 'работа на сеть', relief: 'открыт СППК (перепуск на всас)', shutoff: 'работа на закрытую задвижку', no_suction: 'нет всасывания', cavitation: 'кавитация', stopped: 'остановлен', blocked: 'заблокирован' };
  function liveHTML(f) {
    const y = f && f.hyd; if (!y) return '';
    if (y.fallback) return `<div class="mt" style="color:#8a5a00">Гидравлика: расчёт не выполнен — ${y.why}. Подача — номинальная${y.s < 0.999 ? ` × ${Math.round(y.s * 100)} % (${sWhy(f)})` : ''}.</div>`;
    const r = y.res, def = D.pumps[y.pid] || {};
    const sl = r.segs.filter(q => q.side === 'suc').reduce((a, q) => a + q.hf, 0), dl = r.segs.filter(q => q.side === 'dis').reduce((a, q) => a + q.hf, 0);
    const piB = r.segs.find(q => q.id === 'фильтр всаса ' + y.pid);
    const row = (n, v, i) => `<div><span>${n}</span><b>${v}</b>${i ? `<i>${i}</i>` : ''}</div>`;
    let h = `<div class="oc" style="grid-column:1/-1;margin-top:6px">Гидравлика маршрута (расчёт — модельные данные)</div>` +
      row('Режим насоса', MODE[r.status] || r.status, (r.nPumps > 1 ? r.nPumps + ' насоса в параллель · ' : '') + (y.s < 0.999 ? `обороты ${Math.round(y.s * 100)} % (${sWhy(f)})` : '')) +
      row('Подача расчётная', `${fmt(r.Q, r.Q < 10 ? 2 : 1)} м³/ч`, `паспорт ${def.Qn != null ? def.Qn : '—'} м³/ч${r.Qbypass > 0.01 ? ` · перепуск СППК ${fmt(r.Qbypass, 1)} м³/ч` : ''}`) +
      row('Напор насоса', `${fmt(r.Hpump, 1)} м`, def.Hn != null ? `паспорт ${def.Hn} м` : '') +
      row('PIS (нагнетание)', `${fmt(r.PIS, 3)} МПа`, def.PISnom != null ? `Рном/Рmax АК-004: ${fmt(def.PISnom, 2)}/${fmt(def.PISmax, 2)}` : '') +
      row('PI всас (до / после фильтра)', piB && piB.pB != null ? `${fmt(piB.pB, 3)} / ${fmt(piB.pA, 3)} МПа` : `${fmt(r.PI, 3)} МПа`, r.PI < 0 ? 'разрежение' : '') +
      row('NPSHa (располагаемый)', `${fmt(r.NPSHa, 1)} м`, 'требуемый — по паспорту насоса (нет данных)') +
      row('Потери: всас / нагнетание', `${fmt(sl, 2)} / ${fmt(dl, 2)} м`, `T = ${fmt(cfg.T, 0)} °C, ρ = ${fmt(r.fluid.rho, 0)} кг/м³, ν = ${fmt(r.fluid.nu * 1e6, 2)} мм²/с`) +
      row('Скорость max: всас / нагнетание', `${fmt(r.vmaxSuction || 0, 2)} / ${fmt(r.vmaxDischarge || 0, 2)} м/с`, y.meta.cond > 0.05 ? `условные участки ${fmt(y.meta.cond, 1)} м — Ø по соседней трубе` : '');
    if (r.warnings.length) h += `<div class="mt" style="color:#8a3a00">${r.warnings.map(w => '⚠ ' + w.text).join('<br>')}</div>`;
    if (r.warnings.some(w => w.code === 'RIGHT_OF_CURVE') && y.meta.disValves.length) h += `<div class="pbar" style="grid-column:1/-1">${btn(`data-hp="thr" data-id="${y.pid}"`, 'Вывести на номинальную подачу (прикрыть задвижку на нагнетании)', 'sm')}</div>`;
    if (y.meta.leaves.some(k => /^USN|^UPVS|^UNZH|^ASN|^KOT|^DES|^TRK/.test(k))) h += `<div class="mt">Граничные условия: ${[...new Set(y.meta.leaves)].filter(k => BSRC[k]).map(k => `${L.N[k].n.split(' (')[0]} — ${BSRC[k]}`).join('; ')}.</div>`;
    return h;
  }
  function modelUI(box) {
    const d = D, z = d.zeta;
    const fl = Object.entries(d.fluids).map(([k, f]) => { const a = H.fluidAt(k, cfg.T); return `<tr><td>${f.name}</td><td class="r">${fmt(a.rho, 0)}</td><td class="r">${fmt(a.nu * 1e6, 2)}</td><td class="r">${fmt(a.pv / 1000, 1)}</td></tr>`; }).join('');
    const pu = Object.entries(d.pumps).map(([k, p]) => `<tr><td>${k}</td><td>${p.model}</td><td class="r">${p.Qn}</td><td class="r">${p.Hn == null ? '—' : p.Hn}</td><td class="r">${p.Pset == null ? '—' : fmt(p.Pset, 3)}</td></tr>`).join('');
    const tv = d.timing.valve;
    const html = `<div class="oc">Гидравлика, насосы, арматура</div>` +
      `<label class="chk">Температура продукта, °C <input type="number" id="hxT" min="-40" max="45" step="1" value="${cfg.T}" style="width:64px"></label>` +
      `<div class="rn">Подача — рабочая точка насоса на сети: потери по Дарси–Вейсбаху (λ — Свами–Джейн, шероховатость ${fmt(d.roughness.value * 1000, 1)} мм), длины, Dвн и повороты — по физическим трубам модели сети (PFLOW), перепад отметок — по 3D, уровни — модельные. ` +
      `На каждом насосе — фильтр на всасе и обратный клапан на нагнетании, на байпасе — СППК (АК-004). Все значения ниже — <b>модельные (PROVISIONAL)</b>, кроме паспортных точек насосов и настроек СППК.</div>` +
      `<details class="pfp"><summary><b>Допущения расчёта</b></summary>` +
      `<table class="pft"><tr><th>Продукт (при T)</th><th class="r">ρ, кг/м³</th><th class="r">ν, мм²/с</th><th class="r">pv, кПа</th></tr>${fl}</table>` +
      `<div class="rn">${Object.values(d.fluids).map(f => f.name + ': ' + f.src).join('<br>')}</div>` +
      `<table class="pft"><tr><th>Насос</th><th>Марка</th><th class="r">Qн</th><th class="r">Hн</th><th class="r">СППК, МПа</th></tr>${pu}</table>` +
      `<div class="rn">${d.pumpsSrc}. Форма H(Q): ${d.curve.src}. Проверка: давления расчёта СППК проекта (0,40 / 0,35 / 0,51 / 0,60 МПа) = 1,2·ρ·g·Hн при ρ = 850 кг/м³, настройки СППК = 1,1 × расчётного — т. е. H0 = 1,2·Hн согласуется с документацией.</div>` +
      `<div class="rn">Местные сопротивления (справочно): отвод 90° ${z.elbow90}; тройник проход/ответвление ${z.teeRun}/${z.teeBranch}; задвижка открытая ${z.gateOpen}; кран ${z.ballOpen}; обратный клапан ${z.check}; фильтр ${z.filter}; расходомер ${z.meter}; шарнирное устройство (УСН/УНЖ/АСН) ${z.usn}; вход ${z.inlet}; выход ${z.outlet}. Повороты — по геометрии трассы (ζ отвода × суммарный угол / 90°). ${d.zetaSrc}.</div>` +
      `<div class="rn">Время хода, с (модельное время): задвижки с электроприводом ${tv.gate_e}; краны N1–N5 ${tv.ball_e}; КО ${tv.ko}; клапан «СЕНС» ${tv.sol}; ручные задвижки ${tv.gate_m}; ручные краны ${tv.ball_m}. Насосы: разгон/выбег ${d.timing.pump.dol.acc}/${d.timing.pump.dol.dec} с; ЧП Н-1/Н-2 ${d.timing.pump.vfd.acc}/${d.timing.pump.vfd.dec} с. ${d.timing.src}.</div>` +
      `<div class="rn">Не моделируется: гидроудар, заполнение пустых трасс и вытеснение воздуха, самовсасывание ВКс, подача при выбеге насоса, течение самотёком между ёмкостями при остановленных насосах; давление в существующем трубопроводе ЛСЦ неизвестно — для М8 подача номинальная (по частоте ЧП).</div>` +
      `</details>`;
    const div = document.createElement('div'); div.innerHTML = html;
    const logH = [...box.querySelectorAll('.oc')].find(x => /Журнал/.test(x.textContent));
    if (logH) box.insertBefore(div, logH); else box.appendChild(div);
    const t = div.querySelector('#hxT');
    t.onkeydown = e => e.stopPropagation();
    t.onchange = () => { const x = Math.max(-40, Math.min(45, parseFloat(String(t.value).replace(',', '.')) || 20)); cfg.T = x; PS.log(`Температура продукта (модель): ${fmt(x, 0)} °C.`); kick(); PS.renderModel(true); };
  }
  // кнопки
  function onClick(ev) {
    const b = ev.target.closest('[data-hv],[data-hp]'); if (!b) return;
    ev.stopPropagation();
    const id = b.dataset.id;
    if (b.dataset.hv === 'open') L.setValve(id, true);
    else if (b.dataset.hv === 'close') L.setValve(id, false);
    else if (b.dataset.hv === 'stop') valveStop(id);
    else if (b.dataset.hv === 'to') valveTo(id, +b.dataset.pos);
    else if (b.dataset.hp === 'spd') setSpeed(id, +b.dataset.f);
    else if (b.dataset.hp === 'thr') throttleNow(id);
  }
  document.getElementById('info').addEventListener('click', onClick, true);
  prDet.addEventListener('click', onClick, true);
  // карточки: арматура — заменена, насос — дополнена
  const card0 = procCardHTML;
  procCardHTML = o => {
    try {
      if (o && o.proc && o.proc.k === 'valve' && VS.get(o.proc.id)) return valveCard(o.proc.id);
      const h = card0(o);
      const pid = o && o.proc && o.proc.k === 'pump' ? o.proc.id : Object.keys(L.PU).find(k => L.PU[k].mesh && L.PU[k].mesh === (o && o.id));
      return pid && h ? h + pumpExtra(pid) : h;
    } catch (e) { console.error('HYDX: карточка', e); return card0(o); }
  };
  // манометры цеха: показания по расчёту
  window.__HYDG = (g, on) => {
    if (!on) return 0;
    const f = flowOf(g.pid); if (!f || !f.hyd || f.hyd.fallback) return g.isS ? g.val : (g.before ? 0.020 : 0.016) * Math.max(0.05, PSM.speed(g.pid));
    const r = f.hyd.res;
    let val;
    if (g.isS) val = r.PIS;
    else { const s = r.segs.find(q => q.id === 'фильтр всаса ' + g.pid); val = s && s.pB != null ? (g.before ? s.pB : s.pA) : r.PI; }
    g.hv = val;
    return Math.max(0, Math.min(g.max * 1.05, isFinite(val) ? val : 0));
  };

  const api = { H, VS, PSM, cfg, throttleFor, throttleNow, vtag, valveCard, pumpExtra, liveHTML, modelUI, valveTo, valveStop, setSpeed, hydFlow, buildRoute, boundary, get group() { return group; } };
  window.__HYDX = api;
  return api;
})();

