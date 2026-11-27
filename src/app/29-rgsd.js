/* ---------- RGSD: детальная 3D-модель РГС-75 (заменяет в виде модель РГС-25 «Цифрового склада»; прежняя модель — слой для сравнения) ---------- */
const RGSD = (() => {
  const K = RVSD.kit, { V, T, RY, RX, RZ, mul, cylBetween, boxBetween, run, geoOf } = K;
  const UPV = new THREE.Vector3(0, 1, 0);
  const PAIRS = ['116.1–2', '116.3–4'];
  const KEYS = ['RGSB1', 'RGSB2', 'RGSZ1', 'RGSZ2'];   // с запада на восток
  const ID_OF = { RGSZ1: '116.1', RGSZ2: '116.2', RGSB1: '116.3', RGSB2: '116.4' };
  /* ---------- размеры, м (все неподтверждённые — настраиваемые) ---------- */
  const DIM = {
    R_IN: 3.252 / 2,        // С-001: Dв 3252 — ПОДТВЕРЖДЕНО
    T_W: 0.008,             // толщина стенки — не указана (только для изображения)
    L_TOT: 9.36,            // С-001: L 9360 — принят как габарит (по ГП-003 ≈ 9,32 м)
    H_HEAD: 0.19,           // ГП-003: вылет конического днища
    R_FLAT: 0.55,           // ГП-003: плоская часть днища Ø ≈ 1,1 м
    Y_BOT: 0.70,            // низ корпуса над площадкой (как у прежней модели) — условно
    Z_SUP: 2.70, W_SUP: 0.30, B_SUP: 1.45,   // ГП-003: оси опор ±2,70 м, ширина 0,30 м; полуширина ложа — условно
    Z_N1: 0.60, Z_N2: 2.37, // ГП-003: центры горловин от северного торца обечайки
    R_NECK: 0.41, D_NFL: 0.975,   // горловина Ду800 (знак Ø ≈ 0,98 м на ГП-003 ≈ фланец Ду800) — условно
    Y_NOZ: 0.20,            // ось патрубков Ø108 над низом корпуса (внутр.) — условно
    NOZ_OUT: 0.15,          // вылет патрубков — условно
    H_LSAL: 0.30,           // ось патрубка Ду50 — на уставке LSA L 300 мм (АК-004)
    DECK_UP: 0.35,          // настил площадки над верхом корпуса — условно
    SMDK_H: 3.0,            // ТХ-001: СМДК-100 на высоте 3 м от площадки — ПОДТВЕРЖДЕНО
    COURSE: 1.5,            // ширина поясов обечайки (раскладка швов) — условно
    DECK: { x0: -27.50, x1: -11.91, z0: 2.19, z1: 6.15, hole: 0.53 },   // ГП-003
    STAIR: { x: -28.31, w: 0.80, zBot: 7.83, zTop: 3.07, land: [-28.75, -27.50, 2.17, 3.07] }   // ГП-003
  };
  const R_IN = DIM.R_IN, R_O = R_IN + DIM.T_W, L_CYL = DIM.L_TOT - 2 * DIM.H_HEAD, HALF = L_CYL / 2, ZT = DIM.L_TOT / 2;
  const AXIS = DIM.Y_BOT + R_O, TOP = AXIS + R_O, DECK_Y = TOP + DIM.DECK_UP;
  let deckYL = DECK_Y;   // отметка настила в системе пары резервуара (площадка — общая, в группе западной пары)
  const coneZ = r => HALF + (R_O - r) / (R_O - DIM.R_FLAT) * DIM.H_HEAD;   // |z| поверхности днища на радиусе r

  /* ---------- материалы ---------- */
  const texPaint = MATX.canvasTex(256, (x, s) => {   // окраска корпуса: лёгкие разводы и подтёки (тайл 3 м, проекция в мировых координатах)
    x.fillStyle = '#f2f4f5'; x.fillRect(0, 0, s, s);
    let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { const px = r() * s, len = 20 + r() * 90, g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(110,100,85,${0.03 + r() * 0.06})`); g.addColorStop(1, 'rgba(110,100,85,0)'); x.save(); x.translate(px, r() * s); x.fillStyle = g; x.fillRect(0, 0, 1 + r() * 2, len); x.restore(); }
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,95,100' : '255,255,255'},${r() * 0.05})`; x.fillRect(r() * s, r() * s, 2 + r() * 14, 1 + r() * 6); }
  });
  const MATR = {
    paint: MATX.tri(0xeef1f2, texPaint, 3.0, { roughness: 0.5, metalness: 0.22, envMap: K.envTex, envMapIntensity: 0.55, side: THREE.DoubleSide }),   // наружная окраска — условно
    weld: new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.6, metalness: 0.3, envMap: K.envTex, envMapIntensity: 0.5 }),
    conc: MATX.tri(0xcfcbc1, MATX.T.concrete, 3.0, { roughness: 0.93 }),
    steel: K.MAT.steel, grate: K.MAT.grate, dark: K.MAT.dark, bolt: K.MAT.bolt, alu: K.MAT.alu, yel: K.MAT.yel, red: K.MAT.red,
    galv: K.MAT.galv,
    prodZ: new THREE.MeshStandardMaterial({ color: 0xf2d24b, roughness: 0.45, metalness: 0.3 }),   // цвета линий ГП-005 (как у трасс ДТ(З) и Б)
    prodB: new THREE.MeshStandardMaterial({ color: 0x00b7d8, roughness: 0.45, metalness: 0.3 }),
    smdk: new THREE.MeshStandardMaterial({ color: 0x5d7a52, roughness: 0.55, metalness: 0.35, envMap: K.envTex, envMapIntensity: 0.5 })
  };
  const CUT = new Set(['paint', 'weld', 'stencil']);   // в техническом разрезе режется только корпус

  /* ---------- сборка с учётом компонентов (для подсветки и выбора детали) ---------- */
  function CB() { const b = {}; return { b, add(k, g, m, c) { if (m) g.applyMatrix4(m); (b[k] || (b[k] = [])).push({ g, c }); return g; } };
  }
  function mergeC(list) {
    const ranges = []; let off = 0;
    for (const e of list) {
      const g = e.g; if (!g.index) { const n = g.attributes.position.count, ix = []; for (let i = 0; i < n; i++) ix.push(i); g.setIndex(ix); }
      const n = g.index.count, last = ranges[ranges.length - 1];
      if (last && last.c === e.c && last.s + last.n === off) last.n += n; else ranges.push({ c: e.c, s: off, n });
      off += n;
    }
    return { geo: K.merge(list.map(e => e.g)), ranges };
  }
  /* фланцевое соединение по оси локальной X: фланец, прокладка, ответный фланец, шпильки с гайками (DN → PN16, ГОСТ 33259 — условно) */
  const FL = { 50: [0.165, 0.125, 4, 0.016, 0.018], 100: [0.22, 0.18, 8, 0.016, 0.02], 150: [0.285, 0.24, 8, 0.02, 0.022] };
  function flangeJoint(B, dn, rp, m, c, blind = false) {
    const [D, Kc, nb, db, t] = FL[dn];
    const cyl = (r, h, x, k = 'dark', seg = 24) => B.add(k, new THREE.CylinderGeometry(r, r, h, seg), mul(m, T(x, 0, 0), RZ(Math.PI / 2)), c);
    cyl(rp * 1.25, 0.03, -0.015 - t, 'dark', 18);   // воротник приварного фланца
    cyl(D / 2, t, -t / 2);                            // фланец патрубка
    cyl(Kc / 2 - db * 0.7, 0.003, 0.0015);           // прокладка
    cyl(D / 2, t, 0.003 + t / 2);                     // ответный фланец / заглушка
    if (!blind) cyl(rp * 1.25, 0.03, 0.003 + t + 0.015, 'dark', 18);
    const hb = 0.003 + t + 0.012;
    for (let i = 0; i < nb; i++) {
      const a = (i + 0.5) / nb * Math.PI * 2, y = Kc / 2 * Math.sin(a), z = Kc / 2 * Math.cos(a);
      B.add('bolt', new THREE.CylinderGeometry(db / 2, db / 2, t * 2 + 0.03, 6, 1, true), mul(m, T(0.0015, y, z), RZ(Math.PI / 2)), c);
      for (const xn of [-t - 0.006, hb - 0.006]) B.add('bolt', new THREE.CylinderGeometry(db * 0.85, db * 0.85, 0.012, 6), mul(m, T(xn, y, z), RZ(Math.PI / 2)), c);
    }
    return 0.003 + t + (blind ? 0 : 0.03);   // вылет соединения за торец фланца патрубка
  }
  const ZN = Math.PI / 2;   // RY(+π/2): локальная X → −z (на север); RY(−π/2): X → +z (на юг)

  /* ---------- узлы резервуара (локальные координаты: центр резервуара, y — от отметки пары) ---------- */
  function buildShell(B) {
    const c = 'shell';
    B.add('paint', new THREE.CylinderGeometry(R_O, R_O, L_CYL, 72, 1, true).rotateX(Math.PI / 2), T(0, AXIS, 0), c);
    const nC = Math.max(1, Math.round(L_CYL / DIM.COURSE)), cw = L_CYL / nC;
    for (let i = 0; i <= nC; i++) B.add('weld', new THREE.TorusGeometry(R_O + 0.001, 0.007, 4, 72), T(0, AXIS, -HALF + i * cw), c);   // кольцевые швы (раскладка — условно)
    for (let i = 0; i < nC; i++) { const a = (i % 2 ? 0.55 : -0.55); B.add('weld', new THREE.BoxGeometry(0.014, 0.008, cw), mul(T(0, AXIS, 0), RZ(a), T(0, R_O + 0.002, -HALF + (i + 0.5) * cw)), c); }   // продольные швы, вразбежку
    const ch = 'heads', prof = [new THREE.Vector2(R_O, 0), new THREE.Vector2(DIM.R_FLAT, DIM.H_HEAD), new THREE.Vector2(0.0001, DIM.H_HEAD)];
    for (const s of [-1, 1]) {
      const g = new THREE.LatheGeometry(prof, 72); g.rotateX(s * Math.PI / 2); g.translate(0, AXIS, s * HALF);
      B.add('paint', g, null, ch);
      B.add('weld', new THREE.TorusGeometry(DIM.R_FLAT * 1.0, 0.006, 4, 48), T(0, AXIS, s * (ZT - 0.001)), ch);
    }
  }
  function buildSupports(B, hG) {   // hG(z) — отметка земли под опорой (локально)
    for (const s of [-1, 1]) {
      const z = s * DIM.Z_SUP, yb = Math.min(hG(z) - 0.25, DIM.Y_BOT - 0.4), Bh = DIM.B_SUP, a0 = Math.PI / 3, n = 24;
      const sh = new THREE.Shape(); sh.moveTo(-Bh, yb); sh.lineTo(Bh, yb);
      const ye = AXIS - R_O * Math.cos(a0) - 0.012; sh.lineTo(Bh, ye);
      for (let i = 0; i <= n; i++) { const a = a0 - 2 * a0 * i / n; sh.lineTo((R_O + 0.012) * Math.sin(a), AXIS - (R_O + 0.012) * Math.cos(a)); }
      sh.lineTo(-Bh, ye); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: DIM.W_SUP, bevelEnabled: false, curveSegments: 1 });
      g.translate(0, 0, z - DIM.W_SUP / 2); B.add('conc', g, null, 'sup');
      // подкладной лист 360 мм по ложу (условно)
      const pad = new THREE.CylinderGeometry(R_O + 0.006, R_O + 0.006, DIM.W_SUP + 0.06, 32, 1, true, -a0 - 0.06, 2 * a0 + 0.12); pad.rotateX(Math.PI / 2); pad.translate(0, AXIS, z);
      B.add('steel', pad, null, 'sup');
    }
  }
  /* патрубок Ø108×4 в северном днище + фланцевое соединение + соединительный участок к задвижке графа ТП */
  function buildNozzle108(B, x, comp, valve, prodKey) {
    const y = DIM.Y_BOT + DIM.T_W + DIM.Y_NOZ, r = Math.hypot(x, AXIS - y), zc = -coneZ(r);
    const zf = zc - DIM.NOZ_OUT;
    B.add('paint', cylBetween(V(x, y, zc + 0.04), V(x, y, zf), 0.054, 20, true), null, comp);   // патрубок ⌀108×4
    const ext = flangeJoint(B, 100, 0.054, mul(T(x, y, zf), RY(ZN)), comp);
    if (!valve) return { y, zEnd: zf - ext };
    // соединительный участок «задвижка → патрубок» — условно (лист ТХ-002 отсутствует)
    const zv = valve.z + 0.2, yv = valve.y, z0 = zf - ext, Bp = { add: (k, g, m) => B.add(k, g, m, comp === 'nozV' ? 'spoolV' : 'spoolP') };
    const pts = Math.abs(yv - y) < 0.02 ? [V(x, y, z0), V(x, y, zv)] : [V(x, y, z0), V(x, y, z0 - 0.22), V(x, yv, z0 - 0.22 - Math.abs(y - yv)), V(x, yv, zv)];
    run(Bp, prodKey, pts, 0.054, 0.12, 16);
    return { y, zEnd: z0, pts };   // v0.32: точки — для сети (F32.regRGS)
  }
  function buildNozzle50(B) {   // Ду50 с заглушкой — южное днище, ось на уставке LSA L
    const c = 'noz50', y = DIM.Y_BOT + DIM.T_W + DIM.H_LSAL, r = AXIS - y, zc = coneZ(r), zf = zc + DIM.NOZ_OUT;
    B.add('paint', cylBetween(V(0, y, zc - 0.04), V(0, y, zf), 0.0285, 16), null, c);
    const ext = flangeJoint(B, 50, 0.0285, mul(T(0, y, zf), RY(-ZN)), c, true);
    B.add('steel', cylBetween(V(0, y, zf + ext - 0.001), V(0, y, zf + ext + 0.04), 0.018, 12), null, c);   // бобышка ¾" NPT (круг 36) — условно
    B.add('dark', cylBetween(V(0, y, zf + ext + 0.04), V(0, y, zf + ext + 0.048), 0.012, 6), null, c);    // пробка
    return { y, z: zf + ext + 0.05 };
  }
  function buildNeck(B, z, comp) {   // горловина Ду800 с крышкой (условно)
    const yf = deckYL - 0.005, rN = DIM.R_NECK, Df = DIM.D_NFL;
    B.add('paint', new THREE.CylinderGeometry(rN, rN, yf - (AXIS + 1.45), 40, 1, true), T(0, (yf + AXIS + 1.45) / 2, z), comp);
    B.add('paint', new THREE.CylinderGeometry(Df / 2, Df / 2, 0.03, 48), T(0, yf - 0.015, z), comp);       // фланец горловины
    B.add('dark', new THREE.CylinderGeometry(Df / 2 - 0.035, Df / 2 - 0.035, 0.003, 40), T(0, yf + 0.0015, z), comp);   // прокладка
    B.add('paint', new THREE.CylinderGeometry(Df / 2, Df / 2, 0.025, 48), T(0, yf + 0.0155, z), comp);    // крышка
    const nb = 24, pc = Df / 2 - 0.035;
    for (let i = 0; i < nb; i++) { const a = (i + 0.5) / nb * Math.PI * 2, bx = pc * Math.sin(a), bz = z + pc * Math.cos(a);
      B.add('bolt', new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6, 1, true), T(bx, yf - 0.005, bz), comp);
      for (const yy of [yf - 0.036, yf + 0.034]) B.add('bolt', new THREE.CylinderGeometry(0.017, 0.017, 0.014, 6), T(bx, yy, bz), comp); }
    for (const s of [-1, 1]) {   // ручки крышки
      B.add('steel', cylBetween(V(s * 0.16, yf + 0.028, z - 0.1), V(s * 0.16, yf + 0.1, z - 0.1), 0.008, 6), null, comp);
      B.add('steel', cylBetween(V(s * 0.16, yf + 0.028, z + 0.1), V(s * 0.16, yf + 0.1, z + 0.1), 0.008, 6), null, comp);
      B.add('steel', cylBetween(V(s * 0.16, yf + 0.1, z - 0.1), V(s * 0.16, yf + 0.1, z + 0.1), 0.008, 6), null, comp);
    }
    return yf + 0.028;   // верх крышки
  }
  function buildTopFittings(B, z1, z2, yc) {
    // люк замерный ЛЗ-150 на патрубке ПЗЛ-150 (крышка горловины №1, условно)
    { const c = 'lz', x = 0.22, z = z1;
      B.add('paint', new THREE.CylinderGeometry(0.0795, 0.0795, 0.2, 20), T(x, yc + 0.1, z), c);
      B.add('dark', new THREE.CylinderGeometry(0.142, 0.142, 0.022, 24), T(x, yc + 0.21, z), c);
      B.add('dark', new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), T(x, yc + 0.246, z), c);
      B.add('alu', new THREE.CylinderGeometry(0.115, 0.125, 0.035, 24), T(x, yc + 0.288, z), c);   // крышка
      B.add('dark', boxBetween(V(x + 0.125, yc + 0.27, z), V(x + 0.2, yc + 0.27, z), 0.03, 0.02), null, c);   // шарнир / педаль
      B.add('dark', boxBetween(V(x + 0.2, yc + 0.27, z), V(x + 0.26, yc + 0.2, z), 0.03, 0.015), null, c);
    }
    // бобышка 1½" NPT + уровнемер LT (АК-004, изображение условное)
    { const c = 'lt', x = -0.2, z = z1 + 0.18;
      B.add('steel', new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14), T(x, yc + 0.03, z), c);
      B.add('alu', new THREE.CylinderGeometry(0.035, 0.035, 0.09, 14), T(x, yc + 0.105, z), c);
      B.add('alu', new THREE.CylinderGeometry(0.065, 0.065, 0.11, 18), T(x, yc + 0.205, z), c);
      B.add('dark', new THREE.CylinderGeometry(0.068, 0.068, 0.025, 18), T(x, yc + 0.272, z), c);
      B.add('dark', cylBetween(V(x + 0.06, yc + 0.2, z), V(x + 0.12, yc + 0.2, z), 0.009, 6), null, c);   // кабельный ввод
    }
    // бобышка ¾" NPT + сигнализатор LSA H (АК-004, изображение условное)
    { const c = 'lsa', x = -0.2, z = z1 - 0.18;
      B.add('steel', new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), T(x, yc + 0.025, z), c);
      B.add('alu', new THREE.CylinderGeometry(0.045, 0.045, 0.085, 16), T(x, yc + 0.09, z), c);
      B.add('dark', new THREE.CylinderGeometry(0.047, 0.047, 0.018, 16), T(x, yc + 0.14, z), c);
      B.add('dark', cylBetween(V(x + 0.045, yc + 0.08, z), V(x + 0.1, yc + 0.08, z), 0.008, 6), null, c);
    }
    // стояк Ду100 и клапан СМДК-100 на высоте 3 м от площадки (ТХ-001); габариты клапана — условно
    { const c = 'smdk', z = z2, ys = deckYL + DIM.SMDK_H;
      flangeJoint(B, 100, 0.054, mul(T(0, yc + 0.03, z), RZ(Math.PI / 2)), c);
      B.add('paint', cylBetween(V(0, yc + 0.08, z), V(0, ys - 0.02, z), 0.054, 18), null, c);
      flangeJoint(B, 100, 0.054, mul(T(0, ys - 0.02, z), RZ(Math.PI / 2)), c);
      const y0 = ys + 0.03;
      B.add('smdk', new THREE.CylinderGeometry(0.13, 0.15, 0.2, 24), T(0, y0 + 0.1, z), c);
      B.add('smdk', new THREE.CylinderGeometry(0.21, 0.21, 0.04, 28), T(0, y0 + 0.22, z), c);
      B.add('smdk', new THREE.CylinderGeometry(0.17, 0.2, 0.16, 28), T(0, y0 + 0.32, z), c);
      B.add('smdk', new THREE.SphereGeometry(0.17, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), T(0, y0 + 0.4, z), c);
      B.add('dark', new THREE.CylinderGeometry(0.235, 0.235, 0.012, 28), T(0, y0 + 0.24, z), c);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; B.add('alu', cylBetween(V(0.21 * Math.sin(a), y0 + 0.24, z + 0.21 * Math.cos(a)), V(0.21 * Math.sin(a), y0 + 0.36, z + 0.21 * Math.cos(a)), 0.008, 6), null, c); }
    }
  }
  function buildStripsGround(B, hG, rows) {
    for (const zr of rows) {   // приварные полосы под балками площадки (условно); rows — локальные z рядов балок
      for (const s of [-1, 1]) {
        const x = s * 0.6, ys = AXIS + Math.sqrt(R_O * R_O - x * x);
        B.add('steel', new THREE.BoxGeometry(0.1, 0.012, 0.3), mul(T(x, ys + 0.004, zr), RZ(-Math.asin(x / R_O))), 'strips');
        B.add('steel', new THREE.BoxGeometry(0.08, deckYL - 0.135 - ys, 0.08), T(x, (deckYL - 0.135 + ys) / 2, zr), 'strips');
      }
    }
    for (const s of [-1, 1]) {   // заземление: бобышка на корпусе, полоса 40×4 к контуру (условно)
      const a = s * 1.25, x = R_O * Math.sin(a), y = AXIS - R_O * Math.cos(a), z = DIM.Z_SUP + 0.45;
      B.add('steel', new THREE.BoxGeometry(0.06, 0.04, 0.04), T(x + s * 0.02, y, z), 'ground');
      const xg = x + s * 0.35, yg = hG(z) + 0.02;
      B.add('galv', boxBetween(V(x + s * 0.04, y, z), V(xg, y - 0.05, z), 0.004, 0.04), null, 'ground');
      B.add('galv', boxBetween(V(xg, y - 0.05, z), V(xg, yg, z), 0.04, 0.004), null, 'ground');
    }
  }
  /* маркировка: номер на южном днище и полоса на корпусе (условно) */
  function stencils(id, prod) {
    const pn = prod === 'Z' ? 'ДТ зимнее' : 'Бензин', out = [];
    const mk = (w, h, draw) => { const c = K.cnv(w, h, draw), t = K.tex(c, 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.15, envMap: K.envTex, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }); };
    const mHead = mk(512, 512, (x, w, h) => { x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(28,31,34,.92)'; x.font = 'bold 150px Arial, "DejaVu Sans", sans-serif'; x.fillText(id, w / 2, 210);
      x.font = 'bold 66px Arial, "DejaVu Sans", sans-serif'; x.fillText(pn.toUpperCase(), w / 2, 320); x.fillStyle = 'rgba(170,35,28,.92)'; x.font = 'bold 48px Arial, "DejaVu Sans", sans-serif'; x.fillText('ОГНЕОПАСНО', w / 2, 395); });
    const g1 = new THREE.CircleGeometry(DIM.R_FLAT - 0.03, 40); g1.translate(0, AXIS, ZT + 0.003);
    out.push(new THREE.Mesh(g1, mHead));
    const mSide = mk(1024, 192, (x, w, h) => { x.clearRect(0, 0, w, h); x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillStyle = 'rgba(28,31,34,.9)'; x.font = 'bold 100px Arial, "DejaVu Sans", sans-serif'; x.fillText('РГС-' + id, 20, 62);
      x.font = 'bold 52px Arial, "DejaVu Sans", sans-serif'; const s2 = `${pn} · V = 75 м³ · `; x.fillText(s2, 24, 152);
      x.fillStyle = 'rgba(170,35,28,.92)'; x.fillText('ОГНЕОПАСНО', 24 + x.measureText(s2).width, 152); });
    // полоса на корпусе с южной стороны: текст вдоль оси, на верхней образующей под 35° к востоку
    const L = 4.4, H = 0.82, a = Math.PI - 0.62, g2 = new THREE.CylinderGeometry(R_O + 0.004, R_O + 0.004, L, 24, 1, true, a - H / R_O / 2, H / R_O);
    // UV: u — по дуге (высота строки), v — вдоль цилиндра (длина строки) → поворачиваем UV, чтобы текст шёл вдоль оси
    const uv = g2.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, 1 - v, u); }
    g2.rotateX(Math.PI / 2); g2.translate(0, AXIS, 2.2);
    out.push(new THREE.Mesh(g2, mSide));
    return out;
  }

  /* ---------- площадка обслуживания и лестница (общие на 4 РГС; по ГП-003, высоты и каркас — условно) ---------- */
  function buildDeck(B, gy, tanks) {
    const D = DIM.DECK, hw = D.hole, hG = (x, z) => hAt(x, z) - gy;
    const holes = [];
    for (const t of tanks) for (const zn of [t.cz - HALF + DIM.Z_N1, t.cz - HALF + DIM.Z_N2]) holes.push([t.cx - hw, t.cx + hw, Math.max(D.z0, zn - hw), zn + hw]);
    const inHole = (x, z) => holes.some(h => x > h[0] + 1e-3 && x < h[1] - 1e-3 && z > h[2] + 1e-3 && z < h[3] - 1e-3);
    const xs = [...new Set([D.x0, D.x1, ...holes.flatMap(h => [h[0], h[1]])].map(v => +v.toFixed(3)))].sort((a, b) => a - b);
    const zs = [...new Set([D.z0, D.z1, ...holes.flatMap(h => [h[2], h[3]])].map(v => +v.toFixed(3)))].filter(z => z >= D.z0 && z <= D.z1).sort((a, b) => a - b);
    const yT = DECK_Y, c = 'deck';
    // настил (решётка ячейкой ≈ 30 мм) — ячейки вне проёмов
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
      if (inHole((x0 + x1) / 2, (z0 + z1) / 2)) continue;
      B.add('grate', geoOf([x0, yT, z0, x1, yT, z0, x0, yT, z1, x1, yT, z1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [x0 / 0.1, z0 / 0.1, x1 / 0.1, z0 / 0.1, x0 / 0.1, z1 / 0.1, x1 / 0.1, z1 / 0.1], [0, 2, 1, 1, 2, 3]), null, c);
    }
    // каркас: балки по всем границам ячеек (кроме проёмов) — швеллер ~120 мм (условно)
    const yB = yT - 0.075;
    for (const z of zs) for (let i = 0; i < xs.length - 1; i++) { const xm = (xs[i] + xs[i + 1]) / 2; if (inHole(xm, z - 0.01) && inHole(xm, z + 0.01)) continue; B.add('steel', new THREE.BoxGeometry(xs[i + 1] - xs[i], 0.12, 0.05), T(xm, yB, z), c); }
    for (const x of xs) for (let j = 0; j < zs.length - 1; j++) { const zm = (zs[j] + zs[j + 1]) / 2; if (inHole(x - 0.01, zm) && inHole(x + 0.01, zm)) continue; B.add('steel', new THREE.BoxGeometry(0.05, 0.12, zs[j + 1] - zs[j]), T(x, yB, zm), c); }
    // стойки между резервуарами и по торцам (условно), опорные плиты на бетонных подушках
    const gaps = []; for (let i = 0; i < tanks.length - 1; i++) gaps.push((tanks[i].cx + tanks[i + 1].cx) / 2);
    const colX = [tanks[0].cx - R_O - 0.16, ...gaps, tanks[tanks.length - 1].cx + R_O + 0.16];
    for (const x of colX) for (const z of [D.z0 + 0.08, (D.z0 + D.z1) / 2, D.z1 - 0.08]) {
      const g0 = hG(x, z), top = yT - 0.03;
      B.add('steel', new THREE.BoxGeometry(0.1, top - g0 - 0.05, 0.1), T(x, (top + g0 + 0.05) / 2, z), c);
      B.add('steel', new THREE.BoxGeometry(0.24, 0.02, 0.24), T(x, g0 + 0.04, z), c);
      B.add('conc', new THREE.BoxGeometry(0.4, 0.3, 0.4), T(x, g0 - 0.12, z), c);
      if (x < D.x0 || x > D.x1) { const xe = x < D.x0 ? D.x0 : D.x1; B.add('steel', new THREE.BoxGeometry(Math.abs(xe - x) + 0.05, 0.12, 0.05), T((x + xe) / 2, yB, z), c); }
    }
    // ограждение 1,1 м: поручень, промежуточная планка, бортовая полоса 150 мм (ПБ — условно по типовому решению)
    const rail = (a, b, comp, skip = []) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 1.5));
      const P_ = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const okPt = (x, z) => !skip.some(h => x > h[0] && x < h[1] && z > h[2] && z < h[3]);
      for (let i = 0; i <= n; i++) { const [x, z] = P_(i / n); if (okPt(x, z)) B.add('yel', new THREE.BoxGeometry(0.04, 1.1, 0.04), T(x, yT + 0.55, z), comp); }
      for (const [h, w, k] of [[1.1, 0.045, 'yel'], [0.55, 0.035, 'yel'], [0.075, 0.15, 'steel']])
        B.add(k, boxBetween(V(a[0], yT + h, a[1]), V(b[0], yT + h, b[1]), k === 'steel' ? 0.008 : w, k === 'steel' ? w : w), null, comp);
    };
    const St = DIM.STAIR, Ld = St.land;
    rail([D.x0, D.z0 - 0.03], [D.x1, D.z0 - 0.03], c);
    rail([D.x0, D.z1], [D.x1, D.z1], c);
    rail([D.x1, D.z0 - 0.03], [D.x1, D.z1], c);
    rail([D.x0, Ld[3]], [D.x0, D.z1], c);
    // лестница: косоуры, ступени, поручни; верхняя площадка
    const cs = 'stair', g0 = hG(St.x, St.zBot), rise = yT - g0, run_ = St.zBot - St.zTop, n = Math.max(8, Math.round(rise / 0.18)), xl = St.x - St.w / 2, xr = St.x + St.w / 2;
    for (const x of [xl - 0.03, xr + 0.03]) B.add('steel', boxBetween(V(x, g0 + 0.05, St.zBot + 0.05), V(x, yT - 0.02, St.zTop), 0.06, 0.18), null, cs);
    for (let i = 1; i < n; i++) { const t = i / n, y = g0 + rise * t, z = St.zBot - run_ * t; B.add('steel', new THREE.BoxGeometry(St.w, 0.03, 0.24), T(St.x, y - 0.015, z + 0.02), cs); }
    for (const x of [xl - 0.03, xr + 0.03]) {
      B.add('yel', boxBetween(V(x, g0 + 0.95, St.zBot + 0.05), V(x, yT + 0.95, St.zTop), 0.045, 0.045), null, cs);
      B.add('yel', boxBetween(V(x, g0 + 0.5, St.zBot + 0.05), V(x, yT + 0.5, St.zTop), 0.035, 0.035), null, cs);
      for (let i = 0; i <= 4; i++) { const t = i / 4, y = g0 + rise * t, z = St.zBot + 0.05 - (run_ + 0.05) * t; B.add('yel', new THREE.BoxGeometry(0.04, 0.95, 0.04), T(x, y + 0.475, z), cs); }
    }
    { // верхняя площадка лестницы
      const [lx0, lx1, lz0, lz1] = Ld;
      B.add('grate', geoOf([lx0, yT, lz0, lx1, yT, lz0, lx0, yT, lz1, lx1, yT, lz1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [lx0 / 0.1, lz0 / 0.1, lx1 / 0.1, lz0 / 0.1, lx0 / 0.1, lz1 / 0.1, lx1 / 0.1, lz1 / 0.1], [0, 2, 1, 1, 2, 3]), null, cs);
      for (const z of [lz0, lz1]) B.add('steel', new THREE.BoxGeometry(lx1 - lx0, 0.12, 0.05), T((lx0 + lx1) / 2, yT - 0.075, z), cs);
      B.add('steel', new THREE.BoxGeometry(0.05, 0.12, lz1 - lz0), T(lx0, yT - 0.075, (lz0 + lz1) / 2), cs);
      for (const z of [lz0 + 0.05, lz1 - 0.05]) { const gg = hG(lx0 + 0.05, z); B.add('steel', new THREE.BoxGeometry(0.1, yT - 0.03 - gg - 0.05, 0.1), T(lx0 + 0.05, (yT - 0.03 + gg + 0.05) / 2, z), cs); B.add('conc', new THREE.BoxGeometry(0.4, 0.3, 0.4), T(lx0 + 0.05, gg - 0.12, z), cs); }
      rail([lx0, lz0], [lx0, lz1], cs); rail([lx0, lz0], [lx1, lz0], cs);
      rail([xr + 0.03, lz1], [lx1, lz1], cs);
    }
  }

  /* ---------- построение ---------- */
  const N = PROC.nodes, VAL = PROC.valves;
  const tanks = KEYS.map(k => {
    const [cx, cz] = N[k].p, o = OBJ.find(q => q.id === N[k].obj) || null;
    const id = ID_OF[k], prod = N[k].prod;
    const vOf = suf => { const v = VAL['РГС-' + id + '-' + suf]; return v ? { id: 'РГС-' + id + '-' + suf, x: v.p[0], z: v.p[1] } : null; };
    return { k, id, prod, cx, cz, o, vOut: vOf('В'), vIn: vOf('П') };
  });
  const groups = [], old = [], byK = {}, meshes = {};
  const mkMeshes = (B, parent, userBase) => {
    const out = [];
    for (const [k, list] of Object.entries(B.b)) {
      const { geo, ranges } = mergeC(list), me = new THREE.Mesh(geo, MATR[k]);
      me.castShadow = k !== 'grate'; me.receiveShadow = true;
      Object.assign(me.userData, userBase, { rgsR: ranges, noCut: !CUT.has(k), rgsMat: k });
      pickables.push(me); parent.add(me); out.push(me);
      if (k === 'bolt') FAST_LOD.push(me);
    }
    return out;
  };
  for (const t of tanks) {
    if (!t.o) continue;
    const gy = t.o.g.position.y, hG = z => hAt(t.cx, t.cz + z) - gy, B = CB();
    const oW = OBJ.find(q => q.id === PAIRS[0]); deckYL = DECK_Y + ((oW ? oW.g.position.y : gy) - gy);
    buildShell(B); buildSupports(B, hG);
    const vy = v => v ? { z: v.z - t.cz, y: hAt(v.x, v.z) + 0.6 - gy } : null;
    t.nozV = buildNozzle108(B, t.vOut ? t.vOut.x - t.cx : -0.2, 'nozV', vy(t.vOut), 'prod' + t.prod);
    t.nozP = buildNozzle108(B, t.vIn ? t.vIn.x - t.cx : 0.2, 'nozP', vy(t.vIn), 'prod' + t.prod);
    try { F32.regRGS(t, 'В', t.nozV, t.vOut, gy); F32.regRGS(t, 'П', t.nozP, t.vIn, gy); } catch (e) { console.warn('F32.regRGS', e); }   // v0.32
    t.noz50 = buildNozzle50(B);
    const z1 = -HALF + DIM.Z_N1, z2 = -HALF + DIM.Z_N2;
    const yc1 = buildNeck(B, z1, 'neck1'); buildNeck(B, z2, 'neck2');
    buildTopFittings(B, z1, z2, yc1);
    buildStripsGround(B, hG, [z1 + DIM.DECK.hole, DIM.DECK.z1 - t.cz]);
    const g = new THREE.Group(); g.name = 'РГС-75 ' + t.id + ' (детальная модель)'; g.position.set(t.cx, 0, t.cz);
    meshes[t.k] = mkMeshes(B, g, { o: t.o, rgsK: t.k });
    for (const me of stencils(t.id, t.prod)) { Object.assign(me.userData, { o: t.o, rgsK: t.k, rgsComp: 'stencil' }); me.renderOrder = 1; pickables.push(me); g.add(me); meshes[t.k].push(me); }
    t.g = g; t.gy = gy; byK[t.k] = t; groups.push(g);
  }
  // площадка — в группе западной пары (как прежняя rgsDeck)
  let deckG = null;
  {
    const oW = OBJ.find(q => q.id === PAIRS[0]), gyW = oW ? oW.g.position.y : 0, B = CB();
    buildDeck(B, gyW, tanks);
    deckG = new THREE.Group(); deckG.name = 'Площадка обслуживания РГС (ГП-003)';
    meshes.deck = mkMeshes(B, deckG, { o: oW, rgsK: null });
    groups.push(deckG);
  }
  const PAIR_OF = o => o ? PAIRS.indexOf(o.id) : -1;
  const NOTE = () => '<b>Детальная модель РГС-75 по «Резервуар 1.pdf».</b><br>' +
    '<b>По документам:</b> Dв 3252 мм, L 9360 мм, бетонные опоры, патрубки приёма и раздачи Ø108×4,0 с ответными фланцами, прокладками и крепежом, патрубок Ду50 с заглушкой для сигнализатора нижнего уровня, люк замерный Ду150, клапан СМДК-100 на 3 м над площадкой (ОЛ-001/002, ТХ-001, С-001); контур, опоры, горловины, площадка и лестница — по ГП-003.<br>' +
    '<b>Условно (лист ТХ-002 «План. Разрезы» отсутствует):</b> места патрубков и арматуры на корпусе, форма днищ, отметка площадки, каркас и ограждение, соединительные участки «задвижка → патрубок», окраска и маркировка. Паспорт каждого резервуара — кнопки ниже.';
  function attach(o, gM) {
    const pi = PAIR_OF(o); if (pi < 0) return;
    for (const ch of [...gM.children]) { if (groups.includes(ch)) continue; ch.visible = false; if (!old.includes(ch)) old.push(ch); }
    for (const t of tanks) if (t.o === o && t.g.parent !== gM) gM.add(t.g);
    if (pi === 0 && deckG.parent !== gM) gM.add(deckG);
    Object.defineProperty(o, 'mnote', { configurable: true, get: () => (on(o) ? NOTE() : MN.rgs), set: () => {} });
    o.rgsD = true;
  }
  function fallback() {   // модели «Цифрового склада» не загрузились — детальные РГС всё равно показываем
    for (const id of PAIRS) {
      const o = OBJ.find(q => q.id === id); if (!o) continue;
      if (!o.gM) { const gM = new THREE.Group(); o.g.add(gM); o.gM = gM; gM.visible = true; o.gS.visible = false; }
      attach(o, o.gM); setAnchor(o);
    }
  }
  const on = o => { if (!o || !o.gM || !o.gM.visible) return false; const t = tanks.find(q => q.o === o); return !!(t && t.g.visible && t.g.parent === o.gM); };

  /* ---------- продукт внутри корпуса: сегмент по уровню модели ТП, с учётом конических днищ ---------- */
  function liqGeo(hSim) {
    const r0 = R_IN - 0.004, rF = DIM.R_FLAT - 0.012, zT = ZT - 0.012;
    const h = Math.max(0, Math.min(2 * r0, hSim * (2 * r0) / (2 * RESERVOIR_DATA.SIM.R))), yc = h - r0;
    const rz = z => { const a = Math.abs(z); return a <= HALF ? r0 : r0 - (a - HALF) / (zT - HALF) * (r0 - rF); };
    const zsS = [-zT, -(HALF + (zT - HALF) * 0.5), -HALF, HALF, HALF + (zT - HALF) * 0.5, zT], n = 40;
    const pos = [], idx = [];
    const ring = z => { const r = rz(z), al = yc >= r ? Math.PI : yc <= -r ? 0 : Math.acos(-yc / r); return { r, al, z }; };
    const R = zsS.map(ring);
    // боковая поверхность
    for (const q of R) for (let j = 0; j <= n; j++) { const th = -q.al + 2 * q.al * j / n; pos.push(q.r * Math.sin(th), -q.r * Math.cos(th), q.z); }
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // зеркало продукта
    let base = pos.length / 3;
    for (const q of R) { const y = -q.r * Math.cos(q.al), x = q.r * Math.sin(q.al); pos.push(-x, y, q.z, x, y, q.z); }
    for (let i = 0; i < R.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    // торцы (плоская часть днищ)
    for (const q of [R[0], R[R.length - 1]]) {
      base = pos.length / 3; const yC = -q.r * Math.cos(q.al);
      pos.push(0, (yC - q.r) / 2, q.z);
      for (let j = 0; j <= n; j++) { const th = -q.al + 2 * q.al * j / n; pos.push(q.r * Math.sin(th), -q.r * Math.cos(th), q.z); }
      for (let j = 0; j < n; j++) idx.push(base, base + 1 + j, base + 2 + j);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  /* ---------- компоненты: выбор по попаданию, рамка и подсветка ---------- */
  const SHARED = new Set(['deck', 'stair']);
  function compAt(hit) {
    if (!hit || !hit.object) return null;
    const u = hit.object.userData; if (u.rgsComp) return u.rgsComp;
    const R_ = u.rgsR; if (!R_ || hit.faceIndex === undefined || hit.faceIndex === null) return null;
    const i = hit.faceIndex * 3; for (const r of R_) if (i >= r.s && i < r.s + r.n) return r.c;
    return null;
  }
  function subGeo(me, comp) {   // геометрия одного компонента (копия вершин) — для подсветки
    const R_ = (me.userData.rgsR || []).filter(r => r.c === comp); if (!R_.length) return null;
    const src = me.geometry, I = src.index.array, P_ = src.attributes.position.array, Nn = src.attributes.normal.array, map = new Map(), pos = [], nor = [], idx = [];
    for (const r of R_) for (let k = r.s; k < r.s + r.n; k++) { const v = I[k]; let j = map.get(v); if (j === undefined) { j = pos.length / 3; map.set(v, j); pos.push(P_[3 * v], P_[3 * v + 1], P_[3 * v + 2]); nor.push(Nn[3 * v], Nn[3 * v + 1], Nn[3 * v + 2]); } idx.push(j); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); g.computeBoundingBox();
    return g;
  }
  const hlMatA = new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const hlMatB = new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.18, depthWrite: false, depthTest: false });
  function overlay(k, comp) {   // группа подсветки компонента (вызывающий удаляет её через disposeOverlay)
    const list = SHARED.has(comp) ? (meshes.deck || []) : (meshes[k] || []), g = new THREE.Group(), box = new THREE.Box3();
    g.name = 'подсветка компонента РГС';
    for (const me of list) {
      if (me.userData.rgsComp) { if (me.userData.rgsComp !== comp) continue; me.updateWorldMatrix(true, false); box.expandByObject(me); continue; }
      const sg = subGeo(me, comp); if (!sg) continue;
      me.updateWorldMatrix(true, false);
      for (const m of [hlMatA, hlMatB]) { const o = new THREE.Mesh(sg, m); o.matrixAutoUpdate = false; o.matrix.copy(me.matrixWorld); o.renderOrder = m === hlMatB ? 30 : 29; o.userData.noWalk = 1; g.add(o); }
      box.union(sg.boundingBox.clone().applyMatrix4(me.matrixWorld));
    }
    return { g, box };
  }
  function disposeOverlay(ov) { if (!ov) return; const seen = new Set(); ov.g.traverse(m => { if (m.isMesh && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); } }); if (ov.g.parent) ov.g.parent.remove(ov.g); }
  const pulse = t => { const a = 0.5 + 0.5 * Math.sin(t * 0.006); hlMatA.opacity = 0.32 + 0.33 * a; hlMatB.opacity = 0.10 + 0.14 * a; };
  const tankBox = k => { const t = byK[k]; if (!t) return null; t.g.updateWorldMatrix(true, true); const b = new THREE.Box3(); for (const me of meshes[k]) b.expandByObject(me); return b; };
  const tankAt = (x, z) => { let best = null, bd = 1e9; for (const t of tanks) { if (!t.o) continue; const d = Math.abs(x - t.cx) + (Math.abs(z - t.cz) > ZT + 1.5 ? 50 : 0); if (d < bd) { bd = d; best = t.k; } } return best; };
  return { DIM, AXIS, TOP, DECK_Y, L_CYL, HALF, ZT, R_O, KEYS, ID_OF, PAIRS, tanks, byK, groups, old, meshes, attach, fallback, on, liqGeo, compAt, overlay, disposeOverlay, pulse, tankBox, tankAt, get deckG() { return deckG; } };
})();
if (window.__mdlFail) {   // загрузка моделей завершилась ошибкой ещё до создания RVSD/RGSD (нет DecompressionStream — старые браузеры): детальные РВС и РГС всё равно показываем
  try { RVSD.fallback(); RGSD.fallback(); modelsOn = true; bMdl.classList.add('on'); for (const o of OBJ) if (o.gM) { o.gM.visible = true; o.gS.visible = false; setAnchor(o); } } catch (e) { console.warn('Детальные модели РВС/РГС:', e); }
}
const VTYP = { 'М': 'Задвижка с электроприводом', 'руч': 'Задвижка ручная', 'КО': 'Клапан отсечной', 'КЛ': 'Клапан электромагнитный', 'КШ': 'Кран шаровый ручной' };   // v0.27: КШ
const SRCN = { 'ГП-005': 'трасса по сводному плану сетей ГП-005', 'АК-041': 'по листу АК-041 (насосный цех)', 'АК-004': 'по функциональной схеме АК-004', 'ТХ-186': 'по плану 186-ТХ-002-0 (станция налива 186)', 'ТХ-166': 'по плану 166-ТХ-002-0 (пункт заправки 166)', 'усл': 'условно — трасса/положение не подтверждены документацией' };   // v0.27: ТХ-186, ТХ-166
SRCN['ТХ-186'] = 'по плану 186-ТХ-002-0 (444.pdf)';

SRCN['АК-045'] = 'по листу АК-045 (план эстакады 177: расстановка оборудования КИП и проводок)'; SRCN['АК-045, ГП-005'] = 'по листу АК-045 и сводному плану сетей ГП-005';
