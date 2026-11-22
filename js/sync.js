/* sync.js — offline first. The app always works on this device's own copy of the data (store.js, photos.js), with
   or without a connection. When the app is opened from server/server.js, this keeps that copy in step with the
   server, so that every device (PC, phones) shares the same data:
   - What changed here since the last sync is found by comparing every record with the copy kept at the last sync
     (the "base"), and is sent. What other devices changed comes back and is put in. A record is one unit, item,
     employee, user, RAB, transaction or payment; when two devices change the same record, the last one sent wins.
     A record changed here while a sync is under way is kept, and goes with the next sync.
   - Photos are sent with the records that use them, and fetched when a page shows a photo that is not here.
   - Automatic (the default): after every change, when the connection comes back, when the app is shown again and
     every minute. Manual: only with "Sync now". The choice is kept per device.
   - The server decides what each role may change (see server/server.js); what it refuses is put back as it has it.
   Nothing of this runs when the app is opened as a file, or from a server without the sync API. */
(function (g) {
  'use strict';
  const CFG = 'inv-simple-sync', BASE = 'inv-simple-base';
  const read = (k, def) => { try { return JSON.parse(g.localStorage.getItem(k)) || def; } catch (e) { return def; } };
  const write = (k, v) => { try { g.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('sync: not saved', e); } };
  // server: the app came from a sync server (kept, so it is known offline too); rev: the server's revision at the
  // last sync; tokens: per user id; uploaded: photo ids the server has; last: time of the last sync (ms)
  const cfg = Object.assign({ server: false, mode: 'auto', rev: 0, tokens: {}, uploaded: {}, last: 0 }, read(CFG, {}));
  let base = read(BASE, {}); // "<kind>/<id>" → the record as JSON at the last sync
  const saveCfg = () => write(CFG, cfg);
  const listeners = [];
  let timer = 0, again = false, applying = false;

  const Sync = {
    enabled: false, // the app comes from a sync server
    online: g.navigator.onLine !== false,
    busy: false,
    pending: 0, // records changed here and not sent yet
    error: '', // '' | 'sign-in' (no valid token: sign in again while online) | 'failed'
    demo: [], // the server's demo accounts, for the sign-in page of a new device
    get mode() { return cfg.mode; },
    get last() { return cfg.last; },
    /** fn(Sync) runs whenever the state above changes. */
    onChange(fn) { listeners.push(fn); },
    /** fn(n) runs after n records from other devices were put in. */
    onData: null,
  };
  const notify = () => listeners.forEach((fn) => { try { fn(Sync); } catch (e) { console.error(e); } });
  const url = (p) => new URL(p, g.document.baseURI).toString(); // next to the app, wherever it is served
  const tokenOf = () => { const me = S.me(); return (me && cfg.tokens[me.id]) || ''; };

  /** A request to the server. body: an object (sent as JSON) or a Blob. o: { auth: false, token, timeout, blob } */
  async function api(method, path, body, o = {}) {
    const ctl = new AbortController(), timer2 = setTimeout(() => ctl.abort(), o.timeout || 20000);
    const headers = {}, tok = o.token || tokenOf();
    if (o.auth !== false) headers.Authorization = 'Bearer ' + tok;
    if (body instanceof Blob) headers['Content-Type'] = body.type || 'application/octet-stream';
    else if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const res = await fetch(url(path), { method, headers, signal: ctl.signal, cache: 'no-store',
        body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body) });
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
      return o.blob ? res.blob() : res.json();
    } finally { clearTimeout(timer2); }
  }

  /** What changed here since the last sync: [{ key, kind, id, data (null = deleted), json }]. */
  function diff() {
    const out = [], seen = new Set();
    for (const kind of S.SYNCED) {
      for (const r of S.state[kind] || []) {
        const key = kind + '/' + r.id, json = JSON.stringify(r);
        seen.add(key);
        if (base[key] !== json) out.push({ key, kind, id: r.id, data: r, json });
      }
    }
    for (const key of Object.keys(base)) {
      if (!seen.has(key)) out.push({ key, kind: key.slice(0, key.indexOf('/')), id: key.slice(key.indexOf('/') + 1), data: null, json: undefined });
    }
    return out;
  }
  const count = () => { Sync.pending = Sync.enabled ? diff().length : 0; };

  /** Puts in what the server sent, except records changed here meanwhile (they go with the next sync). What the
      server refused (rejected) is always put back as the server has it. Returns how many records changed here. */
  function apply(changes, rejected) {
    let n = 0;
    applying = true;
    try {
      for (const c of changes) {
        if (!S.SYNCED.includes(c.kind)) continue;
        const key = c.kind + '/' + c.id, list = S.state[c.kind], i = list.findIndex((x) => x.id === c.id);
        const local = i >= 0 ? JSON.stringify(list[i]) : undefined, json = c.data ? JSON.stringify(c.data) : undefined;
        if (local !== base[key] && !rejected.has(key)) continue;
        if (json) base[key] = json; else delete base[key];
        if (local === json) continue;
        if (!c.data) list.splice(i, 1);
        else if (i >= 0) list[i] = c.data;
        else list.push(c.data);
        n += 1;
      }
      if (n) S.synced();
    } finally { applying = false; }
    return n;
  }

  /** Sends a photo that is on this device and not on the server yet. */
  async function upload(id, tok) {
    const blob = await Photos.local(id);
    if (!blob) return; // taken on another device: the server has it already
    await api('PUT', 'api/photos/' + encodeURIComponent(id), blob, { token: tok });
    cfg.uploaded[id] = 1;
    saveCfg();
  }

  /** One sync: send what changed here (and its photos), put in what changed elsewhere. tok: for the sign-in of a new
      device, before anyone is signed in here. */
  async function run(tok) {
    tok = tok || tokenOf();
    if (!Sync.enabled || !tok) { if (Sync.enabled && S.me()) { Sync.error = 'sign-in'; notify(); } return 0; }
    if (!Sync.online) { notify(); return 0; }
    if (Sync.busy) { again = true; return 0; }
    Sync.busy = true;
    Sync.error = '';
    notify();
    let n = 0;
    try {
      const changes = diff();
      for (const c of changes) { const ph = c.data && c.data.photo; if (ph && !cfg.uploaded[ph]) await upload(ph, tok); }
      const res = await api('POST', 'api/sync', { since: cfg.rev, changes: changes.map((c) => ({ kind: c.kind, id: c.id, data: c.data })) }, { token: tok });
      const rejected = new Set(res.rejected || []);
      for (const c of changes) if (!rejected.has(c.key)) { if (c.data) base[c.key] = c.json; else delete base[c.key]; }
      n = apply(res.changes || [], rejected);
      if (rejected.size) console.warn('sync: the server kept its own version of', [...rejected]);
      cfg.rev = res.rev;
      cfg.last = Date.now();
      saveCfg();
      write(BASE, base);
      if (n && Sync.onData) Sync.onData(n);
    } catch (e) {
      // the sign-in expired or the account is gone; the device is offline; or the server failed or cannot be reached
      if (e.status === 401) { const me = S.me(); if (me) delete cfg.tokens[me.id]; saveCfg(); Sync.error = 'sign-in'; }
      else if (g.navigator.onLine === false) Sync.online = false;
      else Sync.error = 'failed';
    } finally {
      Sync.busy = false;
      count();
      notify();
      if (again) { again = false; schedule(300); }
    }
    return n;
  }
  /** Counts what is not sent yet and, in automatic mode, syncs a moment later (changes come in bursts). */
  function schedule(ms = 1500) {
    count();
    notify();
    if (!Sync.enabled || cfg.mode !== 'auto') return;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  }

  function enable() {
    if (Sync.enabled) return;
    Sync.enabled = true;
    S.onSave = () => { if (!applying) schedule(); };
    Photos.remote = (id) => (Sync.online && tokenOf() ? api('GET', 'api/photos/' + encodeURIComponent(id), undefined, { blob: true })
      .then((b) => { cfg.uploaded[id] = 1; saveCfg(); return b; }).catch(() => null) : Promise.resolve(null));
    g.addEventListener('online', () => { Sync.online = true; schedule(500); });
    g.addEventListener('offline', () => { Sync.online = false; notify(); });
    g.document.addEventListener('visibilitychange', () => { if (g.document.visibilityState === 'visible') schedule(300); });
    setInterval(() => { if (cfg.mode === 'auto' && g.document.visibilityState === 'visible') run(); }, 60000);
  }
  /** At start: whether the app comes from a sync server. A device that knows it already starts at once (also
      offline); the first time, this waits for the answer (a few seconds at most). */
  Sync.start = function () {
    if (g.location.protocol === 'file:') return Promise.resolve();
    const info = api('GET', 'api/info', undefined, { auth: false, timeout: 4000 })
      .then((i) => { if (i && i.app === 'inventori-sederhana') { cfg.server = true; saveCfg(); Sync.demo = i.demo || []; enable(); notify(); } })
      .catch(() => { /* offline, or a server without the sync API */ });
    if (cfg.server) { enable(); return Promise.resolve(); }
    return info;
  };
  /** Once the data is loaded and someone is signed in: count, and in automatic mode sync. */
  Sync.ready = function () { if (Sync.enabled) schedule(200); };
  /** Signs in on the server: a token for this user on this device, and on a device that does not know the user yet,
      all the data. Rejects with { status: 401 } for a wrong password, or a network error. */
  Sync.login = async function (username, password) {
    const res = await api('POST', 'api/login', { username, password }, { auth: false, timeout: 10000 });
    cfg.tokens[res.user.id] = res.token;
    saveCfg();
    if (!S.user(res.user.id)) await run(res.token);
    return res.user;
  };
  Sync.hasToken = (userId) => !!cfg.tokens[userId];
  /** Sync now (the button, and the manual mode). */
  Sync.now = () => run();
  Sync.setMode = function (mode) {
    cfg.mode = mode === 'manual' ? 'manual' : 'auto';
    saveCfg();
    schedule(200);
  };
  g.Sync = Sync;
})(typeof window !== 'undefined' ? window : globalThis);
