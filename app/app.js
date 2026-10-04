// Aage Ke? app controller. AI reads; code sorts; Rina decides.
(function () {
  'use strict';
  var t = I18N.t;
  var S = {
    view: 'pin', judge: false, patients: [], current: null, draft: null, smsKey: 'daily', settings: {},
    model: null, labels: null, rules: null, templates: null, fac: null, pinEntry: '', pinError: false
  };
  var $app = document.getElementById('app');
  var DAY = 86400000;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isoDate(d) {
    var x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function today() { return isoDate(Date.now()); }
  function dayDiff(a, b) { // whole local days from a to b ('YYYY-MM-DD')
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / DAY);
  }
  function illnessDay(p) { return p.onset ? dayDiff(p.onset, today()) + 1 : null; }
  function when(ts) {
    var d = isoDate(ts), h = new Date(ts).toTimeString().slice(0, 5);
    if (d === today()) return t('today') + ' ' + h;
    if (dayDiff(d, today()) === 1) return t('yesterday') + ' ' + h;
    return d + ' ' + h;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function warningKeys() { return S.labels.warning_signs.map(function (l) { return l.key; }); }
  function labelName(k) {
    var all = S.labels.warning_signs.concat(S.labels.status_labels);
    var l = all.filter(function (x) { return x.key === k; })[0];
    return l ? (I18N.getLang() === 'bn' ? l.bn : l.en) : k;
  }
  function labelKind(k) {
    if (warningKeys().indexOf(k) !== -1) return 'k-warn';
    if (k === 'fever_dropped' || k === 'feeling_better') return 'k-good';
    if (k === 'test_result_mentioned') return 'k-amber';
    return 'k-neutral';
  }
  function maskPhone(n) { return n ? n.slice(0, -6) + '••••••' : n; }
  function shownPhone(n) { return S.judge ? maskPhone(n) : n; }
  function smsHref(number, body) { return 'sms:' + (number || '') + '?body=' + encodeURIComponent(body); }

  // ---------- AI + rules ----------
  function analyse(text) {
    var t0 = performance.now();
    var probs = AageModel.predict(S.model, text);
    var bands = AageRules.applyRules(probs, S.rules.analyse(text), S.labels.bands);
    S.lastMs = performance.now() - t0;
    var th = S.model.coverage_threshold;
    return { bands: bands, outcome: AageRules.outcome(bands, warningKeys()),
      unfamiliar: th != null && AageModel.coverage(S.model, text) < th };
  }

  // Judge mode only: what the model is, in one line (English; numbers come from model_dengue.json).
  function factsLine() {
    var f = S.model.facts || {}, g = f.gate1 || {}, mf = g.micro_f1 || {};
    var parts = [
      'Model ' + Math.round(S.modelBytes / 1024) + ' KB',
      S.model.labels.length + ' fixed labels, no free text',
      f.train_rows ? 'trained on ' + f.train_rows + ' ' + f.train_source : null,
      mf['model+rules'] ? 'Gate 1 (' + g.rows + ' synthetic stress-test messages, model trained on ' + g.model_rows + ' rows): micro-F1 ' + mf['model+rules'].toFixed(2) +
        ' vs ' + mf['keyword+neg'].toFixed(2) + ' keyword+negation' : null,
      'runs on this phone, no network, no LLM'
    ];
    return parts.filter(Boolean).join(' · ');
  }

  // ---------- urgency (confirmed labels only, docs/01 §6) ----------
  function lastHandled(p) {
    return (p.actions || []).filter(function (a) { return ['call', 'visit', 'refer', 'arrived'].indexOf(a.type) !== -1; })
      .reduce(function (m, a) { return Math.max(m, a.ts); }, 0);
  }
  function confirmedIn(m, k) { return m.decisions && m.decisions[k] === 'confirmed'; }
  // Within red, shock signs (WHO 2009: cold clammy extremities, restlessness or lethargy, reduced
  // urine) and bleeding come first; then oldest first.
  var SHOCK_OR_BLEEDING = ['cold_clammy', 'lethargy_restless', 'low_urine', 'bleeding'];
  function urgency(p) {
    var since = lastHandled(p), wk = warningKeys();
    var pending = (p.messages || []).filter(function (m) { return m.ts > since; })
      .sort(function (a, b) { return a.ts - b.ts; });
    var red = pending.filter(function (m) { return wk.some(function (k) { return confirmedIn(m, k); }); });
    if (red.length) {
      var shock = red.some(function (m) { return SHOCK_OR_BLEEDING.some(function (k) { return confirmedIn(m, k); }); });
      return { tier: 'red', why: t('why_red'), ts: red[0].ts, first: shock ? 1 : 0 };
    }
    var amber = [];
    pending.forEach(function (m) {
      if (m.type === 'sms' && m.outcome === 'not_understood') amber.push([m.ts, t('why_not_understood')]);
      if (confirmedIn(m, 'test_result_mentioned')) amber.push([m.ts, t('why_test')]);
      if (m.type === 'missed_call') amber.push([m.ts, t('why_missed')]);
    });
    if (amber.length) return { tier: 'amber', why: amber[0][1], ts: amber[0][0] };
    var ref = openReferral(p);
    if (ref) return { tier: 'amber', why: t('referred_pending'), ts: ref.ts };
    var day = illnessDay(p);
    var heardToday = (p.messages || []).some(function (m) { return m.type !== 'note' && isoDate(m.ts) === today(); });
    if (((day >= 3 && day <= 7) || p.feverDroppedOn) && !heardToday) {
      var last = (p.messages || []).reduce(function (m, x) { return Math.max(m, x.ts); }, p.added || 0);
      return { tier: 'amber', why: t('why_silent'), ts: last };
    }
    var lastMsg = (p.messages || []).reduce(function (m, x) { return Math.max(m, x.ts); }, p.added || 0);
    return { tier: 'green', why: '', ts: lastMsg };
  }
  // A referral stays open (amber) until Rina marks that the patient reached hospital.
  function openReferral(p) {
    var acts = (p.actions || []).filter(function (a) { return a.type === 'refer' || a.type === 'arrived'; })
      .sort(function (a, b) { return a.ts - b.ts; });
    var last = acts[acts.length - 1];
    return last && last.type === 'refer' ? last : null;
  }
  function confirmedSigns(p) {
    var out = {};
    (p.messages || []).forEach(function (m) {
      Object.keys(m.decisions || {}).forEach(function (k) {
        if (m.decisions[k] === 'confirmed' && warningKeys().indexOf(k) !== -1) out[k] = m.ts;
      });
    });
    return Object.keys(out);
  }

  // ---------- facilities (docs/01 §7) ----------
  function haversine(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function unionOf(p) { return S.fac.unions.filter(function (u) { return u.name === p.union; })[0] || S.fac.unions[0]; }
  function nearestFacility(p) {
    var u = unionOf(p);
    return S.fac.facilities
      .filter(function (f) { return f.type !== 'CC' && (f.admits_dengue === true || f.admits_dengue === 'assumed'); })
      .map(function (f) { return { f: f, km: haversine(u, f) }; })
      .sort(function (a, b) { return a.km - b.km; })[0];
  }

  // ---------- templates ----------
  function fill(key, p, fac) {
    var s = S.templates[key];
    var name = S.settings.chcpName || '';
    s = s.split('[আপার নাম]').join(name).split('[আপা]').join(name);
    if (fac) {
      s = s.split('[হাসপাতাল]').join(fac.name_bn || fac.name)
        .split('ফোন: [নম্বর]').join('ফোন: ' + (fac.phone ? shownPhone(fac.phone) : ''));
    }
    if (p) {
      var u = unionOf(p);
      s = s.split('[কোড]').join(p.code).split('[ইউনিয়ন]').join(u.name_bn || u.name)
        .split('[N]').join(String(illnessDay(p) || ''))
        .split('[নিশ্চিত চিহ্ন]').join(confirmedSigns(p).map(function (k) {
          return S.labels.warning_signs.filter(function (l) { return l.key === k; })[0].bn;
        }).join(', '));
    }
    s = s.split('[কমিউনিটি ক্লিনিক]').join(S.settings.clinic || '').split('[নম্বর]').join(S.settings.myPhone || '');
    return s;
  }

  // English version of a template, for display only (English mode). The SMS sent stays Bangla.
  function fillEn(key, p, fac) {
    var s = (S.templates._en || {})[key];
    if (!s) return '';
    var rp = function (a, b) { s = s.split(a).join(b); };
    rp('[name]', S.settings.chcpNameEn || S.settings.chcpName || '');
    if (fac) { rp('[hospital phone]', fac.phone ? shownPhone(fac.phone) : ''); rp('[hospital]', fac.name); }
    if (p) {
      rp('[code]', p.code); rp('[union]', unionOf(p).name); rp('[N]', String(illnessDay(p) || ''));
      rp('[signs]', confirmedSigns(p).map(function (k) {
        return S.labels.warning_signs.filter(function (l) { return l.key === k; })[0].en;
      }).join(', '));
    }
    rp('[clinic]', S.settings.clinicEn || S.settings.clinic || ''); rp('[my number]', S.settings.myPhone || '');
    return s;
  }
  function translationLine(key, p, fac) {
    if (I18N.getLang() !== 'en') return '';
    var en = fillEn(key, p, fac);
    return en ? '<span class="gloss">' + esc(t('translation_not_sent')) + ': ' + esc(en) + '</span>' : '';
  }
  // Union name in the current language (Bangla names come from the facilities data).
  function unionName(p) {
    var u = unionOf(p);
    return I18N.getLang() === 'bn' && u.name_bn ? u.name_bn : p.union;
  }

  // ---------- persistence ----------
  function save(p) {
    return Store.put(p).then(load);
  }
  function load() {
    return Store.all().then(function (ps) { S.patients = ps; if (S.current) S.current = ps.filter(function (x) { return x.id === S.current.id; })[0]; });
  }
  function go(view) { S.view = view; render(); window.scrollTo(0, 0); }

  // ---------- PIN (screen lock) ----------
  function hashPin(pin, salt) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('plain:' + salt + pin);
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    }).then(function (bits) {
      return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  // PIN of 4 to 6 digits: ✓ submits, the sixth digit submits by itself.
  function pinDigit(d) {
    if (d === 'del') S.pinEntry = S.pinEntry.slice(0, -1);
    else if (d !== 'ok' && S.pinEntry.length < 6) S.pinEntry += d;
    S.pinError = false;
    if (!(S.pinEntry.length === 6 || (d === 'ok' && S.pinEntry.length >= 4))) return render();
    var entered = S.pinEntry; S.pinEntry = '';
    Store.getSetting('lock').then(function (lock) {
      if (lock) return Store.openLock(entered, lock);
      return firstLock(entered);
    }).then(function (ok) {
      if (ok) unlock(); else { S.pinError = true; render(); }
    });
  }
  // First encrypted lock. Data saved by the earlier screen-lock-only version is migrated:
  // its PIN is checked against the old hash, then every record is re-saved encrypted.
  function firstLock(pin) {
    return Store.getSetting('pin').then(function (legacy) {
      var check = legacy ? hashPin(pin, legacy.salt).then(function (h) { return h === legacy.hash; }) : Promise.resolve(true);
      return check.then(function (ok) {
        if (!ok) return false;
        return Store.createLock(pin).then(function () {
          if (!legacy) return true;
          return Promise.all(['chcpName', 'clinic', 'myPhone'].map(Store.getSetting)).then(function (v) {
            return Store.setProfile({ chcpName: v[0], clinic: v[1], myPhone: v[2] });
          }).then(function () { return Store.all(); }).then(function (ps) {
            return Promise.all(ps.map(Store.put));
          }).then(function () {
            return Promise.all(['pin', 'chcpName', 'clinic', 'myPhone'].map(Store.deleteSetting));
          }).then(function () { return true; });
        });
      });
    });
  }
  function unlock() {
    S.hasPin = true;
    return Store.getProfile()
      .then(function (v) { S.settings = { chcpName: v.chcpName, clinic: v.clinic, myPhone: v.myPhone }; return load(); })
      .then(function () { go(detailsMissing() ? 'settings' : 'inbox'); });
  }
  function detailsMissing() { return !(S.settings.chcpName && S.settings.clinic && S.settings.myPhone); }

  // ---------- judge mode (CC5) ----------
  function startJudge() {
    S.judge = true;
    Store.use('memory');
    if (!savedLang()) I18N.setLang('en');
    fetch('demo_data.json').then(function (r) { return r.json(); }).then(function (demo) {
      S.settings = demo.chcp;
      var now = Date.now();
      return Promise.all(demo.patients.map(function (d) {
        var p = {
          id: d.code, code: d.code, union: d.union, phone: '', added: now - (d.illness_day + 1) * DAY,
          onset: isoDate(now - (d.illness_day - 1) * DAY),
          feverDroppedOn: d.fever_dropped_days_ago != null ? isoDate(now - d.fever_dropped_days_ago * DAY) : null,
          messages: [], actions: [], untested: !!d.untested
        };
        d.messages.forEach(function (m) {
          var ts = new Date(now - m.days_ago * DAY).setHours(m.hour, 0, 0, 0);
          if (ts > now) ts = now - 60000;
          var a = analyse(m.text), decisions = {};
          (m.confirm || []).forEach(function (k) { if (a.bands[k]) decisions[k] = 'confirmed'; });
          p.messages.push({ id: uid(), ts: ts, type: 'sms', text: m.text, gloss: m.gloss, bands: a.bands, outcome: a.outcome, unfamiliar: a.unfamiliar, decisions: decisions });
        });
        return Store.put(p);
      }));
    }).then(load).then(function () { go('inbox'); });
  }

  // ---------- views ----------
  function header(title, back) {
    // "Aage Ke?" in the header is the home button on every screen. The screen title sits on its own line.
    return '<header class="bar"><div class="bar-row">' +
      (back ? '<button class="ghost" data-act="back" data-to="' + back + '" aria-label="' + esc(t('cancel')) + '">←</button>' : '') +
      '<button class="home" data-act="home">⌂ ' + esc(t('app_name')) + '</button>' +
      (navigator.onLine ? '' : '<span class="offline-badge">OFFLINE</span>') + '</div>' +
      (title && title !== t('app_name') ? '<h1>' + esc(title) + '</h1>' : '') +
      '</header>' + (S.judge ? '<div class="banner">' + esc(t('demo_banner')) +
        (S.view !== 'about' ? ' <button class="link" data-act="about">' + esc(t('about_link')) + '</button>' : '') + '</div>' +
        ((S.view === 'inbox' || S.view === 'patient') ? '<div class="facts">' +
          esc(I18N.getLang() === 'en' ? factsLine() : t('facts_short', { kb: Math.round(S.modelBytes / 1024) })) + '</div>' : '') : '');
  }

  function viewPin() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    return '<div class="pin">' +
      '<div class="brand">' + esc(t('app_name')) + '</div>' +
      '<p class="muted" id="pin-title">' + esc(S.hasPin ? t('pin_title') : t('pin_set_title')) + '</p>' +
      '<div class="dots">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<span class="' + (i < S.pinEntry.length ? 'on' : '') + (i > 3 ? ' opt' : '') + '"></span>'; }).join('') + '</div>' +
      (S.pinError ? '<p class="err">' + esc(t('pin_wrong')) + '</p>' : '') +
      '<div class="keys">' + keys.map(function (k) {
        var label = k === 'del' ? '⌫' : k === 'ok' ? '✓' : k;
        return '<button data-act="pin" data-d="' + k + '"' + (k === 'ok' ? ' class="ok"' + (S.pinEntry.length < 4 ? ' disabled' : '') : '') + '>' + label + '</button>';
      }).join('') + '</div>' +
      '<p class="muted small">' + esc(t('pin_note')) + '</p>' +
      '<button class="judge" data-act="judge">' + esc(t('judge_button')) + '</button>' +
      '<button class="link" data-act="about">' + esc(t('about_link')) + '</button>' +
      '</div>';
  }

  function viewInbox() {
    var rows = S.patients.map(function (p) { return { p: p, u: urgency(p) }; });
    var html = header(t('app_name')) + '<main>' +
      (S.sharedText ? '<p class="muted">' + esc(t('shared_pick')) + '</p><blockquote>' + esc(S.sharedText) + '</blockquote>' : '');
    ['red', 'amber', 'green'].forEach(function (tier) {
      var list = rows.filter(function (r) { return r.u.tier === tier; })
        .sort(function (a, b) { return ((b.u.first || 0) - (a.u.first || 0)) || (a.u.ts - b.u.ts); });
      html += '<section class="tier ' + tier + '"><h2>' + esc(t('tier_' + tier)) + ' <span class="count">' + list.length + '</span></h2>';
      list.forEach(function (r) {
        var p = r.p, day = illnessDay(p);
        html += '<button class="row" data-act="open" data-id="' + esc(p.id) + '">' +
          '<span class="code">' + esc(p.code) + '</span>' +
          '<span class="meta">' + esc(unionName(p)) + (day ? ' · ' + esc(t('illness_day', { n: day })) : '') +
          (p.untested ? ' · ' + esc(t('status_untested')) : '') + '</span>' +
          (r.u.why ? '<span class="why">' + esc(r.u.why) + '</span>' : '') + '</button>';
      });
      html += '</section>';
    });
    html += '<p class="muted center">' + esc(t('nobody_removed')) + '</p>' +
      '<div class="actions">' +
      '<button data-act="nav" data-to="add_patient">' + esc(t('add_patient')) + '</button>' +
      '<button class="ghost" data-act="nav" data-to="settings">' + esc(t('settings')) + '</button>' +
      '<button class="ghost" data-act="export">' + esc(t('export')) + '</button>' +
      '<button class="ghost" data-act="lock">' + esc(t('lock')) + '</button></div></main>';
    return html;
  }

  function viewAddPatient() {
    var unions = S.fac.unions.map(function (u) { return '<option value="' + esc(u.name) + '">' + esc(I18N.getLang() === 'bn' && u.name_bn ? u.name_bn : u.name) + '</option>'; }).join('');
    return header(t('add_patient'), 'inbox') + '<main><form id="f-patient" class="form">' +
      '<label>' + esc(t('code')) + '<input name="code" required autocomplete="off"></label>' +
      '<div class="radios"><label class="radio"><input type="radio" name="status" value="tested" checked> ' + esc(t('status_tested')) + '</label>' +
      '<label class="radio"><input type="radio" name="status" value="untested"> ' + esc(t('status_untested')) + '</label></div>' +
      '<label>' + esc(t('union')) + '<select name="union">' + unions + '</select></label>' +
      '<label>' + esc(t('phone')) + '<input name="phone" type="tel" inputmode="tel"></label>' +
      '<label>' + esc(t('onset')) + '<input name="onset" type="date" required value="' + today() + '" max="' + today() + '"></label>' +
      '<label>' + esc(t('fever_dropped_on')) + '<input name="fever" type="date" max="' + today() + '"></label>' +
      '<button type="submit">' + esc(t('save')) + '</button></form></main>';
  }

  function viewSettings() {
    var s = S.settings;
    return header(t('settings'), detailsMissing() ? null : 'inbox') + '<main><form id="f-settings" class="form">' +
      (detailsMissing() ? '<p class="muted">' + esc(t('details_needed')) + '</p>' : '') +
      '<label>' + esc(t('chcp_name')) + '<input name="chcpName" required value="' + esc(s.chcpName) + '"></label>' +
      '<label>' + esc(t('clinic_name')) + '<input name="clinic" required value="' + esc(s.clinic) + '"></label>' +
      '<label>' + esc(t('my_phone')) + '<input name="myPhone" type="tel" required value="' + esc(s.myPhone) + '"></label>' +
      '<button type="submit">' + esc(t('save')) + '</button></form>' +
      (detailsMissing() ? '' : '<h2>' + esc(t('learning_export')) + '</h2>' +
        '<label class="radio"><input type="checkbox" id="consent"' + (S.consent ? ' checked' : '') + '> ' + esc(t('learning_consent')) + '</label>' +
        '<button data-act="learning-export"' + (S.consent ? '' : ' disabled') + '>' + esc(t('learning_export')) + '</button>') +
      '</main>';
  }

  function outcomeLine(m) {
    if (m.type === 'missed_call') return '<span class="pill amber">' + esc(t('missed_call')) + '</span>';
    if (m.type === 'note') return '<span class="pill">' + esc(t('own_note')) + '</span>';
    var hasLabels = Object.keys(m.bands || {}).length > 0;
    if (m.outcome === 'not_understood' && !hasLabels) return '<span class="pill amber">' + esc(t('not_understood')) + '</span>';
    if (m.outcome === 'no_warning_sign') return '<span class="pill green">' + esc(t('no_warning')) + '</span>';
    var raw = m.text ? AageModel.predict(S.model, m.text) : {};
    return Object.keys(m.bands || {}).map(function (k) {
      var d = (m.decisions || {})[k];
      var cls = d === 'confirmed' ? 'confirmed' : d === 'rejected' ? 'rejected' : m.bands[k];
      var mark = d === 'confirmed' ? '✓ ' : d === 'rejected' ? '✗ ' : '? ';
      var score = m.bands[k] !== 'manual' && raw[k] != null ? ' <span class="raw-score">' + raw[k].toFixed(2) + '</span>' : '';
      return '<span class="pill ' + cls + ' ' + labelKind(k) + '">' + mark + esc(labelName(k)) + score + '</span>';
    }).join(' ');
  }

  // Small context tags under a message, for judges: script and area. Never a dialect name,
  // because the demo messages are not dialect samples.
  var DIVISION = { Pirojpur: 'Barishal division' };
  function messageTags(p, m) {
    if (m.type !== 'sms' || !m.text) return '';
    var script = AageModel.detectScript(m.text);
    var scriptTag = script === 'banglish' ? 'Banglish · Bangla in Latin letters'
      : script === 'bn' ? (I18N.getLang() === 'en' ? 'Bangla script' : 'বাংলা হরফ · Bangla script') : 'Mixed';
    var area = S.fac.upazila + ', ' + S.fac.district + (DIVISION[S.fac.district] ? ' (' + DIVISION[S.fac.district] + ')' : '');
    var open = S.infoOpen === m.id;
    return '<div class="tags"><span class="tag">' + esc(scriptTag) + '</span>' +
      (script === 'banglish' ? '<button class="info" data-act="info" data-id="' + esc(m.id) + '" aria-expanded="' + open + '" aria-label="' + esc(t('about_banglish')) + '">ⓘ</button>' : '') +
      '<span class="tag">' + esc(area) + '</span>' +
      (open ? '<p class="info-line">' + esc(t('banglish_info')) + '</p>' : '') + '</div>';
  }

  function viewPatient() {
    var p = S.current, u = urgency(p), day = illnessDay(p), signs = confirmedSigns(p);
    var tel = p.phone ? '<a class="btn red" href="tel:' + esc(p.phone) + '" data-act="log" data-type="call">' + esc(t('call_now')) + '</a>'
      : '<button class="btn" disabled>' + esc(t('call_now')) + ' · ' + esc(t('no_phone')) + '</button>';
    var msgs = (p.messages || []).slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (m) {
      return '<li class="bubble ' + (m.type || '') + '"><button class="msg" data-act="msg" data-id="' + esc(m.id) + '">' +
        '<span class="time">' + esc(when(m.ts)) + '</span>' +
        (m.text ? '<span class="text">' + esc(m.text) + '</span>' : '') +
        (m.gloss && I18N.getLang() === 'en' ? '<span class="gloss">' + esc(m.gloss) + '</span>' : '') +
        '<span class="outcome">' + outcomeLine(m) + '</span></button>' + messageTags(p, m) + '</li>';
    }).join('');
    return header(p.code, 'inbox') + '<main>' +
      '<div class="card patient-card tier-' + u.tier + '">' +
      '<div class="pc-head"><span class="code-badge">' + esc(p.code.split(' ')[0]) + '</span>' +
      '<div class="pc-title"><div class="big">' + esc(p.code) + '</div>' +
      (p.feverDroppedOn ? '<div class="muted small">' + esc(t('fever_dropped_badge', { d: p.feverDroppedOn })) + '</div>' : '') + '</div>' +
      (day ? '<span class="day-pill">' + esc(t('illness_day', { n: day })) + '</span>' : '') + '</div>' +
      '<div class="pc-boxes"><div class="pc-box"><small>' + esc(t('union')) + '</small><b>' + esc(unionName(p)) + '</b></div>' +
      '<div class="pc-box tier-box ' + u.tier + '"><small>' + esc(t('tier_' + u.tier)) + '</small><b>' + esc(u.why || t('tier_' + u.tier)) + '</b></div></div>' +
      '<div>' + esc(p.untested ? t('status_untested') : t('status_tested')) + '</div>' +
      (p.untested ? '<div class="muted small">' + esc(t('suggested')) + ': ' + esc(I18N.getLang() === 'en' ? fillEn('test_reminder') : fill('test_reminder')) + '</div>' : '') +
      '<div class="signs"><b>' + esc(t('confirmed_signs')) + ':</b> ' +
      (signs.length ? signs.map(function (k) { return esc(labelName(k)); }).join(', ') : esc(t('none_yet'))) + '</div></div>' +
      latestEvaluation(p) +
      '<div class="actions">' + tel +
      '<button data-act="log" data-type="visit">' + esc(t('visit_today')) + '</button>' +
      '<button class="red" data-act="nav" data-to="refer">' + esc(t('refer')) + '</button>' +
      '<button data-act="nav" data-to="sms">' + esc(t('send_sms')) + '</button>' +
      '<button data-act="nav" data-to="add_message">' + esc(t('add_message')) + '</button>' +
      (openReferral(p) ? '<button class="green" data-act="arrived">' + esc(t('arrived')) + '</button>' : '') +
      (p.untested ? '<button class="green" data-act="tested">' + esc(t('mark_tested')) + '</button>' : '') + '</div>' +
      '<h2>' + esc(t('messages')) + '</h2><ul class="msgs">' + msgs + '</ul></main>';
  }

  function viewAddMessage() {
    return header(t('add_message'), 'patient') + '<main class="form">' +
      '<label>' + esc(t('paste_here')) + '<textarea id="sms-text" rows="4">' + esc(S.sharedText || '') + '</textarea></label>' +
      '<button data-act="read">' + esc(t('read_message')) + '</button>' +
      '<button class="amber" data-act="missed">' + esc(t('missed_call')) + '</button>' +
      '<label>' + esc(t('own_note')) + '<textarea id="note-text" rows="3"></textarea></label>' +
      '<button class="ghost" data-act="note">' + esc(t('save_note')) + '</button></main>';
  }

  function labelCard(m, k, raw, act) {
    var d = (m.decisions || {})[k], b = m.bands[k];
    var badge = b === 'manual' ? t('added_by_you') : d ? t(d) : (b === 'sure' ? t('suggested') : t('unsure'));
    var idAttr = act === 'decide-inline' ? ' data-id="' + esc(m.id) + '"' : '';
    return '<div class="chip ' + b + ' ' + labelKind(k) + (d ? ' ' + d : '') + '">' +
      '<div class="chip-head"><div class="chip-label">' + esc(labelName(k)) + '</div>' +
      '<span class="band-badge">' + esc(badge) + '</span>' +
      (raw && b !== 'manual' ? '<span class="raw-score" title="model score">' + raw[k].toFixed(2) + '</span>' : '') + '</div>' +
      (b !== 'manual' ? '<div class="why-words"><span class="why-key">' + esc(t('why_prefix')) + ':</span> ' +
        esc(AageModel.explain(S.model, m.text, k, 3).map(function (w) { return '"' + w + '"'; }).join(', ')) + '</div>' : '') +
      '<div class="chip-actions">' +
      '<button class="yes" data-act="' + act + '"' + idAttr + ' data-k="' + k + '" data-v="confirmed" aria-pressed="' + (d === 'confirmed') + '">✓ ' + esc(t('confirm_btn')) + '</button>' +
      '<button class="no" data-act="' + act + '"' + idAttr + ' data-k="' + k + '" data-v="rejected" aria-pressed="' + (d === 'rejected') + '">✗ ' + esc(t('reject_btn')) + '</button></div></div>';
  }

  // Patient screen: the latest family message and the model's labels for it, confirmable in place.
  function latestEvaluation(p) {
    var sms = (p.messages || []).filter(function (m) { return m.type === 'sms' && m.text; })
      .sort(function (a, b) { return b.ts - a.ts; })[0];
    if (!sms) return '';
    var keys = Object.keys(sms.bands || {}), raw = AageModel.predict(S.model, sms.text);
    var note = !keys.length && sms.outcome === 'not_understood' ? '<p class="pill amber big">' + esc(t('not_understood')) + '</p>'
      : sms.outcome === 'no_warning_sign' ? '<p class="pill green big">' + esc(t('no_warning')) + '</p>' : '';
    return '<section class="card eval"><h2>' + esc(t('incoming_sms')) + ' <span class="time">' + esc(when(sms.ts)) + '</span></h2>' +
      '<blockquote class="bubble-quote">' + esc(sms.text) + (sms.gloss && I18N.getLang() === 'en' ? '<span class="gloss">' + esc(sms.gloss) + '</span>' : '') + '</blockquote>' +
      messageTags(p, sms).replace('class="tags"', 'class="tags inline"') +
      '<h2>' + esc(t('model_evaluation')) + '</h2>' +
      (sms.unfamiliar ? '<p class="pill amber big">' + esc(t('unfamiliar')) + '</p>' : '') + note +
      keys.map(function (k) { return labelCard(sms, k, raw, 'decide-inline'); }).join('') +
      '<button class="ghost" data-act="msg" data-id="' + esc(sms.id) + '">' + esc(t('add_yourself')) + '</button></section>';
  }

  function viewLabels() {
    var m = S.draft, keys = Object.keys(m.bands);
    var raw = AageModel.predict(S.model, m.text);
    var chips = keys.map(function (k) { return labelCard(m, k, raw, 'decide'); }).join('');
    var note = m.outcome === 'not_understood' ? '<p class="pill amber big">' + esc(t('not_understood')) + '</p>'
      : m.outcome === 'no_warning_sign' ? '<p class="pill green big">' + esc(t('no_warning')) + '</p>' : '';
    return header(S.current.code, 'patient') + '<main>' +
      '<blockquote class="bubble-quote">' + esc(m.text) + (m.gloss && I18N.getLang() === 'en' ? '<span class="gloss">' + esc(m.gloss) + '</span>' : '') + '</blockquote>' +
      (m.unfamiliar ? '<p class="pill amber big">' + esc(t('unfamiliar')) + '</p>' : '') +
      note + (keys.length ? '<p class="muted small">' + esc(t('tap_to_confirm')) + '</p>' : '') + chips +
      (S.judge && m.isNew && S.lastMs != null && I18N.getLang() === 'en' ? '<p class="facts">Read on this phone in ' + S.lastMs.toFixed(1) + ' ms</p>' : '') +
      pickLabels(m) +
      '<button data-act="labels-done">' + esc(t('done')) + '</button></main>';
  }

  // When the model is unsure or misses, Rina can still pick: the next 2 most likely labels from the
  // fixed list (shown without numbers), or any label from the full list. Picked labels count as confirmed.
  var MAYBE_MIN = 0.15;
  function pickLabels(m) {
    var probs = AageModel.predict(S.model, m.text);
    var all = S.labels.warning_signs.concat(S.labels.status_labels).map(function (l) { return l.key; });
    var rest = all.filter(function (k) { return !m.bands[k]; });
    var maybe = rest.slice().sort(function (a, b) { return probs[b] - probs[a]; })
      .filter(function (k) { return probs[k] >= MAYBE_MIN; }).slice(0, 2);
    var btn = function (src) {
      return function (k) {
        return '<button class="pick ' + src + '" data-act="add-label" data-src="' + src + '" data-k="' + k + '">+ ' + esc(labelName(k)) + '</button>';
      };
    };
    return '<div class="picker">' +
      (maybe.length ? '<h2>' + esc(t('maybe_these')) + '</h2><div class="pick-list">' + maybe.map(btn('maybe')).join('') + '</div>' : '') +
      '<button class="ghost pick-toggle" data-act="toggle-all" aria-expanded="' + !!S.showAllLabels + '">' +
      esc(t('add_yourself')) + (S.showAllLabels ? ' ▲' : ' ▼') + '</button>' +
      (S.showAllLabels ? '<div class="pick-list">' + rest.filter(function (k) { return maybe.indexOf(k) === -1; }).map(btn('human')).join('') + '</div>' : '') +
      '</div>';
  }

  function viewSms() {
    var p = S.current, keys = ['daily', 'window', 'callback', 'not_understood', 'enrol', 'refer', 'test_reminder', 'home_care', 'water_containers'];
    var fac = S.smsKey === 'refer' ? nearestFacility(p).f : null;
    var body = fill(S.smsKey, null, fac);
    var number = S.judge ? '' : p.phone;
    return header(t('send_sms'), 'patient') + '<main class="form">' +
      '<label>' + esc(t('choose_template')) + '<select id="tpl">' + keys.map(function (k) {
        var label = I18N.getLang() === 'en' && S.templates._names_en ? S.templates._names_en[k] : k;
        return '<option value="' + k + '"' + (k === S.smsKey ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('') + '</select></label>' +
      '<blockquote class="sms-body">' + esc(body) + translationLine(S.smsKey, null, fac) + '</blockquote>' +
      '<a class="btn" href="' + esc(smsHref(number, body)) + '" data-act="log" data-type="sms" data-detail="' + S.smsKey + '">' + esc(t('open_sms_app')) + '</a>' +
      '<p class="muted small">' + esc(t('sms_note')) + '</p></main>';
  }

  function viewRefer() {
    var p = S.current, n = nearestFacility(p), f = n.f;
    var patientBody = fill('refer', null, f), note = fill('referral_note', p, f);
    var facPhone = f.phone ? (S.judge ? '<span>' + esc(maskPhone(f.phone)) + '</span>' : '<a href="tel:' + esc(f.phone) + '">' + esc(f.phone) + '</a>') : esc(t('number_unverified'));
    var noteBtn = detailsMissing()
      ? '<p class="err">' + esc(t('details_needed')) + '</p><button data-act="nav" data-to="settings">' + esc(t('settings')) + '</button>'
      : f.phone && !S.judge
      ? '<a class="btn" href="' + esc(smsHref(f.phone, note)) + '" data-act="log" data-type="sms" data-detail="referral_note">' + esc(t('send_note')) + '</a>'
      : '<button data-act="copy" data-text="' + esc(note) + '">' + esc(t('copy_note')) + '</button>';
    return header(t('refer'), 'patient') + '<main>' +
      '<div class="card facility"><div class="big">' + esc(I18N.getLang() === 'bn' ? f.name_bn : f.name) + '</div>' +
      '<div>' + esc(f.type) + ' · ' + esc(t('straight_line', { km: n.km.toFixed(1) })) + '</div>' +
      '<div>' + facPhone + '</div>' +
      (f.admits_dengue === 'assumed' ? '<div class="muted small">' + esc(t('admission_unverified')) + '</div>' : '') +
      '<div class="links"><a href="geo:' + f.lat + ',' + f.lon + '">geo:</a> · ' +
      '<a href="https://www.google.com/maps?q=' + f.lat + ',' + f.lon + '" target="_blank" rel="noopener">Google Maps</a></div></div>' +
      '<h2>' + esc(t('referral_note')) + '</h2>' + (detailsMissing() ? '' : '<blockquote class="sms-body">' + esc(note) + translationLine('referral_note', p, f) + '</blockquote>') + noteBtn +
      '<h2>' + esc(t('sms_to_family')) + '</h2><blockquote class="sms-body">' + esc(patientBody) + translationLine('refer', null, f) + '</blockquote>' +
      '<a class="btn" href="' + esc(smsHref(S.judge ? '' : p.phone, patientBody)) + '" data-act="log" data-type="sms" data-detail="refer">' + esc(t('open_sms_app')) + '</a>' +
      '<button class="red" data-act="refer-log" data-fac="' + esc(f.id) + '">' + esc(t('log_refer')) + '</button></main>';
  }

  // ---------- About (static text from Nasim, one language at a time) ----------
  var ABOUT = {
    en: [
      ['p', '<b>Aage Ke? (আগে কে?)</b> means "who first?"'],
      ['lead', 'An offline phone tool that tells a community health worker which of her dengue patients at home needs her first.'],
      ['h', 'Why we built it'],
      ['ul', ['256 people died of dengue in Bangladesh in 2026 up to 3 October (DGHS).',
              'In DGHS\'s 2025 death review, 66 of 114 deaths happened within 24 hours of reaching hospital. Families often arrive too late.',
              'WHO advises that people with dengue cared for at home are reviewed every day until the critical phase is over. In villages, nobody does that daily check.']],
      ['h', 'Who it helps'],
      ['ul', ['<b>The family:</b> they text in their own words, or give a free missed call. No app, no internet.',
              '<b>The community health worker:</b> one list, sorted by who needs her first, showing why. She confirms every suggestion and decides.',
              '<b>The hospital:</b> a short referral note with the illness day and the signs already seen, so the family does not repeat everything.',
              '<b>The health system:</b> home-managed cases leave a DHIS2-shaped record instead of disappearing.']],
      ['h', 'The journey'],
      ['ol', ['Fever in the house. The health worker adds the person ("fever, not tested yet") and sends a test reminder and home-care SMS.',
              'After a test, she switches the status, and the app watches the danger days after the fever falls.',
              'The family texts, for example "pet e khub betha, 2 bar bomi korse". She shares the SMS into the app.',
              'A small on-device model suggests signs from a fixed list of 8 warning signs, or says "not sure" or "call them".',
              'She confirms. The list re-sorts: red, amber, green. Silence in the danger days turns amber.',
              'On red, she sees the nearest facility that admits dengue patients and a pre-written SMS. She presses send herself.']],
      ['h', 'What the AI does, and does not'],
      ['p', 'It reads messy Bangla and Banglish and picks from a fixed list. It never writes advice, never sends anything, never diagnoses. Everything else is plain code. A person decides.'],
      ['h', 'How we tested it'],
      ['p', 'On real messages written by volunteers from 5 districts and on 80 real public Bangla health posts, plus a separate synthetic stress test. See the results in the README.'],
      ['p', 'On 103 real messages and posts it never saw, it missed 20% of danger messages, against 47% for keyword search. When it says \'sure\', it is right 89% of the time.'],
      ['facts', 'Model facts: 443 KB · runs on the phone · no internet · no LLM · 12 fixed labels.']
    ],
    bn: [
      ['p', '<b>আগে কে?</b> মানে "কাকে আগে দেখতে হবে?"'],
      ['lead', 'এক লাইনে: ইন্টারনেট ছাড়াই চলা একটা ফোন-টুল, যা কমিউনিটি স্বাস্থ্যকর্মীকে বলে দেয় বাসায় থাকা ডেঙ্গু রোগীদের মধ্যে কার কাছে আগে যেতে হবে।'],
      ['p', '<b>কেন বানালাম:</b> ২০২৬ সালে ৩ অক্টোবর পর্যন্ত ডেঙ্গুতে ২৫৬ জন মারা গেছেন (স্বাস্থ্য অধিদপ্তর)। ২০২৫ সালের মৃত্যু পর্যালোচনায় ১১৪ জনের মধ্যে ৬৬ জন হাসপাতালে পৌঁছানোর ২৪ ঘণ্টার মধ্যে মারা গেছেন। WHO বলে, বাসায় থাকা রোগীকে বিপদের দিনগুলো পার না হওয়া পর্যন্ত প্রতিদিন দেখতে হবে। গ্রামে এই রোজকার খোঁজ কেউ নেয় না।'],
      ['p', '<b>কার উপকার:</b> পরিবার নিজের ভাষায় SMS বা ফ্রি মিসড কল দেয়। স্বাস্থ্যকর্মী একটা সাজানো তালিকা পান, কারণসহ, আর সিদ্ধান্ত নেন নিজে। হাসপাতাল পায় রোগের দিন আর লক্ষণসহ রেফারেল নোট। আর বাসায় থাকা রোগীরাও রেকর্ডে আসেন।'],
      ['p', '<b>AI কী করে:</b> এলোমেলো বাংলা আর Banglish পড়ে, ৮টা নির্দিষ্ট সতর্কসংকেতের তালিকা থেকে বাছে। নিজে কোনো পরামর্শ লেখে না, কিছু পাঠায় না, রোগ নির্ণয় করে না। সিদ্ধান্ত মানুষের।'],
      ['p', 'আগে কখনো দেখেনি এমন ১০৩টা আসল মেসেজ আর পোস্টে এটি বিপদের মেসেজের ২০% মিস করেছে, আর শুধু শব্দ খোঁজার পদ্ধতি মিস করেছে ৪৭%। যখন এটি \'নিশ্চিত\' বলে, ১০ বারের মধ্যে ৯ বার ঠিক হয়।'],
      ['facts', 'অন-ডিভাইস · 443 KB · ইন্টারনেট ছাড়া']
    ]
  };
  // The text above is fixed, trusted copy (no user input), so it is inserted as HTML.
  function viewAbout() {
    var blocks = ABOUT[I18N.getLang()] || ABOUT.en;
    return header(t('about_title'), S.aboutFrom || 'pin') + '<main class="about">' + blocks.map(function (b) {
      if (b[0] === 'h') return '<h2>' + b[1] + '</h2>';
      if (b[0] === 'lead') return '<p class="lead">' + b[1] + '</p>';
      if (b[0] === 'facts') return '<p class="facts">' + b[1] + '</p>';
      if (b[0] === 'ul' || b[0] === 'ol') return '<' + b[0] + '>' + b[1].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</' + b[0] + '>';
      return '<p>' + b[1] + '</p>';
    }).join('') + '</main>';
  }

  var VIEWS = { pin: viewPin, inbox: viewInbox, add_patient: viewAddPatient, settings: viewSettings, patient: viewPatient,
    add_message: viewAddMessage, labels: viewLabels, sms: viewSms, refer: viewRefer, about: viewAbout };
  function render() { $app.innerHTML = VIEWS[S.view](); renderLang(); }

  // ---------- language switch: fixed segmented control, remembered on this device ----------
  var $lang = document.getElementById('lang-switch');
  function savedLang() { try { return localStorage.getItem('aageke-lang'); } catch (e) { return null; } }
  function setLanguage(l) {
    I18N.setLang(l);
    try { localStorage.setItem('aageke-lang', l); } catch (e) { /* private mode: choice lasts this session */ }
  }
  function renderLang() {
    var cur = I18N.getLang();
    $lang.innerHTML = [['bn', 'বাংলা'], ['en', 'English']].map(function (o) {
      return '<button data-act="lang" data-lang="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"' +
        (o[0] === 'bn' ? ' lang="bn"' : ' lang="en"') + '>' + o[1] + '</button>';
    }).join('');
  }
  $lang.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b && b.dataset.lang !== I18N.getLang()) { setLanguage(b.dataset.lang); render(); }
  });
  if (savedLang()) I18N.setLang(savedLang());

  // ---------- export (DHIS2-shaped, docs/01 §9) ----------
  function exportEvents() {
    var events = [];
    S.patients.forEach(function (p) {
      (p.actions || []).filter(function (a) { return a.type === 'refer'; }).forEach(function (a) {
        events.push({
          program: 'PLACEHOLDER_dengue_home_followup', orgUnit: 'PLACEHOLDER_community_clinic', eventDate: isoDate(a.ts),
          dataValues: [
            { dataElement: 'illness_day', value: String(a.illnessDay) },
            { dataElement: 'warning_signs_confirmed', value: a.signs.join(';') },
            { dataElement: 'action', value: 'refer' },
            { dataElement: 'referred_to', value: a.detail }
          ]
        });
      });
    });
    var blob = new Blob([JSON.stringify({ events: events }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'aageke_events_' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- events ----------
  function logAction(type, detail, extra) {
    var p = S.current;
    p.actions = p.actions || [];
    p.actions.push(Object.assign({ ts: Date.now(), type: type, detail: detail || '' }, extra || {}));
    return save(p);
  }
  function addMessage(msg) {
    var p = S.current;
    p.messages = p.messages || [];
    p.messages.push(msg);
    return save(p);
  }

  $app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'pin') return pinDigit(el.dataset.d);
    if (act === 'judge') return startJudge();
    if (act === 'home') { S.current = null; return go(S.judge || Store.encrypted() ? 'inbox' : 'pin'); }
    if (act === 'about') { S.aboutFrom = S.view === 'about' ? S.aboutFrom : S.view; return go('about'); }
    if (act === 'info') { S.infoOpen = S.infoOpen === el.dataset.id ? null : el.dataset.id; return render(); }
    if (act === 'lock') { S.current = null; S.patients = []; S.settings = {}; S.judge = false; Store.use('idb'); return go('pin'); }
    if (act === 'nav' && el.dataset.to === 'sms') S.smsKey = S.current && S.current.untested ? 'test_reminder' : 'daily';
    if (act === 'back' || act === 'nav') return go(el.dataset.to);
    if (act === 'open') {
      S.current = S.patients.filter(function (p) { return p.id === el.dataset.id; })[0];
      return go(S.sharedText ? 'add_message' : 'patient');
    }
    if (act === 'export') return exportEvents();
    if (act === 'learning-export') return S.consent ? exportLearning() : null;
    if (act === 'log') {
      if (el.dataset.type === 'visit') { logAction('visit').then(render); return alertNote(t('visit_logged')); }
      return logAction(el.dataset.type, el.dataset.detail); // let the tel:/sms: link open
    }
    if (act === 'read') {
      var text = document.getElementById('sms-text').value.trim();
      if (!text) return;
      var a = analyse(text);
      S.sharedText = null;
      S.showAllLabels = false;
      S.draft = { id: uid(), ts: Date.now(), type: 'sms', text: text, bands: a.bands, outcome: a.outcome, unfamiliar: a.unfamiliar, decisions: {}, isNew: true };
      return go('labels');
    }
    if (act === 'missed') return addMessage({ id: uid(), ts: Date.now(), type: 'missed_call', text: '', decisions: {} }).then(function () { go('patient'); });
    if (act === 'note') {
      var note = document.getElementById('note-text').value.trim();
      if (!note) return;
      return addMessage({ id: uid(), ts: Date.now(), type: 'note', text: note, decisions: {} }).then(function () { go('patient'); });
    }
    if (act === 'msg') {
      var m = S.current.messages.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!m || m.type !== 'sms') return;
      S.draft = JSON.parse(JSON.stringify(m));
      S.draft.decisions = S.draft.decisions || {};
      return go('labels');
    }
    if (act === 'decide-inline') {
      var pi = S.current, mi = pi.messages.filter(function (x) { return x.id === el.dataset.id; })[0];
      mi.decisions = mi.decisions || {};
      if (mi.decisions[el.dataset.k] === el.dataset.v) delete mi.decisions[el.dataset.k];
      else mi.decisions[el.dataset.k] = el.dataset.v;
      if (mi.decisions.fever_dropped === 'confirmed' && !pi.feverDroppedOn) pi.feverDroppedOn = isoDate(mi.ts);
      return save(pi).then(function () { return recordDecisions(mi); }).then(render);
    }
    if (act === 'add-label') {
      S.draft.bands[el.dataset.k] = 'manual';
      S.draft.decisions[el.dataset.k] = 'confirmed';
      S.draft.pickSource = S.draft.pickSource || {};
      S.draft.pickSource[el.dataset.k] = el.dataset.src;
      return render();
    }
    if (act === 'toggle-all') { S.showAllLabels = !S.showAllLabels; return render(); }
    if (act === 'decide' && S.draft.bands[el.dataset.k] === 'manual' && el.dataset.v === 'rejected') {
      delete S.draft.bands[el.dataset.k];
      delete S.draft.decisions[el.dataset.k];
      if (S.draft.pickSource) delete S.draft.pickSource[el.dataset.k];
      return render();
    }
    if (act === 'decide') {
      var k = el.dataset.k, v = el.dataset.v;
      if (S.draft.decisions[k] === v) delete S.draft.decisions[k]; else S.draft.decisions[k] = v;
      return render();
    }
    if (act === 'labels-done') {
      var d = S.draft, p = S.current, isNew = d.isNew;
      delete d.isNew;
      if (d.decisions.fever_dropped === 'confirmed' && !p.feverDroppedOn) p.feverDroppedOn = isoDate(d.ts);
      if (isNew) p.messages.push(d);
      else p.messages = p.messages.map(function (x) { return x.id === d.id ? d : x; });
      return save(p).then(function () { return recordDecisions(d); }).then(function () { go('patient'); });
    }
    if (act === 'arrived') return logAction('arrived').then(render);
    if (act === 'tested') { S.current.untested = false; return logAction('tested').then(render); }
    if (act === 'refer-log') {
      var pt = S.current;
      return logAction('refer', el.dataset.fac, { illnessDay: illnessDay(pt), signs: confirmedSigns(pt) }).then(function () { go('patient'); });
    }
    if (act === 'copy') {
      var txt = el.dataset.text;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { alertNote(t('copied')); });
      return;
    }
  });

  $app.addEventListener('change', function (e) {
    if (e.target.id === 'tpl') { S.smsKey = e.target.value; render(); }
    if (e.target.id === 'consent') { S.consent = e.target.checked; render(); }
  });

  $app.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(e.target);
    if (e.target.id === 'f-patient') {
      var p = {
        id: uid(), code: f.get('code').trim(), union: f.get('union'), phone: f.get('phone').trim(),
        onset: f.get('onset'), feverDroppedOn: f.get('fever') || null, added: Date.now(), messages: [], actions: [],
        untested: f.get('status') === 'untested'
      };
      S.current = p;
      return save(p).then(function () { go('patient'); });
    }
    if (e.target.id === 'f-settings') {
      S.settings = { chcpName: f.get('chcpName'), clinic: f.get('clinic'), myPhone: f.get('myPhone') };
      return Store.setProfile(S.settings).then(function () { go('inbox'); });
    }
  });

  // ---------- learning data (D-lite): decisions only, kept encrypted on the phone ----------
  // One row per message and label: {text, label, decision, date}. Leaves the phone only through
  // the consent-gated CSV export in My details.
  function recordDecisions(m) {
    return Store.getBox('learning').then(function (rows) {
      rows = rows || {};
      Object.keys(m.decisions || {}).forEach(function (k) {
        var src = (m.bands || {})[k] !== 'manual' ? 'model_suggested'
          : (m.pickSource || {})[k] === 'maybe' ? 'model_maybe' : 'human_added';
        rows[m.id + '|' + k] = { text: m.text, label: k, decision: m.decisions[k], source: src, date: isoDate(m.ts) };
      });
      return Store.setBox('learning', rows);
    });
  }
  function csvCell(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
  function exportLearning() {
    return Store.getBox('learning').then(function (rows) {
      var list = Object.keys(rows || {}).map(function (k) { return rows[k]; });
      var csv = 'text,label,decision,source,date\n' + list.map(function (r) {
        return [r.text, r.label, r.decision, r.source || 'model_suggested', r.date].map(csvCell).join(',');
      }).join('\n') + '\n';
      var a = document.createElement('a');
      // The byte-order mark lets spreadsheet apps read the Bangla text as UTF-8.
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
      a.download = 'aageke_learning_' + today() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  function alertNote(msg) {
    var n = document.createElement('div');
    n.className = 'toast'; n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1800);
  }

  // ---------- boot ----------
  // Web Share Target: an SMS shared into the app arrives as ?text=... (manifest share_target).
  (function () {
    var q = new URLSearchParams(location.search), shared = q.get('text') || q.get('title');
    if (shared) { S.sharedText = shared.trim(); history.replaceState(null, '', location.pathname); }
  })();
  function getJSON(u) { return fetch(u).then(function (r) { return r.json(); }); }
  var modelText = fetch('model_dengue.json').then(function (r) { return r.text(); }).then(function (txt) {
    S.modelBytes = new Blob([txt]).size;
    return JSON.parse(txt);
  });
  Promise.all([modelText, getJSON('labels_dengue.json'), getJSON('templates.json'), getJSON('facilities.json')])
    .then(function (r) {
      S.model = r[0]; S.labels = r[1]; S.templates = r[2]; S.fac = r[3];
      S.rules = new AageRules.Rules(S.labels);
      return Promise.all([Store.getSetting('lock'), Store.getSetting('pin')]).catch(function () { return []; });
    })
    .then(function (v) { S.hasPin = !!(v[0] || v[1]); render(); });

  window.addEventListener('online', function () { if (S.model) render(); });
  window.addEventListener('offline', function () { if (S.model) render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  window.AageApp = { state: S, urgency: urgency, nearestFacility: nearestFacility, fill: fill };
})();
