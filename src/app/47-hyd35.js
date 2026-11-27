/* ========== v0.35: ядро гидравлики HYD35 (логика без Three.js) ========== */
/* =====================================================================
 * HYD35 — ядро этапа v0.35 цифрового двойника ТС Оскемен.
 *
 *   1. Гидравлика маршрута: рабочая точка насоса на сети
 *      (Дарси–Вейсбах + местные сопротивления + статический напор),
 *      ветвление (дерево), СППК на байпасе, NPSHa, давления PI/PIS.
 *   2. Автомат состояний насосов: стоит → пуск → работа → останов,
 *      неисправность, недоступен; частотный привод Н-1/Н-2.
 *   3. Автомат хода арматуры: время хода, «в движении», промежуточное
 *      положение, стоп в ходе, заклинивание.
 *
 * Модуль не зависит от Three.js и DOM. Встраивается в HTML-файл
 * двойника и связывается с procLogic / procSim / PFLOW адаптером.
 *
 * Принятые условные значения (PROVISIONAL) собраны в HYD35.DATA
 * с указанием источника или причины допущения.
 *
 * Система отсчёта: высоты z — в метрах от ±0,000 сцены (H0 = 297,30 БСВ);
 * напоры H — пьезометрические, м столба продукта, избыточные (атмосфера = 0).
 * Расход — м³/ч во внешнем интерфейсе, м³/с внутри.
 * ===================================================================== */
(function (root) {
  'use strict';

  var G = 9.80665;
  var H0_ABS = 297.30;                // отметка ±0,000 сцены, м БСВ

  /* ------------------------------------------------------------------
   * 1. Справочные данные и допущения
   * ------------------------------------------------------------------ */
  var DATA = {
    version: '0.35-core',

    fluids: {
      DTL: {
        name: 'ДТ летнее', rho20: 840, beta: 0.00083, nu20: 4.5e-6, kNu: 0.030,
        pv: { ref: 0.5e3, T: 20, k: 0.03 },
        status: 'PROVISIONAL',
        src: 'ГОСТ 305-2013: ν20 3,0–6,0 мм²/с, ρ15 ≤ 863,4 кг/м³; принято среднее значение. Нужен паспорт качества продукта'
      },
      DTZ: {
        name: 'ДТ зимнее', rho20: 830, beta: 0.00083, nu20: 3.4e-6, kNu: 0.030,
        pv: { ref: 0.7e3, T: 20, k: 0.03 },
        status: 'PROVISIONAL',
        src: 'ГОСТ 305-2013: ν20 1,8–5,0 мм²/с, ρ15 ≤ 843,4 кг/м³; принято среднее значение. Нужен паспорт качества продукта'
      },
      B: {
        name: 'Бензин', rho20: 745, beta: 0.0012, nu20: 0.6e-6, kNu: 0.012,
        pv: { ref: 65e3, T: 37.8, k: 0.031 },
        status: 'PROVISIONAL',
        src: 'ГОСТ 32513-2013: ρ15 725–780 кг/м³; давление паров зависит от класса испаряемости — принято 65 кПа при 37,8 °C. Нужен паспорт качества продукта'
      }
    },

    roughness: { value: 0.2e-3, status: 'PROVISIONAL', src: 'Сталь, бывшая в эксплуатации — справочное значение' },

    // Коэффициенты местных сопротивлений — справочные (Идельчик И.Е.), PROVISIONAL
    zeta: {
      elbow90: 0.25,   // отвод 90°, R = 1,5 Dн
      elbow45: 0.15,
      teeRun: 0.4,     // тройник, проход
      teeBranch: 1.2,  // тройник, ответвление
      gateOpen: 0.15,  // задвижка клиновая, открыта полностью
      ballOpen: 0.05,  // кран шаровой полнопроходной, открыт
      check: 2.0,      // клапан обратный поворотный
      filter: 3.0,     // фильтр сетчатый, чистый
      meter: 2.0,      // счётчик / расходомер (тип FQIT не указан)
      usn: 4.0,        // УСН-150: шарнирный трубопровод с поворотными соединениями
      inlet: 0.5,      // вход из ёмкости в трубу
      outlet: 1.0      // выход в ёмкость / свободный излив
    },
    zetaSrc: 'Справочные значения (Идельчик И.Е., «Справочник по гидравлическим сопротивлениям»); паспортов изделий нет — PROVISIONAL',

    // Задвижка: относительное открытие h/D → ζ (справочно)
    gateTable: [[0.125, 97.8], [0.25, 17.0], [0.375, 5.52], [0.5, 2.06], [0.625, 0.81], [0.75, 0.26], [0.875, 0.07], [1.0, 0.0]],
    // Кран (пробочный/шаровой): угол прикрытия, ° → ζ (справочно)
    ballTable: [[0, 0.0], [10, 0.29], [20, 1.56], [30, 5.47], [40, 17.3], [50, 52.6], [60, 206], [70, 486]],

    // Насосы — паспортная точка по АК-004; СППК — по ОЛ / v0.23; PIS — АК-004
    pumps: {
      'Н-1':   { model: 'КМ 80-50-215Е',     type: 'cf', Qn: 42,  Hn: 51, N: 11,   drive: 'vfd', Pset: 0.561, PISnom: 0.5,  PISmax: 0.6 },
      'Н-2':   { model: 'КМ 80-50-215Е',     type: 'cf', Qn: 42,  Hn: 51, N: 11,   drive: 'vfd', Pset: 0.561, PISnom: 0.5,  PISmax: 0.6 },
      'Н-3':   { model: 'НМШ 5-25-2,5/6-5',  type: 'pd', Qn: 2.5, Hn: 60, N: 1.5,  drive: 'dol', Pset: 0.66,  PISnom: 0.22, PISmax: 0.3 },
      'Н-4':   { model: 'НМШ 5-25-2,5/6-5',  type: 'pd', Qn: 2.5, Hn: 60, N: 1.5,  drive: 'dol', Pset: 0.66,  PISnom: 0.22, PISmax: 0.3 },
      'Н-5':   { model: 'УОДН 200-150-125',  type: 'cf', Qn: 144, Hn: 40, N: 30,   drive: 'dol', Pset: 0.44,  PISnom: 0.5,  PISmax: 0.6 },
      'Н-6':   { model: 'УОДН 200-150-125',  type: 'cf', Qn: 144, Hn: 40, N: 30,   drive: 'dol', Pset: 0.44,  PISnom: 0.5,  PISmax: 0.6 },
      'Н-7':   { model: 'КМС 100-80-180-Е',  type: 'cf', Qn: 65,  Hn: 35, N: 15,   drive: 'dol', Pset: 0.385, PISnom: 0.25, PISmax: 0.3 },
      'Н-8':   { model: 'КМС 100-80-180-Е',  type: 'cf', Qn: 65,  Hn: 35, N: 15,   drive: 'dol', Pset: 0.385, PISnom: 0.25, PISmax: 0.3 },
      'ТРК-1': { model: 'Нара 4000 мод. С222', type: 'pd', Qn: 3.0, Hn: null, N: 0.55, drive: 'dol', Pset: null, PISnom: null, PISmax: null }
    },
    pumpsSrc: 'Q, H, N — АК-004; давление настройки СППК — опросные листы 200-ТХ.ОЛ (v0.23); PIS Рном/Рmax — АК-004',

    // Форма характеристики H(Q) центробежного насоса: кривых изготовителя нет
    curve: {
      H0k: 1.20,    // напор при закрытой задвижке = 1,2·Hн
      QendK: 1.30,  // конец рабочей части характеристики = 1,3·Qн
      QzeroK: 1.50, // за концом рабочей части — крутой спад (зона кавитации / перегрузки)
      status: 'PROVISIONAL',
      src: 'Кривых H(Q) изготовителя нет. Парабола через паспортную точку АК-004; H0 = 1,2·Hн; рабочая часть до 1,3·Qн'
    },

    timing: {
      pump: {
        dol: { acc: 3, dec: 8 },    // прямой пуск асинхронного двигателя: разгон / выбег, с
        vfd: { acc: 10, dec: 10 },  // частотный привод SINAMICS G120: рампы, с
        pd:  { acc: 1, dec: 2 }     // объёмный насос
      },
      valve: {
        gate_e: 60,   // задвижка с электроприводом (N6–N8, задвижки парка), полный ход, с
        ball_e: 20,   // кран шаровой с электроприводом (N1–N5, Biffi F02), с
        ko: 10,       // клапан отсечной КО-1…КО-3, с
        sol: 2,       // клапан электромагнитный «СЕНС» УНЖ-N1, с
        gate_m: 15,   // ручная задвижка — время, за которое оператор выполняет полный ход, с
        ball_m: 5     // ручной кран, с
      },
      vfdMin: 0.30,   // нижний предел частоты ЧП, доля номинала
      status: 'PROVISIONAL',
      src: 'Паспортов приводов и алгоритмов АСУ ТП нет — типовые значения'
    },

    vRef: {
      suction: 1.5, discharge: 2.5,
      src: '«Технологические трубопроводы нефтебаз», табл. 7.1 (v0.18) — справочный ориентир',
      vnmp: 5.0,
      vnmpSrc: 'ВНТП 5-95, п. 5.1.6: до 5 м/с при ρv ≤ 10⁹ Ом·м или tвсп ≥ 61 °C; для ДТ и бензина — по расчёту'
    }
  };

  /* ------------------------------------------------------------------
   * 2. Физика продукта и трубы
   * ------------------------------------------------------------------ */
  function fluidAt(code, T) {
    var f = DATA.fluids[code];
    if (!f) throw new Error('HYD35: неизвестный продукт ' + code);
    var t = (typeof T === 'number') ? T : 20;
    var rho = f.rho20 * (1 - f.beta * (t - 20));
    var nu = f.nu20 * Math.exp(-f.kNu * (t - 20));
    var pv = f.pv.ref * Math.exp(f.pv.k * (t - f.pv.T));
    return { code: code, name: f.name, T: t, rho: rho, nu: nu, pv: pv };
  }

  // Атмосферное давление по стандартной атмосфере на отметке площадки
  function patm() {
    return 101325 * Math.pow(1 - 2.25577e-5 * H0_ABS, 5.25588);
  }

  // Коэффициент гидравлического трения: ламинарный, переходный, Свами–Джейн
  function frictionFactor(Re, d, eps) {
    if (!(Re > 1e-9)) return 0;
    if (Re < 2300) return 64 / Re;
    var turb = function (r) {
      var a = Math.log10(eps / (3.7 * d) + 5.74 / Math.pow(r, 0.9));
      return 0.25 / (a * a);
    };
    if (Re >= 4000) return turb(Re);
    var lamEnd = 64 / 2300, turbStart = turb(4000);
    return lamEnd + (turbStart - lamEnd) * (Re - 2300) / 1700;
  }

  function interpLog(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        var x0 = table[i - 1][0], x1 = table[i][0];
        var y0 = Math.max(table[i - 1][1], 1e-4), y1 = Math.max(table[i][1], 1e-4);
        var t = (x - x0) / (x1 - x0);
        return Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * t);
      }
    }
    return table[table.length - 1][1];
  }

  /* ζ арматуры по положению pos (0 — закрыта, 1 — открыта).
   * Возвращает Infinity для закрытой арматуры. */
  function valveZeta(type, pos) {
    if (!(pos > 1e-3)) return Infinity;
    var p = Math.min(1, pos);
    if (type === 'ball' || type === 'ball_e' || type === 'ball_m') {
      var ang = 90 * (1 - p);
      if (ang >= 85) return Infinity;
      var z;
      if (ang <= 70) z = interpLog(DATA.ballTable, ang);
      else z = 486 * Math.exp((ang - 70) * 0.35);   // экстраполяция за пределы таблицы
      return DATA.zeta.ballOpen + (ang < 0.5 ? 0 : z);
    }
    // задвижка (и КО — тот же принцип дросселирования, условно)
    var zg;
    if (p >= 0.999) zg = 0;
    else if (p < 0.125) zg = 97.8 * Math.pow(0.125 / p, 2);
    else zg = interpLog(DATA.gateTable, p);
    return DATA.zeta.gateOpen + zg;
  }

  /* Потери напора на участке при расходе Q (м³/с, со знаком).
   * seg: { L, Din (м), zeta (сумма местных), valves:[{type,pos}], check:true } */
  function segLoss(seg, Qs, fl, eps) {
    if (Qs === 0) return 0;
    var d = seg.Din;
    var A = Math.PI * d * d / 4;
    var v = Qs / A;
    var av = Math.abs(v);
    var Re = av * d / fl.nu;
    var lam = frictionFactor(Re, d, eps);
    var z = seg.zeta || 0;
    if (seg.valves) {
      for (var i = 0; i < seg.valves.length; i++) {
        var vz = valveZeta(seg.valves[i].type, seg.valves[i].pos);
        if (!isFinite(vz)) return Qs > 0 ? Infinity : -Infinity;
        z += vz;
      }
    }
    if (seg.check && (seg.check === -1 ? Qs > 0 : Qs < 0)) return Qs > 0 ? Infinity : -Infinity;  // обратный клапан: обратный ток невозможен (check = -1 — клапан ориентирован к насосу)
    var h = (lam * seg.L / d + z) * v * av / (2 * G);
    return h;
  }

  function segDetail(seg, Qs, fl, eps) {
    var d = seg.Din, A = Math.PI * d * d / 4, v = Qs / A, Re = Math.abs(v) * d / fl.nu;
    return { v: v, Re: Re, lambda: frictionFactor(Re, d, eps), h: segLoss(seg, Qs, fl, eps) };
  }

  function branchLoss(br, Qs, fl, eps) {
    var h = 0;
    for (var i = 0; i < br.segs.length; i++) {
      var hs = segLoss(br.segs[i], Qs, fl, eps);
      if (!isFinite(hs)) return hs;
      h += hs;
    }
    return h;
  }

  function branchClosed(br) {
    for (var i = 0; i < br.segs.length; i++) {
      var s = br.segs[i];
      if (s.valves) for (var j = 0; j < s.valves.length; j++) if (!(s.valves[j].pos > 1e-3)) return true;
    }
    return false;
  }

  // Какие направления расхода запирает обратный клапан ветви: neg — к насосу, pos — от насоса
  function branchBlocks(br) {
    var o = { neg: false, pos: false };
    for (var i = 0; i < br.segs.length; i++) {
      var c = br.segs[i].check;
      if (c === -1) o.pos = true; else if (c) o.neg = true;
    }
    return o;
  }

  /* ------------------------------------------------------------------
   * 3. Численные методы
   * ------------------------------------------------------------------ */
  // Корень монотонной функции на [lo, hi] (метод Иллинойса с подстраховкой бисекцией)
  function rootMonotone(f, lo, hi, tol, maxIt) {
    tol = tol || 1e-7; maxIt = maxIt || 100;
    var flo = f(lo), fhi = f(hi);
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if ((flo > 0) === (fhi > 0)) return NaN;
    var side = 0, x = lo;
    for (var it = 0; it < maxIt; it++) {
      if (!isFinite(flo) || !isFinite(fhi)) x = 0.5 * (lo + hi);
      else x = (lo * fhi - hi * flo) / (fhi - flo);
      if (!(x > lo && x < hi)) x = 0.5 * (lo + hi);
      var fx = f(x);
      if (fx === 0 || (hi - lo) < tol) return x;
      if ((fx > 0) === (flo > 0)) {
        lo = x; flo = fx;
        if (side === -1 && isFinite(fhi)) fhi *= 0.5;
        side = -1;
      } else {
        hi = x; fhi = fx;
        if (side === 1 && isFinite(flo)) flo *= 0.5;
        side = 1;
      }
      if (it % 4 === 3) {         // гарантированное сужение интервала
        var m = 0.5 * (lo + hi), fm = f(m);
        if (fm === 0) return m;
        if ((fm > 0) === (flo > 0)) { lo = m; flo = fm; } else { hi = m; fhi = fm; }
      }
    }
    return 0.5 * (lo + hi);
  }

  var QMAX = 0.25;          // м³/с (900 м³/ч) — граница поиска расхода
  var HSPAN = 2000;         // м — граница поиска напора

  /* ------------------------------------------------------------------
   * 4. Сеть: дерево ветвей от насоса
   *
   *   node = { kind: 'junction', branches: [branch, ...] }
   *        | { kind: 'tank',  id, zSurf }      — уровень в ёмкости (вход под уровень)
   *        | { kind: 'free',  id, zOut  }      — свободный излив (верхний налив)
   *   branch = { id, segs: [seg, ...], to: node }
   *
   * Расход в ветви положителен в направлении «от насоса».
   * F(node, H) — суммарный расход, уходящий из узла в поддерево
   * при пьезометрическом напоре H в узле; F возрастает по H.
   * ------------------------------------------------------------------ */
  function makeNet(fl, eps) {
    /* Напор, необходимый в начале ветви для расхода Q (м³/с, «от насоса»): потери в ветви + напор в её конце.
     * Для цепочки без разветвлений — явная сумма (без итераций); итерации нужны только в узлах с несколькими ветвями. */
    function Hend(br, Q) {
      var to = br.to;
      if (to.kind === 'tank') return to.zSurf;
      if (to.kind === 'free') { if (Q > 1e-12) return to.zOut; if (Q < -1e-12) return -Infinity; return to.zOut; }
      return Hreq(to, Q);
    }
    function Hbr(br, Q) {
      var h = branchLoss(br, Q, fl, eps);
      if (!isFinite(h)) return h;
      var e = Hend(br, Q);
      return h + e;
    }
    // расход в ветвь при напоре H в её начале
    function qBranch(br, H) {
      var g = function (q) { var v = Hbr(br, q); return H - v; };   // убывает по q
      var gHi = g(QMAX), gLo = g(-QMAX);
      if (gHi >= 0) return QMAX;
      if (gLo <= 0) return -QMAX;
      var r = rootMonotone(g, -QMAX, QMAX, 1e-7);
      return isNaN(r) ? 0 : r;
    }
    function F(node, H) {
      if (!node || node.kind !== 'junction') return 0;
      var s = 0;
      for (var i = 0; i < node.branches.length; i++) s += qBranch(node.branches[i], H);
      return s;
    }
    // напор в узле, при котором из него уходит расход Q (м³/с); ±Infinity — расход недостижим
    function Hreq(node, Q) {
      var n = node.branches.length;
      if (n === 0) return Q > 1e-12 ? Infinity : (Q < -1e-12 ? -Infinity : 0);
      if (n === 1) return Hbr(node.branches[0], Q);
      var r = rootMonotone(function (H) { return F(node, H) - Q; }, -HSPAN, HSPAN, 1e-4);
      if (isNaN(r)) return Q > 0 ? Infinity : -Infinity;
      return r;
    }
    function Hfor(node, Q) {
      var h = Hreq(node, Q);
      return isFinite(h) ? h : NaN;   // NaN — расход недостижим (закрыто)
    }
    /* Статический напор (расход 0). Если F(H) = 0 на целом интервале
     * (обратный клапан, свободный излив), берётся граница интервала,
     * со стороны которой линия заполнена продуктом. */
    function Hstatic(node) {
      var tiny = 1e-9;
      var negAt = function (H) { return F(node, H) < -tiny; };
      var posAt = function (H) { return F(node, H) > tiny; };
      var hasNeg = negAt(-HSPAN), hasPos = posAt(HSPAN);
      if (!hasNeg && !hasPos) return NaN;
      var bis = function (pred, lo, hi) {      // pred(lo) = true, pred(hi) = false
        for (var i = 0; i < 80 && hi - lo > 1e-5; i++) { var m = 0.5 * (lo + hi); if (pred(m)) lo = m; else hi = m; }
        return 0.5 * (lo + hi);
      };
      var Hlo = hasNeg ? bis(negAt, -HSPAN, HSPAN) : null;
      var Hhi = hasPos ? bis(function (H) { return !posAt(H); }, -HSPAN, HSPAN) : null;
      if (Hlo == null) return Hhi;
      if (Hhi == null) return Hlo;
      return 0.5 * (Hlo + Hhi);
    }
    return { F: F, Hfor: Hfor, Hstatic: Hstatic, qBranch: qBranch, Hreq: Hreq };
  }

  /* ------------------------------------------------------------------
   * 5. Характеристика насоса
   * ------------------------------------------------------------------ */
  function pumpCurve(def, s) {
    var Qn = def.Qn / 3600;                    // м³/с
    var C = DATA.curve;
    if (def.type === 'pd') {
      return { type: 'pd', Q: Qn * s };
    }
    var H0 = C.H0k * def.Hn;
    var k = (C.H0k - 1) * def.Hn / (Qn * Qn);
    var Qe = C.QendK * Qn * s, Qz = C.QzeroK * Qn * s;
    var He = s * s * H0 - k * Qe * Qe;
    var H = function (Q) {
      if (Q <= 0) return s * s * H0;
      if (Q <= Qe) return s * s * H0 - k * Q * Q;
      return He * (Qz - Q) / (Qz - Qe);
    };
    return { type: 'cf', H: H, H0: s * s * H0, Qe: Qe, Qz: Qz, k: k };
  }

  /* ------------------------------------------------------------------
   * 6. Решение маршрута
   *
   * route = {
   *   fluid: 'DTL'|'DTZ'|'B', T: 20,
   *   pump: { id, s: 0..1, z: отметка оси, zPIS, zPI },
   *   suction:   node (корень у всаса; листья — источники),
   *   discharge: node (корень у нагнетания; листья — приёмники)
   * }
   * ------------------------------------------------------------------ */
  function solveRoute(route, opt) {
    opt = opt || {};
    var fl = fluidAt(route.fluid, route.T);
    var eps = (opt.eps != null) ? opt.eps : DATA.roughness.value;
    var def = DATA.pumps[route.pump.id] || route.pump.def;
    if (!def) throw new Error('HYD35: нет паспорта насоса ' + route.pump.id);
    var s = Math.max(0, Math.min(1, route.pump.s == null ? 1 : route.pump.s));
    var rg = fl.rho * G;
    var zP = route.pump.z || 0;
    var zPIS = (route.pump.zPIS != null) ? route.pump.zPIS : zP;
    var zPI = (route.pump.zPI != null) ? route.pump.zPI : zP;
    var net = makeNet(fl, eps);
    // Всас: «расход от насоса» в поддерево всаса отрицателен при работе
    var res = {
      fluid: fl, pumpId: route.pump.id, s: s, status: 'ok', warnings: [],
      Q: 0, Qpump: 0, Qbypass: 0, Hs: NaN, Hd: NaN, Hpump: 0,
      PIS: NaN, PI: NaN, NPSHa: NaN, branches: [], segs: []
    };
    var warn = function (code, level, text) { res.warnings.push({ code: code, level: level, text: text }); };

    var sucMax = net.F(route.suction, -HSPAN);       // наибольший возможный приток (отрицательный)
    var disMax = net.F(route.discharge, HSPAN);
    var sucOpen = sucMax < -1e-7;
    var disOpen = disMax > 1e-7;

    var Hs, Hd, Q = 0, Qp = 0, Qb = 0, Hp = 0;
    var curve = pumpCurve(def, s);
    var nP = Math.max(1, route.pump.n || 1);          // одинаковые насосы в параллель
    if (nP > 1) {
      var c1 = curve;
      curve = c1.type === 'pd' ? { type: 'pd', Q: c1.Q * nP } :
        { type: 'cf', H: function (Q) { return c1.H(Q / nP); }, H0: c1.H0, Qe: c1.Qe * nP, Qz: c1.Qz * nP, k: c1.k };
    }
    res.nPumps = nP; res.curve = curve;

    if (s < 0.01) {
      // Насос стоит. Корпус насоса сообщается со всасом, поэтому напор на выходе
      // насоса (до обратного клапана) равен статическому напору всаса.
      // Линия за обратным клапаном держит столб приёмника — res.HdLine.
      res.status = 'stopped';
      Hs = sucOpen ? net.Hstatic(route.suction) : NaN;
      res.HdLine = net.Hstatic(route.discharge);
      Hd = Hs;
    } else if (!sucOpen) {
      res.status = 'no_suction';
      warn('NO_SUCTION', 2, 'Всасывающая линия закрыта или не собрана — подачи нет, насос работает без продукта');
      Hs = NaN; Hd = NaN; res.HdLine = net.Hstatic(route.discharge);
    } else if (curve.type === 'pd') {
      Qp = curve.Q;
      Hs = net.Hfor(route.suction, -Qp);
      Hd = disOpen ? net.Hfor(route.discharge, Qp) : NaN;
      var pDis = disOpen ? rg * (Hd - zPIS) / 1e6 : Infinity;
      if (!disOpen || (def.Pset != null && pDis > def.Pset)) {
        if (def.Pset == null) {
          res.status = 'blocked';
          warn('PD_BLOCKED', 3, 'Объёмный насос на закрытую линию — СППК в данных нет');
          Q = 0; Hd = NaN;
        } else {
          Hd = def.Pset * 1e6 / rg + zPIS;
          Q = disOpen ? Math.max(0, net.F(route.discharge, Hd)) : 0;
          Hs = net.Hfor(route.suction, -Q);
          Qb = Qp - Q;
          res.status = 'relief';
          warn('RELIEF', 2, 'Открыт СППК (настройка ' + fp(def.Pset) + ' МПа): перепуск ' + fmtQ(Qb) + ' м³/ч на всас');
        }
      } else {
        Q = Qp;
      }
      Hp = Hd - Hs;
    } else {
      // центробежный насос: H_s(Q) + H_p(Q) = H_d(Q)
      if (!disOpen) {
        Q = 0;
        Hs = net.Hfor(route.suction, 0);
        Hp = curve.H(0);
        Hd = Hs + Hp;
        res.status = 'shutoff';
      } else {
        var r = function (Qx) {
          var hs = net.Hfor(route.suction, -Qx);
          var hd = net.Hfor(route.discharge, Qx);
          if (isNaN(hs)) return -1e9;
          if (isNaN(hd)) return -1e9;
          return hs + curve.H(Qx) - hd;
        };
        var r0 = r(0);
        if (r0 <= 0) {
          // насос не преодолевает статический напор
          Q = 0;
          Hs = net.Hfor(route.suction, 0);
          Hp = curve.H(0);
          Hd = Hs + Hp;
          res.status = 'shutoff';
          warn('NO_HEAD', 2, 'Напор насоса меньше статического напора сети — подачи нет');
        } else {
          Q = rootMonotone(r, 0, Math.min(QMAX, curve.Qz * 1.2), 1e-7);
          if (isNaN(Q)) Q = curve.Qz;
          Hs = net.Hfor(route.suction, -Q);
          Hd = net.Hfor(route.discharge, Q);
          Hp = curve.H(Q);
        }
      }
      Qp = Q;
      // СППК на байпасе
      var pd = rg * (Hd - zPIS) / 1e6;
      if (def.Pset != null && pd > def.Pset) {
        var Hd2 = def.Pset * 1e6 / rg + zPIS;
        var Qsys = disOpen ? Math.max(0, net.F(route.discharge, Hd2)) : 0;
        var Hs2 = net.Hfor(route.suction, -Qsys);
        var Hreq = Hd2 - Hs2;
        var Qp2 = (curve.H(0) <= Hreq) ? 0 : rootMonotone(function (Qx) { return curve.H(Qx) - Hreq; }, 0, curve.Qz, 1e-9);
        if (Qp2 > Qsys + 1e-7) {
          Q = Qsys; Qp = Qp2; Qb = Qp2 - Qsys; Hd = Hd2; Hs = Hs2; Hp = Hreq;
          res.status = 'relief';
          warn('RELIEF', 2, 'Открыт СППК (настройка ' + fp(def.Pset) + ' МПа): перепуск ' + fmtQ(Qb) + ' м³/ч на всас');
        }
      }
      if (res.status === 'shutoff' && !(Qb > 0)) {
        warn('SHUTOFF', 2, 'Насос работает на закрытую задвижку: подачи нет, продукт в корпусе нагревается');
      }
      if (Qp > curve.Qe + 1e-9) {
        warn('RIGHT_OF_CURVE', 2, 'Подача ' + fmtQ(Qp) + ' м³/ч правее рабочей части характеристики (> ' +
          fmtQ(curve.Qe) + ' м³/ч): требуется дросселирование задвижкой на нагнетании. Форма кривой условна');
      }
    }

    res.Q = Q * 3600; res.Qpump = Qp * 3600; res.Qbypass = Qb * 3600;
    res.Hs = Hs; res.Hd = Hd; res.Hpump = Hp;
    res.PIS = isFinite(Hd) ? rg * (Hd - zPIS) / 1e6 : NaN;
    res.PI = isFinite(Hs) ? rg * (Hs - zPI) / 1e6 : NaN;
    var pa = patm();
    res.patm = pa / 1e6;
    if (isFinite(Hs)) {
      res.NPSHa = (pa - fl.pv) / rg + (Hs - zP);
      if (s >= 0.01 && Q > 0 && res.NPSHa <= 0) {
        res.status = 'cavitation';
        warn('CAVITATION', 3, 'Давление на всасе ниже давления паров продукта (NPSHa = ' + fc(res.NPSHa, 1) +
          ' м): кавитация, срыв подачи');
      }
    }

    // Распределение по ветвям и участкам
    if (s >= 0.01 && (Q !== 0 || res.status === 'stopped')) {
      walk(route.discharge, Hd, 'dis');
      walk(route.suction, Hs, 'suc');
    }
    function walk(node, H, side) {
      if (!node || node.kind !== 'junction' || !isFinite(H)) return;
      for (var i = 0; i < node.branches.length; i++) {
        var br = node.branches[i];
        var q = net.qBranch(br, H);
        var Hcur = H;
        var flowAway = q;
        for (var j = 0; j < br.segs.length; j++) {
          var sg = br.segs[j];
          var d = segDetail(sg, flowAway, fl, eps);
          var Hin = Hcur, Hout = Hcur - d.h;
          var rec = {
            id: sg.id, branch: br.id, side: side,
            Q: Math.abs(flowAway) * 3600,
            dir: side === 'dis' ? (flowAway >= 0 ? 1 : -1) : (flowAway <= 0 ? 1 : -1),
            v: Math.abs(d.v), Re: d.Re, lambda: d.lambda, hf: Math.abs(d.h),
            Hin: Hin, Hout: Hout, Dn: sg.Dn, Din: sg.Din
          };
          if (sg.zA != null) rec.pA = rg * (Hin - sg.zA) / 1e6;
          if (sg.zB != null) rec.pB = rg * (Hout - sg.zB) / 1e6;
          res.segs.push(rec);
          Hcur = Hout;
        }
        res.branches.push({ id: br.id, side: side, Q: q * 3600, leaf: br.to.kind !== 'junction' ? br.to.id : null });
        if (br.to.kind === 'junction') walk(br.to, Hcur, side);
      }
    }

    // Проверки по результату
    if (s >= 0.01 && res.Q > 0) {
      var vmaxS = 0, vmaxD = 0, segS = null, segD = null, pminAbs = Infinity, segPmin = null;
      for (var k2 = 0; k2 < res.segs.length; k2++) {
        var sgr = res.segs[k2];
        if (sgr.side === 'suc' && sgr.v > vmaxS) { vmaxS = sgr.v; segS = sgr; }
        if (sgr.side === 'dis' && sgr.v > vmaxD) { vmaxD = sgr.v; segD = sgr; }
        if (sgr.side === 'suc') {
          var pp = Math.min(sgr.pA != null ? sgr.pA : Infinity, sgr.pB != null ? sgr.pB : Infinity);
          if (pp < pminAbs) { pminAbs = pp; segPmin = sgr; }
        }
        if (sgr.dir < 0 && sgr.Q > 0.01) {
          warn('REVERSE', 1, 'Обратный ток на участке ' + sgr.id + ' (' + fmtQ(sgr.Q / 3600) + ' м³/ч): перетекание между приёмниками');
        }
      }
      res.vmaxSuction = vmaxS; res.vmaxDischarge = vmaxD;
      if (segS && vmaxS > DATA.vRef.suction) warn('V_SUC', 1, 'Скорость на всасе ' + fc(vmaxS, 2) + ' м/с (участок ' + segS.id + ') выше ориентира 1,5 м/с');
      if (segD && vmaxD > DATA.vRef.discharge) warn('V_DIS', 1, 'Скорость на нагнетании ' + fc(vmaxD, 2) + ' м/с (участок ' + segD.id + ') выше ориентира 2,5 м/с');
      var vmax = Math.max(vmaxS, vmaxD);
      if (vmax > DATA.vRef.vnmp) warn('V_VNTP', 2, 'Скорость ' + fc(vmax, 2) + ' м/с > 5 м/с: по ВНТП 5-95 для ДТ и бензина допустимая скорость — по расчёту');
      if (isFinite(pminAbs)) {
        res.pminSuctionAbs = (pminAbs * 1e6 + pa) / 1e6;
        if (pminAbs * 1e6 + pa <= fl.pv) {
          warn('VAPOR', 3, 'На участке всаса ' + segPmin.id + ' абсолютное давление ниже давления паров: разрыв потока');
        }
      }
      if (def.PISmax != null && res.PIS > def.PISmax) {
        warn('PIS_MAX', 2, 'PIS ' + fc(res.PIS, 3) + ' МПа > Рmax ' + fp(def.PISmax) + ' МПа (АК-004). Действие АСУ ТП — требует уточнения');
      }
    }
    return res;
  }

  function fmtQ(q) { return (Math.round(q * 3600 * 10) / 10).toString().replace('.', ','); }
  function fc(x, d) { return (+x).toFixed(d).replace('.', ',').replace('-', '−'); }
  function fp(x) { return String(x).replace('.', ','); }

  /* ------------------------------------------------------------------
   * 7. Автомат состояний насосов
   * ------------------------------------------------------------------ */
  var PUMP_STATES = {
    stop: 'стоит', start: 'пуск', run: 'работа', stopping: 'останов',
    fault: 'неисправность', na: 'недоступен'
  };

  function PumpSM(ids) {
    this.p = {};
    var list = ids || Object.keys(DATA.pumps);
    for (var i = 0; i < list.length; i++) {
      var id = list[i], def = DATA.pumps[id] || {};
      var kind = def.type === 'pd' ? 'pd' : (def.drive === 'vfd' ? 'vfd' : 'dol');
      this.p[id] = { id: id, state: 'stop', s: 0, sp: 1, kind: kind, reason: '', faultPending: false };
    }
  }
  PumpSM.prototype.get = function (id) { return this.p[id]; };
  PumpSM.prototype.isOn = function (id) { var x = this.p[id]; return !!x && (x.state === 'start' || x.state === 'run'); };
  PumpSM.prototype.speed = function (id) { var x = this.p[id]; return x ? x.s : 0; };
  PumpSM.prototype.label = function (id) { var x = this.p[id]; return x ? PUMP_STATES[x.state] : ''; };
  PumpSM.prototype.cmdStart = function (id) {
    var x = this.p[id];
    if (!x) return { ok: false, reason: 'Нет насоса ' + id };
    if (x.state === 'fault') return { ok: false, reason: id + ': неисправность — ' + (x.reason || 'требуется ремонт') };
    if (x.state === 'na') return { ok: false, reason: id + ': недоступен — ' + (x.reason || 'выведен из работы') };
    if (x.state === 'start' || x.state === 'run') return { ok: true, reason: 'уже в работе' };
    x.state = 'start'; x.reason = '';
    return { ok: true };
  };
  PumpSM.prototype.cmdStop = function (id, reason) {
    var x = this.p[id];
    if (!x) return { ok: false, reason: 'Нет насоса ' + id };
    if (x.state === 'start' || x.state === 'run') { x.state = 'stopping'; x.reason = reason || 'команда «Стоп»'; }
    return { ok: true };
  };
  // Отключение защитой (ПАЗ, местный «Стоп», LSA) — выбег
  PumpSM.prototype.trip = function (id, reason) { return this.cmdStop(id, reason || 'отключение защитой'); };
  PumpSM.prototype.setFault = function (id, reason) {
    var x = this.p[id]; if (!x) return;
    x.reason = reason || 'неисправность';
    if (x.s > 0) { x.state = 'stopping'; x.faultPending = true; }
    else { x.state = 'fault'; x.faultPending = false; }
  };
  PumpSM.prototype.clearFault = function (id) {
    var x = this.p[id]; if (!x) return;
    x.faultPending = false;
    if (x.state === 'fault') { x.state = 'stop'; x.reason = ''; }
  };
  PumpSM.prototype.setAvailable = function (id, on, reason) {
    var x = this.p[id]; if (!x) return;
    if (on) { if (x.state === 'na') { x.state = 'stop'; x.reason = ''; } }
    else { if (x.s > 0) this.cmdStop(id, reason); x.state = x.s > 0 ? 'stopping' : 'na'; x.naPending = true; x.reason = reason || 'выведен из работы'; }
  };
  PumpSM.prototype.setSpeed = function (id, frac) {
    var x = this.p[id]; if (!x || x.kind !== 'vfd') return false;
    x.sp = Math.max(DATA.timing.vfdMin, Math.min(1, frac));
    return true;
  };
  PumpSM.prototype.tick = function (dt) {
    var ev = [];
    for (var id in this.p) {
      var x = this.p[id], t = DATA.timing.pump[x.kind];
      var from = x.state;
      var target = x.kind === 'vfd' ? x.sp : 1;
      if (x.state === 'start') {
        x.s = Math.min(target, x.s + dt / t.acc);
        if (x.s >= target - 1e-9) x.state = 'run';
      } else if (x.state === 'run') {
        if (x.s < target) x.s = Math.min(target, x.s + dt / t.acc);
        else if (x.s > target) x.s = Math.max(target, x.s - dt / t.dec);
      } else if (x.state === 'stopping') {
        x.s = Math.max(0, x.s - dt / t.dec);
        if (x.s <= 0) {
          if (x.faultPending) { x.state = 'fault'; x.faultPending = false; }
          else if (x.naPending) { x.state = 'na'; x.naPending = false; }
          else x.state = 'stop';
        }
      }
      if (from !== x.state) ev.push({ id: id, from: from, to: x.state, reason: x.reason });
    }
    return ev;
  };

  /* ------------------------------------------------------------------
   * 8. Автомат хода арматуры
   * ------------------------------------------------------------------ */
  var VALVE_STATES = {
    closed: 'закрыта', opening: 'открывается', open: 'открыта',
    closing: 'закрывается', stopped: 'остановлена в ходе', jammed: 'заклинила'
  };

  function ValveSM(defs) {
    this.v = {};
    for (var id in (defs || {})) this.add(id, defs[id]);
  }
  ValveSM.prototype.add = function (id, d) {
    var pos = d.pos != null ? d.pos : 0;
    this.v[id] = {
      id: id, kind: d.kind || 'gate_m', pos: pos,
      state: pos >= 1 ? 'open' : (pos <= 0 ? 'closed' : 'stopped'),
      target: pos, jam: false, travel: d.travel || DATA.timing.valve[d.kind || 'gate_m'] || 15
    };
  };
  ValveSM.prototype.get = function (id) { return this.v[id]; };
  ValveSM.prototype.pos = function (id) { var x = this.v[id]; return x ? x.pos : 0; };
  ValveSM.prototype.fullyOpen = function (id) { var x = this.v[id]; return !!x && x.pos >= 0.999; };
  ValveSM.prototype.passable = function (id) { var x = this.v[id]; return !!x && x.pos > 1e-3; };
  ValveSM.prototype.label = function (id) { var x = this.v[id]; return x ? VALVE_STATES[x.jam ? 'jammed' : x.state] : ''; };
  // Признак для прежней логики (procLogic.st.valve): маршрут собирается только из полностью
  // открытой арматуры; при закрытии в ходе продукт идёт, пока задвижка не закрылась
  ValveSM.prototype.legacyOpen = function (id) {
    var x = this.v[id]; if (!x) return false;
    if (x.pos >= 0.999) return true;
    return x.pos > 1e-3 && x.state !== 'opening';
  };
  ValveSM.prototype.hydType = function (id) {
    var x = this.v[id]; if (!x) return 'gate';
    return (x.kind === 'ball_e' || x.kind === 'ball_m') ? 'ball' : 'gate';
  };
  ValveSM.prototype._cmd = function (id, target) {
    var x = this.v[id];
    if (!x) return { ok: false, reason: 'Нет арматуры ' + id };
    if (x.jam) return { ok: false, reason: id + ': заклинивание — команда не выполнена' };
    if (Math.abs(x.pos - target) < 1e-6) {
      x.state = target >= 1 ? 'open' : 'closed';
      return { ok: true, reason: 'уже в положении' };
    }
    x.target = target;
    x.state = target > x.pos ? 'opening' : 'closing';
    return { ok: true, time: Math.abs(target - x.pos) * x.travel };
  };
  ValveSM.prototype.cmdOpen = function (id) { return this._cmd(id, 1); };
  ValveSM.prototype.cmdClose = function (id) { return this._cmd(id, 0); };
  ValveSM.prototype.cmdTo = function (id, pos) { return this._cmd(id, Math.max(0, Math.min(1, pos))); };
  ValveSM.prototype.cmdStop = function (id) {
    var x = this.v[id]; if (!x) return { ok: false };
    if (x.state === 'opening' || x.state === 'closing') { x.state = 'stopped'; x.target = x.pos; }
    return { ok: true };
  };
  ValveSM.prototype.setJam = function (id, on) {
    var x = this.v[id]; if (!x) return;
    x.jam = !!on;
    if (on && (x.state === 'opening' || x.state === 'closing')) { x.state = 'stopped'; x.target = x.pos; }
  };
  // Мгновенная установка (начальные условия, инструктор)
  ValveSM.prototype.setPos = function (id, pos) {
    var x = this.v[id]; if (!x) return;
    x.pos = Math.max(0, Math.min(1, pos)); x.target = x.pos;
    x.state = x.pos >= 1 ? 'open' : (x.pos <= 0 ? 'closed' : 'stopped');
  };
  ValveSM.prototype.tick = function (dt) {
    var ev = [];
    for (var id in this.v) {
      var x = this.v[id];
      if (x.jam || (x.state !== 'opening' && x.state !== 'closing')) continue;
      var step = dt / x.travel, from = x.state;
      if (x.state === 'opening') x.pos = Math.min(x.target, x.pos + step);
      else x.pos = Math.max(x.target, x.pos - step);
      if (Math.abs(x.pos - x.target) < 1e-9) {
        x.pos = x.target;
        x.state = x.pos >= 1 ? 'open' : (x.pos <= 0 ? 'closed' : 'stopped');
      }
      if (from !== x.state) ev.push({ id: id, from: from, to: x.state, pos: x.pos });
    }
    return ev;
  };

  /* ------------------------------------------------------------------
   * 9. Вспомогательное: построение участка
   *   seg({ id, Dn: 219, s: 6, L: 12.3, fittings: { elbow90: 2 }, valves: [...], check, zA, zB })
   * ------------------------------------------------------------------ */
  function seg(o) {
    var Din = (o.Din != null) ? o.Din : (o.Dn - 2 * (o.s || 0)) / 1000;
    var z = 0;
    if (o.fittings) for (var k in o.fittings) {
      if (DATA.zeta[k] == null) throw new Error('HYD35: неизвестная деталь ' + k);
      z += DATA.zeta[k] * o.fittings[k];
    }
    if (o.zeta) z += o.zeta;
    return {
      id: o.id, Dn: o.Dn, s: o.s, Din: Din, L: o.L || 0, zeta: z,
      valves: o.valves || null, check: o.check === -1 ? -1 : !!o.check,
      zA: o.zA, zB: o.zB, cond: !!o.cond
    };
  }

  var api = {
    DATA: DATA, G: G,
    fluidAt: fluidAt, patm: patm, frictionFactor: frictionFactor, valveZeta: valveZeta,
    segLoss: segLoss, seg: seg, pumpCurve: pumpCurve, solveRoute: solveRoute,
    rootMonotone: rootMonotone,
    PumpSM: PumpSM, ValveSM: ValveSM, PUMP_STATES: PUMP_STATES, VALVE_STATES: VALVE_STATES
  };
  root.HYD35 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

