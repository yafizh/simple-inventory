#!/usr/bin/env node
/* server.js — serves the app and keeps the shared copy of the data, so that every device (PC, phones) works on the same
   data. Each device keeps working on its own copy when it is offline, and sends its changes here when it syncs
   (js/sync.js). Node 18 or newer, no packages.

     node server/server.js [--port 8080] [--data server/data]

   Open http://localhost:8080 on this computer. Phones need the address over HTTPS to install the app and use it
   offline (put a reverse proxy with a certificate in front, e.g. Caddy or nginx).

   Data (in --data, default server/data, never served):
   - db.json       { rev, records: { "<kind>/<id>": { rev, data } } } — every record of the app with the revision it was
                   last changed at; data null = deleted. kinds: units, items, employees, jobs, users, rabs, txs, pay
   - sessions.json { "<token>": { userId, at } } — signed-in devices
   - photos/       one file per photo, and <id>.type with its content type
   API (JSON, Authorization: Bearer <token> except info and login):
   - GET  /api/info              the demo accounts for the sign-in page, the current revision
   - POST /api/login             { username, password } → { token, user }
   - POST /api/logout
   - GET  /api/sync?since=<rev>  → { rev, changes: [{ kind, id, rev, data }] }
   - POST /api/sync              { since, changes: [{ kind, id, data }] } → { rev, changes, rejected: [key] }
   - PUT  /api/photos/<id>, GET /api/photos/<id>
   What a role may send: the admin anything; an employee only their own work reports while they wait for approval,
   and their own password; the supervisor only their own password. This is a prototype: the demo passwords are
   shown on the sign-in page, and every signed-in device receives all the data. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const PORT = Number(arg('port', process.env.PORT || 8080));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(arg('data', process.env.INV_DATA || path.join(__dirname, 'data')));
const KINDS = new Set(['units', 'items', 'employees', 'jobs', 'users', 'rabs', 'txs', 'pay']);
const SAFE_ID = /^[\w-]{1,100}$/;
const MAX_JSON = 20 * 1024 * 1024, MAX_PHOTO = 8 * 1024 * 1024;
const SESSION_DAYS = 60;

// ---------------------------------------------------------------- storage
fs.mkdirSync(path.join(DATA, 'photos'), { recursive: true });
const file = (name) => path.join(DATA, name);
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; return fallback(); }
}
/** Writes a file in one go: first to a temporary file, then renamed over the old one. */
function writeJson(name, value) {
  const tmp = file(name + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file(name));
}
const db = readJson('db.json', () => ({ rev: 0, records: {} }));
const sessions = readJson('sessions.json', () => ({}));

/** Same hash as js/store.js: SHA-256 of "salt:password", as hex. */
const hashOf = (salt, password) => crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
const userKey = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
function put(kind, id, data) {
  db.rev += 1;
  db.records[kind + '/' + id] = { rev: db.rev, data };
}
const records = (kind) => Object.entries(db.records).filter(([k, r]) => k.startsWith(kind + '/') && r.data).map(([, r]) => r.data);
// a new server starts with the two accounts every copy of the app has: admin / admin123 and supervisor / supervisor123
if (!records('users').length) {
  for (const [username, name, role] of [['admin', 'Admin', 'admin'], ['supervisor', 'Supervisor', 'supervisor']]) {
    const salt = crypto.randomUUID(), password = username + '123', id = crypto.randomUUID();
    put('users', id, { id, username, name, role, empId: '', salt, hash: hashOf(salt, password), active: true, demo: password });
  }
  writeJson('db.json', db);
}

// ---------------------------------------------------------------- who may send what
const same = (a, b, except) => Object.keys(Object.assign({}, a, b)).every((k) => except.includes(k) || JSON.stringify(a[k]) === JSON.stringify(b[k]));
/** Whether this user may make this change; current is the record as the server has it now (or null). */
function allowed(user, kind, id, data, current) {
  if (user.role === 'admin') return true;
  // their own password (and the demo password that goes with it)
  if (kind === 'users') return id === user.id && !!data && !!current && same(current, data, ['salt', 'hash', 'demo']);
  // an employee: their own work reports, while they wait for the admin
  if (user.role === 'pegawai' && kind === 'txs' && data) {
    const own = (x) => x.type === 'out' && x.empId === user.empId && (x.status || 'approved') === 'pending';
    return own(data) && (!current || own(current));
  }
  return false;
}

// ---------------------------------------------------------------- http helpers
function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(json);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
async function readJsonBody(req) {
  try { return JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}'); } catch (e) { throw Object.assign(new Error(e.status ? e.message : 'bad json'), { status: e.status || 400 }); }
}
/** The signed-in user of a request, or null. */
function auth(req) {
  const m = /^Bearer ([0-9a-f]{48})$/.exec(req.headers.authorization || '');
  const s = m && sessions[m[1]];
  const u = s && db.records['users/' + s.userId] && db.records['users/' + s.userId].data;
  if (!u || !u.active) return null;
  if (Date.now() - s.at > 864e5) { s.at = Date.now(); writeJson('sessions.json', sessions); } // seen today
  return u;
}

// ---------------------------------------------------------------- the API
const changesSince = (since) => Object.entries(db.records).filter(([, r]) => r.rev > since)
  .sort((a, b) => a[1].rev - b[1].rev).map(([k, r]) => ({ kind: k.split('/')[0], id: k.slice(k.indexOf('/') + 1), rev: r.rev, data: r.data }));

async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname;
  if (route === 'GET /api/info') {
    const demo = records('users').filter((u) => u.active && u.demo).map((u) => ({ role: u.role, username: u.username, password: u.demo }));
    return send(res, 200, { app: 'inventori-sederhana', rev: db.rev, demo });
  }
  if (route === 'POST /api/login') {
    const body = await readJsonBody(req);
    const u = records('users').find((x) => x.username === userKey(body.username));
    if (!u || !u.active || u.hash !== hashOf(u.salt, String(body.password))) {
      await new Promise((r) => setTimeout(r, 400)); // slows down guessing
      return send(res, 401, { error: 'wrong-login' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions[token] = { userId: u.id, at: Date.now() };
    for (const [t, s] of Object.entries(sessions)) if (Date.now() - s.at > SESSION_DAYS * 864e5) delete sessions[t];
    writeJson('sessions.json', sessions);
    return send(res, 200, { token, user: { id: u.id, username: u.username, name: u.name, role: u.role } });
  }
  const user = auth(req);
  if (!user) return send(res, 401, { error: 'sign-in' });
  if (route === 'POST /api/logout') {
    delete sessions[(req.headers.authorization || '').slice(7)];
    writeJson('sessions.json', sessions);
    return send(res, 200, { ok: true });
  }
  if (route === 'GET /api/sync') return send(res, 200, { rev: db.rev, changes: changesSince(Number(url.searchParams.get('since')) || 0) });
  if (route === 'POST /api/sync') {
    const body = await readJsonBody(req);
    const since = Number(body.since) || 0, rejected = [];
    for (const c of Array.isArray(body.changes) ? body.changes : []) {
      const key = c.kind + '/' + c.id, cur = db.records[key] ? db.records[key].data : null;
      const ok = KINDS.has(c.kind) && SAFE_ID.test(String(c.id)) && (c.data === null || (typeof c.data === 'object' && c.data.id === c.id));
      if (!ok || !allowed(user, c.kind, c.id, c.data, cur)) { rejected.push(key); continue; }
      if (JSON.stringify(cur) !== JSON.stringify(c.data)) put(c.kind, c.id, c.data);
    }
    writeJson('db.json', db);
    // everything the device does not have yet, and the server's own version of what it may not change
    const out = changesSince(since);
    for (const key of rejected) {
      const r = db.records[key];
      if (r && r.rev <= since) out.push({ kind: key.split('/')[0], id: key.slice(key.indexOf('/') + 1), rev: r.rev, data: r.data });
      if (!r && KINDS.has(key.split('/')[0])) out.push({ kind: key.split('/')[0], id: key.slice(key.indexOf('/') + 1), rev: 0, data: null });
    }
    return send(res, 200, { rev: db.rev, changes: out, rejected });
  }
  const m = /^\/api\/photos\/([\w-]{1,100})$/.exec(url.pathname);
  if (m && req.method === 'PUT') {
    const type = String(req.headers['content-type'] || '');
    if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(type)) return send(res, 415, { error: 'not-an-image' });
    const data = await readBody(req, MAX_PHOTO);
    fs.writeFileSync(path.join(DATA, 'photos', m[1]), data);
    fs.writeFileSync(path.join(DATA, 'photos', m[1] + '.type'), type);
    return send(res, 200, { ok: true });
  }
  if (m && req.method === 'GET') {
    try {
      const type = fs.readFileSync(path.join(DATA, 'photos', m[1] + '.type'), 'utf8');
      // a picture only: never run as a page
      return send(res, 200, fs.readFileSync(path.join(DATA, 'photos', m[1])), { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    } catch (e) { return send(res, 404, { error: 'not-found' }); }
  }
  return send(res, 404, { error: 'not-found' });
}

// ---------------------------------------------------------------- the app's files (and nothing else)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8' };
const STATIC = /^\/(index\.html|manifest\.webmanifest|sw\.js|css\/[\w.-]+\.css|js\/[\w.-]+\.js|img\/[\w.-]+\.(svg|png))$/;
function serveFile(req, res, pathname) {
  const p = pathname === '/' ? '/index.html' : pathname;
  if (!STATIC.test(p)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  const full = path.join(ROOT, p);
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const etag = `W/"${st.size}-${Math.round(st.mtimeMs)}"`;
    // always asked again, so a new version arrives at once; the service worker keeps a copy for offline use
    const headers = { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'server' }); if (!e.status) console.error(e); });
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    let p;
    try { p = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, { error: 'bad path' }); }
    serveFile(req, res, p);
  } else send(res, 405, { error: 'method' });
});
server.listen(PORT, () => console.log(`Inventori Sederhana: http://localhost:${PORT}  (data: ${DATA})`));
