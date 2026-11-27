/* ---------- Послойный просмотр ---------- */
/* =====================================================================================
   Этап 6.3 (v0.8) — пошаговые операции на ж/д эстакаде 177: слив через УСН, налив через УНЖ-N1,
   аварийный слив через УПВС-80С. Последовательность — по типовой технологии слива/налива ж/д цистерн
   (подготовка, заземление, присоединение устройства, сливной прибор, маршрут и насос, завершение);
   блокировки пуска насосов — через procLogic.onStart (насос не запустится, пока подготовка не выполнена).
   Состояния вагонов и устройств — модельные; ВЦ-N стоит под УСН-N (по АК-045: запад — ВЦ-2, середина — ВЦ-3, восток — ВЦ-1).
   ===================================================================================== */
const ESTOPS = (() => {
  const L = procLogic, Q = ESTQ, A = Q.anim;
  const CARS = [{ vc: 'VC2', usn: 'USN2', v: 'УСН-N2' }, { vc: 'VC3', usn: 'USN3', v: 'УСН-N3' }, { vc: 'VC1', usn: 'USN1', v: 'УСН-N1' }];
  const S = CARS.map(() => ({ chock: false, ground: false, bridge: false, hatch: false, usn: false, cv: false, unzh: false, upvs: false }));
  let sel = 2;                                                         // выбранная цистерна (восток — ВЦ-1)
  const opOf = ['usn', 'usn', 'usn'];                                  // операция — своя для каждой позиции
  const vcName = ci => ({ VC1: 'ВЦ-1', VC2: 'ВЦ-2', VC3: 'ВЦ-3' })[CARS[ci].vc];
  const PN = { L: 'ДТ летнее', Z: 'ДТ зимнее', B: 'бензин' };
  const tank = ci => procSim && procSim.V ? procSim.V[CARS[ci].vc] : null;
  const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const running = node => Object.keys(L.st.pump).some(p => { if (!L.st.pump[p]) return false; const lk = L.pumpLinks(p); return lk.suc.includes(node) || lk.dis.includes(node); });
  const runAny = ci => running(CARS[ci].usn) || (ci === 1 && running('UNZH')) || (ci === 2 && running('UPVS'));
  function sync() {
    S.forEach((s, ci) => {
      A[CARS[ci].usn].target = s.usn ? 1 : 0; A['BR' + ci].target = s.bridge ? 1 : 0; if (A['LID' + ci]) A['LID' + ci].target = s.hatch ? 1 : 0;   // v0.22: крышка люка
      A[CARS[ci].usn].gnd.visible = A[CARS[ci].usn].gclip.visible = s.ground; Q.car && (EST177.chocks[ci].visible = s.chock);
    });
    A.UNZH.target = S[1].unzh ? 1 : 0; A.UPVS.target = S[2].upvs ? 1 : 0;
  }
  const msg = (t, lvl = 'info') => { toast(t, lvl); };

  /* ---------- шаги операций ---------- */
  // каждый шаг: k, n (текст), done(s, ci), can(s, ci) → null | причина, run(s, ci)
  const valveOn = v => !!L.st.valve[v];
  const common = [
    { k: 'chock', n: 'Установить тормозные башмаки под колёса цистерны', done: s => s.chock, run: s => { s.chock = true; } },
    { k: 'ground', n: 'Подключить заземление: проводник устройства → рама цистерны', done: s => s.ground, can: s => s.chock ? null : 'сначала закрепите цистерну башмаками', run: s => { s.ground = true; } },
    { k: 'bridge', n: 'Опустить переходной мостик МП на цистерну', done: s => s.bridge, can: s => s.ground ? null : 'сначала подключите заземление', run: s => { s.bridge = true; } },
    { k: 'hatch', n: 'Вскрыть люк, отобрать пробу и замерить уровень', done: s => s.hatch, can: s => s.bridge ? null : 'опустите мостик', run: (s, ci) => { s.hatch = true; const v = tank(ci); msg(v ? `${vcName(ci)}: ${v.prod ? PN[v.prod] : 'пусто'}, ${fmt(v.vol)} м³ из ${fmt(v.cap, 0)} (модель)` : 'Проба отобрана.', 'ok'); } }
  ];
  const OPS = {
    usn: {
      n: 'Нижний слив через УСН', ok: () => true,
      prep: ci => [...common,
        { k: 'usn', n: `Подвести стрелу и присоединить ${CARS[ci].v} к сливному прибору`, done: s => s.usn, can: s => s.ground ? null : 'нет заземления', run: s => { s.usn = true; } },
        { k: 'usnv', n: `Открыть задвижку ${CARS[ci].v}`, done: () => valveOn(CARS[ci].v), can: s => s.usn ? null : 'устройство не присоединено', run: () => L.setValve(CARS[ci].v, true) },
        { k: 'cv', n: 'Открыть нижний сливной прибор цистерны (штангой через колпак)', done: s => s.cv, can: s => !s.usn ? 'устройство не присоединено' : !s.hatch ? 'люк не вскрыт' : null, run: s => { s.cv = true; } },
        { k: 'route', n: 'Собрать маршрут и запустить насос (вкладка «Маршруты»)', done: () => running(CARS[ci].usn), run: () => goRoute(ci, CARS[ci].usn) }],
      fin: ci => [
        { k: 'cvc', n: 'Закрыть нижний сливной прибор', done: s => !s.cv, can: () => runAny(ci) ? 'насос в работе — остановите перекачку' : null, run: s => { s.cv = false; } },
        { k: 'usnvc', n: `Закрыть задвижку ${CARS[ci].v}`, done: () => !valveOn(CARS[ci].v), run: () => L.setValve(CARS[ci].v, false) },
        { k: 'usnoff', n: `Отсоединить ${CARS[ci].v}, стрелу — в гаражное положение`, done: s => !s.usn, can: s => s.cv || valveOn(CARS[ci].v) ? 'закройте сливной прибор и задвижку' : null, run: s => { s.usn = false; } },
        ...finCommon]
    },
    unzh: {
      n: 'Верхний налив через УНЖ-N1', ok: ci => ci === 1,
      prep: ci => [...common,
        { k: 'cvchk', n: 'Проверить: нижний сливной прибор цистерны закрыт', done: s => !s.cv, run: s => { s.cv = false; } },
        { k: 'unzh', n: 'Ввести наливную трубу УНЖ-N1 в люк (рабочее положение, крышка-уплотнитель на горловине)', done: s => s.unzh, can: s => s.hatch ? null : 'люк не вскрыт', run: s => { s.unzh = true; } },
        { k: 'route', n: 'Собрать маршрут М4 и запустить насос (клапан «СЕНС» откроется по команде)', done: () => running('UNZH'), run: () => goRoute(ci, 'UNZH') }],
      fin: ci => [
        { k: 'unzhoff', n: 'Поднять трубу, УНЖ-N1 — в гаражное положение', done: s => !s.unzh, can: () => running('UNZH') ? 'налив не остановлен' : null, run: s => { s.unzh = false; } },
        ...finCommon]
    },
    upvs: {
      n: 'Аварийный верхний слив через УПВС-80С', ok: ci => ci === 2,
      prep: ci => [...common,
        { k: 'upvs', n: 'Установить УПВС-80С в люк цистерны', done: s => s.upvs, can: s => s.hatch ? null : 'люк не вскрыт', run: s => { s.upvs = true; } },
        { k: 'upvsv', n: 'Открыть задвижку УПВС-80С', done: () => valveOn('УПВС'), can: s => s.upvs ? null : 'УПВС не установлено', run: () => L.setValve('УПВС', true) },
        { k: 'route', n: 'Собрать маршрут (источник — УПВС-80С) и запустить насос', done: () => running('UPVS'), run: () => goRoute(ci, 'UPVS') }],
      fin: ci => [
        { k: 'upvsvc', n: 'Закрыть задвижку УПВС-80С', done: () => !valveOn('УПВС'), can: () => running('UPVS') ? 'насос в работе' : null, run: () => L.setValve('УПВС', false) },
        { k: 'upvsoff', n: 'Извлечь УПВС-80С из люка', done: s => !s.upvs, can: () => valveOn('УПВС') ? 'закройте задвижку' : null, run: s => { s.upvs = false; } },
        ...finCommon]
    }
  };
  var finCommon = [
    { k: 'hatchc', n: 'Закрыть и опломбировать люк', done: s => !s.hatch, can: s => s.usn && s.cv ? 'сливной прибор открыт' : s.unzh || s.upvs ? 'устройство в люке' : null, run: s => { s.hatch = false; } },
    { k: 'bridgeup', n: 'Поднять переходной мостик', done: s => !s.bridge, can: s => s.hatch ? 'люк открыт' : null, run: s => { s.bridge = false; } },
    { k: 'groundoff', n: 'Отключить заземление', done: s => !s.ground, can: s => s.usn || s.unzh || s.upvs ? 'устройство ещё присоединено' : null, run: s => { s.ground = false; } },
    { k: 'chockoff', n: 'Убрать тормозные башмаки — цистерна готова к уборке', done: s => !s.chock, can: s => s.ground ? 'заземление не снято' : null, run: s => { s.chock = false; } }
  ];
  // фаза: подготовка, пока не выполнены все шаги подготовки; завершение — когда операция окончена (насос остановлен после пуска) или по кнопке
  const phase = CARS.map(() => 'prep');
  function stepsOf(ci) { const o = OPS[opOf[ci]]; return phase[ci] === 'prep' ? o.prep(ci) : o.fin(ci); }
  function nextStep(ci) { return stepsOf(ci).find(st => !st.done(S[ci], ci)); }
  function doStep(ci, st) {
    const why = st.can ? st.can(S[ci], ci) : null;
    if (why) { msg(`${vcName(ci)}: «${st.n}» — нельзя: ${why}.`, 'err'); return false; }
    st.run(S[ci], ci); sync(); render(); return true;
  }
  function goRoute(ci, node) {
    const v = tank(ci), prod = v && v.prod;
    const rid = node === 'UNZH' ? 'М4' : prod === 'Z' ? 'М2' : prod === 'B' ? 'М3' : 'М1';
    const r = PROC.routes.find(x => x.id === rid); if (!r || !r.src.concat(r.dst).includes(node)) { msg(`Для ${vcName(ci)} маршрут через ${node === 'UNZH' ? 'УНЖ-N1' : CARS[ci].v} по схеме не предусмотрен (АК-004: ДТ(З) и бензин — только через УСН-N1).`, 'err'); return; }
    prSel.r = r; prSel.dose = ''; if (node === 'UNZH') { prSel.dst = 'UNZH'; prSel.src = null; } else prSel.src = node;
    prSetTab('routes'); msg(`Выбран маршрут ${r.id}: соберите маршрут и запустите насос.`, 'ok');
  }

  /* ---------- блокировки пуска (АК-002/004 и технология слива/налива) ---------- */
  L.onStart((pid, lk) => {
    const miss = (ci, need) => need.filter(([k, nm, inv]) => inv ? S[ci][k] : !S[ci][k]).map(x => x[1]);
    for (const n of lk.suc) {
      const ci = CARS.findIndex(c => c.usn === n);
      if (ci >= 0) { const m = miss(ci, [['chock', 'нет тормозных башмаков'], ['ground', 'нет заземления'], ['usn', `${CARS[ci].v} не присоединено`], ['cv', 'нижний сливной прибор закрыт']]); if (m.length) return `${vcName(ci)}: ${m.join(', ')} — выполните подготовку на вкладке «Эстакада»`; }
      if (n === 'UPVS') { const m = miss(2, [['chock', 'нет тормозных башмаков'], ['ground', 'нет заземления'], ['hatch', 'люк не вскрыт'], ['upvs', 'УПВС-80С не установлено']]); if (m.length) return `ВЦ-1 (УПВС-80С): ${m.join(', ')} — подготовка на вкладке «Эстакада»`; }
    }
    if (lk.dis.includes('UNZH')) { const m = miss(1, [['chock', 'нет тормозных башмаков'], ['ground', 'нет заземления'], ['hatch', 'люк не вскрыт'], ['unzh', 'УНЖ-N1 не в рабочем положении'], ['cv', 'открыт нижний сливной прибор', 1]]); if (m.length) return `ВЦ-3 (налив через УНЖ-N1): ${m.join(', ')} — подготовка на вкладке «Эстакада»`; }
    return null;
  });
  // после окончания перекачки (насос остановлен) — переход к завершению
  let was = CARS.map(() => false);
  setInterval(() => {
    let dirty = false;
    CARS.forEach((c, ci) => { const r = runAny(ci); if (was[ci] && !r && phase[ci] === 'prep') { phase[ci] = 'fin'; dirty = true; msg(`${vcName(ci)}: перекачка остановлена — выполните шаги завершения на вкладке «Эстакада».`, 'info'); } was[ci] = r; });
    if (dirty || (prTab === 'est' && procP.style.display === 'flex')) render();
  }, 1000);

  /* ---------- вкладка «Эстакада» ---------- */
  const box = document.getElementById('prEst');
  function render() {
    if (!box || prTab !== 'est') return;
    const op = opOf[sel], o = OPS[op];
    let h = '<div class="oc">Позиции на эстакаде 177 (запад → восток, по АК-045)</div><div class="ecars">';
    [0, 1, 2].forEach(ci => { const v = tank(ci), s = S[ci], chips = [s.chock && 'башмаки', s.ground && 'заземл.', s.bridge && 'мостик', s.hatch && 'люк', s.usn && 'УСН', s.cv && 'прибор откр.', ci === 1 && s.unzh && 'УНЖ', ci === 2 && s.upvs && 'УПВС'].filter(Boolean);
      h += `<button class="ecar${ci === sel ? ' on' : ''}" data-ci="${ci}"><b>${vcName(ci)}</b> · ${CARS[ci].v}${ci === 1 ? ' / УНЖ-N1' : ci === 2 ? ' / УПВС' : ''}<br><span>${v ? (v.prod ? PN[v.prod] : 'пусто') + ', ' + fmt(v.vol) + ' м³' : ''}${runAny(ci) ? ' · <b class="g">идёт перекачка</b>' : ''}</span><br><i>${chips.join(' · ') || 'не подготовлена'}</i></button>`; });
    h += '</div><div class="eops">' + Object.entries(OPS).map(([k, x]) => `<button class="pbtn${k === op ? ' grn' : ''}" data-op="${k}"${x.ok(sel) ? '' : ' disabled title="Для этой позиции не предусмотрено (АК-004/АК-045)"'}>${x.n}</button>`).join('') + '</div>';
    if (!o.ok(sel)) { h += '<div class="rst warn">Для выбранной позиции операция не предусмотрена: УНЖ-N1 — только над ВЦ-3 (середина), УПВС-80С — у ВЦ-1 (восток).</div>'; box.innerHTML = h; bind(); return; }
    let steps = stepsOf(sel), nx = steps.find(st => !st.done(S[sel], sel)), doneMsg = '';
    if (!nx && phase[sel] === 'fin') { phase[sel] = 'prep'; steps = stepsOf(sel); nx = steps.find(st => !st.done(S[sel], sel)); doneMsg = `<div class="rst ok">${vcName(sel)}: операция завершена, цистерна освобождена.</div>`; }
    h += doneMsg + `<div class="oc">${phase[sel] === 'prep' ? 'Подготовка и пуск' : 'Завершение операции'} · ${vcName(sel)}</div><ol class="esteps">`;
    steps.forEach((st, i) => { const d = st.done(S[sel], sel), cur = st === nx; h += `<li class="${d ? 'd' : cur ? 'c' : ''}"><span>${st.n}</span>${cur ? `<button class="pbtn sm grn" data-st="${i}">Выполнить</button>` : d ? '<em>✓</em>' : ''}</li>`; });
    h += '</ol><div class="pbar">';
    if (phase[sel] === 'prep') h += `<button class="pbtn" id="eAuto">Выполнить подготовку целиком</button><button class="pbtn" id="eFin">К завершению</button>`;
    else h += `<button class="pbtn" id="eAuto">Завершить целиком</button><button class="pbtn" id="ePrep">К подготовке</button>`;
    h += '<button class="pbtn" id="eShow">Показать</button></div>';
    h += `<div class="rn">Пуск насоса заблокирован, пока подготовка не выполнена (башмаки, заземление, присоединённое устройство, сливной прибор; при наливе — прибор закрыт, УНЖ в люке). Анимации и состояния — модельные; порядок шагов — типовой, уточняется по технологической инструкции склада.</div>`;
    box.innerHTML = h; bind();
  }
  function bind() {
    box.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => { sel = +b.dataset.ci; render(); showCar(sel); });
    box.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { if (b.disabled) return; if (opOf[sel] !== b.dataset.op && anyPrep(sel)) { msg(`${vcName(sel)}: сначала завершите текущую операцию (${OPS[opOf[sel]].n}).`, 'err'); return; } opOf[sel] = b.dataset.op; phase[sel] = 'prep'; render(); });
    box.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { doStep(sel, stepsOf(sel)[+b.dataset.st]); });
    const a = box.querySelector('#eAuto'); if (a) a.onclick = () => autoRun(sel);
    const f = box.querySelector('#eFin'); if (f) f.onclick = () => { phase[sel] = 'fin'; render(); };
    const p = box.querySelector('#ePrep'); if (p) p.onclick = () => { phase[sel] = 'prep'; render(); };
    const s = box.querySelector('#eShow'); if (s) s.onclick = () => showCar(sel);
  }
  const anyPrep = ci => Object.values(S[ci]).some(Boolean) || valveOn(CARS[ci].v);
  function autoRun(ci) {   // шаги по очереди с паузой (видно анимацию); шаг «маршрут» не выполняется автоматически
    const op0 = opOf[ci], ph0 = phase[ci];
    const go = () => { if (opOf[ci] !== op0 || phase[ci] !== ph0) return; const st = nextStep(ci); if (!st || st.k === 'route') { render(); return; } if (!doStep(ci, st)) return; setTimeout(go, ['usn', 'bridge', 'unzh', 'upvs', 'usnoff', 'bridgeup', 'unzhoff', 'upvsoff'].includes(st.k) ? 1600 : 500); };
    go();
  }
  function showCar(ci) { const x = Q.car[ci]; flyTo([x - 7, EST177.RH + 7.0, EST177.TZ - 9], [x - 1.5, EST177.RH + 1.5, EST177.TZ - 1.5]); }
  sync();
  return {
    S, render, sync, cine: (ci, s) => { Object.assign(S[ci], s); phase[ci] = 'prep'; was[ci] = false; sync(); render(); },   // v0.37
    select: ci => { sel = ci; },
    cardHTML: o => { const ci = o.est === 'UNZH' ? 1 : o.est === 'UPVS' ? 2 : /^BR(\d)/.test(o.est) ? +o.est.slice(2) : ESTQ.CAR_IDX[o.est]; if (ci === undefined) return '';
      const s = S[ci]; return `<div class="n">Состояние (модель): ${vcName(ci)} — ${[s.chock && 'башмаки', s.ground && 'заземление', s.bridge && 'мостик опущен', s.hatch && 'люк вскрыт', s.usn && 'УСН присоединено', s.cv && 'сливной прибор открыт', s.unzh && 'УНЖ в люке', s.upvs && 'УПВС в люке'].filter(Boolean).join(', ') || 'не подготовлена'}.</div><div class="pbar"><button class="pbtn sm grn" data-estopen="${ci}">Операции на эстакаде…</button></div>`; },
    bindCard: el => { const b = el.querySelector('[data-estopen]'); if (b) b.onclick = () => { sel = +b.dataset.estopen; openPanel('proc'); procShow(); prSetTab('est'); }; }
  };
})();

