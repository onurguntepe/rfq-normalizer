/*
 * RFQ Normalizer - SVG drawings. Pure string builders; app.js wires the hover layer.
 */
(function (root) {
  'use strict';

  const DASH = ['', '6 3', '2 3', '9 3 2 3', '4 4', '1 3'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function seriesColor(i) { return 'var(--seri-' + ((i % 6) + 1) + ')'; }
  function seriesDash(i) { return DASH[i % DASH.length]; }

  /**
   * Payment strip for one supplier.  Shared scale across the book so strips compare.
   * Outline = amount due on that day, solid = its value today.
   */
  function paymentStrip(ev, scale, color, fmt, labels) {
    const W = scale.width || 520, H = 96, top = 16, base = 70, left = 2, right = 18;
    const x = d => left + (d / scale.maxDays) * (W - left - right);
    const hgt = v => scale.maxAmount > 0 ? Math.max(2, v / scale.maxAmount * (base - top)) : 2;
    const ticks = [];
    for (let d = 0; d <= scale.maxDays; d += scale.step) ticks.push(d);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labels.aria)}">`;
    s += `<line x1="${left}" y1="${base}" x2="${W - right}" y2="${base}" stroke="var(--murekkep)" stroke-width="1"/>`;
    ticks.forEach(d => {
      s += `<line x1="${x(d)}" y1="${base}" x2="${x(d)}" y2="${base + 4}" stroke="var(--murekkep)" stroke-width="1"/>`;
      s += `<text class="eksen-yazi" x="${x(d)}" y="${base + 16}" text-anchor="${d === 0 ? 'start' : 'middle'}" font-family="var(--font-rakam)" font-size="10" fill="var(--soluk)">${d}${esc(labels.dayShort)}</text>`;
    });
    if (ev.logistics > 0) {
      const lh = hgt(ev.logistics);
      s += `<rect x="${x(0)}" y="${base - lh}" width="6" height="${lh}" fill="var(--soluk)" opacity="0.55" data-ipucu="${esc(labels.logisticsTip)}"/>`;
    }
    const used = {};
    ev.tranches.forEach(t => {
      const w = 30;
      let cx = Math.min(x(t.days), W - right - w);
      const key = Math.round(cx);
      if (used[key]) cx += used[key] * (w + 3);
      used[key] = (used[key] || 0) + 1;
      if (ev.logistics > 0 && t.days === 0) cx += 8;
      const hn = hgt(t.amountOnDue);
      const hp = hgt(t.pv);
      const tip = labels.trancheTip(t);
      s += `<g data-ipucu="${esc(tip)}" tabindex="0" role="img" aria-label="${esc(tip.replace(/\n/g, ', '))}">`;
      s += `<rect x="${cx}" y="${base - hn}" width="${w}" height="${hn}" fill="var(--kagit)" stroke="var(--murekkep)" stroke-width="1"/>`;
      s += `<rect x="${cx + 2}" y="${base - hp}" width="${w - 4}" height="${Math.max(0, hp - 1)}" fill="${color}" opacity="0.9"/>`;
      s += `<rect x="${cx - 4}" y="${top - 12}" width="${w + 8}" height="${base - top + 14}" fill="transparent"/>`;
      s += `<text x="${cx + w / 2}" y="${base - hn - 4}" text-anchor="middle" font-family="var(--font-rakam)" font-size="10" fill="var(--koyu)">%${fmt.pct(t.pct)}</text>`;
      s += `</g>`;
    });
    s += '</svg>';
    return s;
  }

  function niceStep(range, target) {
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  }

  /**
   * Cost today vs monthly funding rate, one line per complete supplier.
   * series: [{ id, name, color, dash, points: [[rate, pv]] }]
   */
  function sensitivityChart(series, opts) {
    const W = 680, H = 380, L = 72, R = 150, T = 18, B = 40;
    const xs = series[0].points.map(p => p[0]);
    const xMin = xs[0], xMax = xs[xs.length - 1];
    let yMin = Infinity, yMax = -Infinity;
    series.forEach(s => s.points.forEach(p => { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); }));
    const pad = (yMax - yMin) * 0.06 || yMax * 0.02 || 1;
    yMin -= pad; yMax += pad;
    const step = niceStep(yMax - yMin, 5);
    yMin = Math.floor(yMin / step) * step;
    yMax = Math.ceil(yMax / step) * step;
    const x = v => L + (v - xMin) / (xMax - xMin) * (W - L - R);
    const y = v => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);

    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria)}" data-xmin="${xMin}" data-xmax="${xMax}" data-l="${L}" data-r="${R}" data-w="${W}" data-t="${T}" data-b="${B}" data-h="${H}">`;
    s += '<g class="izgara">';
    for (let v = yMin; v <= yMax + 1e-6; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    s += '</g><g class="eksen">';
    for (let v = yMin; v <= yMax + 1e-6; v += step) s += `<text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${esc(opts.fmtAxis(v))}</text>`;
    for (let v = Math.ceil(xMin); v <= xMax + 1e-6; v += 1) s += `<text x="${x(v)}" y="${H - B + 18}" text-anchor="middle">%${v}</text>`;
    s += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(opts.xTitle)}</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--murekkep)" stroke-width="1"/>`;
    s += '</g>';

    // current rate
    if (opts.current >= xMin && opts.current <= xMax) {
      s += `<line x1="${x(opts.current)}" x2="${x(opts.current)}" y1="${T}" y2="${H - B}" stroke="var(--murekkep)" stroke-width="1" stroke-dasharray="3 3"/>`;
      s += `<text x="${x(opts.current) + 5}" y="${T + 10}" font-family="var(--font-rakam)" font-size="10.5" fill="var(--murekkep)">${esc(opts.currentLabel)}</text>`;
    }

    series.forEach(sr => {
      const d = sr.points.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
      s += `<path d="${d}" fill="none" stroke="var(--kagit)" stroke-width="5" stroke-linejoin="round"/>`;
      s += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${sr.lead ? 2.5 : 2}" stroke-dasharray="${sr.dash}" stroke-linejoin="round"/>`;
    });

    // break-even markers
    (opts.crossings || []).forEach(c => {
      s += `<circle cx="${x(c.rate)}" cy="${y(c.pv)}" r="5" fill="var(--kagit)" stroke="var(--murekkep)" stroke-width="2" data-ipucu="${esc(c.tip)}"/>`;
    });

    // direct labels at the right edge, nudged apart
    const ends = series.map(sr => ({ sr, yy: y(sr.points[sr.points.length - 1][1]) })).sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14;
    ends.forEach(e => {
      s += `<text x="${W - R + 8}" y="${e.yy + 3.5}" font-size="11.5" font-weight="${e.sr.lead ? 750 : 600}" fill="var(--murekkep)">${esc(e.sr.short)}</text>`;
    });

    s += `<line class="imlec" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--banka)" stroke-width="1" opacity="0"/>`;
    s += `<rect class="vurus" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    s += '</svg>';
    return s;
  }

  function legendSwatch(color, dash) {
    return `<svg viewBox="0 0 22 8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/></svg>`;
  }

  root.RFQCharts = { paymentStrip, sensitivityChart, legendSwatch, seriesColor, seriesDash, esc };
})(typeof self !== 'undefined' ? self : this);
