/* =====================================================================================
   v0.22 — ЭСТАКАДА 177: общий конструктор геометрии (GK) и детальная модель вагона-цистерны (TCAR)
   GK — сборка деталей в одну геометрию с цветами вершин: узел = один вызов отрисовки.
   TCAR — типовой 4-осный вагон-цистерна для светлых нефтепродуктов. Модель вагона в документации не указана
   (реестр, п. 9): размеры — типовые (APPROXIMATE). Сохранены прежние привязки: ось котла RH + 2,55 (Ø 3,0 м),
   центры тележек ±3,875 м, база тележки 1,85 м (как у тормозных башмаков), низ сливного прибора ≈ RH + 0,62.
   ===================================================================================== */
const GK = (() => {
  const UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
  function builder() {
    const parts = [];
    const api = {
      parts,
      add(geo, col, mtx) { if (mtx) geo.applyMatrix4(mtx); parts.push([geo, col]); return geo; },
      box(sx, sy, sz, x, y, z, col) { return api.add(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), col); },
      cyl(a, b, r, col, seg = 14, r2) {
        const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r2 !== undefined ? r2 : r, r, Math.max(L, 1e-3), seg);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return api.add(g, col);
      },
      bar(a, b, w, h, col) {   // брус от a до b: w — поперёк по горизонтали, h — по вертикали
        const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
        const x = new THREE.Vector3().crossVectors(UP, d); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
        const y = new THREE.Vector3().crossVectors(d, x), g = new THREE.BoxGeometry(w, h, L);
        g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, d)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return api.add(g, col);
      },
      ring(c, axis, R, r, col, seg = 20) {   // тор (фланец, бандаж, маховик) с нормалью по axis
        const g = new THREE.TorusGeometry(R, r, 6, seg); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize())); g.translate(c.x, c.y, c.z); return api.add(g, col);
      },
      geometry() { return merge(parts); },
      mesh(mat) { const m = new THREE.Mesh(merge(parts), mat); m.castShadow = m.receiveShadow = true; return m; }
    };
    return api;
  }
  function merge(parts) {
    let nv = 0, ni = 0;
    for (const [g] of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const [g, c] of parts) {
      const n = g.attributes.position.count; pos.set(g.attributes.position.array, ov * 3);
      if (!g.attributes.normal) g.computeVertexNormals(); nor.set(g.attributes.normal.array, ov * 3);
      if (typeof c === 'function') { for (let k = 0; k < n; k++) { _c.set(c(g.attributes.position.getX(k), g.attributes.position.getY(k), g.attributes.position.getZ(k))); col[(ov + k) * 3] = _c.r; col[(ov + k) * 3 + 1] = _c.g; col[(ov + k) * 3 + 2] = _c.b; } }
      else { _c.set(c); for (let k = 0; k < n; k++) { col[(ov + k) * 3] = _c.r; col[(ov + k) * 3 + 1] = _c.g; col[(ov + k) * 3 + 2] = _c.b; } }
      if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[oi + k] = a[k] + ov; oi += a.length; }
      else { for (let k = 0; k < n; k++) idx[oi + k] = ov + k; oi += n; }
      ov += n; g.dispose();
    }
    const r = new THREE.BufferGeometry();
    r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('color', new THREE.BufferAttribute(col, 3));
    r.setIndex(new THREE.BufferAttribute(idx, 1)); r.computeBoundingSphere(); return r;
  }
  const MAT = {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.55 }),   // окрашенный металл
    steel: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.32 }),   // колёса, оси, шарниры, алюминий
    dirty: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.7 })    // котёл, тележки: следы эксплуатации
  };
  return { builder, merge, MAT, V: (x, y, z) => new THREE.Vector3(x, y, z) };
})();

const TCAR = (() => {
  const V = GK.V, Z = V(0, 0, 1), X = V(1, 0, 0), Yv = V(0, 1, 0);
  const C = { tank: 0x26282a, frame: 0x232527, bogie: 0x2b2a28, rust: 0x5a3f2c, steel: 0x9aa0a5, wheel: 0x6e6f70, yel: 0xd9a92b, white: 0xe9e9e4, red: 0xa8302a, hose: 0x151617 };
  const R = 1.5, AX = 2.55, LC = 10.0, HB = 3.875, HW = 0.925, RW = 0.4785, GC = 0.7975;   // котёл, тележки, колёса
  const D = { R, AX, LC, HB, HW, RW, base: 2 * HB, bogieBase: 2 * HW, couplerY: 1.06, drainY: 0.62, hatchTop: 4.52, platformY: 4.1 };
  // следы эксплуатации на котле: пыль сверху, потёки ниже горловины, темнее к низу (только цвета вершин)
  const tankCol = (x, y, z) => {
    const h = (y - (AX - R)) / (2 * R), streak = Math.exp(-(((Math.abs(x) * 3.1) % 1.7 - 0.85) ** 2) * 40) * 0.25 * Math.max(0, h - 0.35) * (Math.abs(x) < 2.2 ? 1 : 0.35);
    const base = new THREE.Color(C.tank).multiplyScalar(0.82 + 0.3 * h), dust = new THREE.Color(0x6f675c);
    return base.lerp(dust, Math.max(0, h - 0.82) * 1.6 + streak).getHex();
  };
  const bogieCol = (x, y) => new THREE.Color(C.bogie).lerp(new THREE.Color(C.rust), Math.max(0, 0.55 - y) * 0.9).getHex();
  function wheelset(B, S, x) {   // колёсная пара Ø957: обод с гребнем, диск, ступица; ось и буксы
    for (const s of [-1, 1]) {
      const zc = s * GC;
      S.cyl(V(x, RW, zc - 0.065), V(x, RW, zc + 0.065), RW, C.wheel, 28);
      S.cyl(V(x, RW, zc - s * 0.065), V(x, RW, zc - s * 0.095), RW + 0.03, C.wheel, 28);
      S.cyl(V(x, RW, zc - 0.03), V(x, RW, zc + 0.03), 0.38, C.steel, 22);
      S.cyl(V(x, RW, s * 0.55), V(x, RW, s * 0.68), 0.12, C.wheel, 16);
      B.box(0.3, 0.27, 0.22, x, RW, s * 1.03, C.bogie);                       // букса
      B.box(0.36, 0.05, 0.26, x, RW + 0.16, s * 1.03, C.bogie);
    }
    S.cyl(V(x, RW, -0.98), V(x, RW, 0.98), 0.085, C.steel, 14);
  }
  function bogie(B, S, F, xc) {   // тележка модели 18-100 (типовая): литые боковые рамы, надрессорная балка, рессорные комплекты, тормозная рычажная передача
    for (const dx of [-HW, HW]) wheelset(B, S, xc + dx);
    const sh = new THREE.Shape([[-1.22, 0.58], [-0.95, 0.44], [-0.55, 0.2], [0.55, 0.2], [0.95, 0.44], [1.22, 0.58], [1.15, 0.7], [0.5, 0.72], [-0.5, 0.72], [-1.15, 0.7]].map(([a, b]) => new THREE.Vector2(a, b)));
    sh.holes.push(new THREE.Path([[-0.36, 0.31], [0.36, 0.31], [0.36, 0.62], [-0.36, 0.62]].map(([a, b]) => new THREE.Vector2(a, b))));
    for (const s of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: false }); g.translate(xc, 0, s * 1.03 - 0.075);
      B.add(g, (x, y) => bogieCol(x, y));
      for (const dx of [-0.24, 0, 0.24]) for (const dz of [-0.05, 0.05]) F.cyl(V(xc + dx, 0.33, s * 1.03 + dz), V(xc + dx, 0.55, s * 1.03 + dz), 0.045, C.rust, 8);   // пружины
      F.box(0.1, 0.06, 0.24, xc + 0.62, 0.36, s * 0.79, C.bogie); F.box(0.1, 0.06, 0.24, xc - 0.62, 0.36, s * 0.79, C.bogie);   // колодки
    }
    B.box(0.34, 0.27, 2.08, xc, 0.66, 0, C.bogie);                                       // надрессорная балка
    B.cyl(V(xc, 0.79, 0), V(xc, 0.84, 0), 0.17, C.bogie, 18);                           // подпятник
    for (const s of [-1, 1]) { F.cyl(V(xc + s * 0.62, 0.36, -0.9), V(xc + s * 0.62, 0.36, 0.9), 0.04, C.bogie, 8); F.bar(V(xc + s * 0.62, 0.36, 0), V(xc, 0.55, 0), 0.06, 0.05, C.bogie); }   // триангели, тяги
    F.box(0.42, 0.06, 0.16, xc, 0.84, 0.82, C.bogie); F.box(0.42, 0.06, 0.16, xc, 0.84, -0.82, C.bogie);   // скользуны
  }
  function car(B, S, F) {   // B — котёл и рама, S — колёсные пары, F — мелкие детали (LOD: скрываются издали)
    // котёл с эллиптическими днищами
    const shell = new THREE.CylinderGeometry(R, R, LC, 72, 6, true); shell.rotateZ(Math.PI / 2); shell.translate(0, AX, 0); B.add(shell, tankCol);
    for (const s of [-1, 1]) {
      const cap = new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.38, 1); cap.rotateZ(-s * Math.PI / 2); cap.translate(s * LC / 2, AX, 0); B.add(cap, tankCol);
      F.ring(V(s * (LC / 2 - 0.02), AX, 0), X, R + 0.004, 0.012, C.tank, 64);                       // сварной шов днища
    }
    for (const x of [-2.7, 2.7]) F.ring(V(x, AX, 0), X, R + 0.008, 0.012, C.tank, 64);              // кольцевые швы
    for (const x of [-HB + 0.7, HB - 0.7]) { B.ring(V(x, AX, 0), X, R + 0.02, 0.025, C.frame, 64); B.box(0.5, 0.32, 2.2, x, AX - R + 0.05, 0, C.frame); }   // хомуты и лежни
    // рама: хребтовая балка, шкворневые и концевые балки, площадки с подножками
    B.box(10.9, 0.36, 0.34, 0, 1.0, 0, C.frame);
    for (const s of [-1, 1]) {
      B.box(0.38, 0.34, 2.7, s * HB, 1.0, 0, C.frame);
      B.box(0.28, 0.42, 2.9, s * 5.45, 1.02, 0, C.frame);
      B.box(0.9, 0.06, 2.9, s * 5.0, 1.24, 0, C.frame);                                             // концевая площадка
      for (const sz of [-1, 1]) {
        F.box(0.08, 0.5, 0.06, s * 5.4, 0.76, sz * 1.42, C.frame); F.box(0.3, 0.025, 0.2, s * 5.4, 0.52, sz * 1.42, C.yel);   // подножка
        F.cyl(V(s * 5.52, 1.3, sz * 1.42), V(s * 5.52, 2.25, sz * 1.42), 0.016, C.white, 8);                                     // поручень составителя
        F.cyl(V(s * 5.52, 2.25, sz * 1.42), V(s * 5.1, 2.25, sz * 1.42), 0.016, C.white, 8);
      }
      // автосцепка СА-3 (условно): хвостовик, корпус, малый и большой зубья, расцепной рычаг
      const xc = s * 5.85, yc = D.couplerY;   // ось автосцепки: длина по осям автосцепок ≈ 12,0 м (типовая)
      B.box(0.42, 0.18, 0.2, s * 5.62, yc, 0, C.frame);
      B.box(0.24, 0.34, 0.36, xc, yc, 0.02, C.bogie); B.box(0.12, 0.28, 0.14, xc + s * 0.16, yc, 0.12, C.bogie); B.box(0.1, 0.22, 0.12, xc + s * 0.15, yc, -0.12, C.bogie);
      F.cyl(V(s * 5.66, yc + 0.28, -0.1), V(s * 5.66, yc + 0.28, -1.35), 0.018, C.red, 6);
      F.cyl(V(s * 5.6, yc - 0.1, 0.35), V(s * 5.86, yc - 0.32, 0.42), 0.03, C.hose, 8);                  // тормозной рукав
      F.box(0.1, 0.12, 0.12, s * 5.88, yc - 0.36, 0.42, C.steel);
    }
    // тормозное оборудование под рамой: цилиндр, запасный резервуар, воздухопровод
    B.cyl(V(-1.6, 0.86, 0.45), V(-1.0, 0.86, 0.45), 0.18, C.bogie, 16);
    B.cyl(V(0.6, 0.84, -0.48), V(1.9, 0.84, -0.48), 0.2, C.bogie, 16);
    F.cyl(V(-5.5, 0.86, 0.3), V(5.5, 0.86, 0.3), 0.022, C.bogie, 6);
    // сливной прибор (универсальный, условно): корпус клапана, патрубок, фланец, заглушка на цепочке
    B.cyl(V(0, AX - R + 0.02, 0), V(0, 0.86, 0), 0.15, C.bogie, 20);
    B.cyl(V(0, 0.86, 0), V(0, D.drainY + 0.04, 0), 0.0795, C.bogie, 18);
    B.cyl(V(0, D.drainY + 0.04, 0), V(0, D.drainY, 0), 0.142, C.steel, 20);
    F.cyl(V(0.32, 0.72, 0), V(0.32, 0.62, 0), 0.13, C.bogie, 18); F.cyl(V(0.0, 0.75, 0), V(0.3, 0.68, 0), 0.006, C.steel, 4);
    for (const s of [-1, 1]) B.bar(V(s * 0.5, 1.0, 0), V(0, 0.82, 0), 0.06, 0.05, C.frame);
    // горловина с крышкой (люк Ø ≈ 570, условно), предохранительно-впускной клапан, площадка с ограждением, лестницы
    const yT = AX + R;
    B.cyl(V(0, yT - 0.15, 0), V(0, D.hatchTop - 0.06, 0), 0.36, C.tank, 32);
    B.cyl(V(0, D.hatchTop - 0.06, 0), V(0, D.hatchTop - 0.045, 0), 0.4, C.frame, 32);              // фланец горловины; крышка — отдельно (открывается)
    F.box(0.1, 0.08, 0.18, -0.42, D.hatchTop - 0.04, 0, C.frame);                                     // петля крышки
    B.cyl(V(0.62, yT - 0.05, 0.35), V(0.62, yT + 0.32, 0.35), 0.075, C.frame, 14); B.cyl(V(0.62, yT + 0.32, 0.35), V(0.62, yT + 0.4, 0.35), 0.1, C.frame, 14);
    const yP = D.platformY;
    B.box(2.3, 0.04, 1.25, 0, yP, 0, C.frame);   // площадка у горловины 2,3 × 1,25 м (условно)
    for (const sx of [-1.05, 1.05]) for (const sz of [-1, 1]) B.bar(V(sx, yP - 0.02, sz * 0.55), V(sx * 0.9, AX + 1.12, sz * 0.95), 0.05, 0.05, C.frame);   // стойки площадки на котле
    for (const sx of [-1.12, 1.12]) for (const sz of [-0.6, 0.6]) F.cyl(V(sx, yP, sz), V(sx, yP + 1.0, sz), 0.018, C.yel, 6);
    // ограждение: торцы (x = ±1,12) и дальняя сторона (z > 0); сторона к эстакаде (z < 0) — проём под переходной мостик
    F.cyl(V(-1.12, yP + 1.0, 0.6), V(1.12, yP + 1.0, 0.6), 0.018, C.yel, 6); F.cyl(V(-1.12, yP + 0.5, 0.6), V(1.12, yP + 0.5, 0.6), 0.012, C.yel, 6);
    for (const sx of [-1.12, 1.12]) { F.cyl(V(sx, yP + 1.0, -0.6), V(sx, yP + 1.0, 0.6), 0.018, C.yel, 6); F.cyl(V(sx, yP + 0.5, -0.6), V(sx, yP + 0.5, 0.6), 0.012, C.yel, 6); }
    for (const s of [-1, 1]) {   // лестница: вертикальная часть у рамы и наклонная по котлу к площадке
      const x0 = 0.75, zA = s * 1.62, yA = 1.2, yB = AX, zB = s * 0.62;
      for (const dx of [-0.21, 0.21]) { F.cyl(V(x0 + dx, yA, zA), V(x0 + dx, yB, zA), 0.016, C.frame, 6); F.cyl(V(x0 + dx, yB, zA), V(x0 + dx, yP, zB), 0.016, C.frame, 6); }
      for (let k = 1; k < 5; k++) { const y = yA + (yB - yA) * k / 5; F.cyl(V(x0 - 0.21, y, zA), V(x0 + 0.21, y, zA), 0.011, C.frame, 6); }
      for (let k = 1; k < 5; k++) { const t = k / 5, y = yB + (yP - yB) * t, z = zA + (zB - zA) * t; F.cyl(V(x0 - 0.21, y, z), V(x0 + 0.21, y, z), 0.011, C.frame, 6); }
    }
    for (const x of [-HB, HB]) bogie(B, S, F, x);
  }
  const old = [], lod = [], groups = [];
  let meshes = [];
  // крышка люка: поворот на петле (x = −0,40 от оси горловины); 0 — закрыта, 1 — открыта (≈ 105°)
  function lidGeo() {
    const L = GK.builder();
    L.cyl(V(0.4, 0, 0), V(0.4, 0.05, 0), 0.4, C.frame, 32);
    L.cyl(V(0.4, 0.05, 0), V(0.4, 0.075, 0), 0.25, C.frame, 24);
    for (const s of [-1, 1]) L.box(0.16, 0.05, 0.05, 0.74, 0.07, s * 0.18, C.steel);                 // откидные болты-прижимы
    L.box(0.06, 0.04, 0.3, 0.84, 0.04, 0, C.steel);                                                   // рукоятка
    return L.geometry();
  }
  const lids = [];
  function setLid(i, t) { const l = lids[i]; if (l) l.rotation.z = 1.83 * t; }
  function build(parent, xs, y0, z0, o) {   // xs — центры вагонов; y0 — головка рельса; z0 — ось пути
    const B = GK.builder(), S = GK.builder(), F = GK.builder();
    for (const cx of xs) {
      const b = GK.builder(), s = GK.builder(), f = GK.builder(); car(b, s, f);
      const T = new THREE.Matrix4().makeTranslation(cx, y0, z0);
      for (const [src, dst] of [[b, B], [s, S], [f, F]]) for (const [g, c] of src.parts) dst.add(g.applyMatrix4(T), c);
    }
    const mB = B.mesh(GK.MAT.dirty), mS = S.mesh(GK.MAT.steel), mF = F.mesh(GK.MAT.paint);
    mB.name = 'Вагоны-цистерны'; mS.name = 'Вагоны-цистерны: колёсные пары'; mF.name = 'Вагоны-цистерны: мелкие детали (LOD)';
    for (const m of [mB, mS, mF]) { if (o) m.userData.o = o; parent.add(m); }
    const gL = lidGeo();
    xs.forEach(cx => { const me = new THREE.Mesh(gL, GK.MAT.paint); me.castShadow = me.receiveShadow = true; me.position.set(cx - 0.4, y0 + D.hatchTop - 0.045, z0); if (o) me.userData.o = o; parent.add(me); lids.push(me); });
    lod.push(mF);   // лестницы, поручни, тормозная передача, пружины — в FAST_LOD (скрываются дальше 40 м); FAST_LOD объявлен после цикла построения объектов
    meshes = [mB, mS, mF];
    return meshes;
  }
  return { build, old, lod, groups, lids, setLid, D, get meshes() { return meshes; } };
})();

