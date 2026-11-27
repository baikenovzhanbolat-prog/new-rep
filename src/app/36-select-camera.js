/* ---------- Выбор объекта ---------- */
const info = document.getElementById('info'), iT = document.getElementById('iT');
let helper = null, curSel = null;
function select(o) {
  if (helper) { scene.remove(helper); helper = null; }
  if (window.__PNET) window.__PNET.clearHL();
  if (window.__UGHL) window.__UGHL.onSelect(o);   // v0.36: подсветка трассы сети по люку
  curSel = o;
  if (!o) { info.style.display = 'none'; placeHud(); markObjList(); return; }
  const useM = o.gM && o.gM.visible;
  if (!o.net) { helper = new THREE.BoxHelper(useM ? o.gM : o.gS, 0xffb000); scene.add(helper); }
  iT.innerHTML = `<b>№ ${o.id}</b> — ${o.name}` + (o.note ? `<div class="n">${o.note}</div>` : '') +
    (useM ? `<div class="n">${o.mnote}</div>` : '') +
    (['427', '431', '799'].includes(o.id) || !o.elev ? '' : `<div class="n">Планировочная отметка ≈ ${o.elev} (по проектным отметкам ГП-003).</div>`) + (window.__GEO ? window.__GEO.cardHTML(o) : '') +
    (o.net || o.f25 || o.f27 ? '' : `<div class="n">Положение и размеры в плане — по генплану; высота — условная.</div>`) + procCardHTML(o) + (window.__RGSP ? window.__RGSP.cardHTML(o) : '') + (window.__F24 ? window.__F24.cardHTML(o) : '') + (window.__F25 ? window.__F25.cardHTML(o) : '') + (window.__F26 ? window.__F26.cardHTML(o) : '') + (window.__F27 ? window.__F27.cardHTML(o) : '') + (window.__DX ? window.__DX.cardHTML(o) : '') + (window.__EMG ? window.__EMG.cardHTML(o) : '') + (o.est !== undefined && typeof ESTOPS !== 'undefined' ? ESTOPS.cardHTML(o) : '') + (window.__PNET ? window.__PNET.cardHTML(o) : '') + (window.__UGHL ? window.__UGHL.cardHTML(o) : '');
  markObjList();
  info.style.display = 'block';
  if (o.est !== undefined && typeof ESTOPS !== 'undefined') ESTOPS.bindCard(iT);
  if (window.__PNET) window.__PNET.bindCard(iT, o);
  if (window.__EMG) window.__EMG.bindCard(iT);
  if (window.__RGSP) window.__RGSP.bindCard(iT, o);   // v0.20
  if (window.__DX) window.__DX.bindCard(iT);   // v0.21
  if (window.__F24) window.__F24.bindCard(iT);   // v0.24
  if (window.__F25) window.__F25.bindCard(iT);   // v0.25
  if (window.__F26) window.__F26.bindCard(iT);   // v0.26
  if (window.__F27) window.__F27.bindCard(iT);   // v0.27
  if (window.__UGHL) window.__UGHL.bindCard(iT);   // v0.36
  placeHud();
}
document.getElementById('iX').onclick = () => select(null);

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  ptr.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const vis = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
  const hit = ray.intersectObjects(pickables, false).find(h => vis(h.object));
  window.__lastHit = hit || null;   // v0.12: точка попадания — для паспорта участка трубопровода
  if (window.__GEO) window.__GEO.onPick(hit, ray.ray);   // v0.16: координаты X/Y и отметка указанной точки
  select(hit ? (hit.object.userData.pick ? hit.object.userData.pick(hit) : hit.object.userData.o) : null);
  if (window.__RGSP) window.__RGSP.onPick(hit);   // v0.20: щелчок по РГС — паспорт резервуара
  window.__lastHit = null;
});

/* ---------- Камера и кнопки ---------- */
function fly(pos, tgt) { camAnim = null; camera.position.set(...pos); controls.target.set(...tgt); controls.update(); }
/* Плавный перелёт: цель — линейно, камера — по сферическим координатам относительно цели (без «прохода сквозь» точку вращения) */
let camAnim = null;
const _o0 = new THREE.Vector3(), _o1 = new THREE.Vector3(), _sA = new THREE.Spherical(), _sB = new THREE.Spherical(), _sC = new THREE.Spherical();
function flyTo(pos, tgt, dur = 0.9) {
  if (window.__walkOn && window.__walkExit) window.__walkExit();   // v0.11: перелёт камеры завершает обход
  const t1 = new THREE.Vector3(...tgt), p1 = new THREE.Vector3(...pos);
  const a = new THREE.Spherical().setFromVector3(_o0.copy(camera.position).sub(controls.target));
  const b = new THREE.Spherical().setFromVector3(_o1.copy(p1).sub(t1));
  let dth = b.theta - a.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));   // кратчайший поворот
  camAnim = { t0: controls.target.clone(), t1, a, b, dth, s: performance.now(), d: dur * 1000 };
}
function stepCamAnim() {
  if (!camAnim) return;
  const A = camAnim, k = Math.min(1, (performance.now() - A.s) / A.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  controls.target.lerpVectors(A.t0, A.t1, e);
  _sC.set(A.a.radius + (A.b.radius - A.a.radius) * e, A.a.phi + (A.b.phi - A.a.phi) * e, A.a.theta + A.dth * e);
  camera.position.copy(controls.target).add(_o0.setFromSpherical(_sC));
  if (k >= 1) camAnim = null;
}
const cancelCamAnim = () => { camAnim = null; };
renderer.domElement.addEventListener('pointerdown', cancelCamAnim);
renderer.domElement.addEventListener('wheel', cancelCamAnim, { passive: true });
const viewPose3d = () => [innerWidth < innerHeight ? [-70, 120, 165] : [-40, 85, 115], [5, 0, 0]];
fly(...viewPose3d());
document.getElementById('b3d').onclick = () => flyTo(...viewPose3d());
document.getElementById('bTop').onclick = () => flyTo([0, innerWidth < innerHeight ? 330 : 170, 0.1], [0, 0, 0]);
const bLab = document.getElementById('bLab');
bLab.onclick = () => { labelsEl.classList.toggle('off'); bLab.classList.toggle('on'); };
