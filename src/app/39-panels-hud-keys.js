/* ---------- Панели: одновременно открыта одна (слои или список объектов) ---------- */
const topBar = document.getElementById('top'), objP = document.getElementById('objp'), netP = document.getElementById('netp');
function closePanels() {
  if (window.__RGSP) window.__RGSP.hidePanel();
  if (window.__DX) window.__DX.hidePanel();   // v0.21
  if (window.__GEO) window.__GEO.hidePanel();
  if (window.__PNET) window.__PNET.hidePanel();
  netP.style.display = 'none'; objP.style.display = 'none'; procP.style.display = 'none'; document.body.classList.remove('procOpen');
  document.getElementById('bNet').classList.remove('on'); document.getElementById('bObj').classList.remove('on'); document.getElementById('bProc').classList.remove('on');
}
function openPanel(which) {
  closePanels();
  const top = Math.round(topBar.getBoundingClientRect().bottom + 6) + 'px';   // под панелью кнопок (на телефоне она в 2 ряда)
  if (which === 'net') { netP.style.top = top; netP.style.display = 'block'; document.getElementById('bNet').classList.add('on'); }
  else if (which === 'proc') { procP.style.top = top; procP.style.maxHeight = `calc(100% - ${top} - 60px)`; procP.style.display = 'flex'; document.body.classList.add('procOpen'); document.getElementById('bProc').classList.add('on'); }
  else { objP.style.top = top; objP.style.display = 'flex'; document.getElementById('bObj').classList.add('on'); }
}

/* ---------- Список объектов с поиском ---------- */
const objList = document.getElementById('objList'), objQ = document.getElementById('objQ');
const objCat = new Map();   // объект -> название слоя (категория списка)
for (const o of OBJ) {
  const L = layerApi.LAYERS.find(L => L.k !== 'rackL' && L.get().includes(o.g));
  objCat.set(o, L ? L.name : 'Прочее');
}
const layersOf = o => layerApi.LAYERS.filter(L => L.get().includes(o.g)).map(L => L.k);
const objVisible = o => o.g.visible;
const normQ = t => t.toLowerCase().replace(/ё/g, 'е').replace(/[‐–—−]/g, '-').trim();
function renderObjList() {
  const q = normQ(objQ.value), words = q.split(/\s+/).filter(Boolean);
  const items = OBJ.filter(o => { const t = normQ(o.id + ' ' + o.name + ' ' + objCat.get(o)); return words.every(w => t.includes(w)); });
  const cats = new Map(); for (const o of items) { const c = objCat.get(o); if (!cats.has(c)) cats.set(c, []); cats.get(c).push(o); }
  const ord = c => { const i = layerApi.LAYERS.findIndex(L => L.name === c); return i < 0 ? 1e3 : i; };
  let html = '';
  for (const [c, arr] of [...cats].sort((a, b) => ord(a[0]) - ord(b[0]))) {
    html += `<div class="oc">${c}</div>`;
    for (const o of arr) html += `<div class="oi${o.fire ? ' f' : ''}${objVisible(o) ? '' : ' hid'}${o === curSel ? ' sel' : ''}" data-i="${OBJ.indexOf(o)}"><b>${o.id}</b><span>${o.name}${objVisible(o) ? '' : ' <i style="color:#7a8a96">(слой скрыт)</i>'}</span></div>`;
  }
  objList.innerHTML = html || '<div class="empty">Ничего не найдено</div>';
  document.getElementById('objN').textContent = items.length + ' из ' + OBJ.length;
}
function markObjList() { if (objP.style.display === 'flex') renderObjList(); }
objQ.addEventListener('input', renderObjList);
objQ.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = objList.querySelector('.oi'); if (f) f.click(); } e.stopPropagation(); });
objList.addEventListener('click', e => {
  const it = e.target.closest('.oi'); if (!it) return;
  goToObject(OBJ[+it.dataset.i]);
  if (innerWidth < 700) closePanels();   // на телефоне панель закрывает сцену
});
document.getElementById('prX').onclick = () => closePanels();
document.getElementById('bObj').onclick = () => {
  if (objP.style.display === 'flex') { closePanels(); return; }
  openPanel('obj'); renderObjList(); if (matchMedia('(pointer:fine)').matches) objQ.focus();
};
/* Показать объект: включить его слой, для оборудования насосного цеха — снять кровлю, перелететь и выделить */
function goToObject(o) {
  for (const k of layersOf(o)) if (!layerApi.isOn(k)) layerApi.setVis(k, true);
  if (o.ph && layerApi.isOn('phroof')) layerApi.setVis('phroof', false);
  const src = o.gM && o.gM.visible ? o.gM : o.gS, bb = new THREE.Box3().setFromObject(src);
  if (bb.isEmpty()) { select(o); return; }
  const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z, size.y * 0.8) / 2, dist = Math.min(260, Math.max(o.ph ? 7 : 12, r * 3.4));
  const s = new THREE.Spherical().setFromVector3(_o1.copy(camera.position).sub(controls.target));
  s.radius = dist; s.phi = Math.min(1.1, Math.max(0.55, s.phi));
  const tgt = new THREE.Vector3(c.x, bb.min.y + size.y * 0.35, c.z), pos = tgt.clone().add(_o1.setFromSpherical(s));
  flyTo(pos.toArray(), tgt.toArray());
  select(o);
}

/* ---------- Компас (север — по ГП-002) и масштабная линейка ---------- */
// Стрелка «С» розы ветров на листе 5632.29-ГП-002: 45,8° против часовой стрелки от верха листа. В сцене: X — вправо по листу, Z — вниз по листу.
const NORTH_DEG = 45.8, NORTH = new THREE.Vector2(-Math.sin(NORTH_DEG * Math.PI / 180), -Math.cos(NORTH_DEG * Math.PI / 180));
const compR = document.getElementById('compR'), scT = document.getElementById('scT'), scB = document.getElementById('scB'), perfEl = document.getElementById('perf'), hudEl = document.getElementById('hud');
const _cd = new THREE.Vector3(), _cu = new THREE.Vector3();
let compLast = 1e9, scLast = '';
function updateHud() {
  camera.getWorldDirection(_cd); _cu.set(0, 1, 0).applyQuaternion(camera.quaternion);
  let fx = _cd.x + _cu.x, fz = _cd.z + _cu.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;   // «вверх по экрану» в плане
  const nu = NORTH.x * fx + NORTH.y * fz, nr = NORTH.x * -fz + NORTH.y * fx, ang = Math.atan2(nr, nu) * 180 / Math.PI;
  if (Math.abs(ang - compLast) > 0.2) { compR.setAttribute('transform', `rotate(${ang.toFixed(1)})`); compLast = ang; }
  const d = camera.position.distanceTo(controls.target), mpp = 2 * d * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
  const want = mpp * 130, p10 = Math.pow(10, Math.floor(Math.log10(want))); let nice = p10;
  for (const m of [1, 2, 5, 10]) if (m * p10 <= want) nice = m * p10;
  const oblique = Math.acos(Math.min(1, Math.max(-1, -_cd.y))) > 0.35;
  const label = (oblique ? '≈ ' : '') + String(nice).replace('.', ',') + ' м';
  const w = Math.round(nice / mpp), key = label + '|' + w;
  if (key !== scLast) { scT.textContent = label; scB.style.width = w + 'px'; scLast = key; }
}
function placeHud() {   // на узком экране карточка объекта во всю ширину — поднимаем компас над ней
  hudEl.style.bottom = (info.style.display === 'block' && innerWidth < 760) ? Math.round(info.getBoundingClientRect().height + 42) + 'px' : (innerWidth <= 700 ? '40px' : '8px');
}
document.getElementById('comp').onclick = () => {   // развернуть вид севером вверх, сохранив дальность и наклон
  if (window.__walkOn) { WALK.faceNorth(); return; }   // в обходе — повернуться лицом на север
  const s = new THREE.Spherical().setFromVector3(_o1.copy(camera.position).sub(controls.target));
  s.theta = Math.atan2(-NORTH.x, -NORTH.y); if (s.phi < 0.02) s.phi = 0.02;
  flyTo(controls.target.clone().add(_o1.setFromSpherical(s)).toArray(), controls.target.toArray(), 0.7);
};
let pfN = 0, pfT = performance.now();
function updatePerf() {
  pfN++; const now = performance.now(); if (now - pfT < 500 || perfEl.style.display === 'none') return;
  const ri = renderer.info.render;
  perfEl.textContent = `${Math.round(pfN * 1000 / (now - pfT))} к/с · ${ri.calls} выз. · ${(ri.triangles / 1e6).toFixed(2).replace('.', ',')} млн тр.`;
  pfN = 0; pfT = now;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); placeHud();
});

/* ---------- Управление с клавиатуры ---------- */
const KEYS = new Set();
const KEYMAP = { ArrowUp: 'fw', ArrowDown: 'bk', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'tu', KeyS: 'td', KeyA: 'rl', KeyD: 'rr', KeyQ: 'up', PageUp: 'up', KeyE: 'dn', PageDown: 'dn', Equal: 'zi', NumpadAdd: 'zi', Minus: 'zo', NumpadSubtract: 'zo' };
addEventListener('keydown', e => { const a = KEYMAP[e.code]; if (!a || e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox') return; KEYS.add(a); camAnim = null; e.preventDefault(); });
addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) KEYS.delete(a); });
addEventListener('blur', () => KEYS.clear());
const kF = new THREE.Vector3(), kR = new THREE.Vector3(), kOff = new THREE.Vector3(), kSph = new THREE.Spherical(); let kT = performance.now();
function keyStep() {
  const now = performance.now(), dt = Math.min(0.1, (now - kT) / 1000); kT = now;
  if (!KEYS.size) return;
  kOff.copy(camera.position).sub(controls.target);
  const dist = kOff.length(), k = dist * dt * 0.9;
  kF.set(-kOff.x, 0, -kOff.z); if (kF.lengthSq() < 1e-6) kF.set(0, 0, -1); kF.normalize();
  kR.set(-kF.z, 0, kF.x);
  const mv = new THREE.Vector3();
  if (KEYS.has('fw')) mv.addScaledVector(kF, k); if (KEYS.has('bk')) mv.addScaledVector(kF, -k);
  if (KEYS.has('r')) mv.addScaledVector(kR, k); if (KEYS.has('l')) mv.addScaledVector(kR, -k);
  if (KEYS.has('up')) mv.y += k; if (KEYS.has('dn')) mv.y -= k;
  mv.multiplyScalar(kShift ? 3 : 1);
  controls.target.add(mv); camera.position.add(mv);
  if (controls.target.y < 0) { camera.position.y -= controls.target.y; controls.target.y = 0; }
  const rot = dt * 1.4 * (kShift ? 2 : 1);
  if (KEYS.has('rl') || KEYS.has('rr') || KEYS.has('tu') || KEYS.has('td')) {
    kOff.copy(camera.position).sub(controls.target); kSph.setFromVector3(kOff);
    if (KEYS.has('rl')) kSph.theta += rot; if (KEYS.has('rr')) kSph.theta -= rot;
    if (KEYS.has('tu')) kSph.phi -= rot; if (KEYS.has('td')) kSph.phi += rot;
    kSph.phi = Math.max(0.05, Math.min(controls.maxPolarAngle, kSph.phi));
    kOff.setFromSpherical(kSph); camera.position.copy(controls.target).add(kOff);
  }
  if (KEYS.has('zi') || KEYS.has('zo')) {
    kOff.copy(camera.position).sub(controls.target);
    const f = 1 + (KEYS.has('zo') ? 1 : -1) * dt * 1.2 * (kShift ? 3 : 1);
    const nd = Math.max(controls.minDistance, Math.min(controls.maxDistance, kOff.length() * f));
    kOff.setLength(nd); camera.position.copy(controls.target).add(kOff);
  }
}
let kShift = false;
addEventListener('keydown', e => { if (e.key === 'Shift') kShift = true; }); addEventListener('keyup', e => { if (e.key === 'Shift') kShift = false; });

