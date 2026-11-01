const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/parser.js');
const M = require('../js/model.js');
const SCEN = require('../js/scenarios.js');

const items = M.scenarioState(SCEN.find(s => s.id === 'pkt01_rebar'), 'tr').items;
const concrete = M.scenarioState(SCEN.find(s => s.id === 'pkt02_concrete'), 'tr').items;
const codes = list => list.map(x => x.code);

test('Turkish and English number formats', () => {
  assert.equal(P.parseNumber('31.200'), 31200);
  assert.equal(P.parseNumber('1.234,50'), 1234.5);
  assert.equal(P.parseNumber('1,234.50'), 1234.5);
  assert.equal(P.parseNumber('845.5'), 845.5);
  assert.equal(P.parseNumber('31,5'), 31.5);
  assert.equal(P.parseNumber('2.936 TL'), 2936);
  assert.equal(P.parseNumber(''), null);
});

test('payment fractions are scaled, not taken at face value', () => {
  const r = P.normalizeQuote({ supplierName: 'X', currency: 'TRY', paymentPlan: [{ ratio: 0.3, days: 0 }, { ratio: 0.7, days: 60 }], lines: [1, 2, 3, 4] }, items);
  assert.deepEqual(r.supplier.plan.map(t => Math.round(t.pct)), [30, 70]);
  assert.ok(codes(r.warnings).includes('PLAN_FRACTIONS'));
  assert.equal(r.errors.length, 0);
});

test('a plan that does not add up to 100 is an error', () => {
  const r = P.normalizeQuote({ supplierName: 'X', paymentPlan: [{ percent: 50, days: 0 }], lines: [1, 2, 3, 4] }, items);
  assert.ok(codes(r.errors).includes('PLAN_SUM'));
});

test('33.33 x 3 is rescaled to exactly 100', () => {
  const r = P.normalizeQuote({ supplierName: 'X', paymentPlan: [{ percent: 33.33, days: 30 }, { percent: 33.33, days: 60 }, { percent: 33.33, days: 90 }], lines: [1, 2, 3, 4] }, items);
  assert.equal(r.errors.length, 0);
  assert.ok(Math.abs(r.supplier.plan.reduce((a, t) => a + t.pct, 0) - 100) < 1e-9);
});

test('missing prices stay missing', () => {
  const r = P.normalizeQuote({ supplierName: 'X', paymentPlan: [{ percent: 100, days: 0 }], lines: [31000] }, items);
  assert.equal(r.supplier.lines.reb_1.price, 31000);
  assert.equal(r.supplier.lines.reb_2.price, null);
  assert.equal(r.supplier.lines.reb_4.price, null);
  assert.equal(codes(r.warnings).filter(c => c === 'PRICE_MISSING').length, 3);
});

test('unknown unit conversion is an error, known one is not', () => {
  const ok = P.normalizeQuote({ supplierName: 'X', paymentPlan: [{ percent: 100, days: 0 }], lines: [{ item: 1, price: 1, unit: 'Ton' }, { item: 2, price: 400, unit: 'boy' }, { item: 3, price: 700, unit: 'boy' }, { item: 4, price: 1, unit: 'Ton' }] }, items);
  assert.equal(ok.errors.length, 0);
  const bad = P.normalizeQuote({ supplierName: 'X', paymentPlan: [{ percent: 100, days: 0 }], lines: [{ item: 1, price: 400, unit: 'boy' }, 1, 1, 1] }, items);
  assert.ok(codes(bad.errors).includes('UNIT_UNKNOWN'), 'Ø8-Ø10 has no single mass per metre');
});

test('JSON is found inside chatty answers and fences', () => {
  const txt = 'Here is the JSON:\n```json\n{"supplierName":"A","note":"x } y","lines":[1]}\n```\nHope it helps.';
  assert.equal(P.extractJson(txt).supplierName, 'A');
  assert.throws(() => P.extractJson('no json here'));
});

test('offline reader takes prices from the item line, not from the title', () => {
  const text = 'Selam Şefim, 2.500 m³ C30/37 Hazır Beton ve Pompa için Özdemir Grup revize fiyatlarımız aşağıdadır:\n' +
    '- C30/37 Hazır Beton (S4 Kıvam, Pompalı): 2.936 TL / m³\n' +
    '- C20/25 Temel Altı Grobeton (Mikserli): 2.468 TL / m³\n' +
    '- 47m - 52m Uzun Bomlu Mobil Pompa Hizmeti: 182 TL / m³\n' +
    '- Sentetik Lif ve Süperakışkanlaştırıcı Katkı: 90 TL / m³\n' +
    'Fiyatlarımız KDV hariç fabrika teslimdir (Şantiyenize tır nakliyesi toplam 78.000 TL, mobil vinç indirme 18.000 TL tutar). Ödeme: 30 - 60 - 90 gün eşit sıralı çek.';
  const raw = P.heuristicRead(text, concrete);
  assert.deepEqual(raw.lines.map(l => l.price), [2936, 2468, 182, 90]);
  assert.equal(raw.deliveryCode, 'factory_exw');
  assert.equal(raw.transportCostTRY, 78000);
  assert.equal(raw.craneCostTRY, 18000);
  assert.deepEqual(raw.paymentPlan.map(t => t.days), [30, 60, 90]);
  assert.equal(raw.vatIncluded, false);
  const n = P.normalizeQuote(raw, concrete);
  assert.equal(n.errors.length, 0);
});

test('offline reader: EUR advance plan and VAT included', () => {
  const text = 'Kuzey Dış Ticaret Ltd. Şti. teklifi\n* Ø12 Nervürlü İnşaat Demiri: 812,50 EUR / Ton\n' +
    'Fiyatlar KDV dahildir. Ödeme: %30 peşin avans, kalan %70 60 gün vadeli.';
  const raw = P.heuristicRead(text, items);
  assert.equal(raw.currency, 'EUR');
  assert.equal(raw.vatIncluded, true);
  assert.deepEqual(raw.paymentPlan, [{ percent: 30, days: 0 }, { percent: 70, days: 60 }]);
  assert.equal(raw.lines[1].price, 812.5);
  assert.equal(raw.lines[0].price, null);
  assert.match(raw.supplierName, /Kuzey Dış Ticaret/);
});

test('offline reader prefers the legal company name over item words', () => {
  const text = 'Selam şefim, 100 Ton Nervürlü İnşaat Demiri (S420) için Örnek Metal Ticaret Ltd. Şti. revize fiyatlarımız:\n- Ø12 Nervürlü İnşaat Demiri (S420): 31.200 TL / Ton';
  assert.equal(P.heuristicRead(text, items).supplierName, 'Örnek Metal Ticaret Ltd. Şti.');
});

test('prompt and schema list every item in order', () => {
  const p = P.buildPrompt(items, 'abc');
  items.forEach((it, i) => assert.ok(p.includes((i + 1) + '. ' + it.name)));
  const s = P.jsonSchema(items.length);
  assert.equal(s.additionalProperties, false);
  assert.ok(s.required.includes('lines'));
});
