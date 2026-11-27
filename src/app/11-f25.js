/* =====================================================================================
   v0.25 — СТАНЦИЯ НАЛИВА 186 ПО 186-ТХ-002-0 И ДТ(Л) К КОТЕЛЬНОЙ ПО 152-ТК-007-0 (модуль F25)
   1. Станция налива в автоцистерны 186 (444.pdf, стр. 25; спецификация 186-ТХ.С-001-0 — 222.pdf, стр. 3):
      навес 9,0 × 11,0 м по осям 1–2 / А–В на 6 колоннах, площадка 0,000 с бортиком, обслуживающая площадка +2,700*
      с лестницей и ограждением до +3,950*, переходной мостик МП-4 (поз. 2), устройство налива АСН-80-02.01 (поз. 1):
      колонна, шарнир консоли +5,100*, двухзвенная консоль, наливная труба с герметизирующей крышкой (горловина
      +2,500…+3,900, радиус обслуживания 3 м), гаражное и рабочее положения; трубопроводы бензина, ДТ(З), ДТ(Л) Ø108×4
      на +0,400 (шаг 540): задвижки Ду100 (поз. 3), обратные клапаны КОП 100-16 (поз. 6), опоры ОПП2 (18, 19),
      коллектор Ø89 с узлом учёта (расходомер P-N4 — часть АК, задвижки Ду80 поз. 4, переходы 13, 14) и обводом;
      отвод паров Ø108×4: от АСН на +3,330 (низ тр.) через огневой предохранитель ПО-100 (поз. 5), подъём до +5,000
      (низ тр.) и выход за ось 2; канализационные приямки — 2.
      Привязка листа к сцене: ось 1 — x = −61,66 (трубы бензина, ДТ(З), ДТ(Л) ГП-005 — 2220 / 2760 / 3300 мм от оси 1,
      совпадение 1 см); ось В — z = −10,06 (линия Гу ГП-005 в 310 мм от оси В; фундаменты колонн на ГП-005).
   2. ДТ(Л) Ø57×3 к котельной 501 и ДЭС 137 (152-ТК-007-0, стр. 21): узел 13 — П-образный надземный переход через
      автодорогу (ОН89 → 800 → стояк → 500 → ОП90 → 6800 → ОП91 → 500 → стояк → 280 → слив; низ трубы +5,100 от оси
      дороги 298,25*; воздушник Ø25×3, слив дренажного остатка Ø25×3 в переносную тару); узел 14 — площадка с
      приямком, арматура и обводы на линии к котельной и на ответвлении к ДЭС; разрез 6-6 — ввод в котельную на +1,590.
      Прежний подземный переход по ГП-005 сохранён в слое сравнения.
   УСЛОВНО (APPROXIMATE): сечения навеса, площадки, лестницы и опор (КМ/КЖ нет), форма АСН-80-02.01 и мостика
   (паспортов изделий нет), автоцистерна (тип не указан), поз. 1 узла 14 (спецификация 152-ТК.С нет).
   ===================================================================================== */
const F25 = (() => {
  const V = GK.V, UP = new THREE.Vector3(0, 1, 0), XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
  const C = { str: 0x7d858c, strD: 0x5a6168, galv: 0xa9b0b5, conc: 0xb8b3a8, concD: 0x9a958b, yel: 0xd9a92b, red: 0xb3261e, redD: 0x7e1a15,
    dark: 0x2a2d31, alu: 0xc9ccce, blk: 0x1d1f21, grt: 0x6b7177, roof: 0xb4bcc3, asn: 0x4f7fa8, asnD: 0x2f4f6c, rubber: 0x161718,
    cab: 0xe6e6e1, tank: 0xc7ccd0, frame: 0x2b2d30, glass: 0x33424f, orange: 0xd2691e };
  const lod = [];
  /* ---------- привязка листа 186-ТХ-002-0 ---------- */
  const AX1 = -61.66, AXB = -10.06;
  const sx = X => AX1 + X, sz = Y => AXB + Y;
  const H186 = 298.05 - H0;                         // 0,000 станции = верх площадки; 298,05 — по 152-ТК-005-0 (рельеф под станцией — ≈ 297,97)
  const H186t = hAt(sx(4.5), sz(5.5));
  const P3 = (X, Y, h) => V(sx(X), h, sz(Y));       // точка в группе станции (y — от 0,000)
  const W3 = (X, Y, h) => [sx(X), H186 + h, sz(Y)]; // точка в сцене
  let inSt = false; const own = [];   // меши внутри gS станции: объект карточки восстанавливается после цикла OBJ (он присваивает всем мешам объект '186')
  const pk = (me, o) => { if (!o) return; if (inSt) own.push([me, o]); else { me.userData.o = o; pickables.push(me); } };
  const meshOf = (b, m, o, cast = true) => { const me = b.mesh(m); me.castShadow = cast; me.receiveShadow = true; pk(me, o); return me; };
  const grateMat = (() => {
    const t = MATX.canvasTex(128, (x, s) => { x.fillStyle = '#000'; x.fillRect(0, 0, s, s); x.fillStyle = '#fff'; for (let i = 0; i < s; i += 16) x.fillRect(i, 0, 4, s); for (let j = 0; j < s; j += 32) x.fillRect(0, j, s, 4); }, false);
    t.repeat.set(8, 8);
    return new THREE.MeshStandardMaterial({ color: C.grt, metalness: 0.45, roughness: 0.55, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  })();
  function gratesMerged(parent, boxes, o) {   // несколько решётчатых настилов одним мешем (позиция, нормаль, UV — для alphaMap)
    const pos = [], nor = [], uv = [], idx = []; let ov = 0;
    for (const [w, d, x, y, z] of boxes) {
      const g = new THREE.BoxGeometry(w, 0.03, d).translate(x, y, z), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let k = 0; k < P.count; k++) { pos.push(P.getX(k), P.getY(k), P.getZ(k)); nor.push(N.getX(k), N.getY(k), N.getZ(k)); uv.push(U.getX(k), U.getY(k)); }
      for (const i of g.index.array) idx.push(i + ov); ov += P.count; g.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, grateMat); m.receiveShadow = true; pk(m, o); parent.add(m); return m;
  }
  const grate = (parent, w, d, x, y, z, o, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), grateMat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; pk(m, o); parent.add(m); return m; };

  /* ---------- объекты карточек ---------- */
  const O = {
    canopy: null,   // навес — объект генплана '186' (присваивается циклом OBJ)
    asn: { id: 'АСН-80', net: 1, f25: 'asn', name: 'Устройство герметизированного верхнего налива АСН-80-02.01 (АСН-N1, поз. 1)', note: 'Ду80, Ру 1,0 МПа, Q = 100 м³/ч, правое исполнение, 380 кг (186-ТХ.С-001-0, 186-ТХ.ОЛ-001-0). Колонна на фундаменте +0,200, шарнир консоли +5,100*, горловина автоцистерны +2,500…+3,900, радиус обслуживания 3 м; гаражное и рабочее положения — по 186-ТХ-002-0. Длины звеньев консоли сняты с плана (1,85 и 2,58 м), конструкция узлов — условно (паспорта изделия нет).' },
    mp: { id: 'МП-4 (186)', net: 1, f25: 'mp', name: 'Мостик переходной МП-4 (поз. 2)', note: 'Стационарный, 4 ступени, рабочая зона 1740 мм (186-ТХ.ОЛ-002-0); на плане — у восточного края обслуживающей площадки +2,700*. Опускается на площадку автоцистерны при наливе; ступени остаются горизонтальными. Сечения — условно.' },
    plat: { id: 'Площадка +2,700', net: 1, f25: 'st', name: 'Обслуживающая площадка +2,700* с лестницей (см. часть КМ)', note: 'План 2,07 × 1,96 м у колонны АСН, ограждение до +3,950*, лестница с отм. 0,000 — по 186-ТХ-002-0 (разрезы 1-1, 2-2). Конструкция — по КМ (нет), условно.' },
    pad: { id: 'Площадка 0,000', net: 1, f25: 'st', name: 'Площадка станции налива с бортиком; полоса автоцистерны', note: 'За 0,000 принята отметка верха площадки (прим. 1 листа 186-ТХ-002-0); бортик +0,150; канализационные приямки — 2 (на площадке и у полосы автоцистерны). Конструкции — по КЖ (нет), условно.' },
    truck: { id: 'АЦ', net: 1, f25: 'truck', name: 'Автоцистерна у АСН-N1 (условная модель)', note: 'Положение и габарит — по плану 186-ТХ-002-0 (по оси автомобильной дороги, кабиной на север). Тип и вместимость автоцистерны в документации не указаны; модель — типовая трёхосная, APPROXIMATE. Ёмкость в модели ТП — 20 м³ (учебно).' },
    pipe: n => ({ id: 'Трубы 186', net: 1, f25: 'pipe', name: n, note: 'Трасса и отметка +0,400 — по 186-ТХ-002-0 (план, разрез 2-2); трубы 186-ТХ.С-001-0 поз. 15–17 (ГОСТ 8732-78*). От подземной трассы ГП-005 (у оси А) — подъём к отметке +0,400.' }),
    vap: { id: 'Гу 186', net: 1, f25: 'pipe', name: 'Отвод паров Ø108×4 от АСН-80-02.01', note: 'От АСН на +3,330 (низ тр.) через огневой предохранитель ПО-100 (поз. 5), подъём до +5,000 (низ тр.) и выход за ось 2 (186-ТХ-002-0). За осью 2 — надземно на +5,000 через дорогу пролётом ≈ 9,8 м (186-ТХ-002-0 и 152-ТК-005-0; v0.34, P16), опуск к трассе Гу у x −43,35 — условно (место опуска на листах не показано); далее — по ГП-005 на опорах ОП64…ОП61.' }
  };

  /* =========================== 1. НАВЕС, ПЛОЩАДКИ, ЛЕСТНИЦА =========================== */
  const hCol = X => 6.0 + 1.6 * X / 9.0;   // верх колонн: +6,000* у оси 1, ≈ +7,6 у оси 2 (разрез 1-1; на 2-2 — +6,000, «Сверка» P17)
  function roofSheet(x0, x1, z0, z1, yOf) {   // профнастил: трапециевидный профиль поперёк ската (шаг 0,2 м)
    const nz = Math.round((z1 - z0) / 0.05), pos = [], idx = [], prof = t => { const f = ((t % 0.2) + 0.2) % 0.2; return f < 0.05 ? 0 : f < 0.07 ? (f - 0.05) / 0.02 * 0.04 : f < 0.13 ? 0.04 : f < 0.15 ? (0.15 - f) / 0.02 * 0.04 : 0; };
    for (let j = 0; j <= nz; j++) { const z = z0 + (z1 - z0) * j / nz, d = prof(z - z0); pos.push(x0, yOf(x0) + d, z, x1, yOf(x1) + d, z); if (j) { const a = (j - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function canopy(root) {
    const bp = GK.builder(), bf = GK.builder();
    const XS = [0, 9.0], YS = [0, 5.5, 11.0];
    for (const X of XS) for (const Y of YS) {
      const h = hCol(X);
      bp.box(0.7, 0.35, 0.7, sx(X), -0.15, sz(Y), C.conc);                 // фундамент (КЖ нет — условно)
      bp.box(0.42, 0.025, 0.42, sx(X), 0.04, sz(Y), C.strD);
      bp.box(0.25, h - 0.05, 0.25, sx(X), 0.05 + (h - 0.05) / 2, sz(Y), C.str);   // колонна — квадратная труба 250 (условно)
      bp.box(0.32, 0.02, 0.32, sx(X), h, sz(Y), C.strD);
    }
    // ригели (двутавр 300, условно) вдоль ската по осям В, Б, А; консоли 0,43 / 0,25 м — по разрезу 1-1
    const rY = X => hCol(X) + 0.16;
    for (const Y of YS) {
      const a = P3(-0.25, Y, rY(-0.25)), b = P3(9.43, Y, rY(9.43));
      bp.bar(V(a.x, a.y + 0.14, a.z), V(b.x, b.y + 0.14, b.z), 0.15, 0.016, C.str); bp.bar(V(a.x, a.y - 0.14, a.z), V(b.x, b.y - 0.14, b.z), 0.15, 0.016, C.str); bp.bar(a, b, 0.009, 0.27, C.str);
      for (const X of XS) { const hc = hCol(X), dx = X ? -1 : 1; bf.bar(P3(X, Y, hc - 0.9), P3(X + dx * 0.9, Y, rY(X + dx * 0.9) - 0.14), 0.08, 0.08, C.str); }   // подкосы
    }
    // прогоны (швеллер 160, шаг ≈ 1,55 м) по ригелям
    for (let X = -0.15; X <= 9.4; X += 1.58) bp.bar(P3(X, -0.35, rY(X) + 0.22), P3(X, 11.35, rY(X) + 0.22), 0.065, 0.16, C.strD);
    // связи по колоннам оси 1 и 2 в пролёте Б–А (условно)
    for (const X of XS) { const h = hCol(X) - 0.4; bf.bar(P3(X, 5.5, 0.6), P3(X, 11.0, h), 0.06, 0.06, C.str); bf.bar(P3(X, 11.0, 0.6), P3(X, 5.5, h), 0.06, 0.06, C.str); }
    root.add(meshOf(bp, GK.MAT.paint, O.canopy)); const mf = meshOf(bf, GK.MAT.paint, O.canopy); root.add(mf);
    // кровля: профнастил по прогонам, водосточный жёлоб и водостоки на низкой стороне (ось 1) — условно
    const yR = x => { const X = x - AX1; return rY(X) + 0.31; };
    const rm = new THREE.Mesh(roofSheet(sx(-0.3), sx(9.48), sz(-0.4), sz(11.4), yR), new THREE.MeshStandardMaterial({ color: C.roof, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide }));
    rm.castShadow = true; rm.receiveShadow = true; root.add(rm);
    const bg = GK.builder();
    bg.cyl(P3(-0.42, -0.4, yR(sx(-0.3)) - 0.06), P3(-0.42, 11.4, yR(sx(-0.3)) - 0.06), 0.075, C.galv, 12);
    for (const Y of [0.3, 10.7]) { bg.cyl(P3(-0.42, Y, yR(sx(-0.3)) - 0.1), P3(-0.42, Y, 0.25), 0.05, C.galv, 10); bg.cyl(P3(-0.42, Y, 0.25), P3(-0.75, Y, 0.08), 0.05, C.galv, 10); }
    // светильники взрывозащищённые под прогонами (условно)
    const bl = GK.builder();
    for (const X of [2.4, 6.3]) for (const Y of [2.75, 8.25]) { const y = rY(X) + 0.1; bg.cyl(P3(X, Y, y), P3(X, Y, y - 0.35), 0.012, C.dark, 6); bg.cyl(P3(X, Y, y - 0.35), P3(X, Y, y - 0.55), 0.13, C.dark, 14, 0.09); bl.cyl(P3(X, Y, y - 0.55), P3(X, Y, y - 0.62), 0.11, 0xf2f0e0, 14); }
    const mg = meshOf(bg, GK.MAT.steel, O.canopy); root.add(mg);
    root.add(meshOf(bl, MATX.F.lamp, O.canopy, false));   // плафоны — материал светильников генплана (светятся в ночном режиме)
  }
  function pads(root) {
    const b = GK.builder();
    // площадка 0,000 с бортиком +0,150 (наружный контур 0,85…4,35 × 0,86…10,16 от осей 1 / В)
    b.box(3.5, 0.32, 9.3, sx(2.6), -0.15, sz(5.51), C.conc);
    for (const [x0, y0, x1, y1] of [[0.85, 0.86, 4.35, 1.01], [0.85, 10.01, 4.35, 10.16], [0.85, 0.86, 1.0, 10.16], [4.2, 0.86, 4.35, 10.16]]) b.box(x1 - x0, 0.17, y1 - y0, sx((x0 + x1) / 2), 0.085, sz((y0 + y1) / 2), C.concD);
    // полоса автоцистерны (безыскровое покрытие, условно)
    b.box(3.1, 0.3, 13.6, sx(5.9), -0.14, sz(5.3), 0xa9a69d);
    for (const X of [4.36, 7.45]) b.box(0.15, 0.2, 13.6, sx(X), 0.05, sz(5.3), C.concD);
    root.add(meshOf(b, GK.MAT.dirty, O.pad, false));
    // приямки с решётками: на площадке (ЮЗ угол) и у полосы автоцистерны (ЮВ)
    const bpit = GK.builder();
    for (const [X0, Y0, X1, Y1] of [[1.14, 9.23, 1.65, 9.86], [7.66, 10.62, 8.45, 11.17]]) {
      bpit.box(X1 - X0, 0.01, Y1 - Y0, sx((X0 + X1) / 2), 0.012, sz((Y0 + Y1) / 2), C.blk);
      for (let X = X0 + 0.04; X < X1; X += 0.06) bpit.box(0.012, 0.025, Y1 - Y0, sx(X), 0.03, sz((Y0 + Y1) / 2), C.strD);
      for (const Y of [Y0, Y1]) bpit.box(X1 - X0 + 0.04, 0.03, 0.03, sx((X0 + X1) / 2), 0.03, sz(Y), C.strD);
    }
    root.add(meshOf(bpit, GK.MAT.paint, O.pad, false));
  }
  // обслуживающая площадка +2,700* и лестница
  const PL = { x0: 2.08, x1: 4.15, y0: 4.32, y1: 6.28, h: 2.70, rail: 1.25, gap: [5.15, 5.91], st: [2.08, 2.91], stY0: 1.75 };
  function platform(root) {
    const bp = GK.builder(), { x0, x1, y0, y1, h } = PL;
    for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { bp.box(0.1, h - 0.06, 0.1, sx(X + (X === x0 ? 0.05 : -0.05)), (h - 0.06) / 2, sz(Y + (Y === y0 ? 0.05 : -0.05)), C.str); bp.box(0.22, 0.02, 0.22, sx(X + (X === x0 ? 0.05 : -0.05)), 0.01, sz(Y + (Y === y0 ? 0.05 : -0.05)), C.strD); }
    for (const [a, b] of [[[x0, y0], [x1, y0]], [[x0, y1], [x1, y1]], [[x0, y0], [x0, y1]], [[x1, y0], [x1, y1]]]) bp.bar(P3(a[0], a[1], h - 0.08), P3(b[0], b[1], h - 0.08), 0.06, 0.14, C.str);   // обвязка — швеллер (условно)
    bp.bar(P3(x0, (y0 + y1) / 2, h - 0.08), P3(x1, (y0 + y1) / 2, h - 0.08), 0.05, 0.12, C.str);
    grate(root, x1 - x0, y1 - y0, sx((x0 + x1) / 2), h - 0.005, sz((y0 + y1) / 2), O.plat);
    // ограждение: поручень +1,25 (до +3,950*), промежуточный пояс, бортовая полоса; проёмы — к лестнице (С) и к мостику (В)
    const rail = (a, b, skip) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / 0.6));
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const X = a[0] + (b[0] - a[0]) * k / n, Y = a[1] + (b[1] - a[1]) * k / n;
        if (skip && skip(X, Y)) { prev = null; continue; }
        bp.bar(P3(X, Y, h), P3(X, Y, h + PL.rail), 0.04, 0.04, C.yel);
        if (prev) { bp.cyl(P3(prev[0], prev[1], h + PL.rail), P3(X, Y, h + PL.rail), 0.022, C.yel, 8); bp.bar(P3(prev[0], prev[1], h + 0.6), P3(X, Y, h + 0.6), 0.03, 0.03, C.yel); bp.bar(P3(prev[0], prev[1], h + 0.075), P3(X, Y, h + 0.075), 0.005, 0.15, C.yel); }
        prev = [X, Y];
      }
    };
    rail([x0, y1], [x1, y1]); rail([x0, y0], [x0, y1]);
    rail([x1, y0], [x1, y1], (X, Y) => Y > PL.gap[0] - 0.05 && Y < PL.gap[1] + 0.05);
    rail([x0, y0], [x1, y0], (X) => X < PL.st[1] + 0.05);
    // лестница: косоуры, ступени-решётки, перила (уклон ≈ 46°, 13 подъёмов по ≈ 0,208 м)
    const [sa, sb] = PL.st, n = 13, rise = h / n, run = (y0 - PL.stY0) / n;
    for (const X of [sa + 0.03, sb - 0.03]) {
      bp.bar(P3(X, PL.stY0 - 0.05, 0.02), P3(X, y0, h - 0.04), 0.012, 0.16, C.str);
      bp.cyl(P3(X, PL.stY0 + 0.05, 0.95), P3(X, y0, h + 0.95), 0.022, C.yel, 8);
      for (const k of [0.15, 0.5, 0.85]) { const Y = PL.stY0 + (y0 - PL.stY0) * k, hh = h * k; bp.bar(P3(X, Y, hh), P3(X, Y, hh + 0.95), 0.035, 0.035, C.yel); }
    }
    const steps = []; for (let i = 1; i < n; i++) steps.push([sb - sa - 0.06, run + 0.04, sx((sa + sb) / 2), rise * i - 0.02, sz(PL.stY0 + run * (i - 0.5))]);
    gratesMerged(root, steps, O.plat);   // ступени — решётчатый настил (12 шт. одним мешем)
    root.add(meshOf(bp, GK.MAT.paint, O.plat));
  }

  /* =========================== 2. АСН-80-02.01, МОСТИК МП-4 =========================== */
  const ASN = { X: 3.30, Y: 4.10, hA: 4.75, L1: 1.85, L2: 2.58, hatch: [5.85, 4.60], hCovW: 3.32, hCovG: 4.00 };
  const kin = { pose: 0, tgt: 0, manual: 0, a1: 0, a2: 0, hc: ASN.hCovG, mp: 1.31, fill: false };   // pose: 0 — гаражное, 1 — рабочее
  // обратная задача двухзвенной консоли (локоть — к северу, как на плане)
  function ik(Xe, Ye) {
    const dx = Xe - ASN.X, dy = Ye - ASN.Y, d = Math.min(Math.hypot(dx, dy), ASN.L1 + ASN.L2 - 1e-3), base = Math.atan2(dy, dx);
    const A = Math.acos(Math.max(-1, Math.min(1, (ASN.L1 ** 2 + d * d - ASN.L2 ** 2) / (2 * ASN.L1 * d))));
    const a1 = base - A, jx = ASN.X + ASN.L1 * Math.cos(a1), jy = ASN.Y + ASN.L1 * Math.sin(a1);
    return { a1, a2: Math.atan2(Ye - jy, Xe - jx), J: [jx, jy] };
  }
  const POSE_W = ik(...ASN.hatch);
  const POSE_G = { a1: -Math.PI / 2, a2: Math.acos(0.33 / ASN.L2) };   // гаражное: консоль к северу, второе звено сложено вдоль первого (план)
  POSE_G.J = [ASN.X, ASN.Y - ASN.L1];
  const asn = {};
  function buildASN(root) {
    const g = new THREE.Group(); g.name = 'АСН-80-02.01'; root.add(g); asn.g = g;
    const px = sx(ASN.X), pz = sz(ASN.Y);
    const bs = GK.builder(), bb = GK.builder();
    bs.box(0.9, 0.42, 0.9, px + 0.05, 0.0, pz - 0.05, C.conc);                  // фундамент, верх +0,200
    bs.box(0.56, 0.03, 0.42, px + 0.05, 0.215, pz - 0.05, C.asnD);
    bs.cyl(V(px, 0.23, pz), V(px, 4.55, pz), 0.1095, C.asn, 20);                 // колонна Ø219 (продукт — внутри), условно
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bs.add(new THREE.BufferGeometry().copy(new THREE.BoxGeometry(0.012, 0.32, 0.2)).rotateY(dz ? Math.PI / 2 : 0).translate(px + dx * 0.2, 0.39, pz + dz * 0.2), C.asnD);   // рёбра
    bs.cyl(V(px, 0.40, pz + 0.23), V(px, 0.40, pz + 0.105), 0.05, C.asn, 14);    // вход продукта Ду80 (граница поставки — СЕНС-ПР)
    bs.ring(V(px, 0.40, pz + 0.235), ZA, 0.075, 0.014, C.asnD, 18);
    bs.box(0.22, 0.3, 0.16, px, 1.45, pz - 0.18, C.dark); bs.box(0.18, 0.06, 0.02, px, 1.52, pz - 0.265, C.red);   // пост управления (ключ режима) — условно
    // опорно-поворотный узел консоли, +4,55…+5,10*
    bs.cyl(V(px, 4.55, pz), V(px, 4.62, pz), 0.16, C.asnD, 20); bs.cyl(V(px, 4.62, pz), V(px, 4.9, pz), 0.12, C.asn, 20); bs.cyl(V(px, 4.9, pz), V(px, 5.1, pz), 0.09, C.asnD, 16);
    // отвод паров от колонны к трубопроводу (кран шаровый Ду80, поз. 7) на +3,384
    bs.cyl(V(px + 0.1, 3.384, pz), V(sx(3.71) - 0.06, 3.384, pz), 0.054, C.asn, 14); bs.ring(V(sx(3.71) - 0.06, 3.384, pz), XA, 0.09, 0.014, C.asnD, 16);
    bs.cyl(V(px + 0.22, 3.33, pz), V(px + 0.34, 3.33, pz), 0.07, C.red, 14, 0.07); bs.cyl(V(px + 0.28, 3.42, pz), V(px + 0.28, 3.5, pz), 0.012, C.dark, 6); bs.box(0.2, 0.015, 0.03, px + 0.36, 3.5, pz, C.red);
    g.add(meshOf(bs, GK.MAT.paint, O.asn));
    // звено 1 (поворот вокруг оси колонны)
    const y1 = new THREE.Group(); y1.position.set(px, ASN.hA, pz); g.add(y1); asn.y1 = y1;
    const b1 = GK.builder(), L1 = ASN.L1, L2 = ASN.L2;
    b1.cyl(V(0, 0.0, 0), V(0, 0.18, 0), 0.075, C.asnD, 16);                     // шарнир
    b1.cyl(V(0.08, 0, 0), V(L1 - 0.1, 0, 0), 0.0445, C.asn, 14);               // продуктовая труба Ду80
    b1.bar(V(0.1, -0.36, 0), V(L1 - 0.15, -0.3, 0), 0.05, 0.05, C.asn);       // нижний пояс фермы
    for (let i = 0; i < 4; i++) { const xa = 0.1 + (L1 - 0.25) * i / 4, xb = 0.1 + (L1 - 0.25) * (i + 1) / 4; b1.bar(V(xa, -0.35 + 0.06 * i / 4, 0), V(xb, -0.03, 0), 0.03, 0.03, C.asn); b1.bar(V(xb, -0.35 + 0.06 * (i + 1) / 4, 0), V(xb, -0.03, 0), 0.03, 0.03, C.asn); }
    b1.bar(V(0.05, -0.36, 0), V(0.05, 0.1, 0), 0.06, 0.06, C.asnD);
    b1.cyl(V(0.12, 0.17, 0), V(0.95, 0.07, 0), 0.05, C.asnD, 12); b1.cyl(V(0.95, 0.07, 0), V(1.25, 0.04, 0), 0.025, C.galv, 8);   // пружинный уравновешивающий механизм в кожухе
    b1.cyl(V(0.1, 0.11, 0.07), V(L1 - 0.12, 0.11, 0.07), 0.03, C.rubber, 10);   // рукав отвода паров
    y1.add(meshOf(b1, GK.MAT.paint, O.asn));
    // звено 2
    const y2 = new THREE.Group(); y2.position.set(L1, 0, 0); y1.add(y2); asn.y2 = y2;
    const b2 = GK.builder();
    b2.cyl(V(0, -0.1, 0), V(0, 0.12, 0), 0.07, C.asnD, 16);                     // поворотный шарнир
    b2.cyl(V(0.07, 0, 0), V(L2 - 0.07, 0, 0), 0.0445, C.asn, 14);
    b2.cyl(V(L2 - 0.07, 0, 0), V(L2, 0, 0), 0.06, C.asnD, 14);
    b2.cyl(V(L2, 0.06, 0), V(L2, -0.25, 0), 0.06, C.asnD, 14);                  // колено на наливную трубу
    b2.cyl(V(0.05, 0.11, 0.06), V(L2 - 0.05, 0.11, 0.06), 0.03, C.rubber, 10);
    b2.box(0.06, 0.4, 0.04, L2 - 0.3, 0.12, 0, C.asnD);                         // рукоять управления
    y2.add(meshOf(b2, GK.MAT.paint, O.asn));
    // наливная труба (телескопическая) и герметизирующая крышка
    const tube = new THREE.Group(); tube.position.set(L2, 0, 0); y2.add(tube); asn.tube = tube;
    const bo = GK.builder(); bo.cyl(V(0, -0.25, 0), V(0, -0.9, 0), 0.056, C.asn, 14); tube.add(meshOf(bo, GK.MAT.paint, O.asn));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.0445, 0.0445, 1, 14), new THREE.MeshStandardMaterial({ color: 0xb9bec2, metalness: 0.75, roughness: 0.3 }));
    pk(inner, O.asn); tube.add(inner); asn.inner = inner;
    const cov = new THREE.Group(); tube.add(cov); asn.cov = cov;
    const bc = GK.builder();
    bc.cyl(V(0, 0, 0), V(0, 0.06, 0), 0.23, C.asnD, 28); bc.ring(V(0, 0.005, 0), UP, 0.2, 0.018, C.rubber, 28);   // крышка с уплотнением (горловины 200–300 мм)
    bc.cyl(V(0, 0.06, 0), V(0, 0.16, 0), 0.08, C.asn, 16);
    bc.cyl(V(0.08, 0.12, 0), V(0.2, 0.32, 0), 0.03, C.rubber, 10);             // патрубок паров
    bc.box(0.1, 0.12, 0.08, -0.13, 0.12, 0.05, C.yel);                           // датчик предельного уровня (СЖУ — условно)
    for (const s of [-1, 1]) { bc.bar(V(-0.2, 0.06, s * 0.12), V(-0.2, 0.32, s * 0.12), 0.02, 0.02, C.dark); }
    bc.bar(V(-0.2, 0.32, -0.12), V(-0.2, 0.32, 0.12), 0.02, 0.02, C.dark);       // ручка
    cov.add(meshOf(bc, GK.MAT.paint, O.asn));
  }
  // мостик МП-4: шарнир на восточном краю площадки, 4 ступени, ограждение; концы опираются на площадку автоцистерны
  const MP = { X: PL.x1, Y: (PL.gap[0] + PL.gap[1]) / 2, w: 0.76, L: 1.7, up: 1.31 };
  const mp = {};
  function buildMP(root) {
    const piv = new THREE.Group(); piv.position.set(sx(MP.X), PL.h - 0.02, sz(MP.Y)); root.add(piv); mp.piv = piv;
    const fr = new THREE.Group(); piv.add(fr); mp.fr = fr;   // поворот вокруг оси z сцены (вдоль Y станции)
    const bf = GK.builder();
    for (const s of [-1, 1]) { bf.bar(V(0, 0, s * MP.w / 2), V(MP.L, 0, s * MP.w / 2), 0.012, 0.14, C.str); bf.cyl(V(0, 0, s * (MP.w / 2 + 0.03)), V(0, 0, s * (MP.w / 2 - 0.02)), 0.04, C.dark, 10); }
    bf.bar(V(MP.L, -0.05, -MP.w / 2), V(MP.L, -0.05, MP.w / 2), 0.05, 0.05, C.str);
    for (const s of [-1, 1]) bf.box(0.12, 0.06, 0.08, MP.L - 0.04, -0.09, s * (MP.w / 2 - 0.05), C.rubber);   // опорные лапы
    bf.cyl(V(0.25, -0.12, MP.w / 2 + 0.05), V(0.9, -0.05, MP.w / 2 + 0.05), 0.035, C.dark, 10);   // уравновешивающий цилиндр
    fr.add(meshOf(bf, GK.MAT.paint, O.mp));
    mp.steps = []; mp.posts = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Group(); s.position.set(0.25 + i * 0.4, 0, 0); fr.add(s); mp.steps.push(s);
      grate(s, 0.3, MP.w - 0.04, 0, 0.0, 0, O.mp);
    }
    for (const xp of [0.05, MP.L - 0.05]) for (const sgn of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(xp, 0, sgn * (MP.w / 2 + 0.01)); fr.add(p); mp.posts.push(p);
      const bpo = GK.builder(); bpo.bar(V(0, 0, 0), V(0, 1.0, 0), 0.035, 0.035, C.yel); p.add(meshOf(bpo, GK.MAT.paint, O.mp));
    }
    mp.rails = [-1, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), new THREE.MeshStandardMaterial({ color: C.yel, metalness: 0.3, roughness: 0.5 })); pk(m, O.mp); root.add(m); return m; });
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function poseApply() {
    asn.y1.rotation.y = -kin.a1; asn.y2.rotation.y = -(kin.a2 - kin.a1);
    const L = ASN.hA - 0.9 - kin.hc;   // выдвижение внутренней трубы до крышки
    asn.inner.scale.y = Math.max(0.05, L + 0.1); asn.inner.position.y = -0.9 - L / 2 + 0.05; asn.cov.position.y = kin.hc - ASN.hA;
    mp.fr.rotation.z = kin.mp;
    for (const s of mp.steps) s.rotation.z = -kin.mp;
    for (const p of mp.posts) p.rotation.z = -kin.mp;
    root0.updateMatrixWorld(true);
    mp.rails.forEach((m, i) => {
      mp.posts[i * 2].localToWorld(_a.set(0, 1.0, 0)); mp.posts[i * 2 + 1].localToWorld(_b.set(0, 1.0, 0));
      root0.worldToLocal(_a); root0.worldToLocal(_b);
      m.position.copy(_a).add(_b).multiplyScalar(0.5); m.scale.y = _a.distanceTo(_b); m.quaternion.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
    });
  }
  const lerpAng = (a, b, t) => a + (b - a) * t;
  function poseAt(t) {   // 0 — гаражное, 1 — рабочее; последовательность: мостик ↔ консоль ↔ крышка
    const tc = Math.min(1, t / 0.6), tl = Math.max(0, (t - 0.6) / 0.4), tm = Math.max(0, (t - 0.55) / 0.45);
    kin.a1 = lerpAng(POSE_G.a1, POSE_W.a1, tc); kin.a2 = lerpAng(POSE_G.a2 + 0, POSE_W.a2, tc);
    kin.hc = ASN.hCovG + (ASN.hCovW - ASN.hCovG) * tl;
    kin.mp = MP.up + (MPW - MP.up) * tm;
  }
  let MPW = 0.3;

  /* =========================== 3. АВТОЦИСТЕРНА (условная модель) =========================== */
  const TR = { X: 5.85, Y0: -0.9, tank: [0.95, 8.15], a: 1.2, b: 0.95, yc: 2.2, hatchY: 4.6 };
  const truck = {};
  function buildTruck(root) {
    const g = new THREE.Group(); g.name = 'автоцистерна'; root.add(g); truck.g = g;
    const tx = sx(TR.X), b = GK.builder(), bw = GK.builder(), bt = GK.builder(), bf = GK.builder();
    const Z = Y => sz(Y);
    // рама, кабина
    for (const s of [-1, 1]) b.box(0.09, 0.26, 9.0, tx + s * 0.44, 0.98, Z(3.6), C.frame);
    b.box(2.48, 1.55, 1.7, tx, 1.95, Z(-0.05), C.cab); b.box(2.48, 0.45, 1.2, tx, 2.95, Z(0.2), C.cab);           // кабина и спальник (условно)
    b.box(2.3, 0.75, 0.02, tx, 2.35, Z(-0.91), C.glass); for (const s of [-1, 1]) b.box(0.02, 0.6, 0.9, tx + s * 1.245, 2.35, Z(-0.3), C.glass);
    b.box(2.5, 0.32, 0.16, tx, 0.72, Z(-0.98), C.frame); b.box(1.5, 0.55, 0.03, tx, 1.45, Z(-0.92), C.frame);   // бампер, решётка
    for (const s of [-1, 1]) { b.box(0.3, 0.14, 0.04, tx + s * 0.95, 0.95, Z(-1.0), 0xf3efd8); b.cyl(V(tx + s * 1.36, 2.6, Z(-0.85)), V(tx + s * 1.36, 2.0, Z(-0.85)), 0.012, C.dark, 6); b.box(0.04, 0.32, 0.18, tx + s * 1.38, 2.35, Z(-0.85), C.dark); }
    b.box(0.6, 0.12, 0.5, tx, 0.62, Z(0.9), C.frame);   // топливный бак/АКБ
    b.cyl(V(tx - 1.05, 0.9, Z(0.95)), V(tx - 1.05, 3.4, Z(0.95)), 0.06, C.dark, 10);   // выхлопная труба с искрогасителем (вперёд — условно)
    // цистерна: эллиптический котёл 2,4 × 1,9 м, днища, ложементы
    const tankG = new THREE.CylinderGeometry(1, 1, TR.tank[1] - TR.tank[0], 40, 1, true); tankG.rotateX(Math.PI / 2); tankG.scale(TR.a, TR.b, 1); tankG.translate(tx, TR.yc, Z((TR.tank[0] + TR.tank[1]) / 2));
    bt.add(tankG, C.tank);
    for (const [Y, s] of [[TR.tank[0], -1], [TR.tank[1], 1]]) { const hg = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); hg.rotateX(s * Math.PI / 2); hg.scale(TR.a, TR.b, 0.28); hg.translate(tx, TR.yc, Z(Y)); bt.add(hg, C.tank); }
    for (const Y of [1.5, 3.5, 5.6, 7.6]) { const r = new THREE.TorusGeometry(1, 0.025, 6, 40); r.rotateY(0); r.scale(TR.a + 0.01, TR.b + 0.01, 1); r.translate(tx, TR.yc, Z(Y)); bt.add(r, 0xaeb4b9); }   // бандажи/шпангоуты
    for (const Y of [1.6, 7.4]) b.box(1.3, 0.3, 0.3, tx, 1.25, Z(Y), C.frame);
    // площадка обслуживания, горловина, поручни
    bt.box(0.5, 0.03, 6.6, tx, TR.yc + TR.b + 0.04, Z(4.55), C.grt);
    for (const s of [-1, 1]) for (let Y = 1.3; Y <= 7.85; Y += 1.3) bt.cyl(V(tx + s * 0.32, TR.yc + TR.b, Z(Y)), V(tx + s * 0.32, TR.yc + TR.b + 0.45, Z(Y)), 0.015, C.galv, 6);
    for (const s of [-1, 1]) bt.cyl(V(tx + s * 0.32, TR.yc + TR.b + 0.45, Z(1.3)), V(tx + s * 0.32, TR.yc + TR.b + 0.45, Z(7.8)), 0.015, C.galv, 6);   // поручни (сложенные — условно)
    bt.cyl(V(tx, TR.yc + TR.b - 0.05, Z(TR.hatchY)), V(tx, TR.yc + TR.b + 0.15, Z(TR.hatchY)), 0.28, 0xb5bbc0, 28);   // горловина Ø ≈ 0,56
    for (const Y of [2.1, 7.1]) bt.cyl(V(tx, TR.yc + TR.b - 0.05, Z(Y)), V(tx, TR.yc + TR.b + 0.1, Z(Y)), 0.12, 0xb5bbc0, 16);   // дыхательный клапан, люк (условно)
    // лестница сзади, пеналы для рукавов, колёса, крылья
    for (const s of [-1, 1]) bt.bar(V(tx + s * 0.22, 0.8, Z(8.45)), V(tx + s * 0.22, TR.yc + TR.b + 0.1, Z(8.45)), 0.03, 0.03, C.galv);
    for (let h = 1.0; h < TR.yc + TR.b; h += 0.3) bt.cyl(V(tx - 0.22, h, Z(8.45)), V(tx + 0.22, h, Z(8.45)), 0.012, C.galv, 6);
    for (const s of [-1, 1]) { b.box(0.22, 0.22, 4.0, tx + s * 1.15, 1.3, Z(3.4), C.frame); b.box(0.5, 0.25, 0.6, tx + s * 1.0, 1.1, Z(5.1), C.frame); }
    b.box(2.4, 0.18, 0.12, tx, 0.78, Z(8.4), C.frame); for (const s of [-1, 1]) b.box(0.25, 0.1, 0.04, tx + s * 0.95, 0.85, Z(8.47), C.red);
    for (const s of [-1, 1]) for (const Y of [3.0, 6.0]) b.box(0.02, 0.3, 0.4, tx + s * (TR.a + 0.01), TR.yc + 0.25, Z(Y), C.orange);   // табло опасного груза (без текста — условно)
    for (const [Y, twin] of [[-0.25, 0], [5.9, 1], [7.25, 1]]) for (const s of [-1, 1]) {
      const offs = twin ? [0.88, 1.18] : [1.03];
      for (const o of offs) { bw.cyl(V(tx + s * (o - 0.15), 0.53, Z(Y)), V(tx + s * (o + 0.15), 0.53, Z(Y)), 0.53, C.rubber, 24); bw.cyl(V(tx + s * (o + 0.152), 0.53, Z(Y)), V(tx + s * (o + 0.156), 0.53, Z(Y)), 0.3, 0x8a8f94, 16); }
      bf.box(0.42, 0.04, twin ? 1.0 : 0.95, tx + s * 1.03, 1.14, Z(Y), C.frame);
    }
    for (const Y of [-0.25, 5.9, 7.25]) bw.cyl(V(tx - 0.8, 0.53, Z(Y)), V(tx + 0.8, 0.53, Z(Y)), 0.07, C.frame, 10);
    g.add(meshOf(b, GK.MAT.paint, O.truck)); g.add(meshOf(bt, GK.MAT.steel, O.truck)); g.add(meshOf(bw, GK.MAT.dirty, O.truck));
    const mf = meshOf(bf, GK.MAT.paint, O.truck); g.add(mf);
    // крышка горловины: откинута при наливе
    const lid = new THREE.Group(); lid.position.set(tx - 0.28, TR.yc + TR.b + 0.15, Z(TR.hatchY)); g.add(lid); truck.lid = lid;
    const bl = GK.builder(); bl.cyl(V(0.28, 0, 0), V(0.28, 0.04, 0), 0.3, 0xb5bbc0, 28); for (const dz of [-0.12, 0.12]) bl.box(0.06, 0.05, 0.04, 0.0, 0.02, dz, C.dark);
    lid.add(meshOf(bl, GK.MAT.steel, O.truck));
    const ttop = TR.yc + TR.b + 0.15;
    return ttop;
  }

  /* =========================== 4. АРМАТУРА И ТРУБЫ СТАНЦИИ (3D) =========================== */
  const CATV = { 80: [0.21, 0.39, 0.0975], 100: [0.23, 0.44, 0.1075] };   // 30с41нж: строительная длина, высота до маховика, R фланца — как в v0.23 (каталог, ориентировочно)
  const stems = [];
  function gateValve(root, X, Y, h, dn, along, vid, o) {   // клиновая задвижка с выдвижным шпинделем; along — 'y' (вдоль Y станции) или 'x'
    const [L, H, Rf] = CATV[dn], c = P3(X, Y, h), ax = along === 'y' ? ZA : XA, rp = dn / 2000 + 0.006;
    const b = GK.builder();
    const e1 = c.clone().addScaledVector(ax, -L / 2), e2 = c.clone().addScaledVector(ax, L / 2);
    b.cyl(e1, e2, rp + 0.02, C.dark, 16);
    for (const e of [e1, e2]) b.cyl(e.clone().addScaledVector(ax, e === e1 ? 0 : -0.02), e.clone().addScaledVector(ax, e === e1 ? 0.02 : 0), Rf, C.dark, 20);
    b.cyl(V(c.x, h, c.z), V(c.x, h + H * 0.55, c.z), rp + 0.015, C.dark, 14, rp * 0.6 + 0.02);   // корпус-крышка
    b.box(0.08, 0.04, 0.08, c.x, h + H * 0.55, c.z, C.dark);
    for (const s of [-1, 1]) b.bar(V(c.x + (along === 'y' ? s * 0.05 : 0), h + H * 0.55, c.z + (along === 'x' ? s * 0.05 : 0)), V(c.x + (along === 'y' ? s * 0.02 : 0), h + H * 0.85, c.z + (along === 'x' ? s * 0.02 : 0)), 0.02, 0.02, C.dark);   // бугель
    const me = meshOf(b, GK.MAT.paint, o); root.add(me);
    const sg = new THREE.Group(); sg.position.set(c.x, h + H * 0.85, c.z); root.add(sg);
    const bs = GK.builder(); bs.cyl(V(0, -0.15, 0), V(0, 0.08, 0), 0.012, C.galv, 8); bs.ring(V(0, 0.06, 0), UP, 0.09 + dn / 2000, 0.012, C.red, 20);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; bs.bar(V(0, 0.06, 0), V(Math.cos(a) * (0.09 + dn / 2000), 0.06, Math.sin(a) * (0.09 + dn / 2000)), 0.012, 0.012, C.red); }
    sg.add(meshOf(bs, GK.MAT.paint, o));
    stems.push({ g: sg, y0: h + H * 0.85, stroke: dn / 1000, vid, k: vid ? 0 : 1 });
  }
  function checkValve(b, X, Y, h) {   // КОП 100-16 (19с53нж) — подъёмный, условно
    const c = P3(X, Y, h);
    b.cyl(c.clone().addScaledVector(ZA, -0.15), c.clone().addScaledVector(ZA, 0.15), 0.07, C.dark, 18);
    for (const s of [-1, 1]) b.cyl(c.clone().addScaledVector(ZA, s * 0.15), c.clone().addScaledVector(ZA, s * 0.13), 0.1075, C.dark, 20);
    b.cyl(V(c.x, h, c.z), V(c.x, h + 0.17, c.z), 0.085, C.dark, 18, 0.07); b.cyl(V(c.x, h + 0.17, c.z), V(c.x, h + 0.2, c.z), 0.095, C.dark, 18);
    b.box(0.03, 0.01, 0.12, c.x, h + 0.205, c.z, C.red);   // стрелка направления потока (на север)
  }
  function support(b, X, Y, hPipe, r, w = 0.2) {   // опора подвижная ОПП2 на стойке (условно)
    const c = P3(X, Y, 0);
    b.box(w, hPipe - r - 0.03, 0.08, c.x, (hPipe - r - 0.03) / 2, c.z, C.str); b.box(w + 0.06, 0.02, 0.2, c.x, 0.01, c.z, C.strD);
    b.box(w, 0.02, 0.14, c.x, hPipe - r - 0.02, c.z, C.strD); b.ring(V(c.x, hPipe, c.z), ZA, r + 0.006, 0.006, C.galv, 14);
  }
  function stationFittings(root, ids) {
    const o = id => procValveObj(id);
    // поз. 3 — задвижки Ду100, поз. 6 — КОП 100-16, поз. 18 — опоры (у каждой из трёх линий)
    const bs = GK.builder(), bcv = GK.builder();
    [[2.22, '186-Б'], [2.76, '186-З'], [3.30, '186-Л']].forEach(([X, vid]) => {
      gateValve(root, X, 9.27, 0.40, 100, 'y', vid, o(vid));
      checkValve(bcv, X, 8.76, 0.40);
      for (const Y of [9.76, 8.25]) support(bs, X, Y, 0.40, 0.054);
    });
    root.add(meshOf(bcv, GK.MAT.paint, Object.assign({}, O.pipe('Клапаны обратные КОП 100-16 (19с53нж), поз. 6'), { note: '186-ТХ.С-001-0 поз. 6 (3 шт.): на линиях бензина, ДТ(З), ДТ(Л) за задвижками Ду100. Поток — от насосного цеха к АСН. Габариты — условно.' })));
    // коллектор: задвижки Ду80 (поз. 4) до и после расходомера и на обводе; опоры ОПП2-100.89 (поз. 19)
    const o4 = { id: 'Задвижка Ду80 (186)', net: 1, f25: 'pipe', name: 'Задвижка клиновая Ду80 Ру16 ЗКЛ2-80-16 (30с41нж), поз. 4', note: '186-ТХ.С-001-0 поз. 4 (3 шт.): до и после расходомера и на обводной линии. В модели ТП не участвуют (узел учёта — ребро графа); положение — открыты на основной линии, закрыта на обводе (учебно).' };
    gateValve(root, 3.30, 7.03, 0.40, 80, 'y', null, o4); gateValve(root, 3.30, 5.59, 0.40, 80, 'y', null, o4);
    gateValve(root, 2.85, 6.83, 0.40, 80, 'y', null, o4); stems[stems.length - 1].k = 0; stems[stems.length - 1].closed = 1;
    for (const [X, Y] of [[3.30, 5.0], [2.85, 6.0], [3.30, 7.55]]) support(bs, X, Y, 0.40, 0.0445, 0.16);
    root.add(meshOf(bs, GK.MAT.paint, O.pipe('Опоры подвижные ОПП2-100.108 / ОПП2-100.89 (поз. 18, 19)')));
    { // v0.34: утеплённые кожухи арматуры (186-ТХ.ВТ-001-0: арматура Ду100 — 2, Ду80 — 5; маты 60 мм + сталь 0,5 мм)
      const bj = GK.builder(), J = [[2.76, 9.27, 100], [3.30, 9.27, 100], [3.30, 7.03, 80], [3.30, 5.59, 80], [2.85, 6.83, 80]];
      for (const [X, Y, dn] of J) { const [L, , Rf] = CATV[dn], c = P3(X, Y, 0.40); bj.cyl(c.clone().addScaledVector(ZA, -(L / 2 + 0.06)), c.clone().addScaledVector(ZA, L / 2 + 0.06), Rf + 0.065, C.galv || C.dark, 20); }
      root.add(meshOf(bj, new THREE.MeshStandardMaterial({ color: 0xc3c8cc, roughness: 0.35, metalness: 0.6 }), Object.assign({}, O.pipe('Утеплённые кожухи арматуры (186-ТХ.ВТ)'), { note: '186-ТХ.ВТ-001-0: утепляется арматура Ду100 — 2 шт. (ДТ(З), ДТ(Л)) и Ду80 — 5 шт.; маты 60 мм, покрытие — сталь 0,5 мм. В 3D — кожухи на задвижках Ду100 ДТ(З)/ДТ(Л) и трёх задвижках Ду80 коллектора; 2 позиции Ду80 по ВТ на плане не определены. Форма кожуха — условно.' })));
    }
    // расходомер P-N4 (FQIT186-01, учтён в части АК) и СЕНС-ПР Ду80/32 (граница заводской поставки АСН)
    const bm = GK.builder(), mx = sx(3.30);
    bm.cyl(V(mx, 0.40, sz(6.02)), V(mx, 0.40, sz(6.66)), 0.075, 0x3b6e8f, 20); for (const Y of [6.02, 6.66]) bm.cyl(V(mx, 0.40, sz(Y) - 0.015), V(mx, 0.40, sz(Y) + 0.015), 0.0825, C.dark, 20);
    bm.cyl(V(mx, 0.47, sz(6.34)), V(mx, 0.62, sz(6.34)), 0.03, C.dark, 10); bm.box(0.16, 0.14, 0.12, mx, 0.68, sz(6.34), 0x3b6e8f); bm.box(0.1, 0.06, 0.005, mx, 0.7, sz(6.34) - 0.063, 0xcfe3ee);
    root.add(meshOf(bm, GK.MAT.paint, { id: 'FQIT186-01', net: 1, f25: 'pipe', name: 'Расходомер P-N4 (FQIT186-01) — узел учёта АСН-N1', note: 'На 186-ТХ-002-0: «Расходомер P-N4 учтён в части АК»; переходы К-89×3,5–57×3 (поз. 14) до и после. Тип и габарит прибора — условно. В модели ТП — ребро «Узел учёта АСН-N1: FQIT186-01, FA186-03».' }));
    const bk = GK.builder(), kz = sz(4.62);
    bk.cyl(V(mx, 0.40, kz - 0.09), V(mx, 0.40, kz + 0.09), 0.06, C.dark, 16); bk.cyl(V(mx, 0.45, kz), V(mx, 0.6, kz), 0.025, C.dark, 10); bk.box(0.1, 0.1, 0.1, mx, 0.65, kz, 0x2f4f6c);
    root.add(meshOf(bk, GK.MAT.paint, { id: 'СЕНС-ПР', net: 1, f25: 'pipe', name: 'Сигнализатор протока СЕНС-ПР Ду80/32 — граница заводской поставки АСН-80-02.01', note: '186-ТХ-002-0, разрез 2-2: вварной адаптер датчика протока (прим. 5). Габарит — условно.' }));
    // клапан отсечной КО-1 (АК-004) — на входе в колонну АСН (в составе поставки устройства; положение — условно)
    const kv = P3(3.30, 4.36, 0.40), b1 = GK.builder();
    b1.cyl(kv.clone().addScaledVector(ZA, -0.12), kv.clone().addScaledVector(ZA, 0.12), 0.06, C.dark, 16); for (const s of [-1, 1]) b1.cyl(kv.clone().addScaledVector(ZA, s * 0.12), kv.clone().addScaledVector(ZA, s * 0.1), 0.0975, C.dark, 18);
    b1.cyl(V(kv.x, 0.46, kv.z), V(kv.x, 0.55, kv.z), 0.03, C.dark, 10); b1.box(0.2, 0.16, 0.16, kv.x, 0.64, kv.z, 0x8a2a22); b1.cyl(V(kv.x + 0.1, 0.64, kv.z), V(kv.x + 0.2, 0.64, kv.z), 0.05, 0x8a2a22, 12);
    root.add(meshOf(b1, GK.MAT.paint, procValveObj('КО-1')));
    // вантуз на коллекторе (поз. 8/17: кран шаровый Ду20, труба Ø25×3) — у тройника
    const bv = GK.builder(), vx = sx(3.03), vz = sz(7.75);
    bv.box(0.05, 0.05, 0.05, vx, 0.70, vz, C.dark); bv.box(0.14, 0.012, 0.02, vx + 0.06, 0.74, vz, C.red);
    root.add(meshOf(bv, GK.MAT.paint, O.pipe('Кран шаровый Ду20 (поз. 8) на трубе Ø25×3 (поз. 17) — воздушник коллектора')));
    // отвод паров: огневой предохранитель ПО-100 (поз. 5), опоры ОП3, ОП4, подвески горизонтального участка +5,0
    const bp = GK.builder(), vxp = sx(3.71);
    bp.cyl(V(vxp, 3.384, sz(2.83)), V(vxp, 3.384, sz(3.17)), 0.12, 0x6b7177, 20); for (const Y of [2.83, 3.17]) bp.cyl(V(vxp, 3.384, sz(Y) - 0.02), V(vxp, 3.384, sz(Y) + 0.02), 0.11, C.dark, 20);
    for (let k = 0; k < 5; k++) bp.ring(V(vxp, 3.384, sz(2.9 + k * 0.06)), ZA, 0.122, 0.006, 0x5a6168, 20);
    root.add(meshOf(bp, GK.MAT.paint, { id: 'ПО-100', net: 1, f25: 'pipe', name: 'Предохранитель огневой ПО-100 Ду100 (поз. 5) на линии отвода паров', note: '186-ТХ.С-001-0 поз. 5 (ТУ 3689-002-0217636); место — по плану 186-ТХ-002-0. Габарит — условно.' }));
    const bq = GK.builder();
    for (const Y of [2.07]) { bq.box(0.1, 3.33 - 0.03, 0.1, vxp, (3.33 - 0.03) / 2, sz(Y), C.str); bq.box(0.25, 0.02, 0.25, vxp, 0.01, sz(Y), C.strD); bq.ring(V(vxp, 3.384, sz(Y)), ZA, 0.06, 0.007, C.galv, 14); }
    for (const X of [4.6, 6.5, 8.3]) { const h = hCol(X) + 0.02; bq.cyl(V(sx(X), 5.054 + 0.07, sz(0.28)), V(sx(X), h, sz(0.28)), 0.01, C.galv, 6); bq.bar(V(sx(X), h, sz(0.28)), V(sx(X), h, sz(0.02)), 0.05, 0.05, C.str); bq.ring(V(sx(X), 5.054, sz(0.28)), XA, 0.06, 0.007, C.galv, 14); }
    bq.box(0.1, 5.0, 0.1, sx(3.71) - 0.12, 2.5, sz(0.28), C.str); bq.box(0.25, 0.02, 0.25, sx(3.71) - 0.12, 0.01, sz(0.28), C.strD);
    root.add(meshOf(bq, GK.MAT.paint, O.pipe('Опоры ОП3, ОП4 и подвески линии отвода паров (условно)')));
  }

  /* =========================== 5. ГРУППЫ И СБОРКА СТАНЦИИ =========================== */
  let root0 = null;
  const pipeG = new THREE.Group(); pipeG.name = 'F25: трубы станции 186'; scene.add(pipeG);
  function station(g) {
    const root = new THREE.Group(); root.position.y = H186; g.add(root); root0 = root; inSt = true;
    canopy(root); pads(root); platform(root);
    buildASN(root); buildMP(root);
    const ttop = buildTruck(root);
    MPW = Math.asin(Math.max(-0.9, Math.min(0.9, (ttop + 0.02 - PL.h) / MP.L)));
    poseAt(0); poseApply();
    inSt = false;
  }

  /* =========================== 6. ТРУБОПРОВОДЫ В ЕДИНУЮ МОДЕЛЬ СЕТИ (PIPEREG → PNET/PGEO) =========================== */
  const netMat = k => { const l = netLayers[k]; if (l) for (const c of l.children) if (c.userData.netsSeg === k && !c.userData.under) return c.material; return null; };
  const lzbMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.45, metalness: 0.3 });
  const ugEnd = (k, x, z, tol = 0.12) => {   // точка подземной трассы ГП-005 (конец/начало) у заданной точки плана
    const runs = (UGN.runsOf && UGN.runsOf[k]) || [];
    for (const r of runs) for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) if (Math.hypot(p[0] - x, p[2] - z) <= tol) return p.slice();
    return null;
  };
  const REC = [];
  const reg = (o) => { PIPEREG.push(Object.assign({ gen: 'TK', cf: { plan: 'V', elev: 'V', dn: 'V' } }, o)); REC.push(o); };
  const TKO = { id: 'ДТ(Л) к 501/137', net: 1, name: 'ДТ(Л) Ø57×3 к котельной 501 и ДЭС 137 — по 152-ТК-007-0', note: '' };
  let ok186 = { b: 0, dtz: 0, dtl: 0, gu: 0 };
  function station186Pipes() {
    const o = (n, extra = {}) => Object.assign(O.pipe(n), { gS: pipeG }, extra);
    const y = h => H186 + h;
    const lines = [['b', 2.22, 'Бензин Ø108×4 от насосного цеха — станция налива 186'], ['dtz', 2.76, 'ДТ(З) Ø108×4 от насосного цеха — станция налива 186'], ['dtl', 3.30, 'ДТ(Л) Ø108×4 от насосного цеха — станция налива 186']];
    for (const [k, X, n] of lines) {
      const e = ugEnd(k, sx(X), 0.99);
      const pts = [];
      if (e) { pts.push(e); ok186[k] = 1; }
      pts.push(W3(X, 11.05, 0.40), W3(X, 7.75, 0.40));
      if (k === 'b') pts.push(W3(2.76, 7.75, 0.40));
      reg({ net: k, r: 0.054, od: 0.108, pts, name: n, src: '186-ТХ-002-0', mt: netMat(k), o: o(n) });
    }
    const L = (n, od, pts) => reg({ net: 'lzb', r: od / 2, od, pts, name: n, src: '186-ТХ-002-0', mt: lzbMat, o: o(n) });
    L('Коллектор Ø108×4: бензин, ДТ(З) → тройник ДТ(Л)', 0.108, [W3(2.76, 7.75, 0.40), W3(3.30, 7.75, 0.40)]);
    L('Коллектор АСН-N1 Ø89×3,5', 0.089, [W3(3.30, 7.75, 0.40), W3(3.30, 7.32, 0.40)]);
    L('Коллектор АСН-N1 Ø89×3,5', 0.089, [W3(3.30, 7.32, 0.40), W3(3.30, 6.80, 0.40)]);
    L('Узел учёта АСН-N1 Ø57×3 (расходомер P-N4)', 0.057, [W3(3.30, 6.80, 0.40), W3(3.30, 5.88, 0.40)]);
    L('Коллектор АСН-N1 Ø89×3,5', 0.089, [W3(3.30, 5.88, 0.40), W3(3.30, 5.21, 0.40)]);
    L('Коллектор АСН-N1 Ø89×3,5 к колонне АСН', 0.089, [W3(3.30, 5.21, 0.40), W3(3.30, 4.10, 0.40)]);
    L('Обводная линия узла учёта Ø89×3,5', 0.089, [W3(3.30, 7.32, 0.40), W3(2.85, 7.32, 0.40), W3(2.85, 5.21, 0.40), W3(3.30, 5.21, 0.40)]);
    reg({ net: 'lzb', r: 0.0125, od: 0.025, pts: [W3(3.03, 7.75, 0.40), W3(3.03, 7.75, 0.80)], name: 'Воздушник коллектора Ø25×3', src: '186-ТХ-002-0', mt: lzbMat, o: o('Воздушник коллектора Ø25×3'), eqEnd: 'Воздушник коллектора: кран шаровый Ду20 (поз. 8)' });
    // продуктовый тракт АСН-80-02.01 (в рабочем положении) — для связности и потока ГСМ; геометрию строит модуль F25
    const J = POSE_W.J, E = ASN.hatch;
    PIPEREG.push({ gen: 'ASN', net: 'lzb', r: 0.0445, od: 0.089, pts: [W3(3.30, 4.10, 0.40), W3(3.30, 4.10, ASN.hA), W3(J[0], J[1], ASN.hA), W3(E[0], E[1], ASN.hA), W3(E[0], E[1], ASN.hCovW + 0.05)],
      name: 'АСН-80-02.01: колонна, консоль, наливная труба (рабочее положение)', src: '186-ТХ-002-0', cf: { plan: 'P', elev: 'P', dn: 'V' }, eqEnd: 'АСН-80-02.01: наливная труба в горловине автоцистерны', o: O.asn });
    // отвод паров
    const eg = ugEnd('gu', sx(9.05), sz(0.28), 0.15);
    const vp = [W3(3.71, 4.10, 3.384), W3(3.71, 0.28, 3.384), W3(3.71, 0.28, 5.054), W3(9.05, 0.28, 5.054)];
    { const yv = vp[vp.length - 1][1]; vp.push([-43.35, +yv.toFixed(3), -9.78], [-43.35, 0.87, -9.78]); ok186.gu = 1; }   // v0.34 (P16): надземно на +5,000 через дорогу (186-ТХ-002, 152-ТК-005); опуск у x −43,35 — условно
    reg({ net: 'gu', r: 0.054, od: 0.108, pts: vp, name: 'Отвод паров Ø108×4 от АСН-80-02.01', src: '186-ТХ-002-0', mt: netMat('gu'), o: Object.assign({}, O.vap, { gS: pipeG }), eqStart: 'АСН-80-02.01: патрубок отвода паров (кран шаровый Ду80, поз. 7)' });
  }
  /* --- 152-ТК-007-0: узел 13 (надземный переход), узел 14, ввод в котельную --- */
  const TK = { z: -19.77, x89: 26.98, xR1: 27.78, x90: 28.28, x91: 35.08, xR2: 35.58, xV: 35.33, xD: 35.86, x92: 37.38, xW: 61.91, xIn: 62.36 };
  TK.yTop = 298.25 + 5.10 + 0.0285 - H0;   // низ трубы +5,100 от оси автодороги (0,000 = 298,25*) — «Сверка» P18
  TK.yIn = 300.04 + 0.0285 - H0;           // ввод в котельную: низ трубы +1,590 (300,04)
  const nodeY = (x, z) => hAt(x, z) + 0.6;   // ось надземной трассы ГП-005 в узле (PNET, п. 4.4: рельеф в узле + 0,6 м)
  function yLine(x, z, N) {   // отметка оси внутри отрезка трассы ДТ(Л) — линейно между узлами
    const L = (N || NETS).dtl;
    for (const s of L) {
      if (s[4]) continue;
      const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz; if (l2 < 1e-8) continue;
      const t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; if (t < -1e-6 || t > 1 + 1e-6) continue;
      if (Math.hypot(s[0] + dx * t - x, s[1] + dz * t - z) > 0.03) continue;
      return nodeY(s[0], s[1]) * (1 - t) + nodeY(s[2], s[3]) * t;
    }
    return nodeY(x, z);
  }
  let tkY = {};
  function tkPipes() {
    const o = Object.assign({}, TKO, { gS: null }), mt = netMat('dtl');
    const z = TK.z, yA = tkY.yA, yB = tkY.yB, yT = TK.yTop;
    const base = { net: 'dtl', r: 0.0285, od: 0.057, src: '152-ТК-007-0', mt };
    reg(Object.assign({}, base, { pts: [[TK.x89, yA, z], [TK.xR1, yA, z], [TK.xR1, yT, z], [TK.xR2, yT, z], [TK.xR2, yB, z], [TK.x92, yB, z]], name: 'ДТ(Л) Ø57×3 — П-образный надземный переход через автодорогу (узел 13)', o: Object.assign({}, o, { id: 'Узел 13', note: '152-ТК-007-0, узел 13 и разрез 5-5: ОН89 → 800 → стояк → 500 → ОП90 → 6800 → ОП91 → 500 → стояк; низ трубы +5,100 (0,000 = ось автодороги 298,25*); у западного конца +0,280, у восточного +0,440 (низ тр.). В модели концы перехода — на отметке трассы ГП-005 (+0,6 м от земли). Трубы ГОСТ 8732-78*.' }) }));
    reg(Object.assign({}, base, { r: 0.0125, od: 0.025, pts: [[TK.xV, yT, z], [TK.xV, yT + 0.40, z]], eqEnd: 'Воздушник: кран шаровый (поз. 10), нормально закрыт', name: 'Воздушник Ø25×3 (кран шаровый поз. 10)', o: Object.assign({}, o, { id: 'Воздушник', note: '152-ТК-007-0, разрез 5-5: воздушник Ø25×3 с краном в верхней точке перехода, в 250 мм от ОП91.' }) }));
    reg(Object.assign({}, base, { r: 0.0125, od: 0.025, pts: [[TK.xD, yB, z], [TK.xD, yB - 0.40, z]], eqEnd: 'Слив дренажного остатка: кран (поз. 10) над переносной тарой', name: 'Слив дренажного остатка Ø25×3 в переносную тару (кран поз. 10)', o: Object.assign({}, o, { id: 'Слив', note: '152-ТК-007-0, узел 13: слив дренажного остатка в переносную тару Ø25×3, в 280 мм от восточного стояка.' }) }));
    // узел 14: обводы на линии к котельной и на ответвлении к ДЭС (по ТК-007, положение — по графике ГП-005)
    const y14a = tkY.y14a, y14b = tkY.y14b, yb1 = tkY.yb1, yb2 = tkY.yb2;
    reg(Object.assign({}, base, { pts: [[57.87, y14a, z], [57.87, y14a, -19.41], [59.78, y14b, -19.41], [59.78, y14b, z]], name: 'Обводная линия Ø57×3 на линии к котельной (узел 14)', o: Object.assign({}, o, { id: 'Узел 14', note: '152-ТК-007-0, узел 14: обвод с краном (поз. 8) вокруг поз. 1 и двух кранов на линии к котельной; положение — по графике ГП-005 (0,36 м южнее линии).' }) }));
    reg(Object.assign({}, base, { pts: [[57.35, yb1, -19.41], [57.71, yb1, -19.41], [57.71, yb2, -17.50], [57.35, yb2, -17.50]], name: 'Обводная линия Ø57×3 на ответвлении к ДЭС (узел 14)', o: Object.assign({}, o, { id: 'Узел 14', note: '152-ТК-007-0, узел 14: обвод с краном (поз. 8) на ответвлении к ДЭС 137.' }) }));
    // ввод в котельную (разрез 6-6)
    reg(Object.assign({}, base, { pts: [[TK.xW, tkY.yC, z], [TK.xW, TK.yIn, z], [TK.xIn, TK.yIn, z]], name: 'ДТ(Л) Ø57×3 — ввод в котельную 501 на +1,590 (разрез 6-6)', eqEnd: 'Котельная 501: ввод ДТ(Л) (+1,590)', o: Object.assign({}, o, { id: 'Ввод 501', note: '152-ТК-007-0, разрез 6-6: подъём у стены котельной до +1,590 (низ тр. 300,04) и ввод в здание. Положение стены — по ГП-003.' }) }));
  }
  /* --- отметки узлов трассы ДТ(Л) по ТК-007 (трасса ГП-005 заменена по ТК-007 в данных NETS с v0.43) --- */
  function initTk(N) {
    const z = TK.z;
    tkY = { yA: nodeY(TK.x89, z), yB: nodeY(TK.x92, z), y14a: yLine(57.87, z, N), y14b: yLine(59.78, z, N), yC: nodeY(TK.xW, z), yb1: yLine(57.35, -19.41, N), yb2: yLine(57.35, -17.50, N) };
  }
  /* --- 3D опор и арматуры по ТК-007 --- */
  const tkG = new THREE.Group(); tkG.name = 'F25: опоры и арматура ТК-007'; scene.add(tkG);
  function ballValve(b, c, ax, open, dn = 50) {   // кран шаровой с рукояткой (поз. 8 / 10)
    const r = dn / 2000 + 0.012, L = dn >= 50 ? 0.18 : 0.08;
    b.cyl(c.clone().addScaledVector(ax, -L / 2), c.clone().addScaledVector(ax, L / 2), r + 0.008, C.dark, 14);
    b.cyl(V(c.x, c.y, c.z), V(c.x, c.y + r + 0.05, c.z), 0.012, C.dark, 6);
    const dir = open ? ax : new THREE.Vector3().crossVectors(ax, UP).normalize();
    b.bar(V(c.x, c.y + r + 0.05, c.z), V(c.x, c.y + r + 0.05, c.z).addScaledVector(dir, dn >= 50 ? 0.22 : 0.12), 0.025, 0.008, C.red);
  }
  function tkBuild() {
    const b = GK.builder(), bk = GK.builder(), z = TK.z, yT = TK.yTop, r = 0.0285;
    const g0 = x => hAt(x, z);
    // ОП90, ОП91 — стойки до низа трубы на +5,100 (поз. 66); ОН89 (поз. 72), ОП92 (поз. 68) — низкие опоры
    for (const x of [TK.x90, TK.x91]) {
      const gy = g0(x);
      b.box(0.6, 0.3, 0.6, x, gy - 0.1, z, C.conc); b.box(0.32, 0.02, 0.32, x, gy + 0.06, z, C.strD);
      b.cyl(V(x, gy + 0.07, z), V(x, yT - r - 0.06, z), 0.0545, C.str, 14);   // стойка — труба Ø108 (условно)
      b.box(0.3, 0.02, 0.18, x, yT - r - 0.05, z, C.strD); b.box(0.12, 0.04, 0.08, x, yT - r - 0.025, z, C.strD); b.ring(V(x, yT, z), XA, r + 0.006, 0.006, C.galv, 14);
      for (const s of [-1, 1]) b.bar(V(x, yT - r - 0.35, z), V(x + s * 0.13, yT - r - 0.05, z), 0.03, 0.03, C.str);
    }
    const low = (x, y, fixed) => { const gy = g0(x); b.box(0.35, 0.2, 0.35, x, gy - 0.05, z, C.conc); b.box(0.1, y - r - 0.03 - gy - 0.05, 0.1, x, (y - r - 0.03 + gy + 0.05) / 2, z, C.str); b.box(0.2, 0.02, 0.14, x, y - r - 0.02, z, C.strD); b.ring(V(x, y, z), XA, r + 0.006, 0.006, C.galv, 14); if (fixed) for (const s of [-1, 1]) b.box(0.02, 0.05, 0.08, x + s * 0.06, y - r + 0.0, z, C.strD); };
    low(TK.x89, tkY.yA, 1); low(TK.x92, tkY.yB, 0);
    ballValve(bk, V(TK.xV, yT + 0.2, z), UP, false, 20); bk.cyl(V(TK.xV, yT + 0.40, z), V(TK.xV + 0.08, yT + 0.34, z), 0.0125, C.str, 8);   // воздушник: кран, загнутый конец
    ballValve(bk, V(TK.xD, tkY.yB - 0.22, z), UP, false, 20);
    tkG.add(meshOf(b, GK.MAT.paint, Object.assign({}, TKO, { id: 'Узел 13', note: 'Опоры перехода: ОН89 — неподвижная (поз. 72), ОП90, ОП91 — стойки до низа трубы на +5,100 (поз. 66), ОП92 (поз. 68) — по 152-ТК-007-0. Сечения стоек и фундаментов — условно (КЖ/КМ нет).' })));
    tkG.add(meshOf(bk, GK.MAT.paint, Object.assign({}, TKO, { id: 'Узел 13', note: 'Краны шаровые (поз. 10) на воздушнике и сливе Ø25×3 — 152-ТК-007-0; нормально закрыты.' })));
    // узел 14: площадка с бортиком (Г-образная), приямок, краны (поз. 8), поз. 1, опоры ОП1а–ОП4а
    const b4 = GK.builder(), bv = GK.builder(), xw = 56.88, zn = -20.39, gy = hAt(58.0, -19.5);
    b4.box(3.0, 0.3, 1.3, xw + 1.5, gy, zn + 0.65, C.conc); b4.box(1.0, 0.3, 1.9, xw + 0.5, gy, zn + 1.3 + 0.95, C.conc);
    b4.box(0.5, 0.01, 0.5, xw + 0.4, gy + 0.155, zn + 0.4, C.blk); for (let k = 0; k < 7; k++) b4.box(0.012, 0.02, 0.5, xw + 0.18 + k * 0.07, gy + 0.165, zn + 0.4, C.strD);
    const yM = tkY.y14a, ax = XA;
    for (const x of [58.18, 59.39]) ballValve(bv, V(x, yM, z), ax, true);
    ballValve(bv, V(58.53, yM, -19.41), ax, false);
    for (const zz of [-19.09, -17.84]) ballValve(bv, V(57.35, yV2(zz), zz), ZA, true);
    ballValve(bv, V(57.71, yV2(-18.72), -18.72), ZA, false);
    // v0.26: поз. 1 узла 14 — клапан запорный (отсечной) с электромагнитным приводом КЭО 50/16/210/133 ЭВ 04/АС/220/9 Ду50, 2 шт., 12 кг
    // (152-ТК.С-001-0 л. 1.1, поз. 1; 55555.pdf стр. 20) = отсечные клапаны КО-2 (котельная) и КО-3 (ДЭС) по АК-004. Строительная длина 210 мм — по обозначению; прочие габариты — условно
    const keo = (c, a, vid, nm) => {
      const bk = GK.builder(), L = 0.21, pr = new THREE.Vector3().crossVectors(a, UP).normalize();
      for (const s of [-1, 1]) bk.cyl(c.clone().addScaledVector(a, s * (L / 2 - 0.02)), c.clone().addScaledVector(a, s * L / 2), 0.08, C.dark, 18);   // фланцы Ду50 Ру16
      bk.cyl(c.clone().addScaledVector(a, -L / 2 + 0.02), c.clone().addScaledVector(a, L / 2 - 0.02), 0.045, 0x5a6168, 16);
      bk.cyl(c.clone().addScaledVector(a, -0.06), c.clone().addScaledVector(a, 0.06), 0.065, 0x5a6168, 18);                                        // корпус
      bk.cyl(V(c.x, c.y + 0.04, c.z), V(c.x, c.y + 0.1, c.z), 0.05, C.dark, 16);                                                                  // крышка
      bk.cyl(V(c.x, c.y + 0.1, c.z), V(c.x, c.y + 0.255, c.z), 0.058, C.alu, 18);                                                                  // электромагнитный привод (взрывозащищённый корпус)
      bk.cyl(V(c.x, c.y + 0.255, c.z), V(c.x, c.y + 0.27, c.z), 0.062, C.dark, 18);
      const jb = V(c.x, c.y + 0.19, c.z).addScaledVector(pr, 0.085); bk.box(0.07, 0.08, 0.07, jb.x, jb.y, jb.z, C.alu);                           // коробка выводов
      const cg = jb.clone().addScaledVector(pr, 0.05); bk.cyl(cg, cg.clone().addScaledVector(pr, 0.04), 0.013, C.dark, 8);                         // кабельный ввод
      const me = meshOf(bk, GK.MAT.paint, Object.assign({}, TKO, { id: 'Узел 14', name: nm, note: '152-ТК.С-001-0 л. 1.1, поз. 1: клапан запорный (отсечной) с электромагнитным приводом КЭО 50/16/210/133 ЭВ 04/АС/220/9, Ду50, 2 шт., 12 кг. По АК-004 — ' + vid + ' (автоматическое закрытие при пожаре и аварии). Габариты, кроме строительной длины 210 мм, — условно.' }));
      me.userData.pick = () => (typeof procLogic !== 'undefined' && procLogic.V && procLogic.V[vid] && typeof procValveObj === 'function') ? procValveObj(vid) : me.userData.o;   // карточка клапана технологической модели
      tkG.add(me);
    };
    keo(V(58.96, yM, z), XA, 'КО-2', 'Клапан отсечной КО-2 — КЭО 50/16 с электромагнитным приводом (узел 14, линия к котельной 501)');
    keo(V(57.35, yV2(-18.31), -18.31), ZA, 'КО-3', 'Клапан отсечной КО-3 — КЭО 50/16 с электромагнитным приводом (узел 14, ответвление к ДЭС 137)');
    for (const [x, zz, yy] of [[58.57, z, yM], [59.04, -19.41, yM], [57.35, -18.70, yV2(-18.70)], [57.71, -18.24, yV2(-18.24)]]) { b4.box(0.08, yy - 0.0285 - gy - 0.15, 0.08, x, (yy - 0.0285 + gy + 0.15) / 2, zz, C.str); b4.box(0.16, 0.02, 0.1, x, yy - 0.04, zz, C.strD); }
    tkG.add(meshOf(b4, GK.MAT.paint, Object.assign({}, TKO, { id: 'Узел 14', note: '152-ТК-007-0, узел 14: Г-образная площадка 3,0 × 1,3 м с выступом 1,0 × 3,2 м, канализационный приямок 500×500×500 (см. часть АС), опоры ОП1а–ОП4а. Конструкции — условно.' })));
    tkG.add(meshOf(bv, GK.MAT.paint, Object.assign({}, TKO, { id: 'Узел 14', note: '152-ТК-007-0, узел 14: краны (поз. 8) до и после поз. 1 на линии к котельной и на ответвлении к ДЭС; на обводах — по крану (в модели закрыты). Поз. 1 — клапан отсечной КЭО 50/16 с электромагнитным приводом (152-ТК.С-001-0, v0.26) = КО-2 / КО-3.' })));
  }
  function yV2(zz) { return yLine(57.35, zz); }


  /* =========================== 8. АНИМАЦИЯ, КАРТОЧКИ =========================== */
  let tPrev = 0, cardFor = null, cardT = 0, msg = '';
  function filling() { try { return typeof procSim !== 'undefined' && procSim.S.flows.some(f => (f.sinks || []).includes('ASN')); } catch (e) { return false; } }
  function tick(now) {
    if (!root0) return;
    const dt = Math.min(0.2, tPrev ? (now - tPrev) / 1000 : 0) * (api.speed || 1); tPrev = now;
    kin.fill = filling();
    kin.tgt = kin.fill ? 1 : kin.manual;
    if (Math.abs(kin.tgt - kin.pose) > 1e-4) { kin.pose += Math.sign(kin.tgt - kin.pose) * Math.min(Math.abs(kin.tgt - kin.pose), dt / 9); poseAt(kin.pose); poseApply(); }
    if (truck.lid) { const tl = kin.pose > 0.5 ? -1.9 : 0; truck.lid.rotation.z += (tl - truck.lid.rotation.z) * Math.min(1, dt * 2); }
    if (typeof procLogic !== 'undefined') for (const s of stems) {
      const tgt = s.vid ? (window.__VPOS ? window.__VPOS(s.vid, procLogic.st.valve[s.vid] ? 1 : 0) : (procLogic.st.valve[s.vid] ? 1 : 0)) : (s.closed ? 0 : 1);
      if (Math.abs(tgt - s.k) < 1e-3 && s.init) continue;
      s.init = 1; s.k += Math.sign(tgt - s.k) * Math.min(Math.abs(tgt - s.k), dt / 1.6);
      s.g.position.y = s.y0 + s.stroke * s.k; s.g.rotation.y = s.k * 6;
    }
    if (cardFor && (cardT += dt) > 0.3) { cardT = 0; const el = document.getElementById('f25st'); if (el) el.innerHTML = stateHTML(); }
  }
  const f1 = v => v.toFixed(2).replace('.', ',');
  function stateHTML() {
    const p = kin.pose, st = p < 0.01 ? 'гаражное' : p > 0.99 ? 'рабочее (крышка на горловине)' : 'перемещение';
    return `Положение АСН: <b>${st}</b>; крышка на ${(kin.hc >= 0 ? '+' : '') + f1(kin.hc)}; мостик МП-4 ${kin.mp > 1.0 ? 'поднят' : 'опущен на автоцистерну'}` + (kin.fill ? ' · <b style="color:#1d4e7a">идёт налив (модель ТП)</b>' : '') + (msg ? `<div style="color:#8a4b00">${msg}</div>` : '');
  }
  function cardHTML(o) {
    const k = o && o.f25; cardFor = null; if (!k) return '';
    let h = '<div class="dxc">';
    if (k === 'asn' || k === 'mp' || k === 'truck') {
      cardFor = o;
      h += `<div class="dxh">АСН-80-02.01 — положение (учебно)</div><div class="n" id="f25st">${stateHTML()}</div>` +
        `<button class="btn" data-f25p="1">Рабочее положение</button><button class="btn" data-f25p="0">Гаражное положение</button>` +
        `<div class="n">При запуске маршрута налива в автоцистерну (модель ТП) устройство само переводится в рабочее положение; после остановки — возвращается в выбранное. Последовательность: консоль над горловиной → опускание крышки → мостик на площадку автоцистерны.</div>` +
        `<button class="btn" data-f25v="asn">Вид на АСН</button><button class="btn" data-dxeq="АСН-80">Паспорт АСН-80</button><button class="btn" data-dxeq="Станция 186">Паспорт станции</button>`;
    } else if (k === 'st' && o.id === '186') h += `<button class="btn" data-f25v="st">Вид на станцию</button><button class="btn" data-f25v="asn">Вид на АСН</button>`;   // паспорта объекта 186 — в блоке документации ТХ ниже
    else if (k === 'st' || k === 'pipe') h += `<button class="btn" data-f25v="st">Вид на станцию</button><button class="btn" data-dxeq="Станция 186">Паспорт станции</button><button class="btn" data-dxeq="Арматура 186">Арматура 186</button>`;
    return h + '</div>';
  }
  function bindCard(root) {
    for (const b of root.querySelectorAll('[data-f25p]')) b.onclick = () => {
      const v = +b.dataset.f25p;
      if (!v && kin.fill) { msg = 'Идёт налив: перевод в гаражное положение — после остановки маршрута.'; } else msg = '';
      kin.manual = v;
    };
    for (const b of root.querySelectorAll('[data-f25v]')) b.onclick = () => VIEWS[b.dataset.f25v] && VIEWS[b.dataset.f25v]();
  }
  const VIEWS = {
    st: () => flyTo([sx(14.5), H186 + 9.5, sz(16.5)], [sx(4.2), H186 + 2.2, sz(5.0)], 0.9),
    asn: () => flyTo([sx(9.8), H186 + 6.4, sz(10.2)], [sx(4.4), H186 + 3.4, sz(4.3)], 0.9),
    nw: () => flyTo([sx(-6.5), H186 + 5.5, sz(-4.5)], [sx(3.0), H186 + 2.0, sz(4.5)], 0.9),   // с северо-запада: лестница, площадка, колонна АСН
    tk13: () => { const y = hAt(31.5, TK.z); flyTo([31.5 - 4, y + 7.5, TK.z + 13], [31.5, y + 3.0, TK.z], 0.9); },
    tk14: () => { const y = hAt(58.4, -18.8); flyTo([58.4 + 3.5, y + 4.2, -18.8 + 5.0], [58.4, y + 0.4, -18.8], 0.9); }
  };
  function late() {
    for (const [m, o] of own) m.userData.o = o;   // объекты карточек АСН, мостика, площадок, автоцистерны (цикл OBJ присвоил им '186')
    if (root0) stationFittings(root0);
    station186Pipes(); tkPipes(); tkBuild();
    FAST_LOD.push(...lod);
  }
  const api = { station, late, tick, initTk, cardHTML, bindCard, VIEWS, kin, ASN, POSE_W, POSE_G, TK, tkY, H186, H186t, sx, sz, tkG, pipeG, REC, ok186, truck, stems,
    own, speed: 1, dbg: () => ({ L: procLogic, S: procSim, PROC }) /* для проверки модели ТП */, setPose: v => { kin.manual = v ? 1 : 0; },
    get state() { return { H186t, pose: kin.pose, hc: kin.hc, mp: kin.mp, fill: kin.fill, a1: kin.a1, a2: kin.a2, ok186, tkY, H186, yTop: TK.yTop }; } };
  window.__F25 = api;
  return api;
})();

