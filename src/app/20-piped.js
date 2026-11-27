/* =====================================================================================
   Этап 6.6 — детализация труб, подземные коммуникации (колодцы, разрез грунта)
   Подтверждено документацией (ГП-005, сводный план инженерных сетей):
     трассы надземных/подземных сетей; переходы под проездами «в футляре»; точки подъёма/опуска труб;
     круглые колодцы (символы на плане) — положение и диаметр 1,0 / 1,5 м сняты с векторных символов листа
     и привязаны к трассам сетей (колодец принят, если его центр ≤ 0,8 м от трассы подземной сети);
     маркировка: ДТ(Л), ДТ(З), Б, Д, Гу — по условным обозначениям листа.
   ПО ПРОЕКТУ (v0.48): В2 и В10 — диаметры подземных труб (610-ПТ-001) и глубина заложения (продольный профиль 610-ПТ-004),
     см. UG_PT ниже.
   УСЛОВНО (требует уточнения по продольным профилям и ТХ):
     глубины заложения остальных сетей (UGND_DEPTH), диаметры труб (NET_DEF.r), положение фланцевых соединений и подвесок,
     номера колодцев, материал и конструкция колодцев, песчаная подготовка, сигнальная лента.
   ===================================================================================== */
/* В2, В10 — по комплекту 610-ПТ (data/ug-pt-610.json): Ø219×5 и Ø159×5 (610-ПТ-001); глубина — медиана глубины до лотка
   по 16 точкам профиля кольца 610-ПТ-004 (совпадает с глубинами колодцев 610-ПТ-006/007), ось = медиана − Dн/2.
   По трассе глубина принята постоянной: поточечно профиль не привязан — плана сетей 610-ПТ-002 с номерами колодцев нет (P38). */
const UG_PT = /*@json data/ug-pt-610.json*/null;
const UG_PT_INV = (() => { const g = UG_PT.ring.map(p => p.ground - p.invert).sort((a, b) => a - b), n = g.length; return { med: n % 2 ? g[(n - 1) / 2] : (g[n / 2 - 1] + g[n / 2]) / 2, min: g[0], max: g[n - 1], n }; })();
const UG_OD = { pv: UG_PT.od.pv, prp: UG_PT.od.prp };   // Dн подземных труб В2, В10 (только подземные участки; надземные отводы — по NET_DEF)
const UGND_DEPTH = { water: 2.5, pv: UG_PT_INV.med - UG_OD.pv / 2, prp: UG_PT_INV.med - UG_OD.prp / 2, kpd: 1.8, k1: 1.8, heat: 1.0, tech: 0.9, cab: 0.7 };   // м от поверхности до оси; кроме В2/В10 — УСЛОВНО (К3: минимальное, далее профиль к 798)
const PIPED = (() => {
  const out = { fit: new THREE.Group(), ins: new THREE.Group(), tags: new THREE.Group(), wells: new THREE.Group(), sec: new THREE.Group() };
  for (const g of Object.values(out)) scene.add(g);
  const up = new THREE.Vector3(0, 1, 0), zax = new THREE.Vector3(0, 0, 1);
  const dir = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), one = new THREE.Quaternion();
  const def = Object.fromEntries(NET_DEF.map(d => [d.k, d]));
  const OVER_T = ['dtl', 'dtz', 'b', 'd', 'gu', 'pv', 'prp'];
  const overSegs = k => def[k].under ? [] : NETS[k].filter(s => s[4] === 0);
  const underSegs = k => def[k].under ? NETS[k] : NETS[k].filter(s => s[4] === 1);
  const ayOf = k => def[k].ay || 0.6;
  const key = (x, z) => Math.round(x * 50) + ',' + Math.round(z * 50);
  const netMat = k => new THREE.MeshStandardMaterial({ color: def[k].c, roughness: 0.45, metalness: 0.3 });
  const steelM = new THREE.MeshStandardMaterial({ color: 0x565b60, roughness: 0.5, metalness: 0.75 });
  const instOf = (geo, mt, n, parent) => { const im = new THREE.InstancedMesh(geo, mt, Math.max(n, 1)); im.count = n; parent.add(im); return im; };
  const stats = { elbows: 0, flanges: 0, ubolts: 0, tags: 0, ins: 0, wells: 0, sec: 0 };

  /* ---- 1. Отводы/заглушки на стыках сегментов, фланцы, хомуты на опорах ---- */
  const gSph = new THREE.SphereGeometry(1, 8, 6), gCyl = new THREE.CylinderGeometry(1, 1, 1, 10), gPlate = new THREE.BoxGeometry(0.22, 0.04, 0.22);
  const gTor = new THREE.TorusGeometry(1, 0.1, 4, 8);
  const flangeAll = [], uboltAll = [], plateAll = [];
  for (const k of OVER_T.concat(['heat'])) {
    const r = def[k].r, ay = ayOf(k), segs = overSegs(k).filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.05);
    const mp = new Map();
    for (const s of segs) for (const [a, b, c, e] of [[s[0], s[1], s[2], s[3]], [s[2], s[3], s[0], s[1]]]) {
      const kk = key(a, b); let v = mp.get(kk); if (!v) mp.set(kk, v = { x: a, z: b, dirs: [] }); v.dirs.push(Math.atan2(e - b, c - a));
    }
    const pts = [];
    for (const v of mp.values()) {
      if (v.dirs.length === 2) { let da = Math.abs(v.dirs[0] - v.dirs[1]) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da; if (da > Math.PI - 0.15) continue; }
      pts.push(v);
    }
    if (pts.length) {   // отвод (радиусный поворот) / тройник / заглушка на конце: сфера по диаметру трубы
      const im = instOf(gSph, netMat(k), pts.length, out.fit); im.castShadow = true;
      pts.forEach((v, i) => { m4.compose(p3.set(v.x, hAt(v.x, v.z) + ay, v.z), one, s3.set(r * 1.02, r * 1.02, r * 1.02)); im.setMatrixAt(i, m4); });
      stats.elbows += pts.length;
    }
    if (k === 'heat') continue;
    segs.forEach(s => {
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, L = Math.hypot(s[2] - s[0], s[3] - s[1]), gy = hAt(mx, mz);
      dir.set(s[2] - s[0], 0, s[3] - s[1]).normalize();
      if (L >= 4.5) flangeAll.push([mx, gy + ay, mz, dir.x, dir.z, r * 1.6]);                      // фланцевое соединение (положение условно)
      if (L >= 0.6) { uboltAll.push([mx, gy + ay, mz, dir.x, dir.z, r * 1.12]); plateAll.push([mx, gy + ay - r - 0.02, mz]); }   // хомут + опорная плита на стойке
    });
  }
  if (flangeAll.length) {
    const im = instOf(gCyl, steelM, flangeAll.length, out.fit); im.castShadow = true;
    flangeAll.forEach(([x, y, z, dx, dz, rr], i) => { dir.set(dx, 0, dz); q.setFromUnitVectors(up, dir); m4.compose(p3.set(x, y, z), q, s3.set(rr, 0.06, rr)); im.setMatrixAt(i, m4); });
    stats.flanges = flangeAll.length;
  }
  if (uboltAll.length) {
    const im = instOf(gTor, steelM, uboltAll.length, out.fit);
    uboltAll.forEach(([x, y, z, dx, dz, rr], i) => { dir.set(dx, 0, dz); q.setFromUnitVectors(zax, dir); m4.compose(p3.set(x, y, z), q, s3.set(rr, rr, rr * 2)); im.setMatrixAt(i, m4); });
    stats.ubolts = uboltAll.length;
    const ip = instOf(gPlate, steelM, plateAll.length, out.fit);
    plateAll.forEach(([x, y, z], i) => { m4.compose(p3.set(x, y, z), one, s3.set(1, 1, 1)); ip.setMatrixAt(i, m4); });
  }

  /* ---- 2. Тепловая изоляция сетей теплоснабжения (оболочка из тонколистового металла — типовое решение) ---- */
  {
    const segs = overSegs('heat').filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.05), r = def.heat.r * 1.5;
    if (segs.length) {
      const im = instOf(gCyl, new THREE.MeshStandardMaterial({ color: 0xb9bec3, roughness: 0.38, metalness: 0.85 }), segs.length, out.ins); im.castShadow = true;
      segs.forEach((s, i) => {
        const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, L = Math.hypot(s[2] - s[0], s[3] - s[1]);
        dir.set(s[2] - s[0], 0, s[3] - s[1]).normalize(); q.setFromUnitVectors(up, dir);
        m4.compose(p3.set(mx, hAt(mx, mz) + ayOf('heat'), mz), q, s3.set(r, Math.max(L - 0.04, 0.02), r)); im.setMatrixAt(i, m4);
      });
      stats.ins = segs.length;
    }
  }

  /* ---- 3. Бирки маркировки по условным обозначениям ГП-005 ---- */
  const TAG = { dtl: 'ДТ(Л)', dtz: 'ДТ(З)', b: 'Б', d: 'Д', gu: 'Гу' };
  for (const [k, txt] of Object.entries(TAG)) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cx = cv.getContext('2d');
    cx.fillStyle = '#' + def[k].c.toString(16).padStart(6, '0'); cx.fillRect(0, 0, 256, 64);
    cx.fillStyle = '#fff'; cx.font = 'bold 40px system-ui,Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(txt, 64, 34); cx.fillText(txt, 192, 34);
    cx.strokeStyle = '#fff'; cx.lineWidth = 6; cx.strokeRect(0, 0, 256, 64);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const places = []; let acc = 10;
    for (const s of overSegs(k)) {
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]); acc += L;
      if (L >= 1.2 && acc >= 12) { acc = 0; places.push(s); }
    }
    if (!places.length) continue;
    const r = def[k].r;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    const im = instOf(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6, metalness: 0.1 }), places.length, out.tags);
    places.forEach((s, i) => {
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2; dir.set(s[2] - s[0], 0, s[3] - s[1]).normalize(); q.setFromUnitVectors(up, dir);
      m4.compose(p3.set(mx, hAt(mx, mz) + ayOf(k), mz), q, s3.set(r * 1.1, 0.34, r * 1.1)); im.setMatrixAt(i, m4);
    });
    stats.tags += places.length;
  }

  /* ---- 4. Колодцы: люки на поверхности (всегда) + шахты (в режиме «разрез грунта») ---- */
  const WELL_NAME = { kpd: 'Колодец производственно-дождевой канализации К3', k1: 'Колодец хозбытовой канализации К1', water: 'Колодец водопроводный', pv: 'Колодец противопожарного водопровода', prp: 'Колодец пенорастворопровода' };
  const wellObj = {};
  for (const k of Object.keys(WELL_NAME)) wellObj[k] = { id: 'К', net: 1, name: WELL_NAME[k] + ' (круглый)', note: 'Положение и диаметр (Ø1,0, Ø1,5 или Ø2,0 м) — по символу на сводном плане сетей ГП-005, колодец привязан к трассе сети. Номер колодца (для К3 по АК-005: К3-15…К3-18), конструкция и глубина — УСЛОВНЫ, требуют уточнения по рабочим чертежам и продольным профилям. Кнопка «Подземные сети» — шахта, кольца, трубы на условной глубине. Символ проверен по слоям векторного ГП-005 (слой блока колодца «0» или «001-ПТ-В2.В10»), центр совпадает с листом в пределах 0,01–0,07 м. Сеть подземная — на поверхности виден только люк.' };
  const wk = {};
  for (const [x, z, w, k] of WELLS_DATA) (wk[k] = wk[k] || []).push([x, z, w]);
  const gRing = new THREE.CylinderGeometry(1, 1, 1, 16), gLid = new THREE.CylinderGeometry(1, 1, 1, 14);
  const ringM = new THREE.MeshStandardMaterial({ color: 0x9d9a93, roughness: 0.95 });
  const lidM = (() => {   // чугунный люк: обод, концентрические рёбра и ромбическое рифление (текстура торца)
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#2f3133'; c.fillRect(0, 0, 256, 256);
    c.save(); c.beginPath(); c.arc(128, 128, 104, 0, 7); c.clip(); c.strokeStyle = '#4a4d50'; c.lineWidth = 5;
    for (let d = -256; d < 512; d += 22) { c.beginPath(); c.moveTo(d, 0); c.lineTo(d + 256, 256); c.stroke(); c.beginPath(); c.moveTo(d + 256, 0); c.lineTo(d, 256); c.stroke(); }
    c.restore(); c.strokeStyle = '#55595c'; for (const [r, w] of [[124, 10], [104, 5], [56, 5]]) { c.lineWidth = w; c.beginPath(); c.arc(128, 128, r, 0, 7); c.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.55 });
  })();
  for (const [k, arr] of Object.entries(wk)) {
    const o = wellObj[k];
    const ir = instOf(gRing, ringM, arr.length, out.wells), il = instOf(gLid, lidM, arr.length, out.wells);
    arr.forEach(([x, z, w], i) => {
      const gy = hAt(x, z);
      m4.compose(p3.set(x, gy + 0.03, z), one, s3.set(w * 0.5, 0.06, w * 0.5)); ir.setMatrixAt(i, m4);     // оголовок (бетонное кольцо)
      m4.compose(p3.set(x, gy + 0.065, z), one, s3.set(0.32, 0.03, 0.32)); il.setMatrixAt(i, m4);           // чугунный люк Ø640
    });
    const objs = arr.map(([x, z, w]) => Object.assign({}, o, { well: { k, x, z, w } }));   // v0.36: колодец → подсветка трассы его сети (UGHL)
    for (const im of [ir, il]) { im.userData.o = o; im.userData.pick = h => objs[h.instanceId] || o; pickables.push(im); }   // шахты — модуль UGN (этап 6.7)
    stats.wells += arr.length;
  }

  /* ---- 5. Подземная прокладка — с этапа 6.7 строится модулем UGN (непрерывные трассы, профиль К3, футляры, траншеи, ёмкости, разрез грунта) ---- */
  out.sec.visible = false;
  return { ...out, stats, wellLid: lidM, tick() {} };
})();

