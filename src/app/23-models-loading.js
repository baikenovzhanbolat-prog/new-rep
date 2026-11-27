/* Загрузка моделей: base64 -> zlib -> int16 позиции (мм), int8 нормали, sRGB-цвета */
const MODELS_META = {"rvs": {"n": 64962, "off": 0, "min": [-6.376, -0.036, -6.422], "max": [6.81, 17.953, 6.799]}, "rgs": {"n": 9918, "off": 779544, "min": [-1.89, -0.05, -5.118], "max": [1.5, 4.77, 5.118]}, "ktp": {"n": 504, "off": 898560, "min": [-2.38, -0.0, -1.3], "max": [2.38, 2.68, 1.3]}, "deg": {"n": 894, "off": 904608, "min": [-2.95, -0.0, -1.2], "max": [2.95, 4.145, 1.2]}, "kpp": {"n": 1842, "off": 915336, "min": [-2.745, -0.0, -2.049], "max": [2.745, 3.25, 2.049]}};
const MODELS_B64 = '/*@base64 assets/bin/models_b64.zlib*/';
let modelsOn = false;
const bMdl = document.getElementById('bMdl');
function showModels(on) {
  modelsOn = on; bMdl.classList.toggle('on', on);
  for (const o of OBJ) if (o.gM) { o.gM.visible = on; o.gS.visible = !on; setAnchor(o); }
  if (curSel) select(curSel);
}
bMdl.onclick = null;   // v0.28: переключатель «Модели склада» убран — детальные модели показаны всегда
/* v0.28: прежние условные модели и слои сравнения удалены из сцены (геометрия и материалы освобождаются, если больше нигде не используются).
   v0.43–0.44: не строятся вовсе прежние 186, 166, вышки 800 (функции не вызывались), механизм 901 и путь 53 западнее упора;
   остальное (модели склада под детальными РВС/РГС, лестницы и оборудование РВС до v0.21/v0.26, здание 196, упрощённые вагоны,
   меши сетей до v0.12, следы подземки, трубы «Л») — пока здесь. */
function purgeOld() {
  const objs = [], arrs = [];
  const A = (o, k) => { try { if (o && Array.isArray(o[k])) arrs.push(o[k]); } catch (e) { /* модуль ещё не создан */ } };
  try { A(RVSD, 'old'); A(RVSD, 'ladOld'); A(RVSD, 'eqOld'); } catch (e) { }
  try { A(RGSD, 'old'); } catch (e) { }
  try { A(S196, 'old'); A(TCAR, 'old'); A(UGN, 'traces'); } catch (e) { }
  try { if (typeof PNET !== 'undefined' && PNET) A(PNET, 'oldMeshes'); } catch (e) { }
  for (const a of arrs) { objs.push(...a); a.length = 0; }
  try { objs.push(RACK_L); } catch (e) { }
  const dead = new Set();
  for (const o of objs) { if (!o || !o.isObject3D) continue; o.traverse(m => dead.add(m)); if (o.parent) o.parent.remove(o); }
  if (!dead.size) return;
  for (let i = pickables.length - 1; i >= 0; i--) if (dead.has(pickables[i])) pickables.splice(i, 1);
  const live = new Set(); scene.traverse(m => { if (m.geometry) live.add(m.geometry); for (const x of [].concat(m.material || [])) live.add(x); });
  for (const m of dead) {
    if (m.geometry && !live.has(m.geometry)) { m.geometry.dispose(); live.add(m.geometry); purgeOld.geo++; }
    for (const x of [].concat(m.material || [])) if (!live.has(x)) { x.dispose(); live.add(x); }
  }
  purgeOld.n += dead.size;
}
purgeOld.n = 0; purgeOld.geo = 0; window.__purgeOld = purgeOld;
(async () => {
  try {
    const bin = Uint8Array.from(atob(MODELS_B64), c => c.charCodeAt(0));
    const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const c = i / 255; lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    const mm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide });
    const geo = {};
    for (const [k, m] of Object.entries(MODELS_META)) {
      const n = m.n, o = m.off;
      const pi = new Int16Array(buf, o, n * 3), ci = new Uint8Array(buf, o + 9 * n, n * 3);
      const pf = new Float32Array(n * 3), cf = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) { pf[i] = pi[i] / 1000; cf[i] = lut[ci[i]]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pf, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf.slice(o + 6 * n, o + 9 * n)), 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(cf, 3));
      g.computeBoundingSphere(); geo[k] = g;
    }
    for (const o of OBJ) {
      const d = MDL[o.id]; if (!d) continue;
      const gM = new THREE.Group();
      for (const [px, py] of d.at) {
        const [x, z] = P(px, py), me = new THREE.Mesh(geo[d.k], mm);
        me.position.set(x, 0, z); me.scale.set(...d.s); if (d.r) me.rotation.y = d.r; me.castShadow = me.receiveShadow = true;
        me.userData.o = o; pickables.push(me); gM.add(me);
      }
      o.g.add(gM); o.gM = gM; o.mnote = d.note; RVSD.attach(o, gM); RGSD.attach(o, gM);
    }
    showModels(true); purgeOld();
    document.getElementById('mStat').textContent = 'Часть объектов — 3D-модели из «Цифрового склада».';
  } catch (e) {
    console.warn('Модели склада не загружены:', e); window.__mdlFail = 1;
    try { RVSD.fallback(); showModels(true); purgeOld(); } catch (e2) { console.warn('Детальные РВС:', e2); }
    try { RGSD.fallback(); } catch (e3) { /* v0.20: модуль RGSD ещё не создан — выполнит fallback при создании */ }
    document.getElementById('mStat').textContent = '(Модели склада не загрузились — показан упрощённый вид.)';
  }
})();

/* v0.44: модель вагона-цистерны «Цифрового склада» (v0.13) больше не загружается: с v0.22 вагоны — детальная модель TCAR,
   а эта строилась только для слоя сравнения «carsold», которого нет с v0.28, — всегда скрытой. Её постройка брала положения
   вагонов в момент загрузки, поэтому состав сцены зависел от скорости машины. */

