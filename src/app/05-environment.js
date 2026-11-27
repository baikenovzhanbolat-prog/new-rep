/* ---------- Этап v0.10: покрытия и окружение ----------
   1) Рельеф: к текстуре покрытий ГП-003 добавлена мелкая и крупная фактура (зерно асфальта, разводы, трава);
      за пределами листа ГП-003 — газон, а не растянутые края текстуры.
   2) За рельефом — луг до горизонта (плавно от края рельефа), сопки на горизонте, деревья вне территории.
      ВСЁ ЗА ОГРАЖДЕНИЕМ — ДЕКОРАТИВНО: реальная застройка и рельеф вокруг склада в проектных материалах не показаны. */
const ENV = (() => {
  /* карта деталей: R — мелкий шум, G — средний, B — крупный (данные, без гамма-коррекции) */
  const det = (() => {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), im = x.createImageData(s, s);
    const A = MATX.N.N1, B = MATX.N.N2, C = MATX.N.N3;
    for (let i = 0; i < s * s; i++) { im.data[i * 4] = A[i] * 255; im.data[i * 4 + 1] = B[i] * 255; im.data[i * 4 + 2] = C[i] * 255; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t;
  })();
  const GRASS = new THREE.Color(0xa8b38b);   // как поле листа ГП-003 за территорией
  const DETAIL = `
    vec3 c0 = diffuseColor.rgb;
    #ifdef USE_MAP
      if (vMapUv.x < 0.002 || vMapUv.x > 0.998 || vMapUv.y < 0.002 || vMapUv.y > 0.998) c0 = uGrass;   // вне листа ГП-003 — газон
    #endif
    float lum = dot(c0, vec3(0.299, 0.587, 0.114));
    float gr = clamp((c0.g - max(c0.r, c0.b)) * 9.0, 0.0, 1.0);
    float n1 = texture2D(uDet, vWP.xz * 0.37).r, n2 = texture2D(uDet, vWP.xz * 0.061).g, n3 = texture2D(uDet, vWP.xz * 0.011).b, gn = texture2D(uDet, vWP.xz * 2.3).r;
    vec3 cc = c0;
    cc *= mix(1.0, 0.84 + 0.32 * n1, 0.55);
    cc *= 0.9 + 0.2 * n2;
    cc *= 0.95 + 0.1 * n3;
    cc *= mix(1.0, 0.8 + 0.4 * gn, (1.0 - gr) * smoothstep(0.55, 0.1, lum) * 0.6);                 // зерно асфальта/бетона
    cc = mix(cc, cc * vec3(0.9, 0.9, 0.62) * (0.84 + 0.3 * n1) + vec3(0.02, 0.016, 0.0) * (n2 - 0.4), gr * 0.85);   // трава: темнее, пятна, оттенок
    diffuseColor.rgb = cc;`;
  function patchTerrain(m) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = sh => {
      prev(sh);
      sh.uniforms.uDet = { value: det }; sh.uniforms.uGrass = { value: GRASS };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDet; uniform vec3 uGrass;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{' + DETAIL + '}');
    };
    m.needsUpdate = true;
  }
  patchTerrain(TERR.material);
  TERR.material.roughness = 0.95;

  /* ---------- луг до горизонта: кольца от края рельефа до R = 4000 м ---------- */
  const X0 = TER.x0 + 0.6, Z0 = TER.z0 + 0.6, X1 = TER.x0 + (TER.nx - 1) * TER.st - 0.6, Z1 = TER.z0 + (TER.nz - 1) * TER.st - 0.6;
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, RAILZ = [P(0, 3575.5)[1], P(0, 3695)[1]];
  const B = [];   // граница рельефа по часовой, шаг 2,5 м
  const pushL = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2.5); for (let i = 0; i < n; i++) B.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); };
  pushL(X0, Z0, X1, Z0); pushL(X1, Z0, X1, Z1); pushL(X1, Z1, X0, Z1); pushL(X0, Z1, X0, Z0);
  const FR = [0, 0.004, 0.012, 0.03, 0.05, 0.075, 0.1, 0.13, 0.17, 0.22, 0.3, 0.45, 0.7, 1.0], RO = 4000;
  let base = 0; for (const [x, z] of B) base += hAt(x, z); base /= B.length;
  const nb = B.length, nr = FR.length, pos = new Float32Array(nb * nr * 3), idx = [];
  const hill = (x, z) => { const d = Math.hypot(x - cx, z - cz); const k = THREE.MathUtils.smoothstep(d, 260, 900); return k * (6 * Math.sin(x * 0.004 + 1.3) * Math.cos(z * 0.0035) + 3 * Math.sin((x + z) * 0.009)); };
  for (let r = 0; r < nr; r++) for (let i = 0; i < nb; i++) {
    const [bx, bz] = B[i], a = Math.atan2(bz - cz, bx - cx), ox = cx + Math.cos(a) * RO, oz = cz + Math.sin(a) * RO, f = FR[r];
    const x = bx + (ox - bx) * f, z = bz + (oz - bz) * f;
    let y = r === 0 ? hAt(bx, bz) - 0.04 : THREE.MathUtils.lerp(hAt(bx, bz), base, Math.min(1, f * 12)) - 0.04 + hill(x, z);
    if (r > 0) { const dz = Math.min(Math.abs(z - RAILZ[0]), Math.abs(z - RAILZ[1])); y = THREE.MathUtils.lerp(RELIEF17.CORR - 0.04, y, THREE.MathUtils.smoothstep(dz, 6, 30)); /* v0.17: полоса пути — на 0,45 м ниже головки рельса */ }
    pos.set([x, y, z], (r * nb + i) * 3);
  }
  for (let r = 0; r < nr - 1; r++) for (let i = 0; i < nb; i++) { const a = r * nb + i, b = r * nb + (i + 1) % nb, c = a + nb, d = b + nb; idx.push(a, b, c, b, d, c); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setIndex(idx); mg.computeVertexNormals();
  const meadowM = new THREE.MeshStandardMaterial({ color: GRASS, roughness: 0.97 });
  meadowM.onBeforeCompile = sh => {
    sh.uniforms.uDet = { value: det };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D uDet;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float n1 = texture2D(uDet, vWP.xz * 0.37).r, n2 = texture2D(uDet, vWP.xz * 0.05).g, n3 = texture2D(uDet, vWP.xz * 0.006).b;
          diffuseColor.rgb *= vec3(0.9, 0.9, 0.62) * (0.84 + 0.3 * n1) * (0.88 + 0.24 * n2) * (0.9 + 0.2 * n3);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.04, 0.78), smoothstep(0.45, 0.75, n3) * 0.6); }`);
  };
  const meadow = new THREE.Mesh(mg, meadowM); meadow.receiveShadow = true; meadow.name = 'луг (декоративно)'; scene.add(meadow);
  ground.visible = false;   // прежняя плоскость под рельефом больше не видна

  /* ---------- сопки на горизонте (декоративно; Усть-Каменогорск — предгорья Алтая) ---------- */
  const hills = new THREE.Group(); hills.name = 'сопки (декоративно)'; scene.add(hills);
  {
    const N = 360, rows = [[1750, 70, 0x7d8b84, 0], [2550, 150, 0x8796a0, 1.7], [3300, 240, 0x95a3ae, 3.1]];
    let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (const [R, Hm, col, ph] of rows) {
      const P2 = [], I = [];
      const amp = []; for (let k = 0; k < 7; k++) amp.push([rnd() * 6.28, 1 + k * 1.7 + rnd(), 0.6 / (k + 1)]);
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2; let h = 0; for (const [p0, f, w] of amp) h += w * (0.5 + 0.5 * Math.sin(a * f * 3 + p0 + ph));
        // выше к востоку/северо-востоку (условно — направление на Алтай; север сцены по розе ветров ГП-002)
        const east = 0.55 + 0.45 * Math.max(0, Math.cos(a - Math.atan2(-0.718, 0.697)));
        const y = Hm * (0.25 + h) * east;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
        P2.push(x, -8, z, x + Math.cos(a) * 160, y, z + Math.sin(a) * 160);
        if (i < N) { const b = i * 2; I.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setIndex(I); g.computeVertexNormals();
      const m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
      hills.add(new THREE.Mesh(g, m));
    }
  }

  /* ---------- деревья вне территории (декоративно): тополя, берёзы, кустарник ---------- */
  const trees = new THREE.Group(); trees.name = 'деревья (декоративно)'; scene.add(trees); let thin = () => {};
  {
    const fence = { x0: -95, x1: 92, z0: -46, z1: 46 };
    const excl = (x, z) =>
      (x > fence.x0 && x < fence.x1 && z > fence.z0 && z < fence.z1) ||
      Math.abs(z - 40) < 16 ||                                            // ж/д коридор
      (x > 8 && x < 36 && z < -40) ||                                     // въезд у КПП (север листа)
      (z > 4 && z < 24 && x > 80) || (z > 6 && z < 22 && x < -85);        // въезды восток/запад
    const gTrunk = new THREE.CylinderGeometry(0.13, 0.2, 1, 6), gBush = new THREE.IcosahedronGeometry(1, 1);
    const crownGeo = (det, seed) => {   // крона: икосфера со смещением по шуму, тень снизу, вариация оттенка
      const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
      const nz = (x, y, z) => Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 - seed) * Math.sin(z * 3.7 + 2 * seed) + 0.5 * Math.sin(x * 7.3 + y * 6.1 + z * 5.3 + seed);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.22 * nz(v.x, v.y, v.z); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
        const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(v.y, -0.9, 0.7), t = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(v.x * 5 + v.z * 4 + seed));
        col[i * 3] = ao * t * 0.95; col[i * 3 + 1] = ao * t; col[i * 3 + 2] = ao * t * 0.9; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    };
    const gCrown = crownGeo(2, 1.7);
    const leafT = MATX.canvasTex(128, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); let sd = 9; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 1400; i++) { const v = Math.floor(120 + r() * 135); x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.ellipse(r() * s, r() * s, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, 7); x.fill(); } });
    const leafM = () => MATX.triplanar(new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true, map: leafT }), 0.9);
    const pts = []; let sd = 17; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // посадки группами (лесополосы вдоль границ и рощицы)
    for (let k = 0; k < 46; k++) {
      const a = rnd() * Math.PI * 2, d = 140 + rnd() * 330, gx = cx + Math.cos(a) * d * 1.25, gz = cz + Math.sin(a) * d;
      const n = 5 + Math.floor(rnd() * 14), sp = 4 + rnd() * 8;
      for (let i = 0; i < n; i++) { const x = gx + (rnd() - 0.5) * sp * 4, z = gz + (rnd() - 0.5) * sp * 2.5; if (!excl(x, z)) pts.push([x, z, rnd()]); }
    }
    for (let i = 0; i < 70; i++) { const x = cx + (rnd() - 0.5) * 360, z = (rnd() < 0.5 ? -1 : 1) * (52 + rnd() * 60); if (!excl(x, z)) pts.push([x, z, rnd()]); }
    const yAt = (x, z) => (x > X0 && x < X1 && z > Z0 && z < Z1) ? hAt(x, z) : base + hill(x, z) - 0.04;
    const N = pts.length, tr = new THREE.InstancedMesh(gTrunk, M(0x5a4a3a, { roughness: 0.9 }), N), cr = new THREE.InstancedMesh(gCrown, leafM(), N * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cols = [0x56733a, 0x63813f, 0x6f8a46, 0x4d6a33, 0x7d8e4a, 0x5f7a44].map(c => new THREE.Color(c));
    pts.forEach(([x, z, r], i) => {
      const y = yAt(x, z), poplar = r < 0.4, H = poplar ? 11 + r * 10 : 6 + r * 6, tH = H * (poplar ? 0.35 : 0.4);
      m4.compose(new THREE.Vector3(x, y + tH / 2, z), q.identity(), new THREE.Vector3(1 + r, tH, 1 + r)); tr.setMatrixAt(i, m4);
      const cw = poplar ? 1.6 + r : 2.4 + r * 1.8, ch = (H - tH) * (poplar ? 0.62 : 0.55);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6.28);
      m4.compose(new THREE.Vector3(x, y + tH + ch, z), q, new THREE.Vector3(cw, ch, cw)); cr.setMatrixAt(i * 2, m4);
      m4.compose(new THREE.Vector3(x + (r - 0.5) * 1.2, y + tH + ch * 1.55, z + (0.5 - r) * 1.0), q, new THREE.Vector3(cw * 0.7, ch * 0.6, cw * 0.7)); cr.setMatrixAt(i * 2 + 1, m4);
      const c = cols[Math.floor(r * 997) % cols.length]; cr.setColorAt(i * 2, c); cr.setColorAt(i * 2 + 1, c.clone().multiplyScalar(1.08));
    });
    tr.castShadow = cr.castShadow = true; tr.receiveShadow = cr.receiveShadow = true; trees.add(tr, cr);
    thin = low => { tr.count = low ? Math.floor(N / 2) : N; cr.count = low ? N : N * 2; };
    // кустарник у оград (вне территории)
    const bsh = []; for (let i = 0; i < 160; i++) { const x = cx + (rnd() - 0.5) * 420, z = cz + (rnd() - 0.5) * 300; if (!excl(x, z) && Math.hypot(x - cx, z - cz) < 230) bsh.push([x, z, rnd()]); }
    const bu = new THREE.InstancedMesh(crownGeo(1, 4.2), leafM(), bsh.length);
    bsh.forEach(([x, z, r], i) => { m4.compose(new THREE.Vector3(x, yAt(x, z) + 0.4, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6), new THREE.Vector3(1 + r * 1.5, 0.7 + r * 0.5, 1 + r)); bu.setMatrixAt(i, m4); bu.setColorAt(i, cols[(i * 7) % cols.length]); });
    bu.castShadow = true; trees.add(bu);
  }
  VIS.hooks.thin = low => thin(low); if (VIS.quality === 'low') thin(true);
  return { meadow, hills, trees, det, thin: k => thin(k) };
})();


