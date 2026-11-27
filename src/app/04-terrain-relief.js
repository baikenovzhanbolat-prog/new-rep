/* ---------- Земля, территория, проезды ---------- */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M(0xa9b48c));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
/* (уровень окружающей земли выставляется после построения рельефа) */

const PARK = [[2913, 3225], [2913, 2700], [3007, 2606], [3780, 2606], [3780, 3018], [3284, 3018], [3284, 3225]]; // по ГП-003

/* ---------- Рельеф по проектным отметкам листа ГП-003 (H0 = 297,30 → y = 0) + покрытия ---------- */
const PH = /*@inline data/04-terrain-relief.PH.json*/null;
let TERR = null;
const H0 = 297.30;
const PH_F0 = 297.40 - 297.30, PH_F1 = 296.40 - 297.30, PH_PIPE_Y = 0.55;   // ±0.000 = 297,40; пол насосного зала −1,000; оси труб — как у наружных сетей
const PH_CLS = { L: [0xb88a00, 'Трубопровод летнего дизельного топлива ДТ(Л)'], Z: [0xf2d24b, 'Трубопровод зимнего дизельного топлива ДТ(З)'], B: [0x00b7d8, 'Трубопровод бензина'],
  D: [0x1fa045, 'Трубопровод дренажа'], DT: [0xc8a050, 'Коллекторы и обвязка насосов ДТ (летнее/зимнее переключаются задвижками)'] };
let ROOF200 = null;
let RACK_L = null;   // условные трубы объекта «Л» — дублируют трассы ДТ(Л)/ДТ(З)/бензина ГП-005, по умолчанию скрыты


const TER = { x0: -160.0, z0: -110.0, st: 2.5, nx: 125, nz: 91, base: 0.5 };
const TH = (() => { const b = Uint8Array.from(atob('/*@base64 assets/bin/terrain-heights.bin*/'), c => c.charCodeAt(0)); const a = new Int16Array(b.buffer); const f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 100; return f; })();
/* ---------- Этап v0.17: рельеф по ГП-003/ГП-004 (модуль RELIEF17) ----------
   Полотно путей больше не «выравнивается» на 297,30 (так было до v0.16). Рельеф полосы ж/д путей, приямка и площадки
   эстакады 177 (296,45), ограждения вышек 800, двора 644, обсыпки 654 и северо-западной полосы перестроен по проектным
   отметкам и горизонталям ГП-003 и узлам сетки ГП-004 (триангуляция; расчёт выполнен вне браузера, данные встроены):
     • основная сетка 2,5 м — изменённые узлы (северо-западная полоса, кольцо у обсыпки, полоса путей вне детальной зоны);
     • детальная полоса 0,5 м: x −95…95, z 17,5…50 — стыкуется с основной сеткой по краю (основная сетка в этой зоне вырезана);
     • площадка эстакады — плита с верхом 296,45; обсыпка 654 — поверхность её 3D-модели (гребень 300,38).
   Головка рельса 297,30 (ГП-003) — EST177.RH; путь № 54 за оградой — 297,25 по существующим отметкам (условно).
   Подпорные стенки (условное обозначение ГП-003) — объекты ПС-1…3. Контрольные точки — «Генплан → Сверка». */
const TRACK_Z = [P(0, 3576)[1], P(0, 3695)[1]];
ground.position.y = -1.7;   // ниже всего рельефа и пола насосного зала
for (let j = 0; j < TER.nz; j++) for (let i = 0; i < TER.nx; i++) if (inPolyT(TER.x0 + i * TER.st, TER.z0 + j * TER.st, PH.geo.outer)) TH[j * TER.nx + i] = Math.min(TH[j * TER.nx + i], 296.2 - 297.30);
function inPolyT(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
const RELIEF17 = (() => {
  const D = /*@inline data/04-terrain-relief.D.json*/null;
  const buf = t => Uint8Array.from(atob(t), c => c.charCodeAt(0)).buffer;
  // 1) основная сетка 2,5 м — изменённые узлы (см от 297,30)
  const ki = new Uint16Array(buf(D.main.i)), kv = new Int16Array(buf(D.main.v));
  for (let n = 0; n < ki.length; n++) TH[ki[n]] = kv[n] / 100;
  const gridH = (x, z) => {
    const fx = Math.min(TER.nx - 1.001, Math.max(0, (x - TER.x0) / TER.st)), fz = Math.min(TER.nz - 1.001, Math.max(0, (z - TER.z0) / TER.st));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = TER.nx;
    return (TH[j * n + i] * (1 - u) + TH[j * n + i + 1] * u) * (1 - v) + (TH[(j + 1) * n + i] * (1 - u) + TH[(j + 1) * n + i + 1] * u) * v;
  };
  // 2) детальная полоса 0,5 м; край — точно по основной сетке (без щелей между сетками)
  const F = D.fb, fv = new Int16Array(buf(F.v));
  const FB = { x0: F.x0, z0: F.z0, st: F.st, nx: F.nx, nz: F.nz, x1: F.x0 + (F.nx - 1) * F.st, z1: F.z0 + (F.nz - 1) * F.st, v: new Float32Array(F.nx * F.nz) };
  for (let k = 0; k < fv.length; k++) FB.v[k] = fv[k] / 100;
  for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) if (i === 0 || j === 0 || i === F.nx - 1 || j === F.nz - 1) FB.v[j * F.nx + i] = gridH(F.x0 + i * F.st, F.z0 + j * F.st);
  // 3) площадка эстакады 177: верх ж/б плиты 296,45 (ГП-003)
  const plat = [...D.plat, 296.45 - H0];
  // 4) обсыпка 654: поверхность 3D-модели (треугольники), поиск через ячейки 2 м
  const Mo = D.mound, V = Mo.v, B = Mo.b, CS = 2.0, cnx = Math.ceil((B[2] - B[0]) / CS), cnz = Math.ceil((B[3] - B[1]) / CS), cells = Array.from({ length: cnx * cnz }, () => []);
  Mo.f.forEach((t, ti) => {
    const xs = t.map(k => V[k][0]), zs = t.map(k => V[k][1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - B[0]) / CS)), i1 = Math.min(cnx - 1, Math.floor((Math.max(...xs) - B[0]) / CS));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - B[1]) / CS)), j1 = Math.min(cnz - 1, Math.floor((Math.max(...zs) - B[1]) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * cnx + i].push(ti);
  });
  function moundAt(x, z) {
    if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return null;
    const i = Math.min(cnx - 1, Math.floor((x - B[0]) / CS)), j = Math.min(cnz - 1, Math.floor((z - B[1]) / CS));
    for (const ti of cells[j * cnx + i]) {
      const [a, b, c] = Mo.f[ti], [x1, z1, h1] = V[a], [x2, z2, h2] = V[b], [x3, z3, h3] = V[c];
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3); if (Math.abs(d) < 1e-9) continue;
      const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d, l3 = 1 - l1 - l2;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * h1 + l2 * h2 + l3 * h3 - H0;
    }
    return null;
  }
  return { FB, plat, mound: Mo, moundAt, gridH, walls: D.walls, cps: D.cps, CORR: -0.45, mainN: ki.length };
})();
function hAt(x, z) {   // v0.17: отметка земли (рельеф, плита площадки эстакады), y = H − 297,30; обсыпка 654 — отдельно (hAtS)
  const F = RELIEF17.FB; let h;
  if (x > F.x0 && x < F.x1 && z > F.z0 && z < F.z1) {
    const fx = (x - F.x0) / F.st, fz = (z - F.z0) / F.st, i = Math.min(F.nx - 2, Math.floor(fx)), j = Math.min(F.nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, n = F.nx, a = F.v;
    h = (a[j * n + i] * (1 - u) + a[j * n + i + 1] * u) * (1 - v) + (a[(j + 1) * n + i] * (1 - u) + a[(j + 1) * n + i + 1] * u) * v;
  } else h = RELIEF17.gridH(x, z);
  const p = RELIEF17.plat; if (x >= p[0] && x <= p[2] && z >= p[1] && z <= p[3]) return p[4];
  return h;
}
/* v0.17: видимая поверхность с учётом обсыпки 654 (гребень 300,38) — для отметки указанной точки, сверки и подписей.
   Трассы сетей, подземные сети и посадка объектов считаются от земли (hAt): трубы В2 входят в обсыпку, а не идут по ней. */
function hAtS(x, z) { const h = hAt(x, z), m = RELIEF17.moundAt(x, z); return m !== null && m > h ? m : h; }
{
  const W = (TER.nx - 1) * TER.st, D = (TER.nz - 1) * TER.st;
  const geo = new THREE.PlaneGeometry(W, D, TER.nx - 1, TER.nz - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const TX0 = -102.22, TZ0 = -54.35, TW = 193.0, TD = 112.7; // текстура покрытий: 0,1 м/пиксель
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k) + TER.x0 + W / 2, z = pos.getZ(k) + TER.z0 + D / 2;
    pos.setXYZ(k, x, TH[k], z); uv.setXY(k, (x - TX0) / TW, 1 - (z - TZ0) / TD);
  }
  { // v0.17: в зоне детальной полосы 0,5 м основная сетка вырезана (зона кратна шагу 2,5 м — край общий)
    const F = RELIEF17.FB, i0 = Math.round((F.x0 - TER.x0) / TER.st), i1 = Math.round((F.x1 - TER.x0) / TER.st), j0 = Math.round((F.z0 - TER.z0) / TER.st), j1 = Math.round((F.z1 - TER.z0) / TER.st), idx = [], n = TER.nx;
    for (let j = 0; j < TER.nz - 1; j++) for (let i = 0; i < TER.nx - 1; i++) {
      if (i >= i0 && i < i1 && j >= j0 && j < j1) continue;
      const a = i + n * j, b = i + n * (j + 1), c = i + 1 + n * (j + 1), d = i + 1 + n * j; idx.push(a, b, d, b, c, d);
    }
    geo.setIndex(idx);
  }
  geo.computeVertexNormals();
  const tex = new THREE.TextureLoader().load('data:image/jpeg;base64,/*@base64 assets/bin/tex.jpg*/');
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const terrMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  { // «окно» в рельефе под насосным цехом: земля не перекрывает пол и подвал
    const NP = PH.geo.outer.length;
    terrMat.onBeforeCompile = sh => {
      sh.uniforms.uPoly = { value: PH.geo.outer.map(q => new THREE.Vector2(q[0], q[1])) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform vec2 uPoly[' + NP + '];')
        .replace('void main() {', 'void main() {\n  bool inside = false;\n  for (int i = 0, j = ' + (NP - 1) + '; i < ' + NP + '; j = i++) { vec2 a = uPoly[i], b = uPoly[j]; if (((a.y > vWP.z) != (b.y > vWP.z)) && (vWP.x < (b.x - a.x) * (vWP.z - a.y) / (b.y - a.y) + a.x)) inside = !inside; }\n  if (inside) discard;');
    };
  }
  const terr = new THREE.Mesh(geo, terrMat);
  terr.receiveShadow = true; scene.add(terr); TERR = terr;
  { // v0.17: детальная полоса рельефа 0,5 м (тот же материал и текстура покрытий ГП-003; входит в слой рельефа)
    const F = RELIEF17.FB, n = F.nx * F.nz, p = new Float32Array(n * 3), q = new Float32Array(n * 2), idx = [];
    for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) {
      const k = j * F.nx + i, x = F.x0 + i * F.st, z = F.z0 + j * F.st;
      p[k * 3] = x; p[k * 3 + 1] = F.v[k]; p[k * 3 + 2] = z; q[k * 2] = (x - TX0) / TW; q[k * 2 + 1] = 1 - (z - TZ0) / TD;
    }
    for (let j = 0; j < F.nz - 1; j++) for (let i = 0; i < F.nx - 1; i++) { const a = i + F.nx * j, b = i + F.nx * (j + 1), c = i + 1 + F.nx * (j + 1), d = i + 1 + F.nx * j; idx.push(a, b, d, b, c, d); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(p, 3)); g2.setAttribute('uv', new THREE.BufferAttribute(q, 2)); g2.setIndex(idx); g2.computeVertexNormals();
    const det = new THREE.Mesh(g2, terrMat); det.receiveShadow = true; det.userData.noWalk = 1; det.name = 'рельеф: детальная полоса 0,5 м (v0.17)'; terr.add(det);
  }
}
