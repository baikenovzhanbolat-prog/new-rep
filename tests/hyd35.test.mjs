/* Модульные тесты ядра гидравлики HYD35: физика трубы, характеристика насоса, решение маршрута, автоматы насосов и арматуры */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHyd35 } from './load.mjs';

const H = loadHyd35();
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (допуск ${tol})`);

/* Коулбрук — эталон для проверки приближения Свами–Джейна */
function colebrook(Re, d, eps) {
  let f = 0.02;
  for (let i = 0; i < 50; i++) f = Math.pow(-2 * Math.log10(eps / (3.7 * d) + 2.51 / (Re * Math.sqrt(f))), -2);
  return f;
}

test('трение: ламинарный режим 64/Re', () => {
  near(H.frictionFactor(1000, 0.1, 1e-4), 0.064, 1e-12, 'Re = 1000');
  assert.equal(H.frictionFactor(0, 0.1, 1e-4), 0);
});

test('трение: турбулентный режим близок к Коулбруку (≤ 3 %)', () => {
  for (const [Re, d, eps] of [[1e4, 0.1, 1e-4], [1e5, 0.2, 2e-4], [1e6, 0.05, 5e-5]]) {
    const f = H.frictionFactor(Re, d, eps), c = colebrook(Re, d, eps);
    assert.ok(Math.abs(f - c) / c < 0.03, `Re ${Re}: ${f} против ${c}`);
  }
});

test('трение: переходная зона непрерывна', () => {
  near(H.frictionFactor(2299.999, 0.1, 1e-4), H.frictionFactor(2300, 0.1, 1e-4), 1e-6, 'на 2300');
  near(H.frictionFactor(3999.999, 0.1, 1e-4), H.frictionFactor(4000, 0.1, 1e-4), 1e-6, 'на 4000');
});

test('продукт: плотность и вязкость падают с температурой', () => {
  for (const code of Object.keys(H.DATA.fluids)) {
    const a = H.fluidAt(code, 0), b = H.fluidAt(code, 30);
    assert.ok(a.rho > b.rho && a.nu > b.nu, code);
  }
  assert.throws(() => H.fluidAt('XX'));
});

test('участок: потери ≈ Q² в турбулентном режиме, обратный клапан не пускает обратный ток', () => {
  const fl = H.fluidAt('DTL', 20), s = H.seg({ id: 's', Dn: 108, s: 4, L: 100, fittings: { elbow90: 2, gateOpen: 1 } });
  assert.equal(H.segLoss(s, 0, fl, 1e-4), 0);
  const h1 = H.segLoss(s, 0.01, fl, 1e-4), h2 = H.segLoss(s, 0.02, fl, 1e-4);
  assert.ok(h1 > 0 && h2 / h1 > 3.5 && h2 / h1 < 4.1, `отношение ${h2 / h1}`);
  const c = H.seg({ id: 'c', Dn: 108, s: 4, L: 1, check: true });
  assert.equal(H.segLoss(c, -0.01, fl, 1e-4), -Infinity);
});

test('насос: напор убывает с подачей, при s = 0,5 напор холостого хода — четверть', () => {
  const def = H.DATA.pumps['Н-5'], c = H.pumpCurve(def, 1), c2 = H.pumpCurve(def, 0.5);
  let prev = Infinity;
  for (let q = 0; q <= def.Qn / 3600 * 1.2; q += 0.002) { const h = c.H(q); assert.ok(h <= prev + 1e-9); prev = h; }
  near(c2.H0, c.H0 / 4, 1e-9, 'H0(0,5)');
});

/* маршрут: ёмкость A (zSurf) → насос → ёмкость B (zSurf) */
const route = (zA, zB, pump = 'Н-5') => ({
  fluid: 'DTL', T: 20, pump: { id: pump, s: 1, z: 0 },
  suction: { kind: 'junction', branches: [{ id: 'bs', segs: [H.seg({ id: 's', Dn: 219, s: 6, L: 30, fittings: { elbow90: 2 } })], to: { kind: 'tank', id: 'A', zSurf: zA } }] },
  discharge: { kind: 'junction', branches: [{ id: 'bd', segs: [H.seg({ id: 'd', Dn: 159, s: 4.5, L: 250, fittings: { elbow90: 6, gateOpen: 2 } })], to: { kind: 'tank', id: 'B', zSurf: zB } }] },
});

test('маршрут: рабочая точка лежит на характеристике насоса и балансе напоров', () => {
  const r = H.solveRoute(route(5, 15));
  assert.equal(r.status, 'ok');
  assert.ok(r.Q > 0);
  const c = H.pumpCurve(H.DATA.pumps['Н-5'], 1);
  near(r.Hpump, c.H(r.Qpump / 3600), 0.02, 'напор насоса = H(Q)');
  near(r.Hpump, r.Hd - r.Hs, 0.02, 'напор насоса = Hнагн − Hвсас');
});

test('маршрут: чем выше приёмник, тем меньше подача; выше напора насоса — подачи нет', () => {
  const q = [10, 20, 30].map(z => H.solveRoute(route(5, z)).Q);
  assert.ok(q[0] > q[1] && q[1] > q[2], q.join(' > '));
  const r = H.solveRoute(route(5, 200));
  assert.equal(r.status, 'shutoff');
  assert.equal(r.Q, 0);
  assert.ok(r.warnings.some(w => w.code === 'NO_HEAD'));
});

test('маршрут: задвижка закрыта — подачи нет', () => {
  const rt = route(5, 15);
  rt.discharge.branches[0].segs[0].valves = [{ type: 'gate', pos: 0 }];
  const r = H.solveRoute(rt);
  assert.equal(r.Q, 0);
});

test('автомат насоса: пуск → работа за время разгона, останов → стоит за время выбега', () => {
  const sm = new H.PumpSM(['Н-5']), t = H.DATA.timing.pump.dol;
  assert.equal(sm.get('Н-5').state, 'stop');
  assert.ok(sm.cmdStart('Н-5').ok);
  sm.tick(t.acc / 2); assert.equal(sm.get('Н-5').state, 'start'); near(sm.speed('Н-5'), 0.5, 1e-9, 'скорость на половине разгона');
  sm.tick(t.acc); assert.equal(sm.get('Н-5').state, 'run');
  sm.cmdStop('Н-5'); sm.tick(t.dec + 0.01); assert.equal(sm.get('Н-5').state, 'stop');
});

test('автомат арматуры: ход за время хода, заклинивание останавливает ход', () => {
  const vs = new H.ValveSM({ V1: { kind: 'gate_m', travel: 20 } });
  assert.equal(vs.get('V1').state, 'closed');
  vs.cmdOpen('V1'); vs.tick(10);
  assert.equal(vs.get('V1').state, 'opening'); near(vs.pos('V1'), 0.5, 1e-9, 'половина хода');
  vs.setJam('V1', true); vs.tick(10); near(vs.pos('V1'), 0.5, 1e-9, 'заклинила');
  vs.setJam('V1', false); vs.cmdOpen('V1'); vs.tick(10.01); assert.ok(vs.fullyOpen('V1'));
});
