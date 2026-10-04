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
  function maskPhone(n) { return n ? n.slice(0, -6) + '••••••' : n; }
  function shownPhone(n) { return S.judge ? maskPhone(n) : n; }
  function smsHref(number, body) { return 'sms:' + (number || '') + '?body=' + encodeURIComponent(body); }

  // ---------- AI + rules ----------
  function analyse(text) {
    var probs = AageModel.predict(S.model, text);
    var bands = AageRules.applyRules(probs, S.rules.analyse(text), S.labels.bands);
    return { bands: bands, outcome: AageRules.outcome(bands, warningKeys()) };
  }

  // ---------- urgency (confirmed labels only, docs/01 §6) ----------
  function lastHandled(p) {
    return (p.actions || []).filter(function (a) { return a.type !== 'sms'; })
      .reduce(function (m, a) { return Math.max(m, a.ts); }, 0);
  }
  function confirmedIn(m, k) { return m.decisions && m.decisions[k] === 'confirmed'; }
  function urgency(p) {
    var since = lastHandled(p), wk = warningKeys();
    var pending = (p.messages || []).filter(function (m) { return m.ts > since; })
      .sort(function (a, b) { return a.ts - b.ts; });
    var red = pending.filter(function (m) { return wk.some(function (k) { return confirmedIn(m, k); }); });
    if (red.length) return { tier: 'red', why: t('why_red'), ts: red[0].ts };
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
  function pinDigit(d) {
    if (d === 'del') S.pinEntry = S.pinEntry.slice(0, -1);
    else if (S.pinEntry.length < 4) S.pinEntry += d;
    S.pinError = false;
    if (S.pinEntry.length < 4) return render();
    var entered = S.pinEntry; S.pinEntry = '';
    Store.getSetting('pin').then(function (stored) {
      if (!stored) {
        var salt = uid();
        return hashPin(entered, salt).then(function (h) { return Store.setSetting('pin', { salt: salt, hash: h }); }).then(unlock);
      }
      return hashPin(entered, stored.salt).then(function (h) {
        if (h === stored.hash) unlock(); else { S.pinError = true; render(); }
      });
    });
  }
  function unlock() {
    S.hasPin = true;
    return Promise.all(['chcpName', 'clinic', 'myPhone'].map(function (k) { return Store.getSetting(k); }))
      .then(function (v) { S.settings = { chcpName: v[0], clinic: v[1], myPhone: v[2] }; return load(); })
      .then(function () { go('inbox'); });
  }

  // ---------- judge mode (CC5) ----------
  function startJudge() {
    S.judge = true;
    Store.use('memory');
    I18N.setLang('en');
    fetch('demo_data.json').then(function (r) { return r.json(); }).then(function (demo) {
      S.settings = demo.chcp;
      var now = Date.now();
      return Promise.all(demo.patients.map(function (d) {
        var p = {
          id: d.code, code: d.code, union: d.union, phone: '', added: now - (d.illness_day + 1) * DAY,
          onset: isoDate(now - (d.illness_day - 1) * DAY),
          feverDroppedOn: d.fever_dropped_days_ago != null ? isoDate(now - d.fever_dropped_days_ago * DAY) : null,
          messages: [], actions: []
        };
        d.messages.forEach(function (m) {
          var ts = new Date(now - m.days_ago * DAY).setHours(m.hour, 0, 0, 0);
          if (ts > now) ts = now - 60000;
          var a = analyse(m.text), decisions = {};
          (m.confirm || []).forEach(function (k) { if (a.bands[k]) decisions[k] = 'confirmed'; });
          p.messages.push({ id: uid(), ts: ts, type: 'sms', text: m.text, gloss: m.gloss, bands: a.bands, outcome: a.outcome, decisions: decisions });
        });
        return Store.put(p);
      }));
    }).then(load).then(function () { go('inbox'); });
  }

  // ---------- views ----------
  function header(title, back) {
    return '<header class="bar">' +
      (back ? '<button class="ghost" data-act="back" data-to="' + back + '">←</button>' : '') +
      '<h1>' + esc(title) + '</h1>' +
      '<button class="ghost small" data-act="lang">' + esc(t('lang_toggle')) + '</button>' +
      '</header>' + (S.judge ? '<div class="banner">' + esc(t('demo_banner')) + '</div>' : '');
  }

  function viewPin() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    return '<div class="pin">' +
      '<div class="brand">' + esc(t('app_name')) + '</div>' +
      '<p class="muted" id="pin-title">' + esc(S.hasPin ? t('pin_title') : t('pin_set_title')) + '</p>' +
      '<div class="dots">' + [0, 1, 2, 3].map(function (i) { return '<span class="' + (i < S.pinEntry.length ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
      (S.pinError ? '<p class="err">' + esc(t('pin_wrong')) + '</p>' : '') +
      '<div class="keys">' + keys.map(function (k) {
        return k ? '<button data-act="pin" data-d="' + k + '">' + (k === 'del' ? '⌫' : k) + '</button>' : '<span></span>';
      }).join('') + '</div>' +
      '<p class="muted small">' + esc(t('pin_note')) + '</p>' +
      '<button class="judge" data-act="judge">' + esc(t('judge_button')) + '</button>' +
      '<button class="ghost small" data-act="lang">' + esc(t('lang_toggle')) + '</button>' +
      '</div>';
  }

  function viewInbox() {
    var rows = S.patients.map(function (p) { return { p: p, u: urgency(p) }; });
    var html = header(t('app_name')) + '<main>';
    ['red', 'amber', 'green'].forEach(function (tier) {
      var list = rows.filter(function (r) { return r.u.tier === tier; }).sort(function (a, b) { return a.u.ts - b.u.ts; });
      html += '<section class="tier ' + tier + '"><h2>' + esc(t('tier_' + tier)) + ' <span class="count">' + list.length + '</span></h2>';
      list.forEach(function (r) {
        var p = r.p, day = illnessDay(p);
        html += '<button class="row" data-act="open" data-id="' + esc(p.id) + '">' +
          '<span class="code">' + esc(p.code) + '</span>' +
          '<span class="meta">' + esc(p.union) + (day ? ' · ' + esc(t('illness_day', { n: day })) : '') + '</span>' +
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
    var unions = S.fac.unions.map(function (u) { return '<option value="' + esc(u.name) + '">' + esc(u.name) + ' · ' + esc(u.name_bn) + '</option>'; }).join('');
    return header(t('add_patient'), 'inbox') + '<main><form id="f-patient" class="form">' +
      '<label>' + esc(t('code')) + '<input name="code" required autocomplete="off"></label>' +
      '<label>' + esc(t('union')) + '<select name="union">' + unions + '</select></label>' +
      '<label>' + esc(t('phone')) + '<input name="phone" type="tel" inputmode="tel"></label>' +
      '<label>' + esc(t('onset')) + '<input name="onset" type="date" required value="' + today() + '" max="' + today() + '"></label>' +
      '<label>' + esc(t('fever_dropped_on')) + '<input name="fever" type="date" max="' + today() + '"></label>' +
      '<button type="submit">' + esc(t('save')) + '</button></form></main>';
  }

  function viewSettings() {
    var s = S.settings;
    return header(t('settings'), 'inbox') + '<main><form id="f-settings" class="form">' +
      '<label>' + esc(t('chcp_name')) + '<input name="chcpName" value="' + esc(s.chcpName) + '"></label>' +
      '<label>' + esc(t('clinic_name')) + '<input name="clinic" value="' + esc(s.clinic) + '"></label>' +
      '<label>' + esc(t('my_phone')) + '<input name="myPhone" type="tel" value="' + esc(s.myPhone) + '"></label>' +
      '<button type="submit">' + esc(t('save')) + '</button></form></main>';
  }

  function outcomeLine(m) {
    if (m.type === 'missed_call') return '<span class="pill amber">' + esc(t('missed_call')) + '</span>';
    if (m.type === 'note') return '<span class="pill">' + esc(t('own_note')) + '</span>';
    if (m.outcome === 'not_understood') return '<span class="pill amber">' + esc(t('not_understood')) + '</span>';
    if (m.outcome === 'no_warning_sign') return '<span class="pill green">' + esc(t('no_warning')) + '</span>';
    return Object.keys(m.bands || {}).map(function (k) {
      var d = (m.decisions || {})[k];
      var cls = d === 'confirmed' ? 'confirmed' : d === 'rejected' ? 'rejected' : m.bands[k];
      var mark = d === 'confirmed' ? '✓ ' : d === 'rejected' ? '✗ ' : '? ';
      return '<span class="pill ' + cls + '">' + mark + esc(labelName(k)) + '</span>';
    }).join(' ');
  }

  function viewPatient() {
    var p = S.current, u = urgency(p), day = illnessDay(p), signs = confirmedSigns(p);
    var tel = p.phone ? '<a class="btn red" href="tel:' + esc(p.phone) + '" data-act="log" data-type="call">' + esc(t('call_now')) + '</a>'
      : '<button class="btn" disabled>' + esc(t('call_now')) + ' · ' + esc(t('no_phone')) + '</button>';
    var msgs = (p.messages || []).slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (m) {
      return '<li><button class="msg" data-act="msg" data-id="' + esc(m.id) + '">' +
        '<span class="time">' + esc(when(m.ts)) + '</span>' +
        (m.text ? '<span class="text">' + esc(m.text) + '</span>' : '') +
        (m.gloss && I18N.getLang() === 'en' ? '<span class="gloss">' + esc(m.gloss) + '</span>' : '') +
        '<span class="outcome">' + outcomeLine(m) + '</span></button></li>';
    }).join('');
    return header(p.code, 'inbox') + '<main>' +
      '<div class="card tier-' + u.tier + '"><div class="big">' + esc(p.code) + '</div>' +
      '<div>' + esc(p.union) + (day ? ' · ' + esc(t('illness_day', { n: day })) : '') +
      (p.feverDroppedOn ? ' · ' + esc(t('fever_dropped_badge', { d: p.feverDroppedOn })) : '') + '</div>' +
      (u.why ? '<div class="why">' + esc(u.why) + '</div>' : '') +
      '<div class="signs"><b>' + esc(t('confirmed_signs')) + ':</b> ' +
      (signs.length ? signs.map(function (k) { return esc(labelName(k)); }).join(', ') : esc(t('none_yet'))) + '</div></div>' +
      '<div class="actions">' + tel +
      '<button data-act="log" data-type="visit">' + esc(t('visit_today')) + '</button>' +
      '<button class="red" data-act="nav" data-to="refer">' + esc(t('refer')) + '</button>' +
      '<button data-act="nav" data-to="sms">' + esc(t('send_sms')) + '</button>' +
      '<button data-act="nav" data-to="add_message">' + esc(t('add_message')) + '</button>' +
      (openReferral(p) ? '<button class="green" data-act="arrived">' + esc(t('arrived')) + '</button>' : '') + '</div>' +
      '<h2>' + esc(t('messages')) + '</h2><ul class="msgs">' + msgs + '</ul></main>';
  }

  function viewAddMessage() {
    return header(t('add_message'), 'patient') + '<main class="form">' +
      '<label>' + esc(t('paste_here')) + '<textarea id="sms-text" rows="4"></textarea></label>' +
      '<button data-act="read">' + esc(t('read_message')) + '</button>' +
      '<button class="amber" data-act="missed">' + esc(t('missed_call')) + '</button>' +
      '<label>' + esc(t('own_note')) + '<textarea id="note-text" rows="3"></textarea></label>' +
      '<button class="ghost" data-act="note">' + esc(t('save_note')) + '</button></main>';
  }

  function viewLabels() {
    var m = S.draft, keys = Object.keys(m.bands);
    var chips = keys.map(function (k) {
      var d = m.decisions[k], b = m.bands[k];
      return '<div class="chip ' + b + (d ? ' ' + d : '') + '">' +
        '<div class="chip-label">' + (b === 'sure' ? '✓ ' : '') + esc(labelName(k)) +
        '<small>' + esc(b === 'sure' ? t('suggested') : t('unsure')) + '</small>' +
        (d ? '<small class="state">' + esc(t(d)) + '</small>' : '') + '</div>' +
        '<button class="yes" data-act="decide" data-k="' + k + '" data-v="confirmed" aria-label="' + esc(t('confirm')) + '">✓</button>' +
        '<button class="no" data-act="decide" data-k="' + k + '" data-v="rejected" aria-label="' + esc(t('reject')) + '">✗</button></div>';
    }).join('');
    var note = m.outcome === 'not_understood' ? '<p class="pill amber big">' + esc(t('not_understood')) + '</p>'
      : m.outcome === 'no_warning_sign' ? '<p class="pill green big">' + esc(t('no_warning')) + '</p>' : '';
    return header(S.current.code, 'patient') + '<main>' +
      '<blockquote>' + esc(m.text) + (m.gloss && I18N.getLang() === 'en' ? '<span class="gloss">' + esc(m.gloss) + '</span>' : '') + '</blockquote>' +
      note + (keys.length ? '<p class="muted small">' + esc(t('tap_to_confirm')) + '</p>' : '') + chips +
      '<button data-act="labels-done">' + esc(t('done')) + '</button></main>';
  }

  function viewSms() {
    var p = S.current, keys = ['daily', 'window', 'callback', 'not_understood', 'enrol', 'refer'];
    var fac = S.smsKey === 'refer' ? nearestFacility(p).f : null;
    var body = fill(S.smsKey, null, fac);
    var number = S.judge ? '' : p.phone;
    return header(t('send_sms'), 'patient') + '<main class="form">' +
      '<label>' + esc(t('choose_template')) + '<select id="tpl">' + keys.map(function (k) {
        return '<option value="' + k + '"' + (k === S.smsKey ? ' selected' : '') + '>' + k + '</option>';
      }).join('') + '</select></label>' +
      '<blockquote class="sms-body">' + esc(body) + '</blockquote>' +
      '<a class="btn" href="' + esc(smsHref(number, body)) + '" data-act="log" data-type="sms" data-detail="' + S.smsKey + '">' + esc(t('open_sms_app')) + '</a>' +
      '<p class="muted small">' + esc(t('sms_note')) + '</p></main>';
  }

  function viewRefer() {
    var p = S.current, n = nearestFacility(p), f = n.f;
    var patientBody = fill('refer', null, f), note = fill('referral_note', p, f);
    var facPhone = f.phone ? (S.judge ? '<span>' + esc(maskPhone(f.phone)) + '</span>' : '<a href="tel:' + esc(f.phone) + '">' + esc(f.phone) + '</a>') : esc(t('number_unverified'));
    var noteBtn = f.phone && !S.judge
      ? '<a class="btn" href="' + esc(smsHref(f.phone, note)) + '" data-act="log" data-type="sms" data-detail="referral_note">' + esc(t('send_note')) + '</a>'
      : '<button data-act="copy" data-text="' + esc(note) + '">' + esc(t('copy_note')) + '</button>';
    return header(t('refer'), 'patient') + '<main>' +
      '<div class="card facility"><div class="big">' + esc(I18N.getLang() === 'bn' ? f.name_bn : f.name) + '</div>' +
      '<div>' + esc(f.type) + ' · ' + esc(t('straight_line', { km: n.km.toFixed(1) })) + '</div>' +
      '<div>' + facPhone + '</div>' +
      (f.admits_dengue === 'assumed' ? '<div class="muted small">' + esc(t('admission_unverified')) + '</div>' : '') +
      '<div class="links"><a href="geo:' + f.lat + ',' + f.lon + '">geo:</a> · ' +
      '<a href="https://www.google.com/maps?q=' + f.lat + ',' + f.lon + '" target="_blank" rel="noopener">Google Maps</a></div></div>' +
      '<h2>' + esc(t('referral_note')) + '</h2><blockquote class="sms-body">' + esc(note) + '</blockquote>' + noteBtn +
      '<h2>' + esc(t('sms_to_family')) + '</h2><blockquote class="sms-body">' + esc(patientBody) + '</blockquote>' +
      '<a class="btn" href="' + esc(smsHref(S.judge ? '' : p.phone, patientBody)) + '" data-act="log" data-type="sms" data-detail="refer">' + esc(t('open_sms_app')) + '</a>' +
      '<button class="red" data-act="refer-log" data-fac="' + esc(f.id) + '">' + esc(t('log_refer')) + '</button></main>';
  }

  var VIEWS = { pin: viewPin, inbox: viewInbox, add_patient: viewAddPatient, settings: viewSettings, patient: viewPatient,
    add_message: viewAddMessage, labels: viewLabels, sms: viewSms, refer: viewRefer };
  function render() { $app.innerHTML = VIEWS[S.view](); }

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
    if (act === 'lang') { I18N.setLang(I18N.getLang() === 'bn' ? 'en' : 'bn'); return render(); }
    if (act === 'lock') { S.current = null; S.judge = false; Store.use('idb'); return go('pin'); }
    if (act === 'back' || act === 'nav') return go(el.dataset.to);
    if (act === 'open') { S.current = S.patients.filter(function (p) { return p.id === el.dataset.id; })[0]; return go('patient'); }
    if (act === 'export') return exportEvents();
    if (act === 'log') {
      if (el.dataset.type === 'visit') { logAction('visit').then(render); return alertNote(t('visit_logged')); }
      return logAction(el.dataset.type, el.dataset.detail); // let the tel:/sms: link open
    }
    if (act === 'read') {
      var text = document.getElementById('sms-text').value.trim();
      if (!text) return;
      var a = analyse(text);
      S.draft = { id: uid(), ts: Date.now(), type: 'sms', text: text, bands: a.bands, outcome: a.outcome, decisions: {}, isNew: true };
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
      return save(p).then(function () { go('patient'); });
    }
    if (act === 'arrived') return logAction('arrived').then(render);
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
  });

  $app.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(e.target);
    if (e.target.id === 'f-patient') {
      var p = {
        id: uid(), code: f.get('code').trim(), union: f.get('union'), phone: f.get('phone').trim(),
        onset: f.get('onset'), feverDroppedOn: f.get('fever') || null, added: Date.now(), messages: [], actions: []
      };
      S.current = p;
      return save(p).then(function () { go('patient'); });
    }
    if (e.target.id === 'f-settings') {
      S.settings = { chcpName: f.get('chcpName'), clinic: f.get('clinic'), myPhone: f.get('myPhone') };
      return Promise.all(Object.keys(S.settings).map(function (k) { return Store.setSetting(k, S.settings[k]); }))
        .then(function () { go('inbox'); });
    }
  });

  function alertNote(msg) {
    var n = document.createElement('div');
    n.className = 'toast'; n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1800);
  }

  // ---------- boot ----------
  function getJSON(u) { return fetch(u).then(function (r) { return r.json(); }); }
  Promise.all([getJSON('model_dengue.json'), getJSON('labels_dengue.json'), getJSON('templates.json'), getJSON('facilities.json')])
    .then(function (r) {
      S.model = r[0]; S.labels = r[1]; S.templates = r[2]; S.fac = r[3];
      S.rules = new AageRules.Rules(S.labels);
      return Store.getSetting('pin').catch(function () { return null; });
    })
    .then(function (pin) { S.hasPin = !!pin; render(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  window.AageApp = { state: S, urgency: urgency, nearestFacility: nearestFacility, fill: fill };
})();
