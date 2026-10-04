// Aage Ke? on-device model. Preprocessing mirrors model/preprocess.py exactly.
(function (root) {
  'use strict';

  function preprocess(text) {
    var t = (text || '').normalize('NFC');
    t = t.replace(/[‌‍]/g, '');
    t = t.toLowerCase();
    t = t.replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09e6); });
    t = t.replace(/(.)\1{2,}/gsu, '$1$1');
    // Letters, combining marks and digits stay; the rest is punctuation.
    t = t.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  // Share of Bangla-block characters among letters: >= 0.8 bn, <= 0.2 banglish, else mixed.
  function detectScript(text) {
    var letters = (text || '').normalize('NFC').match(/[\p{L}\p{M}]/gu) || [];
    if (!letters.length) return 'banglish';
    var bn = letters.filter(function (c) { return c >= 'ঀ' && c <= '৿'; }).length;
    var share = bn / letters.length;
    if (share >= 0.8) return 'bn';
    if (share <= 0.2) return 'banglish';
    return 'mixed';
  }

  var api = { preprocess: preprocess, detectScript: detectScript };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AageModel = api;
})(this);
