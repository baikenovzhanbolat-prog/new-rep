/* ---------- Ж/д пути (v0.17) ----------
   Путь № 53 (эстакада 177): головка рельса 297,30 — ГП-003 («г.р.», три подписи вдоль пути); путь горизонтальный.
   Путь № 54 за оградой: головка рельса 297,25 — по существующим отметкам у восточного края листа (условно).
   Участки ≤ 105 м, чтобы обход учитывал балласт и шпалы как поверхность (длинные элементы фона обход пропускает). */
const TRACK_Y = 3575.5; // ось пути у эстакады — по ГП-003
const RAIL53 = 297.30 - H0, RAIL54 = 297.25 - H0;
track(TRACK_Y, 2785, 3362, RAIL53, { trough: 296.45 - H0 });   // v0.21: участок 1700–2785 — W901.tracks53() (тупиковый упор по 901-ТХ-002)
 track(TRACK_Y, 3362, 5000, RAIL53);
track(3695, 1700, 3350, RAIL54); track(3695, 3350, 5000, RAIL54);
/* v0.10: продолжение путей за пределы листа ГП-002 (декоративно — трасса за границей листа не показана) */
for (const [y, r] of [[TRACK_Y, RAIL53], [3695, RAIL54]]) { if (y !== TRACK_Y) track(y, -2500, 1700, r); track(y, 5000, 9200, r); }   // v0.21: путь 53 западнее упора — слой сравнения

/* ---------- Эстакада 177 (этап 6.3): каркас по ГП-002 (6 осей колонн, шаг ≈ 6,0 м) и АК-045 (настил +3,500, лестницы в торцах) ----------
   ±0,000 эстакады принят на уровне головки рельса (RH). Сечения элементов, ограждение 1,1 м, уклон лестниц 40°, решётчатый настил — типовые (условно).
   v0.17 (ГП-003): головка рельса 297,30 (RH = 0), ж/б площадка 296,45 (GY = −0,85) — колонны, лестницы и обвязка стоят на площадке;
   настил +3,500 от головки рельса = 300,80 (база отметки на АК-045 не указана — условно). */
const EST177 = (() => {
  const RH = 297.30 - H0, PY = RH + 3.5, GY = 296.45 - H0;         // ГП-003: г.р. 297,30, площадка 296,45; АК-045: настил +3,500
  const TZ = P(0, TRACK_Y)[1], zd0 = P(0, 3506)[1], zd1 = P(0, 3537)[1];
  const AX = [-36.03, -30.00, -23.97, -17.94, -11.91, -5.88];      // оси 1–6 (ГП-002: квадраты колонн; АК-045: шаг 6000)
  const X0 = AX[0] - 0.3, X1 = AX[5] + 0.3;                         // настил с консолями 0,3 м
  const SZ0 = 32.6, SZ1 = 33.5;                                     // марши лестниц в торцах (АК-045, штриховка)
  const RUN = (PY - 0.05) / Math.tan(40 * Math.PI / 180);
  const cars = [2880, 3070, 3263.5].map(px => P(px, 0)[0]);         // позиции цистерн — по ГП-003
  return { RH, PY, GY, TZ, zd0, zd1, AX, X0, X1, SZ0, SZ1, RUN, cars, bridges: [-32.97, -21.53, -8.91] };   // мостики МП — центры по АК-045 (обмер листа)
})();
function estakada177(g) {
  const { RH, PY, GY, TZ, zd0, zd1, AX, X0, X1, SZ0, SZ1, cars } = EST177;
  const L = X1 - X0, xc = (X0 + X1) / 2, wd = zd1 - zd0, zm = (zd0 + zd1) / 2;
  const GR = M(0x37608c, { roughness: 0.6, metalness: 0.25 }), GRT = M(0x80868b, { roughness: 0.55, metalness: 0.35 }), YH = M(0xe0a800, { roughness: 0.6 }), CO = M(0xb8b4aa), RD = M(0xc8372d, { roughness: 0.5 });
  const bGR = new BoxBatch(GR), bGT = new BoxBatch(GRT), bYH = new BoxBatch(YH), bCO = new BoxBatch(CO), bRD = new BoxBatch(RD);
  boxPx(g, 2785, 3452, 3362, 3609, 0.2, mat.conc, GY - 0.2);           // ж/б площадка (ГП-003): верх 296,45; толщина 0,2 — условно
  // настил — решётчатый (текстура с прозрачностью), по периметру — обвязочный швеллер
  const grate = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#7d8388'; for (let i = 0; i < 128; i += 8) c.fillRect(i, 0, 3, 128); for (let j = 0; j < 128; j += 32) c.fillRect(0, j, 128, 3);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(L / 0.5, wd / 0.5); t.anisotropy = 4; return t;
  })();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, wd), new THREE.MeshStandardMaterial({ map: grate, alphaMap: grate, transparent: false, alphaTest: 0.3, color: 0xffffff, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }));
  deck.position.set(xc, PY - 0.02, zm); deck.castShadow = deck.receiveShadow = true; g.add(deck);
  for (const zz of [zd0 + 0.05, zd1 - 0.05]) bGR.box(L, 0.2, 0.1, xc, PY - 0.14, zz);                // продольные балки
  for (const x of [X0 + 0.05, X1 - 0.05]) bGR.box(0.1, 0.2, wd, x, PY - 0.14, zm);
  const nb = Math.round(L / 1.5); for (let k = 1; k < nb; k++) bGR.box(0.07, 0.12, wd - 0.12, X0 + k * L / nb, PY - 0.1, zm);   // поперечины
  // колонны по осям 1–6, оголовки фундаментов, связи
  const zcf = zd0 + 0.12, zcn = zd1 - 0.12;
  for (const x of AX) {
    for (const zz of [zcf, zcn]) { bGR.box(0.2, PY - 0.24 - GY, 0.2, x, (PY - 0.24 + GY) / 2 + 0.1, zz); bGR.box(0.36, 0.03, 0.36, x, GY + 0.165, zz); bCO.box(0.6, 0.2, 0.6, x, GY + 0.05, zz); }
    bGR.box(0.12, 0.26, wd - 0.1, x, PY - 0.37, zm);                                                  // ригель по оси
    bGR.seg([x, GY + 0.5, zcf], [x, PY - 0.5, zcn], 0.06);                                                   // поперечная связь
  }
  for (const k of [1, 3]) for (const zz of [zcf, zcn]) { const a = AX[k], b = AX[k + 1]; bGR.seg([a, GY + 0.6, zz], [b, PY - 0.5, zz], 0.07); bGR.seg([a, PY - 0.5, zz], [b, GY + 0.6, zz], 0.07); }   // вертикальные связи
  // ограждение 1,1 м: поручень, средняя планка, бортовая полоса; проёмы — у мостиков (со стороны пути) и у лестниц (в торцах)
  const rail = (xa, xb, zz) => {
    if (xb - xa < 0.05) return;
    bYH.box(xb - xa, 0.05, 0.05, (xa + xb) / 2, PY + 1.1, zz); bYH.box(xb - xa, 0.035, 0.035, (xa + xb) / 2, PY + 0.55, zz); bYH.box(xb - xa, 0.14, 0.012, (xa + xb) / 2, PY + 0.07, zz);
    const n = Math.max(1, Math.round((xb - xa) / 1.5)); for (let i = 0; i <= n; i++) bYH.box(0.045, 1.1, 0.045, xa + (xb - xa) * i / n, PY + 0.55, zz);
  };
  const railZ = (za, zb, xx) => {
    if (zb - za < 0.05) return;
    bYH.box(0.05, 0.05, zb - za, xx, PY + 1.1, (za + zb) / 2); bYH.box(0.035, 0.035, zb - za, xx, PY + 0.55, (za + zb) / 2); bYH.box(0.012, 0.14, zb - za, xx, PY + 0.07, (za + zb) / 2);
    for (const z of [za, zb]) bYH.box(0.045, 1.1, 0.045, xx, PY + 0.55, z);
  };
  const segs = (xa, xb, holes, zz) => { let cur = xa; for (const [h0, h1] of holes) { rail(cur, h0, zz); cur = h1; } rail(cur, xb, zz); };
  segs(X0, X1, [], zd0 + 0.02);
  segs(X0, X1, EST177.bridges.map(c => [c - 0.5, c + 0.5]), zd1 - 0.02);
  for (const x of [X0 + 0.02, X1 - 0.02]) { railZ(zd0 + 0.02, SZ0, x); railZ(SZ1, zd1 - 0.02, x); }
  // лестницы в торцах: марш ≈40°, косоуры, решётчатые ступени, поручни; внизу — бетонная площадка
  // v0.17: низ марша — на земле у торца (рельеф ГП-003/004); восточный марш не заходит на подпорную стенку приямка (x ≤ −0,9) — уклон там ≈43° (условно)
  const SW = SZ1 - SZ0, SZC = (SZ0 + SZ1) / 2, T40 = Math.tan(40 * Math.PI / 180);
  EST177.stairs = [];
  for (const [xt, sg] of [[X0, -1], [X1, 1]]) {
    let xb = xt + sg * (PY - 0.05) / T40, yb = 0;
    for (let it = 0; it < 4; it++) { yb = hAt(xb, SZC); xb = xt + sg * (PY - 0.05 - yb) / T40; if (sg > 0) xb = Math.min(xb, -0.9); }
    yb = hAt(xb, SZC);
    const H = PY - yb, RUNe = Math.abs(xb - xt), NT = Math.round(H / 0.19);
    EST177.stairs.push({ xt, xb, yb, ang: Math.atan2(H, RUNe) * 180 / Math.PI });
    for (const zz of [SZ0 - 0.04, SZ1 + 0.04]) {
      bGR.seg([xb, yb, zz], [xt, PY - 0.08, zz], 0.16);
      bYH.seg([xt, PY + 1.0, zz], [xb, yb + 1.0, zz], 0.045); bYH.seg([xt, PY + 0.5, zz], [xb, yb + 0.5, zz], 0.035);
      const m = Math.round(Math.hypot(RUNe, H) / 1.3); for (let i = 0; i <= m; i++) bYH.box(0.04, 1.0, 0.04, xt + (xb - xt) * i / m, yb + H * (1 - i / m) + 0.5, zz);
    }
    for (let i = 1; i < NT; i++) bGT.box(RUNe / NT * 0.95, 0.035, SW, xt + sg * RUNe * (1 - i / NT) - sg * RUNe / NT * 0.5, yb + H * i / NT - 0.02, SZC);
    const xl = sg > 0 ? xb - 0.05 : xb + sg * 0.45, wl = sg > 0 ? 0.8 : 1.2;
    bCO.box(wl, 0.12, SW + 0.5, xl, hAt(xl, SZC) + 0.03, SZC);
  }
  // кабельный лоток КП-200 под настилом (АК-045, спецификация: секция прямая КП-200 — 30 м), стойки К300
  bGT.box(22.0, 0.08, 0.2, -25.3, PY - 0.75, 32.38);
  for (let x = -36.0; x <= -14.5; x += 1.5) bGT.box(0.04, 0.5, 0.04, x, PY - 0.5, 32.27);
  // прожекторы на стойках со стороны прохода, огнетушители ОП-10 в шкафах
  for (const k of [0.3, 0.7]) { const x = X0 + L * k; bGR.box(0.08, 2.8, 0.08, x, PY + 1.4, zd0 + 0.03); bGR.box(0.5, 0.16, 0.3, x, PY + 2.85, zd0 + 0.26, 0.5); }
  for (const k of [0.5, 0.62]) bRD.box(0.3, 0.75, 0.2, X0 + L * k, PY + 0.45, zd0 + 0.18);
  [bGR, bGT, bYH, bCO, bRD].forEach(bb => bb.build(g));
  // цистерны: на время загрузки модели — упрощённые
  const carG = new THREE.Group(); carG.name = 'carsSimple'; g.add(carG);
  cars.forEach(c => tankCar(carG, c, TZ, RH - 0.5));
  g.userData.cars = carG; g.userData.carPos = EST177.carPos = cars.map(c => [c, RH, TZ]);   // EST177.carPos — для расчёта (SIMGEO), не из сцены
  // v0.22: детальная модель вагона-цистерны (TCAR, типовая — APPROXIMATE); прежние модели — слой «Вагоны-цистерны: прежние модели»
  carG.visible = false; TCAR.old.push(carG);
  const carD = new THREE.Group(); carD.name = 'carsDetail'; g.add(carD); TCAR.build(carD, cars, RH, TZ); TCAR.groups.push(carD);
  g.userData.carsD = carD;
}
