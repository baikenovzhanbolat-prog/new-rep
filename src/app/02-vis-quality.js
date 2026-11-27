/* ---------- Этап v0.10: свет, небо, отражения, дымка, тени, режим качества ----------
   Тональная коррекция ACES; окружение (PMREM) из процедурного неба — отражения на металле и стекле;
   небесный купол с солнцем и дымкой у горизонта; тени: мягкие, область теней следует за камерой (чётче вблизи).
   Режим качества (высокое/среднее/низкое) — «Слои → Служебное», запоминается в браузере. */
const VIS = (() => {
  const SUN = sun.position.clone().normalize();
  const C = { zen: new THREE.Color(0x3d6fb0), hor: new THREE.Color(0xcad9e3), gnd: new THREE.Color(0x8f8a78) };
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera.far = 4200; camera.updateProjectionMatrix();
  /* небесный купол: градиент зенит → горизонт, ореол и диск солнца, ниже горизонта — цвет дымки */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN }, uZen: { value: C.zen }, uHor: { value: C.hor }, uGnd: { value: C.gnd }, uDisc: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
    fragmentShader: `uniform vec3 uSun, uZen, uHor, uGnd; uniform float uDisc; varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(uHor, uZen, pow(smoothstep(-0.02, 0.62, h), 0.75));
        c = mix(c, uHor * 0.97, smoothstep(0.06, -0.03, h));                       // дымка у горизонта
        if (h < -0.03) c = mix(uHor * 0.97, uGnd, smoothstep(-0.03, -0.35, h));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.78) * (pow(s, 6.0) * 0.18 + pow(s, 64.0) * 0.35);  // ореол
        c += vec3(1.0, 0.96, 0.88) * smoothstep(0.9993, 0.9997, s) * 6.0 * uDisc;  // диск
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 48, 24), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'небо';
  scene.add(sky); scene.background = null;
  /* окружение для отражений и рассеянного света: то же небо (без диска) + земля */
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), m = skyMat.clone();
    m.uniforms = THREE.UniformsUtils.clone(skyMat.uniforms); m.uniforms.uDisc.value = 0; m.uniforms.uSun.value = SUN;
    for (const k of ['uZen', 'uHor', 'uGnd']) m.uniforms[k].value = m.uniforms[k].value.clone().multiplyScalar(0.72);   // рассеянный свет от неба — слабее (контраст)
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), m));
    const save = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    scene.environment = pm.fromScene(es, 0.03).texture; renderer.toneMapping = save; pm.dispose();
  }
  scene.fog = new THREE.Fog(C.hor.clone().multiplyScalar(0.97), 320, 3600);
  /* свет: часть рассеянного света теперь даёт окружение — полусфера слабее, солнце теплее */
  scene.traverse(o => { if (o.isHemisphereLight) { o.intensity = 0.5; o.color.set(0xdfe9f2); o.groundColor.set(0x7d7563); } });
  sun.color.set(0xfff0d8); sun.intensity = 2.7;
  scene.add(sun.target);
  sun.shadow.normalBias = 0.02; sun.shadow.bias = -0.0003;
  /* режимы качества */
  const QS = {
    high: { n: 'Высокое', pr: Math.min(devicePixelRatio, 2), sm: 4096, soft: true },
    mid: { n: 'Среднее', pr: Math.min(devicePixelRatio, 1.25), sm: 2048, soft: true },
    low: { n: 'Низкое (слабые телефоны)', pr: 1, sm: 1024, soft: false }
  };
  let qk = null; const hooks = {};
  try { qk = localStorage.getItem('ctrQuality'); } catch (e) { }
  if (!QS[qk]) qk = (matchMedia('(pointer: coarse)').matches || innerWidth < 800) ? 'mid' : 'high';
  function setQuality(k) {
    if (!QS[k]) return; qk = k; const q = QS[k];
    renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight);
    const t = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (renderer.shadowMap.type !== t) { renderer.shadowMap.type = t; scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); }); }
    if (sun.shadow.mapSize.x !== q.sm) { sun.shadow.mapSize.set(q.sm, q.sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    try { localStorage.setItem('ctrQuality', k); } catch (e) { }
    if (hooks.thin) hooks.thin(k === 'low');
    renderer.shadowMap.needsUpdate = true;
  }
  setQuality(qk);
  /* тени: область следует за точкой взгляда; размер — по расстоянию камеры; привязка к текселю (без мерцания).
     v0.45: карта теней пересчитывается не каждый кадр (проход теней — ≈ 700 вызовов отрисовки из 1900): при движении камеры
     или солнца — каждый кадр, иначе — раз в SH_EVERY кадров (подвижные механизмы: насосы, вагоны, АСН, кран). shadowDirty() — сразу. */
  const _t = new THREE.Vector3(), _sig = new Float64Array(10), SH_EVERY = 4;
  let shFrame = 0;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  function shadowDirty() { renderer.shadowMap.needsUpdate = true; }
  function tick() {
    sky.position.copy(camera.position);
    const tg = controls.target, d = camera.position.distanceTo(tg), ext = THREE.MathUtils.clamp(d * 1.5, 16, 135);
    const sc = sun.shadow.camera;
    if (Math.abs(sc.right - ext) / ext > 0.08) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 900; sc.updateProjectionMatrix(); }
    const tx = (2 * sc.right) / sun.shadow.mapSize.x;
    _t.set(Math.round(tg.x / tx) * tx, 0, Math.round(tg.z / tx) * tx);
    sun.target.position.copy(_t); sun.position.copy(_t).addScaledVector(SUN, 420);
    sun.target.updateMatrixWorld();
    const s = [camera.position.x, camera.position.y, camera.position.z, tg.x, tg.y, tg.z, sun.position.x, sun.position.y, sun.position.z, sc.right];
    let moved = false; for (let i = 0; i < 10; i++) if (Math.abs(s[i] - _sig[i]) > 1e-4) { moved = true; _sig[i] = s[i]; }
    if (moved || ++shFrame >= SH_EVERY) { shFrame = 0; renderer.shadowMap.needsUpdate = true; }
  }
  return { tick, shadowDirty, setQuality, get quality() { return qk; }, QS, sky, SUN, hooks };
})();


