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

  // Character n-grams inside word boundaries, as scikit-learn's analyzer="char_wb".
  function charWbNgrams(text, minN, maxN) {
    var grams = [];
    text.split(/\s+/).filter(Boolean).forEach(function (word) {
      var w = Array.from(' ' + word + ' ');
      for (var n = minN; n <= maxN; n++) {
        var offset = 0;
        grams.push(w.slice(offset, offset + n).join(''));
        while (offset + n < w.length) {
          offset += 1;
          grams.push(w.slice(offset, offset + n).join(''));
        }
        if (offset === 0) break; // a short word is counted once
      }
    });
    return grams;
  }

  // TF-IDF vector of a message: {featureIndex: weight}, already L2-normalised.
  function vectorise(model, text) {
    var range = model.vectorizer.ngram_range;
    var counts = {};
    charWbNgrams(preprocess(text), range[0], range[1]).forEach(function (g) {
      counts[g] = (counts[g] || 0) + 1;
    });
    var x = {}, norm = 0, total = 0, known = 0;
    Object.keys(counts).forEach(function (g) {
      total += counts[g];
      var idx = model.vocab[g];
      var idf = idx !== undefined ? model.idf[idx] : model.idf_norm_only[g];
      if (idf === undefined) return;
      known += counts[g];
      var v = (1 + Math.log(counts[g])) * idf;
      norm += v * v;
      if (idx !== undefined) x[idx] = v;
    });
    norm = Math.sqrt(norm) || 1;
    Object.keys(x).forEach(function (i) { x[i] = x[i] / norm; });
    return { x: x, coverage: total ? known / total : 0 };
  }

  // Label probabilities {label: p} from an exported model_dengue.json object.
  function predict(model, text) {
    var x = vectorise(model, text).x;
    var out = {};
    model.labels.forEach(function (label, li) {
      var z = model.intercept[li], row = model.coef[li];
      Object.keys(x).forEach(function (idx) { z += row[idx] * x[idx]; });
      out[label] = 1 / (1 + Math.exp(-z));
    });
    return out;
  }

  // The 2 or 3 words that pushed a label up most. char_wb n-grams never cross a word boundary,
  // so each word gets the summed contribution (weight x coefficient) of its own n-grams.
  function explain(model, text, label, n) {
    var li = model.labels.indexOf(label), x = vectorise(model, text).x, row = model.coef[li];
    var range = model.vectorizer.ngram_range, seen = {};
    var words = preprocess(text).split(' ').filter(function (w) {
      if (seen[w]) return false; seen[w] = true; return true;
    });
    return words.map(function (w) {
      var score = 0, uniq = {};
      charWbNgrams(w, range[0], range[1]).forEach(function (g) {
        var idx = model.vocab[g];
        if (idx === undefined || uniq[g] || x[idx] === undefined) return;
        uniq[g] = true;
        score += row[idx] * x[idx];
      });
      return [w, score];
    }).filter(function (c) { return c[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, n || 3).map(function (c) { return c[0]; });
  }

  function coverage(model, text) { return vectorise(model, text).coverage; }

  var api = { preprocess: preprocess, detectScript: detectScript, predict: predict, explain: explain, coverage: coverage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AageModel = api;
})(this);
