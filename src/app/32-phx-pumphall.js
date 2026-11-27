/* ---------- Визуализация ---------- */
/* ---------- Насосный цех 200, этап v0.9: насосные агрегаты, арматура, фильтры, опоры ОП, КИП — по листу 5632.29-278-АК-041-0 ----------
   Положение и габариты в плане — по чертежу АК-041 (подложка ТХ на плане КИП), привязка к оцифровке PH (СКО 4 мм).
   Высоты, конструкция узлов, цвета — условно (разрезов и ТХ-листов в комплекте нет). */
const PHX = (() => {
  const D = PHX_DATA, Y0 = PH_F1, YP = PH_PIPE_Y, yAt = (x, z) => phY(x, z);   // v0.29: отметка трубы в точке
  let PHX_CUR = null;                                             // v0.14: агрегат, для которого строятся подключения (для PGEO)
  const gHex = new THREE.CylinderGeometry(1, 1, 1, 6), gStud = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);   // гайки, шпильки
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), UP = V3(0, 1, 0);
  const G = new THREE.Group(); G.name = 'PHX'; PHG.add(G);        // арматура, фильтры, опоры — слой «Обвязка, насосы…»
  const GI = new THREE.Group(); GI.name = 'PHX-KIP'; PHI.add(GI);  // манометры, датчики — слой «КИП…»

  /* ---------- материалы ---------- */
  const MAT = {
    motor: M(0x2f5f8e, { roughness: 0.5, metalness: 0.3 }),
    pump: M(0x55606a, { roughness: 0.55, metalness: 0.35 }),
    frame: M(0x3b4045, { roughness: 0.7, metalness: 0.3 }),
    steel: M(0xa8b0b7, { roughness: 0.4, metalness: 0.6 }),
    dark: M(0x24282c, { roughness: 0.6, metalness: 0.4 }),
    guard: new THREE.MeshStandardMaterial({ color: 0xe0b531, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide, alphaTest: 0.5 }),
    conc: mat.concD,
    valve: M(0x2c3035, { roughness: 0.55, metalness: 0.4 }),
    wheel: M(0xc0392b, { roughness: 0.5 }),
    stem: M(0xd4d9dd, { roughness: 0.25, metalness: 0.85 }),
    sv: M(0xa8322a, { roughness: 0.5, metalness: 0.3 }),
    fil: M(0x6b747c, { roughness: 0.5, metalness: 0.45 }),
    sup: M(0x5a6168, { roughness: 0.7, metalness: 0.3 }),
    lever: M(0xe0b531, { roughness: 0.5 }),
    gauge: M(0x1e2124, { roughness: 0.35, metalness: 0.6 }),
    pis: M(0xd9dde2, { roughness: 0.4, metalness: 0.3 }),
    needle: new THREE.MeshBasicMaterial({ color: 0xd0261c })
  };
  const PIPEM = {}; for (const k in PH_CLS) PIPEM[k] = new THREE.MeshStandardMaterial({ color: PH_CLS[k][0], roughness: 0.45, metalness: 0.3 });
  // перфорация ограждения муфты (видно вращение)
  {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#000';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(8 + i * 16, 8 + j * 16, 5.2, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); MAT.guard.alphaMap = t;
    const tg = t.clone(); tg.repeat.set(1, 1); tg.needsUpdate = true;
    const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const y = c2.getContext('2d');   // решётка кожуха вентилятора
    y.fillStyle = '#000'; y.fillRect(0, 0, 128, 128); y.strokeStyle = '#fff'; y.lineWidth = 5;
    for (let r = 14; r < 64; r += 12) { y.beginPath(); y.arc(64, 64, r, 0, 7); y.stroke(); }
    for (let a = 0; a < 8; a++) { y.beginPath(); y.moveTo(64, 64); y.lineTo(64 + 62 * Math.cos(a * Math.PI / 4), 64 + 62 * Math.sin(a * Math.PI / 4)); y.stroke(); }
    MAT.grille = new THREE.MeshStandardMaterial({ color: 0x2a5580, roughness: 0.5, metalness: 0.3, alphaMap: new THREE.CanvasTexture(c2), alphaTest: 0.5, side: THREE.DoubleSide });
  }

  /* ---------- геометрия: слияние ---------- */
  function mergeGeos(list) {
    let n = 0; const parts = list.map(([g, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); q.applyMatrix4(m); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const q of parts) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  class Bk {
    constructor() { this.b = {}; }
    put(key, geo, m4) { (this.b[key] = this.b[key] || []).push([geo, m4.clone()]); }
    build(parent, o, mats = MAT) {
      const out = [];
      for (const [k, l] of Object.entries(this.b)) {
        const me = new THREE.Mesh(mergeGeos(l), mats[k] || PIPEM[k]); me.castShadow = me.receiveShadow = true;
        if (o) { me.userData.o = o; pickables.push(me); }
        parent.add(me); out.push(me);
      }
      return out;
    }
  }
  /* общие единичные геометрии */
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 20), gCyl8 = new THREE.CylinderGeometry(1, 1, 1, 8), gBox = new THREE.BoxGeometry(1, 1, 1);
  const gSph = new THREE.SphereGeometry(1, 16, 10), gCylO = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), gStem = new THREE.CylinderGeometry(1, 1, 1, 8);
  const gTorW = new THREE.TorusGeometry(1, 0.04, 6, 28), gCone4 = new THREE.ConeGeometry(1, 1, 4), gCone16 = new THREE.ConeGeometry(1, 1, 16), gTorR = new THREE.TorusGeometry(1, 0.08, 6, 24);
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(1, 1, 1), _p = V3();
  const TRS = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  /* примитивы в локальной системе агрегата: u — вдоль оси (x), y — вверх, v — поперёк (z) */
  const P = {
    cylU: (b, k, r, u0, u1, y = 0, v = 0, g = gCyl) => b.put(k, g, TRS((u0 + u1) / 2, y, v, r, Math.abs(u1 - u0), r, 0, 0, -Math.PI / 2)),
    coneU: (b, k, r0, r1, u0, u1, y = 0, v = 0) => b.put(k, new THREE.CylinderGeometry(r1, r0, Math.abs(u1 - u0), 20), TRS((u0 + u1) / 2, y, v, 1, 1, 1, 0, 0, -Math.PI / 2)),
    cylY: (b, k, r, y0, y1, u = 0, v = 0, g = gCyl) => b.put(k, g, TRS(u, (y0 + y1) / 2, v, r, y1 - y0, r)),
    cylV: (b, k, r, v0, v1, u = 0, y = 0) => b.put(k, gCyl, TRS(u, y, (v0 + v1) / 2, r, Math.abs(v1 - v0), r, Math.PI / 2, 0, 0)),
    box: (b, k, u0, u1, y0, y1, v0, v1) => b.put(k, gBox, TRS((u0 + u1) / 2, (y0 + y1) / 2, (v0 + v1) / 2, u1 - u0, y1 - y0, v1 - v0)),
    sph: (b, k, r, u, y, v, sy = 1) => b.put(k, gSph, TRS(u, y, v, r, r * sy, r))
  };
  /* электродвигатель: кожух вентилятора с решёткой (−), станина с рёбрами, подшипниковый щит, лапы, коробка выводов */
  function motor(b, rot, o) {   // o: {u0 — торец кожуха, uC — начало станины, u1 — фланец/щит, r, yFoot — низ лап, tb: [u, side], eye: u}
    const { u0, uC, u1, r } = o;
    P.cylU(b, 'motor', r * 0.97, u0 + 0.012, uC, 0, 0, gCylO);            // кожух вентилятора (открыт с торца — за решёткой видна крыльчатка)
    P.cylU(b, 'motor', r * 1.0, uC - 0.01, uC + 0.012);                   // кольцо кожуха
    b.put('grille', new THREE.CircleGeometry(r * 0.9, 24), TRS(u0 + 0.011, 0, 0, 1, 1, 1, 0, -Math.PI / 2, 0));
    P.cylU(b, 'motor', r * 0.86, uC, u1 - 0.035);                         // станина
    const nf = 18;
    for (let i = 0; i < nf; i++) {                                         // рёбра охлаждения (кроме зоны лап)
      const a = (i + 0.5) / nf * Math.PI * 2; if (Math.abs(Math.sin(a) + 1) < 0.35) continue;
      b.put('motor', gBox, TRS((uC + u1 - 0.035) / 2, Math.sin(a) * r * 0.93, Math.cos(a) * r * 0.93, u1 - 0.045 - uC, r * 0.15, 0.008, Math.PI / 2 - a, 0, 0));
    }
    P.coneU(b, 'motor', r * 0.86, r * 0.62, u1 - 0.035, u1);              // подшипниковый щит
    // лапы
    for (const fu of [uC + (u1 - uC) * 0.22, uC + (u1 - uC) * 0.78]) for (const s of [-1, 1]) P.box(b, 'motor', fu - 0.03, fu + 0.03, o.yFoot, -r * 0.55, s * r * 0.62 - 0.035, s * r * 0.62 + 0.035);
    if (o.tb) { const [tu, side] = o.tb; if (side) P.box(b, 'motor', tu - 0.065, tu + 0.065, -0.06, 0.06, Math.min(side * r * 0.84, side * (r * 0.84 + 0.1)), Math.max(side * r * 0.84, side * (r * 0.84 + 0.1))); else P.box(b, 'motor', tu - 0.06, tu + 0.06, r * 0.84, r * 0.84 + 0.09, -0.06, 0.06); }
    if (o.eye !== undefined) b.put('steel', new THREE.TorusGeometry(0.022, 0.006, 6, 14), TRS(o.eye, r * 0.86 + 0.03, 0, 1, 1, 1, 0, 0, 0));
    // крыльчатка вентилятора за решёткой — вращается
    const fb = new Bk(); for (let i = 0; i < 6; i++) fb.put('dark', gBox, TRS(0, 0, 0, 0.012, r * 1.5, 0.05, i * Math.PI / 6, 0, 0)); P.cylU(fb, 'dark', 0.035, -0.02, 0.02);
    const fan = new THREE.Group(); fan.position.set(u0 + 0.045, 0, 0); fb.build(fan, null); return fan;
  }
  /* вал с полумуфтами (вращается) */
  function shaftSet(u0, u1, r, coup) {
    const g = new THREE.Group(), b = new Bk();
    P.cylU(b, 'steel', r, u0, u1);
    b.put('dark', gBox, TRS((u0 + u1) / 2, r, 0, (u1 - u0) * 0.6, r * 0.5, r * 0.6));   // шпонка — видно вращение
    if (coup) { const [c0, c1, rc] = coup, cm = (c0 + c1) / 2;
      P.cylU(b, 'steel', rc, c0, cm - 0.004); P.cylU(b, 'steel', rc, cm + 0.004, c1);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.cylU(b, 'dark', 0.007, cm - 0.02, cm + 0.02, Math.sin(a) * rc * 0.72, Math.cos(a) * rc * 0.72); }
      b.put('motor', gBox, TRS(cm - 0.02, rc * 0.5, 0, 0.012, rc * 0.7, 0.02));         // метка на полумуфте
    }
    b.build(g, null); return g;
  }
  /* фланец со шпильками в плоскости ⟂ u */
  function flangeU(b, k, u, r, t = 0.022, nb = 8, rp = 0) {
    P.cylU(b, k, r, u - t / 2, u + t / 2);
    const f = u + t / 2, a0 = u - t / 2 - (rp ? 0.014 : 0.012), a1 = rp ? f + 0.003 + t + 0.014 : u + t / 2 + 0.012;
    for (let i = 0; i < nb; i++) { const a = (i + 0.5) / nb * Math.PI * 2, y = Math.sin(a) * r * 0.8, v = Math.cos(a) * r * 0.8; P.cylU(b, 'steel', 0.008, a0, a1, y, v, gCyl8);
      if (rp) for (const [w0, w1] of [[u - t / 2 - 0.013, u - t / 2], [f + 0.003 + t, f + 0.003 + t + 0.013]]) P.cylU(b, 'steel', 0.0135, w0, w1, y, v, gHex); }
    if (rp) { P.cylU(b, 'dark', r * 0.78, f, f + 0.003); P.cylU(b, k, r, f + 0.003, f + 0.003 + t); P.coneU(b, k, rp * 1.3, rp, f + 0.003 + t, f + FL_JL); FLANGE_STAT.pump++; }   // v0.14: ответный фланец (условно)
  }
  function flangeY(b, k, y, r, u = 0, v = 0, t = 0.022, nb = 8, rp = 0) {
    P.cylY(b, k, r, y - t / 2, y + t / 2, u, v);
    const f = y + t / 2, a0 = y - t / 2 - (rp ? 0.014 : 0.012), a1 = rp ? f + 0.003 + t + 0.014 : y + t / 2 + 0.012;
    for (let i = 0; i < nb; i++) { const a = (i + 0.5) / nb * Math.PI * 2, uu = u + Math.sin(a) * r * 0.8, vv = v + Math.cos(a) * r * 0.8; P.cylY(b, 'steel', 0.008, a0, a1, uu, vv, gCyl8);
      if (rp) for (const [w0, w1] of [[y - t / 2 - 0.013, y - t / 2], [f + 0.003 + t, f + 0.003 + t + 0.013]]) P.cylY(b, 'steel', 0.0135, w0, w1, uu, vv, gHex); }
    if (rp) { P.cylY(b, 'dark', r * 0.78, f, f + 0.003, u, v); P.cylY(b, k, r, f + 0.003, f + 0.003 + t, u, v); b.put(k, new THREE.CylinderGeometry(rp, rp * 1.3, FL_JL - 0.003 - t, 20), TRS(u, f + 0.003 + t + (FL_JL - 0.003 - t) / 2, v, 1, 1, 1)); FLANGE_STAT.pump++; }
  }

  /* ---------- агрегаты: компоновка по плану АК-041 ----------
     R — опорная точка (ось агрегата): для КМ/КМС — центр напорного патрубка; для УОДН — торец всасывающего фланца; для НМШ — ось корпуса насоса.
     U — направление оси от двигателя к насосу; yA — отметка оси (условно); D — точка опуска всасывающей линии (воздушник ⊕ на листе). */
  const UNITS = [
    { id: 'Н-1рез', pid: 'Н-1', kind: 'KM', R: [-74.638, 27.974], U: 'z', yA: -0.53, D: [-74.638, 28.461], rS: 0.054, cS: 'DT', rD: 0.0445, cD: 'DT' },
    { id: 'Н-2', pid: 'Н-2', kind: 'KM', R: [-72.371, 27.974], U: 'z', yA: -0.53, D: [-72.371, 28.461], rS: 0.054, cS: 'DT', rD: 0.0445, cD: 'DT' },
    { id: 'Н-8', pid: 'Н-8', kind: 'KMS', R: [-67.967, 22.739], U: 'x', yA: -0.464, D: [-67.425, 22.739], rS: 0.0795, cS: 'B', rD: 0.054, cD: 'B' },
    { id: 'Н-7', pid: 'Н-7', kind: 'KMS', R: [-67.967, 26.033], U: 'x', yA: -0.464, D: [-67.425, 26.033], rS: 0.0795, cS: 'Z', rD: 0.054, cD: 'DT' },
    { id: 'Н-5рез', pid: 'Н-5', kind: 'UODN', R: [-67.932, 28.653], U: 'x', yA: -0.40, D: [-67.441, 28.653], J: [-67.932, 28.483], rS: 0.1095, cS: 'DT', rD: 0.1035, cD: 'DT' },
    { id: 'Н-6', pid: 'Н-6', kind: 'UODN', R: [-67.932, 30.466], U: 'x', yA: -0.40, D: [-67.441, 30.466], J: [-67.932, 30.296], rS: 0.1095, cS: 'L', rD: 0.1035, cD: 'DT' },
    { id: 'Н-3', pid: 'Н-3', kind: 'NMSH', R: [-67.453, 21.325], U: 'x', yA: -0.59, nN: [-67.371, 21.117], nS: [-67.371, 21.523], rS: 0.0285, cS: 'DT', rD: 0.0285, cD: 'L' }   // v0.28: напор к линии на котельную Ø57×3 (200-ТХ-002)
  ];
  const DESC = {
    KM: 'Горизонтальный консольно-моноблочный центробежный насос (КМ 80-50-215Е по АК-004): всасывание осевое, напорный патрубок вверх; двигатель и корпус — на общем валу, без муфты.',
    KMS: 'Самовсасывающий моноблочный насос КМС 100-80-180-Е (АК-004): двигатель, фонарь, корпус с самовсасывающей камерой; всасывание осевое, напорный патрубок вверх.',
    UODN: 'Насосный агрегат на раме: двигатель — упругая муфта под ограждением — насос УОДН 200-150-125 со спиральным корпусом (АК-004); рядом — самовсасывающий вихревой ВКс 6,3/15 (Н-х.1) для заполнения.',
    NMSH: 'Шестерённый насос НМШ 5-25-2,5/6 (АК-004, n = 980 об/мин): двигатель на плите, муфта, корпус насоса с боковыми патрубками (всас — север, нагнетание — юг по плану).'
  };
  const units = [], rotAll = [], ringPos = {};
  // локальная → мировая
  const toW = (u, y, v, un) => un.U === 'x' ? V3(un.R[0] + u, y + un.yA, un.R[1] + v) : V3(un.R[0] - v, y + un.yA, un.R[1] + u);
  /* ---------- трубы-соединения: прямые + отводы R = 1,5 DN ---------- */
  function run(b, key, pts, r) {      // pts — мировые точки ортогональной ломаной
    PIPEREG.push({ gen: 'PHX', key, r, pts: pts.map(p => p.toArray()), mt: PIPEM[key] || MAT[key], o: PHX_CUR });   // v0.12: в единую модель сети
    const n = pts.length, segs = [];
    for (let i = 0; i < n - 1; i++) segs.push([pts[i].clone(), pts[i + 1].clone()]);
    const Rb = i => Math.min(3 * r, pts[i].distanceTo(pts[i - 1]) / 2, pts[i].distanceTo(pts[i + 1]) / 2);
    for (let i = 1; i < n - 1; i++) {
      const a = pts[i].clone().sub(pts[i - 1]).normalize(), c = pts[i + 1].clone().sub(pts[i]).normalize();
      if (Math.abs(a.dot(c)) > 0.99) continue;
      const R = Rb(i); segs[i - 1][1].addScaledVector(a, -R); segs[i][0].addScaledVector(c, R);
      const C = pts[i].clone().addScaledVector(a, -R).addScaledVector(c, R), X = c.clone().negate(), Y = a.clone(), Z = X.clone().cross(Y);
      const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(C);
      b.put(key, new THREE.TorusGeometry(R, r, 10, 10, Math.PI / 2), m);
    }
    for (const [p0, p1] of segs) { const L = p0.distanceTo(p1); if (L < 1e-3) continue;
      const m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, p1.clone().sub(p0).normalize()), V3(r, L, r));
      b.put(key, gCyl, m); }
  }
  function reducerW(b, key, p0, p1, r0, r1) {   // v0.14: строится PGEO; начало — за ответным фланцем патрубка (FL_JL)
    p0 = p0.clone().addScaledVector(p1.clone().sub(p0).normalize(), FL_JL);
    PIPEREG.push({ gen: 'PHXR', key, r0, r1, p0: p0.toArray(), p1: p1.toArray(), mt: PIPEM[key] || MAT[key], o: PHX_CUR });
    const L = p0.distanceTo(p1), m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, p1.clone().sub(p0).normalize()), V3(1, 1, 1));
    b.put(key, new THREE.CylinderGeometry(r1, r0, L, 20), m);
  }

  function buildUnit(un) {
    const o = OBJ.find(q => q.ph && q.id === un.id); if (!o) return;
    PHX_CUR = o;
    const grp = new THREE.Group(); grp.position.copy(toW(0, 0, 0, un)); grp.rotation.y = un.U === 'x' ? 0 : -Math.PI / 2; o.gS.add(grp);
    const b = new Bk(), rot = [], yPl = Y0 + 0.15 - un.yA;      // верх фундамента в локальной СК
    const wb = new Bk();                                          // трубы-соединения (мировые координаты)
    const plinth = (u0, u1, v0, v1) => P.box(b, 'conc', u0, u1, Y0 - un.yA, yPl, v0, v1);
    let dis, suc;   // напорный патрубок (лок.: u, v, верх фланца y), всасывающий фланец (лок. u)
    if (un.kind === 'KM') {
      plinth(-0.67, 0.21, -0.2, 0.2);
      rot.push(motor(b, rot, { u0: -0.608, uC: -0.562, u1: -0.229, r: 0.136, yFoot: yPl, tb: [-0.38, 1], eye: -0.396 }));
      flangeU(b, 'motor', -0.20, 0.142, 0.05, 0);
      // фонарь (кронштейн) с окнами: кольца + рёбра, внутри — вал и уплотнение
      P.cylU(b, 'pump', 0.11, -0.178, -0.158); P.cylU(b, 'pump', 0.115, -0.045, -0.025);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; b.put('pump', gBox, TRS(-0.10, Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0.13, 0.03, 0.03, a, 0, 0)); }
      const sh = shaftSet(-0.17, -0.02, 0.02, [-0.12, -0.06, 0.035]); grp.add(sh); rot.push(sh);
      // спиральный корпус: диск + наплыв спирали
      P.cylU(b, 'pump', 0.15, -0.025, 0.085);
      b.put('pump', new THREE.TorusGeometry(0.135, 0.045, 10, 28), TRS(0.03, 0.01, 0, 1, 1, 1, 0, Math.PI / 2, 0));
      P.box(b, 'pump', -0.02, 0.08, yPl, -0.14, -0.1, 0.1);                       // лапа корпуса
      P.cylY(b, 'pump', 0.032, 0.1, 0.235); flangeY(b, 'pump', 0.235, 0.08, 0, 0, 0.022, 4, 0.032);   // напорный патрубок DN50
      P.cylU(b, 'pump', 0.075, 0.085, 0.108); P.cylU(b, 'pump', 0.045, 0.108, 0.13); flangeU(b, 'pump', 0.142, 0.1, 0.024, 8, 0.045);   // всасывающий DN80
      dis = { u: 0, v: 0, y: 0.246, r: 0.032 }; suc = { u: 0.154, r: 0.045 };
    } else if (un.kind === 'KMS') {
      plinth(-0.75, 0.3, -0.33, 0.33);
      const fy = yPl;   // рама из швеллера
      for (const s of [-1, 1]) P.box(b, 'frame', -0.69, 0.21, fy, fy + 0.1, s * 0.24 - 0.035, s * 0.24 + 0.035);
      for (const u of [-0.66, -0.08, 0.18]) P.box(b, 'frame', u - 0.03, u + 0.03, fy, fy + 0.1, -0.275, 0.275);
      rot.push(motor(b, rot, { u0: -0.664, uC: -0.601, u1: -0.155, r: 0.166, yFoot: fy + 0.1, tb: [-0.40, -1], eye: -0.42 }));
      flangeU(b, 'motor', -0.15, 0.13, 0.02, 0);
      P.cylU(b, 'pump', 0.07, -0.142, -0.13); P.cylU(b, 'pump', 0.07, -0.08, -0.069);
      for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + 0.5; b.put('pump', gBox, TRS(-0.105, Math.sin(a) * 0.062, Math.cos(a) * 0.062, 0.07, 0.02, 0.025, a, 0, 0)); }
      const sh = shaftSet(-0.15, -0.065, 0.018, [-0.12, -0.085, 0.03]); grp.add(sh); rot.push(sh);
      P.box(b, 'pump', -0.069, 0.06, -0.0975, 0.0975, -0.0975, 0.0975);              // корпус уплотнения
      for (const sv of [-1, 1]) for (const sy of [-1, 1]) P.cylU(b, 'steel', 0.012, 0.055, 0.075, sy * 0.075, sv * 0.075);
      P.box(b, 'pump', 0.045, 0.205, -0.13, 0.12, -0.123, 0.123);                    // самовсасывающая камера
      P.cylY(b, 'pump', 0.05, 0.0975, 0.17); flangeY(b, 'pump', 0.181, 0.1, 0, 0, 0.022, 8, 0.05);   // напорный DN80
      P.cylU(b, 'pump', 0.055, 0.205, 0.255); flangeU(b, 'pump', 0.27, 0.108, 0.026, 8, 0.055);       // всасывающий DN100
      // поперечная опора корпуса (на плане — «Т» под фонарём)
      P.box(b, 'frame', -0.115, -0.05, fy + 0.1, fy + 0.12, -0.30, 0.25); P.box(b, 'frame', -0.10, -0.065, fy + 0.12, -0.0975, -0.06, 0.06);
      dis = { u: 0, v: 0, y: 0.192, r: 0.05 }; suc = { u: 0.283, r: 0.055 };
    } else if (un.kind === 'UODN') {
      plinth(-1.25, 0.08, -0.5, 0.34);
      const fy = yPl;
      for (const s of [-1, 1]) P.box(b, 'frame', -0.992, -0.032, fy, fy + 0.12, s * 0.235 - 0.04, s * 0.235 + 0.04);
      for (const u of [-0.95, -0.55, -0.07]) P.box(b, 'frame', u - 0.035, u + 0.035, fy, fy + 0.12, -0.27, 0.277);
      for (const u of [-0.839, -0.185]) for (const v of [-0.244, 0.248]) P.cylY(b, 'steel', 0.018, fy + 0.12, fy + 0.15, u, v, gCyl8);
      rot.push(motor(b, rot, { u0: -1.168, uC: -0.998, u1: -0.623, r: 0.165, yFoot: fy + 0.12, tb: [-0.80, 1], eye: -0.80 }));
      const sh = shaftSet(-0.63, -0.30, 0.028, [-0.566, -0.382, 0.073]); grp.add(sh); rot.push(sh);
      // ограждение муфты (перфорированное — вращение видно)
      b.put('guard', new THREE.CylinderGeometry(0.11, 0.11, 0.25, 24, 1, true, 0, Math.PI * 1.3), TRS(-0.475, 0, 0, 1, 1, 1, Math.PI * 0.35, 0, -Math.PI / 2));
      P.box(b, 'frame', -0.53, -0.42, fy + 0.12, -0.07, -0.02, 0.02);                // стойка ограждения
      P.cylU(b, 'pump', 0.068, -0.331, -0.287); P.box(b, 'pump', -0.33, -0.29, fy + 0.12, -0.05, -0.07, 0.07);   // подшипниковый узел
      // спиральный корпус (центр смещён к северу — по контуру на плане), крышка-конус, всасывающий фланец DN150
      P.cylU(b, 'pump', 0.216, -0.287, -0.10, 0, -0.057);
      b.put('pump', new THREE.TorusGeometry(0.19, 0.04, 10, 30), TRS(-0.19, 0, -0.057, 1, 1, 1, 0, Math.PI / 2, 0));
      P.coneU(b, 'pump', 0.15, 0.10, -0.10, -0.025); flangeU(b, 'pump', -0.012, 0.13, 0.026, 8, 0.0795);
      P.box(b, 'pump', -0.25, -0.12, fy + 0.12, -0.19, -0.12, 0.12);                 // лапа корпуса
      P.cylY(b, 'pump', 0.067, 0.12, 0.30, -0.15, -0.17); flangeY(b, 'pump', 0.312, 0.125, -0.15, -0.17, 0.026, 8, 0.067);   // напорный DN125 (условно вверх)
      // ВКс 6,3/15 (Н-х.1) — самовсасывающий вихревой, на кронштейне у северной стороны рамы
      const vy = -0.15;
      P.box(b, 'frame', -0.84, -0.42, yPl, vy - 0.08, -0.45, -0.29);
      dis = { u: -0.15, v: -0.17, y: 0.325, r: 0.067 }; suc = { u: 0.0, r: 0.0795 };
    } else if (un.kind === 'NMSH') {
      plinth(-0.55, 0.10, -0.19, 0.19);
      P.box(b, 'frame', -0.424, -0.062, yPl, yPl + 0.03, -0.145, 0.145);
      for (const u of [-0.338, -0.141]) for (const v of [-0.119, 0.122]) P.cylY(b, 'steel', 0.012, yPl + 0.03, yPl + 0.05, u, v, gCyl8);
      rot.push(motor(b, rot, { u0: -0.515, uC: -0.478, u1: -0.176, r: 0.10, yFoot: yPl + 0.03 }));
      P.cylY(b, 'motor', 0.05, 0.08, 0.14, -0.355, 0);                                // коробка выводов (на плане — круг)
      const sh = shaftSet(-0.18, 0.06, 0.015, [-0.13, -0.065, 0.045]); grp.add(sh); rot.push(sh);
      b.put('guard', new THREE.CylinderGeometry(0.065, 0.065, 0.09, 20, 1, true), TRS(-0.098, 0, 0, 1, 1, 1, 0, 0, -Math.PI / 2));
      P.box(b, 'pump', -0.058, 0.057, -0.08, 0.08, -0.079, 0.079);                   // корпус с шестернями
      P.cylU(b, 'pump', 0.05, 0.057, 0.08); P.cylU(b, 'steel', 0.018, 0.08, 0.1);
      P.box(b, 'pump', -0.05, 0.05, yPl, -0.08, -0.06, 0.06);
      for (const s of [-1, 1]) { P.cylV(b, 'pump', 0.025, s * 0.079, s * 0.13); P.cylV(b, 'pump', 0.05, s * 0.13, s * 0.148); }
    }
    const meshes = b.build(grp, o);
    // ВКс: отдельный узел, смещённый к северу (лок. v = −0.37)
    if (un.kind === 'UODN') {
      const vb = new Bk(), vg = new THREE.Group(); vg.position.set(0, -0.15, -0.37); grp.add(vg);
      P.cylU(vb, 'pump', 0.085, -0.60, -0.45); P.cylU(vb, 'pump', 0.06, -0.45, -0.43);
      P.cylY(vb, 'pump', 0.02, 0.08, 0.14, -0.53); P.cylY(vb, 'pump', 0.02, 0.08, 0.14, -0.49);
      vb.build(vg, o);
      // мотор ВКс: перенести вращающиеся части и корпус двигателя
      const mb = new Bk(), mrot = []; mrot.push(motor(mb, mrot, { u0: -0.82, uC: -0.79, u1: -0.60, r: 0.075, yFoot: -0.08, tb: [-0.70, 0] })); mb.build(vg, o);
      mrot.forEach(f => vg.add(f)); rot.push(...mrot);
      // трубка заполнения ВКс → верх спирального корпуса (DN25, условно)
      const pb = new Bk(); run(pb, 'steel', [toW(-0.51, -0.15 + 0.14, -0.37, un), toW(-0.51, 0.27, -0.37, un), toW(-0.26, 0.27, -0.37, un), toW(-0.26, 0.27, -0.08, un), toW(-0.26, 0.20, -0.08, un)], 0.016);
      pb.build(o.gS, o);
    }
    rot.forEach(r => { if (!r.parent) grp.add(r); });
    // ---------- соединения с трубами цеха ----------
    if (un.kind === 'NMSH') {
      for (const [s, n, r, c] of [[-1, un.nN, un.rS, un.cS], [1, un.nS, un.rD, un.cD]]) {
        const p0 = toW(0, 0, s * 0.148, un), p1 = toW(0, 0, s * Math.abs(n[1] - un.R[1]), un);
        run(wb, c, [p0, p1, V3(p1.x, yAt(n[0], n[1]), p1.z), V3(n[0], yAt(n[0], n[1]), n[1])], r);
      }
    } else {
      // нагнетание: стояк от фланца патрубка до оси труб, затем — к началу трубы (J) или в точку R
      const jxz = un.J || un.R, yJ = yAt(jxz[0], jxz[1]), pD = toW(dis.u, dis.y, dis.v, un), top = V3(pD.x, yJ, pD.z), J = V3(jxz[0], yJ, jxz[1]);
      reducerW(wb, un.cD, pD, pD.clone().add(V3(0, 0.12, 0)), dis.r, un.rD);
      const pts = [pD.clone().add(V3(0, 0.12, 0)), top]; if (top.distanceTo(J) > 0.01) pts.push(J); else pts[1] = J;
      run(wb, un.cD, pts, un.rD); wb.put(un.cD, gSph, TRS(J.x, yJ, J.z, un.rD, un.rD, un.rD));
      // всасывание: переход от фланца, участок по оси, отвод вверх в точке D (на листе — воздушник ⊕)
      const pS = toW(suc.u, 0, 0, un), pR = toW(suc.u + 0.12, 0, 0, un);
      reducerW(wb, un.cS, pS, pR, suc.r, un.rS);
      const yD = yAt(un.D[0], un.D[1]); run(wb, un.cS, [pR, V3(un.D[0], un.yA, un.D[1]), V3(un.D[0], yD, un.D[1])], un.rS); wb.put(un.cS, gSph, TRS(un.D[0], yD, un.D[1], un.rS, un.rS, un.rS));
    }
    for (const me of wb.build(o.gS, o, Object.assign({}, MAT, PIPEM))) me.userData.phxPipe = 1;   // v0.14: скрываются, трубы строит PGEO
    o.note = (o.note || '').split('. Положение')[0] + '. ' + DESC[un.kind] + (un.kind === 'KM' ? ' До v0.9 агрегат был показан вертикальным; по плану АК-041 (рёбра двигателя вдоль оси, рым-болт сверху, осевой всас с юга) — горизонтальный.' : '') + ' Положение, ориентация и габариты в плане — по листу АК-041; отметка оси, фундамент и детали конструкции — условно. Вращение вентилятора и муфты показывает состояние «в работе» (скорость отображения условная).' + (un.kind === 'UODN' ? ' Трубка заполнения от ВКс — условно (на листе — короткий участок у корпуса).' : '');
    setAnchor(o);
    const mu = { KM: -0.40, KMS: -0.38, UODN: -0.81, NMSH: -0.35 }[un.kind], rp = toW(mu, 0, 0, un); ringPos[un.id] = [rp.x, 0.12, rp.z];
    units.push({ un, o, rot, run: 0 }); rotAll.push(...rot);
  }
  UNITS.forEach(buildUnit);

  /* ---------- арматура (InstancedMesh по деталям; клик — карточка) ---------- */
  const VL = D.valves, ind = {};
  const parts = {}, part = (key, geo, m) => parts[key] || (parts[key] = { geo, m, mats: [], ids: [] });
  const vObj = [], vIdOf = [];
  const PROCV = Object.entries(PROC.valves);
  const KNM = { G: 'Задвижка клиновая с выдвижным шпинделем', C: 'Клапан обратный поворотный', S: 'Клапан предохранительный (байпас нагнетание → всас)' };
  /* v0.23: задвижки 30с41нж Ру1,6 (200-ТХ.С-001-0 поз. 13–16: Ду200 — 4, Ду150 — 13, Ду100 — 12, Ду80 — 2). Ду — по диаметру трубы в месте установки.
     Габариты: строительная длина L, высота от оси до маховика (закрыта) H, Ø фланца — по каталожным данным изготовителей, ОРИЕНТИРОВОЧНО. Ход шпинделя ≈ Ду. */
  const DNOF = rp => rp >= 0.095 ? 200 : rp >= 0.075 ? 150 : rp >= 0.05 ? 100 : 80;
  const CATV = { 80: [0.21, 0.39, 0.0975], 100: [0.23, 0.44, 0.1075], 150: [0.28, 0.60, 0.14], 200: [0.33, 0.75, 0.1675] };
  /* v0.23: предохранительные клапаны — по насосу байпаса (200-ТХ.ОЛ-005…008): тип, Ду входа, Рн; высота — по каталогу, ОРИЕНТИРОВОЧНО */
  const SPPK = { 'Н-5рез': ['СППК4Р 150-16М (17с6нж)', 150, 0.93, '0,44 МПа', 'ОЛ-005'], 'Н-6': ['СППК4Р 150-16М (17с6нж)', 150, 0.93, '0,44 МПа', 'ОЛ-005'],
    'Н-7': ['СППК5Р 100-16', 100, 0.62, '0,385 МПа', 'ОЛ-006'], 'Н-8': ['СППК5Р 100-16', 100, 0.62, '0,385 МПа', 'ОЛ-006'],
    'Н-1рез': ['СППК4Р 50-16 (17с6нж)', 50, 0.43, '0,561 МПа', 'ОЛ-007'], 'Н-2': ['СППК4Р 50-16 (17с6нж)', 50, 0.43, '0,561 МПа', 'ОЛ-007'], 'Н-3': ['СППК4Р 50-16 (17с6нж)', 50, 0.43, '0,66 МПа', 'ОЛ-008'] };
  const spOf = v => { let best = null, bd = 1e9; for (const p of PH.pumps) { const d = Math.hypot((p[0] + p[2]) / 2 - v.x, (p[1] + p[3]) / 2 - v.z); if (d < bd) { bd = d; best = p[5]; } } return [best, SPPK[best]]; };
  const KNOTE = {
    G: 'Символ ⊗ на листе АК-041 — маховик задвижки (вид сверху); диаметр маховика — по символу, высота — условно.',
    C: 'Круг между фланцами сразу после PIS на напорной линии — обратный клапан (по составу обвязки насоса в АК-004). Конструкция — условно.',
    S: 'Квадрат с кругом в узле байпаса напорной линии во всасывающую — предохранительный клапан (АК-004: «байпас с предохранительным клапаном»). Исполнение (угловой, пружинный) — условно.'
  };
  function flMate(put, L, rp, rfl) {   // v0.14: ответные фланцы трубы с прокладкой, шпильки с гайками — по обе стороны арматуры (PN16, условно)
    const F = flangeOfOD(2 * rp), t = F[4], nb = F[2], db = F[3], pcd = Math.min(F[1] / 2, rfl - db * 0.9);
    for (const s of [-1, 1]) {
      const f0 = s * L / 2;
      put('vgsk', gCyl, MAT.dark, TRS(f0 + s * 0.0015, 0, 0, pcd - db * 0.7, 0.003, pcd - db * 0.7, 0, 0, Math.PI / 2));
      put('vfl2', gCyl, MAT.valve, TRS(f0 + s * (0.003 + t / 2), 0, 0, rfl, t, rfl, 0, 0, Math.PI / 2));
      put('vneck', gCyl, MAT.valve, TRS(f0 + s * (0.003 + t + 0.012), 0, 0, rp * 1.22, 0.024, rp * 1.22, 0, 0, Math.PI / 2));
      const x0 = f0 - s * 0.038, x1 = f0 + s * (0.015 + t);
      for (let k = 0; k < nb; k++) {
        const a = (k + 0.5) / nb * Math.PI * 2, y = Math.sin(a) * pcd, z = Math.cos(a) * pcd;
        put('vbolt', gStud, MAT.steel, TRS((x0 + x1) / 2, y, z, db / 2, Math.abs(x1 - x0), db / 2, 0, 0, Math.PI / 2));
        for (const xn of [x0 + s * 0.0065, x1 - s * 0.0065]) put('vnut', gHex, MAT.steel, TRS(xn, y, z, db * 0.85, 0.013, db * 0.85, 0, 0, Math.PI / 2));
      }
      FLANGE_STAT.valve++;
    }
  }
  VL.forEach((v, i) => {
    const vid = v.k === 'G' ? (PROCV.find(([k, q]) => Math.hypot(q.p[0] - v.x, q.p[1] - v.z) < 0.05) || [null])[0] : null;
    vIdOf[i] = vid;
    vObj[i] = vid ? null : { id: v.k === 'G' ? 'задв.' : v.k === 'C' ? 'КО' : 'ПК', net: 1, name: KNM[v.k] + ' — насосный цех 200', note: KNOTE[v.k] + (v.k === 'G' ? ' В технологическом графе эта задвижка не моделируется — показана в нормальном (открытом) положении.' : '') };
    if (v.k === 'G' && vObj[i]) { const dn = DNOF(v.r), c = CATV[dn]; vObj[i].name = `Задвижка клиновая 30с41нж Ду${dn} Ру1,6 — насосный цех 200`; vObj[i].note += ` v0.23: тип и Ду — по 200-ТХ.С-001-0 (Ду — по диаметру трубы); строительная длина ${c[0] * 1000} мм, высота до маховика ≈ ${c[1] * 1000} мм, Ø фланца ${Math.round(c[2] * 2000)} мм — каталожные значения, ориентировочно.`; }
    if (v.k === 'S') { const [pn, sp] = spOf(v); if (sp) { vObj[i].name = `Клапан предохранительный ${sp[0]} — байпас насоса ${pn}`; vObj[i].note = `200-ТХ.ОЛ-${sp[4].slice(3)}-0 и расчёт СППК: ${sp[0]}, Ду${sp[1]} Ру16, давление настройки ${sp[3]}. Привязка клапана к насосу — по ближайшему агрегату на плане АК-041. Высота ≈ ${Math.round(sp[2] * 1000)} мм и форма (угловой пружинный, с рычагом) — по каталожным данным, ориентировочно.`; } }
    const ry = v.dir === 'x' || v.dir === '+x' || v.dir === '-x' ? 0 : -Math.PI / 2, rp = v.r, s = v.s;
    const base = new THREE.Matrix4().compose(V3(v.x, yAt(v.x, v.z), v.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.k === 'S' ? 0 : ry, 0)), V3(1, 1, 1));
    const put = (key, geo, m, lm) => { const Pt = part(key, geo, m); Pt.mats.push(new THREE.Matrix4().multiplyMatrices(base, lm)); Pt.ids.push(i); return Pt.mats.length - 1; };
    const DNV = DNOF(rp), rfl = v.k === 'G' ? CATV[DNV][2] : rp + 0.06;
    if (v.k === 'G') {
      const L = CATV[DNV][0], Hb = rp * 1.6, Hw = CATV[DNV][1] - 0.03, stroke = DNV / 1000;   // v0.23: каталожные габариты 30с41нж (ориентировочно)
      put('vfl', gCyl, MAT.valve, TRS(-L / 2 + 0.013, 0, 0, rfl, 0.026, rfl, 0, 0, Math.PI / 2)); put('vfl', gCyl, MAT.valve, TRS(L / 2 - 0.013, 0, 0, rfl, 0.026, rfl, 0, 0, Math.PI / 2));
      put('vfl', gCyl, MAT.valve, TRS(0, 0, 0, rp * 1.25, L - 0.05, rp * 1.25, 0, 0, Math.PI / 2)); flMate(put, L, rp, rfl);
      put('vbS', gSph, MAT.valve, TRS(0, rp * 0.4, 0, rp * 1.55, rp * 1.9, rp * 1.25));
      put('vfl', gCyl, MAT.valve, TRS(0, Hb + 0.012, 0, rp * 1.5, 0.024, rp * 1.25));      // фланец крышки
      put('vfl', gCyl, MAT.valve, TRS(0, Hb + 0.024 + (Hw - Hb) * 0.18, 0, rp * 0.75, (Hw - Hb) * 0.36, rp * 0.75));   // крышка
      for (const sx of [-1, 1]) put('vyoke', gBox, MAT.valve, TRS(sx * rp * 0.55, Hb + (Hw - Hb) * 0.68, 0, 0.025, (Hw - Hb) * 0.64, 0.03));   // стойки бугеля
      put('vyoke', gBox, MAT.valve, TRS(0, Hw - 0.02, 0, rp * 1.2 + 0.03, 0.04, 0.05));
      const wi = put('vwheel', gTorW, MAT.wheel, TRS(0, Hw + 0.015, 0, s / 2, s / 2, s / 2, Math.PI / 2, 0, 0));
      const si = put('vspoke', gBox, MAT.wheel, TRS(0, Hw + 0.015, 0, s * 0.98, 0.014, 0.022)); const si2 = put('vspoke', gBox, MAT.wheel, TRS(0, Hw + 0.015, 0, 0.022, 0.014, s * 0.98));
      const sti = put('vstem', gStem, MAT.stem, TRS(0, Hw, 0, 0.012, 0.01, 0.012));
      const open0 = vid ? (procLogic.st.valve[vid] ? 1 : 0) : 1;
      v._a = { base, Hw, stroke, s, wi, si, si2, sti, t: open0, ang: 0, vid };
      if (vid) RVSD.ind[vid] = [v.x, yAt(v.x, v.z) + Hw + stroke + 0.09, v.z, 0.6];   // индикатор состояния ТП — меньше, над шпинделем
    } else if (v.k === 'C') {
      const L = Math.max(0.9 * s, 5 * rp);
      put('vfl', gCyl, MAT.valve, TRS(-L / 2 + 0.013, 0, 0, rfl, 0.026, rfl, 0, 0, Math.PI / 2)); put('vfl', gCyl, MAT.valve, TRS(L / 2 - 0.013, 0, 0, rfl, 0.026, rfl, 0, 0, Math.PI / 2));
      put('vfl', gCyl, MAT.valve, TRS(0, 0, 0, rp * 1.2, L - 0.05, rp * 1.2, 0, 0, Math.PI / 2)); flMate(put, L, rp, rfl);
      put('vbS', gSph, MAT.valve, TRS(0, 0, 0, s * 0.42, rp * 1.5, s * 0.36));
      put('vfl', gCyl, MAT.valve, TRS(0, rp * 1.45, 0, s * 0.36, 0.03, s * 0.36));          // крышка на болтах
      put('vfl', gCyl, MAT.valve, TRS(0, rp * 1.45 + 0.025, 0, s * 0.12, 0.03, s * 0.12));
      put('varrow', gCone4, MAT.lever, TRS(0, rp * 1.2 + 0.005, rp * 1.25, 0.03, 0.05, 0.004, 0, 0, -Math.PI / 2));   // стрелка направления
    } else if (v.k === 'S') {   // v0.23: угловой пружинный СППК с рычагом: вход снизу (от тройника), выход вбок — в байпас
      const [, sp] = spOf(v), H = sp ? sp[2] : 0.43, dn = sp ? sp[1] : 50, ri = dn / 2000 + 0.01, ro = ri * 1.35, o = v.dir, ox = o[1] === 'x' ? (o[0] === '+' ? 1 : -1) : 0, oz = o[1] === 'z' ? (o[0] === '+' ? 1 : -1) : 0;
      const y0 = rp + 0.03, yb = y0 + H * 0.2, rX = oz ? Math.PI / 2 : 0, rZ = ox ? Math.PI / 2 : 0;
      put('svC', gCyl, MAT.sv, TRS(0, (rp * 0.4 + y0) / 2, 0, ri, y0 - rp * 0.4, ri));                 // патрубок от тройника
      put('svC', gCyl, MAT.sv, TRS(0, y0, 0, ri * 1.6 + 0.01, 0.026, ri * 1.6 + 0.01));                 // входной фланец
      put('svC', gCyl, MAT.sv, TRS(0, yb, 0, ri * 1.3, H * 0.3, ri * 1.3));                              // литой корпус
      put('svS', gSph, MAT.sv, TRS(0, yb - H * 0.15, 0, ri * 1.3, ri * 0.5, ri * 1.3));                  // днище корпуса
      put('svC', gCyl, MAT.sv, TRS(ox * ri * 1.7, yb, oz * ri * 1.7, ro, ri * 2.6, ro, rX, 0, rZ));     // выходной патрубок
      put('svC', gCyl, MAT.sv, TRS(ox * ri * 3.0, yb, oz * ri * 3.0, ro * 1.55 + 0.02, 0.026, ro * 1.55 + 0.02, rX, 0, rZ));   // выходной фланец
      put('svC', gCyl, MAT.sv, TRS(0, y0 + H * 0.37, 0, ri * 1.85, 0.028, ri * 1.85));                  // фланец крышки
      put('svC', gCyl, MAT.sv, TRS(0, y0 + H * 0.43, 0, ri * 1.15, H * 0.1, ri * 1.15));                // крышка
      put('svC', gCyl, MAT.sv, TRS(0, y0 + H * 0.64, 0, ri * 0.8, H * 0.34, ri * 0.8));                 // корпус пружины
      put('svC', gCyl, MAT.sv, TRS(0, y0 + H * 0.84, 0, ri * 0.7, H * 0.06, ri * 0.7));                 // колпак
      put('svS', gSph, MAT.sv, TRS(0, y0 + H * 0.88, 0, ri * 0.7, H * 0.04, ri * 0.7));
      put('svL', gBox, MAT.lever, TRS(ri * 1.2, y0 + H * 0.82, 0, ri * 2.8 + 0.08, 0.016, 0.022));     // рычаг для продувки
    }
  });
  const IM = {};
  for (const [key, Pt] of Object.entries(parts)) {
    const im = new THREE.InstancedMesh(Pt.geo, Pt.m, Pt.mats.length);
    Pt.mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true;
    im.userData.pick = h => { const i = Pt.ids[h.instanceId]; return vIdOf[i] && typeof procValveObj === 'function' ? procValveObj(vIdOf[i]) : vObj[i]; };
    pickables.push(im); G.add(im); IM[key] = { im, Pt };
    if (key === 'vbolt' || key === 'vnut' || key === 'vgsk') FAST_LOD.push(im);   // v0.14
  }
  const _m = new THREE.Matrix4();
  function setGate(v) {
    const a = v._a, e = a.t * a.t * (3 - 2 * a.t), top = a.Hw + 0.03 + e * a.stroke;
    // шпиндель: от бугеля до верха (выдвигается при открытии)
    IM.vstem.im.setMatrixAt(a.sti, _m.multiplyMatrices(a.base, TRS(0, (a.Hw * 0.55 + top) / 2, 0, 0.012, top - a.Hw * 0.55, 0.012))); IM.vstem.im.instanceMatrix.needsUpdate = true;
    IM.vwheel.im.setMatrixAt(a.wi, _m.multiplyMatrices(a.base, TRS(0, a.Hw + 0.015, 0, a.s / 2, a.s / 2, a.s / 2, Math.PI / 2, 0, a.ang))); IM.vwheel.im.instanceMatrix.needsUpdate = true;
    IM.vspoke.im.setMatrixAt(a.si, _m.multiplyMatrices(a.base, TRS(0, a.Hw + 0.015, 0, a.s * 0.98, 0.014, 0.022, 0, a.ang, 0)));
    IM.vspoke.im.setMatrixAt(a.si2, _m.multiplyMatrices(a.base, TRS(0, a.Hw + 0.015, 0, 0.022, 0.014, a.s * 0.98, 0, a.ang, 0))); IM.vspoke.im.instanceMatrix.needsUpdate = true;
  }
  VL.forEach(v => { if (v._a) setGate(v); });

  /* ---------- фильтры ---------- */
  {
    const fb = new Bk();
    for (const f of D.fil) {
      const o = { id: 'Ф', net: 1, name: f.lbl, note: f.k === 'B' ? 'На листе АК-041 — круг с поперечной чертой между манометрами PI до/после: корзинчатый фильтр (крышка с ручкой, вид сверху). Состав «фильтр, PI до и после» — по АК-004. Габариты — по символу, конструкция — условно.' : 'Сетчатый фильтр на всасывающей линии (символ «полумесяц + корпус» на листе АК-041; АК-004: фильтр с PI до и после). Крышка — со стороны «полумесяца». Габариты — по символу, конструкция — условно.' };
      const b = new Bk(), r = f.r, un = { U: f.dir === 'x' ? 'x' : 'z', R: [f.x, f.z], yA: yAt(f.x, f.z) };
      const g = new THREE.Group(); g.position.set(f.x, yAt(f.x, f.z), f.z); g.rotation.y = f.dir === 'x' ? 0 : -Math.PI / 2; G.add(g);
      if (f.k === 'B') {   // корзинчатый: вертикальный корпус, патрубки по линии трубы
        const R0 = 0.165, L = 0.62;
        for (const s of [-1, 1]) { P.cylU(b, 'fil', r * 1.05, s * 0.12, s * (L / 2 - 0.02)); flangeU(b, 'fil', s * (L / 2 - 0.013), r + 0.06, 0.026, 8); }
        P.cylY(b, 'fil', R0, -0.36, 0.12); P.sph(b, 'fil', R0, 0, -0.36, 0, 0.35);
        flangeY(b, 'fil', 0.135, R0 + 0.03, 0, 0, 0.03, 12); P.cylY(b, 'fil', R0 * 0.95, 0.15, 0.19);
        P.box(b, 'steel', -0.13, 0.13, 0.19, 0.215, -0.018, 0.018); P.box(b, 'steel', -0.13, -0.11, 0.15, 0.215, -0.018, 0.018); P.box(b, 'steel', 0.11, 0.13, 0.15, 0.215, -0.018, 0.018);   // ручка крышки
        P.cylY(b, 'steel', 0.018, -0.46, -0.40);                                    // сливная пробка
        P.box(b, 'frame', -0.08, 0.08, Y0 - yAt(f.x, f.z), -0.40, -0.08, 0.08);               // опора корпуса
      } else {             // сетчатый: горизонтальный корпус, крышка со стороны «полумесяца»
        const R0 = Math.max(r * 2.2, 0.07), L = Math.max(R0 * 3.2, 0.26), c = f.cov;
        for (const s of [-1, 1]) flangeU(b, 'fil', s * (L / 2 + 0.06), r + 0.06, 0.024, 8);
        for (const s of [-1, 1]) P.cylU(b, 'fil', r * 1.05, s * L / 2, s * (L / 2 + 0.05));
        P.cylU(b, 'fil', R0, -L / 2, L / 2, -R0 * 0.35);
        P.cylU(b, 'fil', R0 * 1.18, c * L / 2 - 0.015, c * L / 2 + 0.015, -R0 * 0.35);   // фланец крышки
        b.put('fil', gSph, TRS(c * (L / 2 + 0.015), -R0 * 0.35, 0, R0 * 0.32, R0 * 1.05, R0 * 1.05));
        P.cylY(b, 'steel', 0.012, -R0 * 1.4, -R0 * 1.25, -c * L * 0.2, 0);          // сливная пробка
      }
      b.build(g, o);
    }
    fb.build(G, null);
  }

  /* ---------- воздушники (⊕ на листе) ---------- */
  {
    const b = new Bk(), o = { id: 'возд.', net: 1, name: 'Воздушник (кран на верхней точке всасывающего опуска)', note: 'Символ ⊕ на всасывающей линии у каждого насоса (АК-041); АК-004 предусматривает воздушник и дренаж в обвязке насоса. Назначение по символу принято условно; тип крана — условно.' };
    for (const [x, z] of D.vents) {
      const pp = PH.pipes.find(q => (Math.abs(q[0] - x) < 0.02 && Math.abs(q[1] - z) < 0.02) || (Math.abs(q[2] - x) < 0.02 && Math.abs(q[3] - z) < 0.02)) || PH.pipes.find(q => Math.abs(q[1] - z) < 0.02 && Math.min(q[0], q[2]) <= x && x <= Math.max(q[0], q[2]));
      const r = pp ? pp[4] / 2 : 0.06, y = yAt(x, z) + r;
      P.cylY(b, 'steel', 0.012, y - 0.01, y + 0.07, x, z); P.sph(b, 'valve', 0.022, x, y + 0.08, z); P.box(b, 'lever', x - 0.01, x + 0.09, y + 0.095, y + 0.105, z - 0.008, z + 0.008);
    }
    b.build(G, o);
  }

  /* ---------- опоры ОП / ОН — места и марки по 200-ТХ-002-0 (v0.31; прежде — знаки АК-041 без марок) ---------- */
  F31.patchSup(D, PH); F31.hallSup(D, yAt, Y0, G);

  /* ---------- манометры PI и датчики PIS: шкалы/индикаторы реагируют на работу насоса (модельно) ---------- */
  const GA = [];
  {
    const tagPump = t => ({ '01': 'Н-1', '02': 'Н-1', '03': 'Н-1', '04': 'Н-2', '05': 'Н-2', '06': 'Н-2', '07': 'Н-3', '08': 'Н-3', '09': 'Н-3', '10': 'Н-5', '11': 'Н-5', '12': 'Н-5', '13': 'Н-6', '14': 'Н-6', '15': 'Н-6', '16': 'Н-7', '17': 'Н-7', '18': 'Н-7', '19': 'Н-8', '20': 'Н-8', '21': 'Н-8' })[t.slice(-2)];
    const list = PH.ins.filter(q => q[5] === 'P' || q[5] === 'S');
    // атлас циферблатов (PI) и индикаторов (PIS)
    const N = list.length, cell = 128, cols = 8, rows = Math.ceil(N / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cell; cv.height = rows * cell; const cx = cv.getContext('2d');
    const atlas = new THREE.CanvasTexture(cv); atlas.colorSpace = THREE.SRGBColorSpace;
    const faceM = new THREE.MeshBasicMaterial({ map: atlas });
    const faceGeos = [];
    const drawPI = (i, tag, max) => {
      const x0 = (i % cols) * cell, y0 = Math.floor(i / cols) * cell, c = cell / 2;
      cx.fillStyle = '#20252a'; cx.fillRect(x0, y0, cell, cell);
      cx.fillStyle = '#f4f4f0'; cx.beginPath(); cx.arc(x0 + c, y0 + c, c - 4, 0, 7); cx.fill();
      cx.strokeStyle = '#222'; cx.lineWidth = 2;
      for (let k = 0; k <= 20; k++) { const a = Math.PI * 0.75 + k / 20 * Math.PI * 1.5, r0 = k % 5 ? c - 14 : c - 20; cx.beginPath(); cx.moveTo(x0 + c + Math.cos(a) * r0, y0 + c + Math.sin(a) * r0); cx.lineTo(x0 + c + Math.cos(a) * (c - 9), y0 + c + Math.sin(a) * (c - 9)); cx.stroke(); }
      cx.fillStyle = '#222'; cx.font = 'bold 11px Arial'; cx.textAlign = 'center';
      for (let k = 0; k <= 4; k++) { const a = Math.PI * 0.75 + k / 4 * Math.PI * 1.5; cx.fillText(String(+(max * k / 4).toFixed(3)).replace('.', ','), x0 + c + Math.cos(a) * (c - 32), y0 + c + Math.sin(a) * (c - 32) + 4); }
      cx.font = '10px Arial'; cx.fillText('МПа', x0 + c, y0 + c + 22); cx.fillStyle = '#b02a2a'; cx.font = 'bold 10px Arial'; cx.fillText(tag, x0 + c, y0 + c - 18);
    };
    const drawPIS = (i, tag, val) => {
      const x0 = (i % cols) * cell, y0 = Math.floor(i / cols) * cell;
      cx.fillStyle = '#c9ced3'; cx.fillRect(x0, y0, cell, cell);
      cx.fillStyle = '#9fb59a'; cx.fillRect(x0 + 10, y0 + 30, cell - 20, 60);
      cx.fillStyle = '#16210f'; cx.font = 'bold 34px "Courier New", monospace'; cx.textAlign = 'center'; cx.fillText(val.toFixed(2).replace('.', ','), x0 + cell / 2, y0 + 74);
      cx.font = 'bold 13px Arial'; cx.fillText('МПа', x0 + cell - 30, y0 + 86); cx.fillStyle = '#333'; cx.font = 'bold 12px Arial'; cx.fillText(tag, x0 + cell / 2, y0 + 20); cx.fillText('Profibus PA', x0 + cell / 2, y0 + 114);
    };
    const needleIM = new THREE.InstancedMesh(gBox, MAT.needle, N);
    const caseB = new Bk();
    list.forEach(([x, z, w, h, tag, k], i) => {
      const pid = tagPump(tag), alongX = w < h, pp = PH.pipes.find(q => alongX ? Math.abs(q[1] - z) < 0.04 && Math.min(q[0], q[2]) - 0.02 <= x && x <= Math.max(q[0], q[2]) + 0.02 : Math.abs(q[0] - x) < 0.04 && Math.min(q[1], q[3]) - 0.02 <= z && z <= Math.max(q[1], q[3]) + 0.02);
      const pz = pp && alongX ? pp[1] : z, px = pp && !alongX ? pp[0] : x, r = pp ? pp[4] / 2 : 0.06;
      const fn = alongX ? V3(0, 0, 1) : V3(1, 0, 0);          // нормаль циферблата
      const y0 = yAt(px, pz) + r, isS = k === 'S';
      const pu = PROC.pumps[pid], pn = pu && pu.P ? parseFloat(String(pu.P).split('/')[0].replace(',', '.')) : 0;
      const n = parseInt(tag.slice(-2), 10), before = ({ 1: 1, 4: 1, 7: 1, 10: 1, 13: 1, 16: 1, 19: 1 })[n] === 1;
      const max = isS ? 1.0 : 0.04, val = isS ? pn : (before ? 0.020 : 0.016);
      // отбор, кран, корпус
      P.cylY(caseB, 'steel', 0.008, y0 - 0.01, y0 + 0.16, px, pz); P.box(caseB, 'valve', px - 0.022, px + 0.022, y0 + 0.07, y0 + 0.1, pz - 0.022, pz + 0.022);
      const cen = V3(px, y0 + (isS ? 0.27 : 0.22), pz);
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), fn);
      if (isS) {   // датчик давления: корпус электроники с индикатором
        caseB.put('pis', gCyl, new THREE.Matrix4().compose(cen, q, V3(0.06, 0.09, 0.06)));
        caseB.put('steel', gCyl, new THREE.Matrix4().compose(V3(px, y0 + 0.19, pz), new THREE.Quaternion(), V3(0.02, 0.06, 0.02)));
        caseB.put('pis', gBox, new THREE.Matrix4().compose(V3(px, y0 + 0.27, pz).addScaledVector(fn, -0.02), q, V3(0.05, 0.06, 0.05)));
      } else {
        caseB.put('gauge', gCyl, new THREE.Matrix4().compose(cen, q, V3(0.052, 0.03, 0.052)));
        caseB.put('steel', gTorR, new THREE.Matrix4().compose(cen.clone().addScaledVector(fn, 0.016), new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), fn), V3(0.052, 0.052, 0.052)));
      }
      // лицевая плоскость с участком атласа
      const fg = new THREE.PlaneGeometry(isS ? 0.1 : 0.094, isS ? 0.1 : 0.094), uv = fg.attributes.uv, u0 = (i % cols) / cols, v0 = 1 - (Math.floor(i / cols) + 1) / rows;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / cols, v0 + uv.getY(j) / rows);
      const fp = cen.clone().addScaledVector(fn, isS ? 0.0605 : 0.0165);
      fg.applyMatrix4(new THREE.Matrix4().compose(fp, new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), fn), V3(1, 1, 1)));
      faceGeos.push(fg);
      if (isS) drawPIS(i, tag, 0); else drawPI(i, tag, max);
      const g = { i, tag, pid, isS, max, val, cur: 0, cen: fp.clone().addScaledVector(fn, 0.002), fn, lastDrawn: 0, before, pn,
        o: { id: tag, net: 1, name: (isS ? 'Датчик давления с индикацией и сигнализацией ' : 'Манометр показывающий ') + tag, get note() {
          const run = typeof procLogic !== 'undefined' && pid && procLogic.st.pump[pid];
          return (isS ? `Обозначение PIS на листе АК-041; Рном / Рmax по АК-004: ${pu ? pu.P : '—'} МПа (${pid}). Связь — PROFIBUS PA (АК-006).` : `Обозначение PI на листе АК-041; ${before ? 'до' : 'после'} фильтра на всасе ${pid} (АК-004). Шкала 0…0,04 МПа (по АК-004).`) +
            ` Показание сейчас (модель): ${g.cur.toFixed(3).replace('.', ',')} МПа${run ? '' : ' — насос остановлен'}. Значения модельные: при работе — гидравлический расчёт v0.35 (рабочая точка насоса на сети)${g.hv != null && g.hv < 0 ? `; расчёт ${g.hv.toFixed(3).replace('.', ',').replace('-', '−')} МПа — разрежение, ниже шкалы прибора` : ''}; статический напор при остановке не показывается. Тип прибора — условно.`; } } };
      GA.push(g);
    });
    caseB.build(GI, null);
    const faces = new THREE.Mesh(mergeGeosUV(faceGeos), faceM); GI.add(faces);
    needleIM.castShadow = false; GI.add(needleIM);
    const pickG = h => GA[h.instanceId] ? GA[h.instanceId].o : null; needleIM.userData.pick = pickG; pickables.push(needleIM);
    faces.userData.pick = h => { const k = Math.floor(h.faceIndex / 2); return GA[k] ? GA[k].o : null; }; pickables.push(faces);
    GA.atlas = atlas; GA.drawPIS = drawPIS; GA.needle = needleIM;
    GA.forEach(g => setNeedle(g));
  }
  function mergeGeosUV(list) {
    let n = 0; const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const q of parts) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); uv.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere(); return g;
  }
  function setNeedle(g) {
    if (g.isS) { g.needleHide = true; GA.needle.setMatrixAt(g.i, TRS(0, -100, 0, 0, 0, 0)); GA.needle.instanceMatrix.needsUpdate = true; return; }
    const a = Math.PI * 0.75 + Math.min(1, g.cur / g.max) * Math.PI * 1.5;   // угол на циферблате (canvas: по часовой от +x)
    const right = g.fn.x ? V3(0, 0, -g.fn.x) : V3(g.fn.z, 0, 0);            // ось «u» текстуры в мире
    const dir = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(V3(0, -1, 0), Math.sin(a)).normalize();
    const len = 0.036, m = new THREE.Matrix4().makeBasis(dir, g.fn.clone().cross(dir).normalize(), g.fn.clone()).setPosition(g.cen.clone().addScaledVector(dir, len / 2 - 0.006));
    m.scale(V3(len, 0.004, 0.002)); GA.needle.setMatrixAt(g.i, m); GA.needle.instanceMatrix.needsUpdate = true;
  }

  /* ---------- анимация: насосы, задвижки, приборы ---------- */
  let tPrev = performance.now(), atlasDirty = false;
  function tick() {
    const now = performance.now(), dt = Math.min(0.5, (now - tPrev) / 1000); tPrev = now;
    if (typeof procLogic === 'undefined') return;
    const st = procLogic.st;
    for (const u of units) {
      const on = !!st.pump[u.un.pid]; u.run += ((on ? 1 : 0) - u.run) * Math.min(1, dt * (on ? 1.2 : 0.6));   // разгон/выбег
      if (u.run > 0.003) for (const r of u.rot) r.rotation.x += dt * u.run * 9.0;
    }
    for (const v of VL) {
      const a = v._a; if (!a) continue;
      const tgt = a.vid ? (window.__VPOS ? window.__VPOS(a.vid, st.valve[a.vid] ? 1 : 0) : (st.valve[a.vid] ? 1 : 0)) : 1;
      if (Math.abs(tgt - a.t) > 1e-3) { const d = Math.sign(tgt - a.t) * Math.min(Math.abs(tgt - a.t), dt / 2.5); a.t += d; a.ang += d * 18; setGate(v); }
    }
    for (const g of GA) {
      const on = g.pid && st.pump[g.pid], tgt = window.__HYDG ? window.__HYDG(g, on) : (on ? g.val : 0);
      if (Math.abs(tgt - g.cur) > g.max * 0.001) { g.cur += (tgt - g.cur) * Math.min(1, dt * 2.5); setNeedle(g);
        if (g.isS && Math.abs(g.cur - g.lastDrawn) > 0.005) { GA.drawPIS(g.i, g.tag, g.cur); g.lastDrawn = g.cur; atlasDirty = true; } }
      else if (g.isS && g.cur !== tgt) { g.cur = tgt; GA.drawPIS(g.i, g.tag, g.cur); g.lastDrawn = g.cur; atlasDirty = true; }
    }
    if (atlasDirty) { GA.atlas.needsUpdate = true; atlasDirty = false; }
  }
  return { tick, units, VL, GA, ind, ringPos };
})();

const procNet = new THREE.Group(), procVal = new THREE.Group(), procFlag = new THREE.Group(), procAct = new THREE.Group();
procNet.name = 'procNet'; procVal.name = 'procVal'; procFlag.name = 'procFlag';
scene.add(procNet, procVal, procFlag); procNet.add(procAct);
