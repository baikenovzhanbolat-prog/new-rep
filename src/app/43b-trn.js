/* =====================================================================================
   v0.50 — ОБУЧЕНИЕ ПРИ ВИРТУАЛЬНОМ ОБХОДЕ (модуль TRN)
   Задания выполняются в режиме «Обход» (WALK) и проверяются по состоянию модели, а не по нажатию «выполнено»:
     • маршрут осмотра — контрольная точка засчитывается, когда объект удерживается в прицеле обхода не менее
       dwell секунд (WALK.st.aim, дальность прицела 14 м); после осмотра — контрольные вопросы;
     • вопросы — из data/trn-tasks.json; ответы взяты из строк паспортов (27-dxd.js) со статусом «подтверждено»,
       источник показывается после ответа; засчитывается ответ с первой попытки;
     • поиск неисправности — вводится скрытая неисправность модуля ПАЗ (EMG.F): отказ насоса цеха 200
       (защита двигателя, пуск блокируется) или заклинивание арматуры с электроприводом. Обучаемый находит её
       по карточкам и индикации при обходе и докладывает кнопкой «Доложить» с объектом в прицеле;
       по завершении введённая неисправность снимается (если её не сняли раньше на вкладке «ПАЗ»);
     • протокол — сводка по маршруту и поиску, выгрузка в текстовый файл. Хранится только в текущем сеансе.
   Ограничения: банк вопросов учебный — до применения утверждается ответственным за обучение;
   неисправность вводится только в неработающий насос, чтобы не нарушить идущую операцию.
   ===================================================================================== */
const TRN = (() => {
  const B = /*@json data/trn-tasks.json*/null;
  const L = procLogic;
  const fmtT = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, '0')} с`; };
  const clock = d => d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /* ключ объекта в прицеле: насос и арматура — по идентификатору модели ТП, прочее — по номеру генплана */
  const meshPump = Object.fromEntries(Object.entries(L.PU).filter(([, v]) => v.mesh).map(([k, v]) => [v.mesh, k]));
  const keyOf = o => !o ? null : o.proc ? o.proc.id : meshPump[o.id] || o.id;

  /* ---------- состояние ---------- */
  let route = null;        // { r, t0, cp: [{ st: 0|1|2, tIns, ans: [{ pick, ok, first }] }], jumps, done }
  let fault = null;        // { kind, key, n, t0, wrong, found, tEnd, prev }
  let aimKey = null, aimT = 0, lastNow = 0, qOpen = null;
  const log = [];          // журнал занятия
  const note = (t, lvl = 'info') => { log.push({ t: new Date(), m: t, lvl }); if (panel.style.display === 'flex' && tab === 'log') render(); };

  /* ---------- оформление ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #trp{position:fixed;right:10px;top:58px;width:430px;max-width:calc(100% - 20px);max-height:74vh;background:rgba(255,255,255,.97);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);padding:8px 10px;font-size:12.5px;color:#1d2a36;display:none;flex-direction:column;box-sizing:border-box;z-index:30}
    #trp .ph{display:flex;align-items:center;gap:6px} #trp .ph span{font-size:11px;color:#6b7b88;flex:1}
    #trp .tabs{display:flex;gap:4px;margin:6px 0} #trp .tabs button{flex:1;border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:4px 2px;font-size:11.5px;cursor:pointer;color:#1d2a36} #trp .tabs button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #trBody{overflow:auto;flex:1;min-height:0;line-height:1.38}
    #trp h5{margin:9px 0 3px;font-size:11.5px;color:#5b6b78;font-weight:700}
    #trp .cp{border:1px solid #e3e8ed;border-left:4px solid #9aa8b4;border-radius:7px;padding:5px 7px;margin:5px 0;display:flex;gap:6px;align-items:flex-start}
    #trp .cp.s1{border-left-color:#b26a00} #trp .cp.s2{border-left-color:#1f7a3d} #trp .cp .tx{flex:1}
    #trp .mut{color:#6b7b88;font-size:11px} #trp .ok{color:#1f7a3d} #trp .bad{color:#b02a2a}
    #trp .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;align-items:center}
    #trp .warn{background:#fff7e0;border:1px solid #ecd9a0;border-radius:7px;padding:5px 7px;font-size:11.5px;margin:4px 0}
    #trp input,#trp select{font:inherit;padding:3px 5px;border:1px solid #c5cfd8;border-radius:6px}
    #trp .lg div{border-bottom:1px solid #eef1f4;padding:2px 0} #trp .lg .warn2{color:#8a5a00} #trp .lg .bad{color:#b02a2a} #trp .lg .ok{color:#1f7a3d}
    #trBar{position:fixed;left:50%;transform:translateX(-50%);top:64px;background:rgba(20,32,44,.86);color:#fff;border-radius:10px;padding:6px 10px;font-size:12.5px;display:none;gap:8px;align-items:center;z-index:31;max-width:calc(100% - 24px);box-sizing:border-box}
    #trBar .pr{height:4px;background:rgba(255,255,255,.25);border-radius:2px;width:70px;overflow:hidden} #trBar .pr i{display:block;height:100%;background:#7fd18b;width:0}
    #trBar button{background:#b3261e;color:#fff;border:0;border-radius:7px;padding:4px 9px;font:inherit;cursor:pointer;white-space:nowrap}
    #trQ{position:fixed;left:50%;transform:translateX(-50%);bottom:84px;width:440px;max-width:calc(100% - 24px);background:rgba(255,255,255,.98);color:#1d2a36;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.28);padding:10px 12px;font-size:13px;display:none;z-index:32;box-sizing:border-box}
    #trQ .qa{display:block;width:100%;text-align:left;margin:5px 0;padding:6px 8px;border:1px solid #c5cfd8;border-radius:8px;background:#f6f8fa;font:inherit;cursor:pointer;color:#1d2a36}
    #trQ .qa.ok{background:#e6f4ea;border-color:#1f7a3d} #trQ .qa.bad{background:#fbe9e7;border-color:#b02a2a}
    #trQ .src{font-size:11px;color:#5b6b78;margin-top:6px}
    @media (max-width:700px),(max-height:500px){ #trBar{top:auto;bottom:150px;font-size:12px} #trQ{bottom:10px} }`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'trp';
  panel.innerHTML = `<div class="ph"><b>Обучение</b><span>задания при виртуальном обходе ·</span><button class="lbtn" id="trX">✕</button></div>
 <div class="tabs"><button data-t="route" class="on">Маршрут</button><button data-t="fault">Неисправность</button><button data-t="log">Протокол</button></div><div id="trBody"></div>`;
  document.body.appendChild(panel);
  const bar = document.createElement('div'); bar.id = 'trBar'; document.body.appendChild(bar);
  const qEl = document.createElement('div'); qEl.id = 'trQ'; document.body.appendChild(qEl);
  const body = panel.querySelector('#trBody');
  const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'bTrn'; btn.textContent = 'Обучение';
  btn.title = 'Обучающие задания при обходе: маршрут осмотра с контрольными вопросами, поиск неисправности, протокол';
  document.getElementById('bWalk').insertAdjacentElement('afterend', btn);
  let tab = 'route', trainee = '';
  panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; panel.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  function hidePanel() { panel.style.display = 'none'; btn.classList.remove('on'); }
  function showPanel() {
    closePanels();
    const top = Math.round(document.getElementById('top').getBoundingClientRect().bottom + 6) + 'px';
    panel.style.top = top; panel.style.maxHeight = `calc(100% - ${top} - 60px)`; panel.style.display = 'flex'; btn.classList.add('on'); render();
  }
  panel.querySelector('#trX').onclick = hidePanel;
  btn.onclick = () => panel.style.display === 'flex' ? hidePanel() : showPanel();

  /* ---------- маршрут осмотра ---------- */
  function startRoute(id) {
    const r = B.routes.find(q => q.id === id); if (!r) return;
    route = { r, t0: performance.now() / 1000, cp: r.cp.map(() => ({ st: 0, tIns: 0, ans: [] })), jumps: 0, done: false, tEnd: 0 };
    note(`Начат маршрут «${r.n}»: контрольных точек — ${r.cp.length}.`);
    if (!WALK.on) WALK.enter();
    hidePanel(); updBar();
  }
  function stopRoute(why) {
    if (!route) return;
    if (!route.done) { route.done = true; route.tEnd = performance.now() / 1000; note(`Маршрут прерван${why ? ': ' + why : ''}. ${sumRoute().line}`, 'warn2'); }
    closeQ(); updBar(); render();
  }
  function cpOfKey(k) {
    if (!route || route.done || !k) return -1;
    return route.r.cp.findIndex((c, i) => route.cp[i].st === 0 && c.aim.includes(k));
  }
  function inspected(i) {
    const c = route.r.cp[i], s = route.cp[i];
    s.st = 1; s.tIns = performance.now() / 1000 - route.t0;
    note(`Осмотрено: ${c.n} (${fmtT(s.tIns)} от начала).`, 'ok');
    if (c.q && c.q.length) openQ(i, 0); else finishCp(i);
  }
  function finishCp(i) {
    route.cp[i].st = 2;
    if (route.cp.every(s => s.st === 2)) { route.done = true; route.tEnd = performance.now() / 1000; note(`Маршрут завершён. ${sumRoute().line}`, 'ok'); toast('Маршрут осмотра завершён — итог во вкладке «Протокол» панели «Обучение».', 'ok'); }
    updBar(); render();
  }
  function sumRoute() {
    if (!route) return { line: '' };
    const n = route.cp.length, ins = route.cp.filter(s => s.st > 0).length;
    let q = 0, qOk = 0; route.r.cp.forEach((c, i) => (c.q || []).forEach((_, j) => { q++; const a = route.cp[i].ans[j]; if (a && a.first) qOk++; }));
    const t = (route.done ? route.tEnd : performance.now() / 1000) - route.t0;
    return { n, ins, q, qOk, t, line: `Осмотрено ${ins} из ${n}; верно с первой попытки ${qOk} из ${q}; переходов по точкам — ${route.jumps}; время ${fmtT(t)}.` };
  }

  /* ---------- вопрос ---------- */
  function openQ(i, j) {
    const q = route.r.cp[i].q[j], ord = q.a.map((_, k) => k);
    for (let k = ord.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [ord[k], ord[m]] = [ord[m], ord[k]]; }
    qOpen = { i, j, ord, tries: 0 };
    qEl.innerHTML = `<div class="mut">${esc(route.r.cp[i].n)} · вопрос ${j + 1} из ${route.r.cp[i].q.length}</div><b>${esc(q.t)}</b>` +
      ord.map(k => `<button class="qa" data-k="${k}">${esc(q.a[k])}</button>`).join('') + `<div id="trQr"></div>`;
    qEl.style.display = 'block';
    qEl.querySelectorAll('.qa').forEach(b => b.onclick = () => answer(+b.dataset.k, b));
  }
  function answer(k, b) {
    if (!qOpen) return;
    const { i, j } = qOpen, q = route.r.cp[i].q[j], s = route.cp[i];
    qOpen.tries++;
    if (k !== q.ok) {
      b.classList.add('bad'); b.disabled = true;
      if (!s.ans[j]) s.ans[j] = { first: false, pick: q.a[k] };
      qEl.querySelector('#trQr').innerHTML = `<div class="bad">Неверно. Выберите другой ответ.</div>`;
      return;
    }
    b.classList.add('ok');
    if (!s.ans[j]) s.ans[j] = { first: true, pick: q.a[k] };
    s.ans[j].ok = true; s.ans[j].tries = qOpen.tries;
    note(`Вопрос «${q.t}» — ${s.ans[j].first ? 'верно с первой попытки' : `верно с ${qOpen.tries}-й попытки`}.`, s.ans[j].first ? 'ok' : 'warn2');
    qEl.querySelectorAll('.qa').forEach(x => x.disabled = true);
    const last = j + 1 >= route.r.cp[i].q.length;
    qEl.querySelector('#trQr').innerHTML = `<div class="ok">Верно.${q.why ? ' ' + esc(q.why) : ''}</div><div class="src">Источник: ${esc(q.src)}</div>` +
      `<button class="qa" id="trQn" style="text-align:center;margin-top:8px">${last ? 'Продолжить обход' : 'Следующий вопрос'}</button>`;
    qEl.querySelector('#trQn').onclick = () => { closeQ(); if (last) finishCp(i); else openQ(i, j + 1); };
  }
  function closeQ() { qOpen = null; qEl.style.display = 'none'; qEl.innerHTML = ''; }

  /* ---------- поиск неисправности ---------- */
  const E = () => window.__EMG;
  function walkValves() {   // арматура модели ТП, доступная прицелу обхода
    const s = new Set(); for (const m of pickables) { const o = m.userData.o; if (o && o.proc && o.proc.k === 'valve' && L.V[o.proc.id]) s.add(o.proc.id); }
    return [...s];
  }
  function startFault(kind) {
    const em = E(); if (!em) return;
    if (fault && !fault.tEnd) { toast('Поиск неисправности уже идёт.', 'err'); return; }
    let cand, key, n, prev;
    if (kind === 'valve') {
      cand = walkValves().filter(v => !em.F.valve[v]);
      if (!cand.length) { toast('Нет арматуры с электроприводом, доступной при обходе.', 'err'); return; }
      key = cand[Math.floor(Math.random() * cand.length)];
      em.F.valve[key] = L.st.valve[key] ? 'open' : 'closed';
      n = 'Поступило сообщение оператора: одна из задвижек (кранов) с электроприводом не выполняет команды. Найдите неисправную арматуру при обходе и доложите.';
    } else {
      cand = Object.keys(meshPump).map(m => meshPump[m]).filter(p => !L.st.pump[p] && !em.F.pump[p]);
      if (!cand.length) { toast('Все насосы цеха 200 в работе или уже неисправны — остановите насос и повторите.', 'err'); return; }
      key = cand[Math.floor(Math.random() * cand.length)];
      em.F.pump[key] = 'срабатывание защиты двигателя';
      n = 'Поступило сообщение оператора: один из насосных агрегатов цеха 200 не запускается. Найдите неисправный агрегат при обходе и доложите.';
    }
    fault = { kind, key, n, t0: performance.now() / 1000, wrong: [], found: false, tEnd: 0 };
    note(`Начат поиск неисправности (${kind === 'valve' ? 'арматура' : 'насос'}). ${n}`);
    if (!WALK.on) WALK.enter(kind === 'valve' ? undefined : WALK.PTS[4]);
    hidePanel(); updBar();
  }
  function clearFault() {
    const em = E(); if (!em || !fault) return;
    if (fault.kind === 'valve' && em.F.valve[fault.key]) delete em.F.valve[fault.key];
    if (fault.kind === 'pump' && em.F.pump[fault.key]) delete em.F.pump[fault.key];
  }
  function endFault(found, why) {
    if (!fault || fault.tEnd) return;
    fault.found = found; fault.tEnd = performance.now() / 1000; clearFault();
    const t = fmtT(fault.tEnd - fault.t0);
    if (found) { note(`Неисправность найдена: ${fault.key} (${t}; ошибочных докладов — ${fault.wrong.length}). Введённая неисправность снята.`, 'ok'); toast(`Верно: неисправен ${fault.key}. Время поиска ${t}.`, 'ok'); }
    else note(`Поиск неисправности прекращён${why ? ' (' + why + ')' : ''}: неисправным был ${fault.key}; ошибочных докладов — ${fault.wrong.length}. Введённая неисправность снята.`, 'warn2');
    updBar(); render();
  }
  function report() {
    if (!fault || fault.tEnd) return;
    const k = keyOf(WALK.st.aim);
    if (!k) { toast('Наведите прицел на объект, о котором докладываете.', 'err'); return; }
    if (k === fault.key) { endFault(true); return; }
    const isCand = fault.kind === 'valve' ? !!L.V[k] : Object.values(meshPump).includes(k);
    if (!isCand) { toast(`В прицеле — ${k}. Наведите прицел на ${fault.kind === 'valve' ? 'задвижку (кран) с электроприводом' : 'насосный агрегат (опустите взгляд)'}.`, 'err'); return; }
    fault.wrong.push(k); note(`Ошибочный доклад: ${k} исправен.`, 'bad'); toast(`${k}: неисправность не подтверждена. Продолжайте поиск.`, 'err');
  }

  /* ---------- полоса задания в режиме обхода ---------- */
  function updBar() {
    const actR = route && !route.done, actF = fault && !fault.tEnd;
    if (!WALK.on || (!actR && !actF)) { bar.style.display = 'none'; return; }
    let h = '';
    if (actR) { const s = sumRoute(); h += `<span>Маршрут: осмотрено ${s.ins}/${s.n}</span><span class="pr"><i id="trPr"></i></span>`; }
    if (actF) h += `<span>Поиск неисправности</span><button id="trRep" title="Доложить: неисправен объект в прицеле">Доложить</button>`;
    bar.innerHTML = h; bar.style.display = 'flex';
    const b = bar.querySelector('#trRep'); if (b) b.onclick = report;
  }
  function tick() {
    const now = performance.now() / 1000, dt = Math.min(0.5, now - (lastNow || now)); lastNow = now;
    const show = WALK.on && ((route && !route.done) || (fault && !fault.tEnd));
    if ((bar.style.display !== 'none') !== show) updBar();
    if (!route || route.done || !WALK.on || qOpen) { aimT = 0; return; }
    const k = keyOf(WALK.st.aim), i = cpOfKey(k);
    if (i < 0) { aimKey = null; aimT = 0; } else { if (k !== aimKey) { aimKey = k; aimT = 0; } aimT += dt; }
    const pr = bar.querySelector('#trPr'); if (pr) pr.style.width = Math.min(100, aimT / B.dwell * 100) + '%';
    if (i >= 0 && aimT >= B.dwell) { aimT = 0; aimKey = null; inspected(i); }
  }

  /* ---------- протокол ---------- */
  function protocolText() {
    const L2 = [];
    L2.push('ПРОТОКОЛ УЧЕБНОГО ЗАНЯТИЯ — цифровой двойник топливного склада, ТС Оскемен');
    L2.push(`Сформирован: ${clock(new Date())}`);
    L2.push(`Обучаемый: ${trainee || '—'}`);
    L2.push('Вопросы — по подтверждённым данным проектной документации (источник указан); банк учебный, утверждается ответственным за обучение.');
    if (route) {
      const s = sumRoute(); L2.push('', `Маршрут: ${route.r.n} — ${route.cp.every(c => c.st === 2) ? 'завершён' : route.done ? 'прерван' : 'выполняется'}`, s.line);
      route.r.cp.forEach((c, i) => {
        const st = route.cp[i];
        L2.push(`  ${i + 1}. ${c.n}: ${st.st ? 'осмотрено, ' + fmtT(st.tIns) : 'не осмотрено'}`);
        (c.q || []).forEach((q, j) => { const a = st.ans[j]; L2.push(`     — ${q.t} → ${a ? (a.first ? 'верно с первой попытки' : a.ok ? `верно с ${a.tries}-й попытки (первый ответ: ${a.pick})` : `не дан верный ответ (первый ответ: ${a.pick})`) : 'без ответа'} [${q.src}]`); });
      });
    }
    if (fault) {
      L2.push('', `Поиск неисправности (${fault.kind === 'valve' ? 'арматура' : 'насос'}): ${fault.tEnd ? (fault.found ? 'найдена' : 'не найдена') : 'выполняется'}`);
      if (fault.tEnd) L2.push(`  Неисправный объект: ${fault.key}; время ${fmtT(fault.tEnd - fault.t0)}; ошибочные доклады: ${fault.wrong.length ? fault.wrong.join(', ') : 'нет'}`);
    }
    L2.push('', 'Журнал:'); for (const e of log) L2.push(`  ${clock(e.t)}  ${e.m}`);
    return L2.join('\r\n');
  }
  function download() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + protocolText()], { type: 'text/plain;charset=utf-8' }));
    a.download = `protokol-obucheniya-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- панель ---------- */
  function render() {
    if (panel.style.display !== 'flex') return;
    let h = '';
    if (tab === 'route') {
      const act = route && !route.done;
      h += `<div class="warn">${esc(B.note)}</div>`;
      h += `<div class="mut">Контрольная точка засчитывается, когда объект удерживается в прицеле обхода ${String(B.dwell).replace('.', ',')} с (до 14 м). После осмотра — контрольные вопросы. Порядок осмотра — любой.</div>`;
      h += `<div class="row">${act ? `<button class="pbtn" id="trStop">Прервать маршрут</button><button class="pbtn" id="trGo">Продолжить обход</button>` : B.routes.map(r => `<button class="pbtn" data-rt="${r.id}">Начать: ${esc(r.n)}</button>`).join('')}</div>`;
      const r = route ? route.r : B.routes[0];
      h += `<h5>${esc(r.n)}${route ? ' — ' + esc(sumRoute().line) : ''}</h5>`;
      r.cp.forEach((c, i) => {
        const st = route ? route.cp[i].st : 0;
        h += `<div class="cp s${st}"><div class="tx"><b>${i + 1}. ${esc(c.n)}</b><div class="mut">${st === 2 ? 'осмотрено, вопросы пройдены' : st === 1 ? 'осмотрено — ответьте на вопрос' : 'не осмотрено'} · вопросов: ${(c.q || []).length}</div></div>` +
          (act && st === 0 && WALK.PTS[c.pt] ? `<button class="pbtn sm" data-pt="${i}" title="Переход в точку обхода «${esc(WALK.PTS[c.pt].n)}» (отмечается в протоколе)">К точке</button>` : '') + `</div>`;
      });
    } else if (tab === 'fault') {
      const act = fault && !fault.tEnd;
      h += `<div class="mut">Скрытая неисправность вводится в модель ПАЗ: насос не запускается (защита двигателя) или арматура не выполняет команды (заклинивание). Признаки — в карточке объекта (E / «Паспорт» при обходе) и в журнале при попытке пуска или перестановки. Найдите объект, наведите на него прицел и нажмите «Доложить».</div>`;
      if (act) h += `<div class="warn">${esc(fault.n)}<br>Идёт ${fmtT(performance.now() / 1000 - fault.t0)}; ошибочных докладов — ${fault.wrong.length}.</div><div class="row"><button class="pbtn" id="trFGo">Продолжить обход</button><button class="pbtn" id="trFStop">Прекратить и показать ответ</button></div>`;
      else h += `<div class="row"><button class="pbtn" data-ft="pump">Насос цеха 200</button><button class="pbtn" data-ft="valve">Арматура с электроприводом</button></div>`;
      if (fault && fault.tEnd) h += `<div class="cp ${fault.found ? 's2' : 's1'}"><div class="tx"><b>${fault.found ? 'Найдена' : 'Не найдена'}: ${esc(fault.key)}</b><div class="mut">Время ${fmtT(fault.tEnd - fault.t0)}; ошибочные доклады: ${fault.wrong.length ? esc(fault.wrong.join(', ')) : 'нет'}</div></div></div>`;
      h += `<div class="mut">Неисправность вводится только в неработающий насос. По завершении она снимается автоматически.</div>`;
    } else {
      h += `<div class="row"><label>Обучаемый <input id="trName" value="${esc(trainee)}" placeholder="Ф. И. О. (необязательно)" maxlength="80"></label><button class="pbtn" id="trDl">Скачать протокол</button></div>`;
      h += `<div class="mut">Протокол хранится только в открытом окне и не передаётся; при закрытии страницы он теряется — скачайте файл.</div>`;
      if (route) { const s = sumRoute(); h += `<h5>Маршрут</h5><div>${esc(s.line)}</div>`; }
      if (fault) h += `<h5>Поиск неисправности</h5><div>${fault.tEnd ? (fault.found ? `<span class="ok">Найдена</span>` : `<span class="bad">Не найдена</span>`) + ` — ${esc(fault.key)}, ${fmtT(fault.tEnd - fault.t0)}, ошибочных докладов ${fault.wrong.length}` : 'выполняется'}</div>`;
      h += `<h5>Журнал (${log.length})</h5><div class="lg">${log.length ? log.slice().reverse().map(e => `<div class="${e.lvl}">${clock(e.t).slice(-8)} — ${esc(e.m)}</div>`).join('') : '<div class="mut">Записей нет</div>'}</div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => startRoute(b.dataset.rt));
    body.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => startFault(b.dataset.ft));
    body.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => {
      const c = route.r.cp[+b.dataset.pt]; route.jumps++; note(`Переход в точку обхода «${WALK.PTS[c.pt].n}».`, 'warn2');
      if (!WALK.on) WALK.enter(WALK.PTS[c.pt]); else WALK.goPoint(WALK.PTS[c.pt]);
      hidePanel(); updBar();
    });
    const on = (id, f) => { const b = body.querySelector('#' + id); if (b) b.onclick = f; };
    on('trStop', () => stopRoute('по команде обучаемого'));
    on('trGo', () => { if (!WALK.on) WALK.enter(); hidePanel(); updBar(); });
    on('trFGo', () => { if (!WALK.on) WALK.enter(); hidePanel(); updBar(); });
    on('trFStop', () => endFault(false, 'по команде обучаемого'));
    on('trDl', download);
    const nm = body.querySelector('#trName'); if (nm) { nm.oninput = () => { trainee = nm.value.trim(); }; nm.onkeydown = e => e.stopPropagation(); }
  }

  const api = { tick, hidePanel, showPanel, startRoute, stopRoute, startFault, endFault, report, protocolText, keyOf, get route() { return route; }, get fault() { return fault; }, B };
  window.__TRN = api;
  return api;
})();
