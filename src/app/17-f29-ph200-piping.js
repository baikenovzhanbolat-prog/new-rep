/* ---------- F29 (v0.29): обвязка насосного цеха 200 — отметки по 200-ТХ-003-0, Ø по 200-ТХ.С-001-0 ----------
   Отметки — «низ трубы» относительно 0,000 = 297,40 (верх пола венткамеры и электрощитовой; пол насосного зала −1,000).
   Ось трубы в сцене: y = 0,10 + низ + Dн/2 (H0 = 297,30).
   Разрезы 200-ТХ-003-0:
     3-3 — нагнетание Н-3 на котельную Ø57: −0,500; 4-4 — всас Н-3, ДТ(Л) от РВС Ø89: −0,500;
     5-5 — нагнетание Н-8: коллектор и выход «Бензин на 186» +0,400, выход «Бензин в РГС» +0,650;
     6-6 — нагнетание Н-7: коллектор и выход «ДТ(З) на 186» +0,100, «ДТ(Л) в РВС» Ø108 +0,400, «ДТ(З) в РГС» +1,120, «ДТ(Л) на 186» −0,800;
     7-7 — всас Н-7: «ДТ(З) от эстакады» −0,500, «ДТ(З) от РГС» на стене +0,400;
     8-8 — нагнетание Н-5/Н-6: коллектор 0,000, выход «ДТ(Л) в РВС» Ø159 +0,400;
     9-9 — всас Н-5/Н-6: «ДТ(Л) от РВС» и «от (на) эстакады» Ø219 −0,500;
     1-1, 2-2 — Н-1/Н-2: всасывающий коллектор −0,445, нагнетание +0,040.
   По аналогии (разрезов нет — условно): всас Н-8 (как 7-7: −0,500, «от РГС» на стене +0,400); выходы «ДТ(Л) от РВС» и «от эстакады» Ø159 — −0,500;
   дренажные трубы — у пола −0,900. Переход к отметке выхода — в 0,4 м от стены (как на разрезах 5-5, 6-6, 8-8).
   v0.43: отметки (el, wo), источники (elSt, woSt), Ø по ряду 200-ТХ.С (odAk — прежний Ø по АК-041) и узлы по 200-ТХ-002 (tx)
   хранятся в данных PH.pipes (data/04-terrain-relief.PH.json); журнал правок — data/patch-log.json. */
const F29 = (() => {
  const Y0 = 0.10, XW = -61.0;
  const log = PATCH_LOG.F29.log;   // od, tag — правки v0.29 (в данных с v0.43); risers считается ниже
  const TX = PATCH_LOG.F29.TX;   // v0.30: узлы с наложениями линий АК-041 по векторному плану 200-ТХ-002-0 — журнал (в данных с v0.43)
  const yOf = (p, x) => { const el = (p.wo !== undefined && x > XW) ? p.wo : p.el; return el === undefined ? PH_PIPE_Y : Y0 + el + p[4] / 2; };
  const segD = (p, x, z) => { const ux = p[2] - p[0], uz = p[3] - p[1], L2 = ux * ux + uz * uz || 1e-9, t = Math.max(0, Math.min(1, ((x - p[0]) * ux + (z - p[1]) * uz) / L2)); return [Math.hypot(p[0] + ux * t - x, p[1] + uz * t - z), t]; };
  /* отметка оси трубы цеха в точке (x, z); при совпадении — предпочтение трубе, у которой точка внутри участка */
  function phY(x, z, tol = 0.06) {
    let best = null, bd = Infinity;
    for (const p of PH.pipes) { const [d, t] = segD(p, x, z); if (d > tol) continue; const sc = d + (t < 0.02 || t > 0.98 ? 0.01 : 0); if (sc < bd) { bd = sc; best = p; } }
    return best ? yOf(best, x) : PH_PIPE_Y;
  }
  /* сегменты PNET: горизонтальные участки на своих отметках, переход к отметке выхода у стены, стояки в узлах с разной отметкой */
  function segs() {
    const out = [], P = PH.pipes.filter(p => Math.hypot(p[2] - p[0], p[3] - p[1]) >= 0.02);
    for (const p of P) {
      const [x1, z1, x2, z2, D, c] = p, ya = yOf(p, Math.min(x1, x2)), split = p.wo !== undefined && Math.max(x1, x2) > XW + 0.05 && Math.min(x1, x2) < XW - 0.05 && Math.abs(z1 - z2) < 0.01;
      if (!split) { out.push({ p, c, D, a: [x1, yOf(p, x1), z1], b: [x2, yOf(p, x2), z2] }); continue; }
      const xl = Math.min(x1, x2), xr = Math.max(x1, x2), yi = Y0 + p.el + D / 2, yo0 = Y0 + p.wo + D / 2, yo = Math.abs(yo0 - yi) > 0.06 ? yo0 : yi;
      out.push({ p, c, D, a: [xl, yi, z1], b: [XW, yi, z1] });
      if (Math.abs(yo - yi) > 0.06) out.push({ p, c, D, a: [XW, yi, z1], b: [XW, yo, z1], riser: 1, name: 'Подъём/опуск к отметке выхода через стену' });
      out.push({ p, c, D, a: [XW, yo, z1], b: [xr, yo, z1] });
    }
    /* узлы: в точке сходятся трубы на разных отметках — стояки между соседними отметками; только совместимые продукты, не для параллельных наложений */
    const comp = (a, b) => a === b || a === 'DT' && (b === 'L' || b === 'Z') || b === 'DT' && (a === 'L' || a === 'Z');
    const dirOf = p => Math.abs(p[2] - p[0]) >= Math.abs(p[3] - p[1]) ? 'x' : 'z';
    const J = new Map();
    for (const p of P) for (const [x, z] of [[p[0], p[1]], [p[2], p[3]]]) {
      const k = x.toFixed(3) + '|' + z.toFixed(3); let j = J.get(k); if (!j) J.set(k, j = { x, z, list: [p] });
      for (const q of P) { if (q === p || j.list.includes(q)) continue; const [d] = segD(q, x, z); if (d <= 0.03) j.list.push(q); }
    }
    const seen = new Set();
    for (const j of J.values()) {
      const L = j.list.filter((q, i, a) => a.every((o, k) => k >= i || comp(o[5], q[5]) && !(dirOf(o) === dirOf(q) && Math.abs(segD(o, j.x, j.z)[1] - 0.5) < 0.49 && Math.abs(segD(q, j.x, j.z)[1] - 0.5) < 0.49)));
      const lv = [...new Map(L.map(q => [yOf(q, j.x).toFixed(3), q])).entries()].map(([y, q]) => [+y, q]).sort((u, v) => u[0] - v[0]);
      for (let i = 0; i + 1 < lv.length; i++) {
        const [y0, q0] = lv[i], [y1, q1] = lv[i + 1]; if (y1 - y0 < 0.06) continue;   // разница осей из-за разных Ø при одной отметке низа — фасонная деталь, не стояк
        const k = j.x.toFixed(3) + '|' + j.z.toFixed(3) + '|' + y0.toFixed(3); if (seen.has(k)) continue; seen.add(k);
        const q = q0[4] <= q1[4] ? q0 : q1;
        out.push({ p: q, c: q[5], D: q[4], a: [j.x, y0, j.z], b: [j.x, y1, j.z], riser: 1, name: 'Стояк в узле: соединение труб на разных отметках (200-ТХ-003)' }); log.risers++;
      }
    }
    return out;
  }
  /* вид: насосный зал сверху (кровля снимается — как слоем «Насосный цех: кровля») */
  const VIEWS = { hall: () => { if (typeof ROOF200 !== 'undefined' && ROOF200) ROOF200.visible = false; flyTo([-67.5, 13.5, 36.0], [-67.5, -0.6, 26.4], 0.9); },
    sec: () => { if (typeof ROOF200 !== 'undefined' && ROOF200) ROOF200.visible = false; flyTo([-64.2, 1.5, 32.0], [-61.0, -0.3, 25.0], 0.9); } };
  return { TX, VIEWS, phY, yOf, segs, XW, Y0, log };
})();
const phY = (x, z) => F29.phY(x, z);
