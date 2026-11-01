/*
 * RFQ Normalizer - project model helpers (pure, no DOM).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.RFQModel = factory(root.RFQEngine);
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  const DEFAULT_MACRO = { monthlyRate: 4, spotEUR: 38, growthEUR: 2, spotUSD: 35, growthUSD: 1.75, vatRate: 20 };
  const SCHEMA_VERSION = 1;

  function itemFromPreset(it, lang) {
    const item = { id: it.id, name: it.name[lang] || it.name.tr, qty: it.qty, unit: it.unit[lang] || it.unit.tr };
    if (it.diameter) {
      item.diameter = it.diameter;
      item.kgPerM = Engine.rebarKgPerM(it.diameter);
    }
    return item;
  }

  function supplierFromPreset(sup, items, lang) {
    const lines = {};
    for (const item of items) {
      const p = sup.prices[item.id];
      const u = sup.units && sup.units[item.id];
      lines[item.id] = {
        price: p === null || p === undefined ? null : p,
        unit: u ? (u[lang] || u.tr) : item.unit,
        factor: null
      };
    }
    return {
      id: sup.id,
      name: sup.name[lang] || sup.name.tr,
      currency: sup.currency,
      delivery: sup.delivery,
      transportTRY: sup.transportTRY,
      craneTRY: sup.craneTRY,
      wastePct: sup.wastePct,
      vatIncluded: !!sup.vatIncluded,
      plan: Engine.planFromPreset(sup.preset),
      lines,
      source: 'demo'
    };
  }

  function scenarioState(preset, lang, macro) {
    const items = preset.items.map(it => itemFromPreset(it, lang));
    return {
      schema: SCHEMA_VERSION,
      scenarioId: preset.id,
      code: preset.code,
      title: preset.title[lang] || preset.title.tr,
      demo: true,
      macro: { ...DEFAULT_MACRO, ...(macro || {}) },
      items,
      suppliers: preset.suppliers.map(s => supplierFromPreset(s, items, lang))
    };
  }

  /** Re-label a demo project after a language switch, keeping every user edit. */
  function relabel(state, preset, lang) {
    if (!preset) return state;
    const next = JSON.parse(JSON.stringify(state));
    if (next.titleEdited !== true) next.title = preset.title[lang] || preset.title.tr;
    for (const item of next.items) {
      const p = preset.items.find(x => x.id === item.id);
      if (p && !item.edited) { item.name = p.name[lang]; item.unit = p.unit[lang]; }
    }
    for (const sup of next.suppliers) {
      const p = preset.suppliers.find(x => x.id === sup.id);
      if (p && sup.source === 'demo' && !sup.edited) {
        sup.name = p.name[lang];
        for (const item of next.items) {
          const u = p.units && p.units[item.id];
          if (sup.lines[item.id]) sup.lines[item.id].unit = u ? u[lang] : item.unit;
        }
      }
    }
    return next;
  }

  function emptyProject(lang) {
    return {
      schema: SCHEMA_VERSION,
      scenarioId: null,
      code: 'RFQ',
      title: lang === 'en' ? 'New purchase package' : 'Yeni satınalma paketi',
      demo: false,
      macro: { ...DEFAULT_MACRO },
      items: [{ id: 'item_1', name: lang === 'en' ? 'Line item 1' : 'Kalem 1', qty: 1, unit: lang === 'en' ? 'Tons' : 'Ton' }],
      suppliers: []
    };
  }

  /** Validate and repair an imported project file. Throws on unusable input. */
  function importProject(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items) || !Array.isArray(obj.suppliers)) throw new Error('PROJECT_SHAPE');
    const items = obj.items.filter(i => i && i.id).map(i => ({
      id: String(i.id), name: String(i.name || ''), qty: Number(i.qty) || 0, unit: String(i.unit || ''),
      ...(Number(i.kgPerM) > 0 ? { kgPerM: Number(i.kgPerM) } : {}),
      ...(Number(i.diameter) > 0 ? { diameter: Number(i.diameter) } : {})
    }));
    const suppliers = obj.suppliers.filter(s => s && s.id).map(s => ({
      id: String(s.id), name: String(s.name || ''), currency: ['TRY', 'EUR', 'USD'].includes(s.currency) ? s.currency : 'TRY',
      delivery: s.delivery || 'site_stacked', transportTRY: Number(s.transportTRY) || 0, craneTRY: Number(s.craneTRY) || 0,
      wastePct: Number(s.wastePct) || 0, vatIncluded: !!s.vatIncluded, ...(s.vatRate ? { vatRate: Number(s.vatRate) } : {}),
      plan: Array.isArray(s.plan) ? s.plan.map(t => ({ pct: Number(t.pct) || 0, days: Number(t.days) || 0 })) : [],
      lines: Object.fromEntries(items.map(i => {
        const l = (s.lines || {})[i.id] || {};
        return [i.id, { price: Number(l.price) > 0 ? Number(l.price) : null, unit: l.unit || i.unit, factor: Number(l.factor) > 0 ? Number(l.factor) : null }];
      })),
      source: s.source || 'import'
    }));
    return {
      schema: SCHEMA_VERSION,
      scenarioId: obj.scenarioId || null,
      code: String(obj.code || 'RFQ'),
      title: String(obj.title || ''),
      demo: !!obj.demo,
      macro: { ...DEFAULT_MACRO, ...(obj.macro || {}) },
      items,
      suppliers
    };
  }

  /* ---------- exports ---------- */

  /** Cell text safe for spreadsheets: quoted, and formula triggers neutralised. */
  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function round(n) { return Math.round(Number(n) || 0); }

  /** Comparison sheet as rows (array of arrays) for CSV or XLSX. */
  function sheetRows(state, result, labels) {
    const L = labels;
    const evals = result.evals;
    const rows = [];
    rows.push([L.package, state.title]);
    rows.push([L.rate, state.macro.monthlyRate + '%', 'EUR', state.macro.spotEUR, L.growth, state.macro.growthEUR + '%', 'USD', state.macro.spotUSD, L.growth, state.macro.growthUSD + '%']);
    rows.push([]);
    rows.push([L.item, L.qty, L.unit, ...evals.map(e => e.name + ' (' + e.currency + ')')]);
    for (const item of state.items) {
      rows.push([item.name, item.qty, item.unit, ...evals.map(e => e.lines[item.id].missing ? L.noOffer : round(e.lines[item.id].pv))]);
    }
    rows.push([L.paper, '', '', ...evals.map(e => round(e.paper))]);
    rows.push([L.vat, '', '', ...evals.map(e => round(-e.vat))]);
    rows.push([L.waste, '', '', ...evals.map(e => round(e.waste))]);
    rows.push([L.logistics, '', '', ...evals.map(e => round(e.logistics))]);
    rows.push([L.landed, '', '', ...evals.map(e => round(e.landed))]);
    rows.push([L.time, '', '', ...evals.map(e => round(e.timeEffect))]);
    rows.push([L.pv, '', '', ...evals.map(e => round(e.pv))]);
    rows.push([L.status, '', '', ...evals.map(e => e.complete ? (result.leader && result.leader.id === e.id ? L.leader : '') : L.incomplete)]);
    return rows;
  }

  function toCsv(rows) {
    return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  }

  /** Budget-system hand-off: everything needed to audit the decision, nothing more. */
  function workflowJson(state, result) {
    return {
      schema: 'rfq-normalizer/decision@1',
      generatedAt: new Date().toISOString(),
      package: { code: state.code, title: state.title, demo: !!state.demo },
      assumptions: { ...state.macro, logisticsPaidOnDay: 0, monthDays: 30, comparisonBasis: 'VAT excluded, landed at site, present value in TRY' },
      items: state.items.map(i => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit })),
      suppliers: result.evals.map(e => ({
        id: e.id, name: e.name, currency: e.currency, complete: e.complete, missingItems: e.missing,
        paperTRY: round(e.paper), vatTRY: round(e.vat), netTRY: round(e.net), wasteTRY: round(e.waste),
        logisticsTRY: round(e.logistics), landedTRY: round(e.landed), presentValueTRY: round(e.pv),
        pvFactor: Math.round(e.factor * 1e6) / 1e6, averageDays: Math.round(e.avgDays * 10) / 10,
        lines: Object.fromEntries(state.items.map(i => [i.id, e.lines[i.id].missing ? null : {
          quotedPrice: e.lines[i.id].quotedPrice, quotedUnit: e.lines[i.id].quotedUnit, conversion: e.lines[i.id].factor,
          landedTRY: round(e.lines[i.id].landed), presentValueTRY: round(e.lines[i.id].pv)
        }]))
      })),
      decision: {
        leader: result.leader ? result.leader.id : null,
        leaderPresentValueTRY: result.leader ? round(result.leader.pv) : null,
        split: result.split ? { assignment: result.split.assign, suppliers: result.split.suppliers, totalTRY: round(result.split.total), savingVsLeaderTRY: round(result.splitSaving) } : null
      }
    };
  }

  return { DEFAULT_MACRO, SCHEMA_VERSION, scenarioState, relabel, emptyProject, importProject, csvCell, sheetRows, toCsv, workflowJson };
});
