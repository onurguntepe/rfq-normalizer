// Guards for the decisions in KARARLAR.md. A failure here means a recorded decision was broken.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../js/i18n.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sources = ['index.html', 'css/app.css', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)];

test('K-01: no build step, classic scripts only', () => {
  const html = read('index.html');
  assert.ok(!/type=["']module["']/.test(html), 'index.html must not use ES modules');
  assert.ok(!fs.existsSync(path.join(root, 'package-lock.json')), 'no dependency install');
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, m[1])), m[1] + ' missing');
});

test('K-02: no API key in the source', () => {
  for (const f of sources) {
    const s = read(f);
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}/.test(s), f + ' contains something that looks like a key');
    assert.ok(!/\?key=\$\{/.test(s), f + ' puts a key in a URL');
  }
});

test('K-03: every Turkish string has an English twin', () => {
  const tr = Object.keys(I.tr).sort();
  const en = Object.keys(I.en).sort();
  assert.deepEqual(tr.filter(k => !I.en[k]), [], 'missing in EN');
  assert.deepEqual(en.filter(k => !I.tr[k]), [], 'missing in TR');
});

test('K-03: every key the UI asks for exists', () => {
  const used = new Set();
  const app = read('js/app.js') + read('index.html');
  for (const m of app.matchAll(/\bt\('([A-Za-z_]+)'\s*[,)]/g)) used.add(m[1]);
  for (const [prefix, list] of [['del_', ['site_stacked', 'site_no_crane', 'factory_exw']], ['ledgerLead_', ['paper', 'landed', 'pv']], ['src_', ['ai', 'bridge', 'heuristic', 'manual', 'excel', 'demo', 'import']]]) list.forEach(k => used.add(prefix + k));
  for (const m of read('js/parser.js').matchAll(/code: '([A-Z_]+)'/g)) used.add('note_' + m[1]);
  for (const m of app.matchAll(/data-i18n="([A-Za-z_]+)"/g)) used.add(m[1]);
  const missing = [...used].filter(k => I.tr[k] === undefined);
  assert.deepEqual(missing, []);
});

test('K-05: no emoji or pictographs in the interface', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2B00}-\u{2BFF}]/u;
  for (const f of sources) assert.ok(!emoji.test(read(f)), f + ' contains an emoji or pictograph');
});

test('K-06: left-aligned frame with a package dock', () => {
  const css = read('css/app.css');
  const duzen = css.match(/\.duzen \{[^}]*\}/)[0];
  assert.ok(!/margin:\s*0 auto/.test(duzen) && !/max-width/.test(duzen), '.duzen must not be centred or capped');
  assert.ok(/id="paketDok"/.test(read('index.html')), 'package dock missing');
});

test('K-07: logo MKG, product name Mukayese', () => {
  assert.ok(/class="marka-muhur"[^>]*>MKG</.test(read('index.html')));
  assert.equal(I.tr.brand, 'Mukayese');
  for (const f of [...sources, 'README.md']) assert.ok(!read(f).includes('Mukayese Çeki'), f);
});

test('K-08: no cheque words in interface text', () => {
  const banned = /çek defteri|koçan|ödeyiniz|mürekkep|çekin arkası|cheque book|\bstub\b|pay to|\bleaf\b|yaprak/i;
  for (const lang of ['tr', 'en']) for (const [k, v] of Object.entries(I[lang])) assert.ok(!banned.test(v), `${lang}.${k}: ${v}`);
});

test('K-09: number fields have no browser spinners', () => {
  assert.ok(/::-webkit-inner-spin-button[^{]*\{[^}]*appearance:\s*none/.test(read('css/app.css')));
});

test('K-10: the three intake modes sit on the page, not in a drawer', () => {
  const html = read('index.html');
  const section = html.slice(html.indexOf('id="giris"'), html.indexOf('id="defter"'));
  assert.ok(section.length > 0, '#giris section missing or after #defter');
  assert.deepEqual([...section.matchAll(/data-sekme="(\w+)"/g)].map(m => m[1]), ['ai', 'kopru', 'elle']);
  assert.ok(!/id="masa"/.test(html), 'intake must not be a drawer');
  assert.ok(html.indexOf('id="giris"') < html.indexOf('id="defter"') && html.indexOf('id="karar"') < html.indexOf('id="giris"'), 'order: verdict, intake, book');
});

test('demo data carries no real company names', () => {
  const s = read('js/scenarios.js');
  for (const name of ['Kardemir', 'Payas', 'Akçansa', 'Çimsa', 'İçdaş', 'Habaş', 'Kroman', 'Erdemir', 'Tosyalı']) assert.ok(!s.includes(name), name);
});
