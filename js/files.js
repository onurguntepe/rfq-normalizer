/*
 * RFQ Normalizer - files in and out.
 * SheetJS and pdf.js load from cdnjs only when a file actually needs them,
 * so the app itself stays usable offline.
 */
(function (root) {
  'use strict';

  const LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  };
  const MAX_BYTES = 15 * 1024 * 1024;
  const loading = {};

  function loadScript(url) {
    if (!loading[url]) {
      loading[url] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => { delete loading[url]; reject(new Error('LIB_LOAD')); };
        document.head.appendChild(s);
      });
    }
    return loading[url];
  }

  async function xlsx() {
    if (!root.XLSX) await loadScript(LIBS.xlsx);
    return root.XLSX;
  }

  async function pdfjs() {
    if (!root.pdfjsLib) await loadScript(LIBS.pdf);
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    return root.pdfjsLib;
  }

  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }

  /* ---------- CSV ---------- */

  function parseCsv(text) {
    const first = text.split(/\r?\n/)[0] || '';
    const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(v => v.replace(/^﻿/, '').replace(/^'(?=[=+\-@])/, '')));
  }

  function rowsToText(rows) {
    return rows.filter(r => r.some(v => String(v).trim())).map(r => r.map(v => String(v).trim()).filter(Boolean).join('\t')).join('\n');
  }

  /* ---------- reading ---------- */

  async function pdfText(buf) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const lines = [];
      let lastY = null, line = [];
      for (const it of tc.items) {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.join(' ')); line = []; }
        line.push(it.str);
        lastY = y;
      }
      if (line.length) lines.push(line.join(' '));
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
  }

  /**
   * Returns { name, kind, text, rows?, attachment? }.
   * kind: sheet | text | pdf | image
   */
  async function readFile(file) {
    if (file.size > MAX_BYTES) throw new Error('FILE_TOO_BIG');
    const name = file.name || 'file';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = file.type || '';
    if (/^image\//.test(mime) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      const buf = await file.arrayBuffer();
      return { name, kind: 'image', text: '', attachment: { kind: 'image', mime: mime || 'image/' + (ext === 'jpg' ? 'jpeg' : ext), base64: toBase64(buf) } };
    }
    if (ext === 'pdf' || mime === 'application/pdf') {
      const buf = await file.arrayBuffer();
      let text = '';
      try { text = await pdfText(buf); } catch (e) { text = ''; }
      return { name, kind: 'pdf', text, attachment: { kind: 'pdf', mime: 'application/pdf', base64: toBase64(buf) } };
    }
    if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
      const X = await xlsx();
      const wb = X.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      return { name, kind: 'sheet', rows, text: rowsToText(rows) };
    }
    const text = await file.text();
    if (ext === 'csv' || ext === 'tsv') {
      const rows = parseCsv(text);
      return { name, kind: 'sheet', rows, text: rowsToText(rows) };
    }
    return { name, kind: 'text', text };
  }

  /* ---------- standard template ---------- */

  const LABELS = {
    supplier: ['FİRMA', 'SUPPLIER'],
    currency: ['PARA BİRİMİ', 'CURRENCY'],
    delivery: ['TESLİM', 'DELIVERY'],
    freight: ['NAKLİYE (TL)', 'FREIGHT (TRY)'],
    crane: ['VİNÇ / İNDİRME (TL)', 'CRANE / UNLOADING (TRY)'],
    waste: ['FİRE (%)', 'WASTE (%)'],
    vat: ['KDV DAHİL (EVET/HAYIR)', 'VAT INCLUDED (YES/NO)'],
    payPct: ['ÖDEME %', 'PAYMENT %'],
    payDays: ['ÖDEME GÜN', 'PAYMENT DAYS'],
    head: ['NO', 'KALEM', 'MİKTAR', 'BİRİM', 'BİRİM FİYAT', 'FİYAT BİRİMİ'],
    headEn: ['NO', 'ITEM', 'QTY', 'UNIT', 'UNIT PRICE', 'PRICE UNIT']
  };

  function norm(s) {
    return String(s || '').toLocaleUpperCase('tr').replace(/\s+/g, ' ').trim();
  }

  function templateRows(state, lang) {
    const en = lang === 'en';
    const L = k => LABELS[k][en ? 1 : 0];
    const rows = [
      [en ? 'RFQ NORMALIZER - SUPPLIER QUOTE FORM' : 'MUKAYESE ÇEKİ - TEKLİF FORMU', state.title],
      [en ? 'Fill the yellow cells. Prices exclude VAT unless stated. Leave a price empty if you do not quote that item.' : 'Boş hücreleri doldurun. KDV dahil değilse fiyatlar KDV hariçtir. Teklif vermediğiniz kalemin fiyatını boş bırakın.'],
      [],
      [L('supplier'), ''],
      [L('currency'), 'TRY'],
      [L('delivery'), en ? 'Site, stacked' : 'Şantiye istif'],
      [L('freight'), 0],
      [L('crane'), 0],
      [L('waste'), 0],
      [L('vat'), en ? 'NO' : 'HAYIR'],
      [L('payPct'), 100, '', '', '', ''],
      [L('payDays'), 0, '', '', '', ''],
      [],
      en ? LABELS.headEn : LABELS.head
    ];
    state.items.forEach((it, i) => rows.push([i + 1, it.name, it.qty, it.unit, '', it.unit]));
    return rows;
  }

  async function downloadTemplate(state, lang) {
    const rows = templateRows(state, lang);
    const base = (state.code || 'RFQ') + (lang === 'en' ? '_quote_template' : '_teklif_sablonu');
    try {
      const X = await xlsx();
      const ws = X.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 26 }, { wch: 46 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ws, lang === 'en' ? 'Quote' : 'Teklif');
      X.writeFile(wb, base + '.xlsx');
      return 'xlsx';
    } catch (e) {
      const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
      saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), base + '.csv');
      return 'csv';
    }
  }

  function isTemplate(rows) {
    const flat = rows.slice(0, 20).map(r => norm(r[0]));
    return flat.some(v => LABELS.supplier.includes(v)) && rows.some(r => norm(r[0]) === 'NO' && LABELS.head.concat(LABELS.headEn).includes(norm(r[1])));
  }

  /** Template rows to a raw quote object (same shape the AI returns). */
  function parseTemplate(rows, items) {
    const get = key => {
      const r = rows.find(row => LABELS[key].includes(norm(row[0])));
      return r ? r.slice(1) : [];
    };
    const pct = get('payPct');
    const days = get('payDays');
    const plan = [];
    for (let i = 0; i < Math.max(pct.length, days.length); i++) {
      if (String(pct[i]).trim() === '' && String(days[i]).trim() === '') continue;
      plan.push({ percent: pct[i], days: days[i] === '' ? 0 : days[i] });
    }
    const headIdx = rows.findIndex(r => norm(r[0]) === 'NO');
    const lines = items.map((it, i) => {
      const r = rows.slice(headIdx + 1).find(row => Number(row[0]) === i + 1);
      return { item: i + 1, price: r && String(r[4]).trim() !== '' ? r[4] : null, unit: r && String(r[5]).trim() ? r[5] : it.unit };
    });
    const vat = norm(get('vat')[0]);
    return {
      supplierName: String(get('supplier')[0] || '').trim(),
      currency: get('currency')[0],
      deliveryCode: get('delivery')[0],
      transportCostTRY: get('freight')[0],
      craneCostTRY: get('crane')[0],
      wastePercent: get('waste')[0],
      vatIncluded: /^(EVET|YES|DAHİL|TRUE|1)$/.test(vat) ? true : (/^(HAYIR|NO|HARİÇ|FALSE|0)$/.test(vat) ? false : null),
      paymentPlan: plan,
      lines
    };
  }

  /* ---------- downloads ---------- */

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadXlsx(rows, filename, sheetName) {
    const X = await xlsx();
    const ws = X.utils.aoa_to_sheet(rows);
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, sheetName || 'Mukayese');
    X.writeFile(wb, filename);
  }

  root.RFQFiles = { readFile, parseCsv, isTemplate, parseTemplate, templateRows, downloadTemplate, downloadXlsx, saveBlob };
})(typeof self !== 'undefined' ? self : this);
