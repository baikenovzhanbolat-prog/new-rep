/* =====================================================================================
   v0.21 — ПАНЕЛЬ «ДОКУМЕНТЫ ТХ» (модуль DXP): паспорта оборудования по 222.pdf / 333.pdf,
   реестр документов с просмотром страниц без интернета, сверка документации с моделью,
   переключение «прежних вариантов» 3D (для сравнения). Логику ТП не меняет.
   ===================================================================================== */
const DXP = (() => {
  const D = DXD, ST = D.STATUS;
  const css = document.createElement('style');
  css.textContent = `
    #dxp{position:fixed;right:10px;top:58px;width:460px;max-width:calc(100% - 20px);max-height:76vh;background:rgba(255,255,255,.98);border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.22);padding:8px 10px 6px;font-size:12.5px;color:#1d2a36;display:none;flex-direction:column;z-index:7}
    #dxp .ph{display:flex;align-items:flex-start;gap:6px} #dxp .rt{flex:1;min-width:0;line-height:1.25} #dxp .rt b{font-size:14.5px;color:#14324f} #dxp .rt span{display:block;font-size:11px;color:#5b6b78}
    #dxp .lbtn{font-size:13px;padding:3px 9px}
    #dxp .tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin:6px 0 4px} #dxp .tabs button{border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:5px 3px;font-size:11.5px;cursor:pointer;color:#1d2a36;min-width:0}
    #dxp .tabs button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #dxBody{overflow:auto;flex:1;min-height:0;line-height:1.35;padding-right:2px}
    #dxp h5{margin:9px 0 3px;font-size:11px;color:#5b6b78;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
    #dxp table{border-collapse:collapse;width:100%;font-size:11.8px} #dxp td{border-bottom:1px solid #e3e8ed;padding:4px 4px;text-align:left;vertical-align:top}
    #dxp td.k{color:#5b6b78;width:34%} #dxp td.v{font-weight:600;color:#14324f} #dxp td.b{width:1%;white-space:nowrap;text-align:right}
    #dxp .src{font-weight:400;color:#6b7b88;font-size:10.5px;margin-top:2px} #dxp .nt{font-weight:400;color:#8a4b00;font-size:10.8px;margin-top:2px}
    #dxp i.sb{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.02em;padding:1px 5px;border-radius:4px;white-space:nowrap;display:inline-block;cursor:help}
    #dxp .it{display:flex;gap:7px;align-items:flex-start;padding:5px 5px;border-radius:7px;cursor:pointer;border:1px solid transparent} #dxp .it:hover{background:#eef3f7}
    #dxp .it .nm{flex:1;min-width:0} #dxp .it .nm b{font-weight:600;color:#14324f} #dxp .it .nm div{font-size:10.5px;color:#6b7b88}
    #dxp .it .ic{min-width:22px;height:20px;flex:none;border-radius:5px;background:#e5eef7;color:#1d4e7a;font:700 10px/20px system-ui;text-align:center;padding:0 3px}
    #dxp .doc{border:1px solid #dbe3ea;border-radius:8px;padding:6px 8px;margin:5px 0} #dxp .doc .cd{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#14324f}
    #dxp .doc .pg{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px} #dxp .doc .pg button{border:1px solid #c5cfd8;background:#f4f7f9;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer}
    #dxp .doc .pg button:hover{background:#1d4e7a;color:#fff} #dxp .doc .nt2{font-size:10.5px;color:#8a4b00;margin-top:3px}
    #dxp .fd{border-left:4px solid #9aa7b2;background:#f7f9fa;border-radius:6px;padding:5px 7px;margin:5px 0;font-size:11.5px}
    #dxp .fd b{color:#14324f} #dxp .fd div{margin-top:2px;color:#3b4b58} #dxp .fd .a{color:#1d4e7a;font-weight:600}
    #dxp .fd.closed{border-color:#1f7a3d;background:#eef8f1} #dxp .fd.confirmed{border-color:#2f8f5b;background:#f1f9f4} #dxp .fd.partial{border-color:#b8860b;background:#fffaf0}
    #dxp .fd.conflict{border-color:#c0392b;background:#fdf1f0} #dxp .fd.open{border-color:#b8860b;background:#fff8e6} #dxp .fd.note{border-color:#6b7b88}
    #dxp .btns{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0} #dxp .pbtn{font-size:11.5px;padding:4px 9px}
    #dxp .warn{background:#fff6dd;border:1px solid #f0d58a;color:#6b4a00;border-radius:8px;padding:5px 7px;font-size:11.2px;margin:4px 0}
    #dxp label.ly{display:flex;gap:7px;align-items:flex-start;padding:5px 3px;border-bottom:1px solid #eef1f4;cursor:pointer} #dxp label.ly span{flex:1} #dxp label.ly small{display:block;color:#6b7b88;font-size:10.5px}
    #dxp .leg{font-size:10.5px;color:#5b6b78;margin:2px 0 6px;display:flex;flex-wrap:wrap;gap:4px}
    #dxp a{color:#1d4e7a}
    .dxc{margin-top:5px;border-top:1px solid #e3e8ed;padding-top:4px} .dxc .dxh{font-size:11px;font-weight:700;color:#14324f;margin:2px 0}
    .dxc button{font-size:11px;padding:3px 7px;margin:2px 3px 2px 0}
    @media (max-width:700px){
      #dxp{top:auto!important;bottom:8px;left:8px;right:8px;width:auto;max-width:none;max-height:62vh!important;padding:7px 8px 5px}
      #dxp .tabs button{padding:7px 3px} #dxp .lbtn{padding:6px 12px;font-size:15px}
      body.dxpOpen #info{display:none!important} body.dxpOpen #hud{display:none}
    }
    #dxDoc{position:fixed;inset:0;background:rgba(10,18,26,.74);z-index:20;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}
    #dxDoc .dv{background:#fff;border-radius:12px;width:min(1260px,100%);height:min(94vh,100%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4)}
    #dxDoc .dh{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:7px 9px;border-bottom:1px solid #dde4ea;background:#f4f7f9}
    #dxDoc .dh b{font-size:13px;color:#14324f;margin-right:4px} #dxDoc .dh .cd{font:11px ui-monospace,Consolas,monospace;color:#5b6b78} #dxDoc .dh .sp{flex:1}
    #dxDoc .dh button,#dxDoc .dh a{border:1px solid #c5cfd8;background:#fff;border-radius:7px;padding:5px 9px;font-size:12px;cursor:pointer;color:#1d2a36;text-decoration:none}
    #dxDoc .dh button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a} #dxDoc .dh button:disabled{opacity:.4;cursor:default}
    #dxDoc .dc{flex:1;overflow:auto;background:#7d8790;-webkit-overflow-scrolling:touch} #dxDoc .dc img{display:block;margin:10px auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:none}
    #dxDoc .cap{color:#fff;font-size:12px;text-align:center;margin:8px 0 -4px}
    #dxDoc .ft{font-size:11px;color:#5b6b78;padding:5px 9px;border-top:1px solid #dde4ea;background:#f9fbfc}
    @media (max-width:700px){ #dxDoc{padding:0} #dxDoc .dv{border-radius:0;height:100%} #dxDoc .dh button,#dxDoc .dh a{padding:7px 10px} }
  `;
  document.head.appendChild(css);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const badge = st => { const s = ST[st] || ST.NS; return `<i class="sb" style="color:${s.c};background:${s.bg}" title="${esc(s.code + ' — ' + s.d)}">${s.s}</i>`; };
  const objOf = id => (typeof OBJ !== 'undefined' ? OBJ.find(q => q.id === id) : null);
  const objName = id => { const o = objOf(id); return o ? `№ ${id} — ${o.name}` : (id === '—' ? 'общее' : `№ ${id}`); };
  /* ---------- панель ---------- */
  const panel = document.createElement('div'); panel.id = 'dxp';
  panel.innerHTML = `<div class="ph"><div class="rt"><b id="dxTitle">Документация ТХ</b><span id="dxSub">222.pdf · 333.pdf · 444.pdf — рабочий проект 5632.29 (ТОО «АКМАРАЛ»)</span></div><button class="btn lbtn" id="dxX" title="Закрыть">×</button></div>
    <div class="tabs" id="dxTabs"><button data-t="eq">Оборудование</button><button data-t="doc">Документы</button><button data-t="chk">Сверка</button><button data-t="ly">Трубы: аудит</button></div>
    <div id="dxBody"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#dxBody');
  let tab = 'eq', curEq = null;
  function showPanel() { panel.style.display = 'flex'; document.body.classList.add('dxpOpen'); render(); }
  function hidePanel() { panel.style.display = 'none'; document.body.classList.remove('dxpOpen'); }
  panel.querySelector('#dxX').onclick = hidePanel;
  panel.querySelector('#dxTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; curEq = null; render(); };
  function setTabs() { for (const b of panel.querySelectorAll('#dxTabs button')) b.classList.toggle('on', b.dataset.t === tab); }
  const legend = () => `<div class="leg">${Object.keys(ST).map(k => badge(k)).join('')}<span>— статус значения (наведите для расшифровки)</span></div>`;
  function render() {
    setTabs();
    if (tab === 'eq') body.innerHTML = curEq ? eqHTML(curEq) : eqListHTML();
    else if (tab === 'doc') body.innerHTML = docListHTML();
    else if (tab === 'chk') body.innerHTML = chkHTML();
    else body.innerHTML = lyHTML();
    body.scrollTop = 0; bind(body);
  }
  function eqListHTML() {
    const grps = {}; for (const e of D.EQUIP) (grps[e.grp] = grps[e.grp] || []).push(e);
    let h = `<div class="warn">Паспортные данные — из опросных листов, спецификаций и общих данных проекта. Это не показания приборов: состояние насосов и арматуры — в карточках объектов (учебная модель ТП).</div>`;
    for (const [g, list] of Object.entries(grps)) {
      h += `<h5>${esc(g)}</h5>`;
      for (const e of list) h += `<div class="it" data-eq="${esc(e.id)}"><div class="ic">${e.rows.length}</div><div class="nm"><b>${esc(e.n)}</b><div>${e.docs.length} док. · ${esc(objName(e.obj))}</div></div></div>`;
    }
    return h;
  }
  function eqHTML(id) {
    const e = D.EQUIP.find(q => q.id === id); if (!e) return eqListHTML();
    let h = `<div class="btns"><button class="btn pbtn" data-back="1">← Список</button>${objOf(e.obj) ? `<button class="btn pbtn" data-fly="${esc(e.obj)}">Показать на сцене</button>` : ''}</div>`;
    h += `<div style="font-weight:700;color:#14324f;font-size:13px;margin:2px 0 4px">${esc(e.n)}</div>${legend()}<table>`;
    for (const [k, p] of e.rows) h += `<tr><td class="k">${esc(k)}</td><td class="v">${esc(p.v)}<div class="src">${esc(p.src || '')}</div>${p.note ? `<div class="nt">${esc(p.note)}</div>` : ''}</td><td class="b">${badge(p.st)}</td></tr>`;
    h += `</table><h5>Документы</h5>` + e.docs.map(docCard).join('');
    const fs = D.FINDINGS.filter(f => f.obj === e.obj && (f.kind === 'conflict' || f.kind === 'open'));
    if (fs.length) h += `<h5>Расхождения по объекту № ${esc(e.obj)}</h5>` + fs.map(fdHTML).join('');
    return h;
  }
  function docCard(k) {
    const d = D.DOCS[k]; if (!d) return '';
    const F = D.FILES[d.f];
    return `<div class="doc"><div class="cd">${esc(d.code)}</div><div>${esc(d.n)}</div>` +
      `<div class="pg">${d.pages.map(p => `<button data-pg="${d.f}-${p}" data-dk="${esc(k)}">${F.name}, стр. ${p}</button>`).join('')}</div>` +
      (d.note ? `<div class="nt2">${esc(d.note)}</div>` : '') +
      (F.noEmb ? `<div class="nt2">Страницы этого файла в HTML не встроены: PDF открывается кнопкой «PDF», если файл положен в папку docs/ рядом с HTML</div>` : '') + `</div>`;
  }
  function docListHTML() {
    let h = `<div class="warn">Страницы встроены в файл (WebP, 4 тона) и открываются без интернета. Полные PDF — в папке <b>docs/</b> пакета рядом с HTML (кнопка «PDF» в просмотрщике).</div>`;
    for (const [fk, F] of Object.entries(D.FILES)) {
      h += `<h5>${F.name} — ${F.pages} стр., ${F.size}</h5>`;
      for (const [k, d] of Object.entries(D.DOCS)) if (d.f === fk) h += docCard(k);
    }
    return h;
  }
  const KIND = { closed: 'Закрыто', confirmed: 'Подтверждено', partial: 'Частично', open: 'Открыто', conflict: 'Расхождение', note: 'Примечание' };
  const fdHTML = f => `<div class="fd ${f.kind}"><b>${esc(f.id)} · ${KIND[f.kind]} · ${esc(f.obj === '—' ? 'общее' : '№ ' + f.obj)}</b><div>${esc(f.t)}</div>` +
    `<div><i>Документ:</i> ${esc(f.src)}</div><div><i>Модель:</i> ${esc(f.model)}</div><div class="a">${esc(f.act)}</div></div>`;
  function chkHTML() {
    const n = k => D.FINDINGS.filter(f => f.kind === k).length;
    let h = `<div class="warn">Сверка 222.pdf / 333.pdf, 444.pdf, 55555.pdf, Резервуар 1.pdf и комплекта ПТ с моделью: закрыто пунктов реестра — ${n('closed')}, подтверждено — ${n('confirmed')}, частично — ${n('partial')}, расхождений — ${n('conflict')}, открыто — ${n('open')}. Логика ТП и маршруты М1–М9 не менялись: расхождения по логике требуют вашего решения.</div>`;
    for (const k of ['conflict', 'open', 'closed', 'partial', 'confirmed', 'note']) {
      const L = D.FINDINGS.filter(f => f.kind === k); if (!L.length) continue;
      h += `<h5>${KIND[k]} (${L.length})</h5>` + L.map(fdHTML).join('');
    }
    return h;
  }
  /* ---------- v0.28: «Трубы: аудит» — сверка трубопроводов с чертежами (вместо «Вариантов 3D») ---------- */
  const layerOn = k => !!(layerApi && layerApi.isOn && layerApi.isOn(k));
  function lyHTML() {
    const P = window.__PNET, A = typeof F28 !== 'undefined' ? F28 : null, f1 = v => (+v).toFixed(1).replace('.', ',');
    let h = `<div class="warn">Аудит трубопроводов: каждая сеть сверена с листами проекта. Прежние условные модели и слои сравнения удалены из сцены. Значения, которых нет в документах, помечены «условно».</div>`;
    if (!P || !A) return h + '<p>Сеть труб ещё не построена.</p>';
    const agg = {};
    for (const p of P.pipes) {
      const a = agg[p.net] = agg[p.net] || { n: 0, L: 0, U: 0, noOd: 0, ins: 0, od: {} }; let L = 0; for (const s of p.segs) L += s.len;
      a.n++; a.L += L; if (p.under) a.U += L;
      if (p.od) { const k = Math.round(p.od * 1000); a.od[k] = (a.od[k] || 0) + L; } else a.noOd += L;
      if (p.segs.some(s => s.ins)) a.ins += L;
    }
    const iss = {}; for (const i of P.issues) if (i.sev >= 2) { const o = iss[i.net || '—'] = iss[i.net || '—'] || {}; o[i.cat] = (o[i.cat] || 0) + 1; }
    const CN = { CLASH: 'пересечение', NEARP: 'конец рядом с трубой', OPEN: 'обрыв', MIX: 'смешение продуктов', DUP: 'наложение', PAR: 'параллельные вплотную', PROCX: 'ребро ТП частично по трубам', DIAM: 'резкая смена Ø', GAP: 'разрыв', ELEV: 'перепад осей' };
    h += '<h5>Сети: листы, план, диаметры, отметки, изоляция</h5>';
    for (const r of A.AUDIT) {
      const a = agg[r.net]; if (!a) continue;
      const nm = (P.NI[r.net] || {}).nm || r.net;
      const ods = Object.entries(a.od).sort((x, y) => x[0] - y[0]).map(([d, l]) => `Ø${d} — ${f1(l)} м`).join(', ');
      const is = iss[r.net] ? Object.entries(iss[r.net]).map(([c, n]) => `${CN[c] || c}: ${n}`).join('; ') : 'нет';
      h += `<div class="it"><div class="ic">${a.n}</div><div class="nm"><b>${esc(nm)}</b><div>${f1(a.L)} м, из них подземно ${f1(a.U)} м</div>` +
        `<div><b>Листы:</b> ${esc(r.docs)}</div><div><b>План:</b> ${esc(r.plan)}</div>` +
        `<div><b>Ø:</b> ${esc(r.dn)}${ods ? ' · в 3D: ' + esc(ods) : ''}${a.noOd > 0.5 ? ` · без Ø (условно) ${f1(a.noOd)} м` : ''}</div>` +
        `<div><b>Отметки:</b> ${esc(r.elev)}</div><div><b>Изоляция:</b> ${esc(r.ins)}${a.ins > 0.5 ? ` · в 3D ${f1(a.ins)} м` : ''}</div>` +
        `<div><b>Замечания уровня 2–3:</b> ${esc(is)}</div></div></div>`;
    }
    const pg = window.__purgeOld, ins = A.insLog, insL = Object.entries(ins.L).sort((x, y) => x[0] - y[0]).map(([d, l]) => `Ø${d} — ${f1(l)} м`).join(', ');
    if (typeof F34 !== 'undefined') { const L = F34.log; let st = { phys: 0, noz: 0, part: 0, cond: 0 }, bad = [];
      try { const PF = window.__PFLOW, G = PF.L || (window.__F25 && window.__F25.dbg().L); for (const e of G.E) { if (e.k === 'pump') continue; const r = PF.edgeInfo(e); st[r.kind] = (st[r.kind] || 0) + 1; if ((r.kind === 'part' || r.kind === 'cond') && r.gap > 0.05) bad.push(`${e.id} «${e.n}» — разрыв ${(+r.gap).toFixed(2).replace('.', ',')} м`); } } catch (x) { }
      h += `<h5>Устранение расхождений сверки</h5><div class="nt">` +
      `<b>Правило выбора листа при противоречии:</b> детальный рабочий лист раздела (ТХ, ТК М 1:100) — выше сводного плана ГП-005; опросный лист — выше спецификации по типу изделия; ТХ-001 — выше АК по ролям насосов; рабочий лист — выше ТЗ.<br>` +
      `<b>Исправлено в 3D:</b> 1) P51 — дренаж от цеха 200 по 152-ТК-005: z 21,88, поворот x −49,03, ответвление x −54,25 к линии ДТ(З) с задвижкой; трасса ГП-005 (z 20,78) и флажок расхождения у стены сняты, ребро схемы «Дренаж цеха → ДЕ-1» идёт по новой трубе; ` +
      `2) P16 — отвод паров Гу от станции 186 надземно на +5,000 через дорогу (186-ТХ-002 и ТК-005), подземный участок ГП-005 убран, место опуска — условно; ` +
      `3) P52 — ДТ(Л) Ø219 на пункт экипировки (152-ТК-004, разрез 1-1): выход через стену с подъёмом до низа 297,82 (двумя отводами 45°), опуск в 3,65 м от оси 2 к существующему Ø219×6 (глубина — условно); ` +
      `4) P53 — ${L.reg.filter(x => x.startsWith('P53')).length} дренажных отводов Ø32 от агрегатов к коллектору цеха с задвижками (200-ТХ-002; Ду и отметки — условно); ` +
      `5) станция 186 — утеплённые кожухи на 5 задвижках (186-ТХ.ВТ); ` +
      `6) D2, D11 — рабочие насосы по ТХ-001/ОЛ: Н-2 (резерв Н-1), Н-6 (резерв Н-5) — маршруты М1, М4, М8, М9 запускают рабочий насос первым.<br>` +
      `<b>Закрыто решением по документам (3D не менялось):</b> P4, P5, P17, P18, D3, D7, D8, D9, T6, T7, T10.<br>` +
      `Рёбра технологической схемы по трубам: физически — ${st.phys}, до патрубка — ${st.noz}, частично — ${st.part}, условно — ${st.cond}.` +
      (bad.length ? `<br><b>Рёбра с разрывом:</b> ${esc(bad.join('; '))} — все относятся к выходам 8–11 цеха 200 (P34).` : '') +
      `<br><b>Не исправлено — нужно решение:</b> P34 (какой лист верен для выходов 8–11 цеха 200), D1 (Н-7/Н-8 на все продукты или по АК-004), P30 (раздельные блоки ТРК-1 для ДТ и бензина). ` +
      `<b>Нет листов:</b> ТХ-002 РГС-75 (P50), 610-ПТ-002 (P38), ПТ эстакады (P13), 200-ТХ.С листы 2–4 (D10), место ПО-250 и ЗКЛП (P23, P24), пожарный щит 166 (P33), исходный ГП-005 для опор (P47). ` +
      `<b>Несогласованность внутри документов:</b> D4 (ОЛ-007), D5 (УНЖ: исп. 3 ↔ 4), R19 (кран: шифры 200/189).</div>`;
    }
    { const SV = /*@json data/46-dxp.SV.json*/null, ST = { ok: ['соответствует', '#1f7a3d', '#e6f4ea'], part: ['есть расхождения', '#8a5a00', '#fff3d6'], conf: ['листы противоречат', '#a3261b', '#fbe9e7'], data: ['данные в паспортах', '#1d4e7a', '#e5eef7'], none: ['в 3D не отражено', '#5b6b78', '#eceff2'], ref: ['справочно', '#5b6b78', '#eceff2'] };
      const cnt = {}; for (const r of SV) cnt[r[5]] = (cnt[r[5]] || 0) + 1;
      h += `<h5>Сверка всех листов документации (${SV.length}), статусы — после исправлений</h5><div class="nt">` + Object.keys(ST).filter(k => cnt[k]).map(k => `<span style="display:inline-block;margin:0 6px 4px 0;padding:1px 6px;border-radius:4px;color:${ST[k][1]};background:${ST[k][2]}">${ST[k][0]}: ${cnt[k]}</span>`).join('') +
        `<br>Векторные планы сверены с трубами модели автоматически (точки линий листа через 0,25 м, допуск 0,2 м; привязка листа подбиралась по осям труб): ГП-005, 152-ТК-005…008, 200-ТХ-002. Остальные листы — по записям этапов и замечаниям сверки. Шифр открывает лист.</div>`;
      for (const k of ['conf', 'part', 'ok', 'data', 'none', 'ref']) for (const r of SV.filter(q => q[5] === k)) {
        const [dk, code, nm, m3, chk, st, fd] = r, s = ST[st];
        h += `<div style="padding:4px 0;border-top:1px solid rgba(128,128,128,.18);font-size:12px;line-height:1.35"><span style="display:inline-block;min-width:118px;padding:0 5px;border-radius:3px;color:${s[1]};background:${s[2]}">${s[0]}</span> ` +
          (dk ? `<a href="#" data-dk="${esc(dk)}" data-pg="" style="font-weight:600">${esc(code)}</a>` : `<b>${esc(code)}</b>`) + ` — ${esc(nm)}<br><span style="opacity:.8">3D: ${esc(m3)}. Проверка: ${esc(chk)}${fd ? '. Замечания: ' + esc(fd) : ''}</span></div>`;
      } }
    if (typeof F32 !== 'undefined') { const L = F32.log; let st = { phys: 0, noz: 0, part: 0, cond: 0 }, bad = [];
      try { const PF = window.__PFLOW, G = PF.L || (window.__F25 && window.__F25.dbg().L); for (const e of G.E) { if (e.k === 'pump') continue; const r = PF.edgeInfo(e); st[r.kind] = (st[r.kind] || 0) + 1; if ((r.kind === 'part' || r.kind === 'cond') && r.gap > 0.05) bad.push(`${e.id} «${e.n}» — разрыв ${(+r.gap).toFixed(2).replace('.', ',')} м`); } } catch (x) { }
      h += `<h5>Связность технологических трубопроводов</h5><div class="nt">` +
      `Рёбра технологической схемы по трубам модели: физически — ${st.phys}, до патрубка ёмкости — ${st.noz}, частично — ${st.part}, условно — ${st.cond} (178 / 9 / 6 / 13).<br>` +
      `<b>Исправлено:</b> 1) РГС-75 116.1–116.4 — участки «задвижка → патрубок Ø108» (${L.rgs}) включены в сеть: поток доходит до ёмкости по трубе; ` +
      `2) РГС-116.3 — отводы бензина от линий к задвижкам (${L.b3}; на ГП-005 не показаны, по АК-004 — есть, трасса по аналогии с 116.4 — условно); ` +
      `3) Гу — узел ответвления к 186 на коллекторе (x −34,09): крестовина вместо пересечения без соединения; ` +
      `4) дренаж цеха 200 — восстановлен участок ГП-005 x −50,04 → −48,13 (выпал); ` +
      `5) исключены не-трубы: ${L.ug} обрывка условных знаков ГП-005 в слоях ДТ(Л)/Д (в т. ч. дубль линии к 186 в слое дренажа); ` +
      `6) дренажные врезки в продуктовые трубы с задвижками (условно): ${L.drains.length ? esc(L.drains.map(d => d.join(' → ')).join('; ')) : '—'}; ` +
      `7) УСН-N1: общий участок к отводам N1/N3 — отвод ДТ(З) N3 соединён (АК-045); 8) клапан СЕНС УНЖ-N1 — узел схемы на стояке, где стоит клапан.<br>` +
      `<b>Не исправлено — нужно решение (P34):</b> ${bad.length ? esc(bad.join('; ')) : 'нет'}. Все разрывы — у восточной стены цеха 200, выходы 8–11: порядок линий по 200-ТХ-002/АК-041 и по ТК-005/ГП-005 не совпадает.<br>` +
      `Свободные концы технологических линий, которые на ГП-005 тоже заканчиваются (Д у РВС и цеха, Гу x −30,67), оставлены как на листе.</div>`; }
    if (typeof F31 !== 'undefined') { const L = F31.log, f1 = v => (+v).toFixed(1).replace('.', ','), insL = Object.entries(L.ins.L).map(([d, l]) => `Ø${d} — ${f1(l)} м`).join(', ');
      h += `<h5>Опоры трубопроводов по листам ТК и 200-ТХ-002; изоляция</h5><div class="nt">` +
      `1. <b>Наружные опоры</b> — по знакам и номерам на планах 152-ТК-005-0 и 152-ТК-006-0 (444.pdf, стр. 19, 20): построено ${L.built} из ${F31.OUT.length} (ОН35…ОП114, ОН59, ОН74, ОН104)${L.miss.length ? '; не найдена труба у ' + esc(L.miss.join(', ')) : ''}. ` +
      `Листы привязаны к сцене по осям трубопроводов (ТК-005 — 4 см, ТК-006 — 8 см в среднем). Пучки — траверса на 1–2 стойках, одиночные — стойка с опорной плитой; ОН — упоры у башмаков. Опоры несут ${L.pipes} труб. ` +
      `ОН89 и ОП90 (ТК-006) не дублировались — они уже построены по ТК-007 (узел 13); на ТК-006 они в ≈ 0,4 м западнее.<br>` +
      `2. <b>Условные опоры (шаг 3 м)</b> внутри рамок листов у труб с опорами по листу убраны: ${L.skipCond}. Оставлены вне листов и у труб, для которых опор на листах нет: ${L.keepCond}` +
      `${L.noSupInFrame.length ? ' (в рамках листов без опор: ' + esc(L.noSupInFrame.join(', ')) + ')' : ''}.<br>` +
      `3. <b>Проверки</b>: стойка или траверса сквозь другую трубу — ${L.clash.length ? esc(L.clash.map(c => c.join(' / ')).join('; ')) : 'нет'}; пролёты длиннее 7 м — ${L.span.length ? esc(L.span.map(s => s[0] + ' ' + f1(s[1]) + ' м').join('; ')) : 'нет'}; трубы на одной опоре с разницей низа > 0,3 м — ${L.hgt.length ? esc(L.hgt.map(s => s[0]).join(', ')) : 'нет'}. Поток ГСМ и трассы не менялись.<br>` +
      `4. <b>Опоры цеха 200</b> — ${L.hall} (неподвижных ${L.hallFix}): места и марки ОП2…ОП20, ОН1, ОН3, ОН12 по 200-ТХ-002-0; добавлено ${L.hallAdd} (ОП20 на перемычке Ø57 у Н-3 — в АК-041 знака нет). Марки без подписи на листе приняты по соседним в ряду (в карточке отмечено). Тип и конструкция — условно: лист 200-ТХ.С с позициями опор (поз. 65–71) не предоставлен.<br>` +
      `5. <b>Изоляция</b>: станция 186 — коллектор АСН-N1 и обвод узла учёта (186-ТХ.ВТ: Ду80 — 9 м, Ду100 — 4 м; маты 60 мм + сталь 0,5 мм), в 3D ${insL || '—'}; остаток длины по ВТ приходится на колонну АСН-80 (заводское изделие) и вводы — не показан. Обвязка РВС (109-ТХ.ВТ) показана: в 3D Ду200 ≈ 6,7 м, Ду150 ≈ 14,3 м (по ВТ 8 и 11 м — разница от трассировки обвязки в модели).<br>` +
      `6. Экземпляр ГП-005 в проекте («5632.29-ГП-005-0.dwg.pdf») для опор непригоден: геометрия всех слоёв, кроме зданий, стянута в одну точку; опоры взяты с ТК-005/006.</div>` +
      `<div class="btns"><button class="btn pbtn" data-f31v="sup">Опоры у цеха 200</button><button class="btn pbtn" data-f31v="park">Опоры у парка РВС</button><button class="btn pbtn" data-f31v="hall">Опоры в цехе 200</button></div>`; }
    if (typeof F29 !== 'undefined' && F29.TX) h += `<h5>Узлы цеха 200 по плану 200-ТХ-002</h5><div class="nt">Оси труб сняты с векторного листа 200-ТХ-002 (привязка к 18 выходам у стены — расхождение ≤ 1 см). Исправлено ${F29.TX.log.length} мест: убран дубль коллектора Ø200 у оси x −63,1 (на листе — всасывающая и нагнетательная части с разрывом), нитка 26,75 и вторая нитка нагнетания Н-5/Н-6 (29,80); перемычка Ø219 между выходами 30,47 и 30,91 — одна труба; бензин «от РГС» — во всас Н-8, «на 186» — от стояка нагнетания; нагнетание Н-1/Н-2 — на оси линии на ЛСЦ. Пересечений труб в цехе — 0.</div>`;
    if (typeof F29 !== 'undefined') { const L9 = F29.log; h += `<h5>Насосный цех 200 — отметки по 200-ТХ-003</h5><div class="nt">Трубы зала разнесены по отметкам разрезов 1-1…9-9: всас насосов −0,500 (Н-1/Н-2 −0,445), нагнетание Н-8 +0,400, Н-7 +0,100, Н-5/Н-6 0,000, Н-1/Н-2 +0,040, поперечные трубы над коллекторами +0,100 / +0,470 / +0,660, дренаж у пола. Выходы через стену — на отметках разрезов, переход — в 0,4 м от стены. Отмечено ${L9.tag} труб, ${L9.risers} стояков в узлах, ${L9.wallRisers} стояков у наружной стены, Ø приведено к ряду 200-ТХ.С у ${L9.od.length} труб. По аналогии (разрезов нет): всас Н-8, выходы ДТ(Л) Ø159 от РВС и от эстакады, дренаж.</div><div class="btns"><button class="btn pbtn" data-f29v="hall">Насосный зал сверху</button><button class="btn pbtn" data-f29v="sec">Выходы у стены изнутри</button></div>`; }
    h += `<h5>Что исправлено в</h5><div class="nt">` +
      `1. <b>Узел выходов цеха 200</b> (восточная стена): трассы по 152-ТК-005-0 и векторному ГП-005. Убраны 7 ложных четырёхсторонних узлов — трубы, разорванные на листе в месте пересечения, теперь пересекаются без соединения. Врезки — только где на листе тройник.<br>` +
      `2. <b>Линии Б, ДТ(З), ДТ(Л) к станции 186</b> — подземно от цеха до футляров под дорогой (на ТК-005 — пунктир). Линия x −58,89 — ДТ(З) (была в слое ДТ(Л) ГП-005).<br>` +
      `3. <b>Диаметры</b> по подписям листов: ${A.odLog.length} элементов (выходы цеха — 200-ТХ-002; Гу Ø108; дренаж Ø89 и Ø273; патрубки РВС Ду150/Ду200; ДТ(Л) на 166 Ø57).<br>` +
      `4. <b>Теплоизоляция ДТ(Л)</b> 60 мм + сталь 0,5 мм: ${ins.n} элементов${insL ? ' — ' + esc(insL) : ''} (152-ТК.ВТ, 177-ТХ.ВТ, 186-ТХ.ВТ).<br>` +
      `5. <b>Пересечения</b> разводятся повторно с учётом подъёмов соседних труб: наружные технологические сети — без пересечений.<br>` +
      `6. <b>Удалены</b> прежние условные модели и дубли: ${pg ? pg.n : 0} объектов сцены (РВС, РГС, 901, путь 53, 196, вагоны, вышки 800, 186, 166, переход ГП-005, трубы «Л», штрихи подземных трасс, исходная геометрия труб).</div>`;
    h += `<div class="btns"><button class="btn pbtn" data-f28v="node">К узлу выходов цеха 200</button><button class="btn pbtn" data-f28v="wall">К стене цеха 200</button><button class="btn pbtn" data-f25v="st">К станции налива 186</button><button class="btn pbtn" data-f25v="tk13">К переходу ДТ(Л) над дорогой</button><button class="btn pbtn" data-f27v="st">К пункту заправки 166</button><button class="btn pbtn" data-f26v="109.2">К крыше РВС 109.2</button><button class="btn pbtn" data-flyp="901">К лебёдке 901</button><button class="btn pbtn" data-flyp="800.1">К вышке 800.1</button></div>`;
    return h;
  }
  function setLayer(k, on) { if (layerApi && layerApi.setVis && layerApi.LAYERS.find(l => l.k === k)) layerApi.setVis(k, on); }
  /* ---------- камера ---------- */
  const _b = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
  function flyObj(id, sel = true) {
    const o = objOf(id); if (!o) return;
    const g = (o.gM && o.gM.visible) ? o.gM : (o.rvsD || o.gS || o.g);
    _b.setFromObject(g); if (_b.isEmpty()) _b.setFromObject(o.g);
    _b.getCenter(_c); _b.getSize(_s);
    const r = Math.max(6, Math.max(_s.x, _s.z) * 0.9);
    if (id.startsWith('109.') && typeof RVSD !== 'undefined' && RVSD.ladPos) { const p = RVSD.ladPos(id); if (p) { flyTo([p[0] + 10, p[1] + 3, p[2] + 13], p, 0.9); if (sel) select(o); return; } }
    if (id === '186' && window.__F25) { window.__F25.VIEWS.st(); if (sel) select(o); return; }   // v0.25
    if (id === '901' && typeof W901 !== 'undefined') { const p = W901.center(); flyTo([p[0] + 9, p[1] + 6, p[2] + 11], p, 0.9); if (sel) select(o); return; }
    flyTo([_c.x + r * 0.8, _c.y + r * 0.75, _c.z + r * 1.05], [_c.x, _c.y, _c.z], 0.9);
    if (sel) select(o);
  }
  function bind(root) {
    for (const el of root.querySelectorAll('[data-eq]')) el.onclick = () => { tab = 'eq'; curEq = el.dataset.eq; showPanel(); };
    for (const el of root.querySelectorAll('[data-back]')) el.onclick = () => { curEq = null; render(); };
    for (const el of root.querySelectorAll('[data-fly]')) el.onclick = () => flyObj(el.dataset.fly);
    for (const el of root.querySelectorAll('[data-flyp]')) el.onclick = () => flyObj(el.dataset.flyp, false);
    for (const el of root.querySelectorAll('[data-f25v]')) el.onclick = () => window.__F25 && window.__F25.VIEWS[el.dataset.f25v] && window.__F25.VIEWS[el.dataset.f25v]();   // v0.25
    for (const el of root.querySelectorAll('[data-f26v]')) el.onclick = () => window.__F26 && window.__F26.VIEWS.roof(el.dataset.f26v);   // v0.26
    for (const el of root.querySelectorAll('[data-f29v]')) el.onclick = () => typeof F29 !== 'undefined' && F29.VIEWS[el.dataset.f29v] && F29.VIEWS[el.dataset.f29v]();   // v0.29
    for (const el of root.querySelectorAll('[data-f31v]')) el.onclick = () => typeof F31 !== 'undefined' && F31.VIEWS[el.dataset.f31v] && F31.VIEWS[el.dataset.f31v]();   // v0.31
    for (const el of root.querySelectorAll('[data-f28v]')) el.onclick = () => typeof F28 !== 'undefined' && F28.VIEWS[el.dataset.f28v] && F28.VIEWS[el.dataset.f28v]();   // v0.28
    for (const el of root.querySelectorAll('[data-f27v]')) el.onclick = () => window.__F27 && window.__F27.VIEWS[el.dataset.f27v] && window.__F27.VIEWS[el.dataset.f27v]();   // v0.27
    for (const el of root.querySelectorAll('[data-pg]')) el.onclick = () => openDoc(el.dataset.dk, el.dataset.pg);
    for (const el of root.querySelectorAll('[data-ly]')) el.onchange = () => setLayer(el.dataset.ly, el.checked);
  }
  /* ---------- просмотрщик страниц ---------- */
  const dv = document.createElement('div'); dv.id = 'dxDoc';
  dv.innerHTML = `<div class="dv"><div class="dh"><b id="dxdT"></b><span class="cd" id="dxdC"></span><span class="sp"></span>
    <button id="dxdP" title="Предыдущая страница документа">‹</button><span id="dxdN" style="font-size:12px"></span><button id="dxdNx" title="Следующая страница документа">›</button>
    <button data-z="fit" class="on">По ширине</button><button data-z="1">100 %</button><button data-z="2">200 %</button>
    <a id="dxdPdf" target="_blank" rel="noopener" title="Открыть страницу в полном PDF из пакета (docs/ рядом с HTML)">PDF</a><button id="dxdX">Закрыть ✕</button></div>
    <div class="dc" id="dxdC2"></div><div class="ft" id="dxdF"></div></div>`;
  document.body.appendChild(dv);
  const urls = {};
  function pageURL(key) {
    if (urls[key]) return urls[key];
    const el = document.getElementById('dxP_' + key); if (!el) return null;
    const bin = atob(el.textContent.trim()), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return (urls[key] = URL.createObjectURL(new Blob([u8], { type: 'image/webp' })));
  }
  let vDoc = null, vPg = null, zoom = 'fit';
  function openDoc(dk, pg) {
    const d = D.DOCS[dk]; if (!d) return;
    if (vDoc !== dk) zoom = 'fit';
    vDoc = dk; vPg = pg || (d.f + '-' + d.pages[0]); dv.style.display = 'flex'; drawDoc();
  }
  function drawDoc() {
    const d = D.DOCS[vDoc], F = D.FILES[d.f], p = +vPg.split('-')[1], i = d.pages.indexOf(p);
    dv.querySelector('#dxdT').textContent = d.n;
    dv.querySelector('#dxdC').textContent = d.code;
    dv.querySelector('#dxdN').textContent = `${F.name}, стр. ${p} (${i + 1}/${d.pages.length})`;
    dv.querySelector('#dxdP').disabled = i <= 0; dv.querySelector('#dxdNx').disabled = i >= d.pages.length - 1;
    dv.querySelector('#dxdPdf').href = encodeURI(F.pkg) + '#page=' + p;
    for (const b of dv.querySelectorAll('[data-z]')) b.classList.toggle('on', b.dataset.z === zoom);
    const c = dv.querySelector('#dxdC2'), u = pageURL(vPg);
    const st = zoom === 'fit' ? 'width:calc(100% - 20px);height:auto' : '';
    let h = u ? `<img id="dxdImg" src="${u}" alt="стр. ${p}" style="${st}">` : `<div class="cap">Изображение страницы не встроено</div>`;
    const UXC = { '222-13': 'Фрагмент общих указаний (в PDF текст растянут; сжато по горизонтали): назначение насосных агрегатов', '555-16': 'Продолжение указаний по монтажу и первичные средства пожаротушения (в PDF строки выходят за рамку листа и растянуты; сжато по горизонтали и разбито на 3 полосы)' };   // v0.26
    const ux = UXC[vPg] ? pageURL(vPg + 'x') : null;
    if (ux) h += `<div class="cap">${UXC[vPg]}</div><img src="${ux}" style="${zoom === 'fit' ? 'width:calc(100% - 20px)' : ''}">`;
    c.innerHTML = h; c.scrollTop = 0;
    const img = c.querySelector('#dxdImg');
    if (img && zoom !== 'fit') img.onload = () => { img.style.width = (img.naturalWidth * (+zoom) * 0.6) + 'px'; };
    if (img && img.complete && zoom !== 'fit') img.style.width = (img.naturalWidth * (+zoom) * 0.6) + 'px';
    dv.querySelector('#dxdF').textContent = (d.note ? d.note + ' · ' : '') + 'Изображение — растр страницы для просмотра; для печати и точных размеров используйте PDF из пакета.';
  }
  dv.querySelector('#dxdP').onclick = () => { const d = D.DOCS[vDoc], p = +vPg.split('-')[1], i = d.pages.indexOf(p); if (i > 0) { vPg = d.f + '-' + d.pages[i - 1]; drawDoc(); } };
  dv.querySelector('#dxdNx').onclick = () => { const d = D.DOCS[vDoc], p = +vPg.split('-')[1], i = d.pages.indexOf(p); if (i < d.pages.length - 1) { vPg = d.f + '-' + d.pages[i + 1]; drawDoc(); } };
  for (const b of dv.querySelectorAll('[data-z]')) b.onclick = () => { zoom = b.dataset.z; drawDoc(); };
  const closeDoc = () => { dv.style.display = 'none'; };
  dv.querySelector('#dxdX').onclick = closeDoc;
  dv.addEventListener('click', e => { if (e.target === dv) closeDoc(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && dv.style.display === 'flex') { closeDoc(); e.stopPropagation(); } }, true);
  /* ---------- кнопка в верхней панели ---------- */
  const tb = document.createElement('button'); tb.className = 'btn'; tb.id = 'bDoc'; tb.textContent = 'Документы ТХ';
  tb.title = 'Документация (222.pdf, 333.pdf, 444.pdf, 55555.pdf, Резервуар 1.pdf): паспорта оборудования, страницы документов, сверка с моделью';
  const anchor = document.getElementById('bGP'); if (anchor) anchor.insertAdjacentElement('afterend', tb); else (document.getElementById('top') || document.body).appendChild(tb);
  tb.onclick = () => { if (panel.style.display === 'flex') hidePanel(); else { if (typeof closePanels === 'function') closePanels(); showPanel(); } };
  /* ---------- раздел в карточке объекта ---------- */
  const pumpOf = o => {
    if (typeof procLogic === 'undefined') return null;
    if (o.proc && o.proc.k === 'pump') return o.proc.id;
    return Object.keys(procLogic.PU).find(k => procLogic.PU[k].mesh && procLogic.PU[k].mesh === o.id) || null;
  };
  function cardHTML(o) {
    if (!o) return '';
    let h = '';
    const pid = pumpOf(o), pd = pid && D.PUMPDOC[pid];
    if (pd) {
      const p = procLogic.PU[pid];
      h += `<div class="dxh">По документации ТХ</div><div class="n">Роль: <b>${esc(pd.role)}</b>. Предохранительный клапан: ${esc(pd.sppk)}.` +
        (pd.pout ? ` Давление на выходе по расчёту СППК — ${String(pd.pout).replace('.', ',')} МПа (в модели PIS: ${esc(p.P)} МПа по АК-004).` : '') + `</div>` +
        (p.conf ? `<div class="n" style="color:#1f7a3d">${esc(p.conf)}</div>` : '') +
        `<button class="btn" data-dxeq="${esc(pd.eq)}">Паспорт ${esc(pd.eq)}</button>`;
    }
    if (o.proc && o.proc.k === 'valve' && typeof PROC !== 'undefined' && PROC.valves[o.proc.id] && PROC.valves[o.proc.id].tx) {
      h += `<div class="dxh">По документации ТХ</div><div class="n">${esc(PROC.valves[o.proc.id].tx)}</div><button class="btn" data-dxeq="Краны N1–N5">Паспорт кранов N1–N5</button>`;
    }
    const eqs = D.byObj(o.id);
    if (eqs.length) {
      h += `<div class="dxh">Документация ТХ: ${eqs.length} паспорт(а), ${D.docsOfObj(o.id).length} документ(ов)</div>` +
        eqs.map(e => `<button class="btn" data-dxeq="${esc(e.id)}">${esc(e.id)}</button>`).join('');
      const fs = D.FINDINGS.filter(f => f.obj === o.id && f.kind === 'conflict');
      if (fs.length) h += `<div class="n" style="color:#b02a2a">Расхождений с документацией: ${fs.length} — вкладка «Сверка».</div><button class="btn" data-dxchk="1">Сверка</button>`;
    }
    return h ? `<div class="dxc">${h}</div>` : '';
  }
  function bindCard(root) {
    for (const el of root.querySelectorAll('[data-dxeq]')) el.onclick = () => { tab = 'eq'; curEq = el.dataset.dxeq; showPanel(); };
    for (const el of root.querySelectorAll('[data-dxchk]')) el.onclick = () => { tab = 'chk'; curEq = null; showPanel(); };
  }
  const api = { showPanel, hidePanel, openDoc, cardHTML, bindCard, flyObj, setLayer, get state() { return { tab, curEq, open: panel.style.display === 'flex', doc: dv.style.display === 'flex' ? vPg : null }; } };
  window.__DX = api;
  return api;
})();

MATR.apply();                                    // v0.23: фактура материалов (синхронные объекты)
setTimeout(() => MATR.apply(), 4000); setTimeout(() => MATR.apply(), 12000);   // модели, загружаемые асинхронно
