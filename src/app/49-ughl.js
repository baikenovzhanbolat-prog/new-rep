/* =====================================================================================
   v0.36 — ПОДСВЕТКА ТРАССЫ СЕТИ ПО ЛЮКУ КОЛОДЦА (модуль UGHL)
   Щелчок по люку (на поверхности) или по шахте (режим «Подземные сети») → сеть колодца (В2, В10, В1, К3, К1)
   и связная часть её трассы. Связность — по модели трубопроводов PNET (надземные участки ГП-005, подземные трассы UGN,
   узлы, врезки, подъёмы/опуски), только в пределах своей сети; дополнительно трубы своей сети, подходящие к одной шахте
   (≤ R + 0,35 м), считаются соединёнными через колодец. Данные сетей модуль не меняет.
   Показ: труба «на просвет» (видна сквозь грунт и покрытия), след трассы на поверхности (пунктир — подземный участок,
   сплошная — надземный, как в условных обозначениях ГП-005), кольца на колодцах выделенной части, маяк над выбранным
   люком, метка с кодом сети. Карточка колодца: сеть, длина, число колодцев, число несвязанных частей сети в модели.
   ===================================================================================== */
const UGHL = (() => {
  const G = new THREE.Group(); G.name = 'ughl'; G.visible = false; scene.add(G);
  const CODE = { pv: 'В2', prp: 'В10', water: 'В1', kpd: 'К3', k1: 'К1' };
  const NAME = { pv: 'противопожарный водопровод', prp: 'пенорастворопровод', water: 'водопровод хоз-питьевой производственный', kpd: 'канализация производственно-дождевая', k1: 'канализация хоз-бытовая' };
  const defOf = Object.fromEntries(NET_DEF.map(d => [d.k, d]));
  const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
  const dPlan = (pts, x, z) => {
    if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][2] - z);
    let b = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i + 1], dx = c[0] - a[0], dz = c[2] - a[2], L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / L2));
      b = Math.min(b, Math.hypot(a[0] + t * dx - x, a[2] + t * dz - z));
    }
    return b;
  };
  const plen = p => { let L = 0; for (let i = 0; i < p.pts.length - 1; i++) L += Math.hypot(p.pts[i + 1][0] - p.pts[i][0], p.pts[i + 1][1] - p.pts[i][1], p.pts[i + 1][2] - p.pts[i][2]); return L; };
  const P = () => window.__PNET;

  /* ---------- связность (только своя сеть) ---------- */
  let ADJ = null;
  const PASS = { kpd: ['798', '752'] };   // сооружения, через которые сеть проходит по документации (АК-005)
  function adj() {
    if (ADJ) return ADJ;
    ADJ = new Map();
    const link = (a, b) => { if (!a || !b || a === b || a.net !== b.net) return; (ADJ.get(a) || ADJ.set(a, new Set()).get(a)).add(b); (ADJ.get(b) || ADJ.set(b, new Set()).get(b)).add(a); };
    for (const n of P().nodes) { const ps = n.ends.map(e => e.s.pipe); if (n.tee && n.tee.pipe) ps.push(n.tee.pipe); for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) link(ps[i], ps[j]); }
    const viaWell = (x, z, rr, k) => {   // соединение через шахту колодца / камеру
      const near = P().pipes.filter(p => p.net === k && p.pts && p.pts.length && dPlan(p.pts, x, z) <= rr);
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) link(near[i], near[j]);
    };
    for (const [x, z, w, k] of WELLS_DATA) viaWell(x, z, w / 2 + 0.35, k);
    for (const [x, z, L, W, a, k] of (UG_DATA.rect || [])) viaWell(x, z, Math.max(L, W) / 2 + 0.35, k);
    // К3: связь через очистные 798 и сборник 752 — по АК-005 (К3-17 → 798 → К3-18 → 752)
    const ST = new Map();
    for (const n of P().nodes) if (n.ends.length === 1 && n.eq && n.eq.name) {
      const p = n.ends[0].s.pipe, m = /№ (\d+(?:\.\d+)?)/.exec(n.eq.name); if (!p || !m) continue;
      const key = (PASS[p.net] || []).includes(m[1]) ? p.net + ':' + (PASS[p.net].length > 1 ? 'grp' : m[1]) : null; if (!key) continue;
      (ST.get(key) || ST.set(key, []).get(key)).push(p);
    }
    for (const list of ST.values()) for (let i = 1; i < list.length; i++) link(list[0], list[i]);
    return ADJ;
  }
  const bfs = seeds => { const A = adj(), out = new Set(seeds), q = [...seeds]; while (q.length) { const c = q.pop(); for (const x of A.get(c) || []) if (!out.has(x)) { out.add(x); q.push(x); } } return out; };
  const PARTS = {};
  function partsOf(k) {   // несвязанные части сети в модели
    if (PARTS[k]) return PARTS[k];
    const all = P().pipes.filter(p => p.net === k && p.pts && p.pts.length > 1), seen = new Set(), parts = [];
    for (const p of all) if (!seen.has(p)) { const c = bfs([p]); c.forEach(x => seen.add(x)); const len = [...c].reduce((s, x) => s + plen(x), 0); if (len > 0.05) parts.push({ pipes: [...c], len }); }   // точечные трассы (нулевой длины) не считаются
    parts.sort((a, b) => b.len - a.len);
    return (PARTS[k] = parts);
  }
  function compOf(well) {
    if (!P() || !P().pipes || !CODE[well.k]) return null;
    const k = well.k, R = well.w / 2 + 0.6;
    let seeds = P().pipes.filter(p => p.net === k && p.pts && p.pts.length > 1 && dPlan(p.pts, well.x, well.z) <= R);
    let far = 0;
    if (!seeds.length) {   // нет трубы у колодца — ближайшая труба своей сети в пределах 3 м
      let best = null, bd = 3; for (const p of P().pipes) if (p.net === k && p.pts && p.pts.length > 1) { const d = dPlan(p.pts, well.x, well.z); if (d < bd) { bd = d; best = p; } }
      if (!best) return { k, pipes: [], len: 0, lenU: 0, lenO: 0, wells: [], rects: [], parts: partsOf(k), part: -1, far: 0 };
      seeds = [best]; far = bd;
    }
    const pipes = [...bfs(seeds)];
    let lenU = 0, lenO = 0; for (const p of pipes) { const L = plen(p); if (p.under) lenU += L; else lenO += L; }
    const near = (x, z, r) => pipes.some(p => dPlan(p.pts, x, z) <= r);
    const wells = WELLS_DATA.map(([x, z, w, kk], i) => ({ x, z, w, k: kk, i })).filter(w => w.k === k && near(w.x, w.z, w.w / 2 + 0.6));
    const rects = (UG_DATA.rect || []).map(([x, z, L, W, a, kk]) => ({ x, z, w: Math.max(L, W), k: kk })).filter(r => r.k === k && near(r.x, r.z, r.w / 2 + 0.6));
    const parts = partsOf(k), part = parts.findIndex(pt => pt.pipes.includes(pipes[0]));
    const PS = new Set(pipes), ends = new Map(); let open = 0;   // концы трассы: вводы в сооружения, открытые концы
    for (const n of P().nodes) if (n.ends.length === 1 && PS.has(n.ends[0].s.pipe)) {
      if (n.kind === 'открытый конец') open++;
      else if (n.eq && n.eq.name && n.eq.kind !== 'колодец' && !/^Камера/.test(n.eq.name)) { const nm = n.eq.name.replace(/\s*\(.*$/, ''); ends.set(nm, (ends.get(nm) || 0) + 1); }
    }
    const via = (PASS[k] || []).filter(id => [...ends.keys()].some(nm => nm.startsWith('№ ' + id + ' ')));
    return { k, pipes, len: lenU + lenO, lenU, lenO, wells, rects, parts, part, far, ends: [...ends.keys()], open, via };
  }

  /* ---------- графика: ширина линий постоянна на экране (≥ реального диаметра вблизи) ---------- */
  const SH_TUBE = 'uniform float uK; uniform float uMin; uniform float uPx;\n' +
    'void main() { vec3 c = position - normal; vec4 mv = modelViewMatrix * vec4(c, 1.0); float w = max(uMin, uK * uPx * max(-mv.z, 0.1));\n' +
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + normal * w, 1.0); }';
  const SH_RIB = 'attribute vec3 side; uniform float uK; uniform float uMin; uniform float uPx; varying float vU;\n' +
    'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float w = max(uMin, uK * uPx * max(-mv.z, 0.1)); vU = uv.x;\n' +
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + side * w, 1.0); }';
  const SH_FRAG = 'uniform vec3 uC; uniform float uO; uniform float uDash; varying float vU;\n' +
    'void main() { if (uDash > 0.5 && fract(vU) > 0.62) discard; gl_FragColor = vec4(uC, uO); }';
  const SH_FRAG_T = 'uniform vec3 uC; uniform float uO; void main() { gl_FragColor = vec4(uC, uO); }';
  const srgb = c => new THREE.Vector3(c.r, c.g, c.b);    // цвет без преобразований: шейдер пишет его как есть
  const vivid = hex => { const c = new THREE.Color(hex), h = {}; c.getHSL(h, THREE.SRGBColorSpace); c.setHSL(h.h, Math.max(h.s, 0.7), Math.min(0.62, Math.max(h.l, 0.52)), THREE.SRGBColorSpace); return c.getStyle(THREE.SRGBColorSpace); };
  const css2c = st => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(st.replace(/\s/g, '')); return m ? { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255 } : { r: 1, g: 0.8, b: 0 }; };
  const shMat = (vs, fs, rgb, op, px, min, opt = {}) => new THREE.ShaderMaterial({
    uniforms: { uC: { value: srgb(rgb) }, uO: { value: op }, uK: { value: 0.002 }, uMin: { value: min }, uPx: { value: px }, uDash: { value: opt.dash ? 1 : 0 } },
    vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: !!opt.depth, side: THREE.DoubleSide,
    polygonOffset: !!opt.depth, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const gRing = new THREE.RingGeometry(0.62, 1, 40); gRing.rotateX(-Math.PI / 2);
  const gBeam = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); gBeam.translate(0, 0.5, 0);
  let cur = null, curWell = null, mats = [], shM = [], coreM = null, label = null, labelPos = null, t0 = 0, rings = [], ringIM = null, selRing = null, beam = null;
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v0 = new THREE.Vector3(), s0 = new THREE.Vector3();
  const pxK = () => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, innerHeight);   // метров на пиксель на расстоянии 1 м
  const setRings = (k, pulse) => {
    if (!ringIM) return;
    rings.forEach(([x, y, z, R], i) => { const d = camera.position.distanceTo(v0.set(x, y, z)), Rs = Math.max(R, 9 * k * d); ringIM.setMatrixAt(i, m4.compose(v0, q0, s0.setScalar(Rs * (1 + 0.08 * pulse)))); });
    ringIM.instanceMatrix.needsUpdate = true;
  };
  function clear() {
    for (const c of [...G.children]) { if (c.geometry !== gRing && c.geometry !== gBeam) c.geometry.dispose(); if (c.isInstancedMesh) c.dispose(); G.remove(c); }
    for (const m of mats) m.dispose(); mats = []; shM = []; coreM = null; rings = []; ringIM = null; selRing = null; beam = null;
    cur = null; curWell = null; G.visible = false; labelPos = null; if (label) label.style.display = 'none';
  }
  function merge(geos, names) {   // слияние индексированных геометрий — один вызов отрисовки на слой
    let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const A = {}; for (const n of names) A[n] = new Float32Array(nv * geos[0].attributes[n].itemSize);
    const idx = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      for (const nm of names) A[nm].set(g.attributes[nm].array, ov * g.attributes[nm].itemSize);
      if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov; oi += I.length; } else { for (let i = 0; i < n; i++) idx[oi + i] = ov + i; oi += n; }
      ov += n; g.dispose();
    }
    const out = new THREE.BufferGeometry(); for (const nm of names) out.setAttribute(nm, new THREE.BufferAttribute(A[nm], geos[0].attributes[nm].itemSize));
    out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
  }
  function tube(pts) {   // единичный радиус: в шейдере ось = position − normal
    const path = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    return new THREE.TubeGeometry(path, Math.max(2, (pts.length - 1) * 2), 1, 6, false);
  }
  function ribbon(pts) {   // лента по рельефу вдоль проекции трассы; uv.x — метры / 1,6 (шаг пунктира)
    const d = []; let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, , az] = pts[i], [bx, , bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
      const n = Math.max(1, Math.ceil(L / 1.0));
      for (let j = (d.length ? 1 : 0); j <= n; j++) d.push([ax + (bx - ax) * j / n, az + (bz - az) * j / n, acc + L * j / n]);
      acc += L;
    }
    if (d.length < 2) return null;
    const pos = [], side = [], uv = [], idx = [];
    d.forEach(([x, z, s], i) => {
      const a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, y = hAt(x, z) + 0.08;
      pos.push(x, y, z, x, y, z); side.push(nx, 0, nz, -nx, 0, -nz); uv.push(s / 1.6, 0, s / 1.6, 1);
      if (i < d.length - 1) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  function render(c, well) {
    const col = css2c(vivid(defOf[c.k].c)), halo = { r: col.r * 0.45 + 0.55, g: col.g * 0.45 + 0.55, b: col.b * 0.45 + 0.55 };
    const rMin = Math.max(0.07, (defOf[c.k].r || 0.08) * 1.3);
    const haloM = shMat(SH_TUBE, SH_FRAG_T, halo, 0.32, 5.5, rMin * 2.2);          // светлый ореол — контраст на любом фоне
    coreM = shMat(SH_TUBE, SH_FRAG_T, col, 0.95, 2.2, rMin);                      // труба «на просвет» (сквозь грунт)
    const ribU = shMat(SH_RIB, SH_FRAG, col, 0.9, 2.4, 0.17, { depth: 1, dash: 1 });  // след подземного участка — пунктир
    const ribO = shMat(SH_RIB, SH_FRAG, col, 0.75, 2.4, 0.17, { depth: 1 });          // надземного — сплошная
    const rW = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(col.r, col.g, col.b, THREE.SRGBColorSpace), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const rS = new THREE.MeshBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const bM = new THREE.MeshBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.85, toneMapped: false });
    mats = [haloM, coreM, ribU, ribO, rW, rS, bM]; shM = [haloM, coreM, ribU, ribO];
    const tubes = [], rbU = [], rbO = [];
    for (const p of c.pipes) { tubes.push(tube(p.pts)); const rb = ribbon(p.pts); if (rb) (p.under ? rbU : rbO).push(rb); }
    const add = (geo, m, ro) => { const me = new THREE.Mesh(geo, m); me.renderOrder = ro; me.frustumCulled = false; me.userData.noWalk = 1; G.add(me); return me; };
    if (tubes.length) { const g = merge(tubes, ['position', 'normal']); add(g, haloM, 16); add(g, coreM, 17); }
    if (rbU.length) add(merge(rbU, ['position', 'side', 'uv']), ribU, 3);
    if (rbO.length) add(merge(rbO, ['position', 'side', 'uv']), ribO, 3);
    rings = [...c.wells, ...c.rects].filter(w => Math.hypot(w.x - well.x, w.z - well.z) > 0.05).map(w => [w.x, hAt(w.x, w.z) + 0.12, w.z, w.w / 2 + 0.45]);
    if (rings.length) { ringIM = new THREE.InstancedMesh(gRing, rW, rings.length); ringIM.renderOrder = 19; ringIM.frustumCulled = false; ringIM.userData.noWalk = 1; G.add(ringIM); }   // кольца колодцев — один вызов отрисовки
    const gy = hAt(well.x, well.z);
    selRing = add(gRing, rS, 20); selRing.position.set(well.x, gy + 0.12, well.z); selRing.userData.R = well.w / 2 + 0.6;
    beam = add(gBeam, bM, 4); beam.position.set(well.x, gy, well.z);
    labelPos = new THREE.Vector3(well.x, gy + 4.7, well.z);
    if (!label) { label = document.createElement('div'); label.style.cssText = 'position:fixed;z-index:3;pointer-events:none;background:#14202c;color:#ffd200;font:600 12px system-ui,Arial;padding:2px 8px;border-radius:6px;transform:translate(-50%,-110%);white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)'; document.body.appendChild(label); }
    label.textContent = `${CODE[c.k]} · ${c.wells.length + c.rects.length} ${plural(c.wells.length + c.rects.length, 'колодец', 'колодца', 'колодцев')} · ${fmt(c.len, 0)} м`;
    label.style.display = 'block';
    G.visible = true; t0 = performance.now(); tick(t0);
  }
  function show(well) {
    clear();
    const c = compOf(well); if (!c || !c.pipes.length) return c;
    cur = c; curWell = well; render(c, well); return c;
  }
  function fit() {
    if (!cur || !cur.pipes.length) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of cur.pipes) for (const q of p.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = Math.max(x1 - x0, z1 - z0, 12) * Math.max(1, 0.9 / camera.aspect), y = hAt(cx, cz);   // портретный экран — отъехать дальше
    flyTo([cx + d * 0.15, y + d * 0.95, cz + d * 0.75], [cx, y, cz], 0.9);
    if (innerWidth < 700) {   // смартфон: карточка закрывает сцену — скрыть её, подсветка остаётся
      const el = document.getElementById('info'); if (el) el.style.display = 'none';
      if (typeof toast === 'function') toast('Трасса ' + CODE[cur.k] + ' показана. Карточка — повторное нажатие на люк; снять подсветку — нажатие на пустое место.', 'ok');
    }
  }

  /* ---------- карточка ---------- */
  function cardHTML(o) {
    if (!o || !o.well || !CODE[o.well.k]) return '';
    const k = o.well.k, c = cur;
    if (!c || !c.pipes.length) return `<div class="n" style="border-left:3px solid #d0261c;padding-left:6px">Подсветка трассы: у этого колодца в модели нет трубы сети ${CODE[k]} в пределах 3 м — требует проверки.</div>`;
    const nW = c.wells.length + c.rects.length, parts = c.parts.length;
    const partTxt = parts > 1
      ? `Сеть ${CODE[k]} в модели состоит из ${parts} ${plural(parts, 'несвязанной части', 'несвязанных частей', 'несвязанных частей')} (по трассам ГП-005); выделена часть № ${c.part + 1} из ${parts} по длине.`
      : `Выделена вся сеть ${CODE[k]} модели.`;
    const ugOn = typeof UGN !== 'undefined' && UGN.isOn();
    return `<div class="n" style="border-left:3px solid #${defOf[k].c.toString(16).padStart(6, '0')};padding-left:6px">` +
      `<b>Трасса сети: ${CODE[k]} — ${NAME[k]}.</b> Связная часть от этого колодца: ${fmt(c.len, 1)} м` +
      (c.lenU > 0.05 && c.lenO > 0.05 ? ` (подземно ${fmt(c.lenU, 1)} м, надземно ${fmt(c.lenO, 1)} м)` : c.lenO > 0.05 ? ' (надземно)' : ' (подземно)') +
      `, ${nW} ${plural(nW, 'колодец', 'колодца', 'колодцев')} на ней. ${partTxt}` +
      (c.far > 0 ? ` Ближайшая труба сети — в ${fmt(c.far, 2)} м от центра колодца.` : '') +
      (c.via.length ? ` Через сооружения ${c.via.join(', ')} — по АК-005 (К3-17 → 798 → К3-18 → 752).` : '') +
      (c.ends.length ? ` Концы трассы у сооружений: ${c.ends.slice(0, 6).join('; ')}${c.ends.length > 6 ? ' и др.' : ''}.` : '') +
      (c.open ? ` Открытых концов (по проверке PNET): ${c.open}.` : '') +
      ` На поверхности: пунктир — подземный участок, сплошная — надземный (как в условных обозначениях ГП-005); жёлтое кольцо и маяк — выбранный люк.</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"><button class="pbtn sm" id="ughFit">Показать трассу целиком</button>` +
      `<button class="pbtn sm" id="ughUG">${ugOn ? 'Скрыть подземный разрез' : 'Показать под землёй'}</button><button class="pbtn sm" id="ughOff">Снять подсветку</button></div>`;
  }
  function bindCard(el) {
    const b = id => el.querySelector('#' + id);
    if (b('ughFit')) b('ughFit').onclick = () => fit();
    if (b('ughOff')) b('ughOff').onclick = () => { clear(); b('ughOff').disabled = true; };
    if (b('ughUG')) b('ughUG').onclick = () => { if (typeof UGN === 'undefined') return; UGN.setMode(!UGN.isOn()); b('ughUG').textContent = UGN.isOn() ? 'Скрыть подземный разрез' : 'Показать под землёй'; };
  }
  function onSelect(o) { if (o && o.well && CODE[o.well.k]) show(o.well); else clear(); }
  function tick(now) {
    if (!G.visible) return;
    const s = (now - t0) / 1000, p = 0.5 + 0.5 * Math.sin(s * 3.2), k = pxK();
    for (const m of shM) m.uniforms.uK.value = k;
    if (coreM) coreM.uniforms.uO.value = 0.7 + 0.3 * p;
    setRings(k, p);
    if (selRing && curWell) {
      const d = camera.position.distanceTo(selRing.position), R = selRing.userData.R;
      selRing.scale.setScalar(Math.max(R, 13 * k * d) * (1 + 0.18 * p));
      const h = Math.max(4.5, 60 * k * d); beam.scale.set(Math.max(0.045, 1.6 * k * d), h, Math.max(0.045, 1.6 * k * d));
      labelPos.y = beam.position.y + h + 0.2;
    }
    if (labelPos && label) {
      const v = labelPos.clone().project(camera);
      if (v.z > 1 || v.z < -1) label.style.display = 'none';
      else { label.style.display = 'block'; label.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; label.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; }
    }
  }
  const api = { show, clear, fit, compOf, partsOf, cardHTML, bindCard, onSelect, tick, G, get cur() { return cur; }, get well() { return curWell; } };
  window.__UGHL = api;
  return api;
})();

