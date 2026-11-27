/* =====================================================================================
   Этап v0.12–v0.15 — единая модель трубопроводной сети (PNET), проверка связности, построитель геометрии (PGEO), фасонные детали
   v0.12: итерации 1–3 раздела 22 (инвентаризация, модель данных, валидатор).
   v0.15: сверка с векторным ГП-005 (слои листа, невидимые линии, контуры труб): исключены штрихи подписей, восстановлены повороты и
     разрывы линий, концы доведены до труб, Ø технологических трасс — по графике листа, пересечения разведены по высоте.
   v0.14: итерация 5 — отводы между участками (R = 1,5 Dн), переходы (подтверждённая смена Ø), тройники, врезки (сварной шов по линии
     пересечения), сварные стыки у фасонных деталей, переходы у насосов; подключения насосов (PHX) строятся построителем PGEO.
     Исполнение всех деталей условное (ГОСТ 17375/17376/17378, фланцы PN16 по ГОСТ 33259) — в журнале «Фасонная деталь смоделирована условно».
   v0.13: итерация 4 — непрерывная геометрия труб по осевой линии (гнутые отводы вместо сфер, отметка оси в узлах,
     восполнение разрывов по правилу заказчика, исключение контуров и наложений). Исходная геометрия v0.12 скрыта, не удалена.
   Модель СОБИРАЕТСЯ из существующих источников без изменения их координат и без изменения 3D-геометрии:
     NETS (ГП-005, надземные участки) · UGN.runsOf (ГП-005, подземные трассы v0.7) · PH.pipes / PH.conn (АК-041)
     · ESTQ.runs (АК-045/АК-004) · PIPEREG: обвязка РВС (RVSD), подключения насосов (PHX).
   Не входят (не трубопроводы или не физическая геометрия): кабели и электрообогрев (el, cab1, cab2, eh);
     граф ТП (PROC) — технологическая модель, сверяется с физикой отдельно; условные трубы «Л» (RACK_L) —
     скрытый дубль трасс ГП-005; прежние штрихи подземных участков (слой «ugtrace») — заменены трассами UGN.
   Валидатор ничего не исправляет сам; исправления итерации 4 выполняются только по согласованным правилам и записываются
   в журнал (виды «Исправлено: …»; восполненные разрывы — со статусом «восполнено по соосности — требует уточнения»).
   ===================================================================================== */
window.__PNET = null;
const PNET = (() => {
  const t0 = performance.now();
  /* ---------- справочник сетей ---------- */
  const NI = {
    dtl: { code: 'ДТЛ', prod: 'L', fam: 'proc', nm: 'ДТ(Л) — летнее дизельное топливо' },
    dtz: { code: 'ДТЗ', prod: 'Z', fam: 'proc', nm: 'ДТ(З) — зимнее дизельное топливо' },
    b: { code: 'Б', prod: 'B', fam: 'proc', nm: 'Бензин' },
    d: { code: 'Д', prod: 'D', fam: 'proc', nm: 'Дренаж' },
    gu: { code: 'Гу', prod: 'G', fam: 'proc', nm: 'Газоуравнительная обвязка' },
    dt: { code: 'ДТ', prod: 'LZ', fam: 'proc', nm: 'Коллекторы и обвязка насосов ДТ (Л/З переключаются задвижками)' },
    lzb: { code: 'ОБ', prod: 'LZB', fam: 'proc', nm: 'Обвязка УСН-N1 (ДТ(Л)/ДТ(З)/бензин через N1–N3)' },
    pv: { code: 'В2', prod: 'W2', fam: 'pv', nm: 'Противопожарный водопровод В2' },
    prp: { code: 'В10', prod: 'W10', fam: 'prp', nm: 'Пенорастворопровод В10' },
    heat: { code: 'Т', prod: 'T', fam: 'heat', nm: 'Теплоснабжение' },
    water: { code: 'В1', prod: 'W1', fam: 'water', nm: 'Водопровод В1' },
    kpd: { code: 'К3', prod: 'K3', fam: 'kpd', nm: 'Канализация производственно-дождевая К3' },
    k1: { code: 'К1', prod: 'K1', fam: 'k1', nm: 'Канализация хоз-бытовая К1' }
  };
  const PSET = { L: ['L'], Z: ['Z'], B: ['B'], D: ['D'], G: ['G'], LZ: ['L', 'Z'], LZB: ['L', 'Z', 'B'] };
  const pset = p => PSET[p] || [p];
  const compat = (p, q) => pset(p).some(x => pset(q).includes(x));
  const ST = { V: 'ПОДТВЕРЖДЕНО', P: 'УСЛОВНО', R: 'ТРЕБУЕТ УТОЧНЕНИЯ', D: 'ДЕМОНСТРАЦИЯ', N: 'НЕ ПРОВЕРЕНО' };
  const fmt = (v, d = 2) => (+v).toFixed(d).replace('.', ',');
  const H = 297.30;   // H0: отметка y = 0

  /* ---------- 1. сбор физической геометрии ---------- */
  const segs = [];   // атомарные элементы: {id, net, gen, a:[x,y,z], b:[x,y,z], r, od, under, cas, name, src, cf:{plan,elev,dn}, mt, obj, on}
  const gens = {};   // инвентаризация источников
  const G = (k, txt) => (gens[k] = gens[k] || { k, txt, segs: 0, len: 0, pipes: 0 });
  const addSeg = (o) => {
    o.id = segs.length; o.on = o.on === undefined ? 1 : o.on; segs.push(o);
    o.len = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1], o.b[2] - o.a[2]);
    return o;
  };
  const polySegs = (pts, base) => { for (let i = 0; i < pts.length - 1; i++) addSeg({ ...base, a: pts[i].slice(), b: pts[i + 1].slice(), ref: [base.rec, i] }); };
  const defOf = Object.fromEntries(NET_DEF.map(d => [d.k, d]));
  const OVER = ['dtl', 'dtz', 'b', 'd', 'gu', 'pv', 'prp', 'heat'];
  // прежние меши (материал и объект карточки сохраняются)
  const netMesh = {};
  for (const k of OVER) for (const c of netLayers[k].children) if (c.userData.netsSeg === k && !c.userData.under) netMesh[k] = c;
  // 1.1 ГП-005, надземные участки
  G('NETS', 'ГП-005, надземные участки. Отрезки-цилиндры по штрихам, ось «рельеф в середине отрезка + 0,6 м», стыки — сферы. Непрерывные трубы по осевой линии, отметка оси в узлах, отводы по углу');
  for (const k of OVER) {
    const def = defOf[k], ay = def.ay || 0.6;
    NETS[k].forEach((s, si) => {
      if (s[4]) return;
      const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, y = hAt(mx, mz) + ay;
      addSeg({ net: k, gen: 'NETS', a: [s[0], y, s[1]], b: [s[2], y, s[3]], r: def.r, od: null, under: 0, ay, src: s[5] || 'ГП-005', tk: s[5] ? 1 : 0, cf: { plan: 'V', elev: 'P', dn: 'N' }, ref: ['NETS', k, si], mt: netMesh[k] && netMesh[k].material, obj: netMesh[k] && netMesh[k].userData.o });
    });
  }
  // 1.2 ГП-005, подземные трассы (UGN, v0.7)
  G('UGN', 'ГП-005, подземные участки: непрерывные трассы (пунктир листа сведён в линию); глубина — условно');
  if (UGN.runsOf) for (const [k0, runs] of Object.entries(UGN.runsOf)) {
    const k = k0.startsWith('heat') ? 'heat' : k0;
    if (!NI[k]) continue;   // кабели и электрообогрев — не трубопроводы
    runs.forEach((run, ri) => polySegs(run.pts, { net: k, gen: 'UGN', r: (defOf[k] || {}).r || 0.08, od: null, under: 1, cas: run.cas ? 1 : 0, src: 'ГП-005', cf: { plan: 'V', elev: 'P', dn: 'N' }, rec: 'UGN:' + k0 + ':' + ri, sub: k0 }));
  }
  // 1.3 АК-041, насосный цех 200 (после правок v0.9)
  G('PH', 'Насосный цех 200: план — АК-041; отметки — по разрезам 200-ТХ-003-0, Ø — по ряду 200-ТХ.С-001-0, стояки в узлах с разной отметкой');
  const PHN = { L: 'dtl', Z: 'dtz', B: 'b', D: 'd', DT: 'dt' };
  const stdOD = D => [57, 76, 89, 108, 133, 159, 219, 273].some(v => Math.abs(D * 1000 - v) <= 1.2);   // иначе Ø снят по толщине линии на листе
  const phObj = {}; for (const c of PHG.children) if (c.userData.phPipe && c.userData.o) phObj[c.userData.o.name] = c.userData.o;
  const phMat = {};
  for (const c in PH_CLS) phMat[c] = new THREE.MeshStandardMaterial({ color: PH_CLS[c][0], roughness: 0.45, metalness: 0.3 });
  for (const s of F29.segs()) {   // v0.29: отметки по 200-ТХ-003-0; стояки в узлах с разной отметкой
    const { p, c, D } = s, st = p.elSt || '';
    addSeg({ net: PHN[c], gen: 'PH', a: s.a, b: s.b, r: Math.max(0.03, D / 2), od: D, under: 0, src: 'АК-041 (план), 200-ТХ-003-0 (отметки)', cf: { plan: 'V', elev: st && !/условно/.test(st) ? 'V' : 'P', dn: p.odAk ? 'P' : 'V' }, ref: ['PH.pipes', PH.pipes.indexOf(p)], mt: phMat[c], obj: phObj[PH_CLS[c][1] + ' — насосный цех 200'], name: s.name || '', elDoc: st });
  }
  G('PHC', 'АК-041, выходы из цеха (PH.conn): перемычка от стены цеха до конца трассы ГП-005; на отметке выхода (200-ТХ-003), стояк у наружной стены');
  PH.conn.forEach((p, i) => {
    const [x1, z1, x2, z2, D, c, , lbl] = p, yo = phY(x1 - 0.05, z1);
    let yN = null; for (const s of segs) { if (s.net !== PHN[c] || s.gen === 'PH' || s.gen === 'PHC') continue; for (const e of [s.a, s.b]) if (Math.hypot(e[0] - x2, e[2] - z2) < 0.03 && (yN === null || Math.abs(e[1] - yo) < Math.abs(yN - yo))) yN = e[1]; }
    addSeg({ net: PHN[c], gen: 'PHC', a: [x1, yo, z1], b: [x2, yo, z2], r: D / 2, od: D, under: 0, name: lbl, src: 'АК-041, 200-ТХ-003-0', cf: { plan: 'V', elev: 'V', dn: 'V' }, ref: ['PH.conn', i], mt: phMat[c], obj: phObj[lbl] });
    if (yN !== null && Math.abs(yN - yo) > 0.06) { addSeg({ net: PHN[c], gen: 'PHC', a: [x2, yo, z2], b: [x2, yN, z2], r: D / 2, od: D, under: 0, name: lbl + ' — подъём/опуск у наружной стены (наружная отметка — условно)', src: 'АК-041, 200-ТХ-003-0', cf: { plan: 'V', elev: 'P', dn: 'V' }, ref: ['PH.conn', i], mt: phMat[c], obj: phObj[lbl] }); F29.log.wallRisers++; }
  });
  // 1.4 АК-045/АК-004, эстакада 177
  G('ESTQ', 'АК-045, эстакада 177: коллекторы, обвязка УСН/УНЖ/УПВС, дренаж ⌀273. Ломаные из отрезков, стыки — сферы. Непрерывные трубы, отводы по углу');
  const colNet = { 0xb88a00: 'dtl', 0xf2d24b: 'dtz', 0x00b7d8: 'b', 0x1fa045: 'd', 0xe0109c: 'gu', 0x8d949a: 'lzb' };
  (ESTQ.runs || []).forEach(([pts, r, mt, o], ri) => {
    const net = colNet[mt.color.getHex()] || 'lzb';
    polySegs(pts.map(p => p.slice()), { net, gen: 'ESTQ', r, od: 2 * r, under: 0, name: o && o.name, src: 'АК-045/АК-004', cf: { plan: 'P', elev: 'P', dn: 'V' }, rec: 'ESTQ:' + ri, mt, obj: o });
  });
  // 1.5 PIPEREG: обвязка РВС (RVSD) и подключения насосов (PHX) — строятся своими модулями непрерывными трубами
  G('RVSD', 'Обвязка РВС-1000: патрубок → задвижка → трасса ГП-005, стояки В2/В10, Гу — непрерывные трубы с гнутыми отводами (модуль RVSD)');
  G('PHX', 'Подключения насосных агрегатов к трубам цеха: непрерывные трубы с отводами R = 1,5 DN (модуль PHX)');
  G('RGSN', 'РГС-75 — участки «задвижка → патрубок Ø108 днища» (строит модуль РГС-75, в сети — для потока ГСМ)');
  const equipPts = [], phxRed = [];
  try { F34.regPipes(k => { const l = netLayers[k]; if (l) for (const c of l.children) if (c.userData.netsSeg === k && !c.userData.under) return c.material; return null; }, hAt); } catch (e) { console.warn('F34.regPipes', e); }   // v0.34
  PIPEREG.forEach((rec, ri) => {
    if (rec.gen === 'PHXR') { phxRed.push(rec); return; }   // v0.14: переход у патрубка насоса — строится PGEO
    let pts = rec.pts;
    if (rec.local) pts = pts.map(p => [rec.cx + p[0], rec.gy + p[1], rec.cz + p[2]]);
    if (rec.gen === 'PHX') { if (!(rec.key in PHN) || rec.r < 0.02) return; rec.net = PHN[rec.key]; }
    if (!rec.net || pts.length < 2) return;
    polySegs(pts, { net: rec.net, gen: rec.gen, r: rec.r, od: rec.od || 2 * rec.r, under: 0, name: rec.name, src: rec.src || (rec.gen === 'RVSD' ? 'АК-004/ГП-005' : 'АК-041'), cf: rec.cf || { plan: 'P', elev: 'P', dn: rec.gen === 'RVSD' ? 'V' : 'P' }, rec: 'REG:' + ri, mt: rec.mt, obj: rec.o, parent: rec.o && rec.o.gS });
    if (rec.eqStart) equipPts.push({ p: pts[0], name: rec.eqStart, net: rec.net });
    if (rec.eqEnd) equipPts.push({ p: pts[pts.length - 1], name: rec.eqEnd, net: rec.net });
  });
  G('FILL', 'Восполнение разрывов по правилу заказчика (одна сеть, одна ось — смещение ≤ 5 см, разрыв ≤ 5 м) — требует уточнения');
  G('RISE', 'Стояки в точках перехода «надземный ↔ подземный», где на ГП-005 конец надземной трассы и начало подземной разнесены');
  for (const s of segs) { s.fam = NI[s.net].fam; s.prod = NI[s.net].prod; }

  /* ---------- 1.9 (v0.15) векторный лист ГП-005 — источник подтверждения ----------
     GP5V — линии слоёв трубопроводов из векторного PDF ГП-005 в координатах сцены (совпадение с трассами модели — 1–2 см):
     v — видимые линии (оси и контуры труб, штрихи пунктира подземных участков);
     h — невидимые линии (слои *_HID листа): труба в этом месте проходит ПОД пересекающей её трубой;
     l — центры подписей и условных знаков, стоящих в разрыве линии.
     Используется только как подтверждение: что соединять, что исключить, какая труба в пересечении ниже. */
  const EV = {};
  const ck = (x, z) => (Math.floor(x) + 4096) * 8192 + Math.floor(z) + 4096;
  if (typeof GP5V !== 'undefined') for (const k in GP5V) {
    const mk = arr => {
      const a = Float32Array.from(arr, v => v / 1000), n = a.length / 4, g = new Map();
      for (let i = 0; i < n; i++) {
        const x0 = Math.floor(Math.min(a[4 * i], a[4 * i + 2]) - 0.25), x1 = Math.floor(Math.max(a[4 * i], a[4 * i + 2]) + 0.25), z0 = Math.floor(Math.min(a[4 * i + 1], a[4 * i + 3]) - 0.25), z1 = Math.floor(Math.max(a[4 * i + 1], a[4 * i + 3]) + 0.25);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = ck(x, z); let l = g.get(key); if (!l) g.set(key, l = []); l.push(i); }
      }
      return { a, g };
    };
    const L = []; for (let i = 0; i < GP5V[k].l.length; i += 2) L.push([GP5V[k].l[i] / 1000, GP5V[k].l[i + 1] / 1000]);
    EV[k] = { v: mk(GP5V[k].v), h: mk(GP5V[k].h), l: L };
  }
  const evD = (E, x, z) => {
    const l = E.g.get(ck(x, z)); if (!l) return 9; let best = 9; const a = E.a;
    for (const i of l) { const ax = a[4 * i], az = a[4 * i + 1], ux = a[4 * i + 2] - ax, uz = a[4 * i + 3] - az, l2 = ux * ux + uz * uz, t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l2)) : 0, d = Math.hypot(x - ax - ux * t, z - az - uz * t); if (d < best) best = d; }
    return best;
  };
  const evDist = (net, x, z) => EV[net] ? Math.min(evD(EV[net].v, x, z), evD(EV[net].h, x, z)) : 9;
  const evHid = (net, x, z) => EV[net] ? evD(EV[net].h, x, z) : 9;
  const evLine = (net, ax, az, bx, bz, tol = 0.14) => {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(d / 0.05)); let f = 0, fh = 0;
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; if (evDist(net, x, z) <= tol) f++; if (evHid(net, x, z) <= tol) fh++; }
    return { f: f / (n + 1), fh: fh / (n + 1), d };
  };
  const evLabel = (net, ax, az, bx, bz) => {
    if (!EV[net]) return false; const ux = bx - ax, uz = bz - az, l2 = ux * ux + uz * uz || 1;
    return EV[net].l.some(([x, z]) => { const t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l2)); return Math.hypot(x - ax - ux * t, z - az - uz * t) <= 0.8; });
  };
  const V15 = { odm: 0, odp: 0, drop: 0, corn: 0, ext: 0, fillV: 0, fillL: 0, fillR: 0, xHid: 0, xCond: 0, xFail: 0, xOk: 0 };

  /* ---------- 2. оборудование ---------- */
  const N = procLogic.N;
  const eqList = [];
  for (const [k, n] of Object.entries(N)) {
    if (!['tank', 'cons', 'src'].includes(n.t)) continue;
    const rad = n.D ? n.D / 2 + 1.6 : (n.t === 'tank' ? 2.5 : 2.2);
    eqList.push({ x: n.p[0], z: n.p[1], rad, name: (n.n || k).split(' (')[0], prod: n.prod, pk: k });
  }
  const PUMP_BOX = PH.pumps.map(p => ({ x0: Math.min(p[0], p[2]) - 0.6, x1: Math.max(p[0], p[2]) + 0.6, z0: Math.min(p[1], p[3]) - 0.6, z1: Math.max(p[1], p[3]) + 0.6, name: 'Насос ' + p[5] }));
  const objBoxes = OBJ.filter(o => !o.maf && !o.net && o.gS && !['427', '431', '799', 'Л', '654.1', '654.2', '901'].includes(o.id)).map(o => { const b = o.pnetBox ? o.pnetBox.clone() : new THREE.Box3().setFromObject(o.gS); return { o, b }; }).filter(q => isFinite(q.b.min.x) && q.b.max.x - q.b.min.x < 60);
  const fireTanks = OBJ.filter(o => (o.id === '654.1' || o.id === '654.2') && o.gS).map(o => ({ o, b: new THREE.Box3().setFromObject(o.gS) }));
  function equipNear(x, z, s) {
    for (const e of equipPts) if (Math.hypot(e.p[0] - x, e.p[2] - z) < 0.05) return { name: e.name, kind: 'патрубок' };
    if (typeof WELLS_DATA !== 'undefined') for (const w of WELLS_DATA) if (Math.hypot(w[0] - x, w[1] - z) < (w[2] || 1) / 2 + 0.35) return { name: 'Колодец (' + (NI[w[3]] ? NI[w[3]].code : 'сети') + ')', kind: 'колодец' };
    if (typeof UG_DATA !== 'undefined') for (const r of UG_DATA.rect) { const h = Math.max(r[2], r[3]) / 2 + 0.4; if (Math.abs(x - r[0]) < h && Math.abs(z - r[1]) < h) return { name: 'Камера (' + (NI[r[5]] ? NI[r[5]].code : 'сети') + ')', kind: 'колодец' }; }
    if (s.fam === 'pv' || s.fam === 'prp') for (const q of fireTanks) { const b = q.b; if (x > b.min.x - 1.5 && x < b.max.x + 1.5 && z > b.min.z - 1.5 && z < b.max.z + 1.5) return { name: '№ ' + q.o.id + ' ' + q.o.name, kind: 'ввод в сооружение (не детализирован)' }; }
    if (s.fam === 'proc') {
      for (const b of PUMP_BOX) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return { name: b.name, kind: 'агрегат' };
      let best = null, bd = Infinity;
      for (const e of eqList) { const d = Math.hypot(e.x - x, e.z - z); if (d < e.rad && d < bd && (!e.prod || compat(e.prod, s.prod) || s.prod === 'G')) { bd = d; best = e; } }
      if (best) return { name: best.name, kind: 'оборудование (подключение в модели не детализировано)', d: bd };
    }
    for (const q of objBoxes) { const b = q.b; if (x > b.min.x - 1.2 && x < b.max.x + 1.2 && z > b.min.z - 1.2 && z < b.max.z + 1.2) return { name: '№ ' + q.o.id + ' ' + q.o.name, kind: 'ввод в сооружение (не детализирован)' }; }
    return null;
  }

  /* ---------- 3. граф: узлы (допуск 3 см в плане, 0,35 м по высоте, в пределах семейства сетей), пространственный индекс ---------- */
  const TOL = 0.03, CS = 0.06, TOLY = 0.35;
  let nodes = [], nIdx = new Map();
  const nkey = (f, i, j) => f + '|' + i + '|' + j;
  function nodeAt(fam, x, y, z, not) {
    const i = Math.round(x / CS), j = Math.round(z / CS);
    let best = null, bd = Infinity;   // ближайший по высоте узел в допуске
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = nIdx.get(nkey(fam, i + di, j + dj)); if (l) for (const n of l) if (n !== not && Math.hypot(n.x - x, n.z - z) <= TOL && Math.abs(n.y - y) <= TOLY && Math.abs(n.y - y) < bd) { bd = Math.abs(n.y - y); best = n; } }
    if (best) return best;
    const n = { id: nodes.length, x, y, z, fam, ends: [] }; nodes.push(n);
    const k = nkey(fam, i, j); if (!nIdx.has(k)) nIdx.set(k, []); nIdx.get(k).push(n); return n;
  }
  const GC = 4; let grid = new Map();
  const gk = (i, j) => i * 10007 + j;
  function buildGraph() {
    nodes = []; nIdx = new Map(); grid = new Map();
    for (const s of segs) {
      if (!s.on) { s.na = s.nb = null; continue; }
      s.na = nodeAt(s.fam, s.a[0], s.a[1], s.a[2]); s.na.ends.push({ s, e: 0, y: s.a[1] });
      s.nb = nodeAt(s.fam, s.b[0], s.b[1], s.b[2], s.na); s.nb.ends.push({ s, e: 1, y: s.b[1] });   // короткий вертикальный элемент не замыкается сам на себя
      const i0 = Math.floor((Math.min(s.a[0], s.b[0]) - 0.3) / GC), i1 = Math.floor((Math.max(s.a[0], s.b[0]) + 0.3) / GC);
      const j0 = Math.floor((Math.min(s.a[2], s.b[2]) - 0.3) / GC), j1 = Math.floor((Math.max(s.a[2], s.b[2]) + 0.3) / GC);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
    }
  }
  const nearSegs = (x, z, r) => { const out = new Set(); for (let i = Math.floor((x - r) / GC); i <= Math.floor((x + r) / GC); i++) for (let j = Math.floor((z - r) / GC); j <= Math.floor((z + r) / GC); j++) { const l = grid.get(gk(i, j)); if (l) for (const s of l) out.add(s); } return out; };
  const segPt = (s, x, z) => { const ax = s.a[0], az = s.a[2], ex = s.b[0] - ax, ez = s.b[2] - az, l2 = ex * ex + ez * ez; const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0; const px = ax + ex * t, pz = az + ez * t; return [Math.hypot(x - px, z - pz), t, px, pz]; };
  const yOn = (s, t) => s.a[1] + (s.b[1] - s.a[1]) * t;
  const outDir3 = (s, e) => { const A = e === 0 ? s.b : s.a, B = e === 0 ? s.a : s.b, d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...d) || 1; return d.map(v => v / l); };
  const outDir = (s, e) => { const A = e === 0 ? s.b : s.a, B = e === 0 ? s.a : s.b, dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  // классификация свободного конца: подъём/опуск, врезка, оборудование или открытый
  function classifyEnd(n) {
    const { s, y } = n.ends[0];
    for (const t of nearSegs(n.x, n.z, 0.5)) {
      if (t === s || !t.on || t.net !== s.net || t.under === s.under) continue;
      const d = Math.min(t.na.ends.length === 1 ? Math.hypot(t.a[0] - n.x, t.a[2] - n.z) : 9, t.nb.ends.length === 1 ? Math.hypot(t.b[0] - n.x, t.b[2] - n.z) : 9);
      if (d <= 0.45 || segPt(t, n.x, n.z)[0] <= 0.12) return { kind: 'подъём/опуск', ref: t };
    }
    let onOther = null;
    for (const t of nearSegs(n.x, n.z, 0.4)) {
      if (t === s || !t.on || t.fam !== s.fam || t.na === n || t.nb === n) continue;
      const [d, tt] = segPt(t, n.x, n.z);
      if (d > Math.max(t.r, 0.05) + 0.03 || Math.abs(yOn(t, tt) - y) >= Math.max(0.35, t.r + s.r + 0.05)) continue;
      if (tt <= 1e-6 || tt >= 1 - 1e-6) {   // v0.14: конец за торцом соосной трубы — разрыв линии, а не врезка
        const od = outDir3(s, n.ends[0].e), lt = Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]) || 1;
        if (Math.abs((od[0] * (t.b[0] - t.a[0]) + od[1] * (t.b[1] - t.a[1]) + od[2] * (t.b[2] - t.a[2])) / lt) > 0.9) continue;
      }
      if (compat(t.prod, s.prod)) return { kind: 'врезка', ref: t };
      onOther = t;
    }
    if (onOther && F32.drainTap(n, s, onOther)) return { kind: 'врезка', ref: onOther, drain: 1 };   // v0.32: дренажная врезка в продуктовую трубу
    const eq = equipNear(n.x, n.z, s);
    if (eq) return { kind: 'оборудование', eq };
    return { kind: 'открытый конец', onOther };
  }
  // пары соосных свободных концов одной сети
  function gapPairs(open) {
    const pairs = [], paired = new Set();
    for (const n of open) {
      if (paired.has(n)) continue;
      const { s, e } = n.ends[0], dir = outDir(s, e);
      let best = null, bd = Infinity, bl = 0;
      for (const m of open) {
        if (m === n || paired.has(m) || m.fam !== n.fam) continue;
        const t = m.ends[0].s; if (t.net !== s.net && !(compat(t.prod, s.prod) && s.fam === 'proc')) continue;
        const vx = m.x - n.x, vz = m.z - n.z, d = Math.hypot(vx, vz); if (d > 8 || d < 1e-4) continue;
        const cos = (vx * dir[0] + vz * dir[1]) / d, md = outDir(t, m.ends[0].e), back = md[0] * dir[0] + md[1] * dir[1];
        const lat = Math.abs(vx * dir[1] - vz * dir[0]), latMax = t.under === s.under ? Math.max(0.05, 0.02 * d) : 0.6;
        if (cos > 0.9 && back < -0.9 && lat <= latMax && (t.under === s.under || d <= 3) && d < bd) { bd = d; best = m; bl = lat; }
      }
      if (best) { paired.add(n); paired.add(best); pairs.push({ n, m: best, d: bd, lat: bl }); }
    }
    return pairs;
  }

  /* ---------- 4. итерация 4: исправление геометрии (только по согласованным правилам; всё фиксируется в журнале исправлений) ---------- */
  const fixes = [];   // {cat, p, net, txt, segs, d}
  // 4.0а (v0.15) наружный диаметр по графике ГП-005: в чертёжной части листа трубы показаны в масштабе двумя контурными линиями.
  //      Ø = расстояние между контурами, приведённое к ряду стальных труб (допуск 9 мм). Статус — «условно: по графике листа».
  const STD_OD = [0.057, 0.076, 0.089, 0.108, 0.133, 0.159, 0.219, 0.273, 0.325], TECH = new Set(['dtl', 'dtz', 'b', 'd', 'gu']);
  function measureOD(s) {
    const E = EV[s.net]; if (!E) return null;
    const ux = s.b[0] - s.a[0], uz = s.b[2] - s.a[2], L = Math.hypot(ux, uz); if (L < 0.15) return null;
    const nx = -uz / L, nz = ux / L, vals = [], a = E.v.a;
    for (const t of [0.25, 0.5, 0.75]) {
      const x = s.a[0] + ux * t, z = s.a[2] + uz * t, l = E.v.g.get(ck(x, z)); if (!l) continue; let dp = 9, dn = 9;
      for (const i of l) {
        const ex = a[4 * i + 2] - a[4 * i], ez = a[4 * i + 3] - a[4 * i + 1], el = Math.hypot(ex, ez); if (el < 0.05 || Math.abs(ex * uz - ez * ux) / (el * L) > 0.08) continue;
        const w = ((x - a[4 * i]) * ex + (z - a[4 * i + 1]) * ez) / (el * el); if (w < -0.02 || w > 1.02) continue;
        const off = (a[4 * i] - x) * nx + (a[4 * i + 1] - z) * nz; if (off > 0.02 && off < dp) dp = off; if (off < -0.02 && -off < dn) dn = -off;
      }
      if (dp < 0.18 && dn < 0.18 && Math.abs(dp - dn) < 0.012) vals.push(dp + dn);
    }
    if (!vals.length) return null; vals.sort((p, q) => p - q);
    const od = vals[vals.length >> 1], st = STD_OD.reduce((b, v) => Math.abs(v - od) < Math.abs(b - od) ? v : b);
    return Math.abs(st - od) <= 0.009 ? st : null;
  }
  for (const s of segs) if (s.gen === 'NETS' && !s.under && !s.tk && TECH.has(s.net)) { const od = measureOD(s); if (od) { s.od = od; s.r = od / 2; s.cf.dn = 'P'; s.odm = 1; V15.odm++; } }
  // 4.0б (v0.15) штрихи подписей и условных знаков, принятые при оцифровке за трубы: отрезок, рядом с которым на векторном листе нет линии трубопровода
  for (const s of segs) {
    if (s.gen !== 'NETS' || s.under || s.tk || !EV[s.net] || !s.on || s.len < 0.02) continue;   // v0.34: s.tk — участок по детальному листу ТК
    let ok = 0; for (const t of [0.2, 0.5, 0.8]) if (evDist(s.net, s.a[0] + (s.b[0] - s.a[0]) * t, s.a[2] + (s.b[2] - s.a[2]) * t) <= 0.14) ok++;
    if (ok) continue;
    s.on = 0; V15.drop++;
    fixes.push({ cat: 'DROP', p: [(s.a[0] + s.b[0]) / 2, s.a[1], (s.a[2] + s.b[2]) / 2], net: s.net, segs: [s], d: s.len, txt: `отрезок ${fmt(s.len, 2)} м — штрих подписи или условного знака на ГП-005 (линии трубопровода на векторном листе здесь нет); исключён` });
  }
  // 4.0 (v0.14) выходы из цеха 200: перемычка PH.conn (0,11–0,13 м) соединяла конец трубы АК-041 (М 1:50) с концом трассы ГП-005 (М 1:500)
  //     зигзагом: оси разнесены на 6–8 см, концы заходят друг за друга на 0,11 м. Конец трассы ГП-005 совмещается с концом трубы АК-041,
  //     перемычка исключается. Только при смещении оси ≤ 0,10 м и длине перемычки ≤ 0,2 м; остальные выходы не трогаются.
  for (const c of segs.filter(q => q.gen === 'PHC' && q.on)) {
    if (Math.hypot(c.b[0] - c.a[0], c.b[2] - c.a[2]) > 0.2 || Math.hypot(c.b[0] - c.a[0], c.b[2] - c.a[2]) < 0.01) continue;   // v0.29: вертикальный стояк у стены — не перемычка
    for (const [ke, kp] of [['b', 'a'], ['a', 'b']]) {
      const E = c[ke], Pp = c[kp];
      const t = segs.find(s => s.gen === 'NETS' && s.on && ['a', 'b'].some(k => Math.hypot(s[k][0] - E[0], s[k][2] - E[2]) < 0.03));
      if (!t) continue;
      const k = Math.hypot(t.a[0] - E[0], t.a[2] - E[2]) < 0.03 ? 'a' : 'b', o = k === 'a' ? t.b : t.a;
      const ux = t[k][0] - o[0], uz = t[k][2] - o[2], L = Math.hypot(ux, uz); if (L < 0.3) continue;
      const lat = Math.abs((Pp[0] - o[0]) * uz - (Pp[2] - o[2]) * ux) / L; if (lat > 0.1) continue;
      const d = Math.hypot(t[k][0] - Pp[0], t[k][2] - Pp[2]);
      t[k] = [Pp[0], t[k][1], Pp[2]]; t.len = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]); c.on = 0;
      for (const r of segs) if (r.gen === 'PHC' && r !== c && r.on && Math.hypot(r.a[0] - E[0], r.a[2] - E[2]) < 0.03 && Math.hypot(r.b[0] - E[0], r.b[2] - E[2]) < 0.03) { r.a = [Pp[0], r.a[1], Pp[2]]; r.b = [Pp[0], r.b[1], Pp[2]]; }   // v0.29
      fixes.push({ cat: 'ALIGN', p: [Pp[0], Pp[1], Pp[2]], net: t.net, segs: [t, c], d, txt: `конец трассы ГП-005 совмещён с концом трубы АК-041 у стены цеха (перенос ${fmt(d, 3)} м, смещение оси ${fmt(lat, 3)} м); перемычка PH.conn «${c.name || ''}» исключена` });
      break;
    }
  }
  // 4.1 контуры трубы с чертежа: линия ГП-005, параллельная оси той же сети на 0,06–0,14 м только с одной стороны
  {
    const L = segs.filter(s => s.gen === 'NETS' && s.on && s.len > 0.2 && s.net !== 'heat');
    const side = new Map();   // s → {l, r}
    const loc = new Map(); for (const s of L) { const k = Math.floor((s.a[0] + s.b[0]) / 8) + '|' + Math.floor((s.a[2] + s.b[2]) / 8); if (!loc.has(k)) loc.set(k, []); loc.get(k).push(s); }
    const near = s => { const cx = Math.floor((s.a[0] + s.b[0]) / 8), cz = Math.floor((s.a[2] + s.b[2]) / 8), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of loc.get((cx + i) + '|' + (cz + j)) || []) out.push(t); return out; };
    const rel = (s, t) => {   // смещение t относительно s (со знаком) при параллельности и перекрытии
      const ux = s.b[0] - s.a[0], uz = s.b[2] - s.a[2], lu = Math.hypot(ux, uz), vx = t.b[0] - t.a[0], vz = t.b[2] - t.a[2], lv = Math.hypot(vx, vz);
      if (Math.abs(ux * vz - uz * vx) / (lu * lv) > 0.03) return null;
      const off = ((t.a[0] - s.a[0]) * uz - (t.a[2] - s.a[2]) * ux) / lu;
      const t0 = ((t.a[0] - s.a[0]) * ux + (t.a[2] - s.a[2]) * uz) / lu, t1 = ((t.b[0] - s.a[0]) * ux + (t.b[2] - s.a[2]) * uz) / lu;
      const ov = Math.min(lu, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
      return ov > 0.3 ? off : null;
    };
    for (const s of L) { const v = { l: 0, r: 0 }; for (const t of near(s)) { if (t === s || t.net !== s.net) continue; const o = rel(s, t); if (o === null) continue; const a = Math.abs(o); if (a < 0.06 || a > 0.14) continue; if (o > 0) v.l++; else v.r++; } side.set(s, v); }
    const axis = s => { const v = side.get(s); return v && v.l > 0 && v.r > 0; };
    for (const t of L) {
      if (axis(t)) continue; const v = side.get(t); if (!v || (!v.l && !v.r)) continue;
      const a = near(t).find(s => s !== t && s.net === t.net && axis(s) && (() => { const o = rel(s, t); return o !== null && Math.abs(o) >= 0.06 && Math.abs(o) <= 0.14; })());
      if (!a) continue;
      t.on = 0; t.contour = 1;
      fixes.push({ cat: 'CONT', p: [(t.a[0] + t.b[0]) / 2, t.a[1], (t.a[2] + t.b[2]) / 2], net: t.net, segs: [t], d: Math.abs(rel(a, t)), txt: `линия ${fmt(t.len, 1)} м на ${fmt(Math.abs(rel(a, t)), 3)} м от оси — исключена как контур трубы (ось сохранена)` });
    }
  }
  // 4.2 наложения отрезков ГП-005 одной сети: вложенный — исключается, частичное наложение — конец переносится на конец соседа
  {
    const L = segs.filter(s => s.gen === 'NETS' && s.on && s.len > 0.02);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const s = L[i], t = L[j]; if (!s.on || !t.on || s.net !== t.net) continue;
      if (Math.max(s.a[0], s.b[0]) < Math.min(t.a[0], t.b[0]) - 0.05 || Math.max(t.a[0], t.b[0]) < Math.min(s.a[0], s.b[0]) - 0.05 || Math.max(s.a[2], s.b[2]) < Math.min(t.a[2], t.b[2]) - 0.05 || Math.max(t.a[2], t.b[2]) < Math.min(s.a[2], s.b[2]) - 0.05) continue;
      const ux = s.b[0] - s.a[0], uz = s.b[2] - s.a[2], lu = Math.hypot(ux, uz), vx = t.b[0] - t.a[0], vz = t.b[2] - t.a[2], lv = Math.hypot(vx, vz);
      if (Math.abs(ux * vz - uz * vx) / (lu * lv) > 0.03) continue;
      if (Math.abs((t.a[0] - s.a[0]) * uz - (t.a[2] - s.a[2]) * ux) / lu > 0.03) continue;
      const pa = ((t.a[0] - s.a[0]) * ux + (t.a[2] - s.a[2]) * uz) / lu, pb = ((t.b[0] - s.a[0]) * ux + (t.b[2] - s.a[2]) * uz) / lu;
      const lo = Math.min(pa, pb), hi = Math.max(pa, pb), ov = Math.min(lu, hi) - Math.max(0, lo); if (ov < 0.02) continue;
      const P = [(t.a[0] + t.b[0]) / 2, t.a[1], (t.a[2] + t.b[2]) / 2];
      if (lo >= -0.02 && hi <= lu + 0.02) { t.on = 0; fixes.push({ cat: 'TRIM', p: P, net: t.net, segs: [t, s], d: ov, txt: `отрезок ${fmt(t.len, 2)} м целиком лежит на соседнем — исключён` }); continue; }
      if (lo <= 0.02 && hi >= lu - 0.02) { s.on = 0; fixes.push({ cat: 'TRIM', p: P, net: s.net, segs: [s, t], d: ov, txt: `отрезок ${fmt(s.len, 2)} м целиком лежит на соседнем — исключён` }); continue; }
      // частичное наложение: конец t внутри s переносится на ближний конец s
      const endIn = (pa > 0 && pa < lu) ? 'a' : 'b', q = endIn === 'a' ? pa : pb, tgt = (q < lu / 2) ? s.a : s.b;
      t[endIn] = [tgt[0], t[endIn][1], tgt[2]]; t.len = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]);
      fixes.push({ cat: 'TRIM', p: P, net: t.net, segs: [t, s], d: ov, txt: `наложение ${fmt(ov, 2)} м устранено: конец отрезка перенесён на конец соседнего` });
    }
  }
  // 4.2а стояки В2/В10 у РВС: конец трассы ГП-005, заходящий за основание стояка (к стенке резервуара), переносится на основание
  for (const r of segs.filter(q => q.gen === 'RVSD' && (q.net === 'pv' || q.net === 'prp') && Math.hypot(q.b[0] - q.a[0], q.b[2] - q.a[2]) < 1e-3 && q.b[1] - q.a[1] > 2)) {
    const fx = r.a[0], fz = r.a[2];
    for (const t of segs) {
      if (t.gen !== 'NETS' || !t.on || t.net !== r.net) continue;
      for (const k of ['a', 'b']) {
        const o = k === 'a' ? t.b : t.a, d = Math.hypot(t[k][0] - fx, t[k][2] - fz); if (d < 0.01 || d > 0.6) continue;
        const ux = t[k][0] - o[0], uz = t[k][2] - o[2], L = Math.hypot(ux, uz), along = ((fx - o[0]) * ux + (fz - o[2]) * uz) / L, lat = Math.abs((fx - o[0]) * uz - (fz - o[2]) * ux) / L;
        if (lat > 0.05 || along < 0.05 || along > L + 0.6) continue;
        fixes.push({ cat: 'TRIM', p: [fx, r.a[1], fz], net: t.net, segs: [t, r], d, txt: `конец трассы ГП-005 перенесён на основание стояка у РВС (${fmt(d, 2)} м)` });
        t[k] = [fx, t[k][1], fz]; t.len = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]);
      }
    }
  }
  buildGraph();
  // 4.3 (v0.15) соединение свободных концов — только с подтверждением:
  //   V — на векторном ГП-005 между концами проходит линия этой сети (видимая или невидимая);
  //   L — концы соосны, в разрыве стоит подпись линии или условный знак (разрыв линии под надпись);
  //   R — правило заказчика: одна сеть, соосность ≤ 5 см, разрыв ≤ 5 м (остаётся «требует уточнения»).
  {
    const freeEnds = () => {
      const out = [];
      for (const n of nodes) {
        if (n.ends.length !== 1) continue; const k = classifyEnd(n).kind; if (k !== 'открытый конец' && k !== 'оборудование') continue;
        const e = n.ends[0], d = outDir(e.s, e.e); out.push({ n, s: e.s, e: e.e, x: n.x, z: n.z, y: e.y, dx: d[0], dz: d[1], k });
      }
      return out;
    };
    const setEnd = (q, x, z) => { q.s[q.e === 0 ? 'a' : 'b'] = [x, q.y, z]; q.s.len = Math.hypot(q.s.b[0] - q.s.a[0], q.s.b[1] - q.s.a[1], q.s.b[2] - q.s.a[2]); };
    // а) повороты: два конца одной сети сходятся под углом и не доходят до вершины (на листе отвод показан дугой)
    {
      const E = freeEnds().filter(q => !q.s.under && q.s.gen === 'NETS' && EV[q.s.net]), cand = [];
      for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
        const a = E[i], b = E[j]; if (a.s.net !== b.s.net || Math.abs(a.y - b.y) > 0.15) continue;
        const cr = a.dx * b.dz - a.dz * b.dx; if (Math.abs(cr) < 0.5) continue;
        const wx = b.x - a.x, wz = b.z - a.z, s = (wx * b.dz - wz * b.dx) / cr, t = (wx * a.dz - wz * a.dx) / cr;
        if (s < 0.005 || t < 0.005 || s > 0.6 || t > 0.6) continue;
        const X = [a.x + a.dx * s, a.z + a.dz * s]; if (evDist(a.s.net, X[0], X[1]) > 0.3) continue;
        cand.push({ a, b, s, t, X });
      }
      cand.sort((p, q) => p.s + p.t - q.s - q.t); const used = new Set();
      for (const { a, b, s, t, X } of cand) {
        if (used.has(a.n) || used.has(b.n)) continue; used.add(a.n); used.add(b.n);
        setEnd(a, X[0], X[1]); setEnd(b, X[0], X[1]); V15.corn++;
        fixes.push({ cat: 'CORN', p: [X[0], a.y, X[1]], net: a.s.net, segs: [a.s, b.s], d: Math.max(s, t), txt: `поворот трассы: концы доведены до вершины угла (${fmt(s, 2)} и ${fmt(t, 2)} м) — на векторном ГП-005 здесь отвод, показанный дугой` });
      }
      if (cand.length) buildGraph();
    }
    // б) соосные концы
    {
      const E = freeEnds(), cand = [];
      for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
        const a = E[i], b = E[j]; if (a.s.net !== b.s.net) continue;
        const vx = b.x - a.x, vz = b.z - a.z, d = Math.hypot(vx, vz); if (d < 1e-4 || d > 12) continue;
        if ((vx * a.dx + vz * a.dz) / d < 0.985 || -(vx * b.dx + vz * b.dz) / d < 0.985) continue;
        const lat = Math.abs(vx * a.dz - vz * a.dx), mixed = a.s.under !== b.s.under, ecc = lat > (mixed ? 0.08 : 0.05); if (ecc && (mixed || lat > 0.12 || d > 0.8)) continue;
        const net = a.s.net, ev = EV[net] ? evLine(net, a.x, a.z, b.x, b.z) : { f: 0, fh: 0 };
        let basis = null;
        if (ev.f >= 0.9) basis = 'V';
        else if (!ecc && d <= 9 && evLabel(net, a.x, a.z, b.x, b.z)) basis = 'L';
        else if (d <= 5 && lat <= 0.05 && !((a.k === 'оборудование' || b.k === 'оборудование') && d > 0.3)) basis = 'R';
        if (basis) cand.push({ a, b, d, lat, basis, ecc, hid: ev.fh * d >= 0.08 });
      }
      cand.sort((p, q) => p.d - q.d); const used = new Set();
      const BT = { V: 'на векторном ГП-005 линия между концами непрерывна', L: 'разрыв линии под подпись или условный знак на ГП-005', R: 'по правилу заказчика (соосность ≤ 5 см, разрыв ≤ 5 м)' };
      for (const { a, b, d, lat, basis, hid, ecc } of cand) {
        if (used.has(a.n) || used.has(b.n)) continue; used.add(a.n); used.add(b.n);
        const s = a.s, t = b.s, n = a.n, m = b.n; V15['fill' + basis]++;
        const base = { net: s.net, r: s.r, od: s.od, src: s.src, cf: { plan: basis === 'R' ? 'R' : 'V', elev: 'P', dn: s.cf.dn }, fill: 1, basis, hid: hid ? 1 : 0, fam: s.fam, prod: s.prod };
        if (s.under === t.under) {
          const ns = addSeg({ ...base, gen: s.gen, under: s.under, ay: s.ay, a: [n.x, a.y, n.z], b: [m.x, b.y, m.z], mt: s.mt, obj: s.obj, cas: s.cas, sub: s.sub, rec: s.rec, name: ecc ? 'Переход со смещением оси (эксцентрический — по ГП-005)' : 'Восполненный разрыв линии' });
          fixes.push({ cat: 'FILL', basis, p: [(n.x + m.x) / 2, (a.y + b.y) / 2, (n.z + m.z) / 2], net: s.net, segs: [ns, s, t], d, txt: `разрыв ${fmt(d, 2)} м соединён ${ecc ? 'со смещением оси — на листе здесь переход (вероятно, эксцентрический)' : 'по оси'} (смещение ${fmt(lat, 3)} м): ${BT[basis]}` + (hid ? '; линия невидимая — труба проходит под пересекающей' : '') });
        } else {
          const A = s.under ? b : a, U = s.under ? a : b, sa = A.s, su = U.s, ay = sa.ay || 0.6, yTop = hAt(U.x, U.z) + ay;
          const ns = addSeg({ ...base, r: sa.r, od: sa.od, gen: 'NETS', under: 0, ay, a: [A.x, A.y, A.z], b: [U.x, yTop, U.z], mt: sa.mt, obj: sa.obj, name: 'Восполненный разрыв до точки перехода под землю' });
          const nr = addSeg({ ...base, r: sa.r, od: sa.od, gen: 'RISE', under: 0, a: [U.x, U.y, U.z], b: [U.x, yTop, U.z], mt: sa.mt, obj: sa.obj, name: 'Стояк подъёма/опуска' });
          fixes.push({ cat: 'FILL', basis, p: [U.x, yTop, U.z], net: s.net, segs: [ns, nr, sa, su], d, txt: `надземный конец продлён на ${fmt(d, 2)} м до точки перехода под землю, добавлен стояк ${fmt(yTop - U.y, 2)} м: ${BT[basis]}` });
        }
      }
      buildGraph();
    }
    // в) конец не доходит до трубы той же сети, а линия на векторном листе доходит: конец продлевается до оси трубы (врезка/отвод).
    //    Если за трубой линия идёт дальше и там уже есть участок модели — четырёхсторонний узел (труба делится в точке узла).
    for (let pass = 0; pass < 60; pass++) {
      const E = freeEnds().filter(q => !q.s.under && q.s.gen === 'NETS' && EV[q.s.net]); let did = false;
      for (const a of E) {
        const net = a.s.net, hits = [];
        for (const t of nearSegs(a.x + a.dx * 1.8, a.z + a.dz * 1.8, 2.4)) {
          if (!t.on || t === a.s || t.under || t.net !== net || t.na === a.n || t.nb === a.n) continue;
          const ux = t.b[0] - t.a[0], uz = t.b[2] - t.a[2], lt = Math.hypot(ux, uz), cr = a.dx * uz - a.dz * ux; if (lt < 1e-3 || Math.abs(cr) / lt < 0.2) continue;
          const wx = t.a[0] - a.x, wz = t.a[2] - a.z, u = (wx * uz - wz * ux) / cr, w = (wx * a.dz - wz * a.dx) / cr;
          if (u < 0.005 || u > 3.5 || w < -0.03 / lt || w > 1 + 0.03 / lt) continue;
          const wc = Math.max(0, Math.min(1, w)); if (Math.abs(yOn(t, wc) - a.y) > 0.35) continue;
          hits.push({ t, u, w: wc });
        }
        hits.sort((p, q) => p.u - q.u);
        for (const h of hits) {
          let X = [a.x + a.dx * h.u, a.z + a.dz * h.u];
          if (evLine(net, a.x, a.z, X[0], X[1]).f < 0.9) break;
          const r1 = h.t.r + 0.07, beyond = evLine(net, X[0] + a.dx * r1, X[1] + a.dz * r1, X[0] + a.dx * (r1 + 0.3), X[1] + a.dz * (r1 + 0.3));
          let far = null;
          if (beyond.f >= 0.85) {
            for (const m of nodes) {
              if (m === a.n || m.ends.length !== 1) continue; const e = m.ends[0]; if (e.s.net !== net || e.s.under || e.s.gen !== 'NETS' || e.s === h.t) continue;
              const dm = outDir(e.s, e.e); if (dm[0] * a.dx + dm[1] * a.dz > -0.9 || Math.hypot(m.x - X[0], m.z - X[1]) > h.t.r + 0.1) continue;
              far = e; break;
            }
            if (!far) continue;   // линия на листе идёт дальше, участка модели за трубой нет — пересечение, а не врезка
          }
          for (const p of [h.t.a, h.t.b]) if (Math.hypot(p[0] - X[0], p[2] - X[1]) < 0.04) X = [p[0], p[2]];
          if (far) {
            const t = h.t, yx = yOn(t, h.w);
            if (Math.hypot(t.a[0] - X[0], t.a[2] - X[1]) > 0.04 && Math.hypot(t.b[0] - X[0], t.b[2] - X[1]) > 0.04) {
              const nb = addSeg({ ...t, cf: { ...t.cf }, a: [X[0], yx, X[1]], b: t.b.slice() }); nb.fam = t.fam; nb.prod = t.prod;
              t.b = [X[0], yx, X[1]]; t.len = Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]);
            }
            far.s[far.e === 0 ? 'a' : 'b'] = [X[0], far.y, X[1]];
          }
          setEnd(a, X[0], X[1]); did = true; V15.ext++;
          fixes.push({ cat: 'EXT', p: [X[0], a.y, X[1]], net, segs: [a.s, h.t], d: h.u, txt: `конец продлён на ${fmt(h.u, 2)} м до трубы той же сети — на векторном ГП-005 линия доходит до неё` + (far ? '; за трубой линия продолжается — четырёхсторонний узел' : '') });
          break;
        }
        if (did) break;
      }
      if (!did) break;
      buildGraph();
    }
  }
  // 4.4 отметки осей надземных трасс ГП-005: в узлах (непрерывная линия без ступенек); если в узле есть труба с заданной отметкой (цех, эстакада, обвязка РВС, насосы) — по ней
  {
    const FIXED = new Set(['PH', 'PHC', 'ESTQ', 'RVSD', 'PHX']);
    for (const n of nodes) {
      const E = n.ends.filter(q => (q.s.gen === 'NETS' || (q.s.gen === 'RISE' && q.e === 1)) && !q.s.under); if (!E.length) continue;
      const f = n.ends.find(q => FIXED.has(q.s.gen));
      const y = f ? f.y : hAt(n.x, n.z) + (E[0].s.ay || 0.6);
      for (const q of E) { q.s[q.e === 0 ? 'a' : 'b'][1] = y; q.y = y; }
      n.y = y;
    }
    for (const s of segs) if (s.on) s.len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
  }
  buildGraph();
  // 4.5 (v0.15) диаметр по графике распространяется вдоль участка до ближайшего ветвления (Ø трубы без перехода не меняется)
  {
    let ch = true, guard = 0;
    while (ch && guard++ < 200) {
      ch = false;
      for (const n of nodes) {
        if (n.ends.length > 2) {   // через тройник — только вдоль прямого прохода (магистраль)
          for (let i = 0; i < n.ends.length; i++) for (let j = i + 1; j < n.ends.length; j++) {
            const A = n.ends[i], C = n.ends[j], a = A.s, b = C.s; if (a.gen !== 'NETS' || b.gen !== 'NETS' || a.net !== b.net || a.under || b.under || !TECH.has(a.net)) continue;
            const da = outDir(a, A.e), db = outDir(b, C.e); if (da[0] * db[0] + da[1] * db[1] > -0.985) continue;
            if (a.odm && !b.odm && !b.od) { b.od = a.od; b.r = a.r; b.cf.dn = 'P'; b.odm = 3; V15.odp++; ch = true; }
            else if (b.odm && !a.odm && !a.od) { a.od = b.od; a.r = b.r; a.cf.dn = 'P'; a.odm = 3; V15.odp++; ch = true; }
          }
          continue;
        }
        if (n.ends.length !== 2) continue; const a = n.ends[0].s, b = n.ends[1].s;
        if (a.gen !== 'NETS' || b.gen !== 'NETS' || a.net !== b.net || a.under || b.under || !TECH.has(a.net)) continue;
        if (a.odm && !b.odm && !b.od) { b.od = a.od; b.r = a.r; b.cf.dn = 'P'; b.odm = 2; V15.odp++; ch = true; }
        else if (b.odm && !a.odm && !a.od) { a.od = b.od; a.r = b.r; a.cf.dn = 'P'; a.odm = 2; V15.odp++; ch = true; }
      }
    }
  }
  F28.applyOD(segs); F28.applyIns(segs); F31.applyIns(segs); F32.applyOD(segs);   // v0.31: изоляция коллектора 186 (186-ТХ.ВТ); v0.32: Ø отводов к РГС
    // v0.28: Ø наружных участков по подписям ТК/ТХ; теплоизоляция ДТ(Л) по 152-ТК.ВТ, 177-ТХ.ВТ, 186-ТХ.ВТ
  for (const s of segs) if (s.on) { const g = G(s.fill && s.gen !== 'RISE' ? 'FILL' : s.gen); g.segs++; g.len += s.len; }

  /* ---------- 5. участки (трубопроводы): цепочки элементов между узлами ветвления/концами ---------- */
  const pipes = [];
  const sameRun = (s, t) => s.net === t.net && s.gen === t.gen && s.under === t.under && (s.od || 0) === (t.od || 0);
  {
    const used = new Uint8Array(segs.length);
    const other = (n, s) => { const o = n.ends.filter(e => e.s !== s); return n.ends.length === 2 && o.length === 1 && sameRun(s, o[0].s) ? o[0].s : null; };
    const cnt = {};
    for (const s0 of segs) {
      if (!s0.on || used[s0.id]) continue;
      let s = s0, from = s0.na, guard = 0;
      while (guard++ < 5000) { const t = other(from, s); if (!t || used[t.id] || t === s0) break; from = t.na === from ? t.nb : t.na; s = t; }
      const list = []; let cur = s, nA = from; guard = 0;
      while (cur && !used[cur.id] && guard++ < 5000) {
        used[cur.id] = 1; list.push(cur);
        const nB = cur.na === nA ? cur.nb : cur.na; const t = other(nB, cur); nA = nB; cur = t;
      }
      const first = list[0], nStart = from, nEnd = nA;
      const code = NI[first.net].code; cnt[code] = (cnt[code] || 0) + 1;
      const p = { id: code + '-' + String(cnt[code]).padStart(3, '0'), net: first.net, gen: first.gen, under: first.under, cas: first.cas, segs: list, na: nStart, nb: nEnd, od: first.od, r: first.r, src: first.src, cf: first.cf, name: first.name, mt: first.mt, obj: first.obj, len: list.reduce((a, q) => a + q.len, 0), issues: [], proc: [], fill: list.some(q => q.fill), parent: first.parent };
      const pts = []; let n = nStart;
      list.forEach((q, i) => { q.pidx = i; });
      for (const q of list) { const fwd = q.na === n; q.pfwd = fwd; const A = fwd ? q.a : q.b, B = fwd ? q.b : q.a; if (!pts.length) pts.push(A); pts.push(B); n = fwd ? q.nb : q.na; }
      p.pts = pts; list.forEach(q => q.pipe = p); pipes.push(p); G(first.gen).pipes++;
    }
  }
  const nid = n => 'У-' + String(n.id + 1).padStart(4, '0');

  /* ---------- 5.5 (v0.15) пересечения надземных труб: развод по высоте ----------
     Какая труба ниже: 1) по векторному ГП-005 — труба, показанная в пересечении невидимой линией (слой *_HID), проходит под другой;
     2) если данных нет — условно: труба с заданной отметкой (цех, эстакада, обвязка РВС) остаётся на месте, трасса ГП-005 обходит её сверху;
        из двух трасс ГП-005 ниже остаётся идущая с запада на восток. Отметки осей по документам не заданы — высота обхода условна.
     Верхняя труба получает местный подъём над нижней (зазор 3 см между стенками), уклон рамп ≈ 1:2; у концов участка и у врезок отметка не меняется. */
  const rEff = s => s.net === 'heat' ? s.r * 1.5 : s.r;
  for (const p of pipes) { const c = [0]; for (let i = 0; i < p.pts.length - 1; i++) c.push(c[i] + Math.hypot(p.pts[i + 1][0] - p.pts[i][0], p.pts[i + 1][1] - p.pts[i][1], p.pts[i + 1][2] - p.pts[i][2])); p.cum = c; }
  const arcOf = (s, t) => { const p = s.pipe, i = s.pidx; return p.cum[i] + (s.pfwd ? t : 1 - t) * (p.cum[i + 1] - p.cum[i]); };
  const yEff = (s, t) => yOn(s, t) + (s.pipe && s.pipe.offAt ? s.pipe.offAt(arcOf(s, t)) : 0);
  function crossList() {
    const out = [];
    for (const s of segs) {
      if (!s.on || s.under || s.len < 0.05 || !s.pipe) continue;
      for (const t of nearSegs((s.a[0] + s.b[0]) / 2, (s.a[2] + s.b[2]) / 2, s.len / 2 + 0.3)) {
        if (t.id <= s.id || !t.on || t.under || t.len < 0.05 || !t.pipe) continue;
        if (s.na === t.na || s.na === t.nb || s.nb === t.na || s.nb === t.nb) continue;
        const ax = s.a[0], az = s.a[2], ux = s.b[0] - ax, uz = s.b[2] - az, bx = t.a[0], bz = t.a[2], vx = t.b[0] - bx, vz = t.b[2] - bz;
        const den = ux * vz - uz * vx, lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
        if (lu < 1e-3 || lv < 1e-3 || Math.abs(den) / (lu * lv) < 0.05) continue;
        const ts = ((bx - ax) * vz - (bz - az) * vx) / den, tt = ((bx - ax) * uz - (bz - az) * ux) / den;
        if (ts <= 0.002 || ts >= 0.998 || tt <= 0.002 || tt >= 0.998) continue;
        out.push({ s, t, ts, tt, x: ax + ux * ts, z: az + uz * ts });
      }
    }
    return out;
  }
  const XR = new Map(), xkey = (s, t) => s.id + '|' + t.id;
  {
    const bumps = new Map(), movable = s => s.gen === 'NETS';
    const add = (s, t, d, w) => { let l = bumps.get(s.pipe); if (!l) bumps.set(s.pipe, l = []); l.push({ s: arcOf(s, t), d, w }); };
    for (const c of crossList()) {
      const { s, t, ts, tt, x, z } = c, ys = yOn(s, ts), yt = yOn(t, tt), need = rEff(s) + rEff(t) + 0.03;
      if (Math.abs(ys - yt) >= need) continue;
      const hs = s.hid || evHid(s.net, x, z) <= 0.09, ht = t.hid || evHid(t.net, x, z) <= 0.09;
      let low, basis;
      if (hs !== ht) { low = hs ? s : t; basis = 'H'; }
      else {
        basis = 'C';
        if (movable(s) !== movable(t)) low = movable(s) ? t : s;
        else { const ew = q => Math.abs(q.b[0] - q.a[0]) >= Math.abs(q.b[2] - q.a[2]); low = ew(s) !== ew(t) ? (ew(s) ? s : t) : (rEff(s) > rEff(t) ? s : rEff(t) > rEff(s) ? t : (s.id < t.id ? s : t)); }
      }
      const up = low === s ? t : s, tl = low === s ? ts : tt, tu = low === s ? tt : ts, yl = yOn(low, tl), yu = yOn(up, tu);
      let done = false;
      if (movable(up)) { add(up, tu, yl + need - yu, rEff(low) + 0.12); done = true; }
      else if (movable(low)) { const d = yu - need - yl; if (yl + d - rEff(low) >= hAt(x, z) + 0.08) { add(low, tl, d, rEff(up) + 0.12); done = true; } }
      XR.set(xkey(s, t), { low, up, basis, done });
    }
    // концы-врезки: участок примыкает к другой трубе; подвижное ответвление следует за отметкой магистрали, у неподвижного — магистраль в этой точке не поднимается
    const tie = new Map(), fixedAt = new Map();
    for (const n of nodes) {
      if (n.ends.length !== 1) continue; const c = classifyEnd(n); if (c.kind !== 'врезка' || !c.ref.pipe) continue;
      const s = n.ends[0].s, p = s.pipe, m = c.ref.pipe; if (!p || (p.na === n) === (p.nb === n)) continue;
      const sm = arcOf(c.ref, segPt(c.ref, n.x, n.z)[1]);
      if (p.gen === 'NETS') { let o = tie.get(p); if (!o) tie.set(p, o = {}); o[p.na === n ? 'a' : 'b'] = { m, sm }; }
      else { let l = fixedAt.get(m); if (!l) fixedAt.set(m, l = []); l.push(sm); }
    }
    const FLAT = 0.38, TAP = 0.3, prof = new Map();
    // соседние подъёмы (между площадками меньше 3 м) объединяются: труба идёт вторым ярусом над всей группой пересекаемых труб, без «волн»
    const mergeB = B0 => {
      const out = [];
      for (const sg of [1, -1]) {
        let cur = null;
        for (const b of B0.filter(q => (q.d > 0) === (sg > 0)).sort((u, v) => u.s - v.s)) {
          if (cur && b.s - b.w - cur.s1 < 3) { cur.s1 = Math.max(cur.s1, b.s + b.w); cur.d = sg > 0 ? Math.max(cur.d, b.d) : Math.min(cur.d, b.d); }
          else out.push(cur = { s0: b.s - b.w, s1: b.s + b.w, d: b.d });
        }
      }
      return out.map(c => ({ s: (c.s0 + c.s1) / 2, w: (c.s1 - c.s0) / 2, d: c.d }));
    };
    const rebuild = () => {   // v0.28: перестроение профилей (вызывается повторно при доразведении)
      for (const p of pipes) if (p.pts0) { p.pts = p.pts0; delete p.pts0; delete p.offAt; delete p.arcs; delete p.bumps; }
      prof.clear();
    for (const [p, B0] of bumps) {
        const B = mergeB(B0), L = p.cum[p.cum.length - 1], T = tie.get(p) || {}, A = [...(T.a ? [] : [0]), ...(T.b ? [] : [L]), ...(fixedAt.get(p) || [])];
        for (const b of B) b.lr = Math.max(0.4, 2 * Math.abs(b.d));
        const own = sa => {
          let upv = 0, dn = 0;
          for (const b of B) { const k = Math.max(0, Math.min(1, (sa - (b.s - b.w - b.lr)) / b.lr, ((b.s + b.w + b.lr) - sa) / b.lr)); if (b.d > 0) upv = Math.max(upv, b.d * k); else dn = Math.min(dn, b.d * k); }
          let e = 1; for (const a of A) e = Math.min(e, Math.max(0, (Math.abs(sa - a) - FLAT) / TAP));
          return (upv + dn) * e;
        };
        prof.set(p, { own, B, A });
      }
      for (const [p, T] of tie) {   // ответвления без собственных подъёмов, но примыкающие к поднятой магистрали
        if (prof.has(p)) continue; if (['a', 'b'].some(k => T[k] && prof.has(T[k].m) && Math.abs(prof.get(T[k].m).own(T[k].sm)) > 0.01)) prof.set(p, { own: () => 0, B: [], A: [] });
      }
      for (const [p, P] of prof) {
        const L = p.cum[p.cum.length - 1], T = tie.get(p) || {}, F = [];
        for (const k of ['a', 'b']) if (T[k]) { const pm = prof.get(T[k].m), om = pm ? pm.own(T[k].sm) : 0; if (Math.abs(om) > 0.01) F.push({ s: k === 'a' ? 0 : L, d: om, lr: Math.max(0.4, 2 * Math.abs(om)), k }); }
        const follow = sa => { let v = 0; for (const f of F) v += f.d * Math.max(0, 1 - Math.abs(sa - f.s) / f.lr); return v; };
        const off = sa => P.own(sa) + follow(sa);
        const S = new Set(p.cum.map(v => +v.toFixed(3)));
        const addS = v => { if (v > 0.01 && v < L - 0.01) S.add(+v.toFixed(3)); };
        for (const b of P.B) for (const v of [b.s - b.w - b.lr, b.s - b.w, b.s + b.w, b.s + b.w + b.lr]) addS(v);
        for (const a of P.A) if (P.B.some(b => Math.abs(b.s - a) < b.w + b.lr + FLAT + TAP)) for (const v of [a - FLAT - TAP, a - FLAT, a + FLAT, a + FLAT + TAP]) addS(v);
        for (const f of F) addS(f.s === 0 ? f.lr : L - f.lr);
        const arr = [...S].sort((u, v) => u - v), pts = [], arcs = []; let i = 0, last = -1;   // v0.18: arcs — положение точки по длине исходной оси (поток ГСМ)
        for (const sa of arr) {
          if (sa - last < 0.025 && sa > 0 && sa < L - 1e-6) continue; last = sa;
          while (i < p.cum.length - 2 && p.cum[i + 1] < sa) i++;
          const l = p.cum[i + 1] - p.cum[i], k = l > 1e-9 ? (sa - p.cum[i]) / l : 0, P0 = p.pts[i], P1 = p.pts[i + 1];
          pts.push([P0[0] + (P1[0] - P0[0]) * k, P0[1] + (P1[1] - P0[1]) * k + off(sa), P0[2] + (P1[2] - P0[2]) * k]); arcs.push(sa);
        }
        // врезка сверху: у конца-врезки участок ещё поднят над пересекаемой трубой — опуск вертикальным патрубком на ось магистрали
        const E0 = p.pts[0], EL = p.pts[p.pts.length - 1];
        if (T.a && Math.abs(P.own(0)) > 0.05) { pts.unshift([E0[0], E0[1] + follow(0), E0[2]]); arcs.unshift(0); }
        if (T.b && Math.abs(P.own(L)) > 0.05) { pts.push([EL[0], EL[1] + follow(L), EL[2]]); arcs.push(L); }
        p.pts0 = p.pts; p.pts = pts; p.arcs = arcs; p.offAt = off; p.bumps = P.B.length;
      }
    };
    rebuild();
    /* v0.28: доразведение — до 8 проходов: если после подъёма соседних участков трубы снова сходятся, верхняя труба поднимается
       до отметки нижней с учётом её подъёма; если у верхней рядом неподвижный конец (вход в здание, оборудование) — опускается
       нижняя (не ниже 0,08 м над землёй) или над пересекаемой поднимается нижняя. Порядок труб (какая выше) — прежний, кроме перестановки. */
    const ancOf = p => { const L = p.cum[p.cum.length - 1], T = tie.get(p) || {}; return [...(T.a ? [] : [0]), ...(T.b ? [] : [L]), ...(fixedAt.get(p) || [])]; };
    const damp = (p, sa) => { let e = 1; for (const a of ancOf(p)) e = Math.min(e, Math.max(0, (Math.abs(sa - a) - FLAT) / TAP)); return e; };
    XR.iter = 0; XR.add2 = 0;
    for (let it = 0; it < 8; it++) {
      let n = 0;
      for (const [k, r] of XR) {
        const [i, j] = k.split('|').map(Number), s = segs[i], t = segs[j], c = crossPt(s, t); if (!c) continue;
        const need = rEff(s) + rEff(t) + 0.03, low = r.low, up = r.up, tl = low === s ? c[0] : c[1], tu = low === s ? c[1] : c[0];
        const yl = yEff(low, tl), yu = yEff(up, tu); if (yu - yl >= need - 0.004) continue;
        const eU = movable(up) ? damp(up.pipe, arcOf(up, tu)) : -1, eL = movable(low) ? damp(low.pipe, arcOf(low, tl)) : -1;
        const p0 = c ? [low.a[0] + (low.b[0] - low.a[0]) * tl, low.a[2] + (low.b[2] - low.a[2]) * tl] : null;
        if (eU >= 0.95 || (eU >= 0 && eU >= eL)) { add(up, tu, yl + need - yOn(up, tu), rEff(low) + 0.12); n++; }
        else if (eL >= 0) {
          const d = yu - need - yOn(low, tl);
          if (yOn(low, tl) + d - rEff(low) >= hAt(p0[0], p0[1]) + 0.08) add(low, tl, d, rEff(up) + 0.12);
          else { add(low, tl, yu + need - yOn(low, tl), rEff(up) + 0.12); r.low = up; r.up = low; r.swap = 1; }
          n++;
        }
      }
      XR.add2 += n; if (!n) break; XR.iter = it + 1; rebuild();
    }
    for (const [k, r] of XR) {
      const [i, j] = k.split('|').map(Number), s = segs[i], t = segs[j], c = crossPt(s, t);
      r.ok = !!c && Math.abs(yEff(s, c[0]) - yEff(t, c[1])) >= rEff(s) + rEff(t) + 0.005;
      if (r.ok) { V15.xOk++; if (r.basis === 'H') V15.xHid++; else V15.xCond++; } else V15.xFail++;
    }
  }
  for (const p of pipes) if (!p.arcs) p.arcs = p.cum.slice();   // v0.18
  function crossPt(s, t) {
    const ax = s.a[0], az = s.a[2], ux = s.b[0] - ax, uz = s.b[2] - az, bx = t.a[0], bz = t.a[2], vx = t.b[0] - bx, vz = t.b[2] - bz, den = ux * vz - uz * vx;
    if (Math.abs(den) < 1e-9) return null; return [((bx - ax) * vz - (bz - az) * vx) / den, ((bx - ax) * uz - (bz - az) * ux) / den];
  }

  /* ---------- 6. построитель геометрии труб (PGEO): непрерывная осевая линия, гнутые отводы, без сфер на стыках ---------- */
  const PG = { meshes: 0, verts: 0, bends: 0, caps: 0, sup: 0, hidden: 0, supSkip: 0 }, oldMeshes = [], newMeshes = [];
  const RENDER = new Set(['NETS', 'PH', 'PHC', 'ESTQ', 'RISE', 'PHX', 'TK']);   // v0.25: TK — трубы станции 186 и ТК-007
  const V3 = THREE.Vector3;
  const insM = (PIPED.ins.children[0] && PIPED.ins.children[0].material) || new THREE.MeshStandardMaterial({ color: 0xb9bec3, roughness: 0.38, metalness: 0.85 });
  const UGCAT = { pv: 'pv', prp: 'prp', water: 'water', kpd: 'kpd', k1: 'k1', heat: 'heat', dtl: 'tech', dtz: 'tech', b: 'tech', d: 'tech', gu: 'tech' };
  const ugMats = {}; const ugMat = k => ugMats[k] || (ugMats[k] = new THREE.MeshStandardMaterial({ color: defOf[k] ? defOf[k].c : 0x888888, roughness: 0.5, metalness: 0.25, emissive: defOf[k] ? defOf[k].c : 0, emissiveIntensity: 0.16 }));
  function pathOf(pts, r, onBend) {   // точки пути с касательными; повороты > 8° — дугой R ≈ 3r (≈ 1,5 Dн), ограниченной длинами соседних отрезков
    const P = []; for (const q of pts) { const v = new V3(q[0], q[1], q[2]); if (!P.length || v.distanceTo(P[P.length - 1]) > 1e-4) P.push(v); }
    if (P.length < 2) return null;
    const out = [{ p: P[0].clone(), t: P[1].clone().sub(P[0]).normalize() }], Rb = Math.max(3 * r, 0.12);
    for (let i = 1; i < P.length - 1; i++) {
      const d1 = P[i].clone().sub(P[i - 1]), d2 = P[i + 1].clone().sub(P[i]), l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
      const cs = Math.max(-1, Math.min(1, d1.dot(d2))), th = Math.acos(cs);
      if (th < 0.14) { out.push({ p: P[i].clone(), t: d1.clone().add(d2).normalize() }); continue; }
      const tl = Math.min(Rb * Math.tan(th / 2), 0.45 * l1, 0.45 * l2), R = tl / Math.tan(th / 2);
      const nr = d2.clone().addScaledVector(d1, -cs).normalize(), p1 = P[i].clone().addScaledVector(d1, -tl), C = p1.clone().addScaledVector(nr, R);
      const n = Math.max(2, Math.ceil(th / (Math.PI / 14)));
      for (let k = 0; k <= n; k++) { const ph = th * k / n; out.push({ p: C.clone().addScaledVector(nr, -R * Math.cos(ph)).addScaledVector(d1, R * Math.sin(ph)), t: d1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(nr, Math.sin(ph)).normalize() }); }
      PG.bends++;
      if (onBend) onBend(p1, d1, P[i].clone().addScaledVector(d2, tl), d2, th);
    }
    out.push({ p: P[P.length - 1].clone(), t: P[P.length - 1].clone().sub(P[P.length - 2]).normalize() });
    return out;
  }
  if (!PNET_G.heat) PNET_G.heat = new THREE.Group();
  PNET_G.heat.name = 'Теплосеть надземная (в теплоизоляции)'; scene.add(PNET_G.heat);
  const chunks = new Map();
  const chunkOf = (parent, mt, x, z) => {
    const k = parent.uuid + '|' + mt.uuid + '|' + Math.floor(x / 40) + '|' + Math.floor(z / 40);
    let c = chunks.get(k); if (!c) chunks.set(k, c = { parent, mt, pos: [], nor: [], idx: [], ranges: [], pr: [] }); return c;
  };
  let PCUR = null;   // v0.18: участок (или участки детали), к которому относятся добавляемые треугольники — для разреза труб на маршруте
  const markObj = (c, obj) => { if (!c.ranges.length || c.ranges[c.ranges.length - 1].obj !== obj) c.ranges.push({ f0: c.idx.length / 3, obj }); if (!c.pr.length || c.pr[c.pr.length - 1].p !== PCUR) c.pr.push({ f0: c.idx.length / 3, p: PCUR }); };
  // протяжка сечения по готовому пути; rr — радиус (число) или функция (k, n) → радиус k-го сечения (переходы, отводы с переходом)
  function sweepPath(path, rr, parent, mt, obj, capA, capB, N = 12) {
    if (!path || path.length < 2) return;
    const rad = typeof rr === 'function' ? rr : () => rr;
    // кадры — параллельный перенос (без закручивания)
    let nv = new V3(0, 1, 0); if (Math.abs(nv.dot(path[0].t)) > 0.9) nv.set(1, 0, 0); nv.addScaledVector(path[0].t, -nv.dot(path[0].t)).normalize();
    const q = new THREE.Quaternion(); let prevT = path[0].t;
    const rings = path.map((s, k) => { q.setFromUnitVectors(prevT, s.t); nv.applyQuaternion(q); nv.addScaledVector(s.t, -nv.dot(s.t)).normalize(); prevT = s.t; return { p: s.p, t: s.t, n: nv.clone(), b: new V3().crossVectors(s.t, nv), r: rad(k, path.length) }; });
    const ring = (c, R) => { const base = c.pos.length / 3, r = R.r; for (let a = 0; a < N; a++) { const an = a / N * Math.PI * 2, cx = Math.cos(an), sx = Math.sin(an), dx = R.n.x * cx + R.b.x * sx, dy = R.n.y * cx + R.b.y * sx, dz = R.n.z * cx + R.b.z * sx; c.pos.push(R.p.x + dx * r, R.p.y + dy * r, R.p.z + dz * r); c.nor.push(dx, dy, dz); } return base; };
    const cap = (c, R, sign) => { const r = R.r, b0 = c.pos.length / 3; c.pos.push(R.p.x, R.p.y, R.p.z); c.nor.push(R.t.x * sign, R.t.y * sign, R.t.z * sign); for (let a = 0; a < N; a++) { const an = a / N * Math.PI * 2, cx = Math.cos(an), sx = Math.sin(an); c.pos.push(R.p.x + (R.n.x * cx + R.b.x * sx) * r, R.p.y + (R.n.y * cx + R.b.y * sx) * r, R.p.z + (R.n.z * cx + R.b.z * sx) * r); c.nor.push(R.t.x * sign, R.t.y * sign, R.t.z * sign); } for (let a = 0; a < N; a++) { const i1 = b0 + 1 + a, i2 = b0 + 1 + (a + 1) % N; if (sign > 0) c.idx.push(b0, i1, i2); else c.idx.push(b0, i2, i1); } PG.caps++; };
    let last = null;
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1], c = chunkOf(parent, mt, (A.p.x + B.p.x) / 2, (A.p.z + B.p.z) / 2);
      markObj(c, obj);
      const ia = last && last.c === c ? last.base : ring(c, A), ib = ring(c, B);
      for (let a = 0; a < N; a++) { const a1 = (a + 1) % N; c.idx.push(ia + a, ib + a1, ib + a, ia + a, ia + a1, ib + a1); }   // v0.14: обход — наружу (в v0.13 был внутрь: при FrontSide труба выглядела «желобом»)
      if (i === 0 && capA) cap(c, A, -1);
      if (i === rings.length - 2 && capB) cap(c, B, 1);
      last = { c, base: ib };
    }
  }
  function sweep(pts, r, parent, mt, obj, capA, capB, extA, extB, N = 12, onBend) {
    const path = pathOf(pts, r, onBend); if (!path) return;
    if (extA) path.unshift({ p: path[0].p.clone().addScaledVector(path[0].t, -r), t: path[0].t.clone() });
    if (extB) { const L = path[path.length - 1]; path.push({ p: L.p.clone().addScaledVector(L.t, r), t: L.t.clone() }); }
    sweepPath(path, r, parent, mt, obj, capA, capB, N);
  }
  // режим конца участка: заглушка / продление на радиус (стык под углом с другим участком) / без изменений
  function endMode(p, atA) {
    const n = atA ? p.na : p.nb, P = p.pts, o = atA ? [P[0][0] - P[1][0], P[0][1] - P[1][1], P[0][2] - P[1][2]] : [P[P.length - 1][0] - P[P.length - 2][0], P[P.length - 1][1] - P[P.length - 2][1], P[P.length - 1][2] - P[P.length - 2][2]];
    const lo = Math.hypot(...o) || 1; o[0] /= lo; o[1] /= lo; o[2] /= lo;
    if (n.ends.length === 1) { const k = classifyEnd(n).kind; return k === 'врезка' ? { cap: 0, ext: 0 } : { cap: 1, ext: 0 }; }
    let coll = false; for (const e of n.ends) { if (e.s.pipe === p) continue; const d = outDir3(e.s, e.e); if (d[0] * o[0] + d[1] * o[1] + d[2] * o[2] < -0.985) coll = true; }
    if (coll) return { cap: 0, ext: 0 };
    return { cap: 0, ext: n.ends.length === 2 ? 1 : 0 };
  }
  const pickOf = c => h => { const R = c.ranges; let lo = 0, hi = R.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m].f0 <= h.faceIndex) lo = m; else hi = m - 1; } return R[lo] ? R[lo].obj : null; };

  /* ---------- 6.1 (v0.14) фасонные детали: отводы между участками, переходы, тройники, врезки, сварные стыки ----------
     Место детали — по модели сети (узел графа); тип и размеры — условно: отвод R = 1,5 Dн (ГОСТ 17375), тройник — центр–торец 0,8 Dн
     (порядок ГОСТ 17376), переход — длина по порядку ГОСТ 17378, врезка — сварное ответвление со швом по линии пересечения цилиндров.
     Детали и швы сливаются в блоки труб того же слоя и материала (без лишних вызовов отрисовки); клик — паспорт детали. */
  const V = a => new V3(a[0], a[1], a[2]);
  const UG = { weld: new THREE.TorusGeometry(1, 0.075, 3, 16), collar: new THREE.CylinderGeometry(1, 1.22, 1, 16, 1, true) };
  const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new V3(), _nm = new THREE.Matrix3(), _v = new V3(), YAX = new V3(0, 1, 0), ZAX = new V3(0, 0, 1);
  function addGeo(parent, mt, obj, geo, m4) {   // единичная геометрия → в блок (позиции и нормали — в мировые)
    const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
    _v.setFromMatrixPosition(m4); const c = chunkOf(parent, mt, _v.x, _v.z); markObj(c, obj);
    _nm.getNormalMatrix(m4); const b0 = c.pos.length / 3;
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(m4); c.pos.push(_v.x, _v.y, _v.z); _v.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); c.nor.push(_v.x, _v.y, _v.z); }
    if (idx) for (let i = 0; i < idx.count; i++) c.idx.push(b0 + idx.getX(i)); else for (let i = 0; i < pos.count; i++) c.idx.push(b0 + i);
  }
  const FITS = [], fitAt = new Map(), fitSkip = new Map();
  const FG = { elbow: 0, elbowRed: 0, red: 0, tee: 0, branch: 0, weld: 0, phxRed: 0 };
  let fitN = 0;
  function fitRec(name, n, pipes, p, extra) {
    const o = { id: 'Ф-' + String(++fitN).padStart(3, '0'), net: 1, name: name + ' (условно)', note: '' };
    const f = Object.assign({ obj: o, kind: name, node: n, pipes, p }, extra); o._fit = f; o.note = f.basis || ''; FITS.push(f); if (n) fitAt.set(n, f); return f;
  }
  function weld(parent, mt, obj, p, t, r) { _q4.setFromUnitVectors(ZAX, t); _m4.compose(p, _q4, _s4.set(r * 1.01, r * 1.01, r * 1.01)); addGeo(parent, mt, obj, UG.weld, _m4); FG.weld++; }
  function bead(parent, mt, obj, pts, rw) {   // замкнутый сварной шов по точкам линии пересечения
    const K = pts.length, S = 5, c = chunkOf(parent, mt, pts[0].p.x, pts[0].p.z); markObj(c, obj);
    const b0 = c.pos.length / 3;
    for (let k = 0; k < K; k++) {
      const P = pts[k].p, T = pts[(k + 1) % K].p.clone().sub(pts[(k - 1 + K) % K].p).normalize(), A = pts[k].o.clone().addScaledVector(T, -pts[k].o.dot(T)).normalize(), B = new V3().crossVectors(T, A);
      for (let j = 0; j < S; j++) { const an = j / S * Math.PI * 2, cx = Math.cos(an), sx = Math.sin(an), dx = A.x * cx + B.x * sx, dy = A.y * cx + B.y * sx, dz = A.z * cx + B.z * sx; c.pos.push(P.x + dx * rw, P.y + dy * rw, P.z + dz * rw); c.nor.push(dx, dy, dz); }
    }
    for (let k = 0; k < K; k++) for (let j = 0; j < S; j++) { const a0 = b0 + k * S + j, a1 = b0 + k * S + (j + 1) % S, c0 = b0 + ((k + 1) % K) * S + j, c1 = b0 + ((k + 1) % K) * S + (j + 1) % S; c.idx.push(a0, c1, c0, a0, a1, c1); }
  }
  function arcPath(C, d1, d2, tl) {   // дуга отвода: C — вершина угла, d1 — направление входа, d2 — выхода, tl — длина касательной
    const cs = Math.max(-1, Math.min(1, d1.dot(d2))), th = Math.acos(cs), R = tl / Math.tan(th / 2);
    const nr = d2.clone().addScaledVector(d1, -cs).normalize(), Cc = C.clone().addScaledVector(d1, -tl).addScaledVector(nr, R);
    const n = Math.max(3, Math.ceil(th / (Math.PI / 16))), out = [];
    for (let k = 0; k <= n; k++) { const ph = th * k / n; out.push({ p: Cc.clone().addScaledVector(nr, -R * Math.cos(ph)).addScaledVector(d1, R * Math.sin(ph)), t: d1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(nr, Math.sin(ph)).normalize() }); }
    return { path: out, R, th };
  }
  // как строится участок: слой (родитель), материал, радиус, объект карточки; null — участок не строится PGEO
  function rendOf(p) {
    const fillUnder = p.under && p.fill;
    if (!RENDER.has(p.gen) && !fillUnder) return null;
    if (p.under && !fillUnder) return null;
    let parent, mt, r = p.r, obj = p.obj;
    if (fillUnder) { parent = UGN.cat[UGCAT[p.net]] || UGN.root; mt = ugMat(p.net); obj = { id: 'восп.', net: 1, name: NI[p.net].nm + ' — восполненный разрыв (подземный)', note: 'Разрыв подземной трассы ГП-005 восполнен по соосности (правило заказчика). Требует уточнения по продольным профилям.' }; }
    else if (p.gen === 'PH' || p.gen === 'PHC') { parent = PHG; mt = p.mt; }
    else if (p.gen === 'ESTQ') { parent = ESTQ.g; mt = p.mt; }
    else if (p.gen === 'PHX') { parent = p.parent; mt = p.mt; }
    else if (p.gen === 'TK') { parent = netLayers[p.net] || p.parent; mt = p.mt; }   // v0.25
    else { parent = netLayers[p.net]; mt = p.mt; if (p.net === 'heat') { parent = PNET_G.heat; mt = insM; r = p.r * 1.5; } }
    if (!mt || !parent) return null;
    return { parent, mt, r, obj: obj || { id: p.id, net: 1, name: NI[p.net].nm, note: '' }, heat: p.net === 'heat', under: !!fillUnder };
  }
  const solid = R => R && !R.heat && !R.under;
  const kEnd = (p, atA) => p.id + (atA ? '|a' : '|b');
  const endTrim = new Map(), endFix = new Map(), endKeep = new Set();   // подрезка конца под деталь (м); новая точка конца (врезка); конец без заглушки
  const endInfo = (p, atA) => { const P = p.pts, E = V(P[atA ? 0 : P.length - 1]), O = V(P[atA ? 1 : P.length - 2]); return { E, out: E.clone().sub(O).normalize(), L: E.distanceTo(O) }; };
  const REDL = od => (([[0.06, 0.05], [0.08, 0.065], [0.1, 0.075], [0.115, 0.09], [0.14, 0.1], [0.17, 0.13], [0.23, 0.14], [0.3, 0.15]].find(q => od <= q[0]) || [0, 0.18])[1]);
  const RISER_TL = 3 * 0.0445;   // согласовано с модулем RVSD: видимый стояк В2 начинается на длину отвода выше узла
  const mm = od => od ? 'Ø' + Math.round(od * 1000) : 'Ø не указан';
  const dnTxt = p => p.od && p.cf && p.cf.dn === 'V' ? mm(p.od) : (p.od ? mm(p.od) + ' (условно)' : 'Ø не указан (принят по легенде)');
  const elbows = [], reducers = [], tees = [], saddles = [];
  // отводы и переходы в узлах из двух участков
  for (const n of nodes) {
    if (n.ends.length !== 2) continue;
    const p = n.ends[0].s.pipe, q = n.ends[1].s.pipe; if (!p || !q || p === q) continue;
    if ((p.na === n) === (p.nb === n) || (q.na === n) === (q.nb === n)) continue;
    const ap = p.na === n, aq = q.na === n, A = rendOf(p), B = rendOf(q);
    const riserUp = (t, at) => t.gen === 'RVSD' && t.net === 'pv' && at && t.pts.length === 2 && Math.abs(t.pts[0][0] - t.pts[1][0]) < 1e-3 && Math.abs(t.pts[0][2] - t.pts[1][2]) < 1e-3 && t.pts[1][1] > t.pts[0][1];
    let mode = null, P1 = p, P2 = q, a1 = ap, a2 = aq, R1 = A, R2 = B;
    if (solid(A) && solid(B)) mode = 'both';
    else if (solid(A) && riserUp(q, aq)) mode = 'riser';
    else if (solid(B) && riserUp(p, ap)) { mode = 'riser'; P1 = q; P2 = p; a1 = aq; a2 = ap; R1 = B; R2 = null; }
    if (!mode) continue;
    const i1 = endInfo(P1, a1), i2 = endInfo(P2, a2), d1 = i1.out.clone(), d2 = i2.out.clone().negate();
    const th = Math.acos(Math.max(-1, Math.min(1, d1.dot(d2)))), rA = R1.r, rB = mode === 'riser' ? P2.r : R2.r;
    if (th < 0.14) {   // соосный стык: переход — только при подтверждённых разных Ø
      if (mode !== 'both' || !P1.od || !P2.od || P1.cf.dn !== 'V' || P2.cf.dn !== 'V' || Math.abs(P1.od - P2.od) <= 0.002) continue;
      const L = Math.min(REDL(Math.max(P1.od, P2.od)), 0.9 * i1.L, 0.9 * i2.L); if (L < 0.03) { fitSkip.set(n, 'короткие участки'); continue; }
      endTrim.set(kEnd(P1, a1), L / 2); endTrim.set(kEnd(P2, a2), L / 2);
      reducers.push({ n, C: i1.E, d1, d2, L, rA, rB, R: P1.od >= P2.od ? R1 : R2, pipes: [P1, P2] });
      continue;
    }
    if (th > 2.1) { fitSkip.set(n, `угол ${Math.round(180 - th * 180 / Math.PI)}° между участками — вероятно, расхождение данных`); continue; }
    let tl;
    if (mode === 'riser') { tl = RISER_TL; if (0.45 * i1.L < tl) { fitSkip.set(n, 'короткий участок'); continue; } }
    else {
      tl = Math.min(3 * Math.max(rA, rB) * Math.tan(th / 2), 0.45 * i1.L, 0.45 * i2.L);
      if (tl / Math.tan(th / 2) < 1.05 * Math.max(rA, rB)) { fitSkip.set(n, 'участки короче радиуса отвода'); continue; }
    }
    endTrim.set(kEnd(P1, a1), tl); if (mode === 'both') endTrim.set(kEnd(P2, a2), tl);
    elbows.push({ n, C: i1.E, d1, d2, tl, th, rA, rB, R: mode === 'riser' || rA >= rB ? R1 : R2, pipes: [P1, P2], riser: mode === 'riser' });
  }
  // тройники и крестовины (узлы степени ≥ 3)
  for (const n of nodes) {
    if (n.ends.length < 3) continue;
    const E = []; let bad = false;
    for (const e of n.ends) {
      const p = e.s.pipe; if (!p || (p.na === n) === (p.nb === n)) { bad = true; break; }
      const R = rendOf(p); if (R && (R.heat || R.under)) { bad = true; break; }
      const at = p.na === n, inf = endInfo(p, at); E.push({ p, R, dir: inf.out.clone().negate(), L: inf.L, r: R ? R.r : p.r, C: inf.E });
    }
    if (bad || E.length < 3 || !E.some(x => x.R)) continue;
    let run = null, best = -1;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if (E[i].dir.dot(E[j].dir) < -0.985 && Math.max(E[i].r, E[j].r) > best) { best = Math.max(E[i].r, E[j].r); run = [i, j]; }
    tees.push({ n, E, run, C: (E.find(x => x.R) || E[0]).C });
  }
  // врезки: конец ответвления на середине трубы той же сети — доводится до оси магистрали, шов по линии пересечения
  for (const n of nodes) {
    if (n.ends.length !== 1) continue;
    const c = classifyEnd(n); if (c.kind !== 'врезка') continue;
    const s = n.ends[0].s, p = s.pipe, t = c.ref, q = t.pipe; if (!p || !q || (p.na === n) === (p.nb === n)) continue;
    const A = rendOf(p), B = rendOf(q);
    if (!solid(A) || !solid(B)) { fitSkip.set(n, !A || !B ? 'участок строится отдельным модулем (обвязка РВС, котельная, пенотушение) или подземный' : 'теплосеть в изоляции'); continue; }
    const at = p.na === n, [, tt, px, pz] = segPt(t, n.x, n.z), py0 = yOn(t, tt), py = py0 + (typeof arcOf === 'function' && q.offAt ? q.offAt(arcOf(t, tt)) : 0);   // v0.15: магистраль может быть поднята над пересечением
    if (Math.abs(n.ends[0].y - py0) > 0.06) { fitSkip.set(n, `конец выше/ниже оси магистрали на ${fmt(Math.abs(n.ends[0].y - py0), 2)} м`); continue; }
    if (A.r > B.r * 1.05) { fitSkip.set(n, 'Ø ответвления больше Ø магистрали — проверить данные'); continue; }
    const O = p.pts[at ? 1 : p.pts.length - 2], M = new V3(px, py, pz), o = V(O);
    if (M.distanceTo(o) < 0.05) continue;
    const u = new V3(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]).normalize(), d = M.clone().sub(o).normalize();
    if (Math.abs(d.dot(u)) > 0.9) { fitSkip.set(n, 'ответвление почти вдоль магистрали'); continue; }
    endFix.set(kEnd(p, at), [px, py, pz]); endKeep.add(kEnd(p, at));
    saddles.push({ n, M, u, d, rb: A.r, rm: B.r, R: A, pipes: [p, q] });
  }
  // переходы у патрубков насосов (модуль PHX): конец подключения на выходе перехода — без заглушки
  for (const rd of phxRed) {
    const b = rd.p1;
    for (const p of pipes) { if (p.gen !== 'PHX') continue; for (const at of [true, false]) { const E = p.pts[at ? 0 : p.pts.length - 1]; if (Math.hypot(E[0] - b[0], E[1] - b[1], E[2] - b[2]) < 0.005) endKeep.add(kEnd(p, at)); } }
  }
  const trimPts = p => {
    let P = p.pts.map(q => q.slice());
    const fa = endFix.get(kEnd(p, true)), fb = endFix.get(kEnd(p, false));
    if (fa) P[0] = fa.slice(); if (fb) P[P.length - 1] = fb.slice();
    const cut = (P, d) => { const A = P[0], B = P[1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (L < 1e-6) return P; const t = Math.min(d / L, 0.95); P[0] = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; return P; };
    const ta = endTrim.get(kEnd(p, true)), tb = endTrim.get(kEnd(p, false));
    if (ta) P = cut(P, ta); if (tb) { P.reverse(); P = cut(P, tb); P.reverse(); }
    return P;
  };
  {
    for (const p of pipes) {
      const R = rendOf(p); if (!R) continue;
      const fixed = at => endTrim.has(kEnd(p, at)) || endKeep.has(kEnd(p, at));
      const A = fixed(true) ? { cap: 0, ext: 0 } : endMode(p, true), B = fixed(false) ? { cap: 0, ext: 0 } : endMode(p, false);
      // сварные стыки на гнутых отводах внутри участка — только у крутоизогнутых (≥ 30°), где отвод — отдельная деталь
      const onBend = solid(R) ? (pa, ta, pb, tb, th) => { if (th >= 0.52) { weld(R.parent, R.mt, R.obj, pa, ta, R.r); weld(R.parent, R.mt, R.obj, pb, tb, R.r); } } : null;
      PCUR = p; sweep(trimPts(p), R.r, R.parent, R.mt, R.obj, A.cap, B.cap, A.ext, B.ext, R.r > 0.1 ? 16 : 12, onBend); PCUR = null;
      p.rendered = 1;
    }
    // отводы между участками (в т. ч. с переходом Ø; у основания стояков В2)
    for (const e of elbows) {
      PCUR = e.pipes; const { path, R } = arcPath(e.C, e.d1, e.d2, e.tl), deg = Math.round(e.th * 180 / Math.PI), red = Math.abs(e.rA - e.rB) > 0.002, [P1, P2] = e.pipes;
      const name = e.riser ? `Отвод ${deg}° у основания стояка` : red ? `Отвод ${deg}° с переходом Ø` : `Отвод ${deg}°`;
      const f = fitRec(name, e.n, e.pipes, e.C, { cat: 'elbow', red, dims: `${P1.id}: ${dnTxt(P1)} → ${P2.id}: ${dnTxt(P2)}; угол ${deg}°, радиус гиба по оси ${fmt(R, 3)} м`,
        basis: (e.riser ? 'Стояк В2 (Ø89, АК-004) подключён к трассе ГП-005 отводом; фланцевое соединение у основания — условно (PN16). ' : '') + (red ? 'Смена Ø выполнена в пределах отвода (условно): по документам не определено, отвод с переходом или отвод + переход. ' : '') + 'Отвод крутоизогнутый R = 1,5 Dн (ГОСТ 17375) — исполнение условное, уточнить по ТХ.' });
      sweepPath(path, (k, m) => e.rA + (e.rB - e.rA) * k / (m - 1), e.R.parent, e.R.mt, f.obj, 0, 0, Math.max(e.rA, e.rB) > 0.1 ? 16 : 12);
      weld(e.R.parent, e.R.mt, f.obj, path[0].p, path[0].t, e.rA); if (!e.riser) weld(e.R.parent, e.R.mt, f.obj, path[path.length - 1].p, path[path.length - 1].t, e.rB);
      if (red) FG.elbowRed++; else FG.elbow++;
    }
    // переходы концентрические на подтверждённой смене Ø
    for (const e of reducers) {
      PCUR = e.pipes; const a = e.C.clone().addScaledVector(e.d1, -e.L / 2), b = e.C.clone().addScaledVector(e.d2, e.L / 2), t = b.clone().sub(a).normalize(), [P1, P2] = e.pipes;
      const f = fitRec('Переход концентрический', e.n, e.pipes, e.C, { cat: 'red', red: true, dims: `${mm(P1.od)} → ${mm(P2.od)} (оба Ø — по листу), длина ${fmt(e.L * 1000, 0)} мм`, basis: 'Смена Ø по листу подтверждена, переход на листе не показан. Принят концентрический переход (ГОСТ 17378-2001, длина — порядок по стандарту) — условно; эксцентрический или концентрический — уточнить по ТХ.' });
      sweepPath([{ p: a, t }, { p: b, t }], k => k ? e.rB : e.rA, e.R.parent, e.R.mt, f.obj, 0, 0, 16);
      weld(e.R.parent, e.R.mt, f.obj, a, t, e.rA); weld(e.R.parent, e.R.mt, f.obj, b, t, e.rB); FG.red++;
    }
    // переходы у патрубков насосов (раньше — в модуле PHX)
    for (const rd of phxRed) {
      PCUR = null; if (!rd.o || !rd.mt) continue;
      const a = V(rd.p0), b = V(rd.p1), t = b.clone().sub(a).normalize(), parent = rd.o.gS;
      sweepPath([{ p: a, t }, { p: b, t }], k => k ? rd.r1 : rd.r0, parent, rd.mt, rd.o, 0, 0, 16);
      weld(parent, rd.mt, rd.o, a, t, rd.r0); weld(parent, rd.mt, rd.o, b, t, rd.r1); FG.phxRed++;
    }
    // тройники и крестовины
    for (const T of tees) {
      PCUR = T.E.map(x => x.p); const { n, E, run, C } = T, rm = run ? Math.max(E[run[0]].r, E[run[1]].r) : Math.max(...E.map(x => x.r)), Lh = Math.max(1.6 * rm, 0.06);
      const kind = E.length === 3 ? (run ? 'Тройник' : 'Тройник (ответвления под углом)') : 'Крестовина', br = run ? E.filter((x, i) => i !== run[0] && i !== run[1]) : [];
      const f = fitRec(kind, n, E.map(x => x.p), C, { cat: 'tee', dims: run ? `магистраль ${E[run[0]].p.id} / ${E[run[1]].p.id}: ${dnTxt(E[run[0]].p)}; ответвление ${br.map(x => x.p.id + ': ' + dnTxt(x.p)).join(', ')}` : E.map(x => x.p.id + ': ' + dnTxt(x.p)).join('; '),
        basis: 'Тройник штампованный (ГОСТ 17376), центр — торец 0,8 Dн — исполнение условное: по документам не определено, тройник это или врезка. Уточнить по ТХ.' + (E.some(x => !x.R) ? ' Часть ответвлений строится модулем обвязки РВС — швы на них не показаны.' : '') });
      E.forEach((x, i) => {
        if (!x.R) return;
        const isRun = !!run && (i === run[0] || i === run[1]), dist = isRun ? Lh : Math.max(Lh, rm + 0.6 * x.r);
        if (!isRun && run && 1.22 * x.r < rm) {   // плавный переход «магистраль → ответвление» (горловина штампованного тройника)
          const base = Math.sqrt(rm * rm - 1.49 * x.r * x.r), top = rm + 0.45 * x.r, h = top - base;
          _q4.setFromUnitVectors(YAX, x.dir); addGeo(x.R.parent, x.R.mt, f.obj, UG.collar, _m4.compose(C.clone().addScaledVector(x.dir, base + h / 2), _q4, _s4.set(x.r, h, x.r)));
        }
        if (x.L > dist + 0.04) weld(x.R.parent, x.R.mt, f.obj, C.clone().addScaledVector(x.dir, dist), x.dir, x.r);
      });
      FG.tee++;
    }
    // врезки: шов по линии пересечения цилиндров ответвления и магистрали
    for (const S of saddles) {
      PCUR = S.pipes; const { M, u, d, rm } = S, rb = Math.min(S.rb, rm * 0.96), [p, q] = S.pipes;
      const f = fitRec('Врезка (сварное ответвление)', S.n, S.pipes, M, { cat: 'branch', dims: `ответвление ${p.id}: ${dnTxt(p)} → магистраль ${q.id}: ${dnTxt(q)}`, basis: 'Конец ответвления лежит на трубе той же сети (в пределах радиуса). Показано сварное ответвление со швом по линии пересечения — условно: врезка или тройник, наличие усиливающей накладки — уточнить по ТХ.' });
      const n1 = u.clone().addScaledVector(d, -u.dot(d)).normalize(), n2 = new V3().crossVectors(d, n1), du = d.dot(u), K = 28, pts = [];
      for (let k = 0; k < K; k++) {
        const ph = k / K * Math.PI * 2, o = n1.clone().multiplyScalar(rb * Math.cos(ph)).addScaledVector(n2, rb * Math.sin(ph)), ou = o.dot(u);
        const a = 1 - du * du, b = 2 * ou * du, c = rb * rb - rm * rm - ou * ou, D = b * b - 4 * a * c; if (D < 0 || a < 1e-6) { pts.length = 0; break; }
        const s = (-b + Math.sqrt(D)) / (2 * a); pts.push({ p: M.clone().add(o).addScaledVector(d, -s), o: o.clone().normalize() });
      }
      if (pts.length === K) bead(S.R.parent, S.R.mt, f.obj, pts, Math.max(0.003, 0.08 * rb));
      FG.branch++;
    }
    PCUR = null;
    for (const c of chunks.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3)); g.setIndex(c.idx);
      g.computeBoundingSphere(); g.computeBoundingBox();
      const me = new THREE.Mesh(g, c.mt); me.castShadow = me.receiveShadow = true; me.userData.pick = pickOf(c); me.userData.pgeo = 1; me.userData.pr = c.pr;
      c.parent.add(me); pickables.push(me); newMeshes.push(me); PG.meshes++; PG.verts += c.pos.length / 3;
    }
    // прежняя геометрия (v0.2–v0.12): заменена PGEO — удаляется из сцены (v0.28)
    const hide = m => { if (m && m.visible !== false) { m.visible = false; oldMeshes.push(m); PG.hidden++; } };
    for (const k of OVER) for (const c of netLayers[k].children) if ((c.userData.netsSeg === k && !c.userData.under) || c.userData.netsPost === k) hide(c);
    for (const c of PIPED.fit.children) hide(c);
    for (const c of PIPED.ins.children) hide(c);
    for (const c of PHG.children) if (c.userData.phPipe) hide(c);
    for (const c of ESTQ.g.children) if (c.userData.pipeRun) hide(c);
    for (const o of OBJ) if (o.gS) for (const c of o.gS.children) if (c.userData.phxPipe) hide(c);   // v0.14: подключения насосов — теперь PGEO
  }
  // стойка опоры не ставится, если под трубой в этом месте проходит другая надземная труба (стойка прошла бы сквозь неё)
  function supBlocked(x, z, top, self) {
    for (const s of nearSegs(x, z, 0.6)) {
      if (!s.on || s.under || !s.pipe || s.pipe === self || !RENDER.has(s.gen)) continue;
      const [d, tt] = segPt(s, x, z), rr = s.net === 'heat' ? s.r * 1.5 : s.r;
      if (d < rr + 0.07 && yOn(s, tt) - rr < top) return true;
    }
    return false;
  }
  // v0.31: опоры по листам 152-ТК-005-0 / 152-ТК-006-0 (номера ОП/ОН, места по знакам на планах)
  PNET_G.supT = F31.build({ pipes, RENDER, hAt, parent: PNET_G.sup, pickables });
  try { F32.buildDrains(PNET_G.sup, pickables); } catch (e) { console.warn('F32.buildDrains', e); }   // v0.32
  try { F34.buildValves(PNET_G.sup, pickables, hAt); } catch (e) { console.warn('F34.buildValves', e); }   // v0.34
  // опоры трасс ГП-005 (условно): шаг 3 м по оси, не ближе 0,4 м к концам и отводам; стойка от земли, опорная плита, хомут
  // v0.31: внутри рамок листов ТК-005/006 условные опоры не ставятся у труб, имеющих опоры по листу
  {
    // v0.13: опоры сгруппированы по сетям — видимы только вместе со своей сетью (слой сети), стойка/плита общие для параллельных ниток одной сети
    const SUP = {};
    for (const p of pipes) {
      if (p.gen !== 'NETS' || p.under || !p.rendered) continue;
      const L = SUP[p.net] || (SUP[p.net] = { post: [], plate: [], ub: [] }), post = L.post, plate = L.plate, ub = L.ub;
      const rr = p.net === 'heat' ? p.r * 1.5 : p.r, P = p.pts;
      const bendAt = []; for (let i = 1; i < P.length - 1; i++) { const a = [P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]], b = [P[i + 1][0] - P[i][0], P[i + 1][2] - P[i][2]], la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1; if ((a[0] * b[0] + a[1] * b[1]) / (la * lb) < 0.99) bendAt.push(P[i]); }
      let next = 1.5, d0 = 0; const P0 = P[0], PN = P[P.length - 1];
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i], B = P[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (L < 1e-3) continue;
        while (next <= d0 + L) {
          const t = (next - d0) / L, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, z = A[2] + (B[2] - A[2]) * t; next += 3;
          if (F31.skipCond(p, x, z)) continue;   // v0.31
          if (Math.hypot(P0[0] - x, P0[2] - z) < 0.4 || Math.hypot(PN[0] - x, PN[2] - z) < 0.4 || bendAt.some(q => Math.hypot(q[0] - x, q[2] - z) < 0.4)) continue;
          const gy = hAt(x, z), top = y - rr - 0.04; if (top - gy < 0.08) continue;
          if (supBlocked(x, z, top, p)) { PG.supSkip++; continue; }
          const dx = (B[0] - A[0]) / L, dz = (B[2] - A[2]) / L;
          if (!post.some(o => Math.abs(o[0] - x) < 0.3 && Math.abs(o[2] - z) < 0.3)) { post.push([x, gy, z, top - gy]); plate.push([x, y - rr - 0.02, z]); }
          F31.addCond(p, next - 3);   // v0.31
          if (p.net !== 'heat') ub.push([x, y, z, dx, dz, rr * 1.12]);   // теплосеть в изоляции — скользящая опора без хомута
        }
        d0 += L;
      }
    }
    scene.add(PNET_G.sup); PNET_G.supN = {};
    const one = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s3 = new V3(), p3 = new V3(), q = new THREE.Quaternion(), zax = new V3(0, 0, 1), dir = new V3();
    const steel = new THREE.MeshStandardMaterial({ color: 0x7d838a, roughness: 0.55, metalness: 0.55 }), postM = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.8 });
    const gPost = new THREE.BoxGeometry(0.1, 1, 0.1), gPlate = new THREE.BoxGeometry(0.22, 0.04, 0.22), gUb = new THREE.TorusGeometry(1, 0.1, 4, 10);
    let nPost = 0, nUb = 0;
    for (const k in SUP) {
      const grp = new THREE.Group(); grp.name = 'Опоры: ' + NI[k].code; PNET_G.sup.add(grp); PNET_G.supN[k] = grp;
      const mk = (geo, mt, list, f) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mt, list.length); list.forEach((a, i) => { f(a); im.setMatrixAt(i, m4); }); im.castShadow = true; im.userData.pgeo = 1; grp.add(im); newMeshes.push(im); };
      const { post, plate, ub } = SUP[k];
      mk(gPost, postM, post, ([x, gy, z, h]) => m4.compose(p3.set(x, gy + h / 2, z), one, s3.set(1, h, 1)));
      mk(gPlate, steel, plate, ([x, y, z]) => m4.compose(p3.set(x, y, z), one, s3.set(1, 1, 1)));
      mk(gUb, steel, ub, ([x, y, z, dx, dz, rr]) => { dir.set(dx, 0, dz); q.setFromUnitVectors(zax, dir); m4.compose(p3.set(x, y, z), q, s3.set(rr, rr, rr * 2)); });
      nPost += post.length; nUb += ub.length;
    }
    PG.sup = nPost; PG.ub = nUb;
  }
  F31.spans(pipes);   // v0.31: пролёты между опорами
  const tBuildGeo = performance.now();

  /* ---------- 7. проверка ---------- */
  const issues = [];
  const NOTES = /*@json data/pnet-notes.json*/null;   // v0.54: пояснения к замечаниям, требующим решения заказчика/проектировщика
  const CAT = {
    OPEN: 'Открытый конец без подключения',
    GAP: 'Разрыв трассы (соосные концы)',
    NEARP: 'Конец у трубы той же сети, но не соединён',
    EQUIP: 'Конец у оборудования — подключение не смоделировано',
    ELEV: 'Ступенька по высоте в стыке',
    FIT: 'Фасонная деталь не смоделирована',
    DIAM: 'Смена диаметра без перехода',
    MIX: 'Соединение разных продуктов',
    CLASH: 'Пересечение труб в одном уровне',
    DUP: 'Дублирующий участок',
    PAR: 'Параллельный дубль (контуры трубы с чертежа)',
    DEG: 'Вырожденный элемент (длина < 2 см)',
    PROCX: 'Ребро графа ТП без физической трубы',
    PROCU: 'Условная связь графа ТП (нет трассы в документах)',
    PROCA: 'Ось ребра графа ТП в стороне от трубы (поток — по трубе)',
    FILL: 'Исправлено: разрыв восполнен по соосности',
    CONT: 'Исправлено: контур трубы исключён',
    TRIM: 'Исправлено: наложение отрезков',
    DROP: 'Исправлено: исключён штрих подписи (не трубопровод)',
    CORN: 'Исправлено: поворот трассы восстановлен',
    EXT: 'Исправлено: конец доведён до трубы',
    XOK: 'Пересечение разведено по высоте',
    ALIGN: 'Исправлено: сопряжение выхода из цеха',
    FITM: 'Фасонная деталь смоделирована условно'
  };
  const SEV = { 3: 'критично', 2: 'предупреждение', 1: 'информация' };
  const REC = {
    OPEN: 'Найти продолжение трассы на ГП-005/ТХ; если трасса там тоже обрывается — выяснить у проектировщика.',
    GAP: 'Разрыв не подпадает под правило восполнения (смещение оси > 5 см или длина > 5 м). Сверить с ГП-005/ТХ.',
    NEARP: 'Проверить по ГП-005/ТХ, есть ли здесь врезка (тройник). Без подтверждения не соединять.',
    EQUIP: 'Уточнить узел подключения (патрубок, отметка, арматура) по ТХ/КМ оборудования.',
    ELEV: 'Отметку оси уточнить по ТХ; при подтверждении — перестроить переход.',
    FIT: 'Деталь не построена (подземный участок, обвязка РВС — отдельный модуль, теплосеть в изоляции или слишком короткие участки). Уточнить узел по ТХ.',
    DIAM: 'Уточнить диаметры по ТХ; при подтверждении добавить переход (итерация 5).',
    MIX: 'Проверить продукт и цвет линии на ГП-005/АК-041; разные продукты соединяются только через арматуру.',
    CLASH: 'Развести трубы по высоте (одна идёт над другой) по ТХ; без данных не изменять — отметки осей условны.',
    DUP: 'Определить по документам, какой участок верный; второй исключить.',
    PAR: 'Определить по ГП-005, какая из линий — ось трубы; остальные — контуры (исключить из геометрии).',
    DEG: 'Исключить из геометрии (артефакт оцифровки).',
    PROCX: 'Сверить ребро графа с физической трассой: либо добавить трубу по документам, либо пометить связь как условную.',
    PROCU: 'Связь нужна для работы маршрута; физическую трассу уточнить по ТХ.',
    PROCA: 'Замечание схемы, не трубы: ось ребра графа ТП проведена в стороне от трубы (> 0,3 м), но цепочка физических труб между узлами ребра непрерывна — поток и маршрут строятся по трубам. Исправлять не требуется.',
    FILL: 'Основание соединения — в описании: линия на векторном ГП-005, разрыв под подпись либо правило заказчика (последнее — подтвердить по ТХ).',
    CONT: 'Подтвердить по ГП-005 (DWG), что исключённая линия — контур трубы, а не отдельный трубопровод.',
    TRIM: 'Артефакт оцифровки устранён; подтверждения не требует, если трасса на ГП-005 одна.',
    DROP: 'На векторном ГП-005 в этом месте линии трубопровода нет: отрезок получен из штриха надписи или условного знака.',
    CORN: 'Подтверждено векторным ГП-005 (отвод показан дугой). Радиус отвода в модели — 1,5 Dн, уточнить по ТХ.',
    EXT: 'Подтверждено векторным ГП-005. Тип соединения (тройник/врезка) уточнить по ТХ.',
    XOK: 'Порядок труб — по невидимым линиям ГП-005 либо условно; отметки осей и способ обхода уточнить по ТХ (разрезы, профили).',
    ALIGN: 'Конец трассы ГП-005 (М 1:500) совмещён с концом трубы АК-041 (М 1:50) у стены цеха. Подтвердить по ТХ насосной.',
    FITM: 'Исполнение принято условно: отвод R = 1,5 Dн (ГОСТ 17375), тройник (ГОСТ 17376), переход (ГОСТ 17378), врезка — сварное ответвление. Подтвердить тип и размеры по ТХ/спецификации.'
  };
  const relEq = (x, z) => { let best = null, bd = 12; for (const q of objBoxes) { const b = q.b, cx = Math.max(b.min.x, Math.min(x, b.max.x)), cz = Math.max(b.min.z, Math.min(z, b.max.z)), d = Math.hypot(cx - x, cz - z); if (d < bd) { bd = d; best = q.o; } } return best ? '№ ' + best.id + ' ' + best.name : '—'; };
  function addIssue(cat, sev, p, o) {
    const it = { id: 'ДГ-' + String(issues.length + 1).padStart(4, '0'), cat, sev, p: p.map(v => +v.toFixed(3)), pipes: [], status: 'не решено', ...o };
    if (o.segs) { for (const s of o.segs) if (s.pipe && !it.pipes.includes(s.pipe)) it.pipes.push(s.pipe); delete it.segs; }
    it.net = it.net || (it.pipes[0] && it.pipes[0].net) || '';
    it.eq = relEq(p[0], p[2]);
    for (const pp of it.pipes) pp.issues.push(it);
    for (const nn of [o.node, o.node2]) if (nn && (cat === 'GAP' || cat === 'NEARP' || cat === 'OPEN')) nn.icat = cat;
    issues.push(it); return it;
  }
  const stat = { tees: 0, teeEnds: 0, bends: 0, bendsFit: 0, rises: 0, equipEnds: 0, ends: 0, crossOK: 0, joints: 0, fills: 0, contours: 0, trims: 0, aligns: 0, fitm: 0, wellEnds: 0, capEnds: 0, drops: 0, corns: 0, exts: 0, endsEv: 0, endsNoEv: 0 };
  const runGen = g => g === 'RVSD' || g === 'PHX' || g === 'UGN' || g === 'K501' || g === 'F24' || RENDER.has(g);   // v0.54: K501, F24 — отводы строят свои модули   // непрерывные трубы с гнутыми отводами
  function fitIssue(f, p, segs, n) { stat.fitm++; f.issue = addIssue('FITM', 1, p, { segs, node: n, txt: `${f.obj.id} ${f.obj.name}`, status: 'смоделировано условно', fit: f }); }
  const evEnd = n => { const e = n.ends[0], s = e.s; if (!EV[s.net] || s.under) return null; const d = outDir(s, e.e); return evLine(s.net, n.x + d[0] * 0.08, n.z + d[1] * 0.08, n.x + d[0] * 0.45, n.z + d[1] * 0.45).f >= 0.8; };
  const evEndTxt = c => c === null ? '' : c ? '; на векторном ГП-005 линия идёт дальше — этого участка в модели нет' : '; на векторном ГП-005 линия здесь тоже заканчивается';
  function validate() {
    // 7.0 журнал исправлений итерации 4
    for (const f of fixes) {
      const st = f.cat === 'TRIM' ? 'исправлено' : f.cat === 'FILL' ? (f.basis === 'R' ? 'восполнено по соосности — требует уточнения' : 'соединено — подтверждено ГП-005 (вектор)') : (f.cat === 'DROP' || f.cat === 'CORN' || f.cat === 'EXT') ? 'исправлено — подтверждено ГП-005 (вектор)' : 'исправлено условно — требует подтверждения';
      addIssue(f.cat, 1, f.p, { segs: f.segs, net: f.net, d: f.d, txt: f.txt, status: st });
      stat[{ FILL: 'fills', CONT: 'contours', TRIM: 'trims', ALIGN: 'aligns', DROP: 'drops', CORN: 'corns', EXT: 'exts' }[f.cat]]++;
    }
    // 7.1 свободные концы
    const openEnds = [];
    for (const n of nodes) {
      if (n.ends.length !== 1) continue;
      const { s, y } = n.ends[0]; stat.ends++;
      const c = classifyEnd(n); n.kind = c.kind;
      if (c.kind === 'подъём/опуск') { stat.rises++; n.tee = c.ref; continue; }
      if (c.kind === 'врезка') { stat.teeEnds++; n.tee = c.ref; const f = fitAt.get(n); if (f) fitIssue(f, [n.x, y, n.z], [s, c.ref], n); else addIssue('FIT', 1, [n.x, y, n.z], { segs: [s, c.ref], node: n, txt: 'врезка без тройника' + (fitSkip.get(n) ? ' — ' + fitSkip.get(n) : '') }); continue; }
      if (c.kind === 'оборудование') { stat.equipEnds++; n.eq = c.eq; if (c.eq.kind === 'колодец') stat.wellEnds++; else if (c.eq.kind !== 'патрубок' && c.eq.kind !== 'агрегат') addIssue('EQUIP', 1, [n.x, y, n.z], { segs: [s], node: n, d: c.eq.d, txt: `${c.eq.name}: ${c.eq.kind}` }); continue; }
      n.onOther = c.onOther; openEnds.push(n);
    }
    const paired = new Set();
    for (const { n, m, d, lat } of gapPairs(openEnds)) {
      paired.add(n); paired.add(m);
      const s = n.ends[0].s, t = m.ends[0].s, ud = s.under !== t.under;
      addIssue('GAP', 3, [(n.x + m.x) / 2, (n.ends[0].y + m.ends[0].y) / 2, (n.z + m.z) / 2], { segs: [s, t], node: n, node2: m, d, lat, txt: (ud ? 'надземный конец и начало подземного участка (подъём/опуск) не совпадают: ' : '') + `разрыв ${fmt(d)} м, смещение оси ${fmt(lat, 3)} м` });
    }
    for (const n of openEnds) {
      if (paired.has(n)) continue;
      const { s, y } = n.ends[0];
      if (nodes.some(m => m !== n && m.ends.length === 1 && m.kind === 'врезка' && m.tee && m.tee.pipe === s.pipe && Math.hypot(m.x - n.x, m.z - n.z) < 0.6)) { n.kind = 'заглушка коллектора'; stat.capEnds++; continue; }   // v0.15: конец коллектора за последним ответвлением
      let ns = null, nd = Infinity;
      for (const t of nearSegs(n.x, n.z, 3)) { if (t === s || !t.on || t.net !== s.net || t.na === n || t.nb === n) continue; const [d] = segPt(t, n.x, n.z); if (d < nd) { nd = d; ns = t; } }
      const ec = evEnd(n); if (ec === true) stat.endsEv++; else if (ec === false) stat.endsNoEv++;
      if (ns && nd < 3) addIssue('NEARP', ec === false ? 1 : 2, [n.x, y, n.z], { segs: [s, ns], node: n, d: nd, status: ec === false ? 'конец линии подтверждён ГП-005 — назначение уточнить' : 'не решено', txt: `до трубы ${ns.pipe ? ns.pipe.id : ''} ${fmt(nd)} м` + evEndTxt(ec) + (n.onOther ? `; конец лежит на трубе ${NI[n.onOther.net].code} (пересечение в плане)` : '') });
      else addIssue('OPEN', s.under ? 2 : 3, [n.x, y, n.z], { segs: n.onOther ? [s, n.onOther] : [s], node: n, d: null, txt: (s.under ? 'подземный участок обрывается' : 'надземный участок обрывается') + evEndTxt(ec) + (n.onOther ? ` на трубе другого продукта (${NI[n.onOther.net].code}) — в плане это пересечение, не врезка` : '') });
    }
    // 7.2 узлы степени ≥ 2
    for (const n of nodes) {
      const E = n.ends; if (E.length < 2) continue;
      stat.joints++;
      const ov = E.filter(q => !q.s.under), un = E.filter(q => q.s.under);
      if (ov.length && un.length) { stat.rises++; n.kind = 'подъём/опуск'; }
      const ys = ov.map(q => q.y); const dy = ys.length > 1 ? Math.max(...ys) - Math.min(...ys) : 0;
      const p = [n.x, ys.length ? Math.max(...ys) : E[0].y, n.z];
      if (dy > 0.02) addIssue('ELEV', dy > 0.08 && !ov.some(q => q.s.gen === 'PHX') ? 2 : 1, p, { segs: ov.map(q => q.s), node: n, d: dy, txt: `перепад осей ${fmt(dy, 3)} м` });
      const uni = [...new Set(E.flatMap(q => pset(q.s.prod)))], hub = E.some(q => uni.every(x => pset(q.s.prod).includes(x)));
      if (!hub && !F34.teeDrain(E)) for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if (!compat(E[i].s.prod, E[j].s.prod)) { addIssue('MIX', 3, p, { segs: [E[i].s, E[j].s], node: n, txt: `${NI[E[i].s.net].code} ↔ ${NI[E[j].s.net].code}` }); i = E.length; break; }
      if (E.length >= 3) { stat.tees++; n.kind = n.kind || 'тройник'; const f = fitAt.get(n); if (f) fitIssue(f, p, E.map(q => q.s), n); else addIssue('FIT', 1, p, { segs: E.map(q => q.s), node: n, txt: `ветвление на ${E.length} направления — тройник не смоделирован` + (fitSkip.get(n) ? ' — ' + fitSkip.get(n) : '') }); }
      else {
        const [A, B] = E, da = outDir3(A.s, A.e), db = outDir3(B.s, B.e), ang = Math.acos(Math.max(-1, Math.min(1, -(da[0] * db[0] + da[1] * db[1] + da[2] * db[2])))) * 180 / Math.PI;
        if (ang > 8 && A.s.under === B.s.under) {
          stat.bends++; n.kind = n.kind || 'отвод';
          if (A.s.pipe === B.s.pipe && runGen(A.s.gen)) stat.bendsFit++;
          else if (A.s.gen === B.s.gen && (A.s.gen === 'RVSD' || A.s.gen === 'PHX' || A.s.gen === 'RGSN' || A.s.gen === 'K501' || A.s.gen === 'F24')) stat.bendsFit++;   // v0.32: RGSN — отводы строит модуль РГС-75
          else if (A.s.gen === 'ASN' || B.s.gen === 'ASN') stat.bendsFit++;   // v0.25: шарниры консоли и вход в колонну АСН-80-02.01 — узлы изделия (модуль F25)
          else if (fitAt.get(n)) { stat.bendsFit++; fitIssue(fitAt.get(n), p, [A.s, B.s], n); }
          else addIssue('FIT', 1, p, { segs: [A.s, B.s], node: n, d: ang, txt: `стык разных участков под углом ${Math.round(ang)}° — отвод не смоделирован` + (fitSkip.get(n) ? ' — ' + fitSkip.get(n) : '') });
        } else if (!n.kind) n.kind = 'стык';
        if (A.s.od && B.s.od && A.s.cf.dn === 'V' && B.s.cf.dn === 'V' && Math.abs(A.s.od - B.s.od) > 0.002 && A.s.under === B.s.under) { const f = fitAt.get(n); if (f && f.red) { if (f.cat === 'red') fitIssue(f, p, [A.s, B.s], n); addIssue('DIAM', 1, p, { segs: [A.s, B.s], node: n, d: Math.abs(A.s.od - B.s.od), txt: `Ø${Math.round(A.s.od * 1000)} → Ø${Math.round(B.s.od * 1000)} мм — смоделирован условный переход (${f.obj.id})`, status: 'переход смоделирован условно — требует подтверждения', fit: f }); } else addIssue('DIAM', 2, p, { segs: [A.s, B.s], node: n, d: Math.abs(A.s.od - B.s.od), txt: `Ø${Math.round(A.s.od * 1000)} → Ø${Math.round(B.s.od * 1000)} мм` }); }
      }
    }
    for (const s of segs) if (s.on && s.len < 0.02) addIssue('DEG', 1, s.a, { segs: [s], txt: `длина ${fmt(s.len * 1000, 0)} мм` });
    // 7.3 пересечения и дубли (надземные)
    const seenPair = new Set();
    for (const s of segs) {
      if (!s.on || s.under || s.len < 0.05) continue;
      const cand = nearSegs((s.a[0] + s.b[0]) / 2, (s.a[2] + s.b[2]) / 2, s.len / 2 + 0.3);
      for (const t of cand) {
        if (t.id <= s.id || !t.on || t.under || t.len < 0.05) continue;
        if (s.na === t.na || s.na === t.nb || s.nb === t.na || s.nb === t.nb) continue;
        const ax = s.a[0], az = s.a[2], ux = s.b[0] - ax, uz = s.b[2] - az, bx = t.a[0], bz = t.a[2], vx = t.b[0] - bx, vz = t.b[2] - bz;
        const den = ux * vz - uz * vx, lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
        if (lu < 1e-3 || lv < 1e-3) continue;   // вертикальные стояки
        if (Math.abs(den) / (lu * lv) < 0.05) {
          if (s.net !== t.net) continue;
          const dist = Math.abs((bx - ax) * uz - (bz - az) * ux) / lu; if (dist > 0.16) continue;
          const t0 = ((bx - ax) * ux + (bz - az) * uz) / (lu * lu), t1 = ((bx + vx - ax) * ux + (bz + vz - az) * uz) / (lu * lu);
          const ovl = (Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1))) * lu; if (ovl < 0.3) continue;
          const key = (s.pipe ? s.pipe.id : s.id) + '|' + (t.pipe ? t.pipe.id : t.id) + '|' + (dist < 0.03 ? 'D' : 'P'); if (seenPair.has(key)) continue; seenPair.add(key);
          const heat2 = s.net === 'heat' && dist >= 0.03;
          addIssue(dist < 0.03 ? 'DUP' : 'PAR', heat2 ? 1 : 2, [(ax + bx) / 2, (s.a[1] + t.a[1]) / 2, (az + bz) / 2], { segs: [s, t], d: dist, txt: `${dist < 0.03 ? 'наложение' : 'расстояние между осями ' + fmt(dist, 3) + ' м'}, перекрытие ${fmt(ovl, 1)} м` + (heat2 ? ' — вероятно, подающий и обратный трубопроводы (две трубы), требует уточнения по ТС' : (dist < 0.03 && s.gen === 'PH' ? ' — возможно, две нитки на разных отметках (АК-041: «верхняя/нижняя нитка»), требует уточнения' : '')) });
          continue;
        }
        const ts = ((bx - ax) * vz - (bz - az) * vx) / den, tt = ((bx - ax) * uz - (bz - az) * ux) / den;
        if (ts <= 0.002 || ts >= 0.998 || tt <= 0.002 || tt >= 0.998) continue;
        const y1 = yEff(s, ts), y2 = yEff(t, tt), gap = Math.abs(y1 - y2) - rEff(s) - rEff(t), xr = XR.get(xkey(s, t));
        if (gap >= 0.004) {
          stat.crossOK++;
          if (xr) { const up = y1 > y2 ? s : t, lo = up === s ? t : s; addIssue('XOK', 1, [ax + ux * ts, Math.max(y1, y2), az + uz * ts], { segs: [lo, up], d: gap, status: xr.basis === 'H' ? 'порядок труб подтверждён ГП-005; отметка условна' : 'разведено условно — требует подтверждения',
            txt: `${up.pipe.id} проходит над ${lo.pipe.id} (зазор ${fmt(gap * 1000, 0)} мм): ` + (xr.basis === 'H' ? 'на векторном ГП-005 нижняя труба показана невидимой линией' : 'данных о порядке труб нет — принято условно') }); }
          continue;
        }
        const key = (s.pipe ? s.pipe.id : s.id) + '|' + (t.pipe ? t.pipe.id : t.id) + '|X'; if (seenPair.has(key)) continue; seenPair.add(key);
        addIssue('CLASH', 2, [ax + ux * ts, Math.max(y1, y2), az + uz * ts], { segs: [s, t], d: -gap, txt: `${NI[s.net].code} × ${NI[t.net].code}: оси на ${fmt(Math.abs(y1 - y2), 3)} м по высоте при сумме радиусов ${fmt(rEff(s) + rEff(t), 3)} м` + (xr ? ' — развести не удалось (рядом конец участка или врезка)' : '') });
      }
    }
    for (const f of FITS) if (!f.node) { stat.fitm++; f.issue = addIssue('FITM', 1, [f.p.x, f.p.y, f.p.z], { segs: [], net: f.net || '', txt: `${f.obj.id} ${f.obj.name}`, status: 'смоделировано условно', fit: f }); }
    // 7.4 граф ТП ↔ физические трубы
    for (const e of procLogic.E) {
      if (e.k !== 'pipe' || !e.pts || e.pts.length < 2) continue;
      const samp = [];
      for (let i = 0; i < e.pts.length - 1; i++) { const [ax, az] = e.pts[i], [bx, bz] = e.pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.5)); for (let j = (i ? 1 : 0); j <= n; j++) samp.push([ax + (bx - ax) * j / n, az + (bz - az) * j / n]); }
      let cov = 0, gapRun = 0, gapMax = 0, gapAt = null, run0 = null; const hit = new Set();
      for (const [x, z] of samp) {
        let ok = null;
        for (const t of nearSegs(x, z, 0.35)) { if (!t.on || t.fam !== 'proc' || !compat(t.prod, e.prod)) continue; const [d] = segPt(t, x, z); if (d < 0.3) { ok = t; break; } }
        if (ok) { cov++; if (ok.pipe) hit.add(ok.pipe); if (gapRun > gapMax) { gapMax = gapRun; gapAt = run0; } gapRun = 0; } else { if (!gapRun) run0 = [x, z]; gapRun++; }
      }
      if (gapRun > gapMax) { gapMax = gapRun; gapAt = run0; }
      const frac = cov / samp.length;
      e._pnet = { cov: frac, pipes: [...hit].map(p => p.id) };
      for (const p of hit) p.proc.push(e.id);
      const pf = window.__PFLOW ? window.__PFLOW.edgeInfo(e) : null;   // v0.18: сопоставление по цепочке труб
      e._pf = pf ? { kind: pf.kind, len: pf.len, gap: pf.gap } : null;
      if (frac < 0.95 && gapAt) {
        const yy = procLogic.procY ? procLogic.procY(gapAt[0], gapAt[1]) : hAt(gapAt[0], gapAt[1]) + 0.6;
        const cond = e.src === 'усл' || e.cond, pft = pf ? `; по цепочке труб (PFLOW): ${fmt(pf.len, 1)} м` + (pf.gap > 0.05 ? `, условно ${fmt(pf.gap, 1)} м` : '') : '';
        if (pf && (pf.kind === 'phys' || pf.kind === 'noz') && !cond) addIssue('PROCA', 1, [gapAt[0], yy, gapAt[1]], { segs: [], proc: e.id, net: '', d: gapMax * 0.5, status: 'поток — по трубам', txt: `ребро ${e.id} «${e.n || ''}» (${e.src}): ось графа совпадает с трубами на ${Math.round(frac * 100)} %, цепочка труб непрерывна` + pft });
        else addIssue(cond ? 'PROCU' : 'PROCX', cond ? 1 : 2, [gapAt[0], yy, gapAt[1]], { segs: [], proc: e.id, net: '', d: gapMax * 0.5, txt: `ребро ${e.id} «${e.n || ''}» (${e.src}): покрыто физическими трубами на ${Math.round(frac * 100)} %` + pft });
      }
    }
  }

  function applyNotes() {   // v0.54: пояснения из data/pnet-notes.json — статус, ссылка на находку, при необходимости важность
    for (const it of issues) for (const n of NOTES.notes) {
      if (!n.cats.includes(it.cat) || Math.hypot(it.p[0] - n.p[0], it.p[2] - n.p[1]) > n.r) continue;
      it.status = n.status + (n.ref ? ' (' + n.ref + ')' : ''); it.txt = (it.txt ? it.txt + '; ' : '') + n.txt; it.ref = n.ref; if (n.sev) it.sev = n.sev; break;
    }
  }
  /* ---------- 8. визуализация: маркеры проблем, узлы, подсветка ---------- */
  scene.add(PNET_G.diag, PNET_G.nodes, PNET_G.hl);
  const SCOL = { 3: 0xd0261c, 2: 0xf08c00, 1: 0x2f7fd0 };
  let diagIM = null, nodeIM = null;
  function buildMarkers() {
    const gm = new THREE.OctahedronGeometry(0.22, 0), m4 = new THREE.Matrix4(), c = new THREE.Color();
    diagIM = new THREE.InstancedMesh(gm, new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.92 }), issues.length || 1);
    diagIM.count = issues.length; diagIM.renderOrder = 20; diagIM.frustumCulled = false; diagIM.userData.noWalk = 1;
    issues.forEach((it, i) => { m4.makeTranslation(it.p[0], it.p[1] + 0.35, it.p[2]); diagIM.setMatrixAt(i, m4); diagIM.setColorAt(i, c.setHex(SCOL[it.sev])); });
    diagIM.userData.pick = h => issueObj(issues[h.instanceId]);
    pickables.push(diagIM); PNET_G.diag.add(diagIM);
    const gn = new THREE.OctahedronGeometry(0.08, 0), NC = { 'открытый конец': 0xd0261c, 'оборудование': 0x1f8a4c, 'врезка': 0x2f7fd0, 'тройник': 0x2f7fd0, 'подъём/опуск': 0x8e44ad };
    nodeIM = new THREE.InstancedMesh(gn, new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.85 }), nodes.length);
    nodeIM.renderOrder = 19; nodeIM.frustumCulled = false; nodeIM.userData.noWalk = 1;
    nodes.forEach((n, i) => { const y = Math.max(...n.ends.map(q => q.y)); m4.makeTranslation(n.x, y, n.z); nodeIM.setMatrixAt(i, m4); nodeIM.setColorAt(i, c.setHex(NC[n.kind] || 0x7a8a96)); });
    PNET_G.nodes.add(nodeIM);
  }
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.6, depthTest: false });
  const hlMat2 = new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0.45, depthTest: false });
  let hlLabel = null, hlPos = null;
  function clearHL() { for (const c of [...PNET_G.hl.children]) { c.geometry.dispose(); PNET_G.hl.remove(c); } if (hlLabel) hlLabel.style.display = 'none'; hlPos = null; }
  function tubeOf(pts, r, mat) {
    const path = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    const me = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(2, (pts.length - 1) * 2), r, 10, false), mat); me.renderOrder = 18; me.userData.noWalk = 1; return me;
  }
  function highlight(list, label, mat = hlMat) {
    clearHL();
    for (const p of list) PNET_G.hl.add(tubeOf(p.pts, Math.max(0.06, p.r * 1.5 + 0.03), mat));
    PNET_G.hl.visible = true;
    if (label && list.length) {
      if (!hlLabel) { hlLabel = document.createElement('div'); hlLabel.style.cssText = 'position:fixed;z-index:3;pointer-events:none;background:#14202c;color:#ffd200;font:600 12px system-ui,Arial;padding:2px 7px;border-radius:6px;transform:translate(-50%,-130%);white-space:nowrap'; document.body.appendChild(hlLabel); }
      const p = list[0], m = p.pts[Math.floor(p.pts.length / 2)]; hlPos = new THREE.Vector3(...m); hlLabel.textContent = label; hlLabel.style.display = 'block';
    }
  }
  let adj = null;
  function component(p) {   // связная сеть: участки, соединённые через узлы и врезки
    if (!adj) {
      adj = new Map(); const link = (a, b) => { if (!a || !b || a === b) return; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
      for (const n of nodes) { const ps = n.ends.map(e => e.s.pipe); if (n.tee && n.tee.pipe) ps.push(n.tee.pipe); for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) link(ps[i], ps[j]); }
    }
    const out = new Set([p]), q = [p];
    while (q.length) { const c = q.pop(); for (const x of adj.get(c) || []) if (!out.has(x)) { out.add(x); q.push(x); } }
    return [...out];
  }
  function showIssue(it, fly = true) {
    highlight(it.pipes, it.id, hlMat);
    if (fly) { const [x, y, z] = it.p, d = it.cat === 'PROCX' || it.cat === 'PROCU' ? 14 : 9; flyTo([x + d * 0.55, y + d * 0.7, z + d * 0.75], [x, y, z]); }
  }
  // видимость: теплоизолированная теплосеть — со слоем «детализация» (как PIPED.ins в v0.12) или со слоем сети; опоры — только вместе со своей сетью
  function syncVis() {
    if (PNET_G.heat) PNET_G.heat.visible = PNET_G.sup.visible || netLayers.heat.visible;
    for (const k in PNET_G.supN || {}) PNET_G.supN[k].visible = k === 'heat' ? !!(PNET_G.heat && PNET_G.heat.visible) : netLayers[k].visible;
  }
  function tick() {
    syncVis();
    if (hlPos && hlLabel && hlLabel.style.display !== 'none') {
      const v = hlPos.clone().project(camera);
      if (v.z > 1 || v.z < -1) hlLabel.style.display = 'none';
      else { hlLabel.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; hlLabel.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; }
    }
  }

  /* ---------- 9. карточки ---------- */
  const NETN = k => (NI[k] ? NI[k].code + ' — ' + NI[k].nm : k);
  const cfTxt = cf => `план — ${ST[cf.plan]}; высота — ${ST[cf.elev]}; Ø — ${ST[cf.dn]}`;
  const KIND_FREE = { GAP: 'свободный конец — разрыв трассы', NEARP: 'свободный конец — рядом труба той же сети', OPEN: 'открытый конец' };
  const nodeTxt = n => `${nid(n)} (${(n.kind === 'открытый конец' && KIND_FREE[n.icat]) || n.kind || 'стык'}${n.eq ? ': ' + n.eq.name : ''}${n.tee && n.tee.pipe ? ': в ' + n.tee.pipe.id : ''})`;
  const lvl = (y) => fmt(H + y, 2);
  function pipeCard(p) {
    const ys = p.pts.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const eqs = [p.na, p.nb].filter(n => n.eq).map(n => n.eq.name);
    const g = gens[p.gen];
    return `<div class="pn"><div class="pnh">Трубопровод <b>${p.id}</b> · ${p.under ? 'подземный' : 'надземный'}${p.cas ? ', в футляре' : ''}</div>` +
      `<div>Сеть: ${NETN(p.net)}</div>` +
      `<div>Ø: ${p.od ? 'наружный ' + Math.round(p.od * 1000) + ' мм' : 'на листе не указан'} · длина ${fmt(p.len, 1)} м · элементов ${p.segs.length}</div>` +
      `<div>Начало: ${nodeTxt(p.na)}<br>Конец: ${nodeTxt(p.nb)}</div>` +
      `<div>Отметка оси: ${y0 === y1 ? lvl(y0) : lvl(y0) + '…' + lvl(y1)}${p.under ? ' (заглубление условно)' : ''}</div>` +
      `<div>Источник: ${p.src}${p.name ? ' · «' + p.name + '»' : ''}</div>` +
      (p.fill ? `<div style="color:#c46a00">Содержит восполненный разрыв (по соосности — требует уточнения)</div>` : '') +
      `<div>Достоверность: ${cfTxt(p.cf)}</div>` +
      (eqs.length ? `<div>Оборудование: ${eqs.join('; ')}</div>` : '') +
      `<div>Граф ТП: ${p.proc.length ? p.proc.map(id => { const e = procLogic.E.find(q => q.id === id); return id + (e && e.n ? ' «' + e.n + '»' : ''); }).join('; ') : 'не сопоставлен'}. Маршруты М1–М9 — после синхронизации (итерация 6).</div>` +
      `<div>Проверка: ${p.issues.length ? p.issues.map(it => `<a href="#" data-iss="${it.id}" class="sev${it.sev}">${it.id}</a> ${CAT[it.cat]}`).join('<br>') : '<span style="color:#1f8a4c">замечаний нет</span>'}</div>` +
      `<div class="pnb"><button class="pbtn sm" data-hl="${p.id}">Подсветить участок</button><button class="pbtn sm" data-hlc="${p.id}">Вся связная сеть</button></div>` +
      `<div class="pnn">Генератор геометрии: ${g ? g.txt : p.gen}</div></div>`;
  }
  function issueCard(it) {
    return `<div class="pn"><div class="pnh"><b>${it.id}</b> · <span class="sev${it.sev}">${SEV[it.sev]}</span></div>` +
      `<div>${CAT[it.cat]}${it.txt ? ': ' + it.txt : ''}</div>` +
      (it.net ? `<div>Сеть: ${NETN(it.net)}</div>` : '') +
      (it.pipes.length ? `<div>Трубопроводы: ${it.pipes.map(p => `<a href="#" data-pipe="${p.id}">${p.id}</a>`).join(', ')}</div>` : '') +
      (it.node ? `<div>Узел: ${nid(it.node)}${it.node2 ? ' ↔ ' + nid(it.node2) : ''}</div>` : '') +
      `<div>Координаты: x ${fmt(it.p[0])}; z ${fmt(it.p[2])}; отм. ${lvl(it.p[1])}</div>` +
      (it.d !== null && it.d !== undefined ? `<div>Расстояние / величина: ${fmt(it.d, 3)}</div>` : '') +
      `<div>Рядом: ${it.eq}</div>` +
      `<div>Рекомендация: ${REC[it.cat]}</div>` +
      `<div>Статус: ${it.status}</div></div>`;
  }
  function issueObj(it) { return { id: it.id, net: 1, name: CAT[it.cat], note: '', pdiag: it }; }
  function pipeAtHit(hit) {
    if (!hit || !hit.point) return null;
    const P = hit.point; let best = null, bd = Infinity;
    for (const s of nearSegs(P.x, P.z, 1.2)) {
      const ax = s.a[0], ay = s.a[1], az = s.a[2], ux = s.b[0] - ax, uy = s.b[1] - ay, uz = s.b[2] - az, l2 = ux * ux + uy * uy + uz * uz;
      const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((P.x - ax) * ux + (P.y - ay) * uy + (P.z - az) * uz) / l2)) : 0;
      const d = Math.hypot(P.x - ax - ux * t, P.y - ay - uy * t, P.z - az - uz * t) - s.r; if (d < bd) { bd = d; best = s; }
    }
    return best && bd < 0.5 ? best.pipe : null;
  }
  function cardHTML(o) {
    if (o._fit) return fitCard(o._fit);
    if (o.pdiag) return issueCard(o.pdiag);
    if (o._pp) return pipeCard(o._pp);
    if (!o.net) return '';
    const p = pipeAtHit(window.__lastHit); if (!p) return '';
    o._pnetPipe = p; highlight([p], p.id);
    return pipeCard(p);
  }
  function fitCard(f) {
    const ps = (f.pipes || []).filter(Boolean);
    return `<div class="pn"><div class="pnh">Фасонная деталь <b>${f.obj.id}</b> · ${f.obj.name}</div>` +
      (f.node ? `<div>Узел: ${nid(f.node)}</div>` : '') +
      (f.dims ? `<div>${f.dims}</div>` : '') +
      (ps.length ? `<div>Трубопроводы: ${ps.map(p => `<a href="#" data-hl="${p.id}">${p.id}</a>`).join(', ')}</div>` : '') +
      `<div>Достоверность: место — по модели сети; тип и размеры — <b>${ST.P}</b></div>` +
      `<div class="nt">${f.basis || REC.FITM}</div>` +
      (f.issue ? `<div>Журнал: <a href="#" data-iss="${f.issue.id}">${f.issue.id}</a></div>` : '') + `</div>`;
  }
  function bindCard(el, o) {
    if (o && o.pdiag) showIssue(o.pdiag, false);
    el.querySelectorAll('[data-hl]').forEach(b => b.onclick = () => { const p = byId[b.dataset.hl]; highlight([p], p.id); });
    el.querySelectorAll('[data-hlc]').forEach(b => b.onclick = () => { const p = byId[b.dataset.hlc], c = component(p); highlight(c, `${p.id}: связная сеть — ${c.length} участков`, hlMat2); toast(`Связная сеть: ${c.length} участков, ${fmt(c.reduce((a, q) => a + q.len, 0), 0)} м`); });
    el.querySelectorAll('[data-iss]').forEach(a => a.onclick = e => { e.preventDefault(); const it = issues.find(q => q.id === a.dataset.iss); select(issueObj(it)); showIssue(it); });
    el.querySelectorAll('[data-pipe]').forEach(a => a.onclick = e => { e.preventDefault(); const p = byId[a.dataset.pipe]; highlight([p], p.id); select({ id: p.id, net: 1, name: NETN(p.net), note: '', _pp: p }); });
  }
  const byId = {}; for (const p of pipes) byId[p.id] = p;

  /* ---------- 10. панель «Трубопроводы» ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #pipep{position:fixed;right:10px;top:58px;width:400px;max-width:calc(100% - 20px);max-height:74vh;background:rgba(255,255,255,.97);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);padding:8px 10px;font-size:12.5px;color:#1d2a36;display:none;flex-direction:column;box-sizing:border-box;z-index:5}
    #pipep .ph{display:flex;align-items:center;gap:6px} #pipep .ph span{font-size:11px;color:#6b7b88;flex:1}
    #pipep .tabs{display:flex;gap:4px;margin:6px 0} #pipep .tabs button{flex:1;border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:4px;font-size:12px;cursor:pointer;color:#1d2a36} #pipep .tabs button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #pipeBody{overflow:auto;flex:1;min-height:0}
    #pipep table{border-collapse:collapse;width:100%;font-size:11.5px} #pipep td,#pipep th{border-bottom:1px solid #e3e8ed;padding:3px 4px;text-align:right} #pipep th{color:#5b6b78;font-weight:600} #pipep td:first-child,#pipep th:first-child{text-align:left}
    #pipep .oc{font-size:11px;color:#5b6b78;font-weight:600;margin:8px 0 3px}
    #pipep .flt{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px} #pipep select{font:inherit;font-size:11.5px;padding:2px 4px;border:1px solid #c5cfd8;border-radius:6px;max-width:100%}
    #pipep .it{display:flex;gap:6px;padding:4px 5px;border-radius:6px;cursor:pointer;line-height:1.25} #pipep .it:hover,#pipep .it.sel{background:#e7eff6}
    #pipep .it b{min-width:62px;flex:none;color:#1d4e7a} #pipep .it i{width:9px;height:9px;border-radius:50%;flex:none;margin-top:3px}
    #pipep .nt{font-size:11px;color:#6b7b88;margin-top:6px}
    .sev3{color:#c0261c;font-weight:600} .sev2{color:#c46a00;font-weight:600} .sev1{color:#2f6fb0}
    #info .pn{font-size:12px;color:#33424f;margin-top:7px;border-top:1px solid #e3e8ed;padding-top:6px;line-height:1.4}
    #info .pn .pnh{font-size:13px;color:#1d2a36;margin-bottom:2px} #info .pn .pnb{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px} #info .pn .pnn{font-size:11px;color:#7a8a96;margin-top:5px}
    #info .pn a{color:#1d4e7a}
    @media (max-width:700px){ #pipep{max-height:62vh} }
  `;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'pipep';
  panel.innerHTML = `<div class="ph"><b>Трубопроводная сеть</b><span>модель, проверка, геометрия ·</span><button class="lbtn" id="pipeX">✕</button></div>
 <div class="tabs"><button data-t="sum" class="on">Сводка</button><button data-t="iss">Проблемы</button><button data-t="src">Источники</button></div>
 <div id="pipeBody"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#pipeBody');
  let tab = 'sum', fNet = '', fCat = '', fSev = '2';
  panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; panel.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  panel.querySelector('#pipeX').onclick = () => hidePanel();
  const bP = document.getElementById('bPipe');
  function showPanel() {
    closePanels(); ensureValidated();
    const top = Math.round(document.getElementById('top').getBoundingClientRect().bottom + 6) + 'px';
    panel.style.top = top; panel.style.maxHeight = `calc(100% - ${top} - 60px)`; panel.style.display = 'flex'; bP.classList.add('on');
    if (!layerApi.isOn('pdiag')) layerApi.setVis('pdiag', true);
    render();
  }
  function hidePanel() { panel.style.display = 'none'; bP.classList.remove('on'); }
  bP.onclick = () => panel.style.display === 'flex' ? hidePanel() : showPanel();
  const NETS_ORDER = ['dtl', 'dtz', 'b', 'd', 'gu', 'dt', 'lzb', 'pv', 'prp', 'heat', 'water', 'kpd', 'k1'];
  function render() {
    if (tab === 'sum') {
      let h = `<div class="oc">Сети (надземные и подземные участки)</div><table><tr><th>Сеть</th><th>Участков</th><th>Элем.</th><th>Длина, м</th><th>Откр. концы</th><th>Разрывы</th><th>Замеч.</th></tr>`;
      const tot = { p: 0, s: 0, l: 0, o: 0, g: 0, i: 0 };
      for (const k of NETS_ORDER) {
        const ps = pipes.filter(p => p.net === k); if (!ps.length) continue;
        const ss = segs.filter(s => s.net === k && s.on), L = ps.reduce((a, p) => a + p.len, 0), iss = issues.filter(it => it.net === k);
        const o = iss.filter(it => it.cat === 'OPEN').length, g = iss.filter(it => it.cat === 'GAP').length;
        tot.p += ps.length; tot.s += ss.length; tot.l += L; tot.o += o; tot.g += g; tot.i += iss.length;
        h += `<tr><td>${NI[k].code}</td><td>${ps.length}</td><td>${ss.length}</td><td>${fmt(L, 0)}</td><td>${o}</td><td>${g}</td><td><a href="#" data-fn="${k}">${iss.length}</a></td></tr>`;
      }
      h += `<tr><th>Итого</th><th>${tot.p}</th><th>${tot.s}</th><th>${fmt(tot.l, 0)}</th><th>${tot.o}</th><th>${tot.g}</th><th>${tot.i}</th></tr></table>`;
      h += `<div class="oc">Замечания по видам</div><table><tr><th>Вид</th><th>Крит.</th><th>Пред.</th><th>Инф.</th></tr>`;
      for (const c of Object.keys(CAT)) { const l = issues.filter(it => it.cat === c); if (!l.length) continue; h += `<tr><td><a href="#" data-fc="${c}">${CAT[c]}</a></td>${[3, 2, 1].map(s => `<td>${l.filter(it => it.sev === s).length || ''}</td>`).join('')}</tr>`; }
      h += `</table><div class="oc">Узлы и детали (фактический подсчёт по модели)</div><table>` +
        `<tr><td>Узлов сети</td><td>${nodes.length}</td></tr><tr><td>Стыков (степень ≥ 2)</td><td>${stat.joints}</td></tr>` +
        `<tr><td>Поворотов трассы</td><td>${stat.bends}</td></tr><tr><td>— из них с гнутым отводом</td><td>${stat.bendsFit}</td></tr>` +
        `<tr><td>Ветвлений (узлы ≥ 3 + врезки)</td><td>${stat.tees + stat.teeEnds}</td></tr><tr><td>Подключений к оборудованию</td><td>${stat.equipEnds}</td></tr>` +
        `<tr><td>Подъёмов/опусков (над/под землёй)</td><td>${stat.rises}</td></tr><tr><td>Пересечений на разных отметках</td><td>${stat.crossOK}</td></tr>` +
        `<tr><td>Переходов (редукторов) в модели</td><td>${FG.red + FG.elbowRed + FG.phxRed}</td></tr><tr><td>Фланцевых соединений у арматуры, насосов, стояков (PN16 — условно)</td><td>${FLANGE_STAT.valve + FLANGE_STAT.pump + FLANGE_STAT.riser}</td></tr>` +
        `<tr><td>Опор с хомутом на трассах ГП-005 (шаг 3 м — условно)</td><td>${PG.sup}</td></tr></table>` +
        `<div class="oc">Итерация 4: исправления и построение</div><table>` +
        `<tr><td>Разрывов восполнено по соосности</td><td>${stat.fills}</td></tr><tr><td>Контуров трубы исключено</td><td>${stat.contours}</td></tr><tr><td>Наложений отрезков устранено</td><td>${stat.trims}</td></tr>` +
        `<tr><td>Поворотов с гнутым отводом (построено)</td><td>${PG.bends}</td></tr><tr><td>Заглушек на свободных концах</td><td>${PG.caps}</td></tr>` +
        `<tr><td>Мешей труб / вершин</td><td>${PG.meshes} / ${PG.verts}</td></tr><tr><td>Удалено элементов прежней геометрии</td><td>${PG.hidden}</td></tr></table>` +
        `<div class="oc">Сверка с векторным ГП-005</div><table>` +
        `<tr><td>Штрихов подписей исключено</td><td>${stat.drops}</td></tr><tr><td>Поворотов восстановлено</td><td>${stat.corns}</td></tr>` +
        `<tr><td>Концов доведено до трубы</td><td>${stat.exts}</td></tr><tr><td>Разрывов соединено: линия на листе / подпись / правило</td><td>${V15.fillV} / ${V15.fillL} / ${V15.fillR}</td></tr>` +
        `<tr><td>Элементов с Ø по графике листа (измерено / по продолжению)</td><td>${V15.odm} / ${V15.odp}</td></tr>` +
        `<tr><td>Пересечений разведено: по невидимым линиям / условно</td><td>${V15.xHid} / ${V15.xCond}</td></tr><tr><td>Пересечений не разведено</td><td>${V15.xFail}</td></tr>` +
        `<tr><td>Окончаний в колодцах и камерах</td><td>${stat.wellEnds}</td></tr><tr><td>Заглушек коллекторов (конец за последним ответвлением)</td><td>${stat.capEnds}</td></tr>` +
        `<tr><td>Свободных концов: линия на листе кончается / идёт дальше</td><td>${stat.endsNoEv} / ${stat.endsEv}</td></tr></table>` +
        `<div class="oc">Итерация 5: фасонные детали — исполнение условное</div><table>` +
        `<tr><td>Отводов между участками (R = 1,5 Dн)</td><td>${FG.elbow}</td></tr><tr><td>— из них с переходом Ø</td><td>${FG.elbowRed}</td></tr>` +
        `<tr><td>Переходов концентрических (подтверждённая смена Ø)</td><td>${FG.red}</td></tr><tr><td>Переходов у патрубков насосов</td><td>${FG.phxRed}</td></tr>` +
        `<tr><td>Тройников и крестовин</td><td>${FG.tee}</td></tr><tr><td>Врезок (сварное ответвление)</td><td>${FG.branch}</td></tr>` +
        `<tr><td>Сварных стыков у деталей</td><td>${FG.weld}</td></tr><tr><td>Фланцевых соединений: арматура / насосы / стояки</td><td>${FLANGE_STAT.valve} / ${FLANGE_STAT.pump} / ${FLANGE_STAT.riser}</td></tr>` +
        `<tr><td>Выходов из цеха совмещено с ГП-005</td><td>${stat.aligns}</td></tr><tr><td>Опор не поставлено (под трубой другая труба)</td><td>${PG.supSkip}</td></tr></table>` +
        `<label style="display:flex;gap:6px;align-items:center;margin-top:7px"><input type="checkbox" id="pdCb" ${layerApi.isOn('pdiag') ? 'checked' : ''}>Маркеры замечаний на сцене</label>` +
        `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pnCb" ${layerApi.isOn('pnodes') ? 'checked' : ''}>Узлы сети (красные — открытые концы)</label>` +
        `<div style="display:flex;gap:6px;margin-top:7px"><button class="pbtn sm" id="pdCsv">Экспорт замечаний (CSV)</button><button class="pbtn sm" id="pdClr">Снять подсветку</button></div>` +
        `<div class="nt">Модель собрана из существующих данных. Валидатор сам ничего не исправляет; исправления выполнены только по согласованным правилам и записаны в журнал («Исправлено: …»), фасонные детали — условное исполнение («Фасонная деталь смоделирована условно»). Достоверность: трассы в плане по ГП-005/АК-041 — подтверждены; отметки осей надземных сетей (0,6 м над землёй) и глубины подземных — условны; диаметры сетей ГП-005 на листе не указаны. Построение ${fmt(tBuild, 0)} мс, проверка ${fmt(tVal, 0)} мс.</div>`;
      body.innerHTML = h;
      body.querySelector('#pdCb').onchange = e => layerApi.setVis('pdiag', e.target.checked);
      body.querySelector('#pnCb').onchange = e => layerApi.setVis('pnodes', e.target.checked);
      body.querySelector('#pdCsv').onclick = exportCSV;
      body.querySelector('#pdClr').onclick = () => clearHL();
      body.querySelectorAll('[data-fn]').forEach(a => a.onclick = e => { e.preventDefault(); fNet = a.dataset.fn; fCat = ''; fSev = ''; tab = 'iss'; syncTabs(); render(); });
      body.querySelectorAll('[data-fc]').forEach(a => a.onclick = e => { e.preventDefault(); fCat = a.dataset.fc; fNet = ''; fSev = ''; tab = 'iss'; syncTabs(); render(); });
    } else if (tab === 'iss') {
      const L = issues.filter(it => (!fNet || it.net === fNet) && (!fCat || it.cat === fCat) && (!fSev || it.sev >= +fSev));
      let h = `<div class="flt"><select id="fN"><option value="">Все сети</option>${NETS_ORDER.filter(k => pipes.some(p => p.net === k)).map(k => `<option value="${k}"${k === fNet ? ' selected' : ''}>${NI[k].code}</option>`).join('')}</select>` +
        `<select id="fC"><option value="">Все виды</option>${Object.keys(CAT).filter(c => issues.some(it => it.cat === c)).map(c => `<option value="${c}"${c === fCat ? ' selected' : ''}>${CAT[c]}</option>`).join('')}</select>` +
        `<select id="fS"><option value=""${!fSev ? ' selected' : ''}>Любая важность</option><option value="3"${fSev === '3' ? ' selected' : ''}>Только критичные</option><option value="2"${fSev === '2' ? ' selected' : ''}>Критичные и предупреждения</option></select></div>` +
        `<div class="nt" style="margin:0 0 4px">Показано ${Math.min(L.length, 300)} из ${L.length}. Нажмите строку — камера перейдёт к месту, участок подсветится.</div>`;
      for (const it of L.slice(0, 300)) h += `<div class="it" data-i="${it.id}"><i style="background:#${SCOL[it.sev].toString(16).padStart(6, '0')}"></i><b>${it.id}</b><span>${CAT[it.cat]}${it.pipes[0] ? ' · ' + it.pipes.map(p => p.id).join(', ') : ''}${it.txt ? '<br><span style="color:#6b7b88">' + it.txt + '</span>' : ''}</span></div>`;
      body.innerHTML = h;
      body.querySelector('#fN').onchange = e => { fNet = e.target.value; render(); };
      body.querySelector('#fC').onchange = e => { fCat = e.target.value; render(); };
      body.querySelector('#fS').onchange = e => { fSev = e.target.value; render(); };
      body.querySelectorAll('.it').forEach(d => d.onclick = () => { body.querySelectorAll('.it').forEach(x => x.classList.toggle('sel', x === d)); const it = issues.find(q => q.id === d.dataset.i); if (innerWidth < 700) hidePanel(); select(issueObj(it)); showIssue(it); });   // на телефоне панель закрывается, чтобы было видно место и карточку
    } else {
      let h = `<div class="oc">Механизмы построения труб в проекте (итерация 1)</div><table><tr><th>Источник</th><th>Элем.</th><th>Участков</th><th>Длина, м</th></tr>`;
      for (const g of Object.values(gens)) h += `<tr><td title="${g.txt}">${g.k}</td><td>${g.segs}</td><td>${g.pipes}</td><td>${fmt(g.len, 0)}</td></tr>`;
      h += `</table>` + Object.values(gens).map(g => `<div class="nt"><b>${g.k}</b> — ${g.txt}</div>`).join('') +
        `<div class="oc">Не входят в модель физических труб</div>` +
        `<div class="nt"><b>PROC</b> — граф ТП (${procLogic.E.length} рёбер): технологическая модель; сверяется с трубами (замечания «граф ТП»). Покрыто физическими трубами ≥ 95 %: ${procLogic.E.filter(e => e._pnet && e._pnet.cov >= 0.95).length} из ${procLogic.E.filter(e => e._pnet).length} рёбер-труб.` + (window.__PFLOW ? ' ' + window.__PFLOW.statText() : '') + `</div>` +
        `<div class="nt"><b>el, cab1, cab2, eh</b> — кабели и электрообогрев (не трубопроводы).</div>` +
        `<div class="nt"><b>PIPED</b> — сферы на стыках, условные фланцы, хомуты и изоляция теплосети скрыты (заменены построителем PGEO); бирки маркировки сохранены.</div>`;
      body.innerHTML = h;
    }
  }
  let showingOld = false;
  function showOld(on) { showingOld = on; for (const m of oldMeshes) m.visible = on; for (const m of newMeshes) m.visible = !on; toast(on ? 'Показана исходная геометрия: отрезки, сферы на стыках, ступеньки' : 'Показана геометрия: непрерывные трубы с отводами'); }
  const syncTabs = () => panel.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === tab));
  function exportCSV() {
    const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['ID', 'Вид', 'Важность', 'Сеть', 'Трубопроводы', 'Узел', 'X', 'Y (отм.)', 'Z', 'Величина', 'Описание', 'Рядом', 'Рекомендация', 'Статус']];
    for (const it of issues) rows.push([it.id, CAT[it.cat], SEV[it.sev], it.net ? NI[it.net].code : '', it.pipes.map(p => p.id).join(' '), it.node ? nid(it.node) : '', fmt(it.p[0], 3), fmt(H + it.p[1], 3), fmt(it.p[2], 3), it.d === null || it.d === undefined ? '' : fmt(it.d, 3), it.txt || '', it.eq, REC[it.cat], it.status]);
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'oskemen_pipe_check.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- 11. запуск ---------- */
  const tBuild = performance.now() - t0;
  let tVal = 0, validated = false;
  function ensureValidated() {
    if (validated) return; validated = true;
    const t1 = performance.now();
    try { validate(); applyNotes(); } catch (e) { console.error('PNET: ошибка проверки', e); }
    tVal = performance.now() - t1;
    buildMarkers();
  }
  setTimeout(ensureValidated, 1500);   // после первых кадров, чтобы не задерживать загрузку
  const api = { get nodes() { return nodes; }, segs, pipes, issues, gens, stat, PG, FG, FITS, V15, XR, EV, FL: FLANGE_STAT, fixes, oldMeshes, newMeshes, showOld, piped: PIPED.stats, CAT, SEV, NI, byId, nearSegs, segPt, compat, yEff, yOn, arcOf, classifyEnd, rendOf, cardHTML, bindCard, tick, highlight, clearHL, showIssue, hidePanel, showPanel, ensureValidated, component, nid, get validated() { return validated; }, get times() { return [tBuild, tVal]; } };
  window.__PNET = api;
  return api;
})();

