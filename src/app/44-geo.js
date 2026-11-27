/* =====================================================================================
   v0.16: ГЕНПЛАН — геопривязка, отметки, паспорт объекта (комплект 5632.29-ГП, листы ГП-001…004)
   v0.17: сверка обновлена — отметки путей, площадки эстакады и рельеф исправлены (модуль RELIEF17); статистика по узлам ГП-004
   и таблица контрольных точек считаются по текущей модели; масштаб сцены — принят без пересчёта координат (решение заказчика).
   -------------------------------------------------------------------------------------
   Источники: ГП-001 (общие данные, показатели), ГП-002 (координаты X/Y центров РВС и углов зданий, реперы,
   роза ветров), ГП-003 (отметки, покрытия, МАФ, озеленение), ГП-004 (картограмма земляных масс, сетка 20 м).
   Привязка сцены к условной системе координат ГП-002 — преобразование подобия по центрам РВС 109.1–109.3:
   Y + i·X = Z·((x − i·z) − AM) + BM. Масштаб |Z| = 0,99373: 1 м сцены = 0,9937 м по координатам листа
   (сцена крупнее на 0,63 % — см. вкладку «Сверка»). Координаты сцены и объектов НЕ изменялись.
   Отметки: система высот Балтийская; y сцены = отметка − 297,30.
   ===================================================================================== */
const GEO = (() => {
  const D = /*@json data/44-geo.D.json*/null;
  const Z = D.geo.z, AM = D.geo.am, BM = D.geo.bm, H0g = 297.30;
  const fmt = (v, d = 2) => (+v).toFixed(d).replace('.', ',');
  const fmk = v => fmt(v, Math.abs(v * 100 - Math.round(v * 100)) > 1e-6 ? 3 : 2);
  const ST = { V: ['ПОДТВЕРЖДЕНО', '#1f7a3d'], P: ['ТРЕБУЕТ УТОЧНЕНИЯ', '#b26a00'], C: ['РАСЧЁТ', '#5b6b78'], X: ['РАСХОЖДЕНИЕ', '#b3261e'], A: ['ПРИНЯТО', '#5b6b78'], D: ['ДЕМОНСТРАЦИЯ', '#7a5b9a'] };
  const tag = k => `<span style="font-size:10px;font-weight:700;color:${ST[k][1]};white-space:nowrap">${ST[k][0]}</span>`;
  function toReal(x, z) { const a = x - AM[0], b = -z - AM[1]; return { Y: Z[0] * a - Z[1] * b + BM[0], X: Z[1] * a + Z[0] * b + BM[1] }; }
  function toScene(X, Y) { const a = Y - BM[0], b = X - BM[1], d = Z[0] * Z[0] + Z[1] * Z[1]; return [(a * Z[0] + b * Z[1]) / d + AM[0], -((b * Z[0] - a * Z[1]) / d + AM[1])]; }
  const SC = Math.hypot(Z[0], Z[1]);

  /* ---------- карточка объекта: отметки по генплану и координаты ---------- */
  function cardHTML(o) {
    if (!o || !o.anchor || o.net) return '';
    let h = '';
    for (const r of D.marks[o.id] || []) h += `<div class="n"><b>${r[0]}:</b> ${fmk(r[1])} ${tag(r[2])}${r[3] ? ' — ' + r[3] : ''}</div>`;
    const c = D.xy[o.id];
    if (c) h += `<div class="n"><b>Координаты по ГП-002</b> (${c[2]}): X = ${fmt(c[0])}; Y = ${fmt(c[1])} ${tag('V')}</div>`;
    else if (!['427', '431', '799'].includes(o.id)) { const r = toReal(o.anchor.x, o.anchor.z); h += `<div class="n">Координаты центра (условная система ГП-002): X ≈ ${fmt(r.X, 1)}; Y ≈ ${fmt(r.Y, 1)} ${tag('C')} — по привязке модели, ±0,5 м</div>`; }
    return h;
  }

  /* ---------- слой: сетка ГП-004 с отметками, реперы ---------- */
  let built = false;
  function label(lines, w = 176, hh = 76) {
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = '#1d4e7a'; g.lineWidth = 2;
    g.beginPath(); if (g.roundRect) g.roundRect(1, 1, w - 2, hh - 2, 8); else g.rect(1, 1, w - 2, hh - 2); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const dy = (hh - 8) / lines.length;
    lines.forEach(([t, col, f], i) => { g.fillStyle = col; g.font = f || '700 24px system-ui,Arial'; g.fillText(t, w / 2, 5 + dy * (i + 0.5)); });
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.renderOrder = 20;
    sp.scale.set(w / 38, hh / 38, 1); return sp;
  }
  function build() {
    built = true;
    const N = D.grid, pos = [];
    const lineOf = (ax) => { const m = new Map(); for (const n of N) if (n[7 + ax]) { const k = n[5 + ax]; (m.get(k) || m.set(k, []).get(k)).push(n); } return m; };
    for (const ax of [0, 1]) for (const arr of lineOf(ax).values()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => (ax ? a[0] - b[0] : a[1] - b[1]) || 0);
      // крайние точки линии сетки → ломаная по рельефу (шаг 2 м)
      let a = arr[0], b = arr[0], dm = 0;
      for (const p of arr) for (const q of arr) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > dm) { dm = d; a = p; b = q; } }
      const n = Math.max(1, Math.round(dm / 2));
      for (let i = 0; i < n; i++) { const x1 = a[0] + (b[0] - a[0]) * i / n, z1 = a[1] + (b[1] - a[1]) * i / n, x2 = a[0] + (b[0] - a[0]) * (i + 1) / n, z2 = a[1] + (b[1] - a[1]) * (i + 1) / n; pos.push(x1, hAtS(x1, z1) + 0.09, z1, x2, hAtS(x2, z2) + 0.09, z2); }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1d4e7a, transparent: true, opacity: 0.85, depthTest: false })); ln.renderOrder = 19; ln.frustumCulled = false; GEO_G.add(ln);
    const pg = new THREE.SphereGeometry(0.16, 10, 8), pmV = new THREE.MeshBasicMaterial({ color: 0xc0392b }), pmU = new THREE.MeshBasicMaterial({ color: 0x8a94a0 });
    for (const n of N) {
      const [x, z, d, e, unc] = n, y = hAtS(x, z), dm = H0g + y - d;
      const m = new THREE.Mesh(pg, unc ? pmU : pmV); m.position.set(x, y + 0.12, z); GEO_G.add(m);
      const sp = label([[fmk(d) + (unc ? ' ?' : ''), '#c0392b'], [e == null ? '—' : fmk(e), '#1d2a36'], ['модель ' + (dm >= 0 ? '+' : '−') + fmt(Math.abs(dm)), Math.abs(dm) > 0.3 ? '#b3261e' : '#5b6b78', '600 17px system-ui,Arial']], 176, 92);
      sp.position.set(x, y + 1.7, z); GEO_G.add(sp);
      const o = { id: 'ГП-004', net: 1, name: 'Узел сетки плана земляных масс (20 м)', note: `Проектная отметка ${fmk(d)}${unc ? ' (чтение с листа неуверенное)' : ''}; существующая ${e == null ? '— (не прочитана)' : fmk(e)}; рабочая ${e == null ? '—' : (d - e >= 0 ? '+' : '−') + fmt(Math.abs(d - e))} м (${d - e >= 0 ? 'насыпь' : 'выемка'}). Рельеф модели в этой точке: ${fmt(H0g + y)} (${dm >= 0 ? '+' : '−'}${fmt(Math.abs(dm))} м к проектной). Отметки на ГП-004 — векторные штрихи, сняты распознаванием и выборочно сверены по листу.` };
      m.userData.o = o; pickables.push(m);
    }
    for (const r of D.rp) {
      const [x, z] = toScene(r[1], r[2]), y = hAtS(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0xc0392b })); pole.position.set(x, y + 1.1, z); GEO_G.add(pole);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xc0392b })); cone.rotation.x = Math.PI; cone.position.set(x, y + 0.2, z); GEO_G.add(cone);
      const sp = label([[r[0], '#c0392b'], ['X ' + fmt(r[1]), '#1d2a36', '600 17px system-ui,Arial'], ['Y ' + fmt(r[2]), '#1d2a36', '600 17px system-ui,Arial']], 190, 92); sp.position.set(x, y + 3.0, z); GEO_G.add(sp);
      const o = { id: r[0], net: 1, name: 'Репер (ГП-002)', note: `Координаты по примечанию листа ГП-002: X = ${fmt(r[1])}; Y = ${fmt(r[2])} (система координат условная, высот — Балтийская). Положение в сцене вычислено по привязке модели (±0,5 м); отметка репера и его конструкция на листе не указаны — показан условный знак. ${r[3] || ''}` };
      for (const q of [pole, cone]) { q.userData.o = o; pickables.push(q); }
    }
  }
  scene.add(GEO_G);
  function tick() { if (GEO_G.visible && !built) build(); }

  /* ---------- панель «Генплан» ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #gpp{position:fixed;right:10px;top:58px;width:420px;max-width:calc(100% - 20px);max-height:74vh;background:rgba(255,255,255,.97);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);padding:8px 10px;font-size:12.5px;color:#1d2a36;display:none;flex-direction:column;box-sizing:border-box;z-index:5}
    #gpp .ph{display:flex;align-items:center;gap:6px} #gpp .ph span{font-size:11px;color:#6b7b88;flex:1}
    #gpp .tabs{display:flex;gap:4px;margin:6px 0} #gpp .tabs button{flex:1;border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:4px 2px;font-size:11.5px;cursor:pointer;color:#1d2a36} #gpp .tabs button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #gpBody{overflow:auto;flex:1;min-height:0;line-height:1.35}
    #gpp h5{margin:9px 0 3px;font-size:11.5px;color:#5b6b78;font-weight:700}
    #gpp table{border-collapse:collapse;width:100%;font-size:11.5px} #gpp td,#gpp th{border-bottom:1px solid #e3e8ed;padding:3px 4px;text-align:left;vertical-align:top} #gpp td.r,#gpp th.r{text-align:right;white-space:nowrap}
    #gpp .fx{border:1px solid #e3e8ed;border-left:4px solid #b3261e;border-radius:7px;padding:5px 7px;margin:5px 0} #gpp .fx.ok{border-left-color:#1f7a3d} #gpp .fx.q{border-left-color:#b26a00}
    #gpp .lk{color:#1d4e7a;cursor:pointer;text-decoration:underline} #gpp .mut{color:#6b7b88;font-size:11px}
    #gpp label.sw{display:flex;gap:6px;align-items:center;margin:6px 0;cursor:pointer}`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'gpp';
  panel.innerHTML = `<div class="ph"><b>Генеральный план</b><span>5632.29-ГП, листы 1–5 ·</span><button class="lbtn" id="gpX">✕</button></div>
 <div class="tabs"><button data-t="pass" class="on">Паспорт</button><button data-t="pav">Покрытия</button><button data-t="earth">Земля</button><button data-t="geo">Привязка</button><button data-t="aud">Сверка</button></div><div id="gpBody"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#gpBody'), bG = document.getElementById('bGP');
  let tab = 'pass', lastPt = null;
  panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; panel.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  function hidePanel() { panel.style.display = 'none'; bG.classList.remove('on'); }
  function showPanel() {
    closePanels();
    const top = Math.round(document.getElementById('top').getBoundingClientRect().bottom + 6) + 'px';
    panel.style.top = top; panel.style.maxHeight = `calc(100% - ${top} - 60px)`; panel.style.display = 'flex'; bG.classList.add('on'); render();
  }
  panel.querySelector('#gpX').onclick = hidePanel;
  bG.onclick = () => panel.style.display === 'flex' ? hidePanel() : showPanel();
  const rows = (a, cls) => a.map(r => '<tr>' + r.map((c, i) => `<td${cls && cls[i] ? ' class="' + cls[i] + '"' : ''}>${c}</td>`).join('') + '</tr>').join('');
  function rose() {
    const W = D.wind, R = 74, dirs = W.dirs, pt = (i, v) => { const a = i * Math.PI / 4; return [(Math.sin(a) * v * R).toFixed(1), (-Math.cos(a) * v * R).toFixed(1)]; };
    const poly = (k, col) => `<polygon points="${W.rel[k].map((v, i) => pt(i, v).join(',')).join(' ')}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.6"/>`;
    let s = `<svg viewBox="-100 -100 200 200" width="190" height="190" style="display:block;margin:2px auto">`;
    for (const q of [0.25, 0.5, 0.75, 1]) s += `<circle r="${R * q}" fill="none" stroke="#dde3e8" stroke-width="0.8"/>`;
    dirs.forEach((d, i) => { const [x, y] = pt(i, 1), [tx, ty] = pt(i, 1.2); s += `<line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#dde3e8" stroke-width="0.8"/><text x="${tx}" y="${+ty + 3.5}" text-anchor="middle" font-size="10" fill="${i ? '#5b6b78' : '#c0392b'}" font-weight="${i ? 400 : 700}">${d}</text>`; });
    return s + poly('январь', '#1d4e7a') + poly('июнь', '#c0392b') + '</svg>';
  }
  function flyToPt(x, z) { const y = hAtS(x, z); flyTo([x + 14, y + 16, z + 20], [x, y, z], 0.8); }
  function render() {
    let h = '';
    if (tab === 'pass') {
      const p = D.pass;
      h += `<h5>Объект (штамп ГП-001…005)</h5><table>${rows(p.obj)}</table>`;
      h += `<h5>Состав комплекта ГП</h5><table>${rows(p.sheets)}</table>`;
      h += `<h5>Основные показатели по генплану (ГП-001) ${tag('V')}</h5><table>${rows(p.ind, [0, 'r'])}</table>`;
      h += `<h5>Основные комплекты рабочих чертежей</h5><div>${p.kits}</div><div class="mut" style="margin-top:4px">${p.kitsNote}</div>`;
      h += `<h5>Ссылочные документы</h5><div class="mut">${p.refs}</div>`;
    } else if (tab === 'pav') {
      const p = D.pav;
      h += `<h5>Ведомость проездов, тротуаров и площадок (ГП-003) ${tag('V')}</h5><table><tr><th>Тип</th><th>Наименование</th><th class="r">Кол-во</th></tr>${rows(p.list, [0, 0, 'r'])}</table>`;
      h += `<h5>Конструкции дорожной одежды (сверху вниз)</h5>` + p.types.map(t => `<div class="fx ok"><b>${t[0]}</b><br>${t[1]}</div>`).join('');
      h += `<h5>Малые архитектурные формы и переносные изделия</h5><table><tr><th>Поз.</th><th>Наименование</th><th class="r">Шт.</th><th>Типовой проект</th></tr>${rows(p.maf, [0, 0, 'r', 0])}</table>`;
      h += `<h5>Озеленение</h5><div>${p.green}</div><h5>Примечания листа</h5><div class="mut">${p.notes}</div>`;
      h += `<div class="mut" style="margin-top:6px">В 3D-сцене покрытия показаны текстурой по контурам ГП-003; послойная конструкция в модели не строится — данные приведены как паспортные.</div>`;
    } else if (tab === 'earth') {
      const e = D.earth;
      h += `<h5>Ведомость объёмов земляных масс, м³ (ГП-004) ${tag('V')}</h5><table><tr><th>Наименование</th><th class="r">Насыпь (+)</th><th class="r">Выемка (−)</th></tr>${rows(e.list, [0, 'r', 'r'])}</table><div class="mut">${e.notes}</div>`;
      h += `<h5>Итоги по столбцам сетки (с запада на восток; 8 × 20 м + 12,75 м)</h5><table><tr><th>Столбец</th>${e.cols.map((_, i) => `<th class="r">${i + 1}</th>`).join('')}</tr><tr><td>Насыпь</td>${e.cols.map(c => `<td class="r">${c[0] ? '+' + c[0] : '—'}</td>`).join('')}</tr><tr><td>Выемка</td>${e.cols.map(c => `<td class="r">−${c[1]}</td>`).join('')}</tr></table>`;
      h += `<div class="mut">Контроль: Σ насыпи = ${e.cols.reduce((s, c) => s + c[0], 0)}, Σ выемки = ${e.cols.reduce((s, c) => s + c[1], 0)} — сходится с ведомостью. Площадка почти целиком в срезке.</div>`;
      h += `<label class="sw"><input type="checkbox" id="gpGrid" ${layerApi.isOn('gpgrid') ? 'checked' : ''}> Показать в сцене сетку 20 м с отметками (${D.grid.length} узлов) и реперы</label>`;
      h += `<div class="mut">На узле: красным — проектная отметка, чёрным — существующая (как на листе), ниже — отклонение рельефа модели от проектной. «?» — чтение с листа неуверенное (${D.grid.filter(n => n[4]).length} узлов).</div>`;
    } else if (tab === 'geo') {
      h += `<h5>Система координат и высот (примечание ГП-002) ${tag('V')}</h5><div>Система координат — <b>условная</b>; система высот — <b>Балтийская</b>; все размеры в метрах. X — на север, Y — на восток.</div>`;
      h += `<h5>Реперы</h5><table>${rows(D.rp.map(r => [`<span class="lk" data-rp="${r[0]}">${r[0]}</span>`, 'X = ' + fmt(r[1]), 'Y = ' + fmt(r[2])]))}</table><div class="mut">Отметки реперов на листе не приведены. Положение в сцене — расчётное (слой «Генплан»).</div>`;
      h += `<h5>Привязка 3D-сцены ${tag('C')}</h5><div>По центрам РВС 109.1–109.3 (координаты подписаны на ГП-002). Поворот: север — ${fmt(D.geo.north, 1)}° против часовой стрелки от «верха листа» (совпадает со стрелкой розы ветров, 45,8°). Отметка y = 0 сцены — ${fmt(H0g)}.</div><div class="mut">Точность пересчёта для прочих объектов ±0,5 м (контроль по углам зданий 401, 501, 644, 200, 196).</div>`;
      h += `<h5>Координаты точки</h5><div id="gpPt">${ptHTML()}</div>`;
      h += `<h5>Роза ветров (ГП-002)</h5>${rose()}<div class="mut" style="text-align:center"><span style="color:#c0392b">■</span> июнь &nbsp; <span style="color:#1d4e7a">■</span> январь. Лучи сняты с чертежа в относительных единицах (повторяемость в % на листе не подписана) ${tag('P')}</div>`;
    } else {
      const a = D.aud;
      h += `<div class="mut">Сверка модели с листами ГП-002…004. Отметки путей, площадки эстакады и рельеф (пп. «Ж/д пути…», «Обсыпка…», «Полоса…») исправлены по решению заказчика; масштаб сцены принят без пересчёта координат.</div>`;
      h += a.map(f => `<div class="fx ${f[0] === 'X' ? '' : f[0] === 'V' || f[0] === 'A' ? 'ok' : 'q'}"><b>${f[1]}</b> ${tag(f[0])}<br>${f[2]}${f[3] ? `<br><span class="mut">${f[3]}</span>` : ''}${f[4] ? ` <span class="lk" data-fly="${f[4].join(',')}">показать</span>` : ''}</div>`).join('');
      h += `<h5>Рельеф модели и узлы ГП-004 (расчёт по текущей модели)</h5><div>${audStat()}</div><div class="mut">${D.audStat}</div>`;
      h += cpTable();
    }
    body.innerHTML = h;
    const cb = body.querySelector('#gpGrid'); if (cb) cb.onchange = () => layerApi.setVis('gpgrid', cb.checked);
    body.querySelectorAll('[data-rp]').forEach(el => el.onclick = () => { const r = D.rp.find(q => q[0] === el.dataset.rp), [x, z] = toScene(r[1], r[2]); if (!layerApi.isOn('gpgrid')) layerApi.setVis('gpgrid', true); flyToPt(x, z); });
    body.querySelectorAll('[data-fly]').forEach(el => el.onclick = () => { const [x, z] = el.dataset.fly.split(',').map(Number); flyToPt(x, z); });
  }
  /* v0.17: статистика по узлам ГП-004 и контрольные точки рельефа — считаются по текущей модели (hAt) */
  function audStat() {
    const rows = [];
    for (const n of D.grid) { if (n[4] || inPoly(n[0], n[1], PH.geo.outer)) continue; rows.push([n, H0g + hAtS(n[0], n[1]) - n[2]]); }
    const d = rows.map(r => r[1]).sort((a, b) => a - b), med = d[d.length >> 1];
    const big = rows.filter(r => Math.abs(r[1]) > 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return `По ${rows.length} уверенно прочитанным узлам (вне контура цеха 200): медиана ${med >= 0 ? '+' : '−'}${fmt(Math.abs(med))} м; в пределах ±0,15 м — ${d.filter(v => Math.abs(v) <= 0.15).length}; более 0,3 м — ${big.length}; более 0,5 м — ${d.filter(v => Math.abs(v) > 0.5).length}.` +
      (big.length ? `<table>${big.map(([n, v]) => `<tr><td>(${fmt(n[0], 1)}; ${fmt(n[1], 1)})</td><td class="r">${fmk(n[2])}</td><td class="r">${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}</td><td><span class="lk" data-fly="${n[0]},${n[1]}">показать</span></td></tr>`).join('')}</table>` : '');
  }
  function cpTable() {
    const L = RELIEF17.cps, rows = L.map(c => { const m = H0g + hAtS(c.x, c.z), d = m - c.H; return [c, m, d]; });
    const okN = rows.filter(r => Math.abs(r[2]) <= 0.10).length;
    return `<h5>Контрольные точки рельефа</h5><div>${L.length} точек (ГП-003: отметки и горизонтали; ГП-004: узлы; принятые — между подписанными точками). В пределах ±0,10 м — ${okN}; остальные — у подпорных стенок и откосов, где сетка рельефа 0,5/2,5 м не передаёт уступ (стенка показана отдельно).</div>` +
      `<details><summary class="lk">таблица</summary><table><tr><th>Точка</th><th>Источник</th><th class="r">Лист</th><th class="r">Модель</th><th class="r">Δ</th><th></th></tr>` +
      rows.map(([c, m, d]) => `<tr><td>${c.lbl}${c.note ? `<br><span class="mut">${c.note}</span>` : ''}</td><td>${c.src} ${tag(c.st)}</td><td class="r">${fmk(c.H)}</td><td class="r">${fmt(m)}</td><td class="r">${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}</td><td><span class="lk" data-fly="${c.x},${c.z}">показать</span></td></tr>`).join('') + '</table></details>';
  }
  function ptHTML() {
    if (!lastPt) return '<span class="mut">Нажмите на любую точку сцены (землю, объект) — здесь появятся её координаты X/Y и отметка.</span>';
    const r = toReal(lastPt.x, lastPt.z);
    return `X = <b>${fmt(r.X)}</b>; Y = <b>${fmt(r.Y)}</b>; отметка точки <b>${fmt(H0g + lastPt.y)}</b> ${tag('C')}<br><span class="mut">Поверхность земли модели в этой точке: ${fmt(H0g + hAtS(lastPt.x, lastPt.z))}. Точность в плане ±0,5 м.</span>`;
  }
  const _p = new THREE.Vector3();
  function onPick(hit, r) {
    if (hit && hit.point) lastPt = hit.point.clone();
    else if (r) {   // объект не указан — пересечение луча с рельефом модели (шаг 0,5 м + деление пополам)
      let t = 1, ok = false;
      for (; t < 900; t += 0.5) { _p.copy(r.origin).addScaledVector(r.direction, t); if (_p.y <= hAtS(_p.x, _p.z)) { ok = true; break; } }
      if (!ok) return;
      let a = t - 0.5, b = t;
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; _p.copy(r.origin).addScaledVector(r.direction, m); if (_p.y <= hAtS(_p.x, _p.z)) b = m; else a = m; }
      lastPt = _p.clone();
    } else return;
    if (panel.style.display === 'flex' && tab === 'geo') { const el = body.querySelector('#gpPt'); if (el) el.innerHTML = ptHTML(); }
  }
  return { D, toReal, toScene, cardHTML, tick, hidePanel, showPanel, onPick, scale: SC, get built() { return built; }, get lastPt() { return lastPt; } };
})();
window.__GEO = GEO;


