/* ---------- F34 (v0.34): устранение расхождений сверки v0.33 ----------
   Правило выбора при противоречии листов: детальный рабочий лист раздела (ТХ, ТК М 1:100) — выше сводного плана ГП-005;
   опросный лист (документ заказа) — выше спецификации по типу изделия; ТХ-001 (технологическая часть) — выше АК по ролям насосов.
   P51 — дренаж от цеха 200 по 152-ТК-005 (z 21,88; поворот x −49,03; ответвление x −54,25 к линии ДТ(З));
   P16 — Гу от станции 186 надземно на +5,000 через дорогу (186-ТХ-002, 152-ТК-005); опуск к трассе у x −43,35 — условно;
   P52 — ДТ(Л) Ø219 на пункт экипировки по 152-ТК-004 (разрез 1-1): низ 297,82, 3650 от оси 2, опуск к врезке в существующий Ø219×6;
   P53 — дренажные отводы Ø32 от насосов к коллектору цеха с задвижками по 200-ТХ-002 (Ду и отметки — условно). */
const F34 = (() => {
  const log = PATCH_LOG.F34;   // правки P51 (NETS, PH), P16 (UG_DATA), P52 (PH) — в данных с v0.43; reg и valves заполняются ниже
  /* --- P52: ДТ(Л) Ø219 у западной стены цеха 200 — внутренняя часть (до подъёма у стены) в данных PH, наружная — ниже (regPipes) --- */
  const XR = -76.30, XD = -81.13, ZL = 31.393;   // подъём у внутренней грани стены (≈ −76,48) — условно; опуск: ось 2 (−77,46) − 3,65 м
  /* --- P53: дренажные отводы от агрегатов (вектор 200-ТХ-002: двойные линии Ø32, разрыв — задвижка) --- */
  const DR = [[20.954, -66.52, -66.679], [21.70, -66.30, -66.679], [22.535, -66.415, -66.679], [23.624, -66.415, -66.679], [25.83, -66.415, -66.679],
    [26.919, -66.415, -66.679], [27.725, -66.102, -66.93], [28.913, -66.717, -66.93], [29.538, -66.102, -66.93], [30.727, -66.717, -66.93]];
  const XC = -67.253, YC = -0.756;   // ось дренажного коллектора цеха (Д-022) и его отметка в модели (v0.29)
  function regPipes(netMat, hAt) {
    const mD = netMat('d'), mL = netMat('dtl');
    for (const [z, xe, xv] of DR) {
      PIPEREG.push({ gen: 'PHX', net: 'd', r: 0.016, od: 0.032, pts: [[XC, YC, z], [xe, YC, z], [xe, YC + 0.25, z]], mt: mD,
        name: `Дренажный отвод Ø32 от агрегата к коллектору (z ${z.toFixed(2).replace('.', ',')})`, src: '200-ТХ-002-0 (план); Ду и отметки — условно', cf: { plan: 'V', elev: 'P', dn: 'P' }, eqEnd: 'Дренажный штуцер агрегата (условно)' });
      log.reg.push('P53 ' + z);
    }
    // P52: подъём у стены → наружу на отм. низа 297,82 → опуск к врезке в существующий подземный Ø219×6 (глубина — по месту)
    const yIn = 0.249, yOut = 297.82 + 0.1095 - 297.30, gy = hAt(XD, ZL), yB = gy - 1.0;
    PIPEREG.push({ gen: 'TK', net: 'dtl', r: 0.1095, od: 0.219, pts: [[XR, yIn, ZL], [XR - (yOut - yIn), yOut, ZL], [XD, yOut, ZL], [XD, yB, ZL]], mt: mL,
      name: 'ДТ(Л) Ø219×6 на пункт экипировки локомотивов (152-ТК-004-0, разрез 1-1)', src: '152-ТК-004-0: низ трубы 297,82, 3650 от оси 2; подъём 0,38 м в стене — двумя отводами 45° (вертикальный подъём с отводами 90° Ø219 не помещается), глубина врезки — условно', cf: { plan: 'V', elev: 'V', dn: 'V' } });
    PIPEREG.push({ gen: 'TK', net: 'dtl', r: 0.1095, od: 0.219, pts: [[XD, yB, ZL], [XD - 2.5, yB, ZL]], mt: mL,
      name: 'Существующий трубопровод ДТ(Л) Ø219×6 к пункту заправки локомотивов (врезка по месту)', src: '152-ТК-004-0 (существующий, глубина — по месту, прим. 4)', cf: { plan: 'P', elev: 'P', dn: 'V' }, eqEnd: 'Существующий трубопровод — продолжение к ЛСЦ (вне границы проектирования)' });
    log.reg.push('P52');
  }
  /* --- P51: врезка дренажного ответвления (ТК-005) в угол линии ДТ(З) — дренажная врезка с задвижкой, не смешение продуктов --- */
  const LIQ = ['dtl', 'dtz', 'b', 'lzb'];
  function teeDrain(E) {
    const dr = E.filter(q => q.s.net === 'd');
    return dr.length === 1 && dr[0].s.tk === 1 && E.every(q => q.s.net === 'd' || LIQ.includes(q.s.net));
  }
  /* --- задвижки дренажных отводов (P53) и ответвления к ДТ(З) (P51) --- */
  function buildValves(parent, pickables, hAt) {
    const g = new THREE.Group(); g.name = 'v0.34: задвижки дренажных отводов агрегатов (200-ТХ-002)'; parent.add(g);
    const mB = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 }), mW = new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: 0.5, metalness: 0.3 });
    for (const [z, , xv] of DR) {
      const o = { id: 'ЗД-дренаж', net: 1, name: 'Задвижка дренажного отвода агрегата', note: `200-ТХ-002-0: дренажный отвод Ø32 к коллектору цеха с запорной арматурой (z ${z.toFixed(2).replace('.', ',')}). Тип и Ду арматуры, отметки — условно (позиции 18/58 спецификации — уточнить).` };
      const add = (geo, m, x, y, rx, rz) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); if (rz) me.rotation.z = rz; if (rx) me.rotation.x = rx; me.castShadow = true; me.userData.o = o; me.userData.pick = () => o; g.add(me); pickables.push(me); };
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), mB, xv, YC, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 12), mB, xv - 0.05, YC, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 12), mB, xv + 0.05, YC, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), mB, xv, YC + 0.08);
      add(new THREE.TorusGeometry(0.035, 0.005, 6, 14), mW, xv, YC + 0.14, Math.PI / 2);
      log.valves++;
    }
    if (hAt) {   // P51: задвижка на ответвлении x −54,25 у врезки в ДТ(З) (152-ТК-005); тип и Ду — условно
      const x = -54.246, z = 25.35, y = hAt(x, 23.764) + 0.6, o = { id: 'ЗД-дренаж ДТ(З)', net: 1, name: 'Задвижка дренажного ответвления от линии ДТ(З)', note: '152-ТК-005-0: дренажное ответвление x −54,25 от линии ДТ(З) к дренажной линии цеха 200 (z 21,88). Тип, Ду и место задвижки — условно (на листе арматура не обозначена).' };
      const add = (geo, m, px, py, pz, rx) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); if (rx) me.rotation.x = rx; me.castShadow = true; me.userData.o = o; me.userData.pick = () => o; g.add(me); pickables.push(me); };
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 14), mB, x, y, z, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 14), mB, x, y, z - 0.085, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 14), mB, x, y, z + 0.085, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), mB, x, y + 0.14, z);
      add(new THREE.TorusGeometry(0.07, 0.008, 6, 16), mW, x, y + 0.26, z, Math.PI / 2);
      log.valves++;
    }
  }
  return { log, regPipes, buildValves, teeDrain };
})();
