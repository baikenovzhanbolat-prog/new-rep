/* ---------- Цикл ---------- */
const v = new THREE.Vector3();
function loop() {
  const cineOn = CINE.pre(performance.now());   // v0.37–0.42: кинорежим ведёт камеру сам
  if (!window.__walkOn && !cineOn) { keyStep(); stepCamAnim(); controls.update(); }
  WALK.tick();
  MATR.tick();
  PNET.tick();
  GEO.tick();
  if (!window.__walkOn && !cineOn) { const dn = Math.min(1, Math.max(0.08, camera.position.distanceTo(controls.target) * 0.05)); if (Math.abs(camera.near - dn) / camera.near > 0.15) { camera.near = dn; camera.updateProjectionMatrix(); } }   // v0.14
  for (const m of FAST_LOD) { let c = m.userData.lodC; if (!c) { m.updateWorldMatrix(true, false); if (m.isInstancedMesh) m.computeBoundingSphere(); else m.geometry.computeBoundingSphere(); const bs = (m.isInstancedMesh ? m.boundingSphere : m.geometry.boundingSphere).clone().applyMatrix4(m.matrixWorld); c = m.userData.lodC = bs.center; m.userData.lodR = bs.radius; } m.visible = camera.position.distanceTo(c) < m.userData.lodR + (window.__lodD || 40); }   // v0.14: крепёж — LOD; v0.23: дальность по режиму качества
  if (!labelsEl.classList.contains('off') && !window.__walkOn) for (const o of OBJ) {
    v.copy(o.anchor).project(camera);
    if (v.z > 1 || !o.g.visible) { o.el.style.display = 'none'; continue; }
    o.el.style.display = o.maf ? 'none' : '';
    o.el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px,${(1 - v.y) / 2 * innerHeight}px) translate(-50%,-100%)`;
  }
  if (window.__EMG) window.__EMG.tick(performance.now());
  procTick(performance.now()); RVSD.tick(); PIPED.tick(); UGN.tick(); ESTQ.tick(); PHX.tick(); VIS.tick(); F24.tick(performance.now()); F25.tick(performance.now()); F27.tick(performance.now()); UGHL.tick(performance.now());
  if (!(cineOn && CINE.render())) renderer.render(scene, camera);
  updateHud(); updatePerf();
  requestAnimationFrame(loop);
}
try { purgeOld(); } catch (e) { console.warn('purgeOld:', e); }   // v0.28
loop();
/* отладка и автотесты (tools/fingerprint.mjs): доступ к сцене и данным только при ?debug в адресе */
if (/[?&]debug\b/.test(location.search)) window.__genplan = {
  THREE, scene, camera, renderer, pickables, OBJ, PIPEREG,
  data: { NETS, PH, UG_DATA, PHX_DATA, PROC, WELLS_DATA, GP5V },
  logs: { F24, F25, F26, F27, F28, F29, F31, F32, F34 },
};
