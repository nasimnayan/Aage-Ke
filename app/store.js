// Local storage. Real records live only in IndexedDB on this phone; judge mode uses memory.
// Patient: {id, code, union, phone, onset: 'YYYY-MM-DD', feverDroppedOn, added: ms,
//           messages: [{id, ts, type: 'sms'|'missed_call'|'note', text, gloss, bands, outcome, decisions}],
//           actions: [{ts, type: 'call'|'visit'|'refer'|'sms', detail}]}
(function (root) {
  'use strict';
  var DB = 'aageke', VER = 1, mode = 'idb', mem = { patients: {}, settings: {} }, dbp = null;

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

  var Store = {
    use: function (m) { mode = m; if (m === 'memory') mem = { patients: {}, settings: {} }; },
    mode: function () { return mode; },
    all: function () {
      if (mode === 'memory') return Promise.resolve(Object.keys(mem.patients).map(function (k) { return clone(mem.patients[k]); }));
      return tx('patients', 'readonly', function (s) { return s.getAll(); });
    },
    put: function (p) {
      if (mode === 'memory') { mem.patients[p.id] = clone(p); return Promise.resolve(); }
      return tx('patients', 'readwrite', function (s) { return s.put(p); });
    },
    getSetting: function (k) {
      if (mode === 'memory') return Promise.resolve(mem.settings[k]);
      return tx('settings', 'readonly', function (s) { return s.get(k); });
    },
    setSetting: function (k, v) {
      if (mode === 'memory') { mem.settings[k] = v; return Promise.resolve(); }
      return tx('settings', 'readwrite', function (s) { return s.put(v, k); });
    }
  };
  root.Store = Store;
})(this);
