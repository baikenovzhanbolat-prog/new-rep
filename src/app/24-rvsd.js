/* =====================================================================================
   Этап 6.1 — детальная модель РВС-1000 (109.1, 109.2, 109.3)
   Подтверждено документацией:
     АК-004 л.6 — V=1000 м³, Dвн=10,43 м, Нст=12,0 м, стационарная крыша, ДТ летнее; теплоизоляция стенки;
                  патрубки ⌀219×6 (2 отвода с задвижками, FA109-14/16/18) и ⌀159×4,5 (1 задвижка, FA109-13/15/17);
                  LSA H=10 800 / L=700 мм, LT (700…10 700 мм), TT.
     ГП-003     — центры резервуаров, лестница на северо-восточной стороне.
     ГП-005     — отводы ДТ(Л) ⌀219/⌀159 (концы трасс), газоуравнительная обвязка Гу,
                  противопожарный водопровод и пенорастворопровод к каждому РВС с северной стороны.
   Всё остальное (изоляция 100 мм, облицовка, уклон кровли, шаг лестницы, оборудование кровли, тип задвижек,
   кольцо орошения, пеногенераторы, люки, заземление) — условно, по типовым решениям; вынесено в константы.
   v0.26 — по ТЗ на РВС-1000 (222.pdf, л. 21–23) и комплекту 109-ТХ (ТХ-002, ТХ.С, ТХ-001, ТХ.ВТ): теплоизоляция 80 мм, облицовка — тонколистовая сталь;
   люки и патрубки стенки (9) и крыши (13) — по углам α, A, B (0° — по патрубкам приёма и раздачи с привязкой ГП-005); КДС2-1500Л, ГУС с ПО-100,
   зачистка Ду150, КС-80, ПСР, МУ-I, молниеприёмник H 11 000. Прежнее условное оборудование крыши и стенки — слой сравнения.
   ===================================================================================== */
const RVSD = (() => {
  const LIST = { '109.1': [3055, 2825], '109.2': [3344, 2825], '109.3': [3632, 2825] };
  const UP = new THREE.Vector3(0, 1, 0);
  /* ---------- размеры, м ---------- */
  const R_IN = 10.43 / 2;                 // АК-004: Dвн 10,43
  const R_W = R_IN + 0.008;               // наружная поверхность стенки (толщина пояса — условно)
  const R_CL0 = R_W + 0.11;               // до v0.26: изоляция 100 мм + облицовка; от этого радиуса отсчитаны кольца орошения и пенопровода, свес кровли и прежняя лестница (их положение не меняется)
  const R_CL = R_W + 0.09;                // v0.26: теплоизоляция стенки 80 мм (ТЗ на РВС-1000, л. 1, п. 13) + облицовка ≈ 10 мм (условно)
  const Y0 = 0.30;                        // днище = верх кольцевого фундамента (условно)
  const YT = Y0 + 12.0;                   // АК-004: Нст 12,0
  const RISE = 0.6;                       // подъём конической кровли (условно, ≈1:9)
  const R_E = R_CL0 + 0.06;               // свес кровли
  const roofY = r => YT + RISE * Math.min(1, Math.max(0, (R_E - r) / (R_E - 0.25)));
  const R_F = R_W + 0.55;                 // кольцевой фундамент (условно)
  const R_SI = R_CL0 + 0.25, R_SO = R_SI + 0.75, R_SM = (R_SI + R_SO) / 2;   // кольцевая лестница: косоуры
  const Y_MID = 6.25, Y_TOP = YT + 0.06;  // промежуточная и верхняя площадки
  const R_RING = R_CL0 + 0.14, Y_RING = YT - 0.3;    // кольцо орошения (условно)
  const R_FOAM = R_CL0 + 0.44, Y_FOAM = YT - 0.75;   // кольцевой пенопровод (условно)
  const YN = Y0 + 0.35;                   // v0.26: ось патрубков приёма, раздачи, зачистки — A 350 мм (ТЗ, л. 3); до v0.26 +0,40 (условно)
  const A_OUT2_D = -0.09;                 // второй отвод ⌀219 — рядом с первым (по АК-004 л.6 два отвода)
  const A_WALK = 0.33;                    // переход по кровле от верхней площадки к центру
  const A_ST = -0.53, W_ST = 0.8;         // трафарет (ЮЗ сторона, свободная от лестницы и стояков)
  const A_PAD = 2.554, R_PAD = 7.79;      // ГП-003: центр группы из 4 фундаментов у РВС на СВ

  /* ---------- утилиты ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const PP = (a, r, y) => V(r * Math.sin(a), y, r * Math.cos(a));
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const RY = a => new THREE.Matrix4().makeRotationY(a), RX = a => new THREE.Matrix4().makeRotationX(a), RZ = a => new THREE.Matrix4().makeRotationZ(a);
  const mul = (...ms) => ms.reduce((acc, m) => acc.multiply(m), new THREE.Matrix4());
  /* локальная система «у стенки»: z — по радиусу наружу, x — по касательной (рост угла), y — вверх; угол a = atan2(dx, dz) */
  const radF = (a, r, y) => mul(RY(a), T(0, y, r));
  const ZC = g => g.rotateX(Math.PI / 2);           // ось цилиндра → z
  function geoOf(pos, nor, uv, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); return g;
  }
  function cylBetween(a, b, r, seg = 10, open = false) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg, 1, open);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  }
  function boxBetween(a, b, w, h) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(); d.normalize();
    const x = new THREE.Vector3().crossVectors(UP, d); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
    const y = new THREE.Vector3().crossVectors(d, x);
    const g = new THREE.BoxGeometry(w, h, L);
    return g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, d).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2));
  }
  class Helix extends THREE.Curve {
    constructor(r, a0, a1, y0, y1) { super(); this.r = r; this.a0 = a0; this.a1 = a1; this.y0 = y0; this.y1 = y1; }
    getPoint(t, v = new THREE.Vector3()) { const a = this.a0 + (this.a1 - this.a0) * t; return v.set(this.r * Math.sin(a), this.y0 + (this.y1 - this.y0) * t, this.r * Math.cos(a)); }
  }
  const arcTube = (r, a0, a1, y0, y1, rad, rs = 6) =>
    new THREE.TubeGeometry(new Helix(r, a0, a1, y0, y1), Math.max(4, Math.ceil(Math.hypot(Math.abs(a1 - a0) * r, y1 - y0) / 0.25)), rad, rs, false);
  /* трубопровод по ломаной с гнутыми отводами */
  function run(B, key, pts, rad, bend = rad * 2.5, seg = 14, closed = false) {
    let cur = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (i < pts.length - 1) {
        const c = pts[i + 1], d1 = b.clone().sub(a), d2 = c.clone().sub(b), l1 = d1.length(), l2 = d2.length();
        d1.normalize(); d2.normalize();
        const k = Math.min(bend, l1 * 0.45, l2 * 0.45);
        const p1 = b.clone().addScaledVector(d1, -k), p2 = b.clone().addScaledVector(d2, k);
        if (cur.distanceTo(p1) > 1e-3) B.add(key, cylBetween(cur, p1, rad, seg, !closed));
        if (d1.dot(d2) < 0.9995) B.add(key, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p1, b, p2), 6, rad, seg, false));
        else B.add(key, cylBetween(p1, p2, rad, seg, true));
        cur = p2;
      } else if (cur.distanceTo(b) > 1e-3) B.add(key, cylBetween(cur, b, rad, seg, !closed));
    }
  }
  /* решётчатый настил: кольцевой сектор, UV в «ячейках» 0,1 м */
  function sectorGrate(r0, r1, a0, a1, y, n = 0) {
    n = n || Math.max(1, Math.ceil(Math.abs(a1 - a0) * r1 / 0.3));
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      for (const r of [r0, r1]) { pos.push(r * Math.sin(a), y, r * Math.cos(a)); nor.push(0, 1, 0); uv.push(a * R_SM / 0.1, r / 0.1); }
    }
    for (let i = 0; i < n; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    return geoOf(pos, nor, uv, idx);
  }
  /* косоур: вертикальная полоса по винтовой линии */
  function ribbon(r, a0, a1, y0, y1, h) {
    const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r / 0.2)), pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + (a1 - a0) * t, y = y0 + (y1 - y0) * t, s = Math.sin(a), c = Math.cos(a);
      pos.push(r * s, y, r * c, r * s, y - h, r * c); nor.push(s, 0, c, s, 0, c); uv.push(t, 1, t, 0);
    }
    for (let i = 0; i < n; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    return geoOf(pos, nor, uv, idx);
  }
  function Bucket() {   // v0.26: tag — позиция ТЗ (по ней карточка открывается кликом по слитой геометрии)
    const b = {}, tg = {};
    const B = { b, tg, tag: null, add(k, g, m) { if (m) g.applyMatrix4(m); (b[k] || (b[k] = [])).push(g); (tg[k] || (tg[k] = [])).push(B.tag); return g; } };
    return B;
  }
  function merge(list) {
    let nv = 0, ni = 0;
    for (const g of list) {
      if (!g.index) { const n = g.attributes.position.count, ix = []; for (let i = 0; i < n; i++) ix.push(i); g.setIndex(ix); }
      if (!g.attributes.normal) g.computeVertexNormals();
      nv += g.attributes.position.count; ni += g.index.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const g of list) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
      const I = g.index.array; for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov;
      ov += n; oi += I.length; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }

  /* ---------- процедурные текстуры ---------- */
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cnv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
  const ANI = renderer.capabilities.getMaxAnisotropy();
  const tex = (c, rx = 1, ry = 1, srgb = true) => {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = ANI;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  /* v0.26: облицовка изоляции — сталь тонколистовая оцинкованная (109-ТХ-001: ГОСТ 14918-80; толщина 0,5 мм — по 109-ТХ.ВТ для арматуры),
     гладкие листы рядами по 1,5 м с разбежкой вертикальных швов (вид 109-ТХ-002). Ширина листа ≈ 1,0 м — условно. До v0.26 — профлист (условно).
     Карта нормалей и карта цвета — одна раскладка: тайл = 1/3 окружности × вся высота облицовки (11 листов в ряду тайла). */
  const CL_H = 12.0 - 0.2, CL_NS = 11, CL_ROW = 1.5;
  const clRows = h => { const r = [0]; for (let k = 1; CL_ROW * k - 0.2 < CL_H; k++) r.push(Math.round((1 - (CL_ROW * k - 0.2) / CL_H) * h)); return r; };   // y px границ рядов (сверху вниз от низа облицовки)
  const texCorr = (() => {
    const W = 1024, H = 512, c = cnv(W, H, (x, w, h) => {
      const id = x.createImageData(w, h), nx = new Float32Array(w * h), ny = new Float32Array(w * h), sw = w / CL_NS;
      const rows = clRows(h).concat([h]).sort((p, q) => p - q);
      for (let r = 0; r < rows.length - 1; r++) {
        const y0 = rows[r], y1 = rows[r + 1], off = ((rows.length - r) % 2) * sw / 2;
        for (let k = 0; k < CL_NS; k++) {
          const xa = Math.round(k * sw + off), ph = rnd() * 6.28, amp = 0.025 + rnd() * 0.03;
          for (let yy = y0; yy < y1; yy++) for (let xx = xa; xx < xa + sw; xx++) {
            const X = ((xx % w) + w) % w, i = yy * w + X, u = (xx - xa) / sw, v = (yy - y0) / Math.max(1, y1 - y0);
            nx[i] += amp * Math.sin(Math.PI * 2 * u + ph) * Math.sin(Math.PI * v); ny[i] += amp * 0.6 * Math.cos(Math.PI * v + ph);   // «хлопуны» тонкого листа
          }
          for (let yy = y0; yy < y1; yy++) { const xs = ((xa % w) + w) % w; nx[yy * w + xs] = -0.55; nx[yy * w + (xs + 1) % w] = 0.45; }   // вертикальный нахлёст
          for (let yy = y0 + 6; yy < y1 - 3; yy += 13) { const xs = ((xa + 3) % w + w) % w; for (const [dx, dy, a, b] of [[0, 0, -0.4, -0.4], [1, 0, 0.4, -0.4], [0, 1, -0.4, 0.4], [1, 1, 0.4, 0.4]]) { const q = (yy + dy) * w + (xs + dx) % w; nx[q] = a; ny[q] = b; } }   // винты (условно)
        }
        if (y0 > 0) for (let xx = 0; xx < w; xx++) { ny[y0 * w + xx] = 0.55; if (y0 > 1) ny[(y0 - 1) * w + xx] = -0.45; }   // горизонтальный нахлёст ряда
      }
      for (let i = 0; i < w * h; i++) { const a = Math.max(-0.8, Math.min(0.8, nx[i])), b = Math.max(-0.8, Math.min(0.8, ny[i])), z = Math.sqrt(Math.max(0.2, 1 - a * a - b * b)); id.data[i * 4] = (a * 0.5 + 0.5) * 255; id.data[i * 4 + 1] = (b * 0.5 + 0.5) * 255; id.data[i * 4 + 2] = z * 255; id.data[i * 4 + 3] = 255; }
      x.putImageData(id, 0, 0);
    });
    return tex(c, 3, 1, false);
  })();
  /* облицовка: оттенки листов (по раскладке рядов), потёки, грязь у низа (1 тайл ≈ 1/3 окружности) */
  const texClad = tex(cnv(1024, 512, (x, w, h) => {
    x.fillStyle = '#eef0f1'; x.fillRect(0, 0, w, h);
    const sw = w / CL_NS, rows = clRows(h).concat([h]).sort((p, q) => p - q);
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r], y1 = rows[r + 1], off = ((rows.length - r) % 2) * sw / 2;
      for (let k = 0; k < CL_NS; k++) { const v = rnd(), xa = k * sw + off, f = `rgba(${v < 0.5 ? '90,98,105' : '255,255,255'},${0.03 + rnd() * 0.06})`; for (const xo of [xa, xa - w]) { x.fillStyle = f; x.fillRect(xo, y0, sw, y1 - y0); x.fillStyle = 'rgba(70,75,80,.16)'; x.fillRect(xo, y0, 1.5, y1 - y0); } }
      x.fillStyle = 'rgba(60,64,68,.22)'; x.fillRect(0, y0, w, 1.5);
    }
    for (let i = 0; i < 90; i++) {
      const sx = rnd() * w, sy = rnd() * h * 0.5, len = 60 + rnd() * 300, g = x.createLinearGradient(0, sy, 0, sy + len);
      g.addColorStop(0, `rgba(95,85,70,${0.04 + rnd() * 0.08})`); g.addColorStop(1, 'rgba(95,85,70,0)');
      x.fillStyle = g; x.fillRect(sx, sy, 1 + rnd() * 3, len);
    }
    const gb = x.createLinearGradient(0, h - 50, 0, h); gb.addColorStop(0, 'rgba(105,92,72,0)'); gb.addColorStop(1, 'rgba(105,92,72,.38)');
    x.fillStyle = gb; x.fillRect(0, h - 50, w, 50);
    const gt = x.createLinearGradient(0, 0, 0, 22); gt.addColorStop(0, 'rgba(80,80,80,.18)'); gt.addColorStop(1, 'rgba(80,80,80,0)');
    x.fillStyle = gt; x.fillRect(0, 0, w, 22);
  }), 3, 1);
  /* кровля: окраска, радиальные швы щитов, следы коррозии у кромки */
  const texRoof = tex(cnv(1024, 256, (x, w, h) => {
    x.fillStyle = '#c3c8cb'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '70,70,70' : '255,255,255'},${rnd() * 0.035})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 20, 1 + rnd() * 3); }
    for (let i = 0; i < 32; i++) { const px = i * w / 32; x.fillStyle = 'rgba(60,64,68,.35)'; x.fillRect(px, 0, 2, h); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px + 2, 0, 1, h); }
    x.fillStyle = 'rgba(60,64,68,.3)'; x.fillRect(0, h * 0.45, w, 2);
    for (let i = 0; i < 60; i++) { const px = rnd() * w, len = 10 + rnd() * 35, g = x.createLinearGradient(0, h - len, 0, h); g.addColorStop(0, 'rgba(130,70,30,0)'); g.addColorStop(1, `rgba(130,70,30,${0.08 + rnd() * 0.14})`); x.fillStyle = g; x.fillRect(px, h - len, 1 + rnd() * 3, len); }
  }), 1, 1);
  /* решётчатый настил (ячейка 0,1 × 0,1 м): несущие полосы + связи; прозрачные промежутки — alphaTest */
  const texGrate = tex(cnv(64, 64, (x) => {
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = '#c3c8cc'; for (let i = 0; i < 4; i++) x.fillRect(i * 16, 0, 6, 64);
    x.fillStyle = '#a8aeb3'; for (let j = 0; j < 2; j++) x.fillRect(0, j * 32 + 14, 64, 5);
  }), 1, 1);
  const noiseC = cnv(128, 128, (x, w, h) => {
    const id = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 205 + rnd() * 50 - (rnd() < 0.03 ? 60 : 0); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    x.putImageData(id, 0, 0);
  });
  const texConc = tex(noiseC, 24, 2), texAsph = tex(noiseC, 1, 1);
  /* окружение для металлических отражений (только для материалов этой модели; общая подсветка сцены не меняется) */
  const envTex = (() => {
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
        vec3 sky = mix(vec3(0.80, 0.86, 0.90), vec3(0.36, 0.52, 0.74), smoothstep(0.0, 0.75, h));
        vec3 gr = mix(vec3(0.42, 0.40, 0.36), vec3(0.30, 0.29, 0.26), smoothstep(0.0, -0.6, h));
        vec3 c = h > 0.0 ? sky : gr; c += vec3(1.0, 0.97, 0.9) * pow(max(dot(d, normalize(vec3(-0.47, 0.8, 0.4))), 0.0), 400.0) * 18.0;
        gl_FragColor = vec4(c, 1.0); }`
    });
    sc.add(new THREE.Mesh(g, m));
    const rt = pm.fromScene(sc, 0.02); pm.dispose(); g.dispose(); m.dispose();
    return rt.texture;
  })();

  /* ---------- материалы ---------- */
  const SM = o => new THREE.MeshStandardMaterial(Object.assign({ envMap: envTex, envMapIntensity: 0.9 }, o));
  const MAT = {
    clad: SM({ color: 0xffffff, map: texClad, normalMap: texCorr, normalScale: new THREE.Vector2(0.8, 0.8), metalness: 0.55, roughness: 0.34 }),   // v0.26: облицовка изоляции — сталь тонколистовая оцинкованная (109-ТХ-001, ГОСТ 14918-80), гладкие листы
    galvS: SM({ color: 0xc9ced2, metalness: 0.6, roughness: 0.38 }),        // бандажи, отливы
    shell: SM({ color: 0x9aa2a8, metalness: 0.25, roughness: 0.6 }),        // стенка, днище, патрубки
    shellIn: SM({ color: 0x7a8288, metalness: 0.2, roughness: 0.75, side: THREE.BackSide }),
    roof: SM({ color: 0xffffff, map: texRoof, metalness: 0.3, roughness: 0.55 }),
    steel: SM({ color: 0x8c949a, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide }),   // металлоконструкции (окраска условная)
    grate: SM({ color: 0xffffff, map: texGrate, alphaTest: 0.35, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide }),
    galv: SM({ color: 0xc9ced2, metalness: 0.6, roughness: 0.35 }),         // кожух изоляции трубопроводов
    pipe: SM({ color: 0x7c858c, metalness: 0.35, roughness: 0.5 }),         // окрашенные трубы (Гу)
    conc: SM({ color: 0xc4c0b6, map: texConc, metalness: 0, roughness: 0.95, envMapIntensity: 0.25 }),
    asph: SM({ color: 0x64676b, map: texAsph, metalness: 0, roughness: 0.95, envMapIntensity: 0.2 }),
    red: SM({ color: 0xb3261e, metalness: 0.25, roughness: 0.5 }),          // противопожарные сети, маховики
    dark: SM({ color: 0x3b4147, metalness: 0.45, roughness: 0.5 }),         // арматура, фланцы, крепёж
    bolt: SM({ color: 0x3b4147, metalness: 0.5, roughness: 0.45 }),         // v0.14: шпильки и гайки фланцев (отдельный меш — для LOD)
    alu: SM({ color: 0xbfc5ca, metalness: 0.55, roughness: 0.4 }),          // корпуса приборов
    brown: SM({ color: 0x6e4325, metalness: 0.2, roughness: 0.6 }),         // опознавательная окраска (ГОСТ 14202: горючие жидкости)
    yel: SM({ color: 0xd9a816, metalness: 0.2, roughness: 0.55 })
  };
  const CUT_KEYS = new Set(['clad', 'galvS', 'shell', 'shellIn', 'roof']);   // в техническом разрезе режется только оболочка

  /* ---------- задвижка клиновая с выдвижным шпинделем (тип 30с41нж PN16 — условно; габариты типовые) ---------- */
  const VALVE = {
    200: { L: 0.33, Df: 0.34, r: 0.1095, Dw: 0.32, Hw: 0.78, stroke: 0.21, nb: 12 },
    150: { L: 0.28, Df: 0.285, r: 0.0795, Dw: 0.28, Hw: 0.62, stroke: 0.16, nb: 8 }
  };
  function flange(B, Df, r, m, nb, s = 0) {   // фланец с болтами; ось — локальная X; s = ±1 — с ответным фланцем трубы снаружи (v0.14, условно)
    B.add('dark', new THREE.CylinderGeometry(Df / 2, Df / 2, 0.03, 24), mul(m, RZ(Math.PI / 2)));
    const pcd = (Df / 2 + r) / 2 + 0.01;
    if (!s) { for (let i = 0; i < nb; i++) { const t = (i + 0.5) / nb * Math.PI * 2; B.add('dark', new THREE.CylinderGeometry(0.009, 0.009, 0.07, 6), mul(m, T(0, pcd * Math.sin(t), pcd * Math.cos(t)), RZ(Math.PI / 2))); } return; }
    const tc = 0.024, f = s * 0.015, x0 = -s * 0.027, x1 = f + s * (0.003 + tc + 0.014);
    B.add('dark', new THREE.CylinderGeometry(pcd - 0.012, pcd - 0.012, 0.003, 24), mul(m, T(f + s * 0.0015, 0, 0), RZ(Math.PI / 2)));       // прокладка
    B.add('dark', new THREE.CylinderGeometry(Df / 2, Df / 2, tc, 24), mul(m, T(f + s * (0.003 + tc / 2), 0, 0), RZ(Math.PI / 2)));         // ответный фланец трубы
    B.add('dark', new THREE.CylinderGeometry(r * 1.22, r * 1.22, 0.026, 20), mul(m, T(f + s * (0.003 + tc + 0.013), 0, 0), RZ(Math.PI / 2)));   // воротник
    for (let i = 0; i < nb; i++) {
      const t = (i + 0.5) / nb * Math.PI * 2, y = pcd * Math.sin(t), z = pcd * Math.cos(t);
      B.add('bolt', new THREE.CylinderGeometry(0.009, 0.009, Math.abs(x1 - x0), 6, 1, true), mul(m, T((x0 + x1) / 2, y, z), RZ(Math.PI / 2)));
      for (const xn of [x0 + s * 0.007, x1 - s * 0.007]) B.add('bolt', new THREE.CylinderGeometry(0.016, 0.016, 0.014, 6), mul(m, T(xn, y, z), RZ(Math.PI / 2)));
    }
    FLANGE_STAT.valve++;
  }
  function flangePairY(B, x, yc, z, rp, key) {   // v0.14: фланцевое соединение на вертикальной трубе (PN16, условно): два фланца с воротниками, прокладка, шпильки с гайками
    const F = flangeOfOD(2 * rp), D = F[0], K = F[1], nb = F[2], db = F[3], t = F[4], hb = 0.0015 + t + 0.016;
    B.add('dark', new THREE.CylinderGeometry(K / 2 - db * 0.7, K / 2 - db * 0.7, 0.003, 24), T(x, yc, z));
    for (const s of [-1, 1]) {
      B.add(key, new THREE.CylinderGeometry(D / 2, D / 2, t, 24), T(x, yc + s * (0.0015 + t / 2), z));
      B.add(key, new THREE.CylinderGeometry(s > 0 ? rp : rp * 1.25, s > 0 ? rp * 1.25 : rp, 0.025, 16), T(x, yc + s * (0.0015 + t + 0.0125), z));
    }
    for (let i = 0; i < nb; i++) {
      const a = (i + 0.5) / nb * Math.PI * 2, bx = x + Math.cos(a) * K / 2, bz = z + Math.sin(a) * K / 2;
      B.add('bolt', new THREE.CylinderGeometry(db / 2, db / 2, 2 * hb, 6, 1, true), T(bx, yc, bz));
      for (const s of [-1, 1]) B.add('bolt', new THREE.CylinderGeometry(db * 0.85, db * 0.85, 0.013, 6), T(bx, yc + s * (hb - 0.0065), bz));
    }
    FLANGE_STAT.riser++;
  }
  function valve(B, dn, m) {   // ось трубы — локальная X, шпиндель — вверх
    const v = VALVE[dn], rb = v.r * 1.3;
    B.add('dark', new THREE.CylinderGeometry(v.r * 1.08, v.r * 1.08, v.L - 0.05, 20), mul(m, RZ(Math.PI / 2)));
    for (const s of [-1, 1]) flange(B, v.Df, v.r, mul(m, T(s * (v.L / 2 - 0.015), 0, 0)), v.nb, s);
    B.add('dark', new THREE.CylinderGeometry(rb, rb * 0.92, v.r * 2.7, 20).scale(1, 1, 0.68), mul(m, T(0, v.r * 0.25, 0)));   // корпус
    B.add('dark', new THREE.CylinderGeometry(rb * 1.22, rb * 1.22, 0.035, 20).scale(1, 1, 0.72), mul(m, T(0, v.r * 1.62, 0)));  // фланец крышки
    for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; B.add('dark', new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), mul(m, T(rb * 1.08 * Math.sin(t), v.r * 1.62, rb * 0.76 * Math.cos(t)))); }
    B.add('dark', new THREE.CylinderGeometry(v.r * 0.42, rb * 0.78, v.r * 1.4, 16), mul(m, T(0, v.r * 2.35, 0)));   // крышка
    const yB0 = v.r * 3.0, yB1 = v.Hw - 0.06;
    for (const s of [-1, 1]) B.add('dark', new THREE.BoxGeometry(0.028, yB1 - yB0, 0.045), mul(m, T(s * v.r * 0.55, (yB0 + yB1) / 2, 0)));   // бугель
    B.add('dark', new THREE.BoxGeometry(v.r * 1.35, 0.045, 0.065), mul(m, T(0, yB1, 0)));
    const yw = yB1 + 0.06;
    B.add('red', new THREE.TorusGeometry(v.Dw / 2, 0.014, 6, 30), mul(m, T(0, yw, 0), RX(Math.PI / 2)));   // маховик
    for (let k = 0; k < 3; k++) B.add('red', new THREE.BoxGeometry(v.Dw - 0.02, 0.012, 0.02), mul(m, T(0, yw, 0), RY(k * Math.PI / 3)));
    B.add('red', new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), mul(m, T(0, yw, 0)));
    return { yw };
  }
  const STEM_LEN = 0.42;
  const stemMatrix = (vm, yw, stroke, k) => mul(vm, T(0, yw + 0.04 + stroke * k - STEM_LEN / 2, 0));

  /* ---------- оборудование ---------- */
  function nozzleValve(B, a, dn, bOut) {   // патрубок в нижнем поясе + коренная задвижка; v0.26: вылет B — по ТЗ, л. 3 (торец фланца на R_W + B)
    const v = VALVE[dn], m = radF(a, 0, YN), zf = R_W + bOut;
    B.add('shell', cylBetween(V(0, 0, R_W - 0.01), V(0, 0, zf - 0.03), v.r, 18), m);
    B.add('galvS', ZC(new THREE.CylinderGeometry(v.r + 0.12, v.r + 0.12, 0.015, 24)), mul(m, T(0, 0, R_CL + 0.008)));   // оклад изоляции
    B.add('dark', ZC(new THREE.CylinderGeometry(v.Df / 2, v.Df / 2, 0.03, 24)), mul(m, T(0, 0, zf - 0.015)));
    const zc = zf + v.L / 2, vm = mul(radF(a, zc, YN), RY(-Math.PI / 2));
    const { yw } = valve(B, dn, vm);
    return { zOut: zc + v.L / 2, vm, yw, stroke: v.stroke, r: v.r, Df: v.Df };
  }
  function manhole(B, a) {   // люк-лаз DN600 в первом поясе (условно)
    const m = radF(a, 0, Y0 + 0.75);
    B.add('shell', ZC(new THREE.CylinderGeometry(0.31, 0.31, R_CL + 0.2 - R_W, 28, 1, true)), mul(m, T(0, 0, (R_W + R_CL + 0.2) / 2)));
    B.add('galvS', ZC(new THREE.CylinderGeometry(0.45, 0.45, 0.02, 28)), mul(m, T(0, 0, R_CL + 0.01)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 32)), mul(m, T(0, 0, R_CL + 0.22)));
    B.add('shell', ZC(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 32)), mul(m, T(0, 0, R_CL + 0.255)));
    for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; B.add('dark', ZC(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 6)), mul(m, T(0.36 * Math.sin(t), 0.36 * Math.cos(t), R_CL + 0.245))); }
    for (const s of [-1, 1]) { B.add('steel', boxBetween(V(s * 0.12, 0.16, R_CL + 0.27), V(s * 0.12, 0.16, R_CL + 0.36), 0.02, 0.02), m); B.add('steel', boxBetween(V(s * 0.12, 0.16, R_CL + 0.36), V(s * 0.12, -0.04, R_CL + 0.36), 0.02, 0.02), m); }
    B.add('steel', cylBetween(V(0.47, -0.3, R_CL + 0.05), V(0.47, 0.42, R_CL + 0.05), 0.025, 8), m);   // поворотное устройство крышки
    B.add('steel', cylBetween(V(0.47, 0.42, R_CL + 0.05), V(0.47, 0.42, R_CL + 0.3), 0.02, 8), m);
    B.add('steel', cylBetween(V(0.47, 0.42, R_CL + 0.3), V(0, 0.42, R_CL + 0.3), 0.018, 8), m);
  }
  function levelSwitch(B, a, y) {   // сигнализатор уровня (LSA) — компактный, не выступает за косоур лестницы
    const m = radF(a, 0, y);
    B.add('dark', cylBetween(V(0, 0, R_W), V(0, 0, R_CL + 0.07), 0.03, 10), m);
    B.add('dark', ZC(new THREE.CylinderGeometry(0.06, 0.06, 0.022, 14)), mul(m, T(0, 0, R_CL + 0.08)));
    B.add('alu', ZC(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12)), mul(m, T(0, 0, R_CL + 0.115)));
    B.add('alu', new THREE.CylinderGeometry(0.048, 0.048, 0.1, 16), mul(m, T(0, 0.06, R_CL + 0.15)));
    B.add('dark', new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), mul(m, T(0, 0.12, R_CL + 0.15)));
    B.add('dark', cylBetween(V(0, 0.04, R_CL + 0.15), V(0, -0.12, R_CL + 0.15), 0.008, 6), m);   // кабельный ввод
  }
  function thermo(B, a, y) {   // термопреобразователь TT в гильзе
    const m = radF(a, 0, y);
    B.add('dark', cylBetween(V(0, 0, R_W), V(0, 0, R_CL + 0.1), 0.022, 8), m);
    B.add('dark', ZC(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12)), mul(m, T(0, 0, R_CL + 0.1)));
    B.add('alu', ZC(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16)), mul(m, T(0, 0, R_CL + 0.16)));
    B.add('dark', cylBetween(V(0, -0.03, R_CL + 0.16), V(0, -0.2, R_CL + 0.16), 0.008, 6), m);
  }
  function siphon(B, a, yc = Y0 + 0.32) {   // сифонный кран КС-80 для спуска подтоварной воды (конструкция — условно); v0.26: высота — по ТЗ
    const m = radF(a, 0, yc);
    B.add('shell', cylBetween(V(0, 0, R_W), V(0, 0, R_CL + 0.12), 0.0285, 10), m);
    B.add('dark', ZC(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 14)), mul(m, T(0, 0, R_CL + 0.13)));
    B.add('dark', new THREE.SphereGeometry(0.05, 12, 8), mul(m, T(0, 0, R_CL + 0.19)));
    B.add('shell', cylBetween(V(0, 0, R_CL + 0.2), V(0, 0, R_CL + 0.34), 0.0285, 10), m);
    B.add('shell', cylBetween(V(0, 0, R_CL + 0.34), V(0, -0.18, R_CL + 0.34), 0.0285, 10), m);
    B.add('red', boxBetween(V(0, 0.06, R_CL + 0.19), V(0.22, 0.06, R_CL + 0.19), 0.02, 0.012), m);
  }
  function grounding(B, a) {   // присоединение заземления к стенке (условно, 2 точки)
    const m = radF(a, 0, 0);
    B.add('dark', boxBetween(V(0, Y0 + 0.25, R_W), V(0, Y0 + 0.25, R_CL + 0.12), 0.05, 0.05), m);
    B.add('dark', boxBetween(V(0, Y0 + 0.25, R_CL + 0.12), V(0, -0.5, R_CL + 0.12), 0.04, 0.005), m);
    B.add('yel', boxBetween(V(0, Y0 + 0.05, R_CL + 0.123), V(0, Y0 - 0.05, R_CL + 0.123), 0.042, 0.006), m);
  }
  function lz(B, a, r) {   // люк замерный ЛЗ-150 (условно)
    const y = roofY(r), m = radF(a, r, y);
    B.add('steel', new THREE.CylinderGeometry(0.28, 0.28, 0.012, 24), mul(m, T(0, 0.02, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.085, 0.085, 0.34, 16), mul(m, T(0, 0.17, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), mul(m, T(0, 0.34, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.14, 0.15, 0.06, 20), mul(m, T(0, 0.385, 0)));
    B.add('dark', new THREE.BoxGeometry(0.07, 0.05, 0.06), mul(m, T(0, 0.37, 0.17)));
    B.add('dark', boxBetween(V(0, 0.43, 0.1), V(0, 0.43, -0.12), 0.025, 0.025), m);
    B.add('dark', boxBetween(V(0, 0.43, -0.12), V(0, 0.36, -0.2), 0.025, 0.025), m);
  }
  function radar(B, a, r) {   // радарный уровнемер LT109-07/08/09 на патрубке кровли
    const y = roofY(r), m = radF(a, r, y);
    B.add('steel', new THREE.CylinderGeometry(0.2, 0.2, 0.012, 20), mul(m, T(0, 0.02, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.057, 0.057, 0.3, 16), mul(m, T(0, 0.15, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), mul(m, T(0, 0.31, 0)));
    for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; B.add('dark', new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), mul(m, T(0.09 * Math.sin(t), 0.315, 0.09 * Math.cos(t)))); }
    B.add('alu', new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), mul(m, T(0, 0.333, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.035, 0.045, 0.09, 12), mul(m, T(0, 0.39, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.07, 0.07, 0.13, 20), mul(m, T(0, 0.5, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.072, 0.072, 0.03, 20), mul(m, T(0, 0.58, 0)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8)), mul(m, T(0, 0.47, 0.085)));
  }
  function breather(B, a, r) {   // дыхательный клапан с огнепреградителем (тип условно)
    const y = roofY(r), m = radF(a, r, y);
    B.add('steel', new THREE.CylinderGeometry(0.26, 0.26, 0.012, 20), mul(m, T(0, 0.02, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.1, 0.1, 0.22, 16), mul(m, T(0, 0.11, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.18, 0.18, 0.025, 20), mul(m, T(0, 0.23, 0)));
    B.add('steel', new THREE.CylinderGeometry(0.17, 0.17, 0.2, 20), mul(m, T(0, 0.34, 0)));      // огнепреградитель
    B.add('dark', new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20), mul(m, T(0, 0.45, 0)));
    B.add('steel', new THREE.CylinderGeometry(0.24, 0.22, 0.3, 24), mul(m, T(0, 0.61, 0)));      // корпус
    B.add('dark', new THREE.CylinderGeometry(0.31, 0.31, 0.015, 24), mul(m, T(0, 0.765, 0)));
    B.add('steel', new THREE.CylinderGeometry(0.06, 0.3, 0.14, 24), mul(m, T(0, 0.84, 0)));      // колпак
  }
  function skylight(B, a, r) {   // люк световой DN500 (условно)
    const y = roofY(r), m = radF(a, r, y);
    B.add('steel', new THREE.CylinderGeometry(0.26, 0.26, 0.24, 24, 1, true), mul(m, T(0, 0.1, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.33, 0.33, 0.03, 28), mul(m, T(0, 0.235, 0)));
    B.add('steel', new THREE.CylinderGeometry(0.33, 0.33, 0.02, 28), mul(m, T(0, 0.26, 0)));
    for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; B.add('dark', new THREE.CylinderGeometry(0.011, 0.011, 0.06, 6), mul(m, T(0.3 * Math.sin(t), 0.25, 0.3 * Math.cos(t)))); }
    for (const s of [-1, 1]) B.add('steel', boxBetween(V(s * 0.12, 0.27, 0), V(s * 0.12, 0.34, 0), 0.02, 0.02), m);
    B.add('steel', boxBetween(V(-0.12, 0.34, 0), V(0.12, 0.34, 0), 0.02, 0.02), m);
  }
  function foamGen(B, a) {   // пеногенератор с пенокамерой на верхнем поясе (тип и число — условно)
    const m = radF(a, 0, 0), yg = YT - 0.45;
    B.add('red', new THREE.BoxGeometry(0.5, 0.5, 0.38), mul(m, T(0, YT - 0.5, R_CL + 0.19)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 24)), mul(m, T(0, yg, R_CL + 0.39)));
    B.add('red', ZC(new THREE.CylinderGeometry(0.19, 0.19, 0.55, 22)), mul(m, T(0, yg, R_CL + 0.68)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 22)), mul(m, T(0, yg, R_CL + 0.97)));   // кассета сеток
    B.add('red', cylBetween(V(0, Y_FOAM, R_FOAM), V(0, yg - 0.17, R_FOAM), 0.0445, 10), m);
  }

  /* =========================== v0.26: ЛЮКИ, ПАТРУБКИ И КОМПЛЕКТУЮЩИЕ РВС-1000 — ТЗ + КОМПЛЕКТ 109-ТХ ===========================
     ТЗ № 001 — 5632.29-109.1-109.3-ТХ.ОЛ-001-0 (222.pdf, л. 21–23): спецификация люков и патрубков (стенка — 9 поз., крыша — 13 поз.), комплектующие.
     109.1-109.3-ТХ-002-0 «План. Общий вид» (Резервуар 1.pdf, стр. 5): углы и радиусы позиций, молниеприёмник (α 37°, H 11 000, верх +22,920),
       ГУС (ПМ-100 → ПО-100 → кран шаровый Ду100 → опуск по стенке → +2,200), МУ-I, КС-80, ПСР; 0° схемы проходит через шахтную лестницу.
     109-ТХ.С-001-0 (55555.pdf, стр. 25): ЛЛ-600, ЛЛ 600/900, ЛЗ-150 + ПЗЛ-150, ЛЩ-500, КДС2-1500Л Ду200 × 2 на РВС, ПО-100, кран шаровый Ду100,
       30с41нж Ду150 × 2 и Ду200 × 1 на РВС, КС-80 с задвижкой, ПСР, МУ-I × 2, ХП-150-А, ХП-200-В, ПМ-50 × 3, ПМ-80 × 4, ПМ-100 × 2.
     109-ТХ-001-0 (стр. 26): КДС со встроенными огнепреградителями; изоляция — маты ГОСТ 21880 + сталь тонколистовая ГОСТ 14918; молниезащита — II кат.
     109-ТХ.ВТ-001-0 (стр. 27): стенка и крыша — 80 мм; арматура Ду200 × 3 и Ду150 × 6 — 60 мм + сталь 0,5 мм.
     α — угол по часовой стрелке (вид сверху) от 0° схемы; A — у стенки высота оси от днища, у крыши — расстояние от оси; B — вылет / высота торца.
     0° схемы в модели получен по патрубкам приёма (α 176°) и раздачи (α 184°), положение которых задано трассами ГП-005 (оценки расходятся на 2,6°).
     По ТХ-002 ось 0° проходит через шахтную лестницу; в модели лестница (по ГП-003) — на α ≈ 3,4° («Сверка» T11). Координаты не менялись. */
  const DEG = Math.PI / 180, A_INP = -0.48, A_OUT = -0.575;
  const TZ0 = ((A_INP + 176 * DEG) + (A_OUT + 184 * DEG)) / 2, tzA = al => TZ0 - al * DEG;
  const T_INS = 0.09;   // теплоизоляция крыши 80 мм (ТЗ, л. 1, п. 14) + облицовка: поверхность кровли модели — облицовка, настил — ниже на T_INS
  const TZ = {
    W1: { side: 'стенка', pos: 1, n: 'Патрубок приёма', dn: 150, py: 1.6, typ: 'D', al: 176, A: 0.35, B: 0.20, C: 0.112, note: '1 шт.', eq: 'Патрубок ⌀159 и коренная задвижка 30с41нж Ду150 (РВС-109.x-П, FA109-13/15/17) в утеплённом кожухе (ТХ.ВТ: изоляция арматуры 60 мм + сталь 0,5 мм). Внутри — хлопушка ХП-150-А (не показана). Угол — по трассе ГП-005', st: 'CONFIRMED', a3: A_INP, tx: '109-ТХ-002 поз. 8 «Диз. топливо Ду150 из насосной» (поз. 27), задвижка поз. 11; ТХ.С: 30с41нж Ду150 — 6, ХП-150-А — 3 на 3 РВС' },
    W2: { side: 'стенка', pos: 2, n: 'Патрубок раздачи', dn: 200, py: 1.6, typ: 'D', al: 184, A: 0.35, B: 0.25, C: 0.162, note: '1 шт.', eq: 'Патрубок ⌀219 и коренная задвижка 30с41нж Ду200 (РВС-109.x-В, FA109-14/16/18) в утеплённом кожухе. Внутри — хлопушка ХП-200-В (не показана). Угол — по трассе ГП-005', st: 'CONFIRMED', a3: A_OUT, tx: '109-ТХ-002 поз. 9 «Диз. топливо (летнее) Ду200 в насосную» (поз. 26), задвижка поз. 12; ТХ.С: 30с41нж Ду200 — 3, ХП-200-В — 3' },
    W3: { side: 'стенка', pos: 3, n: 'Патрубок зачистки', dn: 150, py: 1.6, typ: 'S', al: 195, A: 0.35, B: 0.20, note: '1 шт.', eq: 'Патрубок ⌀159 и задвижка 30с41нж Ду150 в утеплённом кожухе; отвод (поз. 29) врезан в линию раздачи Ду200 «в насосную» (поз. 26). До v0.26 — второй отвод ⌀219 с задвижкой Ду200 по АК-004 л. 6. В графе ТП задвижка считается открытой (граф не менялся)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 10 (α 195°), задвижка поз. 11, отвод поз. 29; ТХ.С: 30с41нж Ду150 — 6 на 3 РВС (приём + зачистка); ТХ.ВТ: арматура Ду150 — 6' },
    W4: { side: 'стенка', pos: 4, n: 'Люк-лаз I пояса', dn: 600, py: 0.25, al: 73, A: 0.75, B: 0.35, eq: 'Люк-лаз ЛЛ-600 с поворотным устройством крышки (устройство — условно)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 1 (α 73°); ТХ.С: ЛЛ-600 — 3 шт., 174 кг' },
    W5: { side: 'стенка', pos: 5, n: 'Люк-лаз I пояса', dn: '600×900', py: 0.25, al: 272, A: 0.65, B: 0.30, eq: 'Люк-лаз ЛЛ 600/900 «овальный» со скруглёнными углами; большая сторона — горизонтально (ориентация в документах не указана — условно)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 2 (α 272°); ТХ.С: ЛЛ 600/900 «овальный» — 3 шт., 241 кг' },
    W6: { side: 'стенка', pos: 6, n: 'Патрубок монтажный для КИП', dn: 50, al: 170, A: 1.30, B: 0.15, C: 0.10, note: 'датчик температуры, 1 шт. (в ТЗ — α 165°)', eq: 'Термопреобразователь TT 109-10/11/12 (АК-004) на бобышке G1/2A; модель прибора — условно. Угол — по ТХ-002 (170°), в ТЗ — 165°: «Сверка» T10', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 19/25 — α 170°; узел «Бобышка для установки термопреобразователя» G1/2A; ТХ.С: ПМ-50' },
    W7: { side: 'стенка', pos: 7, n: 'Патрубок монтажный для КИП', dn: 50, al: 215, A: 0.70, B: 0.15, note: 'нижний аварийный уровень, 1 шт.', eq: 'Сигнализатор нижнего аварийного уровня LSA L 109-02/04/06, 700 мм (АК-004) на бобышке 3/4" NPT; модель — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 19/23 — α 215°; узел «Бобышка для установки сигнализатора аварийного уровня» 3/4" NPT' },
    W8: { side: 'стенка', pos: 8, n: 'Отверстие для сифонного крана', dn: 80, al: 202, A: 0.35, eq: 'Кран сифонный КС-80 с задвижкой, Ру 0,15 МПа: снаружи — корпус с сальником и рукояткой поворота сифонной трубы, задвижка Ду80 на боковом выходе. Сифонная труба внутри не показана. Габариты — условно (паспорта изделия нет)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 13 (α 202°); ТХ.С: КС-80 с задвижкой — 3 шт., 120 кг' },
    W9: { side: 'стенка', pos: 9, n: 'Отверстие для пробоотборника', al: 250, eq: 'Пробоотборник секционный ПСР: выносной блок кранов отбора проб, вынос ≈ 300 мм от стенки (ТХ-002). Высота блока (в 3D — +0,9 м) и конструкция — условно (паспорта изделия нет)', st: 'APPROX', tx: '109-ТХ-002 поз. 16 (α 250°, размер 300); ТХ.С: ПСР — 3 шт., 360 кг' },
    R1: { side: 'крыша', pos: 1, n: 'Люк световой', dn: 500, al: 110, A: 3.9, B: 0.2, C: 0.02, eq: 'Люк световой ЛЩ-500 с крышкой на болтах', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 5 (R 3900); ТХ.С: ЛЩ-500 — 9 шт., 77 кг' },
    R2: { side: 'крыша', pos: 2, n: 'Люк световой', dn: 500, al: 180, A: 3.9, B: 0.2, C: 0.02, eq: 'Люк световой ЛЩ-500 с крышкой на болтах', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 5 (R 3900); ТХ.С: ЛЩ-500 — 9 шт., 77 кг' },
    R3: { side: 'крыша', pos: 3, n: 'Патрубок монтажный', dn: 200, py: 0.25, al: 28, A: 3.9, B: 0.2, eq: 'Клапан дыхательный совмещённый КДС2-1500Л Ду200 со встроенным огнепреградителем на патрубке ПМ-200 (настройка по ТЗ: давление 2,0/2,4 кПа, вакуум 0,25/0,3 кПа). Габариты корпуса — условно (паспорта изделия нет)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 6/7 (α 28°, R 3900); 109-ТХ-001: «КДС со встроенными огнепреградителями»; ТХ.С: КДС2-1500Л — 6 шт., 115 кг; ПМ-200 — 6' },
    R4: { side: 'крыша', pos: 4, n: 'Патрубок монтажный', dn: 200, py: 0.25, al: 45, A: 3.9, B: 0.2, eq: 'Клапан дыхательный совмещённый КДС2-1500Л Ду200 со встроенным огнепреградителем на патрубке ПМ-200. Габариты корпуса — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 6/7 (α 45°, R 3900); ТХ.С: КДС2-1500Л — 6 шт., 115 кг' },
    R5: { side: 'крыша', pos: 5, n: 'Патрубок монтажный', dn: 150, py: 0.25, al: 350, A: 4.155, B: 0.15, C: 0.02, eq: 'Люк замерный ЛЗ-150 на патрубке ПЗЛ-150 у перехода с шахтной лестницы', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 3/4 (α 350°, R 4155); ТХ.С: ЛЗ-150 — 3, ПЗЛ-150 — 3' },
    R6: { side: 'крыша', pos: 6, n: 'Люк световой', dn: 500, al: 290, A: 3.9, B: 0.2, C: 0.02, eq: 'Люк световой ЛЩ-500 с крышкой на болтах', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 5 (R 3900); ТХ.С: ЛЩ-500 — 9 шт., 77 кг' },
    R7: { side: 'крыша', pos: 7, n: 'Патрубок монтажный для КИП', dn: 100, al: 117, A: 3.0, B: 0.15, note: 'уровнемер, 1 шт.', eq: 'Радарный уровнемер LT 109-07/08/09, диапазон 700…10 700 мм (АК-004) на бобышке 1,5" NPT, патрубок ПМ-100; модель прибора — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 21/24 (α 117°); узел «Бобышка для установки радарного уровнемера» 1,5" NPT; ТХ.С: ПМ-100 — 6' },
    R8: { side: 'крыша', pos: 8, n: 'Патрубок монтажный для КИП', dn: 80, al: 28, A: 3.0, B: 0.15, note: 'для тепловых извещателей пожара, 4 шт.', eq: 'Тепловой пожарный извещатель на патрубке ПМ-80; тип извещателя — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 20/22 (R 3000); ТХ.С: ПМ-80 — 12 на 3 РВС (4 на резервуар)' },
    R9: { side: 'крыша', pos: 9, n: 'Патрубок монтажный для КИП', dn: 80, al: 100, A: 3.0, B: 0.15, note: 'для тепловых извещателей пожара, 4 шт.', eq: 'Тепловой пожарный извещатель на патрубке ПМ-80; тип извещателя — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 20/22 (R 3000); ТХ.С: ПМ-80 — 12 на 3 РВС' },
    R10: { side: 'крыша', pos: 10, n: 'Патрубок монтажный для КИП', dn: 80, al: 202, A: 3.0, B: 0.15, note: 'для тепловых извещателей пожара, 4 шт.', eq: 'Тепловой пожарный извещатель на патрубке ПМ-80; тип извещателя — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 20/22 (R 3000); ТХ.С: ПМ-80 — 12 на 3 РВС' },
    R11: { side: 'крыша', pos: 11, n: 'Патрубок монтажный для КИП', dn: 80, al: 280, A: 3.0, B: 0.15, note: 'для тепловых извещателей пожара, 4 шт.', eq: 'Тепловой пожарный извещатель на патрубке ПМ-80; тип извещателя — условно', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 20/22 (R 3000); ТХ.С: ПМ-80 — 12 на 3 РВС' },
    R12: { side: 'крыша', pos: 12, n: 'Патрубок монтажный для КИП', dn: 50, al: 145, A: 3.0, B: 0.15, note: 'верхний аварийный уровень, 1 шт.', eq: 'Сигнализатор верхнего аварийного уровня LSA H 109-01/03/05, 10 800 мм (АК-004) на бобышке 3/4" NPT, патрубок ПМ-50; модель — условно. До v0.26 стоял на стенке', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 19/23 (α 145°, R 3000); ТХ.С: ПМ-50 — 9 на 3 РВС (крыша 1 + стенка 2)' },
    R13: { side: 'крыша', pos: 13, n: 'Патрубок монтажный', dn: 100, py: 0.25, al: 145, A: 4.155, B: 0.15, note: 'для ГУС', eq: 'ГУС Ø108×4: патрубок ПМ-100 → отвод → огнепреградитель ПО-100 → кран шаровый Ду100 → отвод → опуск по стенке (опоры через 1,0 / 4,0 / 4,0 м от верха стенки) → отвод, горизонталь с низом трубы +2,200 → к трассе Гу ГП-005. Опуск у трассы — условно (152-ТК-003 в комплекте нет)', st: 'CONFIRMED', tx: '109-ТХ-002 поз. 21/30 (α 145°, R 4155), 15 (ПО-100), 14 (кран шаровый Ду100), 28 (труба), 30 (отводы); ТХ.С: ПО-100 — 3, кран шаровый Ду100 ФБ39.010.80 — 3' },
    K1: { side: 'комплектующие', pos: 1, n: 'Молниеприёмник', h: 11.0, al: 37, eq: 'Молниеприёмник на стенке у кромки крыши: верх +22,920, H 11 000 мм над верхом стенки (+11,920 по ТХ-002); нижний конец мачты закреплён к верхнему поясу двумя хомутами. Сечения секций и хомуты — условно (КМ нет). В ТЗ — 10 500 мм: «Сверка» T7', st: 'CONFIRMED', tx: '109-ТХ-002: «Молниеприёмник Н=11000мм», α 37°, отметка верха +22,920; 109-ТХ-001: молниезащита по II категории' },
    K2: { side: 'комплектующие', pos: 2, n: 'Крепление заземления', eq: '2 присоединения у днища. 109-ТХ-001: заземление не менее чем в двух местах, по 227-ЭС (в комплекте нет); положение — условно', st: 'APPROX', tx: '109-ТХ-001: заземление резервуара — не менее 2 мест, по проекту 227-ЭС' },
    K3: { side: 'комплектующие', pos: 3, n: 'Конструкции для пеногенераторов ГПСС-600', eq: 'ГПСС-600 × 2 с пенокамерами на верхнем поясе (тип и количество — ТЗ и 610-ПТ-003-0 поз. 11: 6 шт. на 3 РВС, 34 кг); положение и габарит — условно', st: 'CONFIRMED' },
    K4: { side: 'комплектующие', pos: 4, n: 'Кронштейны трубопроводов орошения', eq: 'Кольцо орошения с оросителями на кронштейнах; диаметр трубы и шаг — условно', st: 'CONFIRMED' },
    M1: { side: 'стенка', ref: '109-ТХ-002 поз. 17', n: 'Механизм управления хлопушкой МУ-I (приём)', al: 176, A: 1.2, angNote: 'смещён от оси патрубка на 0,34 м — вне маховика задвижки (условно)', eq: 'Механизм МУ-I с маховиком на стенке над патрубком приёма; трос через сальник к хлопушке ХП-150-А внутри резервуара. Высота ≈ +1,2 (обмер вида ТХ-002), конструкция — условно', st: 'APPROX', tx: '109-ТХ-002 поз. 17, 18; ТХ.С: МУ-I — 6, ХП-150-А — 3, ХП-200-В — 3 на 3 РВС' },
    M2: { side: 'стенка', ref: '109-ТХ-002 поз. 17', n: 'Механизм управления хлопушкой МУ-I (раздача)', al: 184, A: 1.2, angNote: 'смещён от оси патрубка на 0,34 м — вне маховика задвижки (условно)', eq: 'Механизм МУ-I с маховиком на стенке над патрубком раздачи; трос через сальник к хлопушке ХП-200-В. Высота ≈ +1,2, конструкция — условно', st: 'APPROX', tx: '109-ТХ-002 поз. 17, 18; ТХ.С: МУ-I — 6, ХП-200-В — 3' }
  };
  const MU_D = 0.34 / (R_W + 0.09);   // смещение МУ-I от оси патрубка по стенке (рад)
  TZ.W3.a3 = tzA(195); TZ.M1.a3 = A_INP + MU_D; TZ.M2.a3 = A_OUT - MU_D;
  TZ.K1.rW = R_W + 0.38; TZ.K1.yW = 14.0;   // точка мачты для перелёта камеры и проверки (м от днища)
  for (const [k, it] of Object.entries(TZ)) { it.key = k; if (it.a3 === undefined && it.al !== undefined) it.a3 = tzA(it.al); }
  const ODN = { 15: 0.022, 25: 0.032, 50: 0.057, 80: 0.089, 100: 0.108, 150: 0.159, 200: 0.219, 500: 0.53 };
  function flTop(B, m, yTop, od) {   // фланец с торцом на высоте yTop (PN16 по таблице модели; для Ру 0,25 по ТЗ — условно; Ду500 — по ГОСТ 12820 для Ру 0,25)
    const F = od > 0.4 ? [0.64, 0.6, 16, 0.02, 0.018] : flangeOfOD(od);
    B.add('dark', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, F[4], 28), mul(m, T(0, yTop - F[4] / 2, 0)));
    return F;
  }
  function boltsUp(B, m, y, F, h = 0.05) {
    for (let i = 0; i < F[2]; i++) { const t = (i + 0.5) / F[2] * Math.PI * 2; B.add('bolt', new THREE.CylinderGeometry(F[3] * 0.42, F[3] * 0.42, h, 6), mul(m, T(F[1] / 2 * Math.sin(t), y, F[1] / 2 * Math.cos(t)))); }
  }
  function roofNeck(B, al, r, dn, hB, aa) {   // патрубок крыши по ТЗ: от настила (на T_INS ниже облицовки) до торца фланца на высоте B над настилом
    const a = aa !== undefined ? aa : tzA(al), od = ODN[dn], m = radF(a, r, roofY(r)), yf = hB - T_INS, big = dn >= 500;
    B.add('shell', new THREE.CylinderGeometry(od / 2, od / 2, hB, big ? 32 : 16, 1, big), mul(m, T(0, yf - hB / 2, 0)));
    B.add('galvS', new THREE.CylinderGeometry(od / 2 + 0.06, od / 2 + 0.09, 0.025, big ? 32 : 18), mul(m, T(0, 0.012, 0)));   // оклад изоляции крыши
    const F = flTop(B, m, yf, od);
    return { m, yf, F, od };
  }
  function tzSkylight(B, al, r, hB) {   // люк световой Ду500 (ТЗ: крыша, поз. 1, 2, 6)
    const { m, yf, F } = roofNeck(B, al, r, 500, hB);
    B.add('dark', new THREE.CylinderGeometry(F[0] / 2 - 0.02, F[0] / 2 - 0.02, 0.003, 28), mul(m, T(0, yf + 0.0015, 0)));   // прокладка
    B.add('steel', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.012, 32), mul(m, T(0, yf + 0.009, 0)));                // крышка
    boltsUp(B, m, yf + 0.008, F, 0.05);
    for (const s of [-1, 1]) B.add('steel', boxBetween(V(s * 0.13, yf + 0.015, 0), V(s * 0.13, yf + 0.09, 0), 0.02, 0.02), m);
    B.add('steel', boxBetween(V(-0.13, yf + 0.09, 0), V(0.13, yf + 0.09, 0), 0.02, 0.02), m);                             // ручка
    B.add('steel', boxBetween(V(-0.06, yf + 0.012, F[0] / 2 - 0.01), V(0.06, yf + 0.012, F[0] / 2 + 0.03), 0.03, 0.025), m);   // петля
  }
  function tzBreather(B, al, r, hB) {   // клапан дыхательный совмещённый КДС2-1500Л Ду200 со встроенным огнепреградителем на ПМ-200 (ТЗ: крыша, поз. 3, 4; 109-ТХ-001, ТХ.С); габариты корпуса — условно
    const { m, yf, F } = roofNeck(B, al, r, 200, hB), y = yf;
    boltsUp(B, m, y, F, 0.06);
    B.add('dark', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.022, 24), mul(m, T(0, y + 0.011, 0)));          // присоединительный фланец клапана
    B.add('steel', new THREE.CylinderGeometry(0.17, 0.2, 0.17, 24), mul(m, T(0, y + 0.107, 0)));                  // нижний корпус: кассета огнепреградителя (встроенная)
    for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; B.add('steel', boxBetween(V(0.17 * Math.sin(t), y + 0.03, 0.17 * Math.cos(t)), V(0.2 * Math.sin(t), y + 0.19, 0.2 * Math.cos(t)), 0.012, 0.02), m); }   // рёбра
    B.add('dark', new THREE.CylinderGeometry(0.235, 0.235, 0.02, 28), mul(m, T(0, y + 0.2, 0)));                   // разъём корпуса
    B.add('steel', new THREE.CylinderGeometry(0.26, 0.24, 0.24, 28), mul(m, T(0, y + 0.33, 0)));                   // корпус тарелей давления и вакуума
    for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4 * Math.PI * 2;                                                // окна выхода в атмосферу с сеткой
      B.add('dark', new THREE.BoxGeometry(0.17, 0.12, 0.02), mul(m, T(0.255 * Math.sin(t), y + 0.33, 0.255 * Math.cos(t)), RY(t))); }
    B.add('dark', new THREE.CylinderGeometry(0.28, 0.28, 0.018, 28), mul(m, T(0, y + 0.459, 0)));                  // фланец крышки
    B.add('steel', new THREE.CylinderGeometry(0.07, 0.27, 0.12, 28), mul(m, T(0, y + 0.528, 0)));                   // крышка
    B.add('dark', new THREE.TorusGeometry(0.035, 0.009, 6, 14), mul(m, T(0, y + 0.62, 0)));                         // рым
  }
  function tzLZ(B, al, r, hB) {   // УСЛОВНО: люк замерный ЛЗ-150 на монтажном патрубке Ду150 (ТЗ: крыша, поз. 5)
    const { m, yf, F } = roofNeck(B, al, r, 150, hB), y = yf;
    boltsUp(B, m, y, F, 0.05);
    B.add('dark', new THREE.CylinderGeometry(0.11, 0.12, 0.12, 20), mul(m, T(0, y + 0.06, 0)));       // корпус с направляющей
    B.add('alu', new THREE.CylinderGeometry(0.14, 0.15, 0.05, 20), mul(m, T(0, y + 0.145, 0)));        // крышка
    B.add('dark', new THREE.BoxGeometry(0.07, 0.05, 0.06), mul(m, T(0, y + 0.13, 0.16)));              // шарнир
    B.add('dark', boxBetween(V(0, y + 0.19, 0.1), V(0, y + 0.19, -0.12), 0.025, 0.025), m);
    B.add('dark', boxBetween(V(0, y + 0.19, -0.12), V(0, y + 0.12, -0.2), 0.025, 0.025), m);           // педаль
  }
  function tzRadar(B, al, r, hB) {   // уровнемер LT на патрубке Ду100 (ТЗ: крыша, поз. 7); тип прибора условно
    const { m, yf, F } = roofNeck(B, al, r, 100, hB), y = yf;
    boltsUp(B, m, y, F, 0.05);
    B.add('alu', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.02, 20), mul(m, T(0, y + 0.01, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.035, 0.045, 0.09, 12), mul(m, T(0, y + 0.065, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.07, 0.07, 0.13, 20), mul(m, T(0, y + 0.175, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.072, 0.072, 0.03, 20), mul(m, T(0, y + 0.255, 0)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8)), mul(m, T(0, y + 0.15, 0.085)));
  }
  function tzHeat(B, al, r, hB) {   // тепловой пожарный извещатель на патрубке Ду80 (ТЗ: крыша, поз. 8–11); тип — условно
    const { m, yf, F } = roofNeck(B, al, r, 80, hB), y = yf;
    boltsUp(B, m, y, F, 0.045);
    B.add('dark', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.016, 20), mul(m, T(0, y + 0.008, 0)));   // фланец-заглушка с вводом
    B.add('alu', new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10), mul(m, T(0, y + 0.04, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.045, 0.045, 0.07, 16), mul(m, T(0, y + 0.1, 0)));              // корпус
    B.add('red', new THREE.CylinderGeometry(0.047, 0.047, 0.014, 16), mul(m, T(0, y + 0.142, 0)));           // крышка (опознавательный цвет — условно)
    B.add('dark', ZC(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8)), mul(m, T(0, y + 0.09, 0.065)));     // кабельный ввод
  }
  function tzLevelTop(B, al, r, hB) {   // сигнализатор верхнего аварийного уровня LSA H на патрубке Ду50 (ТЗ: крыша, поз. 12); тип — условно
    const { m, yf, F } = roofNeck(B, al, r, 50, hB), y = yf;
    boltsUp(B, m, y, F, 0.045);
    B.add('dark', new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.016, 18), mul(m, T(0, y + 0.008, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), mul(m, T(0, y + 0.05, 0)));
    B.add('alu', new THREE.CylinderGeometry(0.05, 0.05, 0.09, 16), mul(m, T(0, y + 0.13, 0)));
    B.add('dark', new THREE.CylinderGeometry(0.052, 0.052, 0.02, 16), mul(m, T(0, y + 0.185, 0)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8)), mul(m, T(0, y + 0.12, 0.07)));
  }
  function manholeTZ(B, al, yc, bOut) {   // люк-лаз Ду600 (ТЗ: стенка, поз. 4)
    const m = radF(tzA(al), 0, yc), zf = R_W + bOut;
    B.add('shell', ZC(new THREE.CylinderGeometry(0.31, 0.31, zf - 0.04 - (R_W - 0.02), 28, 1, true)), mul(m, T(0, 0, (zf - 0.04 + R_W - 0.02) / 2)));
    B.add('galvS', ZC(new THREE.CylinderGeometry(0.45, 0.45, 0.02, 28)), mul(m, T(0, 0, R_CL + 0.01)));   // оклад изоляции
    B.add('dark', ZC(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 32)), mul(m, T(0, 0, zf - 0.035)));      // фланец
    B.add('shell', ZC(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 32)), mul(m, T(0, 0, zf - 0.002)));      // крышка
    for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; B.add('bolt', ZC(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 6)), mul(m, T(0.36 * Math.sin(t), 0.36 * Math.cos(t), zf - 0.02))); }
    for (const s of [-1, 1]) { B.add('steel', boxBetween(V(s * 0.12, 0.16, zf + 0.01), V(s * 0.12, 0.16, zf + 0.1), 0.02, 0.02), m); B.add('steel', boxBetween(V(s * 0.12, 0.16, zf + 0.1), V(s * 0.12, -0.04, zf + 0.1), 0.02, 0.02), m); }
    B.add('steel', cylBetween(V(0.47, -0.3, R_CL + 0.05), V(0.47, 0.42, R_CL + 0.05), 0.025, 8), m);   // поворотное устройство крышки (условно)
    B.add('steel', cylBetween(V(0.47, 0.42, R_CL + 0.05), V(0.47, 0.42, zf + 0.04), 0.02, 8), m);
    B.add('steel', cylBetween(V(0.47, 0.42, zf + 0.04), V(0, 0.42, zf + 0.04), 0.018, 8), m);
  }
  function rrShape(w, h, rr) {   // прямоугольник со скруглёнными углами (в плоскости x–y)
    const s = new THREE.Shape(), x = w / 2, y = h / 2;
    s.moveTo(-x + rr, -y); s.lineTo(x - rr, -y); s.absarc(x - rr, -y + rr, rr, -Math.PI / 2, 0, false); s.lineTo(x, y - rr); s.absarc(x - rr, y - rr, rr, 0, Math.PI / 2, false);
    s.lineTo(-x + rr, y); s.absarc(-x + rr, y - rr, rr, Math.PI / 2, Math.PI, false); s.lineTo(-x, -y + rr); s.absarc(-x + rr, -y + rr, rr, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function rrRing(w, h, rr, t, depth) {   // кольцо по контуру (горловина, фланец) — выдавливание вдоль локальной z от 0 до depth
    const s = rrShape(w + 2 * t, h + 2 * t, rr + t), hole = rrShape(w, h, rr); s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  }
  function manholeOval(B, al, yc, bOut) {   // люк-лаз 600 × 900 (ТЗ: стенка, поз. 5); большая сторона — горизонтально (условно)
    const m = radF(tzA(al), 0, yc), zf = R_W + bOut, W = 0.9, H = 0.6, RR = 0.22;
    B.add('shell', rrRing(W, H, RR, 0.012, zf - 0.04 - (R_W - 0.03)), mul(m, T(0, 0, R_W - 0.03)));                // горловина
    B.add('galvS', rrRing(W + 0.02, H + 0.02, RR, 0.13, 0.02), mul(m, T(0, 0, R_CL)));                           // оклад изоляции
    B.add('dark', rrRing(W, H, RR, 0.1, 0.035), mul(m, T(0, 0, zf - 0.07)));                                     // фланец
    B.add('shell', new THREE.ExtrudeGeometry(rrShape(W + 0.2, H + 0.2, RR + 0.1), { depth: 0.03, bevelEnabled: false, curveSegments: 6 }), mul(m, T(0, 0, zf - 0.034)));   // крышка
    const pts = rrShape(W + 0.1, H + 0.1, RR + 0.05).getSpacedPoints(26);
    for (let i = 0; i < pts.length - 1; i++) B.add('bolt', ZC(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 6)), mul(m, T(pts[i].x, pts[i].y, zf - 0.04)));
    for (const s of [-1, 1]) { B.add('steel', boxBetween(V(s * 0.22, 0.14, zf + 0.005), V(s * 0.22, 0.14, zf + 0.09), 0.02, 0.02), m); B.add('steel', boxBetween(V(s * 0.22, 0.14, zf + 0.09), V(s * 0.22, -0.06, zf + 0.09), 0.02, 0.02), m); }
    B.add('steel', cylBetween(V(0.62, -0.25, R_CL + 0.05), V(0.62, 0.4, R_CL + 0.05), 0.025, 8), m);   // поворотное устройство (условно)
    B.add('steel', cylBetween(V(0.62, 0.4, R_CL + 0.05), V(0.62, 0.4, zf + 0.04), 0.02, 8), m);
    B.add('steel', cylBetween(V(0.62, 0.4, zf + 0.04), V(0, 0.4, zf + 0.04), 0.018, 8), m);
  }
  function psr(B, al, yc) {   // УСЛОВНО: выносной блок кранов пробоотборника ПСР Ду15 (ТЗ: стенка, поз. 9; комплектующие, п. 9)
    const m = radF(tzA(al), 0, yc), z0 = R_CL + 0.16;
    B.add('shell', cylBetween(V(0, 0.12, R_W), V(0, 0.12, z0 - 0.06), 0.016, 8), m);                        // патрубок
    B.add('galvS', ZC(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 14)), mul(m, T(0, 0.12, R_CL + 0.006)));
    B.add('alu', new THREE.BoxGeometry(0.24, 0.44, 0.12), mul(m, T(0, 0.02, z0)));                         // корпус блока кранов
    B.add('dark', new THREE.BoxGeometry(0.25, 0.02, 0.13), mul(m, T(0, 0.25, z0)));
    for (let i = 0; i < 3; i++) {                                                                             // краны отбора проб по секциям
      const y = 0.15 - i * 0.12;
      B.add('dark', ZC(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10)), mul(m, T(-0.05, y, z0 + 0.08)));
      B.add('red', boxBetween(V(-0.05, y + 0.025, z0 + 0.09), V(0.07, y + 0.025, z0 + 0.09), 0.018, 0.012), m);
      B.add('dark', cylBetween(V(-0.05, y - 0.015, z0 + 0.1), V(-0.05, y - 0.06, z0 + 0.1), 0.007, 6), m);
    }
    B.add('steel', new THREE.BoxGeometry(0.3, 0.015, 0.2), mul(m, T(0, -0.3, z0 + 0.06)));                    // полка под пробоотборную посуду
    B.add('steel', boxBetween(V(0, -0.31, R_CL), V(0, -0.31, z0 + 0.14), 0.03, 0.02), m);
  }
  function lightningRod(B, al) {   // молниеприёмник по 109-ТХ-002-0: α 37°, верх +22,920, H 11 000 над верхом стенки; мачта на двух хомутах к верхнему поясу. Сечения секций — условно (КМ нет)
    const a = tzA(al), R = TZ.K1.rW, y0 = YT - 1.15, y1 = Y0 + 22.92, yA = Y0 + 14.0, yB = Y0 + 16.5, P = y => PP(a, R, y);
    B.add('steel', cylBetween(P(y0), P(yA), 0.045, 12));                                                              // нижняя секция Ø89 (условно)
    B.add('steel', cylBetween(P(yA), P(yB), 0.03, 10));                                                                // средняя секция Ø60 (условно)
    const pc = P(yB); B.add('steel', new THREE.CylinderGeometry(0.013, 0.03, 0.3, 10), T(pc.x, yB + 0.15, pc.z));       // переход
    B.add('steel', new THREE.CylinderGeometry(0.005, 0.013, y1 - yB - 0.3, 8), T(pc.x, (yB + 0.3 + y1) / 2, pc.z));     // стержень до +22,920
    for (const y of [yA, yB]) { const p = P(y); B.add('dark', new THREE.CylinderGeometry(y < yB ? 0.06 : 0.042, y < yB ? 0.06 : 0.042, 0.06, 12), T(p.x, y, p.z)); }   // стыки
    for (const y of [YT - 0.18, YT - 1.05]) {                                                                          // хомуты к верхнему поясу (ТХ-002: ≈0,2 и ≈1,1 м ниже верха стенки)
      B.add('steel', boxBetween(PP(a, R_CL, y), PP(a, R - 0.05, y), 0.07, 0.08));
      B.add('steel', new THREE.BoxGeometry(0.16, 0.2, 0.012), radF(a, R_CL + 0.006, y));                         // опорная пластина на облицовке
      const p = P(y); B.add('dark', new THREE.TorusGeometry(0.058, 0.012, 6, 14).rotateX(Math.PI / 2), T(p.x, y, p.z));
    }
    const pb = P(y0); B.add('dark', new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), T(pb.x, y0, pb.z));
    B.add('dark', boxBetween(PP(a, R, y0 + 0.12), PP(a, R_CL, y0 + 0.12), 0.03, 0.006));                              // токоотвод к стенке (условно)
  }
  function ks80(B, al, yc) {   // кран сифонный КС-80 с задвижкой, Ру 0,15 МПа (ТЗ: стенка, поз. 8; 109-ТХ-002 поз. 13; ТХ.С) — конструкция и габариты условно
    const m = radF(tzA(al), 0, yc), zf = R_CL + 0.06, zb = zf + 0.1;
    B.add('shell', cylBetween(V(0, 0, R_W), V(0, 0, zf - 0.01), 0.0445, 12), m);                                     // патрубок Ду80
    B.add('galvS', ZC(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 18)), mul(m, T(0, 0, R_CL + 0.006)));            // оклад изоляции
    B.add('dark', ZC(new THREE.CylinderGeometry(0.0975, 0.0975, 0.02, 18)), mul(m, T(0, 0, zf)));                    // фланцы Ду80
    B.add('dark', ZC(new THREE.CylinderGeometry(0.0975, 0.0975, 0.02, 18)), mul(m, T(0, 0, zf + 0.022)));
    for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4 * Math.PI * 2; B.add('bolt', ZC(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6)), mul(m, T(0.08 * Math.sin(t), 0.08 * Math.cos(t), zf + 0.011))); }
    B.add('dark', ZC(new THREE.CylinderGeometry(0.065, 0.07, 0.14, 16)), mul(m, T(0, 0, zb)));                        // корпус крана
    B.add('dark', ZC(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 14)), mul(m, T(0, 0, zb + 0.1)));                 // сальник поворота сифонной трубы
    B.add('dark', ZC(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8)), mul(m, T(0, 0, zb + 0.15)));
    B.add('red', boxBetween(V(0, -0.05, zb + 0.17), V(0, 0.24, zb + 0.17), 0.03, 0.018), m);                          // рукоятка поворота (положение — «сифон вниз», условно)
    B.add('steel', new THREE.CylinderGeometry(0.11, 0.11, 0.006, 16, 1, false, -0.6, 1.2).rotateX(Math.PI / 2), mul(m, T(0, 0, zb + 0.135)));   // сектор-указатель положения
    // боковой выход → задвижка Ду80 (ось вдоль −x, шпиндель вверх)
    const xv = -0.27, vL = 0.21;
    B.add('dark', cylBetween(V(-0.06, 0, zb), V(xv + vL / 2 + 0.01, 0, zb), 0.0445, 12), m);
    for (const x of [xv + vL / 2, xv - vL / 2]) B.add('dark', new THREE.CylinderGeometry(0.0975, 0.0975, 0.02, 18).rotateZ(Math.PI / 2), mul(m, T(x, 0, zb)));
    B.add('dark', new THREE.CylinderGeometry(0.055, 0.055, vL - 0.03, 14).rotateZ(Math.PI / 2), mul(m, T(xv, 0, zb)));
    B.add('dark', new THREE.CylinderGeometry(0.07, 0.065, 0.16, 14).scale(1, 1, 0.7), mul(m, T(xv, 0.05, zb)));        // корпус задвижки
    B.add('dark', new THREE.CylinderGeometry(0.03, 0.06, 0.1, 12), mul(m, T(xv, 0.18, zb)));                             // крышка
    for (const s of [-1, 1]) B.add('dark', new THREE.BoxGeometry(0.018, 0.17, 0.03), mul(m, T(xv + s * 0.035, 0.31, zb)));   // бугель
    B.add('dark', new THREE.BoxGeometry(0.09, 0.025, 0.04), mul(m, T(xv, 0.4, zb)));
    B.add('red', new THREE.TorusGeometry(0.09, 0.009, 6, 22).rotateX(Math.PI / 2), mul(m, T(xv, 0.43, zb)));         // маховик
    B.add('red', new THREE.BoxGeometry(0.17, 0.008, 0.014), mul(m, T(xv, 0.43, zb)));
    B.add('dark', cylBetween(V(xv - vL / 2 - 0.01, 0, zb), V(xv - vL / 2 - 0.09, 0, zb), 0.0445, 12), m);             // выход с заглушкой (условно)
    B.add('dark', new THREE.CylinderGeometry(0.0975, 0.0975, 0.02, 18).rotateZ(Math.PI / 2), mul(m, T(xv - vL / 2 - 0.1, 0, zb)));
    B.add('steel', boxBetween(V(xv, -0.06, zb), V(xv, -0.06, R_CL), 0.04, 0.012), m);                                  // кронштейн к стенке
  }
  function muI(B, a, yc) {   // механизм управления хлопушкой МУ-I (109-ТХ-002 поз. 17; ТХ.С) — положение по высоте — обмер вида, конструкция условно
    const m = radF(a, 0, yc), z0 = R_CL;
    B.add('dark', cylBetween(V(0, -0.05, R_W), V(0, -0.05, z0 + 0.03), 0.022, 8), m);                                 // сальник прохода троса через стенку
    B.add('galvS', ZC(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12)), mul(m, T(0, -0.05, z0 + 0.005)));
    B.add('steel', new THREE.BoxGeometry(0.24, 0.32, 0.012), mul(m, T(0, 0, z0 + 0.006)));                            // опорная плита
    B.add('dark', new THREE.BoxGeometry(0.17, 0.2, 0.11), mul(m, T(0, 0.01, z0 + 0.067)));                             // корпус редуктора с барабаном
    B.add('dark', ZC(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14)), mul(m, T(0, 0.04, z0 + 0.145)));
    B.add('dark', ZC(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8)), mul(m, T(0, 0.04, z0 + 0.19)));
    B.add('red', new THREE.TorusGeometry(0.11, 0.01, 6, 24), mul(m, T(0, 0.04, z0 + 0.225)));                          // маховик
    for (let k = 0; k < 3; k++) B.add('red', new THREE.BoxGeometry(0.2, 0.012, 0.012), mul(m, T(0, 0.04, z0 + 0.225), RZ(k * Math.PI / 3)));
    B.add('alu', new THREE.BoxGeometry(0.09, 0.03, 0.004), mul(m, T(0, -0.13, z0 + 0.124)));                           // табличка «открыто/закрыто»
  }
  function valveJacket(B, dn, vm) {   // теплоизоляция арматуры: маты 60 мм + сталь тонколистовая 0,5 мм (109-ТХ.ВТ); форма съёмного кожуха — условно
    const v = VALVE[dn], rb = v.r * 1.3, rj = v.Df / 2 + 0.065, Lj = v.L + 0.06;
    B.add('galv', new THREE.CylinderGeometry(rj, rj, Lj, 28).rotateZ(Math.PI / 2), vm);
    B.add('galv', new THREE.CylinderGeometry(rb + 0.075, rb + 0.075, v.r * 1.9, 24).scale(1, 1, 0.8), mul(vm, T(0, v.r * 0.95, 0)));
    for (const x of [-Lj / 2 + 0.03, Lj / 2 - 0.03]) B.add('galvS', new THREE.TorusGeometry(rj + 0.002, 0.006, 4, 28).rotateY(Math.PI / 2), mul(vm, T(x, 0, 0)));   // стяжные ленты
  }
  function guPO(B, c) {   // огнепреградитель ПО-100 на ГУС (109-ТХ-002 поз. 15; ТХ.С); ось — z; габариты условно
    const F = flangeOfOD(0.108);
    for (const s of [-1, 1]) { B.add('dark', ZC(new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.022, 20)), T(c.x, c.y, c.z + s * 0.15)); B.add('dark', ZC(new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.022, 20)), T(c.x, c.y, c.z + s * 0.174)); }
    B.add('steel', ZC(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 18)), T(c.x, c.y, c.z - 0.115));
    B.add('steel', ZC(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 18)), T(c.x, c.y, c.z + 0.115));
    B.add('steel', ZC(new THREE.CylinderGeometry(0.115, 0.115, 0.17, 22)), T(c.x, c.y, c.z));                          // корпус с кассетой
    for (const s of [-1, 1]) B.add('dark', ZC(new THREE.CylinderGeometry(0.125, 0.125, 0.018, 22)), T(c.x, c.y, c.z + s * 0.08));
    for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8 * Math.PI * 2; B.add('bolt', ZC(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6)), T(c.x + F[1] / 2 * Math.sin(t), c.y + F[1] / 2 * Math.cos(t), c.z - 0.162)); B.add('bolt', ZC(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6)), T(c.x + F[1] / 2 * Math.sin(t), c.y + F[1] / 2 * Math.cos(t), c.z + 0.162)); }
  }
  function guBall(B, c) {   // кран шаровый Ду100 фланцевый на ГУС (109-ТХ-002 поз. 14; ТХ.С: ФБ39.010.80); ось — z; рукоятка вдоль трубы — «открыто»
    const F = flangeOfOD(0.108);
    for (const s of [-1, 1]) B.add('dark', ZC(new THREE.CylinderGeometry(F[0] / 2, F[0] / 2, 0.022, 20)), T(c.x, c.y, c.z + s * 0.12));
    B.add('dark', new THREE.SphereGeometry(0.1, 18, 12).scale(1, 0.95, 1.15), T(c.x, c.y, c.z));
    B.add('dark', new THREE.CylinderGeometry(0.03, 0.035, 0.09, 10), T(c.x, c.y + 0.13, c.z));
    B.add('red', boxBetween(V(c.x, c.y + 0.18, c.z + 0.02), V(c.x, c.y + 0.19, c.z - 0.32), 0.035, 0.015));
  }
  function tzRoof(B) {
    B.tag = 'R1'; tzSkylight(B, 110, 3.9, 0.2); B.tag = 'R2'; tzSkylight(B, 180, 3.9, 0.2); B.tag = 'R6'; tzSkylight(B, 290, 3.9, 0.2);
    B.tag = 'R3'; tzBreather(B, 28, 3.9, 0.2); B.tag = 'R4'; tzBreather(B, 45, 3.9, 0.2);
    B.tag = 'R5'; tzLZ(B, 350, 4.155, 0.15);
    B.tag = 'R7'; tzRadar(B, 117, 3.0, 0.15);
    for (const [k, al] of [['R8', 28], ['R9', 100], ['R10', 202], ['R11', 280]]) { B.tag = k; tzHeat(B, al, 3.0, 0.15); }
    B.tag = 'R12'; tzLevelTop(B, 145, 3.0, 0.15);
    B.tag = null;
  }
  function tzWall(B) {
    B.tag = 'W4'; manholeTZ(B, 73, Y0 + 0.75, 0.35);
    B.tag = 'W5'; manholeOval(B, 272, Y0 + 0.65, 0.30);
    B.tag = 'W6'; thermo(B, tzA(TZ.W6.al), Y0 + TZ.W6.A);   // v0.26: α 170° по 109-ТХ-002 (ТЗ — 165°)
    B.tag = 'W7'; levelSwitch(B, tzA(215), Y0 + 0.7);
    B.tag = 'W8'; ks80(B, 202, Y0 + 0.35);
    B.tag = 'W9'; psr(B, 250, Y0 + 0.9);
    B.tag = 'M1'; muI(B, TZ.M1.a3, Y0 + TZ.M1.A);
    B.tag = 'M2'; muI(B, TZ.M2.a3, Y0 + TZ.M2.A);
    B.tag = 'K1'; lightningRod(B, 37);
    B.tag = 'K2'; grounding(B, -2.40); grounding(B, 2.05);
    B.tag = null;
  }
  function tagRanges(list, tags) {   // диапазоны индексов слитой геометрии по позициям ТЗ (для карточки по клику)
    const R = []; let o = 0;
    list.forEach((g, i) => {
      const n = g.index ? g.index.count : g.attributes.position.count, t = tags && tags[i];
      if (t) { const last = R[R.length - 1]; if (last && last[2] === t && last[1] === o) last[1] = o + n; else R.push([o, o + n, t]); }
      o += n;
    });
    return R;
  }
  const itemCache = {};
  function itemObj(id, key) {
    const k = id + '|' + key; if (itemCache[k]) return itemCache[k];
    const it = TZ[key];
    return (itemCache[k] = { id: 'РВС-' + id, net: 1, f26: key, tank: id, name: `${it.n}${it.dn ? ' Ду' + it.dn : ''} — ТЗ на РВС-1000, ${it.side}${it.pos ? ', поз. ' + it.pos : ''}`, note: it.eq });
  }
  const pickBy = (R, o, id) => R && R.length ? h => { const fi = (h.faceIndex || 0) * 3; for (const r of R) if (fi >= r[0] && fi < r[1]) return itemObj(id, r[2]); return o; } : null;

  /* ---------- общая часть (одинакова для трёх РВС) ---------- */
  const NOZ = {};
  function buildBody(B, Bo, Bq) {   // Bq — v0.26: прежнее условное оборудование крыши и стенки (слой сравнения)
    // кольцевой фундамент, окрайка, стенка
    B.add('conc', new THREE.CylinderGeometry(R_F, R_F + 0.06, Y0 + 1.2, 96, 1, false), T(0, Y0 - (Y0 + 1.2) / 2, 0));
    B.add('shell', new THREE.CylinderGeometry(R_W + 0.05, R_W + 0.05, 0.014, 96), T(0, Y0 + 0.007, 0));
    B.add('shell', new THREE.CircleGeometry(R_W, 64).rotateX(-Math.PI / 2), T(0, Y0 + 0.015, 0));
    B.add('shell', new THREE.CylinderGeometry(R_W, R_W, 0.22, 96, 1, true), T(0, Y0 + 0.11, 0));
    B.add('shellIn', new THREE.CylinderGeometry(R_W - 0.002, R_W - 0.002, YT - Y0, 96, 1, true), T(0, (Y0 + YT) / 2, 0));
    // теплоизоляция: облицовка, бандажи через 1,5 м, отливы
    B.add('galvS', new THREE.CylinderGeometry(R_CL + 0.004, R_CL + 0.05, 0.06, 128, 1, true), T(0, Y0 + 0.2, 0));
    B.add('clad', new THREE.CylinderGeometry(R_CL, R_CL, YT - Y0 - 0.2, 160, 1, true), T(0, (YT + Y0 + 0.2) / 2, 0));
    for (let k = 1; k <= 7; k++) B.add('galvS', new THREE.TorusGeometry(R_CL + 0.004, 0.008, 4, 160).rotateX(Math.PI / 2), T(0, Y0 + 1.5 * k, 0));
    B.add('galvS', new THREE.CylinderGeometry(R_CL + 0.02, R_CL + 0.02, 0.12, 128, 1, true), T(0, YT - 0.04, 0));
    // коническая кровля
    B.add('roof', new THREE.CylinderGeometry(0.25, R_E, RISE, 128, 1, true), T(0, YT + RISE / 2, 0));
    B.add('roof', new THREE.CylinderGeometry(R_E, R_E, 0.1, 128, 1, true), T(0, YT - 0.03, 0));
    B.add('roof', new THREE.CylinderGeometry(0.25, 0.25, 0.06, 24), T(0, YT + RISE + 0.03, 0));
    // ограждение кровли по периметру. v0.21: разрыв — у переходного мостика шахтной лестницы (ТЗ на РВС-1000: «лестница — шахтная»)
    const rP = R_E - 0.07, yP = YT + 0.01;
    const roofRail = (Bx, aR0, aR1, np) => {
      Bx.add('steel', new THREE.CylinderGeometry(rP, rP, 0.15, Math.max(6, Math.ceil(np * 6.6)), 1, true, aR0, aR1 - aR0), T(0, yP + 0.075, 0));
      Bx.add('steel', arcTube(rP, aR0, aR1, yP + 1.1, yP + 1.1, 0.024));
      Bx.add('steel', arcTube(rP, aR0, aR1, yP + 0.55, yP + 0.55, 0.012));
      for (let i = 0; i <= np; i++) Bx.add('steel', new THREE.BoxGeometry(0.05, 1.1, 0.05), radF(aR0 + (aR1 - aR0) * i / np, rP, yP + 0.55));
    };
    roofRail(B, A_PAD + SH_GAP, A_PAD - SH_GAP + Math.PI * 2, 24);
    // прежняя кольцевая лестница (до v0.21): два марша, промежуточная и верхняя площадки, фундамент, ограждение кровли без разрыва у шахты
    roofRail(Bo, A_PAD - SH_GAP, A_PAD + SH_GAP, 1);
    flight(Bo, 2.65, 1.65, Y0, Y_MID, 30);
    platform(Bo, 1.65, 1.45, R_SI, Y_MID, false);
    flight(Bo, 1.45, 0.46, Y_MID, Y_TOP, 31);
    platform(Bo, 0.46, 0.20, R_E - 0.4, Y_TOP, true);
    Bo.add('conc', new THREE.BoxGeometry(1.0, 1.1, 1.1), radF(2.76, R_SM + 0.05, Y0 - 0.55));
    walkway(B);
    walkway(B, A_PAD);   // v0.21: переход по кровле от мостика шахтной лестницы к центру
    // кровля: облицовка теплоизоляции 80 мм (ТЗ, п. 14) — отлив по кромке; оборудование — v0.26 по ТЗ (л. 3); прежнее условное (v0.5) — в слое сравнения
    B.add('galvS', new THREE.CylinderGeometry(R_E + 0.006, R_E + 0.006, 0.05, 128, 1, true), T(0, YT + 0.04, 0));
    if (Bq) { lz(Bq, 0.20, 4.3); radar(Bq, 0.10, 3.4); breather(Bq, 0.12, 2.6); breather(Bq, 0.58, 2.6); skylight(Bq, 1.9, 4.3); skylight(Bq, -1.6, 4.3); }
    tzRoof(B);
    // кольцо орошения (ТЗ, комплектующие, п. 4: кронштейны трубопроводов орошения)
    B.tag = 'K4';
    B.add('red', arcTube(R_RING, 0, Math.PI * 2, Y_RING, Y_RING, 0.04, 8));
    for (let i = 0; i < 28; i++) { const a = (i + 0.5) / 28 * Math.PI * 2; B.add('galv', cylBetween(PP(a, R_RING, Y_RING - 0.02), PP(a, R_RING - 0.07, Y_RING - 0.12), 0.012, 6)); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; B.add('steel', boxBetween(PP(a, R_CL, Y_RING - 0.06), PP(a, R_RING + 0.04, Y_RING - 0.06), 0.03, 0.04)); }
    // кольцевой пенопровод и пеногенераторы ГПСС-600 × 2 (ТЗ, комплектующие, п. 3; 610-ПТ-003-0 поз. 11)
    B.tag = 'K3';
    const aF = -Math.PI + 0.079;
    B.add('red', arcTube(R_FOAM, aF, -Math.PI + 0.7, Y_FOAM, Y_FOAM, 0.0445, 8));
    B.add('red', arcTube(R_FOAM, aF, -Math.PI - 0.7, Y_FOAM, Y_FOAM, 0.0445, 8));
    for (let a = -Math.PI - 0.62; a < -Math.PI + 0.65; a += 0.2) B.add('steel', boxBetween(PP(a, R_CL, Y_FOAM - 0.07), PP(a, R_FOAM + 0.04, Y_FOAM - 0.07), 0.03, 0.04));
    foamGen(B, -Math.PI + 0.7); foamGen(B, Math.PI - 0.7);
    B.tag = null;
    // патрубки и коренные задвижки: приём Ду150 и раздача Ду200 — угол по трассам ГП-005; v0.26: ось и вылет — по ТЗ (A 350, B 200 / 250);
    // третий патрубок — зачистка Ду150, α 195° (ТЗ поз. 3; 109-ТХ-002 поз. 10; ТХ.С и ТХ.ВТ: Ду150 × 2 и Ду200 × 1 на РВС). До v0.26 — второй отвод ⌀219 по АК-004.
    // Задвижки — в утеплённых кожухах (109-ТХ.ВТ: арматура 60 мм + сталь 0,5 мм)
    B.tag = 'W2'; NOZ.out = nozzleValve(B, A_OUT, 200, TZ.W2.B); NOZ.out.a = A_OUT; valveJacket(B, 200, NOZ.out.vm);
    B.tag = 'W3'; NOZ.out2 = nozzleValve(B, TZ.W3.a3, 150, TZ.W3.B); NOZ.out2.a = TZ.W3.a3; valveJacket(B, 150, NOZ.out2.vm);
    B.tag = 'W1'; NOZ.inp = nozzleValve(B, A_INP, 150, TZ.W1.B); NOZ.inp.a = A_INP; valveJacket(B, 150, NOZ.inp.vm);
    B.tag = null;
    // люки-лазы, КИП, сифонный кран, пробоотборник, молниеприёмник, заземление — v0.26 по ТЗ; прежние условные (v0.5) — в слое сравнения
    if (Bq) { manhole(Bq, 1.6); manhole(Bq, -1.6); levelSwitch(Bq, 0.75, Y0 + 10.8); levelSwitch(Bq, -0.25, Y0 + 0.7); thermo(Bq, -0.33, Y0 + 1.0); siphon(Bq, -0.95); grounding(Bq, -2.2); }
    tzWall(B);
  }
  function flight(B, aS, aE, yS, yE, n) {
    const rise = (yE - yS) / n, da = (aE - aS) / (n - 1);
    const yc = t => yS + rise * (t * (n - 1) + 0.5);
    for (let i = 1; i < n; i++) {
      const a0 = aS + da * (i - 1), a1 = aS + da * i, y = yS + i * rise;
      B.add('grate', sectorGrate(R_SI + 0.01, R_SO - 0.01, a0 - da * 0.05, a1, y - 0.012, 1));
      B.add('steel', new THREE.BoxGeometry(0.035, 0.03, R_SO - R_SI), radF(a1, R_SM, y - 0.02));
    }
    const t0 = -0.03;
    for (const r of [R_SI, R_SO]) {
      B.add('steel', ribbon(r, aS + (aE - aS) * t0, aE, yc(t0) + 0.05, yc(1) + 0.05, 0.22));
      B.add('steel', arcTube(r, aS, aE, yc(0) + 1.0, yc(1) + 1.0, 0.022));
      B.add('steel', arcTube(r, aS, aE, yc(0) + 0.5, yc(1) + 0.5, 0.012));
      const np = Math.ceil((n - 1) / 5);
      for (let j = 0; j <= np; j++) { const t = j / np; B.add('steel', new THREE.BoxGeometry(0.04, 1.0, 0.04), radF(aS + (aE - aS) * t, r, yc(t) + 0.5)); }
    }
    const nb = Math.ceil(Math.abs(aE - aS) / 0.22);
    for (let j = 0; j <= nb; j++) {
      const t = j / nb, a = aS + (aE - aS) * t, y = yc(t) - 0.2;
      if (y < Y0 + 0.5 || Math.abs(y - Y_RING) < 0.35) continue;
      B.add('steel', boxBetween(PP(a, R_CL, y), PP(a, R_SO + 0.02, y), 0.05, 0.08));
      B.add('steel', cylBetween(PP(a, R_CL, y - 0.75), PP(a, R_SO - 0.08, y - 0.03), 0.022, 6));
    }
  }
  function platform(B, a0, a1, rIn, y, top) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    B.add('grate', sectorGrate(rIn, R_SO, lo, hi, y - 0.012));
    B.add('steel', new THREE.CylinderGeometry(R_SO, R_SO, 0.15, 16, 1, true, lo, hi - lo), T(0, y + 0.065, 0));
    B.add('steel', new THREE.CylinderGeometry(R_SO, R_SO, 0.12, 16, 1, true, lo, hi - lo), T(0, y - 0.07, 0));
    if (!top) B.add('steel', new THREE.CylinderGeometry(rIn, rIn, 0.27, 16, 1, true, lo, hi - lo), T(0, y - 0.005, 0));
    B.add('steel', arcTube(R_SO, lo, hi, y + 1.0, y + 1.0, 0.022)); B.add('steel', arcTube(R_SO, lo, hi, y + 0.5, y + 0.5, 0.012));
    for (const a of [lo, (lo + hi) / 2, hi]) B.add('steel', new THREE.BoxGeometry(0.04, 1.0, 0.04), radF(a, R_SO, y + 0.5));
    for (const a of [lo + 0.02, (lo + hi) / 2, hi - 0.02]) {
      B.add('steel', boxBetween(PP(a, R_CL, y - 0.08), PP(a, R_SO, y - 0.08), 0.06, 0.1));
      B.add('steel', cylBetween(PP(a, R_CL, y - 0.9), PP(a, R_SO - 0.1, y - 0.12), 0.025, 6));
    }
    if (top) {   // боковое ограждение верхней площадки (со стороны a = lo)
      const p0 = PP(lo, R_E - 0.07, y), p1 = PP(lo, R_SO, y);
      for (const h of [0.5, 1.0]) B.add('steel', cylBetween(p0.clone().setY(y + h), p1.clone().setY(y + h), h > 0.6 ? 0.022 : 0.012, 8));
      B.add('steel', new THREE.BoxGeometry(0.04, 1.0, 0.04), radF(lo, R_E - 0.07, y + 0.5));
      B.add('steel', boxBetween(p0.clone().setY(y + 0.07), p1.clone().setY(y + 0.07), 0.005, 0.15));
    }
  }
  function walkway(B, aW = A_WALK) {   // переход по кровле к оборудованию (ограждение с одной стороны)
    const m = RY(aW), z0 = 1.3, z1 = R_E - 0.4, w = 0.35, yy = z => roofY(z) + 0.1;
    B.add('grate', geoOf([-w, yy(z0), z0, w, yy(z0), z0, -w, yy(z1), z1, w, yy(z1), z1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [-w / 0.1, z0 / 0.1, w / 0.1, z0 / 0.1, -w / 0.1, z1 / 0.1, w / 0.1, z1 / 0.1], [0, 2, 1, 1, 2, 3]), m);
    for (const s of [-1, 1]) {
      const x = s * (w + 0.02);
      B.add('steel', boxBetween(V(x, yy(z0) - 0.03, z0), V(x, yy(z1) - 0.03, z1), 0.03, 0.1), m);
      const np = Math.ceil((z1 - z0) / 1.0);
      for (let j = 0; j <= np; j++) {
        const z = z0 + (z1 - z0) * j / np;
        B.add('steel', new THREE.BoxGeometry(0.05, 0.12, 0.05), mul(m, T(x, roofY(z) + 0.04, z)));
        if (s > 0) B.add('steel', new THREE.BoxGeometry(0.04, 1.0, 0.04), mul(m, T(x, yy(z) + 0.5, z)));
      }
      if (s > 0) for (const h of [0.5, 1.0]) B.add('steel', cylBetween(V(x, yy(z0) + h, z0), V(x, yy(z1) + h, z1), h > 0.6 ? 0.022 : 0.012, 8), m);
    }
  }

  /* ---------- v0.21: шахтная лестница РВС (ТЗ на проектирование РВС-1000, 222.pdf л. 21: «лестница — шахтная») ----------
     Положение — площадка ГП-003 на СВ: 4 фундамента 0,7×0,7 м с шагом 1,75 м (центр A_PAD/R_PAD) — подтверждено.
     Конструкция условная (КМ резервуара в документации нет): решётчатая шахта 1,75×1,75 м по осям фундаментов,
     марши шириной 0,8 м вокруг шахты (≈45°, ступени ≈0,2 м), угловые площадки, верхняя площадка и переходный мостик на кровлю. */
  const SH_C = 0.875, SH_W = 0.8, SH_GAP = 0.1;
  function shaftLadder(B, m, g) {
    const c = SH_C, w = SH_W, o = c + w, Z = R_PAD;
    const W = (x, y, dz) => V(x, y, Z + dz).applyMatrix4(m);
    const quad = (p00, p10, p01, p11, key = 'grate') => {   // четырёхугольник с нормалью вверх (опора для обхода)
      const pos = [p00, p10, p01, p11].flatMap(p => [p.x, p.y, p.z]);
      const u = p10.clone().sub(p00), v = p01.clone().sub(p00), up = new THREE.Vector3().crossVectors(v, u).y > 0;
      const uvs = [p00, p10, p01, p11].flatMap(p => [p.x / 0.1, p.z / 0.1]);
      B.add(key, geoOf(pos, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], uvs, up ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]));
    };
    const rect = (x0, x1, d0, d1, y, key) => quad(W(x0, y, d0), W(x1, y, d0), W(x0, y, d1), W(x1, y, d1), key);
    const rail = (a, b, r = 0.022) => B.add('steel', cylBetween(a, b, r, 8));
    const post = (x, dz, y0, h = 1.0) => B.add('steel', boxBetween(W(x, y0, dz), W(x, y0 + h, dz), 0.045, 0.045));
    const guard = (x0, d0, x1, d1, y) => {   // ограждение 1,0 м: поручень, средний пояс, бортовая полоса, стойки
      rail(W(x0, y + 1.0, d0), W(x1, y + 1.0, d1)); rail(W(x0, y + 0.5, d0), W(x1, y + 0.5, d1), 0.012);
      B.add('steel', boxBetween(W(x0, y + 0.07, d0), W(x1, y + 0.07, d1), 0.005, 0.14));
      const L = Math.hypot(x1 - x0, d1 - d0), np = Math.max(1, Math.ceil(L / 1.0));
      for (let i = 0; i <= np; i++) post(x0 + (x1 - x0) * i / np, d0 + (d1 - d0) * i / np, y);
    };
    // сторона k: 0 — к резервуару (dz < 0), 1 — по +x, 2 — наружу, 3 — по −x; t — вдоль марша от начала, u — расстояние от оси шахты
    const sp = (k, t, u) => k === 0 ? [-c + t, -u] : k === 1 ? [u, -c + t] : k === 2 ? [c - t, u] : [-u, c - t];
    const CORNER = [[-1, -1], [1, -1], [1, 1], [-1, 1]];   // угол в конце марша k — CORNER[(k + 1) % 4]
    const nF = Math.max(5, Math.round((Y_TOP - g(0, Z) - 0.04) / 1.75));
    const k0 = ((3 - (nF - 1)) % 4 + 4) % 4;                 // последний марш — по стороне 3, выход на верхнюю площадку со стороны резервуара
    const [sx0, sz0] = sp(k0, 0, c + w / 2), yS0 = g(sx0, Z + sz0) + 0.04, H = Y_TOP - yS0, hF = H / nF;
    const n = Math.max(6, Math.round(hF / 0.2)), rise = hF / n, run = 2 * c, td = run / (n - 1);
    for (let i = 0; i < nF; i++) {
      const k = (k0 + i) % 4, yS = yS0 + i * hF, yE = yS + hF;
      for (let j = 1; j < n; j++) {                           // ступени — решётчатый настил
        const t0 = (j - 1) * td + 0.01, t1 = j * td + 0.01, y = yS + j * rise - 0.012;
        const a = sp(k, t0, c + 0.03), b = sp(k, t1, c + 0.03), a2 = sp(k, t0, o - 0.03), b2 = sp(k, t1, o - 0.03);
        quad(W(a[0], y, a[1]), W(b[0], y, b[1]), W(a2[0], y, a2[1]), W(b2[0], y, b2[1]));
        const e0 = sp(k, t1 - 0.005, c + 0.03), e1 = sp(k, t1 - 0.005, o - 0.03);
        B.add('steel', boxBetween(W(e0[0], y - 0.02, e0[1]), W(e1[0], y - 0.02, e1[1]), 0.03, 0.03));
      }
      for (const u of [c + 0.02, o - 0.02]) {                 // косоуры
        const a = sp(k, -0.02, u), b = sp(k, run + 0.02, u);
        B.add('steel', boxBetween(W(a[0], yS - 0.06, a[1]), W(b[0], yE - 0.06, b[1]), 0.012, 0.2));
      }
      { const a = sp(k, 0, o), b = sp(k, run, o), am = sp(k, c, o);  // наружное ограждение марша
        rail(W(a[0], yS + 1.0, a[1]), W(b[0], yE + 1.0, b[1])); rail(W(a[0], yS + 0.5, a[1]), W(b[0], yE + 0.5, b[1]), 0.012);
        post(a[0], a[1], yS); post(am[0], am[1], (yS + yE) / 2); post(b[0], b[1], yE);
        const ai = sp(k, 0, c + 0.03), bi = sp(k, run, c + 0.03);       // поручень у шахты
        rail(W(ai[0], yS + 0.95, ai[1]), W(bi[0], yE + 0.95, bi[1]), 0.02); }
      if (i < nF - 1) {                                       // угловая площадка
        const [qx, qz] = CORNER[(k + 1) % 4], x0 = qx < 0 ? -o : c, x1 = qx < 0 ? -c : o, d0 = qz < 0 ? -o : c, d1 = qz < 0 ? -c : o;
        rect(x0, x1, d0, d1, yE - 0.012);
        B.add('steel', boxBetween(W(x0, yE - 0.07, qz * o), W(x1, yE - 0.07, qz * o), 0.05, 0.12));
        B.add('steel', boxBetween(W(qx * o, yE - 0.07, d0), W(qx * o, yE - 0.07, d1), 0.05, 0.12));
        guard(qx * o, qz * c, qx * o, qz * o, yE); guard(qx * c, qz * o, qx * o, qz * o, yE);
        B.add('steel', cylBetween(W(qx * c, yE - 0.9, qz * c), W(qx * (o - 0.06), yE - 0.09, qz * (o - 0.06)), 0.024, 6));   // подкос от стойки шахты
      }
    }
    // верхняя площадка (сторона 0 целиком, Y_TOP) и переходный мостик на кровлю
    rect(-o, o, -o, -c, Y_TOP - 0.012);
    B.add('steel', boxBetween(W(-o, Y_TOP - 0.07, -o), W(o, Y_TOP - 0.07, -o), 0.05, 0.12));
    B.add('steel', boxBetween(W(-o, Y_TOP - 0.07, -c), W(o, Y_TOP - 0.07, -c), 0.05, 0.12));
    const bw = 0.42, dzR = R_E - 0.4 - Z;
    guard(-o, -o, -bw, -o, Y_TOP); guard(bw, -o, o, -o, Y_TOP);
    guard(-o, -o, -o, -c, Y_TOP); guard(o, -o, o, -c, Y_TOP); guard(c, -c, o, -c, Y_TOP);
    rect(-bw + 0.02, bw - 0.02, dzR, -o + 0.01, Y_TOP - 0.012);
    for (const s of [-1, 1]) {
      B.add('steel', boxBetween(W(s * bw, Y_TOP - 0.06, dzR), W(s * bw, Y_TOP - 0.06, -o), 0.03, 0.14));
      guard(s * bw, -o, s * bw, dzR + 0.25, Y_TOP);
    }
    // решётчатая шахта: 4 стойки по осям фундаментов, обвязка на уровнях площадок, диагональные связи
    const yTie = [];
    for (let i = 1; i <= nF; i++) yTie.push(yS0 + i * hF - 0.07);
    yTie.push(Y_TOP + 0.5, Y_TOP + 1.0);
    const CP = [[-c, -c], [c, -c], [c, c], [-c, c]];
    for (const [x, dz] of CP) {
      const yb = g(x, Z + dz) + 0.15;
      B.add('dark', new THREE.BoxGeometry(0.32, 0.02, 0.32), mul(m, T(x, yb + 0.01, Z + dz)));
      B.add('steel', boxBetween(W(x, yb, dz), W(x, Y_TOP + 1.05, dz), 0.1, 0.1));
    }
    let yPrev = Math.max(...CP.map(([x, dz]) => g(x, Z + dz))) + 0.3;
    yTie.forEach((y, li) => {
      for (let f = 0; f < 4; f++) {
        const [xa, da] = CP[f], [xb, db] = CP[(f + 1) % 4];
        B.add('steel', boxBetween(W(xa, y, da), W(xb, y, db), 0.06, 0.08));
        if (li < nF && y - yPrev > 0.6) { const s = (li + f) % 2; B.add('steel', cylBetween(W(s ? xa : xb, yPrev + 0.05, s ? da : db), W(s ? xb : xa, y - 0.05, s ? db : da), 0.016, 6)); }
      }
      yPrev = y;
    });
    const mid = V(0, (yS0 + Y_TOP) / 2, Z).applyMatrix4(m);
    return { nF, n, rise, hF, w, yS0, mid: [mid.x, mid.y, mid.z] };
  }

  /* ---------- по резервуару: обвязка до трасс ГП-005, стояки ПВ/пенораствора, Гу, отмостка, трафарет ---------- */
  const isNear = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) < r;
  function netEnds(k, cx, cz) {   // концы трасс сети k у резервуара (из ГП-005)
    const out = [];
    for (const s of NETS[k] || []) for (const [x, z] of [[s[0], s[1]], [s[2], s[3]]]) if (isNear(x, z, cx, cz, 8.6)) out.push([x, z, Math.hypot(x - cx, z - cz)]);
    return out;
  }
  function buildTank(B, id, cx, cz, gy) {
    const hL = (x, z) => hAt(cx + x, cz + z) - gy, yNet = (x, z) => hL(x, z) + 0.6;
    const info = { flags: [] };
    // --- отводы ДТ(Л): концы трасс ГП-005 ---
    const dtl = netEnds('dtl', cx, cz).filter(p => p[2] > 7.5).map(p => ({ x: p[0] - cx, z: p[1] - cz, a: Math.atan2(p[0] - cx, p[1] - cz) })).sort((p, q) => p.a - q.a);
    const eOut = dtl[0] || { x: 8 * Math.sin(-0.575), z: 8 * Math.cos(-0.575) }, eIn = dtl[dtl.length - 1] || { x: 8 * Math.sin(-0.48), z: 8 * Math.cos(-0.48) };
    if (dtl.length < 2) info.flags.push('концы отводов ДТ(Л) на ГП-005 не найдены — положение условное');
    const line = (nz, e, rr) => {
      const rE = Math.hypot(e.x, e.z), aE = Math.atan2(e.x, e.z), y1 = yNet(e.x, e.z), rj = rr + 0.06;
      const p0 = PP(nz.a, nz.zOut, YN), p1 = PP(nz.a, nz.zOut + 0.14, YN), p2 = PP(nz.a, rE - 0.8, YN), p3 = PP(aE, rE - 0.45, y1), p4 = V(e.x, y1, e.z);
      B.add('pipe', cylBetween(p0, p1, rr, 16));
      run(B, 'galv', Math.abs(y1 - YN) < 0.04 ? [p1, p4] : [p1, p2, p3, p4], rj, 0.25, 18, true);
      const u = p2.clone().sub(p1).normalize(), pm = p1.clone().lerp(p2, 0.55);
      B.add('brown', cylBetween(pm.clone().addScaledVector(u, -0.15), pm.clone().addScaledVector(u, 0.15), rj + 0.004, 18, true));
      B.add('red', cylBetween(pm.clone().addScaledVector(u, 0.2), pm.clone().addScaledVector(u, 0.26), rj + 0.004, 18, true));
      const pf = p1.clone().lerp(p2, 0.25);   // сигнализатор потока FA
      B.add('alu', new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), T(pf.x, YN + rj + 0.05, pf.z));
      B.add('alu', new THREE.CylinderGeometry(0.028, 0.028, 0.05, 12), T(pf.x, YN + rj + 0.13, pf.z));
      const ps = p1.clone().lerp(p2, 0.85), gs = hL(ps.x, ps.z);   // опора
      B.add('conc', new THREE.BoxGeometry(0.4, YN - rj - gs + 0.2, 0.4), T(ps.x, (YN - rj + gs - 0.2) / 2, ps.z));
      B.add('steel', new THREE.BoxGeometry(0.3, 0.04, 0.3), T(ps.x, YN - rj - 0.02, ps.z));
      PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: 'dtl', r: rj, od: rr === VALVE[200].r ? 0.219 : 0.159, eqStart: `РВС-${id}: патрубок ⌀${rr === VALVE[200].r ? '219' : '159'}`, name: `Обвязка РВС-${id}: патрубок → задвижка → трасса ГП-005`, pts: (Math.abs(y1 - YN) < 0.04 ? [p0, p1, p4] : [p0, p1, p2, p3, p4]).map(v => v.toArray()), cf: { plan: 'P', elev: 'P', dn: 'V' } });
      return { p1, p2, aE, rE, rj };
    };
    const lo = line(NOZ.out, eOut, VALVE[200].r);
    line(NOZ.inp, eIn, VALVE[150].r);
    {   // второй отвод ⌀219 — врезка в основную линию
      // v0.26: отвод зачистки Ду150 (ТЗ, стенка, поз. 3; 109-ТХ-002 поз. 10, отвод поз. 29 — в линию раздачи Ду200 «в насосную», поз. 26); изоляция — 109-ТХ.ВТ
      const n2 = NOZ.out2, rj = VALVE[150].r + 0.06, q1 = PP(n2.a, n2.zOut + 0.14, YN), qA = PP(n2.a, 6.55, YN), qB = PP(NOZ.out.a, 7.05, YN);
      B.add('pipe', cylBetween(PP(n2.a, n2.zOut, YN), q1, VALVE[150].r, 16));
      run(B, 'galv', [q1, qA, qB], rj, 0.25, 18, true);
      PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: 'dtl', r: rj, od: 0.159, eqStart: `РВС-${id}: патрубок зачистки ⌀159`, name: `Обвязка РВС-${id}: отвод зачистки Ду150 (врезка в линию раздачи; 109-ТХ-002)`, pts: [PP(n2.a, n2.zOut, YN), q1, qA, qB].map(v => v.toArray()), cf: { plan: 'P', elev: 'P', dn: 'P' } });
    }
    // --- стояк противопожарного водопровода → кольцо орошения; стояк пенораствора → пенопровод ---
    const riser = (k, rr, yTop) => {
      const e = netEnds(k, cx, cz).sort((p, q) => p[2] - q[2])[0];
      const x = e ? e[0] - cx : (k === 'pv' ? 0.455 : -0.455);
      if (!e) info.flags.push(`подвод ${k} на ГП-005 не найден — стояк условный`);
      const zr = -Math.sqrt(rr * rr - x * x), zs = zr - 0.9, rpts = e ? [V(x, yNet(x, zr), zr), V(x, yTop, zr)] : [V(x, yNet(x, zs), zs), V(x, yNet(x, zr), zr), V(x, yTop, zr)];   // v0.13: при наличии трассы ГП-005 — без горизонтального участка (трасса подходит к основанию стояка)
      run(B, 'red', e && k === 'pv' ? [V(x, yNet(x, zr) + 3 * 0.0445, zr), V(x, yTop, zr)] : rpts, 0.0445, 0.15, 10);   // v0.14: у В2 — отвод у основания строит PGEO
      PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: k, r: 0.0445, od: 0.089, eqEnd: k === 'pv' ? `РВС-${id}: кольцо орошения` : `РВС-${id}: пеногенераторы`, name: `Стояк ${k === 'pv' ? 'В2 к кольцу орошения' : 'В10 к пеногенераторам'} РВС-${id}`, pts: rpts.map(v => v.toArray()), cf: { plan: 'P', elev: 'P', dn: 'P' } });
      for (let y = Y0 + 1.5; y < yTop - 0.4; y += 2.0) B.add('steel', boxBetween(V(x, y, -Math.sqrt(R_CL * R_CL - x * x)), V(x, y, zr), 0.03, 0.04));
      if (e) flangePairY(B, x, yNet(x, zr) + (k === 'pv' ? 3 * 0.0445 + 0.035 : 0.2), zr, 0.0445, 'red');   // v0.14: фланцевое соединение у основания стояка (условно)
      else B.add('red', new THREE.BoxGeometry(0.12, 0.12, 0.12), T(x, yNet(x, zr), zr));   // фланцевое соединение у основания (условно)
    };
    riser('pv', R_RING, Y_RING); riser('prp', R_FOAM, Y_FOAM);
    // --- газоуравнительная обвязка Гу: патрубок на кровле → огнепреградитель → опуск по стенке → отвод ГП-005 ---
    {
      const gu = netEnds('gu', cx, cz).sort((p, q) => p[2] - q[2])[0];
      const xg = gu ? gu[0] - cx : 0.34, zS = gu ? gu[1] - cz : 7.96;
      if (!gu) info.flags.push('отвод Гу у этого РВС на ГП-005 не показан — выполнен по аналогии с соседними (требует уточнения)');
      // v0.26: ГУС по 109-ТХ-002-0: патрубок ПМ-100 (ТЗ, крыша, поз. 13: A 4155, B 150) → отвод (поз. 30) → огнепреградитель ПО-100 (поз. 15) → кран шаровый Ду100 (поз. 14)
      // → отвод → опуск по стенке (поз. 28; опоры через 1000 / 4000 / 4000 от верха стенки +11,920) → отвод → горизонталь, низ трубы +2,200 → к трассе Гу ГП-005.
      // Горизонталь над крышей — +12,46 (обмер вида). Опуск у трассы ГП-005 — условно (152-ТК-003 в комплекте нет). До v0.26 — R 4,9 м, огнепреградитель на патрубке
      const rG = TZ.R13.A, zR = Math.sqrt(Math.max(0, rG * rG - xg * xg)), yR = roofY(rG), zW = Math.sqrt(5.62 * 5.62 - xg * xg), yS = yNet(xg, zS), yF = yR + TZ.R13.B - T_INS;
      const yH = Y0 + 12.46, yL = Y0 + 2.2 + 0.054;
      B.tag = 'R13';
      B.add('pipe', cylBetween(V(xg, yR - T_INS, zR), V(xg, yF - 0.02, zR), 0.054, 12));
      B.add('galvS', new THREE.CylinderGeometry(0.115, 0.14, 0.025, 18), T(xg, yR + 0.012, zR));   // оклад изоляции крыши
      B.add('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.022, 14), T(xg, yF - 0.011, zR));     // фланец ПМ-100 и ответный
      B.add('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.022, 14), T(xg, yF + 0.013, zR));
      const z1 = Math.max(zW + 0.6, zS - 0.5);   // опуск к отметке трассы — у её конца, вход в трассу соосно (условно)
      const guPts = [V(xg, yF + 0.025, zR), V(xg, yH, zR), V(xg, yH, zW), V(xg, yL, zW), V(xg, yL, z1), V(xg, yS, z1), V(xg, yS, zS)];
      run(B, 'pipe', guPts, 0.054, 0.16, 12);
      guPO(B, V(xg, yH, zR + 0.45)); guBall(B, V(xg, yH, zR + 0.98));
      B.tag = null;
      PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: 'gu', r: 0.054, od: 0.108, eqStart: `РВС-${id}: патрубок ГУС ПМ-100 на крыше (ТЗ, поз. 13)`, name: `Гу РВС-${id}: ПМ-100 → ПО-100 → кран Ду100 → опуск по стенке → +2,200 → трасса ГП-005 (109-ТХ-002-0)`, pts: guPts.map(v => v.toArray()), cf: { plan: gu ? 'P' : 'R', elev: 'P', dn: 'V' } });
      for (const y of [Y0 + 10.92, Y0 + 6.92, Y0 + 2.92]) { B.add('steel', boxBetween(V(xg, y, Math.sqrt(R_CL * R_CL - xg * xg)), V(xg, y, zW - 0.06), 0.06, 0.05)); B.add('dark', new THREE.TorusGeometry(0.062, 0.008, 6, 14).rotateX(Math.PI / 2), T(xg, y, zW)); }   // опоры ГУС по ТХ-002: 1000 / 4000 / 4000 от верха стенки
      B.add('yel', cylBetween(V(xg, yL + 0.9, zW), V(xg, yL + 1.0, zW), 0.058, 12, true));
      if (!gu) {   // недостающий отвод и разрыв коллектора Гу на чертеже — по аналогии (условно)
        const zc = -2.15 - cz;
        run(B, 'pipe', [V(xg, yS, zS), V(xg, yNet(xg, zc), zc)], 0.054, 0.1, 12);
        PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: 'gu', r: 0.054, od: 0.108, name: `Гу РВС-${id}: отвод к коллектору (по аналогии — на ГП-005 не показан)`, pts: [V(xg, yS, zS), V(xg, yNet(xg, zc), zc)].map(v => v.toArray()), cf: { plan: 'R', elev: 'P', dn: 'V' } });
        const xs = (NETS.gu || []).flatMap(s => [[s[0], s[1]], [s[2], s[3]]]).filter(p => Math.abs(p[1] + 2.15) < 0.02).map(p => p[0] - cx);
        const l = Math.max(...xs.filter(v => v < xg)), r = Math.min(...xs.filter(v => v > xg));
        if (isFinite(l) && isFinite(r) && r - l > 0.5 && r - l < 5) for (const [xa, xb] of [[l, xg], [xg, r]]) { B.add('pipe', cylBetween(V(xa, yNet(xa, zc), zc), V(xb, yNet(xb, zc), zc), 0.054, 12)); PIPEREG.push({ gen: 'RVSD', local: true, cx, cz, gy, net: 'gu', r: 0.054, od: 0.108, name: `Гу: восполнение разрыва коллектора у РВС-${id} (по аналогии — требует уточнения)`, pts: [V(xa, yNet(xa, zc), zc), V(xb, yNet(xb, zc), zc)].map(v => v.toArray()), cf: { plan: 'R', elev: 'P', dn: 'V' } }); }
      }
    }
    // --- площадка у лестницы на СВ: по ГП-003 — мощение ≈4,5×4,5 м и 4 фундамента 0,7×0,7 м с шагом 1,75 м (назначение — требует уточнения по КМ/КЖ) ---
    {
      const m = radF(A_PAD, 0, 0), g = (x, z) => { const p = V(x, 0, z).applyMatrix4(m); return hL(p.x, p.z); };
      const n = 6, x0 = -2.25, x1 = 2.25, z0 = R_F + 0.95, z1 = R_PAD + 2.25, pos = [], nor = [], uv = [], idx = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * j / n; pos.push(x, g(x, z) + 0.04, z); nor.push(0, 1, 0); uv.push(x / 1.5, z / 1.5); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * (n + 1) + i; idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2); }
      B.add('asph', geoOf(pos, nor, uv, idx), m);
      for (const dx of [-0.875, 0.875]) for (const dz of [-0.875, 0.875]) {
        const x = dx, z = R_PAD + dz, y = g(x, z);
        B.add('conc', new THREE.BoxGeometry(0.7, 0.5, 0.7), mul(m, T(x, y - 0.1, z)));
      }
      info.lad = shaftLadder(B, m, g);   // v0.21: шахтная лестница на площадке ГП-003
    }
    // --- отмостка по рельефу ---
    {
      const n = 96, r0 = R_F, r1 = R_F + 1.0, pos = [], nor = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
        const yi = Math.max(0.1, hL(r0 * s, r0 * c) + 0.04), yo = hL(r1 * s, r1 * c) + 0.02;
        pos.push(r0 * s, yi, r0 * c, r1 * s, yo, r1 * c, (r1 + 0.02) * s, yo - 0.45, (r1 + 0.02) * c);
        nor.push(0, 1, 0, 0, 1, 0, s, 0, c);
        uv.push(a * r0 / 1.5, 0, a * r1 / 1.5, 0.67, a * r1 / 1.5, 1);
      }
      for (let i = 0; i < n; i++) { const k = i * 3; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4); }
      B.add('asph', geoOf(pos, nor, uv, idx));
    }
    return info;
  }
  function stencil(id) {   // маркировка на стенке (номер, продукт, объём, «Огнеопасно»)
    const c = cnv(1024, 576, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(28,31,34,.9)'; x.font = 'bold 200px Arial, "DejaVu Sans", sans-serif'; x.fillText('РВС-' + id, w / 2, 160);
      x.font = 'bold 84px Arial, "DejaVu Sans", sans-serif'; const t2 = 'ДТ летнее · V = 1000 м', w2 = x.measureText(t2).width;
      x.textAlign = 'left'; x.fillText(t2, (w - w2 - 40) / 2, 330); x.font = 'bold 50px Arial, "DejaVu Sans", sans-serif'; x.fillText('3', (w - w2 - 40) / 2 + w2 + 4, 306); x.textAlign = 'center';
      x.fillStyle = 'rgba(170,35,28,.92)'; x.font = 'bold 100px Arial, "DejaVu Sans", sans-serif'; x.fillText('ОГНЕОПАСНО', w / 2, 470);
    });
    const t = tex(c, 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0.2, envMap: envTex, envMapIntensity: 0.6 });
    const me = new THREE.Mesh(new THREE.CylinderGeometry(R_CL + 0.012, R_CL + 0.012, 2.4, 40, 1, true, A_ST - W_ST / 2, W_ST), m);
    me.position.y = 8.3; me.renderOrder = 1; return me;
  }

  /* ---------- сборка ---------- */
  const B0 = Bucket(), B0o = Bucket(), B0q = Bucket(); buildBody(B0, B0o, B0q);
  const SH = {}, SHR = {}; for (const [k, l] of Object.entries(B0.b)) { SHR[k] = tagRanges(l, B0.tg[k]); SH[k] = merge(l); }
  const SHQ = {}; for (const [k, l] of Object.entries(B0q.b)) SHQ[k] = merge(l);   // v0.26: прежнее условное оборудование крыши и стенки
  const SHO = {}; for (const [k, l] of Object.entries(B0o.b)) SHO[k] = merge(l);   // v0.21: прежняя кольцевая лестница
  const stemGeo = new THREE.CylinderGeometry(0.016, 0.016, STEM_LEN, 8);
  const groups = [], old = [], byId = {}, stems = [], ind = {}, ladOld = [], eqOld = [];
  for (const [id, pxy] of Object.entries(LIST)) {
    const o = OBJ.find(q => q.id === id); if (!o) continue;
    const [cx, cz] = P(...pxy), gy = o.g.position.y;
    const g = new THREE.Group(); g.name = 'rvsDetail ' + id;
    const Bt = Bucket(), info = buildTank(Bt, id, cx, cz, gy);
    const addMesh = (geo, key, R) => {
      const me = new THREE.Mesh(geo, MAT[key]); me.position.set(cx, 0, cz); me.castShadow = me.receiveShadow = key !== 'asph';
      const pk = pickBy(R, o, id); if (pk) { me.userData.pick = pk; me.userData.tzR = R; }   // v0.26: клик по позиции ТЗ — карточка позиции
      if (key === 'asph') me.receiveShadow = true;
      me.userData.o = o; me.userData.noCut = !CUT_KEYS.has(key); pickables.push(me); g.add(me);
      if (key === 'bolt') FAST_LOD.push(me);
    };
    for (const [k, geo] of Object.entries(SH)) addMesh(geo, k, SHR[k]);
    for (const [k, l] of Object.entries(Bt.b)) { const R = tagRanges(l, Bt.tg[k]); addMesh(merge(l), k, R); }
    { const lo = new THREE.Group(); lo.name = 'РВС ' + id + ': прежняя кольцевая лестница (до v0.21)';   // слой сравнения «rvslad»
      for (const [k, geo] of Object.entries(SHO)) { const me = new THREE.Mesh(geo, MAT[k]); me.position.set(cx, 0, cz); me.castShadow = me.receiveShadow = true; me.userData.o = o; me.userData.noCut = !CUT_KEYS.has(k); lo.add(me); }
      g.add(lo); ladOld.push(lo); }
    { const qo = new THREE.Group(); qo.name = 'РВС ' + id + ': прежнее условное оборудование крыши и стенки (до v0.26)'; qo.visible = false;   // слой сравнения «rvseqold»
      for (const [k, geo] of Object.entries(SHQ)) { const me = new THREE.Mesh(geo, MAT[k]); me.position.set(cx, 0, cz); me.castShadow = me.receiveShadow = true; me.userData.o = o; me.userData.noCut = true; qo.add(me); }
      g.add(qo); eqOld.push(qo); }
    const st = stencil(id); st.position.x = cx; st.position.z = cz; st.userData.o = o; pickables.push(st); g.add(st);
    // шпиндели задвижек: положение «открыто/закрыто» по состоянию в технологической модели
    const im = new THREE.InstancedMesh(stemGeo, MAT.galv, 3); im.position.set(cx, 0, cz); im.castShadow = true;
    const vids = ['РВС-' + id + '-В', 'РВС-' + id + '-П', null];
    [NOZ.out, NOZ.inp, NOZ.out2].forEach((nz, i) => {
      const s = { im, i, vm: nz.vm, yw: nz.yw, stroke: nz.stroke, vid: vids[i], k: vids[i] ? 0 : 1 };
      im.setMatrixAt(i, stemMatrix(s.vm, s.yw, s.stroke, s.k)); stems.push(s);
      if (vids[i]) { const p = new THREE.Vector3(0, s.yw + s.stroke + 0.32, 0).applyMatrix4(s.vm); ind[vids[i]] = [cx + p.x, gy + p.y, cz + p.z]; }
    });
    im.userData.pick = h => { const vid = vids[h.instanceId]; return vid && typeof procValveObj === 'function' ? procValveObj(vid) : o; };
    pickables.push(im); g.add(im);
    o.rvsD = g; o.rvsInfo = info; byId[id] = g; groups.push(g);
  }
  function ladPos(id) {   // v0.21: середина шахтной лестницы в мировых координатах (для перелёта камеры)
    const o = OBJ.find(q => q.id === id), g = byId[id]; if (!o || !g || !o.rvsInfo || !o.rvsInfo.lad) return null;
    const [cx, cz] = P(...LIST[id]), m = o.rvsInfo.lad.mid, v = new THREE.Vector3(cx + m[0], m[1], cz + m[2]);
    g.updateWorldMatrix(true, false); g.localToWorld(v); return [v.x, v.y, v.z];
  }
  let tPrev = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - (tPrev || now)) / 1000); tPrev = now;
    if (typeof procLogic === 'undefined') return;
    for (const s of stems) {
      if (!s.vid) continue;
      const tgt = window.__VPOS ? window.__VPOS(s.vid, procLogic.st.valve[s.vid] ? 1 : 0) : (procLogic.st.valve[s.vid] ? 1 : 0);
      if (Math.abs(tgt - s.k) < 1e-3) continue;
      s.k += Math.sign(tgt - s.k) * Math.min(Math.abs(tgt - s.k), dt / 1.6);   // ход шпинделя ≈1,6 с (визуально)
      s.im.setMatrixAt(s.i, stemMatrix(s.vm, s.yw, s.stroke, s.k)); s.im.instanceMatrix.needsUpdate = true;
    }
  }
  const NOTE = o => {
    const fl = (o.rvsInfo && o.rvsInfo.flags.length) ? `<br><b>Расхождения:</b> ${o.rvsInfo.flags.join('; ')}.` : '';
    return `<b>Детальная модель РВС-1000 (этап 6.1).</b><br>` +
      `<b>v0.26 — по ТЗ на РВС-1000 (222.pdf, л. 21–23) и комплекту 109-ТХ (ТХ-002, ТХ.С, ТХ-001, ТХ.ВТ):</b> теплоизоляция стенки и крыши 80 мм, облицовка — сталь тонколистовая (гладкие листы рядами 1,5 м); ` +
      `люки и патрубки стенки (9) и крыши (13) — по углам и размерам ТЗ и ТХ-002: ЛЩ-500 × 3, КДС2-1500Л × 2 со встроенными огнепреградителями, ЛЗ-150 на ПЗЛ-150, радарный уровнемер, 4 тепловых извещателя, LSA H, ` +
      `ГУС (ПО-100, кран Ду100, опуск по стенке на +2,200), ЛЛ-600 и ЛЛ 600/900, КИП Ду50 × 2, патрубок зачистки Ду150, КС-80 с задвижкой, ПСР, МУ-I × 2; задвижки — в утеплённых кожухах; молниеприёмник H 11 000 (верх +22,920). ` +
      `Нажмите на люк, патрубок или прибор — откроется карточка позиции.<br>` +
      `<b>v0.21:</b> лестница шахтная (ТЗ) — на площадке ГП-003; конструкция шахты условная (КМ нет). По ТХ-002 ось 0° проходит через лестницу, в модели — 3,4° от неё.<br>` +
      `<b>По документации:</b> Dвн 10,43 м, Нст 12,0 м, крыша коническая щитовая, LSA H 10 800 / L 700 мм, LT 700…10 700, TT (АК-004 л. 6; ТЗ); ` +
      `лестница на СВ (ГП-003); отводы ДТ(Л), Гу, подводы противопожарного водопровода и пенораствора (ГП-005).<br>` +
      `<b>Условно (требует уточнения по КМ, паспортам изделий, фото):</b> подъём кровли 0,6 м, конструкция шахтной лестницы, габариты 30с41нж, КДС2-1500Л, ПО-100, КС-80, МУ-I, ПСР, ` +
      `модели приборов КИП, ширина листа облицовки, высота ПСР и МУ-I, опуск ГУС у трассы (152-ТК-003 нет), положение ГПСС-600, кольцо орошения, заземление. ` +
      `Задвижка зачистки в технологической модели не участвует (считается открытой).` + fl;
  };
  function attach(o, gM) {
    if (!byId[o.id]) return;
    for (const ch of [...gM.children]) { ch.visible = false; old.push(ch); }
    gM.add(byId[o.id]);
    Object.defineProperty(o, 'mnote', { configurable: true, get: () => (byId[o.id].visible ? NOTE(o) : MN.rvs), set: () => {} });
  }
  function fallback() {   // модели «Цифрового склада» не загрузились — детальные РВС всё равно показываем
    for (const id of Object.keys(byId)) { const o = OBJ.find(q => q.id === id); if (!o || o.gM) continue; const gM = new THREE.Group(); o.g.add(gM); o.gM = gM; attach(o, gM); }
  }
  return {
    groups, old, ladOld, eqOld, ladPos, ind, tick, attach, fallback, has: id => !!byId[id], Y_BOT: Y0 + 0.015,
    TZ, TZ0, tzA, itemObj, roofY, Y_0: Y0, R_CL, topOf: id => { const o = OBJ.find(q => q.id === id); if (!o || !LIST[id]) return null; const [cx, cz] = P(...LIST[id]); return [cx, o.g.position.y + YT + RISE, cz]; },   // v0.26
    kit: { V, T, RY, RX, RZ, mul, cylBetween, boxBetween, run, geoOf, merge, MAT, envTex, cnv, tex },   // v0.20: для детальной модели РГС-75 (RGSD)
    on: o => !!(o.rvsD && o.rvsD.visible)
  };
})();
