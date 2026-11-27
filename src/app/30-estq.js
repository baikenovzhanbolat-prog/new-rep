/* =====================================================================================
   Этап 6.3 (v0.8) — ж/д эстакада 177: устройства слива/налива, обвязка и КИП — по листу
   5632.29-278-АК-045-0 «Железнодорожная эстакада на 3 вагона-цистерны (поз. 177). План расположения
   оборудования КИП и проводок» (привязка листа к сцене — по осям колонн ГП-002 и оси пути, точность ≈0,2 м).
   Подтверждено АК-045: порядок устройств с запада на восток — УСН-N2, УСН-N3 с УНЖ-N1 (в гаражном положении),
     УСН-N1 со стойкой УПВС-80С; у каждого УСН — петля обвязки: ручные задвижки, фильтр с PI до/после, FQIT,
     байпас; электрозадвижки N4, N5 (запад), N1, N2, N3 (восток); коллекторы Б ⌀159×4,5, ДТ(З) ⌀159×4,5,
     ДТ(Л) ⌀219×6 «в насосную»; PT/TT 177-08…13; QE-5a; пульт ПУ-1; КС-4; переходные мостики МП;
     кабельный лоток КП-200; аварийный приямок 1000×1000×1800; дренаж ⌀273×7 в ёмкость 139.2;
     кнопки механизма управления лебёдкой; настил +3,500.
   АК-004: типы — УСН-150-04, УНЖ 6-100АС-02.04, УПВС-80С, задвижки N1–N8 30с941нж, назначение линий.
   УСЛОВНО: высота обвязки над землёй (≈0,6 м), конструкция и размеры устройств (по типовым образцам),
     типоразмеры фильтров и расходомеров, длины рукавов/стрел, положение кнопок и пультов по высоте.
   Граф ТП (PROC) по эстакаде перестраивается здесь по той же геометрии (до создания procLogic).
   ===================================================================================== */
const ESTQ = (() => {
  const E = EST177, { RH, PY, TZ, zd0, zd1 } = E, car = E.cars;     // car: [запад, середина, восток]
  const g = new THREE.Group(); g.name = 'estq'; scene.add(g);
  const yP = (x, z) => hAt(x, z) + 0.6;                                // как у трасс графа (procY вне цеха 200)
  const ZS = 34.51;                                                    // стойки УСН (АК-045)
  const XS = { USN2: car[0] - 2.0, USN3: car[1] - 2.0, USN1: car[2] - 2.0 };
  const UNZH_C = [-22.43, 34.30], UPVS_C = [-10.0, 33.93];             // АК-045
  const YA = PY + 1.6;                                                 // ось стрелы УНЖ (условно)
  const HIGH = hAt(-15.65, 30.2) + 1.15;                               // переход отводов N2/N3 над коллекторами (условно; v0.17 — от отметки площадки)
  const CAR_IDX = { USN2: 0, USN3: 1, USN1: 2, UNZH: 1, UPVS: 2 };

  /* ---------- 1. Перестройка графа PROC по АК-045 ---------- */
  const N = PROC.nodes, ED = Object.fromEntries(PROC.edges.map(e => [e.id, e])), V = PROC.valves;
  const node = (id, x, z) => { if (!N[id]) N[id] = { n: '', t: 'j', p: [x, z] }; else N[id].p = [x, z]; };
  const edge = (id, pts, extra = {}) => { const e = ED[id]; e.pts = pts; delete e._p3; Object.assign(e, extra); if (extra.src) delete e.cond; };
  const valve = (id, x, z, y) => { V[id].p = [x, z]; if (y !== undefined) V[id].y = y; else delete V[id].y; };
  const xs2 = XS.USN2, xs3 = XS.USN3, xs1 = XS.USN1, S45 = 'АК-045';
  // запад: УСН-N2 → петля (FQIT177-02) → N4 → ДТ(Л)
  node('USN2', xs2, ZS); node('U2a', xs2, 33.9); node('U2j', -31.4, 31.6); node('U2N4', -30.8, 31.2); node('LK2', -30.8, 30.43);
  edge('e90', [[xs2, 34.15]]); valve('УСН-N2', xs2, 34.15, yP(xs2, 34.15));
  edge('e91', [[xs2, 33.9], [xs2, 32.0], [-31.4, 32.0], [-31.4, 31.6]], { src: S45, n: 'Обвязка УСН-N2: задвижки, фильтр, FQIT177-02, байпас' });
  edge('e100', [[-31.4, 31.6], [-30.8, 31.6], [-30.8, 31.2]], { src: S45 });
  edge('e101', [[-30.8, 30.85]]); valve('N4', -30.8, 30.85);
  // середина: УСН-N3 → петля (FQIT177-03) → N5 → ДТ(Л); от стояка — УНЖ-N1
  node('USN3', xs3, ZS); node('U3a', -24.8, 34.0); node('U3j', -28.75, 31.6); node('U3N5', -29.1, 31.2); node('LK3', -29.1, 30.43);
  edge('e92', [[-23.5, 34.3]]); valve('УСН-N3', -23.5, 34.3, yP(-23.5, 34.3));
  edge('e93', [[-24.8, 34.0], [-24.8, 32.0], [-28.75, 32.0], [-28.75, 31.6]], { src: S45, n: 'Обвязка УСН-N3 / УНЖ-N1: задвижки, фильтр, FQIT177-03, байпас' });
  edge('e102', [[-28.75, 31.6], [-29.1, 31.6], [-29.1, 31.2]], { src: S45 });
  edge('e103', [[-29.1, 30.85]]); valve('N5', -29.1, 30.85);
  ED.e104.a = 'U3a';   // АК-004: УСН-N3 и УНЖ-N1 — общий стояк через FQIT177-03
  node('UNa', UNZH_C[0], UNZH_C[1]); node('UNb', UNZH_C[0], UNZH_C[1] + 0.45);
  edge('e104', [[-24.8, 34.0], [-24.8, 33.6], [UNZH_C[0], 33.6], [UNZH_C[0], UNZH_C[1]]], { src: S45, n: 'Обвязка УНЖ-N1 (от стояка УСН-N3)' });
  edge('e105', [[UNZH_C[0], UNZH_C[1]], [UNZH_C[0], UNZH_C[1], YA], [UNZH_C[0], UNZH_C[1] + 0.45, YA]], { src: S45 });
  edge('e106', [[UNZH_C[0], UNZH_C[1], YA - 0.45]]); valve('СЕНС-УНЖ', UNZH_C[0], UNZH_C[1], YA - 0.45);   // v0.32: узел графа — на стояке, где стоит клапан (было смещение 0,6 м)
  N.UNZH.p = [UNZH_C[0] + 0.5, UNZH_C[1] + 1.2];
  node('Gunzh', UNZH_C[0], 33.9);
  edge('e210', [[-24.72, 28.8], [-24.72, 28.95], [-24.72, 28.95, HIGH + 0.25], [-24.72, 32.3, HIGH + 0.25], [-24.72, 32.3, PY + 2.3], [UNZH_C[0], 32.3, PY + 2.3], [UNZH_C[0], 33.9, PY + 2.3]], { src: S45 });   // v0.17: над коллекторами
  // восток: УСН-N1 → петля (FQIT177-01) → коллектор отводов → N1 (ДТ(Л)), N3 (ДТ(З)), N2 (Б); УПВС-80С → обратный клапан → стояк
  node('USN1', xs1, ZS); node('U1a', xs1, 33.75); node('U1j', -15.35, 31.6);
  edge('e88', [[xs1, 34.15]]); valve('УСН-N1', xs1, 34.15, yP(xs1, 34.15));
  edge('e89', [[xs1, 33.75], [xs1, 31.6], [-15.35, 31.6]], { src: S45, n: 'Обвязка УСН-N1: задвижки, фильтр, FQIT177-01, байпас' });
  node('U1N1', -16.55, 31.2); node('LK1', -16.55, 30.43);
  edge('e94', [[-15.35, 31.6], [-16.55, 31.6], [-16.55, 31.2]], { src: S45 });
  edge('e95', [[-16.55, 30.85]]); valve('N1', -16.55, 30.85);
  node('U1N3', -15.95, 31.2); node('ZK1v', -15.95, 30.95); node('ZK1', -15.95, 29.9);
  edge('e98', [[-15.35, 31.6], [-15.95, 31.6], [-15.95, 31.2], [-15.95, 31.2, HIGH]], { src: S45 });
  ED.e99.b = 'ZK1v'; edge('e99', [[-15.95, 30.95, HIGH]]); valve('N3', -15.95, 30.95, HIGH);
  node('U1N2', -15.35, 31.2); node('BK1v', -15.35, 30.95); node('BK1', -15.35, 29.4);
  edge('e96', [[-15.35, 31.6], [-15.35, 31.2], [-15.35, 31.2, HIGH]], { src: S45 });
  ED.e97.b = 'BK1v'; edge('e97', [[-15.35, 30.95, HIGH]]); valve('N2', -15.35, 30.95, HIGH);
  PROC.edges.push({ id: 'e99b', a: 'ZK1v', b: 'ZK1', k: 'pipe', prod: 'Z', pts: [[-15.95, 30.95, HIGH], [-15.95, 29.9, HIGH], [-15.95, 29.9]], n: 'Отвод N3 → коллектор ДТ(З)', src: S45 });
  PROC.edges.push({ id: 'e97b', a: 'BK1v', b: 'BK1', k: 'pipe', prod: 'B', pts: [[-15.35, 30.95, HIGH], [-15.35, 29.4, HIGH], [-15.35, 29.4]], n: 'Отвод N2 → коллектор бензина', src: S45 });
  node('UPVS', UPVS_C[0], UPVS_C[1]); node('UPa', UPVS_C[0], UPVS_C[1]);
  edge('e107', [[UPVS_C[0], UPVS_C[1], PY + 0.7]]); valve('УПВС', UPVS_C[0], UPVS_C[1], PY + 0.7);
  edge('e108', [[UPVS_C[0], UPVS_C[1], PY + 0.7], [UPVS_C[0], UPVS_C[1]], [UPVS_C[0], 33.75], [xs1, 33.75]], { src: S45 });
  // коллекторы вдоль эстакады: от задвижек N6–N8 до отводов восточного УСН (АК-045)
  Object.assign(ED.e80, { b: 'LK2' }); edge('e80', [[-37.4, 30.43], [-30.8, 30.43]], { src: S45 });
  Object.assign(ED.e81, { a: 'LK2', b: 'LK3' }); edge('e81', [[-30.8, 30.43], [-29.1, 30.43]], { src: S45 });
  Object.assign(ED.e82, { a: 'LK3', b: 'LK1' }); edge('e82', [[-29.1, 30.43], [-16.55, 30.43]], { src: S45 });
  Object.assign(ED.e83, { a: 'LK1' }); edge('e83', [[-16.55, 30.43], [-15.0, 30.43]], { src: S45 }); node('LKe', -15.0, 30.43);
  edge('e84', [[-37.4, 29.9], [-15.95, 29.9]], { src: S45 }); edge('e85', [[-15.95, 29.9], [-15.0, 29.9]], { src: S45 }); node('ZKe', -15.0, 29.9);
  edge('e86', [[-37.4, 29.4], [-15.35, 29.4]], { src: S45 }); edge('e87', [[-15.35, 29.4], [-14.8, 29.4]], { src: S45 }); node('BKe', -14.8, 29.4);
  // дренаж эстакады: вдоль пути с южной стороны (АК-045) → ГП-005 (x = −1,89) → ДЕ-2
  node('Dest', -28.0, 39.35);
  edge('e205', [[-28.0, 39.35], [-2.4, 39.35], [-1.89, 39.5], [-1.89, 29.11], [-1.78, 28.83], [-1.4, 28.46], [-1.29, 28.19], [-1.29, 14.9], [-0.889, 8.952]], { src: 'АК-045, ГП-005' });
  const fl = PROC.flags.find(f => f.n === 'Коллекторы эстакады');
  if (fl) Object.assign(fl, { n: 'Эстакада: расстановка по АК-045', p: [-21.0, 31.0], note: 'Расстановка устройств слива/налива, обвязки и электрозадвижек — по листу АК-045 «План расположения оборудования КИП и проводок» (поз. 177): с запада на восток УСН-N2, УСН-N3 с УНЖ-N1, УСН-N1 со стойкой УПВС-80С. Ранее порядок был принят по функциональной схеме АК-004 (УСН-N1 на западе) — исправлено; соединения (какая задвижка куда ведёт) не менялись, кроме подключения УНЖ-N1 до FQIT177-03 (АК-004: «общий стояк через FQIT 177-03»). Высота обвязки ≈0,6 м над землёй — условно.' });

  /* ---------- 2. Материалы и геометрии ---------- */
  const SM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.35, ...o });
  const mPipe = { L: SM(NET_DEF[0].c), Z: SM(NET_DEF[1].c), B: SM(NET_DEF[2].c), D: SM(NET_DEF[3].c), G: SM(NET_DEF[4].c), X: SM(0x8d949a, { metalness: 0.6 }) };
  const mSteel = SM(0x4f565c, { metalness: 0.7, roughness: 0.4 }), mDark = SM(0x26292c, { metalness: 0.5 }), mRed = SM(0xc0392b), mYel = SM(0xe0b531), mBlue = SM(0x3f6f99, { metalness: 0.3 });
  const mGauge = SM(0xf0f0ea, { metalness: 0.1, roughness: 0.3 }), mConc = SM(0xa8a49a, { metalness: 0, roughness: 0.95 }), mRubber = SM(0x1b1c1e, { metalness: 0, roughness: 0.85 }), mGreen = SM(0x2e8b4a);
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 18), gSph = new THREE.SphereGeometry(1, 14, 10), gBox = new THREE.BoxGeometry(1, 1, 1), gTor = new THREE.TorusGeometry(1, 0.13, 8, 22);
  const UP = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), one = new THREE.Quaternion();
  const mesh = (geo, mt, parent = g, o = null) => { const me = new THREE.Mesh(geo, mt); me.castShadow = me.receiveShadow = true; parent.add(me); if (o) { me.userData.o = o; pickables.push(me); } return me; };
  const cylAB = (a, b, r, mt, parent = g, o = null) => { const me = mesh(gCyl, mt, parent, o); placeAB(me, a, b, r); return me; };
  const placeAB = (me, a, b, r) => { v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); me.scale.set(r, Math.max(L, 0.001), r); me.quaternion.setFromUnitVectors(UP, v3.normalize()); me.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); };

  /* ---------- 3. Трубопроводы (физические): по рёбрам графа + участки у арматуры; отводы/стыки — сферы ---------- */
  const DN = { L219: 0.1095, P159: 0.0795, D150: 0.0795, D100: 0.057, D80: 0.0445, D273: 0.137, G108: 0.054 };
  const runs = [];   // [pts3, r, mat, o]
  const P3 = pts => pts.map(q => [q[0], q.length > 2 ? q[2] : yP(q[0], q[1]), q[1]]);
  const pipeObj = (n, note) => ({ id: 'труба', net: 1, name: n, note: note || 'Трасса — по листу АК-045 (план эстакады); высота над землёй ≈0,6 м и опоры — условно.' });
  const addRun = (pts, r, mt, o) => runs.push([P3(pts), r, mt, o]);
  // коллекторы: от концов трасс ГП-005 (x = −38,94) через N6–N8 до восточных отводов
  addRun([[-38.94, 30.43], [-15.0, 30.43]], DN.L219, mPipe.L, pipeObj('Коллектор ДТ(Л) ⌀219×6 (в насосную) — эстакада 177', 'Диаметр и назначение — по АК-045/АК-004; трасса вдоль эстакады — по АК-045. Высота ≈0,6 м — условно.'));
  addRun([[-38.94, 29.9], [-15.0, 29.9]], DN.P159, mPipe.Z, pipeObj('Коллектор ДТ(З) ⌀159×4,5 (в насосную) — эстакада 177'));
  addRun([[-38.94, 29.4], [-14.8, 29.4]], DN.P159, mPipe.B, pipeObj('Коллектор бензина ⌀159×4,5 (в насосную) — эстакада 177'));
  const LOOPS = [
    { k: 'USN2', fq: 'FQIT177-02', fa: 'FA177-06', pi: ['PI177-16', 'PI177-17'], mt: mPipe.L, z: 32.0, zb: 31.45, x0: xs2, x1: -31.4, xin: -34.45, xf: -33.65, xq: -32.65, xout: -31.95, xb: [-34.75, -31.7], xbv: -33.2 },
    { k: 'USN3', fq: 'FQIT177-03', fa: 'FA177-07', pi: ['PI177-18', 'PI177-19'], mt: mPipe.L, z: 32.0, zb: 31.45, x0: -24.8, x1: -28.75, xin: -25.25, xf: -26.05, xq: -27.2, xout: -28.15, xb: [-25.0, -28.5], xbv: -26.75 },
    { k: 'USN1', fq: 'FQIT177-01', fa: 'FA177-05', pi: ['PI177-14', 'PI177-15'], mt: mPipe.X, z: 31.6, zb: 31.05, x0: xs1, x1: -15.35, xin: -11.2, xf: -12.0, xq: -13.2, xout: -14.3, xb: [-10.95, -14.75], xbv: -12.85 }
  ];
  const nm = { USN1: 'УСН-N1', USN2: 'УСН-N2', USN3: 'УСН-N3' };
  for (const L of LOOPS) {
    const o = pipeObj(`Обвязка ${nm[L.k]} Ду150 (фильтр, ${L.fq}, байпас)`, `Петля обвязки — по листу АК-045: ручные задвижки, фильтр с манометрами ${L.pi.join('/')} до и после, расходомер ${L.fq}, реле потока ${L.fa}, байпасная линия с задвижкой (АК-004). Высота ≈0,6 м, типоразмеры — условно.` + (L.k === 'USN1' ? ' Петля УСН-N1 — общая для ДТ(Л), ДТ(З) и бензина (окраска нейтральная).' : ''));
    const st = L.k === 'USN3' ? [[xs3, ZS], [xs3, 34.3], [-24.8, 34.3], [-24.8, 34.0]] : [[XS[L.k], ZS], [XS[L.k], L.k === 'USN1' ? 33.75 : 33.9]];
    addRun(st, DN.D150, L.mt, o);
    addRun([[L.x0, st[st.length - 1][1]], [L.x0, L.z], [L.x1, L.z], [L.x1, 31.6]], DN.D150, L.mt, o);
    addRun([[L.xb[0], L.z], [L.xb[0], L.zb], [L.xb[1], L.zb], [L.xb[1], L.z]], DN.D150, L.mt, o);
  }
  addRun([[-31.4, 31.6], [-30.8, 31.6], [-30.8, 30.43]], DN.D150, mPipe.L, pipeObj('Отвод УСН-N2 → N4 → коллектор ДТ(Л)'));
  addRun([[-28.75, 31.6], [-29.1, 31.6], [-29.1, 30.43]], DN.D150, mPipe.L, pipeObj('Отвод УСН-N3 → N5 → коллектор ДТ(Л)'));
  addRun([[-15.35, 31.6], [-15.95, 31.6]], DN.D150, mPipe.X, pipeObj('Обвязка УСН-N1: общий участок к отводам N1 / N3 (АК-045)'));
  addRun([[-15.95, 31.6], [-16.55, 31.6], [-16.55, 30.43]], DN.D150, mPipe.L, pipeObj('Отвод УСН-N1 → N1 → коллектор ДТ(Л)'));
  addRun([[-15.95, 31.6], [-15.95, 31.2], [-15.95, 31.2, HIGH], [-15.95, 29.9, HIGH], [-15.95, 29.9]], DN.D150, mPipe.Z, pipeObj('Отвод УСН-N1 → N3 → коллектор ДТ(З)', 'По АК-004/АК-045; переход над коллектором ДТ(Л) — условно.'));
  addRun([[-15.35, 31.6], [-15.35, 31.2], [-15.35, 31.2, HIGH], [-15.35, 29.4, HIGH], [-15.35, 29.4]], DN.D150, mPipe.B, pipeObj('Отвод УСН-N1 → N2 → коллектор бензина', 'По АК-004/АК-045; переход над коллекторами — условно.'));
  // УНЖ-N1: от стояка УСН-N3 до колонны, подъём до стрелы
  addRun([[-24.8, 34.0], [-24.8, 33.6], [UNZH_C[0], 33.6], [UNZH_C[0], UNZH_C[1]], [UNZH_C[0], UNZH_C[1], YA - 0.15]], DN.D100, mPipe.L, pipeObj('Подвод к УНЖ-N1 Ду100 (от стояка УСН-N3, через FQIT177-03)', 'АК-004: налив летнего ДТ в ВЦ через УНЖ-N1 по общему стояку с УСН-N3 (FQIT177-03, задвижка N5). Положение колонны УНЖ — по АК-045 («УНЖ-N1 в гаражном положении»); высота стрелы — условно.'));
  // Гу: от трассы ГП-005 вверх на настил и к УНЖ
  addRun([[-24.72, 28.78], [-24.72, 28.95], [-24.72, 28.95, HIGH + 0.25], [-24.72, 32.3, HIGH + 0.25], [-24.72, 32.3, PY + 2.3], [UNZH_C[0], 32.3, PY + 2.3], [UNZH_C[0], 33.9, PY + 2.3]], DN.G108, mPipe.G, pipeObj('Газоуравнительная линия Гу к УНЖ-N1', 'Отвод паров от УНЖ-N1 в газоуравнительную обвязку РВС (АК-004); подход к эстакаде — ГП-005, подъём на эстакаду — по АК-045 (вертикаль по x ≈ −24,7), высота — условно.'));
  // УПВС-80С: стойка → обратный клапан → стояк УСН-N1
  addRun([[UPVS_C[0], UPVS_C[1], PY + 1.3], [UPVS_C[0], UPVS_C[1]], [UPVS_C[0], 33.75], [xs1, 33.75]], DN.D80, mPipe.X, pipeObj('Линия УПВС-80С Ду80 → обратный клапан → стояк УСН-N1', 'АК-004: аварийный верхний слив через УПВС-80С в обвязку УСН-N1 через обратный клапан; стойка — по АК-045. Высоты — условно.'));
  // дренаж ⌀273×7: вдоль пути с южной стороны, трапы между цистернами
  const yD = (x, z) => hAt(x, z) + 0.35;
  const dObj = pipeObj('Дренажный трубопровод ⌀273×7 эстакады → ёмкость 139.2', 'По листу АК-045 (вдоль пути с южной стороны, трапы между цистернами) и ГП-005 (подход к 139.2 по x = −1,89). Высота ≈0,35 м — условно.');
  runs.push([[[-28.0, yD(-28.0, 39.35), 39.35], [-2.4, yD(-2.4, 39.35), 39.35], [-1.89, yD(-1.89, 39.5), 39.5]], DN.D273, mPipe.D, dObj]);
  for (const x of [-28.0, -26.35, -14.05]) {
    runs.push([[[x, yD(x, 38.3), 38.3], [x, yD(x, 39.35), 39.35]], 0.06, mPipe.D, dObj]);
    if (x === -14.05) runs.push([[[x, yD(x, 39.35), 39.35], [-14.05, yD(-14.05, 39.35), 39.35]], DN.D273, mPipe.D, dObj]);
  }
  // построение: InstancedMesh по материалу+радиусу, стыки — сферы
  {
    const groups = new Map();
    for (const [pts, r, mt, o] of runs) { const k = mt.uuid + '|' + r; if (!groups.has(k)) groups.set(k, { r, mt, segs: [], joints: [], o }); const G = groups.get(k); for (let i = 0; i < pts.length - 1; i++) G.segs.push([pts[i], pts[i + 1], o]); for (let i = 1; i < pts.length - 1; i++) G.joints.push(pts[i]); }
    for (const G of groups.values()) {
      const im = new THREE.InstancedMesh(gCyl, G.mt, G.segs.length), map = [];
      G.segs.forEach(([a, b, o], i) => { v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v3.length(); q.setFromUnitVectors(UP, v3.normalize()); m4.compose(p3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s3.set(G.r, L + 0.002, G.r)); im.setMatrixAt(i, m4); map[i] = o; });
      im.castShadow = im.receiveShadow = true; im.userData.pick = h => map[h.instanceId]; im.userData.pipeRun = 1; pickables.push(im); g.add(im);
      if (G.joints.length) { const ij = new THREE.InstancedMesh(gSph, G.mt, G.joints.length); G.joints.forEach((p, i) => { m4.compose(p3.set(...p), one, s3.set(G.r * 1.04, G.r * 1.04, G.r * 1.04)); ij.setMatrixAt(i, m4); }); ij.castShadow = true; ij.userData.pipeRun = 1; g.add(ij); }
    }
    // опоры трубопроводов (низкие стойки с ригелем) — через ≈3 м под коллекторами и петлями
    const sup = new BoxBatch(mSteel), base = new BoxBatch(mConc);
    for (let x = -38.4; x <= -15.3; x += 3.0) { const z0 = 29.25, z1 = 30.6, gy = hAt(x, (z0 + z1) / 2); sup.box(0.08, 0.5, 0.08, x, gy + 0.25, z0); sup.box(0.08, 0.5, 0.08, x, gy + 0.25, z1); sup.box(0.08, 0.08, z1 - z0 + 0.15, x, gy + 0.46, (z0 + z1) / 2); base.box(0.3, 0.1, z1 - z0 + 0.4, x, gy + 0.05, (z0 + z1) / 2); }
    for (const L of LOOPS) for (const x of [L.x0 + (L.x1 - L.x0) * 0.15, L.x0 + (L.x1 - L.x0) * 0.85]) { const z0 = L.zb - 0.12, z1 = L.z + 0.12, gy = hAt(x, (z0 + z1) / 2); sup.box(0.08, 0.5, 0.08, x, gy + 0.25, (z0 + z1) / 2); sup.box(0.08, 0.08, z1 - z0, x, gy + 0.46, (z0 + z1) / 2); base.box(0.25, 0.08, 0.3, x, gy + 0.04, (z0 + z1) / 2); }
    for (let x = -27.0; x <= -2.6; x += 3.0) { const gy = hAt(x, 39.35); sup.box(0.08, 0.2, 0.08, x, gy + 0.1, 39.35); base.box(0.3, 0.08, 0.3, x, gy + 0.04, 39.35); }
    sup.build(g); base.build(g);
  }

  /* ---------- 4. Арматура: клиновые задвижки (ручные и с электроприводом), обратный и электромагнитный клапаны ---------- */
  // ax — ось трубы ('x' | 'z' | 'y'); id — арматура графа (положение берётся из procLogic), иначе — постоянное состояние open
  const VL = [];
  const addV = (id, x, y, z, ax, r, kind, nm2, note, open = true) => VL.push({ id, x, y, z, ax, r, kind, nm: nm2, note, open });
  for (const [id, xx, zz, ax] of [['УСН-N2', xs2, 34.15, 'z'], ['УСН-N3', -23.5, 34.3, 'x'], ['УСН-N1', xs1, 34.15, 'z']]) addV(id, xx, yP(xx, zz), zz, ax, DN.D150, 'R');
  for (const [id, xx, zz, yy] of [['N4', -30.8, 30.85], ['N5', -29.1, 30.85], ['N1', -16.55, 30.85], ['N3', -15.95, 30.95, HIGH], ['N2', -15.35, 30.95, HIGH]]) addV(id, xx, yy !== undefined ? yy : yP(xx, zz), zz, 'z', DN.D150, 'M');
  for (const [id, zz, r] of [['N7', 30.43, DN.L219], ['N6', 29.9, DN.P159], ['N8', 29.4, DN.P159]]) addV(id, -37.8, yP(-37.8, zz), zz, 'x', r, 'M');
  addV('СЕНС-УНЖ', UNZH_C[0], YA - 0.45, UNZH_C[1], 'y', DN.D100, 'S');
  addV('УПВС', UPVS_C[0], PY + 0.7, UPVS_C[1], 'y', DN.D80, 'R');
  addV(null, UPVS_C[0], yP(UPVS_C[0], 33.75), 33.85, 'z', DN.D80, 'C', 'Обратный клапан линии УПВС-80С', 'АК-004: подключение УПВС-80С к обвязке УСН-N1 через обратный клапан (поток — только в сторону УСН-N1).');
  for (const L of LOOPS) {
    const xz = x => [x, yP(x, L.z), L.z];
    addV(null, ...xz(L.xin), 'x', DN.D150, 'R', `Задвижка на входе узла учёта ${nm[L.k]}`, 'Ручная задвижка петли обвязки — по АК-045/АК-004. В модели постоянно открыта (отключение — задвижкой УСН и электрозадвижками).');
    addV(null, ...xz(L.xout), 'x', DN.D150, 'R', `Задвижка на выходе узла учёта ${nm[L.k]}`, 'Ручная задвижка петли обвязки — по АК-045/АК-004. В модели постоянно открыта.');
    addV(null, L.xbv, yP(L.xbv, L.zb), L.zb, 'x', DN.D150, 'R', `Задвижка байпаса ${L.fq}`, 'Байпас фильтра и расходомера — по АК-045/АК-004. Нормально закрыта (в модели — постоянно закрыта).', false);
  }
  {
    const parts = { body: [], fl: [], bonnet: [], yoke: [], wheel: [], act: [], motor: [], coil: [], stem: [], gsk: [], fl2: [], neck: [], bolt: [], nut: [], bvb: [], bvh: [], bvk: [], bva: [], bvd: [] };
    for (const v of VL) if (/^N[1-5]$/.test(v.id || '')) v.bv = 1;   // v0.22: N1–N5 — краны шаровые F190F DN150 с электроприводом Biffi F02-500 (177-ТХ.С-001-0 поз. 5)
    const basis = ax => ax === 'x' ? new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0)) : ax === 'z' ? new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0, 1)) : new THREE.Quaternion();
    const side = ax => ax === 'y' ? new THREE.Vector3(0, 0, -1) : UP.clone();                // направление шпинделя
    VL.forEach((v, i) => {
      const r = v.r, qa = basis(v.ax), sd = side(v.ax), sq = new THREE.Quaternion().setFromUnitVectors(UP, sd), c = new THREE.Vector3(v.x, v.y, v.z);
      const at = d => c.clone().addScaledVector(sd, d);
      const axv = v.ax === 'x' ? new THREE.Vector3(1, 0, 0) : v.ax === 'z' ? new THREE.Vector3(0, 0, 1) : UP.clone();
      if (v.bv) { parts.bvb.push([c.clone(), qa, [r * 1.8, r * 1.95, r * 1.8], i]); for (const s of [-1, 1]) parts.bvh.push([c.clone().addScaledVector(axv, s * r * 1.3), qa, [r * 1.45, r * 0.8, r * 1.45], i]); }   // шаровой корпус, патрубки
      else parts.body.push([c.clone(), qa, [r * 1.55, r * 3.2, r * 1.55], i]);
      for (const s of [-1, 1]) parts.fl.push([c.clone().addScaledVector(axv, s * r * 1.75), qa, [r * 1.75, 0.035, r * 1.75], i]);
      {   // v0.14: ответные фланцы трубы, прокладки, шпильки с гайками (PN16, условно)
        const F = flangeOfOD(2 * r), t = F[4], nb = F[2], db = F[3], pcd = Math.min(F[1] / 2, r * 1.75 - db * 0.9), f0 = r * 1.75 + 0.0175;
        const e1 = new THREE.Vector3(axv.y, axv.z, axv.x), e2 = new THREE.Vector3().crossVectors(axv, e1);
        for (const s of [-1, 1]) {
          const at = d => c.clone().addScaledVector(axv, s * d);
          parts.gsk.push([at(f0 + 0.0015), qa, [pcd - db * 0.7, 0.003, pcd - db * 0.7], i]);
          parts.fl2.push([at(f0 + 0.003 + t / 2), qa, [r * 1.75, t, r * 1.75], i]);
          parts.neck.push([at(f0 + 0.003 + t + 0.012), qa, [r * 1.22, 0.024, r * 1.22], i]);
          const x0 = f0 - 0.047, x1 = f0 + 0.015 + t;
          for (let k = 0; k < nb; k++) {
            const a = (k + 0.5) / nb * Math.PI * 2, off = e1.clone().multiplyScalar(Math.cos(a) * pcd).addScaledVector(e2, Math.sin(a) * pcd);
            parts.bolt.push([at((x0 + x1) / 2).add(off), qa, [db / 2, x1 - x0, db / 2], i]);
            for (const xn of [x0 + 0.0065, x1 - 0.0065]) parts.nut.push([at(xn).add(off), qa, [db * 0.85, 0.013, db * 0.85], i]);
          }
          FLANGE_STAT.valve++;
        }
      }
      if (v.kind === 'C') { parts.bonnet.push([at(r * 1.2), sq, [r * 0.9, r * 0.6, r * 0.9], i]); return; }
      if (v.kind === 'S') { parts.coil.push([at(r * 2.2), sq, [r * 1.1, r * 1.8, r * 1.1], i]); parts.bonnet.push([at(r * 1.2), sq, [r * 0.6, r * 0.9, r * 0.6], i]); return; }
      if (v.bv) {   // габариты крана и привода — условно (паспортов изделий нет); поворот на 90°, указатель положения
        const e2 = new THREE.Vector3().crossVectors(sd, axv).normalize(), qS = new THREE.Quaternion().setFromUnitVectors(UP, e2), qW = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), e2);
        const y0 = r * 1.75, yPd = y0 + 0.035, yA = yPd + 0.12, hA = 0.3;
        parts.bonnet.push([at(y0 - r * 0.1), sq, [r * 0.55, r * 0.6, r * 0.55], i]);                 // горловина шпинделя
        parts.yoke.push([at(yPd), sq, [r * 2.1, 0.03, r * 2.1], i]);                                  // монтажная площадка ISO 5211
        parts.bvk.push([at(yPd + 0.06), sq, [0.055, 0.12, 0.055], i]);                                 // адаптер с муфтой
        parts.bva.push([at(yA + hA / 2), sq, [0.17, hA, 0.17], i]);                                   // корпус привода EEx d
        parts.act.push([at(yA + 0.12).addScaledVector(axv, 0.2), sq, [0.12, 0.16, 0.1], i]);          // клеммная коробка EEx e
        parts.motor.push([at(yA + 0.1).addScaledVector(e2, 0.2), qS, [0.085, 0.26, 0.085], i]);        // электродвигатель
        parts.wheel.push([at(yA + 0.16).addScaledVector(e2, -0.21), qW, [0.13, 0.13, 0.13], i]);       // маховик ручного дублёра
        parts.bvd.push([at(yA + hA + 0.025), sq, [0.07, 0.05, 0.07], i]);                              // колпак указателя положения
        v.ind = at(yA + hA + 0.055); v.sd = sd; v.e2 = e2; v.axv = axv; v.ang = null;
        return;
      }
      parts.bonnet.push([at(r * 1.9), sq, [r * 0.75, r * 1.6, r * 0.75], i]);
      parts.yoke.push([at(r * 3.2), sq, [r * 1.3, r * 1.2, r * 0.35], i]);
      v.stemBase = at(r * 3.0); v.sd = sd; v.sq = sq; v.stemL = r * 2.6; v.sl = 0;
      if (v.kind === 'M') { parts.act.push([at(r * 4.4), sq, [0.24, 0.26, 0.2], i]); const mpos = at(r * 4.4).add(new THREE.Vector3(0.2, 0, 0)); parts.motor.push([mpos, new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0)), [0.085, 0.24, 0.085], i]); parts.wheel.push([at(r * 4.4).add(new THREE.Vector3(-0.17, 0, 0)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)), [0.12, 0.12, 0.12], i]); }
      else parts.wheel.push([at(r * 4.0), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sd), [Math.max(0.13, r * 1.6), Math.max(0.13, r * 1.6), Math.max(0.13, r * 1.6)], i]);
      parts.stem.push([null, null, null, i]);
    });
    const vObj = i => { const v = VL[i]; if (v.id && typeof procValveObj === 'function') return procValveObj(v.id);
      return { id: v.kind === 'C' ? 'КО' : 'задв.', net: 1, name: v.nm, note: v.note }; };
    const mk = (geo, mt, arr) => { const im = new THREE.InstancedMesh(geo, mt, Math.max(arr.length, 1)); im.count = arr.length; arr.forEach(([p, qq, s], k) => { if (p) { m4.compose(p, qq, s3.set(...s)); im.setMatrixAt(k, m4); } }); im.castShadow = true; im.userData.pick = h => vObj(arr[h.instanceId][3]); pickables.push(im); g.add(im); return im; };
    mk(gCyl, mDark, parts.body); mk(gCyl, mSteel, parts.fl); mk(gCyl, mDark, parts.bonnet); mk(gBox, mSteel, parts.yoke);
    mk(gTor, mRed, parts.wheel); mk(gBox, mBlue, parts.act); mk(gCyl, mBlue, parts.motor); mk(gCyl, mYel, parts.coil);
    mk(gSph, mDark, parts.bvb); mk(gCyl, mDark, parts.bvh); mk(gCyl, mSteel, parts.bvk); mk(gCyl, mBlue, parts.bva); mk(gCyl, mGauge, parts.bvd);   // v0.22: краны шаровые N1–N5
    const bvList = VL.filter(v => v.bv), bvIM = new THREE.InstancedMesh(gBox, mYel, Math.max(bvList.length, 1)); bvIM.count = bvList.length; bvIM.castShadow = true; g.add(bvIM);
    var BVP = { im: bvIM, list: bvList };   // стрелка указателя: вдоль трубы — открыт, поперёк — закрыт
    { const gHexE = new THREE.CylinderGeometry(1, 1, 1, 6), gStudE = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); FAST_LOD.push(mk(gCyl, mDark, parts.gsk)); mk(gCyl, mSteel, parts.fl2); mk(gCyl, mSteel, parts.neck); FAST_LOD.push(mk(gStudE, mDark, parts.bolt), mk(gHexE, mDark, parts.nut)); }   // v0.14
    const stemIM = new THREE.InstancedMesh(gCyl, SM(0xc9ced3, { metalness: 0.9, roughness: 0.25 }), Math.max(parts.stem.length, 1)); stemIM.count = parts.stem.length; g.add(stemIM);
    var STEM = { im: stemIM, list: parts.stem.map(s => VL[s[3]]) };
    // индикаторы состояния (зелёный/красный) — над приводом/маховиком; маркер-заглушка графа не рисуется (как у задвижек РВС)
    for (const v of VL) if (v.id) RVSD.ind[v.id] = v.ax === 'y' ? [v.x, v.y + 0.45, v.z + 0.25] : v.bv ? [v.x, v.ind.y + 0.14, v.z] : [v.x, v.y + v.r * 4.4 + (v.kind === 'M' ? 0.32 : 0.22), v.z];
  }

  /* ---------- 5. Фильтры, расходомеры, манометры, реле потока ---------- */
  for (const L of LOOPS) {
    const y = yP(L.xf, L.z), dirx = Math.sign(L.x1 - L.x0) || 1;
    const fo = { id: 'Ф', net: 1, name: `Фильтр сетчатый Ду150 — обвязка ${nm[L.k]}`, note: `Положение — по АК-045; фильтр с манометрами ${L.pi[0]} (до) и ${L.pi[1]} (после), шкала 0,027 МПа по АК-004 — перепад показывает засорение сетки. Тип и типоразмер фильтра — условно.` };
    const fb = mesh(gCyl, mSteel, g, fo); fb.scale.set(0.17, 0.62, 0.17); fb.rotation.z = Math.PI / 2; fb.position.set(L.xf, y, L.z);
    const cap = mesh(gCyl, mDark, g, fo); cap.scale.set(0.2, 0.05, 0.2); cap.rotation.z = Math.PI / 2; cap.position.set(L.xf + dirx * 0.34, y, L.z);
    const sump = mesh(gCyl, mSteel, g, fo); sump.scale.set(0.09, 0.28, 0.09); sump.position.set(L.xf, y - 0.22, L.z);
    for (const [k, dx] of [[0, -0.45], [1, 0.45]]) {
      const x = L.xf + dirx * dx, po = { id: L.pi[k], net: 1, name: `Манометр ${L.pi[k]}`, note: `Манометр показывающий ${k ? 'после' : 'до'} фильтра (АК-004: шкала 0,027 МПа; на АК-045 — ${L.pi[k]}). Модель условная.` };
      cylAB([x, y + 0.08, L.z], [x, y + 0.32, L.z], 0.012, mSteel);
      const d = mesh(gCyl, mGauge, g, po); d.scale.set(0.065, 0.03, 0.065); d.rotation.x = Math.PI / 2; d.position.set(x, y + 0.38, L.z - 0.02);
      const rim = mesh(gTor, mDark); rim.scale.set(0.066, 0.066, 0.1); rim.position.set(x, y + 0.38, L.z - 0.036);
    }
    const qo = { id: L.fq, net: 1, name: `Расходомер-счётчик ${L.fq}`, note: `Узел учёта ${nm[L.k]} — по АК-045/АК-004 (PROFIBUS PA). Показания в модели — на вкладке «Технология → Маршруты» во время перекачки. Тип прибора на листах не указан — модель условная.` };
    const sp = mesh(gCyl, mSteel, g, qo); sp.scale.set(0.105, 0.55, 0.105); sp.rotation.z = Math.PI / 2; sp.position.set(L.xq, y, L.z);
    const hd = mesh(gBox, mBlue, g, qo); hd.scale.set(0.2, 0.18, 0.16); hd.position.set(L.xq, y + 0.24, L.z);
    const dsp = mesh(gBox, SM(0x162a3a, { emissive: 0x2a8f5a, emissiveIntensity: 0.25 }), g, qo); dsp.scale.set(0.12, 0.08, 0.01); dsp.position.set(L.xq, y + 0.26, L.z - 0.085);
    const ao = { id: L.fa, net: 1, name: `Реле потока ${L.fa}`, note: 'Сигнализатор потока на линии узла учёта (АК-004). Модель условная.' };
    const fa = mesh(gBox, mYel, g, ao); fa.scale.set(0.1, 0.1, 0.08); fa.position.set(L.xq + dirx * 0.55, y + 0.15, L.z);
  }
  // PT/TT на коллекторах (АК-004: 177-08/09 — ДТ(З), 177-10/11 — ДТ(Л), 177-12/13 — Б)
  for (const [x, z, t1, t2, pr] of [[-31.4, 30.43, 'PT177-10', 'TT177-11', 'ДТ(Л)'], [-17.1, 29.9, 'PT177-08', 'TT177-09', 'ДТ(З)'], [-16.9, 29.4, 'PT177-12', 'TT177-13', 'Б']]) {
    const y = yP(x, z), o = { id: t1, net: 1, name: `${t1} / ${t2} — давление и температура, коллектор ${pr}`, note: 'По АК-004 (перечень приборов эстакады) и АК-045 (положение вдоль коллекторов — приблизительно). PROFIBUS PA. Модели датчиков — условно.' };
    cylAB([x, y + 0.08, z], [x, y + 0.36, z], 0.015, mSteel);
    const b1 = mesh(gCyl, mBlue, g, o); b1.scale.set(0.06, 0.14, 0.06); b1.position.set(x, y + 0.43, z);
    cylAB([x + 0.3, y + 0.08, z], [x + 0.3, y + 0.3, z], 0.012, mSteel);
    const b2 = mesh(gBox, SM(0xd8d8d0), g, o); b2.scale.set(0.11, 0.11, 0.11); b2.position.set(x + 0.3, y + 0.36, z);
  }
  // QE-5a (датчик загазованности), QA-5б (свето-звуковая сигнализация), пульты, КС-4, аварийный приямок
  { const o = { id: 'QE-5a', net: 1, name: 'Датчик загазованности QE-5a (ДАТ-М) — ж/д эстакада', note: 'АК-004: 2 порога; при ДВК > 50 % НКПР — отключение насосов слива/налива. Положение — по АК-045; высота установки (низ, пары тяжелее воздуха) — условно.' };
    const gy = hAt(-17.84, 31.8); cylAB([-17.84, gy, 31.8], [-17.84, gy + 0.55, 31.8], 0.025, mSteel); const s = mesh(gCyl, SM(0xd9a419), g, o); s.scale.set(0.07, 0.16, 0.07); s.position.set(-17.84, gy + 0.62, 31.8); }
  { const o = { id: 'QA-5б', net: 1, name: 'Сигнализация загазованности QA-5б (свет, звук)', note: 'По АК-045. Модель условная.' };
    const l = mesh(gCyl, SM(0xff5a2a, { emissive: 0x802000, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }), g, o); l.scale.set(0.07, 0.12, 0.07); l.position.set(E.AX[3], PY - 1.2, zd0 + 0.28); }
  E.pults = [];
  for (const [i, x, nm2] of [[0, -32.2, 'ПУ-СН (УСН-N2)'], [1, -21.0, 'ПУ-1 (УСН-N3 / УНЖ-N1)'], [2, -8.1, 'ПУ-СН (УСН-N1 / УПВС)']]) {
    const o = { id: 'ПУ', net: 1, name: `Пульт слива-налива ${nm2}`, note: 'АК-004: 4 пульта слива/налива на эстакаде — кнопки «Пуск» H177-20…23, «Стоп» H177-24…27; ESD-кнопки HS/SB 91, 92. Положение на настиле — по АК-045 (приблизительно), конструкция — условно.' };
    const b = mesh(gBox, SM(0x8a929a, { metalness: 0.4 }), g, o); b.scale.set(0.26, 0.34, 0.14); b.position.set(x, PY + 1.25, zd1 - 0.12);
    cylAB([x, PY, zd1 - 0.12], [x, PY + 1.08, zd1 - 0.12], 0.025, mSteel);
    for (const [dx, mt] of [[-0.06, mGreen], [0.06, mRed]]) { const k = mesh(gCyl, mt); k.scale.set(0.028, 0.03, 0.028); k.rotation.x = Math.PI / 2; k.position.set(x + dx, PY + 1.28, zd1 - 0.04); }
  }
  { const o = { id: 'КС-4', net: 1, name: 'Коробка соединительная КС-4', note: 'По АК-045 (западный торец эстакады). Модель условная.' };
    const gy = hAt(-34.5, 32.74); cylAB([-34.5, gy, 32.74], [-34.5, gy + 1.05, 32.74], 0.03, mSteel); const b = mesh(gBox, SM(0xc9c9d6), g, o); b.scale.set(0.32, 0.38, 0.16); b.position.set(-34.5, gy + 1.25, 32.74); }
  { const o = { id: 'приямок', net: 1, name: 'Аварийный технологический приямок 1000×1000×1800', note: 'По АК-045 (северо-восточный угол площадки эстакады). Решётка и конструкция — условно.' };
    const [x, z] = [-3.23, 29.47], gy = hAt(x, z);
    const rim = new BoxBatch(mConc); rim.box(1.3, 0.25, 0.15, x, gy - 0.05, z - 0.575); rim.box(1.3, 0.25, 0.15, x, gy - 0.05, z + 0.575); rim.box(0.15, 0.25, 1.0, x - 0.575, gy - 0.05, z); rim.box(0.15, 0.25, 1.0, x + 0.575, gy - 0.05, z); rim.build(g);
    const pit = mesh(gBox, SM(0x2c2a27, { metalness: 0, roughness: 1 }), g, o); pit.scale.set(1.0, 0.02, 1.0); pit.position.set(x, gy - 0.12, z);
    const gr = mesh(gBox, SM(0x6d7378, { metalness: 0.6, transparent: true, opacity: 0.85 }), g, o); gr.scale.set(1.04, 0.03, 1.04); gr.position.set(x, gy + 0.06, z); }
  // трапы дренажа и кнопки механизма передвижения вагонов (лебёдка 901) — АК-045
  for (const x of [-28.0, -26.35, -14.05]) {
    const gy = hAt(x, 38.3), o = { id: 'трап', net: 1, name: 'Трап дренажа эстакады', note: 'По АК-045: приём проливов в межпутье → дренажный трубопровод ⌀273×7 → ёмкость 139.2. Конструкция — условно.' };
    const t = mesh(gCyl, mDark, g, o); t.scale.set(0.2, 0.06, 0.2); t.position.set(x, gy + 0.03, 38.3);
    const k = { id: 'лебёдка', net: 1, name: 'Пост кнопочный механизма передвижения вагонов (лебёдка 901)', note: 'По АК-045: «кнопки механизма управления лебёдкой» у противопожарной стены. Конструкция поста — условно.' };
    const gy2 = hAt(x, 39.75); cylAB([x, gy2, 39.75], [x, gy2 + 1.0, 39.75], 0.03, mSteel); const b = mesh(gBox, SM(0xe0c040), g, k); b.scale.set(0.16, 0.24, 0.12); b.position.set(x, gy2 + 1.15, 39.75);
  }

  /* ---------- 6. Подвижные устройства: УСН ×3, УНЖ-N1, УПВС-80С, переходные мостики МП-4 (v0.22 — по данным ТХ и изготовителей) ----------
     Положение стоек, кинематика (парковка ↔ работа), ключи anim и ход операций ESTOPS — как в v0.8–v0.21.
     Узлы собраны в геометрию с цветами вершин (GK): один узел — один вызов отрисовки. */
  const anim = {};
  const ARM = 1.55, YAR = RH + 0.45, YDR = RH + 0.6;                        // плечи шарнирного трубопровода УСН (условно); ось; низ сливного прибора
  const CD = { pipe: 0xa9b2b8, joint: 0x3d4247, alu: 0xc9ced3, red: 0xb3312b, yel: 0xd9a92b, rub: 0x1b1c1e, dark: 0x2a2d30, blue: 0x3f6f99, grey: 0x7d858c };
  const V3 = GK.V, Yax = V3(0, 1, 0), Xax = V3(1, 0, 0), Zax = V3(0, 0, 1);   // V занято (PROC.valves)
  const kit = () => GK.builder();
  const put = (B, mat, parent, o) => { const me = B.mesh(mat); parent.add(me); if (o) { me.userData.o = o; pickables.push(me); } return me; };
  function fmt2(v) { return v.toFixed(2).replace('.', ','); }
  function joint(B, c, r, axis = Yax, h = 0.2) {   // роликовый шарнир: корпус, два фланца с болтовыми поясами
    const a = c.clone().addScaledVector(axis, -h / 2), b = c.clone().addScaledVector(axis, h / 2);
    B.cyl(a, b, r, CD.joint, 20);
    for (const s of [-1, 1]) { const f = c.clone().addScaledVector(axis, s * (h / 2 - 0.015)); B.cyl(f.clone().addScaledVector(axis, -0.016), f.clone().addScaledVector(axis, 0.016), r * 1.32, CD.joint, 22); B.ring(f.clone().addScaledVector(axis, s * 0.018), axis, r * 1.16, 0.011, CD.dark, 12); }
  }
  const usnObj = k => ({ id: nm[k], net: 1, est: k, name: `Устройство нижнего слива ${nm[k]} (УСН-150-04, Ду150)`,
    note: `177-ТХ.С-001-0 поз. 1, 177-ТХ.ОЛ-001-0: Ду150, Ру 0,6 МПа, Q 320 м³/ч (светлые), 155 кг; без подогрева; установочные H 340, h 86, L 2030 мм. ` +
      `Назначение: ${k === 'USN1' ? 'летнее и зимнее ДТ, бензин' : 'летнее ДТ'} (177-ТХ-001-0). Положение стойки — по АК-045. ` +
      `Шарнирно-сочленённый трубопровод из двух плеч на роликовых шарнирах, пружинный балансир в защитном кожухе, присоединительная головка из алюминиевого сплава с прихватами под один штурвал, поручни — по открытым данным изготовителя (продавца) УСН-150. ` +
      `Длины плеч (${fmt2(ARM)} м), окраска и форма деталей — условно (паспорта изделия нет).` });
  for (const k of ['USN2', 'USN3', 'USN1']) {
    const x0 = XS[k], ci = CAR_IDX[k], cx = car[ci], o = usnObj(k);
    const G = new THREE.Group(); g.add(G);
    const gy = hAt(x0, ZS), yc = yP(x0, ZS);
    // неподвижная часть: фундамент, стояк от коллектора, опорный шарнир, стойка-ложемент парковки
    const S0 = kit();
    S0.box(0.55, 0.16, 0.55, x0, gy + 0.08, ZS, 0xa8a49a);
    S0.cyl(V3(x0, yc, ZS), V3(x0, YAR - 0.13, ZS), 0.0795, CD.pipe, 18);
    S0.cyl(V3(x0, YAR - 0.2, ZS), V3(x0, YAR - 0.17, ZS), 0.142, CD.joint, 22);
    S0.bar(V3(x0 + 0.05, gy + 0.16, ZS + 0.18), V3(x0 + 0.05, YAR - 0.22, ZS + 0.06), 0.06, 0.06, CD.grey);
    const park = [Math.PI + 0.2, -0.15];
    const pk = [x0 + ARM * Math.cos(park[0]) + ARM * Math.cos(park[1]), ZS + ARM * Math.sin(park[0]) + ARM * Math.sin(park[1])], gp = hAt(pk[0], pk[1]);
    S0.box(0.3, 0.1, 0.3, pk[0], gp + 0.05, pk[1], 0xa8a49a);
    S0.cyl(V3(pk[0], gp + 0.1, pk[1]), V3(pk[0], YAR - 0.1, pk[1]), 0.035, CD.grey, 10);
    S0.box(0.3, 0.04, 0.06, pk[0], YAR - 0.09, pk[1] - 0.08, CD.grey); S0.box(0.3, 0.04, 0.06, pk[0], YAR - 0.09, pk[1] + 0.08, CD.grey);   // ложемент
    put(S0, GK.MAT.paint, G, o);
    // плечо 1 (вращается вокруг стояка): опорный шарнир, труба, балансир в кожухе
    const A1 = kit();
    joint(A1, V3(0, 0, 0), 0.115, Yax, 0.24);
    A1.cyl(V3(0.1, 0, 0), V3(ARM - 0.12, 0, 0), 0.0795, CD.pipe, 18);
    A1.cyl(V3(0.28, 0.24, 0), V3(1.02, 0.15, 0), 0.06, CD.yel, 14);                     // кожух пружинного балансира
    A1.cyl(V3(1.02, 0.15, 0), V3(1.28, 0.11, 0), 0.016, CD.alu, 8);
    A1.box(0.08, 0.2, 0.05, 0.25, 0.13, 0, CD.joint); A1.box(0.08, 0.14, 0.05, 1.3, 0.06, 0, CD.joint);
    const a1 = put(A1, GK.MAT.paint, G, o); a1.position.set(x0, YAR, ZS);
    // плечо 2: межплечевой шарнир, труба, концевой шарнир, поручень
    const A2 = kit();
    joint(A2, V3(0, 0, 0), 0.11, Yax, 0.22);
    A2.cyl(V3(0.1, 0, 0), V3(ARM - 0.1, 0, 0), 0.0795, CD.pipe, 18);
    joint(A2, V3(ARM, 0, 0), 0.1, Yax, 0.2);
    A2.cyl(V3(ARM - 0.55, 0.11, 0.12), V3(ARM - 0.55, 0.32, 0.12), 0.014, CD.yel, 6); A2.cyl(V3(ARM - 0.2, 0.11, 0.12), V3(ARM - 0.2, 0.32, 0.12), 0.014, CD.yel, 6);
    A2.cyl(V3(ARM - 0.55, 0.32, 0.12), V3(ARM - 0.2, 0.32, 0.12), 0.014, CD.yel, 6);   // поручень
    const a2 = put(A2, GK.MAT.paint, G, o);
    // присоединительная головка (алюминиевый сплав): патрубок вверх, фланец с уплотнением, прихваты, штурвал
    const H = kit();
    H.cyl(V3(0, 0.1, 0), V3(0, 0.2, 0), 0.0795, CD.pipe, 18);
    H.cyl(V3(0, 0.2, 0), V3(0, 0.3, 0), 0.15, CD.alu, 24); H.cyl(V3(0, 0.3, 0), V3(0, 0.315, 0), 0.12, CD.rub, 24);
    for (const s of [-1, 1]) { H.box(0.04, 0.16, 0.05, s * 0.16, 0.3, 0, CD.alu); H.box(0.07, 0.03, 0.05, s * 0.135, 0.37, 0, CD.alu); }   // прихваты
    H.cyl(V3(0, 0.25, 0.15), V3(0, 0.25, 0.3), 0.012, CD.alu, 6); H.ring(V3(0, 0.25, 0.31), Zax, 0.13, 0.012, CD.red, 22);
    for (let k2 = 0; k2 < 3; k2++) { const a = k2 * Math.PI * 2 / 3; H.cyl(V3(0, 0.25, 0.31), V3(0.13 * Math.cos(a), 0.25 + 0.13 * Math.sin(a), 0.31), 0.007, CD.red, 4); }
    const head = put(H, GK.MAT.steel, G, o);
    // земля (заземляющий проводник) — виден при подключении
    const gnd = mesh(gCyl, SM(0x2a7a2a)), gclip = mesh(gBox, mYel); gnd.visible = gclip.visible = false; gclip.scale.set(0.08, 0.05, 0.05);
    const ik = () => { const dx = cx - x0, dz = TZ - ZS, d = Math.min(Math.hypot(dx, dz), 2 * ARM - 1e-3), ph = Math.atan2(dz, dx), al = Math.acos(d / (2 * ARM)), t1 = ph + al, ex = x0 + ARM * Math.cos(t1), ez = ZS + ARM * Math.sin(t1); return [t1, Math.atan2(TZ - ez, cx - ex)]; };
    const work = ik();
    let unwrap = work[0]; while (unwrap > park[0]) unwrap -= 2 * Math.PI; while (unwrap < park[0] - 2 * Math.PI + 0.01) unwrap += 2 * Math.PI;
    if (park[0] - unwrap > Math.PI * 1.5) unwrap += 2 * Math.PI;
    const set = t => {   // t: 0 — парковка (головка на ложементе), 1 — подсоединено к сливному прибору
      const e = t * t * (3 - 2 * t), t1 = park[0] + (unwrap - park[0]) * e;
      let t2w = work[1]; while (t2w - park[1] > Math.PI) t2w -= 2 * Math.PI; while (t2w - park[1] < -Math.PI) t2w += 2 * Math.PI;
      const t2 = park[1] + (t2w - park[1]) * e;
      const j2 = [x0 + ARM * Math.cos(t1), YAR, ZS + ARM * Math.sin(t1)], j3 = [j2[0] + ARM * Math.cos(t2), YAR, j2[2] + ARM * Math.sin(t2)];
      a1.rotation.y = -t1; a2.position.set(...j2); a2.rotation.y = -t2;
      head.position.set(j3[0], YAR - 0.215 + (YDR - 0.315 - (YAR - 0.215)) * e, j3[2]); head.rotation.y = -t2;   // при подключении головка поднимается к фланцу сливного прибора
    };
    set(0);
    anim[k] = { t: 0, target: 0, set, gnd, gclip, x0, cx, G };
    const ga = [x0 + 0.15, YAR - 0.2, ZS + 0.1], gb = [cx - TCAR.D.HB, RH + 1.0, TZ - 1.36];   // проводник к шкворневой балке рамы цистерны
    placeAB(gnd, ga, gb, 0.008); gclip.position.set(...gb);
  }
  // УНЖ-N1 (УНЖ6-100АС-02.04, исп. 3, левое): стояк, поворотный шарнир, консоль с противовесом и пружинным уравновешиванием,
  // наливная труба с герметизирующей крышкой, жёсткий пароотвод (Гу), датчик СЖУ-1-2, пульт управления
  {
    const [cx0, cz0] = UNZH_C, tx = car[1], o = { id: 'УНЖ-N1', net: 1, est: 'UNZH', name: 'Устройство верхнего налива УНЖ-N1 (УНЖ6-100АС-02.04, исп. 3, Ду100)',
      note: '177-ТХ.С-001-0 поз. 2, 177-ТХ.ОЛ-002-0: Ду100, Ру 1,0 МПа, Q 150 м³/ч; 350 кг; исполнение 3, левое (основное); крышка с пароотводом; прекращение налива — ручное, по уровню (автономная заслонка и электрифицированное), по дозе; клапан СЕНС-ПР DN80/32 PN25, датчик СЖУ-1-2, пульт. ' +
        'Положение стояка — по АК-045. Компоновка стояк — поворотный шарнир — консоль с противовесом — наливная труба — крышка — по типовой конструкции устройств налива; высоты и длины — условно (паспорта изделия нет).' };
    const G = new THREE.Group(); g.add(G);
    const gy = hAt(cx0, cz0);
    const S0 = kit();
    S0.box(0.6, 0.2, 0.6, cx0, gy + 0.1, cz0, 0xa8a49a); S0.cyl(V3(cx0, gy + 0.2, cz0), V3(cx0, gy + 0.23, cz0), 0.2, CD.joint, 20);
    S0.cyl(V3(cx0, gy + 0.23, cz0), V3(cx0, YA - 0.18, cz0), 0.0545, CD.pipe, 18);                 // стояк Ду100
    S0.cyl(V3(cx0, gy + 0.23, cz0 - 0.2), V3(cx0, YA - 0.3, cz0 - 0.2), 0.07, CD.grey, 12);        // опорная колонна
    for (const y of [PY - 0.2, PY + 0.8]) S0.bar(V3(cx0, y, cz0 - 0.2), V3(cx0, y, cz0 - 0.95), 0.07, 0.07, CD.grey);   // связи с эстакадой
    joint(S0, V3(cx0, YA - 0.08, cz0), 0.1, Yax, 0.22);
    { const px = cx0 + 0.75, pz = Math.min(cz0 - 0.9, zd1 - 0.25); S0.cyl(V3(px, PY, pz), V3(px, PY + 1.0, pz), 0.03, CD.grey, 8); S0.box(0.32, 0.42, 0.18, px, PY + 1.2, pz, CD.blue); S0.cyl(V3(px - 0.08, PY + 1.25, pz + 0.09), V3(px - 0.08, PY + 1.25, pz + 0.11), 0.03, 0x2e8b4a, 10); S0.cyl(V3(px + 0.08, PY + 1.25, pz + 0.09), V3(px + 0.08, PY + 1.25, pz + 0.11), 0.03, CD.red, 10); }   // пульт
    put(S0, GK.MAT.paint, G, o);
    const LA = Math.hypot(tx - cx0, TZ - cz0), yw = Math.atan2(TZ - cz0, tx - cx0), ypark = Math.PI;
    const C1 = kit();   // консоль (поворачивается вокруг стояка)
    C1.cyl(V3(-0.7, 0, 0), V3(LA, 0, 0), 0.0545, CD.pipe, 18);
    C1.box(0.42, 0.34, 0.3, -0.85, -0.05, 0, CD.grey);                                         // противовес
    C1.cyl(V3(0.05, 0.62, 0), V3(LA * 0.75, 0.06, 0), 0.02, CD.grey, 8); C1.cyl(V3(0, 0.08, 0), V3(0, 0.66, 0), 0.03, CD.grey, 8);   // тяга
    C1.cyl(V3(-0.15, 0.5, 0.09), V3(0.55, 0.1, 0.09), 0.055, CD.yel, 14);                          // пружинный механизм уравновешивания
    joint(C1, V3(LA, 0, 0), 0.09, Yax, 0.32);                                                   // направляющая наливной трубы
    const con = put(C1, GK.MAT.paint, G, o); con.position.set(cx0, YA, cz0);
    // наливная труба и герметизирующая крышка (перемещаются по вертикали)
    const T1 = kit();
    T1.cyl(V3(0, 0, 0), V3(0, -1, 0), 0.0545, CD.pipe, 16);
    const tube = put(T1, GK.MAT.paint, G, o);
    const K1 = kit();
    const dish = new THREE.LatheGeometry([[0.0, 0.0], [0.34, 0.0], [0.34, 0.03], [0.3, 0.09], [0.12, 0.14], [0.0, 0.14]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    K1.add(dish, CD.grey); K1.cyl(V3(0, -0.02, 0), V3(0, 0.0, 0), 0.33, CD.rub, 28);
    K1.cyl(V3(0.2, 0.08, 0), V3(0.2, 0.28, 0), 0.04, CD.grey, 12); K1.ring(V3(0.2, 0.28, 0), Yax, 0.05, 0.012, CD.joint, 12);   // патрубок пароотвода
    K1.box(0.08, 0.14, 0.08, -0.2, 0.18, 0.12, CD.yel); K1.cyl(V3(-0.2, 0.1, 0.12), V3(-0.2, -0.5, 0.12), 0.01, CD.alu, 6);   // СЖУ-1-2
    for (const s of [-1, 1]) K1.cyl(V3(s * 0.3, 0.06, 0), V3(s * 0.3, 0.32, 0), 0.012, CD.yel, 6);
    K1.cyl(V3(-0.3, 0.32, 0), V3(0.3, 0.32, 0), 0.012, CD.yel, 6);                                // рукоятка
    const cov = put(K1, GK.MAT.paint, G, o);
    const hose = mesh(gCyl, SM(CD.pipe, { metalness: 0.45, roughness: 0.45 }), G, o), hj = mesh(gSph, SM(CD.joint), G, o); hj.scale.setScalar(0.06);
    const set = t => {
      const e = t * t * (3 - 2 * t), a = ypark + ((yw < 0 ? yw + 2 * Math.PI : yw) - ypark) * Math.min(1, e * 1.6), drop = Math.max(0, (e - 0.62) / 0.38);
      con.rotation.y = -a;
      const end = [cx0 + LA * Math.cos(a), YA, cz0 + LA * Math.sin(a)];
      const top = YA + 0.16, bot = RH + 4.1 - 1.7 * drop;                                       // опущенная — внутрь котла
      tube.position.set(end[0], top, end[2]); tube.scale.set(1, top - bot, 1);
      const cy = Math.max(RH + TCAR.D.hatchTop + 0.02, bot + 0.6 * (1 - drop) + 0.4);
      cov.position.set(end[0], cy, end[2]); cov.rotation.y = -a;
      const vx = end[0] + 0.2 * Math.cos(a), vz = end[2] + 0.2 * Math.sin(a), mid = [cx0 + (end[0] - cx0) * 0.45, YA + 0.35, cz0 + (end[2] - cz0) * 0.45];
      placeAB(hose, [vx, cy + 0.28, vz], mid, 0.04); hj.position.set(...mid);
    };
    set(0);
    anim.UNZH = { t: 0, target: 0, set, G };
  }
  // УПВС-80С: стойка у настила, поворотный шарнир, штанга Ду80, сифонная труба через люк (в гаражном положении — вертикально у стойки)
  {
    const [ux, uz] = UPVS_C, tx = car[2], o = { id: 'УПВС-80С', net: 1, est: 'UPVS', name: 'Установка аварийного верхнего слива УПВС-80С (Ду80)',
      note: '177-ТХ.С-001-0 поз. 3: Ду80, Ру 0,05 МПа, 200 кг, ОАО «Промприбор»; слив через горловину ВЦ при неисправности нижнего сливного прибора (177-ТХ-001-0). Подключение к обвязке УСН-N1 через обратный клапан — АК-004. Стойка — по АК-045. Конструкция штанги и шарниров — условно.' };
    const G = new THREE.Group(); g.add(G);
    const top = PY + 1.3, L1 = Math.hypot(tx - ux, TZ - uz), yw = Math.atan2(TZ - uz, tx - ux);
    const S0 = kit();
    S0.box(0.36, 0.02, 0.36, ux, PY + 0.01, uz - 0.25, CD.joint); S0.cyl(V3(ux, PY, uz - 0.25), V3(ux, top - 0.1, uz - 0.25), 0.05, CD.grey, 12);
    S0.bar(V3(ux, top - 0.12, uz - 0.25), V3(ux, top - 0.12, uz), 0.06, 0.06, CD.grey);
    joint(S0, V3(ux, top, uz), 0.075, Yax, 0.2);
    put(S0, GK.MAT.paint, G, o);
    const r1 = mesh(gCyl, SM(CD.pipe, { metalness: 0.45, roughness: 0.45 }), G, o), r2 = mesh(gCyl, SM(CD.pipe, { metalness: 0.45, roughness: 0.45 }), G, o), j2 = mesh(gSph, SM(CD.joint), G, o); j2.scale.setScalar(0.07);
    const P0 = [ux, top + 1.7, uz], P1 = [ux + L1 * Math.cos(yw), top + 0.25, uz + L1 * Math.sin(yw)];
    const set = t => {
      const e = t * t * (3 - 2 * t), end = [P0[0] + (P1[0] - P0[0]) * e, P0[1] + (P1[1] - P0[1]) * e + Math.sin(Math.PI * e) * 0.5, P0[2] + (P1[2] - P0[2]) * e];
      placeAB(r1, [ux, top + 0.1, uz], end, DN.D80);
      placeAB(r2, end, [end[0], end[1] - 0.35 - 2.4 * e, end[2]], 0.04); j2.position.set(...end);
    };
    set(0);
    anim.UPVS = { t: 0, target: 0, set, G };
  }
  // переходные мостики МП-4 (177-ТХ.ОЛ-003-0): стационарные, 4 подвижные ступени, рабочая зона 1740 мм.
  // Поднятое положение — вертикально у ограждения; опущенное — на площадку у горловины цистерны; ступени сохраняют горизонталь
  E.BY = RH + TCAR.D.platformY + 0.19; E.BZ = TZ - 0.42;            // опорный конец мостика — на площадке у горловины (лапы на настиле площадки)
  const STEP_G = (() => { const b = kit(); b.box(0.8, 0.03, 0.26, 0, 0, 0, CD.grey); for (let k2 = -3; k2 <= 3; k2++) b.box(0.012, 0.035, 0.26, k2 * 0.11, 0.002, 0, CD.dark); b.box(0.8, 0.05, 0.02, 0, -0.01, 0.13, CD.yel); return b.geometry(); })();
  E.bridges.forEach((bx, i) => {
    const o = { id: 'МП', net: 1, est: 'BR' + i, name: 'Мостик переходной МП-4 к горловине цистерны',
      note: '177-ТХ.ОЛ-003-0, 177-ТХ.С-001-0 поз. 4: МП-4, 3 шт., 120 кг; 4 подвижные ступени, рабочая зона 1740 мм, стационарно закреплённый, без датчиков. Положение — по АК-045 и плану 177-ТХ-002-0 (у постов УСН-N2, N3, N1). ' +
        'При опускании ступени остаются горизонтальными; уравновешивающий цилиндр и сечения — условно. Опускается для вскрытия люка, замера и открытия сливного прибора.' };
    const piv = new THREE.Group(); piv.position.set(bx, PY, zd1); g.add(piv);
    const Lb = Math.hypot(E.BZ - zd1, E.BY - PY);
    const B = kit();
    for (const s of [-1, 1]) {
      B.box(0.05, 0.16, Lb, s * 0.45, 0, Lb / 2, CD.grey); B.box(0.08, 0.02, Lb, s * 0.43, 0.08, Lb / 2, CD.grey);   // косоуры (швеллер)
      for (const zz of [0.06, Lb / 2, Lb - 0.06]) B.cyl(V3(s * 0.47, 0.06, zz), V3(s * 0.47, 0.98, zz), 0.017, CD.yel, 6);
      B.cyl(V3(s * 0.47, 0.98, 0.06), V3(s * 0.47, 0.98, Lb - 0.06), 0.02, CD.yel, 6); B.cyl(V3(s * 0.47, 0.5, 0.06), V3(s * 0.47, 0.5, Lb - 0.06), 0.012, CD.yel, 6);
      B.box(0.12, 0.12, 0.12, s * 0.45, 0, 0.02, CD.joint); B.box(0.1, 0.1, 0.16, s * 0.45, -0.1, Lb - 0.08, CD.rub);   // шарнир, опорная лапа
    }
    B.box(0.9, 0.03, 0.3, 0, 0.0, Lb - 0.15, CD.grey);
    const bm = put(B, GK.MAT.paint, piv, o);
    const nst = 4, im = new THREE.InstancedMesh(STEP_G, GK.MAT.paint, nst); im.castShadow = im.receiveShadow = true; im.userData.o = o; pickables.push(im); piv.add(im);
    const P2 = kit(); P2.cyl(V3(bx + 0.62, PY, zd1 - 0.15), V3(bx + 0.62, PY + 1.25, zd1 - 0.15), 0.035, CD.grey, 10); put(P2, GK.MAT.paint, g, o);   // стойка уравновешивающего цилиндра
    const cylM = mesh(gCyl, SM(CD.dark, { metalness: 0.6, roughness: 0.35 }), g, o), rodM = mesh(gCyl, SM(0xd0d4d8, { metalness: 0.9, roughness: 0.2 }), g, o);
    const down = -Math.atan2(E.BY - PY, E.BZ - zd1), up = -Math.PI / 2 + 0.12;
    const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(1, 1, 1), ex = new THREE.Vector3(1, 0, 0), wv = new THREE.Vector3();
    const set = t => {
      const e = t * t * (3 - 2 * t); piv.rotation.x = up + (down - up) * e;
      for (let s2 = 0; s2 < nst; s2++) { qq.setFromAxisAngle(ex, -piv.rotation.x * e); pp.set(0, 0.05, (s2 + 0.75) * Lb / (nst + 0.5)); mm.compose(pp, qq, ss); im.setMatrixAt(s2, mm); }
      im.instanceMatrix.needsUpdate = true;
      piv.updateMatrixWorld(true); wv.set(0.5, 0.06, Lb * 0.33).applyMatrix4(piv.matrixWorld);
      const a = [bx + 0.62, PY + 1.2, zd1 - 0.15], b = [wv.x + 0.12, wv.y, wv.z], m = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, a[2] + (b[2] - a[2]) * 0.55];
      placeAB(cylM, a, m, 0.035); placeAB(rodM, m, b, 0.014);
    };
    set(0);
    anim['BR' + i] = { t: 0, target: 0, set, G: piv };
  });
  // крышки люков вагонов-цистерн: открываются на шаге «Вскрыть люк» (ESTOPS), закрываются на шаге «Закрыть и опломбировать люк»
  TCAR.lids.forEach((l, i) => { anim['LID' + i] = { t: 0, target: 0, set: t => TCAR.setLid(i, t * t * (3 - 2 * t)), G: l }; });
  // тормозные башмаки — под колёса крайней тележки каждой цистерны (видны после установки)
  E.chocks = car.map(cx => { const G = new THREE.Group(); g.add(G); for (const s of [-1, 1]) { const b = mesh(gBox, mRed, G); b.scale.set(0.3, 0.14, 0.14); b.position.set(cx - 3.875 - 0.925 - 0.45, RH + 0.07, TZ + s * 0.76); } G.visible = false; return G; });

  /* ---------- 7. Анимация и состояние арматуры ---------- */
  let tPrev = performance.now();
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    for (const a of Object.values(anim)) if (a.t !== a.target) { const sp = dt / 3.0; a.t = a.target > a.t ? Math.min(a.target, a.t + sp) : Math.max(a.target, a.t - sp); a.set(a.t); }
    const st = typeof procLogic !== 'undefined' ? procLogic.st.valve : {};
    let changed = false;
    STEM.list.forEach((v, i) => {
      if (!v.stemBase) return;
      const open = v.id ? !!st[v.id] : v.open, tg = v.id && window.__VPOS ? window.__VPOS(v.id, open ? 1 : 0) : (open ? 1 : 0);
      if (v.sl !== tg || !v.init) { v.sl = v.init ? (tg > v.sl ? Math.min(tg, v.sl + dt * 0.8) : Math.max(tg, v.sl - dt * 0.8)) : tg; v.init = 1; changed = true;
        const L = v.stemL * (0.35 + 0.65 * v.sl), c = v.stemBase.clone().addScaledVector(v.sd, L / 2); m4.compose(c, v.sq, s3.set(0.016, L, 0.016)); STEM.im.setMatrixAt(i, m4); }
    });
    if (changed) STEM.im.instanceMatrix.needsUpdate = true;
    // v0.22: поворот шара крана (по указателю) — 90° за ≈ 1,2 с
    let bch = false;
    BVP.list.forEach((v, i) => {
      const tg = window.__VPOS ? 1 - window.__VPOS(v.id, st[v.id] ? 1 : 0) : (st[v.id] ? 0 : 1);
      if (v.ang === null) v.ang = tg; else if (v.ang !== tg) v.ang = tg > v.ang ? Math.min(tg, v.ang + dt / 1.2) : Math.max(tg, v.ang - dt / 1.2); else return;
      const q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v.e2, v.sd || UP, v.axv)), qr = new THREE.Quaternion().setFromAxisAngle(v.sd || UP, v.ang * Math.PI / 2);
      m4.compose(v.ind, qr.multiply(q0), s3.set(0.03, 0.02, 0.2)); BVP.im.setMatrixAt(i, m4); bch = true;
    });
    if (bch) BVP.im.instanceMatrix.needsUpdate = true;
  }
  return { g, anim, tick, XS, CAR_IDX, car, nm, LOOPS, runs, BVP };
})();

