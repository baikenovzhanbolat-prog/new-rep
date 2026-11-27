/* =====================================================================================
   Этап 6.7 (v0.7) — ПОДЗЕМНЫЕ СЕТИ. Режим «Подземные сети» (кнопка в верхней панели, слой «ugsec»).
   Подтверждено документацией:
     ГП-005 (сводный план сетей) — трассы и условные обозначения: В1, В2, В10, К1, К3, кабели в траншее,
       «трубопровод в футляре», кабели в а/ц трубах, точки подъёма/опуска (теплосеть — зелёные, кабели — синие),
       круглые и прямоугольные колодцы, отметки у сооружений 752 (292,206) и 798 (292,74);
     АК-004 — ДЕ-1 ЕП 8-2000-1300-2 (D 2,0; L 2,90; H 3,66), ДЕ-2 ЕП 63-3000-1000-2 (D 3,0; L 9,25; H 4,36);
     АК-005 — канализация К3: К3-15 → К3-16 → К3-17 → очистные 798 (3 л/с) → К3-18 → сборник 752 (10 м³);
     5632.29-654.1-654.2-КЖ-20 «План котлована» — РПВ 2 × 21,0 × 11,72 м, отм. дна 0,000 = 295,80;
       ведомость грунтов (скв. №10): насыпной грунт до 297,36, супесь лессовидная до 293,36.
   UG_DATA снят с векторного PDF ГП-005 (привязка по 46 колодцам, СКО 0,03 м). Штрихи пунктира сведены в непрерывные
   трассы: разрывы штрихов ≤ 2,4 м (у В1, К1, К3 ≤ 4,2 м — подписи и колодцы), повороты и примыкания — по пересечению осей.
   УСЛОВНО (на листах нет — требует уточнения по НВК/ЭС/ТС/ТХ): глубины заложения (UGND_DEPTH), диаметры (NET_DEF.r),
   материалы и покрытия труб, диаметр футляров, конструкция колодцев (кольца КС, плиты), шахты горловин ёмкостей,
   ориентация ДЕ-1, толщина стен и высота РВП (по объёму 900 м³), профиль К3 (самотёк к отметке 798, см. k3Profile).
   ===================================================================================== */
const UGN = (() => {
  const root = PIPED.sec;                                    // всё подземное — в слое «ugsec»
  const surf = new THREE.Group(); scene.add(surf);           // надземные части стояков/защитных труб — видны всегда
  const def = Object.fromEntries(NET_DEF.map(d => [d.k, d]));
  const D = UGND_DEPTH;
  const up = new THREE.Vector3(0, 1, 0), xAx = new THREE.Vector3(1, 0, 0), one = new THREE.Quaternion();
  const v3 = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 16), gCylO = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
  const gSph = new THREE.SphereGeometry(1, 12, 8), gBox = new THREE.BoxGeometry(1, 1, 1);
  const gTube = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cat = {}; const CATS = ['pv', 'prp', 'water', 'kpd', 'k1', 'heat', 'tech', 'cab', 'wells', 'tanks', 'soil'];
  for (const k of CATS) { cat[k] = new THREE.Group(); root.add(cat[k]); }
  const stats = { pipes: 0, joints: 0, wells: 0, tanks: 0 };
  const pick = (im, o) => { if (!o) return im; if (typeof o === 'function') im.userData.pick = h => o(h.instanceId); else im.userData.o = o; pickables.push(im); return im; };
  const inst = (geo, mt, n, parent, o) => { const im = new THREE.InstancedMesh(geo, mt, Math.max(n, 1)); im.count = n; parent.add(im); return pick(im, o); };
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const SRC = 'Трасса — по сводному плану сетей ГП-005 (пунктир листа сведён в непрерывную линию).';
  const NOTE_DEPTH = 'Глубина заложения и диаметр — УСЛОВНЫ: продольных профилей и листов наружных сетей в комплекте нет.';

  /* ---------- материалы ---------- */
  const pipeM = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.25, emissive: c, emissiveIntensity: 0.16 });
  const sandM = new THREE.MeshStandardMaterial({ color: 0xd2bd8a, roughness: 1 });
  const casM = new THREE.MeshStandardMaterial({ color: 0x7d8389, roughness: 0.55, metalness: 0.55, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  const sealM = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.8 });
  const ppuM = new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.62, metalness: 0.05, emissive: 0x8e0a96, emissiveIntensity: 0.12 });
  const tapeM = new THREE.MeshStandardMaterial({ color: 0xd9381e, roughness: 0.8 });
  const acM = new THREE.MeshStandardMaterial({ color: 0xc4c3bc, roughness: 0.9 });
  const steelM = new THREE.MeshStandardMaterial({ color: 0x5f666c, roughness: 0.45, metalness: 0.7 });
  const concM = new THREE.MeshStandardMaterial({ color: 0x8e8a81, roughness: 0.95, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const concS = new THREE.MeshStandardMaterial({ color: 0x8f8b82, roughness: 0.95 });
  const jointM = new THREE.MeshStandardMaterial({ color: 0x6e6a62, roughness: 0.95 });
  const rungM = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.7 });
  const tankM = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.65, metalness: 0.2 });     // битумно-полимерное покрытие (условно)
  const tank2M = new THREE.MeshStandardMaterial({ color: 0x55616b, roughness: 0.6, metalness: 0.3 });

  /* ---------- 1. Разрез грунта: стенки «блока» по границе площадки, слои по скважине №10 (КЖ-20) ---------- */
  const BOX = { x0: -102.0, x1: 92.5, z0: -54.2, z1: 58.2 }, YB = -6.2, YT = 3.4;
  const L1 = 297.36 - H0, L2 = 293.36 - H0;                 // подошвы слоёв 1 и 2 (абс. отметки ведомости грунтов)
  const CLIP = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOX.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), BOX.x1),
                new THREE.Plane(new THREE.Vector3(0, 0, 1), -BOX.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), BOX.z1)];
  const soilTex = (() => {
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const yPx = y => (YT - y) / (YT - YB) * H, r = Math.random;
    const band = (yA, yB, base, dots) => {
      const a = yPx(yA), b = yPx(yB); c.fillStyle = base; c.fillRect(0, a, W, b - a);
      for (let i = 0; i < dots.n; i++) { c.fillStyle = dots.col[(r() * dots.col.length) | 0]; const s = dots.s0 + r() * dots.s1; c.globalAlpha = dots.a; c.beginPath(); c.ellipse(r() * W, a + r() * (b - a), s, s * (0.5 + r() * 0.5), r() * 3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    };
    band(YT, L1, '#5a5047', { n: 2600, col: ['#8d857a', '#a79d8e', '#3a342e', '#6b625a', '#9a5b45'], s0: 0.8, s1: 4.5, a: 0.85 });   // насыпной: гравий, мусор, кирпич
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(25,22,19,0.35)'; c.beginPath(); c.ellipse(r() * W, yPx(L1 + 0.15 + r() * 1.5), 14 + r() * 40, 5 + r() * 10, 0, 0, 7); c.fill(); }   // пятна нефтепродуктов
    band(L1, L2, '#b08a58', { n: 9000, col: ['#c49d68', '#9c7848', '#d4b27e', '#8a6a40'], s0: 0.4, s1: 1.4, a: 0.7 });              // супесь лессовидная
    for (let i = 0; i < 22; i++) { c.fillStyle = 'rgba(222,196,140,0.55)'; c.beginPath(); c.ellipse(r() * W, yPx(L2 + 0.3 + r() * 3.4), 30 + r() * 70, 2 + r() * 4, 0, 0, 7); c.fill(); }   // прослои песка
    band(L2, YB, '#8d7c66', { n: 3000, col: ['#9a8a72', '#7c6c58'], s0: 0.4, s1: 1.2, a: 0.6 });
    c.strokeStyle = 'rgba(60,50,40,0.35)'; c.lineWidth = 2; for (let x = -H; x < W; x += 26) { c.beginPath(); c.moveTo(x, yPx(L2)); c.lineTo(x + (yPx(YB) - yPx(L2)), yPx(YB)); c.stroke(); }   // «нет данных»
    c.fillStyle = 'rgba(30,24,18,0.75)'; for (const y of [L1, L2]) c.fillRect(0, yPx(y) - 1.5, W, 3);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const soilObj = { id: 'грунт', net: 1, name: 'Разрез грунта площадки', note: 'Слои — по ведомости грунтов листа 5632.29-654.1-654.2-КЖ-20 (скважина №10, устье 298,48): ' +
    '1 — насыпной грунт (смесь гравия, супеси, песка, строительного мусора, пропитанный нефтепродуктами), подошва 297,36; ' +
    '2 — супесь желтовато-коричневая лессовидная, слюдистая, макропористая, твёрдая, с гнёздами и прослоями песка, подошва 293,36 (ρ 1,866 г/см³, c 16 кПа, φ 28°, E 21,3 МПа). ' +
    'Ниже 293,36 — данных нет (штриховка). Границы слоёв приняты горизонтальными по одной скважине — по площадке условно. В разрезе рельеф обрезан по границе площадки.' };
  {
    const sides = [[BOX.x0, BOX.z0, BOX.x1, BOX.z0], [BOX.x1, BOX.z0, BOX.x1, BOX.z1], [BOX.x1, BOX.z1, BOX.x0, BOX.z1], [BOX.x0, BOX.z1, BOX.x0, BOX.z0]];
    const pos = [], uv = [], idx = []; let acc = 0;
    for (const [ax, az, bx, bz] of sides) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5), base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, yt = hAt(x, z), u = (acc + L * t) / 4;
        pos.push(x, yt, z, x, YB, z); uv.push(u, (yt - YB) / (YT - YB), u, 0);
        if (i < n) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      acc += L;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const wall = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, side: THREE.DoubleSide }));
    wall.userData.o = soilObj; pickables.push(wall); cat.soil.add(wall);
    const bt = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#8d7c66'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(70,58,44,0.35)' : 'rgba(170,150,120,0.35)'; c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 24); return t; })();
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(BOX.x1 - BOX.x0, BOX.z1 - BOX.z0), new THREE.MeshStandardMaterial({ color: 0x9a8a74, map: bt, roughness: 1 }));
    bot.rotation.x = -Math.PI / 2; bot.position.set((BOX.x0 + BOX.x1) / 2, YB, (BOX.z0 + BOX.z1) / 2); cat.soil.add(bot);
    // подписи слоёв на углу блока (ближний левый угол)
    const tag = (txt, y) => {
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 64; const c = cv.getContext('2d');
      c.font = '600 30px system-ui,Arial'; const tw = Math.min(768, c.measureText(txt).width + 28);
      c.fillStyle = 'rgba(20,32,44,0.82)'; c.fillRect(768 - tw, 0, tw, 64); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(txt, 768 - tw + 14, 33);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); sp.scale.set(12, 1, 1); sp.center.set(1, 0.5); sp.position.set(BOX.x0 - 0.6, y, BOX.z1 + 0.6); sp.renderOrder = 5; cat.soil.add(sp);
    };
    tag('1 — насыпной грунт (до 297,36)', (hAt(BOX.x0, BOX.z1) + L1) / 2);
    tag('2 — супесь лессовидная (до 293,36)', (L1 + L2) / 2);
    tag('ниже 293,36 — нет данных', (L2 + YB) / 2);
  }

  /* ---------- 2. Трассы: полилинии UG_DATA → точки с отметкой оси ---------- */
  const key = (x, z) => Math.round(x * 20) + ',' + Math.round(z * 20);
  const polys = k => (UG_DATA.nets[k] || []).map(a => { const pts = []; for (let i = 1; i < a.length; i += 2) pts.push([a[i], a[i + 1]]); return { cas: a[0], pts }; });
  const densify = (pts, yOf, step = 3) => {        // постоянное заглубление: ось следует рельефу
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let j = (i ? 1 : 0); j <= n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n; out.push([x, yOf(x, z), z]); }
    }
    return out;
  };

  /* Профиль самотёчной К3: уклон к очистным 798 (отметка у 798 на ГП-005 — 292,74; принята как низ сооружения) */
  const TK = {
    '139.1': { r: [2648, 3268, 2722, 3340], D: 2.0, L: 2.9, h: 1.3, ax: 'x', name: 'Дренажная ёмкость ДЕ-1 (поз. 139.1)', mark: 'ЕП 8-2000-1300-2, V 8 м³: D 2,0 м; L 2,90 м; H 3,66 м; Ру 0,07 МПа; 2800 кг (АК-004)' },
    '139.2': { r: [3344, 3050, 3428, 3233], D: 3.0, L: 9.25, h: 1.0, ax: 'z', name: 'Дренажная ёмкость ДЕ-2 (поз. 139.2)', mark: 'ЕП 63-3000-1000-2, V 63 м³: D 3,0 м; L 9,25 м; H 4,36 м; Ру 0,07 МПа; 8990 кг (АК-004)' },
    '752': { r: [3533, 3211, 3625, 3235], bot: 292.206 - H0, ax: 'x', name: 'Сборник очищенных производственно-дождевых стоков (поз. 752)', mark: 'V 10 м³, погружной насос ГНОМ 16-16, LSA 752-1 (АК-005)' },
    '798': { r: [3657, 3214, 3728, 3232], bot: 292.74 - H0, ax: 'x', name: 'Очистные сооружения производственно-дождевых стоков (поз. 798)', mark: '3 л/с (10,8 м³/ч), LSA 798-1 — аварийный уровень, LSA 798-2 — плёнка нефтепродуктов (АК-005)' }
  };
  for (const t of Object.values(TK)) {
    const [a, b] = P(t.r[0], t.r[1]), [c, d] = P(t.r[2], t.r[3]);
    t.cx = (a + c) / 2; t.cz = (b + d) / 2; t.w = Math.abs(c - a); t.d = Math.abs(d - b);
    if (t.D === undefined) { t.D = Math.min(t.w, t.d); t.L = Math.max(t.w, t.d); }      // 752, 798: габарит в плане по ГП-002/005
    t.gy = hAt(t.cx, t.cz);
    if (t.bot === undefined) t.bot = t.gy - t.h - t.D;                                   // ЕП: h — заглубление верхней образующей
    t.top = t.bot + t.D; t.axY = t.bot + t.D / 2;
  }
  let K3 = { i: 0, yIn: 0, ok: false };
  function k3Profile(list) {
    const N = new Map(), E = [];
    const node = (x, z) => { const kk = key(x, z); let n = N.get(kk); if (!n) N.set(kk, n = { x, z, adj: [], d: Infinity }); return n; };
    // примыкания «в тело» другой трассы: вставить узел
    const all = list.map(p => p.pts.map(v => v.slice()));
    for (let a = 0; a < all.length; a++) for (const e of [all[a][0], all[a][all[a].length - 1]]) for (let b = 0; b < all.length; b++) {
      if (a === b) continue; const P2 = all[b];
      for (let i = 0; i < P2.length - 1; i++) {
        const [ax, az] = P2[i], [bx, bz] = P2[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
        const t = ((e[0] - ax) * dx + (e[1] - az) * dz) / L2; if (t <= 0.01 || t >= 0.99) continue;
        if (Math.hypot(ax + t * dx - e[0], az + t * dz - e[1]) < 0.08) { P2.splice(i + 1, 0, [e[0], e[1]]); break; }
      }
    }
    for (const P2 of all) for (let i = 0; i < P2.length - 1; i++) { const a = node(...P2[i]), b = node(...P2[i + 1]), L = Math.hypot(b.x - a.x, b.z - a.z); a.adj.push([b, L]); b.adj.push([a, L]); }
    const t798 = TK['798'], inX = t798.cx + t798.L / 2, inZ = t798.cz;                  // вход в 798 — с восточного торца (по ГП-005)
    let out = null, bd = 2.5; for (const n of N.values()) { const d = Math.hypot(n.x - inX, n.z - inZ); if (d < bd) { bd = d; out = n; } }
    const yConn = TK['752'].top - 0.35;                                                  // перепуск 798 → 752 и выпуск 752 (условно)
    const near752 = n => [TK['752'], TK['798']].some(t => Math.abs(n.x - t.cx) < t.L / 2 + 3 && Math.abs(n.z - t.cz) < t.D / 2 + 1.5);
    if (out) {
      out.d = 0; const Q = [out];
      while (Q.length) { Q.sort((a, b) => a.d - b.d); const n = Q.shift(); for (const [m, L] of n.adj) if (n.d + L < m.d) { m.d = n.d + L; Q.push(m); } }
      const yIn = t798.top - 0.3; let i = 0.05;
      for (const n of N.values()) if (isFinite(n.d) && n.d > 5) i = Math.min(i, (hAt(n.x, n.z) - D.kpd - yIn) / n.d);
      i = Math.max(0.003, i); K3 = { i, yIn, ok: true };
      for (const n of N.values()) n.y = isFinite(n.d) ? yIn + i * n.d : (near752(n) ? yConn : hAt(n.x, n.z) - D.kpd);
    } else for (const n of N.values()) n.y = hAt(n.x, n.z) - D.kpd;
    return list.map((p, j) => ({ cas: p.cas, pts: all[j].map(([x, z]) => [x, N.get(key(x, z)).y, z]) }));
  }

  /* ---------- 3. Построение трубы: отрезки + сварные стыки/отводы, подготовка, футляр ---------- */
  function buildRuns(runs, rad, mat, parent, o, opt = {}) {
    const segs = [], cas = [], cnt = new Map(), jp = new Map();
    for (const r of runs) for (let i = 0; i < r.pts.length - 1; i++) { segs.push([r.pts[i], r.pts[i + 1]]); if (r.cas || opt.allCas) cas.push([r.pts[i], r.pts[i + 1]]); }
    for (const [a, b] of segs) for (const p of [a, b]) { const kk = key(p[0], p[2]); cnt.set(kk, (cnt.get(kk) || 0) + 1); jp.set(kk, p); }
    const im = inst(gCyl, mat, segs.length, parent, o);
    segs.forEach(([a, b], i) => {
      v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); v3.normalize(); q.setFromUnitVectors(up, v3);
      m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s3.set(rad, L + 0.004, rad)); im.setMatrixAt(i, m4);
    });
    const J = [...jp.entries()].filter(([kk]) => cnt.get(kk) > 1).map(([, p]) => p);
    const ij = inst(gSph, mat, J.length, parent, o);
    J.forEach((p, i) => { m4.compose(p3.set(...p), one, s3.set(rad, rad, rad)); ij.setMatrixAt(i, m4); });
    if (opt.bed) {   // песчаная подготовка под трубой (условно 0,2 м, ширина ≥ 0,5 м)
      const ib = inst(gBox, sandM, segs.length, parent);
      segs.forEach(([a, b], i) => {
        v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); v3.normalize(); q.setFromUnitVectors(xAx, v3);
        m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - rad - 0.1, (a[2] + b[2]) / 2), q, s3.set(L + 0.02, 0.2, Math.max(0.5, rad * 5))); ib.setMatrixAt(i, m4);
      });
    }
    if (cas.length) {   // футляр + торцевые уплотнения
      const rc = Math.max(rad * 2.1, rad + 0.1), oc = { id: 'футляр', net: 1, name: 'Футляр — ' + (o && o.short || ''), note: 'По условному обозначению ГП-005 «Трубопровод в футляре» (труба между двумя линиями). Диаметр, материал футляра и уплотнение торцов на листе не указаны — показаны условно (стальной футляр, Ø ≈ ' + Math.round(rc * 2000) + ' мм).' };
      const ic = inst(gCylO, casM, cas.length, parent, oc);
      const ends = new Map(); const cc = new Map();
      cas.forEach(([a, b], i) => {
        v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); v3.normalize(); q.setFromUnitVectors(up, v3);
        m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s3.set(rc, L, rc)); ic.setMatrixAt(i, m4);
        for (const [p, s] of [[a, -1], [b, 1]]) { const kk = key(p[0], p[2]); cc.set(kk, (cc.get(kk) || 0) + 1); ends.set(kk, [p, v3.clone().multiplyScalar(s)]); }
      });
      const E2 = [...ends.entries()].filter(([kk]) => cc.get(kk) === 1).map(([, v]) => v);
      const is = inst(gCyl, sealM, E2.length, parent);
      E2.forEach(([p, d], i) => { q.setFromUnitVectors(up, d.normalize()); m4.compose(p3.set(p[0], p[1], p[2]), q, s3.set(rc * 1.04, 0.06, rc * 1.04)); is.setMatrixAt(i, m4); });
    }
    stats.pipes += segs.length; stats.joints += J.length;
    return segs;
  }
  const netObj = (k, code, extra) => ({ id: code, net: 1, short: code, name: code + ' — ' + def[k].name.replace(/ (В1|В2|В10|К1|К3)$/, '') + ' (подземная прокладка)', note: SRC + ' ' + extra + ' ' + NOTE_DEPTH });
  const constY = d => (x, z) => hAt(x, z) - d;
  const ptsY = (list, yOf, step) => list.map(p => ({ cas: p.cas, pts: densify(p.pts, yOf, step) }));
  const runsOf = {};

  // В2 — противопожарный водопровод; В10 — пенораствор; В1 — хоз-питьевой производственный водопровод
  runsOf.pv = ptsY(polys('pv'), constY(D.pv));
  buildRuns(runsOf.pv, def.pv.r, pipeM(def.pv.c), cat.pv, netObj('pv', 'В2', `Ось трубы — ${fmt(D.pv)} м от поверхности (условно), песчаная подготовка.`), { bed: 1 });
  runsOf.prp = ptsY(polys('prp'), constY(D.prp));
  buildRuns(runsOf.prp, def.prp.r, pipeM(def.prp.c), cat.prp, netObj('prp', 'В10', `Ось трубы — ${fmt(D.prp)} м от поверхности (условно).`), { bed: 1 });
  runsOf.water = ptsY(polys('water'), constY(D.water));
  buildRuns(runsOf.water, def.water.r, pipeM(def.water.c), cat.water, netObj('water', 'В1', `Ось — ${fmt(D.water)} м (условно). Участки в футляре — по обозначению ГП-005. v0.36: по легенде ГП-005 голубая линия — «Водопровод хоз-питьевой производственный подземный» (В1; слой листа назван «Всасывающие_трубопроводы», но цвет и легенда — В1): ввод с юго-востока → вдоль восточной границы → 401 и РПВ 654. Участки у въездов (x ≈ −93,6 и 88,7, к югу от ограждения) — «Участок выноса существующего водопровода, переносной» (В0).`), { bed: 1 });
  // К3 — самотёк с уклоном к 798
  runsOf.kpd = k3Profile(polys('kpd'));
  const k3o = netObj('kpd', 'К3', '');
  k3o.note = SRC + (K3.ok ? ` Самотёчная сеть: уклон к очистным 798 принят i ≈ ${fmt(K3.i * 1000, 0)} ‰ так, чтобы заглубление оси в верховьях было не менее ${fmt(D.kpd)} м, а у входа в 798 ось была на 0,3 м ниже верха сооружения (низ 798 — по отметке 292,74 на ГП-005). Маршрут стоков: К3-15 → К3-16 → К3-17 → 798 → К3-18 → 752 (АК-005). Номера колодцев к символам не привязаны.` : '') +
    ' Почти вся К3 на ГП-005 начерчена «в футляре» (две линии вдоль трассы) — показан футляр; возможное иное прочтение (ж/б лоток) требует подтверждения по НВК. ' + NOTE_DEPTH;
  buildRuns(runsOf.kpd, def.kpd.r, pipeM(def.kpd.c), cat.kpd, k3o, { bed: 1 });
  // К1 — хоз-бытовая
  runsOf.k1 = ptsY(polys('k1'), constY(D.k1));
  buildRuns(runsOf.k1, def.k1.r, pipeM(def.k1.c), cat.k1, netObj('k1', 'К1', `Ось — ${fmt(D.k1)} м (условно). v0.36: трасса — по слою листа 03-4_Наружные_сети_канализации (знак «К1» легенды): выпуск от служебно-бытового корпуса 401 к прямоугольному сооружению 2,4 × 2,4 м (тип на листе не подписан), 11,3 м. Прежние участки у эстакады 177, цеха 200 и вдоль путей удалены — это существующий трубопровод дизтоплива топоосновы ГП-002 того же цвета.`), { bed: 1 });
  // Технологические трубопроводы под проездами — в футляре
  for (const k of ['dtl', 'dtz', 'b', 'd', 'gu']) {
    runsOf[k] = ptsY(polys(k), constY(D.tech));
    const nm = { dtl: 'ДТ(Л)', dtz: 'ДТ(З)', b: 'Б', d: 'Д', gu: 'Гу' }[k];
    buildRuns(runsOf[k], def[k].r, pipeM(def[k].c), cat.tech, { id: nm, net: 1, short: nm, name: nm + ' — переход под проездом', note: 'Подземные участки технологического трубопровода — переходы под проездами в футляре (по ГП-005). Глубина оси ' + fmt(D.tech) + ' м и футляр — условно.' }, { allCas: 1 });
  }
  // Теплосеть — подземные участки: двухтрубная прокладка (подача/обратка) в ППУ-изоляции (условно)
  {
    const r0 = def.heat.r, off = r0 * 1.5 + 0.1, o = { id: 'Т', net: 1, name: 'Тепловая сеть — подземные участки (подающий и обратный)', note: 'Участки и точки подъёма/опуска — по ГП-005 (зелёные точки на трассе теплосети). Способ прокладки на листе не указан: показана бесканальная двухтрубная прокладка в ППУ-изоляции, ось ' + fmt(D.heat) + ' м — условно.' };
    for (const s of [-1, 1]) {
      const runs = polys('heat').map(p => {
        const out = [];
        for (let i = 0; i < p.pts.length; i++) {      // смещение по нормали (средней в изломах)
          const a = p.pts[Math.max(0, i - 1)], b = p.pts[Math.min(p.pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
          out.push([p.pts[i][0] - dz / L * off * s, p.pts[i][1] + dx / L * off * s]);
        }
        return { cas: 0, pts: out };
      });
      runsOf['heat' + s] = ptsY(runs, constY(D.heat));
      buildRuns(runsOf['heat' + s], r0 * 1.5, ppuM, cat.heat, o, { bed: 1 });
    }
  }
  // Кабели в траншее: подушка, кабель, сигнальная лента; переходы в а/ц трубах; точки подъёма/опуска
  {
    const cab = ['el', 'cab1', 'cab2', 'eh'];
    for (const k of cab) {
      runsOf[k] = ptsY(polys(k), constY(D.cab), 4);
      const nm = def[k].name;
      const segs = buildRuns(runsOf[k], def[k].r * 0.7, pipeM(def[k].c), cat.cab, { id: 'каб', net: 1, name: nm + ' — в траншее', note: 'Трасса — по ГП-005 («в траншее», пунктир). Глубина ' + fmt(D.cab) + ' м, песчаная подушка и сигнальная лента — условно (типовая прокладка в земле).' }, { bed: 0 });
      const it = inst(gBox, tapeM, segs.length, cat.cab), ib = inst(gBox, sandM, segs.length, cat.cab);
      segs.forEach(([a, b], i) => {
        v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); v3.normalize(); q.setFromUnitVectors(xAx, v3);
        m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.25, (a[2] + b[2]) / 2), q, s3.set(L, 0.01, 0.2)); it.setMatrixAt(i, m4);
        m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.08, (a[2] + b[2]) / 2), q, s3.set(L, 0.1, 0.4)); ib.setMatrixAt(i, m4);
      });
    }
    const ao = { id: 'а/ц', net: 1, name: 'Асбестоцементная труба — переход кабеля под проездом', note: 'Положение и длина — по ГП-005 (красные прямоугольники «в а/ц трубах», секции по 3,0 м). Диаметр трубы и глубина — условно.' };
    const ia = inst(gTube, acM, UG_DATA.ac.length, cat.cab, ao);
    UG_DATA.ac.forEach(([x, z, L, W, a], i) => {
      v3.set(Math.cos(a), 0, Math.sin(a)); q.setFromUnitVectors(up, v3);
      m4.compose(p3.set(x, hAt(x, z) - D.cab, z), q, s3.set(Math.min(W, 0.5) * 0.18, L, Math.min(W, 0.5) * 0.18)); ia.setMatrixAt(i, m4);
    });
  }

  /* ---------- 4. Стояки в точках подъёма/опуска: надземная часть видна всегда ---------- */
  function risers(list, yLow, yHigh, rad, mat, o, both) {
    const ib = inst(gCyl, mat, list.length, cat[both.cat], o), ia = inst(gCyl, mat, list.length, surf, o), ie = inst(gSph, mat, list.length, cat[both.cat]);
    list.forEach(([x, z], i) => {
      const gy = hAt(x, z), lo = yLow(x, z), hi = yHigh(x, z);
      m4.compose(p3.set(x, (lo + gy) / 2, z), one, s3.set(rad, gy - lo, rad)); ib.setMatrixAt(i, m4);
      m4.compose(p3.set(x, (gy + hi) / 2, z), one, s3.set(rad, Math.max(hi - gy, 0.01), rad)); ia.setMatrixAt(i, m4);
      m4.compose(p3.set(x, lo, z), one, s3.set(rad, rad, rad)); ie.setMatrixAt(i, m4);
    });
  }
  // стыки подземных и надземных участков одной сети (В2, В10, технологические)
  const junctions = k => {
    const ov = new Set(); for (const s of NETS[k]) if (!s[4]) { ov.add(key(s[0], s[1])); ov.add(key(s[2], s[3])); }
    const res = new Map();
    for (const p of polys(k)) for (const e of [p.pts[0], p.pts[p.pts.length - 1]]) {
      if (ov.has(key(e[0], e[1]))) { res.set(key(e[0], e[1]), e); continue; }
      for (const s of NETS[k]) if (!s[4]) for (const [a, b] of [[s[0], s[1]], [s[2], s[3]]]) if (Math.hypot(a - e[0], b - e[1]) < 0.25) res.set(key(e[0], e[1]), e);
    }
    return [...res.values()];
  };
  for (const [k, c, d] of [['pv', 'pv', D.pv], ['prp', 'prp', D.prp], ['dtl', 'tech', D.tech], ['dtz', 'tech', D.tech], ['b', 'tech', D.tech], ['d', 'tech', D.tech], ['gu', 'tech', D.tech]]) {
    const J = junctions(k); if (!J.length) continue;
    risers(J, (x, z) => hAt(x, z) - d, (x, z) => hAt(x, z) + (def[k].ay || 0.6), def[k].r, pipeM(def[k].c),
      { id: 'стояк', net: 1, name: def[k].name + ' — подъём/опуск трубы', note: 'Стык подземного и надземного участков трассы по ГП-005. Отметка низа — по условной глубине.' }, { cat: c });
  }
  // теплосеть: зелёные точки ГП-005 — две трубы в ППУ
  {
    const o = { id: 'Т', net: 1, name: 'Тепловая сеть — точка подъёма/опуска', note: 'Положение — по ГП-005 (зелёная точка «точка подъёма, опуска трубы» на трассе теплосети). Конструкция (ППУ, две трубы) — условно.' };
    const pts = [];
    for (const [x, z] of UG_DATA.riseHeat) {   // направление трассы у точки — по ближайшему подземному участку
      let best = null, bd = 1.2;
      for (const p of polys('heat')) for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(ax + t * dx - x, az + t * dz - z); if (d < bd) { bd = d; best = [dx, dz, ax + t * dx, az + t * dz]; }
      }
      const [dx, dz, sx, sz] = best || [1, 0, x, z], L = Math.hypot(dx, dz) || 1, off = def.heat.r * 1.5 + 0.1;
      for (const s of [-1, 1]) pts.push([sx - dz / L * off * s, sz + dx / L * off * s]);
    }
    risers(pts, (x, z) => hAt(x, z) - D.heat, (x, z) => hAt(x, z) + def.heat.ay, def.heat.r * 1.5, ppuM, o, { cat: 'heat' });
  }
  // кабели: синие точки ГП-005 — защитная труба до 2 м над землёй (условно — типовое требование ПУЭ)
  risers(UG_DATA.riseEl, (x, z) => hAt(x, z) - D.cab, (x, z) => hAt(x, z) + 2.0, 0.045, steelM,
    { id: 'каб', net: 1, name: 'Точка подъёма/опуска кабеля', note: 'Положение — по ГП-005 (синие точки на трассах электроснабжения у переходов в а/ц трубах). Стальная защитная труба на высоту 2 м от земли — по типовому требованию ПУЭ, на листе не показана (условно).' }, { cat: 'cab' });

  /* ---------- 5. Колодцы: сборные ж/б кольца КС (условно), плиты, горловина, ходовые скобы ---------- */
  const WN = { kpd: ['К3', 'Колодец канализации К3'], k1: ['К1', 'Колодец канализации К1'], water: ['В1', 'Колодец водопроводный В1'], pv: ['В2', 'Колодец противопожарного водопровода В2'], prp: ['В10', 'Колодец пенорастворопровода В10'] };
  function yNear(k, x, z) {   // отметка оси ближайшей трубы сети в колодце
    const runs = k === 'kpd' ? runsOf.kpd : runsOf[k] || [];
    let best = null, bd = 6;
    for (const r of runs) for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / L2));
      const d = Math.hypot(a[0] + t * dx - x, a[2] + t * dz - z); if (d < bd) { bd = d; best = a[1] + (b[1] - a[1]) * t; }
    }
    return best !== null ? best : hAt(x, z) - (D[k] || 1.8);
  }
  {
    const W = WELLS_DATA.map(([x, z, w, k]) => {
      const gy = hAt(x, z), ya = yNear(k, x, z), r = def[k] ? def[k].r : 0.1, bot = ya - r - 0.45, slabTop = gy - 0.4, ringTop = slabTop - 0.15;
      return { x, z, w, k, gy, ya, bot, slabTop, ringTop, H: ringTop - bot };
    });
    const wObj = i => { const w = W[i], [code, nm] = WN[w.k] || ['К', 'Колодец'];
      return { id: code, net: 1, well: { k: w.k, x: w.x, z: w.z, w: w.w }, name: nm + ' Ø' + fmt(w.w) + ' м', note: 'Положение и диаметр — по символу на ГП-005. Глубина шахты ≈ ' + fmt(w.gy - w.bot) + ' м — от условной отметки трубы' + (w.k === 'kpd' ? ' (профиль К3 к 798)' : '') + '. Конструкция (кольца КС высотой 0,9 м, плиты днища и перекрытия, горловина Ø0,7 м, ходовые скобы) — типовая, условно. Номер колодца и оборудование (задвижки, гидранты) на листе не указаны.' }; };
    const ish = inst(gCylO, concM, W.length, cat.wells, wObj), isb = inst(gCyl, concS, W.length, cat.wells, wObj), ict = inst(gCyl, concS, W.length, cat.wells, wObj), ink = inst(gCylO, concM, W.length, cat.wells, wObj);
    const JT = [], RG = [];   // стыки колец (через 0,9 м) и ходовые скобы (через 0,3 м)
    for (const w of W) {
      const R = w.w / 2 + 0.08;
      for (let y = w.bot + 0.9; y < w.ringTop - 0.05; y += 0.9) JT.push([w.x, y, w.z, R + 0.012]);
      for (let y = w.slabTop - 0.3; y > w.bot + 0.35; y -= 0.3) RG.push([w.x + w.w / 2 - 0.06, y, w.z]);
    }
    const ij = inst(gCylO, jointM, JT.length, cat.wells), ir = inst(gBox, rungM, RG.length, cat.wells);
    JT.forEach(([x, y, z, R], i) => { m4.compose(p3.set(x, y, z), one, s3.set(R, 0.03, R)); ij.setMatrixAt(i, m4); });
    RG.forEach(([x, y, z], i) => { m4.compose(p3.set(x, y, z), one, s3.set(0.08, 0.02, 0.3)); ir.setMatrixAt(i, m4); });
    W.forEach((w, i) => {
      const R = w.w / 2 + 0.08;
      m4.compose(p3.set(w.x, w.bot + w.H / 2, w.z), one, s3.set(R, w.H, R)); ish.setMatrixAt(i, m4);
      m4.compose(p3.set(w.x, w.bot - 0.06, w.z), one, s3.set(R + 0.1, 0.12, R + 0.1)); isb.setMatrixAt(i, m4);
      m4.compose(p3.set(w.x, w.ringTop + 0.075, w.z), one, s3.set(R + 0.1, 0.15, R + 0.1)); ict.setMatrixAt(i, m4);
      m4.compose(p3.set(w.x, (w.slabTop + w.gy) / 2, w.z), one, s3.set(0.42, w.gy - w.slabTop, 0.42)); ink.setMatrixAt(i, m4);
    });
    stats.wells = W.length;
    // прямоугольные колодцы/приямки (символы ГП-005)
    const RN = { kpd: 'Прямоугольный приямок на площадке РГС 116.1–4 с выпуском в сеть К3', k1: 'Прямоугольное сооружение на сети К1 (2,4 × 2,4 м)', water: 'Прямоугольный водопроводный колодец В1 — в точке подключения к участку выноса существующего водопровода' };
    const RR = UG_DATA.rect.map(([x, z, L, Wd, a, k]) => { const gy = hAt(x, z), ya = yNear(k, x, z); return { x, z, L, Wd, a, k, gy, bot: ya - (def[k] ? def[k].r : 0.1) - 0.45 }; });
    const rObj = i => { const r = RR[i]; return { id: (WN[r.k] || ['К'])[0], net: 1, well: { k: r.k, x: r.x, z: r.z, w: Math.max(r.L, r.Wd), rect: 1 }, name: RN[r.k], note: 'Положение и габарит в плане (' + fmt(r.L, 2) + ' × ' + fmt(r.Wd, 2) + ' м) — по символу ГП-005; назначение и тип на листе не подписаны. Глубина ≈ ' + fmt(r.gy - r.bot) + ' м и конструкция — условно.' }; };
    const irw = inst(gBox, concM, RR.length, cat.wells, rObj), irb = inst(gBox, concS, RR.length, cat.wells, rObj), irs = inst(gBox, concS, RR.length, PIPED.wells, rObj), irl = inst(gCyl, PIPED.wellLid, RR.length, PIPED.wells, rObj);
    RR.forEach((r, i) => {
      const H = r.gy - 0.12 - r.bot; q.setFromAxisAngle(up, -r.a);
      m4.compose(p3.set(r.x, r.bot + H / 2, r.z), q, s3.set(r.L, H, r.Wd)); irw.setMatrixAt(i, m4);
      m4.compose(p3.set(r.x, r.bot - 0.06, r.z), q, s3.set(r.L + 0.2, 0.12, r.Wd + 0.2)); irb.setMatrixAt(i, m4);
      m4.compose(p3.set(r.x, r.gy - 0.04, r.z), q, s3.set(r.L + 0.16, 0.16, r.Wd + 0.16)); irs.setMatrixAt(i, m4);      // плита перекрытия заподлицо с покрытием
      m4.compose(p3.set(r.x, r.gy + 0.045, r.z), one, s3.set(0.32, 0.03, 0.32)); irl.setMatrixAt(i, m4);              // люк
    });
  }

  /* ---------- 6. Подземные ёмкости и РПВ ---------- */
  {
    const capG = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const tObj = k => { const t = TK[k]; return { id: k, net: 1, name: t.name + ' — подземная часть', note: t.mark + '. ' + (t.h !== undefined
      ? `Заглубление верхней образующей ${fmt(t.h)} м — по обозначению ЕП (h = ${Math.round(t.h * 1000)} мм), что согласуется с H по АК-004 (горловина выступает ≈0,36 м). Ось ${t.ax === 'x' ? '— вдоль X листа' : '— вдоль длинной стороны контура'}${k === '139.1' ? ' (контур на плане квадратный — ориентация условна)' : ''}. Покрытие, ложемент, горловина — условно.`
      : `Габарит в плане — по ГП-002/005 (${fmt(t.L, 2)} × ${fmt(t.D, 2)} м); низ принят по отметке ${k === '752' ? '292,206' : '292,74'} у сооружения на ГП-005 (что обозначает отметка — на листе не указано). Форма (горизонтальный цилиндр), материал и шахта горловины — условно.`) };
    };
    for (const [k, t] of Object.entries(TK)) {
      const o = tObj(k), g = new THREE.Group(); cat.tanks.add(g);
      const along = t.ax === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), mt = t.h !== undefined ? tankM : tank2M, R = t.D / 2;
      const body = new THREE.Mesh(gCyl, mt); body.scale.set(R, t.L - t.D * 0.25, R); body.quaternion.setFromUnitVectors(up, along); body.position.set(t.cx, t.axY, t.cz);
      body.userData.o = o; pickables.push(body); g.add(body);
      for (const s of [-1, 1]) {   // эллиптические днища
        const cap = new THREE.Mesh(capG, mt); cap.scale.set(R, t.D * 0.25, R); cap.quaternion.setFromUnitVectors(up, along.clone().multiplyScalar(s));
        cap.position.set(t.cx + along.x * s * (t.L - t.D * 0.25) / 2, t.axY, t.cz + along.z * s * (t.L - t.D * 0.25) / 2); cap.userData.o = o; pickables.push(cap); g.add(cap);
      }
      const slab = new THREE.Mesh(gBox, concS); slab.scale.set(t.ax === 'x' ? t.L + 0.6 : t.D + 0.6, 0.3, t.ax === 'x' ? t.D + 0.6 : t.L + 0.6); slab.position.set(t.cx, t.bot - 0.15, t.cz); g.add(slab);
      const neckTop = t.h !== undefined ? t.gy + 0.36 : Math.max(t.gy, 0.8);
      const neck = new THREE.Mesh(gCyl, t.h !== undefined ? mt : concM); neck.scale.set(0.42, neckTop - t.top + 0.05, 0.42); neck.position.set(t.cx, (neckTop + t.top) / 2, t.cz); neck.userData.o = o; pickables.push(neck); g.add(neck);
      stats.tanks++;
    }
    // РПВ 654.1 / 654.2 — монолитные ж/б резервуары под обсыпкой (КЖ-20)
    const RV = { in: [11.72, 21.0], wall: 0.3, floor: 295.80 - H0, hIn: 900 / (11.72 * 21.0), roof: 0.25 };
    const x0 = P(4155, 0)[0];
    for (const [id, pyC, hz] of [['654.2', 2915, [2820, 3010]], ['654.1', 3295, [3200, 3390]]]) {
      const zc = P(0, pyC)[1], o = { id, net: 1, name: 'Резервуар противопожарного запаса воды V=900 м³ (поз. ' + id + ') — подземная часть', note: 'План котлована 5632.29-654.1-654.2-КЖ-20: резервуар 21,0 × 11,72 м (по осям), между резервуарами 3,0 м, отм. дна 0,000 = 295,80; обсыпка до 300,38 (ГП-003). Высота ≈ ' + fmt(RV.hIn, 2) + ' м — расчётно по объёму 900 м³; толщина стен ' + fmt(RV.wall) + ' м и плит — условно (листов КЖ с конструкцией в комплекте нет).' };
      const g = new THREE.Group(); cat.tanks.add(g);
      const Wx = RV.in[0] + RV.wall * 2, Wz = RV.in[1] + RV.wall * 2, yF = RV.floor, yR = yF + RV.hIn;
      const box = (sx, sy, sz, x, y, z, m) => { const me = new THREE.Mesh(gBox, m); me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.userData.o = o; pickables.push(me); g.add(me); return me; };
      box(Wx + 0.4, 0.3, Wz + 0.4, x0, yF - 0.15, zc, concS);                                   // днище
      box(Wx, RV.roof, Wz, x0, yR + RV.roof / 2, zc, concM);                                     // покрытие
      for (const s of [-1, 1]) { box(RV.wall, RV.hIn, Wz, x0 + s * (Wx - RV.wall) / 2, yF + RV.hIn / 2, zc, concM); box(Wx - RV.wall * 2, RV.hIn, RV.wall, x0, yF + RV.hIn / 2, zc + s * (Wz - RV.wall) / 2, concM); }
      for (const py of hz) { const z = P(0, py)[1], top = 300.38 - H0; const n = new THREE.Mesh(gCyl, concM); n.scale.set(0.55, top - yR, 0.55); n.position.set(x0, (top + yR) / 2, z); n.userData.o = o; pickables.push(n); g.add(n); }
      stats.tanks++;
    }
  }

  /* ---------- 7. Режим: прозрачная земля, обрезка рельефа по блоку, легенда ---------- */
  const traces = [];   // прежние «пунктирные» следы подземных участков на поверхности (v0.2) — отдельный слой, по умолчанию выключен
  for (const g of Object.values(netLayers)) g.children.forEach(c => { if (c.isInstancedMesh && c.material && c.material.transparent) traces.push(c); });
  let state = false, opac = 0.3;
  const trackMats = new Set(); tracks.traverse(o => { if (o.material) for (const m of [].concat(o.material)) trackMats.add(m); });   // ж/д пути за границей блока — обрезать
  function fade(on) {
    for (const m of [TERR && TERR.material, MOUND_MESH && MOUND_MESH.material]) if (m) {
      m.transparent = on; m.opacity = on ? opac : 1; m.depthWrite = !on; m.clippingPlanes = on && m === TERR.material ? CLIP : null; m.needsUpdate = true;
    }
    for (const m of trackMats) { m.clippingPlanes = on ? CLIP : null; m.needsUpdate = true; }
    ground.visible = on ? false : (layerApi ? layerApi.isOn('ground') : true);
    if (on) for (const t of traces) t.visible = false; else if (layerApi) for (const t of traces) t.visible = layerApi.isOn('ugtrace');
  }
  // панель-легенда режима
  const ugp = document.getElementById('ugp');
  const ROWS = [
    ['pv', 'В2 — противопожарный водопровод', def.pv.c, `ось ${fmt(D.pv)} м*`], ['prp', 'В10 — пенорастворопровод', def.prp.c, `ось ${fmt(D.prp)} м*`],
    ['water', 'В1 — водопровод хоз-питьевой произв.', def.water.c, `ось ${fmt(D.water)} м*`],
    ['kpd', 'К3 — производственно-дождевая', def.kpd.c, K3.ok ? `самотёк ${fmt(K3.i * 1000, 0)} ‰*` : `ось ${fmt(D.kpd)} м*`], ['k1', 'К1 — хоз-бытовая', def.k1.c, `ось ${fmt(D.k1)} м*`],
    ['heat', 'Теплосеть — подземные участки', def.heat.c, `ось ${fmt(D.heat)} м*`], ['tech', 'ДТ, Б, Д, Гу — переходы в футляре', def.dtl.c, `ось ${fmt(D.tech)} м*`],
    ['cab', 'Кабели в траншее и а/ц трубах', def.el.c, `${fmt(D.cab)} м*`], ['wells', 'Колодцы (шахты)', 0x9b978d, ''],
    ['tanks', 'Ёмкости ДЕ-1, ДЕ-2, 752, 798, РПВ', 0x2a2d30, ''], ['soil', 'Разрез грунта (скв. №10)', 0xb08a58, '']
  ];
  ugp.innerHTML = '<div class="uh"><b>Подземные сети</b><button class="lbtn" id="ugMin" title="Свернуть/развернуть">▾</button><button class="lbtn" id="ugX" title="Выйти из режима">✕</button></div><div id="ugB">' +
    ROWS.map(([k, n, c, d]) => `<label><input type="checkbox" data-ug="${k}" checked><i style="background:#${c.toString(16).padStart(6, '0')}"></i><span>${n}</span><em>${d}</em></label>`).join('') +
    '<label class="op">Земля<input type="range" id="ugOp" min="0" max="0.7" step="0.02" value="' + opac + '"></label>' +
    '<div class="nt">* Глубины и диаметры — условные: продольных профилей в документации нет. Трассы, колодцы, футляры, точки подъёма — по ГП-005.</div>' +
    '<div class="nt">Щелчок по люку или шахте колодца — подсветка трассы его сети (v0.36).</div></div>';
  ugp.querySelectorAll('[data-ug]').forEach(cb => cb.onchange = () => { cat[cb.dataset.ug].visible = cb.checked; });
  document.getElementById('ugOp').oninput = e => { opac = +e.target.value; if (state) fade(true); };
  document.getElementById('ugX').onclick = () => setMode(false);
  document.getElementById('ugMin').onclick = () => { const b = document.getElementById('ugB'), hid = b.style.display === 'none'; b.style.display = hid ? '' : 'none'; document.getElementById('ugMin').textContent = hid ? '▾' : '▸'; };
  if (matchMedia('(max-width:700px)').matches) { document.getElementById('ugB').style.display = 'none'; document.getElementById('ugMin').textContent = '▸'; }
  const bUG = document.getElementById('bUG');
  function setMode(on) {
    if (layerApi) layerApi.setVis('ugsec', on); else root.visible = on;
    apply();
    if (on) {   // при виде строго сверху — наклонить камеру, чтобы читались глубины
      v3.copy(camera.position).sub(controls.target); const sp = new THREE.Spherical().setFromVector3(v3);
      if (sp.phi < 0.5) { sp.phi = 0.95; sp.radius = Math.min(sp.radius, 160); v3.setFromSpherical(sp).add(controls.target); flyTo([v3.x, v3.y, v3.z], [controls.target.x, controls.target.y, controls.target.z]); }
      toast('Режим «Подземные сети»: земля полупрозрачна, рельеф обрезан по границе площадки. Глубины — условные.', 'ok');
    }
  }
  function apply() {
    state = root.visible; fade(state);
    bUG.classList.toggle('on', state); ugp.style.display = state ? 'block' : 'none';
  }
  bUG.onclick = () => setMode(!root.visible);
  root.visible = false;
  return { root, surf, cat, traces, stats, runsOf, setMode, isOn: () => state, tick() { if (root.visible !== state) apply(); else if (state && ground.visible) ground.visible = false; } };
})();


