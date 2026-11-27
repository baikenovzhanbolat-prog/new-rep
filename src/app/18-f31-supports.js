/* ---------- F31 (v0.31): опоры трубопроводов по 152-ТК-005-0, 152-ТК-006-0 и 200-ТХ-002-0; изоляция 186 по 186-ТХ.ВТ ----------
   Наружные опоры: символы опор (двутавр «I» поперёк трубы) и номера ОП/ОН сняты с векторных листов ТК-005 / ТК-006 (444.pdf, стр. 19, 20).
   Привязка листа к сцене — по осям трубопроводов ГП-005 (подбор масштаба и сдвига; среднее отклонение 4 см на ТК-005, 8 см на ТК-006):
     ТК-005: x = 0,035489·X − 66,50; z = 0,035489·Y − 31,19;   ТК-006: x = 0,035524·X − 26,18; z = 0,035524·Y − 29,02 (X, Y — pt листа).
   Экземпляр ГП-005 в проекте («5632.29-ГП-005-0.dwg.pdf») для опор непригоден: геометрия слоёв 03-2_Опоры и 03-2_Фундаменты_опоры стянута в точку.
   Опоры цеха 200: знаки опор и марки ОП/ОН — по 200-ТХ-002-0 (лист 2, план), места совпадают с прежними знаками АК-041 (≤ 5 см).
   Конструкция опор (стойки, траверсы, хомуты, фундаменты) — условно: листов КМ/КЖ и типовых узлов опор в документации нет. */
const F31 = (() => {
  const OUT = [["ОН35",5,-52.444,23.645,-52.444,26.654,0],["ОП36",5,-49.531,23.673,-49.531,26.682,0],["ОП38",5,-47.014,23.673,-47.014,26.682,1],["ОП39",5,-43.997,23.673,-43.997,26.682,0],["ОП41",5,-40.98,23.673,-40.98,26.682,1],["ОП42",5,-37.96,23.673,-37.96,26.682,0],["ОП44",5,-25.184,28.221,-25.184,27.719,0],["ОП45",5,-31.724,28.221,-31.724,27.719,0],["ОП46",5,-37.509,27.468,-37.004,27.468,0],["ОП48",5,-37.126,23.418,-34.338,23.418,0],["ОП49",5,-37.76,20.903,-34.338,20.903,1],["ОП50",5,-37.76,18.388,-34.338,18.388,0],["ОП51",5,-37.76,15.369,-34.338,15.369,1],["ОП52",5,-37.76,12.351,-34.338,12.351,0],["ОП53",5,-37.76,9.334,-34.338,9.334,1],["ОП54",5,-37.76,6.315,-34.338,6.315,0],["ОП55",5,-37.76,3.8,-34.338,3.8,1],["ОП56",5,-37.76,0.278,-34.338,0.278,0],["ОП57",5,-33.385,0.855,-33.385,1.358,0],["ОП58",5,-39.911,-1.553,-39.911,-0.427,0],["ОН59",5,-37.258,-2.616,-37.258,-2.254,0],["ОП60",5,-33.385,-2.641,-33.385,-0.227,0],["ОП61",5,-34.338,-4.149,-33.836,-4.149,0],["ОП62",5,-34.338,-9.178,-33.836,-9.178,0],["ОП63",5,-35.697,-10.017,-35.697,-9.515,0],["ОП64",5,-42.236,-10.017,-42.236,-9.515,0],["ОП66",5,-32.428,-4.149,-31.926,-4.149,0],["ОП67",5,-32.428,-6.419,-31.926,-6.419,0],["ОП68",5,-32.428,-10.443,-31.926,-10.443,0],["ОП69",5,-32.428,-14.468,-31.926,-14.468,0],["ОП70",5,-32.428,-18.492,-31.926,-18.492,0],["ОП71",5,-31.504,-19.914,-31.86,-20.27,0],["ОП72",5,-28.659,-22.761,-29.015,-23.117,0],["ОП73",5,-25.813,-25.606,-26.168,-25.962,0],["ОН74",5,-24.388,-26.532,-24.388,-26.03,0],["ОП75",5,-20.977,-26.532,-20.977,-26.03,0],["ОП76",5,-16.955,-26.532,-16.955,-26.03,0],["ОП76а",5,-13.533,-26.532,-13.533,-26.03,0],["ОП77",6,-11.33,-26.558,-11.33,-26.055,0],["ОП78",6,-8.408,-26.558,-8.408,-26.055,0],["ОП79",6,-4.482,-26.558,-4.482,-26.055,0],["ОП80",6,-0.353,-26.558,-0.353,-26.055,0],["ОП81",6,3.675,-26.558,3.675,-26.055,0],["ОП82",6,7.704,-26.558,7.704,-26.055,0],["ОП83",6,11.73,-26.558,11.73,-26.055,0],["ОП84",6,15.758,-26.558,15.758,-26.055,0],["ОП85",6,19.787,-26.558,19.787,-26.055,0],["ОП86",6,23.512,-26.558,23.512,-26.055,0],["ОП87",6,25.183,-25.358,25.689,-25.358,0],["ОП88",6,25.183,-21.33,25.689,-21.33,0],["ОН104",5,-28.312,-2.339,-28.312,-0.227,0],["ОП105",5,-22.276,-2.339,-22.276,-0.227,0],["ОП106",5,-21.741,-2.641,-21.339,-2.641,0],["ОП107",5,-16.239,-2.339,-16.239,-0.629,0],["ОП108",6,-10.211,-2.341,-10.211,-1.232,0],["ОП109",6,-4.169,-2.341,-4.169,-1.232,0],["ОП110",6,-3.433,-2.643,-3.03,-2.643,0],["ОП111",6,1.872,-2.341,1.872,-1.232,0],["ОП112",6,7.915,-2.341,7.915,-1.232,0],["ОП113",6,12.446,-2.341,12.446,-1.938,0],["ОП114",6,14.895,-2.643,15.298,-2.643,0]];    // [номер, лист (5 | 6), x0, z0, x1, z1, 1 — знак на размерной линии пучка (опора на весь пучок)]
  const HALL = [["ОП15*",-62.165,28.007,"x"],["ОП15",-62.165,27.583,"x"],["ОП15*",-62.165,27.16,"x"],["ОП15",-62.165,26.737,"x"],["ОП16*",-62.165,26.032,"x"],["ОП16",-62.165,25.528,"x"],["ОП16",-62.165,24.52,"x"],["ОП16*",-62.165,25.024,"x"],["ОН12",-67.636,23.442,"x"],["ОН12",-67.636,26.737,"x"],["ОН1",-73.036,28.276,"z"],["ОН1",-75.303,28.279,"z"],["ОП4",-73.631,30.909,"x"],["ОН3",-72.372,28.46,"z"],["ОП20*",-62.75,21.521,"x"],["ОП20",-63.757,21.884,"x"],["ОП20",-65.188,21.115,"x"],["ОП20",-67.001,21.521,"x"],["ОП7",-66.93,28.651,"x"],["ОП2",-75.303,30.001,"z"],["ОП19*",-62.165,23.442,"x"],["ОП20",-65.188,21.521,"x"],["ОП20",-62.75,21.115,"x"],["ОП6",-70.407,31.593,"x"],["ОП13",-63.757,23.442,"x"],["ОП14",-63.757,22.737,"x"],["ОП19*",-62.165,23.08,"x"],["ОП19",-62.165,22.737,"x"],["ОП13",-63.757,26.737,"x"],["ОП14",-63.757,26.032,"x"],["—",-62.442,24.188,"z"],["ОП7",-66.93,30.465,"x"],["ОП8",-65.56,27.996,"x"],["ОП8",-65.56,29.81,"x"],["ОП11",-62.165,29.467,"x"],["ОП10",-62.317,30.465,"x"],["ОП10*",-62.317,30.909,"x"],["ОП9",-64.14,29.306,"z"],["ОП6",-67.384,31.593,"x"],["ОП6",-63.354,31.593,"x"],["ОП2",-73.036,30.001,"z"],["ОП5",-75.948,31.392,"x"],["ОН3",-74.639,28.46,"z"],["Д",-74.991,29.116,"x"],["Д",-72.674,29.116,"x"],["Д",-71.414,29.116,"x"],["Д",-69.197,29.116,"x"],["Д",-67.485,29.116,"x"],["Д",-67.253,30.163,"z"],["Д",-67.253,26.254,"z"],["Д",-67.253,28.349,"z"],["Д",-67.253,22.959,"z"],["Д",-67.253,24.742,"z"],["Д",-67.253,21.327,"z"],["Д",-66.679,20.712,"x"],["Д",-65.188,20.712,"x"],["Д",-62.75,20.712,"x"]];  // [марка, x, z, ось трубы] — 200-ТХ-002-0; «*» — марка на листе не подписана, принята по соседним в ряду
  const SH = { 5: '152-ТК-005-0', 6: '152-ТК-006-0' };
  // рамки планов (области, где опоры показаны на листах): вне их сохраняются условные опоры с шагом 3 м
  const FR = [
    { sh: 5, x0: -63.48, z0: -29.68, x1: -11.56, z1: 33.73, cut: [-63.48, -29.68, -54.79, -20.42] },
    { sh: 6, x0: -12.83, z0: -27.49, x1: 30.11, z1: 1.98 }
  ];
  const inFrame = (x, z) => FR.some(f => x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && !(f.cut && x >= f.cut[0] && x <= f.cut[2] && z >= f.cut[1] && z <= f.cut[3]));
  const log = { built: 0, miss: [], clash: [], hgt: [], skipCond: 0, keepCond: 0, span: [], hall: 0, hallFix: 0, hallAdd: 1 /* ОП20 у Н-3 — в данных PHX_DATA.sup с v0.43 */, ins: { n: 0, L: {} }, pipes: 0, noSupInFrame: [], items: [] };
  const covered = new Map();   // труба → [дуговые координаты опор по листам]
  const condAt = new Map();    // труба → [дуговые координаты условных опор]
  const NAME = { dtl: 'ДТ(Л)', dtz: 'ДТ(З)', b: 'Б', d: 'Д', gu: 'Гу', lzb: 'ДТ/Б', heat: 'Т', pv: 'В2', prp: 'В10' };
  const fmt = (v, n = 2) => (+v).toFixed(n).replace('.', ',').replace('-', '−');
  const isFixed = id => /^ОН/.test(id);

  /* ---------- накопитель геометрии с выбором опоры по треугольнику ---------- */
  function Acc() { this.parts = {}; }
  Acc.prototype.add = function (key, geo, o) {
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    (this.parts[key] || (this.parts[key] = [])).push([g, o]); if (g !== geo) geo.dispose();
  };
  Acc.prototype.build = function (parent, mats, extra) {
    const out = [];
    for (const key in this.parts) {
      const list = this.parts[key]; let n = 0; for (const [g] of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), rng = []; let o = 0;
      for (const [g, ob] of list) {
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        const c = g.attributes.position.count; rng.push([o / 3, (o + c) / 3, ob]); o += c; g.dispose();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const me = new THREE.Mesh(geo, mats[key]); me.castShadow = true; me.receiveShadow = true; me.name = 'F31: ' + key;
      me.userData.pick = h => { const f = h.faceIndex | 0; let a = 0, b = rng.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (rng[m][0] <= f) a = m; else b = m - 1; } return rng[a][2]; };
      me.userData.o = rng.length ? rng[0][2] : null; Object.assign(me.userData, extra || {});
      parent.add(me); out.push(me);
    }
    return out;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const boxY = (w, d, y0, y1, x, z) => boxAt(w, Math.max(y1 - y0, 0.005), d, x, (y0 + y1) / 2, z);
  // брус длиной L вдоль направления (ux, uz) в плане, сечение h × w, центр (x, y, z)
  const beam = (L, h, w, ux, uz, x, y, z) => new THREE.BoxGeometry(L, h, w).rotateY(Math.atan2(-uz, ux)).translate(x, y, z);
  // хомут — полукольцо поверх трубы, плоскость перпендикулярна оси (dx, dz)
  const clamp = (R, t, dx, dz, x, y, z) => new THREE.TorusGeometry(R, t, 5, 14, Math.PI).rotateY(Math.atan2(dx, dz)).translate(x, y, z);

  /* ---------- 186: теплоизоляция коллектора АСН-N1 по 186-ТХ.ВТ (Ду100 — 4 м, Ду80 — 9 м; маты 60 мм + сталь 0,5 мм) ---------- */
  function applyIns(segs) {
    const re = /^(Коллектор АСН-N1 Ø89×3,5|Обводная линия узла учёта Ø89×3,5|Коллектор Ø108×4: бензин, ДТ\(З\))/;
    for (const s of segs) {
      if (!s.on || s.under || s.gen !== 'TK' || s.net !== 'lzb' || !re.test(s.name || '')) continue;
      const od = s.od || 2 * s.r; if (s.r > od / 2 + 0.03) continue;
      s.ins = F28.INS_T; s.r = od / 2 + F28.INS_T; s.mt = F28.insMat || s.mt; log.ins.n++;
      const k = Math.round(od * 1000); log.ins.L[k] = (log.ins.L[k] || 0) + (s.len || Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]));
    }
  }

  /* ---------- условные опоры (шаг 3 м): внутри рамок листов — только у труб без опор по листу ---------- */
  function skipCond(p, x, z, d) {
    if (inFrame(x, z) && covered.has(p)) { log.skipCond++; return true; }
    return false;
  }
  function addCond(p, d) { log.keepCond++; (condAt.get(p) || (condAt.set(p, []), condAt.get(p))).push(d); }

  /* ---------- наружные опоры по листам ТК-005 / ТК-006 ---------- */
  const NETS_OK = new Set(['dtl', 'dtz', 'b', 'd', 'gu', 'lzb']);   // технологические трубопроводы листов ТК (теплосеть, В2, В10 — другие разделы)
  const okP = (p, RENDER) => !p.under && NETS_OK.has(p.net) && (p.gen === 'RVSD' || (p.rendered && RENDER.has(p.gen))) && p.gen !== 'PH' && p.gen !== 'PHX';
  function crossings(pipes, RENDER, S) {
    const [id, sh, ax, az, bx, bz] = S; let ux = bx - ax, uz = bz - az; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
    const E = L < 0.8 ? 0.4 : 0.2, A = [ax - ux * E, az - uz * E], B = [bx + ux * E, bz + uz * E];
    const hits = [];
    for (const p of pipes) {
      if (!okP(p, RENDER)) continue;
      const P = p.pts; let arc = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], l3 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const ex = b[0] - a[0], ez = b[2] - a[2], l2 = Math.hypot(ex, ez);
        if (l2 > 0.05) {
          const dx = B[0] - A[0], dz = B[1] - A[1], den = ex * dz - ez * dx;
          if (Math.abs(den) / (l2 * Math.hypot(dx, dz)) > 0.45) {   // угол > 27°
            const t = ((A[0] - a[0]) * dz - (A[1] - a[2]) * dx) / den, s = ((A[0] - a[0]) * ez - (A[1] - a[2]) * ex) / den;
            if (t >= -0.001 && t <= 1.001 && s >= 0 && s <= 1) {
              const tt = Math.max(0, Math.min(1, t));
              hits.push({ p, x: a[0] + ex * tt, z: a[2] + ez * tt, y: a[1] + (b[1] - a[1]) * tt, s: s * Math.hypot(dx, dz) - E, dx: ex / l2, dz: ez / l2, arc: arc + l3 * tt });
            }
          }
        }
        arc += l3;
      }
    }
    if (!hits.length && L < 0.8) {   // одиночный знак рядом с трубой (не пересекает её в плане)
      const mx = (ax + bx) / 2, mz = (az + bz) / 2; let best = null;
      for (const p of pipes) {
        if (!okP(p, RENDER)) continue;
        const P = p.pts; let arc = 0;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1], l3 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ex = b[0] - a[0], ez = b[2] - a[2], l2 = ex * ex + ez * ez;
          if (l2 > 0.0025) {
            const t = Math.max(0, Math.min(1, ((mx - a[0]) * ex + (mz - a[2]) * ez) / l2)), px = a[0] + ex * t, pz = a[2] + ez * t, d = Math.hypot(mx - px, mz - pz);
            if (d < 0.45 && (!best || d < best.d)) best = { d, h: { p, x: px, z: pz, y: a[1] + (b[1] - a[1]) * t, s: L / 2, dx: ex / Math.sqrt(l2), dz: ez / Math.sqrt(l2), arc: arc + l3 * t } };
          }
          arc += l3;
        }
      }
      if (best) hits.push(best.h);
    }
    const byP = new Map();   // одна точка на трубу — ближайшая к середине знака
    for (const h of hits) { const o = byP.get(h.p); if (!o || Math.abs(h.s - L / 2) < Math.abs(o.s - L / 2)) byP.set(h.p, h); }
    return { list: [...byP.values()].sort((a, b) => a.s - b.s), ux, uz, L };
  }
  function build(ctx) {
    const { pipes, RENDER, hAt, parent } = ctx;
    const acc = new Acc(), objs = [];
    const all = pipes.filter(p => !p.under && ((p.rendered && RENDER.has(p.gen)) || p.gen === 'RVSD'));
    for (const S of OUT) {
      const [id, sh, ax, az, bx, bz, bund] = S;
      const { list, ux, uz } = crossings(pipes, RENDER, S);
      if (!list.length) { log.miss.push(id); continue; }
      for (const h of list) { const c = covered.get(h.p) || []; c.push(h.arc); covered.set(h.p, c); }
      const rs = h => (h.p.od || 2 * h.p.r) / 2, ro = h => h.p.r;
      const yT = Math.min(...list.map(h => h.y - ro(h))) - 0.03;   // верх траверсы / опорной плиты
      const s0 = list[0].s, s1 = list[list.length - 1].s, cx = ax + ux * (s0 + s1) / 2, cz = az + uz * (s0 + s1) / 2;
      const span = s1 - s0 + Math.max(ro(list[0]), ro(list[list.length - 1])) * 2 + 0.16;
      const fixed = isFixed(id), multi = list.length > 1;
      const posts = !multi || span <= 1.2 ? [[cx, cz]] : [[ax + ux * (s0 - 0.08 - ro(list[0]) + 0.06), az + uz * (s0 - 0.08 - ro(list[0]) + 0.06)], [ax + ux * (s1 + 0.08 + ro(list[list.length - 1]) - 0.06), az + uz * (s1 + 0.08 + ro(list[list.length - 1]) - 0.06)]];
      const prods = list.map(h => `${h.p.id} ${NAME[h.p.net] || h.p.net} Ø${Math.round((h.p.od || 2 * h.p.r) * 1000)}${h.p.r > rs(h) + 0.03 ? ' (изол.)' : ''} — низ ${fmt(h.y - rs(h) + H0, 2)}`);
      const dy = Math.max(...list.map(h => h.y - ro(h))) - Math.min(...list.map(h => h.y - ro(h)));
      if (dy > 0.3) log.hgt.push([id, dy]);
      const o = {
        id, net: 1, f31: 1, name: `Опора ${id} — ${fixed ? 'неподвижная' : 'подвижная'}${multi ? `, траверса на ${list.length} тр.` : ''}`,
        note: `Номер и место — ${SH[sh]} (знак опоры на плане${bund ? ' пучка — на размерной линии' : ''}; привязка листа к сцене по осям трубопроводов, ±5…8 см). ` +
          `Несёт: ${prods.join('; ')}. Верх ${multi ? 'траверсы' : 'опорной плиты'} ${fmt(yT + H0, 2)}${multi ? `, длина траверсы ≈ ${fmt(span, 2)} м, стоек ${posts.length}` : ''}. ` +
          (fixed ? 'Неподвижная (ОН): башмаки приварены к траверсе, упоры с обеих сторон. ' : 'Подвижная (ОП): скользящие башмаки, хомуты. ') +
          `Отметки труб — условные отметки наружных сетей модели (ТК-005/006 отметок не дают)${dy > 0.3 ? '; трубы на разных отметках — подставки под верхними' : ''}. ` +
          'Сечения стоек и траверс, хомуты, фундаменты — условно (чертежей КМ/КЖ нет).'
      };
      objs.push(o);
      // фундаменты и стойки
      for (const [px, pz] of posts) {
        const gy = hAt(px, pz), yB = multi ? yT - 0.1 : yT - 0.012, w = multi ? 0.12 : 0.1;
        acc.add('cn', boxY(0.4, 0.4, gy - 0.3, gy + 0.15, px, pz), o);
        acc.add('st', boxY(0.26, 0.26, gy + 0.15, gy + 0.17, px, pz), o);
        if (yB - gy - 0.17 > 0.04) acc.add('st', boxY(w, w, gy + 0.17, yB, px, pz), o);
        for (const h of all) {   // стойка не должна проходить сквозь другую трубу
          if (list.some(q => q.p === h)) continue;
          const P = h.pts;
          for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], ex = b[0] - a[0], ez = b[2] - a[2], l2 = ex * ex + ez * ez; if (l2 < 1e-6) continue;
            const t = Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[2]) * ez) / l2)), d = Math.hypot(px - a[0] - ex * t, pz - a[2] - ez * t), y = a[1] + (b[1] - a[1]) * t;
            if (d < h.r + w / 2 + 0.02 && y - h.r < yB && y + h.r > gy + 0.17) { log.clash.push([id, h.id, 'стойка']); break; }
          }
        }
      }
      if (multi) {   // траверса — швеллер 100 (условно), консоли за стойками
        const L = span, mx = ax + ux * (s0 + s1) / 2, mz = az + uz * (s0 + s1) / 2;
        acc.add('st', beam(L, 0.1, 0.08, ux, uz, mx, yT - 0.05, mz), o);
        for (const h of all) {   // траверса не должна проходить сквозь не опирающуюся на неё трубу
          if (list.some(q => q.p === h)) continue;
          const P = h.pts, A0 = [mx - ux * L / 2, mz - uz * L / 2], B0 = [mx + ux * L / 2, mz + uz * L / 2];
          for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], ex = b[0] - a[0], ez = b[2] - a[2], dx = B0[0] - A0[0], dz = B0[1] - A0[1], den = ex * dz - ez * dx;
            if (Math.abs(den) < 1e-6) continue;
            const t = ((A0[0] - a[0]) * dz - (A0[1] - a[2]) * dx) / den, s = ((A0[0] - a[0]) * ez - (A0[1] - a[2]) * ex) / den;
            if (t < 0 || t > 1 || s < 0 || s > 1) continue;
            const y = a[1] + (b[1] - a[1]) * t;
            if (y - h.r < yT && y + h.r > yT - 0.1) { log.clash.push([id, h.id, 'траверса']); break; }
          }
        }
      }
      // башмаки, подставки, хомуты, упоры ОН
      for (const h of list) {
        const r0 = rs(h), rO = ro(h), yb = h.y - r0, top = h.y - rO;
        if (top - yT > 0.06) acc.add('st', boxY(0.08, 0.08, yT, top - 0.02, h.x, h.z), o);   // подставка под более высокой трубой
        const yS = Math.max(yT, top - 0.02);
        acc.add('st', beam(0.3, Math.max(yb - yS, 0.03), Math.min(0.6 * r0 * 2 + 0.03, 0.16), h.dx, h.dz, h.x, (yS + Math.max(yb, yS + 0.03)) / 2, h.z), o);   // башмак
        if (!multi) acc.add('st', boxAt(0.26, 0.012, 0.26, h.x, yT - 0.006, h.z), o);   // опорная плита
        acc.add('st', clamp(rO + 0.006, 0.006, h.dx, h.dz, h.x, h.y, h.z), o);
        if (fixed) for (const k of [-1, 1]) acc.add('st', beam(0.02, 0.06, Math.min(0.6 * r0 * 2 + 0.06, 0.2), h.dx, h.dz, h.x + h.dx * k * 0.17, yT + 0.03, h.z + h.dz * k * 0.17), o);
      }
      log.built++; log.items.push([id, list.map(h => h.p.id), +(yT + H0).toFixed(2), posts.length]);
    }
    const mats = {
      st: new THREE.MeshStandardMaterial({ color: 0x6f767d, roughness: 0.55, metalness: 0.5, name: 'Опоры — сталь окрашенная (условно)' }),
      cn: new THREE.MeshStandardMaterial({ color: 0xa8a49b, roughness: 0.9, metalness: 0, name: 'Фундаменты опор — бетон (условно)' })
    };
    const g = new THREE.Group(); g.name = 'Опоры трубопроводов по 152-ТК-005/006 (v0.31)'; parent.add(g);
    const ms = acc.build(g, mats, { pgeo: 1, f31: 1 });
    for (const m of ms) { ctx.pickables.push(m); ctx.newMeshes && ctx.newMeshes.push(m); }
    log.pipes = covered.size;
    // трубы в рамках листов без опор по листу (надземные трассы ГП-005)
    for (const p of pipes) if (p.gen === 'NETS' && NETS_OK.has(p.net) && !p.under && p.rendered && !covered.has(p) && p.pts.some(q => inFrame(q[0], q[2])) && p.len > 1.5) log.noSupInFrame.push(p.id);
    return g;
  }
  // пролёты между опорами (по листу и условными) — после построения условных опор
  function spans(pipes) {
    for (const [p, arr] of covered) {
      const d = arr.concat(condAt.get(p) || []).sort((a, b) => a - b);
      for (let i = 1; i < d.length; i++) if (d[i] - d[i - 1] > 7.0) log.span.push([p.id, d[i] - d[i - 1]]);
    }
  }

  /* ---------- цех 200: марки опор по 200-ТХ-002-0 ---------- */
  function hallMark(x, z) {
    let best = null, bd = 0.4;
    for (const h of HALL) { const d = Math.hypot(h[1] - x, h[2] - z); if (d < bd) { bd = d; best = h; } }
    return best ? best[0] : null;
  }
  function hallSup(D, yAt, Y0, parent) {
    const acc = new Acc();
    const odAt = (x, z, dr, r0) => {   // Ø — по трубе модели в месте опоры (после уточнений v0.29–v0.30)
      const q = PH.pipes.find(p => dr === 'x' ? Math.abs(p[1] - z) < 0.03 && Math.abs(p[3] - z) < 0.03 && Math.min(p[0], p[2]) - 0.02 <= x && x <= Math.max(p[0], p[2]) + 0.02
        : Math.abs(p[0] - x) < 0.03 && Math.abs(p[2] - x) < 0.03 && Math.min(p[1], p[3]) - 0.02 <= z && z <= Math.max(p[1], p[3]) + 0.02);
      return q ? q[4] / 2 : r0;
    };
    for (const [x, z, dr, r0] of D.sup) {
      const r = odAt(x, z, dr, r0);
      const mk = hallMark(x, z) || '—', m = mk.replace('*', ''), fixed = /^ОН/.test(m), drain = m === 'Д', ax = dr === 'x';
      const o = {
        id: drain ? 'ОП (Д)' : m === '—' ? 'ОП' : m, net: 1, f31: 1,
        name: drain ? 'Опора дренажного трубопровода (поз. 69)' : `Опора ${m === '—' ? 'трубопровода' : m} — ${fixed ? 'неподвижная' : 'подвижная'}`,
        note: `Место и марка — 200-ТХ-002-0 (план цеха 200, знаки опор; совпадают со знаками АК-041)${mk.endsWith('*') ? '; марка на листе не подписана — принята по соседним опорам ряда' : ''}${m === '—' ? '; марка на листе не подписана' : ''}. ` +
          `Труба Ø${Math.round(r * 2000)}, отметка — по 200-ТХ-003-0 (v0.29). ` + (fixed ? 'Неподвижная: башмак с упорами. ' : '') +
          'Тип и конструкция — по 200-ТХ.С (лист с позициями опор не предоставлен): сечение стойки, ложемента и хомута — условно.'
      };
      const y = yAt(x, z), yt = y - r - 0.005, dx = ax ? 1 : 0, dz = ax ? 0 : 1;
      acc.add('st', boxY(0.06, 0.06, Y0, yt - 0.02, x, z), o);
      acc.add('st', boxY(0.16, 0.16, Y0, Y0 + 0.012, x, z), o);
      acc.add('st', ax ? boxAt(0.17, 0.02, r * 1.8 + 0.04, x, yt - 0.01, z) : boxAt(r * 1.8 + 0.04, 0.02, 0.17, x, yt - 0.01, z), o);
      acc.add('st', clamp(r + 0.008, 0.006, dx, dz, x, y, z), o);
      if (fixed) for (const k of [-1, 1]) acc.add('st', beam(0.012, 0.05, r * 1.4 + 0.03, dx, dz, x + dx * k * 0.1, yt + 0.02, z + dz * k * 0.1), o);
      log.hall++; if (fixed) log.hallFix++;
    }
    const mats = { st: new THREE.MeshStandardMaterial({ color: 0x5f666c, roughness: 0.55, metalness: 0.5, name: 'Опоры цеха 200 (условно)' }) };
    const ms = acc.build(parent, mats, { f31: 1 });
    for (const m of ms) pickables.push(m);
  }
  const VIEWS = {
    sup: () => flyTo([-41.5, 7.5, 32.5], [-38.5, 0.5, 21.0], 0.9),
    park: () => flyTo([-27.0, 8.5, -16.0], [-33.0, 0.5, -6.0], 0.9),
    hall: () => { if (typeof ROOF200 !== 'undefined' && ROOF200) ROOF200.visible = false; flyTo([-66.0, 4.6, 31.8], [-63.0, -0.7, 26.2], 0.9); }
  };
  return { OUT, HALL, FR, inFrame, log, applyIns, skipCond, addCond, build, spans, hallSup, hallMark, VIEWS, covered };
})();

/* v0.43: теги отметок и Ø труб цеха 200 (F29, v0.29–v0.30) и трасса ДТ(Л) по 152-ТК-007-0 (F25) внесены в data/ */
F25.initTk(NETS);   // v0.25: отметки узлов 13, 14 и ввода в 501 по рельефу (152-ТК-007-0)
