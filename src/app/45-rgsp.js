/* =====================================================================================
   v0.20 — ТЕХНИЧЕСКИЙ ПАСПОРТ РЕЗЕРВУАРА РГС-75 (модуль RGSP)
   Открывается по щелчку/касанию резервуара (или кнопкой в карточке пары 116.x), вкладки:
   Обзор (текущее состояние модели ТП), Паспорт (данные опросного листа и спецификации со статусом источника),
   Оборудование и Патрубки (подсветка узла в 3D, перелёт камеры), Продукт, Документы (просмотр стр. 1–4 без интернета,
   исходный PDF стр. 1–2 встроен; полный файл — в пакете рядом с HTML).
   Технические данные — не показания приборов; текущий объём и уровень — значения учебной модели (procSim).
   ===================================================================================== */
const RGSP = (() => {
  const D = RESERVOIR_DATA, ST = D.STATUS, f = D.fmtN;
  const css = document.createElement('style');
  css.textContent = `
    #rgsp{position:fixed;right:10px;top:58px;width:430px;max-width:calc(100% - 20px);max-height:74vh;background:rgba(255,255,255,.98);border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.22);padding:8px 10px 6px;font-size:12.5px;color:#1d2a36;display:none;flex-direction:column;box-sizing:border-box;z-index:5;border-top:4px solid #1d4e7a}
    #rgsp .ph{display:flex;align-items:flex-start;gap:6px} #rgsp .rt{flex:1;min-width:0;line-height:1.25} #rgsp .rt b{font-size:14.5px;color:#14324f} #rgsp .rt span{display:block;font-size:11px;color:#5b6b78}
    #rgsp .lbtn{font-size:13px;padding:3px 9px}
    #rgsp .rgk{display:flex;gap:4px;margin:6px 0 2px;flex-wrap:wrap} #rgsp .rgk button{border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:3px 8px;font-size:11.5px;cursor:pointer;color:#1d2a36;display:flex;align-items:center;gap:5px}
    #rgsp .rgk button i{width:9px;height:9px;border-radius:50%;display:inline-block} #rgsp .rgk button.on{background:#14324f;color:#fff;border-color:#14324f}
    #rgsp .tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:6px 0 4px} #rgsp .tabs button{border:1px solid #c5cfd8;background:#f4f7f9;border-radius:7px;padding:5px 4px;font-size:11.5px;cursor:pointer;color:#1d2a36;min-width:0}
    #rgsp .tabs button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #rgBody{overflow:auto;flex:1;min-height:0;line-height:1.35;padding-right:2px}
    #rgsp h5{margin:9px 0 3px;font-size:11px;color:#5b6b78;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
    #rgsp table{border-collapse:collapse;width:100%;font-size:11.8px} #rgsp td,#rgsp th{border-bottom:1px solid #e3e8ed;padding:4px 4px;text-align:left;vertical-align:top}
    #rgsp th{color:#5b6b78;font-weight:600;font-size:11px} #rgsp td.v{font-weight:600;color:#14324f} #rgsp td.b{width:1%;white-space:nowrap;text-align:right}
    #rgsp .src{font-weight:400;color:#6b7b88;font-size:10.5px;margin-top:1px}
    #rgsp i.sb{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.02em;padding:1px 5px;border-radius:4px;white-space:nowrap;display:inline-block;margin:1px 0 1px 3px;cursor:help}
    #rgsp .warn{background:#fff6dd;border:1px solid #f0d58a;color:#6b4a00;border-radius:8px;padding:5px 7px;font-size:11.2px;margin:4px 0}
    #rgsp .err{background:#fdecec;border:1px solid #f2b8b8;color:#8a1c1c;border-radius:8px;padding:5px 7px;font-size:11.5px;margin:4px 0;font-weight:600}
    #rgsp .ok{background:#e9f7ee;border:1px solid #b9e2c6;color:#14532d;border-radius:8px;padding:5px 7px;font-size:11.5px;margin:4px 0}
    #rgsp .live{display:grid;grid-template-columns:118px 1fr;gap:6px 10px;align-items:center;margin:4px 0}
    #rgsp .kv{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:11.8px} #rgsp .kv span{color:#5b6b78} #rgsp .kv b{text-align:right;color:#14324f;font-family:ui-monospace,Consolas,monospace;font-size:12.5px}
    #rgsp .kv .big{font-size:17px}
    #rgsp .btns{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
    #rgsp .pbtn{font-size:11.5px;padding:4px 9px}
    #rgsp .eq{display:flex;gap:7px;align-items:flex-start;padding:5px 5px;border-radius:7px;cursor:pointer;border:1px solid transparent} #rgsp .eq:hover{background:#eef3f7} #rgsp .eq.sel{background:#fff1df;border-color:#ffb766}
    #rgsp .eq .nm{flex:1;min-width:0} #rgsp .eq .nm b{font-weight:600;color:#14324f} #rgsp .eq .nm div{font-size:10.5px;color:#6b7b88}
    #rgsp .eq .ic{width:20px;height:20px;flex:none;border-radius:5px;background:#e5eef7;color:#1d4e7a;font:700 10px/20px system-ui;text-align:center}
    #rgsp .eq.na{cursor:default;opacity:.85} #rgsp .eq.na:hover{background:none}
    #rgsp .det{border:1px solid #ffb766;background:#fffaf2;border-radius:8px;padding:6px 8px;margin:4px 0 8px}
    #rgsp .det b{color:#8a4b00} #rgsp .det p{margin:4px 0;font-size:11.5px}
    #rgsp .leg{font-size:10.5px;color:#5b6b78;margin:2px 0 6px} #rgsp .leg i{margin-right:2px}
    #rgsp details summary{cursor:pointer;font-size:11.5px;color:#1d4e7a;margin:4px 0}
    #rgsp .doc{border:1px solid #dbe3ea;border-radius:8px;padding:6px 8px;margin:5px 0} #rgsp .doc.me{border-color:#1d4e7a;box-shadow:0 0 0 1px #1d4e7a inset;background:#f3f8fc}
    #rgsp .doc.miss{background:#f6f7f8;color:#6b7b88} #rgsp .doc .cd{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#14324f}
    #rgsp a{color:#1d4e7a}
    #rgsp tr.ck{cursor:pointer} #rgsp tr.ck:hover td{background:#eef3f7} #rgsp tr.sel td{background:#fff1df}
    body.rgspOpen .lb.lv{opacity:.85}
    @media (max-width:700px){
      #rgsp{top:auto!important;bottom:8px;left:8px;right:8px;width:auto;max-width:none;max-height:60vh!important;padding:7px 8px 5px}
      #rgsp .tabs button{min-width:0;padding:7px 4px;font-size:11.5px} #rgsp .rgk button{padding:5px 9px} #rgsp .lbtn{padding:6px 12px;font-size:15px}
      #rgsp .live{grid-template-columns:96px 1fr}
      body.rgspOpen #info{display:none!important} body.rgspOpen #hud{display:none}
    }
    #rgDoc{position:fixed;inset:0;background:rgba(10,18,26,.74);z-index:20;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}
    #rgDoc .dv{background:#fff;border-radius:12px;width:min(1180px,100%);height:min(94vh,100%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4)}
    #rgDoc .dh{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:7px 9px;border-bottom:1px solid #dde4ea;background:#f4f7f9}
    #rgDoc .dh b{font-size:13px;color:#14324f;margin-right:4px} #rgDoc .dh .sp{flex:1}
    #rgDoc .dh button,#rgDoc .dh a{border:1px solid #c5cfd8;background:#fff;border-radius:7px;padding:5px 9px;font-size:12px;cursor:pointer;color:#1d2a36;text-decoration:none}
    #rgDoc .dh button.on{background:#1d4e7a;color:#fff;border-color:#1d4e7a}
    #rgDoc .dc{flex:1;overflow:auto;background:#7d8790;-webkit-overflow-scrolling:touch} #rgDoc .dc img{display:block;margin:10px auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:none}
    #rgDoc .df{font-size:11px;color:#5b6b78;padding:5px 10px;border-top:1px solid #dde4ea}
    @media (max-width:700px){ #rgDoc{padding:0} #rgDoc .dv{border-radius:0;height:100%} }`;
  document.head.appendChild(css);

  const panel = document.createElement('div'); panel.id = 'rgsp'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Паспорт резервуара');
  panel.innerHTML = `<div class="ph"><div class="rt"><b id="rgT">Паспорт резервуара</b><span id="rgS"></span></div><button class="lbtn" id="rgX" title="Закрыть паспорт">✕</button></div>
    <div class="rgk" id="rgK"></div>
    <div class="tabs" id="rgTabs"><button data-t="ov" class="on">Обзор</button><button data-t="pas">Паспорт</button><button data-t="eq">Оборудование</button><button data-t="noz">Патрубки</button><button data-t="prod">Продукт</button><button data-t="doc">Документы</button></div>
    <div id="rgBody"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#rgBody');
  const IDS = Object.keys(D.TANKS);
  let cur = null, tab = 'ov', comp = null, ov = null, boxH = null, timer = 0, myHelper = null;

  /* ---------- узлы (описания, статусы документа / места) ---------- */
  const COMP = {
    shell: { g: 'Корпус и опоры', ic: 'К', n: 'Корпус (обечайка) Dв 3252 мм', st: 'CONFIRMED', pos: 'MODEL', view: 'side', d: 'Обечайка из стали 09Г2С-8 ГОСТ 5520-79* (ОЛ п. 3), Dв 3252 мм (С-001). Длина обечайки ≈ 8,98 м — так, чтобы габарит с днищами был 9,36 м (L по С-001; по ГП-003 ≈ 9,32 м). Толщина стенки и раскладка листов не указаны: сварные швы (пояса ≈ 1,5 м) и наружная окраска — условно. Внутри — эпоксидное покрытие (ТХ-001).' },
    heads: { g: 'Корпус и опоры', ic: 'Д', n: 'Днища (2 шт.)', st: 'MODEL', pos: 'MODEL', view: 's', d: 'Форма — по контуру на ГП-003: коническое, вылет ≈ 0,19 м, плоская часть Ø ≈ 1,1 м. Тип днища в опросном листе и спецификации не указан — требует уточнения по листу ТХ-002 или паспорту завода (ТОО «ЗСК»).' },
    sup: { g: 'Корпус и опоры', ic: 'О', n: 'Опоры бетонные (2 шт.)', st: 'CONFIRMED', pos: 'MODEL', view: 'side', d: 'Тип опор — бетонные (ОЛ п. 5). Оси опор ±2,70 м от середины резервуара, ширина ≈ 0,30 м — по ГП-003. Ложе 120° и подкладной лист — условно; конструкция опор — по марке КЖ (5632.29-116.1-116.4-КЖ, не предоставлена).' },
    nozP: { g: 'Патрубки', ic: 'П', n: 'Патрубок приёма Ø108×4,0', st: 'CONFIRMED', pos: 'APPROX', view: 'n', d: 'ОЛ п. 17.1: ответные фланцы с прокладками и деталями крепежа для патрубков приёма и раздачи на диаметр Ø108×4,0. Фланец DN100 PN16 — по Ру задвижек 1,6 МПа (С-001 поз. 5), исполнение условно. Место (северное днище, ось на 0,20 м над низом корпуса, на оси линии приёма графа ТП) — условно: лист ТХ-002 отсутствует.' },
    nozV: { g: 'Патрубки', ic: 'Р', n: 'Патрубок раздачи Ø108×4,0', st: 'CONFIRMED', pos: 'APPROX', view: 'n', d: 'ОЛ п. 17.1: ответные фланцы с прокладками и деталями крепежа, Ø108×4,0. Место (северное днище, на оси линии выдачи графа ТП) — условно: лист ТХ-002 отсутствует.' },
    noz50: { g: 'Патрубки', ic: '50', n: 'Патрубок Ду50 с заглушкой (сигнализатор нижнего уровня)', st: 'CONFIRMED', pos: 'APPROX', view: 's', d: 'ОЛ п. 17.2: «предусмотреть в днище резервуара патрубок Ду50 с заглушкой для сигнализатора нижнего уровня». У горизонтального резервуара днище — торцевой элемент корпуса, поэтому патрубок показан на южном днище; ось — на уставке LSA L 300 мм от низа (АК-004). Заглушка фланцевая с бобышкой ¾" NPT (С-001 поз. 18) — условно. Сигнализатор (поставка АК) в комплект резервуара по документам не входит и не показан.' },
    spoolP: { g: 'Патрубки', ic: '~', n: 'Соединительный участок: задвижка приёма → патрубок', st: 'APPROX', pos: 'APPROX', view: 'n', d: 'В графе ТП связь задвижки с резервуаром — условная. Участок Ø108×4,0 с двумя отводами показан условно; трасса по ТХ-002 не подтверждена. В модели трубопроводной сети (PNET) и в расчёте потока не участвует.' },
    spoolV: { g: 'Патрубки', ic: '~', n: 'Соединительный участок: задвижка раздачи → патрубок', st: 'APPROX', pos: 'APPROX', view: 'n', d: 'Как для линии приёма: показан условно, в модели сети не участвует.' },
    valveP: { g: 'Арматура (модель ТП)', ic: 'З', n: 'Задвижка приёма Ду100 (30с41нж, Ру 1,6 МПа)', st: 'CONFIRMED', pos: 'MODEL', view: 'n', ext: 'П', d: 'С-001 поз. 5: ЗКЛ2-100-16 (30с41нж), ОАО «БАЗ», 10 шт. на 4 резервуара, с ответными фланцами. Положение и состояние — по технологическому графу (АК-004/ГП-005); в 3D — маркер арматуры модели ТП. Открыть/закрыть — в карточке задвижки.' },
    valveV: { g: 'Арматура (модель ТП)', ic: 'З', n: 'Задвижка раздачи Ду100 (30с41нж, Ру 1,6 МПа)', st: 'CONFIRMED', pos: 'MODEL', view: 'n', ext: 'В', d: 'С-001 поз. 5: ЗКЛ2-100-16 (30с41нж). Положение и состояние — по технологическому графу (АК-004/ГП-005); в 3D — маркер арматуры модели ТП.' },
    neck1: { g: 'Верх резервуара', ic: 'Г', n: 'Горловина Ду800 №1 с крышкой', st: 'MODEL', pos: 'MODEL', view: 'top', d: 'На ГП-003 у каждого резервуара два круглых знака Ø ≈ 0,98 м на оси — в 0,60 и 2,37 м от северного торца обечайки; размер соответствует фланцу Ду800. Назначение (люк-лаз или монтажная горловина) и конструкция в документах не указаны — показаны условно.' },
    neck2: { g: 'Верх резервуара', ic: 'Г', n: 'Горловина Ду800 №2 с крышкой', st: 'MODEL', pos: 'MODEL', view: 'top', d: 'Второй знак Ø ≈ 0,98 м на ГП-003 (2,37 м от северного торца обечайки). Конструкция — условно.' },
    lz: { g: 'Верх резервуара', ic: 'Л', n: 'Люк замерный Ду150 (ЛЗ-150 У) на патрубке ПЗЛ-150 У', st: 'CONFIRMED', pos: 'APPROX', view: 'top', d: 'С-001 поз. 2–3: по 1 шт. на резервуар, ОАО «Нефтемаш»-Сапкон (Саратов), 5,2 + 9,1 кг. Место — на крышке горловины №1, условно.' },
    smdk: { g: 'Верх резервуара', ic: 'С', n: 'Клапан СМДК-100 на стояке Ду100', st: 'CONFIRMED', pos: 'APPROX', view: 'top', d: 'ТХ-001: для отвода газовоздушной смеси при приёме и отпуске резервуары оборудованы клапанами СМДК-100, расположенными на высоте 3 м от обслуживающей площадки (подтверждено). С-001 поз. 4: СМДК-100 ЧА, ОАО «АОМЗ», 35 кг, с ответными фланцами. Место стояка (горловина №2) и габариты клапана — условно.' },
    lt: { g: 'Верх резервуара', ic: 'LT', n: 'Бобышка 1½" NPT под уровнемер', st: 'CONFIRMED', pos: 'APPROX', view: 'top', d: 'С-001 поз. 17: БП01-1,5" NPT, 1 шт. на резервуар. Уровнемер LT116-xx (диапазон 300…2700 мм) — по АК-004; изображение прибора условное, место — условно.' },
    lsa: { g: 'Верх резервуара', ic: 'LS', n: 'Бобышка ¾" NPT под сигнализатор LSA H', st: 'CONFIRMED', pos: 'APPROX', view: 'top', d: 'С-001 поз. 18: БП01-3/4" NPT, 8 шт. на 4 резервуара — принято по две на резервуар: сверху (LSA H, 2700 мм) и в заглушке Ду50 (LSA L). Приборы — по АК-004, изображение условное.' },
    strips: { g: 'Площадка и лестница', ic: 'П', n: 'Приварные полосы для площадки', st: 'CONFIRMED', pos: 'APPROX', view: 'top', d: 'ОЛ п. 7: приварка полос для площадок и лестниц — требуется. Опирание балок площадки на полосы корпуса показано условно (узел в документах не показан).' },
    ground: { g: 'Корпус и опоры', ic: '⏚', n: 'Заземление', st: 'CONFIRMED', pos: 'APPROX', view: 'side', d: 'ТХ-001 (указания 6–7): оборудование и трубопроводы заземляются для отвода статического электричества и защиты от вторичных проявлений молнии. Места присоединения к корпусу (2 шт.) — условно.' },
    deck: { g: 'Площадка и лестница', ic: 'Пл', n: 'Площадка обслуживания (общая на 4 РГС)', st: 'MODEL', pos: 'MODEL', view: 'deck', shared: 1, d: 'Контур 15,6 × 4,0 м над северными концами резервуаров с проёмами вокруг горловин — по ГП-003. Отметка настила (0,35 м над верхом корпуса), каркас, стойки и ограждение 1,1 м — условно (марка КМ не предоставлена).' },
    stair: { g: 'Площадка и лестница', ic: 'Лс', n: 'Лестница и верхняя площадка', st: 'MODEL', pos: 'MODEL', view: 'stair', shared: 1, d: 'Положение по ГП-003: с запада от резервуара 116.3, подъём к северу, ширина 0,8 м, шаг ступеней в плане ≈ 0,2 м. Уклон ≈ 41° и ограждение — условно.' }
  };
  const EQ_ORDER = ['shell', 'heads', 'sup', 'ground', 'nozP', 'nozV', 'noz50', 'spoolP', 'spoolV', 'valveP', 'valveV', 'neck1', 'neck2', 'lz', 'smdk', 'lt', 'lsa', 'deck', 'stair', 'strips'];
  const VIEW = { n: [0.45, 0.6, -1], s: [0.4, 0.45, 1], top: [0.55, 1.35, 0.7], side: [1, 0.5, 0.35], deck: [0.3, 1.0, 1.1], stair: [-1, 0.6, 0.55] };

  const badge = s => { const q = ST[s] || ST.NS; return `<i class="sb" style="color:${q.c};background:${q.bg}" title="${q.code} — ${q.d}">${q.s}</i>`; };
  const legend = () => `<div class="leg">${Object.keys(ST).map(k => badge(k) + ' ' + ST[k].code.toLowerCase()).join(' &nbsp; ')}</div>`;
  const row = (l, v, s, src, note) => `<tr><td>${l}</td><td class="v">${v}${src || note ? `<div class="src">${[src, note].filter(Boolean).join(' · ')}</div>` : ''}</td><td class="b">${badge(s)}</td></tr>`;
  const P = k => D.COMMON[k];
  const prow = (l, k, fmt = x => x) => { const p = P(k); return row(l, p.v === null ? '—' : fmt(p.v), p.st, p.src, p.note); };
  const tk = () => D.tank(cur);
  const simOf = t => (typeof procSim !== 'undefined' && procSim.V) ? procSim.V[t.simKey] : null;
  const rg = t => RGSD.byK[t.simKey];
  const pairObj = t => rg(t) ? rg(t).o : null;

  /* ---------- состояние резервуара в модели ТП ---------- */
  function stateOf(t) {
    const v = simOf(t); if (!v) return null;
    const h = procSim.level(v), fl = [], al = [];
    for (const fw of procSim.S.flows || []) {
      if (!fw.sinks || !fw.srcs) continue;
      if (fw.sinks.includes(t.simKey)) fl.push({ t: 'fill', q: fw.Q / fw.sinks.length, p: fw.pumps });
      if (fw.srcs.includes(t.simKey)) fl.push({ t: 'drain', q: fw.Q / fw.srcs.length, p: fw.pumps });
    }
    if (procSim.full(v)) al.push(`верхний аварийный уровень (${v.tagH}, ${f(v.hH * 1000)} мм)`);
    if (h <= v.hL + 1e-4) al.push(`нижний аварийный уровень (${v.tagL}, ${f(v.hL * 1000)} мм)`);
    if (v.lsaHFail) al.push(`отказ сигнализатора ${v.tagH} — сценарий инструктора`);
    if (v.vol >= v.cap - 1e-3) al.push('корпус заполнен полностью (модель)');
    return { v, h, fl, al };
  }
  function gauge(t, s) {
    const R = 46, cx = 56, cy = 56, frac = Math.max(0, Math.min(1, s.h / (2 * D.SIM.R))), yL = cy + R - 2 * R * frac;
    const mk = (fr, c, lb) => { const y = cy + R - 2 * R * fr, w = Math.sqrt(Math.max(0, R * R - (y - cy) ** 2)); return `<line x1="${cx - w - 3}" y1="${y}" x2="${cx + w + 3}" y2="${y}" stroke="${c}" stroke-width="1.6" stroke-dasharray="${lb === 'раб.' ? '3 2' : ''}"/><text x="${cx + w + 5}" y="${y + 3}" font-size="8" fill="${c}">${lb}</text>`; };
    return `<svg viewBox="0 0 128 112" width="118" height="104" role="img" aria-label="Уровень продукта (модель)"><defs><clipPath id="rgC"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>
      <circle cx="${cx}" cy="${cy}" r="${R + 2}" fill="#eef1f3" stroke="#8c949a" stroke-width="2"/>
      <rect x="${cx - R}" y="${yL}" width="${2 * R}" height="${cy + R - yL}" fill="${t.product.color}" clip-path="url(#rgC)" opacity=".95"/>
      <line x1="${cx - R}" y1="${yL}" x2="${cx + R}" y2="${yL}" stroke="#7a6420" stroke-width="1" clip-path="url(#rgC)"/>
      ${mk(s.v.hH / (2 * D.SIM.R), '#b42a2a', 'H')}${mk(s.v.hL / (2 * D.SIM.R), '#d97706', 'L')}${mk(D.simH(P('workingVolume').v) / (2 * D.SIM.R), '#1d4e7a', 'раб.')}
      <text x="${cx}" y="${cy + 4}" font-size="13" font-weight="700" text-anchor="middle" fill="#14324f">${f(s.v.vol / P('nominalVolume').v * 100, 0)}%</text></svg>`;
  }
  function liveHTML() {
    const t = tk(), s = stateOf(t); if (!s) return '<div class="warn">Модель техпроцесса недоступна.</div>';
    const nom = P('nominalVolume').v, work = P('workingVolume').v, rho = t.product.density;
    const flow = s.fl.length ? s.fl.map(x => `${x.t === 'fill' ? 'наполнение' : 'опорожнение'} — ${x.p.join(', ') || 'самотёк'}, ≈ ${f(x.q, 1)} м³/ч`).join('; ') : 'покой (перекачки нет)';
    return `<div class="live">${gauge(t, s)}<div class="kv">
        <span>Текущий объём ${badge('SIM')}</span><b class="big">${f(s.v.vol, 1)} м³</b>
        <span>Заполнение (от номинальной 75 м³)</span><b>${f(s.v.vol / nom * 100, 1)} %</b>
        <span>Уровень ${s.v.lt || 'LT'}</span><b>${f(s.h * 1000, 0)} мм</b>
        <span>До рабочего объёма 74 м³</span><b>${f(Math.max(0, work - s.v.vol), 1)} м³</b>
        <span>Масса продукта (V × ρ)</span><b>${f(s.v.vol * rho, 1)} т</b></div></div>
      ${s.al.length ? `<div class="err">⚠ ${s.al.join('; ')}</div>` : ''}
      <div class="${s.fl.length ? 'ok' : 'leg'}" style="margin:3px 0"><b>Состояние (модель ТП):</b> ${flow}</div>
      <div class="leg">Значения — учебной модели техпроцесса, не показания приборов. Заполнение = V / 75 м³ × 100 (номинальная вместимость, ОЛ п. 9); рабочий объём 74 м³ = ${f(work / nom * 100, 1)} % — пунктир «раб.». H/L — уставки LSA ${f(s.v.hH * 1000)} / ${f(s.v.hL * 1000)} мм (АК-004).</div>`;
  }

  /* ---------- вкладки ---------- */
  function rOv() {
    const t = tk(), o = pairObj(t);
    return `<div class="warn"><b>Нумерация</b> — по технологическому графу (ГП-005): восточная пара — 116.1/116.2 (ДТ зимнее), западная — 116.3/116.4 (бензин). Этот резервуар — в паре генплана «${o ? o.id : '—'}», подпись которой ${o && o.id === '116.1–2' ? 'указывает ДТ зимнее' : 'указывает бензин'}. Требует подтверждения (см. «! Нумерация РГС»).</div>
      <div id="rgLive">${liveHTML()}</div>
      <h5>Основные данные</h5><table>
      ${row('Тип', 'РГС-75, горизонтальный стальной, надземный', 'CONFIRMED', 'ОЛ, ТХ-001')}
      ${row('Хранимый продукт', t.product.name, 'CONFIRMED', `${t.doc.code.replace('5632.29-116.1-116.4-', '')}, стр. ${t.doc.page}`)}
      ${prow('Номинальная вместимость', 'nominalVolume', v => v + ' м³')}
      ${prow('Рабочий объём', 'workingVolume', v => v + ' м³')}
      ${row('Плотность продукта', f(t.product.density, 2) + ' т/м³', 'CONFIRMED', 'ОЛ п. 1')}
      ${prow('Рабочее давление', 'workingPressure', v => f(v, 2) + ' МПа')}
      ${prow('Рабочая температура', 'operatingTemperature', v => `от −${-v.min} до +${v.max} °C`)}
      ${prow('Производительность', 'throughput', v => v + ' м³/ч')}
      </table>
      <div class="btns"><button class="pbtn" data-a="fly">Показать резервуар</button><button class="pbtn" data-a="docv">Опросный лист (стр. ${t.doc.page})</button><button class="pbtn" data-a="proc">Ёмкости (модель ТП)</button></div>`;
  }
  function rPas() {
    const t = tk(), v = simOf(t);
    return legend() + `<h5>Аппарат</h5><table>
      ${prow('Наименование', 'designation')}${prow('Тип', 'type')}${prow('Количество', 'quantity')}
      ${row('Позиция по генплану', 'поз. ' + t.id, 'CONFIRMED', 'ТХ-001, ОЛ', 'положение позиции на площадке — по графу ТП (требует подтверждения)')}
      ${prow('Изготовитель', 'manufacturer')}${prow('Масса', 'mass', x => f(x) + ' кг')}
      ${prow('Внутренний диаметр Dв', 'innerDiameter', x => f(x) + ' мм')}${prow('Длина L', 'length', x => f(x) + ' мм')}
      ${prow('Толщина стенки', 'wallThickness')}${prow('Днища', 'headType')}</table>
      <h5>Параметры процесса</h5><table>
      ${prow('Номинальная вместимость', 'nominalVolume', x => x + ' м³')}${prow('Рабочий объём', 'workingVolume', x => x + ' м³')}
      ${prow('Рабочее давление', 'workingPressure', x => f(x, 2) + ' МПа')}${prow('Рабочая температура', 'operatingTemperature', x => `от −${-x.min} до +${x.max} °C`)}
      ${prow('Производительность', 'throughput', x => x + ' м³/ч')}${prow('Подача продукта', 'feedPumps')}
      ${v ? row('Вместимость модели уровня', f(D.SIM.cap, 1) + ' м³', 'MODEL', 'procSim: цилиндр D 3,24 × L 9,36 (с v0.x, не изменялась)', 'градуировочная таблица не предоставлена; уровень и объём модели — условные') : ''}
      ${v ? row('Уставки сигнализаторов', `LSA H ${f(v.hH * 1000)} мм (≈ ${f(D.simV(v.hH), 1)} м³) · LSA L ${f(v.hL * 1000)} мм (≈ ${f(D.simV(v.hL), 1)} м³)`, 'MODEL', `АК-004: ${v.tagH}, ${v.tagL}; объём — по модели уровня`) : ''}
      </table>
      <h5>Конструкция и материалы</h5><table>
      ${prow('Материал основных деталей', 'material')}${prow('Термообработка', 'heatTreatment')}${prow('Тип опор', 'supportType')}${prow('Расположение опор', 'supportsPos')}
      ${prow('Теплоизоляция', 'insulation')}${prow('Полосы для площадок и лестниц', 'weldStrips')}
      ${prow('Скорость проникновения коррозии', 'corrosionRate', x => f(x, 1) + ' мм/год')}${prow('Испытание на МКК', 'mkkTest')}
      ${prow('Теплообменное устройство', 'heatExchanger')}${prow('Внутреннее покрытие', 'innerCoating')}${prow('Срок службы', 'serviceLife', x => x + ' лет')}</table>
      <h5>Условия установки</h5><table>
      ${prow('Место', 'location')}${prow('Установка', 'installation')}${prow('Размещение', 'placement')}${prow('Сейсмичность', 'seismicity', x => x + ' баллов')}
      ${prow('Температура наиболее холодной пятидневки', 'coldest5day', x => '−' + (-x) + ' °C')}${prow('Мин. температура стенки в рабочих условиях', 'minWallTemp', x => '−' + (-x) + ' °C')}
      ${prow('Отметка низа корпуса', 'elevation')}${prow('Площадка обслуживания', 'platform')}</table>
      <h5>Испытания и эксплуатация</h5><table>${prow('Испытание', 'hydroTest')}${prow('Заполнение', 'maxFill')}${prow('Дыхательные клапаны', 'smdk')}</table>
      <h5>Классификация продукта</h5><table>
      ${row('Взрывоопасность (ГОСТ 30852.2-2002)', t.product.hazard, 'CONFIRMED', 'ОЛ п. 1')}${row('Класс опасности (ГОСТ 12.1.007-76*)', String(t.product.hazClass), 'CONFIRMED', 'ОЛ п. 1')}</table>
      <h5>Заказчик и проектировщик</h5><table>${prow('Заказчик аппарата', 'customer')}${prow('Опросный лист заполнил', 'filledBy')}</table>`;
  }
  function eqItem(c, t) {
    const d = COMP[c], o = pairObj(t), det = RGSD.on(o) || d.ext;
    return `<div class="eq${comp === c ? ' sel' : ''}${det ? '' : ' na'}" data-c="${c}"><span class="ic">${d.ic}</span><div class="nm"><b>${d.n}</b><div>документ ${badge(d.st)} · место ${badge(d.pos)}</div></div></div>` +
      (comp === c ? `<div class="det"><b>${d.n}</b><p>${d.d}</p><div class="btns"><button class="pbtn" data-a="cfly">Показать</button><button class="pbtn" data-a="back">← К резервуару</button>${d.ext ? `<button class="pbtn" data-a="vcard">Карточка задвижки</button>` : ''}</div></div>` : '');
  }
  function rEq() {
    const t = tk(); let h = '<div class="leg">Нажмите узел — он подсветится в 3D, камера перелетит к нему. Статусы: «документ» — подтверждение самого элемента, «место» — его положения.</div>';
    if (!RGSD.on(pairObj(t))) h += '<div class="warn">Детальная модель РГС скрыта (слой «РГС-75: детальная модель») — подсветка доступна только для задвижек.</div>';
    let g0 = '';
    for (const c of EQ_ORDER) { const d = COMP[c]; if (d.g !== g0) { h += `<h5>${d.g}</h5>`; g0 = d.g; } h += eqItem(c, t); }
    h += `<h5>По спецификации, но без места установки (в 3D не показаны)</h5>` + D.NOT_SHOWN.map(([n, w]) => `<div class="eq na"><span class="ic" style="background:#eceff2;color:#5b6b78">—</span><div class="nm"><b>${n}</b><div>${w} ${badge('NS')}</div></div></div>`).join('');
    h += `<details><summary>Спецификация 5632.29-116.1-116.4-ТХ.С-001-0 (на 4 резервуара)</summary><table><tr><th>Поз.</th><th>Наименование, тип</th><th>Кол.</th><th>Масса ед., кг</th></tr>` +
      D.SPEC.map(r => `<tr><td>${r[0]}</td><td>${r[1]}${r[2] ? `<div class="src">${r[2]}${r[3] ? ' · ' + r[3] : ''}${r[7] ? ' · ' + r[7] : ''}</div>` : ''}</td><td>${f(r[5], r[5] % 1 ? 1 : 0)} ${r[4]}</td><td>${r[6] === null ? '—' : f(r[6], r[6] % 1 ? 2 : 0)}</td></tr>`).join('') + `</table><div class="leg">Источник: «${D.FILE.name}», стр. 4 ${badge('CONFIRMED')}</div></details>`;
    return h;
  }
  function rNoz() {
    const t = tk(), NZ = [
      ['nozP', 'Приём', 'Ø108×4,0; ответный фланец, прокладка, крепёж', 'приём продукта от насосов Н-7/Н-8 (линия приёма ⌀108×4,0 по ГП-005)'],
      ['nozV', 'Раздача', 'Ø108×4,0; ответный фланец, прокладка, крепёж', 'раздача (выдача) продукта на всас Н-7/Н-8 (линия выдачи ⌀159×4,5 по ГП-005)'],
      ['noz50', 'В днище', 'Ду50 с заглушкой', 'установка сигнализатора нижнего уровня'],
      ['lz', 'Замерный люк', 'Ду150: ЛЗ-150 У на ПЗЛ-150 У', 'замер уровня и отбор проб вручную'],
      ['smdk', 'Дыхательный клапан', 'Ду100: СМДК-100 ЧА, на высоте 3 м от площадки', 'отвод газовоздушной смеси при приёме и отпуске (ТХ-001)'],
      ['lt', 'Бобышка уровнемера', '1½" NPT (БП01-1,5")', 'установка уровнемера'],
      ['lsa', 'Бобышки сигнализаторов', '¾" NPT (БП01-3/4"), 2 шт.', 'установка сигнализаторов уровня'],
      ['neck1', 'Горловины (2 шт.)', 'Ду800 — по знаку на ГП-003', 'не указано']
    ];
    const o = pairObj(t), det = RGSD.on(o);
    return `<div class="leg">Строка — подсветка патрубка в 3D. «Документ» подтверждает характеристику, «место» — расположение на корпусе (лист ТХ-002 «План. Разрезы» в файле отсутствует).</div>
      <table><tr><th>Патрубок</th><th>Характеристика · назначение</th><th class="b">Документ / место</th></tr>` +
      NZ.map(([c, n, s, p]) => `<tr class="${det ? 'ck' : ''}${comp === c ? ' sel' : ''}" data-c="${c}"><td><b>${n}</b></td><td>${s}<div class="src">${p}</div></td><td class="b">${badge(COMP[c].st)}<br>${badge(COMP[c].pos)}</td></tr>`).join('') +
      `</table>${comp && COMP[comp] ? `<div class="det"><b>${COMP[comp].n}</b><p>${COMP[comp].d}</p><div class="btns"><button class="pbtn" data-a="cfly">Показать</button><button class="pbtn" data-a="back">← К резервуару</button></div></div>` : ''}
      <div class="leg" style="margin-top:6px">Ответные фланцы показаны по ГОСТ 33259 PN16 (DN100: Ø220, 8 шпилек М16) — исполнение и Ру фланцев в опросном листе не указаны ${badge('APPROX')}.</div>`;
  }
  function rProd() {
    const t = tk(), p = t.product, s = stateOf(t);
    return `<h5>${p.name} — ${t.doc.code.replace('5632.29-116.1-116.4-', '')}, стр. ${t.doc.page}</h5><table>
      ${row('Наименование', p.name, 'CONFIRMED', 'ОЛ п. 1')}${row('Физическое состояние', p.state, 'CONFIRMED', 'ОЛ п. 1')}${row('Компонентный состав', p.comp, 'CONFIRMED', 'ОЛ п. 1')}
      ${row('Плотность', f(p.density, 2) + ' т/м³', 'CONFIRMED', 'ОЛ п. 1')}${row('Склонность к кристаллизации', p.cryst, 'CONFIRMED', 'ОЛ п. 1')}
      ${row('Температура кипения при 0,07 МПа', '—', 'NS', 'ОЛ п. 1', 'графа не заполнена')}
      ${row('Горючесть, взрывоопасность', p.hazard, 'CONFIRMED', 'ОЛ п. 1, ' + p.hazardStd)}${row('Класс опасности', String(p.hazClass), 'CONFIRMED', 'ОЛ п. 1, ' + p.hazClassStd)}</table>
      <h5>В модели склада</h5><table>
      ${s ? row('Количество (модель)', `<span id="rgMass">${f(s.v.vol, 1)} м³ · ${f(s.v.vol * p.density, 1)} т</span>`, 'SIM', 'масса = объём модели × плотность ОЛ') : ''}
      ${row('Насос перекачки', p.pump + ' (цех 200)', 'MODEL', 'граф ТП: маршруты ' + (p.key === 'Z' ? 'М2' : 'М3') + ', М5, М6; ТХ-001: Н-7, Н-8')}
      ${row('Трубопроводы', p.lines, 'MODEL', 'ГП-005')}
      ${row('Контроль загазованности', p.qe + ' (ДАТ-М, площадка РГС)', 'MODEL', 'АК-004; модуль ПАЗ')}
      ${row('Цвет в модели', `<span style="display:inline-block;width:28px;height:10px;border-radius:3px;background:${p.color};border:1px solid #b8a35a;vertical-align:middle"></span>`, 'APPROX', 'условное обозначение продукта')}</table>`;
  }
  function rDoc() {
    const t = tk(), me = t.doc;
    const docRow = (k, d) => `<div class="doc${d === me ? ' me' : ''}${d.missing || d.other ? ' miss' : ''}"><div class="cd">${d.code}${d.page ? ` · стр. ${d.page}` : ''}</div><div>${d.n}</div><div class="src">${d.type} · поз. ${d.pos}${d === me ? ' · <b>источник данных этого резервуара</b>' : ''}</div>` +
      (d.page && !d.other ? `<div class="btns"><button class="pbtn${d === me ? ' grn' : ''}" data-a="docv" data-p="${d.page}">Просмотр стр. ${d.page}</button>${d.page <= 2 ? `<button class="pbtn" data-a="pdf" data-p="${d.page}">Открыть PDF</button>` : ''}<a class="pbtn" href="${encodeURI(D.FILE.pkg)}#page=${d.page}" target="_blank" rel="noopener">Полный файл (пакет)</a></div>` : '') + '</div>';
    return `<h5>Исходная документация</h5><table>
      <tr><td>Файл</td><td class="v">${D.FILE.name}<div class="src">${D.FILE.pages} стр., ${D.FILE.size}</div></td></tr>
      <tr><td>Для этого резервуара</td><td class="v">${me.type}: ${me.code}<div class="src">стр. ${me.page} · поз. ${me.pos}</div></td></tr></table>` +
      Object.entries(D.DOCS).map(([k, d]) => docRow(k, d)).join('') +
      `<div class="leg">«Просмотр» — страница, встроенная в приложение (работает без интернета, в т. ч. на телефоне). «Открыть PDF» — исходный PDF стр. 1–2, встроенный в HTML (браузер ПК откроет нужную страницу; Android сохранит файл). «Полный файл» — ${D.FILE.pkg} рядом с HTML (папка пакета).</div>
 <h5>Указания листа ТХ-001</h5><ol style="margin:3px 0 0 18px;padding:0;font-size:11.5px">${D.NOTES.map(n => `<li>${n}</li>`).join('')}</ol><div class="leg">Пункты 3–8 в PDF выходят за рамку листа — приведены по читаемой части ${badge('CONFIRMED')}</div>`;
  }
  const R_ = { ov: rOv, pas: rPas, eq: rEq, noz: rNoz, prod: rProd, doc: rDoc };
  function render() {
    if (!cur) return;
    const t = tk();
    panel.querySelector('#rgT').textContent = 'Паспорт резервуара РГС-' + t.id;
    panel.querySelector('#rgS').textContent = `${t.product.name} · РГС-75 · ${t.doc.code.replace('5632.29-', '')}`;
    panel.querySelector('#rgK').innerHTML = IDS.map(id => { const q = D.tank(id); return `<button data-k="${id}" class="${id === cur ? 'on' : ''}" title="${q.product.name}"><i style="background:${q.product.color}"></i>${id}</button>`; }).join('');
    panel.querySelectorAll('#rgTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const sc = body.scrollTop; body.innerHTML = R_[tab](); if (tab === 'eq' || tab === 'noz') body.scrollTop = sc;
  }
  panel.querySelectorAll('#rgTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; body.scrollTop = 0; render(); });
  panel.querySelector('#rgK').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) open(b.dataset.k, { tab, fly: true }); });
  panel.querySelector('#rgX').onclick = () => hidePanel();
  body.addEventListener('click', e => {
    const it = e.target.closest('[data-c]');
    if (it && !e.target.closest('button') && !it.classList.contains('na')) { const c = it.dataset.c; if (comp === c) { clearComp(); render(); } else { setComp(c, { fly: true }); render(); } return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, t = tk();
    if (a === 'fly') flyTank(t.simKey);
    else if (a === 'docv') viewer.open(+(b.dataset.p || t.doc.page));
    else if (a === 'pdf') openPdf(+(b.dataset.p || t.doc.page));
    else if (a === 'proc') { hidePanel(); openPanel('proc'); procShow(); prSetTab('tanks'); }
    else if (a === 'cfly') { if (comp) setComp(comp, { fly: true }); }
    else if (a === 'back') { clearComp(); render(); flyTank(t.simKey); }
    else if (a === 'vcard') { const vid = 'РГС-' + t.id + '-' + COMP[comp].ext; if (procLogic.V[vid]) select(procValveObj(vid)); }
  });

  /* ---------- подсветка резервуара и узлов, перелёт камеры ---------- */
  function boxOfTank(k) {
    const t = RGSD.byK[k]; if (!t) return null;
    if (RGSD.on(t.o)) return RGSD.tankBox(k);
    const gy = t.o.g.position.y; return new THREE.Box3(new THREE.Vector3(t.cx - 1.75, gy, t.cz - 4.8), new THREE.Vector3(t.cx + 1.75, gy + 4.2, t.cz + 4.8));
  }
  function highlightTank(k) {
    const b = boxOfTank(k); if (!b) return;
    if (helper) scene.remove(helper);
    helper = myHelper = new THREE.Box3Helper(b.clone().expandByScalar(0.08), 0xffb000); scene.add(helper);
  }
  function clearComp() {
    comp = null;
    if (ov) { RGSD.disposeOverlay(ov); ov = null; }
    if (boxH) { scene.remove(boxH); boxH.geometry.dispose(); boxH.material.dispose(); boxH = null; }
  }
  function flyBox(box, view) {
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
    const dist = Math.min(30, Math.max(2.4, sz * 1.7)), dir = new THREE.Vector3(...(VIEW[view] || VIEW.side)).normalize();
    flyTo(c.clone().addScaledVector(dir, dist).toArray(), c.toArray(), 0.9);
  }
  function flyTank(k) { const b = boxOfTank(k); if (!b) return; const c = b.getCenter(new THREE.Vector3()); flyTo([c.x + 9, c.y + 7.5, c.z + 11], [c.x, c.y - 0.6, c.z], 0.9); }
  function setComp(c, o = {}) {
    clearComp(); comp = c;
    const t = tk(), k = t.simKey, d = COMP[c]; let box = null;
    if (d.ext) {
      const v = procLogic.V['РГС-' + t.id + '-' + d.ext];
      if (v) { const y = hAt(v.p[0], v.p[1]) + 0.6; box = new THREE.Box3(new THREE.Vector3(v.p[0] - 0.3, y - 0.25, v.p[1] - 0.3), new THREE.Vector3(v.p[0] + 0.3, y + 0.8, v.p[1] + 0.3)); }
    } else if (RGSD.on(pairObj(t))) {
      ov = RGSD.overlay(k, c); scene.add(ov.g);
      const m0 = ov.g.children[0]; if (m0) m0.onBeforeRender = () => RGSD.pulse(performance.now());
      box = ov.box.isEmpty() ? null : ov.box;
    } else { toast('Детальная модель РГС скрыта — включите слой «РГС-75: детальная модель».', 'err'); }
    if (box) {
      boxH = new THREE.Box3Helper(box.clone().expandByScalar(0.06), 0xff7a00); boxH.material.depthTest = false; boxH.material.transparent = true; boxH.renderOrder = 31; scene.add(boxH);
      if (o.fly) flyBox(box, d.view);
    }
  }

  /* ---------- панель ---------- */
  function show() {
    const top = Math.round(document.getElementById('top').getBoundingClientRect().bottom + 6) + 'px';
    panel.style.top = top; panel.style.maxHeight = `calc(100% - ${top} - 60px)`; panel.style.display = 'flex'; document.body.classList.add('rgspOpen');
    clearInterval(timer); timer = setInterval(tickLive, 700);
    placeHud();
  }
  function hidePanel(restore = true) {
    if (panel.style.display !== 'flex') return;
    panel.style.display = 'none'; document.body.classList.remove('rgspOpen'); clearInterval(timer); timer = 0;
    clearComp();
    if (myHelper && helper === myHelper) { scene.remove(helper); helper = null; }
    myHelper = null; placeHud();
    if (restore && curSel && RGSD.PAIRS.includes(curSel.id)) select(curSel);
  }
  function open(id, o = {}) {
    if (!D.TANKS[id]) return;
    if (panel.style.display !== 'flex') { closePanels(); show(); }
    const changed = cur !== id; cur = id;
    if (o.tab) tab = o.tab;
    clearComp(); highlightTank(D.TANKS[id].simKey);
    if (o.comp && COMP[o.comp]) setComp(o.comp, { fly: !!o.fly }); else if (o.fly && changed) flyTank(D.TANKS[id].simKey);
    render();
  }
  function tickLive() {
    if (panel.style.display !== 'flex' || !cur) return;
    if (tab === 'ov') { const el = body.querySelector('#rgLive'); if (el) el.innerHTML = liveHTML(); }
    else if (tab === 'prod') { const el = body.querySelector('#rgMass'), s = stateOf(tk()); if (el && s) el.textContent = `${f(s.v.vol, 1)} м³ · ${f(s.v.vol * tk().product.density, 1)} т`; }
  }
  /* ---------- встроенная документация ---------- */
  let pdfUrl = null;
  function pdfBlobUrl() {
    if (pdfUrl) return pdfUrl;
    const el = document.getElementById('rgsDocPdf'); if (!el) return null;
    const bin = atob(el.textContent.trim()), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return (pdfUrl = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })));
  }
  function openPdf(page) {
    const u = pdfBlobUrl(); if (!u) { toast('Встроенный PDF не найден.', 'err'); return; }
    if (page > 2) { toast('Во встроенный PDF входят стр. 1–2 (опросные листы). Стр. ' + page + ' — «Просмотр» или полный файл пакета.', 'info'); viewer.open(page); return; }
    const w = window.open(u + '#page=' + page, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = u; a.download = 'Резервуар 1 — стр. 1–2 (ОЛ-002, ОЛ-001).pdf'; document.body.appendChild(a); a.click(); a.remove(); }
  }
  const viewer = (() => {
    const el = document.createElement('div'); el.id = 'rgDoc'; el.setAttribute('role', 'dialog');
    const PG = { 1: 'стр. 1 — ОЛ-002 (бензин, 116.3–116.4)', 2: 'стр. 2 — ОЛ-001 (ДТ зимнее, 116.1–116.2)', 3: 'стр. 3 — ТХ-001 «Общие данные» (в рамке листа)', 4: 'стр. 4 — ТХ.С-001 «Спецификация»' };
    el.innerHTML = `<div class="dv"><div class="dh"><b>Резервуар 1.pdf</b>${[1, 2, 3, 4].map(p => `<button data-p="${p}">стр. ${p}</button>`).join('')}<span class="sp"></span><button data-z="-1" title="Уменьшить">−</button><button data-z="0" title="По ширине окна">По ширине</button><button data-z="1" title="Увеличить">+</button><button data-a="pdf">Открыть PDF</button><a id="rgDl" download="Резервуар 1 — стр. 1–2 (ОЛ-002, ОЛ-001).pdf">Скачать стр. 1–2</a><button data-a="x" title="Закрыть (Esc)">✕</button></div><div class="dc"><img alt="Страница документа"></div><div class="df"></div></div>`;
    document.body.appendChild(el);
    const img = el.querySelector('img'), dc = el.querySelector('.dc'), ft = el.querySelector('.df'), cache = {};
    let page = 1, zoom = 1;
    const src = p => cache[p] || (cache[p] = 'data:image/png;base64,' + document.getElementById('rgsDocP' + p).textContent.trim());
    const fit = () => { img.style.width = Math.round(Math.max(200, (dc.clientWidth - 24) * zoom)) + 'px'; };
    function show(p) {
      page = p; img.src = src(p); fit(); dc.scrollTop = 0; dc.scrollLeft = 0;
      el.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', +b.dataset.p === p));
      ft.textContent = `${PG[p]} · изображение страницы «Резервуар 1.pdf» для просмотра без интернета${p === 3 ? '; п. 3–8 указаний в исходном PDF выходят за рамку листа' : ''}. Стр. 5–8 относятся к РВС-1000 и не встроены.`;
    }
    el.addEventListener('click', e => {
      if (e.target === el) { close(); return; }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.p) show(+b.dataset.p);
      else if (b.dataset.z !== undefined) { const z = +b.dataset.z; zoom = z === 0 ? 1 : Math.min(4, Math.max(0.5, zoom * (z > 0 ? 1.35 : 1 / 1.35))); fit(); }
      else if (b.dataset.a === 'x') close();
      else if (b.dataset.a === 'pdf') openPdf(page);
    });
    const onKey = e => { if (el.style.display !== 'flex') return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); };
    addEventListener('keydown', onKey, true); addEventListener('keyup', e => { if (el.style.display === 'flex') e.stopImmediatePropagation(); }, true);
    addEventListener('resize', () => { if (el.style.display === 'flex') fit(); });
    function open(p) { el.style.display = 'flex'; const u = pdfBlobUrl(); if (u) el.querySelector('#rgDl').href = u; zoom = 1; show(p || 1); }
    function close() { el.style.display = 'none'; img.removeAttribute('src'); }
    return { open, close, get isOpen() { return el.style.display === 'flex'; } };
  })();

  /* ---------- связь с выбором объектов ---------- */
  const isPair = o => !!o && RGSD.PAIRS.includes(o.id);
  function cardHTML(o) {
    if (!isPair(o)) { const rgsValve = o && o.proc && o.proc.k === 'valve' && /^РГС-/.test(o.proc.id); if (panel.style.display === 'flex' && !rgsValve) hidePanel(false); return ''; }
    const ks = RGSD.tanks.filter(t => t.o === o).map(t => RGSD.ID_OF[t.k]).sort();
    return `<div class="pn"><div class="pnh"><b>Технические паспорта РГС-75</b> («Резервуар 1.pdf»)</div><div class="pnb">` +
      ks.map(id => { const q = D.tank(id); return `<button class="pbtn" data-rgsp="${id}">РГС-${id} · ${q.product.short}</button>`; }).join('') +
      `</div><div class="pnn">Номера — по графу ТП (ГП-005); подпись пары «${o.id}» на генплане — требует подтверждения.</div></div>`;
  }
  function bindCard(el, o) {
    if (!isPair(o)) return;
    el.querySelectorAll('[data-rgsp]').forEach(b => b.onclick = e => { e.stopPropagation(); open(b.dataset.rgsp, { tab: 'ov', fly: false }); });
  }
  function onPick(hit) {
    if (!hit || !hit.object) return;
    const o = hit.object.userData.o; if (!isPair(o)) return;
    let k = hit.object.userData.rgsK;
    if (!k) k = RGSD.tankAt(hit.point.x, hit.point.z);
    if (!k) return;
    const id = RGSD.ID_OF[k], c = RGSD.compAt(hit);
    if (c && COMP[c] && !['shell', 'heads', 'stencil', 'deck', 'stair'].includes(c)) open(id, { tab: COMP[c].g === 'Патрубки' ? 'noz' : 'eq', comp: c, fly: false });
    else open(id, { tab: (panel.style.display === 'flex' && cur && tab !== 'eq' && tab !== 'noz') ? tab : 'ov' });
  }
  return { open, hidePanel, cardHTML, bindCard, onPick, COMP, viewer, get current() { return cur; }, get tab() { return tab; }, get comp() { return comp; }, setComp, clearComp, render, isOpen: () => panel.style.display === 'flex' };
})();
window.__RGSP = RGSP;

