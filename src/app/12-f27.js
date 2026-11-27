/* =====================================================================================
   v0.27 — ПУНКТ ЗАПРАВКИ АВТОТРАНСПОРТА 166 по комплекту 166-ТХ (55555.pdf, стр. 16–19)
   166-ТХ-002-0 «План. Разрезы»: навес 4 стойки (оси 1–2 = 3650, А/1–А/2 = 4300), низ ригеля +2,800* (ось 2) / ≈ +3,050* (ось 1), кровля по прогонам;
     площадка −0,200 (оси 1/1–1/2 × А–Б = 3150 × 4800) с канализационным лотком по периметру и приямком 500 × 500 × 500; земля −0,400*;
     фундамент ТРК и фундамент насосно-измерительных блоков (верх 0,000 — за 0,000 принят верх фундамента ТРК, прим. 2);
     ТРК «Нара 4000» мод. С222 (поз. 1): корпус до +1,810*, рукава на шлангодержателях до +2,680*;
     насосно-измерительные блоки (в комплекте с ТРК): блок 1 — ДТ(Л) / ДТ(З) (через тройник поз. 9), блок 2 — бензин;
     вводы ⌀57×3 (поз. 3) на +0,100 (низ тр.) от границы проектирования (152-ТК-003): кран шаровый Ду50 ФБ39.010.50 (поз. 2), опора ОПП2-100.57 (поз. 11),
     переход Э-57×5-45×4 (поз. 10), ⌀45×3 (поз. 4) к блокам, ⌀32×3 (поз. 5) от блоков к ТРК, отводы поз. 6–8.
   166-ТХ-001-0: трубопроводы и арматура ДТ(Л) утепляются (маты 60 мм + сталь оцинкованная 0,5 мм; 166-ТХ.ВТ), ДТ(З) и бензин — окраска.
   Абсолютная отметка 0,000 = 298,10 (152-ТК-005-0). Привязка в плане: граница проектирования = концы трасс ГП-005 (x −42,74);
   оси вводов на листе (320 / 400 мм) совпадают с трассами ГП-005 (z −1,37 / −1,05 / −0,64).
   Условно: сечения стоек, ригелей и прогонов (КМ/КЖ нет; на плане стойка 100, на разрезах ≈ 200), облик ТРК и блоков (чертежей завода нет),
   строительная длина кранов, конструкция опор, ширина и уклон лотка, светильники.
   ===================================================================================== */
const F27 = (() => {
  const V = GK.V, UP = new THREE.Vector3(0, 1, 0), XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
  const C = { str: 0x7d858c, strD: 0x5a6168, galv: 0xa9b0b5, conc: 0xb8b3a8, concD: 0x8e8a82, dark: 0x2a2d31, blk: 0x1d1f21, red: 0xb3261e,
    roof: 0xb4bcc3, body: 0xe4e6e3, bodyD: 0xc9cdcf, panel: 0x30363c, glass: 0x1b2229, hose: 0x151617, nozzle: 0x3a3f44, blue: 0x1f5d99, yel: 0xd9a92b };
  /* ---------- привязка листа 166-ТХ-002-0: u — от оси 1 на восток (+x), v — от оси Б на юг (+z), h — от 0,000 ---------- */
  const AX1 = -46.32, AXB = -4.283, Y0 = 298.10 - H0;
  const sx = u => AX1 + u, sz = v => AXB + v;
  const P3 = (u, v, h) => V(sx(u), Y0 + h, sz(v));
  const W3 = (u, v, h) => [+sx(u).toFixed(3), +(Y0 + h).toFixed(3), +sz(v).toFixed(3)];
  const hc = u => 3.05 - 0.25 * u / 3.65;                  // низ ригеля: ≈ +3,050* у оси 1, +2,800* у оси 2 (разрезы 1-1, 2-2)
  const H57 = 0.1285, H45 = 0.1225, H32 = 0.22, HB_IN = 0.60, HT_IN = 0.22;   // HB_IN — внутренний тракт блока (насос, счётчик) внутри корпуса — условно; HT_IN — узел TJ под ТРК на уровне подводов (подъём поз. 8 к присоединению +0,440 — только изображение)   // оси: ввод ⌀57 (низ +0,100), ⌀45 (переход эксцентрический), ⌀32; входы в блок / ТРК
  const LN = { L: 2.913, Z: 3.230, B: 3.634 };            // оси вводов от оси Б (320 / 400 мм между ними — по плану)
  const U_BND = 3.578, U_VA = 2.606, U_VB = 2.209, U_TEE = 1.828, U_RL = 1.742, U_RB = 1.758, U_IN = 1.24;   // U_IN: вход ⌀45 в блок — по плану 1,284; сдвинут на 4 см внутрь рамы, чтобы не было ложной «врезки» в соседний подвод (присоединения внутри блоков — условно)
  const TRK = { u0: 1.202, u1: 1.661, v0: 0.953, v1: 1.852, hTop: 1.81, hHang: 2.68 }, TRKc = [(TRK.u0 + TRK.u1) / 2, (TRK.v0 + TRK.v1) / 2];
  const BLK = [{ n: 1, v0: 2.533, v1: 3.152, prod: 'ДТ(Л) / ДТ(З)' }, { n: 2, v0: 3.249, v1: 3.872, prod: 'бензин' }], BLK_H = 1.33;
  const L5 = { D: { u: 1.484, vB: 2.70, vT: 1.544 }, B: { u: 1.348, vB: 3.50, vT: 1.260 } };   // ⌀32×3 (поз. 5): от блоков к ТРК; выходы из блоков (по плану v 2,847 / 3,586) — разнесены от входов ⌀45 (условно)
  const pk = (me, f) => { me.userData.pick = f; me.castShadow = true; me.receiveShadow = true; return me; };
  const meshOf = (b, m, f) => { const me = b.mesh(m); if (f) pk(me, f); return me; };
  const concM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: mat.conc.map || null, roughness: 0.92, metalness: 0 });
  const concDM = new THREE.MeshStandardMaterial({ color: 0x8a867e, map: mat.conc.map || null, roughness: 0.95, metalness: 0 });
  function boxesMesh(list, m) {   // несколько параллелепипедов одним мешем с UV (для текстуры бетона)
    const pos = [], nor = [], uv = [], idx = []; let ov = 0;
    for (const [u0, u1, v0, v1, h0, h1] of list) {
      const w = u1 - u0, d = v1 - v0, h = h1 - h0, g = new THREE.BoxGeometry(w, h, d).translate(sx((u0 + u1) / 2), Y0 + (h0 + h1) / 2, sz((v0 + v1) / 2));
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let k = 0; k < P.count; k++) { pos.push(P.getX(k), P.getY(k), P.getZ(k)); nor.push(N.getX(k), N.getY(k), N.getZ(k)); uv.push(U.getX(k) * Math.max(w, d) * 0.6, U.getY(k) * Math.max(h, d) * 0.6); }
      for (const i of g.index.array) idx.push(i + ov); ov += P.count; g.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; return me;
  }
  const grateMat = (() => {
    const t = MATX.canvasTex(128, (x, s) => { x.fillStyle = '#000'; x.fillRect(0, 0, s, s); x.fillStyle = '#fff'; for (let i = 0; i < s; i += 16) x.fillRect(i, 0, 4, s); for (let j = 0; j < s; j += 32) x.fillRect(0, j, s, 4); }, false);
    t.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({ color: 0x5a6168, metalness: 0.45, roughness: 0.6, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  })();

  /* ---------- объекты карточек ---------- */
  const NOTE_TRK = 'Топливораздаточная колонка «Нара 4000» модель С222 с отсчётным устройством ЭЦТ 2-16.01 и силовым шкафом (IP54), 2 рукава, 50 л/мин, 200 кг, ЗАО «Нара» (166-ТХ.С-001-0 поз. 1; 166-ТХ-001-0). ' +
    'Положение — по плану 166-ТХ-002-0 (фундамент под ТРК, рама 459 × 898 мм); корпус до +1,810*, шлангодержатели до +2,680* (разрез 1-1). Облик корпуса, табло и пистолетов — условно (чертежей завода нет). ' +
    'Подача — насосно-измерительными блоками (в комплекте с ТРК), минуя насосный цех 200.';
  const O = {
    blk: n => ({ id: 'Блок ' + n + ' (166)', net: 1, f27: 'blk', name: 'Насосно-измерительный блок ' + n + ' ТРК «Нара 4000» — ' + BLK[n - 1].prod, note: 'В комплекте с ТРК (166-ТХ-002-0, разрез 1-1). Рама ' + Math.round((BLK[n - 1].v1 - BLK[n - 1].v0) * 1000) + ' × 459 мм на общем фундаменте, корпус до ≈ +1,330 (обмер разреза). Вход ⌀45×3 (поз. 4) снизу, выход ⌀32×3 (поз. 5) к ТРК. ' + (n === 1 ? 'Летнее и зимнее ДТ подаются в блок через тройник ⌀57 (поз. 9) — переключение кранами поз. 2.' : '') + ' Облик и внутренняя обвязка — условно (чертежей завода нет).' }),
    pipe: n => ({ id: 'Трубы 166', net: 1, f27: 'pipe', name: n, note: 'Трасса и отметки — по 166-ТХ-002-0 (план, разрезы 1-1, 2-2); трубы 166-ТХ.С-001-0 поз. 3–5 (ГОСТ 8732-78*, ст. 20), отводы поз. 6–8, тройник поз. 9, переход поз. 10. Изоляция ДТ(Л) — 166-ТХ.ВТ (маты 60 мм + сталь 0,5 мм). От границы проектирования до трасс ГП-005 — короткий условный переход к отметке ГП-005.' }),
    sup: { id: 'ОПП2 (166)', net: 1, f27: 'pipe', name: 'Опоры подвижные ОПП2-100.57 (поз. 11, ГОСТ 22130-86)', note: '3 шт. — по плану 166-ТХ-002-0 (по одной на вводе). Высота башмака 100 мм — по обозначению; стойка до площадки −0,200 — условно.' },
    pad: { id: '166', net: 1, f27: 'st', name: 'Площадка пункта заправки −0,200 с канализационным лотком и приямком', note: 'Площадка 3150 × 4800 мм (оси 1/1–1/2, А–Б), верх −0,200; лоток по периметру и приямок 500 × 500 × 500 мм в углу у осей А / 1/2 — по 166-ТХ-002-0. Ширина и уклон лотка, решётка приямка — условно (строительные решения в комплекте нет).' }
  };
  const trkObj = () => { const o = typeof procPumpObj === 'function' ? procPumpObj('ТРК-1') : { id: 'ТРК-1', net: 1, name: 'ТРК-1' }; o.f27 = 'trk'; o.note = NOTE_TRK; return o; };
  const blkObj = [O.blk(1), O.blk(2)];

  /* =========================== 1. НАВЕС =========================== */
  function roofSheet(u0, u1, v0, v1, yOf) {   // профнастил: трапециевидный профиль поперёк ската (шаг 0,2 м, h 0,04 — условно), рёбра вдоль ската
    const nz = Math.round((v1 - v0) / 0.05), pos = [], idx = [], prof = t => { const f = ((t % 0.2) + 0.2) % 0.2; return f < 0.05 ? 0 : f < 0.07 ? (f - 0.05) / 0.02 * 0.04 : f < 0.13 ? 0.04 : f < 0.15 ? (0.15 - f) / 0.02 * 0.04 : 0; };
    for (let j = 0; j <= nz; j++) { const v = v0 + (v1 - v0) * j / nz, d = prof(v - v0); pos.push(sx(u0), yOf(u0) + d, sz(v), sx(u1), yOf(u1) + d, sz(v)); if (j) { const a = (j - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function canopyTX(g) {
    const b = GK.builder(), US = [0, 3.65], VS = [0.25, 4.55];
    const ped = [];
    for (const u of US) for (const v of VS) {
      ped.push([u - 0.25, u + 0.25, v - 0.25, v + 0.25, -0.62, -0.05]);   // фундамент стойки 500 × 500 (план), верх ≈ −0,050 (разрез 1-1)
      b.box(0.3, 0.02, 0.3, sx(u), Y0 - 0.04, sz(v), C.strD);           // опорная плита
      b.box(0.16, hc(u) + 0.03, 0.16, sx(u), Y0 + (hc(u) - 0.03) / 2, sz(v), C.str);   // стойка — квадратная труба (условно)
      for (const [du, dv] of [[0.11, 0], [-0.11, 0], [0, 0.11], [0, -0.11]]) b.box(du ? 0.06 : 0.008, 0.1, dv ? 0.06 : 0.008, sx(u + du * 0.75), Y0 + 0.01, sz(v + dv * 0.75), C.strD);   // рёбра базы
    }
    g.add(boxesMesh(ped, concM));
    // ригели — швеллер вдоль ската по осям А/1, А/2 (консоли 0,35 м, разрез 2-2); прогоны — 4 шт. (разрез 2-2); сечения условно
    for (const v of VS) {
      const a = P3(-0.35, v, hc(-0.35) + 0.08), c = P3(4.0, v, hc(4.0) + 0.08);
      b.bar(a, c, 0.008, 0.16, C.str);
      for (const s of [-1, 1]) b.bar(V(a.x, a.y + s * 0.075, a.z + 0.03), V(c.x, c.y + s * 0.075, c.z + 0.03), 0.065, 0.01, C.str);
    }
    for (const u of [0.02, 1.23, 2.43, 3.66]) {
      const y = Y0 + hc(u) + 0.16 + 0.03;
      b.bar(V(sx(u), y, sz(-0.15)), V(sx(u), y, sz(4.92)), 0.004, 0.06, C.strD);
      for (const s of [-1, 1]) b.bar(V(sx(u), y + s * 0.027, sz(-0.15)), V(sx(u), y + s * 0.027, sz(4.92)), 0.05, 0.006, C.strD);
    }
    // светильники под прогонами (условно — проект ЭО в комплекте нет)
    const lamps = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, emissive: 0xfff4d6, emissiveIntensity: 0.55, roughness: 0.5 });
    for (const [u, v] of [[1.23, 1.4], [2.43, 3.3]]) { b.box(0.06, 0.12, 0.06, sx(u), Y0 + hc(u) + 0.10, sz(v), C.strD); const lm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.22), lamps); lm.position.set(sx(u), Y0 + hc(u) + 0.02, sz(v)); g.add(lm); }
    g.add(b.mesh(GK.MAT.paint));
    const yR = u => Y0 + hc(u) + 0.16 + 0.06 + 0.003;
    const rm = new THREE.Mesh(roofSheet(-0.43, 4.085, -0.15, 4.92, yR), new THREE.MeshStandardMaterial({ color: C.roof, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide }));
    rm.castShadow = rm.receiveShadow = true; g.add(rm);
    const be = GK.builder();   // торцевые планки кровли (условно)
    for (const v of [-0.15, 4.92]) be.bar(V(sx(-0.43), yR(-0.43) + 0.02, sz(v)), V(sx(4.085), yR(4.085) + 0.02, sz(v)), 0.01, 0.06, C.galv);
    g.add(be.mesh(GK.MAT.steel));
  }

  /* =========================== 2. ПЛОЩАДКА, ЛОТОК, ПРИЯМОК, ФУНДАМЕНТЫ =========================== */
  function pad(g) {
    const U0 = 0.25, U1 = 3.40, V0 = 0, V1 = 4.80, R = 0.13, T = 0.17, hT = -0.20, hB = -0.55, hL = -0.31;
    const PU0 = 2.77, PU1 = 3.27, PV0 = 4.18, PV1 = 4.68;   // приямок 500 × 500 (план)
    const top = [
      [U0, U1, V0, V0 + R, hB, hT], [U0, U1, V1 - R, V1, hB, hT], [U0, U0 + R, V0 + R, V1 - R, hB, hT], [U1 - R, U1, V0 + R, PV0, hB, hT],   // борт
      [U0 + R + T, U1 - R - T, V0 + R + T, PV0, hB, hT], [U0 + R + T, PU0, PV0, V1 - R - T, hB, hT]                                          // основная плита
    ];
    const low = [
      [U0 + R, U1 - R, V0 + R, V0 + R + T, hB, hL], [U0 + R, PU0, V1 - R - T, V1 - R, hB, hL], [U0 + R, U0 + R + T, V0 + R + T, V1 - R - T, hB, hL], [U1 - R - T, U1 - R, V0 + R + T, PV0, hB, hL],   // лоток
      [PU0, PU1, PV0, PV1, hB - 0.2, hB - 0.15], [U1 - R, U1, PV0, PV1, hB, hT]                                                                                 // дно приямка, стенки у угла
    ];
    const m1 = boxesMesh(top, concM), m2 = boxesMesh(low, concDM); g.add(m1, m2);   // карточка — объект генплана '166'
    const gr = new THREE.Mesh(new THREE.BoxGeometry(PU1 - PU0, 0.03, PV1 - PV0), grateMat); gr.position.set(sx((PU0 + PU1) / 2), Y0 + hT - 0.015, sz((PV0 + PV1) / 2)); g.add(gr);
    // фундаменты: ТРК и насосно-измерительных блоков (верх 0,000), по плану
    const fd = boxesMesh([[0.953, 1.911, 0.700, 2.101, hT, 0], [0.953, 1.911, 2.303, 4.101, hT, 0]], concM); g.add(fd);
  }

  /* =========================== 3. ТРК «Нара 4000» С222 и НАСОСНО-ИЗМЕРИТЕЛЬНЫЕ БЛОКИ =========================== */
  const disp = { c: null, t: null, L: 0, Bn: 0, run: 0, prod: '', last: '' };
  function dispTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; disp.c = c;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; disp.t = t; drawDisp(); return t;
  }
  const f2 = v => v.toFixed(2).replace('.', ',');
  function drawDisp() {
    const x = disp.c.getContext('2d'), on = disp.run;
    x.fillStyle = on ? '#0d1a12' : '#101418'; x.fillRect(0, 0, 256, 128);
    x.font = '600 16px system-ui,Arial'; x.fillStyle = on ? '#9ee6a8' : '#56606a'; x.textAlign = 'left';
    x.fillText('ТРК-1 · ' + (on ? 'ВЫДАЧА' : 'ГОТОВ'), 10, 22);
    const row = (lab, v, y) => { x.font = '700 24px system-ui,Arial'; x.fillStyle = on ? '#9ee6a8' : '#6f7b85'; x.textAlign = 'left'; x.fillText(lab, 10, y);
      x.font = '700 30px ui-monospace,Menlo,Consolas,monospace'; x.fillStyle = on ? '#c8ffcf' : '#7d8892'; x.textAlign = 'right'; x.fillText(f2(v) + ' л', 246, y); x.textAlign = 'left'; };
    row('ДТ', disp.L, 62); row('Бензин', disp.Bn, 100);
    x.font = '500 12px system-ui,Arial'; x.fillStyle = '#6f7b85'; x.fillText('учебная модель ТП', 10, 121);
    if (disp.t) disp.t.needsUpdate = true;
  }
  function trk(g) {
    const b = GK.builder(), bm = GK.builder(), { u0, u1, v0, v1, hTop, hHang } = TRK, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, W = u1 - u0, L = v1 - v0;
    // рама (цоколь) 0…0,28: стойки и обвязка, низ открыт — видны подводы ⌀32
    for (const u of [u0 + 0.02, u1 - 0.02]) for (const v of [v0 + 0.02, v1 - 0.02]) b.box(0.04, 0.28, 0.04, sx(u), Y0 + 0.14, sz(v), C.strD);
    for (const h of [0.015, 0.265]) { b.box(W, 0.03, 0.04, sx(uc), Y0 + h, sz(v0 + 0.02), C.strD); b.box(W, 0.03, 0.04, sx(uc), Y0 + h, sz(v1 - 0.02), C.strD); b.box(0.04, 0.03, L, sx(u0 + 0.02), Y0 + h, sz(vc), C.strD); b.box(0.04, 0.03, L, sx(u1 - 0.02), Y0 + h, sz(vc), C.strD); }
    // корпус 0,28…1,81: гидравлический отсек (низ), панель табло, верхняя крышка
    b.box(W, 0.86, L, sx(uc), Y0 + 0.28 + 0.43, sz(vc), C.body);
    b.box(W + 0.01, 0.02, L + 0.01, sx(uc), Y0 + 1.15, sz(vc), C.bodyD);
    b.box(W - 0.02, 0.62, L - 0.06, sx(uc), Y0 + 1.15 + 0.31, sz(vc), C.body);
    b.box(W + 0.03, 0.04, L + 0.03, sx(uc), Y0 + hTop - 0.02, sz(vc), C.bodyD);
    for (const s of [-1, 1]) {   // лицевые стороны (на восток и запад): двери гидроотсека с жалюзи, полоса фирменного цвета (условно)
      const uf = s < 0 ? u0 - 0.004 : u1 + 0.004;
      b.box(0.006, 0.6, L - 0.16, sx(uf), Y0 + 0.66, sz(vc), C.bodyD);
      for (let k = 0; k < 7; k++) b.box(0.01, 0.012, L - 0.3, sx(uf + s * 0.004), Y0 + 0.44 + k * 0.06, sz(vc), C.strD);
      b.box(0.008, 0.05, L, sx(uf), Y0 + 1.06, sz(vc), C.blue);
      b.box(0.012, 0.3, L - 0.14, sx(uf + s * 0.002), Y0 + 1.42, sz(vc), C.panel);   // рамка табло
      b.box(0.012, 0.09, 0.2, sx(uf + s * 0.002), Y0 + 1.22, sz(vc), C.panel);      // клавиатура
      for (const dv of [-0.3, 0.3]) b.box(0.01, 0.02, 0.02, sx(uf + s * 0.003), Y0 + 0.98, sz(vc + dv), C.dark);   // замки дверей
    }
    // пистолеты в держателях на торцах (север — ДТ, юг — бензин; распределение по торцам — условно), рукава на шлангодержателях до +2,680*
    const nozM = new THREE.MeshStandardMaterial({ color: C.nozzle, roughness: 0.5, metalness: 0.4 });
    for (const [s, vE, col] of [[-1, v0, 0x2b2b2b], [1, v1, 0x2a6e3a]]) {
      const vo = vE + s * 0.005;
      b.box(0.22, 0.24, 0.07, sx(uc), Y0 + 1.22, sz(vo + s * 0.035), C.bodyD);                              // держатель
      bm.box(0.05, 0.16, 0.06, sx(uc), Y0 + 1.25, sz(vo + s * 0.085), C.nozzle);                           // корпус пистолета
      bm.cyl(P3(uc, vo + s * 0.085, 1.17), P3(uc, vo + s * 0.04, 1.08), 0.011, C.galv, 8);                 // носик в держателе
      bm.box(0.04, 0.05, 0.09, sx(uc), Y0 + 1.14, sz(vo + s * 0.115), col);                                // рычаг / колпачок (цвет — условно)
      // шлангодержатель: перевёрнутая «U» над корпусом в плоскости торца (разрез 1-1)
      const vi = vc + s * 0.18, vo2 = vc + s * 0.39, R = (vo2 - vi) / 2, va = (vi + vo2) / 2;
      const hose = []; hose.push(new THREE.Vector3(sx(uc), Y0 + hTop, sz(vi)), new THREE.Vector3(sx(uc), Y0 + hHang - R, sz(vi)));
      for (let k = 1; k < 8; k++) { const a = Math.PI * k / 8; hose.push(new THREE.Vector3(sx(uc), Y0 + hHang - R + Math.sin(a) * R, sz(va - s * Math.cos(a) * R))); }
      hose.push(new THREE.Vector3(sx(uc), Y0 + hHang - R, sz(vo2)), new THREE.Vector3(sx(uc), Y0 + 1.75, sz(vo2)), new THREE.Vector3(sx(uc), Y0 + 1.5, sz(vo2 + s * 0.06)),
        new THREE.Vector3(sx(uc), Y0 + 0.9, sz(vE + s * 0.16)), new THREE.Vector3(sx(uc - 0.04), Y0 + 0.25, sz(vE + s * 0.2)), new THREE.Vector3(sx(uc - 0.06), Y0 + 0.16, sz(vE + s * 0.12)),
        new THREE.Vector3(sx(uc - 0.03), Y0 + 0.5, sz(vE + s * 0.11)), new THREE.Vector3(sx(uc), Y0 + 1.06, sz(vo + s * 0.11)));
      const hm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hose, false, 'centripetal'), 64, 0.013, 8, false), new THREE.MeshStandardMaterial({ color: C.hose, roughness: 0.7, metalness: 0.05 }));
      pk(hm, trkObj); g.add(hm);
      for (let k = 0; k < 6; k++) bm.add(new THREE.TorusGeometry(0.02, 0.004, 5, 12).rotateX(Math.PI / 2).translate(sx(uc), Y0 + 1.42 + k * 0.03, sz(vo2)), C.galv);   // пружина-переломоограничитель
      b.box(0.06, 0.03, 0.06, sx(uc), Y0 + hTop + 0.015, sz(vi), C.dark);
    }
    // отводы 90-32×3 (поз. 8) и подъёмы ⌀32 к присоединениям ТРК на +0,440 (разрез 1-1) — изображение; в модели сети подвод заканчивается у отвода
    for (const [L, col] of [[L5.D, 0x8d949a], [L5.B, 0x00b7d8]]) {
      const c = P3(L.u, L.vT, H32), R = 0.048;   // подвод идёт с юга (+v) на север (−z); отвод R = 1,5 Dн
      const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6 * Math.PI / 2; pts.push(V(c.x, c.y + R * (1 - Math.cos(t)), c.z - R * Math.sin(t))); }
      for (let k = 0; k < 6; k++) b.cyl(pts[k], pts[k + 1], 0.016, col, 10);
      b.cyl(V(c.x, c.y + R, c.z - R), V(c.x, Y0 + 0.43, c.z - R), 0.016, col, 10);
      b.cyl(V(c.x, Y0 + 0.43, c.z - R), V(c.x, Y0 + 0.448, c.z - R), 0.07, C.dark, 14);   /* фланец присоединения (условно) */
    }
    g.add(meshOf(b, GK.MAT.paint, trkObj)); g.add(meshOf(bm, nozM, trkObj));
    // табло (два лицевых), общий холст — показания учебной модели
    const tx = dispTex(), dm = new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.55, roughness: 0.3 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.2, 0.25), dm); p.position.set(sx(s < 0 ? u0 - 0.018 : u1 + 0.018), Y0 + 1.42, sz(vc)); /* перед рамкой табло (рамка до ±0,012) */ p.rotation.y = s < 0 ? -Math.PI / 2 : Math.PI / 2; pk(p, trkObj); g.add(p); }
  }
  function blocks(g) {
    for (const B of BLK) {
      const b = GK.builder(), { v0, v1 } = B, u0 = TRK.u0, u1 = TRK.u1, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, W = u1 - u0, L = v1 - v0;
      for (const u of [u0 + 0.02, u1 - 0.02]) for (const v of [v0 + 0.02, v1 - 0.02]) b.box(0.04, 0.27, 0.04, sx(u), Y0 + 0.135, sz(v), C.strD);
      for (const h of [0.015, 0.255]) { b.box(W, 0.03, 0.04, sx(uc), Y0 + h, sz(v0 + 0.02), C.strD); b.box(W, 0.03, 0.04, sx(uc), Y0 + h, sz(v1 - 0.02), C.strD); }
      b.box(W, BLK_H - 0.27, L, sx(uc), Y0 + 0.27 + (BLK_H - 0.27) / 2, sz(vc), C.body);
      b.box(W + 0.04, 0.03, L + 0.04, sx(uc), Y0 + BLK_H + 0.015, sz(vc), C.bodyD);
      for (const s of [-1, 1]) {
        const uf = s < 0 ? u0 - 0.004 : u1 + 0.004;
        b.box(0.006, BLK_H - 0.4, L - 0.08, sx(uf), Y0 + 0.27 + (BLK_H - 0.27) / 2, sz(vc), C.bodyD);   // дверь
        for (let k = 0; k < 6; k++) b.box(0.01, 0.012, L - 0.2, sx(uf + s * 0.004), Y0 + 0.42 + k * 0.05, sz(vc), C.strD);   // жалюзи
        b.box(0.012, 0.1, 0.02, sx(uf + s * 0.004), Y0 + 0.86, sz(v1 - 0.08), C.dark);   // ручка
        b.box(0.008, 0.06, 0.16, sx(uf + s * 0.002), Y0 + 1.12, sz(vc), B.n === 1 ? C.yel : 0x00b7d8);   // табличка продукта (цвет — по легенде сетей модели)
      }
      g.add(meshOf(b, GK.MAT.paint, () => blkObj[B.n - 1]));
    }
  }

  /* =========================== 4. АРМАТУРА, ОПОРЫ, ИЗОЛЯЦИЯ АРМАТУРЫ =========================== */
  const levers = [];
  function ballValve(g, u, v, vid, ins) {   // кран шаровый фланцевый Ду50 Ру1,6 ФБ39.010.50 (10с19п1), поз. 2; строительная длина 0,23 м — условно
    const b = GK.builder(), c = P3(u, v, H57), L = 0.23, Df = 0.165;
    for (const s of [-1, 1]) { b.cyl(c.clone().addScaledVector(XA, s * L / 2), c.clone().addScaledVector(XA, s * (L / 2 - 0.018)), Df / 2, C.dark, 20); b.cyl(c.clone().addScaledVector(XA, s * (L / 2 + 0.018)), c.clone().addScaledVector(XA, s * L / 2), Df / 2, C.dark, 20); }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const a = (k + 0.5) * Math.PI / 2, d = V(0, Math.cos(a) * 0.0625, Math.sin(a) * 0.0625); b.cyl(c.clone().add(d).addScaledVector(XA, s * (L / 2 - 0.03)), c.clone().add(d).addScaledVector(XA, s * (L / 2 + 0.03)), 0.008, C.galv, 6); }
    b.cyl(c.clone().addScaledVector(XA, -L / 2 + 0.018), c.clone().addScaledVector(XA, L / 2 - 0.018), 0.05, 0x5a6168, 18);
    b.add(new THREE.SphereGeometry(0.068, 18, 12).scale(1.15, 1, 1).translate(c.x, c.y, c.z), 0x5a6168);
    const hS = ins ? 0.17 : 0.1;
    b.cyl(V(c.x, c.y + 0.05, c.z), V(c.x, c.y + hS, c.z), 0.016, C.dark, 10);
    if (ins) {   // съёмный утеплённый кожух крана ДТ(Л): маты 60 мм + сталь оцинкованная 0,5 мм (166-ТХ.ВТ)
      b.cyl(c.clone().addScaledVector(XA, -L / 2 - 0.06), c.clone().addScaledVector(XA, L / 2 + 0.06), 0.15, C.galv, 22);
      for (const s of [-1, 1]) b.ring(c.clone().addScaledVector(XA, s * (L / 2 + 0.03)), XA, 0.151, 0.005, C.strD, 22);
    }
    g.add(meshOf(b, GK.MAT.paint, () => typeof procValveObj === 'function' ? procValveObj(vid) : null));
    const lg = new THREE.Group(); lg.position.set(c.x, c.y + hS, c.z); g.add(lg);
    const bl = GK.builder(); bl.box(0.03, 0.02, 0.03, 0, 0, 0, C.dark); bl.box(0.24, 0.012, 0.025, 0.12, 0.012, 0, C.red);
    lg.add(meshOf(bl, GK.MAT.paint, () => typeof procValveObj === 'function' ? procValveObj(vid) : null));
    levers.push({ g: lg, vid, k: -1 });
    return [c.x, c.y + hS + 0.14, c.z, 0.5];
  }
  function supports(g) {   // ОПП2-100.57 (поз. 11): башмак 100 мм на стойке от площадки −0,200 (стойка — условно)
    const b = GK.builder();
    for (const [u, v, ins] of [[U_VB, LN.L, 1], [U_VA, LN.Z, 0], [U_VB, LN.B, 0]]) {
      const c = P3(u, v, H57), yb = c.y - 0.0285, r = ins ? 0.089 : 0.0285;
      b.box(0.16, 0.012, 0.16, c.x, Y0 - 0.2 + 0.006, c.z, C.strD);
      b.box(0.06, 0.2 - 0.012, 0.06, c.x, Y0 - 0.1, c.z, C.str);
      b.box(0.16, 0.01, 0.1, c.x, Y0 + 0.005, c.z, C.strD);   // опорная пластина
      b.box(0.12, 0.008, 0.08, c.x, yb - 0.1 + 0.004, c.z, C.strD);   // подошва башмака
      b.box(0.1, 0.092, 0.008, c.x, yb - 0.054, c.z, C.str);           // ребро башмака (до трубы)
      if (ins) b.ring(c, XA, r + 0.004, 0.006, C.galv, 18); else b.ring(c, XA, r + 0.003, 0.004, C.galv, 14);
    }
    g.add(meshOf(b, GK.MAT.paint, () => O.sup));
  }

  /* =========================== 5. СБОРКА =========================== */
  const oldG = new THREE.Group(); oldG.name = '166: прежняя условная модель'; oldG.visible = false; scene.add(oldG);
  function old166() {   // прежняя условная модель v0.10 (для сравнения): навес по контуру ГП-003 и ТРК-параллелепипед
    const g = new THREE.Group();
    canopy(g, [2660, 2934, 2722, 3006], 4.5); FAC.canopyLights(g, [2660, 2934, 2722, 3006], 4.5, 2);
    boxPx(g, 2668, 2945, 2714, 2995, 0.15, mat.conc);
    boxPx(g, 2684, 2958, 2698, 2982, 1.9, mat.red, 0.15);
    const [a, b] = P(2660, 2934), [c, d] = P(2722, 3006); g.position.y = hAt((a + c) / 2, (b + d) / 2); oldG.add(g);
  }
  const IND = {};
  function build(g) {
    canopyTX(g); pad(g); trk(g); blocks(g); supports(g);
    IND['166-Л'] = ballValve(g, U_VA, LN.L, '166-Л', 1);
    IND['166-З'] = ballValve(g, U_VB, LN.Z, '166-З', 0);
    IND['166-Б'] = ballValve(g, U_VA, LN.B, '166-Б', 0);
  }

  /* =========================== 6. ТРУБЫ → ЕДИНАЯ МОДЕЛЬ СЕТИ (PIPEREG → PNET / PGEO / PFLOW) =========================== */
  const netMat = k => { const l = netLayers[k]; if (l) for (const c of l.children) if (c.userData.netsSeg === k && !c.userData.under) return c.material; return null; };
  const lzbMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.45, metalness: 0.3 });
  const insMat = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, metalness: 0.6, roughness: 0.35 });   // покрытие изоляции — сталь оцинкованная 0,5 мм
  const REC = [];
  const pipeG = new THREE.Group(); pipeG.name = 'F27: трубы пункта заправки 166'; scene.add(pipeG);
  const reg = o => { const r = Object.assign({ gen: 'TK', src: '166-ТХ-002-0', cf: { plan: 'V', elev: 'V', dn: 'V' } }, o); PIPEREG.push(r); REC.push(r); };
  const endOf = (k, z) => {   // конец надземной трассы ГП-005 у границы проектирования
    const L = (NETS[k] || []).filter(s => !s[4]);
    let best = null; for (const s of L) for (const [x, zz] of [[s[0], s[1]], [s[2], s[3]]]) if (Math.abs(zz - z) < 0.05 && Math.abs(x - sx(U_BND)) < 0.15) best = [x, zz];
    return best;
  };
  function pipes() {
    const o = n => Object.assign(O.pipe(n), { gS: pipeG });   // gS — родитель для участков, которых нет в слоях сетей ГП-005 (смешанная линия 'lzb')
    const yN = (x, z) => hAt(x, z) + 0.6;   // ось надземной трассы ГП-005 в узле (правило модели сети, v0.12)
    const lines = [['dtl', 'L', 'ДТ(Л)'], ['dtz', 'Z', 'ДТ(З)'], ['b', 'B', 'Бензин']];
    const st = {};
    for (const [k, key, nm] of lines) {
      const e = endOf(k, sz(LN[key])); st[k] = !!e;
      const E = e ? [e[0], +yN(e[0], e[1]).toFixed(3), e[1]] : W3(U_BND, LN[key], H57);
      const mt = netMat(k), ins = k === 'dtl';
      const head = [E, W3(3.20, LN[key], H57)];
      if (k === 'dtl') reg({ net: k, r: 0.089, od: 0.057, pts: [...head, W3(U_TEE, LN.L, H57)], name: 'ДТ(Л) ⌀57×3 (поз. 3) с изоляцией 60 мм — от границы проектирования (152-ТК-003) к тройнику (поз. 9)', mt: insMat, o: o('ДТ(Л) ⌀57×3 к пункту заправки 166 (изоляция 60 мм + сталь 0,5 мм)') });
      if (k === 'dtz') {
        reg({ net: k, r: 0.0285, od: 0.057, pts: [...head, W3(1.98, LN.Z, H57)], name: 'ДТ(З) ⌀57×3 (поз. 3) — от границы проектирования к тройнику ДТ(Л)', mt, o: o('ДТ(З) ⌀57×3 к пункту заправки 166') });
        reg({ net: k, r: 0.089, od: 0.057, pts: [W3(1.98, LN.Z, H57), W3(U_TEE, LN.Z, H57), W3(U_TEE, LN.L, H57)], name: 'ДТ(З) ⌀57×3 — отвод (поз. 6) и врезка в тройник ДТ(Л), с изоляцией (166-ТХ.ВТ)', mt: insMat, o: o('ДТ(З) ⌀57×3: отвод к тройнику (изоляция — 166-ТХ.ВТ)') });
      }
      if (k === 'b') {
        reg({ net: k, r: 0.0285, od: 0.057, pts: [...head, W3(U_RB, LN.B, H57)], name: 'Бензин ⌀57×3 (поз. 3) — от границы проектирования к переходу (поз. 10)', mt, o: o('Бензин ⌀57×3 к пункту заправки 166') });
        reg({ net: k, r: 0.0225, od: 0.045, pts: [W3(U_RB, LN.B, H45), W3(U_IN, LN.B, H45), W3(U_IN, LN.B, HB_IN)], name: 'Бензин ⌀45×3 (поз. 4) — к насосно-измерительному блоку 2', mt, o: o('Бензин ⌀45×3 к блоку 2') });
        reg({ net: k, r: 0.0225, od: 0.045, pts: [W3(U_IN, LN.B, HB_IN), W3(L5.B.u, LN.B, HB_IN), W3(L5.B.u, L5.B.vB, HB_IN)], name: 'Насосно-измерительный блок 2: внутренний тракт (насос, счётчик) — условно, внутри корпуса', mt, o: Object.assign(O.blk(2), { gS: pipeG }) });
        reg({ net: k, r: 0.016, od: 0.032, pts: [W3(L5.B.u, L5.B.vB, HB_IN), W3(L5.B.u, L5.B.vB, H32), W3(L5.B.u, L5.B.vT, H32)], name: 'Бензин ⌀32×3 (поз. 5) — от блока 2 к ТРК', mt, o: o('Бензин ⌀32×3: блок 2 → ТРК'), eqEnd: 'ТРК «Нара 4000»: вход ⌀32 (бензин), отвод поз. 8 вверх к присоединению +0,440' });
      }
    }
    // за тройником (поз. 9) — общий участок ДТ(Л) / ДТ(З): в модели сети — смешанная линия 'lzb' (как коллектор станции 186)
    const mL = netMat('lzb') || lzbMat;
    reg({ net: 'lzb', r: 0.089, od: 0.057, pts: [W3(U_TEE, LN.L, H57), W3(U_RL, LN.L, H57)], name: 'ДТ(Л)+ДТ(З) ⌀57×3 — от тройника к переходу, с изоляцией', mt: insMat, o: o('ДТ ⌀57×3 за тройником (изоляция)') });
    reg({ net: 'lzb', r: 0.0825, od: 0.045, pts: [W3(U_RL, LN.L, H45), W3(TRK.u1, LN.L, H45)], name: 'ДТ ⌀45×3 (поз. 4) с изоляцией — к насосно-измерительному блоку 1', mt: insMat, o: o('ДТ ⌀45×3 к блоку 1 (изоляция)') });
    reg({ net: 'lzb', r: 0.0225, od: 0.045, pts: [W3(TRK.u1, LN.L, H45), W3(U_IN, LN.L, H45), W3(U_IN, LN.L, HB_IN)], name: 'ДТ ⌀45×3 — вход в насосно-измерительный блок 1 (в раме блока)', mt: mL, o: o('ДТ ⌀45×3: вход в блок 1') });
    reg({ net: 'lzb', r: 0.0225, od: 0.045, pts: [W3(U_IN, LN.L, HB_IN), W3(L5.D.u, LN.L, HB_IN), W3(L5.D.u, L5.D.vB, HB_IN)], name: 'Насосно-измерительный блок 1: внутренний тракт (насос, счётчик) — условно, внутри корпуса', mt: mL, o: Object.assign(O.blk(1), { gS: pipeG }) });
    reg({ net: 'lzb', r: 0.016, od: 0.032, pts: [W3(L5.D.u, L5.D.vB, HB_IN), W3(L5.D.u, L5.D.vB, H32), W3(L5.D.u, BLK[0].v0, H32)], name: 'ДТ ⌀32×3 (поз. 5) — выход из блока 1 (в раме блока)', mt: mL, o: o('ДТ ⌀32×3: выход из блока 1') });
    reg({ net: 'lzb', r: 0.076, od: 0.032, pts: [W3(L5.D.u, BLK[0].v0, H32), W3(L5.D.u, TRK.v1, H32)], name: 'ДТ ⌀32×3 (поз. 5) с изоляцией — между фундаментами', mt: insMat, o: o('ДТ ⌀32×3: блок 1 → ТРК (изоляция)') });
    reg({ net: 'lzb', r: 0.016, od: 0.032, pts: [W3(L5.D.u, TRK.v1, H32), W3(L5.D.u, L5.D.vT, H32)], name: 'ДТ ⌀32×3 — подвод под ТРК (в раме ТРК)', mt: mL, o: o('ДТ ⌀32×3: вход в ТРК'), eqEnd: 'ТРК «Нара 4000»: вход ⌀32 (ДТ), отвод поз. 8 вверх к присоединению +0,440' });
    return st;
  }

  /* =========================== 7. ГРАФ ТП: геометрия узлов и рёбер по физическим трубам (топология без изменений) =========================== */
  function patchProc(PR) {
    const N = PR.nodes, E = Object.fromEntries(PR.edges.map(e => [e.id, e])), Vv = PR.valves;
    const p2 = (u, v) => [+sx(u).toFixed(3), +sz(v).toFixed(3)], p3 = (u, v, h) => [+sx(u).toFixed(3), +sz(v).toFixed(3), +(Y0 + h).toFixed(3)];
    const set = (id, pts) => { if (E[id]) { E[id].pts = pts; E[id].src = E[id].src === 'усл' ? 'ТХ-166' : E[id].src; } };
    const L = [['L', 'e121', 'TL0', 'TL1', 'e124', U_VA], ['Z', 'e122', 'TZ0', 'TZ1', 'e126', U_VB], ['B', 'e123', 'TB0', 'TB1', 'e128', U_VA]];
    for (const [k, ePipe, n0, n1, eV, uV] of L) {
      const v = LN[k], vid = '166-' + { L: 'Л', Z: 'З', B: 'Б' }[k];
      if (N[n0]) N[n0].p = p2(U_BND, v);
      if (E[ePipe]) { const q = E[ePipe].pts; q[q.length - 1] = p2(U_BND, v); }
      set(eV, [p2(uV, v), p2(uV, v)]);
      if (Vv[vid]) { Vv[vid].p = p2(uV, v); Vv[vid].src = 'ТХ-166'; Vv[vid].typ = 'КШ'; Vv[vid].n = 'Кран шаровый Ду50 на линии ' + { L: 'ДТ(Л)', Z: 'ДТ(З)', B: 'бензина' }[k] + ' к ТРК-1 (поз. 2)';
        Vv[vid].note = 'Кран шаровый фланцевый Ду50 Ру1,6 ФБ39.010.50 (10с19п1), ЗАО «Фобос» — 166-ТХ.С-001-0 поз. 2; место — по плану 166-ТХ-002-0' + (k === 'L' ? '; в утеплённом кожухе (166-ТХ.ВТ)' : '') + '. До v0.27 — «задвижка» (АК-004). Поток контролируется FA166-01/02/03.'; }
      if (N[n1]) N[n1].p = p2(uV - 0.2, v);
    }
    const tj = [TRKc[0], TRKc[1]];
    if (N.TJ) { N.TJ.p = p2(tj[0], tj[1]); N.TJ.y = +(Y0 + HT_IN).toFixed(3); N.TJ.noSnap = 1; }   // условный узел слияния (АК-004) внутри цоколя ТРК: к трубам не привязывается — «Сверка» P30
    const dTail = [p3(U_RL, LN.L, H45), p3(U_IN, LN.L, H45), p3(U_IN, LN.L, HB_IN), p3(L5.D.u, LN.L, HB_IN), p3(L5.D.u, L5.D.vB, HB_IN), p3(L5.D.u, L5.D.vB, H32), p3(L5.D.u, L5.D.vT, H32), p3(tj[0], tj[1], HT_IN)];
    set('e125', [p3(U_VA - 0.2, LN.L, H57), p3(U_TEE, LN.L, H57), ...dTail]);
    set('e127', [p3(U_VB - 0.2, LN.Z, H57), p3(U_TEE, LN.Z, H57), p3(U_TEE, LN.L, H57), ...dTail]);
    set('e129', [p3(U_VA - 0.2, LN.B, H57), p3(U_RB, LN.B, H57), p3(U_IN, LN.B, H45), p3(U_IN, LN.B, HB_IN), p3(L5.B.u, LN.B, HB_IN), p3(L5.B.u, L5.B.vB, HB_IN), p3(L5.B.u, L5.B.vB, H32), p3(L5.B.u, L5.B.vT, H32), p3(tj[0], tj[1], HT_IN)]);
    if (N.TRK) { N.TRK.p = p2(tj[0], tj[1]); N.TRK.y = +(Y0 + 1.15).toFixed(3); N.TRK.n = 'ТРК-1 («Нара 4000», мод. С222) — пункт заправки 166'; }
    set('e130', [p3(tj[0], tj[1], HT_IN), p3(tj[0], tj[1], 1.15)]);
  }
  function ind(I) { for (const [k, v] of Object.entries(IND)) I[k] = v; }

  /* =========================== 8. АНИМАЦИЯ, КАРТОЧКИ, ВИДЫ =========================== */
  let tPrev = 0, okNets = null, cardT = 0;
  const pumpOn = () => { try { return !!procLogic.st.pump['ТРК-1']; } catch (e) { return false; } };
  const vOpen = id => { try { return !!procLogic.st.valve[id]; } catch (e) { return false; } };
  function flowing() { try { return typeof procSim !== 'undefined' && procSim.S.flows.some(f => (f.pumps || []).includes('ТРК-1')); } catch (e) { return false; } }
  function tick(now) {
    const dt = Math.min(0.2, tPrev ? (now - tPrev) / 1000 : 0); tPrev = now;
    if (typeof procLogic === 'undefined') return;
    for (const l of levers) {   // рукоятка вдоль трубы — открыт, поперёк — закрыт
      const tgt = window.__VPOS ? window.__VPOS(l.vid, vOpen(l.vid) ? 1 : 0) : (vOpen(l.vid) ? 1 : 0);
      if (l.k < 0) l.k = tgt;
      if (Math.abs(tgt - l.k) > 1e-3) l.k += Math.sign(tgt - l.k) * Math.min(Math.abs(tgt - l.k), dt / 0.8);
      l.g.rotation.y = Math.PI + (1 - l.k) * Math.PI / 2;
    }
    const run = flowing() ? 1 : 0, d = vOpen('166-Л') || vOpen('166-З'), bz = vOpen('166-Б'), q = 50 / 60 * dt * (api.speed || 1), n = (d ? 1 : 0) + (bz ? 1 : 0);
    if (run && n) { if (d) disp.L += q / n; if (bz) disp.Bn += q / n; }
    const key = run + '|' + disp.L.toFixed(2) + '|' + disp.Bn.toFixed(2);
    if (disp.c && key !== disp.last && (!run || (cardT += dt) > 0.2 || disp.run !== run)) { cardT = 0; disp.run = run; disp.last = key; drawDisp(); }
    const el = document.getElementById('f27st'); if (el && (el.dataset.k !== key)) { el.dataset.k = key; el.innerHTML = stateHTML(); }
  }
  function stateHTML() {
    const run = flowing(), on = pumpOn();
    return `Насос ТРК-1 (модель ТП): <b>${on ? 'включён' : 'выключен'}</b>${run ? ' · <b style="color:#1d4e7a">идёт выдача</b>' : on ? ' · маршрут не открыт' : ''}. ` +
      `Краны: ДТ(Л) — ${vOpen('166-Л') ? 'открыт' : 'закрыт'}, ДТ(З) — ${vOpen('166-З') ? 'открыт' : 'закрыт'}, бензин — ${vOpen('166-Б') ? 'открыт' : 'закрыт'}. ` +
      `Табло: ДТ ${f2(disp.L)} л, Б ${f2(disp.Bn)} л (учебный счётчик: 50 л/мин на ТРК, при двух открытых продуктах — поровну).`;
  }
  const VIEWS = {
    st: () => flyTo([sx(7.8), Y0 + 4.6, sz(7.9)], [sx(1.8), Y0 + 0.9, sz(2.2)], 0.9),
    trk: () => flyTo([sx(4.1), Y0 + 2.1, sz(-0.6)], [sx(1.43), Y0 + 1.1, sz(1.6)], 0.9),
    inl: () => flyTo([sx(4.7), Y0 + 1.7, sz(1.9)], [sx(2.3), Y0 + 0.12, sz(3.35)], 0.9)   // между стойками осей А/1 и А/2 — видны краны, опоры, тройник и переходы
  };
  function cardHTML(o) {
    const k = o && (o.f27 || (o.id === '166' ? 'st' : null)); if (!k) return '';
    let h = '<div class="dxc">';
    if (k === 'trk') h += `<div class="dxh">Пункт заправки 166 — ТРК-1</div><div class="n" id="f27st">${stateHTML()}</div><div class="n">Выдача запускается из модели ТП: откройте кран нужного продукта (166-Л / 166-З / 166-Б) и включите насос ТРК-1 (маршрут «Отпуск через ТРК-1»).</div>`;
    h += `<button class="btn" data-f27v="st">Вид на пункт</button><button class="btn" data-f27v="trk">Вид на ТРК</button><button class="btn" data-f27v="inl">Вид на вводы</button>` +
      `<button class="btn" data-dxeq="Пункт заправки 166">Паспорт пункта 166</button><button class="btn" data-f27d="166-002">Лист 166-ТХ-002</button><button class="btn" data-f27d="166-С">166-ТХ.С</button></div>`;
    return h;
  }
  function bindCard(root) {
    for (const b of root.querySelectorAll('[data-f27v]')) b.onclick = () => VIEWS[b.dataset.f27v] && VIEWS[b.dataset.f27v]();
    for (const b of root.querySelectorAll('[data-f27d]')) b.onclick = () => window.__DX && window.__DX.openDoc(b.dataset.f27d);
  }
  function late() {
    okNets = pipes();
    try { const r = procLogic.pRing && procLogic.pRing['ТРК-1']; if (r) { r.position.set(sx(TRKc[0]), Y0 + 2.0, sz(TRKc[1])); r.scale.setScalar(0.55); } } catch (e) { console.warn('F27: кольцо насоса ТРК-1', e); }
  }
  const api = { build, late, tick, patchProc, ind, cardHTML, bindCard, VIEWS, oldG, pipeG, REC, levers, disp, sx, sz, Y0, TRKc, LN, speed: 1,
    scr: (u, v, h) => { const p = P3(u, v, h).project(camera), r = renderer.domElement.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; },   // экранная точка (для проверок)
    U: { VA: U_VA, VB: U_VB }, H57,
    get state() { return { okNets, Y0, run: flowing(), L: disp.L, B: disp.Bn, lev: levers.map(l => [l.vid, +l.k.toFixed(2)]) }; } };
  window.__F27 = api;
  return api;
})();

