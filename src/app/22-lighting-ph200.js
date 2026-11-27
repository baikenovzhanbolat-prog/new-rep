/* Освещение территории — по ГП-005: прожекторные мачты и опоры наружного освещения */
function mastAt(g, x, z) {
  add(g, new THREE.BoxGeometry(1.4, 0.6, 1.4), mat.concD, x, 0.3, z);
  add(g, new THREE.CylinderGeometry(0.18, 0.35, 21, 10), mat.steelD, x, 10.5, z);
  add(g, new THREE.BoxGeometry(2.2, 0.15, 2.2), mat.steelD, x, 21, z);
  for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) add(g, new THREE.BoxGeometry(0.45, 0.35, 0.45), M(0xf3f1d6, { emissive: 0x6b6630 }), x + dx, 21.35, z + dz);
}
function poleAt(g, x, z) {
  add(g, new THREE.CylinderGeometry(0.07, 0.11, 8, 8), mat.steelD, x, 4, z);
  add(g, new THREE.BoxGeometry(0.9, 0.06, 0.06), mat.steelD, x + 0.4, 7.9, z);
  add(g, new THREE.BoxGeometry(0.4, 0.12, 0.25), M(0xf3f1d6, { emissive: 0x6b6630 }), x + 0.8, 7.82, z);
}

/* ---------- Насосный цех 200: технологическая обвязка по листу 5632.29-278-АК-041-0 ---------- */

function inPoly(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function segBox(g, a, b, h, t, m, y0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const me = add(g, new THREE.BoxGeometry(L, h, t), m, (a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2);
  me.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); return me;
}
function slabPoly(g, poly, y, th, m) {
  const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; g.add(me); return me;
}
function ph200(g) {
  const G = PH.geo, top = 5.5, wallM = mat.wall;
  const O = G.outer; for (let i = 0; i < O.length; i++) segBox(g, O[i], O[(i + 1) % O.length], top - PH_F1 + 0.3, 0.22, wallM, PH_F1 - 0.3);
  slabPoly(g, G.hall, PH_F1 - 0.15, 0.15, M(0x9b9a95));
  for (const [a, b] of G.upper) { const me = add(g, new THREE.BoxGeometry(Math.abs(b[0] - a[0]), 1.15, Math.abs(b[1] - a[1])), M(0xa9a7a0), (a[0] + b[0]) / 2, PH_F0 - 0.575, (a[1] + b[1]) / 2); }
  for (const [a, b, t] of G.parts) segBox(g, a, b, top - PH_F1, t, wallM, PH_F1);
  for (const [a, b] of G.rail.slice(0, 3)) { segBox(g, a, b, 0.05, 0.05, mat.yellow, PH_F0 + 1.0); segBox(g, a, b, 0.05, 0.05, mat.yellow, PH_F0 + 0.5); }
  const [s0, s1] = G.stair, n = 6;   // лестница с отметки 0,000 на −1,000
  for (let i = 0; i < n; i++) { const z = s0[1] + (s1[1] - s0[1]) * (i + 0.5) / n; add(g, new THREE.BoxGeometry(Math.abs(s1[0] - s0[0]), 0.06, Math.abs(s1[1] - s0[1]) / n), mat.steelD, (s0[0] + s1[0]) / 2, PH_F0 - (i + 1) * (PH_F0 - PH_F1) / (n + 1), z); }
  const roof = new THREE.Group(); slabPoly(roof, O, top, 0.3, mat.roof); g.add(roof); ROOF200 = roof;
}
function pumpAt(g, p) { /* v0.9: агрегат строится в модуле PHX (после создания объектов) */ }
function cabAt(g, c) { const [x0, z0, x1, z1, h] = c; add(g, new THREE.BoxGeometry(Math.abs(x1 - x0), h, Math.abs(z1 - z0)), M(0xd9dde2), (x0 + x1) / 2, PH_F0 + h / 2, (z0 + z1) / 2); }
/* Этап v0.9: данные по листу АК-041 — арматура по типам, фильтры, опоры ОП, воздушники; концы труб у насосов
   (опуски/стояки строятся вместе с агрегатом) и два пропуска оцифровки (участок всаса Н-2 у фильтра; начало линии z≈25,03) */
const PHX_DATA = /*@inline data/22-lighting-ph200.PHX_DATA.json*/null;
{
  for (const [i, end, x, z] of PHX_DATA.clips) { const p = PH.pipes[i]; if (!p) continue; if (end === 0) { p[0] = x; p[1] = z; } else { p[2] = x; p[3] = z; } }
  PH.pipes = PH.pipes.filter((p, i) => !PHX_DATA.drop.includes(i) && !p.dead).concat(PHX_DATA.extra); F29.tagExtra(PHX_DATA.extra); F29.fixValves(PHX_DATA); F34.patchPH(PH);   // v0.30: узлы по 200-ТХ-002
}
const PHG = new THREE.Group(); scene.add(PHG);
const PHT = new THREE.Group(); scene.add(PHT);   // кабельные лотки КП-300 — отдельный слой
{
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const cmat = {}; for (const k in PH_CLS) cmat[k] = new THREE.MeshStandardMaterial({ color: PH_CLS[k][0], roughness: 0.45, metalness: 0.3 });
  const tube = (a, b, y, r, m, o) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.02) return;
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L + 0.02, 14), m); dir.set(b[0] - a[0], 0, b[1] - a[1]).normalize();
    me.quaternion.setFromUnitVectors(up, dir); me.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); me.castShadow = true; me.userData.o = o; me.userData.phPipe = 1; pickables.push(me); PHG.add(me);
  };
  const po = {}; for (const k in PH_CLS) po[k] = { id: 'АК-041', net: 1, name: PH_CLS[k][1] + ' — насосный цех 200', note: 'Трасса и диаметры — по листу 5632.29-278-АК-041-0. Ось труб принята на отм. 297,85 (как у наружных сетей), опуски к насосам — условно.' };
  for (const [x1, z1, x2, z2, D, c] of PH.pipes) tube([x1, z1], [x2, z2], PH_PIPE_Y, Math.max(0.03, D / 2), cmat[c], po[c]);
  const tM = M(0xa7adb3, { metalness: 0.5, transparent: true, opacity: 0.6, depthWrite: false }), to = { id: 'КП', net: 1, name: 'Кабельные конструкции КП-300 (лотки)', note: 'Трасса — по листу АК-041; монтаж на стене на отм. +1,800 (прим. 6 листа).' };
  for (const [x1, z1, x2, z2, ph] of PH.trays) { const me = segBox(PHT, [x1, z1], [x2, z2], 0.08, 0.3, tM, (ph ? PH_F1 : PH_F0) + 1.8); me.userData.o = to; pickables.push(me); }
  for (const [x1, z1, x2, z2, D, c, flag, lbl] of PH.conn) tube([x1, z1], [x2, z2], PH_PIPE_Y, D / 2, cmat[c], { id: 'выход', net: 1, name: lbl, note: 'Выход трубопровода из насосного цеха (граница проектирования АК-041) и стыковка с наружной сетью ГП-005.' });
  const fM = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const [x, z, lbl, cAk, c05, jog] of PH.flags) {
    const nm = { L: 'летнее ДТ', Z: 'зимнее ДТ', B: 'бензин', D: 'дренаж' };
    const txt = cAk !== c05 ? `По АК-041 эта линия — «${lbl}» (${nm[cAk]}), а на ГП-005 продолжение окрашено как ${nm[c05]}.` : `Выход по АК-041 и начало линии на ГП-005 разнесены на ${String(jog).replace('.', ',')} м — показан переход.`;
    const o = { id: '!', net: 1, name: 'Расхождение между листами', note: txt + ' Требует уточнения у проектировщика (ТОО «Акмарал»).' };
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), fM); ring.rotation.y = Math.PI / 2; ring.position.set(x + 0.3, phY(x + 0.3, z), z); ring.userData.o = o; pickables.push(ring); PHG.add(ring);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), fM); s.position.set(x + 0.3, phY(x + 0.3, z) + 1.2, z); s.userData.o = o; pickables.push(s); PHG.add(s);
    add(PHG, new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), fM, x + 0.3, phY(x + 0.3, z) + 0.65, z);
  }
}


/* КИП, фильтры и прочее оборудование насосного цеха — АК-041 (отдельный слой) */
const PHI = new THREE.Group(); scene.add(PHI);
{
  const gM = M(0x2a2d31, { metalness: 0.6 }), mM = M(0xff00ff, { roughness: 0.5 }), sM = M(0x9aa3ab, { metalness: 0.6 }), bM = M(0xcfd5da);
  const KIND = {
    P: ['Манометр показывающий', 'Условное обозначение PI на листе АК-041: манометр на трубопроводе. Модель условная.'],
    S: ['Датчик давления (PIS)', 'Обозначение PIS на листе АК-041: измерение давления с индикацией/сигнализацией; кабельная связь — через ящики ЯВ (см. лист). Модель условная.'],
    F: ['Расходомер FQIT', 'FQIT200-22 — расходомер-счётчик на нитке ДТ насоса Н-3 (по обозначению ISA); тип прибора на листе не указан.'],
    A: ['FA200-23', 'Прибор FA200-23 на обводной линии расходомера; по обозначению ISA — сигнализация расхода. Тип на листе не указан.']
  };
  const pipeZ = z => { let best = z, bd = 0.2; for (const q of PH.pipes) if (q[1] === q[3] && Math.abs(q[1] - z) < bd) { bd = Math.abs(q[1] - z); best = q[1]; } return best; };
  for (const [x, z, w, h, lab, k] of PH.ins.filter(q => q[5] === 'F' || q[5] === 'A')) {   // v0.9: PI/PIS — в модуле PHX
    const o = { id: lab, net: 1, name: KIND[k][0] + ' ' + lab, note: KIND[k][1] };
    const yP = phY(x, z), y = yP + 0.26 + (k === 'F' ? 0.05 : 0);
    const bw = Math.max(0.12, Math.min(w, 0.3)), bh = Math.max(0.12, Math.min(h, 0.3));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), gM); stem.position.set(x, yP + 0.14, z); PHI.add(stem);
    let me;
    if (k === 'F' || k === 'A') me = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.2), 0.14, Math.max(h, 0.2)), k === 'F' ? M(0x3b82a6) : mM);
    else { me = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, k === 'S' ? 0.14 : 0.06, 16), k === 'S' ? M(0xd8d8e8) : bM); me.rotation.x = Math.PI / 2; }
    me.position.set(x, y + 0.1, z); me.userData.o = o; pickables.push(me); PHI.add(me);
    const lm = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), mM); lm.rotation.x = Math.PI / 2; lm.position.set(x, yP, z); PHI.add(lm);
  }
  // КС-3: соединительная коробка на стене, отм. +1,200 (прим. 1)
  { const [x, z] = PH.ex.ks3, o = { id: 'КС-3', net: 1, name: 'Соединительная коробка КС-3', note: 'Монтаж на стене на отм. +1,200 (прим. 1 листа АК-041). Размеры условные.' };
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), M(0xc9c9d6)); b.position.set(x, PH_F1 + 1.2 + 0.2, z); b.userData.o = o; pickables.push(b); PHI.add(b); }
  // QA-36 (газоанализатор/датчик загазованности) с QE-3a — позиция по листу; высота установки на листе не указана
  { const [x, z] = PH.ex.qa, o = { id: 'QA-36', net: 1, name: 'Датчики QA-36 / QE-3a', note: 'Позиция по плану АК-041 (датчики/анализатор QE-3a); высота установки на листе не указана — принята условно 1,5 м от пола.' };
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), gM); st.position.set(x, PH_F1 + 0.7, z); PHI.add(st);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.2), M(0xe0c040)); b.position.set(x, PH_F1 + 1.5, z); b.userData.o = o; pickables.push(b); PHI.add(b); }
  // ЯВ2, ЯВ2* — ящики снаружи у северной стены
  for (const [x, z] of PH.ex.yav) { const o = { id: 'ЯВ2', net: 1, name: 'Ящик ЯВ2 (вывод кабелей КИП)', note: 'Два прямоугольника ЯВ2 / ЯВ2* на плане у северной стены (снаружи); отметка установки на листе не указана — условно 1,5 м, размеры по плану.' };
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.37, 0.25), M(0x3a4fb0)); b.position.set(x, PH_F0 + 1.5, z); b.userData.o = o; pickables.push(b); PHI.add(b); }
}

