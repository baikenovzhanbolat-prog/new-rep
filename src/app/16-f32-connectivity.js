/* ---------- F32 (v0.32): связность технологических трубопроводов ----------
   Проверка показала места, где труба в модели обрывается или поток ГСМ идёт по условной связи (пунктиром), а не по трубе:
   1) РГС-75 116.1–116.4: участки «задвижка → патрубок Ø108 днища» строились моделью РГС (v0.20), но в сеть не входили — поток к ёмкости шёл условно;
   2) РГС-116.3: на векторном ГП-005 нет отводов от линий бензина к задвижкам (у 116.1, 116.2, 116.4 — есть) — по АК-004 задвижки и линии есть;
   3) Гу: узел ответвления «к станции 186» на коллекторе (x −34,09) — на ГП-005 обе линии сплошные (соединение), в модели было пересечение без соединения;
   4) Д: участок ГП-005 x −50,04 (z 20,78→22,88) → x −48,13 выпал при перестройке узла выходов цеха (v0.28) — дренаж цеха был разорван;
   5) ДТ(Л) подземно ×3 (≈1,2 м, у x −37, z 10–11,5): обрывки условного знака ГП-005, не трубы — исключены;
   6) дренажные отводы, конец которых лежит на продуктовой трубе: врезка дренажа с задвижкой (задвижка — условно);
   7) обвязка УСН-N1: общий участок к отводам N1/N3 был отнесён к ДТ(Л) — отвод ДТ(З) N3 не соединялся (АК-045). */
const F32 = (() => {
  const log = PATCH_LOG.F32;   // правки (2)–(5) в NETS и UG_DATA — в данных с v0.43; rgs, drains, estq заполняются ниже
  /* --- (1) РГС: участок «задвижка → патрубок» в сеть (строит его модуль RGSD) --- */
  function regRGS(t, side, loc, valve, gy) {
    if (!loc || !loc.pts || !valve) return;
    const net = t.prod === 'Z' ? 'dtz' : t.prod === 'B' ? 'b' : 'dtl';
    const yv = loc.pts[loc.pts.length - 1].y, zEndPNET = 0.22 - t.cz;   // торец сетевой трубы перед задвижкой (z 0,22 по ГП-005)
    const pts = [[valve.x - t.cx, yv, zEndPNET], ...loc.pts.slice().reverse().map(v => [v.x, v.y, v.z])];
    PIPEREG.push({ gen: 'RGSN', local: true, cx: t.cx, cz: t.cz, gy, net, r: 0.054, od: 0.108, eqEnd: `РГС-${t.id}: патрубок Ø108×4 северного днища (${side === 'В' ? 'выдача' : 'приём'})`,
      name: `РГС-${t.id}: задвижка ${side === 'В' ? 'выдачи' : 'приёма'} → патрубок Ø108×4 (модуль РГС-75)`, src: 'Резервуар 1.pdf / АК-004 (соединительный участок — условно, лист ТХ-002 отсутствует)', pts, cf: { plan: 'P', elev: 'P', dn: 'V' } });
    log.rgs++;
    // ребро технологического графа «Патрубок РГС» — конечная точка на фланце патрубка (иначе поток до ёмкости рисуется пунктиром)
    const q = loc.pts[0], nz = [t.cx + q.x, t.cz + q.z, gy + q.y];
    for (const e of PROC.edges) if (e.k === 'pipe' && /^Патрубок РГС-/.test(e.n || '') && PROC.nodes[e.a] && Math.abs(PROC.nodes[e.a].p[0] - valve.x) < 0.02) e.pts = [e.pts[0], nz];
  }
  /* --- Ø отводов к РГС — по патрубку Ø108×4 (на ГП-005 Ø не подписан) --- */
  const RGS_X = [-17.66, -17.24, -13.38, -12.96, -21.94, -21.52, -26.26, -25.86];
  function applyOD(segs) {
    for (const s of segs) {
      if (s.gen !== 'NETS' || s.under || !['b', 'dtz'].includes(s.net)) continue;
      if (!RGS_X.some(x => Math.abs(s.a[0] - x) < 0.02 && Math.abs(s.b[0] - x) < 0.02)) continue;
      if (Math.min(s.a[2], s.b[2]) < -1.1 || Math.max(s.a[2], s.b[2]) > 0.3) continue;
      if (s.od && Math.abs(s.od - 0.108) < 0.002) continue;
      s.od = 0.108; s.r = 0.054; log.od = (log.od || 0) + 1;
    }
  }
  /* --- (6) дренажная врезка в продуктовую трубу --- */
  const drainEnds = new Map();
  function drainTap(n, s, t) {
    if (s.net !== 'd' || !t || s.under || t.under || !['dtl', 'dtz', 'b', 'lzb'].includes(t.net)) return false;   // только надземные врезки в линии жидких продуктов
    drainEnds.set(n, { n, s, t }); return true;
  }
  function buildDrains(parent, pickables, yOn, segPt) {
    if (!drainEnds.size) return;
    const g = new THREE.Group(); g.name = 'Задвижки дренажных врезок (условно)'; parent.add(g);
    const mB = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 }), mW = new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: 0.5, metalness: 0.3 });
    const seen = new Set();
    for (const { n, s, t } of [...drainEnds.values()].reverse()) {   // последний проход — актуальные сегменты
      const key = n.x.toFixed(2) + ',' + n.z.toFixed(2); if (seen.has(key) || !n.ends || !n.ends.length) continue; seen.add(key);   // классификация концов выполняется в нескольких проходах
      const e = n.ends[0].e, A = e === 0 ? s.a : s.b, B = e === 0 ? s.b : s.a, d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...d); if (l < 0.35) continue;
      const u = d.map(v => v / l), off = Math.min(0.3, l / 2), c = new THREE.Vector3(A[0] + u[0] * off, A[1] + u[1] * off, A[2] + u[2] * off), r = s.r;
      const o = { id: 'ЗД ' + (s.pipe ? s.pipe.id : 'Д'), net: 1, name: `Задвижка дренажной врезки ${s.pipe ? s.pipe.id : ''} → ${t.pipe ? t.pipe.id : ''}`,
        note: `Дренажная линия ${s.pipe ? s.pipe.id : ''} (Ø${Math.round((s.od || 2 * s.r) * 1000)}) заканчивается на продуктовой трубе ${t.pipe ? t.pipe.id : ''} — на ГП-005 так же. В модели — врезка дренажа с задвижкой. Тип, Ду и место задвижки — условно (на ГП-005 арматура не показана).` };
      const grp = new THREE.Group(); grp.position.copy(c); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...u)); g.add(grp);
      const add = (geo, m, y) => { const me = new THREE.Mesh(geo, m); me.position.y = y || 0; me.castShadow = true; me.userData.o = o; me.userData.pick = () => o; grp.add(me); pickables.push(me); return me; };
      add(new THREE.CylinderGeometry(r * 1.55, r * 1.55, 0.025, 16), mB, -0.07); add(new THREE.CylinderGeometry(r * 1.55, r * 1.55, 0.025, 16), mB, 0.07);
      add(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.12, 16), mB, 0);
      // шпиндель и маховик — вверх в мировой системе
      const up = new THREE.Vector3(0, 1, 0), st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mB); st.position.set(c.x, c.y + r + 0.08, c.z); st.userData.o = o; st.userData.pick = () => o; g.add(st); pickables.push(st);
      const hw = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 16), mW); hw.rotation.x = Math.PI / 2; hw.position.set(c.x, c.y + r + 0.16, c.z); hw.userData.o = o; hw.userData.pick = () => o; g.add(hw); pickables.push(hw);
      log.drains.push([s.pipe ? s.pipe.id : '', t.pipe ? t.pipe.id : '']);
    }
  }
  return { log, regRGS, drainTap, buildDrains, applyOD };
})();
/* v0.43: правки NETS (F28, F32, F34) и PH (F28) внесены в data/ */
