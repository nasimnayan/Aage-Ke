// Cue matching, negation and past rules. Mirrors model/rules.py exactly.
(function (root) {
  'use strict';
  var pre = (typeof module !== 'undefined' && module.exports) ? require('./model.js').preprocess : root.AageModel.preprocess;

  function Rules(labelsJson) {
    var r = labelsJson.rules, self = this;
    this.charBreaks = []; this.wordBreaks = {};
    r.clause_breaks.forEach(function (b) {
      var p = pre(b);
      if (p) self.wordBreaks[p] = true; else self.charBreaks.push(b);
    });
    var toks = function (x) { return pre(x).split(' '); };
    this.neg = r.negation_cues_bn.concat(r.negation_cues_banglish).map(toks);
    this.past = r.past_cues_bn.concat(r.past_cues_banglish).map(toks);
    this.pastEndings = r.past_verb_endings.map(pre);
    this.stop = r.stop_words.map(pre);
    this.window = r.negation_window_tokens;
    this.keys = []; this.kind = {}; this.cues = {}; this.exclude = {};
    [['warning_signs', 'warning'], ['status_labels', 'status']].forEach(function (g) {
      labelsJson[g[0]].forEach(function (lab) {
        var k = lab.key;
        self.keys.push(k); self.kind[k] = g[1];
        var raw = (lab.cues_bn || []).concat(lab.cues_banglish || [], lab.cues_regional || []);
        var set = {};
        raw.forEach(function (c) { var p = pre(c); if (p) set[p] = true; });
        self.cues[k] = Object.keys(set).sort(function (a, b) { return b.length - a.length; });
        self.exclude[k] = (lab.exclude_phrases || []).map(pre);
      });
    });
  }

  Rules.prototype.clauses = function (text) {
    var parts = [text || ''], self = this;
    this.charBreaks.forEach(function (b) {
      var next = [];
      parts.forEach(function (p) { next = next.concat(p.split(b)); });
      parts = next;
    });
    var out = [];
    parts.forEach(function (p) {
      var cur = [];
      pre(p).split(' ').filter(Boolean).forEach(function (tok) {
        if (self.wordBreaks[tok]) { if (cur.length) out.push(cur); cur = []; }
        else cur.push(tok);
      });
      if (cur.length) out.push(cur);
    });
    return out;
  };

  function countSpaces(s, end) {
    var n = 0;
    for (var i = 0; i < end; i++) if (s[i] === ' ') n++;
    return n;
  }

  Rules.prototype.matches = function (key, tokens) {
    var s = tokens.join(' ');
    this.exclude[key].forEach(function (ex) { s = s.split(ex).join('#'.repeat(ex.length)); });
    var spans = [];
    this.cues[key].forEach(function (cue) {
      var i = s.indexOf(cue);
      while (i !== -1) {
        spans.push([countSpaces(s, i), countSpaces(s, i + cue.length - 1)]);
        i = s.indexOf(cue, i + 1);
      }
    });
    return spans;
  };

  function seqAt(tokens, i, seq) {
    if (i + seq.length > tokens.length) return false;
    for (var j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) return false;
    return true;
  }

  Rules.prototype.negPositions = function (tokens) {
    var pos = {}, self = this;
    tokens.forEach(function (_, i) {
      self.neg.forEach(function (seq) {
        if (seqAt(tokens, i, seq)) for (var j = i; j < i + seq.length; j++) pos[j] = true;
      });
    });
    return Object.keys(pos).map(Number);
  };

  Rules.prototype.isPast = function (tokens) {
    var self = this;
    return tokens.some(function (t, i) {
      return self.pastEndings.some(function (e) { return t.endsWith(e); }) ||
        self.past.some(function (seq) { return seqAt(tokens, i, seq); });
    });
  };

  Rules.prototype.spanNegated = function (tokens, span, negpos) {
    var a = span[0], b = span[1], self = this;
    return negpos.some(function (n) {
      var between;
      if (n >= a && n <= b) return false; // negation inside the cue does not count
      if (n >= a - self.window && n < a) between = tokens.slice(n + 1, a);
      else if (n > b && n <= b + self.window) between = tokens.slice(b + 1, n);
      else return false;
      // "bomi bondho hocche na" = vomiting does not stop: keep the label.
      var stopped = between.some(function (t) { return self.stop.some(function (s) { return t.startsWith(s); }); });
      return !stopped;
    });
  };

  // {label: null | 'neg' | 'past' | 'plain'}
  Rules.prototype.analyse = function (text) {
    var self = this;
    var info = this.clauses(text).map(function (c) { return [c, self.negPositions(c), self.isPast(c)]; });
    var out = {};
    this.keys.forEach(function (k) {
      var mentions = [];
      info.forEach(function (x) {
        var tokens = x[0], negpos = x[1], past = x[2];
        var spans = self.matches(k, tokens);
        if (!spans.length) return;
        if (past && self.kind[k] === 'warning') mentions.push('past');
        else if (spans.every(function (sp) { return self.spanNegated(tokens, sp, negpos); })) mentions.push('neg');
        else mentions.push('plain');
      });
      if (!mentions.length) out[k] = null;
      else if (mentions.every(function (m) { return m === 'neg'; })) out[k] = 'neg';
      else if (mentions.every(function (m) { return m === 'neg' || m === 'past'; })) out[k] = 'past';
      else out[k] = 'plain';
    });
    return out;
  };

  function band(p, bands) {
    if (p >= bands.suggest) return 'sure';
    if (p >= bands.unsure_low) return 'unsure';
    return null;
  }
  var RANK = { null: 0, unsure: 1, sure: 2 };

  // Model probabilities + rule status -> {label: 'sure' | 'unsure'}
  function applyRules(probs, status, bands) {
    var out = {};
    Object.keys(probs).forEach(function (k) {
      var st = status[k];
      if (st === 'neg') return;
      var b = st === 'past' ? 'unsure' : band(probs[k], bands);
      if (b) out[k] = b;
    });
    if (status.fever_present === 'neg') {
      var best = 'unsure';
      [out.fever_dropped || null, band(probs.fever_present, bands)].forEach(function (b) {
        if (RANK[b] > RANK[best]) best = b;
      });
      out.fever_dropped = best;
    }
    return out;
  }

  // 'labels' | 'not_understood' | 'no_warning_sign'
  function outcome(bandsByLabel, warningKeys) {
    var ks = Object.keys(bandsByLabel);
    if (!ks.length) return 'not_understood';
    var anyWarning = ks.some(function (k) { return warningKeys.indexOf(k) !== -1; });
    var onlyFine = ks.every(function (k) { return k === 'feeling_better' || k === 'fever_dropped'; });
    if (!anyWarning && onlyFine) return 'no_warning_sign';
    return 'labels';
  }

  var api = { Rules: Rules, applyRules: applyRules, outcome: outcome, band: band };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AageRules = api;
})(this);
