/*
 * RFQ Normalizer - quote normalisation and offline text reading.
 * Turns whatever came back from an AI, a pasted JSON or a supplier message into
 * one supplier record, and says plainly what is missing or doubtful.
 * Nothing is ever filled in from another supplier.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.RFQParser = factory(root.RFQEngine);
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  const DELIVERY = ['site_stacked', 'site_no_crane', 'factory_exw'];

  /* ---------- schema shared by the AI call and the prompt bridge ---------- */

  function jsonSchema(itemCount) {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['supplierName', 'currency', 'deliveryCode', 'transportCostTRY', 'craneCostTRY', 'wastePercent', 'vatIncluded', 'paymentPlan', 'lines'],
      properties: {
        supplierName: { type: 'string' },
        currency: { type: 'string', enum: ['TRY', 'EUR', 'USD'] },
        deliveryCode: { type: 'string', enum: DELIVERY },
        transportCostTRY: { type: 'number' },
        craneCostTRY: { type: 'number' },
        wastePercent: { type: 'number' },
        vatIncluded: { type: 'boolean' },
        paymentPlan: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['percent', 'days'],
            properties: { percent: { type: 'number' }, days: { type: 'number' } }
          }
        },
        lines: {
          type: 'array',
          description: 'Exactly ' + itemCount + ' entries, in tender item order. price null when the quote does not price that item.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['item', 'price', 'unit'],
            properties: {
              item: { type: 'integer' },
              price: { type: ['number', 'null'] },
              unit: { type: 'string' }
            }
          }
        }
      }
    };
  }

  const RULES = [
    'Read the supplier quote and return one JSON object.',
    'percent values are 0-100 and must add up to 100. "30-60-90 days equal cheques" means three tranches of 33.333 at 30, 60 and 90 days. Cash or advance is day 0.',
    'price is the unit price exactly as written, in the quote currency, for the unit the supplier used (write that unit in "unit": Ton, kg, m, boy, m2, m3, adet...). Do not convert units or currencies. Use null when an item is not priced. Never copy a price from another item.',
    'vatIncluded is true only when the quote says prices include VAT (KDV dahil).',
    'deliveryCode: factory_exw when freight is excluded (fabrika/depo teslim), site_no_crane when delivered to site but unloading is the buyer\'s, site_stacked when everything is included.',
    'transportCostTRY and craneCostTRY: only amounts stated in the quote for freight or unloading the buyer must pay, in TRY; otherwise 0. wastePercent: stated cutting/waste allowance, otherwise 0.'
  ];

  function itemList(items) {
    return items.map((it, i) => (i + 1) + '. ' + it.name + ' (' + it.qty + ' ' + it.unit + ')').join('\n');
  }

  function buildPrompt(items, rawText) {
    const example = {
      supplierName: 'Supplier name',
      currency: 'TRY',
      deliveryCode: 'site_stacked',
      transportCostTRY: 0,
      craneCostTRY: 0,
      wastePercent: 0,
      vatIncluded: false,
      paymentPlan: [{ percent: 100, days: 0 }],
      lines: items.map((_, i) => ({ item: i + 1, price: 0, unit: items[i].unit }))
    };
    return [
      'You convert construction supplier quotes into JSON for a comparison sheet.',
      '',
      RULES.join('\n'),
      '',
      'TENDER ITEMS (lines must follow this order, item = number below):',
      itemList(items),
      '',
      'Answer with the JSON object only, shaped like this:',
      JSON.stringify(example, null, 2),
      '',
      'SUPPLIER QUOTE:',
      rawText && rawText.trim() ? rawText.trim() : '[paste the supplier message, e-mail or proforma text here]'
    ].join('\n');
  }

  function systemPrompt() {
    return 'You convert construction supplier quotes into structured data for a purchasing comparison sheet. ' + RULES.join(' ');
  }

  function userPrompt(items, rawText) {
    return 'TENDER ITEMS:\n' + itemList(items) + '\n\nSUPPLIER QUOTE:\n' + rawText;
  }

  /* ---------- JSON extraction ---------- */

  /** First balanced JSON object in a text, tolerating prose and code fences around it. */
  function extractJson(text) {
    const s = String(text || '');
    const start = s.indexOf('{');
    if (start < 0) throw new Error('NO_JSON');
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return JSON.parse(s.slice(start, i + 1));
      }
    }
    throw new Error('UNBALANCED_JSON');
  }

  /* ---------- numbers ---------- */

  /** Parses 31.200 / 31,200 / 1.234,50 / 1,234.50 / 845.5 / 2.936 */
  function parseNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v === null || v === undefined) return null;
    let s = String(v).trim().replace(/[\s ]/g, '').replace(/(TL|TRY|EUR|USD|₺|€|\$)/gi, '');
    if (!s) return null;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      const dec = lastDot > lastComma ? '.' : ',';
      const thou = dec === '.' ? ',' : '.';
      s = s.split(thou).join('').replace(dec, '.');
    } else if (lastComma >= 0) {
      s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot >= 0) {
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /* ---------- normalisation ---------- */

  function pick(obj, keys) {
    for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    return undefined;
  }

  function normCurrency(v) {
    const t = String(v || '').trim().toUpperCase();
    if (['TRY', 'TL', '₺', 'YTL'].includes(t)) return 'TRY';
    if (['EUR', 'EURO', '€'].includes(t)) return 'EUR';
    if (['USD', 'DOLAR', 'DOLLAR', '$', 'US$'].includes(t)) return 'USD';
    return null;
  }

  function normDelivery(v) {
    const t = String(v || '').toLowerCase();
    if (DELIVERY.includes(t)) return t;
    if (/exw|fabrika|factory|depo|ex-works/.test(t)) return 'factory_exw';
    if (/no_crane|indirme|unload|vinç hariç|crane/.test(t)) return 'site_no_crane';
    if (/stack|istif|site|şantiye|santiye|dahil/.test(t)) return 'site_stacked';
    return null;
  }

  function normBool(v) {
    if (typeof v === 'boolean') return v;
    const t = String(v || '').toLowerCase();
    if (/^(true|evet|yes|dahil|included|1)$/.test(t)) return true;
    if (/^(false|hayır|hayir|no|hariç|haric|excluded|0)$/.test(t)) return false;
    return null;
  }

  /**
   * Payment plan from any reasonable shape. Fractions (0.3 / 0.7) are scaled to
   * percent; sums within 1 point of 100 are rescaled; anything else is an error.
   */
  function normPlan(raw, notes) {
    if (!Array.isArray(raw) || !raw.length) {
      notes.errors.push({ code: 'PLAN_MISSING' });
      return [];
    }
    let plan = raw.map(t => ({
      pct: parseNumber(pick(t, ['percent', 'pct', 'ratio', 'share', 'oran', 'yuzde'])),
      days: parseNumber(pick(t, ['days', 'day', 'gun', 'gün', 'vade', 'term']))
    }));
    if (plan.some(t => t.pct === null || t.days === null || t.pct < 0 || t.days < 0)) {
      notes.errors.push({ code: 'PLAN_BAD_ROW' });
      return plan.map(t => ({ pct: t.pct || 0, days: t.days || 0 }));
    }
    let sum = plan.reduce((a, t) => a + t.pct, 0);
    if (sum > 0.98 && sum < 1.02 && plan.every(t => t.pct <= 1)) {
      plan = plan.map(t => ({ ...t, pct: t.pct * 100 }));
      sum *= 100;
      notes.warnings.push({ code: 'PLAN_FRACTIONS' });
    }
    if (Math.abs(sum - 100) <= 1 && Math.abs(sum - 100) > 1e-6) {
      plan = plan.map(t => ({ ...t, pct: t.pct * 100 / sum }));
      notes.warnings.push({ code: 'PLAN_RESCALED', sum });
    } else if (Math.abs(sum - 100) > 1) {
      notes.errors.push({ code: 'PLAN_SUM', sum });
    }
    return plan;
  }

  function nameKey(s) {
    return String(s || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşüø]+/gi, ' ').trim();
  }

  /** Lines as an array in item order, or an object keyed by id, number or name. */
  function normLines(raw, items, notes) {
    const out = {};
    const get = idx => {
      const item = items[idx];
      if (Array.isArray(raw)) {
        const byItem = raw.find(r => r && typeof r === 'object' && Number(r.item) === idx + 1);
        return byItem !== undefined ? byItem : raw[idx];
      }
      if (raw && typeof raw === 'object') {
        if (raw[item.id] !== undefined) return raw[item.id];
        if (raw[idx + 1] !== undefined) return raw[idx + 1];
        if (raw[String(idx + 1)] !== undefined) return raw[String(idx + 1)];
        const k = Object.keys(raw).find(key => nameKey(key) === nameKey(item.name));
        if (k) return raw[k];
      }
      return undefined;
    };
    if (Array.isArray(raw) && raw.length > items.length) notes.warnings.push({ code: 'LINES_EXTRA', count: raw.length });
    items.forEach((item, idx) => {
      const v = get(idx);
      let price = null, unit = item.unit, factor = null;
      if (v && typeof v === 'object') {
        price = parseNumber(pick(v, ['price', 'unitPrice', 'fiyat', 'birimFiyat']));
        unit = pick(v, ['unit', 'birim']) || item.unit;
        factor = parseNumber(pick(v, ['factor', 'carpan']));
      } else if (v !== undefined) {
        price = parseNumber(v);
      }
      if (!(price > 0)) {
        price = null;
        notes.warnings.push({ code: 'PRICE_MISSING', item: item.id });
      }
      const conv = factor > 0 ? factor : Engine.conversionFactor(item, unit);
      if (price !== null && !(conv > 0)) notes.errors.push({ code: 'UNIT_UNKNOWN', item: item.id, unit });
      out[item.id] = { price, unit, factor: factor > 0 ? factor : null };
    });
    return out;
  }

  /**
   * One supplier record from loose input.  Returns { supplier, warnings, errors }.
   * The record may carry errors; the review sheet must resolve them before saving.
   */
  function normalizeQuote(raw, items, opts = {}) {
    const notes = { warnings: [], errors: [] };
    const obj = raw && typeof raw === 'object' ? raw : {};

    const name = String(pick(obj, ['supplierName', 'name', 'firma', 'supplier', 'tedarikci']) || '').trim();
    if (!name) notes.warnings.push({ code: 'NAME_MISSING' });

    let currency = normCurrency(pick(obj, ['currency', 'paraBirimi', 'doviz']));
    if (!currency) { currency = 'TRY'; notes.warnings.push({ code: 'CURRENCY_ASSUMED' }); }

    let delivery = normDelivery(pick(obj, ['deliveryCode', 'delivery', 'teslim']));
    if (!delivery) { delivery = 'site_stacked'; notes.warnings.push({ code: 'DELIVERY_ASSUMED' }); }

    const num = keys => {
      const v = parseNumber(pick(obj, keys));
      return v !== null && v >= 0 ? v : 0;
    };

    const vatRaw = normBool(pick(obj, ['vatIncluded', 'kdvDahil', 'vat']));
    const vatIncluded = vatRaw === true;
    if (vatRaw === null) notes.warnings.push({ code: 'VAT_ASSUMED' });

    const plan = normPlan(pick(obj, ['paymentPlan', 'plan', 'odemePlani', 'payment']), notes);
    const lines = normLines(pick(obj, ['lines', 'prices', 'fiyatlar', 'items']), items, notes);

    if (delivery === 'factory_exw' && !num(['transportCostTRY', 'transport', 'nakliye'])) notes.warnings.push({ code: 'EXW_NO_FREIGHT' });
    if (delivery === 'site_no_crane' && !num(['craneCostTRY', 'crane', 'vinc'])) notes.warnings.push({ code: 'NO_CRANE_COST' });

    const supplier = {
      id: opts.id || ('sup_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      name: name || opts.fallbackName || 'Supplier',
      currency,
      delivery,
      transportTRY: num(['transportCostTRY', 'transport', 'nakliye']),
      craneTRY: num(['craneCostTRY', 'crane', 'vinc']),
      wastePct: num(['wastePercent', 'waste', 'fire']),
      vatIncluded,
      vatRate: parseNumber(pick(obj, ['vatRate', 'kdvOrani'])) || undefined,
      plan,
      lines,
      source: opts.source || 'manual'
    };
    return { supplier, warnings: notes.warnings, errors: notes.errors };
  }

  /** Re-check a supplier record after hand edits in the review sheet. */
  function validateSupplier(sup, items) {
    const errors = [];
    const warnings = [];
    if (!String(sup.name || '').trim()) errors.push({ code: 'NAME_MISSING' });
    if (!Engine.planIsValid(sup.plan)) errors.push({ code: 'PLAN_SUM', sum: Engine.planSum(sup.plan) });
    for (const item of items) {
      const l = (sup.lines || {})[item.id];
      if (!l || !(Number(l.price) > 0)) { warnings.push({ code: 'PRICE_MISSING', item: item.id }); continue; }
      const conv = Number(l.factor) > 0 ? Number(l.factor) : Engine.conversionFactor(item, l.unit);
      if (!(conv > 0)) errors.push({ code: 'UNIT_UNKNOWN', item: item.id, unit: l.unit });
    }
    if (sup.currency !== 'TRY' && sup.currency !== 'EUR' && sup.currency !== 'USD') errors.push({ code: 'CURRENCY' });
    return { errors, warnings };
  }

  /* ---------- offline reading of free text ---------- */

  const CURRENCY_MARK = '(?:TL|TRY|₺|EUR|€|USD|\\$|euro|dolar)';

  function detectCurrency(text) {
    const t = text.toUpperCase();
    const eur = (t.match(/EUR|€|EURO/g) || []).length;
    const usd = (t.match(/USD|\$|DOLAR|DOLLAR/g) || []).length;
    const tl = (t.match(/\bTL\b|TRY|₺/g) || []).length;
    if (eur > tl && eur >= usd) return 'EUR';
    if (usd > tl && usd > eur) return 'USD';
    return 'TRY';
  }

  function detectPlan(text) {
    const t = text.toLocaleLowerCase('tr');
    let m = t.match(/(\d{2,3})\s*[-–\/]\s*(\d{2,3})\s*[-–\/]\s*(\d{2,3})\s*(?:gün|gun|day)/);
    if (m) {
      const d = [m[1], m[2], m[3]].map(Number);
      return d.map(days => ({ percent: 100 / 3, days }));
    }
    m = t.match(/%\s*(\d{1,2})\s*(?:peşin|pesin|avans|advance|cash)[^%]{0,60}%\s*(\d{1,2})\s*[^\d]{0,20}(\d{2,3})\s*(?:gün|gun|day)/);
    if (!m) m = t.match(/(\d{1,2})\s*%\s*(?:peşin|pesin|avans|advance|cash)[^%]{0,60}(\d{1,2})\s*%\s*[^\d]{0,20}(\d{2,3})\s*(?:gün|gun|day)/);
    if (m) return [{ percent: Number(m[1]), days: 0 }, { percent: Number(m[2]), days: Number(m[3]) }];
    m = t.match(/(\d{2,3})\s*(?:gün|gun|day)s?\s*(?:tek|single|vadeli)?\s*(?:çek|cek|check|cheque|senet|vade)/);
    if (m) return [{ percent: 100, days: Number(m[1]) }];
    if (/peşin|pesin|nakit|havale|cash|advance payment/.test(t)) return [{ percent: 100, days: 0 }];
    return null;
  }

  /** First amount of at least 100 that follows one of the words (whole words, Turkish suffixes allowed). */
  function amountNear(text, words) {
    const re = new RegExp('(?<!\\p{L})(?:' + words + ')\\p{L}*[^\\n\\d]{0,40}?(\\d[\\d.,]*)', 'giu');
    for (const m of text.matchAll(re)) {
      const n = parseNumber(m[1].replace(/[.,]$/, ''));
      if (n && n >= 100) return n;
    }
    return 0;
  }

  function tokens(s) {
    return nameKey(s).split(' ').filter(w => w.length > 1);
  }

  /**
   * Reads a supplier message without any AI.  It is a guess and is labelled as one:
   * prices are taken only from a line that names the item and shows a currency.
   */
  function heuristicRead(text, items) {
    const raw = String(text || '');
    const lower = raw.toLocaleLowerCase('tr');
    const lines = raw.split(/\r?\n|;|(?<=TL|EUR|USD|€|₺)\s*,\s*/).map(l => l.trim()).filter(Boolean);

    const priceRe = new RegExp('(\\d[\\d.,]*)\\s*' + CURRENCY_MARK + '\\b', 'i');
    const priced = lines.map(l => {
      const m = l.match(new RegExp('(\\d[\\d.,]*)\\s*' + CURRENCY_MARK + '(?:\\s*\\/\\s*([\\wçğıöşüµ²³.]+))?', 'i'));
      return { line: l, price: m ? parseNumber(m[1]) : null, unit: m && m[2] ? m[2] : null, used: false };
    });

    // Score every (item, line) pair. Tokens carrying digits (Ø12, C30, DN100) identify
    // the item: when an item has them, a line that matches none of them scores zero.
    const pairs = [];
    items.forEach((item, i) => {
      const want = tokens(item.name);
      const marks = want.filter(w => /\d/.test(w));
      priced.forEach((p, j) => {
        if (!p.price) return;
        const have = tokens(p.line.split(priceRe)[0] || p.line);
        if (marks.length && !marks.some(w => have.includes(w))) return;
        const score = want.filter(w => have.includes(w)).length / Math.max(1, want.length);
        if (score >= 0.5) pairs.push({ i, j, score });
      });
    });
    pairs.sort((a, b) => b.score - a.score);
    const takenItem = new Set();
    const out = items.map((item, i) => ({ item: i + 1, price: null, unit: item.unit }));
    for (const { i, j } of pairs) {
      if (takenItem.has(i) || priced[j].used) continue;
      takenItem.add(i);
      priced[j].used = true;
      out[i] = { item: i + 1, price: priced[j].price, unit: priced[j].unit || items[i].unit };
    }

    // Company name: a legal suffix wins; trade words only on text that is not an item name.
    const first = lines[0] || '';
    let name = '';
    const word = '[A-ZÇĞİÖŞÜ][\\wçğıöşüÇĞİÖŞÜ&.\\-]*';
    const legal = raw.match(new RegExp('(' + word + '(?: ' + word + '){0,4} (?:A\\.Ş\\.|AŞ|Ltd\\.?(?: Şti\\.?)?|Inc\\.?|GmbH|Co\\.))'));
    if (legal) name = legal[1].trim();
    else {
      const itemWords = new Set(items.flatMap(i => tokens(i.name)));
      const trade = raw.match(new RegExp('(' + word + '(?: ' + word + '){0,3} (?:Grup|Group|Ticaret|Trading|Pazarlama|Yapı|Metal|Beton|Çelik|Dış Ticaret))', 'g')) || [];
      const pickName = trade.find(m => tokens(m).filter(w => !itemWords.has(w)).length >= 1 && !/^\d/.test(m));
      if (pickName) name = pickName.trim();
      else if (first.includes(':') && first.split(':')[0].length < 50) name = first.split(':')[0].replace(/^(selam|merhaba|hi|hello)[^,]*,?/i, '').trim();
    }

    let delivery = 'site_stacked';
    if (/fabrika|ex-?works|exw|depo teslim|factory/.test(lower)) delivery = 'factory_exw';
    else if (/(indirme|vinç|vinc|unloading|crane)[^.\n]{0,40}(hariç|haric|alıcı|alici|size ait|buyer)/.test(lower) || /(alıcı|alici|buyer)[^.\n]{0,30}(indirme|vinç|vinc|unloading|crane)/.test(lower)) delivery = 'site_no_crane';

    const waste = (() => {
      const m = lower.match(/%\s*([\d.,]+)\s*(?:kesim|fire|waste)|([\d.,]+)\s*%\s*(?:kesim|fire|waste)/);
      return m ? parseNumber(m[1] || m[2]) || 0 : 0;
    })();

    return {
      supplierName: name,
      currency: detectCurrency(raw),
      deliveryCode: delivery,
      transportCostTRY: amountNear(raw, 'nakliye|navlun|freight|tır|tir'),
      craneCostTRY: amountNear(raw, 'vinç|vinc|indirme|crane|unloading'),
      wastePercent: waste,
      vatIncluded: /kdv\s*dahil|vat\s*incl|including\s*vat/i.test(raw) ? true : (/kdv\s*hari|excl/i.test(raw) ? false : null),
      paymentPlan: detectPlan(raw) || [],
      lines: out
    };
  }

  return {
    DELIVERY,
    jsonSchema,
    buildPrompt,
    systemPrompt,
    userPrompt,
    extractJson,
    parseNumber,
    normalizeQuote,
    validateSupplier,
    heuristicRead
  };
});
