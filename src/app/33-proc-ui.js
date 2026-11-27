const PROC_LBL = [];   // HTML-подписи N1…N8, КО, СЕНС
const procPulse = [];  // мигающие индикаторы закрытой арматуры на выбранном маршруте
const procPickObj = {};
{
  const L = procLogic, ph = PH.geo.outer;
  const inPH = (x, z) => inPoly(x, z, ph);
  const procY = (x, z) => (inPH(x, z) || (x > -60.8 && x < -60.45 && z > 20.5 && z < 31.5)) ? phY(Math.min(x, -60.62), z) : hAt(x, z) + 0.6;   // v0.29: по отметке трубы цеха (и узлы выходов у стены)
  L.procY = procY;
  for (const N of Object.values(L.N)) if (N.wall && N.y == null) N.y = procY(N.p[0], N.p[1]);   // v0.29: узлы выходов у стены — на отметке выхода (200-ТХ-003)
  const pts3 = e => {
    if (e._p3) return e._p3;
    const P = e.pts, out = [], yOf = q => q.length > 2 ? q[2] : procY(q[0], q[1]);
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      if (i > 0) {
        const p = P[i - 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(len / 2.5));
        for (let k = 1; k < n; k++) {
          const t = k / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
          const y = (p.length > 2 || q.length > 2) ? yOf(p) + (yOf(q) - yOf(p)) * t : procY(x, z);
          out.push(new THREE.Vector3(x, y, z));
        }
      }
      out.push(new THREE.Vector3(q[0], yOf(q), q[1]));
    }
    return (e._p3 = out);
  };
  L.pts3 = pts3;
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), up = new THREE.Vector3(0, 1, 0);
  const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
  const segMatrix = (a, b, r) => {
    _d.subVectors(b, a); const len = _d.length(); if (len < 0.005) return null;
    _q.setFromUnitVectors(up, _d.multiplyScalar(1 / len));
    return _m.compose(_c.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(r, len + 0.01, r));
  };
  L.segMatrix = segMatrix; L.cyl = cyl;

  /* Базовый слой: «рукава» по технологическим линиям, по цвету продукта; условные трассы — бледнее */
  const groups = {};
  for (const e of L.E) {
    if (e.k === 'valve') continue;
    const key = (e.k === 'pump' ? 'P' : e.prod) + (e.cond ? 'c' : '');
    (groups[key] = groups[key] || []).push(e);
  }
  for (const [key, list] of Object.entries(groups)) {
    const cond = key.endsWith('c'), pk = key.replace('c', ''), col = pk === 'P' ? 0xd13b3b : (PROD[pk] || PROD.LZB).c;
    const segs = [];
    for (const e of list) { const p = pts3(e); for (let i = 1; i < p.length; i++) segs.push([p[i - 1], p[i], e]); }
    const m = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: cond ? 0.28 : 0.42, depthWrite: false, roughness: 0.5, emissive: col, emissiveIntensity: 0.15 });
    const im = new THREE.InstancedMesh(cyl, m, segs.length), map = [];
    let n = 0;
    for (const [a, b, e] of segs) { const mm = segMatrix(a, b, e.k === 'pump' ? 0.09 : 0.125); if (!mm) continue; im.setMatrixAt(n, mm); map[n++] = e; }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.renderOrder = 2;
    im.userData.pick = h => procEdgeObj(map[h.instanceId]);
    pickables.push(im); procNet.add(im);
  }

  /* Маркеры арматуры */
  const gBody = new THREE.CylinderGeometry(0.13, 0.13, 0.36, 14), gFl = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), gStem = new THREE.CylinderGeometry(0.022, 0.022, 0.4, 6);
  const gWheel = new THREE.TorusGeometry(0.15, 0.022, 6, 18), gAct = new THREE.BoxGeometry(0.26, 0.3, 0.22), gSol = new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12);
  const gInd = new THREE.SphereGeometry(0.11, 14, 10), gHalo = new THREE.TorusGeometry(0.26, 0.035, 8, 24);
  const mBody = M(0x30363c, { metalness: 0.5, roughness: 0.45 }), mWheel = M(0xc0392b, { roughness: 0.5 }), mAct = M(0x3f6f99, { metalness: 0.3 }), mSol = M(0xd8b02a);
  const mOpen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.8 }), mClosed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 });
  L.mats = { mOpen, mClosed };
  const vMesh = {};
  const nodePos = k => L.N[k].p;
  const parts = {};   // геометрия|материал -> {geo, mat, mats:[], ids:[]}
  const part = (key, geo, mat) => parts[key] || (parts[key] = { geo, mat, mats: [], ids: [] });
  const mInd = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const indIds = [], indMats = [];
  const _e = new THREE.Euler(), _qq = new THREE.Quaternion(), _one = new THREE.Vector3(1, 1, 1), _pp = new THREE.Vector3();
  const local = (x, y, z, rx = 0, rz = 0) => new THREE.Matrix4().compose(_pp.set(x, y, z), _qq.setFromEuler(_e.set(rx, 0, rz)), _one);
  for (const [vid, v] of Object.entries(L.V)) {
    if (RVSD.ind[vid]) {   // этап 6.1: у РВС-109 задвижки показаны детально — здесь только индикатор
      const p = RVSD.ind[vid], indM = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]); if (p[3]) indM.scale(new THREE.Vector3(p[3], p[3], p[3]));
      indIds.push(vid); indMats.push(indM);
      const halo = new THREE.Mesh(gHalo, mClosed); halo.rotation.x = Math.PI / 2; halo.position.set(p[0], p[1], p[2]); halo.visible = false; procVal.add(halo);
      vMesh[vid] = { idx: indIds.length - 1, halo };
      continue;
    }
    const e = L.E.find(x => x.id === v.e);
    // направление трубы: по соседнему участку
    let dir = new THREE.Vector3(1, 0, 0);
    for (const n of [e.a, e.b]) {
      const nb = L.E.find(x => x !== e && x.k !== 'valve' && (x.a === n || x.b === n));
      if (nb) { const p = pts3(nb), np = nodePos(n); let best = null, bd = 1e9; for (let i = 1; i < p.length; i++) { const mx = (p[i].x + p[i - 1].x) / 2, mz = (p[i].z + p[i - 1].z) / 2, d = Math.hypot(mx - np[0], mz - np[1]); if (d < bd && p[i].distanceTo(p[i - 1]) > 0.01) { bd = d; best = [p[i - 1], p[i]]; } } if (best) { dir.subVectors(best[1], best[0]); dir.y = 0; if (dir.lengthSq() > 1e-6) { dir.normalize(); break; } dir.set(1, 0, 0); } }
    }
    const y = v.y !== undefined ? v.y : procY(v.p[0], v.p[1]);
    const base = new THREE.Matrix4().compose(_pp.set(v.p[0], y, v.p[1]), _qq.setFromEuler(_e.set(0, Math.atan2(-dir.z, dir.x), 0)), _one);
    const put = (key, geo, mat, lm) => { const P = part(key, geo, mat); P.mats.push(new THREE.Matrix4().multiplyMatrices(base, lm)); P.ids.push(vid); };
    put('body', gBody, mBody, local(0, 0, 0, 0, Math.PI / 2));
    put('fl', gFl, mBody, local(-0.19, 0, 0, 0, Math.PI / 2)); put('fl', gFl, mBody, local(0.19, 0, 0, 0, Math.PI / 2));
    let top;
    if (v.typ === 'М') { put('stem', gStem, mBody, local(0, 0.22, 0)); put('act', gAct, mAct, local(0, 0.5, 0)); top = 0.68; }
    else if (v.typ === 'руч') { put('stem', gStem, mBody, local(0, 0.25, 0)); put('wheel', gWheel, mWheel, local(0, 0.45, 0, Math.PI / 2)); top = 0.5; }
    else { put('stem', gStem, mBody, local(0, 0.2, 0)); put('sol', gSol, mSol, local(0, 0.4, 0)); top = 0.54; }
    const indM = new THREE.Matrix4().multiplyMatrices(base, local(0, top + 0.13, 0));
    indIds.push(vid); indMats.push(indM);
    const halo = new THREE.Mesh(gHalo, mClosed); halo.rotation.x = Math.PI / 2; halo.position.setFromMatrixPosition(indM); halo.visible = false; procVal.add(halo);
    vMesh[vid] = { idx: indIds.length - 1, halo };
    if (v.lbl) {
      const o = procValveObj(vid), el = document.createElement('div'); el.className = 'lb v'; el.textContent = vid; el.onclick = () => select(o);
      labelsEl.appendChild(el); PROC_LBL.push({ el, pos: new THREE.Vector3(v.p[0], y + top + 0.5, v.p[1]), grp: procVal });
    }
  }
  for (const P of Object.values(parts)) {
    const im = new THREE.InstancedMesh(P.geo, P.mat, P.mats.length);
    P.mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true;
    im.userData.pick = h => procValveObj(P.ids[h.instanceId]); pickables.push(im); procVal.add(im);
  }
  const indIM = new THREE.InstancedMesh(gInd, mInd, indMats.length);
  indMats.forEach((m, i) => { indIM.setMatrixAt(i, m); indIM.setColorAt(i, new THREE.Color(0xef4444)); });
  indIM.userData.pick = h => procValveObj(indIds[h.instanceId]); pickables.push(indIM); procVal.add(indIM);
  L.indIM = indIM;
  L.vMesh = vMesh;

  /* Индикаторы состояния насосов */
  const gRing = new THREE.TorusGeometry(0.42, 0.06, 8, 28), mStop = new THREE.MeshStandardMaterial({ color: 0x8a949c, emissive: 0x30363c, emissiveIntensity: 0.4 });
  L.mats.mStop = mStop;
  const pRing = {};
  for (const [pid, p] of Object.entries(L.PU)) {
    let pos = null;
    if (p.mesh) { const ph = PH.pumps.find(q => q[5] === p.mesh); if (PHX.ringPos[p.mesh]) pos = PHX.ringPos[p.mesh]; else if (ph) pos = [(ph[0] + ph[2]) / 2, PH_F1 + 1.55, (ph[1] + ph[3]) / 2]; }
    else if (pid === 'ТРК-1') { const n = L.N.TRK; pos = [n.p[0], hAt(n.p[0], n.p[1]) + 2.6, n.p[1]]; }
    if (!pos) continue;
    const r = new THREE.Mesh(gRing, mStop); r.rotation.x = Math.PI / 2; r.position.set(...pos); if (p.mesh && PHX.ringPos[p.mesh]) r.scale.setScalar(0.55); r.userData.o = procPumpObj(pid); pickables.push(r); procVal.add(r); pRing[pid] = r;
  }
  L.pRing = pRing;

  /* Флажки расхождений */
  const fM = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const f of PROC.flags) {
    const o = { id: '!', net: 1, name: 'Расхождение: ' + f.n, note: f.note };
    const x = f.p[0], z = f.p[1], y = hAt(x, z) + f.y;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), fM); s.position.set(x, y, z); s.userData.o = o; pickables.push(s); procFlag.add(s);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, f.y, 6), fM); st.position.set(x, y - f.y / 2, z); procFlag.add(st);
    const el = document.createElement('div'); el.className = 'lb f'; el.textContent = '! ' + f.n; el.onclick = () => select(o);
    labelsEl.appendChild(el); PROC_LBL.push({ el, pos: new THREE.Vector3(x, y + 0.6, z), grp: procFlag });
  }
}

/* Объекты для карточки (общий механизм select) */
function procValveObj(vid) {
  if (procPickObj['v' + vid]) return procPickObj['v' + vid];
  const v = procLogic.V[vid];
  return (procPickObj['v' + vid] = { id: vid, net: 1, proc: { k: 'valve', id: vid }, name: v.n, note: '' });
}
function procPumpObj(pid) {
  if (procPickObj['p' + pid]) return procPickObj['p' + pid];
  return (procPickObj['p' + pid] = { id: pid, net: 1, proc: { k: 'pump', id: pid }, name: procLogic.PU[pid].n, note: '' });
}
function procEdgeObj(e) {
  if (!e) return null;
  if (e.k === 'pump') return procPumpObj(e.pump);
  const L = procLogic, an = L.N[e.a], bn = L.N[e.b];
  const ends = [an, bn].filter(n => n.n).map(n => n.n.split(' (')[0]);
  return { id: 'ТП', net: 1, proc: { k: 'edge', id: e.id }, name: e.n,
    note: `Продукт: ${(PROD[e.prod] || PROD.LZB).n}${e.dn ? '; ' + e.dn : ''}. ${e.k === 'check' ? 'Участок с обратным клапаном (поток только в одну сторону). ' : ''}Источник: ${SRCN[e.src] || e.src}.` + (ends.length ? ` Связывает: ${ends.join(' — ')}.` : '') };
}

/* Подсветка выбранного маршрута: линия по потоку + стрелки направления + мигание закрытой арматуры */
let procActMeshes = [];
const procMatCache = {};
const procMat = (c, o) => procMatCache[c + '|' + o] || (procMatCache[c + '|' + o] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.85, transparent: o < 1, opacity: o, depthWrite: o >= 1 }));
const procCone = new THREE.ConeGeometry(0.22, 0.55, 12);
/* v0.18: выбранный маршрут подсвечивается по физическим трубам (PFLOW); при недоступности — прежняя схема по оси графа */
function procDrawPath(path, lvl, prod) {
  const PF = window.__PFLOW;
  if (!PF || !path) return procDrawPathGraph(path, lvl, prod);
  try {
    for (const m of procActMeshes) { procAct.remove(m); if (m.isInstancedMesh) m.dispose(); else m.geometry.dispose(); }
    procActMeshes = []; procPulse.length = 0;
    for (const k in procLogic.vMesh) procLogic.vMesh[k].halo.visible = false;
    const L = procLogic;
    const col = lvl === 'err' ? 0xffffff : new THREE.Color((PROD[prod] || PROD.LZB).c).lerp(new THREE.Color(0xffffff), 0.25).getHex(), op = lvl === 'err' ? 0.75 : 1;
    const running = !!(prSel.pump && L.st.pump[prSel.pump] && lvl !== 'err');
    const R = PF.routeMeshes(path, col, op);
    if (!running) {
      for (const m of R.meshes) { procAct.add(m); procActMeshes.push(m); }
      const cm = new THREE.InstancedMesh(procCone, procMat(lvl === 'err' ? 0xb0b6bb : 0x1d2a36, 1), Math.max(1, R.arrows.length));
      const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = new THREE.Vector3(); let n = 0;
      for (const [p, d, ro] of R.arrows) { const k = Math.max(0.35, Math.min(0.75, ro * 6)); q.setFromUnitVectors(up, d); m4.compose(p.clone().add(new THREE.Vector3(0, ro + 0.12 + 0.3 * k, 0)), q, sc.set(k, k, k)); cm.setMatrixAt(n++, m4); }
      cm.count = n; procAct.add(cm); procActMeshes.push(cm);
    }
    for (const { e } of path) if (e.k === 'valve' && !L.st.valve[e.v]) { const vm = L.vMesh[e.v]; vm.halo.visible = true; procPulse.push(vm.halo); }
  } catch (e) { console.error('PFLOW: маршрут', e); procDrawPathGraph(path, lvl, prod); }
}
function procDrawPathGraph(path, lvl, prod) {
  for (const m of procActMeshes) { procAct.remove(m); if (m.isInstancedMesh) m.dispose(); else m.geometry.dispose(); }
  procActMeshes = []; procPulse.length = 0;
  for (const k in procLogic.vMesh) procLogic.vMesh[k].halo.visible = false;
  if (!path) return;
  const L = procLogic, pts = [];
  for (const { e, d } of path) { const p = L.pts3(e); const seq = d === 1 ? p : [...p].reverse(); for (const q of seq) if (!pts.length || pts[pts.length - 1].distanceTo(q) > 0.01) pts.push(q); }
  const col = lvl === 'err' ? 0xffffff : new THREE.Color((PROD[prod] || PROD.LZB).c).lerp(new THREE.Color(0xffffff), 0.25).getHex(), op = lvl === 'err' ? 0.75 : 1;
  if (!(prSel.pump && procLogic.st.pump[prSel.pump] && lvl !== 'err')) {
    const im = new THREE.InstancedMesh(L.cyl, procMat(col, op), pts.length); let n = 0;
    for (let i = 1; i < pts.length; i++) { const m = L.segMatrix(pts[i - 1], pts[i], 0.2); if (m) im.setMatrixAt(n++, m); }
    im.count = n; im.renderOrder = 3; procAct.add(im); procActMeshes.push(im);
  }
  let n = 0;
  // стрелки по направлению потока каждые ~4 м
  const arr = []; let acc = 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = a.distanceTo(b);
    while (acc < len) { arr.push([a.clone().lerp(b, acc / len), b.clone().sub(a).normalize()]); acc += 4; }
    acc -= len;
  }
  const cm = new THREE.InstancedMesh(procCone, procMat(lvl === 'err' ? 0xb0b6bb : 0x1d2a36, 1), Math.max(1, arr.length));
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1);
  for (const [p, d] of arr) { q.setFromUnitVectors(up, d); m4.compose(p.clone().add(new THREE.Vector3(0, 0.32, 0)), q, s); cm.setMatrixAt(n++, m4); }
  cm.count = n; procAct.add(cm); procActMeshes.push(cm);
  for (const { e } of path) if (e.k === 'valve' && !L.st.valve[e.v]) { const vm = L.vMesh[e.v]; vm.halo.visible = true; procPulse.push(vm.halo); }
}
function procRefresh3D() {
  const L = procLogic;
  const cO = new THREE.Color(0x22c55e), cC = new THREE.Color(0xef4444);
  for (const [k, vm] of Object.entries(L.vMesh)) { const on = L.st.valve[k]; L.indIM.setColorAt(vm.idx, on ? cO : cC); vm.halo.material = on ? L.mats.mOpen : L.mats.mClosed; }
  L.indIM.instanceColor.needsUpdate = true;
  for (const [k, r] of Object.entries(L.pRing)) r.material = L.st.pump[k] ? L.mats.mOpen : L.mats.mStop;
}
let procLastT = 0;
function procTick(t) {
  const dt = procLastT ? (t - procLastT) / 1000 : 0; procLastT = t;
  procSim.tick(t, dt);
  const s = 1 + 0.35 * Math.sin(t * 0.008);
  for (const h of procPulse) h.scale.setScalar(s);
  if (!labelsEl.classList.contains('off')) for (const l of PROC_LBL) {
    if (!l.grp.visible) { l.el.style.display = 'none'; continue; }
    v.copy(l.pos).project(camera);
    if (v.z > 1) { l.el.style.display = 'none'; continue; }
    l.el.style.display = ''; l.el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px,${(1 - v.y) / 2 * innerHeight}px) translate(-50%,-100%)`;
  }
}

/* ---------- Карточки элементов (дополнение к общей карточке объекта) ---------- */
const procBtn = (act, id, txt, cls = '') => `<button class="pbtn ${cls}" data-act="${act}" data-id="${id}">${txt}</button>`;
function procCardHTML(o) {
  const L = procLogic;
  if (o.proc && o.proc.k === 'valve') {
    const v = L.V[o.proc.id], open = L.st.valve[o.proc.id];
    return `<div class="n">${VTYP[v.typ] || v.typ}${v.tag ? ' · ' + v.tag : ''}. Положение: ${SRCN[v.src] || v.src}.</div>` + (v.note ? `<div class="n">${v.note}</div>` : '') +
      `<div class="pst ${open ? 'on' : 'off'}">Состояние (модель): <b>${open ? 'ОТКРЫТА' : 'ЗАКРЫТА'}</b></div>` +
      `<div class="pbar">${procBtn('valve', o.proc.id, open ? 'Закрыть' : 'Открыть', open ? 'red' : 'grn')}</div>`;
  }
  const pid = o.proc && o.proc.k === 'pump' ? o.proc.id : Object.keys(L.PU).find(k => L.PU[k].mesh && L.PU[k].mesh === o.id);
  if (pid) {
    const p = L.PU[pid], run = L.st.pump[pid], lk = L.pumpLinks(pid), nm = k => L.N[k].n.split(' (')[0];
    return `<div class="n"><b>${p.n}</b>: ${p.model}; Q = ${p.Q}${typeof p.Q === 'number' ? ' м³/ч' : ''}; H = ${p.H}${typeof p.H === 'number' ? ' м' : ''}; N = ${p.N} кВт. Управление: ${p.ctrl}. Давление на напоре (Рном / Рmax, МПа): ${p.P}${p.pis !== '—' ? ' — ' + p.pis : ''}.</div>` +
      `<div class="n">Назначение: ${p.duty}</div><div class="n">Блокировки (АК-004, реализация — этап 2–3): ${p.lock}</div>` +
      (p.warn ? `<div class="n" style="color:#b02a2a">${p.warn}</div>` : '') + (o.proc || o.id === pid ? '' : `<div class="n">В 3D-модели (по АК-041) насос подписан «${o.id}»; в АК-004 — «${pid}».</div>`) +
      `<div class="n">Связь сейчас: всас — ${lk.suc.length ? lk.suc.map(nm).join(', ') : 'нет'}; нагнетание — ${lk.dis.length ? lk.dis.map(nm).join(', ') : 'нет'}.</div>` +
      `<div class="pst ${run ? 'on' : 'off'}">Состояние (модель): <b>${run ? 'В РАБОТЕ' : 'ОСТАНОВЛЕН'}</b></div>` +
      `<div class="pbar">${procBtn('pump', pid, run ? 'Стоп' : 'Пуск', run ? 'red' : 'grn')}</div>`;
  }
  // резервуары генплана: показать задвижки из графа
  const tk = Object.keys(L.N).filter(k => L.N[k].t === 'tank' && L.N[k].obj === o.id);
  if (tk.length) {
    let h = '<div class="n"><b>В технологическом графе:</b></div>';
    for (const k of tk) {
      const vs = Object.keys(L.V).filter(v => v.startsWith(L.N[k].n.split(' (')[0] + '-'));
      h += `<div class="n">${L.N[k].n}${L.N[k].rgsflag ? ' <span style="color:#b02a2a">(нумерация — см. «! Нумерация РГС»)</span>' : ''}: ` +
        vs.map(v => `${L.V[v].n.replace('Задвижка ', '')} — ${L.st.valve[v] ? 'откр.' : 'закр.'} ${procBtn('valve', v, L.st.valve[v] ? 'Закрыть' : 'Открыть', 'sm')}`).join('; ') + '</div>';
    }
    return h;
  }
  return '';
}
document.getElementById('info').addEventListener('click', e => {
  const b = e.target.closest('.pbtn'); if (!b) return;
  if (b.dataset.act === 'valve') procLogic.setValve(b.dataset.id, !procLogic.st.valve[b.dataset.id]);
  else if (b.dataset.act === 'pump') procLogic.setPump(b.dataset.id, !procLogic.st.pump[b.dataset.id]);
});

/* ---------- Панель «Технология»: маршруты ---------- */
const procP = document.getElementById('procp'), prList = document.getElementById('prList'), prDet = document.getElementById('prDet');
const toastEl = document.getElementById('toast'); let toastT = 0;
function toast(msg, lvl = 'info') { toastEl.textContent = msg; toastEl.className = 'show ' + lvl; clearTimeout(toastT); toastT = setTimeout(() => toastEl.className = '', 4200); }
const prSel = { r: null, src: null, dst: null, pump: null };
function prNodeName(k) { return procLogic.N[k].n.split(' (')[0]; }
function prOptions(r) {
  const L = procLogic, prodFor = s => r.prod === 'LZB' ? L.prodOf(s) : r.prod, ok = [];
  for (const s of r.src) for (const d of r.dst) if (s !== d) for (const p of r.pump) if (L.findPath(s, d, p, prodFor(s), false)) ok.push([s, d, p]);
  return ok;
}
function prRenderList() {
  let h = '', last = '';
  for (const r of PROC.routes) {
    if (r.grp !== last) { h += `<div class="oc">${r.grp}</div>`; last = r.grp; }
    h += `<div class="oi${prSel.r === r ? ' sel' : ''}" data-r="${r.id}"><b>${r.id}</b><span>${r.n}</span></div>`;
  }
  prList.innerHTML = h;
}
function prRenderDet() {
  const r = prSel.r; if (!r) { prDet.innerHTML = '<div class="empty">Выберите операцию — маршрут будет подсвечен в 3D, а система проверит положение арматуры и состояние насосов.</div>'; procDrawPath(null); return; }
  const L = procLogic, opts = prOptions(r);
  const srcs = [...new Set(opts.map(o => o[0]))];
  if (!srcs.includes(prSel.src)) prSel.src = srcs[0];
  const dsts = [...new Set(opts.filter(o => o[0] === prSel.src).map(o => o[1]))];
  if (!dsts.includes(prSel.dst)) prSel.dst = dsts[0];
  const pumps = opts.filter(o => o[0] === prSel.src && o[1] === prSel.dst).map(o => o[2]);
  if (!pumps.includes(prSel.pump)) prSel.pump = pumps[0];
  const prod = r.prod === 'LZB' ? L.prodOf(prSel.src) : r.prod;
  const ev = L.evaluate(prSel.src, prSel.dst, prSel.pump, prod);
  const sel = (id, arr, cur, nm) => `<select id="${id}">${arr.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${nm(k)}</option>`).join('')}</select>`;
  const run = L.st.pump[prSel.pump];
  let h = `<div class="rh"><b>${r.id}</b> ${r.n} <i class="pd" style="background:#${(PROD[prod] || PROD.LZB).c.toString(16).padStart(6, '0')}"></i><span style="font-size:11px;color:#5b6b78">${(PROD[prod] || PROD.LZB).n}</span><button class="lbtn" id="prClr" style="margin-left:auto">снять выбор</button></div>` +
    `<div class="rs"><label>Источник ${sel('prS', srcs, prSel.src, prNodeName)}</label><label>Приёмник ${sel('prD', dsts, prSel.dst, prNodeName)}</label><label>Насос ${sel('prP', pumps, prSel.pump, k => k)}</label></div>` +
    `<div class="rst ${ev.lvl}">${ev.text.replace(' Движение продукта будет показано на этапе 2.', '')}${(ev.warn || []).map(w => '<br>⚠ ' + w).join('')}</div>` +
    `<div id="prLive"></div><div id="prPass"></div>` +
    `<label class="dose">Задание на перекачку, м³ <input id="prDose" type="number" min="0" step="0.5" placeholder="без ограничения" value="${prSel.dose || ''}"></label>` +
    `<div class="pbar"><button class="pbtn grn" id="prAsm">Собрать маршрут</button><button class="pbtn ${run ? 'red' : 'grn'}" id="prRun">${run ? 'Стоп' : 'Пуск'} ${prSel.pump}</button>` +
    `<button class="pbtn" id="prShow">Показать</button><button class="pbtn" id="prAll">Закрыть всё</button></div>`;
  if (ev.need) {
    h += '<div class="oc">Арматура маршрута (по потоку)</div>';
    for (const v of ev.need) { const on = L.st.valve[v]; h += `<div class="vr" data-v="${v}"><i class="dot ${on ? 'on' : 'off'}"></i><span><b>${v}</b> ${L.V[v].n}${window.__HYDX ? window.__HYDX.vtag(v) : ''}</span>${procBtn('valve', v, on ? 'Закр.' : 'Откр.', 'sm ' + (on ? 'red' : 'grn'))}</div>`; }
  }
  h += `<div class="rn">${r.note}</div><div class="rn">Модель: связность маршрута — по положению арматуры, направлению насосов и обратных клапанов; подача — рабочая точка насоса на сети (гидравлический расчёт v0.35 по физическим трубам; модельные данные, допущения — вкладка «Модель»); арматура открывается и закрывается за время хода, пуск — после полного открытия маршрута; поток и маршрут показаны по физическим трубам модели сети (v0.18), скорость — по внутреннему диаметру участка; уровни и объёмы — модельные (задаются на вкладке «Ёмкости»); блокировки по уровням — по АК-004. Пожар и загазованность — этап 3.</div>`;
  prDet.innerHTML = h;
  procDrawPath(ev.ideal, ev.lvl, prod);
  if (window.__PFLOW) try { window.__PFLOW.renderPass(document.getElementById('prPass'), ev.ideal, prSel.pump); } catch (e) { console.error('PFLOW: паспорт', e); }
  prDet.querySelector('#prS').onchange = e => { prSel.src = e.target.value; prRenderDet(); };
  prDet.querySelector('#prD').onchange = e => { prSel.dst = e.target.value; prRenderDet(); };
  prDet.querySelector('#prP').onchange = e => { prSel.pump = e.target.value; prRenderDet(); };
  prDet.querySelector('#prAsm').onclick = () => { if (ev.ideal) L.assemble(ev.ideal); };
  prDet.querySelector('#prRun').onclick = () => { const on = !L.st.pump[prSel.pump]; if (L.setPump(prSel.pump, on) && on) procSim.setTask(prSel.pump, +prSel.dose || 0); };
  prDet.querySelector('#prDose').oninput = e => { prSel.dose = e.target.value; };
  prDet.querySelector('#prDose').onkeydown = e => e.stopPropagation();
  procSim.renderLive();
  prDet.querySelector('#prAll').onclick = () => L.closeAll();
  prDet.querySelector('#prShow').onclick = () => prFit(ev.ideal);
  prDet.querySelector('#prClr').onclick = () => { prSel.r = null; prRenderList(); prRenderDet(); };
}
prDet.addEventListener('click', e => {
  const b = e.target.closest('.pbtn[data-act]');
  if (b) { e.stopPropagation(); procLogic.setValve(b.dataset.id, !procLogic.st.valve[b.dataset.id]); return; }
  const row = e.target.closest('.vr');
  if (row) { const v = procLogic.V[row.dataset.v], y = v.y !== undefined ? v.y : procLogic.procY(v.p[0], v.p[1]); procShow(); flyTo([v.p[0] + 6, y + 6, v.p[1] + 7], [v.p[0], y, v.p[1]]); select(procValveObj(row.dataset.v)); if (innerWidth < 700) closePanels(); }
});
prList.addEventListener('click', e => {
  const it = e.target.closest('.oi'); if (!it) return;
  prSel.r = PROC.routes.find(r => r.id === it.dataset.r); prSel.dose = it.dataset.r === 'М6' ? '0.05' : ''; prRenderList(); prRenderDet(); prFit(procLogic._last);
});
function prFit(path) {
  if (!path) { const r = prSel.r; if (!r) return; const L = procLogic, prod = r.prod === 'LZB' ? L.prodOf(prSel.src) : r.prod; path = L.findPath(prSel.src, prSel.dst, prSel.pump, prod, false); if (!path) return; }
  procShow();
  const bb = new THREE.Box3(), PF = window.__PFLOW; for (const { e } of path) for (const p of (PF ? PF.edgePts(e) : procLogic.pts3(e))) bb.expandByPoint(p);
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.z) / 2;
  const s = new THREE.Spherical().setFromVector3(new THREE.Vector3().subVectors(camera.position, controls.target));
  const side = innerWidth >= 760 && procP.style.display === 'flex' ? Math.min(0.45, (procP.getBoundingClientRect().right + 10) / innerWidth) : 0;
  s.radius = Math.min(260, Math.max(22, r * (1.9 + side * 2.2))); s.phi = Math.min(1.0, Math.max(0.5, s.phi));
  // при открытой панели слева — сдвинуть цель так, чтобы маршрут оказался в свободной части экрана
  const hw = s.radius * Math.tan(camera.fov * Math.PI / 360) * camera.aspect, right = new THREE.Vector3(Math.cos(s.theta), 0, -Math.sin(s.theta));
  const tgt = c.clone().addScaledVector(right, -side * hw);
  flyTo(tgt.clone().add(new THREE.Vector3().setFromSpherical(s)).toArray(), tgt.toArray());
  if (innerWidth < 700) closePanels();
}
function procShow() { for (const k of (window.__PFLOW ? ['procval', 'procflow'] : ['procnet', 'procval'])) if (!layerApi.isOn(k)) layerApi.setVis(k, true); }
procLogic.on((msg, lvl) => {
  procRefresh3D(); if (typeof procSim !== 'undefined') procSim.dirty = true;
  if (msg) toast(msg, lvl);
  if (procP.style.display === 'flex') prRenderDet();
  else if (prSel.r) { const L = procLogic, r = prSel.r, prod = r.prod === 'LZB' ? L.prodOf(prSel.src) : r.prod, ev = L.evaluate(prSel.src, prSel.dst, prSel.pump, prod); procDrawPath(ev.ideal, ev.lvl, prod); }
  if (curSel && (curSel.proc || procCardHTML(curSel))) select(curSel);
});
let prTab = 'routes';
function prSetTab(t) {
  prTab = t;
  procP.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.getElementById('prRoutes').style.display = t === 'routes' ? '' : 'none';
  document.getElementById('prTanks').style.display = t === 'tanks' ? '' : 'none';
  document.getElementById('prModel').style.display = t === 'model' ? '' : 'none';
  document.getElementById('prEst').style.display = t === 'est' ? '' : 'none';
  document.getElementById('prEmg').style.display = t === 'emg' ? '' : 'none'; document.body.classList.toggle('emgTab', t === 'emg');
  if (t === 'routes') { prRenderList(); prRenderDet(); } else if (t === 'tanks') procSim.renderTanks(true); else if (t === 'est') ESTOPS.render(); else if (t === 'emg') { if (window.__EMG) window.__EMG.render(true); } else procSim.renderModel(true);
}
procP.querySelectorAll('.tabs button').forEach(b => b.onclick = () => prSetTab(b.dataset.tab));
document.getElementById('bProc').onclick = () => {
  if (procP.style.display === 'flex') { closePanels(); return; }
  openPanel('proc'); procShow(); prSetTab(prTab);
};
procRefresh3D();

