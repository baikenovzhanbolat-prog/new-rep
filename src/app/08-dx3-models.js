/* =====================================================================================
   v0.21 — 3D ПО ДОКУМЕНТАЦИИ ТХ (222.pdf):
   W901 — механизм транспорта вагоно-цистерн по 901-ТХ-002-0 / 901-ТХ.С-001-0: лебёдка ТЛ-8Б3Р.ВЗИ под навесом,
          тупиковый упор, канаты на 13 парах поддерживающих роликов (26 шт., шаг 6 м), натяжное устройство.
   S196 — склад тары и готовой продукции по 196-ТХ-001-0 / 196-ТХ.С-001-0: площадка под навесом с сетчатым
          ограждением на рампе, 184 бочки по 200 л в 2 яруса на поддонах, погрузчик, пандус и лестница.
   Прежние изображения сохранены в слоях сравнения (по умолчанию скрыты).
   ===================================================================================== */
const DX3 = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
  function cylAB(a, b, r, seg = 10) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r, r, L, seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
  }
  function boxAB(a, b, w, h) {   // брус от a до b: w — поперёк по горизонтали, h — по вертикали
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
    const x = new THREE.Vector3().crossVectors(UP, d); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
    const y = new THREE.Vector3().crossVectors(d, x), g = new THREE.BoxGeometry(w, h, L);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, d)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
  }
  const box = (sx, sy, sz, x, y, z) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
  function Bk() { const b = new Map(); return { b, add(m, g) { (b.get(m) || b.set(m, []).get(m)).push(g); return g; } }; }
  function flush(B, grp, o) {
    for (const [m, list] of B.b) { const me = new THREE.Mesh(trkMerge(list), m); me.castShadow = me.receiveShadow = true; if (o) me.userData.o = o; grp.add(me); }
  }
  const MT = {
    winch: M(0x4f6f63, { roughness: 0.55, metalness: 0.25 }), rope: M(0x3c3d3e, { roughness: 0.45, metalness: 0.7 }),
    white: M(0xf1f0ea, { roughness: 0.6 }), roofS: M(0x8d979e, { roughness: 0.5, metalness: 0.45 }),
    mesh: M(0x7c868e, { transparent: true, opacity: 0.38, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    drum: M(0x2f4f78, { roughness: 0.5, metalness: 0.35 }), pallet: M(0xa88457, { roughness: 0.9 }),
    fork: M(0xb3392f, { roughness: 0.55, metalness: 0.2 }), tyre: M(0x1f2124, { roughness: 0.9 })
  };
  /* ---------------- 901 ---------------- */
  const W901 = (() => {
    const [xw] = P(2238.5, 3576.5), zT = P(0, TRACK_Y)[1];            // ось лебёдки — знак ГП-003; ось каната — ось пути № 53
    const xStop = xw + 5.0;                                          // 901-ТХ-002: ось лебёдки → тупиковый упор 5,0 м
    const xTen = EST177.AX[5] + 15.0;                                // ось 6 эстакады → натяжное устройство 15,0 м
    const ROLL = []; for (let k = 0; k < 13; k++) ROLL.push(xTen - 4.0 - 6.0 * k);   // 13 пар роликов, шаг 6 м (26 шт.)
    const ySl = RAIL53 - TRK.RAIL_H - TRK.PAD, yRope = ySl + 0.13, dzR = [-0.16, 0.16];   // [основной, вспомогательный]
    const old = [], t53w = [];
    let center = [xw, 0, zT];
    function build(g, o) {
      const y0 = hAt(xw, zT), B = Bk();
      center = [xw, y0 + 1.2, zT];
      // фундамент лебёдки и навес (4 колонны в осях 1–2 / А–Б, шаг ≈2,5 м — обмер листа; высота — условно)
      B.add(mat.conc, box(2.3, 0.45, 1.6, xw, y0 - 0.1, zT));
      const cx = [xw - 1.25, xw + 1.25], cz = [zT - 1.25, zT + 1.25], hW = 2.95, hE = 2.65;
      for (const x of cx) for (const z of cz) {
        const yt = x < xw ? hW : hE, yg = hAt(x, z);
        B.add(mat.conc, box(0.45, 0.35, 0.45, x, yg + 0.02, z));
        B.add(mat.steelD, box(0.12, y0 + yt - yg - 0.17, 0.12, x, (y0 + yt + yg + 0.17) / 2, z));
      }
      for (const z of cz) B.add(mat.steelD, boxAB(V(cx[0] - 0.05, y0 + hW, z), V(cx[1] + 0.05, y0 + hE, z), 0.1, 0.16));
      for (const t of [0, 0.5, 1]) { const x = cx[0] + (cx[1] - cx[0]) * t, y = y0 + hW + (hE - hW) * t + 0.1; B.add(mat.steelD, box(0.08, 0.06, 2.9, x, y, zT)); }
      const sl = new THREE.BoxGeometry(3.3, 0.04, 3.3), q = new THREE.Matrix4().makeRotationZ(Math.atan2(hE - hW, 2.5));
      sl.applyMatrix4(q); sl.translate(xw, y0 + (hW + hE) / 2 + 0.16, zT); B.add(MT.roofS, sl);
      // лебёдка ТЛ-8Б3Р.ВЗИ — условная компоновка: рама, барабан, редуктор, двигатель, тормоз (габариты не указаны)
      const yb = y0 + 0.12;
      for (const z of [zT - 0.45, zT + 0.45]) B.add(MT.winch, box(1.7, 0.16, 0.1, xw, yb + 0.08, z));
      for (const x of [xw - 0.8, xw + 0.8]) B.add(MT.winch, box(0.1, 0.16, 1.0, x, yb + 0.08, zT));
      const yd = yb + 0.62, xd = xw + 0.35;
      B.add(MT.winch, box(0.12, 0.5, 0.08, xd, yb + 0.4, zT - 0.42)); B.add(MT.winch, box(0.12, 0.5, 0.08, xd, yb + 0.4, zT + 0.42));
      B.add(MT.winch, cylAB(V(xd, yd, zT - 0.36), V(xd, yd, zT + 0.36), 0.31, 28));
      B.add(MT.rope, cylAB(V(xd, yd, zT - 0.3), V(xd, yd, zT + 0.3), 0.235, 28));
      B.add(mat.dark, cylAB(V(xd, yd, zT - 0.5), V(xd, yd, zT + 0.5), 0.05, 12));
      B.add(MT.winch, box(0.5, 0.55, 0.36, xd, yb + 0.43, zT + 0.68));                       // редуктор
      B.add(MT.winch, cylAB(V(xw - 0.55, yb + 0.42, zT + 0.68), V(xw - 0.02, yb + 0.42, zT + 0.68), 0.17, 20));   // электродвигатель (взрывозащ.)
      B.add(mat.dark, cylAB(V(xw - 0.62, yb + 0.42, zT + 0.68), V(xw - 0.55, yb + 0.42, zT + 0.68), 0.15, 20));
      B.add(MT.winch, cylAB(V(xw - 0.45, yb + 0.35, zT - 0.62), V(xw - 0.1, yb + 0.35, zT - 0.62), 0.12, 16));   // тормоз
      B.add(mat.yellow, box(0.04, 0.5, 0.9, xd + 0.42, yb + 0.55, zT));                            // ограждение барабана
      // пост управления у навеса (условно)
      B.add(mat.steelD, box(0.08, 1.3, 0.08, xw - 1.25, y0 + 0.65, zT + 1.6));
      B.add(mat.dark, box(0.32, 0.42, 0.2, xw - 1.25, y0 + 1.2, zT + 1.72));
      // тупиковый упор (сварной, условно), брус на высоте автосцепки ≈1,06 м от головки рельса
      const yR = RAIL53;
      for (const s of [-1, 1]) {
        const z = zT + s * TRK.GC;
        B.add(mat.red, boxAB(V(xStop - 0.9, yR + 0.02, z), V(xStop, yR + 1.0, z), 0.12, 0.14));
        B.add(mat.red, box(0.16, 1.1, 0.16, xStop + 0.05, yR + 0.55, z));
        B.add(mat.dark, box(1.1, 0.08, 0.2, xStop - 0.45, yR + 0.02, z));
      }
      for (let i = 0; i < 6; i++) B.add(i % 2 ? MT.white : mat.red, box(0.26, 0.3, 0.5, xStop + 0.06, yR + 1.06, zT - 1.25 + i * 0.5));
      // ролики, канаты, натяжное устройство
      const xs = [xd + 0.28, ...[...ROLL].reverse(), xTen];
      for (const x of ROLL) for (const [i, dz] of dzR.entries()) {
        const xx = x + (i ? 0.45 : 0), z = zT + dz;
        B.add(mat.dark, box(0.3, 0.04, 0.34, xx, ySl + 0.02, z));
        for (const s of [-1, 1]) B.add(mat.steelD, box(0.16, 0.13, 0.012, xx, ySl + 0.085, z + s * 0.13));
        B.add(mat.steel, cylAB(V(xx, yRope - 0.065, z - 0.11), V(xx, yRope - 0.065, z + 0.11), 0.055, 14));
      }
      B.add(mat.steel, cylAB(V(xd + 0.95, y0 + 0.25, zT - 0.3), V(xd + 0.95, y0 + 0.25, zT + 0.3), 0.07, 14));   // направляющий ролик у лебёдки
      B.add(mat.conc, box(1.0, 0.3, 1.2, xd + 0.95, y0 + 0.02, zT));
      for (const [i, dz] of dzR.entries()) {
        const r = i ? 0.0035 : 0.0105, z = zT + dz, pts = [V(xd, yd + (i ? -0.23 : 0.23), zT + dz * 0.6), V(xd + 0.95, y0 + 0.33, z)];
        for (const x of [...ROLL].reverse()) pts.push(V(x + (i ? 0.45 : 0), yRope, z));
        pts.push(V(xTen - 0.25, yRope, z));
        for (let k = 0; k < pts.length - 1; k++) B.add(MT.rope, cylAB(pts[k], pts[k + 1], Math.max(r, 0.006), 6));
      }
      B.add(mat.conc, box(1.2, 0.28, 1.0, xTen + 0.2, ySl - 0.1, zT));
      B.add(MT.winch, box(0.9, 0.12, 0.62, xTen + 0.25, ySl + 0.1, zT));
      B.add(mat.steel, new THREE.CylinderGeometry(0.21, 0.21, 0.07, 26).translate(xTen, yRope, zT));    // обводной шкив
      B.add(mat.dark, new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10).translate(xTen, yRope + 0.02, zT));
      B.add(MT.winch, boxAB(V(xTen + 0.05, yRope, zT), V(xTen + 0.7, yRope, zT), 0.08, 0.08));       // натяжной винт (условно)
      B.add(mat.yellow, box(0.12, 0.25, 0.7, xTen + 0.72, ySl + 0.2, zT));
      flush(B, g, o);
      // прежнее условное изображение (v0.10) — слой сравнения
      const go = new THREE.Group(); go.name = '901: прежнее условное изображение (до v0.21)';
      boxPx(go, 2213, 3546, 2264, 3607, 0.8, mat.yellow, hAt(...P(2238.5, 3576.5)) - 0.05);
      g.add(go); old.push(go);
    }
    /* путь № 53: участок восточнее упора — основной; западнее — слой сравнения */
    function tracks53() {
      const pxStop = 3400 + (xStop - 1.0) * 15.75;                    // рельсы заканчиваются ≈1 м за упором
      track(TRACK_Y, pxStop, 2785, RAIL53);
      for (const tg of [track(TRACK_Y, 1700, pxStop, RAIL53), track(TRACK_Y, -2500, 1700, RAIL53)]) { tg.name += ' — западнее упора (прежний вариант)'; t53w.push(tg); }
    }
    return { build, tracks53, old, t53w, center: () => center, anchorXZ: [xw, zT], xStop, xTen, ROLL, zT };
  })();
  /* ---------------- 196 ---------------- */
  const S196 = (() => {
    const old = [];
    const [ix0, iz0] = P(3659, 3390), [ix1, iz1] = P(3854, 3507);   // внутренний контур ГП-003 (12,4 × 7,4)
    const xc = (ix0 + ix1) / 2, zc = (iz0 + iz1) / 2, LX = 13.4, LZ = 7.85;   // площадка 13,4 × 7,85 (196-ТХ-001)
    const [rx0, rz0] = P(3594, 3374), [rx1, rz1] = P(3908, 3551);   // рампа (наружный контур ГП-003)
    const Y = hAt(22.285714285714285, 29.329016136437712);           // как в v0.20: посадка группы по центру прежнего габарита (рампа)
    function build(g0, o) {
      const g = new THREE.Group(); g.position.y = Y; g0.add(g);
      // прежнее здание (FAC v0.10) строится в отдельную группу; рампа из неё переносится в основную
      const go = new THREE.Group(); go.name = '196: прежнее закрытое здание (до v0.21)';
      FAC.B['196'](go);
      for (const ch of go.children.slice(0, 2)) g.add(ch);
      g.add(go); old.push(go);
      const B = Bk(), yR = 1.1, x0 = xc - LX / 2, x1 = xc + LX / 2, z0 = zc - LZ / 2, z1 = zc + LZ / 2;
      // навес: колонны по периметру площадки (шаг ≈6,7 × 7,85 м), односкатная кровля — условно (лист плана пуст)
      const COL = []; for (const x of [x0, xc, x1]) for (const z of [z0, z1]) COL.push([x, z]);
      const hN = 4.6, hS = 4.1;                                       // скат на юг, к пути
      const hAtZ = z => yR + hN + (hS - hN) * (z - z0) / (z1 - z0);
      for (const [x, z] of COL) {
        B.add(mat.steelD, box(0.2, hAtZ(z) - yR, 0.2, x, (hAtZ(z) + yR) / 2, z));
        B.add(mat.dark, box(0.4, 0.03, 0.4, x, yR + 0.015, z));
      }
      for (const x of [x0, xc, x1]) B.add(mat.steelD, boxAB(V(x, hAtZ(z0 - 0.4) + 0.12, z0 - 0.4), V(x, hAtZ(z1 + 0.4) + 0.12, z1 + 0.4), 0.16, 0.3));
      for (const z of [z0, z1]) B.add(mat.steelD, box(LX + 0.3, 0.22, 0.14, xc, hAtZ(z) - 0.11, z));
      for (let k = 0; k <= 6; k++) { const z = z0 - 0.3 + (LZ + 0.6) * k / 6; B.add(mat.steel, box(LX + 0.6, 0.1, 0.07, xc, hAtZ(z) + 0.32, z)); }
      const rf = new THREE.BoxGeometry(LX + 0.9, 0.05, Math.hypot(LZ + 1.2, hS - hN));
      rf.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.atan2(hN - hS, LZ + 1.2)));   // скат на юг (+z ниже)
      rf.translate(xc, (hAtZ(z0) + hAtZ(z1)) / 2 + 0.4, zc); B.add(MT.roofS, rf);
      // сетчатое ограждение 2-50-3,0 по периметру площадки, высота 2,0 м — условно; проёмы: ворота к пути, выход на пандус
      const hF = 2.0, GATE = [{ side: 'S', a: xc - 1.6, b: xc + 1.6 }, { side: 'E', a: zc - 1.4, b: zc + 1.4 }];
      const fenceRun = (pA, pB) => {
        B.add(MT.mesh, boxAB(V(pA[0], yR + 0.1 + hF / 2, pA[1]), V(pB[0], yR + 0.1 + hF / 2, pB[1]), 0.01, hF));
        for (const h of [0.1, hF + 0.1]) B.add(mat.steelD, boxAB(V(pA[0], yR + h, pA[1]), V(pB[0], yR + h, pB[1]), 0.04, 0.04));
        const L = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]), n = Math.max(1, Math.ceil(L / 2.5));
        for (let i = 0; i <= n; i++) { const t = i / n, x = pA[0] + (pB[0] - pA[0]) * t, z = pA[1] + (pB[1] - pA[1]) * t; B.add(mat.steelD, box(0.05, hF + 0.1, 0.05, x, yR + (hF + 0.1) / 2, z)); }
      };
      const fz0 = z0 + 0.1, fz1 = z1 - 0.1, fx0 = x0 + 0.1, fx1 = x1 - 0.1;
      fenceRun([fx0, fz0], [fx1, fz0]); fenceRun([fx0, fz0], [fx0, fz1]);
      fenceRun([fx0, fz1], [GATE[0].a, fz1]); fenceRun([GATE[0].b, fz1], [fx1, fz1]);
      fenceRun([fx1, fz0], [fx1, GATE[1].a]); fenceRun([fx1, GATE[1].b], [fx1, fz1]);
      // бочки 200 л (184 шт.) на поддонах 1,2 × 1,2 м: 23 штабеля × 2 яруса × 4 бочки — раскладка условная
      const ST = []; const px = k => x0 + 1.0 + k * 1.3;
      for (let k = 0; k < 9; k++) { ST.push([px(k), z0 + 0.95]); ST.push([px(k), z0 + 2.25]); }
      for (const k of [0, 1, 2, 7, 8]) ST.push([px(k), z1 - 1.05]);   // проход к воротам у пути — свободен
      const prof = [[0, 0], [0.292, 0], [0.284, 0.02], [0.284, 0.27], [0.297, 0.285], [0.284, 0.3], [0.284, 0.58], [0.297, 0.595], [0.284, 0.61], [0.284, 0.86], [0.292, 0.88], [0, 0.88]].map(([r, y]) => new THREE.Vector2(r, y));
      const drumG = new THREE.LatheGeometry(prof, 14), palG = (() => {
        const L = []; for (const dz of [-0.55, 0, 0.55]) L.push(box(1.2, 0.1, 0.12, 0, 0.05, dz));
        for (const dx of [-0.53, -0.18, 0.18, 0.53]) L.push(box(0.14, 0.03, 1.2, dx, 0.115, 0)); return trkMerge(L);
      })();
      const nP = ST.length * 2, imP = new THREE.InstancedMesh(palG, MT.pallet, nP), imD = new THREE.InstancedMesh(drumG, MT.drum, nP * 4), m4 = new THREE.Matrix4();
      let ip = 0, id = 0;
      for (const [x, z] of ST) for (let t = 0; t < 2; t++) {
        const yb = yR + t * 1.02;
        m4.makeTranslation(x, yb, z); imP.setMatrixAt(ip++, m4);
        for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { m4.makeTranslation(x + dx, yb + 0.13, z + dz); imD.setMatrixAt(id++, m4); }
      }
      for (const im of [imP, imD]) { im.castShadow = im.receiveShadow = true; im.userData.o = o; g.add(im); }
      // пандус для погрузчика (восточный торец рампы) и лестница для персонала (западный торец) — сторона по тексту ТХ не указана
      { const L = 6.6, W = 3.0, z = zc, x = rx1, sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), new THREE.Vector2(0, yR)]);
        const pg = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false }); pg.translate(0, -0.25, -W / 2); pg.translate(x, 0.25, z); B.add(mat.concD, pg);
        for (const s of [-1, 1]) B.add(mat.yellow, boxAB(V(x, yR + 0.06, z + s * (W / 2 - 0.05)), V(x + L, 0.06, z + s * (W / 2 - 0.05)), 0.1, 0.12)); }
      { const x = rx0, z = zc + 2.0, n = 6, d = 0.28, w = 1.2;
        for (let i = 0; i < n; i++) B.add(mat.concD, box(d, yR - i * (yR / n), w, x - (i + 0.5) * d, (yR - i * (yR / n)) / 2, z));
        for (const s of [-1, 1]) { B.add(mat.steelD, boxAB(V(x, yR + 0.9, z + s * w / 2), V(x - n * d, 0.9 + yR / n, z + s * w / 2), 0.04, 0.04));
          B.add(mat.steelD, box(0.04, 0.9, 0.04, x - n * d + 0.1, 0.45 + yR / n, z + s * w / 2)); } }
      // погрузчик Linde H14D (тип — по спецификации; модель условная), пожарный щит
      { const fx = x1 + 1.7, fz = z0 + 1.6, y = yR, L = [];
        L.push([mat.dark, box(1.15, 0.5, 0.95, fx + 0.2, y + 0.55, fz)], [MT.fork, box(1.2, 0.42, 1.0, fx + 0.2, y + 0.98, fz)], [MT.fork, box(0.5, 0.75, 1.0, fx + 0.85, y + 0.75, fz)]);
        for (const s of [-1, 1]) {
          L.push([mat.dark, box(0.08, 2.15, 0.1, fx - 0.55, y + 1.2, fz + s * 0.32)]);
          L.push([mat.dark, box(0.06, 1.25, 0.06, fx + 0.6, y + 1.83, fz + s * 0.45)], [mat.dark, box(0.06, 1.25, 0.06, fx - 0.25, y + 1.83, fz + s * 0.45)]);
          L.push([mat.steelD, box(1.0, 0.045, 0.1, fx - 1.1, y + 0.1, fz + s * 0.2)], [mat.steelD, box(0.05, 0.5, 0.1, fx - 0.62, y + 0.35, fz + s * 0.2)]);
          for (const [wx, r] of [[fx - 0.3, 0.27], [fx + 0.7, 0.22]]) L.push([MT.tyre, new THREE.CylinderGeometry(r, r, 0.2, 16).rotateX(Math.PI / 2).translate(wx, y + r, fz + s * 0.45)]);
        }
        L.push([mat.dark, box(0.95, 0.05, 1.0, fx + 0.18, y + 2.47, fz)], [mat.dark, box(0.4, 0.45, 0.42, fx + 0.35, y + 1.42, fz)]);
        for (const [m, gg] of L) B.add(m, gg); }
      { const x = x0 + 0.6, z = z1 + 0.6; B.add(mat.red, box(1.0, 1.4, 0.06, x, yR + 1.0, z)); B.add(mat.dark, box(0.06, 1.7, 0.06, x - 0.45, yR + 0.85, z + 0.05)); B.add(mat.dark, box(0.06, 1.7, 0.06, x + 0.45, yR + 0.85, z + 0.05));
        B.add(mat.yellow, box(0.6, 0.45, 0.5, x + 1.0, yR + 0.23, z)); }
      flush(B, g, o);
    }
    return { build, old, Y, anchorXZ: [22.285714285714285, 29.329016136437712], rect: { x0: xc - LX / 2, x1: xc + LX / 2, z0: zc - LZ / 2, z1: zc + LZ / 2 }, ramp: { x0: rx0, x1: rx1, z0: rz0, z1: rz1 } };
  })();
  return { W901, S196 };
})();
const W901 = DX3.W901, S196 = DX3.S196;
W901.tracks53();   // v0.21: путь № 53 — до тупикового упора (901-ТХ-002); западнее — слой сравнения

