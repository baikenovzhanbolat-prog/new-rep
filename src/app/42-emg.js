/* =====================================================================================
   v0.19 — ПРОТИВОАВАРИЙНАЯ ЗАЩИТА (ПАЗ) И АВАРИЙНЫЕ СИТУАЦИИ (модуль EMG)
   Блокировки — по АК-002 и таблице функциональной схемы АК-004 (документ проекта «АК — данные автоматизации»):
     • все насосы: ДВК > 50 % НКПР на площадках РГС, в насосном цехе, на автоналиве и на эстакаде (QE-1a…QE-5a, ДАТ-М,
       2 порога на канал); ESD с аварийных постов (РВС, РГС, эстакада — HS/SB 91, 92, автоналив); пожар;
     • Н-5/Н-6 — отключение с площадки ж/д эстакады; Н-7/Н-8 — с эстакады и с площадки автоналива; Н-3 — с площадки котельной;
     • N1…N5, КО-1…КО-3 — автоматическое закрытие при пожаре и аварии.
   Принято в модели (требует уточнения по алгоритмам АСУ ТП):
     • предупредительный порог П1 = 20 % НКПР (в прочитанной части АК есть только порог отключения 50 %);
     • «авария» для закрытия N1–N5 и КО-1…3 = ESD или ДВК ≥ 50 % НКПР;
     • сработавшая защита запоминается: повторный пуск — после устранения причины и кнопки «Сброс сигнализации» (SB, ЩКУ);
     • места аварийных постов и датчиков QE-1a, QE-2a, QE-4a — условно (планов КИП этих площадок в комплекте нет).
   Аварийные ситуации (инструктор): пролив на эстакаде, перелив РВС/РГС при отказе LSA H, отказ насоса, заклинивание задвижки,
   утечка через уплотнение насоса в цехе 200, сигнал «Пожар». Нарастание загазованности от разлива — учебная модель
   (коэффициенты условные), объёмы — модельные; время — модельное (ускорение — вкладка «Модель»).
   ===================================================================================== */
window.__EMG = null;
const EMG = (() => {
  const L = procLogic, PS = procSim, V = PS.V, PF = window.__PFLOW;
  const fmt = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
  const hms = t => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const P1 = 20, P2 = 50;   // % НКПР
  const PN = { L: 'ДТ летнее', Z: 'ДТ зимнее', B: 'бензин' };
  const PCOL = { L: 0x7a5410, Z: 0x86702a, B: 0x9a8a48 };   // плёнка разлива: тёмный глянец «мокрого» пятна (бензин светлее)
  const ALLP = Object.keys(L.PU);
  const G = new THREE.Group(); G.name = 'ПАЗ: датчики, посты, разливы'; scene.add(G);

  /* ---------- 1. сигналы ---------- */
  const QE = {
    'QE-1a': { n: 'Площадка РГС-116.1/116.2 (ДТ зимнее)', p: [-15.36, 1.25], cond: 1 },
    'QE-2a': { n: 'Площадка РГС-116.3/116.4 (бензин)', p: [-23.94, 1.25], cond: 1 },
    'QE-3a': { n: 'Насосный цех 200', p: PH.ex.qa, ph: 1 },
    'QE-4a': { n: 'Автоналив 186 (АСН-N1)', p: [-55.3, -2.7], cond: 1 },
    'QE-5a': { n: 'Ж/д эстакада 177', p: [-17.84, 31.8] }
  };
  for (const q of Object.values(QE)) { q.val = 0; q.man = null; q.st = 0; }
  const ZONES = { park: 'Резервуарный парк РВС-109', rgs: 'Площадка РГС-116', ph: 'Насосный цех 200', est: 'Ж/д эстакада 177', asn: 'Автоналив 186', trk: 'Пункт заправки 166' };
  const ZP = { park: [-3.6, -11.1, 9], rgs: [-19.6, 6.6, 8], ph: [-68.0, 26.0, 7], est: [-20.6, 34.0, 16], asn: [-56.4, -4.4, 4], trk: [-44.9, -1.9, 3] };
  const fire = {}; for (const z in ZONES) fire[z] = false;
  const ESD = {
    'ESD-РВС': { n: 'Аварийный пост резервуарного парка РВС (у западной стенки)', p: [-31.6, -3.9] },
    'ESD-РГС': { n: 'Аварийный пост площадки РГС (у западной стенки)', p: [-31.6, 5.0] },
    'SB91': { n: 'Кнопка ESD HS/SB 91 — ж/д эстакада (запад)', p: [-35.6, 33.0] },
    'SB92': { n: 'Кнопка ESD HS/SB 92 — ж/д эстакада (восток)', p: [-4.6, 33.0] },
    'ESD-186': { n: 'Аварийный пост автоналива 186', p: [-53.6, -1.6] }
  };
  for (const b of Object.values(ESD)) b.on = false;
  const LOCAL = {
    est: { n: 'Стоп с площадки ж/д эстакады (пульты, H177-24…27)', pumps: ['Н-5', 'Н-6', 'Н-7', 'Н-8'] },
    asn: { n: 'Стоп с площадки автоналива 186 (пульт 186-07/08)', pumps: ['Н-7', 'Н-8'] },
    kot: { n: 'Стоп с площадки котельной', pumps: ['Н-3'] }
  };
  const AUTO_CLOSE = ['N1', 'N2', 'N3', 'N4', 'N5', 'КО-1', 'КО-2', 'КО-3'].filter(v => L.V[v]);

  /* ---------- 2. неисправности и аварийные ситуации ---------- */
  const F = { pump: {}, valve: {}, lsa: {} };   // pump[id] = текст; valve[id] = 'open' | 'closed'; lsa[k] = true (отказ LSA H)
  const POOLS = {};                              // разливы: { k, n, zone, prod, vol (м³ на поверхности), area, mesh }
  const SC = { spill: null, seal: null };         // активные источники утечек
  const DE = { DE2: { n: 'ДЕ-2 (139.2)', cap: 63, vol: 0 }, DE1: { n: 'ДЕ-1 (139.1)', cap: 8, vol: 0 } };
  const GASK = { B: 8, Z: 0.2, L: 0.12 };          // % НКПР на 1 м² зеркала разлива у датчика (учебная модель, условно): ДТ — малолетуч (Твсп > 40 °С), бензин — летуч
  const USN_CI = { 'УСН-N2': 0, 'УСН-N3': 1, 'УСН-N1': 2 }, USN_VC = { 'УСН-N1': 'VC1', 'УСН-N2': 'VC2', 'УСН-N3': 'VC3' }, USN_ND = { 'УСН-N1': 'USN1', 'УСН-N2': 'USN2', 'УСН-N3': 'USN3' };
  const NV = { RVS1: 'RVS1', RVS2: 'RVS2', RVS3: 'RVS3', RGSZ1: 'RGSZ1', RGSZ2: 'RGSZ2', RGSB1: 'RGSB1', RGSB2: 'RGSB2', USN1: 'VC1', USN2: 'VC2', USN3: 'VC3', UPVS: 'VC1' };

  /* ---------- 3. состояние защиты ---------- */
  const latch = [];   // срабатывания: { id, kind, txt, t, cleared, reset }
  let ack = true, lastBeep = 0, alarmTxt = '';
  const nowT = () => PS.S.t;
  const log = (t, lvl) => PS.log ? PS.log(t, lvl) : console.log(t);
  function say(t) {   // голосовое сообщение (Web Speech API, ru-RU), канал «Голос» во вкладке «Модель»
    try { if (!procAudio.on || !procAudio.ch.voice || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return; const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 1.0; u.volume = Math.min(1, procAudio.vol * 1.6); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }
  const alert0 = txt => { ack = false; lastBeep = 0; alarmTxt = txt; };
  function raise(id, kind, txt, voice) {
    const it = latch.find(x => x.id === id && !x.reset);
    if (it) { it.cleared = false; return false; }
    latch.push({ id, kind, txt, t: nowT(), cleared: false, reset: false });
    alert0(txt); log('ПАЗ: ' + txt + '.', 'alarm'); if (voice) say(voice);
    return true;
  }
  const active = () => latch.filter(x => !x.reset);
  // причина запрета пуска (по АК-004 все защитные события действуют на все насосы)
  function blockReason(pid) {
    if (F.pump[pid]) return `${pid} неисправен (${F.pump[pid]}) — пуск невозможен до устранения`;
    const a = active();
    if (a.length) return `сработала ПАЗ: ${a[0].txt}${a.length > 1 ? ` (и ещё ${a.length - 1})` : ''} — устраните причину и нажмите «Сброс сигнализации» (вкладка «ПАЗ»)`;
    return null;
  }
  L.onStart(pid => blockReason(pid));
  function stopPumps(list, why) {
    const run = list.filter(p => L.st.pump[p]);
    for (const p of run) L.st.pump[p] = false;
    if (run.length) L.emit(`${run.join(', ')} остановлен: ${why}.`, 'err');
    return run;
  }
  function autoClose(why) {
    const fail = [], done = [];
    for (const v of AUTO_CLOSE) {
      if (!L.st.valve[v]) continue;
      if (F.valve[v] === 'open') { fail.push(v); continue; }
      L.st.valve[v] = false; done.push(v);
    }
    if (done.length) { log(`ПАЗ (${why}): автоматически закрыты ${done.join(', ')}.`, 'warn'); L.emit(null); }
    if (fail.length) { log(`ПАЗ: не закрылась арматура ${fail.join(', ')} (заклинивание) — закрыть вручную по месту, отсечь участок соседней задвижкой.`, 'alarm'); say('Внимание! Задвижка не закрылась.'); }
  }
  function trip(id, kind, txt, voice, close) {
    if (!raise(id, kind, txt, voice)) return;
    stopPumps(ALLP, 'ПАЗ — ' + txt);
    if (close) autoClose(txt);
  }
  function resetAll() {
    evaluate();
    const a = active(), keep = a.filter(x => !x.cleared);
    if (!a.length) { toast('Активных срабатываний ПАЗ нет.', 'info'); ack = true; alarmTxt = ''; return false; }
    if (keep.length) { const t = `Сброс невозможен: не устранено — ${keep.map(x => x.txt).join('; ')}.`; toast(t, 'err'); log(t, 'warn'); return false; }
    for (const x of a) x.reset = true;
    ack = true; alarmTxt = ''; log('Сброс сигнализации (SB, ЩКУ): защиты сброшены, пуск насосов разрешён.', 'ok'); procAudio.chime(); toast('ПАЗ сброшена. Пуск насосов разрешён.', 'ok'); L.emit(null);
    return true;
  }

  /* ---------- 4. перехват арматуры: заклинивание ---------- */
  const setValve0 = L.setValve, assemble0 = L.assemble, closeAll0 = L.closeAll;
  const keepStuck = () => { for (const [v, m] of Object.entries(F.valve)) L.st.valve[v] = m === 'open'; };
  L.setValve = (id, open) => {
    const m = F.valve[id];
    if (m && (m === 'open') !== !!open) { log(`Отказ арматуры: ${id} ${m === 'open' ? 'не закрылась' : 'не открылась'} по команде.`, 'warn'); L.emit(`${id}: ${m === 'open' ? 'не закрывается' : 'не открывается'} — заклинивание. Использовать резервную арматуру или ручной привод.`, 'err'); return; }
    setValve0(id, open);
  };
  L.assemble = path => {
    assemble0(path);
    if (!Object.keys(F.valve).length) return;
    keepStuck();
    const bad = path.filter(x => x.e.k === 'valve' && F.valve[x.e.v] === 'closed').map(x => x.e.v), op = Object.keys(F.valve).filter(v => F.valve[v] === 'open');
    L.emit(bad.length ? `Маршрут не собран полностью: ${bad.join(', ')} не открылась (заклинивание).` : op.length ? `Маршрут собран, но ${op.join(', ')} осталась открытой (заклинивание).` : null, bad.length ? 'err' : 'warn');
  };
  L.closeAll = () => { closeAll0(); if (Object.keys(F.valve).length) { keepStuck(); const op = Object.keys(F.valve).filter(v => F.valve[v] === 'open'); L.emit(op.length ? `Не закрылись: ${op.join(', ')} (заклинивание).` : null, 'err'); } };

  /* ---------- 5. 3D: сигнальные огни датчиков, посты ESD, разливы, индикация пожара ---------- */
  // статические детали — InstancedMesh (6 объектов отрисовки на все датчики и посты)
  const mBody = new THREE.MeshStandardMaterial({ color: 0xd9a419, roughness: 0.5, metalness: 0.2 }), mPost = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.6, metalness: 0.5 });
  const mBox = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.55, metalness: 0.15 }), mMush = new THREE.MeshStandardMaterial({ color: 0xd11f1f, roughness: 0.4, emissive: 0x3a0000 });
  const mPlate = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.7 }), mLampI = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gSph = new THREE.SphereGeometry(1, 14, 10), gCyl = new THREE.CylinderGeometry(1, 1, 1, 16), gBoxG = new THREE.BoxGeometry(1, 1, 1);
  const QL = Object.keys(QE), EL = Object.keys(ESD), qPost = QL.filter(id => !QE[id].ph && id !== 'QE-5a');
  const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), QX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const setI = (m, i, x, y, z, sx, sy, sz, q = Q0) => { M4.compose(v3.set(x, y, z), q, s3.set(sx, sy, sz)); m.setMatrixAt(i, M4); };
  function inst(geo, mt, objs, name, shadow = true) {
    const m = new THREE.InstancedMesh(geo, mt, objs.length); m.name = name; m.castShadow = shadow; m.receiveShadow = false;
    m.userData.pick = h => objs[h.instanceId]; m.userData.o = objs[0]; pickables.push(m); G.add(m); return m;
  }
  for (const id of QL) { const q = QE[id]; q.o = { id, net: 1, emg: { k: 'qe', id }, name: `Датчик загазованности ${id} (ДАТ-М) — ${q.n}`, note: `АК-004: 2 порога; при ДВК > 50 % НКПР — отключение всех насосов.${q.cond ? ' Положение — условно (планов КИП этой площадки в комплекте нет); высота — 0,5–0,7 м от земли (пары нефтепродуктов тяжелее воздуха), условно.' : ''}` }; q.y0 = q.ph ? PH_F1 : hAt(q.p[0], q.p[1]); }
  for (const id of EL) { const b = ESD[id]; b.o = { id, net: 1, emg: { k: 'esd', id }, name: b.n, note: 'АК-004: ESD с аварийных постов отключает все насосы; в модели — также закрывает N1–N5 и КО-1…КО-3 (уточнить по алгоритмам АСУ ТП). Место поста и конструкция — условно (планов КИП в комплекте нет).' }; b.y0 = hAt(b.p[0], b.p[1]); }
  const iPost = inst(gCyl, mPost, [...qPost.map(id => QE[id].o), ...EL.map(id => ESD[id].o)], 'ПАЗ: стойки');
  qPost.forEach((id, i) => { const q = QE[id]; setI(iPost, i, q.p[0], q.y0 + 0.3, q.p[1], 0.025, 0.6, 0.025); });
  EL.forEach((id, i) => { const b = ESD[id]; setI(iPost, qPost.length + i, b.p[0], b.y0 + 0.55, b.p[1], 0.03, 1.1, 0.03); });
  const iBody = inst(gCyl, mBody, qPost.map(id => QE[id].o), 'ПАЗ: датчики ДАТ-М');
  qPost.forEach((id, i) => { const q = QE[id]; setI(iBody, i, q.p[0], q.y0 + 0.66, q.p[1], 0.07, 0.16, 0.07); });
  const iBox = inst(gBoxG, mBox, EL.map(id => ESD[id].o), 'ПАЗ: посты ESD'), iPlate = inst(gBoxG, mPlate, EL.map(id => ESD[id].o), 'ПАЗ: таблички', false), iMush = inst(gCyl, mMush, EL.map(id => ESD[id].o), 'ПАЗ: кнопки ESD');
  EL.forEach((id, i) => { const b = ESD[id], [x, z] = b.p; setI(iBox, i, x, b.y0 + 1.18, z, 0.24, 0.28, 0.15); setI(iPlate, i, x, b.y0 + 1.38, z + 0.076, 0.2, 0.07, 0.004); setI(iMush, i, x, b.y0 + 1.16, z + 0.1, 0.06, 0.04, 0.06, QX); });
  const iLamp = inst(gSph, mLampI, [...QL.map(id => QE[id].o), ...EL.map(id => ESD[id].o)], 'ПАЗ: сигнальные лампы', false);
  QL.forEach((id, i) => { const q = QE[id]; setI(iLamp, i, q.p[0], q.y0 + (q.ph ? 1.76 : 0.82), q.p[1], 0.045, 0.045, 0.045); });
  EL.forEach((id, i) => { const b = ESD[id]; setI(iLamp, QL.length + i, b.p[0], b.y0 + 1.36, b.p[1] - 0.02, 0.03, 0.03, 0.03); });
  const LC = { g: new THREE.Color(0x22c55e), y: new THREE.Color(0xf5b301), r: new THREE.Color(0xff2a2a), off: new THREE.Color(0x3a3f44) }, lampSt = [];
  for (let i = 0; i < QL.length + EL.length; i++) iLamp.setColorAt(i, LC.off);
  for (const m of [iPost, iBody, iBox, iPlate, iMush, iLamp]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  // разлив: неправильное пятно (тонкая плёнка с бликом); в обваловании — кольцо вокруг стенки РВС
  const blob = (() => { const n = 72, sh = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = 1 + 0.13 * Math.sin(3 * a + 0.7) + 0.08 * Math.sin(7 * a + 2.1) + 0.05 * Math.sin(13 * a); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(r, 0); } const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(-Math.PI / 2); return g; })();
  const poolMat = {}; const pMat = p => poolMat[p] || (poolMat[p] = new THREE.MeshStandardMaterial({ color: PCOL[p] || PCOL.L, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  function pool(k, n, zone, prod, x, z, y, maxR, ring, hw) {
    let q = POOLS[k];
    if (!q) {
      q = POOLS[k] = { k, n, zone, prod, vol: 0, area: 0, maxR, ring, hw: hw || 0, x, z, y };
      q.mesh = new THREE.Mesh(ring ? new THREE.RingGeometry(ring, ring + 0.02, 96, 1).rotateX(-Math.PI / 2) : blob, pMat(prod));
      q.mesh.position.set(x, y + 0.012, z); q.mesh.renderOrder = 2; q.mesh.visible = false; q.mesh.userData.noWalk = true;
      q.mesh.userData.o = { id: 'Разлив', net: 1, emg: { k: 'pool', id: k }, name: n, note: 'Аварийная ситуация (учебная модель). Объём и площадь — модельные.' }; pickables.push(q.mesh); G.add(q.mesh);
    }
    if (prod && q.prod !== prod) { q.prod = prod; q.mesh.material = pMat(prod); }
    return q;
  }
  function drawPool(q) {
    const film = q.ring ? 0.04 : 0.008;   // толщина слоя: в обваловании — 4 см, на площадке — 8 мм (условно)
    q.area = q.vol / film;
    if (q.ring) {
      const R0 = q.ring, R1 = Math.min(q.maxR, Math.sqrt(R0 * R0 + q.area / Math.PI)); q.area = Math.PI * (R1 * R1 - R0 * R0);
      if (Math.abs((q.R1 || 0) - R1) > 0.03) { q.R1 = R1; q.mesh.geometry.dispose(); q.mesh.geometry = new THREE.RingGeometry(R0, Math.max(R0 + 0.02, R1), 96, 1).rotateX(-Math.PI / 2); }
    } else if (q.hw) {   // в лотке пути: ширина ограничена бортами лотка, продукт растекается вдоль пути
      const sz = Math.min(q.hw, Math.sqrt(q.area / Math.PI)), sx = Math.min(q.maxR, q.area / (Math.PI * sz)); q.area = Math.PI * sx * sz; q.mesh.scale.set(sx, 1, sz);
    } else { const r = Math.min(q.maxR, Math.sqrt(q.area / Math.PI)); q.area = Math.PI * r * r; q.mesh.scale.set(r, 1, r); }
    q.mesh.visible = q.vol > 0.002;
  }
  // индикация сигнала «Пожар» по зоне (сам огонь и тушение — следующий этап)
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff3010, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const FIRE3 = {};
  for (const [z, [x, zz, r]] of Object.entries(ZP)) {
    const y = z === 'ph' ? PH_F0 : hAtS(x, zz);
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 64, 1).rotateX(-Math.PI / 2), fireMat); m.position.set(x, y + 0.08, zz); m.visible = false; m.userData.noWalk = true; m.renderOrder = 3; G.add(m);
    const el = document.createElement('div'); el.className = 'lb emgf'; el.textContent = 'ПОЖАР — ' + ZONES[z]; labelsEl.appendChild(el);
    PROC_LBL.push({ el, pos: new THREE.Vector3(x, y + (z === 'ph' ? 7.5 : 4), zz), grp: { get visible() { return G.visible && fire[z]; } } });
    FIRE3[z] = m;
  }

  /* ---------- 6. сток в дренаж (поток по трубам, канал PFLOW «drain») ---------- */
  const eDrain = L.E.find(e => e.id === 'e205'), eDrainPH = L.E.find(e => e.id === 'e203');
  const drainQ = { est: 0, ph: 0 }; let drainShown = '';
  function showDrain() {
    if (!PF) return;
    const key = Object.entries(drainQ).map(([k, q]) => k + (q > 0.05 ? 1 : 0)).join(',') + (POOLS.est ? POOLS.est.prod : '') + (POOLS.ph ? POOLS.ph.prod : '');
    if (key === drainShown) return; drainShown = key;
    const flows = [];
    if (drainQ.est > 0.05 && eDrain) flows.push({ pumps: [], Q: drainQ.est, srcs: ['Dest'], sinks: ['DE2'], edges: new Map([[eDrain.id, { e: eDrain, q: drainQ.est, dir: 1, side: 'd' }]]), prod: POOLS.est.prod });
    if (drainQ.ph > 0.05 && eDrainPH) flows.push({ pumps: [], Q: drainQ.ph, srcs: ['W2'], sinks: ['DE1'], edges: new Map([[eDrainPH.id, { e: eDrainPH, q: drainQ.ph, dir: 1, side: 'd' }]]), prod: POOLS.ph.prod });
    try { PF.buildFlow(PS.flowGrp, flows, f => f.prod || 'L', 'drain'); } catch (e) { console.error('ПАЗ: дренаж', e); }
  }

  /* ---------- 7. подписи уровня дренажных ёмкостей ---------- */
  const lbls = [];
  for (const [k, d] of Object.entries(DE)) {
    const n = L.N[k]; if (!n) continue;
    const el = document.createElement('div'); el.className = 'lb lv'; labelsEl.appendChild(el);
    el.onclick = () => openTab();
    const it = { el, k, pos: new THREE.Vector3(n.p[0], hAt(n.p[0], n.p[1]) + 2.2, n.p[1]), grp: { get visible() { return G.visible && d.vol > 0.005; } } };
    PROC_LBL.push(it); lbls.push(it);
  }

  /* ---------- 8. модельная динамика: утечки, разливы, загазованность ---------- */
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ZQE = { est: ['QE-5a'], ph: ['QE-3a'], park: [], rgs: ['QE-1a', 'QE-2a'], asn: ['QE-4a'] };
  function stepModel(dt) {
    if (SC.spill) {   // пролив на эстакаде: самотёком из цистерны через неплотность присоединения УСН, пока открыт нижний сливной прибор
      const s = SC.spill, st = ESTOPS.S[s.ci], v = V[s.vc];
      const on = !!(st && st.cv && st.usn && v && v.vol > 0.01);
      if (on) { const dv = Math.min(v.vol, s.q / 3600 * dt); v.vol -= dv; const q = pool('est', 'Разлив в лотке пути ж/д эстакады 177 (у ' + s.usnN + ')', 'est', v.prod || 'L', s.x, EST177.TZ, EST177.RH - TRK.RAIL_H - TRK.PAD + 0.004, 16, 0, TRK.CURB[0] - 0.02); q.vol += dv; s.total += dv; }
      if (on !== s.on) { s.on = on; log(on ? `Пролив у ${s.usnN}: течь ${fmt(s.q, 1)} м³/ч (модель).` : `Пролив у ${s.usnN} прекращён${v && v.vol <= 0.01 ? ' — цистерна опорожнена' : ' — нижний сливной прибор закрыт'}; вытекло ${fmt(s.total, 2)} м³.`, on ? 'alarm' : 'ok'); if (on) alert0(`Пролив у ${s.usnN}`); }
    }
    if (SC.seal) {    // утечка через торцевое уплотнение насоса — только пока насос работает
      const s = SC.seal, on = !!L.st.pump[s.pid];
      if (on) { const q = pool('ph', 'Разлив в насосном цехе 200 (под ' + s.pid + ')', 'ph', s.prod, s.x, s.z, PH_F1, 2.4); const dv = s.q / 3600 * dt; q.vol += dv; s.total += dv; }
      if (on !== s.on) { s.on = on; log(on ? `Утечка через торцевое уплотнение ${s.pid}: ${fmt(s.q * 1000 / 60, 1)} л/мин (модель).` : `${s.pid} не работает — утечка через уплотнение прекратилась; вытекло ${fmt(s.total * 1000, 0)} л.`, on ? 'warn' : 'ok'); }
    }
    // сток: с площадки эстакады — через трапы и приямок в дренаж ⌀273 → ДЕ-2 (τ ≈ 2 мин, условно); в цехе — через трап пола в ДЕ-1 (τ ≈ 6 мин, условно)
    drainQ.est = drainQ.ph = 0;
    for (const [k, tau, de] of [['est', 120, 'DE2'], ['ph', 360, 'DE1']]) {
      const q = POOLS[k], D = DE[de]; if (!q || q.vol <= 0) continue;
      const d = Math.min(q.vol, q.vol * (1 - Math.exp(-dt / tau)), D.cap - D.vol);
      q.vol -= d; D.vol += d; drainQ[k] = d / dt * 3600;
      if (D.vol >= D.cap * 0.9 && !D.warn) { D.warn = 1; log(`${D.n}: заполнена на 90 % — организовать откачку (модель).`, 'warn'); }
    }
    for (const q of Object.values(POOLS)) drawPool(q);
    // загазованность: равновесное значение — по площади зеркала разлива и удалению от датчика; установление τ = 20 с, спад τ = 60 с
    const tgt = {}; for (const id in QE) tgt[id] = 0;
    for (const q of Object.values(POOLS)) if (q.area > 0) for (const id of ZQE[q.zone] || []) {
      const att = Math.max(0.12, Math.min(1, 6 / (dist([q.x, q.z], QE[id].p) + 2))), encl = q.zone === 'ph' ? 6 : 1;   // закрытое помещение: накопление паров (условно)
      tgt[id] += (GASK[q.prod] || 1) * q.area * att * encl;
    }
    for (const [id, q] of Object.entries(QE)) {
      if (q.man != null) { q.val = q.man; continue; }
      const T = Math.min(100, tgt[id]), tau = T > q.val ? 20 : 60;
      q.val += (T - q.val) * (1 - Math.exp(-dt / tau)); if (q.val < 0.05) q.val = 0;
    }
  }
  // перелив (вызывается из procSim): продукт выше верха стенки — в обвалование (РВС) или на площадку (РГС)
  function overflow(v, dv, prod) {
    const n = L.N[v.k]; if (!n) return;
    const isR = v.kind === 'rvs', [x, z] = n.p, R0 = 5.9;
    const y = isR ? Math.max(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => hAt(x + Math.cos(i * Math.PI / 4) * (R0 + 0.6), z + Math.sin(i * Math.PI / 4) * (R0 + 0.6)))) : hAt(x, z);
    const q = pool(v.k, `Перелив ${v.n}${isR ? ' — продукт в обваловании' : ' — продукт на площадке РГС'}`, isR ? 'park' : 'rgs', prod || v.prod || 'L', x, z, y, isR ? 9 : 6, isR ? R0 : 0);
    if (!q.ov) { q.ov = 1; log(`ПЕРЕЛИВ ${v.n}: продукт через дыхательную арматуру и по стенке — ${isR ? 'в обвалование' : 'на площадку РГС'}${F.lsa[v.k] ? ` (датчик ${v.tagH} неисправен — защита не сработала)` : ''}.`, 'alarm'); say(`Внимание! Перелив резервуара ${v.n.replace(/^(РВС|РГС)-/, '')}.`); alert0(`Перелив ${v.n}`); }
    q.vol += dv;
  }

  /* ---------- 9. контроль сигналов и срабатывание защит ---------- */
  const ovWarn = {};
  function evaluate() {
    for (const [id, q] of Object.entries(QE)) {
      const up = q.val >= P2 ? 2 : q.val >= P1 ? 1 : 0, dn = q.val >= P2 - 2 ? 2 : q.val >= P1 - 2 ? 1 : 0;   // гистерезис 2 % НКПР
      const st = up > q.st ? up : dn < q.st ? dn : q.st;
      if (st > q.st) {
        if (st === 1) { log(`${id} (${q.n}): ДВК ${fmt(q.val, 0)} % НКПР — предупредительный порог П1 (${P1} %, условно).`, 'warn'); alert0(`${id}: загазованность ${fmt(q.val, 0)} % НКПР`); say(`Внимание! Загазованность. ${q.n}.`); }
        if (st === 2) trip('gas:' + id, 'gas', `${id} — ДВК ≥ ${P2} % НКПР (${q.n})`, `Авария! Загазованность пятьдесят процентов. ${q.n}. Насосы отключены.`, true);
      }
      q.st = st;
      const it = latch.find(x => x.id === 'gas:' + id && !x.reset); if (it) it.cleared = st < 2;
    }
    for (const z in ZONES) { const it = latch.find(x => x.id === 'fire:' + z && !x.reset); if (fire[z] && !it) trip('fire:' + z, 'fire', `ПОЖАР — ${ZONES[z]} (сигнал АПС)`, `Пожар! ${ZONES[z]}. Насосы отключены.`, true); else if (it) it.cleared = !fire[z]; }
    for (const [id, b] of Object.entries(ESD)) { const it = latch.find(x => x.id === 'esd:' + id && !x.reset); if (b.on && !it) trip('esd:' + id, 'esd', `ESD — ${b.n}`, 'Аварийный останов. Насосы отключены.', true); else if (it) it.cleared = !b.on; }
    // защита держит насосы остановленными (пуск блокируется в onStart; здесь — на случай пуска в обход)
    if (active().length) { const run = ALLP.filter(p => L.st.pump[p]); if (run.length) stopPumps(run, 'ПАЗ не сброшена'); }
    for (const p of Object.keys(F.pump)) if (L.st.pump[p]) stopPumps([p], `аварийное отключение — ${F.pump[p]}`);
    // уровнемер LT: показание за верхней границей диапазона при отказе LSA H
    for (const k of Object.keys(F.lsa)) { const v = V[k]; if (!v) continue; const h = PS.level(v); if (h > v.lt1 + 1e-3 && !ovWarn[k]) { ovWarn[k] = 1; log(`${v.lt}: показание за верхней границей диапазона (${fmt(v.lt1 * 1000, 0)} мм) — уровень выше уставки ${v.tagH}, сигнализации нет (датчик неисправен).`, 'warn'); alert0(`${v.lt}: уровень вне диапазона`); } if (h < v.lt1 - 0.05) ovWarn[k] = 0; }
  }

  /* ---------- 10. такт ---------- */
  let lastT = 0, uiT = 0;
  function tick(now) {
    const dtR = lastT ? Math.min(0.25, (now - lastT) / 1000) : 0; lastT = now;
    const dt = dtR * PS.S.speed;
    if (dt > 0) {
      const busy = SC.spill || SC.seal || Object.values(POOLS).some(q => q.vol > 0) || Object.values(QE).some(q => q.val > 0);
      if (!PS.S.flows.length && busy) PS.S.t += dt;   // модельное время идёт и без перекачки
      let rem = dt; while (rem > 1e-6) { const h = Math.min(5, rem); rem -= h; stepModel(h); }
      evaluate(); showDrain();
    }
    const blink = (now / 400 | 0) % 2;
    let lc = false;
    QL.forEach((id, i) => { const st = QE[id].st, c = st === 2 ? (blink ? 'r' : 'off') : st === 1 ? 'y' : 'g'; if (lampSt[i] !== c) { lampSt[i] = c; iLamp.setColorAt(i, LC[c]); lc = true; } });
    EL.forEach((id, i) => { const b = ESD[id], c = b.on ? (blink ? 'r' : 'off') : 'off', k = QL.length + i; if (lampSt[k] !== c) { lampSt[k] = c; iLamp.setColorAt(k, LC[c]); lc = true; }
      if (b.pressed !== b.on) { b.pressed = b.on; setI(iMush, i, b.p[0], b.y0 + 1.16, b.p[1] + (b.on ? 0.085 : 0.1), 0.06, 0.04, 0.06, QX); iMush.instanceMatrix.needsUpdate = true; } });
    if (lc) iLamp.instanceColor.needsUpdate = true;
    const s = 1 + 0.06 * Math.sin(now * 0.006);
    for (const z in FIRE3) { const m = FIRE3[z]; m.visible = fire[z]; if (fire[z]) { m.scale.set(s, 1, s); fireMat.opacity = 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.008)); } }
    if (!ack && now - lastBeep > 6000) { lastBeep = now; procAudio.alarm(); }   // повтор тревоги до квитирования
    if (now - uiT > 300) {
      uiT = now; bar();
      for (const it of lbls) { const d = DE[it.k]; it.el.textContent = `${d.n.split(' ')[0]} · ${fmt(d.vol, 2)} / ${d.cap} м³`; it.el.classList.toggle('al', d.vol >= d.cap * 0.9); }
      if (prTab === 'emg' && procP.style.display === 'flex') render(false);
      const cv = document.getElementById('emgCardVal'); if (cv && curSel && curSel.emg) cv.innerHTML = cardVal(curSel);
    }
  }

  /* ---------- 11. полоса тревоги ---------- */
  const barEl = document.getElementById('alarmBar');
  let barKey = '';
  if (barEl) barEl.innerHTML = '<b></b><span></span><button data-a="ack">Квитировать</button><button data-a="open">ПАЗ</button>';
  const barB = barEl && barEl.querySelector('b'), barS = barEl && barEl.querySelector('span'), barAck = barEl && barEl.querySelector('[data-a="ack"]');
  function bar() {
    if (!barEl) return;
    const a = active(), warn = Object.entries(QE).filter(([, q]) => q.st === 1);
    if (!a.length && !warn.length && (ack || !alarmTxt)) { if (barKey) { barEl.style.display = 'none'; barKey = ''; } return; }
    const head = a.length ? '⚠ ПАЗ СРАБОТАЛА' : warn.length ? '⚠ ЗАГАЗОВАННОСТЬ' : '⚠ АВАРИЙНАЯ СИТУАЦИЯ';
    const txt = a.length ? a.map(x => x.txt + (x.cleared ? ' (устранено)' : '')).join(' · ') : warn.length ? warn.map(([id, q]) => `${id}: ${fmt(q.val, 0)} % НКПР`).join(' · ') : alarmTxt;
    const key = head + txt + ack;
    if (key === barKey) return; barKey = key;
    barEl.className = (a.length ? 'al' : 'wa') + (ack ? '' : ' blink');
    barB.textContent = head; barS.textContent = txt; barAck.style.display = ack ? 'none' : '';   // кнопки не пересоздаются — нажатие не теряется
    barEl.style.display = 'flex';
  }
  function ackAlarm() { if (ack) return; ack = true; if (!active().length) alarmTxt = ''; log('Тревога квитирована (звуковой сигнал снят).', 'info'); bar(); if (prTab === 'emg') render(true); }
  if (barEl) barEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.a === 'ack') ackAlarm(); else openTab(); });
  function openTab() { openPanel('proc'); prSetTab('emg'); }

  /* ---------- 12. вкладка «ПАЗ» ---------- */
  const box = document.getElementById('prEmg');
  const UI = { inst: false, sig: '', ev: null };
  const sig = () => JSON.stringify([latch.map(x => x.id + x.cleared + x.reset), ack, Object.values(ESD).map(b => b.on), F, fire, Object.values(QE).map(q => [q.st, q.man != null]), Object.values(POOLS).map(q => q.vol > 0.002), Object.values(DE).map(d => d.vol > 0), !!SC.spill, !!SC.seal, ALLP.map(p => L.st.pump[p])]);
  const opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`;
  function render(rebuild) {
    if (!box || prTab !== 'emg') return;
    const s = sig();
    if (!rebuild && s === UI.sig) { live(); return; }
    if (!rebuild && document.activeElement && box.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) { live(); return; }
    UI.sig = s;
    const sel = {}; box.querySelectorAll('[data-p]').forEach(x => sel[x.dataset.p] = x.value);
    const a = active(), anyW = Object.values(QE).some(q => q.st);
    let h = `<div class="rst ${a.length ? 'err' : anyW ? 'warn' : 'ok'}">${a.length ? `<b>ПАЗ сработала:</b> ${a.map(x => `${x.txt}${x.cleared ? ' — <i>причина устранена</i>' : ''}`).join('; ')}` : anyW ? 'Предупреждение: загазованность выше П1.' : 'Защиты в норме. Насосы разрешены к пуску.'}</div>`;
    h += `<div class="pbar"><button class="pbtn ${a.length && a.every(x => x.cleared) ? 'grn' : ''}" data-a="reset">Сброс сигнализации (SB, ЩКУ)</button>${ack ? '' : '<button class="pbtn red" data-a="ack">Квитировать звук</button>'}</div>`;
    h += `<div class="oc">Загазованность, % НКПР (ДАТ-М; П1 ${P1} % — условно, П2 ${P2} % — отключение, АК-004)</div>`;
    for (const [id, q] of Object.entries(QE)) {
      h += `<div class="qe ${q.st === 2 ? 'a' : q.st === 1 ? 'w' : ''}" data-qe="${id}"><span class="t"><b>${id}</b> ${q.n}${q.cond ? ' <i>(место усл.)</i>' : ''} <span class="lk" data-fly="${q.p[0]},${q.p[1]},${q.ph ? 1 : 0}">показать</span></span><span class="v">${fmt(q.val, 0)} %</span>` +
        `<div class="gb"><i style="width:${Math.min(100, q.val)}%"></i><s style="left:${P1}%"></s><s class="h" style="left:${P2}%"></s></div>${q.man != null ? '<span class="mi">значение задано инструктором</span>' : ''}</div>`;
    }
    h += `<div class="oc">Аварийные посты ESD (с фиксацией)</div><div class="esd">` + Object.entries(ESD).map(([id, b]) => `<button class="pbtn ${b.on ? 'red' : ''}" data-esd="${id}" title="${b.n}">${b.on ? '◉ ' + id + ' — отжать' : id}</button>`).join('') + `</div>`;
    h += `<div class="oc">Местные кнопки «Стоп» (без фиксации)</div><div class="esd">` + Object.entries(LOCAL).map(([k, l]) => `<button class="pbtn" data-loc="${k}" title="Отключает ${l.pumps.join(', ')}">${l.n}</button>`).join('') + `</div>`;
    const blocked = ALLP.map(p => [p, blockReason(p)]).filter(x => x[1]), run = ALLP.filter(p => L.st.pump[p]);
    h += `<div class="oc">Насосы</div><div class="bl">${run.length ? 'В работе: <b>' + run.join(', ') + '</b>' : 'Все насосы остановлены.'}</div>` + (blocked.length ? (a.length ? `<div class="bl er">Пуск всех насосов заблокирован ПАЗ.</div>` : '') + blocked.filter(([p]) => F.pump[p]).map(([p, r]) => `<div class="bl er"><b>${p}</b>: ${r}</div>`).join('') : '<div class="bl ok">Блокировок ПАЗ нет (уровни и подготовка эстакады проверяются при пуске).</div>');
    const pools = Object.values(POOLS).filter(q => q.vol > 0.002), des = Object.entries(DE).filter(([, d]) => d.vol > 0);
    if (pools.length || des.length) {
      h += `<div class="oc">Разливы и дренажные ёмкости (модель)</div>` + pools.map(q => `<div class="bl" data-pool="${q.k}"><b>${q.n}</b> (${PN[q.prod] || q.prod}): <span class="pv">${fmt(q.vol * 1000, 0)} л, ≈ ${fmt(q.area, 1)} м²</span> <button class="pbtn sm" data-clean="${q.k}">собрать сорбентом</button> <span class="lk" data-fly="${q.zone === 'est' ? 'est:' + q.x : q.x + ',' + q.z + ',' + (q.zone === 'ph' ? 1 : 0)}">показать</span></div>`).join('') +
        des.map(([k, d]) => `<div class="bl" data-de="${k}">${d.n}: <span class="pv">${fmt(d.vol, 2)} из ${d.cap} м³</span> <button class="pbtn sm" data-pumpde="${k}">откачать</button></div>`).join('');
    }
    // инструктор
    const pumps = ALLP.filter(p => L.PU[p].mesh), valves = Object.keys(L.V);
    const usn = sel['sp-usn'] || 'УСН-N1', sp = SC.spill, se = SC.seal;
    h += `<details class="inst"${UI.inst ? ' open' : ''}><summary><b>Инструктор: аварийные ситуации</b></summary>` +
      `<div class="sc"><b>Пролив на эстакаде</b> — неплотность присоединения УСН; течёт самотёком, пока присоединено устройство и открыт нижний сливной прибор цистерны (шаги — вкладка «Эстакада»).<br>` +
      (sp ? `Активно: ${sp.usnN}, ${fmt(sp.q, 1)} м³/ч${sp.on ? '' : ' — течь начнётся при открытом сливном приборе'}. <button class="pbtn sm red" data-sc="spill">Устранить течь</button>` :
        `<select data-p="sp-usn">${['УСН-N1', 'УСН-N2', 'УСН-N3'].map(u => opt(u, `${u} (${({ 'УСН-N1': 'ВЦ-1', 'УСН-N2': 'ВЦ-2', 'УСН-N3': 'ВЦ-3' })[u]}${V[USN_VC[u]].prod ? ', ' + PN[V[USN_VC[u]].prod] : ', пуста'})`, usn)).join('')}</select> <input type="number" min="0.5" max="30" step="0.5" value="${sel['sp-q'] || 4}" data-p="sp-q"> м³/ч <button class="pbtn sm" data-sc="spill">Начать</button>`) + `</div>` +
      `<div class="sc"><b>Утечка через торцевое уплотнение насоса</b> (цех 200) — только пока насос работает.<br>` +
      (se ? `Активно: ${se.pid}, ${fmt(se.q * 1000 / 60, 1)} л/мин${se.on ? '' : ' — проявится при работе насоса'}. <button class="pbtn sm red" data-sc="seal">Устранить</button>` :
        `<select data-p="se-p">${pumps.map(u => opt(u, u, sel['se-p'])).join('')}</select> <input type="number" min="0.2" max="20" step="0.2" value="${sel['se-q'] || 2}" data-p="se-q"> л/мин <button class="pbtn sm" data-sc="seal">Начать</button>`) + `</div>` +
      `<div class="sc"><b>Отказ сигнализатора верхнего аварийного уровня LSA H</b> (перелив при наполнении) <select data-p="lsa-k">${['RVS1', 'RVS2', 'RVS3', 'RGSZ1', 'RGSZ2', 'RGSB1', 'RGSB2'].map(k => opt(k, `${V[k].n} (${V[k].tagH})${F.lsa[k] ? ' — НЕИСПРАВЕН' : ''}`, sel['lsa-k'])).join('')}</select> <button class="pbtn sm" data-sc="lsa">Отказ / восстановить</button></div>` +
      `<div class="sc"><b>Отказ насоса</b> (срабатывание защиты двигателя) <select data-p="pf-p">${ALLP.filter(p => p !== 'Н-4').map(u => opt(u, u + (F.pump[u] ? ' — НЕИСПРАВЕН' : L.st.pump[u] ? ' — в работе' : ''), sel['pf-p'])).join('')}</select> <button class="pbtn sm" data-sc="pump">Отказ / ремонт</button></div>` +
      `<div class="sc"><b>Заклинивание арматуры</b> — в текущем положении <select data-p="vf-v">${valves.map(u => opt(u, u + (F.valve[u] ? ' — ЗАКЛИНИЛА (' + (F.valve[u] === 'open' ? 'открыта' : 'закрыта') + ')' : L.st.valve[u] ? ' (открыта)' : ''), sel['vf-v'])).join('')}</select> <button class="pbtn sm" data-sc="valve">Заклинить / исправить</button></div>` +
      `<div class="sc"><b>Загазованность — значение инструктора</b> (вместо модели; для отработки защиты при любом продукте)` +
        Object.entries(QE).map(([id, q]) => `<label class="man" data-qm-row="${id}"><input type="checkbox" data-qm="${id}" ${q.man != null ? 'checked' : ''}> <b>${id}</b> <input type="range" min="0" max="100" step="1" value="${q.man != null ? q.man : Math.round(q.val)}" data-qv="${id}" ${q.man != null ? '' : 'disabled'}><span class="mv">${q.man != null ? q.man : Math.round(q.val)} %</span></label>`).join('') + `</div>` +
      `<div class="sc"><b>Сигнал «Пожар»</b> (АПС) <select data-p="fz">${Object.entries(ZONES).map(([k, n]) => opt(k, n + (fire[k] ? ' — ПОЖАР' : ''), sel.fz)).join('')}</select> <button class="pbtn sm" data-sc="fire">Пожар / ликвидирован</button></div>` +
      `<div class="pbar"><button class="pbtn" data-sc="clear">Снять все неисправности, утечки и разливы</button></div>` +
      `<div class="rn">Загазованность от разлива — учебная модель: растёт с площадью зеркала и близостью к датчику; у ДТ на открытой площадке обычно невелика, у бензина и в закрытом помещении — выше. Для отработки защиты при любом продукте — «значение инструктора» выше. Огонь и тушение (ПНС 644, лафетные вышки 800), персонал и техника — следующий этап.</div></details>`;
    h += `<div class="oc">Журнал событий (модельное время)</div><div class="jr" id="emgJr"></div>`;
    h += `<div class="rn">Логика ПАЗ — по АК-002/004: все насосы отключаются при ДВК ≥ ${P2} % НКПР (QE-1a…5a), ESD и пожаре; N1–N5 и КО-1…3 закрываются при пожаре и аварии. Фиксация срабатывания и сброс кнопкой SB, порог П1 — модель (уточнить по алгоритмам АСУ ТП). ТРК-1 (встроенный насос) отключается вместе с насосами — условно. Места постов ESD и датчиков QE-1a, 2a, 4a — условные.</div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-p]').forEach(x => { if (sel[x.dataset.p] != null && x.tagName === 'INPUT') x.value = sel[x.dataset.p]; });
    const d = box.querySelector('details.inst'); d.ontoggle = () => { UI.inst = d.open; };
    UI.ev = null; live();
  }
  function live() {   // обновление значений без перестройки разметки (не мешает нажатиям)
    for (const [id, q] of Object.entries(QE)) {
      const r = box.querySelector(`[data-qe="${id}"]`); if (!r) continue;
      r.querySelector('.v').textContent = fmt(q.val, 0) + ' %'; r.querySelector('.gb i').style.width = Math.min(100, q.val) + '%';
      const m = box.querySelector(`[data-qm-row="${id}"]`); if (m && q.man == null) { const rg = m.querySelector('[data-qv]'); if (document.activeElement !== rg) rg.value = Math.round(q.val); m.querySelector('.mv').textContent = Math.round(q.val) + ' %'; }
    }
    for (const q of Object.values(POOLS)) { const e = box.querySelector(`[data-pool="${q.k}"] .pv`); if (e) e.textContent = `${fmt(q.vol * 1000, 0)} л, ≈ ${fmt(q.area, 1)} м²`; }
    for (const [k, d] of Object.entries(DE)) { const e = box.querySelector(`[data-de="${k}"] .pv`); if (e) e.textContent = `${fmt(d.vol, 2)} из ${d.cap} м³`; }
    const jr = box.querySelector('#emgJr'), ev = PS.S.events;
    if (jr && UI.ev !== ev[0]) { UI.ev = ev[0]; jr.innerHTML = ev.length ? ev.slice(0, 14).map(e => `<div class="ev ${e.lvl}"><b>${hms(e.t)}</b> ${e.txt}</div>`).join('') : '<div class="empty">Событий пока нет.</div>'; }
  }
  if (box) {
    box.addEventListener('click', e => {
      const b = e.target.closest('button,.lk'); if (!b) return;
      const val = k => { const x = box.querySelector(`[data-p="${k}"]`); return x ? x.value : ''; };
      if (b.dataset.a === 'reset') resetAll();
      else if (b.dataset.a === 'ack') ackAlarm();
      else if (b.dataset.esd) pressESD(b.dataset.esd, !ESD[b.dataset.esd].on);
      else if (b.dataset.loc) localStop(b.dataset.loc);
      else if (b.dataset.clean) { const q = POOLS[b.dataset.clean]; if (q) { log(`Разлив «${q.n}»: собрано сорбентом ${fmt(q.vol * 1000, 0)} л (модель).`, 'ok'); q.vol = 0; q.ov = 0; drawPool(q); } }
      else if (b.dataset.pumpde) { const d = DE[b.dataset.pumpde]; log(`${d.n}: откачано ${fmt(d.vol, 2)} м³ (модель).`, 'ok'); d.vol = 0; d.warn = 0; }
      else if (b.dataset.fly && b.dataset.fly.startsWith('est:')) { flySpill(+b.dataset.fly.slice(4)); if (innerWidth < 700) closePanels(); return; }
      else if (b.dataset.fly) { const [x, z, ph] = b.dataset.fly.split(',').map(Number), y = ph ? PH_F1 : hAt(x, z); if (ph && layerApi && layerApi.isOn('phroof')) layerApi.setVis('phroof', false); flyTo([x + 7, y + 8, z + 9], [x, y, z]); if (innerWidth < 700) closePanels(); return; }
      else if (b.dataset.sc) scenario(b.dataset.sc, val);
      render(true);
    });
    box.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.qm) { const q = QE[t.dataset.qm]; q.man = t.checked ? Math.round(q.val) : null; log(`${t.dataset.qm}: ${t.checked ? 'задано значение инструктором' : 'возврат к модели'}.`, 'info'); render(true); }
    });
    box.addEventListener('input', e => { const t = e.target; if (t.dataset.qv) { const q = QE[t.dataset.qv]; if (q.man != null) { q.man = +t.value; q.val = q.man; t.closest('label').querySelector('.mv').textContent = t.value + ' %'; live(); } } });
    box.addEventListener('keydown', e => e.stopPropagation());
  }
  function localStop(k) { const l = LOCAL[k], s = stopPumps(l.pumps, l.n); log(`${l.n}: ${s.length ? 'остановлены ' + s.join(', ') : 'насосы этой группы не работали'}.`, s.length ? 'warn' : 'info'); if (!s.length) toast(`${l.n}: насосы ${l.pumps.join(', ')} не работали.`, 'info'); }
  function pressESD(id, on) {
    const b = ESD[id]; b.on = on;
    log(on ? `Нажата кнопка ESD: ${b.n}.` : `Кнопка ESD отжата: ${b.n}. Для пуска — «Сброс сигнализации».`, on ? 'alarm' : 'info');
    evaluate();
    render(true); if (curSel && curSel.emg) select(curSel);
  }
  // вид на лоток пути у цистерны: сверху-сбоку, со стороны стенки 799 (пятно частично под цистерной)
  const flySpill = x => flyTo([x - 8, EST177.RH + 10, EST177.TZ + 8.5], [x, EST177.RH - 0.2, EST177.TZ]);
  function scenario(k, val) {
    if (k === 'spill') {
      if (SC.spill) { log(`Течь у ${SC.spill.usnN} устранена (присоединение уплотнено).`, 'ok'); SC.spill = null; return; }
      const usnN = val('sp-usn') || 'УСН-N1', n = L.N[USN_ND[usnN]], ci = USN_CI[usnN], v = V[USN_VC[usnN]];
      SC.spill = { usnN, ci, vc: USN_VC[usnN], q: Math.max(0.5, Math.min(30, +val('sp-q') || 4)), x: n.p[0], z: EST177.TZ, total: 0, on: false };
      const st = ESTOPS.S[ci];
      log(`Аварийная ситуация: неплотность присоединения ${usnN} (${fmt(SC.spill.q, 1)} м³/ч).${!v || v.vol <= 0.01 ? ' Цистерна пуста — течи не будет.' : st && st.cv && st.usn ? '' : ' Течь начнётся при присоединённом УСН и открытом нижнем сливном приборе.'}`, 'warn');
      flySpill(n.p[0]);
    } else if (k === 'seal') {
      if (SC.seal) { log(`Утечка через уплотнение ${SC.seal.pid} устранена (ремонт).`, 'ok'); SC.seal = null; return; }
      const pid = val('se-p') || 'Н-7', ph = PH.pumps.find(q => q[5] === L.PU[pid].mesh);
      if (!ph) { toast(`${pid}: в 3D-модели цеха нет агрегата.`, 'err'); return; }
      const lk = L.pumpLinks(pid), prod = (lk.suc.map(n => V[NV[n]]).find(v => v && v.prod) || {}).prod || (L.PU[pid].mesh === 'Н-8' ? 'B' : 'L');
      SC.seal = { pid, q: Math.max(0.2, Math.min(20, +val('se-q') || 2)) * 60 / 1000, prod, x: (ph[0] + ph[2]) / 2, z: (ph[1] + ph[3]) / 2, total: 0, on: false };
      log(`Аварийная ситуация: утечка через торцевое уплотнение ${pid} (${fmt(SC.seal.q * 1000 / 60, 1)} л/мин)${L.st.pump[pid] ? '' : ' — проявится при работе насоса'}.`, 'warn');
    } else if (k === 'lsa') {
      const kk = val('lsa-k') || 'RVS1', v = V[kk];
      if (F.lsa[kk]) { delete F.lsa[kk]; v.lsaHFail = false; log(`Сигнализатор ${v.tagH} (${v.n}) восстановлен.`, 'ok'); }
      else { F.lsa[kk] = true; v.lsaHFail = true; log(`Аварийная ситуация: отказ сигнализатора ${v.tagH} (${v.n}) — верхний аварийный уровень не формируется.`, 'warn'); }
    } else if (k === 'pump') {
      const p = val('pf-p') || 'Н-5';
      if (F.pump[p]) { delete F.pump[p]; log(`${p}: неисправность устранена, насос готов к пуску.`, 'ok'); }
      else {
        F.pump[p] = 'срабатывание защиты двигателя'; const was = L.st.pump[p];
        log(`Аварийная ситуация: ${p} — срабатывание защиты двигателя${was ? ', насос отключился' : ''}.`, 'alarm');
        if (was) { stopPumps([p], 'аварийное отключение — защита двигателя'); say(`Авария насоса ${p.replace('Н-', 'эн ')}.`); alert0(`Аварийное отключение ${p}`); }
      }
    } else if (k === 'valve') {
      const v = val('vf-v');
      if (!v) return;
      if (F.valve[v]) { delete F.valve[v]; log(`${v}: заклинивание устранено.`, 'ok'); }
      else { F.valve[v] = L.st.valve[v] ? 'open' : 'closed'; log(`Аварийная ситуация: ${v} заклинило в положении «${L.st.valve[v] ? 'открыта' : 'закрыта'}».`, 'warn'); }
    } else if (k === 'fire') {
      const z = val('fz') || 'est'; fire[z] = !fire[z];
      if (fire[z]) { evaluate(); const [x, zz] = ZP[z], y = hAt(x, zz); flyTo([x + 22, y + 24, zz + 26], [x, y, zz]); }
      else log(`${ZONES[z]}: сигнал «Пожар» снят. Для пуска насосов — «Сброс сигнализации».`, 'ok');
    } else if (k === 'clear') {
      SC.spill = SC.seal = null; for (const k2 in F.pump) delete F.pump[k2]; for (const k2 in F.valve) delete F.valve[k2];
      for (const k2 of Object.keys(F.lsa)) { V[k2].lsaHFail = false; delete F.lsa[k2]; }
      for (const z in fire) fire[z] = false; for (const q of Object.values(QE)) q.man = null;
      for (const q of Object.values(POOLS)) { q.vol = 0; q.ov = 0; drawPool(q); }
      log('Инструктор: неисправности, утечки и разливы сняты. Если ПАЗ сработала — «Сброс сигнализации».', 'info');
    }
    if (curSel && curSel.emg) select(curSel);
  }

  /* ---------- 13. карточка объекта ---------- */
  function cardVal(o) {
    if (o.emg.k === 'qe') { const q = QE[o.emg.id]; return `Показание (модель): <b>${fmt(q.val, 0)} % НКПР</b> — ${q.st === 2 ? 'АВАРИЯ (П2)' : q.st === 1 ? 'предупреждение (П1)' : 'норма'}`; }
    if (o.emg.k === 'esd') { const b = ESD[o.emg.id]; return `Кнопка: <b>${b.on ? 'НАЖАТА (аварийный останов)' : 'в исходном положении'}</b>`; }
    if (o.emg.k === 'pool') { const q = POOLS[o.emg.id]; return q ? `Продукт: ${PN[q.prod] || q.prod}; на поверхности ≈ ${fmt(q.vol * 1000, 0)} л, площадь ≈ ${fmt(q.area, 1)} м²` : ''; }
    return '';
  }
  function cardHTML(o) {
    if (o.emg) {
      const on = o.emg.k === 'qe' ? QE[o.emg.id].st === 0 : o.emg.k === 'esd' ? !ESD[o.emg.id].on : false;
      return `<div class="pst ${on ? 'on' : 'off'}" id="emgCardVal">${cardVal(o)}</div><div class="pbar">` +
        (o.emg.k === 'esd' ? `<button class="pbtn ${ESD[o.emg.id].on ? '' : 'red'}" data-emgesd="${o.emg.id}">${ESD[o.emg.id].on ? 'Отжать кнопку' : 'Нажать ESD'}</button>` : '') +
        (o.emg.k === 'pool' ? `<button class="pbtn" data-emgclean="${o.emg.id}">Собрать сорбентом</button>` : '') + `<button class="pbtn" data-emgtab="1">Вкладка «ПАЗ»</button></div>`;
    }
    const pid = o.proc && o.proc.k === 'pump' ? o.proc.id : Object.keys(L.PU).find(k => L.PU[k].mesh && L.PU[k].mesh === o.id);
    if (pid) { const r = blockReason(pid); return r ? `<div class="n" style="color:#b02a2a">ПАЗ: ${r}.</div>` : ''; }
    const vid = o.proc && o.proc.k === 'valve' ? o.proc.id : null;
    if (vid && F.valve[vid]) return `<div class="n" style="color:#b02a2a">Неисправность: заклинивание в положении «${F.valve[vid] === 'open' ? 'открыта' : 'закрыта'}».</div>`;
    return '';
  }
  function bindCard(el) {
    el.querySelectorAll('[data-emgtab]').forEach(b => b.onclick = () => openTab());
    el.querySelectorAll('[data-emgesd]').forEach(b => b.onclick = () => pressESD(b.dataset.emgesd, !ESD[b.dataset.emgesd].on));
    el.querySelectorAll('[data-emgclean]').forEach(b => b.onclick = () => { const q = POOLS[b.dataset.emgclean]; if (q) { log(`Разлив «${q.n}»: собрано сорбентом ${fmt(q.vol * 1000, 0)} л (модель).`, 'ok'); q.vol = 0; q.ov = 0; drawPool(q); select(null); } });
  }

  const api = { QE, ESD, ZONES, fire, F, POOLS, DE, SC, latch, LOCAL, P1, P2, tick, overflow, render, resetAll, pressESD, localStop, scenario, evaluate, cardHTML, bindCard, blockReason, active, ackAlarm, openTab, g: G, get ack() { return ack; } };
  window.__EMG = api;
  return api;
})();

