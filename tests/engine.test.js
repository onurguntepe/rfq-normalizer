const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const M = require('../js/model.js');
const SCEN = require('../js/scenarios.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);
const scenario = id => M.scenarioState(SCEN.find(s => s.id === id), 'tr');

test('present value factors match hand calculation', () => {
  // 90-day cheque of 1,000,000 TL at 4 % a month: 1e6 / 1.04^3
  near(E.pvFactor([{ pct: 100, days: 90 }], 0.04, 0) * 1e6, 888996.36, 0.01);
  // 30-60-90 equal cheques
  near(E.pvFactor(E.planFromPreset('30_60_90'), 0.04, 0), (1 / 1.04 + 1 / 1.04 ** 2 + 1 / 1.04 ** 3) / 3);
  // EUR 30 % now, 70 % in 60 days, FX +2 %/month
  near(E.pvFactor(E.planFromPreset('adv30_60'), 0.04, 0.02), 0.3 + 0.7 * (1.02 / 1.04) ** 2);
  // cash is cash
  near(E.pvFactor(E.planFromPreset('cash'), 0.04, 0), 1);
});

test('rebar theoretical mass and unit conversion', () => {
  near(E.rebarKgPerM(12), 0.888, 0.001);
  const item = { unit: 'Ton', kgPerM: E.rebarKgPerM(12) };
  // one 12 m bar of Ø12 is about 10.65 kg = 0.01065 t
  near(E.conversionFactor(item, 'Boy'), 0.888 * 12 / 1000, 0.00002);
  near(E.conversionFactor(item, 'kg'), 0.001);
  near(E.conversionFactor(item, 'Ton'), 1);
  assert.equal(E.conversionFactor({ unit: 'Ton' }, 'm'), null, 'metre needs a mass per metre');
  assert.equal(E.conversionFactor({ unit: 'm²' }, 'adet'), null);
});

test('VAT-included quote is compared VAT-excluded', () => {
  const items = [{ id: 'a', name: 'A', qty: 10, unit: 'Ton' }];
  const sup = { id: 's', currency: 'TRY', plan: [{ pct: 100, days: 0 }], vatIncluded: true, lines: { a: { price: 1200 } } };
  const r = E.evaluateSupplier(sup, items, { monthlyRate: 4, vatRate: 20 });
  near(r.paper, 12000);
  near(r.net, 10000);
  near(r.vat, 2000);
  near(r.pv, 10000);
});

test('PKT-01 numbers are stable and the per-bar quote converts', () => {
  const st = scenario('pkt01_rebar');
  const res = E.evaluate(st);
  const byId = Object.fromEntries(res.evals.map(e => [e.id, e]));
  near(byId.reb_sup1.pv, 3127000, 1);
  near(byId.reb_sup2.pv, 3056331, 1);
  near(byId.reb_sup3.pv, 3040312, 1);
  // Supplier D quoted Ø12 per bar incl. VAT; net per ton should land back near 30,380
  near(byId.reb_sup4.lines.reb_2.netUnitOrig, 30380, 2);
  assert.equal(byId.reb_sup4.complete, false);
  assert.deepEqual(byId.reb_sup4.missing, ['reb_4']);
  assert.ok(!res.byPv.some(e => e.id === 'reb_sup4'), 'incomplete quote is not ranked');
  assert.equal(res.leader.id, 'reb_sup3');
  assert.equal(res.paperLeader.id, 'reb_sup1');
});

test('missing prices are never borrowed from another supplier', () => {
  const st = scenario('pkt01_rebar');
  st.suppliers[0].lines.reb_4.price = null;
  const res = E.evaluate(st);
  const a = res.evals.find(e => e.id === 'reb_sup1');
  assert.equal(a.complete, false);
  assert.ok(a.lines.reb_4.missing);
  assert.ok(a.pv < 3127000 - 700000, 'missing line is not filled');
  assert.ok(!res.byPv.includes(a));
});

test('split order charges full logistics to every supplier used (PKT-10)', () => {
  const st = scenario('pkt10_infra');
  const res = E.evaluate(st);
  // The prototype reported +12,453 TL from splitting. With full freight per
  // supplier the best split is the single leader itself.
  assert.ok(res.split.total >= res.leader.pv - 1, `split ${res.split.total} vs leader ${res.leader.pv}`);
  near(res.splitSaving, 0, 1);
});

test('split order still finds real savings (PKT-02)', () => {
  const res = E.evaluate(scenario('pkt02_concrete'));
  assert.ok(res.splitSaving > 0);
  // brute-force check of the optimiser on this package
  const evals = res.evals;
  let best = Infinity;
  const n = evals.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const used = new Set();
    let mat = 0, ok = true;
    for (const item of res.evals[0] ? Object.keys(evals[0].lines) : []) {
      let b = null;
      for (let k = 0; k < n; k++) if (mask & (1 << k)) {
        const l = evals[k].lines[item];
        if (!l.missing && (b === null || l.pvMaterial < evals[b].lines[item].pvMaterial)) b = k;
      }
      if (b === null) { ok = false; break; }
      used.add(b); mat += evals[b].lines[item].pvMaterial;
    }
    if (!ok) continue;
    let lg = 0; used.forEach(k => { lg += evals[k].logistics; });
    best = Math.min(best, mat + lg);
  }
  near(res.split.total, best, 0.01);
});

test('break-even rate flips the order', () => {
  const st = scenario('pkt01_rebar');
  const [a, , c] = st.suppliers;
  const x = E.breakEvenRate(a, c, st.items, st.macro);
  assert.ok(x !== null && x > 0 && x < 8, `break-even ${x}`);
  const below = E.evaluateSupplier(a, st.items, st.macro, x - 0.2).pv - E.evaluateSupplier(c, st.items, st.macro, x - 0.2).pv;
  const above = E.evaluateSupplier(a, st.items, st.macro, x + 0.2).pv - E.evaluateSupplier(c, st.items, st.macro, x + 0.2).pv;
  assert.ok(below * above < 0);
});

test('challenger ask closes the gap exactly', () => {
  const st = scenario('pkt01_rebar');
  const res = E.evaluate(st);
  const b = res.evals.find(e => e.id === 'reb_sup2');
  const ask = E.challengerAsk(b, res.leader.pv, st.macro);
  near(b.pvMaterial * (1 - ask.discountPct / 100) + b.logistics, res.leader.pv, 0.01);
  const shifted = { ...st.suppliers[1], plan: st.suppliers[1].plan.map(t => ({ ...t, days: t.days + ask.extraDays })) };
  near(E.evaluateSupplier(shifted, st.items, st.macro).pv, res.leader.pv, 0.5);
});

test('every demo package evaluates without NaN', () => {
  for (const p of SCEN) {
    const res = E.evaluate(M.scenarioState(p, 'en'));
    for (const e of res.evals) assert.ok(Number.isFinite(e.pv), `${p.id} ${e.id}`);
    assert.ok(res.leader, p.id);
  }
});

test('CSV cells neutralise formula injection', () => {
  assert.equal(M.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(M.csvCell('-1500'), '"-1500"');
  assert.equal(M.csvCell('A; B'), '"A; B"');
});

test('logistics estimate', () => {
  const r = E.estimateLogistics({ tonnage: 100, distanceKm: 300, craneHours: 4 });
  assert.equal(r.trucks, 4);
  assert.equal(r.freight, 4 * (6000 + 45 * 300));
  assert.equal(r.crane, 18000);
});
