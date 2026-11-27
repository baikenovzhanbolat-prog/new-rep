/* =====================================================================================
   v0.23 — СКВОЗНОЙ ЭТАП «МАТЕРИАЛЫ» (MATR)
   1. Фактура и следы эксплуатации для стандартных материалов сцены (без текстур и UV):
      шейдерная вставка в MeshStandardMaterial — шум в мировых координатах: неравномерность окраски,
      пыль на верхних гранях, разброс шероховатости; для бетона — рельеф поверхности (bump по производным).
      Категории: бетон (матовый неметалл), металл, окраска. Прозрачные, светящиеся, текстурированные материалы
      и материалы с собственными шейдерными вставками не затрагиваются.
   2. Опознавательная окраска трубопроводов по ГОСТ 14202-69 (переключатель, по умолчанию выключен):
      горючие жидкости (ДТ(Л), ДТ(З), бензин, дренаж) — коричневый; газоуравнительная (пары нефтепродуктов,
      горючие газы) — жёлтый; противопожарные (В2, пенораствор В10) — красный сигнальный (п. 5).
      Предупреждающие кольца красные (легковоспламеняющиеся вещества), ширина по наружному диаметру
      (до 80 мм — 40 мм; 81…160 — 50 мм; 161…300 — 70 мм), шаг ≤ 10 м в помещениях и ≈ 30 м снаружи (условно).
      Фактическая окраска труб на объекте не подтверждена (фото нет) — режим показывает требование стандарта.
   3. LOD по режиму качества: дальность показа мелких деталей (FAST_LOD) 60 / 40 / 22 м; на «Низком» фактура отключена,
      на «Среднем» — без рельефа бетона.
   ===================================================================================== */
const MATR = (() => {
  const CAT = {
    conc: { scale: 1.3, dirt: 0.40, dust: 0.14, bump: 0.10 },
    metal: { scale: 2.2, dirt: 0.22, dust: 0.38, bump: 0.0 },
    paint: { scale: 1.7, dirt: 0.16, dust: 0.28, bump: 0.0 }
  };
  const U = {};
  for (const [k, c] of Object.entries(CAT)) U[k] = { uMScale: { value: c.scale }, uMDirt: { value: c.dirt }, uMDust: { value: c.dust }, uMBump: { value: c.bump } };
  const BASE_OBC = THREE.Material.prototype.onBeforeCompile;
  const done = new WeakSet(), list = [];
  let on = true, qual = null;
  const GLSL_N = `
uniform float uMScale; uniform float uMDirt; uniform float uMDust; uniform float uMBump;
varying vec3 vMW; varying vec3 vMN;
float mhs(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mns(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mhs(i), mhs(i + vec3(1, 0, 0)), f.x), mix(mhs(i + vec3(0, 1, 0)), mhs(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(mhs(i + vec3(0, 0, 1)), mhs(i + vec3(1, 0, 1)), f.x), mix(mhs(i + vec3(0, 1, 1)), mhs(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float mfb(vec3 p) { return 0.55 * mns(p) + 0.3 * mns(p * 2.13) + 0.15 * mns(p * 4.71); }
`;
  function patch(m, cat) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U[cat]);
      sh.vertexShader = 'varying vec3 vMW; varying vec3 vMN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 mW4 = vec4(transformed, 1.0); vec3 mN3 = objectNormal;
  #ifdef USE_INSTANCING
    mW4 = instanceMatrix * mW4; mN3 = mat3(instanceMatrix) * mN3;
  #endif
  vMW = (modelMatrix * mW4).xyz; vMN = normalize(mat3(modelMatrix) * mN3);`);
      sh.fragmentShader = GLSL_N + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  float mN1 = mfb(vMW * uMScale), mN2 = mns(vMW * uMScale * 7.0), mUp = smoothstep(0.35, 0.95, vMN.y);
  diffuseColor.rgb *= 1.0 - uMDirt * (0.8 * mN1 + 0.25 * mN2 - 0.42);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.14, 0.11), clamp(uMDust * mUp * (0.35 + 0.65 * mN1), 0.0, 0.6));`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (1.0 + (uMDirt + uMDust) * (1.4 * mN1 - 0.6)) + 0.25 * uMDust * mUp, 0.05, 1.0);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor *= 1.0 - 0.6 * uMDust * mUp * mN1;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uMBump > 0.0) {
    float mH = mns(vMW * uMScale * 9.0) + 0.5 * mns(vMW * uMScale * 23.0);
    vec3 mdx = dFdx(-vViewPosition), mdy = dFdy(-vViewPosition); float mhx = dFdx(mH), mhy = dFdy(mH);
    vec3 mr1 = cross(mdy, normal), mr2 = cross(normal, mdx); float mdet = dot(mdx, mr1);
    normal = normalize(abs(mdet) * normal - uMBump * sign(mdet) * (mhx * mr1 + mhy * mr2));
  }`);
    };
    m.customProgramCacheKey = () => 'matr-' + cat;
    m.needsUpdate = true;
  }
  function catOf(m) {
    if (!m || !m.isMeshStandardMaterial || done.has(m)) return null;
    if (m.onBeforeCompile !== BASE_OBC || m.map || m.alphaMap || m.wireframe || m.userData.noMatr) return null;
    if (m.transparent && m.opacity < 0.999) return null;
    if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return null;
    if (m.metalness >= 0.15) return 'metal';
    if (m.roughness >= 0.8) return 'conc';
    return 'paint';
  }
  function apply(root = scene) {
    let n = 0;
    root.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || o.isSprite) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const c = catOf(m); if (!c) continue;
        done.add(m); list.push([m, c]); patch(m, c); n++;
      }
    });
    setUniforms();
    return n;
  }
  function setUniforms() {
    const q = quality(), w = on && q !== 'low';
    for (const [k, c] of Object.entries(CAT)) {
      U[k].uMDirt.value = w ? c.dirt : 0; U[k].uMDust.value = w ? c.dust : 0; U[k].uMBump.value = w && q === 'high' ? c.bump : 0;
    }
    window.__lodD = q === 'low' ? 22 : q === 'mid' ? 40 : 60;
  }
  function quality() { let q = null; try { q = localStorage.getItem('ctrQuality'); } catch (e) { } return q || ((matchMedia('(pointer: coarse)').matches || innerWidth < 800) ? 'mid' : 'high'); }

  /* ---------- ГОСТ 14202 ---------- */
  const GOST = { dtl: 0x6b4226, dtz: 0x6b4226, b: 0x6b4226, d: 0x6b4226, gu: 0xd8b22a, pv: 0xc4271f, prp: 0xc4271f };
  const NETC = new Map(NET_DEF.filter(d => GOST[d.k] !== undefined).map(d => [d.c, d.k])); NETC.set(PH_CLS.DT[0], 'dtl');   // + коллекторы и обвязка насосов ДТ цеха 200
  let reg = null, rings = null, gostOn = false;
  function registry() {
    reg = [];
    const seen = new Set();
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) || !m.color) continue;
        seen.add(m); const k = NETC.get(m.color.getHex());
        if (k) reg.push({ m, k, c0: m.color.getHex() });
      }
    });
  }
  function ringMesh() {
    const P = window.__PNET; if (!P || !P.segs) return null;
    const FUEL = new Set(['dtl', 'dtz', 'b', 'd', 'gu']), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), p = new THREE.Vector3();
    const hall = PH.geo.hall, hx = hall.map(v => v[0]), hz = hall.map(v => v[1]);
    const inHall = (x, z) => x > Math.min(...hx) && x < Math.max(...hx) && z > Math.min(...hz) && z < Math.max(...hz);
    const mats = [];
    for (const sg of P.segs) {
      if (!FUEL.has(sg.net) || sg.under || sg.on === 0 || !sg.a || !sg.b) continue;
      d.set(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1], sg.b[2] - sg.a[2]); const L = d.length(); if (L < 1.2) continue;
      const od = sg.od || 2 * (sg.r || 0.05), w = od <= 0.08 ? 0.04 : od <= 0.16 ? 0.05 : 0.07, rr = od / 2 + 0.004;
      const sp = inHall((sg.a[0] + sg.b[0]) / 2, (sg.a[2] + sg.b[2]) / 2) ? 10 : 30;
      let n = Math.floor(L / sp); if (!n && L > 2.5) n = 1;
      d.normalize(); q.setFromUnitVectors(UP, d);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; p.set(sg.a[0] + (sg.b[0] - sg.a[0]) * t, sg.a[1] + (sg.b[1] - sg.a[1]) * t, sg.a[2] + (sg.b[2] - sg.a[2]) * t); mats.push(M4.compose(p, q, s.set(rr, w, rr)).clone()); }
    }
    const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), mt = new THREE.MeshStandardMaterial({ color: 0xc4271f, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
    mt.userData.noMatr = 1;
    const im = new THREE.InstancedMesh(geo, mt, Math.max(mats.length, 1)); im.count = mats.length; mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.name = 'ГОСТ 14202: предупреждающие кольца'; im.castShadow = false; im.receiveShadow = true; im.visible = false; scene.add(im);
    return im;
  }
  function setGost(v) {
    gostOn = !!v;
    if (gostOn && !reg) registry();
    if (gostOn && !rings) rings = ringMesh();
    if (reg) for (const r of reg) r.m.color.setHex(gostOn ? GOST[r.k] : r.c0);
    if (rings) rings.visible = gostOn;
  }
  let fr = 0;
  function tick() { if (++fr % 90 === 0) { const q = quality(); if (q !== qual) { qual = q; setUniforms(); } } }
  const ly = {
    w: { get visible() { return on; }, set visible(v) { on = !!v; setUniforms(); } },
    g: { get visible() { return gostOn; }, set visible(v) { setGost(v); } }
  };
  return { apply, tick, ly, setGost, U, CAT, get stats() { return { patched: list.length, byCat: list.reduce((a, [, c]) => (a[c] = (a[c] || 0) + 1, a), {}), gost: reg ? reg.reduce((a, r) => (a[r.k] = (a[r.k] || 0) + 1, a), {}) : null, rings: rings ? rings.count : 0, lodD: window.__lodD }; } };
})();

F24.late();   // v0.24: насосный цех (ГПС-600, В10, кран, приямок) и ГПС-600 над РГС — по 444.pdf
F25.late();   // v0.25: арматура станции 186, трубы станции и ТК-007 — в единую модель сети (PIPEREG)
F27.late();   // v0.27: трубы пункта заправки 166 — в единую модель сети (PIPEREG)
let layerApi = null;   // { LAYERS, setVis, isOn } — для списка объектов и будущих модулей
{
  const byIds = ids => () => OBJ.filter(o => ids.includes(o.id)).map(o => o.g);
  const byRe = re => () => OBJ.filter(o => re.test(o.id)).map(o => o.g);
  const LAYERS = [
    { k: 'park', grp: 'Сооружения', name: 'Резервуарный парк (РВС, РГС, обвалование)', get: byIds(['109.1', '109.2', '109.3', '116.1–2', '116.3–4', '431']) },
    { k: 'rvsdet', grp: 'Сооружения', name: 'РВС-1000: детальная модель', get: () => RVSD.groups },
    { k: 'rgsdet', grp: 'Сооружения', name: 'РГС-75: детальная модель по «Резервуар 1.pdf» и ГП-003, площадка и лестница', get: () => RGSD.groups },
    { k: 'carsdet', grp: 'Сооружения', name: 'Вагоны-цистерны: детальная модель (типовая — APPROXIMATE)', get: () => TCAR.groups },
    { k: 'f25truck', grp: 'Станция налива 186 (444.pdf)', name: 'Автоцистерна у АСН-N1 (условная модель)', get: () => [F25.truck.g] },
    { k: 'f25tk', grp: 'Станция налива 186 (444.pdf)', name: 'ДТ(Л) к котельной по 152-ТК-007-0: опоры ОП90/ОП91, краны узлов 13 и 14', get: () => [F25.tkG] },
    { k: 'f24foam', grp: 'Пожаротушение (444.pdf)', name: 'ГПС-600 и пенопроводы В10: насосный цех 200, РГС 116, станция налива 186', get: () => [F24.hall.foam, F24.rgsG, F24.st186G] },
    { k: 'f24jet', grp: 'Пожаротушение (444.pdf)', name: 'Струи лафетных стволов 800 (учебно; подача — из карточки вышки)', get: () => [F24.jetG] },
    { k: 'f24crane', grp: 'Насосный цех 200 (АК-041)', name: 'Кран мостовой подвесной 1 т (200-ТХ-003-0)', get: () => [F24.hall.crane] },
    { k: 'f24san', grp: 'Насосный цех 200 (АК-041)', name: 'Приямок и трап производственной канализации К3 (200-ПТ-004-0)', get: () => [F24.hall.san] },
    { k: 'matr', grp: 'Материалы', name: 'Фактура и следы эксплуатации (пыль, неравномерность окраски, рельеф бетона)', get: () => [MATR.ly.w] },
    { k: 'gost', grp: 'Материалы', name: 'Окраска трубопроводов по ГОСТ 14202-69: ГСМ — коричневый, Гу — жёлтый, пожарные — красный; красные предупреждающие кольца (вместо цветов схемы)', off: 1, get: () => [MATR.ly.g] },
    { k: 'tech', grp: 'Сооружения', name: 'Слив, налив, насосная, дренаж', get: byIds(['177', '186', '166', '200', '139.1', '139.2', '901']) },
    { k: 'estq', grp: 'Сооружения', name: 'Эстакада 177: УСН, УНЖ, УПВС, обвязка, задвижки, КИП (АК-045)', get: () => [ESTQ.g] },
    { k: 'fireobj', grp: 'Сооружения', name: 'Объекты пожаротушения', get: () => OBJ.filter(o => ['644', '654.1', '654.2', '799', '800.1', '800.2'].includes(o.id) || /^а\d/.test(o.id)).map(o => o.g) },
    { k: 'energy', grp: 'Сооружения', name: 'ДЭС, ТП, котельная', get: byIds(['137', '213', '501']) },
    { k: 'aux', grp: 'Сооружения', name: 'СБК, КПП, гараж, склад, очистные', get: byIds(['401', '406', '446', '196', '752', '798']) },
    { k: 'maf', grp: 'Сооружения', name: 'Скамьи, урны, контейнеры', get: byRe(/^[бвг]\d/) },
    { k: 'fence', grp: 'Сооружения', name: 'Ограждение территории', get: byIds(['427']) },
    { k: 'pdiag', grp: 'Трубопроводы: проверка', name: 'Маркеры замечаний проверки связности', off: 1, get: () => [PNET_G.diag] },
    { k: 'pnodes', grp: 'Трубопроводы: проверка', name: 'Узлы сети: концы, врезки, подключения', off: 1, get: () => [PNET_G.nodes] },
    { k: 'gpgrid', grp: 'Генплан (ГП-002, ГП-004)', name: 'Сетка 20 м с проектными и существующими отметками, реперы Rp-1 / Rp-2', off: 1, get: () => [GEO_G] },
    { k: 'ph', grp: 'Насосный цех 200 (АК-041)', name: 'Насосные агрегаты, обвязка, арматура, фильтры, опоры ОП, щиты', get: () => [PHG, ...OBJ.filter(o => o.ph).map(o => o.g)] },
    { k: 'phi', grp: 'Насосный цех 200 (АК-041)', name: 'КИП: манометры, PIS, FQIT, QA-36; КС-3, ЯВ2', get: () => [PHI] },
    { k: 'phtray', grp: 'Насосный цех 200 (АК-041)', name: 'Кабельные лотки КП-300 (+1,800)', get: () => [PHT] },
    { k: 'phroof', grp: 'Насосный цех 200 (АК-041)', name: 'Кровля насосного цеха (снимите, чтобы заглянуть внутрь)', get: () => [ROOF200] },
    { k: 'procnet', grp: 'Технология: граф ТП', name: 'Схема графа ТП: оси технологических линий (бледные — условные трассы); по умолчанию скрыта — поток и маршрут показываются по трубам', off: 1, get: () => [procNet] },
    { k: 'procval', grp: 'Технология: граф ТП', name: 'Арматура (зелёный — открыта, красный — закрыта) и состояние насосов', get: () => [procVal] },
    { k: 'procflag', grp: 'Технология: граф ТП', name: 'Расхождения в документации (!)', get: () => [procFlag] },
    { k: 'proclvl', grp: 'Технология: граф ТП', name: 'Продукт в ёмкостях: уровни и объёмы (модель)', get: () => [procSim.liqGrp] },
    { k: 'procflow', grp: 'Технология: граф ТП', name: 'Поток ГСМ и выбранный маршрут — по физическим трубам; разрез стенки на работающем маршруте', get: () => [procSim.flowGrp] },
    { k: 'emg', grp: 'Технология: граф ТП', name: 'ПАЗ: датчики загазованности, посты ESD, разливы, сигнал «Пожар»', get: () => [window.__EMG && window.__EMG.g] },
    ...NET_DEF.map(d => ({ k: d.k, grp: 'Сети: ' + d.grp.toLowerCase(), name: d.name.replace('Трубопровод ', ''), c: d.c, off: d.off, get: () => [netLayers[d.k]] })),
    { k: 'pipedet', grp: 'Сети: детализация', name: 'Опоры трубопроводов: по 152-ТК-005/006 и условные с шагом 3 м — вне листов; теплоизоляция теплосети', get: () => [PNET_G.sup] },
    { k: 'pipetag', grp: 'Сети: детализация', name: 'Бирки маркировки: ДТ(Л), ДТ(З), Б, Д, Гу', get: () => [PIPED.tags] },
    { k: 'wells', grp: 'Сети: детализация', name: 'Колодцы: люки (положение — по символам ГП-005)', get: () => [PIPED.wells] },
    { k: 'ugsec', grp: 'Сети: подземные', name: 'Режим «Подземные сети» (кнопка в верхней панели): трубы, футляры, траншеи, колодцы, ёмкости, разрез грунта', off: 1, get: () => [PIPED.sec] },
    { k: 'light', grp: 'Сети: освещение', name: 'Прожекторные мачты и опоры', get: byRe(/^(ПМ|ОО)/) },
    { k: 'rail', grp: 'Основа', name: 'Ж/д пути', get: () => [tracks] },
    { k: 'ground', grp: 'Основа', name: 'Рельеф и покрытия', get: () => [TERR, ground] }
  ];
  const p = document.getElementById('netp'), bN = document.getElementById('bNet');
  let html = '<div style="display:flex;gap:6px;align-items:center"><b style="flex:1">Слои</b><button class="lbtn" data-a="all">Всё</button><button class="lbtn" data-a="none">Ничего</button></div>', last = '';
  for (const L of LAYERS) {
    if (L.grp !== last) { html += `<h4>${L.grp}</h4>`; last = L.grp; }
    const sw = L.c !== undefined ? `<i style="background:#${L.c.toString(16).padStart(6, '0')}"></i>` : '';
    html += `<label><input type="checkbox" data-k="${L.k}" ${L.off ? '' : 'checked'}>${sw}<span style="flex:1">${L.name}</span><button class="lbtn" data-solo="${L.k}">только</button></label>`;
  }
  html += '<div style="font-size:11px;color:#6b7b88;margin-top:5px">Подземные участки сетей — кнопка «Подземные сети».</div>';
  p.innerHTML = html;
  const boxes = {}; p.querySelectorAll('input').forEach(cb => boxes[cb.dataset.k] = cb);
  const setVis = (k, on) => { if (boxes[k]) boxes[k].checked = on; for (const ob of LAYERS.find(l => l.k === k).get()) if (ob) ob.visible = on; };
  LAYERS.forEach(L => setVis(L.k, !L.off));
  p.querySelectorAll('input').forEach(cb => cb.onchange = () => setVis(cb.dataset.k, cb.checked));
  p.querySelectorAll('button').forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.a) LAYERS.forEach(L => setVis(L.k, b.dataset.a === 'all' || L.k === 'ground'));
    else LAYERS.forEach(L => setVis(L.k, L.k === b.dataset.solo || (L.k === 'ground' && b.dataset.solo !== 'ground')));
    select(null);
  });
  bN.onclick = () => { const on = p.style.display !== 'block'; if (on) openPanel('net'); else closePanels(); };
  layerApi = { LAYERS, setVis, isOn: k => !!(boxes[k] && boxes[k].checked) };
  // служебное: показатели производительности (не входит в «Всё/Ничего/только»)
  const sv = document.createElement('div');
  sv.innerHTML = '<h4>Служебное</h4><label><input type="checkbox" id="perfCb" checked><span style="flex:1">Показатели производительности (к/с, вызовы отрисовки, треугольники)</span></label>' +
    '<label style="gap:6px"><span style="flex:1">Качество графики (тени, чёткость)</span><select id="qSel" style="font:inherit;font-size:12px;padding:2px 4px;border:1px solid #c5cfd8;border-radius:6px">' +
    Object.entries(VIS.QS).map(([k, q]) => `<option value="${k}"${k === VIS.quality ? ' selected' : ''}>${q.n}</option>`).join('') + '</select></label>' +
    '<label><input type="checkbox" id="envCb" checked><span style="flex:1">Окружение за ограждением: луг, деревья, сопки (декоративно)</span></label>';
  p.appendChild(sv);
  document.getElementById('perfCb').onchange = e => { document.getElementById('perf').style.display = e.target.checked ? '' : 'none'; };
  document.getElementById('qSel').onchange = e => VIS.setQuality(e.target.value);
  document.getElementById('envCb').onchange = e => { ENV.trees.visible = ENV.hills.visible = e.target.checked; };
}

