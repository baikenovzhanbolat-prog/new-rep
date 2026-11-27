/* =====================================================================================
   v0.26 — РВС-1000: позиции ТЗ и комплекта 109-ТХ (люки, патрубки, приборы, комплектующие) — карточка по клику, виды (модуль F26)
   Геометрия строится модулем RVSD (позиции помечены тегами ТЗ в слитой геометрии; клик определяет позицию по треугольнику).
   ===================================================================================== */
const F26 = (() => {
  const TZ = RVSD.TZ, DEGR = 180 / Math.PI;
  const ST = { CONFIRMED: ['ПОДТВЕРЖДЕНО', '#1f6b2e', '#e6f3e8'], APPROX: ['УСЛОВНО', '#8a5a00', '#fff3d6'] };
  const mm = v => Math.round(v * 1000).toLocaleString('ru-RU');
  const ang = it => { if (it.a3 === undefined) return null; let d = (RVSD.TZ0 - it.a3) * DEGR; d = ((d % 360) + 360) % 360; return Math.round(d); };
  const badge = st => { const s = ST[st] || ST.APPROX; return `<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;color:${s[1]};background:${s[2]}">${s[0]}</span>`; };
  function dataRows(it) {
    const r = [];
    if (it.dn) r.push(['Условный проход', 'Ду ' + it.dn + ' мм']);
    if (it.py) r.push(['Условное давление', String(it.py).replace('.', ',') + ' МПа']);
    if (it.typ) r.push(['Тип патрубка', '«' + it.typ + '»']);
    if (it.al !== undefined) { const a = ang(it); r.push([it.ref ? 'Угол α (по патрубку)' : 'Угол α по ТЗ', it.al + '°' + (a !== null && Math.abs(a - it.al) > 0.5 && it.key[0] !== 'K' ? ` (в 3D ≈ ${a}° — ${it.angNote || 'по трассе ГП-005'})` : '')]); }
    if (it.A !== undefined) r.push([it.side === 'крыша' ? 'A — от оси резервуара' : it.ref ? 'Высота от днища (≈)' : 'A — ось от днища', mm(it.A) + ' мм']);
    if (it.B !== undefined) r.push([it.side === 'крыша' ? 'B — торец над настилом' : 'B — вылет от стенки', mm(it.B) + ' мм']);
    if (it.C !== undefined) r.push(['C', mm(it.C) + ' мм']);
    if (it.h) r.push(['Высота', mm(it.h) + ' мм']);
    if (it.note) r.push(['Примечание ТЗ', it.note]);
    if (it.tx) r.push(['Комплект 109-ТХ', it.tx]);
    return r;
  }
  function cardHTML(o) {
    if (o && o.f26 && TZ[o.f26]) {
      const it = TZ[o.f26];
      const hd = it.ref ? `${it.ref} (Резервуар 1.pdf, стр. 5), ${it.side}` : `ТЗ на РВС-1000 (222.pdf, л. 21–23): ${it.side}${it.pos ? ', поз. ' + it.pos : ''}`;
      return `<div class="dxc"><div class="dxh">${hd} ${badge(it.st)}</div>` +
        `<table style="font-size:12px;border-collapse:collapse;margin:4px 0">${dataRows(it).map(([k, v]) => `<tr><td style="padding:1px 8px 1px 0;color:#5b6670;vertical-align:top">${k}</td><td style="padding:1px 0">${v}</td></tr>`).join('')}</table>` +
        `<div class="n"><b>В 3D:</b> ${it.eq}</div>` +
        (worldOf(o.tank, o.f26) ? `<button class="btn" data-f26i="${o.tank}|${o.f26}">Показать</button>` : '') +
        `<button class="btn" data-f26dk="109-002">Лист 109-ТХ-002</button><button class="btn" data-f26doc="23">Лист ТЗ (спецификация)</button><button class="btn" data-f26dk="109-С">ТХ.С</button><button class="btn" data-dxeq="РВС-1000: люки и патрубки">Все люки и патрубки</button><button class="btn" data-f26v="${o.tank}">Вид на крышу</button></div>`;
    }
    if (o && /^109\.[123]$/.test(o.id)) return `<div class="dxc"><button class="btn" data-f26v="${o.id}">Вид на крышу</button><button class="btn" data-f26w="${o.id}">Вид на патрубки</button><button class="btn" data-dxeq="РВС-1000: люки и патрубки">Люки и патрубки</button><button class="btn" data-f26dk="109-002">Лист 109-ТХ-002</button>` +
      `<div class="n">v0.26: люки, патрубки, приборы и комплектующие — по ТЗ на РВС-1000 и комплекту 109-ТХ (ТХ-002, ТХ.С, ТХ-001, ТХ.ВТ). Нажмите на люк, патрубок или прибор — откроется карточка позиции.</div></div>`;
    return '';
  }
  const VIEWS = {
    roof: id => { const p = RVSD.topOf(id); if (p) flyTo([p[0] + 8.5, p[1] + 7.5, p[2] + 9.5], [p[0], p[1] - 0.6, p[2]], 0.9); },
    wall: id => { const w = worldOf(id, 'W2'), it = TZ.W2; if (!w) return; const a = it.a3; flyTo([w[0] + Math.sin(a) * 5.5 + Math.cos(a) * 2.2, w[1] + 2.2, w[2] + Math.cos(a) * 5.5 - Math.sin(a) * 2.2], [w[0] - Math.cos(a) * 0.4, w[1] + 0.3, w[2] + Math.sin(a) * 0.4], 0.9); },
    item: (id, key) => { const w = worldOf(id, key), p = RVSD.topOf(id), it = TZ[key]; if (!w || !p) return; const a = it.a3, roof = it.side === 'крыша', d = roof ? 3.2 : 4.5;
      if (key === 'K1') { flyTo([w[0] + Math.sin(a) * 17 + Math.cos(a) * 7, w[1] - 1.0, w[2] + Math.cos(a) * 17 - Math.sin(a) * 7], [w[0], w[1] + 3.0, w[2]], 0.9); return; }   // мачта целиком: от хомутов до +22,920
      flyTo([w[0] + Math.sin(a) * d + Math.cos(a) * 1.2, w[1] + (roof ? 2.4 : 1.6), w[2] + Math.cos(a) * d - Math.sin(a) * 1.2], w, 0.9); }
  };
  function bind(root) {
    for (const b of root.querySelectorAll('[data-f26v]')) b.onclick = () => VIEWS.roof(b.dataset.f26v);
    for (const b of root.querySelectorAll('[data-f26i]')) b.onclick = () => { const [id, k] = b.dataset.f26i.split('|'); VIEWS.item(id, k); };
    for (const b of root.querySelectorAll('[data-f26doc]')) b.onclick = () => window.__DX && window.__DX.openDoc('РВС-ТЗ', '222-' + b.dataset.f26doc);
    for (const b of root.querySelectorAll('[data-f26dk]')) b.onclick = () => window.__DX && window.__DX.openDoc(b.dataset.f26dk);
    for (const b of root.querySelectorAll('[data-f26w]')) b.onclick = () => VIEWS.wall(b.dataset.f26w);
  }
  function worldOf(id, key) {   // мировая точка позиции ТЗ (для проверки и перелёта)
    const it = TZ[key], p = RVSD.topOf(id); if (!it || !p || it.a3 === undefined) return null;
    const gy = p[1] - (RVSD.Y_0 + 12.0 + 0.6), roof = it.side === 'крыша', r = roof ? it.A : (it.rW || RVSD.R_CL + 0.15), y = roof ? gy + RVSD.roofY(it.A) + 0.12 : gy + RVSD.Y_0 + (it.yW || it.A || 0.9);
    return [p[0] + r * Math.sin(it.a3), y, p[2] + r * Math.cos(it.a3)];
  }
  function screenOf(id, key) { const w = worldOf(id, key); if (!w) return null; const v = new THREE.Vector3(...w).project(camera), r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, v.z]; }
  function checkTags(id) {   // проверка: центр треугольников каждой позиции ТЗ ↔ расчётная точка позиции (м, в плане)
    const acc = {}, v = new THREE.Vector3();
    let nIn = 0; scene.traverse(n => { if (n.userData && n.userData.tzR) nIn++; });
    pickables.forEach(n => {
      if (!n.isMesh || !n.userData.tzR || !n.userData.pick) return;
      const t0 = n.userData.pick({ faceIndex: n.userData.tzR[0][0] / 3 }); if (!t0 || t0.tank !== id) return;
      n.updateWorldMatrix(true, false); const pa = n.geometry.attributes.position, ix = n.geometry.index.array;
      for (const [i0, i1, tag] of n.userData.tzR) { const a = acc[tag] || (acc[tag] = [0, 0, 0, 0]); for (let k = i0; k < i1; k++) { v.fromBufferAttribute(pa, ix[k]).applyMatrix4(n.matrixWorld); a[0] += v.x; a[1] += v.y; a[2] += v.z; a[3]++; } }
    });
    const out = {};
    for (const [tag, a] of Object.entries(acc)) { const c = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], w = worldOf(id, tag); out[tag] = { n: a[3] / 3, c: c.map(x => +x.toFixed(2)), d: w ? +Math.hypot(c[0] - w[0], c[2] - w[2]).toFixed(2) : null }; }
    out._inScene = nIn; return out;
  }
  const api = { cardHTML, bindCard: bind, bind, VIEWS, TZ, ang, worldOf, screenOf, checkTags };
  window.__F26 = api;
  return api;
})();

