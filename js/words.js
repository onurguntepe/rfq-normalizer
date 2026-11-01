/*
 * Amounts in words, the way a cheque is written:
 * TR "Yalnız #ÜçMilyonKırkBinÜçYüzOnİki# TL'dir", EN "Three million forty thousand ...".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RFQWords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TR_ONES = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const TR_TENS = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const TR_SCALE = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon'];

  function trTriplet(n) {
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
    return (h ? (h === 1 ? '' : TR_ONES[h]) + 'Yüz' : '') + TR_TENS[t] + TR_ONES[o];
  }

  function tr(amount) {
    let n = Math.round(Math.abs(Number(amount) || 0));
    if (n === 0) return 'Sıfır';
    const parts = [];
    let i = 0;
    while (n > 0 && i < TR_SCALE.length) {
      const g = n % 1000;
      if (g) parts.unshift((i === 1 && g === 1 ? '' : trTriplet(g)) + TR_SCALE[i]);
      n = Math.floor(n / 1000);
      i++;
    }
    return parts.join('');
  }

  const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const EN_SCALE = ['', 'thousand', 'million', 'billion', 'trillion'];

  function enTriplet(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const out = [];
    if (h) out.push(EN_ONES[h] + ' hundred');
    if (r) out.push(r < 20 ? EN_ONES[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? '-' + EN_ONES[r % 10] : ''));
    return out.join(' ');
  }

  function en(amount) {
    let n = Math.round(Math.abs(Number(amount) || 0));
    if (n === 0) return 'Zero';
    const parts = [];
    let i = 0;
    while (n > 0 && i < EN_SCALE.length) {
      const g = n % 1000;
      if (g) parts.unshift(enTriplet(g) + (EN_SCALE[i] ? ' ' + EN_SCALE[i] : ''));
      n = Math.floor(n / 1000);
      i++;
    }
    const s = parts.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { tr, en };
});
