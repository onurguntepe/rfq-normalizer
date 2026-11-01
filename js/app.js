/*
 * RFQ Normalizer - user interface.
 * Reads state, asks RFQEngine for numbers, prints them on cheque paper.
 */
(function () {
  'use strict';

  const E = window.RFQEngine, P = window.RFQParser, M = window.RFQModel, SC = window.RFQScenarios;
  const I18N = window.RFQI18n, W = window.RFQWords, AI = window.RFQAi, F = window.RFQFiles, C = window.RFQCharts;
  const STORE = 'mukayese-ceki/v1';
  const AI_STORE = 'mukayese-ceki/ai';
  const $ = id => document.getElementById(id);
  const esc = C.esc;

  const ui = { lang: 'tr', view: 'pv', editItems: false, tab: 'ai', draft: null, draftNotes: null, draftEditId: null, draftSource: 'manual', busy: false, abort: null, lastLeader: null, lastLeaderPv: null, aiError: null, pendingAttachment: null, bridgeAttachment: null, cat: 'ALL', q: '' };
  let state = null;
  let result = null;
  let ai = { provider: 'anthropic', key: '', model: '', url: '', remember: false };

  /* ---------- text ---------- */

  function t(key, vars) {
    const dict = I18N[ui.lang] || I18N.tr;
    let s = dict[key] !== undefined ? dict[key] : (I18N.tr[key] !== undefined ? I18N.tr[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    return s;
  }
  const locale = () => (ui.lang === 'en' ? 'en-US' : 'tr-TR');
  function num(n, d = 0) {
    if (!Number.isFinite(n)) return '–';
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  const tl = n => num(Math.round(n)) + ' TL';
  const signedTl = n => (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(Math.round(n))) + ' TL';
  function pct(n) {
    const r = Math.round(n * 10) / 10;
    return num(r, Math.abs(r - Math.round(r)) < 1e-9 ? 0 : 1);
  }
  function unitPrice(n, cur) {
    const d = n < 100 ? 2 : 0;
    return num(n, d) + ' ' + (cur === 'TRY' ? 'TL' : cur);
  }
  function shortName(name) { return String(name || '').replace(/\s*\(.*\)\s*$/, '').trim() || String(name || ''); }

  /* ---------- storage ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const o = JSON.parse(raw);
        ui.lang = o.lang === 'en' ? 'en' : 'tr';
        ui.view = ['paper', 'landed', 'pv'].includes(o.view) ? o.view : 'pv';
        state = M.importProject(o.project);
      }
    } catch (e) { state = null; }
    if (!state) {
      const nav = (navigator.language || '').toLowerCase();
      ui.lang = nav && !nav.startsWith('tr') ? 'en' : 'tr';
      state = M.scenarioState(SC[0], ui.lang);
    }
    try {
      const a = JSON.parse(localStorage.getItem(AI_STORE) || sessionStorage.getItem(AI_STORE) || 'null');
      if (a && AI.PROVIDERS[a.provider]) ai = { ...ai, ...a };
    } catch (e) { /* storage blocked */ }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ lang: ui.lang, view: ui.view, project: state })); } catch (e) { /* private mode */ }
  }

  function saveAi() {
    const data = JSON.stringify(ai);
    try {
      if (ai.remember) { localStorage.setItem(AI_STORE, data); sessionStorage.removeItem(AI_STORE); }
      else { sessionStorage.setItem(AI_STORE, data); localStorage.removeItem(AI_STORE); }
    } catch (e) { /* storage blocked */ }
  }

  /* ---------- small UI helpers ---------- */

  function toast(msg, isError) {
    const el = document.createElement('div');
    el.className = 'bildirim' + (isError ? ' hata' : '');
    el.textContent = msg;
    $('bildirimler').appendChild(el);
    setTimeout(() => el.remove(), isError ? 6000 : 3400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function supplierIndex(id) { return state.suppliers.findIndex(s => s.id === id); }
  function colorOf(id) { return C.seriesColor(Math.max(0, supplierIndex(id))); }
  function dashOf(id) { return C.seriesDash(Math.max(0, supplierIndex(id))); }
  function supById(id) { return state.suppliers.find(s => s.id === id); }
  function evById(id) { return result.evals.find(e => e.id === id); }
  function itemName(id) { const it = state.items.find(i => i.id === id); return it ? it.name : id; }

  function planLabel(plan) {
    if (!plan || !plan.length) return t('planNone');
    if (plan.length === 1 && plan[0].days === 0) return t('planCash');
    if (plan.length === 1) return t('planSingle', { d: plan[0].days });
    const eq = plan.every(p => Math.abs(p.pct - plan[0].pct) < 0.01);
    if (eq && plan.every(p => p.days > 0)) return t('planEqual', { d: plan.map(p => p.days).join('-') });
    return plan.map(p => '%' + pct(p.pct) + ' ' + (p.days === 0 ? t('planNow') : p.days + t('dayShort'))).join(' + ');
  }
  function deliveryLabel(code) { return t('del_' + code); }

  /* ---------- guilloche: generated once, used as security tint ---------- */

  function guilloche() {
    try {
      const w = 1040, h = 520;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.lineWidth = 0.7;
      const rosette = (cx, cy, R, r, d, turns, color) => {
        g.strokeStyle = color;
        g.beginPath();
        for (let i = 0; i <= 3600 * turns; i++) {
          const a = i / 3600 * Math.PI * 2;
          const x = cx + (R - r) * Math.cos(a) + d * Math.cos((R - r) / r * a);
          const y = cy + (R - r) * Math.sin(a) - d * Math.sin((R - r) / r * a);
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      };
      // open rosettes: a large pen offset keeps the hub empty instead of a dense disc
      rosette(1130, 250, 240, 41, 150, 41, 'rgba(31,58,115,0.045)');
      rosette(1130, 250, 190, 29, 140, 29, 'rgba(23,133,98,0.035)');
      g.strokeStyle = 'rgba(31,58,115,0.06)';
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y = 40 + k * 32 + Math.sin(x / 38 + k * 0.6) * 9 + Math.sin(x / 11) * 2;
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      document.documentElement.style.setProperty('--guilos', 'url(' + cv.toDataURL('image/png') + ')');
    } catch (e) { /* canvas unavailable: plain paper */ }
  }

  function microprint(code) {
    const unit = 'MKG MUKAYESE · ' + (code || 'RFQ') + ' · RFQ NORMALIZER · ';
    return '<span class="mikro" aria-hidden="true">' + esc(unit.repeat(18)) + '</span>';
  }

  /* ---------- top bar and MICR ---------- */

  function renderHeader() {
    $('projeKod').textContent = state.code || 'RFQ';
    const inp = $('projeAd');
    if (document.activeElement !== inp) inp.value = state.title || '';
    $('ornekEtiket').hidden = !state.demo;
    document.querySelectorAll('.dil button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === ui.lang)));
  }

  function renderMicr() {
    const m = state.macro;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    set('pRate', m.monthlyRate); set('pRateR', m.monthlyRate);
    set('pEur', m.spotEUR); set('pEurG', m.growthEUR);
    set('pUsd', m.spotUSD); set('pUsdG', m.growthUSD);
    set('pVat', m.vatRate);
    $('pRateYil').textContent = t('annualEq', { v: pct((Math.pow(1 + (Number(m.monthlyRate) || 0) / 100, 12) - 1) * 100) });
  }

  /* ---------- verdict cheque ---------- */

  function fxStress() {
    const leader = result.leader;
    if (!leader || leader.currency === 'TRY') return null;
    const key = leader.currency === 'EUR' ? 'growthEUR' : 'growthUSD';
    const macro = { ...state.macro, [key]: (Number(state.macro[key]) || 0) + 2 };
    const r2 = E.evaluate({ ...state, macro });
    const l2 = r2.evals.find(e => e.id === leader.id);
    return { pv: l2.pv, delta: l2.pv - leader.pv, newLeader: r2.leader && r2.leader.id !== leader.id ? r2.leader : null };
  }

  function renderVerdict() {
    const box = $('kararIc');
    const leader = result.leader;
    if (!leader) {
      const anyPartial = result.evals.length > 0;
      box.innerHTML = `<div class="bos-durum">
        <h3>${esc(t(anyPartial ? 'emptyPartialTitle' : 'emptyTitle'))}</h3>
        <p>${esc(t(anyPartial ? 'emptyPartialText' : 'emptyText'))}</p>
        <div class="eylem-satir"><button class="btn btn-dolu" data-eylem="teklif">${esc(t('addQuote'))}</button><button class="btn" data-eylem="paketler">${esc(t('loadDemo'))}</button></div>
      </div>`;
      ui.lastLeader = null;
      return;
    }
    const second = result.byPv[1];
    const paper = result.paperLeader;
    const illusion = paper && paper.id !== leader.id;
    const words = ui.lang === 'en' ? W.en(leader.pv) : W.tr(leader.pv);
    const date = new Date().toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    const inkPct = leader.landed > 0 ? Math.min(100, leader.pv / leader.landed * 100) : 100;
    const stress = fxStress();
    const fresh = ui.lastLeader !== leader.id;
    const amountChanged = ui.lastLeaderPv !== null && Math.round(ui.lastLeaderPv) !== Math.round(leader.pv);
    ui.lastLeader = leader.id;
    ui.lastLeaderPv = leader.pv;
    const incomplete = result.evals.filter(e => !e.complete).length;

    const reason = second
      ? t('verdictReason', { plan: esc(planLabel(supById(leader.id).plan)), other: esc(shortName(second.name)), gap: tl(second.pv - leader.pv) })
      : t('verdictAlone');

    box.innerHTML = `<div class="cek">
      <div class="kocan">
        <span class="etiket">${esc(t('stub'))}</span>
        <div class="kocan-satir">
          <span class="etiket">${esc(t('paperCheapest'))}</span>
          <div>${esc(shortName(paper.name))}</div>
          <div class="kocan-deger ${illusion ? 'duzeltme' : ''}">${tl(paper.paper)}</div>
          ${illusion ? `<div class="kocan-deger kirmizi-kalem">${esc(t('reallyCosts'))} ${tl(paper.pv)}</div><div class="kocan-deger kirmizi-kalem">${signedTl(paper.pv - leader.pv)}</div>` : `<div class="kocan-deger">${esc(t('paperAligned'))}</div>`}
        </div>
        <div class="kocan-satir">
          <span class="etiket">${esc(t('quotesIn'))}</span>
          <div class="kocan-deger">${esc(t('quotesCount', { n: result.byPv.length, m: incomplete }))}</div>
        </div>
        <div class="kocan-satir">
          <span class="etiket">${esc(t('leaderTerm'))}</span>
          <div class="kocan-deger">${esc(t('avgDays', { d: num(leader.avgDays) }))}</div>
          <div class="kocan-deger">${esc(t('fundingAt', { r: pct(state.macro.monthlyRate) }))}</div>
        </div>
        ${stress ? `<div class="kocan-satir">
          <span class="etiket">${esc(t('fxStress'))}</span>
          <div class="kocan-deger">${signedTl(stress.delta)}</div>
          <div class="kocan-deger ${stress.newLeader ? 'kirmizi-kalem' : ''}">${esc(stress.newLeader ? t('fxStressFlip', { n: shortName(stress.newLeader.name) }) : t('fxStressHold'))}</div>
        </div>` : ''}
      </div>
      <div class="cek-yuz">
        <div class="cek-ust">
          <span class="etiket">${esc(t('chequeSeries', { c: state.code || 'RFQ' }))}</span>
          <span class="karar-damga"><span class="damga damga-iri ${fresh ? 'damga-bas' : ''}">${esc(t('stampCheapest'))}</span></span>
          <span class="cek-no">${esc(t('issued'))} ${esc(date)}</span>
        </div>
        <div class="cek-satir"><span class="etiket">${esc(t('payTo'))}</span><div class="noktali odeyiniz">${esc(leader.name)}</div></div>
        <div class="cek-satir"><span class="etiket">${esc(t('onlyWords'))}</span><div class="noktali yalniz">#${esc(words)}#${esc(t('wordsSuffix'))}</div></div>
        <div class="cek-satir"><span class="etiket">${esc(t('amount'))}</span>
          <div><span class="tutar-kutu"><span class="rakam ${amountChanged ? 'yenilendi' : ''}">#${num(Math.round(leader.pv))}#</span><span class="birim">TL</span></span>
          ${leader.currency !== 'TRY' ? ` <span class="damga damga-kirmizi">${esc(t('stampFx'))}</span>` : ''}</div>
        </div>
        <div class="cek-satir"><span class="etiket">${esc(t('inkLabel'))}</span>
          <div>
            <div class="murekkep-serit" role="img" aria-label="${esc(t('inkAria', { p: pct(inkPct) }))}"><span style="transform:scaleX(${(inkPct / 100).toFixed(4)})"></span></div>
            <div class="murekkep-not"><span>${esc(t('inkLanded'))} <b class="rakam">${tl(leader.landed)}</b></span><span>${esc(t('inkToday'))} <b class="rakam">${tl(leader.pv)}</b> (%${pct(inkPct)})</span></div>
          </div>
        </div>
        <div class="cek-alt">
          <p style="max-width:62ch;font-size:13.5px;color:var(--koyu)">${reason}</p>
          <div class="imza">${esc(t('signature'))}</div>
        </div>
        <div style="margin-top:14px">${microprint(state.code)}</div>
      </div>
    </div>`;
  }

  /* ---------- cheque book ---------- */

  function stripScale() {
    let maxDays = 90, maxAmount = 0;
    result.evals.forEach(e => {
      e.tranches.forEach(tr => { maxDays = Math.max(maxDays, tr.days); maxAmount = Math.max(maxAmount, tr.amountOnDue); });
      maxAmount = Math.max(maxAmount, e.logistics);
    });
    const narrow = window.innerWidth < 640;
    const step = maxDays > 180 || narrow && maxDays > 120 ? 60 : 30;
    // drawn close to its on-screen width so the day labels stay legible on a phone
    return { maxDays: Math.ceil((maxDays + 10) / step) * step, maxAmount, step, width: narrow ? 300 : 520 };
  }

  function renderBook() {
    const box = $('defterIc');
    if (!state.suppliers.length) {
      box.innerHTML = `<div class="bos-durum"><h3>${esc(t('bookEmpty'))}</h3><p>${esc(t('bookEmptyText'))}</p><button class="btn btn-dolu" data-eylem="teklif">${esc(t('addQuote'))}</button></div>`;
      return;
    }
    const scale = stripScale();
    const order = [...result.byPv, ...result.evals.filter(e => !e.complete)];
    const leader = result.leader;
    const paperLeader = result.paperLeader;
    box.innerHTML = order.map(ev => {
      const sup = supById(ev.id);
      const rank = ev.complete ? result.byPv.indexOf(ev) + 1 : null;
      const stamps = [];
      if (leader && ev.id === leader.id) stamps.push(`<span class="damga">${esc(t('stampLeader'))}</span>`);
      if (paperLeader && leader && ev.id === paperLeader.id && paperLeader.id !== leader.id) stamps.push(`<span class="damga damga-kirmizi">${esc(t('stampIllusion'))}</span>`);
      if (!ev.complete) stamps.push(`<span class="damga damga-kirmizi">${esc(t('stampIncomplete'))}</span>`);
      if (ev.currency !== 'TRY') stamps.push(`<span class="damga damga-soluk">${esc(t('stampFxShort', { c: ev.currency }))}</span>`);
      if (sup.source === 'heuristic') stamps.push(`<span class="damga damga-soluk">${esc(t('stampGuess'))}</span>`);
      const gap = leader && ev.complete && ev.id !== leader.id ? ev.pv - leader.pv : null;
      const terms = [ev.currency, deliveryLabel(sup.delivery), planLabel(sup.plan), sup.wastePct ? t('wasteShort', { p: pct(sup.wastePct) }) : null, sup.vatIncluded ? t('vatIncl') : t('vatExcl')].filter(Boolean).join(' · ');
      const missingNames = ev.missing.concat(ev.unconvertible).map(itemName);
      const strip = C.paymentStrip(ev, scale, colorOf(ev.id), { pct }, {
        aria: t('stripAria', { n: ev.name }),
        dayShort: t('dayShort'),
        logisticsTip: t('logisticsTip', { v: tl(ev.logistics) }),
        trancheTip: tr => t('trancheTip', { p: pct(tr.pct), d: tr.days, due: tl(tr.amountOnDue), pv: tl(tr.pv), cur: ev.currency !== 'TRY' ? ' (' + unitPrice(tr.currencyAmount, ev.currency) + ')' : '' })
      });
      const rows = [
        [t('rowPaper'), tl(ev.paper), ''],
        ev.vat ? [t('rowVat'), signedTl(-ev.vat), 'eksi'] : null,
        ev.waste ? [t('rowWaste'), signedTl(ev.waste), 'arti'] : null,
        ev.logistics ? [t('rowLogistics'), signedTl(ev.logistics), 'arti'] : null,
        [t('rowLanded'), tl(ev.landed), 'ara'],
        [t('rowTime'), signedTl(ev.timeEffect), ev.timeEffect <= 0 ? 'eksi' : 'arti'],
        [t('rowPv'), tl(ev.pv), 'son']
      ].filter(Boolean);
      return `<article class="yaprak ${ev.complete ? '' : 'eksik'}" id="yaprak-${esc(ev.id)}">
        <div class="yaprak-sira">
          <span class="sira-no">${rank ? rank : '–'}</span>
          <span class="sira-dis">${esc(rank ? t('rankLabel') : t('unranked'))}</span>
        </div>
        <div class="yaprak-sol">
          <div class="yaprak-ad"><span class="seri-isaret" style="background:${colorOf(ev.id)}" aria-hidden="true"></span><h3>${esc(ev.name)}</h3>${stamps.join(' ')}</div>
          <div class="yaprak-sart">${esc(terms)}</div>
          ${missingNames.length ? `<div class="yaprak-sart kirmizi-kalem" style="margin-top:4px">${esc(t('missingList', { list: missingNames.join(', ') }))}</div>` : ''}
          <div class="vade-serit">${strip}</div>
          <div class="yaprak-arac">
            <button class="bag" data-eylem="duzenle" data-id="${esc(ev.id)}">${esc(t('edit'))}</button>
            <button class="bag" data-eylem="kopyala" data-id="${esc(ev.id)}">${esc(t('duplicate'))}</button>
            <button class="bag bag-kirmizi" data-eylem="sil" data-id="${esc(ev.id)}">${esc(t('remove'))}</button>
          </div>
        </div>
        <div class="yaprak-sag">
          <table class="dokum"><tbody>
            ${rows.map(r => `<tr class="${r[2] === 'ara' ? 'ara' : r[2] === 'son' ? 'son' : ''}"><td>${esc(r[0])}${!ev.complete && r[2] === 'son' ? ' ' + esc(t('partial')) : ''}</td><td class="${r[2] === 'eksi' || r[2] === 'arti' ? r[2] : ''}">${r[1]}</td></tr>`).join('')}
            ${gap !== null ? `<tr class="bos"><td>${esc(t('vsLeader'))}</td><td>${signedTl(gap)}</td></tr>` : ''}
          </tbody></table>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- comparison ledger ---------- */

  function renderLedger() {
    const box = $('cetvelIc');
    document.querySelectorAll('#gorunum button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gorunum === ui.view)));
    $('kalemDuzenBtn').setAttribute('aria-pressed', String(ui.editItems));
    $('kalemDuzenBtn').textContent = ui.editItems ? t('editItemsDone') : t('editItems');
    $('cetvelAciklama').textContent = t('ledgerLead_' + ui.view);
    const evals = [...result.byPv, ...result.evals.filter(e => !e.complete)];
    const key = ui.view;
    const unitKey = { paper: 'unitPaper', landed: 'unitLanded', pv: 'unitPv' }[key];
    const leaderId = result.leader && result.leader.id;
    let h = '<table class="cetvel"><thead><tr>';
    h += `<th scope="col">${esc(t('colItem'))}</th>`;
    evals.forEach(e => {
      h += `<th scope="col" class="${e.id === leaderId ? 'lider-sutun' : ''}"><span class="seri-isaret" style="display:inline-block;background:${colorOf(e.id)};margin-right:6px" aria-hidden="true"></span>${esc(shortName(e.name))}<br><span class="rakam" style="font-weight:400;text-transform:none;letter-spacing:0">${esc(e.currency)}${e.complete ? '' : ' · ' + esc(t('incompleteShort'))}</span></th>`;
    });
    h += '</tr></thead><tbody>';
    state.items.forEach(item => {
      const best = result.itemBest[item.id][key];
      h += '<tr>';
      if (ui.editItems) {
        h += `<th scope="row"><div class="kalem-duzen">
          <label class="alan-grup"><span class="etiket">${esc(t('itemName'))}</span><input class="alan" data-kalem="${esc(item.id)}" data-alan="name" value="${esc(item.name)}"></label>
          <label class="alan-grup"><span class="etiket">${esc(t('qty'))}</span><input class="alan" type="number" min="0" step="any" data-kalem="${esc(item.id)}" data-alan="qty" value="${esc(item.qty)}"></label>
          <label class="alan-grup"><span class="etiket">${esc(t('unit'))}</span><input class="alan" list="birimler" data-kalem="${esc(item.id)}" data-alan="unit" value="${esc(item.unit)}"></label>
          <label class="alan-grup"><span class="etiket" title="${esc(t('diameterHint'))}">Ø mm</span><input class="alan" type="number" min="0" step="1" data-kalem="${esc(item.id)}" data-alan="diameter" value="${esc(item.diameter || '')}"></label>
          <button class="bag bag-kirmizi" data-eylem="kalemSil" data-id="${esc(item.id)}">${esc(t('remove'))}</button>
        </div></th>`;
      } else {
        h += `<th scope="row"><span class="kalem-ad">${esc(item.name)}</span><span class="kalem-mik">${num(item.qty, item.qty % 1 ? 2 : 0)} ${esc(item.unit)}</span></th>`;
      }
      evals.forEach(e => {
        const l = e.lines[item.id];
        if (l.missing) {
          h += `<td class="yok"><span class="hucre-ana">${esc(l.unconvertible ? t('noConversion') : t('noOffer'))}</span></td>`;
          return;
        }
        const quoted = unitPrice(l.quotedPrice, e.currency) + ' / ' + l.quotedUnit + (supById(e.id).vatIncluded ? ' ' + t('vatInclShort') : '');
        const sub = key === 'paper' ? quoted : unitPrice(l[unitKey], 'TRY') + ' / ' + item.unit;
        h += `<td class="${best === e.id && result.itemBest[item.id].offers > 1 ? 'en-iyi' : ''}"><span class="hucre-ana">${num(Math.round(l[key]))}</span><span class="hucre-alt">${esc(sub)}</span></td>`;
      });
      h += '</tr>';
    });
    if (ui.editItems) h += `<tr><th scope="row"><button class="btn btn-kucuk" data-eylem="kalemEkle">${esc(t('addItem'))}</button></th>${evals.map(() => '<td></td>').join('')}</tr>`;
    h += '</tbody><tfoot>';
    const foot = [
      ['paper', t('rowPaper')],
      ['landed', t('rowLanded')],
      ['pv', t('rowPv')]
    ];
    foot.forEach(([k, label], i) => {
      h += `<tr class="${i === foot.length - 1 ? 'toplam-son' : ''}"><th scope="row">${esc(label)}</th>${evals.map(e => `<td class="${e.id === leaderId && k === 'pv' ? 'lider-sutun' : ''}">${num(Math.round(e[k]))}${e.complete ? '' : '*'}</td>`).join('')}</tr>`;
    });
    h += `<tr><th scope="row">${esc(t('rankRow'))}</th>${evals.map(e => `<td>${e.complete ? result.byPv.indexOf(e) + 1 : '–'}</td>`).join('')}</tr>`;
    h += '</tfoot></table>';
    if (evals.some(e => !e.complete)) h += `<p class="not-kutu" style="margin:0;padding:10px 12px">${esc(t('partialNote'))}</p>`;
    h += `<datalist id="birimler">${['Ton', 'kg', 'm', 'Boy', 'm²', 'm³', 'Adet', 'Set', 'Lt', 'Torba'].map(u => `<option value="${u}">`).join('')}</datalist>`;
    box.innerHTML = h;
    if (!evals.length) box.innerHTML = `<div class="bos-durum" style="border:0"><p>${esc(t('ledgerEmpty'))}</p></div>`;
  }

  /* ---------- interest-rate break-even ---------- */

  function breakEvens() {
    const leader = result.leader;
    if (!leader) return [];
    const ls = supById(leader.id);
    return result.byPv.slice(1).map(ev => {
      const rate = E.breakEvenRate(ls, supById(ev.id), state.items, state.macro, 0, 20);
      return { ev, rate, pv: rate !== null ? E.evaluateSupplier(ls, state.items, state.macro, rate).pv : null };
    });
  }

  function renderRate() {
    const box = $('kirilmaIc');
    if (result.byPv.length < 2) {
      box.innerHTML = `<p class="aciklama">${esc(t('rateNeedTwo'))}</p>`;
      box.style.display = 'block';
      return;
    }
    box.style.display = '';
    const cur = Number(state.macro.monthlyRate) || 0;
    const xMax = Math.max(8, Math.ceil(cur * 1.5));
    const sups = result.byPv.map(e => supById(e.id));
    const sens = E.sensitivity(sups, state.items, state.macro, 0, xMax, xMax / 80);
    const leaderId = result.leader.id;
    const bes = breakEvens();
    const series = sens.map(s => ({ id: s.id, points: s.points, color: colorOf(s.id), dash: dashOf(s.id), lead: s.id === leaderId, short: shortName(supById(s.id).name) }));
    const crossings = bes.filter(b => b.rate !== null && b.rate <= xMax).map(b => ({ rate: b.rate, pv: b.pv, tip: t('crossTip', { r: pct(b.rate), a: shortName(result.leader.name), b: shortName(b.ev.name), v: tl(b.pv) }) }));
    const svg = C.sensitivityChart(series, {
      aria: t('rateAria'),
      fmtAxis: v => num(v / 1e6, 2) + (ui.lang === 'en' ? 'M' : ' Mn'),
      xTitle: t('rateAxis'),
      current: cur,
      currentLabel: t('rateNow', { r: pct(cur) }),
      crossings
    });
    const legend = series.map(s => `<span>${C.legendSwatch(s.color, s.dash)}${esc(s.short)}</span>`).join('');
    const items = bes.map(b => {
      const other = esc(shortName(b.ev.name));
      if (b.rate === null) return `<li>${t('beNever', { b: other })}</li>`;
      const r = `<span class="rakam">%${pct(b.rate)}</span>`;
      return `<li>${b.rate < cur ? t('beBelow', { r, b: other }) : t('beAbove', { r, b: other })}</li>`;
    }).join('');
    box.innerHTML = `<div class="grafik" id="kirilmaGrafik">${svg}<div class="lejant">${legend}</div></div>
      <div><h3 class="etiket" style="margin-bottom:6px">${esc(t('beTitle', { n: shortName(result.leader.name) }))}</h3><ul class="kirilma-liste">${items}</ul>
      <p class="not-kutu">${esc(t('rateNote'))}</p></div>`;
    wireRateHover(series);
  }

  function wireRateHover(series) {
    const svg = $('kirilmaGrafik').querySelector('svg');
    const hit = svg.querySelector('.vurus');
    const cursor = svg.querySelector('.imlec');
    const d = svg.dataset;
    const xmin = Number(d.xmin), xmax = Number(d.xmax), L = Number(d.l), R = Number(d.r), Wd = Number(d.w);
    const move = ev => {
      const box = svg.getBoundingClientRect();
      const px = (ev.clientX - box.left) / box.width * Wd;
      const rate = xmin + (px - L) / (Wd - L - R) * (xmax - xmin);
      const idx = Math.max(0, Math.min(series[0].points.length - 1, Math.round((rate - xmin) / (xmax - xmin) * (series[0].points.length - 1))));
      const xr = series[0].points[idx][0];
      const sx = L + (xr - xmin) / (xmax - xmin) * (Wd - L - R);
      cursor.setAttribute('x1', sx); cursor.setAttribute('x2', sx); cursor.setAttribute('opacity', '0.8');
      const rows = series.map(s => ({ n: s.short, v: s.points[idx][1] })).sort((a, b) => a.v - b.v);
      showTip(t('rateTipHead', { r: pct(xr) }) + '\n' + rows.map((r, i) => (i + 1) + '. ' + r.n + '  ' + tl(r.v)).join('\n'), ev.clientX, ev.clientY);
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => { cursor.setAttribute('opacity', '0'); hideTip(); });
  }

  /* ---------- split order ---------- */

  function naiveSplit() {
    // The shortcut most sheets take: per-item best with logistics spread by value.
    let total = 0;
    for (const item of state.items) {
      const id = result.itemBest[item.id].pv;
      if (!id) return null;
      total += evById(id).lines[item.id].pv;
    }
    return total;
  }

  function renderSplit() {
    const box = $('bolunmusIc');
    const sp = result.split;
    const leader = result.leader;
    if (!sp) {
      box.innerHTML = `<div class="levha"><p>${esc(t('splitNone'))}</p></div>`;
      return;
    }
    const used = sp.suppliers.map(id => evById(id));
    const single = used.length === 1;
    const naive = naiveSplit();
    let head;
    if (!leader) head = t('splitOnlyWay', { n: used.length, v: tl(sp.total) });
    else if (single) head = t('splitNoGain', { n: esc(shortName(used[0].name)) });
    else {
      const lg = used.reduce((a, e) => a + e.logistics, 0);
      head = t(lg > 0 ? 'splitGain' : 'splitGainNoLog', { n: used.length, s: tl(leader.pv - sp.total), l: tl(lg) });
    }
    const naiveLine = leader && naive !== null && naive < leader.pv - 1 && (single || naive < sp.total - 1)
      ? `<p>${t('splitNaive', { v: tl(leader.pv - naive), real: single ? t('splitNaiveNone') : tl(leader.pv - sp.total) })}</p>` : '';
    const rows = state.items.map(item => {
      const ev = evById(sp.assign[item.id]);
      return `<tr><td>${esc(item.name)}</td><td><span class="seri-isaret" style="display:inline-block;background:${colorOf(ev.id)};margin-right:6px" aria-hidden="true"></span>${esc(shortName(ev.name))}</td><td class="sag">${tl(ev.lines[item.id].pvMaterial)}</td></tr>`;
    }).join('');
    const logRows = used.filter(e => e.logistics > 0).map(e => `<tr><td>${esc(t('logisticsOf', { n: shortName(e.name) }))}</td><td></td><td class="sag">${tl(e.logistics)}</td></tr>`).join('');
    box.innerHTML = `<div class="iki-sutun">
      <div class="levha">
        <span class="etiket">${esc(t('splitBest'))}</span>
        <div class="buyuk-rakam">${tl(sp.total)}</div>
        ${leader ? `<p class="rakam" style="font-size:12.5px;color:var(--soluk);margin-top:2px">${esc(t('vsSingle', { v: tl(leader.pv) }))}</p>` : ''}
        <p style="margin-top:12px">${head}</p>
        ${naiveLine}
        <p class="not-kutu">${esc(t('splitAssume'))}</p>
      </div>
      <div class="levha">
        <h3>${esc(t('splitTable'))}</h3>
        <table class="liste-tablo"><thead><tr><th>${esc(t('colItem'))}</th><th>${esc(t('colSupplier'))}</th><th class="sag">${esc(t('colPvMat'))}</th></tr></thead>
        <tbody>${rows}${logRows}<tr><td><b>${esc(t('total'))}</b></td><td></td><td class="sag"><b>${tl(sp.total)}</b></td></tr></tbody></table>
      </div>
    </div>`;
  }

  /* ---------- negotiation ---------- */

  function letterFor(kind, ev, ask) {
    const title = state.title;
    const plan = planLabel(supById(ev.id).plan);
    if (kind === 'leader') return t('letterLeader', { n: shortName(ev.name), title, plan, ask });
    if (kind === 'challenger') return t('letterChallenger', { n: shortName(ev.name), title, plan, ask });
    return t('letterMissing', { n: shortName(ev.name), title, ask });
  }

  function renderNego() {
    const box = $('pazarlikIc');
    const leader = result.leader;
    if (!state.suppliers.length) { box.innerHTML = `<div class="levha"><p>${esc(t('negoEmpty'))}</p></div>`; return; }
    const parts = [];
    const macro = state.macro;
    if (leader) {
      const ls = supById(leader.id);
      const weak = state.items.filter(i => result.itemBest[i.id].pvMaterial && result.itemBest[i.id].pvMaterial !== leader.id).map(i => {
        const b = evById(result.itemBest[i.id].pvMaterial);
        return { item: i, by: b, diff: leader.lines[i.id].pvMaterial - b.lines[i.id].pvMaterial };
      }).filter(w => w.diff > 1);
      const second = result.byPv[1];
      const margin = second ? second.pv - leader.pv : null;
      const plus15 = E.evaluateSupplier({ ...ls, plan: ls.plan.map(p => ({ ...p, days: p.days + 15 })) }, state.items, macro).pv;
      const gain15 = leader.pv - plus15;
      let ask;
      if (result.splitSaving > 1) {
        const d = result.splitSaving / leader.pvMaterial * 100;
        const target = leader.paper * (1 - d / 100);
        ask = t('askLeaderSplit', { d: pct(d), v: leader.currency === 'TRY' ? tl(target) : unitPrice(target / leader.spot, leader.currency), s: tl(result.splitSaving) });
      } else {
        ask = t('askLeaderDays', { g: tl(gain15) });
      }
      parts.push(`<div class="ciro-madde">
        <h3><span class="damga">${esc(t('stampLeader'))}</span>${esc(leader.name)}</h3>
        <p>${margin !== null ? t('leaderMargin', { m: tl(margin), p: pct(margin / leader.pv * 100), n: esc(shortName(second.name)) }) : ''} ${weak.length ? t('leaderWeak', { list: weak.map(w => esc(w.item.name) + ' (' + esc(shortName(w.by.name)) + ', ' + signedTl(w.diff) + ')').join('; ') }) : t('leaderStrong')}</p>
        <p>${ask}</p>
        ${letterBlock('leader', leader, ask)}
      </div>`);
      result.byPv.slice(1).forEach(ev => {
        const a = E.challengerAsk(ev, leader.pv, macro);
        const target = ev.paper * (1 - a.discountPct / 100);
        const tgt = ev.currency === 'TRY' ? tl(target) : unitPrice(target / ev.spot, ev.currency);
        const days = a.extraDays !== null ? t('askDays', { d: Math.ceil(a.extraDays) }) : t('askDaysFx');
        const ask2 = t('askChallenger', { d: pct(a.discountPct), v: tgt, days });
        parts.push(`<div class="ciro-madde">
          <h3><span class="sira-no" style="font-size:16px">${result.byPv.indexOf(ev) + 1}</span>${esc(ev.name)} <span class="rakam" style="font-size:12px;color:var(--soluk)">${signedTl(ev.pv - leader.pv)}</span></h3>
          <p>${ask2}</p>
          ${letterBlock('challenger', ev, ask2)}
        </div>`);
      });
    }
    result.evals.filter(e => !e.complete).forEach(ev => {
      const list = ev.missing.concat(ev.unconvertible).map(itemName).join(', ');
      const ask3 = t('askMissing', { list: esc(list) });
      parts.push(`<div class="ciro-madde"><h3><span class="damga damga-kirmizi">${esc(t('stampIncomplete'))}</span>${esc(ev.name)}</h3><p>${ask3}</p>${letterBlock('missing', ev, ask3)}</div>`);
    });
    box.innerHTML = `<div class="ciro">${parts.join('')}</div>`;
  }

  function stripTags(s) { const d = document.createElement('div'); d.innerHTML = s; return d.textContent; }

  function letterBlock(kind, ev, askHtml) {
    const text = letterFor(kind, ev, stripTags(askHtml));
    return `<blockquote data-mektup="${esc(ev.id)}">${esc(text)}</blockquote>
      <div class="eylem-satir" style="margin-top:8px">
        <button class="bag" data-eylem="mektupKopyala" data-id="${esc(ev.id)}">${esc(t('copy'))}</button>
        <button class="bag" data-eylem="mektupAi" data-id="${esc(ev.id)}" data-tur="${kind}">${esc(t('aiPolish'))}</button>
      </div>`;
  }

  /* ---------- outputs ---------- */

  function renderOutputs() {
    const has = result.evals.length > 0;
    const lead = !!result.leader;
    const out = [
      ['onay', t('outApproval'), t('outApprovalSub'), !lead],
      ['siparis', t('outOrder'), t('outOrderSub'), !lead],
      ['xlsx', t('outXlsx'), t('outXlsxSub'), !has],
      ['csv', t('outCsv'), t('outCsvSub'), !has],
      ['json', t('outJson'), t('outJsonSub'), !has],
      ['sablon', t('outTemplate'), t('outTemplateSub'), false],
      ['kaydet', t('outSave'), t('outSaveSub'), false],
      ['ac', t('outOpen'), t('outOpenSub'), false]
    ];
    $('ciktilarIc').innerHTML = out.map(o => `<button class="cikti" data-cikti="${o[0]}" ${o[3] ? 'disabled' : ''}><b>${esc(o[1])}</b><span>${esc(o[2])}</span></button>`).join('');
    $('varsayimNotu').textContent = t('assumptions') + (state.demo ? ' ' + t('demoNote') : '');
  }

  function renderRail() {
    const l = result.leader;
    $('rayKarar').textContent = l ? num(Math.round(l.pv / 1000)) + (ui.lang === 'en' ? 'k TL' : ' bin TL') : '–';
    $('rayGiris').textContent = t('railModes');
    $('rayDefter').textContent = t('railQuotes', { n: state.suppliers.length });
    $('rayCetvel').textContent = t('railItems', { n: state.items.length });
    const be = breakEvens().filter(b => b.rate !== null).sort((a, b) => Math.abs(a.rate - state.macro.monthlyRate) - Math.abs(b.rate - state.macro.monthlyRate))[0];
    $('rayKirilma').textContent = be ? '%' + pct(be.rate) : '–';
    $('rayBolunmus').textContent = result.split && result.splitSaving > 1 ? t('railSplitGain', { v: tl(result.splitSaving) }) : t('railNoSplit');
    $('rayPazarlik').textContent = t('railParties', { n: result.evals.length });
  }

  /* ---------- static text ---------- */

  function applyStatic() {
    document.documentElement.lang = ui.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.title = t('brand') + ' · RFQ Normalizer';
  }

  function render() {
    result = E.evaluate(state);
    renderHeader();
    renderMicr();
    renderVerdict();
    renderBook();
    renderLedger();
    renderRate();
    renderSplit();
    renderNego();
    renderOutputs();
    renderRail();
    renderDock();
    save();
  }

  /* ---------- tooltip ---------- */

  function showTip(text, x, y) {
    const tip = $('ipucu');
    tip.textContent = text;
    tip.style.whiteSpace = 'pre-line';
    tip.classList.add('gorunur');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { $('ipucu').classList.remove('gorunur'); }

  /* ---------- package menu ---------- */

  const CATEGORIES = ['ALL', 'STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'INFRA_STEEL'];

  function renderDock() {
    $('dokAra').placeholder = t('dockSearch');
    $('dokKat').innerHTML = CATEGORIES.map(c => `<button type="button" data-kat="${c}" aria-pressed="${ui.cat === c}">${esc(t('cat_' + c))}</button>`).join('');
    const q = (ui.q || '').toLocaleLowerCase(locale());
    const list = SC.filter(s => (ui.cat === 'ALL' || s.category === ui.cat) &&
      (!q || (s.code + ' ' + s.title[ui.lang] + ' ' + s.summary[ui.lang]).toLocaleLowerCase(locale()).includes(q)));
    $('dokListe').innerHTML = list.length
      ? list.map(s => `<li><button type="button" data-paket="${esc(s.id)}" aria-current="${state.scenarioId === s.id}">
          <span class="dok-kod">${esc(s.code)}</span><span class="dok-ad">${esc(s.title[ui.lang])}</span><span class="dok-ozet">${esc(s.summary[ui.lang])}</span></button></li>`).join('')
      : `<li class="dok-bos">${esc(t('dockNone'))}</li>`;
  }

  // Below 1360 px the dock is a drawer; above it is always on screen.
  const dockIsDrawer = () => window.matchMedia('(max-width: 1360px)').matches;

  function toggleDock(open) {
    const dok = $('paketDok');
    const show = open === undefined ? !dok.classList.contains('acik') : open;
    dok.classList.toggle('acik', show);
    $('paketBtn').setAttribute('aria-expanded', String(show));
    $('masaPerde').hidden = !show;
    $('masaPerde').classList.toggle('acik', show);
    if (show) setTimeout(() => $('dokAra').focus(), 60);
  }

  function userWork() { return state.suppliers.some(s => s.source !== 'demo' || s.edited) || state.items.some(i => i.edited); }

  function switchPackage(id) {
    if (dockIsDrawer()) toggleDock(false);
    if (id === '__ac') { $('projeDosya').click(); return; }
    if (id === state.scenarioId && !userWork()) { document.getElementById('karar').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (userWork() && !window.confirm(t('confirmReplace'))) return;
    const macro = state.macro;
    state = id === '__bos' ? { ...M.emptyProject(ui.lang), macro } : M.scenarioState(SC.find(s => s.id === id), ui.lang, macro);
    ui.lastLeader = null;
    render();
    document.getElementById('karar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(id === '__bos' ? t('toastEmpty') : t('toastLoaded', { n: state.title }));
  }

  /* ======================================================================
   * Quote intake: the three modes live on the page, under the verdict (K-10)
   * ==================================================================== */

  /** Bring the intake section into view, optionally on a given mode. */
  function openDesk(tab) {
    if (tab && !ui.draft) { ui.tab = tab; renderDesk(); }
    $('giris').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { const f = $('masaGovde').querySelector('input, textarea, select'); if (f) f.focus({ preventScroll: true }); }, 400);
  }

  function renderTabs() {
    document.querySelectorAll('#sekmeler [role="tab"]').forEach(b => {
      const on = b.dataset.sekme === ui.tab && !ui.draft;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on || (!ui.draft && b.dataset.sekme === ui.tab) ? 0 : -1;
    });
  }

  function renderDesk() {
    renderTabs();
    const body = $('masaGovde');
    if (ui.draft) { renderReview(); return; }
    if (ui.tab === 'ai') body.innerHTML = deskAi();
    else if (ui.tab === 'kopru') body.innerHTML = deskBridge();
    else body.innerHTML = deskManual();
    wireDropzones();
  }

  function sampleText(n) {
    const items = state.items;
    const base = state.suppliers.find(s => s.currency === 'TRY') || state.suppliers[0];
    const priceOf = it => {
      const l = base && base.lines[it.id];
      return l && l.price > 0 && (l.unit || it.unit) === it.unit ? l.price : 1000;
    };
    const tr = ui.lang === 'tr';
    if (n === 1) {
      const lines = items.map((it, i) => `- ${it.name}: ${Math.round(priceOf(it) * (1.03 - i * 0.01)).toLocaleString('tr-TR')} TL / ${it.unit}`).join('\n');
      return tr ? `Selam şefim, ${state.title} için Örnek Metal Ticaret Ltd. Şti. revize fiyatlarımız:\n${lines}\nFiyatlarımız KDV hariç fabrika teslimdir (şantiyenize tır nakliyesi toplam 78.000 TL, mobil vinç indirme 18.000 TL tutar). Ödeme: 30 - 60 - 90 gün eşit çek.`
        : `Hi, revised prices from Sample Metal Trading Ltd. for ${state.title}:\n${lines}\nPrices exclude VAT, ex-works factory (freight to your site 78,000 TL, crane unloading 18,000 TL). Payment: 30 - 60 - 90 days equal cheques.`;
    }
    if (n === 2) {
      const eur = Number(state.macro.spotEUR) || 38;
      const lines = items.map(it => `* ${it.name}: ${(priceOf(it) / eur * 1.01).toFixed(2).replace('.', tr ? ',' : '.')} EUR / ${it.unit}`).join('\n');
      return tr ? `Kuzey Dış Ticaret A.Ş. teklifi\n${lines}\nTeslim: şantiye istif teslim, nakliye ve vinç dahil. Ödeme: %30 peşin avans, kalan %70 60 gün vadeli. Fiyatlar KDV hariçtir.`
        : `Northern Trading Co. quote\n${lines}\nDelivery: site, stacked, freight and crane included. Payment: 30% advance, remaining 70% at 60 days. Prices exclude VAT.`;
    }
    const lines = items.slice(0, Math.max(1, items.length - 1)).map(it => `${it.name} ${Math.round(priceOf(it) * 1.2 * 1.08).toLocaleString('tr-TR')} TL/${it.unit}`).join(', ');
    return tr ? `Anadolu Yapı Pazarlama: ${lines}. Fiyatlar KDV dahildir. Şantiye teslim, indirme vinci alıcıya ait (yaklaşık 24.000 TL). %1,5 kesim fire payı öngörülmüştür. Ödeme: 90 gün tek çek.`
      : `Anatolia Building Supply: ${lines}. Prices include VAT. Delivered to site, unloading crane by buyer (approx. 24,000 TL). 1.5% cutting waste allowance. Payment: 90 days single cheque.`;
  }

  function providerFields() {
    const p = AI.PROVIDERS[ai.provider];
    const models = (p.models || []).map(m => `<option value="${esc(m)}">`).join('');
    return `<div class="izgara-2">
      <label class="alan-grup"><span class="etiket">${esc(t('aiProvider'))}</span>
        <select class="alan" id="aiProvider">${Object.keys(AI.PROVIDERS).map(k => `<option value="${k}" ${k === ai.provider ? 'selected' : ''}>${esc(k === 'openai' ? t('providerOpenai') : AI.PROVIDERS[k].label)}</option>`).join('')}</select></label>
      <label class="alan-grup"><span class="etiket">${esc(t('aiModel'))}</span>
        <input class="alan" id="aiModel" list="aiModeller" value="${esc(ai.model || p.defaultModel)}" autocomplete="off"><datalist id="aiModeller">${models}</datalist></label>
    </div>
    ${p.needsUrl ? `<label class="alan-grup"><span class="etiket">${esc(t('aiUrl'))}</span><input class="alan" id="aiUrl" value="${esc(ai.url || p.defaultUrl)}" autocomplete="off" spellcheck="false"></label>` : ''}
    <label class="alan-grup"><span class="etiket">${esc(p.needsKey ? t('aiKey') : t('aiKeyOptional'))}</span><input class="alan" id="aiKey" type="password" value="${esc(ai.key)}" autocomplete="off" spellcheck="false" placeholder="${esc(t('aiKeyPh'))}"></label>
    <label class="onay-kutu"><input type="checkbox" id="aiRemember" ${ai.remember ? 'checked' : ''}>${esc(t('aiRemember'))}</label>
    <p class="aciklama">${esc(t('aiPrivacy'))}</p>`;
  }

  function dropzone(id, hint) {
    return `<div class="surukle" id="${id}" tabindex="0" role="button" aria-label="${esc(t('dropAria'))}">
      <b>${esc(t('dropTitle'))}</b><br><span>${esc(hint)}</span><div class="dosya-bilgi" id="${id}Bilgi"></div>
      <input type="file" hidden accept=".pdf,.xlsx,.xls,.ods,.csv,.txt,.png,.jpg,.jpeg,.webp">
    </div>`;
  }

  function deskAi() {
    const err = ui.aiError;
    return `<p>${esc(t('aiLead'))}</p>
    <div class="adimlar">
      <div class="adim"><div class="adim-bas"><span class="adim-no">01</span><h3>${esc(t('aiStep1'))}</h3></div>${providerFields()}</div>
      <div class="adim"><div class="adim-bas"><span class="adim-no">02</span><h3>${esc(t('aiStep2'))}</h3></div>
        ${dropzone('aiDrop', t('dropHintAi'))}
        <div class="eylem-satir" style="margin:10px 0 6px"><span class="etiket">${esc(t('samples'))}</span>
          <button class="bag" data-ornek="1">${esc(t('sample1'))}</button><button class="bag" data-ornek="2">${esc(t('sample2'))}</button><button class="bag" data-ornek="3">${esc(t('sample3'))}</button></div>
        <label class="sr" for="aiMetin">${esc(t('quoteText'))}</label>
        <textarea class="alan" id="aiMetin" rows="7" placeholder="${esc(t('quotePh'))}">${esc(ui.aiText || '')}</textarea>
      </div>
      ${err ? `<ul class="uyari-liste"><li class="hata">${esc(err)}</li></ul>
        <div class="eylem-satir"><button class="btn btn-kucuk" data-eylem="tahmin">${esc(t('tryOffline'))}</button><button class="btn btn-kucuk" data-eylem="kopruyeGec">${esc(t('goBridge'))}</button></div>` : ''}
      <div class="eylem-satir">
        <button class="btn btn-dolu" id="aiOku" ${ui.busy ? 'disabled' : ''}>${esc(ui.busy ? t('reading') : t('aiRead'))}</button>
        ${ui.busy ? `<button class="btn" data-eylem="iptal">${esc(t('cancel'))}</button>` : `<button class="bag" data-eylem="tahmin">${esc(t('offlineRead'))}</button>`}
      </div>
    </div>`;
  }

  function deskBridge() {
    return `<p>${esc(t('bridgeLead'))}</p>
    <div class="adimlar">
      <div class="adim"><div class="adim-bas"><span class="adim-no">01</span><h3>${esc(t('bridgeStep1'))}</h3></div>
        ${dropzone('koprDrop', t('dropHintBridge'))}
        <div class="eylem-satir" style="margin:10px 0 6px"><span class="etiket">${esc(t('samples'))}</span>
          <button class="bag" data-ornek-k="1">${esc(t('sample1'))}</button><button class="bag" data-ornek-k="2">${esc(t('sample2'))}</button><button class="bag" data-ornek-k="3">${esc(t('sample3'))}</button></div>
        <label class="sr" for="kopruMetin">${esc(t('quoteText'))}</label>
        <textarea class="alan" id="kopruMetin" rows="6" placeholder="${esc(t('quotePh'))}">${esc(ui.bridgeText || '')}</textarea>
        <div class="eylem-satir" style="margin-top:10px"><button class="btn btn-dolu" data-eylem="komutKopyala">${esc(t('copyPrompt'))}</button><button class="bag" data-eylem="tahminKopru">${esc(t('offlineRead'))}</button></div>
        <details style="margin-top:8px"><summary class="bag" style="cursor:pointer;display:inline">${esc(t('showPrompt'))}</summary><pre class="mektup" id="komutOnizleme" style="font-family:var(--font-rakam);font-size:11px;max-height:220px;overflow:auto"></pre></details>
      </div>
      <div class="adim"><div class="adim-bas"><span class="adim-no">02</span><h3>${esc(t('bridgeStep2'))}</h3></div>
        <label class="sr" for="kopruCevap">${esc(t('bridgeAnswer'))}</label>
        <textarea class="alan" id="kopruCevap" rows="7" placeholder='${esc(t('bridgeAnswerPh'))}'></textarea>
        <div class="eylem-satir" style="margin-top:10px"><button class="btn btn-dolu" data-eylem="kopruAl">${esc(t('bridgeImport'))}</button></div>
      </div>
    </div>`;
  }

  // Mode 3: no AI, no internet needed. Fill the form by hand, or round-trip the Excel template.
  function deskManual() {
    return `<p>${esc(t('manualLead'))}</p>
    <div class="adimlar">
      <div class="adim"><div class="adim-bas"><span class="adim-no">A</span><h3>${esc(t('manualFormTitle'))}</h3></div>
        <p class="aciklama">${esc(t('manualFormText'))}</p>
        <div class="eylem-satir" style="margin-top:10px"><button class="btn btn-dolu" data-eylem="formAc">${esc(t('manualFormBtn'))}</button></div>
      </div>
      <div class="adim"><div class="adim-bas"><span class="adim-no">B</span><h3>${esc(t('excelTitle'))}</h3></div>
        <p class="aciklama">${esc(t('excelStep1Text'))}</p>
        <div class="eylem-satir" style="margin:10px 0"><button class="btn" data-eylem="sablonIndir">${esc(t('outTemplate'))}</button></div>
        ${dropzone('excelDrop', t('dropHintExcel'))}
      </div>
    </div>`;
  }

  /* ---------- files into the desk ---------- */

  function wireDropzones() {
    document.querySelectorAll('#masaGovde .surukle').forEach(zone => {
      const input = zone.querySelector('input[type="file"]');
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('uzerinde'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('uzerinde'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('uzerinde'); if (e.dataTransfer.files[0]) handleFile(zone.id, e.dataTransfer.files[0]); });
      input.addEventListener('change', () => { if (input.files[0]) handleFile(zone.id, input.files[0]); input.value = ''; });
    });
    const prev = $('komutOnizleme');
    if (prev) prev.textContent = P.buildPrompt(state.items, ($('kopruMetin') || {}).value || '');
  }

  async function handleFile(zoneId, file) {
    const info = $(zoneId + 'Bilgi');
    info.textContent = t('fileReading', { n: file.name });
    let res;
    try { res = await F.readFile(file); } catch (e) {
      info.textContent = '';
      toast(e.message === 'FILE_TOO_BIG' ? t('fileTooBig') : e.message === 'LIB_LOAD' ? t('libLoad') : t('fileFail'), true);
      return;
    }
    if (res.kind === 'sheet' && F.isTemplate(res.rows)) {
      const raw = F.parseTemplate(res.rows, state.items);
      const n = P.normalizeQuote(raw, state.items, { source: 'excel', fallbackName: file.name });
      startDraft(n.supplier, 'excel', null, n);
      return;
    }
    if (zoneId === 'excelDrop') {
      ui.tab = 'kopru';
      ui.bridgeText = res.text;
      renderDesk();
      toast(t('notTemplate'));
      return;
    }
    const target = zoneId === 'aiDrop' ? 'aiMetin' : 'kopruMetin';
    if (res.text) $(target).value = res.text;
    if (zoneId === 'aiDrop') { ui.aiText = res.text; ui.pendingAttachment = res.attachment || null; }
    else { ui.bridgeText = res.text; }
    const what = res.kind === 'image' ? t('fileImage') : res.kind === 'pdf' && !res.text ? t('filePdfScan') : t('fileTextOk', { c: num(res.text.length) });
    info.textContent = file.name + ' · ' + what;
    if (zoneId === 'koprDrop' && res.kind === 'image') toast(t('bridgeImage'));
    const prev = $('komutOnizleme');
    if (prev && zoneId === 'koprDrop') prev.textContent = P.buildPrompt(state.items, res.text);
  }

  function readAiFields() {
    const prov = $('aiProvider');
    if (!prov) return;
    ai.provider = prov.value;
    ai.model = $('aiModel').value.trim();
    ai.url = $('aiUrl') ? $('aiUrl').value.trim() : ai.url;
    ai.key = $('aiKey').value.trim();
    ai.remember = $('aiRemember').checked;
    saveAi();
  }

  function aiErrorText(e) {
    const code = e && e.code ? e.code : 'UNKNOWN';
    const key = 'aiErr_' + (code.startsWith('HTTP_') ? 'HTTP' : code);
    return t(key, { code, detail: e && e.detail ? String(e.detail).slice(0, 160) : '' });
  }

  async function runAi() {
    readAiFields();
    const text = ($('aiMetin').value || '').trim();
    ui.aiText = text;
    if (!text && !ui.pendingAttachment) { toast(t('needText'), true); return; }
    if (!AI.configured(ai)) { ui.aiError = t('aiErr_NOT_CONFIGURED'); renderDesk(); return; }
    ui.busy = true; ui.aiError = null;
    ui.abort = new AbortController();
    renderDesk();
    try {
      const raw = await AI.readQuote(ai, state.items, text, ui.pendingAttachment, ui.abort.signal);
      const n = P.normalizeQuote(raw, state.items, { source: 'ai' });
      ui.busy = false;
      ui.pendingAttachment = null;
      startDraft(n.supplier, 'ai', null, n);
    } catch (e) {
      ui.busy = false;
      ui.aiError = e.code === 'ABORTED' ? null : aiErrorText(e);
      renderDesk();
    }
  }

  function runOffline(text) {
    if (!text || !text.trim()) { toast(t('needText'), true); return; }
    const raw = P.heuristicRead(text, state.items);
    const n = P.normalizeQuote(raw, state.items, { source: 'heuristic' });
    n.warnings.unshift({ code: 'GUESS' });
    startDraft(n.supplier, 'heuristic', null, n);
  }

  function importBridge() {
    const txt = ($('kopruCevap').value || '').trim();
    if (!txt) { toast(t('bridgeEmpty'), true); return; }
    let obj;
    try { obj = P.extractJson(txt); } catch (e) { toast(t('bridgeBadJson'), true); return; }
    const n = P.normalizeQuote(obj, state.items, { source: 'bridge' });
    startDraft(n.supplier, 'bridge', null, n);
  }

  /* ---------- review sheet ---------- */

  function blankSupplier() {
    const lines = {};
    state.items.forEach(i => { lines[i.id] = { price: null, unit: i.unit, factor: null }; });
    return { id: 'sup_' + Date.now().toString(36), name: '', currency: 'TRY', delivery: 'site_stacked', transportTRY: 0, craneTRY: 0, wastePct: 0, vatIncluded: false, plan: E.planFromPreset('30_60_90'), lines, source: 'manual' };
  }

  function startDraft(sup, source, editId, notes) {
    ui.draft = JSON.parse(JSON.stringify(sup));
    ui.draft.plan = (ui.draft.plan || []).map(p => ({ pct: Math.round(p.pct * 1e4) / 1e4, days: p.days }));
    state.items.forEach(i => { if (!ui.draft.lines[i.id]) ui.draft.lines[i.id] = { price: null, unit: i.unit, factor: null }; });
    ui.draftSource = source;
    ui.draftEditId = editId;
    ui.draftNotes = notes || { warnings: [], errors: [] };
    renderDesk();
    const body = $('masaGovde');
    body.scrollTop = 0;
    const first = body.querySelector('input');
    if (first) first.focus({ preventScroll: true });
  }

  function noteText(n) {
    const item = n.item ? itemName(n.item) : '';
    return t('note_' + n.code, { item, unit: n.unit || '', sum: n.sum !== undefined ? pct(n.sum) : '', count: n.count || '' });
  }

  function sourceBadge(src) {
    const cls = src === 'heuristic' ? 'kaynak kaynak-tahmin' : (src === 'ai' ? 'kaynak kaynak-ai' : 'kaynak');
    return `<span class="${cls}">${esc(t('src_' + src))}</span>`;
  }

  function conversionHint(item, line) {
    if (!(Number(line.price) > 0)) return '';
    const f = Number(line.factor) > 0 ? Number(line.factor) : E.conversionFactor(item, line.unit);
    if (!(f > 0)) return '';
    if (Math.abs(f - 1) < 1e-12) return '';
    return '1 ' + line.unit + ' = ' + num(f, f < 0.1 ? 5 : 3) + ' ' + item.unit;
  }

  function renderReview() {
    const d = ui.draft;
    const body = $('masaGovde');
    const presetOpts = ['cash', '30_60_90', 'adv30_60', 'adv20_45_90', 'single_45', 'single_60', 'single_90', 'single_120'];
    const tonnage = state.items.filter(i => E.unitKey(i.unit) === 'ton').reduce((a, i) => a + (Number(i.qty) || 0), 0);
    body.innerHTML = `<div class="foy">
      <div class="foy-bas"><h3>${esc(ui.draftEditId ? t('reviewEdit') : t('reviewTitle'))}</h3>${sourceBadge(ui.draftSource)}</div>
      <div class="foy-govde">
        ${ui.draftSource === 'heuristic' ? `<p class="aciklama kirmizi-kalem">${esc(t('guessBanner'))}</p>` : ''}
        <label class="alan-grup"><span class="etiket">${esc(t('fSupplier'))}</span><input class="alan" data-f="name" value="${esc(d.name)}" placeholder="${esc(t('fSupplierPh'))}"></label>
        <div class="izgara-3">
          <label class="alan-grup"><span class="etiket">${esc(t('fCurrency'))}</span><select class="alan" data-f="currency">${['TRY', 'EUR', 'USD'].map(c => `<option ${d.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="alan-grup"><span class="etiket">${esc(t('fDelivery'))}</span><select class="alan" data-f="delivery">${P.DELIVERY.map(c => `<option value="${c}" ${d.delivery === c ? 'selected' : ''}>${esc(deliveryLabel(c))}</option>`).join('')}</select></label>
          <div class="alan-grup"><span class="etiket">${esc(t('fVat'))}</span>
            <div style="display:flex;gap:10px;align-items:center;min-height:32px"><label class="onay-kutu"><input type="checkbox" data-f="vatIncluded" ${d.vatIncluded ? 'checked' : ''}>${esc(t('fVatIncl'))}</label>
            <input class="alan" type="number" min="0" max="50" step="1" data-f="vatRate" value="${esc(d.vatRate ?? state.macro.vatRate)}" style="width:56px" aria-label="${esc(t('pVat'))}"></div></div>
        </div>
        <div class="izgara-3">
          <label class="alan-grup"><span class="etiket">${esc(t('fFreight'))}</span><input class="alan" type="number" min="0" step="100" data-f="transportTRY" value="${esc(d.transportTRY)}"></label>
          <label class="alan-grup"><span class="etiket">${esc(t('fCrane'))}</span><input class="alan" type="number" min="0" step="100" data-f="craneTRY" value="${esc(d.craneTRY)}"></label>
          <label class="alan-grup"><span class="etiket">${esc(t('fWaste'))}</span><input class="alan" type="number" min="0" max="50" step="0.1" data-f="wastePct" value="${esc(d.wastePct)}"></label>
        </div>
        <details id="lojistikHesap"><summary class="bag" style="cursor:pointer;display:inline">${esc(t('logCalc'))}</summary>
          <div class="hesap-kutu" style="margin-top:8px">
            <p class="aciklama">${esc(t('logCalcText'))}</p>
            <div class="izgara-3">
              <label class="alan-grup"><span class="etiket">${esc(t('logTon'))}</span><input class="alan" type="number" id="lgTon" value="${tonnage || ''}"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logKm'))}</span><input class="alan" type="number" id="lgKm" value="250"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logCraneH'))}</span><input class="alan" type="number" id="lgVs" value="${d.delivery === 'site_stacked' ? 0 : 4}"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logCap'))}</span><input class="alan" type="number" id="lgCap" value="25"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logBase'))}</span><input class="alan" type="number" id="lgBase" value="6000"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logPerKm'))}</span><input class="alan" type="number" id="lgKmTl" value="45"></label>
              <label class="alan-grup"><span class="etiket">${esc(t('logCraneRate'))}</span><input class="alan" type="number" id="lgVsTl" value="4500"></label>
            </div>
            <div class="eylem-satir"><span class="dosya-bilgi" id="lgSonuc"></span><button class="btn btn-kucuk" data-eylem="lojistikUygula">${esc(t('apply'))}</button></div>
          </div>
        </details>
        <div>
          <div class="izgara-2" style="align-items:end">
            <label class="alan-grup"><span class="etiket">${esc(t('fPlan'))}</span><select class="alan" id="planOn"><option value="">${esc(t('planCustom'))}</option>${presetOpts.map(k => `<option value="${k}">${esc(planLabel(E.planFromPreset(k)))}</option>`).join('')}</select></label>
            <div class="plan-toplam rakam" id="planToplam"></div>
          </div>
          <div id="planSatirlar" style="margin-top:6px"></div>
          <button class="bag" data-eylem="taksitEkle" style="margin-top:6px">${esc(t('addTranche'))}</button>
        </div>
        <div style="overflow-x:auto">
          <table class="foy-kalem"><thead><tr><th>${esc(t('colItem'))}</th><th>${esc(t('fPrice', { c: d.currency }))}</th><th>${esc(t('fUnit'))}</th><th>${esc(t('fConv'))}</th></tr></thead>
          <tbody id="foyKalemler"></tbody></table>
        </div>
        <ul class="uyari-liste" id="foyNotlar"></ul>
      </div>
      <div class="foy-alt">
        <button class="btn" data-eylem="foyVazgec">${esc(t('cancel'))}</button>
        <button class="btn btn-dolu" id="foyKaydet">${esc(ui.draftEditId ? t('reviewSaveEdit') : t('reviewSave'))}</button>
      </div>
    </div>`;
    renderPlanRows();
    renderReviewLines();
    refreshReview();
  }

  function renderPlanRows() {
    const box = $('planSatirlar');
    box.innerHTML = ui.draft.plan.map((p, i) => `<div class="plan-satir">
      <label class="alan-grup"><span class="etiket">${esc(t('fPct'))}</span><input class="alan" type="number" min="0" max="100" step="any" data-plan="${i}" data-pa="pct" value="${esc(p.pct)}"></label>
      <label class="alan-grup"><span class="etiket">${esc(t('fDays'))}</span><input class="alan" type="number" min="0" step="1" data-plan="${i}" data-pa="days" value="${esc(p.days)}"></label>
      <button class="bag bag-kirmizi" data-eylem="taksitSil" data-i="${i}" ${ui.draft.plan.length < 2 ? 'disabled' : ''}>${esc(t('remove'))}</button>
    </div>`).join('');
  }

  function renderReviewLines() {
    $('foyKalemler').innerHTML = state.items.map(item => {
      const l = ui.draft.lines[item.id];
      const auto = E.conversionFactor(item, l.unit);
      const needsFactor = Number(l.price) > 0 && !(auto > 0);
      return `<tr data-satir="${esc(item.id)}" class="${Number(l.price) > 0 ? '' : 'eksik-satir'}">
        <td>${esc(item.name)}<span class="dosya-bilgi" style="display:block">${num(item.qty, item.qty % 1 ? 2 : 0)} ${esc(item.unit)}</span></td>
        <td><input class="alan" type="number" min="0" step="any" data-satir-f="price" data-id="${esc(item.id)}" value="${l.price === null ? '' : esc(l.price)}" placeholder="${esc(t('noOffer'))}" aria-label="${esc(t('fPriceFor', { n: item.name }))}"></td>
        <td><input class="alan" list="birimler2" data-satir-f="unit" data-id="${esc(item.id)}" value="${esc(l.unit || item.unit)}" style="width:76px" aria-label="${esc(t('fUnit'))}"></td>
        <td>${needsFactor || Number(l.factor) > 0
          ? `<input class="alan ${needsFactor && !(Number(l.factor) > 0) ? 'hatali' : ''}" type="number" min="0" step="any" data-satir-f="factor" data-id="${esc(item.id)}" value="${esc(l.factor || '')}" placeholder="${esc(t('factorPh', { u: l.unit, b: item.unit }))}" style="width:110px" aria-label="${esc(t('fConv'))}">`
          : `<span class="donusum">${esc(conversionHint(item, l))}</span>`}</td>
      </tr>`;
    }).join('') + `<datalist id="birimler2">${['Ton', 'kg', 'm', 'Boy', 'm²', 'm³', 'Adet', 'Set', 'Lt', 'Torba'].map(u => `<option value="${u}">`).join('')}</datalist>`;
  }

  function refreshReview() {
    const d = ui.draft;
    const v = P.validateSupplier(d, state.items);
    const sum = E.planSum(d.plan);
    const tot = $('planToplam');
    tot.textContent = t('planTotal', { s: pct(sum) });
    tot.classList.toggle('hatali', Math.abs(sum - 100) > 0.01);
    const firstNotes = (ui.draftNotes.warnings || []).filter(n => !['PRICE_MISSING', 'UNIT_UNKNOWN', 'PLAN_SUM', 'NAME_MISSING'].includes(n.code));
    const notes = [
      ...v.errors.map(n => ({ ...n, err: true })),
      ...firstNotes,
      ...v.warnings
    ];
    $('foyNotlar').innerHTML = notes.map(n => `<li class="${n.err ? 'hata' : ''}">${esc(noteText(n))}</li>`).join('');
    $('foyKaydet').disabled = v.errors.length > 0;
    document.querySelectorAll('#foyKalemler tr').forEach(tr => {
      const l = d.lines[tr.dataset.satir];
      tr.classList.toggle('eksik-satir', !(Number(l.price) > 0));
    });
    const name = document.querySelector('[data-f="name"]');
    if (name) name.classList.toggle('hatali', !String(d.name || '').trim());
  }

  function saveDraft() {
    const d = ui.draft;
    const v = P.validateSupplier(d, state.items);
    if (v.errors.length) { refreshReview(); return; }
    const sup = {
      ...d,
      name: d.name.trim(),
      transportTRY: Number(d.transportTRY) || 0,
      craneTRY: Number(d.craneTRY) || 0,
      wastePct: Number(d.wastePct) || 0,
      vatRate: d.vatIncluded ? Number(d.vatRate ?? state.macro.vatRate) : undefined,
      plan: d.plan.map(p => ({ pct: Number(p.pct), days: Number(p.days) })),
      source: ui.draftSource === 'heuristic' ? 'heuristic' : ui.draftSource,
      edited: true
    };
    if (ui.draftEditId) {
      const i = supplierIndex(ui.draftEditId);
      if (i >= 0) state.suppliers[i] = { ...sup, id: ui.draftEditId, source: state.suppliers[i].source === 'heuristic' ? 'manual' : state.suppliers[i].source };
    } else {
      sup.id = 'sup_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      state.suppliers.push(sup);
    }
    const name = sup.name;
    const wasEdit = !!ui.draftEditId;
    ui.draft = null; ui.draftEditId = null; ui.aiText = ''; ui.bridgeText = '';
    if (state.demo && !wasEdit) state.demo = state.suppliers.every(s => s.source === 'demo');
    renderDesk();
    render();
    toast(wasEdit ? t('toastUpdated', { n: name }) : t('toastAdded', { n: name }));
    const leaf = document.getElementById('yaprak-' + (wasEdit ? sup.id : state.suppliers[state.suppliers.length - 1].id));
    if (leaf) { leaf.scrollIntoView({ behavior: 'smooth', block: 'center' }); leaf.classList.add('secili'); setTimeout(() => leaf.classList.remove('secili'), 1800); }
  }

  /* ---------- print documents ---------- */

  function printDoc(html) {
    $('baski').innerHTML = html;
    window.print();
  }

  function approvalHtml() {
    const r = result, L = r.leader, today = new Date().toLocaleDateString(locale());
    const sp = r.split;
    const rows = [...r.byPv, ...r.evals.filter(e => !e.complete)].map(e => `<tr><td>${e.complete ? r.byPv.indexOf(e) + 1 : '–'}</td><td>${esc(e.name)}</td><td>${esc(e.currency)}</td><td>${esc(planLabel(supById(e.id).plan))}</td><td class="sag">${num(Math.round(e.paper))}</td><td class="sag">${num(Math.round(e.landed))}</td><td class="sag">${num(Math.round(e.pv))}</td><td class="sag">${e.complete && L ? num(Math.round(e.pv - L.pv)) : esc(t('incompleteShort'))}</td></tr>`).join('');
    const splitHtml = sp && sp.suppliers.length > 1 && r.splitSaving > 1
      ? `<p>${esc(t('printSplit', { n: sp.suppliers.length, v: tl(sp.total), s: tl(r.splitSaving) }))}</p><table><tr><th>${esc(t('colItem'))}</th><th>${esc(t('colSupplier'))}</th></tr>${state.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(evById(sp.assign[i.id]).name)}</td></tr>`).join('')}</table>` : '';
    return `<h1>${esc(t('printApprovalTitle'))}</h1>
      <p><b>${esc(t('package'))}:</b> ${esc(state.code)} · ${esc(state.title)}<br><b>${esc(t('date'))}:</b> ${esc(today)}</p>
      <p class="kucuk">${esc(t('printParams', { r: pct(state.macro.monthlyRate), e: num(state.macro.spotEUR, 2), eg: pct(state.macro.growthEUR), u: num(state.macro.spotUSD, 2), ug: pct(state.macro.growthUSD) }))}</p>
      <h2>${esc(t('printTable'))}</h2>
      <table><tr><th>#</th><th>${esc(t('colSupplier'))}</th><th>${esc(t('fCurrency'))}</th><th>${esc(t('fPlan'))}</th><th class="sag">${esc(t('rowPaper'))}</th><th class="sag">${esc(t('rowLanded'))}</th><th class="sag">${esc(t('rowPv'))}</th><th class="sag">${esc(t('vsLeader'))}</th></tr>${rows}</table>
      <h2>${esc(t('printDecision'))}</h2>
      <p>${L ? esc(t('printRecommend', { n: L.name, v: tl(L.pv) })) : esc(t('emptyTitle'))}</p>
      ${r.paperLeader && L && r.paperLeader.id !== L.id ? `<p>${esc(t('printIllusion', { n: r.paperLeader.name, v: tl(r.paperLeader.pv - L.pv) }))}</p>` : ''}
      ${splitHtml}
      <p class="kucuk">${esc(t('assumptions'))}${state.demo ? ' ' + esc(t('demoNote')) : ''}</p>
      <div class="imzalar"><div>${esc(t('signPrepared'))}</div><div>${esc(t('signPurchasing'))}</div><div>${esc(t('signPm'))}</div><div>${esc(t('signApprove'))}</div></div>`;
  }

  function orderHtml() {
    const L = result.leader;
    const sup = supById(L.id);
    const today = new Date().toLocaleDateString(locale());
    const rows = state.items.map(i => { const l = L.lines[i.id]; return `<tr><td>${esc(i.name)}</td><td class="sag">${num(i.qty, i.qty % 1 ? 2 : 0)} ${esc(i.unit)}</td><td class="sag">${esc(unitPrice(l.quotedPrice, L.currency))} / ${esc(l.quotedUnit)}</td></tr>`; }).join('');
    return `<p style="text-align:right">${esc(today)}</p>
      <p><b>${esc(t('orderTo'))}:</b> ${esc(L.name)}</p>
      <p><b>${esc(t('orderSubject'))}:</b> ${esc(state.code)} · ${esc(state.title)}</p>
      <p>${esc(t('orderBody', { title: state.title }))}</p>
      <table><tr><th>${esc(t('colItem'))}</th><th class="sag">${esc(t('qty'))}</th><th class="sag">${esc(t('orderUnitPrice'))}</th></tr>${rows}</table>
      <p style="margin-top:4mm"><b>${esc(t('fPlan'))}:</b> ${esc(planLabel(sup.plan))} · <b>${esc(t('fDelivery'))}:</b> ${esc(deliveryLabel(sup.delivery))} · ${esc(sup.vatIncluded ? t('vatIncl') : t('vatExcl'))}</p>
      <p>${esc(t('orderClose'))}</p>
      <div class="imzalar"><div>${esc(t('signPurchasing'))}</div><div>${esc(t('signPm'))}</div><div></div><div></div></div>`;
  }

  function exportLabels() {
    return { package: t('package'), rate: t('pRate'), growth: t('pGrowth'), item: t('colItem'), qty: t('qty'), unit: t('unit'), noOffer: t('noOffer'), paper: t('rowPaper'), vat: t('rowVat'), waste: t('rowWaste'), logistics: t('rowLogistics'), landed: t('rowLanded'), time: t('rowTime'), pv: t('rowPv'), status: t('status'), leader: t('stampLeader'), incomplete: t('stampIncomplete') };
  }

  async function doOutput(kind) {
    const base = (state.code || 'RFQ').replace(/[^\w-]+/g, '_');
    try {
      if (kind === 'onay') return printDoc(approvalHtml());
      if (kind === 'siparis') return printDoc(orderHtml());
      if (kind === 'csv') return F.saveBlob(new Blob([M.toCsv(M.sheetRows(state, result, exportLabels()))], { type: 'text/csv;charset=utf-8' }), base + (ui.lang === 'en' ? '_comparison.csv' : '_mukayese.csv'));
      if (kind === 'xlsx') { await F.downloadXlsx(M.sheetRows(state, result, exportLabels()), base + (ui.lang === 'en' ? '_comparison.xlsx' : '_mukayese.xlsx'), ui.lang === 'en' ? 'Comparison' : 'Mukayese'); return; }
      if (kind === 'json') return F.saveBlob(new Blob([JSON.stringify(M.workflowJson(state, result), null, 2)], { type: 'application/json' }), base + '_decision.json');
      if (kind === 'sablon') { const how = await F.downloadTemplate(state, ui.lang); if (how === 'csv') toast(t('templateCsv')); return; }
      if (kind === 'kaydet') return F.saveBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), base + '_project.json');
      if (kind === 'ac') return $('projeDosya').click();
    } catch (e) {
      toast(e.message === 'LIB_LOAD' ? t('libLoad') : t('exportFail'), true);
    }
  }

  /* ---------- AI letter polish ---------- */

  async function polishLetter(id, kind, btn) {
    if (!AI.configured(ai)) { openDesk('ai'); toast(t('aiNeedSetup')); return; }
    const block = document.querySelector(`[data-mektup="${CSS.escape(id)}"]`);
    if (!block) return;
    const facts = t('letterFacts', { text: block.textContent, lang: ui.lang === 'en' ? 'English' : 'Turkish' });
    btn.disabled = true;
    btn.textContent = t('reading');
    try {
      const txt = await AI.writeLetter(ai, t('letterSystem'), facts);
      block.textContent = txt.trim();
      block.classList.add('yenilendi');
    } catch (e) {
      toast(aiErrorText(e), true);
    } finally {
      btn.disabled = false;
      btn.textContent = t('aiPolish');
    }
  }

  /* ======================================================================
   * Events
   * ==================================================================== */

  function setMacro(key, raw) {
    const v = parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(v)) return;
    state.macro[key] = v;
    render();
  }

  function wire() {
    document.querySelectorAll('.dil button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.lang === ui.lang) return;
      ui.lang = b.dataset.lang;
      const preset = state.scenarioId && SC.find(s => s.id === state.scenarioId);
      if (preset) state = M.relabel(state, preset, ui.lang);
      applyStatic();
      render();
      renderDesk();
    }));

    $('projeAd').addEventListener('input', e => { state.title = e.target.value; state.titleEdited = true; save(); });
    $('projeAd').addEventListener('change', () => render());

    const bind = (id, key) => {
      $(id).addEventListener('change', e => setMacro(key, e.target.value));
      $(id).addEventListener('keydown', e => { if (e.key === 'Enter') setMacro(key, e.target.value); });
    };
    bind('pRate', 'monthlyRate'); bind('pEur', 'spotEUR'); bind('pEurG', 'growthEUR'); bind('pUsd', 'spotUSD'); bind('pUsdG', 'growthUSD'); bind('pVat', 'vatRate');
    $('pRateR').addEventListener('input', e => setMacro('monthlyRate', e.target.value));

    document.querySelectorAll('#gorunum button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.gorunum; render(); }));
    $('kalemDuzenBtn').addEventListener('click', () => { ui.editItems = !ui.editItems; renderLedger(); });

    $('teklifBtn').addEventListener('click', () => openDesk());
    $('paketBtn').addEventListener('click', () => toggleDock());
    $('dokKapat').addEventListener('click', () => { toggleDock(false); $('paketBtn').focus(); });
    $('paketDok').addEventListener('click', e => {
      const k = e.target.closest('[data-kat]');
      if (k) { ui.cat = k.dataset.kat; renderDock(); return; }
      const b = e.target.closest('[data-paket]');
      if (b) switchPackage(b.dataset.paket);
    });
    $('dokAra').addEventListener('input', e => { ui.q = e.target.value; renderDock(); });

    // drawn steppers on the MICR band
    document.querySelectorAll('.micr input[type="number"]').forEach(inp => {
      const box = document.createElement('span');
      box.className = 'adim-kutu';
      inp.parentNode.insertBefore(box, inp);
      const mk = (sign, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'adim-btn';
        b.textContent = sign > 0 ? '+' : '−';
        b.setAttribute('aria-label', label + ' ' + (inp.labels[0] ? inp.labels[0].textContent : ''));
        b.addEventListener('click', () => {
          const step = Number(inp.step) || 1;
          const v = Math.round(((Number(inp.value) || 0) + sign * step) * 1e4) / 1e4;
          const min = inp.min === '' ? -Infinity : Number(inp.min);
          const max = inp.max === '' ? Infinity : Number(inp.max);
          inp.value = Math.min(max, Math.max(min, v));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return b;
      };
      box.append(mk(-1, t('stepDown')), inp, mk(1, t('stepUp')));
    });

    $('projeDosya').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (userWork() && !window.confirm(t('confirmReplace'))) return;
        state = M.importProject(obj);
        ui.lastLeader = null;
        render();
        toast(t('toastOpened', { n: state.title }));
      } catch (err) { toast(t('openFail'), true); }
    });

    // main area actions
    document.querySelector('.ana').addEventListener('click', e => {
      const b = e.target.closest('[data-eylem], [data-cikti]');
      if (!b) return;
      if (b.dataset.cikti) { doOutput(b.dataset.cikti); return; }
      const id = b.dataset.id;
      switch (b.dataset.eylem) {
        case 'teklif': openDesk(); break;
        case 'paketler': if (dockIsDrawer()) toggleDock(true); else $('dokAra').focus(); break;
        case 'duzenle': {
          const sup = supById(id);
          if (ui.draft && !window.confirm(t('confirmDiscard'))) return;
          startDraft(sup, sup.source === 'demo' ? 'manual' : sup.source, id, { warnings: [], errors: [] });
          openDesk();
          break;
        }
        case 'kopyala': {
          const sup = JSON.parse(JSON.stringify(supById(id)));
          sup.id = 'sup_' + Date.now().toString(36);
          sup.name = sup.name + ' ' + t('copySuffix');
          sup.source = 'manual';
          if (ui.draft && !window.confirm(t('confirmDiscard'))) return;
          startDraft(sup, 'manual', null, { warnings: [], errors: [] });
          openDesk();
          break;
        }
        case 'sil': {
          const sup = supById(id);
          if (!window.confirm(t('confirmRemove', { n: sup.name }))) return;
          state.suppliers = state.suppliers.filter(s => s.id !== id);
          render();
          toast(t('toastRemoved', { n: sup.name }));
          break;
        }
        case 'kalemSil': {
          if (state.items.length <= 1) { toast(t('lastItem'), true); return; }
          state.items = state.items.filter(i => i.id !== id);
          state.suppliers.forEach(s => { delete s.lines[id]; });
          render();
          break;
        }
        case 'kalemEkle': {
          const nid = 'item_' + Date.now().toString(36);
          state.items.push({ id: nid, name: t('newItem', { n: state.items.length + 1 }), qty: 1, unit: state.items[0] ? state.items[0].unit : 'Adet', edited: true });
          state.suppliers.forEach(s => { s.lines[nid] = { price: null, unit: state.items[state.items.length - 1].unit, factor: null }; });
          render();
          const inp = document.querySelector(`[data-kalem="${nid}"][data-alan="name"]`);
          if (inp) { inp.focus(); inp.select(); }
          break;
        }
        case 'mektupKopyala': {
          const q = document.querySelector(`[data-mektup="${CSS.escape(id)}"]`);
          copyText(q ? q.textContent : '').then(ok => toast(ok ? t('copied') : t('copyFail'), !ok));
          break;
        }
        case 'mektupAi': polishLetter(id, b.dataset.tur, b); break;
        default: break;
      }
    });

    $('cetvelIc').addEventListener('change', e => {
      const inp = e.target.closest('[data-kalem]');
      if (!inp) return;
      const item = state.items.find(i => i.id === inp.dataset.kalem);
      if (!item) return;
      const f = inp.dataset.alan;
      if (f === 'qty') item.qty = Math.max(0, Number(inp.value) || 0);
      else if (f === 'diameter') {
        const dmm = Number(inp.value);
        if (dmm > 0) { item.diameter = dmm; item.kgPerM = E.rebarKgPerM(dmm); } else { delete item.diameter; delete item.kgPerM; }
      } else item[f] = inp.value;
      item.edited = true;
      render();
    });

    // tooltips
    document.addEventListener('mouseover', e => { const el = e.target.closest('[data-ipucu]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.ipucu, r.left + r.width / 2, r.top); } });
    document.addEventListener('mouseout', e => { if (e.target.closest('[data-ipucu]')) hideTip(); });
    document.addEventListener('focusin', e => { const el = e.target.closest('[data-ipucu]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.ipucu, r.left + r.width / 2, r.bottom); } });
    document.addEventListener('focusout', e => { if (e.target.closest('[data-ipucu]')) hideTip(); });

    // desk
    $('masaPerde').addEventListener('click', () => toggleDock(false));
    $('sekmeler').addEventListener('click', e => {
      const b = e.target.closest('[data-sekme]');
      if (!b) return;
      if (ui.draft && !window.confirm(t('confirmDiscard'))) return;
      ui.draft = null;
      ui.tab = b.dataset.sekme;
      ui.aiError = null;
      renderDesk();
    });
    $('sekmeler').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = [...$('sekmeler').querySelectorAll('[role="tab"]')];
      const i = tabs.indexOf(document.activeElement);
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); n.click();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('paketDok').classList.contains('acik')) { toggleDock(false); $('paketBtn').focus(); }
      }
    });

    const govde = $('masaGovde');
    govde.addEventListener('click', e => {
      const b = e.target.closest('button, [data-ornek], [data-ornek-k]');
      if (!b) return;
      if (b.id === 'aiOku') { runAi(); return; }
      if (b.id === 'foyKaydet') { saveDraft(); return; }
      if (b.dataset.ornek) { $('aiMetin').value = sampleText(Number(b.dataset.ornek)); ui.aiText = $('aiMetin').value; ui.pendingAttachment = null; return; }
      if (b.dataset.ornekK) { $('kopruMetin').value = sampleText(Number(b.dataset.ornekK)); ui.bridgeText = $('kopruMetin').value; $('komutOnizleme').textContent = P.buildPrompt(state.items, ui.bridgeText); return; }
      switch (b.dataset.eylem) {
        case 'iptal': if (ui.abort) ui.abort.abort(); break;
        case 'tahmin': runOffline(($('aiMetin') || {}).value || ui.aiText); break;
        case 'tahminKopru': runOffline(($('kopruMetin') || {}).value); break;
        case 'kopruyeGec': ui.bridgeText = ($('aiMetin') || {}).value || ''; ui.tab = 'kopru'; ui.aiError = null; renderDesk(); break;
        case 'komutKopyala': {
          const txt = P.buildPrompt(state.items, $('kopruMetin').value);
          copyText(txt).then(ok => toast(ok ? t('promptCopied') : t('copyFail'), !ok));
          break;
        }
        case 'kopruAl': importBridge(); break;
        case 'sablonIndir': doOutput('sablon'); break;
        case 'foyVazgec': ui.draft = null; ui.draftEditId = null; renderDesk(); break;
        case 'formAc': startDraft(blankSupplier(), 'manual', null, { warnings: [], errors: [] }); break;
        case 'taksitEkle': ui.draft.plan.push({ pct: Math.max(0, Math.round((100 - E.planSum(ui.draft.plan)) * 100) / 100), days: 30 }); renderPlanRows(); refreshReview(); break;
        case 'taksitSil': ui.draft.plan.splice(Number(b.dataset.i), 1); renderPlanRows(); refreshReview(); break;
        case 'lojistikUygula': {
          const r = lgCalc();
          ui.draft.transportTRY = r.freight;
          ui.draft.craneTRY = r.crane;
          document.querySelector('[data-f="transportTRY"]').value = r.freight;
          document.querySelector('[data-f="craneTRY"]').value = r.crane;
          refreshReview();
          break;
        }
        default: break;
      }
    });
    govde.addEventListener('input', e => {
      const el = e.target;
      if (el.id === 'kopruMetin') { ui.bridgeText = el.value; const p = $('komutOnizleme'); if (p) p.textContent = P.buildPrompt(state.items, el.value); return; }
      if (el.id === 'aiMetin') { ui.aiText = el.value; return; }
      if (el.id && el.id.startsWith('lg')) { const r = lgCalc(); $('lgSonuc').textContent = t('logResult', { n: r.trucks, f: tl(r.freight), c: tl(r.crane) }); return; }
      if (!ui.draft) return;
      if (el.dataset.f) {
        const f = el.dataset.f;
        ui.draft[f] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value);
        if (f === 'currency') { const th = document.querySelector('.foy-kalem th:nth-child(2)'); if (th) th.textContent = t('fPrice', { c: ui.draft.currency }); }
        refreshReview();
      } else if (el.dataset.plan !== undefined) {
        ui.draft.plan[Number(el.dataset.plan)][el.dataset.pa] = el.value === '' ? 0 : Number(el.value);
        $('planOn').value = '';
        refreshReview();
      } else if (el.dataset.satirF) {
        const line = ui.draft.lines[el.dataset.id];
        const f = el.dataset.satirF;
        if (f === 'unit') line.unit = el.value;
        else line[f] = el.value === '' ? null : Number(el.value);
        refreshReview();
      }
    });
    govde.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'aiProvider') { readAiFields(); ai.model = AI.PROVIDERS[ai.provider].defaultModel; ai.url = ''; renderDesk(); return; }
      if (el.id && el.id.startsWith('ai')) { readAiFields(); return; }
      if (el.id === 'planOn' && el.value) { ui.draft.plan = E.planFromPreset(el.value).map(p => ({ pct: Math.round(p.pct * 1e4) / 1e4, days: p.days })); renderPlanRows(); refreshReview(); return; }
      if (el.dataset && el.dataset.satirF === 'unit') { renderReviewLines(); refreshReview(); }
      if (el.dataset && el.dataset.f === 'delivery') {
        const d = ui.draft;
        if (d.delivery === 'site_stacked' && !d.transportTRY && !d.craneTRY) refreshReview();
      }
    });
  }

  function lgCalc() {
    const v = id => Number(($(id) || {}).value) || 0;
    return E.estimateLogistics({ tonnage: v('lgTon'), distanceKm: v('lgKm'), craneHours: v('lgVs'), truckCapacityT: v('lgCap') || 25, truckBaseTRY: v('lgBase'), truckPerKmTRY: v('lgKmTl'), craneHourTRY: v('lgVsTl') });
  }

  /* ---------- layout bookkeeping ---------- */

  function trackHeights() {
    const set = () => {
      document.documentElement.style.setProperty('--ust-h', $('ust').offsetHeight + 'px');
      document.documentElement.style.setProperty('--micr-h', $('micr').offsetHeight + 'px');
    };
    set();
    if ('ResizeObserver' in window) new ResizeObserver(set).observe(document.body);
    let narrow = window.innerWidth < 640;
    window.addEventListener('resize', () => {
      set();
      if ((window.innerWidth < 640) !== narrow) { narrow = !narrow; renderBook(); }
    });
  }

  // The current section is the last one whose top has passed the pinned bars;
  // at the very bottom of the page it is always the last section.
  function scrollSpy() {
    const links = [...document.querySelectorAll('.ray a')];
    const sections = [...document.querySelectorAll('.bolum')];
    const update = () => {
      const line = $('ust').offsetHeight + $('micr').offsetHeight + 80;
      let current = sections[0].id;
      sections.forEach(s => { if (s.getBoundingClientRect().top <= line) current = s.id; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1].id;
      links.forEach(a => a.setAttribute('aria-current', String(a.dataset.bolum === current)));
    };
    // seven rect reads per scroll event are cheap; no rAF, so a background tab stays correct too
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('hashchange', update);
    links.forEach(a => a.addEventListener('click', () => links.forEach(l => l.setAttribute('aria-current', String(l === a)))));
    update();
  }

  /* ---------- start ---------- */

  load();
  guilloche();
  applyStatic();
  wire();
  render();
  renderDesk();
  trackHeights();
  scrollSpy();
  window.RFQApp = { get state() { return state; }, get result() { return result; }, render };
})();
