/*
 * RFQ Normalizer - deterministic cost engine.
 * No DOM, no network. Every number on screen comes from here.
 * Works as a browser global (window.RFQEngine) and as a CommonJS module for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RFQEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STEEL_DENSITY = 7850; // kg/m3
  const DEFAULT_BAR_LENGTH_M = 12;

  /* ---------- units ---------- */

  const UNIT_ALIASES = {
    ton: ['ton', 'tons', 't', 'tn'],
    kg: ['kg', 'kilo', 'kilogram'],
    m: ['m', 'mt', 'metre', 'meter', 'metretül', 'metretul', 'mtül', 'mtul', 'lm', 'linear m'],
    boy: ['boy', 'bar', 'bars', 'çubuk', 'cubuk'],
    m2: ['m2', 'm²', 'metrekare', 'sqm'],
    m3: ['m3', 'm³', 'metreküp', 'cbm'],
    adet: ['adet', 'ad', 'pcs', 'pc', 'piece', 'pieces', 'unit', 'units'],
    set: ['set', 'takım', 'takim', 'lot', 'götürü', 'goturu', 'ls', 'lump sum'],
    lt: ['lt', 'l', 'litre', 'liter'],
    torba: ['torba', 'bag', 'bags', 'kova', 'bucket']
  };

  function unitKey(text) {
    const t = String(text || '').trim().toLowerCase().replace(/\.$/, '');
    if (!t) return null;
    for (const key of Object.keys(UNIT_ALIASES)) {
      if (UNIT_ALIASES[key].includes(t)) return key;
    }
    return t;
  }

  /** Theoretical mass of a round steel bar in kg per metre. */
  function rebarKgPerM(diameterMm) {
    const d = Number(diameterMm) / 1000;
    return Math.PI / 4 * d * d * STEEL_DENSITY;
  }

  /** Mass in kg of one quoted unit, when the unit is mass or length based. */
  function unitMassKg(key, kgPerM, barLength) {
    if (key === 'ton') return 1000;
    if (key === 'kg') return 1;
    if (!(kgPerM > 0)) return null;
    if (key === 'm') return kgPerM;
    if (key === 'boy') return kgPerM * (barLength || DEFAULT_BAR_LENGTH_M);
    return null;
  }

  /**
   * How many base units of the item one quoted unit equals.
   * Returns null when the conversion cannot be derived and must be entered by hand.
   */
  function conversionFactor(item, quotedUnit) {
    const base = unitKey(item.unit);
    const quoted = unitKey(quotedUnit || item.unit);
    if (!quoted || quoted === base) return 1;
    const qKg = unitMassKg(quoted, item.kgPerM, item.barLength);
    const bKg = unitMassKg(base, item.kgPerM, item.barLength);
    if (qKg && bKg) return qKg / bKg;
    return null;
  }

  /* ---------- payment plans ---------- */

  const PLAN_PRESETS = {
    cash: [{ pct: 100, days: 0 }],
    '30_60_90': [{ pct: 100 / 3, days: 30 }, { pct: 100 / 3, days: 60 }, { pct: 100 / 3, days: 90 }],
    adv30_60: [{ pct: 30, days: 0 }, { pct: 70, days: 60 }],
    adv20_45_90: [{ pct: 20, days: 0 }, { pct: 40, days: 45 }, { pct: 40, days: 90 }],
    single_45: [{ pct: 100, days: 45 }],
    single_60: [{ pct: 100, days: 60 }],
    single_90: [{ pct: 100, days: 90 }],
    single_120: [{ pct: 100, days: 120 }]
  };

  function planFromPreset(key) {
    return (PLAN_PRESETS[key] || PLAN_PRESETS.cash).map(t => ({ ...t }));
  }

  function planSum(plan) {
    return (plan || []).reduce((a, t) => a + (Number(t.pct) || 0), 0);
  }

  function planIsValid(plan) {
    if (!Array.isArray(plan) || !plan.length) return false;
    if (plan.some(t => !(Number(t.pct) > 0) || !(Number(t.days) >= 0))) return false;
    return Math.abs(planSum(plan) - 100) < 0.01;
  }

  function weightedDays(plan) {
    return (plan || []).reduce((a, t) => a + (Number(t.pct) || 0) / 100 * (Number(t.days) || 0), 0);
  }

  /**
   * Present-value factor of one unit of currency paid on the plan, in TRY of today.
   * Each tranche is converted at the expected rate on its due day, then discounted
   * at the TRY funding rate.  r and g are monthly fractions, a month is 30 days.
   */
  function pvFactor(plan, r, g) {
    let f = 0;
    for (const t of plan || []) {
      const w = (Number(t.pct) || 0) / 100;
      const months = (Number(t.days) || 0) / 30;
      f += w * Math.pow(1 + (g || 0), months) / Math.pow(1 + (r || 0), months);
    }
    return f;
  }

  /* ---------- macro ---------- */

  function spotRate(macro, currency) {
    if (currency === 'EUR') return Number(macro.spotEUR) || 0;
    if (currency === 'USD') return Number(macro.spotUSD) || 0;
    return 1;
  }

  function fxGrowth(macro, currency) {
    if (currency === 'EUR') return (Number(macro.growthEUR) || 0) / 100;
    if (currency === 'USD') return (Number(macro.growthUSD) || 0) / 100;
    return 0;
  }

  /* ---------- per supplier ---------- */

  /**
   * Evaluate one supplier against the item list.
   * paper    : what the quote says, converted at spot, VAT as written
   * net      : VAT removed, quoted units converted to the item's base unit
   * landed   : net + waste + freight + crane
   * pv       : material paid on the plan, discounted, plus logistics paid today
   */
  function evaluateSupplier(sup, items, macro, rOverride) {
    const r = (rOverride !== undefined ? rOverride : (Number(macro.monthlyRate) || 0)) / 100;
    const g = fxGrowth(macro, sup.currency);
    const spot = spotRate(macro, sup.currency);
    const vatRate = sup.vatIncluded ? (Number(sup.vatRate ?? macro.vatRate) || 0) / 100 : 0;
    const wasteRate = (Number(sup.wastePct) || 0) / 100;
    const logistics = (Number(sup.transportTRY) || 0) + (Number(sup.craneTRY) || 0);
    const factor = pvFactor(sup.plan, r, g);

    const lines = {};
    const missing = [];
    const unconvertible = [];
    let paper = 0;
    let net = 0;

    for (const item of items) {
      const line = (sup.lines || {})[item.id] || {};
      const price = Number(line.price);
      if (line.price === null || line.price === undefined || line.price === '' || !(price > 0)) {
        missing.push(item.id);
        lines[item.id] = { missing: true };
        continue;
      }
      const conv = Number(line.factor) > 0 ? Number(line.factor) : conversionFactor(item, line.unit);
      if (!(conv > 0)) {
        unconvertible.push(item.id);
        lines[item.id] = { missing: true, unconvertible: true };
        continue;
      }
      const qty = Number(item.qty) || 0;
      const paperUnitTRY = price * spot / conv;
      const netUnitTRY = paperUnitTRY / (1 + vatRate);
      const linePaper = paperUnitTRY * qty;
      const lineNet = netUnitTRY * qty;
      const lineMaterial = lineNet * (1 + wasteRate);
      lines[item.id] = {
        missing: false,
        quotedPrice: price,
        quotedUnit: line.unit || item.unit,
        factor: conv,
        netUnitOrig: price / conv / (1 + vatRate),
        paper: linePaper,
        net: lineNet,
        material: lineMaterial,
        pvMaterial: lineMaterial * factor
      };
      paper += linePaper;
      net += lineNet;
    }

    const waste = net * wasteRate;
    const landed = net + waste + logistics;
    const pvMaterial = (net + waste) * factor;
    const pv = pvMaterial + logistics;

    // Item level figures carry a share of the fixed logistics for display only.
    const base = net > 0 ? net : 1;
    for (const item of items) {
      const l = lines[item.id];
      if (l.missing) continue;
      const share = net > 0 ? l.net / base : 0;
      l.logisticsShare = logistics * share;
      l.landed = l.material + l.logisticsShare;
      l.pv = l.pvMaterial + l.logisticsShare;
      const qty = Number(item.qty) || 0;
      l.unitPaper = qty ? l.paper / qty : 0;
      l.unitLanded = qty ? l.landed / qty : 0;
      l.unitPv = qty ? l.pv / qty : 0;
    }

    const tranches = (sup.plan || []).map(t => {
      const w = (Number(t.pct) || 0) / 100;
      const months = (Number(t.days) || 0) / 30;
      const amountToday = (net + waste) * w;
      const amountOnDue = amountToday * Math.pow(1 + g, months);
      return {
        pct: Number(t.pct) || 0,
        days: Number(t.days) || 0,
        amountOnDue,
        pv: amountOnDue / Math.pow(1 + r, months),
        currencyAmount: spot ? amountOnDue / Math.pow(1 + g, months) / spot : 0
      };
    });

    return {
      id: sup.id,
      name: sup.name,
      currency: sup.currency,
      complete: missing.length === 0 && unconvertible.length === 0,
      missing,
      unconvertible,
      spot,
      factor,
      avgDays: weightedDays(sup.plan),
      paper,
      vat: paper - net,
      net,
      waste,
      logistics,
      landed,
      pvMaterial,
      pv,
      timeEffect: pv - landed,
      lines,
      tranches
    };
  }

  /* ---------- split order ---------- */

  /**
   * Cheapest way to buy every item, allowing any combination of suppliers.
   * Each supplier that receives at least one item is charged its full freight
   * and crane cost: a truck for one line item still costs a truck.
   * Exact search over supplier subsets (n <= 14), greedy above that.
   */
  function optimiseSplit(evals, items) {
    const n = evals.length;
    if (!n || !items.length) return null;
    const ids = items.map(i => i.id);

    function costOf(subsetIdx) {
      const assign = {};
      let material = 0;
      const used = new Set();
      for (const id of ids) {
        let best = null;
        for (const k of subsetIdx) {
          const l = evals[k].lines[id];
          if (l && !l.missing && (best === null || l.pvMaterial < evals[best].lines[id].pvMaterial)) best = k;
        }
        if (best === null) return null;
        assign[id] = evals[best].id;
        material += evals[best].lines[id].pvMaterial;
        used.add(best);
      }
      let logistics = 0;
      used.forEach(k => { logistics += evals[k].logistics; });
      return { assign, material, logistics, total: material + logistics, suppliers: [...used].map(k => evals[k].id) };
    }

    let best = null;
    if (n <= 14) {
      for (let mask = 1; mask < (1 << n); mask++) {
        const idx = [];
        for (let k = 0; k < n; k++) if (mask & (1 << k)) idx.push(k);
        const c = costOf(idx);
        if (c && (!best || c.total < best.total - 1e-6 || (Math.abs(c.total - best.total) < 1e-6 && c.suppliers.length < best.suppliers.length))) best = c;
      }
    } else {
      best = costOf(evals.map((_, k) => k));
    }
    return best;
  }

  /* ---------- sensitivity ---------- */

  function pvAtRate(sup, items, macro, ratePct) {
    return evaluateSupplier(sup, items, macro, ratePct).pv;
  }

  /** Monthly rate (percent) in [lo, hi] where a and b cost the same today, or null. */
  function breakEvenRate(supA, supB, items, macro, lo = 0, hi = 20) {
    const f = x => pvAtRate(supA, items, macro, x) - pvAtRate(supB, items, macro, x);
    let fa = f(lo);
    const fb = f(hi);
    if (fa === 0) return lo;
    if (fa * fb > 0) return null;
    let a = lo, b = hi;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      const fm = f(m);
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  }

  function sensitivity(suppliers, items, macro, from = 0, to = 8, step = 0.1) {
    const xs = [];
    for (let x = from; x <= to + 1e-9; x += step) xs.push(Math.round(x * 1000) / 1000);
    return suppliers.map(s => ({ id: s.id, points: xs.map(x => [x, pvAtRate(s, items, macro, x)]) }));
  }

  /* ---------- negotiation numbers ---------- */

  /**
   * What a challenger has to give to match the target present cost:
   * a price cut on material, or extra days on every tranche.
   */
  function challengerAsk(evalC, targetPv, macro) {
    const gap = evalC.pv - targetPv;
    if (gap <= 0) return { gap, discountPct: 0, extraDays: 0 };
    const discountPct = evalC.pvMaterial > 0 ? gap / evalC.pvMaterial * 100 : null;
    const r = (Number(macro.monthlyRate) || 0) / 100;
    const g = fxGrowth(macro, evalC.currency);
    const targetMaterial = targetPv - evalC.logistics;
    let extraDays = null;
    if (targetMaterial > 0 && r > g) {
      extraDays = 30 * Math.log(evalC.pvMaterial / targetMaterial) / Math.log((1 + r) / (1 + g));
    }
    return { gap, discountPct, extraDays };
  }

  /* ---------- whole sheet ---------- */

  function evaluate(state) {
    const items = state.items || [];
    const macro = state.macro || {};
    const evals = (state.suppliers || []).map(s => evaluateSupplier(s, items, macro));
    const complete = evals.filter(e => e.complete);
    const rank = arr => [...arr].sort((a, b) => a.pv - b.pv);
    const byPv = rank(complete);
    const byPaper = [...complete].sort((a, b) => a.paper - b.paper);
    const byLanded = [...complete].sort((a, b) => a.landed - b.landed);

    const itemBest = {};
    for (const item of items) {
      const priced = evals.filter(e => !e.lines[item.id].missing);
      const pick = key => priced.reduce((best, e) => (!best || e.lines[item.id][key] < best.lines[item.id][key] ? e : best), null);
      itemBest[item.id] = {
        paper: pick('paper')?.id || null,
        landed: pick('landed')?.id || null,
        pv: pick('pv')?.id || null,
        pvMaterial: pick('pvMaterial')?.id || null,
        offers: priced.length
      };
    }

    const split = optimiseSplit(evals, items);
    const leader = byPv[0] || null;
    const paperLeader = byPaper[0] || null;

    return {
      evals,
      byPv,
      byPaper,
      byLanded,
      leader,
      paperLeader,
      illusion: leader && paperLeader && leader.id !== paperLeader.id ? paperLeader.pv - leader.pv : 0,
      itemBest,
      split,
      splitSaving: leader && split ? leader.pv - split.total : 0
    };
  }

  /* ---------- logistics helper ---------- */

  /** Rough site logistics estimate; every rate is a user-editable assumption. */
  function estimateLogistics({ tonnage, distanceKm, truckCapacityT = 25, truckBaseTRY = 6000, truckPerKmTRY = 45, craneHours = 0, craneHourTRY = 4500 }) {
    const trucks = tonnage > 0 ? Math.ceil(tonnage / truckCapacityT) : 0;
    const freight = trucks * (truckBaseTRY + truckPerKmTRY * (Number(distanceKm) || 0));
    const crane = (Number(craneHours) || 0) * craneHourTRY;
    return { trucks, freight: Math.round(freight), crane: Math.round(crane) };
  }

  return {
    UNIT_ALIASES,
    PLAN_PRESETS,
    unitKey,
    rebarKgPerM,
    conversionFactor,
    planFromPreset,
    planSum,
    planIsValid,
    weightedDays,
    pvFactor,
    spotRate,
    fxGrowth,
    evaluateSupplier,
    optimiseSplit,
    breakEvenRate,
    sensitivity,
    challengerAsk,
    evaluate,
    estimateLogistics
  };
});
