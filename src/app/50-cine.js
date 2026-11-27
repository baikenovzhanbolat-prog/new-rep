/* =====================================================================================
   v0.38–v0.39 — КИНОРЕЖИМ (модуль CINE): два фильма 9:16 (1080 × 1920) для Instagram.
   v0.39: программа «Экшн · 45 с» — FPV-пролёт одним дублем на сетке 120 BPM: «из чертежа» (план → рост сооружений),
   пикирование и пролёт между РВС, макро продукта в разрезе (замедление), щель у автоцистерны и АСН-80, «рентген»
   (линия сканирования, уровни в РВС, потоки, подземные сети), испытание лафетного ствола 800.1 (струя в замедлении),
   пролёт под вагоном-цистерной между тележками, ракетный отъезд; финальный кадр совпадает с первым (зацикливание).
   v0.41: «Экшн» — 62 с: «чертёж» 4 с, облёт быстрее (×1,33), разрез грунта у вышки 800.1 (36–44 с), без дрожи камеры, крен сглажен.
   v0.40: «Экшн» — 55 с: после «чертежа» пикирование и облёт РВС-109.3 по рисунку «Обзора» (2–18 с), остальные сцены v0.39 сдвинуты на +10 с.
   Модельные процессы и координаты не меняются; эффекты — только в кадре. Ниже — программа «Обзор · 58 с» (v0.38).
   Заменяет кинорежим v0.37. Сцена, объекты, координаты и технологические схемы — существующие:
   модуль не создаёт сооружений, труб и оборудования и не перемещает их.
   • Раскадровка (8 сцен): дрон-пролёт → орбита 315° вокруг РВС-109.3 → трекинг вдоль трубопроводов →
     проход у автоцистерны и АСН-80 (станция 186) → геологический разрез: подземные сети В2, В10, К3 по ГП-005 →
     поток ДТ в разрезе трубопровода (маршрут М1) → эстакада 177 вдоль вагонов-цистерн → финальный общий план.
   • Камера: сплайн Эрмита по опорным кадрам (C1), опорные кадры — от координат объектов модели;
     переход сцен 6 → 7 — растворение (0,8 с). Просвет до рельефа и объёмов — guard(), полная проверка лучами — check().
   • Свет «ясное утро»: солнце 30° (восток–юго-восток), голубое небо с кучевыми облаками (процедурно),
     окружение PMREM из того же неба; цветокоррекция ACES, нейтральные тени, тёплые света; размытие движения
     камеры (по глубине кадра, затвор 180°).
   • Подземный разрез: на время сцены 5 в рельефе и покрытиях вырезается участок 12,7 × 5,5 м (плоскости отсечения),
     стенки и дно — грунт со слоями по скважине №10 (КЖ-20); видны только сети внутри разреза. Глубины — условные (UGND_DEPTH).
   • Время — виртуальное: каждый кадр рендерится без пропусков (покадровый MP4 в браузере или внешний рендер).
   • После выхода камера, свет, небо, материалы, слои, режимы и модель перекачки возвращаются к исходным.
   ===================================================================================== */
const CINE = (() => {
  const V3 = THREE.Vector3, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
  const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const ramp = (t, a, b) => sm((t - a) / (b - a));
  const win = (t, a, b, c, d) => Math.min(ramp(t, a, b), 1 - ramp(t, c, d));
  const OUT = { w: 1080, h: 1920 };
  /* v0.42: формат кадра — 'h' 16:9 (экран компьютера, во весь экран) или 'v' 9:16 (Instagram, телефон).
     В 16:9 — та же траектория; вертикальный угол уменьшен (tg ×0,7), по горизонтали кадр шире — как у FPV-камеры */
  let FMT = innerWidth >= 900 ? 'h' : 'v';
  const ASP = () => FMT === 'h' ? 16 / 9 : 9 / 16;
  const fovF = f => FMT === 'h' ? 2 * Math.atan(Math.tan(f * Math.PI / 360) * 0.7) * 180 / Math.PI : f;   // 16:9: вертикальный угол ×0,7 по тангенсу — широкий FPV-кадр, крупность сохраняется
  if (FMT === 'h') { OUT.w = 1920; OUT.h = 1080; }
  let DUR = 58; const VER = '39.' + Date.now().toString(36);   // VER — ключ программ шейдеров модуля
  const objOf = id => OBJ.find(o => o.id === id);

  /* ---------- 1. Тексты (RU). Правятся здесь ---------- */
  const TXT = {
    org: 'Филиал ТОО «КТЖ – Грузовые перевозки»',
    finalA: 'ЦЕНТР ТОПЛИВНЫХ РЕСУРСОВ',
    finalB: 'ЦИФРОВОЙ ДВОЙНИК',
    finalC: 'Топливный склад Оскемен',
    finalD: 'Промышленная инфраструктура. Визуализирована.'
  };
  const SCENES_TOUR = [
    { id: 'aerial', t0: 0, t1: 5, a: 'Топливный склад Оскемен', b: 'Цифровой двойник', top: 'Центр топливных ресурсов' },
    { id: 'tank', t0: 5, t1: 13, a: 'Резервуарный парк', b: 'РВС-1000 · 3 резервуара' },
    { id: 'pipes', t0: 13, t1: 19, a: 'Технологические трубопроводы', b: 'Трассы — по ГП-005' },
    { id: 'asn', t0: 19, t1: 27, a: 'Станция налива 186', b: 'Автоцистерна · АСН-80, верхний налив' },
    { id: 'ug', t0: 27, t1: 37, a: 'Подземные сети', b: 'Водопровод В2 · пенораствор В10 · канализация К3', n: 'Трассы — ГП-005. Глубины В2, В10 — по профилю 610-ПТ-004, К3 — условные' },
    { id: 'flow', t0: 37, t1: 44, a: 'Движение ГСМ', b: 'ДТ летнее: ВЦ-1 → насос → РВС-109.2', n: 'Технический разрез трубопровода' },
    { id: 'rail', t0: 44, t1: 50, a: 'Железнодорожная эстакада', b: 'Слив и налив вагонов-цистерн' },
    { id: 'final', t0: 50, t1: 58, fin: 1, tin: [53.2, 54.6] }
  ];
  const ROUTE = { src: 'USN1', dst: 'RVS2', prod: 'L', pumps: ['Н-6', 'Н-5'] };   // М1: слив ДТ(Л) из ВЦ-1 в РВС-109.2
  const XF = { t0: 43.6, t1: 44.4 };                                                   // растворение сцен 6 → 7 (программа «Обзор»)
  /* программа «Экшн · 45 с»: подписи — короткие, в верхней трети кадра (вне интерфейса Instagram); w — окно показа, с */
  const SCENES_ACTION = [
    { id: 'hook', t0: 0, t1: 4, a: 'Топливный склад Оскемен', b: 'Из чертежа — в цифровой двойник', top: 'Центр топливных ресурсов', w: [-1, -0.5, 3.4, 3.9] },
    { id: 'dive', t0: 4, t1: 16, a: 'Резервуарный парк', b: 'РВС-1000 · облёт резервуара 109.3', w: [8.9, 9.3, 13.4, 13.9] },
    { id: 'pipes', t0: 16, t1: 22, a: 'ДТ в трубопроводе', b: 'Технический разрез · замедление ×4', w: [18.4, 18.8, 20.7, 21.1] },
    { id: 'asn', t0: 22, t1: 28, a: 'Станция налива 186', b: 'АСН-80 · крышка на горловине', w: [24.4, 24.8, 26.8, 27.3] },
    { id: 'xray', t0: 28, t1: 36, a: 'Склад насквозь', b: 'Уровни в резервуарах · потоки · подземные сети', n: 'Глубины, кроме В2 и В10, — условные', w: [29.5, 30.0, 34.4, 34.9] },
    { id: 'trench', t0: 36, t1: 44, a: 'Подземные сети', b: 'Разрез грунта · трубы В2, В10, К3 и колодцы', n: 'Глубины В2, В10 — по профилю; К3 — условные', w: [37.6, 38.0, 41.4, 41.9] },
    { id: 'water', t0: 44, t1: 50, a: 'Лафетный ствол 800.1', b: 'Испытание подачи воды · замедление', n: 'Струя — учебная баллистика', w: [45.7, 46.1, 49.0, 49.5] },
    { id: 'rail', t0: 50, t1: 56, a: 'Ж/д эстакада 177', b: 'Пролёт под вагоном-цистерной', w: [51.0, 51.4, 54.6, 55.2] },
    { id: 'final', t0: 56, t1: 62, fin: 1, tin: [57.2, 58.2] }
  ];

  const PROGS = { tour: { name: 'Обзор · 58 с', dur: 58, scenes: SCENES_TOUR, fpv: false }, action: { name: 'Экшн · 62 с', dur: 62, scenes: SCENES_ACTION, fpv: true } };
  let PROG = 'action', SCENES = SCENES_ACTION; DUR = 62;

  /* ---------- 2. Состояние ---------- */
  const st = {
    on: false, playing: false, paused: false, t: 0, last: 0, offline: false, titles: true, quality: 'fast', mb: true,
    plan: null, segs: null, A: null, saved: null, logo: null, env: null, busy: false, lights: []
  };

  /* ---------- 3. Опорные данные из модели ---------- */
  function anchors() {
    const A = {};
    for (const [k, id] of [['rvs1', '109.1'], ['rvs2', '109.2'], ['rvs3', '109.3']]) {
      const m = MDL[id] && MDL[id].at && MDL[id].at[0];
      let x, z; if (m) [x, z] = P(...m); else { const c = new THREE.Box3().setFromObject(objOf(id).g).getCenter(new V3()); x = c.x; z = c.z; }
      A[k] = new V3(x, hAt(x, z), z);
    }
    A.R = 10.43 / 2 + 0.1;
    A.est = { x0: EST177.X0, x1: EST177.X1, z: EST177.TZ, cars: EST177.cars };
    A.truck = F25.truck && F25.truck.g ? new THREE.Box3().setFromObject(F25.truck.g) : new THREE.Box3(new V3(-57.2, 0.75, -11.1), new V3(-54.4, 4.4, -1.6));
    A.H186 = F25.H186;
    return A;
  }

  /* ---------- 4. Маршрут М1 (модель ТП) ---------- */
  function routePlan() {
    const L = procLogic;
    for (const p of ROUTE.pumps) {
      if (!L.PU[p]) continue;
      if (!L.findPath(ROUTE.src, ROUTE.dst, p, ROUTE.prod, false)) continue;
      const ev = L.evaluate(ROUTE.src, ROUTE.dst, p, ROUTE.prod);
      if (ev && ev.ideal) return { ev, pump: p, path: ev.ideal };
    }
    return null;
  }

  /* ---------- 5. Камера: опорные кадры {t, p, q, f (верт. угол), r (крен, °)} → сплайн Эрмита ---------- */
  function makeTrack(K) {
    const n = K.length, mp = [], mq = [], mf = [], mr = [];
    const tgS = (k, i) => {
      if (i === 0 || i === n - 1) return 0;
      const a = K[i - 1], b = K[i], c = K[i + 1], h0 = b.t - a.t, h1 = c.t - b.t;
      return ((b[k] - a[k]) / h0 * h1 + (c[k] - b[k]) / h1 * h0) / (h0 + h1);
    };
    const tgV = (k, i) => {
      if (i === 0 || i === n - 1) {   // концы: скорость по соседнему участку (без остановки на границе отрезка)
        if (n < 2) return new V3();
        const a = i === 0 ? K[0] : K[n - 2], b = i === 0 ? K[1] : K[n - 1];
        return K[i].hold ? new V3() : b[k].clone().sub(a[k]).divideScalar(b.t - a.t).multiplyScalar(0.5);
      }
      if (K[i].hold) return new V3();
      const a = K[i - 1], b = K[i], c = K[i + 1], h0 = b.t - a.t, h1 = c.t - b.t;
      const v0 = b[k].clone().sub(a[k]).divideScalar(h0), v1 = c[k].clone().sub(b[k]).divideScalar(h1);
      const m = v0.clone().multiplyScalar(h1 / (h0 + h1)).add(v1.clone().multiplyScalar(h0 / (h0 + h1)));
      const lim = 1.6 * Math.min(v0.length(), v1.length()); if (m.length() > lim) m.setLength(lim);
      return m;
    };
    for (let i = 0; i < n; i++) { mp.push(tgV('p', i)); mq.push(tgV('q', i)); mf.push(tgS('f', i)); mr.push(tgS('r', i)); }
    const _a = new V3(), _b = new V3();
    function herm(out, pa, ma, pb, mb, s, h) {
      const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      return out.copy(pa).multiplyScalar(h00).add(_a.copy(ma).multiplyScalar(h10 * h)).add(_b.copy(pb).multiplyScalar(h01)).add(_a.copy(mb).multiplyScalar(h11 * h));
    }
    const hs = (a, ma, b, mb, s, h) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * h * ma + (-2 * s3 + 3 * s2) * b + (s3 - s2) * h * mb; };
    const at = function (t, P_, Q_, o) {
      if (t <= K[0].t) { P_.copy(K[0].p).addScaledVector(mp[0], t - K[0].t); Q_.copy(K[0].q).addScaledVector(mq[0], t - K[0].t); o.f = K[0].f; o.r = K[0].r; return; }
      if (t >= K[n - 1].t) { P_.copy(K[n - 1].p).addScaledVector(mp[n - 1], t - K[n - 1].t); Q_.copy(K[n - 1].q).addScaledVector(mq[n - 1], t - K[n - 1].t); o.f = K[n - 1].f; o.r = K[n - 1].r; return; }
      let i = 0; while (i < n - 2 && K[i + 1].t < t) i++;
      const a = K[i], b = K[i + 1], h = b.t - a.t, s = (t - a.t) / h;
      herm(P_, a.p, mp[i], b.p, mp[i + 1], s, h); herm(Q_, a.q, mq[i], b.q, mq[i + 1], s, h);
      o.f = hs(a.f, mf[i], b.f, mf[i + 1], s, h); o.r = hs(a.r, mr[i], b.r, mr[i + 1], s, h);
    };
    at.t0 = K[0].t; at.t1 = K[n - 1].t;
    return at;
  }

  /* ---------- 6. Раскадровка: опорные кадры от координат модели ---------- */
  function build() {
    const A = st.A = anchors();
    st.plan = routePlan();
    if (PROG === 'action') return buildAction(A);
    const r3 = A.rvs3, r2 = A.rvs2, g = (x, z) => hAt(x, z);
    const S1 = [], S2 = [];
    const key = (L, t, p, q, f = 55, r = 0, hold = false) => L.push({ t, p: new V3(...p), q: new V3(...q), f, r, hold });
    // Сцена 1 (0–5): с высоты — быстро вперёд и вниз к резервуарному парку
    key(S1, 0.0, [98, 50, 118], [2, 4, -8], 52);
    key(S1, 2.2, [62, 31, 54], [8, 5, -11], 56);
    key(S1, 4.5, [42, 23, 13], [r3.x - 1, 7, r3.z], 60, -2);
    // Сцена 2 (5–13): орбита вокруг РВС-109.3 (спираль внутрь): юго-восток → восток (низко) → север → над проходом между РВС (высоко) → юг (низкий ракурс снизу вверх)
    const orbit = [   // [t, угол °(0 — восток, 90 — юг), радиус, высота камеры, высота точки взгляда, верт. угол, крен]
      [5.7, 36, 23, 14.0, 7.0, 62, -3],
      [6.7, 6, 16.6, 6.0, 6.5, 66, -4],
      [7.7, -32, 20.5, 4.4, 7.5, 66, -4],
      [8.7, -76, 21.0, 7.5, 7.0, 64, -3],
      [9.7, -118, 19.0, 14.0, 6.5, 64, -3],
      [10.7, -160, 12.0, 21.0, 5.0, 66, -2],
      [11.6, -205, 11.4, 14.0, 7.0, 68, -2],
      [12.4, -240, 10.2, 5.0, 10.0, 70, -1],
      [13.05, -262, 8.9, 1.9, 13.0, 74, 0]
    ];
    for (const [t, a, R, y, ty, f, r] of orbit) {
      const ar = a * Math.PI / 180, x = r3.x + Math.cos(ar) * R, z = r3.z + Math.sin(ar) * R;
      key(S1, t, [x, g(x, z) + y, z], [r3.x, ty, r3.z], f, r);
    }
    // Сцена 3 (13–19): выход из орбиты, разгон низко вдоль трубопроводов южной стороны парка (z ≈ −1,4) на запад, затем подъём над поворотом трассы
    key(S1, 13.9, [12.4, 2.2, -1.0], [6.0, 5.5, -7.5], 70, 2);
    key(S1, 14.85, [6.0, 2.0, -0.4], [-4.0, 1.3, -1.0], 64, 3);
    key(S1, 15.7, [-6.0, 2.0, -0.3], [-17.0, 1.25, -1.1], 64, 2);
    key(S1, 17.0, [-22.0, 2.2, -0.3], [-34.0, 1.4, -1.0], 62, 1);
    key(S1, 18.4, [-34.0, 6.5, -1.0], [-50.0, 3.0, -6.5], 58, -2);
    // Сцена 4 (19–27): станция налива 186 — общий план, подход низко в три четверти к кабине, проход вдоль автоцистерны,
    // подъём к АСН-80 (крышка на горловине), выход у задней части и подъём в сторону участка подземных сетей
    const tb = A.truck, tcx = (tb.min.x + tb.max.x) / 2, tz0 = tb.min.z, tz1 = tb.max.z, ty1 = tb.max.y, H = A.H186, ex = tb.max.x + 1.05;
    key(S1, 19.8, [-42.5, 8.5, 6.0], [-56.0, 2.6, -4.0], 56, -1);
    const cap = new V3(tcx, ty1 + 0.2, -5.46);   // горловина автоцистерны под крышкой АСН-80 (186-ТХ-002-0)
    key(S1, 21.0, [-53.7, 2.3, tz1 + 5.5], [tb.max.x - 0.2, 2.5, tz1 - 2.0], 60, 2);
    key(S1, 22.2, [-53.68, 2.5, -1.2], [tcx + 0.4, 3.0, -8.0], 64, 3);
    key(S1, 23.0, [-53.9, 4.8, -2.3], cap.toArray(), 62, 2);
    key(S1, 23.8, [-54.1, 6.6, -5.0], cap.toArray(), 60, 0);
    key(S1, 24.7, [-54.6, 5.0, -8.9], cap.toArray(), 58, -1);
    key(S1, 25.3, [-54.6, 5.15, -11.4], cap.toArray(), 58, -1);
    key(S1, 26.5, [-49.0, 15.0, -17.5], [-55.5, 2.5, -5.0], 54, -2);
    // Сцена 5 (27–37): подземные сети — общий план участка, разрез открывается, камера уходит под землю вдоль трасс
    const C = CUT.box, gc = g((C.x0 + C.x1) / 2, (C.zN + C.zS) / 2);
    key(S1, 28.3, [-29.0, 18.5, 1.0], [-28.5, gc - 1.0, 19.0], 54, 0);
    key(S1, 29.8, [-20.5, 11.0, 9.0], [-28.0, gc - 1.5, 19.0], 56, 0);
    key(S1, 31.2, [C.x1 + 1.8, gc + 3.0, 19.0], [C.x1 - 6.0, gc - 1.7, 19.0], 60, 0);
    key(S1, 32.4, [C.x1 - 0.8, gc - 0.25, 19.3], [C.x1 - 6.5, gc - 2.6, 19.2], 64, 0);
    key(S1, 34.6, [-30.6, gc - 0.3, 19.4], [-35.8, gc - 2.4, 19.5], 66, 0);
    key(S1, 35.9, [-33.4, gc + 1.8, 19.8], [-37.5, 0.8, 21.0], 62, 0);
    // Сцена 6 (37–44): вдоль нагнетательного трубопровода М1 (x ≈ −36,4) — продукт в разрезе трубы
    key(S1, 37.0, [-35.6, 1.6, 20.8], [-36.4, 0.8, 17.6], 54, 0);
    key(S1, 38.4, [-35.95, 1.4, 19.2], [-36.4, 0.79, 16.6], 46, 2);
    key(S1, 40.2, [-36.4, 1.55, 17.4], [-36.45, 0.8, 14.8], 44, 0);
    key(S1, 42.0, [-36.95, 1.45, 15.6], [-36.4, 0.84, 12.9], 46, -2);
    key(S1, 44.6, [-37.6, 4.0, 12.6], [-36.4, 1.0, 7.5], 54, 0);
    // Сцена 7 (44–50): эстакада 177 — низко у пути, вдоль вагонов-цистерн, затем подъём
    const ez = A.est.z, cars = A.est.cars, xw = Math.min(...cars) - 12, gz = g(-20, ez + 3);
    key(S2, 43.4, [-40.0, gz + 1.1, ez + 2.7], [-26, gz + 1.5, ez + 1.2], 62, 0);
    key(S2, 46.6, [cars[1] - 1, gz + 1.25, ez + 2.75], [cars[2] + 6, gz + 1.7, ez + 1.0], 62, 2);
    key(S2, 48.0, [cars[1] + 6, gz + 1.7, ez + 2.8], [cars[2] + 5, gz + 2.6, ez + 0.2], 60, 2);
    key(S2, 49.0, [cars[2] + 0.5, gz + 3.6, ez + 3.0], [cars[2] + 14, gz + 3.4, ez + 0.5], 58, 0);
    key(S2, 50.0, [cars[2] + 4, gz + 8.5, ez + 4.5], [cars[2] + 6, gz + 1.5, ez - 8], 56, 0);
    // Сцена 8 (50–58): подъём и отъезд — весь склад, небо и горизонт, место для титра
    key(S2, 51.0, [8, 16, ez + 13], [-16, 2, 10], 52, 0);
    key(S2, 53.8, [44, 30, 86], [-10, 5, -4], 48, 0);
    key(S2, 56.4, [60, 37, 104], [-8, 7, -6], 44, 0);
    key(S2, DUR + 0.6, [62.5, 38.2, 107.5], [-8, 7.2, -6], 44, 0);
    st.segs = [{ t0: -1, t1: XF.t1, track: makeTrack(S1) }, { t0: XF.t0, t1: DUR + 1, track: makeTrack(S2) }];
  }

  /* ---------- 6а. Программа «Экшн · 45 с»: опорные кадры (сетка 120 BPM — такт 2 с) ---------- */
  function buildAction(A) {
    const r2 = A.rvs2, r3 = A.rvs3, gx = (r2.x + r3.x) / 2, tz = (r2.z + r3.z) / 2, K = [];
    const key = (t, p, q, f = 60, r = 0) => K.push({ t, p: new V3(...p), q: new V3(...q), f, r, hold: false });
    const tb = A.truck, tcx = (tb.min.x + tb.max.x) / 2, tz1 = tb.max.z, ty1 = tb.max.y, cap = [tcx, ty1 + 0.2, -5.46];
    const T1 = F24.towers && F24.towers['800.1'], twx = T1 ? T1.cx : -26.7, twz = T1 ? T1.cz : 24.15;
    const cars = A.est.cars, ez = A.est.z, cw = Math.min(...cars);   // ВЦ-2 (запад) — пролёт под ним
    // 0–2: «из чертежа» — вид сверху (восток вверху кадра), сооружения вырастают из плана
    key(0, [-4, 162, 3], [10, 0, 3], 62);
    key(2.4, [-3, 150, 1], [11, 0, -1.5], 62);
    key(4, [-1, 132, -5], [10, 0, -10], 62);
    // 2–18 (v0.40): пикирование к РВС-109.3 и облёт по спирали на 315° — рисунок фильма «Обзор» (сдвиг +2,2 с), выход низко к трубопроводам
    const g = (x, z) => hAt(x, z);
    key(4.975, [12, 100, 4], [14, 0, -8], 62);
    key(5.95, [30, 60, 14], [r3.x, 4, r3.z], 60);
    key(6.775, [40, 34, 16], [r3.x - 1, 6, r3.z], 60);
    key(7.525, [42, 23, 13], [r3.x - 1, 7, r3.z], 60, -2);
    for (const [t, a, R, y, ty, f, r] of [[5.7, 36, 23, 14.0, 7.0, 62, -3], [6.7, 6, 16.6, 6.0, 6.5, 66, -4], [7.7, -32, 20.5, 4.4, 7.5, 66, -4], [8.7, -76, 21.0, 7.5, 7.0, 64, -3],
      [9.7, -118, 19.0, 14.0, 6.5, 64, -3], [10.7, -160, 12.0, 21.0, 5.0, 66, -2], [11.6, -205, 11.4, 14.0, 7.0, 68, -2], [12.4, -240, 10.2, 5.0, 10.0, 70, -1], [13.05, -262, 8.9, 1.9, 13.0, 74, 0]]) {
      const ar = a * Math.PI / 180, x = r3.x + Math.cos(ar) * R, z = r3.z + Math.sin(ar) * R;
      key(4 + (t + 0.2) * 0.75, [x, g(x, z) + y, z], [r3.x, ty, r3.z], f, r);
    }
    key(14.575, [12.4, 2.2, -1.0], [6.0, 5.5, -7.5], 70, 2);
    // дальше — опорные кадры v0.39 со сдвигом +10 с (от 6,9 с): стык в 18 с совпадает с готовыми кадрами
    key(15.175, [gx - 2.6, 2.4, -0.9], [gx - 12.5, 1.7, 0.4], 70);
    key(15.625, [0.5, 2.15, -0.35], [-10, 1.3, -0.9], 68);
    // 8–14: вдоль трубопроводов на запад, торможение к разрезу трубы (замедление времени), рывок и подъём у поворота трассы
    key(16.8, [-12.0, 2.0, -0.3], [-20, 1.25, -1.2], 62);
    // макро: над окном разреза трубы М1 (ось y ≈ 1,24, z ≈ −1,45 — по сетке потока модели), взгляд вниз ≈ 28°
    key(18, [-15.2, 2.0, -1.2], [-16.6, 1.24, -1.46], 52);
    key(19, [-15.9, 1.9, -1.3], [-17.1, 1.24, -1.46], 46);
    key(20.4, [-16.5, 1.88, -1.32], [-17.7, 1.24, -1.46], 46);
    key(21.2, [-24, 2.3, -0.4], [-36, 1.6, -0.8], 62);
    key(22, [-34.5, 6.0, -0.8], [-48, 3.0, -5.0], 60);
    // 14–20: станция 186 — низко сзади, щель между колоннами навеса и автоцистерной, пролёт над АСН-80 (замедление), выход и подъём
    key(22.9, [-45.5, 4.5, 5.0], [-55.5, 2.6, -2.0], 60);
    key(23.7, [-53.7, 2.3, tz1 + 5.5], [tb.max.x - 0.2, 2.5, tz1 - 2.0], 64);
    key(24.3, [-53.68, 2.5, -1.2], [tcx + 0.4, 3.0, -8.0], 68);
    key(24.9, [-53.9, 4.8, -2.3], cap, 62);
    key(25.7, [-54.1, 6.6, -5.0], cap, 58);
    key(26.4, [-54.6, 5.0, -8.9], cap, 58);
    key(26.9, [-54.6, 5.15, -11.4], cap, 58);
    key(27.8, [-50, 16, -19], [-40, 2, 5], 58);
    // 20–28: «рентген» — высоко с запада, линия сканирования уходит на восток; облёт к вышке 800.1, линия возвращается
    key(29.2, [-62, 40, -8], [-8, 0, 6], 56);
    key(31.6, [-70, 36, 22], [-6, -1, 8], 54);
    // 36–44 (v0.41): земля раскрывается — разрез у вышки 800.1 (рисунок сцены 5 «Обзора»), камера идёт под землёй вдоль В2/В10/К3 на запад и выныривает к вышке
    { const C = CUT.box, gc = hAt((C.x0 + C.x1) / 2, (C.zN + C.zS) / 2);
      key(33.4, [-45, 30, 0], [-24, 0, 16], 56);
      key(35.0, [-29.0, 18.5, 1.0], [-28.5, gc - 1.0, 19.0], 54);
      key(36.4, [-20.5, 11.0, 9.0], [-28.0, gc - 1.5, 19.0], 56);
      key(37.6, [C.x1 + 1.8, gc + 3.0, 19.0], [C.x1 - 6.0, gc - 1.7, 19.0], 60);
      key(38.6, [C.x1 - 0.8, gc - 0.25, 19.3], [C.x1 - 6.5, gc - 2.6, 19.2], 64);
      key(40.8, [-30.6, gc - 0.3, 19.4], [-35.8, gc - 2.4, 19.5], 66);
      key(41.8, [-33.4, gc + 1.8, 19.8], [-37.5, 0.8, 21.0], 62); }
    key(43, [twx - 9.5, 11, twz + 8.8], [twx, 5.5, twz + 0.1], 56);
    // 28–34: лафетный ствол — монитор наводится, подача воды (замедление), камера идёт вдоль струи к цистерне, уход вниз к пути
    key(44.2, [twx - 4.9, 8.6, twz + 5.3], [twx - 0.3, 6.6, twz + 0.2], 52);
    key(45.4, [twx - 2.9, 8.4, twz - 2.9], [twx + 2.2, 6.5, twz + 5.9], 58);
    key(46.8, [twx - 0.7, 9.0, twz + 0.9], [twx + 3.9, 5.5, twz + 7.9], 60);
    key(48.2, [twx + 1.5, 8.6, twz + 5.3], [twx + 5.5, 4.6, twz + 11.9], 62);
    key(49, [twx + 3.5, 7.6, twz + 9.5], [cars[1], 4.3, ez], 64);
    key(49.9, [twx + 1.2, 3.0, ez + 2.75], [twx - 4.4, 1.6, ez + 2.5], 64);
    // 34–40: коридор между вагонами и стеной на запад, вираж вправо, пролёт под ВЦ-2 между тележками (в 1,3 м от оси — в стороне от сливного прибора),
    // выход к северу и вертикальный подъём в зазоре между котлом и краем площадки эстакады (≈ 1,1 м), уход вверх
    const ux = cw + 1.3, gz = ez - 2.06;   // gz — середина зазора котёл / площадка
    key(50.8, [ux + 3.2, 1.25, ez + 2.75], [ux - 3.0, 0.9, ez + 2.0], 66);
    key(51.5, [ux + 0.3, 0.62, ez + 2.35], [ux, 0.35, ez - 3.5], 70);
    key(52, [ux, 0.37, ez + 0.05], [ux, 0.45, ez - 6.5], 72);
    key(52.45, [ux, 0.72, gz], [ux, 3.5, gz - 4.5], 70);
    key(52.85, [ux, 2.6, gz], [ux + 0.2, 6.5, gz - 3.0], 66);
    key(53.4, [ux + 0.1, 6.6, gz + 0.02], [ux + 4.5, 1.0, ez - 0.5], 64);
    key(54.6, [ux + 6, 14, ez + 3.5], [ux + 11, 1.0, ez - 3.5], 58);
    // 40–45: ракетный отъезд вверх, разворот в вид сверху (как в первом кадре) — финальный титр
    key(56.4, [-8, 45, 50], [-6, 0, 10], 58);
    key(58.6, [-4, 110, 14], [6, 0, 6], 60);
    key(60, [-4, 152, 4], [10, 0, 3], 62);
    key(61.6, [-4, 162, 3], [10, 0, 3], 62);
    key(63.2, [-4, 163, 3], [10, 0, 3], 62);
    st.segs = [{ t0: -1, t1: 64, track: makeTrack(K) }];
  }

  /* ---------- 7. Просвет камеры: рельеф и крупные объёмы ---------- */
  let OBST = null;
  function obstacles() {
    const A = st.A, list = [];
    for (const r of [A.rvs1, A.rvs2, A.rvs3]) list.push({ k: 'cyl', x: r.x, z: r.z, r: A.R + 0.8, y1: r.y + 13.8 });
    for (const id of ['116.1–2', '116.3–4', '137', '166', '196', '213', '401', '406', '446', '501', '644', '200']) { const o = objOf(id); if (o && o.g) list.push({ k: 'box', b: new THREE.Box3().setFromObject(o.g).expandByScalar(0.5) }); }
    return list;
  }
  function guard(p) {
    const inCut = CUT.k > 0.01 && CUT.inside(p);
    const g = inCut ? CUT.floorAt(p.x, p.z) + 0.35 : hAt(p.x, p.z) + 0.55; if (p.y < g) p.y = g;
    if (!OBST) return p;
    for (const o of OBST) {
      if (o.k === 'cyl') {
        if (p.y > o.y1) continue;
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
        if (d < o.r) { const k = o.r / Math.max(1e-3, d); p.x = o.x + dx * k; p.z = o.z + dz * k; }
      } else if (o.b.containsPoint(p)) {
        const b = o.b, c = [[b.max.y - p.y, 'y+'], [p.x - b.min.x, 'x-'], [b.max.x - p.x, 'x+'], [p.z - b.min.z, 'z-'], [b.max.z - p.z, 'z+']].sort((u, v) => u[0] - v[0])[0][1];
        if (c === 'y+') p.y = b.max.y; else if (c === 'x-') p.x = b.min.x; else if (c === 'x+') p.x = b.max.x; else if (c === 'z-') p.z = b.min.z; else p.z = b.max.z;
      }
    }
    return p;
  }
  const _o = { f: 55, r: 0 };
  /* FPV: крен по боковому ускорению траектории (до 26°) и лёгкая «живая» вибрация камеры — только в программе «Экшн» */
  const _b0 = new V3(), _b1 = new V3(), _b2 = new V3(), _bq = new V3(), _bo = { f: 0, r: 0 };
  const nz = (t, s) => Math.sin(t * 6.1 + s) * 0.6 + Math.sin(t * 9.7 + s * 1.7) * 0.3 + Math.sin(t * 15.3 + s * 2.3) * 0.1;
  function bankAt(i, t) {
    const tr = st.segs[i].track, h = 0.09;
    tr(t - h, _b0, _bq, _bo); tr(t, _b1, _bq, _bo); tr(t + h, _b2, _bq, _bo);
    const vx = (_b2.x - _b0.x) / (2 * h), vz = (_b2.z - _b0.z) / (2 * h), ax = (_b2.x - 2 * _b1.x + _b0.x) / (h * h), az = (_b2.z - 2 * _b1.z + _b0.z) / (h * h);
    const sp = Math.hypot(vx, vz), sp3 = _b2.distanceTo(_b0) / (2 * h);
    const lat = sp > 1e-3 ? (vz * ax - vx * az) / sp : 0;
    return { roll: BANK_SIGN * clamp(Math.atan2(lat, 9.81) * 180 / Math.PI * 0.5, -26, 26) * clamp((sp - 2) / 6, 0, 1), k: clamp((sp3 - 3) / 14, 0, 1) };
  }
  let BANK_SIGN = 1; const BANK_K = [[-0.36, 0.25], [-0.18, 0.6], [0, 1], [0.18, 0.6], [0.36, 0.25]];
  function poseSeg(i, t, P_, Q_) {
    st.segs[i].track(t, P_, Q_, _o); const f = _o.f; let r = _o.r;
    if (PROGS[PROG].fpv) {
      let rs = 0, ws_ = 0; for (const [dt, w] of BANK_K) { rs += bankAt(i, t + dt).roll * w; ws_ += w; }   // крен сглажен по окну ±0,36 с
      r += rs / ws_ * (1 - 0.5 * win(t, 7.4, 7.9, 13.8, 14.4));   // на облёте РВС — вдвое мягче
    }
    guard(P_); return { f, r };
  }
  const _P = new V3(), _Q = new V3(), _up = new V3(), _fw = new V3();
  function setCam(cam, P_, Q_, f, rDeg, near) {
    cam.position.copy(P_); cam.up.set(0, 1, 0); cam.lookAt(Q_);
    if (rDeg) cam.rotateZ(rDeg * Math.PI / 180);
    f = fovF(f); const A = ASP();
    if (Math.abs(cam.fov - f) > 1e-4 || Math.abs(cam.near - near) / near > 0.02 || cam.aspect !== A) { cam.fov = f; cam.near = near; cam.aspect = A; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
  function nearOf(P_, Q_) { const d = P_.distanceTo(Q_); return clamp(d * 0.02, 0.06, 0.6); }
  function applyCamera(t, cam = camera, seg = 0) {
    const o = poseSeg(seg, t, _P, _Q);
    setCam(cam, _P, _Q, o.f, o.r, nearOf(_P, _Q));
    if (cam === camera) controls.target.copy(_Q);
    return o;
  }
  const segAt = t => (st.segs.length < 2 || t < XF.t0 ? 0 : t >= XF.t1 ? 1 : 0);

  /* ---------- 8. Свет «ясное утро», небо с облаками, окружение, тени ---------- */
  const LOOK = { az: 104, el: 31, sunCol: 0xfff0dc, sunI: 3.1, hemiI: 0.36, hemiSky: 0xd8e8ff, hemiGnd: 0x8c8068, fogC: 0xb4cbe2, fogN: 600, fogF: 5200, exp: 0.74 };
  function hemi() { let h = null; scene.traverse(o => { if (!h && o.isHemisphereLight) h = o; }); return h; }
  const SKY_DECL = 'uniform vec3 uSun; uniform float uT; uniform float uDisc; uniform float uCloud; varying vec3 vD;\n';
  const SKY_GLSL = `
    float h1(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ s += a * n2(p); p = m * p; a *= 0.5; } return s; }
    vec3 skyBase(vec3 d){
      float h = d.y;
      vec3 zen = vec3(0.055, 0.19, 0.62), hor = vec3(0.42, 0.60, 0.86), gnd = vec3(0.30, 0.31, 0.27);
      vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.8, max(h, 0.0)), 0.45));
      c = mix(c, hor * 1.04, smoothstep(0.08, -0.01, h));
      if (h < -0.01) c = mix(hor * 1.02, gnd, smoothstep(-0.01, -0.25, h));
      float mu = max(dot(d, uSun), 0.0);
      c += vec3(1.0, 0.86, 0.66) * (pow(mu, 6.0) * 0.16 + pow(mu, 48.0) * 0.45);
      c += vec3(1.0, 0.95, 0.86) * smoothstep(0.99975, 0.9999, mu) * 30.0 * uDisc;
      return c;
    }
    vec3 skyCol(vec3 d){
      vec3 c = skyBase(d);
      if (uCloud > 0.0 && d.y > 0.0) {
        vec2 p = d.xz / (d.y + 0.06) * 1.25 + vec2(uT * 0.006, uT * 0.002);
        float cov = 0.54, base = fbm(p * 1.1 + vec2(3.1, 1.7));
        float dens = smoothstep(cov, cov + 0.28, base + 0.18 * fbm(p * 4.3));
        vec2 so = normalize(uSun.xz + 1e-4) * 0.045;
        float lit = clamp((base - fbm((p + so) * 1.1 + vec2(3.1, 1.7))) * 5.0 + 0.55, 0.0, 1.0);
        vec3 cc = mix(vec3(0.58, 0.64, 0.74), vec3(1.0, 0.99, 0.97) * 1.55, lit);
        float mu = max(dot(d, uSun), 0.0); cc += vec3(1.0, 0.9, 0.75) * pow(mu, 12.0) * 0.6 * (1.0 - dens * 0.6);
        float fade = smoothstep(0.015, 0.16, d.y);
        c = mix(c, cc, dens * fade * uCloud * 0.92);
      }
      return c;
    }`;
  function skyMat(disc) {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: VIS.SUN }, uT: { value: 0 }, uDisc: { value: disc }, uCloud: { value: 1 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: SKY_DECL + SKY_GLSL + 'void main(){ gl_FragColor = vec4(skyCol(normalize(vD)), 1.0); }'
    });
  }
  function envFromSky() {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), m = skyMat(0);
    m.uniforms.uCloud.value = 0.7;
    const geo = new THREE.SphereGeometry(100, 48, 24); es.add(new THREE.Mesh(geo, m));
    const gm = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: 0x5c5a4c })); gm.rotation.x = -Math.PI / 2; gm.position.y = -6; es.add(gm);   // земля внизу — тёплый серо-зелёный отражённый свет
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    const r = pm.fromScene(es, 0.02); renderer.toneMapping = tm; pm.dispose(); m.dispose(); geo.dispose(); gm.geometry.dispose(); gm.material.dispose();
    return r;
  }
  let SKYM = null;
  function lookOn() {
    const h = hemi(), S = st.saved;
    S.look = { sun: VIS.SUN.clone(), skyMat: VIS.sky.material, env: scene.environment, fog: scene.fog ? { c: scene.fog.color.clone(), n: scene.fog.near, f: scene.fog.far } : null,
      sunC: sun.color.clone(), sunI: sun.intensity, hemi: h ? { i: h.intensity, c: h.color.clone(), g: h.groundColor.clone() } : null,
      sh: { r: sun.shadow.camera.right, sm: sun.shadow.mapSize.x, b: sun.shadow.bias, nb: sun.shadow.normalBias }, visTick: VIS.tick };
    const az = LOOK.az * Math.PI / 180, el = LOOK.el * Math.PI / 180;
    VIS.SUN.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();   // азимут от севера (−z) по часовой
    SKYM = skyMat(1); VIS.sky.material = SKYM;
    st.env = envFromSky(); scene.environment = st.env.texture;
    if (scene.fog) { scene.fog.color.set(LOOK.fogC); scene.fog.near = LOOK.fogN; scene.fog.far = LOOK.fogF; }
    sun.color.set(LOOK.sunCol); sun.intensity = LOOK.sunI;
    if (h) { h.intensity = LOOK.hemiI; h.color.set(LOOK.hemiSky); h.groundColor.set(LOOK.hemiGnd); }
    if (sun.shadow.mapSize.x < 4096) { sun.shadow.mapSize.set(4096, 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025;
    VIS.tick = shadowTick;
    matLook(true);
  }
  function lookOff() {
    const L = st.saved && st.saved.look; if (!L) return;
    const h = hemi();
    VIS.tick = L.visTick; VIS.SUN.copy(L.sun); VIS.sky.material = L.skyMat; if (SKYM) { SKYM.dispose(); SKYM = null; }
    scene.environment = L.env; if (st.env) { st.env.dispose(); st.env = null; }
    if (scene.fog && L.fog) { scene.fog.color.copy(L.fog.c); scene.fog.near = L.fog.n; scene.fog.far = L.fog.f; }
    sun.color.copy(L.sunC); sun.intensity = L.sunI;
    if (h && L.hemi) { h.intensity = L.hemi.i; h.color.copy(L.hemi.c); h.groundColor.copy(L.hemi.g); }
    if (sun.shadow.mapSize.x !== L.sh.sm) { sun.shadow.mapSize.set(L.sh.sm, L.sh.sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.bias = L.sh.b; sun.shadow.normalBias = L.sh.nb;
    matLook(false);
    for (const l of st.lights) { scene.remove(l); l.dispose(); } st.lights = [];
  }
  /* тени: область — по плану кадра (крупно — 22…40 м, общий план — до 150 м), центр — между камерой и точкой взгляда; привязка к текселю */
  const _st = new V3(), _sc = new V3();
  const SHX_ACTION = [[0, 170], [4.2, 170], [6.0, 110], [7.5, 70], [8.4, 55], [14.0, 50], [15.0, 40], [16, 40], [18, 24], [20.6, 24], [21.4, 45], [22.5, 40], [23.5, 30], [27.4, 30], [28.6, 130], [33.4, 130], [35.0, 60], [36.4, 40], [37.6, 30], [41.8, 30], [43.0, 40], [49.4, 40], [50.2, 30], [54.4, 40], [56.2, 150], [64, 170]];
  function shadowExt(t) {
    const L = PROG === 'action' ? SHX_ACTION : [[0, 150], [4.0, 150], [5.6, 46], [13.0, 46], [14.0, 40], [18.0, 40], [19.5, 60], [21.0, 34], [26.0, 34], [27.5, 70], [30.5, 40], [36.5, 34], [37.5, 26], [43.6, 26], [44.4, 40], [48.0, 44], [51.5, 150], [DUR + 1, 150]];
    let i = 0; while (i < L.length - 2 && L[i + 1][0] < t) i++;
    return lerp(L[i][1], L[i + 1][1], sm((t - L[i][0]) / (L[i + 1][0] - L[i][0])));
  }
  function shadowFor(P_, Q_, ext) {
    const sc = sun.shadow.camera;
    if (Math.abs(sc.right - ext) > 1e-3) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 1200; sc.updateProjectionMatrix(); }
    _sc.copy(P_).lerp(Q_, 0.75);
    const tx = (2 * ext) / sun.shadow.mapSize.x;
    _st.set(Math.round(_sc.x / tx) * tx, 0, Math.round(_sc.z / tx) * tx);
    sun.target.position.copy(_st); sun.position.copy(_st).addScaledVector(VIS.SUN, 500);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }
  function shadowTick() {
    VIS.sky.position.copy(camera.position);
    shadowFor(camera.position, controls.target, shadowExt(st.t));
    if (SKYM) SKYM.uniforms.uT.value = tOld(st.t);
  }
  /* материалы окружения: луг и деревья — естественнее (цвет), только на время показа */
  function matLook(on) {
    const S = st.saved;
    if (on) {
      S.mats = [];
      const set = (m, c) => { S.mats.push([m, m.color.clone()]); m.color.set(c); };
      scene.traverse(o => {
        if (o.name === 'луг (декоративно)' && o.material && o.material.color) set(o.material, 0x95a271);
        if (o.name === 'деревья (декоративно)') o.traverse(m => { if (m.material && m.material.color && !S.mats.some(e => e[0] === m.material)) set(m.material, m.material.color.clone().multiplyScalar(0.72).getHex()); });
      });
    } else if (S.mats) { for (const [m, c] of S.mats) m.color.copy(c); S.mats = null; }
  }

  /* ---------- 9. Подземный разрез (сцена 5) ---------- */
  const CUT = (() => {
    const box = { x0: -34.5, x1: -21.8, zN: 16.35, zS: 21.95 };
    const api = { box, k: 0, grp: null, x0: box.x0, x1: box.x0 };
    const PL = [new THREE.Plane(new V3(-1, 0, 0), 1e5), new THREE.Plane(new V3(1, 0, 0), -1e5), new THREE.Plane(new V3(0, 0, -1), box.zN), new THREE.Plane(new V3(0, 0, 1), -box.zS), new THREE.Plane(new V3(0, -1, 0), -1e5)];   // вырез поверхности (пересечение); 5-я — «рост из плана» (v0.39)
    const KEEP = [new THREE.Plane(new V3(1, 0, 0), 0), new THREE.Plane(new V3(-1, 0, 0), 0), new THREE.Plane(new V3(0, 0, 1), -box.zN + 0.25), new THREE.Plane(new V3(0, 0, -1), box.zS + 0.25)];   // подземное — только в разрезе
    const KEEPX = [new THREE.Plane(new V3(1, 0, 0), 0), new THREE.Plane(new V3(-1, 0, 0), 0)];   // стенки разреза — по текущей длине
    let prof = null;   // профиль дна: оси труб В2/В10/К3 по x
    function axisY(runs, x, zRef) {
      let best = null, bd = 1.5;
      for (const r of runs || []) for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1]; if (Math.abs(a[2] - zRef) > bd && Math.abs(b[2] - zRef) > bd) continue;
        const dx = b[0] - a[0]; if (Math.abs(dx) < 1e-6) continue;
        const u = (x - a[0]) / dx; if (u < -0.001 || u > 1.001) continue;
        const z = a[2] + (b[2] - a[2]) * u; if (Math.abs(z - zRef) < bd) { bd = Math.abs(z - zRef); best = a[1] + (b[1] - a[1]) * u; }
      }
      return best;
    }
    function profile() {
      const R = UGN.runsOf, D = UGND_DEPTH, xs = [];
      for (let x = box.x0 - 0.5; x <= box.x1 + 0.51; x += 0.5) xs.push(x);
      prof = xs.map(x => {
        const yk = axisY(R.kpd, x, 17.5) ?? (hAt(x, 17.5) - D.kpd), yp = axisY(R.prp, x, 19.0) ?? (hAt(x, 19) - D.prp), yv = axisY(R.pv, x, 20.0) ?? (hAt(x, 20) - D.pv);
        return { x, pts: [[box.zN - 0.3, yk + 0.05], [17.15, yk - 0.02], [17.85, yk - 0.06], [18.7, yp - 0.03], [19.3, yp - 0.04], [19.75, yv - 0.04], [20.6, yv - 0.08], [box.zS + 0.3, yv - 0.08]] };
      });
    }
    function floorAt(x, z) {
      if (!prof) return hAt(x, z) - 2;
      const i = clamp(Math.floor((x - prof[0].x) / 0.5), 0, prof.length - 2), a = prof[i], b = prof[i + 1], u = clamp((x - a.x) / 0.5, 0, 1);
      const yz = pr => { const p = pr.pts; if (z <= p[0][0]) return p[0][1]; for (let j = 1; j < p.length; j++) if (z <= p[j][0]) return lerp(p[j - 1][1], p[j][1], (z - p[j - 1][0]) / (p[j][0] - p[j - 1][0])); return p[p.length - 1][1]; };
      return lerp(yz(a), yz(b), u);
    }
    api.floorAt = floorAt;
    api.inside = p => p.x > api.x0 && p.x < api.x1 && p.z > box.zN && p.z < box.zS && p.y < hAt(p.x, p.z) + 0.2;
    /* грунт: слои по скважине №10 (КЖ-20) — покрытие и щебёночное основание, насыпной грунт до 297,36, супесь лессовидная до 293,36 */
    const L1 = 297.36 - H0, L2 = 293.36 - H0;
    const soilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
    soilMat.onBeforeCompile = sh => {
      sh.uniforms.uL1 = { value: L1 }; sh.uniforms.uL2 = { value: L2 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTop; varying float vTop; varying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTop = aTop; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying float vTop; varying vec3 vWP; uniform float uL1, uL2;
        float sh1(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float sn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(sh1(i), sh1(i + vec3(1,0,0)), f.x), mix(sh1(i + vec3(0,1,0)), sh1(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(sh1(i + vec3(0,0,1)), sh1(i + vec3(1,0,1)), f.x), mix(sh1(i + vec3(0,1,1)), sh1(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float pebbles(vec3 p, float s, float th){ vec3 q = p * s; float n = sn(q) * 0.6 + sn(q * 2.3) * 0.4; return smoothstep(th, th + 0.06, n); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float dpt = vTop - vWP.y; vec3 p = vWP;
          float w = sn(vec3(p.x * 0.7, p.y * 9.0, p.z * 0.7)) * 0.08;                 // неровность границ слоёв
          float n1 = sn(p * 3.1), n2 = sn(p * 11.0), n3 = sn(vec3(p.x * 2.0, p.y * 40.0, p.z * 2.0));
          vec3 asph = vec3(0.035, 0.035, 0.037) * (0.85 + 0.3 * n2);
          vec3 base = mix(vec3(0.11, 0.105, 0.10), vec3(0.20, 0.19, 0.18), n2) * (0.8 + 0.3 * pebbles(p, 14.0, 0.62));
          vec3 fill = mix(vec3(0.055, 0.04, 0.03), vec3(0.09, 0.068, 0.048), n1) * (0.85 + 0.25 * n2);
          fill = mix(fill, vec3(0.16, 0.15, 0.135), pebbles(p, 9.0, 0.66) * 0.75);
          vec3 loess = mix(vec3(0.13, 0.085, 0.048), vec3(0.18, 0.12, 0.068), n1) * (0.86 + 0.2 * n3);
          loess = mix(loess, vec3(0.23, 0.18, 0.12), smoothstep(0.72, 0.8, sn(vec3(p.x * 0.35, p.y * 5.0, p.z * 0.35))) * 0.5);   // прослои песка
          loess *= 1.0 - 0.18 * smoothstep(-0.5, -3.5, p.y);                                                                   // влажнее глубже
          vec3 deep = vec3(0.10, 0.075, 0.05) * (0.9 + 0.2 * n1);
          vec3 c = asph;
          c = mix(c, base, smoothstep(0.09, 0.11, dpt + w * 0.2));
          c = mix(c, fill, smoothstep(0.36, 0.4, dpt + w));
          c = mix(c, loess, smoothstep(uL1 + 0.03, uL1 - 0.03, vWP.y + w));
          c = mix(c, deep, smoothstep(uL2 + 0.05, uL2 - 0.05, vWP.y + w));
          diffuseColor.rgb = c;
        }`);
    };
    soilMat.customProgramCacheKey = () => 'cine-soil-' + VER;
    soilMat.clippingPlanes = KEEPX;
    const meshes = [];
    let endW = null, endE = null;
    function stripGeo(pts) {   // pts: [[x, yTop, z, yBot], ...] — вертикальная лента
      const pos = [], top = [], idx = [];
      pts.forEach(([x, yt, z, yb], i) => { pos.push(x, yt, z, x, yb, z); top.push(yt, yt); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); g2.setIndex(idx); g2.computeVertexNormals();
      return g2;
    }
    function endPts(x) { const pts = []; for (let z = box.zN; z <= box.zS + 1e-6; z += 0.25) pts.push([x, hAt(x, z) + 0.03, z, floorAt(x, z) - 0.3]); return pts; }
    function make() {
      if (api.grp) return;
      profile();
      const g2 = new THREE.Group(); g2.name = 'кинорежим: подземный разрез'; api.grp = g2; scene.add(g2);
      const add = geo => { const m = new THREE.Mesh(geo, soilMat); m.castShadow = m.receiveShadow = true; g2.add(m); meshes.push(m); return m; };
      for (const z of [box.zN, box.zS]) { const pts = []; for (let x = box.x0; x <= box.x1 + 1e-6; x += 0.25) pts.push([x, hAt(x, z) + 0.03, z, floorAt(x, z) - 0.3]); add(stripGeo(pts)); }
      // дно: сетка по профилю осей труб
      { const xs = [], zs = []; for (let x = box.x0; x <= box.x1 + 1e-6; x += 0.25) xs.push(x); for (let z = box.zN; z <= box.zS + 1e-6; z += 0.1) zs.push(z);
        const pos = [], top = [], idx = [];
        for (const z of zs) for (const x of xs) { pos.push(x, floorAt(x, z), z); top.push(hAt(x, z)); }
        for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + xs.length; idx.push(a, b, a + 1, b, b + 1, a + 1); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); fg.setIndex(idx); fg.computeVertexNormals();
        add(fg); }
      endW = add(stripGeo(endPts(box.x0))); endE = add(stripGeo(endPts(box.x0)));
      g2.visible = false;
    }
    function dispose() { if (!api.grp) return; scene.remove(api.grp); for (const m of meshes) m.geometry.dispose(); meshes.length = 0; api.grp = null; }
    /* материалы: поверхность вырезается (пересечение 4 плоскостей), подземное — только внутри разреза */
    const saved = new Map(), swaps = []; let ugRoot = null;
    const KEEPY = KEEP.concat([new THREE.Plane(new V3(0, -1, 0), 0)]);   // колодцы — без перекрытий и горловин (выше отметки разреза)
    const um = (c, r, mt, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt, clippingPlanes: o.y ? KEEPY : KEEP, clipShadows: true, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, ...(o.x || {}) });
    const UGM = {
      pv: um(0x3a4d63, 0.42, 0.55), prp: um(0x55603d, 0.48, 0.45), kpd: um(0x5e4c40, 0.6, 0.3),
      cas: um(0xa3a9ae, 0.35, 0.7, { ds: 1, x: { transparent: true, opacity: 0.28, depthWrite: false } }), seal: um(0x1d1f21, 0.8, 0), sand: um(0x8a7550, 1, 0),
      conc: um(0x7c776d, 0.9, 0, { y: 1, ds: 1 }), joint: um(0x5c574f, 0.95, 0, { y: 1, ds: 1 }), rung: um(0x3a3c3e, 0.5, 0.7, { y: 1 })
    };
    function prep() {
      make(); ugRoot = UGN.root;
      const ugSet = new Set(), cutSet = new Set(); ugRoot.traverse(o => ugSet.add(o)); api.grp.traverse(o => cutSet.add(o));
      const surf = new Set(), ug = new Set();
      scene.traverse(o => { if (!o.material || cutSet.has(o) || o === VIS.sky) return; for (const m of [].concat(o.material)) if (m) (ugSet.has(o) ? ug : surf).add(m); });
      for (const m of ug) surf.delete(m);
      for (const m of surf) { if (m === soilMat) continue; saved.set(m, { cp: m.clippingPlanes, ci: m.clipIntersection, cs: m.clipShadows }); m.clippingPlanes = PL; m.clipIntersection = true; m.clipShadows = true; m.needsUpdate = true; }
      for (const m of ug) { saved.set(m, { cp: m.clippingPlanes, ci: m.clipIntersection, cs: m.clipShadows, op: m.opacity, tr: m.transparent, dw: m.depthWrite, em: m.emissiveIntensity, col: m.color && m.color.clone() }); m.clippingPlanes = KEEP; m.clipIntersection = false; m.clipShadows = true; m.needsUpdate = true; }
      // подземное: только сети разреза; материалы — реалистичнее (без свечения), колодцы — непрозрачный бетон
      api.ugVis = { root: ugRoot.visible, cats: Object.fromEntries(Object.entries(UGN.cat).map(([k, g3]) => [k, g3.visible])) };
      for (const [k, g3] of Object.entries(UGN.cat)) g3.visible = ['pv', 'prp', 'kpd', 'wells'].includes(k);
      // материалы подземного — на время показа: сталь в изоляции (В2 — серо-синяя, В10 — оливковая), чугун К3 в стальном футляре, бетон колодцев
      const hex = m => m.color ? m.color.getHex() : -1;
      for (const [k, g3] of Object.entries(UGN.cat)) g3.traverse(o => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const m = o.material; let nm = null;
        if (k === 'pv' || k === 'prp' || k === 'kpd') nm = m.transparent ? UGM.cas : hex(m) === 0x1d1f21 ? UGM.seal : hex(m) === 0xd2bd8a ? UGM.sand : UGM[k];
        else if (k === 'wells') nm = hex(m) === 0x6e6a62 ? UGM.joint : hex(m) === 0x3a3c3e ? UGM.rung : UGM.conc;
        if (nm) { swaps.push([o, m]); o.material = nm; }
      });
      { let mn = 1e9; for (let x = box.x0; x <= box.x1; x += 0.5) for (let z = box.zN; z <= box.zS; z += 0.5) mn = Math.min(mn, hAt(x, z)); KEEPY[4].constant = mn - 1.45; api.yCut = mn - 1.45; }
      api.uTick = UGN.tick; UGN.tick = () => {};
      ugRoot.visible = false;
    }
    function unprep() {
      for (const [o, m] of swaps) o.material = m; swaps.length = 0;
      for (const [m, s] of saved) { m.clippingPlanes = s.cp; m.clipIntersection = s.ci; m.clipShadows = s.cs; if ('op' in s) { m.opacity = s.op; m.transparent = s.tr; m.depthWrite = s.dw; if (s.em !== undefined) m.emissiveIntensity = s.em; } m.needsUpdate = true; }
      saved.clear();
      if (api.ugVis) { for (const [k, v] of Object.entries(api.ugVis.cats)) UGN.cat[k].visible = v; ugRoot.visible = api.ugVis.root; api.ugVis = null; }
      if (api.uTick) { UGN.tick = api.uTick; api.uTick = null; }
      dispose();
    }
    /* k: 0…1 — доля открытой длины (разрез раскрывается от середины к торцам) */
    function set(k) {
      api.k = k;
      const on = k > 0.002, cx = (box.x0 + box.x1) / 2, hw = (box.x1 - box.x0) / 2 * k;
      api.x0 = on ? cx - hw : 1e5; api.x1 = on ? cx + hw : -1e5;
      PL[0].constant = on ? api.x0 : 1e5; PL[1].constant = on ? -api.x1 : -1e5; PL[2].constant = box.zN; PL[3].constant = -box.zS; PL[4].constant = -1e5;
      KEEP[0].constant = on ? -(api.x0 - 0.25) : -1e5; KEEP[1].constant = on ? api.x1 + 0.25 : -1e5; KEEP[2].constant = -box.zN + 0.25; KEEP[3].constant = box.zS + 0.25;
      if (api.yCut !== undefined) KEEPY[4].constant = api.yCut;
      KEEPX[0].constant = -(api.x0 - 0.03); KEEPX[1].constant = api.x1 + 0.03;
      if (api.grp) {
        api.grp.visible = on; if (ugRoot) ugRoot.visible = on;
        if (on) for (const [m, x] of [[endW, api.x0], [endE, api.x1]]) { const g3 = stripGeo(endPts(x)); m.geometry.dispose(); m.geometry = g3; }
      }
    }
    /* v0.39: «рост из плана» — над отметкой h поверхность не рисуется (по всей сцене); keepAll — подземное целиком (для «рентгена») */
    function grow(h) { PL[0].constant = -1e5; PL[1].constant = -1e5; PL[2].constant = -1e5; PL[3].constant = -1e5; PL[4].constant = h; }
    function keepAll(on) {
      if (on) { for (let i = 0; i < 4; i++) KEEP[i].constant = 1e5; KEEPY[4].constant = 1e5; return; }
      KEEP[0].constant = -(api.x0 - 0.25); KEEP[1].constant = api.x1 + 0.25; KEEP[2].constant = -box.zN + 0.25; KEEP[3].constant = box.zS + 0.25;
      if (api.yCut !== undefined) KEEPY[4].constant = api.yCut;
    }
    Object.assign(api, { prep, unprep, set, grow, keepAll, soilMat });
    return api;
  })();

  /* ---------- 10. Продукт в трубе: освещённая жидкость (янтарный ДТ), рябь, отражение неба, блик солнца ---------- */
  let LIQ = null;
  function liqMat() {
    if (LIQ) return LIQ;
    LIQ = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uSun: { value: VIS.SUN }, uSunC: { value: new THREE.Color(LOOK.sunCol).multiplyScalar(LOOK.sunI * 0.32) } },
      vertexShader: `attribute float aT; attribute float aS; attribute float aU; attribute vec3 aC; attribute float aK;
        varying float vT; varying float vS; varying float vU; varying float vK; varying vec3 vN; varying vec3 vP;
        void main(){ vT = aT; vS = aS; vU = aU; vK = aK; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: 'uniform float uT; uniform vec3 uSun; uniform vec3 uSunC; const float uDisc = 0.0; const float uCloud = 0.0;\n' + SKY_GLSL + `
        varying float vT; varying float vS; varying float vU; varying float vK; varying vec3 vN; varying vec3 vP;
        float hh(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
        float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          if (vK > 0.5 && vK < 1.5 && fract(vS * 2.2) > 0.55) discard;
          float ph = (vT - uT) * 3.0;                                   // фаза потока (м при v ≈ 3 м/с), рисунок идёт с местной скоростью
          vec2 q = vec2(ph, vU * 2.6);
          float h = nn(q * vec2(1.3, 2.2)) * 0.6 + nn(q * vec2(3.1, 4.6) + 3.7) * 0.3 + nn(q * vec2(6.5, 9.0) + 1.3) * 0.1;
          vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
          vec3 dpx = dFdx(vP), dpy = dFdy(vP); float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
          vec3 Nb = normalize(abs(det) * N - 0.05 * sign(det) * (dhx * r1 + dhy * r2));
          float ndv = clamp(dot(Nb, V), 0.0, 1.0), F = 0.06 + 0.94 * pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, Nb), sky = skyBase(normalize(vec3(R.x, abs(R.y), R.z))) * (R.y < 0.0 ? 0.35 : 1.0);
          float dif = max(dot(Nb, uSun), 0.0);
          float hl = nn(q * vec2(0.5, 1.0) + 7.1);
          vec3 body = mix(vec3(0.40, 0.21, 0.04), vec3(0.55, 0.31, 0.07), hl);         // янтарный ДТ (без «прожилок»)
          vec3 col = body * (0.22 + 0.55 * dif) * (uSunC * 0.9 + 0.35);
          col += body * vec3(1.0, 0.75, 0.35) * pow(max(dot(-V, uSun), 0.0), 3.0) * 0.4; // просвет на солнце
          col = mix(col, sky * 1.1, clamp(F, 0.0, 0.9));
          col += uSunC * pow(max(dot(R, uSun), 0.0), 220.0) * 6.0;                       // блик
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    return LIQ;
  }
  function flowLook(on) {
    const PF = window.__PFLOW; if (!PF || !procSim.flowGrp) return;
    if (on) { const lm = liqMat(); for (const c of procSim.flowGrp.children) if (c.material === PF.flowMat) c.material = lm; LIQ.uniforms.uT.value = PF.flowMat.uniforms.uT.value; }
    else { for (const c of procSim.flowGrp.children) if (c.material === LIQ) c.material = PF.flowMat; }
  }
  /* кромка разреза трубы — сталь (вместо оранжевой условной кромки) — только на время показа */
  function cutEdgeLook(on) {
    const S = st.saved;
    if (on) {
      S.cutEdge = [];
      scene.traverse(o => { const m = o.material; if (!m || Array.isArray(m) || !m.customProgramCacheKey || S.cutEdge.some(e => e[0] === m)) return;
        let k = ''; try { k = m.customProgramCacheKey(); } catch (e) { } if (!k.includes('pflowcut')) return;
        const ob = m.onBeforeCompile, ck = m.customProgramCacheKey;
        S.cutEdge.push([m, ob, ck]);
        m.onBeforeCompile = (sh, r) => { ob.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('mix(gl_FragColor.rgb, vec3(0.93, 0.38, 0.08), 0.6)', 'mix(gl_FragColor.rgb, vec3(0.62, 0.63, 0.64), 0.55)').replace('gl_FragColor.rgb *= 0.42;', 'gl_FragColor.rgb *= 0.55;'); };
        m.customProgramCacheKey = () => ck.call(m) + '|cine' + VER;
        m.needsUpdate = true; });
    } else if (S.cutEdge) { for (const [m, ob, ck] of S.cutEdge) { m.onBeforeCompile = ob; m.customProgramCacheKey = ck; m.needsUpdate = true; } S.cutEdge = null; }
  }
  function hideMarkers() { if (procSim.flowGrp) for (const c of procSim.flowGrp.children) if (c.isInstancedMesh && c.name === 'направление потока') c.visible = false; }

  /* ---------- 11. Пост-обработка: размытие движения камеры, растворение, цветокоррекция, титры ---------- */
  let rtA = null, rtB = null, rtX = null, rtL = null, lin = null, post = null, ovl = null;
  function mkRT() {
    const r = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    r.depthTexture = new THREE.DepthTexture(4, 4); r.depthTexture.type = THREE.FloatType;   // 32F: точная реконструкция положения (размытие, «чертёж», «рентген»)
    return r;
  }
  function pipeline(on) {
    if (on && !rtA) {
      rtA = mkRT(); rtB = mkRT(); rtX = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      /* положения точек кадра (относительно камеры) — отдельный проход с highp-выборкой глубины: в основном шейдере выборка глубины идёт с половинной точностью */
      rtL = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      { const m = new THREE.ShaderMaterial({ uniforms: { d: { value: rtA.depthTexture }, iA: { value: new THREE.Matrix4() }, uCam: { value: new V3() } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
          fragmentShader: 'uniform highp sampler2D d; uniform mat4 iA; uniform vec3 uCam; varying vec2 vUv; void main(){ highp float z = texture2D(d, vUv).r; vec4 w = iA * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); gl_FragColor = vec4(w.xyz / w.w - uCam, z > 0.99999 ? 1.0 : 0.0); }',
          depthTest: false, depthWrite: false });
        const sc = new THREE.Scene(), g = new THREE.PlaneGeometry(2, 2); sc.add(new THREE.Mesh(g, m)); lin = { m, sc, g }; }
      const c = document.createElement('canvas'); c.width = OUT.w; c.height = OUT.h;
      const tex = new THREE.CanvasTexture(c); tex.premultiplyAlpha = true; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.NoColorSpace;
      ovl = { c, x: c.getContext('2d'), tex, key: '' };
      const mat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
          tA: { value: rtA.texture }, dA: { value: rtA.depthTexture }, tB: { value: rtB.texture }, dB: { value: rtB.depthTexture }, tO: { value: tex },
          iA: { value: new THREE.Matrix4() }, pA: { value: new THREE.Matrix4() }, iB: { value: new THREE.Matrix4() }, pB: { value: new THREE.Matrix4() },
          uMix: { value: 0 }, uMB: { value: 0.5 }, uExp: { value: LOOK.exp }, uSat: { value: 1.06 }, uCon: { value: 1.09 }, uVig: { value: 0.16 }, uFade: { value: 1 }, uAsp: { value: ASP() }, uTY: { value: FMT === 'h' ? new THREE.Vector4(0.06, 0.1, 0.34, 0.4) : new THREE.Vector4(0.74, 0.8, 0.93, 0.97) }, uSeed: { value: 0 }, uPx: { value: new THREE.Vector2(1 / OUT.w, 1 / OUT.h) },
          tX: { value: rtX.texture }, tL: { value: rtL.texture }, uCam: { value: new V3() }, uBP: { value: 0 }, uGH: { value: 0 }, uGK: { value: 0 }, uXR: { value: 0 }, uSX: { value: 0 }, uSkyD: { value: 0 }
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tA, dA, tB, dB, tO, tX, tL; uniform mat4 iA, pA, iB, pB; uniform float uMix, uMB, uExp, uSat, uCon, uVig, uFade, uAsp, uSeed; uniform vec2 uPx; varying vec2 vUv;
          uniform vec3 uCam; uniform float uBP, uGH, uGK, uXR, uSX, uSkyD; uniform vec4 uTY;
          vec3 wposA(vec2 uv){ return uCam + texture2D(tL, uv).xyz; }
          float edgeA(vec2 uv, float dc, float k){   // кромки по глубине (вторая производная расстояния); k — чувствительность
            vec2 o = uPx * 1.5;
            float dl = length(wposA(uv - vec2(o.x, 0.0)) - uCam), dr = length(wposA(uv + vec2(o.x, 0.0)) - uCam);
            float du = length(wposA(uv + vec2(0.0, o.y)) - uCam), dd = length(wposA(uv - vec2(0.0, o.y)) - uCam);
            return smoothstep(0.006 * k, 0.03 * k, (abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc)) / max(dc, 0.5));
          }
          float lumE(vec2 uv){   // кромки по яркости (линии «чертежа» на плоских элементах)
            vec2 o = uPx * 1.2; const vec3 W = vec3(0.2126, 0.7152, 0.0722);
            float a = log(dot(texture2D(tA, uv - vec2(o.x, 0.0)).rgb, W) + 0.03), b = log(dot(texture2D(tA, uv + vec2(o.x, 0.0)).rgb, W) + 0.03);
            float c = log(dot(texture2D(tA, uv - vec2(0.0, o.y)).rgb, W) + 0.03), d = log(dot(texture2D(tA, uv + vec2(0.0, o.y)).rgb, W) + 0.03);
            return smoothstep(0.14, 0.4, abs(a - b) + abs(c - d));
          }
          float gridL(vec2 p, float s, float w){ vec2 q = p / s, g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-5)); return (1.0 - clamp(min(g.x, g.y) / w, 0.0, 1.0)) * (1.0 - smoothstep(0.25, 0.6, max(fwidth(q).x, fwidth(q).y))); }
          vec2 vel(sampler2D D, mat4 inv, mat4 prev, vec2 uv){
            float d = texture2D(D, uv).r;
            vec4 w = inv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); w /= w.w;
            vec4 p = prev * w; vec2 puv = p.xy / p.w * 0.5 + 0.5;
            vec2 v = (uv - puv) * uMB;
            float L = length(v / uPx); if (L > 36.0) v *= 36.0 / L;          // не более 36 пикс
            return v;
          }
          vec3 blur(sampler2D C, sampler2D D, mat4 inv, mat4 prev, vec2 uv){
            vec2 v = vel(D, inv, prev, uv);
            if (length(v / uPx) < 0.6) return texture2D(C, uv).rgb;
            vec3 s = vec3(0.0); float ws = 0.0;
            for (int i = 0; i < 12; i++) { float k = float(i) / 11.0 - 0.5; float w = 1.0 - abs(k) * 0.6; s += texture2D(C, uv + v * k).rgb * w; ws += w; }
            return s / ws;
          }
          vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
          vec3 aces(vec3 c){
            const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
            const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
            return clamp(O * rrt(I * c), 0.0, 1.0); }
          float srgb(float c){ return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
          void main(){
            vec3 h = blur(tA, dA, iA, pA, vUv);
            if (uMix > 0.0) h = mix(h, blur(tB, dB, iB, pB, vUv), uMix);
            if (uBP > 0.001 || uXR > 0.5 || uGK > 0.5) {   // v0.39: «чертёж», фронт роста, «рентген»
              bool sky = texture2D(tL, vUv).a > 0.5;
              vec3 P = wposA(vUv); float dc = length(P - uCam);
              float e = (uBP > 0.001 || uXR > 0.5) ? edgeA(vUv, dc, uBP > 0.001 ? 0.35 : 1.0) : 0.0;
              if (uBP > 0.001) e = max(e, lumE(vUv) * 0.55);
              float lum = dot(h, vec3(0.2126, 0.7152, 0.0722));
              if (uGK > 0.5 && !sky) h += vec3(0.35, 0.8, 1.7) * exp(-abs(P.y - uGH) * 5.0) * 1.4;
              if (uBP > 0.001) {
                float gr = sky ? 0.0 : (gridL(P.xz, 10.0, 1.1) * 0.9 + gridL(P.xz, 2.0, 0.8) * 0.22) * step(P.y, 2.5);
                float ttl = 1.0 - 0.6 * smoothstep(uTY.x, uTY.y, vUv.y) * (1.0 - smoothstep(uTY.z, uTY.w, vUv.y));   // зона титра — линии приглушены
                vec3 bp = vec3(0.012, 0.05, 0.13) + vec3(0.06, 0.15, 0.32) * min(lum, 1.5) * 0.55 + (vec3(0.25, 0.55, 1.0) * gr * 0.45 + vec3(0.8, 0.92, 1.0) * e * 1.3) * ttl;
                if (sky) bp = vec3(0.01, 0.04, 0.1) + vec3(0.8, 0.92, 1.0) * e;
                h = mix(h, bp, uBP);
              }
              if (uXR > 0.5) {
                float inX = sky ? 0.0 : 1.0 - smoothstep(uSX - 0.4, uSX + 0.4, P.x);
                vec3 holo = vec3(0.01, 0.035, 0.085) + vec3(0.05, 0.13, 0.28) * min(lum, 2.0) * 0.7 + vec3(0.3, 0.7, 1.4) * e;
                h = mix(h, holo, inX * 0.92);
                if (sky) h *= 1.0 - uSkyD;
                vec4 xo = texture2D(tX, vUv);
                h = mix(h, xo.rgb * 1.5, clamp(xo.a, 0.0, 1.0) * inX);
                if (!sky) h += vec3(0.5, 1.1, 2.4) * exp(-abs(P.x - uSX) * 2.2) * 1.6;
                vec3 rd = normalize(P - uCam);
                if (abs(rd.x) > 1e-4) { float tt = (uSX - uCam.x) / rd.x; if (tt > 0.0 && tt < dc) { vec3 hp = uCam + rd * tt;
                  float sh = (1.0 - smoothstep(0.0, 55.0, hp.y)) * step(-2.0, hp.y) * (1.0 - smoothstep(55.0, 80.0, abs(hp.z - 3.0))); h += vec3(0.12, 0.35, 0.85) * sh * 0.45; } }
              }
            }
            vec3 c = aces(h * uExp / 0.6);
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, uSat);
            c *= mix(vec3(0.99, 1.0, 1.015), vec3(1.035, 1.0, 0.96), smoothstep(0.1, 0.75, l));   // нейтральные тени, тёплые света
            vec3 s = vec3(srgb(c.r), srgb(c.g), srgb(c.b));
            s = clamp((s - 0.5) * uCon + 0.5 + 0.012, 0.0, 1.0);
            vec2 d = (vUv - 0.5) * vec2(uAsp, 1.0); s *= 1.0 - uVig * smoothstep(0.35, 0.8, length(d) * 1.35);
            vec4 o = texture2D(tO, vUv); s = s * (1.0 - o.a) + o.rgb;
            s *= uFade;
            s += (fract(sin(dot(gl_FragCoord.xy + uSeed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
            gl_FragColor = vec4(s, 1.0);
          }`
      });
      const g2 = new THREE.PlaneGeometry(2, 2), sc = new THREE.Scene(); sc.add(new THREE.Mesh(g2, mat));
      post = { sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat, g: g2 };
    } else if (!on && rtA) {
      for (const r of [rtA, rtB]) { r.depthTexture.dispose(); r.dispose(); }
      rtX.dispose(); rtX = null; rtL.dispose(); lin.m.dispose(); lin.g.dispose(); rtL = lin = null;
      ovl.tex.dispose(); post.mat.dispose(); post.g.dispose(); rtA = rtB = post = ovl = null;
    }
  }
  /* титры: тонкие подписи сцен (верхняя треть — вне зоны интерфейса Instagram), финальный титр */
  const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  function drawOverlay(t) {
    const sc = SCENES.find(s => t >= s.t0 && t < s.t1) || SCENES[SCENES.length - 1];
    let a = 0;
    if (st.titles) a = sc.fin ? ramp(t, sc.tin[0], sc.tin[1]) : sc.w ? win(t, ...sc.w) : win(t, sc.t0 + (sc.t0 ? 0.7 : 0.6), sc.t0 + (sc.t0 ? 1.4 : 1.5), sc.t1 - 1.3, sc.t1 - 0.5);
    const key = st.titles ? sc.id + ':' + Math.round(a * 60) + (st.logo ? ':L' : '') : 'off';
    if (key === ovl.key) return; ovl.key = key;
    const x = ovl.x, W = ovl.c.width, HH = ovl.c.height, L = FMT === 'h'; x.clearRect(0, 0, W, HH);
    if (a > 0.003) {
      x.save(); x.globalAlpha = a;
      if (sc.fin) {
        const gh = L ? HH : 980, gr = x.createLinearGradient(0, 0, 0, gh); gr.addColorStop(0, 'rgba(8,16,28,0.55)'); gr.addColorStop(0.7, 'rgba(8,16,28,0.18)'); gr.addColorStop(1, 'rgba(8,16,28,0)');
        x.fillStyle = gr; x.fillRect(0, 0, W, gh);
        x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 16; x.shadowOffsetY = 2;
        let y = (L ? 360 : 330) + (1 - a) * 18;
        if (st.logo) { const im = st.logo, k = Math.min(420 / im.width, 160 / im.height), lh = im.height * k; x.drawImage(im, (W - im.width * k) / 2, y - 70, im.width * k, lh); y += lh + 10; }
        x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,0.82)'; x.font = `500 29px ${FONT}`; x.fillText(TXT.org, W / 2, y);
        fitText(x, TXT.finalA, W / 2, y + 86, 940, 60, '700', '3px', '#fff');
        fitText(x, TXT.finalB, W / 2, y + 150, 860, 42, '600', '10px', '#7cc8ff'); x.letterSpacing = '0px';
        x.shadowBlur = 0; x.fillStyle = 'rgba(124,200,255,0.95)'; x.fillRect(W / 2 - 60, y + 186, 120, 3); x.shadowBlur = 16;
        x.fillStyle = 'rgba(255,255,255,0.95)'; x.font = `500 35px ${FONT}`; x.fillText(TXT.finalC, W / 2, y + 246);
        x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = `400 29px ${FONT}`; x.fillText(TXT.finalD, W / 2, y + 292);
      } else {
        if (L) { const gr = x.createLinearGradient(0, HH - 560, 0, HH); gr.addColorStop(0, 'rgba(6,14,24,0)'); gr.addColorStop(1, 'rgba(6,14,24,0.5)'); x.fillStyle = gr; x.fillRect(0, HH - 560, W * 0.62, 560); }
        else { const gr = x.createLinearGradient(0, 0, 0, 620); gr.addColorStop(0, 'rgba(6,14,24,0)'); gr.addColorStop(0.42, 'rgba(6,14,24,0.30)'); gr.addColorStop(1, 'rgba(6,14,24,0)');
          x.fillStyle = gr; x.fillRect(0, 0, W, 620); }
        x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 12; x.shadowOffsetY = 2;
        const X0 = L ? 110 : 76, Y0 = (L ? HH - (sc.n ? 300 : 230) : 300) + (1 - a) * 14, TW = L ? 900 : W - X0 - 120;   // 16:9 — титр в нижней левой трети
        x.textAlign = 'left';
        if (sc.top) { x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = `600 25px ${FONT}`; x.letterSpacing = '3px'; x.fillText(sc.top.toUpperCase(), X0 + 26, Y0 - 58); x.letterSpacing = '0px'; }
        x.fillStyle = '#fff'; x.font = `700 50px ${FONT}`; x.fillText(sc.a, X0 + 26, Y0);
        x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = `400 30px ${FONT}`; const nl = wrap(x, sc.b, X0 + 26, Y0 + 48, TW, 36);
        let yb = Y0 + 48 + (nl - 1) * 36;
        if (sc.n) { x.fillStyle = 'rgba(255,255,255,0.72)'; x.font = `italic 400 24px ${FONT}`; yb += 40; wrap(x, sc.n, X0 + 26, yb, TW, 29); }
        x.shadowBlur = 0; x.fillStyle = '#3aa6ff'; x.fillRect(X0, Y0 - 42, 5, yb - Y0 + 52);
      }
      x.restore();
    }
    ovl.tex.needsUpdate = true;
  }
  function fitText(x, s, X, Y, maxW, px, wt, ls, col) {
    x.letterSpacing = ls; let k = px;
    do { x.font = `${wt} ${k}px ${FONT}`; if (x.measureText(s).width <= maxW) break; k -= 2; } while (k > 20);
    x.fillStyle = col; x.fillText(s, X, Y);
  }
  function wrap(x, s, X, Y, w, lh) {
    const ws = s.split(' '); let line = '', y = Y, n = 1;
    for (const word of ws) { const tst = line ? line + ' ' + word : word; if (x.measureText(tst).width > w && line) { x.fillText(line, X, y); line = word; y += lh; n++; } else line = tst; }
    if (line) x.fillText(line, X, y);
    return n;
  }

  /* ---------- 12. Состояние сцены по времени ---------- */
  /* «Экшн»: замедление модельного времени (поток, АСН-80, струя) — [вход, полное, выход, конец, коэффициент]; камера идёт по своему времени */
  const WS = [[18.6, 18.9, 20.5, 20.8, 0.25], [24.5, 24.8, 26.2, 26.5, 0.3], [45.2, 45.5, 48.8, 49.2, 0.3]];
  /* v0.40: на облёте (2–18 с) модельное время идёт ×0,375 — к 18 с проходит столько же, сколько в v0.39 к 8 с (стык с готовыми кадрами); tOld — время v0.39 для неба и вибрации камеры */
  const tOld = t => t;   // v0.41: фильм рендерится целиком — привязка ко времени v0.39 не нужна
  function ws(t) { if (PROG !== 'action') return 1; let k = 1; for (const [a, b, c, d, v] of WS) { const w = win(t, a, b, c, d); if (w > 0) k = Math.min(k, 1 - (1 - v) * w); } return k; }
  function wsInt(a, b) { let s = 0; const n = Math.max(1, Math.ceil((b - a) / 0.01)), h = (b - a) / n; for (let i = 0; i < n; i++) s += ws(a + (i + 0.5) * h) * h; return s; }   // модельные секунды за интервал
  const ACT = { grow: [1.0, 2.8], gH0: 1.6, gH1: 40, scan: [28.6, 31.4, 34.0, 35.5], sx0: -112, sx1: 102, aim: [43.6, 51.5], water: [45.0, 50.4], tower: '800.1', car: 1, tags: [17.0, 21.4], cut: [35.6, 37.0, 42.6, 43.6], light: [37.8, 38.6, 41.2, 41.8] };
  function actionState(t) {
    const g = ramp(t, ACT.grow[0], ACT.grow[1]), gE = 1 - (1 - g) * (1 - g);
    const [s0, s1, s2, s3] = ACT.scan, sk = t < s2 ? ramp(t, s0, s1) : 1 - ramp(t, s2, s3), xr = t > s0 - 0.05 && t < s3 + 0.05;
    return {
      cut: ramp(t, ACT.cut[0], ACT.cut[1]) * (1 - ramp(t, ACT.cut[2], ACT.cut[3])), light: win(t, ...ACT.light), fade: 1, mix: 0,
      bp: Math.min(1, 1 - ramp(t, 2.3, 3.6) + 0.85 * ramp(t, 60.6, 62)),
      grow: t < 2.9 ? ACT.gH0 + (ACT.gH1 - ACT.gH0) * gE : null, gk: t > 0.9 && t < 2.9 ? 1 : 0,
      xr: xr ? 1 : 0, sx: ACT.sx0 + (ACT.sx1 - ACT.sx0) * sk, skyD: 0.55 * win(t, s0, s0 + 0.6, s3 - 0.6, s3),
      aim: t >= ACT.aim[0] && t < ACT.aim[1], water: t >= ACT.water[0] && t < ACT.water[1],
      front: t >= ACT.water[0] ? wsInt(ACT.water[0], Math.min(t, ACT.water[1])) : 0,
      tagsOff: t > ACT.tags[0] && t < ACT.tags[1]
    };
  }
  function stateAt(t) {
    if (PROG === 'action') return actionState(t);
    return {
      cut: ramp(t, 28.7, 30.3) * (1 - ramp(t, 38.4, 39.4)),
      light: win(t, 30.4, 31.6, 35.2, 36.4),
      fade: 1,
      mix: t <= XF.t0 || t >= XF.t1 ? 0 : sm((t - XF.t0) / (XF.t1 - XF.t0))
    };
  }
  function routeKeep(now) {
    const p = st.plan && st.plan.pump; if (!p) return;
    const L = procLogic;
    if (!L.st.pump[p] && now - (st.pumpTry || 0) > 350) { st.pumpTry = now; if (L.canStart(p).ok && L.setPump(p, true)) procSim.setTask(p, 0); }
  }
  function applyState(t, now) {
    const s = stateAt(t);
    if (s.grow !== null && s.grow !== undefined) CUT.grow(s.grow); else CUT.set(s.cut);
    if (PROG === 'action') { CUT.keepAll(!!s.xr); towerState(s); }
    for (const l of st.lights) l.intensity = 6 * s.light;
    const tagsOff = PROG === 'action' ? s.tagsOff : t > 36.6 && t < 44.2;
    if (PIPED.tags) PIPED.tags.visible = !tagsOff && st.saved.tagsVis;   // маркировочные кольца над разрезом трубы — скрыты на крупном плане
    const p = st.plan && st.plan.pump, run = !!(p && procLogic.st.pump[p] && procSim.S.flows.length);
    procSim.S.speed = run ? 1 : 60;
    routeKeep(now);
    if (post) { const u = post.mat.uniforms; u.uFade.value = s.fade; u.uSeed.value = (t * 37.1) % 100; u.uMix.value = s.mix; u.uMB.value = st.mb ? 0.45 : 0;
      u.uBP.value = s.bp || 0; u.uGK.value = s.gk || 0; u.uGH.value = s.grow || 0; u.uXR.value = s.xr || 0; u.uSX.value = s.sx || 0; u.uSkyD.value = s.skyD || 0; }
    st.state = s;
  }

  /* ---------- 12б. Лафетный ствол 800.1 (F24): наведение на ВЦ, подача воды; струя «в кадре» — нарастающий фронт, водяная пыль ---------- */
  function towerState(s) {
    if (typeof F24 === 'undefined' || !F24.towers) return;
    const T = F24.towers[ACT.tower]; if (!T) return;
    if (s.aim && T.aim !== ACT.car) F24.aimTower(ACT.tower, ACT.car);
    else if (!s.aim && T.aim >= 0) F24.aimTower(ACT.tower, -1);
    if (s.aim && T.water !== s.water) F24.setWater(ACT.tower, s.water);
    st.jetFront = s.front;
  }
  let JETM = null, MIST = null;
  function jetLook(T) {
    if (!T || !T.jet) { if (MIST) MIST.visible = false; return; }
    const m = T.jet.m;
    if (!JETM) {
      const o = m.material;
      JETM = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uT: o.uniforms.uT, uF: { value: 1 }, uSun: { value: VIS.SUN } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: `uniform float uT, uF; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          float h(float n){ return fract(sin(n) * 43758.5453); }
          float n1(float x){ float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
          void main(){
            float u = vUv.x; if (u > uF) discard;
            float lane = vUv.y * 26.0, li = floor(lane);
            float fib = n1(u * 22.0 - uT * 9.0 + li * 7.31) * 0.65 + n1(u * 57.0 - uT * 15.0 + li * 3.73 + 11.0) * 0.35;   // продольные струйки
            float streak = smoothstep(0.32, 0.85, fib);
            float clump = n1(u * 8.0 - uT * 4.5 + 2.0);                          // распад на «пакеты» к концу траектории
            float fr = pow(abs(dot(normalize(vN), vV)), 1.25);                   // мягкие края: плотнее по оси
            float core = mix(0.85, 0.1, smoothstep(0.0, 0.8, u));
            float a = core * fr * mix(0.95, 0.2 + 0.95 * streak, smoothstep(0.04, 0.45, u)) * mix(1.0, 0.35 + 0.9 * clump, smoothstep(0.3, 0.9, u));
            a *= smoothstep(0.0, 0.015, u) * (1.0 - smoothstep(0.88, 1.0, u));
            if (uF < 0.999) a *= smoothstep(0.0, 0.04 + 0.07 * n1(li * 1.7 + uT * 3.0), uF - u);   // рваный фронт
            float br = streak;
            float lit = 0.6 + 0.5 * max(dot(normalize(vN), uSun), 0.0);
            vec3 c = vec3(0.84, 0.92, 0.98) * lit * (0.85 + 0.3 * br) + vec3(1.0) * pow(max(dot(reflect(-uSun, normalize(vN)), vV), 0.0), 24.0) * 0.6;
            gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));
          }`
      });
      JETM.userData.orig = o;
    }
    if (m.material !== JETM) { JETM.userData.orig = m.material; m.material = JETM; }
    // фронт струи: время полёта по баллистике (как в F24), доля пройденной траектории
    const tEnd = T.sol ? T.sol.d / Math.max(1, T.sol.v * Math.cos(T.sol.pitch)) : 1.1, fr = clamp((st.jetFront || 0) / tEnd, 0, 1);
    JETM.uniforms.uF.value = fr < 0.999 ? Math.max(0.002, fr) : 1.001;
    T.jet.sp.visible = fr > 0.97;
    mist(T, fr);
  }
  /* водяная пыль вдоль струи и брызги у цели (учебная визуализация); частицы — на ЦП, 1 обращение к GPU */
  function mist(T, fr) {
    const N = 2600;
    if (!MIST) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPH: { value: 1600 } },
        vertexShader: 'uniform float uPH; attribute float aA; attribute float aS; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aS * uPH / -mv.z, 1.0, 64.0); }',
        fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(0.92, 0.96, 1.0, vA * (1.0 - r * 4.0)); }' });
      MIST = new THREE.Points(g, m); MIST.frustumCulled = false; MIST.renderOrder = 4; MIST.name = 'кинорежим: водяная пыль'; scene.add(MIST);
      let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      MIST.userData.r = Array.from({ length: N }, (_, i) => ({ u: rnd(), a: rnd() * 6.283, m: rnd(), ph: rnd(), sp: i >= 1800, cl: i >= 2300, v: [rnd() * 2 - 1, rnd(), rnd() * 2 - 1] }));
    }
    MIST.visible = true; MIST.material.uniforms.uPH.value = cv.height * 0.85;
    const geo = T.jet.m.geometry, P = geo.attributes.position, R = 10, NR = P.count / R, pos = MIST.geometry.attributes.position.array, al = MIST.geometry.attributes.aA.array, sz = MIST.geometry.attributes.aS.array;
    const tw = st.jetFront || 0, ring = (i, o) => { o.set(0, 0, 0); for (let j = 0; j < R; j++) o.x += P.getX(i * R + j), o.y += P.getY(i * R + j), o.z += P.getZ(i * R + j); return o.multiplyScalar(1 / R); };
    const end = ring(NR - 1, _mE), c = _mC;
    MIST.userData.r.forEach((q, i) => {
      if (!q.sp) {   // пыль вдоль струи: дрейф наружу и вниз, растёт к концу
        const ph = (q.ph + tw * 0.9) % 1, u = q.u, ii = Math.min(NR - 2, Math.floor(u * (NR - 1)));
        ring(ii, c); const rad = 0.06 + 0.75 * u * u + ph * (0.25 + 0.9 * u), sn = Math.sin(q.a), cs = Math.cos(q.a);
        pos[i * 3] = c.x + cs * rad; pos[i * 3 + 1] = c.y + sn * rad * 0.7 - ph * ph * 0.8 * u; pos[i * 3 + 2] = c.z + sn * rad * 0.6;
        al[i] = u < fr ? 0.16 * (1 - ph) * smoothstepJ(0.08, 0.35, u) : 0; sz[i] = 0.018 + 0.045 * u + ph * 0.05;
      } else if (q.cl) {   // облако водяной пыли у места удара: медленно поднимается и расходится
        const ph = (q.ph + tw * 0.35) % 1, r = 0.4 + 2.2 * ph * q.m;
        pos[i * 3] = end.x + Math.cos(q.a) * r; pos[i * 3 + 1] = end.y - 0.3 + q.v[1] * 1.2 + ph * 0.9; pos[i * 3 + 2] = end.z + Math.sin(q.a) * r;
        al[i] = fr > 0.98 ? 0.055 * Math.sin(Math.PI * ph) : 0; sz[i] = 0.35 + 0.5 * q.m;
      } else {       // брызги у цели: баллистика от точки удара
        const ph = (q.ph + tw * 1.4) % 1, tt = ph * 0.9, v = q.v;
        pos[i * 3] = end.x + v[0] * 2.6 * tt; pos[i * 3 + 1] = end.y + (1.2 + 2.4 * v[1]) * tt - 4.9 * tt * tt; pos[i * 3 + 2] = end.z + v[2] * 2.6 * tt;
        al[i] = fr > 0.98 ? 0.32 * (1 - ph) : 0; sz[i] = 0.01 + 0.03 * q.m;
      }
    });
    MIST.geometry.attributes.position.needsUpdate = true; MIST.geometry.attributes.aA.needsUpdate = true; MIST.geometry.attributes.aS.needsUpdate = true;
  }
  const _mE = new V3(), _mC = new V3(), smoothstepJ = (a, b, x) => sm((x - a) / (b - a));
  function towerSave() { st.saved.f24 = (typeof F24 !== 'undefined' && F24.state) ? F24.state.towers : null; }
  function towerRestore() {
    const T0 = typeof F24 !== 'undefined' && F24.towers; if (!T0) return;
    for (const T of Object.values(T0)) if (T.jet && JETM && T.jet.m.material === JETM) T.jet.m.material = JETM.userData.orig;
    const S = st.saved.f24; if (!S) return;
    for (const [id, s] of Object.entries(S)) {
      const T = T0[id]; if (!T) continue;
      if (s.aim >= 0) F24.aimTower(id, s.aim); else F24.aimTower(id, -1);
      T.water = !!s.water; T.yaw = T.tYaw = s.yaw; T.pitch = T.tPitch = s.pitch; T.yawG.rotation.y = s.yaw; T.pitchG.rotation.x = -s.pitch; T.dirty = true;
    }
    if (T0[ACT.tower] && T0[ACT.tower].jet) T0[ACT.tower].jet.sp.visible = true;
    if (MIST) { scene.remove(MIST); MIST.geometry.dispose(); MIST.material.dispose(); MIST = null; }
  }

  /* ---------- 12в. «Рентген»: второй проход — уровни в резервуарах, потоки, подземные сети (слой 2) поверх кадра ---------- */
  const XL = 2, XCATS = ['pv', 'prp', 'water', 'kpd', 'k1', 'heat', 'tech', 'cab'];   // трубопроводы и кабели; колодцы, подземные ёмкости и грунт — не показываются
  function renderX(cam) {
    const ug = UGN.root, h = hemi();
    const keep = { bg: scene.background, sunI: sun.intensity, hI: h ? h.intensity : 0, au: renderer.shadowMap.autoUpdate, nu: renderer.shadowMap.needsUpdate, ugv: ug.visible, cats: {}, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha() };
    for (const k in UGN.cat) { keep.cats[k] = UGN.cat[k].visible; UGN.cat[k].visible = XCATS.includes(k); }
    const em = new Map();   // сети — со свечением цвета категории (на время прохода)
    for (const k of XCATS) if (UGN.cat[k]) UGN.cat[k].traverse(o => { const m = o.isMesh && o.material; if (m && m.emissive && !em.has(m)) { em.set(m, [m.emissive.clone(), m.emissiveIntensity]); m.emissive.copy(m.color).multiplyScalar(0.55); m.emissiveIntensity = 1; } });
    ug.visible = true;
    for (const g of [ug, procSim.liqGrp, procSim.flowGrp]) if (g) g.traverse(o => o.layers.enable(XL));
    scene.traverse(o => { if (o.isLight) o.layers.enable(XL); });
    scene.background = null; sun.intensity = 0; if (h) h.intensity = 1.5;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    cam.layers.set(XL);
    renderer.setRenderTarget(rtX); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    cam.layers.set(0);
    renderer.setClearColor(keep.cc, keep.ca);
    scene.background = keep.bg; sun.intensity = keep.sunI; if (h) h.intensity = keep.hI; renderer.shadowMap.autoUpdate = keep.au; renderer.shadowMap.needsUpdate = keep.nu;   // v0.45: тень обновляется по требованию (VIS)
    for (const k in keep.cats) UGN.cat[k].visible = keep.cats[k];
    for (const [m, [c, i]] of em) { m.emissive.copy(c); m.emissiveIntensity = i; }
    ug.visible = keep.ugv;
  }
  function layersOff() { for (const g of [UGN.root, procSim.liqGrp, procSim.flowGrp]) if (g) g.traverse(o => o.layers.disable(XL)); scene.traverse(o => { if (o.isLight) o.layers.disable(XL); }); }

  /* ---------- 13. Кадр 9:16: размер холста и буферов ---------- */
  const cv = renderer.domElement;
  function layout() {
    if (!st.on) return;
    const wide = innerWidth >= 900, full = !!st.full, ui = wide && !full ? 312 : 0, mg = wide && !full ? 28 : 0, A = ASP();
    const aw = innerWidth - ui - mg, ah = innerHeight - mg;
    let h = ah, w = h * A; if (w > aw) { w = aw; h = w / A; }
    Object.assign(cv.style, { position: 'fixed', left: Math.round(ui + (innerWidth - ui - w) / 2) + 'px', top: Math.round((innerHeight - h) / 2) + 'px', width: Math.round(w) + 'px', height: Math.round(h) + 'px' });
    let bw, bh;
    if (st.offline || st.rec || st.quality === 'full') { bw = OUT.w; bh = OUT.h; }
    else { const pr = Math.min(devicePixelRatio || 1, 1.5); bh = Math.min(OUT.h, Math.round(h * pr)); bw = Math.round(bh * A); }
    renderer.setPixelRatio(1); renderer.setSize(bw, bh, false);
    for (const r of [rtA, rtB, rtX, rtL]) if (r) r.setSize(bw, bh);
    if (post) { post.mat.uniforms.uPx.value.set(1 / bw, 1 / bh); post.mat.uniforms.uAsp.value = A; }
    camera.aspect = A; camera.updateProjectionMatrix();
  }
  addEventListener('resize', () => { if (st.on) layout(); });

  /* ---------- 14. Сохранение и восстановление состояния приложения ---------- */
  const MARK_LAYERS = ['procval', 'procnet', 'procflag', 'emg', 'pdiag', 'pnodes', 'gpgrid'];
  function snapshot() {
    const L = procLogic, S = procSim.S;
    st.saved = {
      cam: { p: camera.position.clone(), q: camera.quaternion.clone(), up: camera.up.clone(), fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect },
      tgt: controls.target.clone(), ctrl: controls.enabled, pr: renderer.getPixelRatio(),
      css: { position: cv.style.position, left: cv.style.left, top: cv.style.top, width: cv.style.width, height: cv.style.height },
      labelsOff: labelsEl.classList.contains('off'), audio: procAudio.on,
      layers: Object.fromEntries(layerApi.LAYERS.map(l => [l.k, layerApi.isOn(l.k)])),
      ug: UGN.isOn(),
      sim: { valve: { ...L.st.valve }, pump: { ...L.st.pump }, vol: Object.fromEntries(Object.entries(procSim.V).map(([k, v]) => [k, v.vol])), t: S.t, speed: S.speed, cut: !!S.cut },
      asn: { manual: F25.kin.manual, speed: F25.speed }, tagsVis: PIPED.tags ? PIPED.tags.visible : true
    };
  }
  function restoreSim() {
    const L = procLogic, s = st.saved.sim;
    const anyOpen = Object.values(s.valve).some(Boolean), anyRun = Object.values(s.pump).some(Boolean);
    L.closeAll(true);
    if (anyOpen) for (const id in s.valve) if (s.valve[id]) L.setValve(id, true);
    for (const k in s.vol) if (procSim.V[k]) procSim.V[k].vol = s.vol[k];
    procSim.S.t = s.t; procSim.S.speed = s.speed; procSim.S.tasks = {};
    if (anyRun) {
      let n = 0; const iv = setInterval(() => { let left = 0; for (const p in s.pump) if (s.pump[p] && !L.st.pump[p]) { if (L.canStart(p).ok) L.setPump(p, true); else left++; } if (!left || ++n > 40) clearInterval(iv); }, 150);
    }
    procSim.dirty = true;
  }
  function estPrep(on) {
    if (typeof ESTOPS === 'undefined' || !ESTOPS.cine) return;
    const ci = ESTQ.CAR_IDX[ROUTE.src]; if (ci === undefined) return;
    if (on) { st.saved.est = { ci, s: { ...ESTOPS.S[ci] } }; ESTOPS.cine(ci, { chock: true, ground: true, bridge: true, hatch: true, usn: true, cv: true }); }
    else if (st.saved.est) ESTOPS.cine(st.saved.est.ci, st.saved.est.s);
  }
  function liquidLook(on) {
    const mats = new Set(); procSim.liqGrp.traverse(m => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) mats.add(m.material); });
    if (on) { st.saved.liq = [...mats].map(m => [m, m.color.clone(), m.roughness, m.opacity]); for (const m of mats) { m.color.set(0x9c7632); m.roughness = 0.08; m.opacity = 0.92; } }
    else if (st.saved.liq) { for (const [m, c, r, o] of st.saved.liq) { m.color.copy(c); m.roughness = r; m.opacity = o; } st.saved.liq = null; }
  }
  function resetSimVolumes() { const s = st.saved.sim; for (const k in s.vol) if (procSim.V[k]) procSim.V[k].vol = s.vol[k]; procSim.dirty = true; }
  function asnPrep(on) {   // АСН-80 — в рабочее положение (крышка на горловине автоцистерны), ход ускорен
    if (!F25.kin) return;
    if (on) { F25.kin.manual = 1; F25.speed = 40; }
    else { F25.kin.manual = st.saved.asn.manual; F25.speed = 40; setTimeout(() => { F25.speed = st.saved.asn.speed || 1; }, 1500); }
  }

  /* ---------- 15. Вход / выход ---------- */
  async function enter() {
    if (st.on || st.busy) return;
    st.busy = true; uiStatus('Подготовка кинорежима…');
    try {
      if (window.__walkOn && window.__walkExit) window.__walkExit();
      cancelCamAnim(); snapshot(); towerSave();
      build(); OBST = obstacles();
      document.body.classList.add('cine'); labelsEl.classList.add('off'); controls.enabled = false; procAudio.on = false;
      for (const k of MARK_LAYERS) if (layerApi.isOn(k)) layerApi.setVis(k, false);
      if (!layerApi.isOn('procflow')) layerApi.setVis('procflow', true);
      if (!layerApi.isOn('proclvl')) layerApi.setVis('proclvl', true);
      if (UGN.isOn()) UGN.setMode(false);
      if (procSim.S.cut) procSim.setCut(false);
      lookOn(); pipeline(true); CUT.prep(); cutEdgeLook(true);
      { const l = new THREE.PointLight(0xe6eeff, 0, 9, 1.6); scene.add(l); st.lights.push(l); }   // подсветка в разрезе (следует за камерой)
      st.on = true; st.t = 0; st.playing = false; st.paused = false; st.last = performance.now();
      liquidLook(true); asnPrep(true);
      if (st.plan) { estPrep(true); procLogic.assemble(st.plan.path); }
      layout(); ui(true); uiStatus(st.plan ? `Маршрут М1 собран, насос ${st.plan.pump} — пуск автоматически.` : 'Маршрут М1 не найден в модели — поток не показывается.');
    } catch (e) { console.error('CINE: вход', e); uiStatus('Ошибка подготовки: ' + e.message); }
    st.busy = false;
  }
  function exit() {
    if (!st.on) return;
    if (st.rec) recStop(true); if (st.offline) st.cancel = true;
    st.on = false; st.playing = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const S = st.saved;
    CUT.set(0); CUT.unprep(); cutEdgeLook(false); flowLook(false);
    if (S.ug && !UGN.isOn()) UGN.setMode(true);
    if (S.sim.cut) procSim.setCut(true);
    restoreSim(); estPrep(false); liquidLook(false); asnPrep(false); if (PIPED.tags) PIPED.tags.visible = S.tagsVis;
    towerRestore(); layersOff();
    for (const [k, on] of Object.entries(S.layers)) if (layerApi.isOn(k) !== on) layerApi.setVis(k, on);
    lookOff(); pipeline(false);
    Object.assign(cv.style, S.css);
    renderer.setPixelRatio(S.pr); renderer.setSize(innerWidth, innerHeight);
    camera.position.copy(S.cam.p); camera.quaternion.copy(S.cam.q); camera.up.copy(S.cam.up);
    camera.fov = S.cam.fov; camera.near = S.cam.near; camera.far = S.cam.far; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    controls.target.copy(S.tgt); controls.enabled = S.ctrl; cancelCamAnim(); controls.update();
    labelsEl.classList.toggle('off', S.labelsOff); procAudio.on = S.audio;
    document.body.classList.remove('cine'); ui(false);
    try { placeHud(); } catch (e) { }
    OBST = null;
  }

  /* ---------- 16. Кадр: вызывается из основного цикла ---------- */
  const camB = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 4200), camPrev = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 4200);
  const _m = new THREE.Matrix4();
  function pre(now) {
    if (!st.on) return false;
    if (!st.offline) {
      const dt = Math.min(0.25, Math.max(0, (now - st.last) / 1000)); st.last = now;
      if (st.playing && !st.paused) { st.t += dt; if (st.t >= DUR) { st.t = DUR; st.playing = false; onEnd(); } }
    }
    camera.far = 4200;
    applyCamera(st.t, camera, segAt(st.t));
    applyState(st.t, now);
    if ((now - (st.uiT || 0)) > 200) { st.uiT = now; uiTick(); }
    return true;
  }
  function prevVP(seg, t, out) {   // матрица вида-проекции предыдущего кадра (для размытия движения)
    const o = poseSeg(seg, t - 1 / 30, _P, _Q); setCam(camPrev, _P, _Q, o.f, o.r, nearOf(_P, _Q));
    return out.multiplyMatrices(camPrev.projectionMatrix, camPrev.matrixWorldInverse);
  }
  function renderTo(rt, cam) { renderer.setRenderTarget(rt); renderer.render(scene, cam); }
  function render() {
    hideMarkers(); flowLook(true);
    if (LIQ && window.__PFLOW) LIQ.uniforms.uT.value = window.__PFLOW.flowMat.uniforms.uT.value;
    const t = st.t, u = post.mat.uniforms, seg = segAt(t);
    // подсветка в разрезе — у камеры
    if (st.lights[0]) st.lights[0].position.copy(camera.position).add(_fw.set(0, 0.2, 0));
    if (PROG === 'action' && typeof F24 !== 'undefined' && F24.towers) jetLook(F24.towers[ACT.tower]);
    renderTo(rtA, camera);
    u.uCam.value.copy(camera.position);
    if (u.uXR.value > 0.5) renderX(camera);
    u.iA.value.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld);
    if (u.uBP.value > 0.001 || u.uXR.value > 0.5 || u.uGK.value > 0.5) {   // положения точек кадра — для «чертежа», фронта роста и «рентгена»
      lin.m.uniforms.iA.value.copy(u.iA.value); lin.m.uniforms.uCam.value.copy(camera.position);
      renderer.setRenderTarget(rtL); renderer.render(lin.sc, post.cam);
    }
    prevVP(seg, t, u.pA.value);
    if (u.uMix.value > 0 && u.uMix.value < 1) {   // растворение: второй кадр — камера сцены 7
      const o = poseSeg(1, t, _P, _Q); setCam(camB, _P, _Q, o.f, o.r, nearOf(_P, _Q));
      shadowFor(camB.position, _Q, shadowExt(XF.t1 + 0.1)); VIS.sky.position.copy(camB.position);
      renderTo(rtB, camB);
      VIS.sky.position.copy(camera.position);
      u.iB.value.copy(camB.projectionMatrixInverse).premultiply(camB.matrixWorld);
      prevVP(1, t, u.pB.value);
      // в растворении основной кадр — сцена 6 (A), второй — сцена 7 (B)
    }
    renderer.setRenderTarget(null);
    drawOverlay(t);
    renderer.render(post.sc, post.cam);
    return true;
  }

  /* ---------- 17. Управление показом ---------- */
  function play() { if (!st.on) return; if (st.t >= DUR - 0.01) restart(); st.playing = true; st.paused = false; st.last = performance.now(); uiTick(); }
  function pause() { if (!st.on || !st.playing) return; st.paused = !st.paused; st.last = performance.now(); uiTick(); }
  function restart() { if (!st.on) return; st.t = 0; resetSimVolumes(); st.last = performance.now(); uiTick(); }
  function next() { if (!st.on) return; const i = SCENES.findIndex(s => st.t >= s.t0 && st.t < s.t1); const n = SCENES[Math.min(SCENES.length - 1, i + 1)]; st.t = i + 1 < SCENES.length ? n.t0 + 0.01 : DUR; uiTick(); }
  function seek(t) { if (!st.on) return; st.t = clamp(t, 0, DUR); st.last = performance.now(); uiTick(); }
  function onEnd() { if (st.rec) setTimeout(() => recStop(false), 400); uiTick(); }

  /* ---------- 18. Запись в реальном времени (MediaRecorder) ---------- */
  const MR_TYPES = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  function recStart() {
    if (!st.on || st.rec || st.offline) return;
    if (!window.MediaRecorder || !cv.captureStream) { uiStatus('Браузер не поддерживает запись холста (MediaRecorder). Используйте «Рендер MP4» в Chrome/Edge.'); return; }
    const type = MR_TYPES.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    if (!type) { uiStatus('Нет поддерживаемого формата записи в этом браузере.'); return; }
    st.rec = { type, chunks: [] }; layout();
    const stream = cv.captureStream(30);
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: brate() });
    mr.ondataavailable = e => { if (e.data && e.data.size) st.rec.chunks.push(e.data); };
    mr.onstop = () => {
      const r = st.rec; st.rec = null; stream.getTracks().forEach(t => t.stop()); layout();
      if (r.cancel || !r.chunks.length) { uiStatus('Запись отменена.'); uiTick(); return; }
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      save(new Blob(r.chunks, { type: type.split(';')[0] }), `CTR_Oskemen_film_1080x1920_realtime.${ext}`);
      uiStatus(`Готово: запись в реальном времени, формат ${ext.toUpperCase()}. Для плавного видео используйте «Рендер MP4 (покадрово)».`); uiTick();
    };
    st.rec.mr = mr; restart(); st.playing = true; st.paused = false; mr.start(1000);
    uiStatus(`● Идёт запись в реальном времени (${type.split(';')[0]}). Плавность зависит от видеокарты.`); uiTick();
  }
  function recStop(cancel) { if (!st.rec || !st.rec.mr) return; st.rec.cancel = !!cancel; try { st.rec.mr.stop(); } catch (e) { st.rec = null; } }
  const brate = () => (+(document.getElementById('cBr') || {}).value || 20) * 1e6;

  /* ---------- 19. Покадровый рендер MP4 (WebCodecs + mp4-muxer, виртуальное время) ---------- */
  function takeClock() {
    const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame;
    let vnow = realNow(), pend = [];
    performance.now = () => vnow;
    window.requestAnimationFrame = cb => { pend.push(cb); return pend.length; };
    return {
      ready: () => new Promise(r => { const c = () => pend.length ? r() : setTimeout(c, 4); c(); }),
      step(ms) { vnow += ms; const cbs = pend; pend = []; for (const cb of cbs) cb(vnow); },
      release() { performance.now = realNow; window.requestAnimationFrame = realRAF; const cbs = pend; pend = []; for (const cb of cbs) realRAF(cb); }
    };
  }
  function prewarm(step) {   // до первого кадра: маршрут собран, насос в работе, АСН в рабочем положении, шейдеры собраны
    resetSimVolumes(); st.t = 0;
    const pp = st.plan && st.plan.pump;
    for (let w = 0; w < 400; w++) { step(1000 / 30); if (w >= 8 && (!pp || (procLogic.st.pump[pp] && procSim.S.flows.length)) && F25.kin.pose > 0.999) break; }
    F25.speed = st.saved.asn.speed || 1;
    for (const t of (PROG === 'action' ? [0.5, 9, 19.5, 25, 30, 32, 38.5, 57, 61.8] : [9, 22, 31, 33, 40, 46])) { st.t = t; step(1000 / 30); }   // сборка шейдеров всех сцен (вне подачи воды)
    st.t = 0; step(1000 / 30);
  }
  async function renderMP4(o = {}) {
    if (!st.on || st.offline || st.rec) return;
    if (!window.VideoEncoder || !window.VideoFrame) { uiStatus('Покадровый рендер требует WebCodecs (Chrome или Edge на компьютере). Используйте «Запись в реальном времени».'); return; }
    if (!window.Mp4Muxer) { uiStatus('Не загружен модуль упаковки MP4.'); return; }
    const fps = +(document.getElementById('cFps') || {}).value || 30, br = brate();
    let cfg = null;
    for (const codec of ['avc1.640033', 'avc1.640032', 'avc1.64002a', 'avc1.4d0033', 'avc1.4d002a', 'avc1.42e033', 'avc1.42002a']) {
      const c = { codec, width: OUT.w, height: OUT.h, bitrate: br, framerate: fps, avc: { format: 'avc' } };
      try { const s = await VideoEncoder.isConfigSupported(c); if (s.supported) { cfg = c; break; } } catch (e) { }
    }
    if (!cfg) { uiStatus('Кодек H.264 для 1080 × 1920 недоступен в этом браузере. Используйте «Запись в реальном времени».'); return; }
    st.offline = true; st.cancel = false; st.playing = false; layout(); uiTick();
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: OUT.w, height: OUT.h, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let encErr = null;
    const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { encErr = e; } });
    enc.configure(cfg);
    const T0 = clamp(+o.t0 || 0, 0, DUR), T1 = clamp(+o.t1 || DUR, T0 + 1 / fps, DUR), clk = takeClock(), N = Math.round((T1 - T0) * fps), t0 = Date.now();
    try {
      await clk.ready();
      uiProg(0.001, 'Подготовка: маршрут, насос, шейдеры…'); await new Promise(r => setTimeout(r, 0));
      prewarm(ms => clk.step(ms));
      for (let i = 0; i < N; i++) {
        if (st.cancel || encErr || !st.on) break;
        st.t = T0 + i / fps; clk.step(1000 / fps * ws(st.t));   // модельное время — с замедлением программы
        const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 1));
        if (i % 3 === 0) {
          const k = (i + 1) / N, el = (Date.now() - t0) / 1000;
          uiProg(k, `Рендер MP4: кадр ${i + 1} из ${N} · ${Math.round(k * 100)} % · осталось ≈ ${fmtT(el / k - el)}`);
          await new Promise(r => setTimeout(r, 0));
        }
      }
      await enc.flush();
    } catch (e) { encErr = encErr || e; }
    clk.release();
    try { enc.close(); } catch (e) { }
    const ok = !st.cancel && !encErr;
    st.offline = false; st.last = performance.now(); uiProg(0, '');
    if (ok) {
      muxer.finalize();
      save(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `CTR_Oskemen_film_${PROG === 'action' ? 'action_62s' : 'tour_58s'}_${OUT.w}x${OUT.h}_${fps}fps.mp4`);
      uiStatus(`Готово: MP4 (H.264), 1080 × 1920, ${fps} к/с, ${fmtT(N / fps)}. Файл сохранён в «Загрузки».`);
    } else uiStatus(encErr ? 'Ошибка кодирования: ' + (encErr.message || encErr) : 'Рендер отменён.');
    if (st.on) layout(); uiTick();
  }
  let lastURL = null;
  function save(blob, name) {
    if (window.__cineSaveHook) return window.__cineSaveHook(blob, name);
    if (lastURL) URL.revokeObjectURL(lastURL);
    lastURL = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = lastURL; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    const d = document.getElementById('cDl'); if (d) { d.href = lastURL; d.download = name; d.textContent = `⬇ ${name} (${(blob.size / 1048576).toFixed(1)} МБ)`; d.style.display = 'block'; }
  }
  const fmtT = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------- 20. Панель управления ---------- */
  const css = document.createElement('style'); css.id = 'cineCss';
  css.textContent = `
    body.cine{background:#06090d}
    body.cine > :not(canvas):not(#cineP){display:none !important}
    body.cine > canvas{pointer-events:none;box-shadow:0 0 0 1px rgba(255,255,255,.07),0 24px 70px rgba(0,0,0,.65)}
    #cineP{display:none;position:fixed;left:14px;top:14px;width:282px;max-height:calc(100% - 28px);overflow:auto;background:rgba(16,24,34,.94);color:#e8eef4;
      border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 13px;font-size:12.5px;line-height:1.35;box-shadow:0 10px 40px rgba(0,0,0,.45);z-index:50}
    body.cine #cineP{display:block}
    #cineP .ch{display:flex;align-items:center;gap:8px;margin-bottom:8px}#cineP .ch b{flex:1;font-size:14px}
    #cineP button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#e8eef4;padding:7px 9px}
    #cineP button:hover{background:rgba(255,255,255,.14)}#cineP button:disabled{opacity:.4;cursor:default}
    #cineP .pri{background:#1f7fd1;border-color:#1f7fd1;color:#fff}#cineP .red{background:#b8322f;border-color:#b8322f;color:#fff}
    #cineP .row{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
    #cineP .sc{display:flex;justify-content:space-between;color:#9fb1c2;margin-top:4px}
    #cBar{position:relative;height:16px;margin:8px 0 4px;display:flex;gap:2px;cursor:pointer}
    #cBar span{flex:1;background:rgba(255,255,255,.12);border-radius:3px;position:relative;overflow:hidden}
    #cBar span i{position:absolute;left:0;top:0;bottom:0;background:#3aa0f2}
    #cBar span.cur{outline:1px solid #7cc4ff}
    #cineP label{display:flex;align-items:center;gap:7px;margin:5px 0;color:#c7d3de}
    #cineP select{font:inherit;background:#0e161f;color:#e8eef4;border:1px solid rgba(255,255,255,.16);border-radius:7px;padding:4px 6px}
    #cineP input[type=file]{font-size:11px;color:#9fb1c2;max-width:150px}
    #cineP .sec{border-top:1px solid rgba(255,255,255,.09);margin-top:9px;padding-top:8px}
    #cineP .sec>b{display:block;margin-bottom:4px;font-size:12px;color:#9fd0ff;letter-spacing:.3px}
    #cProg{height:6px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;margin:7px 0 4px;display:none}#cProg i{display:block;height:100%;width:0;background:#3aa0f2}
    #cStat{color:#a9bccd;font-size:11.5px;min-height:15px;white-space:pre-line}
    #cDl{display:none;margin-top:6px;color:#7cc4ff;word-break:break-all}
    #cineP .nt{color:#7f93a6;font-size:11px;margin-top:6px}
    body.cine.cfull #cineP{display:none}
    @media (max-width:899px){#cineP{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:46%}#cineP.min #cBody{display:none}}
  `;
  document.head.appendChild(css);
  const pnl = document.createElement('div'); pnl.id = 'cineP';
  pnl.innerHTML = `<div class="ch"><b>Кинорежим</b><button id="cMin" title="Свернуть">▾</button><button id="cX" title="Выйти (Esc)">✕</button></div>
    <div id="cBody">
      <label>Формат <select id="cFmt"><option value="h">16:9 — экран компьютера</option><option value="v">9:16 — Instagram, телефон</option></select></label>
      <div class="row"><button class="pri" id="cFull" title="Клавиша F">⛶ Смотреть во весь экран</button></div>
      <label>Фильм <select id="cPg"><option value="action">Экшн · 62 с (FPV, 120 BPM)</option><option value="tour">Обзор · 58 с</option></select></label>
      <div class="sc"><span id="cScn">—</span><span id="cTm">00:00 / ${fmtT(DUR)}</span></div>
      <div id="cBar"></div>
      <div class="row"><button class="pri" id="cPlay">▶ Старт</button><button id="cPause">❚❚ Пауза</button><button id="cNext" title="Следующая сцена">⏭ Сцена</button><button id="cRst" title="С начала">⟲ Заново</button></div>
      <label><input type="checkbox" id="cTit" checked> Титры в кадре (RU)</label>
      <label><input type="checkbox" id="cMb" checked> Размытие движения камеры</label>
      <label>Логотип для финала <input type="file" id="cLogo" accept="image/png,image/svg+xml,image/jpeg,image/webp"></label>
      <label>Предпросмотр <select id="cQ"><option value="fast">быстрый</option><option value="full">полный (как в видео)</option></select></label>
      <div class="sec"><b>ВИДЕО (В ВЫБРАННОМ ФОРМАТЕ)</b>
        <label>Кадров/с <select id="cFps"><option selected>30</option><option>60</option></select> Мбит/с <select id="cBr"><option>12</option><option>16</option><option selected>20</option><option>24</option></select></label>
        <div class="row"><button class="pri" id="cRen" title="Каждый кадр рендерится без спешки — видео плавное на любом компьютере">● Рендер MP4 (покадрово)</button></div>
        <div class="row"><button id="cRec">● Запись в реальном времени</button><button class="red" id="cRecS">■ Остановить</button></div>
        <div id="cProg"><i></i></div><div id="cStat"></div><a id="cDl"></a>
        <div class="nt">Рекомендуется «Рендер MP4 (покадрово)»: виртуальное время, 30 к/с без пропусков, замедления модельного времени — точно по программе (Chrome/Edge). В реальном времени замедляется только камера. Звук в браузере не пишется — монтаж «Экшн» рассчитан на трек 120 BPM из Instagram.</div>
      </div>
      <div class="row" style="margin-top:9px"><button id="cExit" style="flex:1">■ Выйти в обычный режим</button></div>
      <div class="nt">F — во весь экран · Пробел — пауза · → — следующая сцена · Esc — выход</div>
    </div>`;
  document.body.appendChild(pnl);
  const $ = id => document.getElementById(id);
  function ui(on) {
    if (!on) return;
    $('cBar').innerHTML = SCENES.map((s, i) => `<span data-i="${i}" title="${i + 1}. ${s.a || 'Финал'}"><i></i></span>`).join('');
    uiTick();
  }
  function uiTick() {
    if (!st.on) return;
    const i = Math.max(0, SCENES.findIndex(s => st.t >= s.t0 && st.t < s.t1)), s = SCENES[st.t >= DUR ? SCENES.length - 1 : i];
    $('cScn').textContent = `${SCENES.indexOf(s) + 1}/${SCENES.length} · ${s.a || 'Финал'}`;
    $('cTm').textContent = `${fmtT(st.t)} / ${fmtT(DUR)}`;
    $('cBar').querySelectorAll('span').forEach((el, j) => { const q = SCENES[j]; el.firstChild.style.width = (clamp((st.t - q.t0) / (q.t1 - q.t0), 0, 1) * 100) + '%'; el.classList.toggle('cur', q === s); });
    const busy = !!(st.offline || st.rec);
    $('cPlay').textContent = st.playing && !st.paused ? '▶ Идёт' : st.paused ? '▶ Продолжить' : '▶ Старт';
    $('cPause').textContent = st.paused ? '▶ Продолжить' : '❚❚ Пауза';
    for (const id of ['cPlay', 'cPause', 'cNext', 'cRst', 'cRen', 'cRec', 'cQ', 'cFps', 'cBr', 'cPg', 'cFmt', 'cFull']) $(id).disabled = busy;
    $('cPause').disabled = busy || !st.playing;
    $('cRecS').disabled = !st.rec && !st.offline; $('cRecS').textContent = st.offline ? '■ Отменить рендер' : '■ Остановить';
  }
  function uiStatus(s) { const e = $('cStat'); if (e) e.textContent = s; }
  function uiProg(k, s) { const b = $('cProg'); b.style.display = k > 0 ? 'block' : 'none'; b.firstChild.style.width = (k * 100) + '%'; if (s) uiStatus(s); }
  $('cPlay').onclick = () => { if (st.paused) pause(); else play(); };
  $('cPause').onclick = pause; $('cNext').onclick = next; $('cRst').onclick = () => { restart(); if (!st.playing) play(); };
  $('cX').onclick = exit; $('cExit').onclick = exit;
  $('cMin').onclick = () => { pnl.classList.toggle('min'); $('cBody').style.display = $('cBody').style.display === 'none' ? '' : 'none'; $('cMin').textContent = $('cBody').style.display === 'none' ? '▸' : '▾'; };
  $('cTit').onchange = e => { st.titles = e.target.checked; if (ovl) ovl.key = ''; };
  $('cMb').onchange = e => { st.mb = e.target.checked; };
  $('cQ').onchange = e => { st.quality = e.target.value; layout(); };
  $('cPg').onchange = e => setProgram(e.target.value);
  $('cFmt').value = FMT; $('cFmt').onchange = e => setFormat(e.target.value);
  $('cFull').onclick = () => fullScreen(true);
  /* во весь экран: панель скрыта, кадр занимает экран; Esc — выход из полноэкранного режима (браузер), повторный Esc — выход из кинорежима */
  function fullScreen(on) {
    const el = document.documentElement;
    if (on && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => uiStatus('Браузер не разрешил полноэкранный режим.'));
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (on && !st.playing && !st.offline && !st.rec) play();
  }
  document.addEventListener('fullscreenchange', () => { st.full = !!document.fullscreenElement; document.body.classList.toggle('cfull', st.full); if (st.on) layout(); });
  $('cRen').onclick = () => renderMP4(); $('cRec').onclick = recStart; $('cRecS').onclick = () => { if (st.offline) st.cancel = true; else recStop(false); };
  $('cBar').onclick = e => { const sp = e.target.closest('span'); if (!sp || st.offline || st.rec) return; const s = SCENES[+sp.dataset.i], r = sp.getBoundingClientRect(); seek(s.t0 + (s.t1 - s.t0) * clamp((e.clientX - r.left) / r.width, 0, 0.98)); };
  $('cLogo').onchange = e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const im = new Image(); im.onload = () => { st.logo = im; if (ovl) ovl.key = ''; uiStatus('Логотип загружен — показывается в финальном кадре.'); };
    im.onerror = () => uiStatus('Не удалось прочитать файл логотипа.'); im.src = URL.createObjectURL(f);
  };
  const onKey = e => {
    if (!st.on) return;
    if (e.code === 'Escape') { if (st.offline) st.cancel = true; else exit(); }
    else if (e.code === 'Space') { if (!st.offline && !st.rec) { if (st.playing) pause(); else play(); } }
    else if (e.code === 'ArrowRight') { if (!st.offline && !st.rec) next(); }
    else if (e.code === 'KeyF') { if (!st.offline && !st.rec) fullScreen(!document.fullscreenElement); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  addEventListener('keydown', onKey, true);
  const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'bCine'; btn.textContent = 'Кино'; btn.title = 'Кинорежим: фильмы 9:16 для Instagram — «Экшн · 62 с» и «Обзор · 58 с»'; btn.onclick = enter;
  { const top = document.getElementById('top'); if (top) top.appendChild(btn); }

  /* ---------- 21. Проверка траектории (разработка): просвет камеры по лучам ---------- */
  function check(step = 0.1, R = 2.0, t0 = 0, t1 = DUR) {
    if (!st.segs) { build(); OBST = obstacles(); }
    const ray = new THREE.Raycaster(), dirs = [];
    for (let i = 0; i < 26; i++) { const y = 1 - (i / 25) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; dirs.push(new V3(Math.cos(a) * r, y, Math.sin(a) * r)); }
    let cands = []; scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && o !== VIS.sky && o !== ground && !(TERR && o === TERR) && !(CUT.grp && o.parent === CUT.grp) && !o.material.transparent) { let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) cands.push(o); } });
    let sph = cands.map(o => { if (o.isInstancedMesh) o.computeBoundingSphere(); else if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = (o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere).clone(); s.applyMatrix4(o.matrixWorld); return s; });
    const keep = sph.map(s => s.radius < 150); cands = cands.filter((o, i) => keep[i]); sph = sph.filter((s, i) => keep[i]);
    const P_ = new V3(), Q_ = new V3(), res = [];
    for (let t = t0; t <= t1 + 1e-6; t += step) {
      const sg = st.segs.length > 1 && t > XF.t0 + 0.4 ? 1 : 0, s0 = stateAt(t);
      if (s0.grow !== null && s0.grow !== undefined) CUT.set(0); else CUT.set(s0.cut); poseSeg(sg, t, P_, Q_);
      const near = cands.filter((o, i) => sph[i].distanceToPoint(P_) < R);
      let md = R, hit = null;
      for (const d of dirs) { ray.set(P_, d); ray.far = R; const h = ray.intersectObjects(near, false)[0]; if (h && h.distance < md) { md = h.distance; hit = h.object.name || h.object.parent && h.object.parent.name || h.object.type; } }
      const gr = P_.y - (CUT.inside(P_) ? CUT.floorAt(P_.x, P_.z) : hAt(P_.x, P_.z));
      res.push({ t: +t.toFixed(2), clr: +md.toFixed(2), ground: +gr.toFixed(2), hit, p: P_.toArray().map(v => +v.toFixed(1)) });
    }
    CUT.set(stateAt(st.t).cut);
    return res;
  }
  /* выбор фильма: траектория, сцены и длительность; модельное состояние — с начала */
  function setProgram(id) {
    if (!PROGS[id] || st.offline || st.rec) return;
    if (st.on && PROG === 'action' && id !== 'action') { towerRestore(); towerSave(); CUT.keepAll(false); }
    PROG = id; SCENES = PROGS[id].scenes; DUR = PROGS[id].dur;
    const sel = document.getElementById('cPg'); if (sel && sel.value !== id) sel.value = id;
    if (st.on) { build(); OBST = obstacles(); st.t = 0; st.playing = false; st.paused = false; resetSimVolumes(); ui(true); uiStatus(`Фильм: ${PROGS[id].name}.`); }
  }
  /* формат кадра: размеры выхода, оверлей титров, зона титра «чертежа» */
  function setFormat(f) {
    if ((f !== 'h' && f !== 'v') || st.offline || st.rec) return;
    FMT = f; OUT.w = f === 'h' ? 1920 : 1080; OUT.h = f === 'h' ? 1080 : 1920;
    const sel = document.getElementById('cFmt'); if (sel && sel.value !== f) sel.value = f;
    if (ovl) { ovl.c.width = OUT.w; ovl.c.height = OUT.h; ovl.tex.dispose(); ovl.key = ''; }
    if (post) post.mat.uniforms.uTY.value.set(...(f === 'h' ? [0.06, 0.1, 0.34, 0.4] : [0.74, 0.8, 0.93, 0.97]));
    layout();
  }
  function dispose() {   // разработка: горячая перезагрузка модуля
    if (st.on) exit();
    pnl.remove(); css.remove(); btn.remove(); removeEventListener('keydown', onKey, true);
  }

  const api = { enter, exit, play, pause, restart, next, seek, renderMP4, recStart, recStop, pre, render, check, poseSeg, stateAt, prewarm, dispose, CUT, ws, wsInt, setProgram, setFormat, get FMT() { return FMT; },
    get DUR() { return DUR; }, get SCENES() { return SCENES; }, get PROG() { return PROG; }, set bankSign(v) { BANK_SIGN = v; },
    get on() { return st.on; }, get t() { return st.t; }, get st() { return st; }, setTime(t) { st.t = t; },
    setOut(w, h) { OUT.w = w; OUT.h = h; layout(); } };
  window.__CINE = api;
  return api;
})();


