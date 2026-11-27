/* =====================================================================================
   v0.24 — ПОЖАРОТУШЕНИЕ И НАСОСНЫЙ ЦЕХ ПО 444.pdf (модуль F24)
   Источник — 444.pdf (25 стр.), рабочий проект ТОО «АКМАРАЛ», шифр 5632.29:
     800.1-800.2-ПТ-001/002-0 — вышки лафетного ствола: площадка +5,000 (2700 × 2700), ограждение 1250, стояк В2 Ø89×2,8
       (1350 от грани, 1650 от оси Б), монитор «Brahma» CM-1250B-3 + насадок CMNB-350: 4732 л/мин, 0,8 МПа, струя 43 м,
       360° / 150°; охлаждение эстакады 22 л/с на ствол (44 л/с от двух), 4 ч;
     200-ПТ-001…004-0 — насосный цех: ГПС-600 × 3, пенопровод по стенам на кронштейнах, ось +1,800, ввод Ø108×4;
       приёмный приямок 500×500×500 и трап ТК-50 (производственная канализация К3);
     200-ТХ-002/003-0 — план и разрезы цеха: подвесной кран Q = 1 т — пути в 3,30 и 9,32 м к западу от оси 6,
       мост 6,6 м, верх моста +2,550*, крюк +1,890* (с * — справочные);
     116.1-116.4-ПТ-001/002-0 — РГС: ГПС-600 над каждым резервуаром на +5,000, консоль 1700 на стойке в 2500 от оси
       опоры, стояк Ø76×4 в 500 от стойки, подземный коллектор −1,970.
   Привязка к сцене: план ПТ-002 цеха подогнан к модели по 7 агрегатам АК-041 (масштаб 1:1, СКО 0,06 м).
   УСЛОВНО (APPROXIMATE): сечения профилей вышки (АС нет), форма монитора и ГПС-600 (по габаритам знаков на листах),
   ориентация вышки на генплане (ось А — к эстакаде, по примыканию В2 ГП-005), конструкция кронштейнов и крана,
   длина тяг подвески путей (высота зала в модели — условная, v0.10). Струя — учебная визуализация, не расчёт.
   ===================================================================================== */
const F24 = (() => {
  const V = GK.V, UP = new THREE.Vector3(0, 1, 0);
  const C = { str: 0x7f878e, strD: 0x5d646a, red: 0xb3261e, redD: 0x7e1a15, yel: 0xd9a92b, dark: 0x2a2d31, alu: 0xc9ccce, brass: 0xb08d57, conc: 0xb3afa5, galv: 0xa9b0b5, blk: 0x1d1f21, chain: 0x45484b, grt: 0x6b7177 };
  const lod = [];
  const PRP_C = 0x2e7d32;   // цвет В10 как у трассы ГП-005 (в режиме ГОСТ 14202 — красный, через MATR)
  const pipeMat = () => new THREE.MeshStandardMaterial({ color: PRP_C, roughness: 0.45, metalness: 0.3 });
  const meshOf = (b, m, o, cast = true) => { const me = b.mesh(m); me.castShadow = cast; me.receiveShadow = true; if (o) { me.userData.o = o; pickables.push(me); } return me; };
  /* решётчатый настил: прозрачность по маске (ячейка ≈ 34 мм) */
  const grateMat = (() => {
    const t = MATX.canvasTex(128, (x, s) => { x.fillStyle = '#000'; x.fillRect(0, 0, s, s); x.fillStyle = '#fff'; for (let i = 0; i < s; i += 16) x.fillRect(i, 0, 4, s); for (let j = 0; j < s; j += 32) x.fillRect(0, j, s, 4); }, false);
    t.repeat.set(10, 10);
    return new THREE.MeshStandardMaterial({ color: C.grt, metalness: 0.45, roughness: 0.55, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  })();
  /* полукольцо (дуга) из отрезков в горизонтальной плоскости: центр c, радиус R, углы a0…a1 (0 — по +x) */
  function arc(b, c, R, a0, a1, w, h, col, n = 8) {
    let p0 = V(c.x + R * Math.cos(a0), c.y, c.z + R * Math.sin(a0));
    for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, p1 = V(c.x + R * Math.cos(a), c.y, c.z + R * Math.sin(a)); b.bar(p0, p1, w, h, col); p0 = p1; }
  }

  /* =========================== 1. ВЫШКИ ЛАФЕТНОГО СТВОЛА 800.1, 800.2 =========================== */
  const TW = { A: 1.35, LEG: 1.27, H: 5.0, RL: 1.25, RISER: 0.30, FL: 6.60 };   // ПТ-002: 2700/2, базы на 80 внутрь, +5,000, 1250, 1650 от Б, 350 над ограждением
  const towers = {};   // id → { mon: {yaw, pitch}, yawG, pitchG, tip, aim, water, ... }
  function tower(g, px, py, id) {
    const [cx, cz] = P(px, py), { A, LEG, H, RL } = TW;
    const bp = GK.builder(), bs = GK.builder(), bf = GK.builder();   // окраска; оцинковка/сталь; мелкие детали (LOD)
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [cx + sx * LEG, cz + sz * LEG]);
    // фундаменты (КЖ нет — условно), опорные плиты, стойки 140×140 (АС нет — условно), косынки под площадкой
    for (const [x, z] of legs) {
      bs.box(0.55, 0.3, 0.55, x, 0.0, z, C.conc);
      bp.box(0.32, 0.02, 0.32, x, 0.16, z, C.strD);
      bp.box(0.14, H - 0.33, 0.14, x, 0.17 + (H - 0.33) / 2, z, C.str);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bf.box(dx ? 0.12 : 0.01, 0.12, dz ? 0.12 : 0.01, x + dx * 0.13, 0.25, z + dz * 0.13, C.strD);   // рёбра базы
    }
    // крестовые связи в 2 яруса и распорка посередине высоты (ПТ-002, разрез 1-1); фасонки в узлах
    const yT = [0.35, 2.55, H - 0.22];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = legs[i], [x1, z1] = legs[(i + 1) % 4];
      for (let t = 0; t < 2; t++) {
        bp.bar(V(x0, yT[t], z0), V(x1, yT[t + 1], z1), 0.063, 0.063, C.str);
        bp.bar(V(x1, yT[t], z1), V(x0, yT[t + 1], z0), 0.063, 0.063, C.str);
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (yT[t] + yT[t + 1]) / 2;
        bf.box(Math.abs(x1 - x0) > 0.1 ? 0.28 : 0.012, 0.28, Math.abs(z1 - z0) > 0.1 ? 0.28 : 0.012, mx, my, mz, C.strD);
      }
      bp.bar(V(x0, 2.55, z0), V(x1, 2.55, z1), 0.07, 0.07, C.str);
    }
    // рама площадки +5,000: обвязка (швеллер), второстепенные балки (план ПТ-002), решётчатый настил
    const yb = H - 0.09;
    for (let i = 0; i < 4; i++) { const [sx0, sz0] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i], [sx1, sz1] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][(i + 1) % 4]; bp.bar(V(cx + sx0 * A, yb, cz + sz0 * A), V(cx + sx1 * A, yb, cz + sz1 * A), 0.08, 0.16, C.str); }
    for (const d of [-0.45, 0.45]) { bp.bar(V(cx + d, yb, cz - A), V(cx + d, yb, cz + A), 0.06, 0.12, C.str); bp.bar(V(cx - A, yb, cz + d), V(cx + A, yb, cz + d), 0.06, 0.12, C.str); }
    for (const [x, z] of legs) for (const [dx, dz] of [[Math.sign(cx - x), 0], [0, Math.sign(cz - z)]]) bp.bar(V(x, H - 0.75, z), V(x + dx * 0.45, H - 0.17, z + dz * 0.45), 0.05, 0.05, C.str);   // подкосы-косынки
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2 * A, 0.03, 2 * A), grateMat); deck.position.set(cx, H - 0.015, cz); deck.castShadow = false; deck.receiveShadow = true; g.add(deck);
    // ограждение 1250: поручень, промежуточный пояс, бортовая полоса, стойки ≈ 0,45 м; проём к лестнице (восточная грань у оси Б)
    const zL = cz - A + 0.5, gap = [zL - 0.42, zL + 0.42];
    const rails = (a, b) => { bp.cyl(V(a.x, H + RL, a.z), V(b.x, H + RL, b.z), 0.021, C.yel, 10); bp.bar(V(a.x, H + 0.62, a.z), V(b.x, H + 0.62, b.z), 0.04, 0.04, C.str); bp.bar(V(a.x, H + 0.075, a.z), V(b.x, H + 0.075, b.z), 0.006, 0.15, C.str); };
    const side = (a, b, skip) => {
      const L = a.distanceTo(b), n = Math.max(2, Math.round(L / 0.45)), d = new THREE.Vector3().subVectors(b, a).divideScalar(n);
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(d, k);
        if (skip && p.z > gap[0] && p.z < gap[1]) { prev = null; continue; }
        bp.bar(V(p.x, H, p.z), V(p.x, H + RL, p.z), 0.04, 0.04, C.str);
        if (prev) rails(prev, p);
        prev = p;
      }
    };
    const c4 = [V(cx - A, 0, cz - A), V(cx + A, 0, cz - A), V(cx + A, 0, cz + A), V(cx - A, 0, cz + A)];
    side(c4[0], c4[1]); side(c4[1], c4[2], true); side(c4[2], c4[3]); side(c4[3], c4[0]);
    // вертикальная лестница с ограждением: дуги R500, вынос 1000, ширина 1000 (ПТ-002); ступени через 0,3 м
    const xL = cx + A + 0.18;
    for (const s of [-1, 1]) { bs.bar(V(xL, 0.15, zL + s * 0.3), V(xL, H + 1.1, zL + s * 0.3), 0.06, 0.012, C.galv); bs.bar(V(xL, H + 1.1, zL + s * 0.3), V(cx + A, H + 1.1, zL + s * 0.3), 0.012, 0.06, C.galv); }
    for (let y = 0.3; y < H; y += 0.3) bs.cyl(V(xL, y, zL - 0.3), V(xL, y, zL + 0.3), 0.01, C.galv, 6);
    for (let y = 2.3; y <= H + RL + 0.01; y += 0.75) {
      const yy = Math.min(y, H + RL);
      for (const s of [-1, 1]) bf.bar(V(cx + A, yy, zL + s * 0.5), V(cx + A + 0.5, yy, zL + s * 0.5), 0.008, 0.05, C.galv);
      arc(bf, V(cx + A + 0.5, yy, zL), 0.5, -Math.PI / 2, Math.PI / 2, 0.008, 0.05, C.galv, 8);
    }
    for (const a of [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2]) { const x = cx + A + 0.5 + 0.5 * Math.cos(a), z = zL + 0.5 * Math.sin(a); bf.bar(V(x, 2.3, z), V(x, H + RL, z), 0.04, 0.008, C.galv); }
    // стояк В2 Ø89×2,8 с опорами; фланец монитора на 350 выше ограждения
    const rx = cx, rz = cz + TW.RISER, rr = 0.0445;
    const pM = new THREE.MeshStandardMaterial({ color: 0x1e4dd8, roughness: 0.45, metalness: 0.3 });   // цвет В2 (ГП-005); в режиме ГОСТ 14202 — красный
    const bpipe = GK.builder();
    bpipe.cyl(V(rx, -0.4, rz), V(rx, TW.FL - 0.05, rz), rr, 0, 16);
    bs.cyl(V(rx, TW.FL - 0.05, rz), V(rx, TW.FL - 0.02, rz), 0.1, C.red, 20); bs.cyl(V(rx, TW.FL - 0.02, rz), V(rx, TW.FL, rz), 0.1, C.red, 20);
    for (const y of [2.55, H - 0.1]) { bp.bar(V(cx - LEG, y, rz), V(cx + LEG, y, rz), 0.05, 0.08, C.str); bf.ring(V(rx, y + 0.06, rz), UP, rr + 0.012, 0.006, C.galv, 14); }
    bs.cyl(V(rx, H, rz), V(rx, H + 0.06, rz), rr + 0.03, C.str, 16);   // гильза в настиле
    bs.cyl(V(rx, TW.FL - 0.3, rz), V(rx + 0.12, TW.FL - 0.3, rz), 0.012, C.dark, 8); bs.box(0.04, 0.03, 0.03, rx + 0.14, TW.FL - 0.3, rz, C.red);   // кран дренажа (поз. 2–3, условно)
    // монитор «Brahma» CM-1250B-3 + насадок CMNB-350: поворот 360° (yaw) и 150° (pitch); форма — условно по знаку листа
    const yawG = new THREE.Group(); yawG.position.set(rx, TW.FL, rz);
    const bm = GK.builder();
    bm.cyl(V(0, 0, 0), V(0, 0.03, 0), 0.1, C.red, 20); bm.cyl(V(0, 0.03, 0), V(0, 0.16, 0), 0.075, C.red, 18);
    bm.ring(V(0, 0.1, 0), UP, 0.085, 0.012, C.dark, 18);   // стопор горизонтального поворота
    bm.cyl(V(0, 0.16, 0), V(0, 0.27, -0.1), 0.055, C.red, 14); bm.cyl(V(0, 0.27, -0.1), V(0, 0.36, 0), 0.055, C.red, 14);   // колено «гусиная шея»
    bm.cyl(V(-0.09, 0.36, 0), V(0.09, 0.36, 0), 0.06, C.red, 16);   // корпус шарнира вертикального поворота
    yawG.add(meshOf(bm, GK.MAT.paint));
    const pitchG = new THREE.Group(); pitchG.position.set(0, 0.36, 0); yawG.add(pitchG);
    const bn = GK.builder();
    bn.cyl(V(0, 0, 0), V(0, 0, 0.42), 0.05, C.red, 16);                 // ствол
    bn.cyl(V(0, 0, 0.42), V(0, 0, 0.56), 0.068, C.alu, 18);              // насадок CMNB-350: корпус
    bn.cyl(V(0, 0, 0.56), V(0, 0, 0.72), 0.06, C.alu, 18, 0.075);        // распылитель
    bn.ring(V(0, 0, 0.7), new THREE.Vector3(0, 0, 1), 0.07, 0.012, C.dark, 18);   // кольцо регулировки струи
    bn.cyl(V(0, 0.05, 0.05), V(0, 0.25, -0.5), 0.015, C.dark, 8); bn.cyl(V(0, 0.25, -0.5), V(0, 0.27, -0.62), 0.022, C.blk, 8);   // рукоять наведения
    bn.ring(V(0.1, 0, 0), new THREE.Vector3(1, 0, 0), 0.05, 0.01, C.dark, 14);   // стопор вертикального поворота
    pitchG.add(meshOf(bn, GK.MAT.steel));
    const tip = new THREE.Object3D(); tip.position.set(0, 0, 0.74); pitchG.add(tip);
    g.add(meshOf(bp, GK.MAT.paint)); g.add(meshOf(bs, GK.MAT.steel)); const mf = meshOf(bf, GK.MAT.paint, null, false); g.add(mf); lod.push(mf);
    const mp = bpipe.mesh(pM); g.add(mp);
    g.add(yawG);
    towers[id] = { id, yawG, pitchG, tip, cx, cz, yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, aim: -1, water: false, jet: null, v: 0, dirty: true };
  }

  /* --- струя (учебно): баллистическая траектория без сопротивления воздуха; переменный радиус; брызги у цели --- */
  const jetG = new THREE.Group(); jetG.name = 'F24: струи лафетных стволов'; scene.add(jetG);
  const jetMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0xdfeef8) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float s = vUv.x * 60.0 - uT * 9.0, k = floor(s), f = fract(s);
        float streak = mix(h(k + floor(vUv.y * 7.0) * 13.0), 1.0, 0.35) * smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.55, 1.0, f));
        float a = (0.32 + 0.55 * streak) * (1.0 - smoothstep(0.82, 1.0, vUv.x)) * smoothstep(0.0, 0.02, vUv.x);
        gl_FragColor = vec4(uC * (0.85 + 0.25 * streak), a);
        #include <colorspace_fragment>
      }`
  });
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uS: { value: 1 } },
    vertexShader: `uniform float uT; attribute vec4 aR; varying float vA;
      void main(){ float t = fract(aR.w + uT * 0.7); vec3 p = position + vec3(aR.x * 2.2 * t, 1.2 * t - 3.2 * t * t, aR.z * 2.2 * t);
        vA = 1.0 - t; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(90.0 / -mv.z, 1.5, 9.0); }`,
    fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; gl_FragColor = vec4(0.9, 0.95, 1.0, 0.55 * vA); }'
  });
  function sprayGeo() {
    const n = 260, pos = new Float32Array(n * 3), r = new Float32Array(n * 4);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.283, m = 0.3 + rnd(); r.set([Math.cos(a) * m, 0, Math.sin(a) * m, rnd()], i * 4); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('aR', new THREE.BufferAttribute(r, 4)); gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4); return gg;
  }
  function tubeGeo(pts, radii, radial = 10) {
    const n = pts.length, pos = new Float32Array(n * radial * 3), uv = new Float32Array(n * radial * 2), idx = [];
    const t = new THREE.Vector3(), nA = new THREE.Vector3(), bA = new THREE.Vector3(), ref = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      nA.crossVectors(t, ref); if (nA.lengthSq() < 1e-6) nA.set(1, 0, 0); nA.normalize(); bA.crossVectors(t, nA).normalize();
      for (let j = 0; j < radial; j++) {
        const a = j / radial * Math.PI * 2, c = Math.cos(a) * radii[i], s = Math.sin(a) * radii[i], k = i * radial + j;
        pos[k * 3] = pts[i].x + nA.x * c + bA.x * s; pos[k * 3 + 1] = pts[i].y + nA.y * c + bA.y * s; pos[k * 3 + 2] = pts[i].z + nA.z * c + bA.z * s;
        uv[k * 2] = i / (n - 1); uv[k * 2 + 1] = j / radial;
        if (i < n - 1) { const j1 = (j + 1) % radial; idx.push(k, i * radial + j1, (i + 1) * radial + j, i * radial + j1, (i + 1) * radial + j1, (i + 1) * radial + j); }
      }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeBoundingSphere(); return gg;
  }
  const GRAV = 9.81, ELEV = 20 * Math.PI / 180;   // угол возвышения ствола при наведении на цистерну — учебно
  const carTarget = i => new THREE.Vector3(EST177.cars[i], EST177.RH + 2.55 + 1.5 + 0.15, EST177.TZ);   // верх котла (TCAR: ось +2,55, R 1,5)
  const CAR_N = ['ВЦ-2 (запад)', 'ВЦ-3 (середина)', 'ВЦ-1 (восток)'];
  function solve(T, i) {   // азимут, возвышение и скорость, чтобы попасть в верх котла i
    const p = new THREE.Vector3(); T.yawG.getWorldPosition(p); p.y += 0.36;
    const tg = carTarget(i), dx = tg.x - p.x, dz = tg.z - p.z, d = Math.hypot(dx, dz) - 0.74 * Math.cos(ELEV), dh = tg.y - p.y - 0.74 * Math.sin(ELEV);   // от среза насадка
    const den = 2 * Math.cos(ELEV) ** 2 * (d * Math.tan(ELEV) - dh), v = den > 0 ? Math.sqrt(GRAV * d * d / den) : 15;
    return { yaw: Math.atan2(dx, dz), pitch: ELEV, v, d, dh };
  }
  function jetBuild(T) {
    if (T.jet) { jetG.remove(T.jet.m); jetG.remove(T.jet.sp); T.jet.m.geometry.dispose(); T.jet.sp.geometry.dispose(); T.jet = null; }
    if (!T.water) return;
    T.yawG.updateWorldMatrix(true, true);
    const o = new THREE.Vector3(), q = new THREE.Quaternion(); T.tip.getWorldPosition(o); T.tip.getWorldQuaternion(q);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(), v = T.v || 14;
    const vx = dir.x * v, vy = dir.y * v, vz = dir.z * v, yEnd = T.aim >= 0 ? carTarget(T.aim).y : hAt(o.x, o.z) + 0.1;
    const pts = [], rad = []; let tEnd = 0;
    for (let t = 0; t < 8; t += 0.02) { const y = o.y + vy * t - GRAV * t * t / 2; if (t > 0.1 && y < yEnd && vy - GRAV * t < 0) { tEnd = t; break; } tEnd = t; }
    const N = 48;
    for (let i = 0; i <= N; i++) { const t = tEnd * i / N, u = i / N; pts.push(new THREE.Vector3(o.x + vx * t, o.y + vy * t - GRAV * t * t / 2, o.z + vz * t)); rad.push(0.04 + 0.5 * u * u); }
    const m = new THREE.Mesh(tubeGeo(pts, rad), jetMat); m.userData.noWalk = 1; m.renderOrder = 3; m.frustumCulled = false;
    const sp = new THREE.Points(sprayGeo(), sprayMat); sp.position.copy(pts[N]); sp.userData.noWalk = 1; sp.frustumCulled = false;
    jetG.add(m); jetG.add(sp); T.jet = { m, sp, end: pts[N].clone(), range: Math.hypot(pts[N].x - o.x, pts[N].z - o.z) };
  }
  function aimTower(id, i) {
    const T = towers[id]; if (!T) return;
    if (i < 0) { T.aim = -1; T.tYaw = 0; T.tPitch = 0; T.v = 14; T.water = false; }
    else { const s = solve(T, i); T.aim = i; T.tYaw = s.yaw; T.tPitch = s.pitch; T.v = s.v; T.sol = s; }
    T.dirty = true; cardRefresh();
  }
  function setWater(id, on) { const T = towers[id]; if (!T) return; T.water = on === undefined ? !T.water : !!on; if (T.water && T.aim < 0) aimTower(id, id === '800.1' ? 1 : 2); T.dirty = true; cardRefresh(); }
  const angDiff = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

  /* =========================== 2. НАСОСНЫЙ ЦЕХ 200: ПЕНОТУШЕНИЕ, КРАН, ПРИЯМОК =========================== */
  // подгонка листа 200-ПТ-002-0 к модели по 7 агрегатам АК-041: x = −77,295 + 0,009880·px, z = 17,920 + 0,009880·py (px — растр 130 dpi)
  const AX6 = -61.29, AXB = 20.212;   // ось 6 и ось В в координатах сцены (по подгонке)
  const Y10 = PH_F0 + 1.8;            // ось пенопровода +1,800
  const HALL = { W: -76.858, E: -60.925, N: 19.797, S: 32.711 };   // внутренние грани стен (модель, АК-041)
  const B10 = { xW: -76.109, xE: -61.685, zN: 20.262, zS: 31.930, xIn: -61.932, xG: -64.323, zG1: 29.302 };
  const hall = { foam: new THREE.Group(), crane: new THREE.Group(), san: new THREE.Group() };
  for (const k in hall) { hall[k].name = 'F24: цех 200 — ' + k; scene.add(hall[k]); }
  const O = {
    b10: { id: 'В10 (цех)', net: 1, f24: 'b10', name: 'Пенопровод В10 насосного цеха', note: 'Ввод Ø108×4 у северной стены (низ −2,820) → Ø76×4 к ГПС-3 и в угол; Ø89×4 вдоль восточной и южной стены; Ø76×4 к ГПС-1 и ГПС-2. Ось +1,800; трубы ГОСТ 10704-91, на кронштейнах (200-ПТ-002-0, -003-0, ПТ.С-001-0). Положение — по плану ПТ-002, подогнанному к агрегатам АК-041; кронштейны — условно.' },
    sup: { id: 'Опоры В10', net: 1, f24: 'b10', name: 'Опоры пенопровода: подвижные 76 и 89 (по 5), подвесные 76 (4)', note: '200-ПТ.С-001-0 поз. 15–17. Положение — по плану ПТ-002; конструкция кронштейнов и длина вылета до стены модели — условно (зал в модели шире осевых размеров, см. «Сверка» P6).' }
  };
  const gpsO = n => ({ id: 'ГПС-600 (цех)', net: 1, f24: 'gps', name: `Генератор пены средней кратности ГПС-600 — ${n}`, note: 'Насосный цех 200: 3 шт. (Армавирский опытный машзавод, 4,5 кг); раствор 6 л/с на генератор, 3 × 6 = 18 л/с; интенсивность 0,08 л/(м²·с); время тушения 10 мин (200-ПТ-001-0). Подключение — патрубок Ø76×2,8 с резьбой и головка ГМ-70; наклон 20° (схема В10). Форма — по габариту знака на листе (≈ 0,65 × Ø0,33 м), условно.' });
  function gps(b, p, dir, tilt = 0) {   // ГПС-600: головка ГМ-70, распылитель, корпус, кассета сеток; dir — направление выхода пены
    const d = dir.clone().normalize(); if (tilt) { const ax = new THREE.Vector3().crossVectors(d, UP).normalize(); d.applyAxisAngle(ax, -tilt); }
    const at = s => p.clone().addScaledVector(d, s);
    b.cyl(at(-0.12), at(-0.04), 0.045, C.alu, 12);                   // патрубок + ГМ-70
    b.ring(at(-0.06), d, 0.05, 0.012, C.alu, 12);
    b.cyl(at(-0.04), at(0.06), 0.06, C.red, 14, 0.05);              // корпус распылителя
    b.cyl(at(0.06), at(0.24), 0.065, C.red, 22, 0.15);              // конфузор
    b.cyl(at(0.24), at(0.56), 0.165, C.red, 24);                     // корпус
    b.ring(at(0.56), d, 0.165, 0.014, C.redD, 24);                   // обечайка кассеты
    b.cyl(at(0.555), at(0.565), 0.152, C.alu, 24);                   // пакет сеток (вид снаружи)
    for (let k = 0; k < 3; k++) { const a = k * 2.094, n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); n.addScaledVector(d, -n.dot(d)).normalize(); b.bar(at(0.0).addScaledVector(n, 0.055), at(0.25).addScaledVector(n, 0.15), 0.012, 0.012, C.redD); }
    return d;
  }
  function bracketWall(bs, p, wall, r) {   // кронштейн от стены к трубе: консоль, подкос, хомут
    const y = p.y - r - 0.03, w = wall.clone(); w.y = y;
    const q = p.clone(); q.y = y;
    bs.bar(w, q, 0.05, 0.05, C.str);
    bs.bar(V(w.x, y - 0.45, w.z), V(w.x + (q.x - w.x) * 0.7, y - 0.03, w.z + (q.z - w.z) * 0.7), 0.04, 0.04, C.str);
    bs.box(Math.abs(q.x - w.x) > 0.01 ? 0.01 : 0.18, 0.3, Math.abs(q.z - w.z) > 0.01 ? 0.01 : 0.18, w.x, y - 0.1, w.z, C.strD);   // закладная пластина
    const ax = new THREE.Vector3().subVectors(q, w).normalize(), along = new THREE.Vector3().crossVectors(ax, UP).normalize();
    bs.ring(p, along, r + 0.006, 0.006, C.galv, 14);
  }
  function buildHall() {
    const pM = pipeMat(), bpi = GK.builder(), bs = GK.builder(), bg = GK.builder(), bfit = GK.builder();
    const pt = (x, z, y = Y10) => V(x, y, z);
    const R76 = 0.038, R89 = 0.0445, R108 = 0.054;
    const run = (a, b, r) => bpi.cyl(a, b, r, 0, 16);
    const elbow = (p, r) => bfit.cyl(V(p.x, p.y - r, p.z), V(p.x, p.y + r, p.z), r * 1.0, 0, 12);   // отвод (условно — шар/цилиндр по диаметру)
    // ввод Ø108×4: стояк от пола зала до оси +1,800, тройник
    run(pt(B10.xIn, B10.zN, PH_F1 - 0.05), pt(B10.xIn, B10.zN), R108);
    bfit.cyl(pt(B10.xIn - 0.07, B10.zN), pt(B10.xIn + 0.07, B10.zN), R108 * 1.15, 0, 14);
    // север: Ø76×4 к ГПС-3 и к углу; восток и юг (до ГПС-2) — Ø89×4; юг и запад — Ø76×4
    run(pt(B10.xG, B10.zN), pt(B10.xIn, B10.zN), R76); run(pt(B10.xIn, B10.zN), pt(B10.xE, B10.zN), R89);
    run(pt(B10.xE, B10.zN), pt(B10.xE, B10.zS), R89); run(pt(B10.xE, B10.zS), pt(B10.xG, B10.zS), R89);
    run(pt(B10.xG, B10.zS), pt(B10.xW, B10.zS), R76); run(pt(B10.xW, B10.zS), pt(B10.xW, B10.zG1), R76);
    for (const [x, z, r] of [[B10.xE, B10.zN, R89], [B10.xE, B10.zS, R89], [B10.xW, B10.zS, R76], [B10.xG, B10.zN, R76], [B10.xW, B10.zG1, R76]]) elbow(pt(x, z), r);
    bfit.cyl(pt(B10.xG - 0.07, B10.zS), pt(B10.xG + 0.07, B10.zS), R89 * 1.15, 0, 14);   // тройник 89×3,5–76×3,5 у ГПС-2
    bfit.cyl(pt(B10.xIn - 0.26, B10.zN), pt(B10.xIn - 0.12, B10.zN), R76, 0, 14, R108);   // переход К 108–76 (поз. 13)
    bfit.cyl(pt(B10.xG - 0.26, B10.zS), pt(B10.xG - 0.12, B10.zS), R76, 0, 14, R89);     // переход К 89–76 (поз. 14)
    const mp = meshOf(bpi, pM, O.b10); mp.geometry.computeBoundingSphere(); hall.foam.add(mp);
    hall.foam.add(meshOf(bfit, pM, O.b10));
    // ГПС-600 × 3 (направления — по плану ПТ-002, наклон 20° — по схеме ПТ-003)
    const t20 = 20 * Math.PI / 180;
    const g1 = GK.builder(); gps(g1, pt(B10.xW + 0.17, B10.zG1), new THREE.Vector3(1, 0, 0), t20); g1.cyl(pt(B10.xW, B10.zG1), pt(B10.xW + 0.06, B10.zG1), R76, C.red, 12);
    const g2 = GK.builder(); gps(g2, pt(B10.xG, B10.zS - 0.17), new THREE.Vector3(0, 0, -1), t20);
    const g3 = GK.builder(); gps(g3, pt(B10.xG, B10.zN + 0.17), new THREE.Vector3(0, 0, 1), t20);
    hall.foam.add(meshOf(g1, GK.MAT.paint, gpsO('ГПС-1 (у западной стены)'))); hall.foam.add(meshOf(g2, GK.MAT.paint, gpsO('ГПС-2 (у южной стены)'))); hall.foam.add(meshOf(g3, GK.MAT.paint, gpsO('ГПС-3 (у северной стены)')));
    // опоры: подвижные 76 (юг, 5), подвижные 89 (восток, 5) — кронштейны от стены модели; подвесные 76 (4) — тяги к перекрытию
    for (const px of [120, 372, 597, 852, 1108]) { const x = -77.295 + 0.00988 * px; bracketWall(bs, pt(x, B10.zS), V(x, 0, HALL.S), x < -76 ? R76 : (x > B10.xG ? R89 : R76)); }
    for (const py of [283, 540, 847, 1102, 1410]) { const z = 17.920 + 0.00988 * py; bracketWall(bs, pt(B10.xE, z), V(HALL.E, 0, z), R89); }
    for (const [x, z, ax] of [[B10.xW, B10.zG1 + 0.25, 'z'], [B10.xG + 0.3, B10.zS, 'x'], [B10.xG + 0.3, B10.zN, 'x'], [B10.xIn - 0.4, B10.zN, 'x']]) {   // подвесные опоры 76 (поз. 15)
      bs.cyl(pt(x, z, Y10 + 0.045), pt(x, z, CR.ceil), 0.008, C.galv, 6); bs.box(0.12, 0.01, 0.12, x, CR.ceil - 0.005, z, C.strD);
      bs.ring(pt(x, z), ax === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), R76 + 0.008, 0.007, C.galv, 14);
    }
    hall.foam.add(meshOf(bs, GK.MAT.paint, O.sup));
    buildCrane(); buildSan();
  }
  /* --- кран мостовой ручной однобалочный подвесной Q = 1 т (ОЛ-009; положение — 200-ТХ-003-0, разрез 4-4) --- */
  const CR = { xR: [AX6 - 9.32, AX6 - 3.30], x0: AX6 - 9.61, x1: AX6 - 3.0, z0: HALL.N + 0.25, z1: HALL.S - 0.25, yBT: PH_F0 + 2.55, yHook: PH_F0 + 1.89, yLow: PH_F1 + 0.15, ceil: 5.5 };
  CR.yRB = CR.yBT + 0.22;   // низ пути (нижняя полка двутавра 24М) — над кареткой моста (условно)
  const crane = { bz: 28.41, tz: 28.41, hx: AX6 - 9.0, thx: AX6 - 9.0, hy: CR.yHook, thy: CR.yHook, pend: null, bridge: null, trolley: null, hook: null, chain: null, o: null };
  const _rc = new THREE.Raycaster(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(0, -1, 0);
  const visCh = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
  function hookLow() {   // нижнее положение крюка: пол зала или верх оборудования под крюком (+0,2 м) — без пересечений
    _ro.set(crane.hx, CR.yBT - 0.75, crane.bz); _rc.set(_ro, _rd); _rc.far = 5;
    const hit = _rc.intersectObjects(pickables, false).find(h => visCh(h.object) && !(h.object.userData.o && h.object.userData.o.f24 === 'crane'));
    return Math.min(CR.yHook, Math.max(CR.yLow, hit ? hit.point.y + 0.2 : CR.yLow));
  }
  function craneMove(k, v) {   // перемещение моста/тали — только с поднятым крюком (учебная блокировка)
    crane.pend = Object.assign(crane.pend || {}, { [k]: v });
    if (crane.hy < CR.yHook - 0.01) crane.thy = CR.yHook;
  }
  function ibeam(b, a, c, h, w, col) {   // двутавр от a до c (горизонтальный)
    b.bar(V(a.x, a.y + h / 2 - 0.0075, a.z), V(c.x, c.y + h / 2 - 0.0075, c.z), w, 0.015, col);
    b.bar(V(a.x, a.y - h / 2 + 0.0075, a.z), V(c.x, c.y - h / 2 + 0.0075, c.z), w, 0.015, col);
    b.bar(V(a.x, a.y, a.z), V(c.x, c.y, c.z), 0.008, h - 0.03, col);
  }
  function buildCrane() {
    const o = crane.o = { id: 'Кран 1 т', net: 1, f24: 'crane', name: 'Кран мостовой ручной однобалочный подвесной Q = 1 т', note: 'Пролёт 6 м, длина моста 6,6 м (консоли по 0,3 м), высота подъёма 3 м, путь — двутавр 24М, таль червячная, взрывозащищённое исполнение (200-ТХ.ОЛ-009-0). Пути — в 3,30 и 9,32 м к западу от оси 6 по всей длине зала; верх моста +2,550*, крюк в верхнем положении +1,890* (200-ТХ-003-0, разрез 4-4; 200-ПТ-004-0). Конструкция кареток, тали и тяг подвески — условно; тяги доведены до перекрытия модели (высота зала — условная).' };
    const bs = GK.builder();
    for (const xr of CR.xR) {
      ibeam(bs, V(xr, CR.yRB + 0.12, CR.z0), V(xr, CR.yRB + 0.12, CR.z1), 0.24, 0.115, C.str);
      for (let z = CR.z0 + 0.4; z <= CR.z1; z += 2.4) { bs.cyl(V(xr, CR.yRB + 0.24, z), V(xr, CR.ceil, z), 0.012, C.galv, 6); bs.box(0.2, 0.012, 0.2, xr, CR.ceil - 0.006, z, C.strD); bs.box(0.16, 0.02, 0.06, xr, CR.yRB + 0.25, z, C.strD); }
      for (const z of [CR.z0 + 0.05, CR.z1 - 0.05]) bs.box(0.16, 0.18, 0.06, xr, CR.yRB + 0.02, z, C.red);   // тупиковые упоры
    }
    hall.crane.add(meshOf(bs, GK.MAT.paint, o));
    // мост: двутавр, каретки на нижней полке пути, приводная цепь передвижения
    const br = crane.bridge = new THREE.Group(); hall.crane.add(br);
    const bb = GK.builder();
    ibeam(bb, V(CR.x0, CR.yBT - 0.12, 0), V(CR.x1, CR.yBT - 0.12, 0), 0.24, 0.115, C.yel);
    for (let x = CR.x0 + 0.6; x < CR.x1; x += 0.9) bb.box(0.008, 0.2, 0.1, x, CR.yBT - 0.12, 0, C.yel);   // рёбра жёсткости
    for (const xr of CR.xR) {
      bb.box(0.4, 0.02, 0.9, xr, CR.yBT + 0.01, 0, C.yel);                 // опорная плита каретки
      for (const s of [-1, 1]) {
        bb.box(0.012, 0.36, 0.9, xr + s * 0.09, CR.yBT + 0.18, 0, C.yel);   // щёки каретки
        for (const z of [-0.3, 0.3]) bb.cyl(V(xr + s * 0.012, CR.yRB + 0.06, z), V(xr + s * 0.05, CR.yRB + 0.06, z), 0.045, C.dark, 14);   // катки по нижней полке пути
      }
    }
    bb.ring(V(CR.xR[1] + 0.2, CR.yBT + 0.12, 0), new THREE.Vector3(1, 0, 0), 0.16, 0.012, C.dark, 20);   // колесо привода передвижения
    br.add(meshOf(bb, GK.MAT.paint, o));
    const bc = GK.builder();   // петля приводной цепи передвижения (до 1,2 м над полом)
    for (const dz of [-0.14, 0.14]) bc.cyl(V(CR.xR[1] + 0.21, CR.yBT - 0.03, dz), V(CR.xR[1] + 0.21, PH_F1 + 1.2, dz), 0.006, C.chain, 5);
    bc.bar(V(CR.xR[1] + 0.21, PH_F1 + 1.2, -0.14), V(CR.xR[1] + 0.21, PH_F1 + 1.2, 0.14), 0.012, 0.012, C.chain);
    const mc = meshOf(bc, GK.MAT.steel, o, false); br.add(mc); lod.push(mc);
    // таль червячная на ходовой тележке; петля ручной цепи; грузовая цепь и крюковая подвеска
    const tr = crane.trolley = new THREE.Group(); br.add(tr);
    const bt = GK.builder();
    for (const s of [-1, 1]) { bt.box(0.3, 0.22, 0.012, 0, CR.yBT - 0.22, s * 0.075, C.yel); for (const x of [-0.08, 0.08]) bt.cyl(V(x, CR.yBT - 0.19, s * 0.012), V(x, CR.yBT - 0.19, s * 0.05), 0.035, C.dark, 12); }
    bt.box(0.22, 0.08, 0.2, 0, CR.yBT - 0.33, 0, C.yel);
    bt.cyl(V(0, CR.yBT - 0.37, -0.16), V(0, CR.yBT - 0.37, 0.16), 0.11, C.yel, 18);   // корпус червячной тали
    bt.box(0.16, 0.18, 0.14, 0, CR.yBT - 0.52, 0, C.yel);
    bt.ring(V(0, CR.yBT - 0.37, 0.19), new THREE.Vector3(0, 0, 1), 0.13, 0.01, C.dark, 20);   // тяговое колесо ручной цепи
    for (const dx of [-0.13, 0.13]) bt.cyl(V(dx, CR.yBT - 0.37, 0.19), V(dx, PH_F1 + 1.0, 0.19), 0.005, C.chain, 5);
    bt.bar(V(-0.13, PH_F1 + 1.0, 0.19), V(0.13, PH_F1 + 1.0, 0.19), 0.01, 0.01, C.chain);
    tr.add(meshOf(bt, GK.MAT.paint, o));
    const chainM = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 6), new THREE.MeshStandardMaterial({ color: C.chain, metalness: 0.7, roughness: 0.4 }));
    chainM.userData.o = o; pickables.push(chainM); tr.add(chainM); crane.chain = chainM;
    const hk = crane.hook = new THREE.Group(); tr.add(hk);
    const bh = GK.builder();
    bh.box(0.1, 0.14, 0.07, 0, 0.07, 0, C.yel); bh.cyl(V(0, -0.01, 0), V(0, 0.02, 0), 0.02, C.dark, 10);
    const hookC = new THREE.TorusGeometry(0.045, 0.012, 8, 16, Math.PI * 1.45); hookC.rotateZ(Math.PI * 0.78); hookC.translate(0.01, -0.07, 0); bh.add(hookC, C.dark);
    hk.add(meshOf(bh, GK.MAT.paint, o));
    craneApply();
  }
  function craneApply() {
    if (!crane.bridge) return;
    crane.bridge.position.z = crane.bz; crane.trolley.position.x = crane.hx; crane.hook.position.y = crane.hy;
    const top = CR.yBT - 0.61, L = Math.max(0.02, top - (crane.hy + 0.14));
    crane.chain.scale.y = L; crane.chain.position.set(0, crane.hy + 0.14 + L / 2, 0);
  }
  const CRANE_Z = [['Н-6', 30.48], ['Н-5рез', 28.65], ['Н-7', 26.03], ['Н-8', 22.74]];
  const CRANE_X = [['над агрегатами', -68.4], ['у западного пути', AX6 - 9.0], ['у восточного пути', AX6 - 3.6]];
  /* --- производственная канализация: приёмный приямок 500×500 с решёткой; трап ТК-50 в венткамере --- */
  function buildSan() {
    const oP = { id: 'Приямок', net: 1, f24: 'pit', name: 'Приёмный приямок 500×500×500 (h) производственной канализации', note: 'Стоки после проливов и пожара стекают по уклону пола 0,005 к приямку (дно −1,500), далее выпуск Ø219×6 (ось −1,250; футляр Ø426×8, сальник Ду200) в контрольный колодец с гидрозатвором и в сеть К3 (200-ПТ-001-0, -004-0). Положение — по 200-ТХ-002-0 и 200-ПТ-002-0 (у северной стены между осями 5–6). На 200-ПТ-004-0 — иное положение, см. «Сверка» P5.' };
    const oT = { id: 'Трап ТК-50', net: 1, f24: 'pit', name: 'Трап ТК-50 в вентиляционной камере', note: 'Приём условно-чистых стоков; труба Ø50 в лотке под полом → выпуск Ø57×3,5 L = 3,7 м в контрольный колодец (200-ПТ-004-0). Положение — по плану К3 (обмер), условно.' };
    const b = GK.builder(), x = -63.71, z = 20.588, y = PH_F1 + 0.003;
    b.box(0.5, 0.004, 0.5, x, y, z, C.blk);
    for (let i = -4; i <= 4; i++) b.box(0.012, 0.02, 0.5, x + i * 0.055, y + 0.01, z, C.strD);
    for (const s of [-1, 1]) { b.box(0.56, 0.02, 0.03, x, y + 0.01, z + s * 0.265, C.strD); b.box(0.03, 0.02, 0.56, x + s * 0.265, y + 0.01, z, C.strD); }
    hall.san.add(meshOf(b, GK.MAT.paint, oP, false));
    const t = GK.builder(), tx = -72.80, tz = 21.12, ty = PH_F0 + 0.003;
    t.cyl(V(tx, ty, tz), V(tx, ty + 0.01, tz), 0.1, C.strD, 20); t.ring(V(tx, ty + 0.012, tz), UP, 0.06, 0.006, C.blk, 16); t.ring(V(tx, ty + 0.012, tz), UP, 0.03, 0.006, C.blk, 12);
    hall.san.add(meshOf(t, GK.MAT.paint, oT, false));
  }

  /* =========================== 3. РГС 116.1–116.4: ГПС-600 НА КОНСОЛЯХ (+5,000) =========================== */
  const rgsG = new THREE.Group(); rgsG.name = 'F24: ГПС-600 над РГС'; scene.add(rgsG);
  const RGS_PX = [2989.5, 3056.5, 3124.5, 3191.5], RGS_ID = ['116.3', '116.4', '116.1', '116.2'];   // с запада на восток — как в RGSD (v0.20)
  function buildRGS() {
    const pM = pipeMat(), bpi = GK.builder(), bs = GK.builder(), bg = GK.builder(), bf = GK.builder();
    const zc = P(0, 3103.5)[1], zSup = zc + 2.70, zSt = zSup + 2.5, zRs = zSt + 0.5;   // ось опоры (ГП-003), стойка 2500, стояк 500 (116-ПТ-002-0)
    RGS_PX.forEach((px, i) => {
      const x = P(px, 0)[0], y0 = hAt(x, zc), yT = y0 + 5.0, R = 0.038, yS = hAt(x, zSt), yR = hAt(x, zRs);
      bpi.cyl(V(x, yR - 0.6, zRs), V(x, yT, zRs), R, 0, 14);                 // стояк Ст.В10-N Ø76×4 (от коллектора −1,970)
      bpi.cyl(V(x, yT - R, zRs), V(x, yT + R, zRs), R, 0, 12);               // отвод 90°
      bpi.cyl(V(x, yT, zRs), V(x, yT, zSt - 1.9), R, 0, 14);                  // по консоли к ГПС
      bs.box(0.45, 0.25, 0.45, x, yS + 0.0, zSt, C.conc);                     // фундамент стойки (условно)
      bs.box(0.12, yT - 0.06 - yS - 0.12, 0.12, x, (yS + 0.12 + yT - 0.06) / 2, zSt, C.str);   // стойка СТ (сечение условно)
      bs.bar(V(x, yT - 0.06, zSt + 0.06), V(x, yT - 0.06, zSt - 1.7), 0.1, 0.1, C.str);         // консоль Б, вылет 1700
      bs.bar(V(x, yT - 1.75, zSt), V(x, yT - 0.12, zSt - 1.2), 0.06, 0.06, C.str);              // подкос
      for (const zz of [zSt - 0.2, zSt - 1.6]) bf.ring(V(x, yT, zz), new THREE.Vector3(0, 0, 1), R + 0.007, 0.006, C.galv, 14);   // хомуты К-1 (200 / 1400)
      gps(bg, V(x, yT, zSt - 2.07), new THREE.Vector3(0, 0, -1));             // ГПС-600, выход пены — к резервуару (на север)
      bf.cyl(V(x, yR - 0.02, zRs), V(x, yR + 0.04, zRs), R + 0.03, C.conc, 12);
    });
    const oP = { id: 'В10 (РГС)', net: 1, f24: 'b10', name: 'Стояки В10 Ø76×4 к ГПС-600 над РГС (Ст.В10-1…4)', note: 'От подземного коллектора −1,970 (Ø133×5 → 108 → 89 → 76×4, шаг 4252) — 116.1-116.4-ПТ-002-0. Стояк в 500 мм от стойки, стойка — в 2500 от оси опоры резервуара; на консоли — хомуты К-1. Совпадает с трассой В10 ГП-005 (z 12,25) с точностью 0,02 м.' };
    const oG = { id: 'ГПС-600 (РГС)', net: 1, f24: 'gps', name: 'ГПС-600 над РГС-75 — по одному над каждым резервуаром', note: 'Пожаротушение РГС зимнего ДТ и бензина: раствор пенообразователя на стационарные ГПС-600 на отм. +5,000; 4 × 6 = 24 л/с; 0,08 л/(м²·с); 10 мин (116-ПТ-001-0). Консоль Б 1700 мм на стойке СТ, подкос (116-ПТ-002-0). Сечения стойки и консоли, фундамент — условно.' };
    rgsG.add(meshOf(bpi, pM, oP)); rgsG.add(meshOf(bs, GK.MAT.paint, oG)); rgsG.add(meshOf(bg, GK.MAT.paint, oG));
    const mf = meshOf(bf, GK.MAT.steel, oG, false); rgsG.add(mf); lod.push(mf);
  }

  /* =========================== 3а. СТАНЦИЯ НАЛИВА 186: ГПС-600 × 2 ПО 186-ПТ-002-0 (v0.51) ===========================
     5632.29-186-ПТ-001-0, -002-0 «План с сетью В10», ПТ.С-001-0 (Комплект ПТ-2.pdf, стр. 5–7). Оси станции — по 186-ТХ-002-0 (модуль F25):
     X — от оси 1 на восток, Y — от оси В на юг. Стояк Ø89×4 — в 200 мм за осью 2 (у колонны 2/В), от подземного ввода до ≈ +7,36;
     разводка под кровлей в 120 мм от оси В: Ø89×4 2,8 м → тройник (поз. 8) → ГПС-600 у X ≈ 5,9 (+7,300*) → переход 89→76 (поз. 9) →
     Ø76×4 → ГПС-600 у X ≈ 3,6 (+6,900*); генераторы наклонены на 30° к автоцистерне (разрезы 2-2, 3-3). Отметки со «*» — по листу ориентировочные;
     подвески и хомуты (опоры поз. 10, 11) — условно (КМ нет). Подземная часть ввода (89×4, 3 м, изоляция «весьма усиленная») — до границы 610-ПТ. */
  const st186G = new THREE.Group(); st186G.name = 'F24: ГПС-600 станции 186'; scene.add(st186G);
  function build186() {
    if (typeof F25 === 'undefined') return;
    const X = x => F25.sx(x), Z = y => F25.sz(y), H = F25.H186, Yp = 0.12, R89 = 0.0445, R76 = 0.038;
    const yAt = x => H + 7.30 + (x - 5.9) * (0.40 / 2.3);              // ось разводки по скату (+6,900* у X 3,6 … +7,300* у X 5,9)
    const yTop = H + 7.36, xR = 9.2, xT = 6.2, xG = [5.9, 3.6];
    const bp = GK.builder(), bs = GK.builder(), bg = GK.builder();
    const yG0 = hAt(X(xR), Z(Yp));
    bp.cyl(V(X(xR), yG0 - 0.35, Z(Yp)), V(X(xR), yTop, Z(Yp)), R89, 0, 14);                       // стояк Ø89×4
    bp.cyl(V(X(xR), yTop, Z(Yp)), V(X(xT), yAt(xT) + 0.02, Z(Yp)), R89, 0, 14);                   // Ø89×4 под кровлей
    bp.cyl(V(X(xT), yAt(xT), Z(Yp)), V(X(xG[1]), yAt(xG[1]), Z(Yp)), R76, 0, 14);                 // Ø76×4 после перехода
    bp.cyl(V(X(xR), yTop - R89, Z(Yp)), V(X(xR), yTop + R89, Z(Yp)), R89 + 0.006, 0, 12);          // отвод 90° (поз. 6)
    xG.forEach((xg, i) => {
      const y = yAt(xg), r = i ? R76 : R89, d = new THREE.Vector3(0, 0, 1);
      const p = V(X(xg), y - 0.42, Z(Yp + 0.32));
      const dd = gps(bg, p, d, 30 * Math.PI / 180);
      const inlet = p.clone().addScaledVector(dd, -0.12);
      bp.cyl(V(X(xg), y, Z(Yp)), V(X(xg), inlet.y + 0.06, Z(Yp)), R76, 0, 12);                  // отвод (поз. 7) и опуск к ГМ-70
      bp.cyl(V(X(xg), inlet.y + 0.06, Z(Yp)), inlet, R76, 0, 12);
      bs.ring(V(X(xg), y, Z(Yp)), new THREE.Vector3(1, 0, 0), r + 0.006, 0.006, C.galv, 12);
    });
    for (const x of [8.4, 7.0, 5.0, 4.2]) { const y = yAt(Math.min(x, 6.2)) + (x > 6.2 ? (yTop - yAt(6.2)) * (x - 6.2) / 3.0 : 0); bs.cyl(V(X(x), y + 0.05, Z(Yp)), V(X(x), y + 0.3, Z(Yp)), 0.008, C.str, 6); bs.ring(V(X(x), y, Z(Yp)), new THREE.Vector3(1, 0, 0), 0.05, 0.006, C.galv, 12); }   // подвески к ригелю (условно)
    for (const h of [0.65, 3.33, 6.01]) bs.bar(V(X(9.0) + 0.12, H + h, Z(Yp)), V(X(xR), H + h, Z(Yp)), 0.04, 0.04, C.str);   // хомуты стояка к колонне 2/В (опоры поз. 11, условно)
    const oP = { id: 'В10 (186)', net: 1, f24: 'b10', name: 'Пенопровод В10 станции налива 186: стояк Ø89×4, разводка Ø89/Ø76 под кровлей', note: '186-ПТ-002-0 «План с сетью В10», разрез 1-1; 186-ПТ.С-001-0: труба 89×4 — 11 м (и 3 м подземно), 76×4 — 2 м, отводы 90-89 × 4, 90-76 × 1, тройник 89 × 1, переход 89→76 × 1, опоры 89 × 5, 76 × 1. Подвод от кольцевой сети В10 — подземно (граница — 610-ПТ). Подвески и хомуты — условно (КМ нет).' };
    const oG = { id: 'ГПС-600 (186)', net: 1, f24: 'gps', name: 'ГПС-600 над автоцистерной — 2 шт. (станция налива 186)', note: '186-ПТ-001-0: пожаротушение — раствор пенообразователя на стационарные ГПС-600 над автоцистерной; 0,08 л/(м²·с), площадь 75 м² → 6,0 л/с; при работе 2 ГПС-600 — 12 л/с; время тушения 10 мин; охлаждение площадки и оборудования — от пожарных гидрантов. 186-ПТ.С-001-0: ГПС-600 — 2 шт. (Армавирский опытный машзавод, 4,5 кг), головки ГМ-70 — 2, патрубки 76 L 150 — 2. Положение и наклон 30° — по 186-ПТ-002-0 (разрезы 2-2, 3-3); форма генератора — по габариту знака (условно).' };
    st186G.add(meshOf(bp, pipeMat(), oP)); st186G.add(meshOf(bg, GK.MAT.paint, oG));
    const mf = meshOf(bs, GK.MAT.steel, oP, false); st186G.add(mf); lod.push(mf);
  }

  /* =========================== 4. АНИМАЦИЯ, КАРТОЧКИ =========================== */
  let tPrev = 0, cardFor = null, cardT = 0, SPEED = 1;   // SPEED — ускорение анимации (для проверки)
  function tick(now) {
    const dt = Math.min(0.2, tPrev ? (now - tPrev) / 1000 : 0) * SPEED; tPrev = now;
    jetMat.uniforms.uT.value = now / 1000; sprayMat.uniforms.uT.value = now / 1000;
    for (const T of Object.values(towers)) {
      const dy = angDiff(T.yaw, T.tYaw), dp = T.tPitch - T.pitch, sp = 0.6 * dt;   // ≈ 34°/с — ручное наведение (учебно)
      if (Math.abs(dy) > 1e-3 || Math.abs(dp) > 1e-3) {
        T.yaw += Math.sign(dy) * Math.min(Math.abs(dy), sp); T.pitch += Math.sign(dp) * Math.min(Math.abs(dp), sp * 0.6);
        T.yawG.rotation.y = T.yaw; T.pitchG.rotation.x = -T.pitch; T.dirty = true;
      }
      if (T.dirty) { T.dirty = false; jetBuild(T); }
    }
    if (crane.bridge) {
      let ch = false;
      const mv = (k, tk, v) => { const d = crane[tk] - crane[k]; if (Math.abs(d) > 1e-4) { crane[k] += Math.sign(d) * Math.min(Math.abs(d), v * dt); ch = true; } };
      if (crane.pend && crane.hy >= CR.yHook - 0.01) { if (crane.pend.tz !== undefined) crane.tz = crane.pend.tz; if (crane.pend.thx !== undefined) crane.thx = crane.pend.thx; crane.pend = null; }
      mv('bz', 'tz', 0.35); mv('hx', 'thx', 0.3); mv('hy', 'thy', 0.25);
      if (ch) craneApply();
    }
    if (cardFor && (cardT += dt) > 0.25) { cardT = 0; const el = document.getElementById('f24st'); if (el) el.innerHTML = stateHTML(cardFor); }
  }
  const deg = r => Math.round(((r * 180 / Math.PI) % 360 + 360) % 360);
  const f1 = v => v.toFixed(1).replace('.', ',');
  function stateHTML(o) {
    if (o.f24 === 'tower') {
      const T = towers[o.id]; if (!T) return '';
      return `Азимут ствола ${deg(T.yaw)}° (0° — на юг сцены, к эстакаде), возвышение ${Math.round(T.pitch * 180 / Math.PI)}°` +
        (T.aim >= 0 ? ` · цель: ${CAR_N[T.aim]}, по горизонтали ${f1(T.sol.d)} м` : ' · исходное положение') +
        (T.water && T.jet ? ` · <b style="color:#1d4e7a">подача воды (учебно)</b>, дальность струи ${f1(T.jet.range)} м` : '');
    }
    if (o.f24 === 'crane') return `Мост: z = ${f1(crane.bz)} м · таль: x = ${f1(crane.hx)} м · крюк: ${(crane.hy - PH_F0 >= 0 ? '+' : '−') + Math.abs(crane.hy - PH_F0).toFixed(3).replace('.', ',')} (верхнее +1,890; нижнее — над полом или оборудованием)` + (crane.pend ? ' · <b>подъём крюка перед перемещением</b>' : '');
    return '';
  }
  const objF24 = o => o && (o.f24 || (o.id === '800.1' || o.id === '800.2' ? 'tower' : null));
  function cardHTML(o) {
    const k = objF24(o); if (!k) { cardFor = null; return ''; }
    const oo = Object.assign({}, o, { f24: k }); cardFor = oo;
    let h = '<div class="dxc">';
    if (k === 'tower') {
      h += `<div class="dxh">Лафетный ствол (800-ПТ-002-0) — учебное наведение</div><div class="n">Монитор «Brahma» CM-1250B-3, насадок CMNB-350: 4732 л/мин при 0,8 МПа, струя до 43 м, поворот 360° / 150°. Расчётный расход на охлаждение цистерн — 22 л/с на ствол (44 л/с от двух; ≥ 40 л/с по п. 8.14 СНиП 2.11.03-93), время охлаждения 4 ч.</div>` +
        `<div class="n" id="f24st">${stateHTML(oo)}</div>` +
        [0, 1, 2].map(i => `<button class="btn" data-f24aim="${i}">На ${CAR_N[i]}</button>`).join('') +
        `<button class="btn" data-f24w="1">${towers[o.id] && towers[o.id].water ? 'Прекратить подачу' : 'Подать воду (учебно)'}</button><button class="btn" data-f24aim="-1">Исходное</button>` +
        `<div class="n" style="color:#6b3fa0">Струя — учебная визуализация: траектория без сопротивления воздуха при возвышении 20°, не гидравлический расчёт. Подача — по месту, вручную.</div>` +
        `<button class="btn" data-f24v="jet">Вид на эстакаду</button><button class="btn" data-dxeq="Вышки 800">Паспорт вышек 800</button>`;
    } else if (k === 'crane') {
      h += `<div class="dxh">Кран 1 т — учебное управление (ручной привод)</div><div class="n" id="f24st">${stateHTML(oo)}</div>` +
        `<div class="n">Мост к агрегату:</div>` + CRANE_Z.map(([n, z]) => `<button class="btn" data-f24bz="${z}">${n}</button>`).join('') +
        `<div class="n">Таль:</div>` + CRANE_X.map(([n, x]) => `<button class="btn" data-f24hx="${x}">${n}</button>`).join('') +
        `<button class="btn" data-f24hy="up">Крюк вверх</button><button class="btn" data-f24hy="down">Крюк вниз</button>` +
        `<div class="n">Учебно: перед перемещением моста или тали крюк поднимается в верхнее положение; крюк опускается до пола или до верха агрегата под ним.</div>` +
        `<button class="btn" data-f24v="crane">Вид на кран</button><button class="btn" data-dxeq="Кран мостовой">Паспорт крана</button>`;
    } else if (k === 'gps' || k === 'b10') h += `<button class="btn" data-dxeq="Пенотушение В10">Паспорт «Пенотушение В10»</button>`;
    else if (k === 'pit') h += `<button class="btn" data-dxeq="Цех 200: ПТ и К3">Паспорт «Цех 200: ПТ и К3»</button>`;
    return h + '</div>';
  }
  function bindCard(root) {
    const o = cardFor; if (!o) return;
    for (const b of root.querySelectorAll('[data-f24v]')) b.onclick = () => VIEWS[b.dataset.f24v] && VIEWS[b.dataset.f24v]();
    for (const b of root.querySelectorAll('[data-f24aim]')) b.onclick = () => aimTower(o.id, +b.dataset.f24aim);
    for (const b of root.querySelectorAll('[data-f24w]')) b.onclick = () => setWater(o.id);
    for (const b of root.querySelectorAll('[data-f24bz]')) b.onclick = () => craneMove('tz', Math.min(CR.z1 - 0.5, Math.max(CR.z0 + 0.5, +b.dataset.f24bz)));
    for (const b of root.querySelectorAll('[data-f24hx]')) b.onclick = () => craneMove('thx', +b.dataset.f24hx);
    for (const b of root.querySelectorAll('[data-f24hy]')) b.onclick = () => { if (crane.pend) return; crane.thy = b.dataset.f24hy === 'up' ? CR.yHook : hookLow(); };
  }
  function cardRefresh() { if (cardFor && typeof curSel !== 'undefined' && curSel && objF24(curSel)) select(curSel); }
  /* виды камеры для карточек (и проверки) */
  const roofOff = () => { if (typeof layerApi !== 'undefined' && layerApi) layerApi.setVis('phroof', false); };
  const VIEWS = {
    tower: () => { const T = towers['800.1'], y = hAt(T.cx, T.cz); flyTo([T.cx - 8, y + 8.5, T.cz - 9], [T.cx + 0.5, y + 4.5, T.cz + 1], 0.9); },
    jet: () => { const T = towers['800.1'], y = hAt(T.cx, T.cz); flyTo([T.cx - 24, y + 15, T.cz - 2], [T.cx + 3, y + 3.5, T.cz + 7], 0.9); },
    hall: () => { roofOff(); flyTo([-64.5, 16.5, 37.0], [-68.6, -0.6, 26.4], 0.9); },
    crane: () => { roofOff(); flyTo([-62.6, 3.4, 31.9], [-68.2, 1.6, 27.6], 0.9); },
    rgs: () => { const x = P(3056.5, 0)[0], y = hAt(x, 8); flyTo([x + 7, y + 9, 21], [x - 1, y + 3, 9], 0.9); }
  };
  function craneCmd(k, v) { if (k === 'hook') { if (!crane.pend) crane.thy = v === 'up' ? CR.yHook : hookLow(); } else craneMove(k === 'bridge' ? 'tz' : 'thx', v); }
  function late() { const n0 = lod.length; buildHall(); buildRGS(); build186(); FAST_LOD.push(...lod.slice(n0)); }
  /* контур для проверки связности сетей (PNET): прежний габарит вышки ±1,8 м — чтобы классификация концов сетей
     у вышек (в т. ч. К1) осталась как в v0.23; привязка концов труб к сооружениям по габариту — эвристика PNET */
  const fp = (px, py) => { const [x, z] = P(px, py); return new THREE.Box3(new THREE.Vector3(x - 1.8, -1, z - 1.8), new THREE.Vector3(x + 1.8, 13, z + 1.8)); };
  const api = { tower, late, tick, lod, VIEWS, craneCmd, hookLow, fp, cardHTML, bindCard, aimTower, setWater, towers, crane, CR, hall, rgsG, st186G, jetG, set speed(v) { SPEED = +v || 1; }, get state() { return { towers: Object.fromEntries(Object.entries(towers).map(([k, T]) => [k, { yaw: T.yaw, pitch: T.pitch, aim: T.aim, water: T.water, jet: T.jet ? { range: T.jet.range, end: T.jet.end.toArray() } : null }])), crane: { bz: crane.bz, hx: crane.hx, hy: crane.hy } }; } };
  window.__F24 = api;
  return api;
})();

