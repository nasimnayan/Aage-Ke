// Local storage. Real records live only in IndexedDB on this phone, encrypted with AES-GCM.
// The key is derived from the PIN with PBKDF2 (SHA-256, 100,000 iterations, random salt kept in the clear)
// and never stored. Judge mode uses an in-memory store with no encryption.
//
// Patient (decrypted): {id, code, union, phone, onset: 'YYYY-MM-DD', feverDroppedOn, added: ms,
//   messages: [{id, ts, type: 'sms'|'missed_call'|'note', text, gloss, bands, outcome, decisions}],
//   actions: [{ts, type: 'call'|'visit'|'refer'|'arrived'|'sms', detail}]}
// On disk: patients {id, iv, ct}; settings 'lock' {salt, check: {iv, ct}}; settings 'profile' {iv, ct}.
(function (root) {
  'use strict';
  var DB = 'aageke', VER = 1, ITER = 100000, CHECK = 'aageke-ok';
  var mode = 'idb', mem = { patients: {}, settings: {} }, dbp = null, key = null;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('patients')) db.createObjectStore('patients', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }

  function tx(store, kind, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, kind), r = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(r && r.result); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // ---------- crypto ----------
  function deriveKey(pin, salt) {
    return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function encryptWith(k, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj)))
      .then(function (ct) { return { iv: iv, ct: ct }; });
  }
  function decryptWith(k, box) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, k, box.ct)
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  function getSetting(k) {
    if (mode === 'memory') return Promise.resolve(mem.settings[k]);
    return tx('settings', 'readonly', function (s) { return s.get(k); });
  }
  function setSetting(k, v) {
    if (mode === 'memory') { mem.settings[k] = v; return Promise.resolve(); }
    return tx('settings', 'readwrite', function (s) { return s.put(v, k); });
  }
  function deleteSetting(k) {
    if (mode === 'memory') { delete mem.settings[k]; return Promise.resolve(); }
    return tx('settings', 'readwrite', function (s) { return s.delete(k); });
  }

  var Store = {
    use: function (m) { mode = m; key = null; if (m === 'memory') mem = { patients: {}, settings: {} }; },
    mode: function () { return mode; },
    encrypted: function () { return mode === 'idb' && !!key; },
    getSetting: getSetting,
    setSetting: setSetting,
    deleteSetting: deleteSetting,

    // First PIN: new salt, store an encrypted check value, keep the key in memory.
    createLock: function (pin) {
      var salt = crypto.getRandomValues(new Uint8Array(16));
      return deriveKey(pin, salt).then(function (k) {
        return encryptWith(k, CHECK).then(function (check) {
          return setSetting('lock', { salt: salt, check: check });
        }).then(function () { key = k; return true; });
      });
    },
    // Later PINs: the key is right only if the check value decrypts.
    openLock: function (pin, lock) {
      return deriveKey(pin, lock.salt).then(function (k) {
        return decryptWith(k, lock.check).then(function (v) {
          if (v !== CHECK) return false;
          key = k; return true;
        }, function () { return false; });
      });
    },
    lock: function () { key = null; },

    all: function () {
      if (mode === 'memory') return Promise.resolve(Object.keys(mem.patients).map(function (k) { return clone(mem.patients[k]); }));
      return tx('patients', 'readonly', function (s) { return s.getAll(); }).then(function (rows) {
        // Rows without `ct` were saved before encryption; they are re-saved encrypted on unlock.
        return Promise.all(rows.map(function (r) { return r.ct ? decryptWith(key, r) : r; }));
      });
    },
    put: function (p) {
      if (mode === 'memory') { mem.patients[p.id] = clone(p); return Promise.resolve(); }
      return encryptWith(key, p).then(function (box) {
        return tx('patients', 'readwrite', function (s) { return s.put({ id: p.id, iv: box.iv, ct: box.ct }); });
      });
    },
    // Any other encrypted settings record (e.g. 'learning': confirm/reject decisions).
    getBox: function (name) {
      return getSetting(name).then(function (box) {
        if (!box) return null;
        return mode === 'memory' ? clone(box) : decryptWith(key, box);
      });
    },
    setBox: function (name, obj) {
      if (mode === 'memory') return setSetting(name, clone(obj));
      return encryptWith(key, obj).then(function (box) { return setSetting(name, box); });
    },
    getProfile: function () {
      return getSetting('profile').then(function (box) {
        if (mode === 'memory') return box || {};
        return box ? decryptWith(key, box) : {};
      });
    },
    setProfile: function (obj) {
      if (mode === 'memory') return setSetting('profile', obj);
      return encryptWith(key, obj).then(function (box) { return setSetting('profile', box); });
    }
  };
  root.Store = Store;
})(this);
