/* ---------- Материалы ---------- */
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05, ...o });
const mat = {
  wall: M(0xe2dac8), roof: M(0x5d6d7e), steel: M(0xeef1f3, { metalness: 0.2, roughness: 0.55 }), steelD: M(0x9aa4ad),
  conc: M(0xb8b4aa), concD: M(0x9c978c), red: M(0xc0392b), dark: M(0x2c3035), rail: M(0x6e6a64, { metalness: 0.4 }),
  sleeper: M(0x5c4a3a), ballast: M(0x8e877c), glass: M(0x87a9c2), fence: M(0x6f7a84, { transparent: true, opacity: 0.45 }),
  tp: M(0xd8dde2), yellow: M(0xe0b531)
};

const pickables = [];
const groups = [];
const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
function add(g, geo, m, x, y, z) { const me = sh(new THREE.Mesh(geo, m)); me.position.set(x, y, z); g.add(me); return me; }
/* ---------- Этап v0.10: процедурные текстуры и материалы с проекцией в мировых координатах ----------
   Текстура ложится в метрах независимо от развёртки (триплanar): штукатурка, сэндвич-панели, бетон, кровельная мембрана.
   Применяется к общим материалам стен, бетона и кровли — все здания и сооружения получают фактуру сразу. */
const MATX = (() => {
  const ANI = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  /* бесшовный шум: сумма октав, решётка с переносом по краям */
  function noise(size, oct, seed = 1, base = 4) {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out = new Float32Array(size * size);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const g = base << o, grid = new Float32Array(g * g); for (let i = 0; i < g * g; i++) grid[i] = rnd();
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = x / size * g, fy = y / size * g, i0 = Math.floor(fx), j0 = Math.floor(fy), u = fx - i0, v = fy - j0;
        const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), i1 = (i0 + 1) % g, j1 = (j0 + 1) % g;
        const a = grid[j0 * g + i0], b = grid[j0 * g + i1], c = grid[j1 * g + i0], d = grid[j1 * g + i1];
        out[y * size + x] += amp * ((a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv);
      }
      tot += amp; amp *= 0.55;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  function canvasTex(size, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANI; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const paintNoise = (x, size, n, k, r0 = 255, g0 = 255, b0 = 255) => {
    const im = x.getImageData(0, 0, size, size), d = im.data;
    const ns = Math.round(Math.sqrt(n.length));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x, f = 1 + (n[(y % ns) * ns + (x % ns)] - 0.5) * k; d[i * 4] = Math.min(255, d[i * 4] * f); d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * f); d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * f); }
    x.putImageData(im, 0, 0);
  };
  const N1 = noise(256, 5, 7, 4), N2 = noise(256, 4, 11, 8), N3 = noise(256, 3, 23, 2);
  /* штукатурка (2 × 2 м) */
  const plaster = canvasTex(256, (x, s) => { x.fillStyle = '#f2efe8'; x.fillRect(0, 0, s, s); paintNoise(x, s, N2, 0.10); paintNoise(x, s, N3, 0.08); });
  /* сэндвич-панели (стеновые, горизонтальная раскладка): модуль 1,0 м по высоте, микропрофиль 0,1 м (тайл 2 × 2 м) */
  const panel = canvasTex(512, (x, s) => {
    x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 20; i++) { const y = i * s / 20; x.fillStyle = i % 2 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)'; x.fillRect(0, y, s, s / 40); }
    for (const y of [0, s / 2]) { x.fillStyle = 'rgba(40,45,50,0.55)'; x.fillRect(0, y, s, 3); x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(0, y + 3, s, 2); }
    paintNoise(x, s, N1, 0.05);
  });
  /* бетон (3 × 3 м): поры, разводы, швы опалубки 1,5 м */
  const concrete = canvasTex(512, (x, s) => {
    x.fillStyle = '#efede7'; x.fillRect(0, 0, s, s);
    paintNoise(x, s, N1, 0.16); paintNoise(x, s, N3, 0.12);
    x.fillStyle = 'rgba(60,60,60,0.10)'; for (const p of [0, s / 2]) { x.fillRect(p, 0, 2, s); x.fillRect(0, p, s, 2); }
    let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(70,70,70,${0.15 + r() * 0.25})`; x.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5); }
  });
  /* кровельная мембрана (4 × 4 м): полотнища 2 м с нахлёстом */
  const roof = canvasTex(256, (x, s) => {
    x.fillStyle = '#e6e8ea'; x.fillRect(0, 0, s, s); paintNoise(x, s, N2, 0.12);
    for (const p of [0, s / 2]) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(p, 0, 2, s); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(p + 2, 0, 2, s); }
  });
  /* проекция в мировых координатах: веса по нормали (резкие), учёт InstancedMesh */
  function triplanar(m, tile) {
    m.userData.tri = tile;
    m.onBeforeCompile = sh => {
      sh.uniforms.uTile = { value: tile };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          #ifdef USE_INSTANCING
            vTriP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vTriN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
          #else
            vTriP = (modelMatrix * vec4(transformed, 1.0)).xyz; vTriN = normalize(mat3(modelMatrix) * objectNormal);
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN; uniform float uTile;')
        .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec3 tw = pow(abs(normalize(vTriN)), vec3(6.0)); tw /= (tw.x + tw.y + tw.z);
          vec4 tX = texture2D(map, vTriP.zy / uTile), tY = texture2D(map, vTriP.xz / uTile), tZ = texture2D(map, vTriP.xy / uTile);
          diffuseColor *= tX * tw.x + tY * tw.y + tZ * tw.z;
          #endif`);
    };
    m.customProgramCacheKey = () => 'tri' + tile;
    m.needsUpdate = true;
    return m;
  }
  const tri = (color, map, tile, o = {}) => triplanar(new THREE.MeshStandardMaterial({ color, map, roughness: 0.85, metalness: 0.02, ...o }), tile);
  // общие материалы — та же ссылка (все уже созданные и будущие объекты получают фактуру)
  const up = (m, map, tile, rough) => { m.map = map; if (rough !== undefined) m.roughness = rough; triplanar(m, tile); };
  up(mat.wall, plaster, 2.0, 0.9); up(mat.conc, concrete, 3.0, 0.92); up(mat.concD, concrete, 3.0, 0.92); up(mat.roof, roof, 4.0, 0.8);
  /* ограждение: сварная сетчатая панель (условно — конструкция по чертежам АС не предоставлена); тайл 1 м, ячейка 50 × 200 мм */
  const meshT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 128); x.fillStyle = 'rgba(205,210,214,1)';
    for (let i = 0; i < 20; i++) x.fillRect(i * 6.4, 0, 1.6, 128); for (let j = 0; j < 5; j++) x.fillRect(0, j * 25.6, 128, 2.2);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANI; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  Object.assign(mat.fence, { map: meshT, transparent: false, opacity: 1, alphaTest: 0.3, alphaToCoverage: true, side: THREE.DoubleSide, color: new THREE.Color(0x8f979c), metalness: 0.5, roughness: 0.5 });
  triplanar(mat.fence, 1.0);
  /* материалы фасадов (этап v0.10, условно — нет чертежей АР) */
  const F = {
    plaster: tri(0xf1ece2, plaster, 2.0, { roughness: 0.9 }),
    panelW: tri(0xe8eaea, panel, 2.0, { roughness: 0.55, metalness: 0.15 }),          // сэндвич-панель, светло-серая
    panelB: tri(0x9fb3c4, panel, 2.0, { roughness: 0.55, metalness: 0.15 }),          // сэндвич-панель, серо-голубая
    plinth: tri(0x8b8f93, concrete, 3.0, { roughness: 0.9 }),
    coping: M(0xb9bec3, { roughness: 0.45, metalness: 0.55 }),
    frame: M(0xf3f3f1, { roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8aa2b0, roughness: 0.05, metalness: 0.7, envMapIntensity: 1.5 }),
    door: M(0x6d7378, { roughness: 0.5, metalness: 0.5 }),
    doorB: M(0x7a5b44, { roughness: 0.55, metalness: 0.35 }),
    gate: tri(0xd6d9db, panel, 1.0, { roughness: 0.5, metalness: 0.3 }),
    dark: M(0x3b3f43, { roughness: 0.6, metalness: 0.4 }),
    pipe: M(0xa9afb4, { roughness: 0.45, metalness: 0.5 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c8, emissiveIntensity: 0.35, roughness: 0.4 }),
    louvre: M(0x8c9298, { roughness: 0.5, metalness: 0.5 })
  };
  return { tri, triplanar, noise, canvasTex, F, T: { plaster, panel, concrete, roof }, N: { N1, N2, N3 } };
})();


/* Коробка по углам из плана */
function boxPx(g, x0, y0, x1, y1, h, m, y = 0) {
  const [a, b] = P(x0, y0), [c, d] = P(x1, y1);
  return add(g, new THREE.BoxGeometry(c - a, h, d - b), m, (a + c) / 2, y + h / 2, (b + d) / 2);
}
/* Здание: стены + плоская кровля */
function building(g, r, h, wallM = mat.wall, roofM = mat.roof, y0 = 0) {
  boxPx(g, ...r, h, wallM, y0);
  boxPx(g, r[0] - 3, r[1] - 3, r[2] + 3, r[3] + 3, 1.2, mat.concD, -1.2); // цоколь/отмостка — чтобы на уклоне не «висело»
  const [a, b] = P(r[0], r[1]), [c, d] = P(r[2], r[3]);
  add(g, new THREE.BoxGeometry(c - a + 0.4, 0.35, d - b + 0.4), roofM, (a + c) / 2, y0 + h + 0.17, (b + d) / 2);
}
/* Вертикальный резервуар РВС */
function rvs(g, px, py, D, H) {
  const [x, z] = P(px, py), r = D / 2;
  add(g, new THREE.CylinderGeometry(r + 0.9, r + 1.1, 0.45, 48), mat.conc, x, 0.22, z);
  add(g, new THREE.CylinderGeometry(r, r, H, 56), mat.steel, x, 0.45 + H / 2, z);
  add(g, new THREE.CylinderGeometry(0.7, r + 0.05, 1.3, 56), mat.steelD, x, 0.45 + H + 0.65, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.15, 0.05, 6, 56), mat.steelD);
  ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.45 + H + 1.1, z); g.add(ring);
  // наружная лестница (упрощённо)
  const st = add(g, new THREE.BoxGeometry(0.9, H * 1.15, 0.12), mat.steelD, x + r + 0.5, 0.45 + H / 2, z);
  st.rotation.z = 0.5;
}
/* Горизонтальный резервуар РГС (ось вдоль плана "сверху-вниз") */
function rgs(g, px, py, D, L) {
  const [x, z] = P(px, py), r = D / 2;
  const c = add(g, new THREE.CylinderGeometry(r, r, L, 32), mat.steel, x, 0.7 + r, z);
  c.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.steel, x, 0.7 + r, z + s * L / 2)
      .rotation.x = s * Math.PI / 2;
    add(g, new THREE.BoxGeometry(D * 0.9, 0.7 + r * 0.6, 0.5), mat.conc, x, (0.7 + r * 0.6) / 2, z + s * L * 0.3);
  }
  add(g, new THREE.CylinderGeometry(0.35, 0.35, 0.35, 16), mat.steelD, x, 0.7 + D + 0.15, z);
}
/* Подземная ёмкость: люк/горловина над землёй + контур */
function buried(g, r, label) {
  boxPx(g, ...r, 0.15, mat.concD);
  const [a, b] = P(r[0], r[1]), [c, d] = P(r[2], r[3]);
  add(g, new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), mat.steelD, (a + c) / 2, 0.4, (b + d) / 2);
}
/* Плита перекрытия подземного сооружения заподлицо с покрытием + люк (752, 798 — этап 6.7) */
function ugSlab(g, r) {
  const [a, b] = P(r[0], r[1]), [c, d] = P(r[2], r[3]), x = (a + c) / 2, z = (b + d) / 2, gy = hAt(x, z);
  add(g, new THREE.BoxGeometry(c - a + 0.3, 0.3, d - b + 0.3), mat.concD, x, gy - 0.07, z);
  add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), mat.dark, x, gy + 0.1, z);
}
/* Навес (колонны + кровля) */
function canopy(g, r, h) {
  const [a, b] = P(r[0], r[1]), [c, d] = P(r[2], r[3]);
  for (const [x, z] of [[a + .3, b + .3], [c - .3, b + .3], [a + .3, d - .3], [c - .3, d - .3]])
    add(g, new THREE.BoxGeometry(0.35, h, 0.35), mat.steelD, x, h / 2, z);
  add(g, new THREE.BoxGeometry(c - a + 0.8, 0.5, d - b + 0.8), mat.wall, (a + c) / 2, h + 0.25, (b + d) / 2);
  add(g, new THREE.BoxGeometry(c - a + 0.85, 0.18, d - b + 0.85), mat.red, (a + c) / 2, h + 0.1, (b + d) / 2);
}
/* Вышка лафетного ствола */
function tower(g, px, py, H) {
  const [x, z] = P(px, py), w = 1.4;
  for (const [i, k] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    add(g, new THREE.BoxGeometry(0.18, H, 0.18), mat.red, x + i * w, H / 2, z + k * w);
  for (let y = 2; y < H; y += 2.5) {
    add(g, new THREE.BoxGeometry(2 * w, 0.1, 0.1), mat.red, x, y, z - w);
    add(g, new THREE.BoxGeometry(2 * w, 0.1, 0.1), mat.red, x, y, z + w);
    add(g, new THREE.BoxGeometry(0.1, 0.1, 2 * w), mat.red, x - w, y, z);
    add(g, new THREE.BoxGeometry(0.1, 0.1, 2 * w), mat.red, x + w, y, z);
  }
  add(g, new THREE.BoxGeometry(2 * w + 0.8, 0.2, 2 * w + 0.8), mat.steelD, x, H + 0.1, z);
  const n = add(g, new THREE.CylinderGeometry(0.12, 0.2, 1.8, 12), mat.dark, x, H + 1.0, z - 0.4);
  n.rotation.x = -0.9; // ствол направлен в сторону резервуарного парка (на плане — вверх)
}
/* ---------- Ж/д путь (v0.17) ----------
   Головка рельса — по ГП-003 («г.р. 297,30» → y = 0); путь № 54 за оградой — 297,25 по существующим отметкам (условно).
   Колея 1520 мм (оси головок ±0,7975 м); рельсы — профиль Р65 (высота 180 мм); ж/б шпалы 2,75 м, 1840 шт/км;
   щебёночная призма: поверху 3,25 м на уровне верха шпал, откосы 1:1,5 до земли (низ призмы скрыт рельефом).
   На площадке эстакады (296,45) путь уложен в лотке между бортовыми камнями, чтобы трапы дренажа АК-045
   (1,76 м от оси пути) оставались вне балласта. Верхнее строение пути и лоток — УСЛОВНО (раздела ЖД в комплекте нет). */
const tracks = new THREE.Group(); scene.add(tracks);
const TRK = { RAIL_H: 0.18, PAD: 0.03, SLP_H: 0.19, SLP_L: 2.75, SLP_W: 0.27, SLP_STEP: 1 / 1.84, HW: 1.625, GC: 0.7975, CURB: [1.42, 1.55] };
const TRK_RAIL_SHAPE = (() => {   // Р65, упрощённый профиль (м): подошва 150, шейка 18, головка 75 × 38
  const P_ = [[-0.075, 0], [0.075, 0], [0.075, 0.011], [0.009, 0.032], [0.009, 0.135], [0.0375, 0.142], [0.0375, 0.18], [-0.0375, 0.18], [-0.0375, 0.142], [-0.009, 0.135], [-0.009, 0.032], [-0.075, 0.011]];
  const sh = new THREE.Shape(); sh.moveTo(...P_[0]); for (let i = 1; i < P_.length; i++) sh.lineTo(...P_[i]); sh.closePath(); return sh;
})();
function trkMerge(geos) {   // объединение геометрий одного материала (позиции, нормали, UV, индексы) — меньше вызовов отрисовки
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[oi + k] = a[k] + ov; oi += a.length; }
    else { for (let k = 0; k < n; k++) idx[oi + k] = ov + k; oi += n; }
    ov += n; g.dispose();
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  r.setIndex(new THREE.BufferAttribute(idx, 1)); return r;
}
function track(pyAxis, px0, px1, railY = 0, opt = {}) {
  const [x0, z] = P(px0, pyAxis), [x1] = P(px1, pyAxis), L = x1 - x0, xc = (x0 + x1) / 2;
  const yTop = railY - TRK.RAIL_H - TRK.PAD, yBot = Math.min(railY - 1.25, -1.05);   // верх шпал = верх балласта; низ призмы — ниже земли
  const tg = new THREE.Group(); tg.name = 'путь ' + (pyAxis > 3650 ? '№ 54' : '№ 53') + (opt.trough !== undefined ? ' (лоток на площадке эстакады)' : ''); tracks.add(tg);
  if (opt.trough !== undefined) {   // путь в лотке на площадке эстакады (условно)
    const y0 = opt.trough, [c0, c1] = TRK.CURB;
    const fill = new THREE.Mesh(new THREE.BoxGeometry(L, yTop - y0, 2 * c0), mat.ballast); fill.position.set(xc, (yTop + y0) / 2, z); fill.receiveShadow = true; tg.add(fill);
    const cg = []; for (const sgn of [-1, 1]) { const b = new THREE.BoxGeometry(L, yTop + 0.03 - y0, c1 - c0); b.translate(xc, (yTop + 0.03 + y0) / 2, z + sgn * (c0 + c1) / 2); cg.push(b); }
    const curbs = new THREE.Mesh(trkMerge(cg), TRK.curbM || (TRK.curbM = M(0xb3afa5, { roughness: 0.92 }))); curbs.castShadow = curbs.receiveShadow = true; tg.add(curbs);   // свой материал: режим «Подземные сети» обрезает материалы путей
  } else {   // щебёночная призма
    const hb = TRK.HW + 1.5 * (yTop - yBot);
    const sh = new THREE.Shape([new THREE.Vector2(-hb, yBot), new THREE.Vector2(hb, yBot), new THREE.Vector2(TRK.HW, yTop), new THREE.Vector2(-TRK.HW, yTop)]);
    const pg = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); pg.rotateY(Math.PI / 2); pg.translate(x0, 0, z);
    const pr = new THREE.Mesh(pg, mat.ballast); pr.receiveShadow = true; tg.add(pr);
  }
  const rg = []; for (const sgn of [-1, 1]) { const g = new THREE.ExtrudeGeometry(TRK_RAIL_SHAPE, { depth: L, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, railY - TRK.RAIL_H, z + sgn * TRK.GC); rg.push(g); }
  const rails = new THREE.Mesh(trkMerge(rg), mat.rail); rails.castShadow = rails.receiveShadow = true; tg.add(rails);
  const n = Math.floor(L / TRK.SLP_STEP), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(TRK.SLP_W, TRK.SLP_H, TRK.SLP_L), mat.sleeper, n), m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation(x0 + (i + 0.5) * TRK.SLP_STEP, yTop - TRK.SLP_H / 2, z); sl.setMatrixAt(i, m4); }
  sl.receiveShadow = true; tg.add(sl);
  return tg;
}
/* Пакет брусков одним InstancedMesh (для металлоконструкций с множеством мелких деталей) */
class BoxBatch {
  constructor(m) { this.m = m; this.a = []; }
  box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.a.push([w, h, d, x, y, z, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))]); return this;
  }
  /* брусок сечением t вдоль отрезка a→b */
  seg(a, b, t) {
    const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = v.length();
    this.a.push([l, t, t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), v.normalize())]); return this;
  }
  build(g) {
    if (!this.a.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.m, this.a.length), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.a.forEach((a, i) => { p.set(a[3], a[4], a[5]); s.set(a[0], a[1], a[2]); m4.compose(p, a[6], s); im.setMatrixAt(i, m4); });
    im.castShadow = im.receiveShadow = true; g.add(im);
  }
}
/* Вагон-цистерна (упрощённая; после загрузки заменяется моделью цистерны из «Цифрового склада») */
function tankCar(g, x, z, y0 = 0) {   // y0 — смещение от прежней посадки (головка рельса +0,50); v0.17: y0 = RH − 0,5
  for (const s of [-4.2, 4.2]) add(g, new THREE.BoxGeometry(2.6, 0.8, 2.3), mat.dark, x + s, y0 + 0.85, z);
  add(g, new THREE.BoxGeometry(12, 0.3, 2.7), mat.dark, x, y0 + 1.4, z);
  const c = add(g, new THREE.CylinderGeometry(1.5, 1.5, 10.6, 28), M(0x34383d, { metalness: 0.3, roughness: .6 }), x, y0 + 3.05, z);
  c.rotation.z = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(0.75, 0.75, 0.5, 20), mat.dark, x, y0 + 4.75, z);
}
/* Стена/ограждение по ломаной */
function polyWall(g, pts, h, t, m) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = P(...pts[i]), [c, d] = P(...pts[i + 1]);
    const L = Math.hypot(c - a, d - b), k = Math.max(1, Math.ceil(L / 6)), ry = -Math.atan2(d - b, c - a);
    for (let j = 0; j < k; j++) {
      const f = (j + 0.5) / k;
      const w = add(g, new THREE.BoxGeometry(L / k + 0.02, h, t), m, a + (c - a) * f, h / 2, b + (d - b) * f);
      w.rotation.y = ry;
    }
  }
}
function polyShape(pts, y, m) {
  const sh = new THREE.Shape(pts.map(([px, py]) => { const [x, z] = P(px, py); return new THREE.Vector2(x, -z); }));
  const me = new THREE.Mesh(new THREE.ShapeGeometry(sh), m);
  me.rotation.x = -Math.PI / 2; me.position.y = y; me.receiveShadow = true; scene.add(me); return me;
}

/* МАФ: координаты листа ГП-003 (600 dpi) -> метры сцены */
const P3 = (x, y) => [(x - 240) / 22.176 - 102.22, (y - 220) / 22.176 - 54.35];
function mafShield(g, px, py) {
  const [x, z] = P3(px, py);
  for (const s of [-0.6, 0.6]) add(g, new THREE.BoxGeometry(0.08, 1.9, 0.08), mat.steelD, x, 0.95, z + s);
  add(g, new THREE.BoxGeometry(0.06, 1.3, 1.4), mat.red, x, 1.15, z);
  add(g, new THREE.BoxGeometry(0.08, 0.9, 0.25), M(0xf2f2f2), x + 0.05, 1.1, z - 0.35);
  add(g, new THREE.BoxGeometry(0.5, 0.45, 0.9), mat.red, x + 0.4, 0.23, z + 0.2); // ящик с песком
}
function mafBench(g, px, py) {
  const [x, z] = P3(px, py);
  add(g, new THREE.BoxGeometry(2.0, 0.06, 0.45), M(0x8a5a32), x, 0.45, z);
  add(g, new THREE.BoxGeometry(2.0, 0.4, 0.05), M(0x8a5a32), x, 0.75, z - 0.22);
  for (const s of [-0.85, 0.85]) add(g, new THREE.BoxGeometry(0.08, 0.45, 0.45), mat.dark, x + s, 0.22, z);
}
function mafUrn(g, px, py) {
  const [x, z] = P3(px, py);
  add(g, new THREE.CylinderGeometry(0.22, 0.18, 0.7, 16), mat.concD, x, 0.35, z);
}
function mafBin(g, px, py) {
  const [x, z] = P3(px, py);
  add(g, new THREE.BoxGeometry(1.2, 1.1, 0.9), M(0x2f6b3a), x, 0.55, z);
  add(g, new THREE.BoxGeometry(1.25, 0.08, 0.95), M(0x22502b), x, 1.14, z);
}

/* Здание по многоугольному контуру (Г-образные и т.п.) */
function prism(g, pts, h, wallM = mat.wall, roofM = mat.roof) {
  const sh = new THREE.Shape(pts.map(([px, py]) => { const [x, z] = P(px, py); return new THREE.Vector2(x, -z); }));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  const me = sh2mesh(geo, wallM); g.add(me);
  const r = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }); r.rotateX(-Math.PI / 2); r.translate(0, h, 0);
  g.add(sh2mesh(r, roofM));
  const b = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); b.rotateX(-Math.PI / 2); b.translate(0, -1.2, 0);
  g.add(sh2mesh(b, mat.concD));
}
function sh2mesh(geo, m) { const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me; }
/* Площадка обслуживания РГС с лестницей (по ГП-003) */
function rgsDeck(g) {
  const [a, b] = P(2967, 3061), [c, d] = P(3215, 3096), y = 0.7 + 3.24 + 0.15;
  add(g, new THREE.BoxGeometry(c - a, 0.12, d - b), mat.steelD, (a + c) / 2, y, (b + d) / 2);
  add(g, new THREE.BoxGeometry(c - a, 0.05, 0.05), mat.yellow, (a + c) / 2, y + 1.1, b);
  add(g, new THREE.BoxGeometry(c - a, 0.05, 0.05), mat.yellow, (a + c) / 2, y + 1.1, d);
  const [sx, sz0] = P(2960, 3040), [, sz1] = P(2960, 3123);
  const s = add(g, new THREE.BoxGeometry(0.9, 0.12, sz1 - sz0), mat.steelD, sx, y / 2, (sz0 + sz1) / 2); s.rotation.x = -Math.atan2(y, sz1 - sz0);
}
/* Лестница-переход через стенку обвалования */
function stile(g, px, py, ax) {
  const [x, z] = P(px, py), h = 1.0, run = 1.6, w = 0.9;
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(ax === 'x' ? run : w, 0.1, ax === 'x' ? w : run);
    const m = add(g, geo, mat.steelD, x + (ax === 'x' ? s * (run / 2 + 0.2) : 0), h / 2 + 0.1, z + (ax === 'z' ? s * (run / 2 + 0.2) : 0));
    if (ax === 'x') m.rotation.z = -s * Math.atan2(h, run); else m.rotation.x = s * Math.atan2(h, run);
  }
  add(g, new THREE.BoxGeometry(ax === 'x' ? 0.6 : w, 0.08, ax === 'x' ? w : 0.6), mat.steelD, x, h + 0.15, z);
  for (const s of [-0.45, 0.45]) add(g, new THREE.BoxGeometry(ax === 'x' ? 3.6 : 0.05, 0.05, ax === 'x' ? 0.05 : 3.6), mat.yellow, x + (ax === 'z' ? s : 0), h + 1.0, z + (ax === 'x' ? s : 0));
}
/* Обсыпка подземных резервуаров 654.1–2 (v0.17): гребень 4043–4265 × 2732–3477 на 300,38 (ГП-003); подошва 4002–4307 × 2690–3519
   со срезанными углами — отметки подошвы по ГП-003: 298,20 у северных углов, 297,00 у южных, 298,00 у двора 644; между — по прямой.
   Та же поверхность используется рельефом (hAt), поэтому отметка указанной точки и обход совпадают с моделью. */
let MOUND_MESH = null;   // обсыпка РПВ — полупрозрачна в режиме «Подземные сети»
function mound(g) {
  const M17 = RELIEF17.mound, v = M17.v, f = M17.f, pos = [], skirt = [];
  for (const t of f) for (const k of t) pos.push(v[k][0], v[k][2] - H0, v[k][1]);
  // «юбка» по подошве — на 0,35 м вниз, чтобы рельеф (сетка 2,5 м) не оставлял щелей у подошвы
  for (const [a, b] of M17.rim) { const A = v[a], B = v[b], ya = A[2] - H0, yb = B[2] - H0;
    skirt.push(A[0], ya, A[1], B[0], yb, B[1], B[0], yb - 0.35, B[1], A[0], ya, A[1], B[0], yb - 0.35, B[1], A[0], ya - 0.35, A[1]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.concat(skirt), 3)); geo.computeVertexNormals();
  const me = new THREE.Mesh(geo, M(0x8fa766, { side: THREE.DoubleSide })); me.receiveShadow = me.castShadow = true; g.add(me); MOUND_MESH = me;
}
/* v0.17: подпорные стенки — по условному обозначению ГП-003 (такому же, как у ограждающей стенки парка 431).
   Положение — по листу (верхняя и нижняя грани знака); верх — на 0,10 м выше верхней планировки, низ — на 0,30 м ниже
   нижней (заглубление). Толщина = ширина знака (≈0,8 м). Конструкция — условно (марка АС/КЖ не предоставлена). */
function walls17(g, k) {
  const W = RELIEF17.walls[k], pos = [], T = [], Bt = [];
  const v3 = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const tri = (a, b, c, out) => { const u = v3(a, b), w = v3(a, c), n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) [b, c] = [c, b]; pos.push(...a, ...b, ...c); };
  const quad = (a, b, c, d, out) => { tri(a, b, c, out); tri(a, c, d, out); };
  const N = W.hi.length, dirs = [];
  for (let i = 0; i < N; i++) {
    const [hx, hz, hv] = W.hi[i], [lx, lz, lv] = W.lo[i], dx = hx - lx, dz = hz - lz, L = Math.hypot(dx, dz) || 1;
    const top = hv - H0 + 0.10, lowG = lv !== null && lv !== undefined ? lv - H0 : hAt(lx - dx / L * 0.4, lz - dz / L * 0.4), bot = Math.min(lowG, hv - H0) - 0.30;
    T.push([[hx, top, hz], [lx, top, lz]]); Bt.push([[hx, bot, hz], [lx, bot, lz]]); dirs.push([dx / L, 0, dz / L]);
  }
  for (let i = 0; i < N - 1; i++) {
    const o = [(dirs[i][0] + dirs[i + 1][0]) / 2, 0, (dirs[i][2] + dirs[i + 1][2]) / 2];
    quad(T[i][0], T[i][1], T[i + 1][1], T[i + 1][0], [0, 1, 0]);
    quad(T[i][0], T[i + 1][0], Bt[i + 1][0], Bt[i][0], o);
    quad(T[i][1], Bt[i][1], Bt[i + 1][1], T[i + 1][1], [-o[0], 0, -o[2]]);
  }
  for (const [i, j] of [[0, 1], [N - 1, N - 2]]) {
    const a = T[i][0], b = T[j][0], out = [a[0] - b[0], 0, a[2] - b[2]];
    quad(T[i][0], T[i][1], Bt[i][1], Bt[i][0], out);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const me = new THREE.Mesh(geo, mat.conc); me.castShadow = me.receiveShadow = true; g.add(me);
}
function hatch654(g, px, py) {
  const [x, z] = P(px, py), y = 300.38 - H0;
  add(g, new THREE.BoxGeometry(1.2, 0.5, 1.2), mat.concD, x, y + 0.25, z);
  add(g, new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), mat.steelD, x, y + 0.6, z);
}
/* Трубопроводы от насосного цеха (200) к эстакаде (177): X 2563–2765, Y 3454–3488 */
function pipeRack(g) {
  const [x0, z0] = P(2563, 3454), [x1, z1] = P(2765, 3488), L = x1 - x0, n = 5;
  const gp = new THREE.Group(); gp.name = 'rackL_pipes'; g.add(gp); RACK_L = gp;
  for (let i = 0; i < n; i++) {
    const z = z0 + (z1 - z0) * (i + 0.5) / n;
    const p = add(gp, new THREE.CylinderGeometry(0.11, 0.11, L, 12), i === 0 ? mat.red : mat.steelD, (x0 + x1) / 2, 0.75, z); p.rotation.z = Math.PI / 2;
  }
  for (let x = x0 + 0.5; x < x1; x += 3) add(g, new THREE.BoxGeometry(0.25, 0.6, z1 - z0 + 0.3), mat.concD, x, 0.3, (z0 + z1) / 2);
}

