/* ---------- Этап 3 (v0.11): виртуальный обход от первого лица ----------
   Камера на высоте глаз 1,65 м. ПК: W/S/A/D или стрелки — шаги и повороты, мышь (перетаскивание) — обзор, Shift — бегом,
   колесо — приближение (угол зрения), E — паспорт объекта в прицеле, Esc — выход.
   Телефон/планшет: джойстик слева — шаги, перетаскивание по экрану — обзор, кнопки «Бегом», «Паспорт», «Выход».
   Столкновения — по фактической геометрии сцены (треугольники стен, оборудования, ограждений, опор, вагонов, труб):
   то, что выше 0,45 м над ступнёй и ниже 1,85 м, — препятствие; поверхности не выше 0,45 м — шаг (ступени, бордюры,
   настилы); с края выше 0,45 м — падение. Тело — цилиндр R 0,28 м. Геометрия разбивается на ячейки 16×16 м по мере
   перемещения (ленивое построение), видимость слоёв учитывается. Вход в здания и на эстакаду по лестницам — пешком,
   если проход существует в модели; в помещения без показанных дверей — через точки обхода (двери на чертежах ГП не даны). */
window.__walkOn = false; window.__walkExit = null;
const WALK = (() => {
  const EYE = 1.65, R = 0.28, RL = 0.16, STEP = 0.45, KNEE = 1.0, BAND1 = 1.85, VW = 1.4, VRUN = 3.6, TILE = 16, NC = 16;
  const BX0 = TER.x0 + 2, BX1 = TER.x0 + (TER.nx - 1) * TER.st - 2, BZ0 = TER.z0 + 2, BZ1 = TER.z0 + (TER.nz - 1) * TER.st - 2;
  const st = { on: false, feet: 0, eye: 0, vy: 0, grounded: true, yaw: 0, pitch: -0.05, keys: new Set(), run: false, runBtn: false, joy: { x: 0, y: 0 }, dist: 0, surf: 'ground', save: null, aim: null, aimT: 0, fov: 70 };
  const pos = new THREE.Vector3();
  const inPH = (x, z) => inPoly(x, z, PH.geo.outer);
  /* ---------- точки обхода (положение — по генплану/АК-041; направление взгляда — к объекту) ---------- */
  const PTS = [
    { n: 'Въезд у КПП 406', p: [26.5, -33.0], yaw: Math.PI },
    { n: 'Резервуарный парк: между РГС и РВС', p: [-8.0, -0.5], yaw: 0 },
    { n: 'Ж/д эстакада 177: настил (+3,500)', p: [-15.0, 33.05], yaw: Math.PI / 2, y: EST177.PY },
    { n: 'Ж/д эстакада 177: у цистерн (земля)', p: [-24.0, 30.9], yaw: Math.PI },
    { n: 'Насосный цех 200: зал Н-7/Н-8 (отм. −1,000)', p: [-65.6, 24.6], yaw: Math.PI / 2, y: PH_F1 },
    { n: 'Насосный цех 200: Н-1рез/Н-2', p: [-73.7, 29.7], yaw: 0, y: PH_F1 },
    { n: 'Насосный цех 200: Н-5рез/Н-6', p: [-65.4, 29.55], yaw: Math.PI / 2, y: PH_F1 },
    { n: 'Станция налива 186', p: [-49.0, -4.0], yaw: Math.PI / 2 },
    { n: 'Станция налива 186: площадка АСН (+2,700)', p: [F25.sx(3.0), F25.sz(5.6)], yaw: -Math.PI / 2, y: F25.H186 + 2.70 },
    { n: 'Склад тары 196', p: [24.0, 17.0], yaw: Math.PI },
    { n: 'Котельная 501 и ДЭС', p: [57.5, -8.0], yaw: -Math.PI / 2 },
    { n: 'Насосная пожаротушения 644', p: [60.5, 11.5], yaw: -2.39 },
    ...(K501.walkPt ? [K501.walkPt] : [])   // v0.52: внутри котельной (501-ТМ-002)
  ];
  /* ---------- источники геометрии (собираются при входе) ---------- */
  let ents = [], meshes = [], meshVis = new Uint8Array(0), visT = 0;
  const tiles = new Map();
  function collect() {
    ents = []; meshes = []; tiles.clear();
    const skipRoots = new Set([TERR, VIS.sky, procNet, procVal, procFlag, procAct].filter(Boolean));
    const skipNames = new Set(['луг (декоративно)', 'сопки (декоративно)', 'procLiq', 'procFlow', 'небо']);
    const tm = new THREE.Matrix4(), mi = new Map();
    scene.updateMatrixWorld(true);
    scene.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position || m.userData.noWalk) return;
      for (let p = m; p; p = p.parent) if (skipRoots.has(p) || skipNames.has(p.name)) return;
      if (m.userData.o && m.userData.o.id === 'грунт') return;                       // разрез грунта режима «Подземные сети»
      const m0 = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!m0 || m0.visible === false || m0.colorWrite === false || (m0.transparent && m0.opacity < 0.7)) return;
      const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const metal = m0.metalness > 0.3 || !!m0.alphaMap || m0 === mat.fence, ds = m0.side === THREE.DoubleSide;
      const add = mw => {
        const box = g.boundingBox.clone().applyMatrix4(mw), sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
        if (!isFinite(sx) || Math.max(sx, sz) > 150 || Math.max(sx, sy, sz) < 0.12) return;   // фон/рельсы во всю длину; болты и мелочь
        const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
        if (!inPH(cx, cz) && box.max.y < hAt(cx, cz) + 0.03) return;                          // подземные сооружения
        if (!mi.has(m)) mi.set(m, meshes.push(m) - 1);
        ents.push({ m, mi: mi.get(m), mw, box, metal, ds });
      };
      if (m.isInstancedMesh) { const n = Math.min(m.count, 20000); for (let i = 0; i < n; i++) { m.getMatrixAt(i, tm); add(new THREE.Matrix4().multiplyMatrices(m.matrixWorld, tm)); } }
      else add(m.matrixWorld.clone());
    });
    meshVis = new Uint8Array(meshes.length); updVis();
  }
  const vis = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
  function updVis() { for (let i = 0; i < meshes.length; i++) meshVis[i] = vis(meshes[i]) ? 1 : 0; }
  /* ---------- ячейка 16×16 м: треугольники опор (|ny|>0,5, вверх) и стен (|ny|<0,5) в мировых координатах ---------- */
  let VB = new Float32Array(1 << 16);
  function buildTile(ti, tj) {
    const x0 = ti * TILE, z0 = tj * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
    const F = [], W = [], FE = [], WE = [], fc = [], wc = [];
    for (let k = 0; k < NC * NC; k++) { fc.push([]); wc.push([]); }
    const cellRange = (a0, a1, o) => [Math.max(0, Math.floor(a0 - o)), Math.min(NC - 1, Math.floor(a1 - o))];
    for (let ei = 0; ei < ents.length; ei++) {
      const e = ents[ei], b = e.box;
      if (b.max.x < x0 || b.min.x > x1 || b.max.z < z0 || b.min.z > z1) continue;
      const g = e.m.geometry, pa = g.attributes.position, ix = g.index, n = pa.count, el = e.mw.elements;
      if (VB.length < n * 3) VB = new Float32Array(n * 3 * 1.5 | 0);
      for (let k = 0; k < n; k++) {
        const x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k);
        VB[3 * k] = el[0] * x + el[4] * y + el[8] * z + el[12]; VB[3 * k + 1] = el[1] * x + el[5] * y + el[9] * z + el[13]; VB[3 * k + 2] = el[2] * x + el[6] * y + el[10] * z + el[14];
      }
      const nt = (ix ? ix.count : n) / 3;
      for (let t = 0; t < nt; t++) {
        const ia = 3 * (ix ? ix.getX(3 * t) : 3 * t), ib = 3 * (ix ? ix.getX(3 * t + 1) : 3 * t + 1), ic = 3 * (ix ? ix.getX(3 * t + 2) : 3 * t + 2);
        const ax = VB[ia], ay = VB[ia + 1], az = VB[ia + 2], bx = VB[ib], by = VB[ib + 1], bz = VB[ib + 2], cx = VB[ic], cy = VB[ic + 1], cz = VB[ic + 2];
        const xmin = Math.min(ax, bx, cx), xmax = Math.max(ax, bx, cx), zmin = Math.min(az, bz, cz), zmax = Math.max(az, bz, cz);
        if (xmax < x0 || xmin > x1 || zmax < z0 || zmin > z1) continue;
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz);
        if (L < 1e-9) continue;
        const nyn = ny / L;
        let A, E, C;
        if (nyn > 0.5 || (e.ds && nyn < -0.5)) { A = F; E = FE; C = fc; }
        else if (Math.abs(nyn) <= 0.5) { if (Math.max(ay, by, cy) - Math.min(ay, by, cy) < 0.02) continue; A = W; E = WE; C = wc; }
        else continue;                                                                         // нижние грани (потолки) — не опора
        const id = E.length; A.push(ax, ay, az, bx, by, bz, cx, cy, cz); E.push(ei);
        const [i0, i1] = cellRange(xmin, xmax, x0), [j0, j1] = cellRange(zmin, zmax, z0);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) C[j * NC + i].push(id);
      }
    }
    return { x0, z0, F: new Float32Array(F), W: new Float32Array(W), FE: Int32Array.from(FE), WE: Int32Array.from(WE), fc, wc, stamp: new Uint32Array(WE.length) };
  }
  const tkey = (ti, tj) => ti * 100003 + tj;
  function tileAt(x, z) {
    const ti = Math.floor(x / TILE), tj = Math.floor(z / TILE), k = tkey(ti, tj);
    let t = tiles.get(k); if (!t) { t = buildTile(ti, tj); tiles.set(k, t); } return t;
  }
  function prefetch() {   // одна соседняя ячейка за кадр — без рывков при переходе через границу
    const ti = Math.floor(pos.x / TILE), tj = Math.floor(pos.z / TILE);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = tkey(ti + di, tj + dj); if (!tiles.has(k)) { tiles.set(k, buildTile(ti + di, tj + dj)); return; } }
  }
  /* ---------- опора под ногами: максимум по пятну стоп (центр и 4 точки на 0,1 м) — решётчатые ступени с зазорами ---------- */
  const FOOT = [[0, 0], [0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]];
  function floorAt(x, z, feet) {
    let best = -Infinity, surf = 'ground';
    for (const [dx, dz] of FOOT) { const r = floor1(x + dx, z + dz, feet); if (r[0] > best + 1e-4) { best = r[0]; surf = r[1]; } }
    return [best, surf];
  }
  function floor1(x, z, feet) {
    const lim = feet + STEP + 0.02; let best = inPH(x, z) ? -1e9 : hAt(x, z), metal = false;
    const t = tileAt(x, z), L = t.fc[Math.min(NC - 1, Math.floor(z - t.z0)) * NC + Math.min(NC - 1, Math.floor(x - t.x0))], F = t.F;
    for (let q = 0; q < L.length; q++) {
      const i = L[q], e = ents[t.FE[i]]; if (!meshVis[e.mi]) continue;
      const o = i * 9, ax = F[o], az = F[o + 2];
      const v0x = F[o + 3] - ax, v0z = F[o + 5] - az, v1x = F[o + 6] - ax, v1z = F[o + 8] - az, v2x = x - ax, v2z = z - az;
      const den = v0x * v1z - v1x * v0z; if (Math.abs(den) < 1e-12) continue;
      const u = (v2x * v1z - v1x * v2z) / den, v = (v0x * v2z - v2x * v0z) / den;
      if (u < -1e-4 || v < -1e-4 || u + v > 1.0001) continue;
      const y = F[o + 1] + u * (F[o + 4] - F[o + 1]) + v * (F[o + 7] - F[o + 1]);
      if (y <= lim && y > best) { best = y; metal = e.metal; }
    }
    if (best < -1e8) best = PH_F1;
    return [best, metal ? 'metal' : 'ground'];
  }
  function coveredAt(x, z, feet) {   // есть ли над головой кровля/настил (для выбора свободного места)
    const t = tileAt(x, z), L = t.fc[Math.min(NC - 1, Math.floor(z - t.z0)) * NC + Math.min(NC - 1, Math.floor(x - t.x0))], F = t.F;
    for (const i of L) {
      if (!meshVis[ents[t.FE[i]].mi]) continue; const o = i * 9;
      const ax = F[o], az = F[o + 2], v0x = F[o + 3] - ax, v0z = F[o + 5] - az, v1x = F[o + 6] - ax, v1z = F[o + 8] - az, v2x = x - ax, v2z = z - az;
      const den = v0x * v1z - v1x * v0z; if (Math.abs(den) < 1e-12) continue;
      const u = (v2x * v1z - v1x * v2z) / den, v = (v0x * v2z - v2x * v0z) / den;
      if (u < -1e-4 || v < -1e-4 || u + v > 1.0001) continue;
      const y = F[o + 1] + u * (F[o + 4] - F[o + 1]) + v * (F[o + 7] - F[o + 1]);
      if (y > feet + 2.2 && y < feet + 40) return true;
    }
    return false;
  }
  /* ---------- столкновения: цилиндр тела против треугольников стен в полосе [ступня+0,45; ступня+1,85] ---------- */
  let stampN = 1;
  const clip = (P, h, s) => {   // отсечение многоугольника (x,y,z…) плоскостью y=h, оставляем s·(y−h) ≥ 0
    const out = [], n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, da = (P[3 * i + 1] - h) * s, db = (P[3 * j + 1] - h) * s;
      if (da >= 0) out.push(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
      if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); out.push(P[3 * i] + (P[3 * j] - P[3 * i]) * k, h, P[3 * i + 2] + (P[3 * j + 2] - P[3 * i + 2]) * k); }
    }
    return out;
  };
  // тело: ноги — R 0,16 м в полосе [ступня+0,45; +1,0], корпус — R 0,28 м в полосе [+1,0; +1,85]
  function pushOut(p, P, R0, W, o, from) {
    const n = P.length / 3; if (!n) return false;
    let bd = Infinity, qx = 0, qz = 0, inside = false;
    for (let a = 0; a < n; a++) {
      const b = (a + 1) % n, ax = P[3 * a], az = P[3 * a + 2], ex = P[3 * b] - ax, ez = P[3 * b + 2] - az, l2 = ex * ex + ez * ez;
      const k = l2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / l2)) : 0;
      const sx = ax + ex * k, sz = az + ez * k, d2 = (p.x - sx) ** 2 + (p.z - sz) ** 2;
      if (d2 < bd) { bd = d2; qx = sx; qz = sz; }
      if (n > 2 && ((az > p.z) !== (P[3 * b + 2] > p.z)) && (p.x < ax + ex * (p.z - az) / (ez || 1e-12))) inside = !inside;
    }
    if (!inside && bd >= R0 * R0) return false;
    let dx = p.x - qx, dz = p.z - qz; const d = Math.sqrt(bd);
    if (d < 1e-5) {                                                                     // ровно на линии — по нормали грани, в сторону, откуда пришли
      const ux = W[o + 3] - W[o], uz = W[o + 5] - W[o + 2], vx = W[o + 6] - W[o], vz = W[o + 8] - W[o + 2], uy = W[o + 4] - W[o + 1], vy = W[o + 7] - W[o + 1];
      let nx = uy * vz - uz * vy, nz = ux * vy - uy * vx; const ln = Math.hypot(nx, nz) || 1; nx /= ln; nz /= ln;
      const sg = from && ((from.x - qx) * nx + (from.z - qz) * nz) < 0 ? -1 : 1;
      p.x = qx + nx * sg * R0; p.z = qz + nz * sg * R0; return true;
    }
    if (inside) { dx = -dx; dz = -dz; }                                                 // центр внутри проекции — наружу через ближайшее ребро
    const k = inside ? (R0 + d) / d : (R0 - d) / d; p.x += dx * k; p.z += dz * k; return true;
  }
  function collide(p, feet, from) {
    const yL = feet + STEP, yK = feet + KNEE, yT = feet + BAND1; let hit = false;
    for (let it = 0; it < 3; it++) {
      let moved = false; stampN = (stampN + 1) >>> 0 || 1;
      for (let cz = Math.floor(p.z - R); cz <= Math.floor(p.z + R); cz++) for (let cx = Math.floor(p.x - R); cx <= Math.floor(p.x + R); cx++) {
        const t = tileAt(cx + 0.5, cz + 0.5), L = t.wc[(cz - t.z0) * NC + (cx - t.x0)], W = t.W;
        for (let q = 0; q < L.length; q++) {
          const i = L[q]; if (t.stamp[i] === stampN) continue; t.stamp[i] = stampN;
          const o = i * 9, ymax = Math.max(W[o + 1], W[o + 4], W[o + 7]), ymin = Math.min(W[o + 1], W[o + 4], W[o + 7]);
          if (ymax < yL || ymin > yT) continue;
          if (Math.max(W[o], W[o + 3], W[o + 6]) < p.x - R || Math.min(W[o], W[o + 3], W[o + 6]) > p.x + R ||
              Math.max(W[o + 2], W[o + 5], W[o + 8]) < p.z - R || Math.min(W[o + 2], W[o + 5], W[o + 8]) > p.z + R) continue;
          if (!meshVis[ents[t.WE[i]].mi]) continue;
          const T = [W[o], W[o + 1], W[o + 2], W[o + 3], W[o + 4], W[o + 5], W[o + 6], W[o + 7], W[o + 8]];
          if (ymax >= yL && ymin <= yK && pushOut(p, clip(clip(T, yL, 1), yK, -1), RL, W, o, from)) moved = hit = true;
          if (ymax >= yK && ymin <= yT && pushOut(p, clip(clip(T, yK, 1), yT, -1), R, W, o, from)) moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }
  const _q = new THREE.Vector3();
  function freeSpot(x, z, rMax = 16) {   // ближайшее открытое (не под кровлей) и свободное место на земле
    for (let r = 0; r <= rMax; r += 0.7) {
      const na = r ? Math.max(6, Math.round(2 * Math.PI * r / 0.8)) : 1;
      for (let a = 0; a < na; a++) {
        const cx = Math.max(BX0, Math.min(BX1, x + r * Math.cos(a / na * 2 * Math.PI))), cz = Math.max(BZ0, Math.min(BZ1, z + r * Math.sin(a / na * 2 * Math.PI)));
        if (inPH(cx, cz)) continue;
        const [fl] = floorAt(cx, cz, hAt(cx, cz));
        if (fl - hAt(cx, cz) > 0.25 || coveredAt(cx, cz, fl)) continue;                    // не на оборудовании и не под кровлей
        _q.set(cx, 0, cz); if (collide(_q, fl, null)) continue;
        return [cx, cz, fl];
      }
    }
    return null;
  }
  /* ---------- интерфейс ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #wHud{position:fixed;left:10px;top:58px;display:none;flex-direction:column;align-items:flex-start;gap:5px;z-index:4;max-width:min(560px,calc(100% - 20px))}
    #wHud .bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:rgba(20,32,44,.84);color:#fff;border-radius:10px;padding:6px 8px;font-size:12.5px}
    #wHud select{font:inherit;font-size:12.5px;max-width:230px;border-radius:7px;border:0;padding:4px 5px}
    #wHud .wb{background:#fff;color:#1d2a36;border:0;border-radius:7px;padding:5px 10px;font-size:12.5px;cursor:pointer}
    #wHud .wb.on{background:#e0b531}
    #wZone{font-size:12px;opacity:.92}
    #wKeys{font-size:11px;opacity:.85}
    #wHint{position:fixed;left:50%;top:calc(50% + 20px);transform:translateX(-50%);background:rgba(20,32,44,.82);color:#fff;padding:5px 10px;border-radius:9px;font-size:12.5px;display:none;z-index:3;white-space:nowrap;max-width:86vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    #wHint b{color:#ffd76a}
    #wCross{position:fixed;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;display:none;pointer-events:none;z-index:3}
    #wCross:before,#wCross:after{content:'';position:absolute;background:rgba(255,255,255,.92);box-shadow:0 0 2px rgba(0,0,0,.8)}
    #wCross:before{left:7px;top:0;width:2px;height:16px} #wCross:after{top:7px;left:0;width:16px;height:2px}
    #wJoy{position:fixed;left:18px;bottom:58px;width:128px;height:128px;border-radius:50%;background:rgba(20,32,44,.3);border:2px solid rgba(255,255,255,.65);display:none;z-index:4;touch-action:none}
    #wJoy i{position:absolute;left:38px;top:38px;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.88);box-shadow:0 2px 6px rgba(0,0,0,.3);pointer-events:none}
    #wMap{position:fixed;right:10px;bottom:98px;width:212px;height:124px;border-radius:9px;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;z-index:3;cursor:crosshair;background:#a8b38b}
    body.walk #foot, body.walk #labels, body.walk #scale{display:none}
    body.walk canvas{cursor:grab}
    @media (pointer:coarse){ #wHud #wKeys{display:none} body.walk #wJoy{display:block} body.walk #info{bottom:196px;max-height:36vh;overflow:auto} }
    @media (max-width:700px){ #wMap{width:150px;height:88px;bottom:120px} #wHud select{max-width:190px} }
  `;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'wHud';
  hud.innerHTML = `<div class="bar"><b>Обход</b><select id="wPt" title="Перейти к точке обхода"><option value="">Перейти к точке…</option>${PTS.map((p, i) => `<option value="${i}">${p.n}</option>`).join('')}</select>` +
    `<button class="wb" id="wRun" title="Бегом (удерживайте Shift)">Бегом</button><button class="wb" id="wPass" title="Паспорт объекта в прицеле (E)" style="display:none">Паспорт</button><button class="wb" id="wExit" title="Выйти из обхода (Esc)">Выход</button></div>` +
    `<div class="bar"><span id="wZone">—</span></div>` +
    `<div class="bar" id="wKeys">W/S/A/D — шаги · ←/→ — поворот · мышь (перетаскивание) — обзор · колесо — приближение · Shift — бегом · E — паспорт · Esc — выход · клик по мини-карте — переход</div>`;
  document.body.appendChild(hud);
  const hint = document.createElement('div'); hint.id = 'wHint'; document.body.appendChild(hint);
  const cross = document.createElement('div'); cross.id = 'wCross'; document.body.appendChild(cross);
  const joy = document.createElement('div'); joy.id = 'wJoy'; joy.innerHTML = '<i></i>'; joy.title = 'Джойстик: шаги'; document.body.appendChild(joy);
  const map = document.createElement('canvas'); map.id = 'wMap'; map.title = 'Мини-карта (подложка — покрытия ГП-003). Нажмите, чтобы перейти в точку'; document.body.appendChild(map);
  const $ = id => document.getElementById(id);
  const coarse = matchMedia('(pointer:coarse)');
  const placeHud = () => { const t = $('top'); hud.style.top = ((t ? t.getBoundingClientRect().bottom : 48) + 6) + 'px'; };
  addEventListener('resize', () => { if (st.on) placeHud(); });
  /* джойстик */
  { const knob = joy.firstChild; let id = null, cx = 0, cy = 0;
    const mv = e => { let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), M = 52; if (d > M) { dx *= M / d; dy *= M / d; } st.joy.x = dx / M; st.joy.y = -dy / M; knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener('pointerdown', e => { if (id !== null) return; id = e.pointerId; try { joy.setPointerCapture(id); } catch (_) {} const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); e.preventDefault(); e.stopPropagation(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === id) { mv(e); e.preventDefault(); } });
    const up = e => { if (e.pointerId !== id) return; id = null; st.joy.x = st.joy.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up); joy.addEventListener('lostpointercapture', up);
  }
  /* обзор перетаскиванием по сцене (мышь и касание; несколько касаний — по первому) */
  { let drag = null;
    renderer.domElement.addEventListener('pointerdown', e => { if (st.on && !drag) drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!st.on || !drag || e.pointerId !== drag.id) return;
      const k = (e.pointerType === 'touch' ? 0.0062 : 0.0045) * st.fov / 70;
      st.yaw += (e.clientX - drag.x) * k; st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch + (e.clientY - drag.y) * k));
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    renderer.domElement.addEventListener('wheel', e => { if (!st.on) return; st.fov = Math.max(30, Math.min(80, st.fov * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); camera.fov = st.fov; camera.updateProjectionMatrix(); e.preventDefault(); }, { passive: false });
  }
  /* клавиатура */
  const KM = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr' };
  addEventListener('keydown', e => {
    if (!st.on || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
    if (e.code === 'Escape') { exit(); return; }
    if (e.code === 'KeyE') { if (st.aim) { select(st.aim); if (window.__RGSP) window.__RGSP.onPick(st.aimHit); } return; }
    if (e.key === 'Shift') st.run = true;
    const a = KM[e.code]; if (a) { st.keys.add(a); e.preventDefault(); }
  });
  addEventListener('keyup', e => { const a = KM[e.code]; if (a) st.keys.delete(a); if (e.key === 'Shift') st.run = st.runBtn; });
  addEventListener('blur', () => { st.keys.clear(); st.run = st.runBtn; });
  $('wRun').onclick = () => { st.runBtn = !st.runBtn; st.run = st.runBtn; $('wRun').classList.toggle('on', st.runBtn); };
  $('wExit').onclick = () => exit();
  $('wPass').onclick = () => { if (st.aim) { select(st.aim); if (window.__RGSP) window.__RGSP.onPick(st.aimHit); } };
  $('wPt').onchange = e => { const i = e.target.value; if (i !== '') goPoint(PTS[+i]); e.target.value = ''; e.target.blur(); };
  /* мини-карта: подложка покрытий ГП-003 (та же, что у рельефа) */
  const MX0 = -102.22, MZ0 = -54.35, MW = 193.0, MD = 112.7;
  map.addEventListener('click', e => {
    const r = map.getBoundingClientRect(), x = MX0 + (e.clientX - r.left) / r.width * MW, z = MZ0 + (e.clientY - r.top) / r.height * MD;
    const f = freeSpot(x, z, 12);
    if (f) { setPos(f[0], f[1], f[2]); toast2('Переход: ближайшее открытое место у выбранной точки'); }
    else toast2('Рядом нет свободного открытого места — выберите точку обхода из списка');
  });
  const toast2 = t => { if (typeof toast === 'function') toast(t); };
  function drawMap() {
    const w = map.clientWidth, h = map.clientHeight; if (!w) return;
    const dpr = Math.min(2, devicePixelRatio || 1); if (map.width !== Math.round(w * dpr)) { map.width = Math.round(w * dpr); map.height = Math.round(h * dpr); }
    const c = map.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const img = TERR.material.map && TERR.material.map.image;
    if (img && (img.width || img.naturalWidth)) c.drawImage(img, 0, 0, w, h); else { c.fillStyle = '#a8b38b'; c.fillRect(0, 0, w, h); }
    c.fillStyle = 'rgba(29,78,122,.9)'; for (const p of PTS) { c.beginPath(); c.arc((p.p[0] - MX0) / MW * w, (p.p[1] - MZ0) / MD * h, 2.4, 0, 7); c.fill(); }
    const px = (pos.x - MX0) / MW * w, pz = (pos.z - MZ0) / MD * h, fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), half = Math.atan(Math.tan(st.fov * Math.PI / 360) * camera.aspect);
    c.fillStyle = 'rgba(255,215,106,.42)'; c.beginPath(); c.moveTo(px, pz);
    for (const a of [-half, half]) { const ca = Math.cos(a), sa = Math.sin(a); c.lineTo(px + (fx * ca - fz * sa) * 24, pz + (fx * sa + fz * ca) * 24); } c.closePath(); c.fill();
    c.fillStyle = '#d0261c'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, pz, 4, 0, 7); c.fill(); c.stroke();
  }
  /* ---------- вход / выход / переходы ---------- */
  function setPos(x, z, feet, yaw) {
    pos.set(Math.max(BX0, Math.min(BX1, x)), 0, Math.max(BZ0, Math.min(BZ1, z)));
    st.feet = feet; collide(pos, feet, null);
    st.feet = floorAt(pos.x, pos.z, feet + 0.05)[0]; st.eye = st.feet + EYE; st.vy = 0; st.grounded = true;
    if (yaw !== undefined && yaw !== null) st.yaw = yaw;
  }
  function goPoint(p) {
    const y = p.y !== undefined ? p.y : hAt(p.p[0], p.p[1]);
    setPos(p.p[0], p.p[1], y, p.yaw); st.pitch = -0.05;
  }
  function enter(at) {
    if (st.on) return;
    camAnim = null; select(null); closePanels();
    st.save = { fov: camera.fov, near: camera.near };
    collect();
    st.on = true; window.__walkOn = true; controls.enabled = false;
    st.fov = 70; camera.fov = 70; camera.near = 0.15; camera.updateProjectionMatrix();
    document.body.classList.add('walk'); placeHud();
    hud.style.display = 'flex'; map.style.display = 'block'; cross.style.display = 'block';
    $('bWalk').classList.add('on');
    if (at) { goPoint(at); return; }
    // старт — там, куда смотрит камера орбиты, направление взгляда сохраняется
    const t = controls.target, dx = t.x - camera.position.x, dz = t.z - camera.position.z, yaw = Math.hypot(dx, dz) > 0.5 ? Math.atan2(-dx, -dz) : Math.PI;
    if (inPH(t.x, t.z)) { let best = PTS[4], bd = Infinity; for (const p of PTS) if (p.y !== undefined && p.y < 0) { const d = Math.hypot(p.p[0] - t.x, p.p[1] - t.z); if (d < bd) { bd = d; best = p; } } goPoint(best); return; }
    const f = freeSpot(t.x, t.z, 16);
    if (f) { setPos(f[0], f[1], f[2], yaw); st.pitch = -0.05; } else goPoint(PTS[0]);
  }
  function exit() {
    if (!st.on) return;
    st.on = false; window.__walkOn = false; st.keys.clear(); st.joy.x = st.joy.y = 0;
    camera.fov = st.save.fov; camera.near = st.save.near; camera.updateProjectionMatrix();
    // орбитальная камера — над местом, где закончился обход, с тем же направлением взгляда
    controls.target.set(pos.x, st.feet, pos.z);
    camera.position.set(pos.x + Math.sin(st.yaw) * 24, st.feet + 16, pos.z + Math.cos(st.yaw) * 24);
    controls.enabled = true; controls.update();
    document.body.classList.remove('walk');
    hud.style.display = 'none'; map.style.display = 'none'; cross.style.display = 'none'; hint.style.display = 'none';
    $('bWalk').classList.remove('on');
    tiles.clear(); ents = []; meshes = [];
  }
  window.__walkExit = exit;
  /* ---------- шаги: звук по типу покрытия (канал «Шаги (обход)» в настройках звука) ---------- */
  let sg = null;
  function stepSound(surf) {
    const A = procAudio; if (!A || !A.ctx || !A.on || !A.ch.steps || A.ctx.state !== 'running') return;
    const ctx = A.ctx; if (!sg) { sg = ctx.createGain(); sg.connect(ctx.destination); }
    sg.gain.value = A.vol * 0.5;
    const t = ctx.currentTime, len = surf === 'metal' ? 0.07 : 0.11, b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, surf === 'metal' ? 5 : 2.5);
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = surf === 'metal' ? 1500 + Math.random() * 300 : 380 + Math.random() * 160; f.Q.value = surf === 'metal' ? 3 : 0.8;
    const g = ctx.createGain(); g.gain.value = surf === 'metal' ? 0.55 : 0.9; s.connect(f).connect(g).connect(sg); s.start(t);
    if (surf === 'metal') {   // звон стального настила
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 540 + Math.random() * 90;
      og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(og).connect(sg); o.start(t); o.stop(t + 0.18);
    }
  }
  /* ---------- кадр ---------- */
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _p = new THREE.Vector3(), _from = new THREE.Vector3(), aimRay = new THREE.Raycaster(), _c = new THREE.Vector2(0, 0);
  let tPrev = performance.now(), mapT = 0;
  function tick(dtSim) {   // dtSim — только для автоматической проверки (детерминированный шаг)
    const now = performance.now(), dt = dtSim !== undefined ? dtSim : Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    if (!st.on) return;
    if (now - visT > 500) { visT = now; updVis(); }
    if (st.keys.has('tl')) st.yaw += dt * 1.5; if (st.keys.has('tr')) st.yaw -= dt * 1.5;
    _f.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)); _r.set(-_f.z, 0, _f.x);
    let mx = st.joy.x, my = st.joy.y;
    if (st.keys.has('f')) my += 1; if (st.keys.has('b')) my -= 1; if (st.keys.has('r')) mx += 1; if (st.keys.has('l')) mx -= 1;
    const ml = Math.hypot(mx, my), mag = Math.min(1, ml);
    if (mag > 0.06 && st.grounded) {
      const total = (st.run ? VRUN : VW) * mag * dt, ns = Math.max(1, Math.ceil(total / 0.1)), k = total / ns / ml;
      for (let s = 0; s < ns; s++) {
        _from.copy(pos); _p.copy(pos).addScaledVector(_f, my * k).addScaledVector(_r, mx * k);
        _p.x = Math.max(BX0, Math.min(BX1, _p.x)); _p.z = Math.max(BZ0, Math.min(BZ1, _p.z));
        collide(_p, st.feet, _from);
        const [fl] = floorAt(_p.x, _p.z, st.feet);
        if (fl > st.feet) st.feet = fl;                                                    // подъём на ступень
        st.dist += Math.hypot(_p.x - pos.x, _p.z - pos.z); pos.x = _p.x; pos.z = _p.z;
      }
    }
    // опора: спуск по ступеням — сразу, с края выше шага — падение
    const [fl, surf] = floorAt(pos.x, pos.z, st.feet); st.surf = surf;
    if (st.feet - fl > 0.005) {
      if (st.grounded && st.feet - fl <= STEP) st.feet = fl;
      else { st.grounded = false; st.vy -= 9.81 * dt; st.feet = Math.max(fl, st.feet + st.vy * dt); if (st.feet <= fl + 1e-4) { st.feet = fl; st.vy = 0; st.grounded = true; stepSound(surf); } }
    } else { st.feet = Math.max(st.feet, fl); st.vy = 0; st.grounded = true; }
    if (st.dist > (st.run ? 1.2 : 0.75)) { st.dist = 0; stepSound(surf); }
    prefetch();
    // камера: глаза 1,65 м, сглаживание ступеней, лёгкое покачивание при ходьбе
    st.eye += (st.feet + EYE - st.eye) * Math.min(1, dt * (st.grounded ? 14 : 40));
    const bob = mag > 0.06 && st.grounded ? Math.sin(now * (st.run ? 0.0155 : 0.0105)) * 0.022 * mag : 0;
    camera.position.set(pos.x, st.eye + bob, pos.z);
    camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ');
    controls.target.copy(camera.position).addScaledVector(_f, 25);                         // для теней (VIS) — область перед игроком
    // объект в прицеле → паспорт по E / кнопке «Паспорт»; «Рядом» — ближайший объект генплана
    if (now - st.aimT > 220) {
      st.aimT = now; camera.updateMatrixWorld(); aimRay.setFromCamera(_c, camera); aimRay.far = 14;
      const h = aimRay.intersectObjects(pickables, false).find(q => vis(q.object));
      const o = h ? (h.object.userData.pick ? h.object.userData.pick(h) : h.object.userData.o) : null;
      st.aim = o || null; st.aimHit = h || null;
      if (o) { hint.innerHTML = `<b>№ ${o.id}</b> — ${o.name}<span style="opacity:.75"> · ${coarse.matches ? '«Паспорт»' : 'E — паспорт'}</span>`; hint.style.display = 'block'; } else hint.style.display = 'none';
      $('wPass').style.display = o ? '' : 'none';
      let bo = null, bd = 18;
      for (const q of OBJ) { if (q.maf || q.net || q.fence || !q.anchor || !q.g.visible) continue; const d = Math.hypot(q.anchor.x - pos.x, q.anchor.z - pos.z); if (d < bd) { bd = d; bo = q; } }
      const where = inPH(pos.x, pos.z) ? 'Насосный цех 200' : bo ? `Рядом: № ${bo.id} — ${bo.name}` : 'Территория склада';
      $('wZone').textContent = `${where} · отм. ${(H0 + st.feet).toFixed(2).replace('.', ',')}`;
    }
    if (now - mapT > 120) { mapT = now; drawMap(); }
  }
  return { tick, enter, exit, PTS, faceNorth: () => { st.yaw = Math.atan2(-NORTH.x, -NORTH.y); }, get on() { return st.on; }, st, pos, floorAt, collide, freeSpot, setPos, goPoint, tiles, get ents() { return ents; } };
})();
document.getElementById('bWalk').onclick = () => WALK.on ? WALK.exit() : WALK.enter();

