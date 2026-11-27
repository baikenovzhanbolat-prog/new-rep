/* ---------- Объекты по экспликации ---------- */
const NETS_MASTS = [[59.62, 28.06], [36.13, -8.7], [-80.83, 36.63], [10.16, 7.3], [-35.49, -13.33]], NETS_POLES = [[1.59, 39.05], [83.81, 7.94], [80.63, -35.87], [83.81, -17.21], [41.84, -38.41], [-53.46, -24.44], [-74.67, -14.16], [26.73, 38.54], [83.81, 33.08], [77.02, 38.54], [51.87, 38.54], [-83.49, 38.6], [-41.21, 39.05], [-62.35, 38.6], [-86.22, 17.84], [-87.81, 3.94], [18.67, -38.41], [-29.78, -32.95], [-6.48, -38.41]];
/* ---------- Этап v0.10: фасады зданий (УСЛОВНО — чертежей АР и фото в комплекте нет) ----------
   Контур и высота — как раньше (ГП-002/ГП-003, высоты условные). Добавлены: цоколь, парапет с отливом, кровля,
   окна с рамами и отливами, двери/ворота, козырьки и светильники у входов, водосточные трубы — типовые решения. */
class GeoBucket {
  constructor() { this.b = new Map(); }
  put(m, geo, m4) { if (!this.b.has(m)) this.b.set(m, []); this.b.get(m).push([geo, m4.clone()]); }
  build(parent) {
    for (const [m, l] of this.b) {
      let n = 0; const parts = l.map(([g, mm]) => { const q = g.index ? g.toNonIndexed() : g.clone(); q.applyMatrix4(mm); n += q.attributes.position.count; return q; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
      for (const q of parts) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; q.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.computeBoundingSphere();
      const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; parent.add(me);
    }
  }
}
const FAC = (() => {
  const F = MATX.F, gB = new THREE.BoxGeometry(1, 1, 1), gC = new THREE.CylinderGeometry(1, 1, 1, 14), gT = new THREE.TorusGeometry(1, 0.35, 8, 12, Math.PI / 2);
  const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  /* в системе стены: s — вдоль стены, n — наружу, y — вверх */
  function W(e) {   // e: {a:[x,z], b:[x,z], n:[nx,nz], L}
    const dx = (e.b[0] - e.a[0]) / e.L, dz = (e.b[1] - e.a[1]) / e.L, ry = -Math.atan2(dz, dx);
    return (bk, m, s, y, n, ls, ly, ln, geo = gB) => bk.put(m, geo, new THREE.Matrix4().compose(
      _p.set(e.a[0] + dx * s + e.n[0] * n, y, e.a[1] + dz * s + e.n[1] * n), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(ls, ly, ln)));
  }
  function edges(poly) {   // мировые точки → рёбра с внешней нормалью
    let A = 0; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; A += x1 * z2 - x2 * z1; }
    const sg = A > 0 ? 1 : -1;
    return poly.map((a, i) => { const b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; return { a, b, L, n: [sg * dz, -sg * dx] }; });
  }
  /* окна, двери, ворота, решётки */
  function opening(bk, e, o, y0) {
    const w = W(e), t = o.t, y = y0 + (o.y || 0), h = o.h, wd = o.w;
    if (o.k === 'win') {
      w(bk, F.glass, t, y + h / 2, 0.012, wd - 0.08, h - 0.08, 0.02);
      for (const [s, yy, ls, ly] of [[t, y + 0.03, wd, 0.06], [t, y + h - 0.03, wd, 0.06], [t - wd / 2 + 0.03, y + h / 2, 0.06, h], [t + wd / 2 - 0.03, y + h / 2, 0.06, h]]) w(bk, F.frame, s, yy, 0.035, ls, ly, 0.07);
      if (wd > 1.1) w(bk, F.frame, t, y + h / 2, 0.035, 0.05, h, 0.06);                         // импост
      w(bk, F.frame, t, y + h * 0.72, 0.035, wd, 0.045, 0.06);                                    // фрамуга
      w(bk, F.coping, t, y - 0.02, 0.08, wd + 0.1, 0.03, 0.16);                                   // отлив
    } else if (o.k === 'door' || o.k === 'door2') {
      const m = o.m || F.door;
      w(bk, F.dark, t, y + h / 2 + 0.03, 0.02, wd + 0.12, h + 0.06, 0.05);                        // коробка
      w(bk, m, t, y + h / 2, 0.04, wd, h, 0.04);
      if (o.k === 'door2') w(bk, F.dark, t, y + h / 2, 0.062, 0.012, h - 0.04, 0.006);            // притвор
      for (const s of o.k === 'door2' ? [t - 0.1, t + 0.1] : [t + wd / 2 - 0.12]) w(bk, F.pipe, s, y + 1.0, 0.075, 0.025, 0.18, 0.04);   // ручки
      w(bk, F.dark, t, y + 0.05, 0.25, wd + 0.5, 0.1, 0.5);                                         // площадка у входа
    } else if (o.k === 'gate') {
      w(bk, F.dark, t, y + h / 2 + 0.05, 0.02, wd + 0.2, h + 0.1, 0.06);
      w(bk, F.gate, t, y + h / 2, 0.045, wd, h, 0.03);
      for (const s of [t - wd / 2 - 0.06, t + wd / 2 + 0.06]) w(bk, F.coping, s, y + h / 2, 0.08, 0.08, h, 0.08);   // отбойники
      w(bk, F.dark, t, y + 0.02, 0.6, wd + 0.4, 0.04, 1.2);                                         // пандус/площадка
    } else if (o.k === 'louvre') {
      w(bk, F.dark, t, y + h / 2, 0.02, wd + 0.06, h + 0.06, 0.04);
      for (let i = 0; i < Math.round(h / 0.08); i++) w(bk, F.louvre, t, y + 0.06 + i * 0.08, 0.05, wd - 0.04, 0.012, 0.07);
    }
    if (o.canopy) {   // козырёк над входом
      const cw = wd + 0.8, cy = y + h + 0.3;
      w(bk, F.coping, t, cy, 0.55, cw, 0.08, 1.1);
        for (const s of [t - cw / 2 + 0.15, t + cw / 2 - 0.15]) w(bk, F.dark, s, cy - 0.12, 0.3, 0.03, 0.18, 0.6);   // консоли
    }
    if (o.lamp) w(bk, F.lamp, t, y + h + (o.canopy ? 0.65 : 0.25), 0.1, 0.32, 0.12, 0.14);
  }
  /* ряд окон по стене с пропуском занятых мест */
  function row(eIdx, y, h, w, step, margin, L, busy = []) {
    const out = [], n = Math.max(1, Math.floor((L - 2 * margin + step - w) / step)), used = (n - 1) * step, s0 = (L - used) / 2;
    for (let i = 0; i < n; i++) { const t = s0 + i * step; if (busy.some(([b0, b1]) => t + w / 2 > b0 - 0.3 && t - w / 2 < b1 + 0.3)) continue; out.push({ e: eIdx, k: 'win', t, y, h, w }); }
    return out;
  }
  /* здание: контур в пикселях скана, высота, отметка низа, спецификация */
  function building2(g, pts, h, sp) {
    const poly = pts.map(p => P(...p)), E = edges(poly), y0 = sp.y0 || 0, bk = new GeoBucket();
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const ext = (depth, y, m) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); bk.put(m, geo, new THREE.Matrix4()); };
    ext(h, y0, sp.wall);                                                    // стены
    ext(1.2, y0 - 1.2, mat.concD);                                          // фундамент/отмостка — на уклоне не «висит»
    ext(0.28, y0 + h - 0.28 + 0.001, sp.roof || mat.roof);                  // кровля (внутри парапета)
    const par = sp.parapet === undefined ? 0.55 : sp.parapet, pl = sp.plinth === undefined ? 0.45 : sp.plinth;
    for (const e of E) {
      const w = W(e);
      if (pl > 0) w(bk, F.plinth, e.L / 2, y0 + pl / 2 - 0.1, 0.025, e.L + 0.05, pl + 0.2, 0.05);                       // цоколь
      if (par > 0) { w(bk, sp.wall, e.L / 2, y0 + h + par / 2, -0.12, e.L, par, 0.24); w(bk, F.coping, e.L / 2, y0 + h + par + 0.02, -0.12, e.L + 0.1, 0.04, 0.36); }   // парапет, отлив
      else w(bk, F.coping, e.L / 2, y0 + h + 0.02, 0.0, e.L + 0.1, 0.05, 0.12);
    }
    // проёмы
    for (const o of sp.open || []) opening(bk, E[o.e], o, y0);
    // водосточные трубы — у выпуклых углов по списку
    for (const c of sp.drains || []) {
      const e = E[c], p = e.a, prev = E[(c - 1 + E.length) % E.length], nx = e.n[0] + prev.n[0], nz = e.n[1] + prev.n[1], k = 0.16 / Math.hypot(nx, nz);
      const x = p[0] + nx * k, z = p[1] + nz * k, top = y0 + h + par - 0.1;
      bk.put(F.pipe, gC, new THREE.Matrix4().compose(_p.set(x, (y0 + 0.35 + top) / 2, z), _q.identity(), _s.set(0.055, top - y0 - 0.35, 0.055)));
      bk.put(F.pipe, gB, new THREE.Matrix4().compose(_p.set(x, top + 0.08, z), _q.identity(), _s.set(0.2, 0.18, 0.2)));            // воронка
      bk.put(F.pipe, gC, new THREE.Matrix4().compose(_p.set(x + nx * k * 1.2, y0 + 0.25, z + nz * k * 1.2), _q.setFromAxisAngle(new THREE.Vector3(nz, 0, -nx).normalize(), Math.PI / 4), _s.set(0.055, 0.32, 0.055)));   // отмёт
      for (let yy = y0 + 1.2; yy < top - 0.3; yy += 1.6) bk.put(F.dark, gB, new THREE.Matrix4().compose(_p.set(x, yy, z), _q.identity(), _s.set(0.13, 0.03, 0.13)));
    }
    bk.build(g);
    return { E, poly };
  }
  const rectPts = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];   // рёбра: 0 — верх листа (Ю→В), 1 — правое, 2 — низ листа, 3 — левое
  const lenOf = (pts, i) => { const a = P(...pts[i]), b = P(...pts[(i + 1) % pts.length]); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  /* набор зданий (условно) */
  const B = {
    '401': g => {   // служебно-бытовой: 2 этажа, штукатурка; главный вход — со стороны площадки
      const pts = rectPts([4117, 2366, 4606, 2528]), L0 = lenOf(pts, 0), L1 = lenOf(pts, 1), mid = L0 / 2;
      const open = [{ e: 2, k: 'door2', t: mid, w: 1.8, h: 2.4, canopy: 1, lamp: 1, m: F.doorB }, { e: 2, k: 'door', t: 4.5, w: 1.0, h: 2.2, canopy: 1, lamp: 1 }];
      for (const y of [0.95, 4.25]) open.push(...row(2, y, 1.45, 1.5, 3.0, 1.4, L0, y < 2 ? [[mid - 1.2, mid + 1.2], [3.8, 5.2]] : []), ...row(0, y, 1.45, 1.5, 3.0, 1.4, L0), ...row(1, y, 1.45, 1.5, 3.2, 2.0, L1), ...row(3, y, 1.45, 1.5, 3.2, 2.0, L1));
      return building2(g, pts, 7, { wall: MATX.F.plaster, open, drains: [0, 1, 2, 3] });
    },
    '501': g => {   // котельная: сэндвич-панели, окна-ЛСК, двустворчатая дверь, жалюзийная решётка; газоход к дымовой трубе
      const pts = rectPts([4379, 2664, 4541, 2772]), L0 = lenOf(pts, 0), L1 = lenOf(pts, 1);
      const open = [{ e: 2, k: 'door2', t: L0 - 2.0, w: 1.6, h: 2.3, canopy: 1, lamp: 1 }, { e: 2, k: 'louvre', t: L0 - 4.4, y: 0.5, w: 0.9, h: 0.8 }];
      open.push(...row(2, 2.5, 1.3, 1.8, 3.0, 1.2, L0, [[L0 - 5.0, L0 - 1.0], [5.6, 7.2]]), ...row(0, 2.5, 1.3, 1.8, 3.0, 1.2, L0), ...row(1, 2.5, 1.3, 1.8, 3.0, 1.2, L1), ...row(3, 2.5, 1.3, 1.8, 3.0, 1.2, L1));
      return building2(g, pts, 5, { wall: MATX.F.panelW, open, drains: [0, 2] });
    },
    '644': g => {   // насосная пожаротушения: Г-образная, сэндвич-панели, ворота для техники, кровля — красная (как раньше)
      const pts = [[4356, 3261], [4610, 3261], [4610, 3452], [4412, 3452], [4412, 3350], [4356, 3350]], L0 = lenOf(pts, 0), L1 = lenOf(pts, 1), L2 = lenOf(pts, 2);
      const open = [{ e: 2, k: 'gate', t: 4.0, w: 3.0, h: 3.0, lamp: 1 }, { e: 5, k: 'door', t: 2.8, w: 1.0, h: 2.2, canopy: 1, lamp: 1 }];
      open.push(...row(0, 2.2, 1.2, 1.5, 3.2, 1.2, L0), ...row(1, 2.2, 1.2, 1.5, 3.2, 1.2, L1), ...row(2, 2.2, 1.2, 1.5, 3.2, 1.2, L2, [[2.3, 5.7]]));
      return building2(g, pts, 5, { wall: MATX.F.panelW, roof: mat.red, open, drains: [0, 1, 2, 5] });
    },
    '196': g => {   // склад тары: на рампе 1,1 м (ГП-003); ворота — на рампу со стороны пути, ленточные окна
      boxPx(g, 3594, 3374, 3908, 3551, 1.1, mat.concD);
      const [ra, rb] = P(3594, 3551), [rc] = P(3908, 3551);
      add(g, new THREE.BoxGeometry(rc - ra, 0.12, 0.012), MATX.F.dark, (ra + rc) / 2, 1.04, rb + 0.006);   // окантовка рампы уголком (условно)
      const pts = rectPts([3659, 3390, 3854, 3507]), L0 = lenOf(pts, 0), L1 = lenOf(pts, 1);
      const open = [{ e: 2, k: 'gate', t: 3.3, w: 3.0, h: 3.2, lamp: 1 }, { e: 2, k: 'gate', t: L0 - 3.3, w: 3.0, h: 3.2, lamp: 1 }, { e: 0, k: 'door', t: 2.2, w: 1.0, h: 2.2, canopy: 1, lamp: 1 }];
      open.push(...row(0, 3.7, 0.9, 2.4, 4.0, 1.5, L0, [[1.2, 3.2]]), ...row(1, 3.7, 0.9, 2.4, 4.0, 1.2, L1), ...row(3, 3.7, 0.9, 2.4, 4.0, 1.2, L1));
      return building2(g, pts, 6, { wall: MATX.F.panelW, y0: 1.1, open, drains: [0, 1, 2, 3] });
    },
    '446': g => {   // гараж: двое ворот в сторону проезда, дверь, окна
      const pts = rectPts([2072, 2992, 2233, 3168]), L0 = lenOf(pts, 0), L1 = lenOf(pts, 1);
      const open = [{ e: 1, k: 'gate', t: 3.0, w: 3.0, h: 3.0, lamp: 1 }, { e: 1, k: 'gate', t: L1 - 3.0, w: 3.0, h: 3.0, lamp: 1 }, { e: 2, k: 'door', t: 2.2, w: 1.0, h: 2.2, canopy: 1, lamp: 1 }];
      open.push(...row(0, 2.3, 1.0, 1.5, 3.2, 1.5, L0), ...row(3, 2.3, 1.0, 1.5, 3.2, 1.5, L1), ...row(2, 2.3, 1.0, 1.5, 3.2, 1.5, L0, [[1.2, 3.2]]));
      return building2(g, pts, 5, { wall: MATX.F.panelB, open, drains: [0, 2] });
    }
  };
  /* насосный цех 200: цоколь, отлив парапета, водостоки — по контуру ГП-003/АК-041 (стены строит ph200) */
  function ph200dress(g, outer, top) {
    const bk = new GeoBucket(), E = edges(outer);
    for (const e of E) { const w = W(e); w(bk, F.plinth, e.L / 2, PH_F0 + 0.18, 0.12, e.L + 0.25, 0.56, 0.05); w(bk, F.coping, e.L / 2, top + 0.33, 0.0, e.L + 0.3, 0.05, 0.3); }
    for (const c of [0, 2, 3]) { const e = E[c], prev = E[(c - 1 + E.length) % E.length], nx = e.n[0] + prev.n[0], nz = e.n[1] + prev.n[1], k = 0.27 / Math.hypot(nx, nz), x = e.a[0] + nx * k, z = e.a[1] + nz * k;
      bk.put(F.pipe, gC, new THREE.Matrix4().compose(_p.set(x, (PH_F0 + 0.3 + top + 0.2) / 2, z), _q.identity(), _s.set(0.055, top + 0.2 - PH_F0 - 0.3, 0.055))); }
    bk.build(g);
  }
  /* навесы ТРК и налива: светильники под навесом (условно) */
  function canopyLights(g, r, h, n = 2) {
    const [a, b] = P(r[0], r[1]), [c, d] = P(r[2], r[3]), bk = new GeoBucket();
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) bk.put(F.lamp, gB, new THREE.Matrix4().compose(_p.set(a + (c - a) * (i + 0.5) / n, h - 0.03, b + (d - b) * (j + 0.5) / 2), _q.identity(), _s.set(0.6, 0.06, 0.3)));
    bk.build(g);
  }
  return { B, building2, ph200dress, canopyLights, edges };
})();

