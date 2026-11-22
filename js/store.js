/* store.js — keeps the data in localStorage.
   State: { v: 10, seq, txs: [transaction], items: [item], units: [unit], employees: [employee], users: [user], pay: [payment], rabs: [rab] }
   - unit     : { id, name, note }
   - item     : { id, code, name, unitId, note, active }
   - employee : { id, code, name, dept, active }
   - payment  : { id, empId, rabId (the RAB the wage is for), date (paid on), base, allowance, deduction, note }
                Salaries are paid per RAB: base is the employee's wage on that RAB (see rab.workers). Payments from before (when salaries
                were monthly) have no rabId but a month: 'YYYY-MM'; they are kept as they are.
   - user     : { id, username, name, role: 'supervisor'|'admin'|'pegawai', empId (pegawai only), salt, hash, active, demo }
   - rab      : { id, no, title, date, note, status: 'open'|'closed', lines: [{ id, itemId, qty }], workers: [{ empId, wage }] }
                The work plan (RAB): which items and how much (lines), and which employees do the work with one wage
                each for the whole RAB (workers). Everything bought or used is for a RAB: a purchase and a work report
                both have the rabId and the lineId of the RAB line of their item. Every worker can use every item of
                the RAB. There is one shared stock: what one RAB does not use stays in stock for the next ones.
   - transaction : { id, seq, date, type, itemId, empId, qty, price, party, ref, note, photo, rabId, lineId }
                type 'in'  = purchase for a RAB: price = purchase price per unit, party = supplier, ref = invoice no.
                type 'out' = use: a work report on a RAB, sent by the employee who did the work (empId), no price.
                type 'adj' = adjustment after a stock count (+ found / − missing or damaged), not on a RAB.
                A work report also has status: 'pending' (sent, waiting for the admin) | 'approved' | 'rejected',
                reason (why it was rejected), reviewedBy (name) and reviewedAt (date) of the admin's decision, and
                edited (true once the admin changed it). Only approved reports are in the stock and the costs; a
                waiting one already holds its quantity on the RAB line. Rejected reports are kept as they are.
   photo is the id of a picture kept by photos.js (IndexedDB), or ''. Entries from before purchases and use were tied
   to a RAB have rabId and lineId ''. Nothing is sold, so a use has no price.
   Users and roles only decide what each person sees in this browser. Everything is stored on this device, so this is
   not real security. Passwords are kept as a salted hash so that they are not readable in the saved data.
   Transactions only store ids. S.all() returns them with the names filled in (item, code, unit, emp, rabNo, rabTitle),
   and S.txs() only those in the stock (not the work reports that are waiting or rejected), which is what calc.js
   works with. */
(function (g) {
  'use strict';
  const KEY = 'inv-simple-v1', SESSION = 'inv-simple-session';
  const KINDS = ['items', 'employees', 'units'];
  const ROLES = ['supervisor', 'admin', 'pegawai'];
  const blank = () => ({ v: 10, seq: 0, txs: [], items: [], units: [], employees: [], users: [], pay: [], rabs: [] });
  const S = { state: blank(), KINDS, ROLES };
  const tr = (s, v) => C.tr(s, v);
  let cache = null, cacheAll = null; // transactions with names (in the stock / all), rebuilt after every change
  /** The status of a work report. Entries from before the approval have none: they were in the stock already. */
  const statusOf = (x) => x.status || 'approved';
  /** Is it in the stock? Purchases and adjustments always are, work reports once they are approved. */
  const posted = (x) => x.type !== 'out' || statusOf(x) === 'approved';

  function uid() {
    return (g.crypto && g.crypto.randomUUID) ? g.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  const pad = (n) => String(n).padStart(3, '0');
  // item codes are BRG-001, BRG-002… (barang). Data is in Indonesian whatever the language of the screens.
  const codePrefix = () => 'BRG-';

  /** Data saved before master data existed ({ seq, txs } with item and unit names): build the masters from it. */
  function fromNames(st) {
    const out = blank();
    out.seq = st.seq || 0;
    const items = new Map(), units = new Map();
    for (const tx of C.sort(st.txs || [])) {
      const name = C.clean(tx.item), un = C.clean(tx.unit);
      let it = items.get(C.key(name));
      if (!it) { it = { id: uid(), code: '', name, unitId: '', note: '', active: true }; items.set(C.key(name), it); }
      it.name = name; // latest spelling wins
      if (un) {
        let u = units.get(C.key(un));
        if (!u) { u = { id: uid(), name: un, note: '' }; units.set(C.key(un), u); }
        it.unitId = u.id; // latest unit wins
      }
      out.txs.push({ id: tx.id, seq: tx.seq, date: tx.date, type: tx.type, itemId: it.id, empId: '', qty: tx.qty, price: tx.price, party: tx.party || '', ref: tx.ref || '', note: tx.note || '' });
    }
    out.items = [...items.values()].sort(byName);
    out.items.forEach((it, i) => { it.code = codePrefix() + pad(i + 1); });
    out.units = [...units.values()].sort(byName);
    return out;
  }
  /** RABs saved before workers existed had an employee and a wage on each line. The employees become the workers
      (their line wages added up), and lines of the same item are merged, their reports moving along. */
  function rabWorkers(st, rab) {
    const workers = [], byItem = new Map(), lines = [];
    for (const l of rab.lines) {
      if (l.empId) {
        let w = workers.find((x) => x.empId === l.empId);
        if (!w) { w = { empId: l.empId, wage: 0 }; workers.push(w); }
        w.wage = C.round(w.wage + (l.wage || 0), 2);
      }
      const keep = byItem.get(l.itemId);
      if (keep) {
        keep.qty = C.round(keep.qty + l.qty, 4);
        for (const tx of st.txs) if (tx.lineId === l.id) tx.lineId = keep.id;
      } else {
        const nl = { id: l.id, itemId: l.itemId, qty: l.qty };
        byItem.set(l.itemId, nl);
        lines.push(nl);
      }
    }
    rab.lines = lines;
    rab.workers = workers;
  }
  function migrate(st) {
    const out = st.v ? st : fromNames(st);
    if (!out.users) out.users = [];
    ensureUsers(out);
    // once, for data saved before employees had accounts: a demo account for every active employee without one
    if (!(out.v >= 4)) for (const e of out.employees) if (e.active && !out.users.some((u) => u.empId === e.id)) employeeAccount(out, e);
    if (!out.pay) out.pay = [];
    if (!out.rabs) out.rabs = [];
    for (const r of out.rabs) if (!r.workers) rabWorkers(out, r);
    // v9: the RAB has its own column now, so a work report no longer keeps the RAB number as its reference
    if (!(out.v >= 9)) {
      for (const tx of out.txs) {
        const r = tx.rabId && out.rabs.find((x) => x.id === tx.rabId);
        if (r && tx.ref === r.no) tx.ref = '';
      }
    }
    // v10: work reports are approved by the admin; the ones saved before were already in the stock
    if (!(out.v >= 10)) for (const tx of out.txs) if (tx.type === 'out' && !tx.status) tx.status = 'approved';
    out.v = 10;
    return out;
  }
  /** Today in this browser's time zone, as YYYY-MM-DD. */
  S.today = function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const day = (iso) => (g.fmtDate ? g.fmtDate(iso) : iso);
  /** Errors for the date of an entry or payment on a RAB: not after today, not before the RAB. */
  function dateErrors(date, rab) {
    if (date > S.today()) return [tr('The date cannot be after today.')];
    if (rab && date < rab.date) return [tr('The date cannot be before the date of {no} ({date}).', { no: rab.no, date: day(rab.date) })];
    return [];
  }

  // ---- users
  /** SHA-256 as hex. Written out here because the browser's own (crypto.subtle) is not available on every address
      this page may be opened from. */
  function sha256(str) {
    const K = [], H = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2; K.length < 64; n++) {
      let prime = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (!prime) continue;
      if (H.length < 8) H.push(frac(Math.sqrt(n)));
      K.push(frac(Math.cbrt(n)));
    }
    const bytes = Array.from(new TextEncoder().encode(str)), bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? Math.floor(bits / 4294967296 / Math.pow(256, i - 4)) & 255 : (bits >>> (i * 8)) & 255);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n)), w = new Array(64), h = H.slice();
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g2, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g2)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g2; g2 = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g2, hh].forEach((x, i) => { h[i] = (h[i] + x) | 0; });
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  S.sha256 = sha256;
  const hashOf = (salt, password) => sha256(salt + ':' + password);
  /** demo accounts keep their password readable so the sign-in page can list them; it is dropped when the password changes */
  function newUser(username, name, role, password, empId) {
    const salt = uid();
    return { id: uid(), username, name, role, empId: empId || '', salt, hash: hashOf(salt, password), active: true, demo: password };
  }
  /** There is always an admin to sign in with. */
  function ensureUsers(st) {
    if (!st.users.some((u) => u.role === 'admin' && u.active)) st.users.push(newUser(freeName(st, 'admin'), 'Admin', 'admin', 'admin123'));
    if (!st.users.some((u) => u.role === 'supervisor')) st.users.push(newUser(freeName(st, 'supervisor'), 'Supervisor', 'supervisor', 'supervisor123'));
  }
  /** Demo account for an employee: the first name as username, e.g. budi / budi123. */
  function employeeAccount(st, emp) {
    const username = freeName(st, C.key(emp.name).split(' ')[0].replace(/[^a-z0-9._-]/g, '') || 'pegawai');
    st.users.push(newUser(username, emp.name, 'pegawai', username + '123', emp.id));
  }
  function freeName(st, base) {
    let name = base;
    for (let i = 2; st.users.some((u) => u.username === name); i++) name = base + i;
    return name;
  }

  S.load = function () {
    try {
      const raw = g.localStorage.getItem(KEY);
      if (raw) {
        const st = JSON.parse(raw), v = st.v;
        S.state = migrate(st);
        cache = cacheAll = null;
        if (v !== S.state.v) S.save();
        return true;
      }
    } catch (e) { console.warn('load failed', e); }
    return false;
  };
  S.save = function () {
    cache = cacheAll = null;
    try { g.localStorage.setItem(KEY, JSON.stringify(S.state)); } catch (e) { console.warn('save failed', e); }
    if (S.onSave) S.onSave();
  };
  /** Called after every save (js/sync.js counts what is not sent yet, and sends it). */
  S.onSave = null;
  /** The kinds of records that are synced: each is a list of records with an id. */
  S.SYNCED = ['units', 'items', 'employees', 'users', 'rabs', 'txs', 'pay'];
  /** After js/sync.js put in records from the server: the counter of transactions follows, and it is saved. */
  S.synced = function () {
    S.state.seq = S.state.txs.reduce((m, x) => Math.max(m, x.seq || 0), S.state.seq || 0);
    S.save();
  };

  // ---- master data
  S.list = (kind) => S.state[kind].slice().sort(byName);
  S.find = (kind, id) => (id && S.state[kind].find((x) => x.id === id)) || null;
  S.unitName = (item) => { const u = item && S.find('units', item.unitId); return u ? u.name : ''; };
  /** Item by what the user typed: its name, or else its code. */
  S.findItem = function (text) {
    const k = C.key(text);
    if (!k) return null;
    return S.state.items.find((x) => C.key(x.name) === k) || S.state.items.find((x) => x.code && C.key(x.code) === k) || null;
  };
  /** How many records point to this one: items for a unit, transactions for an item or an employee. */
  S.usage = function (kind, id) {
    if (kind === 'units') return S.state.items.filter((x) => x.unitId === id).length;
    const f = kind === 'items' ? 'itemId' : 'empId';
    return S.state.txs.filter((x) => x[f] === id).length;
  };
  /** Next free item code, e.g. BRG-006. */
  S.nextCode = function () {
    let max = 0;
    for (const it of S.state.items) { const m = /(\d+)$/.exec(it.code || ''); if (m) max = Math.max(max, Number(m[1])); }
    return codePrefix() + pad(max + 1);
  };
  /** A number typed into a form: empty counts as 0. */
  const amount = (v) => (String(v == null ? '' : v).trim() === '' ? 0 : Number(v));
  /** Validate, then add (no id) or replace (with id) a unit, item or employee. Returns { errors, row }. */
  S.putMaster = function (kind, input) {
    const list = S.state[kind];
    const old = input.id ? S.find(kind, input.id) : null;
    const others = list.filter((x) => x !== old);
    const row = { id: old ? old.id : uid(), name: C.clean(input.name) };
    if (kind !== 'units') { row.code = C.clean(input.code); row.active = input.active !== false; }
    if (kind === 'items') row.unitId = input.unitId || '';
    if (kind === 'employees') row.dept = C.clean(input.dept);
    else row.note = C.clean(input.note);

    const errors = [];
    if (!row.name) errors.push(tr('Enter a name.'));
    else if (kind !== 'employees' && others.some((x) => C.key(x.name) === C.key(row.name))) errors.push(tr('The name “{name}” is already used.', { name: row.name }));
    if (row.code && others.some((x) => C.key(x.code) === C.key(row.code))) errors.push(tr('The code “{code}” is already used.', { code: row.code }));
    if (kind === 'items' && !S.find('units', row.unitId)) errors.push(tr('Choose a unit.'));
    if (errors.length) return { errors };
    if (old) list[list.indexOf(old)] = row;
    else list.push(row);
    S.save();
    return { errors: [], row };
  };
  /** Returns an error message, or '' when deleted. Records that are in use cannot be deleted. */
  S.removeMaster = function (kind, id) {
    const n = S.usage(kind, id);
    const account = kind === 'employees' && S.state.users.find((u) => u.empId === id);
    if (account) return tr('This employee has a user account ({name}). Delete the account first.', { name: account.username });
    if (kind === 'employees' && S.state.pay.some((p) => p.empId === id)) return tr('This employee has salary payments and cannot be deleted. Make them inactive instead.');
    const rab = kind === 'items' ? S.state.rabs.find((r) => r.lines.some((l) => l.itemId === id))
      : kind === 'employees' ? S.state.rabs.find((r) => r.workers.some((w) => w.empId === id)) : null;
    if (rab) return tr('This record is used in {no} and cannot be deleted. Make it inactive instead.', { no: rab.no });
    if (n) {
      return kind === 'units' ? tr('This unit is used by {n} items and cannot be deleted.', { n })
        : kind === 'items' ? tr('This item has {n} transactions and cannot be deleted. Make it inactive instead.', { n })
        : tr('This employee has {n} transactions and cannot be deleted. Make them inactive instead.', { n });
    }
    S.state[kind] = S.state[kind].filter((x) => x.id !== id);
    S.save();
    return '';
  };

  // ---- salary payments: one per employee per RAB, the wage being the sum of their lines on it
  function namedPay(p) {
    const e = S.find('employees', p.empId), rab = S.rab(p.rabId);
    return Object.assign({}, p, { emp: e ? e.name : '', dept: e ? e.dept : '', total: C.payTotal(p), rabNo: rab ? rab.no : '', rabTitle: rab ? rab.title : '', month: p.month || '' });
  }
  /** All salary payments with the employee's name, the RAB and the total, newest first. */
  S.pays = () => S.state.pay.map(namedPay).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.rabNo.localeCompare(a.rabNo) || a.emp.localeCompare(b.emp)));
  S.pay = (id) => { const p = id && S.state.pay.find((x) => x.id === id); return p ? namedPay(p) : null; };
  /** An employee's wage on a RAB (0 when they are not on it). */
  S.wageOf = (rab, empId) => { const w = rab && rab.workers.find((x) => x.empId === empId); return w ? w.wage : 0; };
  /** The workers of a RAB with their name, wage, number of work reports and payment (or null). */
  S.rabWages = function (rab) {
    return rab.workers.map((w) => {
      const e = S.find('employees', w.empId), p = S.state.pay.find((x) => x.rabId === rab.id && x.empId === w.empId);
      const reports = S.state.txs.filter((x) => x.rabId === rab.id && x.type === 'out' && x.empId === w.empId && statusOf(x) !== 'rejected').length;
      return { empId: w.empId, emp: e ? e.name : '', dept: e ? e.dept : '', wage: w.wage, reports, pay: p ? namedPay(p) : null };
    });
  };
  /** Validate, then add (no id) or replace (with id) a salary payment. One payment per employee per RAB.
      A payment from the monthly days keeps its month when no RAB is chosen. Returns { errors, row }. */
  S.putPay = function (input) {
    const old = input.id ? S.state.pay.find((x) => x.id === input.id) : null;
    const emp = S.find('employees', input.empId), rab = S.rab(input.rabId);
    const row = {
      id: old ? old.id : uid(), empId: emp ? emp.id : '', rabId: rab ? rab.id : '', date: String(input.date || ''),
      base: amount(input.base), allowance: amount(input.allowance), deduction: amount(input.deduction), note: C.clean(input.note),
    };
    if (!rab && old && old.month && !old.rabId) row.month = old.month;
    const errors = [];
    if (!emp) errors.push(tr('Choose an employee.'));
    if (!rab && !row.month) errors.push(tr('Choose the RAB the wage is for.'));
    else if (rab && emp && !rab.workers.some((w) => w.empId === emp.id)) errors.push(tr('{name} is not on {no}.', { name: emp.name, no: rab.no }));
    else if (rab && emp && S.state.pay.some((x) => x !== old && x.empId === emp.id && x.rabId === rab.id)) errors.push(tr('{name} is already paid for {no}. Edit that payment instead.', { name: emp.name, no: rab.no }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push(tr('Enter the date it was paid.'));
    else errors.push(...dateErrors(row.date, rab));
    if ([row.base, row.allowance, row.deduction].some((v) => !(v >= 0))) errors.push(tr('Amounts cannot be negative.'));
    else if (C.payTotal(row) <= 0) errors.push(tr('The total must be more than 0.'));
    if (errors.length) return { errors };
    if (old) S.state.pay[S.state.pay.indexOf(old)] = row;
    else S.state.pay.push(row);
    S.save();
    return { errors: [], row: namedPay(row) };
  };
  S.removePay = function (id) { S.state.pay = S.state.pay.filter((x) => x.id !== id); S.save(); return ''; };
  /** Pays the wages of a RAB: a payment for every employee on it who has a wage and is not paid yet for it.
      Returns { errors, count }. */
  S.payAll = function (rabId, date) {
    const errors = [], rab = S.rab(rabId);
    if (!rab) errors.push(tr('Choose the RAB the wage is for.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) errors.push(tr('Enter the date it was paid.'));
    else errors.push(...dateErrors(date, rab));
    const wages = rab ? S.rabWages(rab).filter((w) => w.wage > 0) : [];
    if (!errors.length && !wages.length) errors.push(tr('No one on {no} has a wage yet. Set the wages on the RAB first.', { no: rab.no }));
    if (errors.length) return { errors, count: 0 };
    const due = wages.filter((w) => !w.pay);
    for (const w of due) S.state.pay.push({ id: uid(), empId: w.empId, rabId: rab.id, date, base: w.wage, allowance: 0, deduction: 0, note: '' });
    if (due.length) S.save();
    return { errors: [], count: due.length };
  };

  // ---- users and the signed-in session
  S.users = () => S.state.users.slice().sort((a, b) => a.username.localeCompare(b.username));
  S.user = (id) => (id && S.state.users.find((u) => u.id === id)) || null;
  const admins = (list) => list.filter((u) => u.role === 'admin' && u.active).length;
  /** The signed-in user, or null. */
  S.me = function () {
    let id = '';
    try { id = g.localStorage.getItem(SESSION) || ''; } catch (e) { /* no storage */ }
    const u = S.user(id);
    return u && u.active ? u : null;
  };
  S.login = function (username, password) {
    const u = S.state.users.find((x) => x.username === C.key(username));
    if (!u || !u.active || u.hash !== hashOf(u.salt, String(password))) return null;
    try { g.localStorage.setItem(SESSION, u.id); } catch (e) { /* ignore */ }
    return u;
  };
  S.logout = function () { try { g.localStorage.removeItem(SESSION); } catch (e) { /* ignore */ } };
  const passwordError = (p) => (String(p || '').length < 6 ? tr('The password needs at least 6 characters.') : '');
  /** Validate, then add (no id) or replace (with id) a user. input.password is optional when editing (empty = keep).
      meId is the signed-in user, who cannot lock themselves out. Returns { errors, row }. */
  S.putUser = function (input, meId) {
    const old = S.user(input.id), others = S.state.users.filter((u) => u !== old);
    const emp = S.find('employees', input.empId), role = input.role;
    const row = {
      id: old ? old.id : uid(), username: C.key(input.username), role, empId: role === 'pegawai' && emp ? emp.id : '',
      name: C.clean(input.name) || (role === 'pegawai' && emp ? emp.name : ''), active: input.active !== false,
      salt: old ? old.salt : uid(), hash: old ? old.hash : '', demo: old ? old.demo : '',
    };
    const errors = [];
    if (!row.username) errors.push(tr('Enter a username.'));
    else if (!/^[a-z0-9._-]+$/.test(row.username)) errors.push(tr('The username may only have letters, numbers, dots, dashes and underscores.'));
    else if (others.some((u) => u.username === row.username)) errors.push(tr('The username “{name}” is already used.', { name: row.username }));
    if (!ROLES.includes(role)) errors.push(tr('Choose a role.'));
    if (role === 'pegawai') {
      if (!emp) errors.push(tr('Choose the employee this account belongs to.'));
      else if (others.some((u) => u.empId === emp.id)) errors.push(tr('{name} already has an account.', { name: emp.name }));
    } else if (!row.name) errors.push(tr('Enter a name.'));
    if (input.password || !old) {
      const err = passwordError(input.password);
      if (err) errors.push(err);
      else { row.hash = hashOf(row.salt, String(input.password)); row.demo = ''; }
    }
    if (old && old.id === meId && (row.role !== old.role || !row.active)) errors.push(tr('You cannot change your own role or make yourself inactive.'));
    else if (old && admins(S.state.users) && !admins(others.concat([row]))) errors.push(tr('There must be at least one active admin.'));
    if (errors.length) return { errors };
    if (old) S.state.users[S.state.users.indexOf(old)] = row;
    else S.state.users.push(row);
    S.save();
    return { errors: [], row };
  };
  /** Returns an error message, or '' when deleted. */
  S.removeUser = function (id, meId) {
    if (id === meId) return tr('You cannot delete your own account.');
    const rest = S.state.users.filter((u) => u.id !== id);
    if (!admins(rest)) return tr('There must be at least one active admin.');
    S.state.users = rest;
    S.save();
    return '';
  };
  /** A user changes their own password. Returns an error message or ''. */
  S.changePassword = function (id, current, next) {
    const u = S.user(id);
    if (!u || u.hash !== hashOf(u.salt, String(current))) return tr('The current password is wrong.');
    const err = passwordError(next);
    if (err) return err;
    u.hash = hashOf(u.salt, String(next));
    u.demo = '';
    S.save();
    return '';
  };

  // ---- RAB (work plan): the items and quantities, and the employees who do the work with their wage
  const num = (v) => (g.fmtQty ? g.fmtQty(v) : String(v));
  S.rab = (id) => (id && S.state.rabs.find((r) => r.id === id)) || null;
  /** All RABs, newest first. */
  S.rabs = () => S.state.rabs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no.localeCompare(a.no)));
  /** Next free RAB number, e.g. RAB-004. */
  S.nextRabNo = function () {
    let max = 0;
    for (const r of S.state.rabs) { const m = /(\d+)$/.exec(r.no || ''); if (m) max = Math.max(max, Number(m[1])); }
    return 'RAB-' + pad(max + 1);
  };
  /** Quantity reported on a RAB line by any worker, approved or still waiting (rejected reports do not count), leaving
      out one transaction (the one being edited). This is what the limit of the line looks at. */
  S.lineReported = (lineId, exceptTx) => C.round(S.state.txs.reduce((a, x) => a + (x.lineId === lineId && x.type === 'out' && statusOf(x) !== 'rejected' && x.id !== exceptTx ? x.qty : 0), 0), 4);
  const lineQty = (lineId, status) => C.round(S.state.txs.reduce((a, x) => a + (x.lineId === lineId && x.type === 'out' && statusOf(x) === status ? x.qty : 0), 0), 4);
  /** Quantity bought for a RAB line. */
  S.lineBought = (lineId) => C.round(S.state.txs.reduce((a, x) => a + (x.lineId === lineId && x.type === 'in' ? x.qty : 0), 0), 4);
  /** The lines of a RAB with names and progress: bought, used (approved reports), waiting (reports not approved yet),
      left (still to report) and need (still to come out of the stock: waiting + left). */
  S.rabLines = function (rab) {
    return rab.lines.map((l) => {
      const it = S.find('items', l.itemId), used = lineQty(l.id, 'approved'), waiting = lineQty(l.id, 'pending');
      return Object.assign({}, l, { item: it ? it.name : '', code: it ? it.code : '', unit: S.unitName(it), bought: S.lineBought(l.id), used, waiting,
        left: C.round(Math.max(l.qty - used - waiting, 0), 4), need: C.round(Math.max(l.qty - used, 0), 4) });
    });
  };
  /** Progress of a RAB: lines done (fully reported and approved), the number of approved and waiting work reports and of
      purchases, and its state: 'closed', 'done' (every line done) or 'open'. */
  S.rabProgress = function (rab) {
    const lines = S.rabLines(rab), done = lines.filter((l) => l.used >= l.qty).length;
    const reps = S.state.txs.filter((x) => x.rabId === rab.id && x.type === 'out');
    const reports = reps.filter((x) => statusOf(x) === 'approved').length, waiting = reps.filter((x) => statusOf(x) === 'pending').length;
    const purchases = S.state.txs.filter((x) => x.rabId === rab.id && x.type === 'in').length;
    return { lines, done, reports, waiting, purchases, state: rab.status === 'closed' ? 'closed' : lines.length && done === lines.length ? 'done' : 'open' };
  };
  /** What the open RABs still need from the stock, per item (waiting reports and what is left to report):
      Map(itemId → { qty, rabs: [{ id, no, qty }] }), oldest RAB first. */
  S.needs = function () {
    const out = new Map();
    for (const rab of S.rabs().reverse()) {
      if (rab.status !== 'open') continue;
      for (const l of S.rabLines(rab)) {
        if (!(l.need > 0)) continue;
        let n = out.get(l.itemId);
        if (!n) { n = { qty: 0, rabs: [] }; out.set(l.itemId, n); }
        n.qty = C.round(n.qty + l.need, 4);
        n.rabs.push({ id: rab.id, no: rab.no, qty: l.need });
      }
    }
    return out;
  };
  /** The open RABs an employee works on, oldest first: { rab, wage, lines }. */
  S.tasks = function (empId) {
    return S.rabs().reverse().filter((r) => r.status === 'open' && r.workers.some((w) => w.empId === empId))
      .map((rab) => ({ rab, wage: S.wageOf(rab, empId), lines: S.rabLines(rab) }));
  };
  /** Validate, then add (no id) or replace (with id) a RAB.
      input.lines: [{ id (kept lines), itemId, qty }], input.workers: [{ empId, wage }].
      A line that already has purchases or reports keeps its item and cannot be removed, and cannot go below what is
      reported. A worker who has reported work or is paid on the RAB cannot be removed. The date cannot move past the
      first purchase, report or payment on the RAB. Returns { errors, row }. */
  S.putRab = function (input) {
    const old = S.rab(input.id), others = S.state.rabs.filter((r) => r !== old);
    const row = {
      id: old ? old.id : uid(), no: C.clean(input.no), title: C.clean(input.title), date: String(input.date || ''), note: C.clean(input.note),
      status: input.status === 'closed' ? 'closed' : 'open', lines: [], workers: [],
    };
    const errors = [];
    if (!row.no) errors.push(tr('Enter a RAB number.'));
    else if (others.some((r) => C.key(r.no) === C.key(row.no))) errors.push(tr('The number “{no}” is already used.', { no: row.no }));
    if (!row.title) errors.push(tr('Enter the work or project.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push(tr('Enter a date.'));
    else if (old) {
      const first = S.state.txs.filter((x) => x.rabId === old.id).concat(S.state.pay.filter((p) => p.rabId === old.id))
        .reduce((a, x) => (!a || x.date < a ? x.date : a), '');
      if (first && row.date > first) errors.push(tr('The RAB date cannot be after {date}, the date of its first purchase, report or payment.', { date: day(first) }));
    }

    // workers: one wage per employee for the whole RAB
    const oldWorkers = old ? old.workers : [];
    (input.workers || []).forEach((x, i) => {
      const emp = S.find('employees', x.empId), wage = amount(x.wage), errs = [];
      if (!emp) errs.push(tr('Choose an employee.'));
      else if (row.workers.some((w) => w.empId === emp.id)) errs.push(tr('{name} is already on the list.', { name: emp.name }));
      else if (!emp.active && !oldWorkers.some((w) => w.empId === emp.id)) errs.push(tr('{name} is inactive and cannot be used in a new transaction.', { name: emp.name }));
      if (!(wage >= 0)) errs.push(tr('The wage cannot be negative.'));
      errs.forEach((m) => errors.push(tr('Employee {n}: {msg}', { n: i + 1, msg: m })));
      if (!errs.length) row.workers.push({ empId: emp.id, wage: C.round(wage, 2) });
    });
    if (!(input.workers || []).length) errors.push(tr('Add at least one employee who does the work.'));
    for (const w of oldWorkers) {
      if (row.workers.some((x) => x.empId === w.empId)) continue;
      const emp = S.find('employees', w.empId), name = emp ? emp.name : '?', no = row.no || old.no;
      if (S.state.txs.some((x) => x.rabId === old.id && x.type === 'out' && x.empId === w.empId && statusOf(x) !== 'rejected')) errors.push(tr('{name} has already reported work on {no} and cannot be removed.', { name, no }));
      else if (S.state.pay.some((p) => p.rabId === old.id && p.empId === w.empId)) errors.push(tr('{name} is already paid for {no} and cannot be removed.', { name, no }));
    }

    // lines: the items and their quantities, bought for the RAB and used by any of the workers
    const oldLines = old ? old.lines : [];
    const hasEntries = (lineId) => S.state.txs.some((x) => x.lineId === lineId && x.type !== 'adj');
    (input.lines || []).forEach((x, i) => {
      const prev = oldLines.find((l) => l.id === x.id), it = S.find('items', x.itemId);
      const qty = x.qty === null || x.qty === undefined || String(x.qty).trim() === '' ? NaN : Number(x.qty);
      const used = prev ? S.lineReported(prev.id) : 0, errs = [];
      if (!it) errs.push(C.clean(x.item) ? tr('“{name}” is not in the item master. Add it first.', { name: C.clean(x.item) }) : tr('Choose an item.'));
      else if (!it.active && !(prev && prev.itemId === it.id)) errs.push(tr('{name} is inactive and cannot be used in a new transaction.', { name: it.name }));
      else if (row.lines.some((l) => l.itemId === it.id)) errs.push(tr('{item} is already on another line. Put it on one line.', { item: it.name }));
      if (!(qty > 0)) errs.push(tr('Quantity must be more than 0.'));
      if (prev && hasEntries(prev.id)) {
        if (prev.itemId !== (it && it.id)) errs.push(tr('This line already has purchases or work reports, so its item cannot change.'));
        else if (qty > 0 && qty < used) errs.push(tr('{used} {unit} has already been reported, so the quantity cannot be less.', { used: num(used), unit: S.unitName(it) }));
      }
      errs.forEach((m) => errors.push(tr('Line {n}: {msg}', { n: i + 1, msg: m })));
      row.lines.push({ id: prev ? prev.id : uid(), itemId: it ? it.id : '', qty: C.round(qty, 4) });
    });
    if (!row.lines.length) errors.push(tr('Add at least one item with its quantity.'));
    for (const l of oldLines) {
      if (hasEntries(l.id) && !row.lines.some((x) => x.id === l.id)) {
        const it = S.find('items', l.itemId);
        errors.push(tr('{item} already has purchases or work reports and cannot be removed.', { item: it ? it.name : '?' }));
      }
    }
    if (errors.length) return { errors };
    if (old) S.state.rabs[S.state.rabs.indexOf(old)] = row;
    else S.state.rabs.push(row);
    S.save();
    return { errors: [], row };
  };
  /** Returns an error message, or '' when deleted. A RAB with purchases, work reports or payments cannot be deleted. */
  S.removeRab = function (id) {
    const n = S.state.txs.filter((x) => x.rabId === id).length;
    if (n) return tr('This RAB has {n} purchases or work reports and cannot be deleted. Close it instead.', { n });
    const paid = S.state.pay.filter((p) => p.rabId === id).length;
    if (paid) return tr('This RAB has {n} salary payments and cannot be deleted. Close it instead.', { n: paid });
    S.state.rabs = S.state.rabs.filter((r) => r.id !== id);
    S.save();
    return '';
  };
  /** Rules for a purchase (in) or a use (out), which are always for a RAB. The line is the RAB's line of the item.
      Entries from before purchases and use were tied to a RAB may stay without one. */
  function rabErrors(tx, old) {
    if (!tx.rabId) return old && !old.rabId ? [] : [tr('Choose the RAB.')];
    const rab = S.rab(tx.rabId), line = rab.lines.find((l) => l.id === tx.lineId), it = S.find('items', tx.itemId), errs = [];
    if (!line) return it ? [tr('{item} is not on {no}. Add it to the RAB first.', { item: it.name, no: rab.no })] : [];
    const isNew = !old || old.lineId !== tx.lineId;
    if (isNew && rab.status !== 'open') errs.push(tr('{no} is closed. Nothing more can be bought or reported on it.', { no: rab.no }));
    if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date || '') && tx.date < rab.date) errs.push(...dateErrors(tx.date, rab));
    if (tx.type !== 'out') return errs;
    // a use is a work report: by one of the RAB's employees, and not more than what is left of the line
    const emp = S.find('employees', tx.empId);
    if (!emp) errs.push(tr('Choose an employee.'));
    else if (!rab.workers.some((w) => w.empId === emp.id)) errs.push(tr('{name} is not on {no}.', { name: emp.name, no: rab.no }));
    const left = C.round(line.qty - S.lineReported(line.id, tx.id), 4);
    if (isFinite(tx.qty) && tx.qty > 0 && tx.qty > left) {
      errs.push(left > 0 ? tr('Only {left} {unit} of {item} is left on {no}.', { left: num(left), unit: S.unitName(it), item: it ? it.name : '', no: rab.no }).replace(/ {2,}/g, ' ')
        : tr('{item} on {no} is already fully reported.', { item: it ? it.name : '', no: rab.no }));
    }
    return errs;
  }

  // ---- transactions
  function named(tx) {
    const it = S.find('items', tx.itemId), emp = S.find('employees', tx.empId), rab = S.rab(tx.rabId);
    return Object.assign({}, tx, { item: it ? it.name : '', code: it ? it.code : '', unit: S.unitName(it), emp: emp ? emp.name : '',
      rabNo: rab ? rab.no : '', rabTitle: rab ? rab.title : '' });
  }
  /** All transactions with item, code, unit, emp, rabNo and rabTitle filled in, also the work reports that are waiting
      or rejected. Do not change the returned objects. */
  S.all = function () {
    if (!cacheAll) cacheAll = S.state.txs.map(named);
    return cacheAll;
  };
  /** The transactions that are in the stock: purchases, adjustments and approved work reports. calc.js works with these. */
  S.txs = function () {
    if (!cache) cache = S.all().filter(posted);
    return cache;
  };
  S.get = (id) => S.all().find((x) => x.id === id);
  S.posted = posted;
  /** The work reports sent by the employees (uses on a RAB), newest first: waiting, approved and rejected. */
  S.workReports = () => C.sort(S.all().filter((x) => x.type === 'out' && x.rabId)).reverse();
  /** Name of the signed-in user, kept on the admin's decisions. */
  const meName = () => { const u = S.me(); return u ? u.name || u.username : ''; };

  /** Validate, then add (no id) or replace (with id). input.item is the text typed, only used for the message
      when it is not in the item master. A purchase or a use has input.rabId; its line is the RAB's line of the item.
      Only a purchase has a price and a supplier, and only a use has an employee. A new use (a work report sent by an
      employee) waits for approval; input.status 'approved' approves it. With dry = true it only checks.
      Returns { errors, tx }. */
  S.put = function (input, dry) {
    const old = input.id ? S.state.txs.find((x) => x.id === input.id) : null;
    const type = input.type, onRab = type === 'in' || type === 'out';
    const it = S.find('items', input.itemId), emp = type === 'out' ? S.find('employees', input.empId) : null;
    const rab = onRab ? S.rab(input.rabId !== undefined ? input.rabId : old && old.rabId) : null;
    const line = rab && it ? rab.lines.find((l) => l.itemId === it.id) : null;
    const tx = {
      id: old ? old.id : uid(), seq: old ? old.seq : S.state.seq + 1, date: input.date, type,
      itemId: it ? it.id : '', empId: emp ? emp.id : '', qty: input.qty, price: type === 'in' ? input.price : 0,
      party: type === 'in' ? C.clean(input.party) : '', ref: C.clean(input.ref), note: String(input.note || '').trim(), photo: input.photo || '',
      rabId: rab ? rab.id : '', lineId: line ? line.id : '',
    };
    if (type === 'out') {
      // a work report: sent by the employee, waiting until the admin approves (or rejects) it
      const was = old && old.type === 'out' ? old : null;
      Object.assign(tx, {
        status: !was ? 'pending' : input.status === 'approved' ? 'approved' : statusOf(was),
        reason: was ? was.reason || '' : '', reviewedBy: was ? was.reviewedBy || '' : '', reviewedAt: was ? was.reviewedAt || '' : '', edited: !!(was && was.edited),
      });
      // approving puts it into the stock now: on its date it comes after what was entered before (e.g. that day's purchase)
      if (tx.status === 'approved' && !(was && statusOf(was) === 'approved')) Object.assign(tx, { reviewedBy: meName(), reviewedAt: S.today(), seq: S.state.seq + 1 });
      // the employee sees when the admin changed their report
      const me = S.me();
      if (was && me && me.role !== 'pegawai' && ['date', 'itemId', 'rabId', 'qty', 'note', 'photo'].some((k) => String(was[k] ?? '') !== String(tx[k] ?? ''))) tx.edited = true;
    }
    const full = named(tx);
    // a waiting report leaves room in the stock for the other waiting reports too, so that together they fit
    const base = type === 'out' && tx.status === 'pending' ? S.all().filter((x) => posted(x) || (x.type === 'out' && statusOf(x) === 'pending')) : S.txs();
    let errors = C.validate(base, full);
    if (old && old.type !== type) errors.push(tr('The type of an entry cannot change.'));
    if (old && old.type === 'out' && statusOf(old) === 'rejected') errors.push(tr('A rejected report cannot be changed.'));
    if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date || '') && tx.date > S.today()) errors.push(tr('The date cannot be after today.'));
    if (!it && C.clean(input.item)) {
      const miss = tr('“{name}” is not in the item master. Add it first.', { name: C.clean(input.item) });
      errors = errors.map((m) => (m === tr('Choose an item.') ? miss : m));
    }
    // inactive records stay on the transactions that already use them, but cannot be chosen for others
    if (it && !it.active && !(old && old.itemId === it.id)) errors.push(tr('{name} is inactive and cannot be used in a new transaction.', { name: it.name }));
    if (emp && !emp.active && !(old && old.empId === emp.id)) errors.push(tr('{name} is inactive and cannot be used in a new transaction.', { name: emp.name }));
    if (onRab) errors.push(...rabErrors(tx, old));
    if (errors.length || dry) return { errors };
    if (old) S.state.txs[S.state.txs.indexOf(old)] = tx;
    else S.state.txs.push(tx);
    S.state.seq = Math.max(S.state.seq, tx.seq);
    S.save();
    return { errors: [], tx: named(tx) };
  };
  /** The admin approves a work report as it is: it goes into the stock. Returns { errors, tx }. */
  S.approve = function (id) {
    const tx = S.get(id);
    if (!tx || tx.type !== 'out' || statusOf(tx) !== 'pending') return { errors: [tr('Only a report that is waiting can be approved.')] };
    return S.put(Object.assign({}, tx, { status: 'approved' }));
  };
  /** The admin rejects a work report, waiting or approved, with the reason the employee sees. It leaves the stock and
      no longer holds its quantity on the RAB, but it is kept. Returns { errors }. */
  S.reject = function (id, reason) {
    const tx = S.state.txs.find((x) => x.id === id), why = C.clean(reason);
    if (!tx || tx.type !== 'out' || statusOf(tx) === 'rejected') return { errors: [tr('This report cannot be rejected.')] };
    if (!why) return { errors: [tr('Write why the report is rejected. The employee sees it.')] };
    Object.assign(tx, { status: 'rejected', reason: why, reviewedBy: meName(), reviewedAt: S.today() });
    S.save();
    return { errors: [] };
  };
  /** Returns an error message, or '' when deleted. */
  S.remove = function (id) {
    const err = C.checkDelete(S.txs(), id);
    if (err) return err;
    S.state.txs = S.state.txs.filter((x) => x.id !== id);
    S.save();
    return '';
  };
  /** Deletes transactions and master data. User accounts stay, except those of employees (the employees are gone). */
  S.clear = function () {
    const users = S.state.users.filter((u) => u.role !== 'pegawai');
    S.state = blank();
    S.state.users = users;
    ensureUsers(S.state);
    S.save();
  };
  S.isEmpty = () => !S.state.txs.length && !S.state.rabs.length && !S.state.pay.length && !KINDS.some((k) => S.state[k].length);

  /** Sample data around today: last month and this month. It is in Indonesian whatever the language of the screens,
      like the data people enter. Returns the example photos of its work reports, for the app to draw and save
      (js/sample-photos.js): [{ id, scene, label, date, time, place, who }]. */
  S.loadSample = function (today) {
    const st = blank();
    st.users = S.state.users.filter((u) => u.role !== 'pegawai'); // accounts stay; employee accounts are made again below
    ensureUsers(st);
    const unit = {}, item = {}, emp = {};
    // units: [name, note]
    const U = { rim: ['rim', '500 lembar'], botol: ['botol', ''], buah: ['buah', ''], gulung: ['gulung', ''], dus: ['dus', ''] };
    for (const k in U) { unit[k] = uid(); st.units.push({ id: unit[k], name: U[k][0], note: U[k][1] }); }
    // items: [name, unit]
    const I = { paper: ['Kertas A4 80gr', 'rim'], ink: ['Tinta Printer Hitam', 'botol'], pen: ['Pulpen Biru', 'buah'], folder: ['Map Plastik', 'buah'], tape: ['Lakban Coklat', 'gulung'] };
    Object.keys(I).forEach((k, i) => { item[k] = uid(); st.items.push({ id: item[k], code: codePrefix() + pad(i + 1), name: I[k][0], unitId: unit[I[k][1]], note: '', active: true }); });
    // employees: [employee no., name, department]
    const E = { w: ['2019004', 'Budi Santoso', 'Gudang'], s: ['2021011', 'Siti Rahma', 'Penjualan'], a: ['2022003', 'Andi Pratama', 'Umum'] };
    for (const k in E) {
      emp[k] = uid();
      st.employees.push({ id: emp[k], code: E[k][0], name: E[k][1], dept: E[k][2], active: true });
      employeeAccount(st, st.employees[st.employees.length - 1]);
    }

    const sup = ['CV Sumber Kertas', 'PT Alat Tulis Jaya'];
    const [y, m, d] = today.split('-').map(Number);
    const day = (off) => new Date(Date.UTC(y, m - 1, d + off)).toISOString().slice(0, 10);
    // Three RABs. Everything is bought for a RAB, and what one RAB leaves over stays in stock for the next ones
    // (the folders, pens and tape bought for RAB-001 are used later on RAB-002 and RAB-003).
    // - RAB-001: finished, closed and paid, with a bonus for Siti
    // - RAB-002: complete, Andi is paid and Budi not yet
    // - RAB-003: in progress, not paid, and short of tape: 9 rolls still to use, 2 in stock. Two work reports wait for
    //   the admin, and one was rejected (Siti reported pens for labels printed on paper, then reported the paper).
    // [date, title, status, lines [item, qty], workers [employee, wage], purchases [date, item, qty, price, supplier, invoice],
    //  reports [date, item, qty, work done, employee, status (approved when left out), reason], payments [date, employee, bonus, note]]
    const R = [
      [-40, 'Pengiriman barang ke cabang', 'closed',
        [['tape', 12], ['folder', 40], ['pen', 60]], [['w', 150000], ['s', 100000]],
        [[-39, 'tape', 20, 9500, 1, 'INV-0912'], [-39, 'folder', 100, 3000, 1, 'INV-0912'], [-39, 'pen', 200, 2500, 1, 'INV-0912']],
        [[-37, 'tape', 12, 'Mengemas 6 dus kiriman', 'w'],
          [-36, 'folder', 40, 'Menyusun dokumen pengiriman', 's'],
          [-36, 'pen', 60, 'Dikirim bersama paket', 's']],
        [[-34, 'w', 0, ''], [-34, 's', 50000, 'Bonus selesai lebih cepat']]],
      [-22, 'Persiapan dokumen tender', 'open',
        [['paper', 10], ['folder', 20], ['ink', 2]], [['a', 400000], ['w', 50000]],
        [[-21, 'paper', 30, 42000, 0, 'INV-0951'], [-21, 'ink', 6, 65000, 1, 'INV-0953']],
        [[-19, 'paper', 6, 'Mencetak dokumen penawaran', 'a'],
          [-18, 'folder', 20, 'Menyusun berkas per bagian', 'a'],
          [-17, 'ink', 2, 'Mengganti tinta printer', 'w'],
          [-16, 'paper', 4, 'Mencetak salinan untuk arsip', 'a']],
        [[-15, 'a', 0, '']]],
      [-6, 'Pindahan ruang arsip', 'open',
        [['tape', 15], ['folder', 30], ['paper', 5], ['pen', 10]], [['s', 200000], ['a', 150000]],
        [[-5, 'folder', 50, 3200, 1, 'INV-0990']],
        [[-4, 'folder', 20, 'Memindahkan arsip 2019–2021 ke map baru', 's'],
          [-3, 'tape', 6, 'Mengemas 3 lemari arsip', 'a'],
          [-2, 'pen', 4, 'Mencetak label rak', 's', 'rejected', 'Salah barang: label dicetak di kertas, bukan dengan pulpen. Laporkan di Kertas A4.'],
          [-2, 'paper', 2, 'Mencetak label rak', 's', 'pending'],
          [-1, 'folder', 5, 'Memasukkan arsip 2022 ke map', 'a', 'pending']],
        []],
    ];
    // every work report has a photo: what it shows (a scene of js/sample-photos.js, and what is written on it)
    const SHOT = {
      'Mengemas 6 dus kiriman': ['boxes'],
      'Menyusun dokumen pengiriman': ['folders', 'Pengiriman'],
      'Dikirim bersama paket': ['pens'],
      'Mencetak dokumen penawaran': ['print', 'PENAWARAN'],
      'Menyusun berkas per bagian': ['folders', 'Tender'],
      'Mengganti tinta printer': ['ink'],
      'Mencetak salinan untuk arsip': ['print', 'SALINAN ARSIP'],
      'Memindahkan arsip 2019–2021 ke map baru': ['folders', '2019–2021'],
      'Mengemas 3 lemari arsip': ['cabinets'],
      'Mencetak label rak': ['labels'],
      'Memasukkan arsip 2022 ke map': ['folders', '2022'],
    };
    const shots = []; // the photos to draw: { id, scene, label, date, time, place, who }
    const admin = (st.users.find((u) => u.role === 'admin' && u.active) || { name: 'Admin' }).name;
    const entries = []; // [day, transaction], put in date order below
    const entry = (off, o) => entries.push([off, Object.assign({ date: day(off), empId: '', price: 0, party: '', ref: '', note: '', photo: '', rabId: '', lineId: '' }, o)]);
    R.forEach(([off, title, status, lines, workers, buys, reports, paid], i) => {
      const rab = { id: uid(), no: 'RAB-' + pad(i + 1), title, date: day(off), note: '', status,
        lines: lines.map(([k, qty]) => ({ id: uid(), itemId: item[k], qty })), workers: workers.map(([e, wage]) => ({ empId: emp[e], wage })) };
      st.rabs.push(rab);
      const on = (k) => ({ rabId: rab.id, lineId: rab.lines.find((l) => l.itemId === item[k]).id, itemId: item[k] });
      for (const [dd, k, qty, price, s, ref] of buys) entry(dd, Object.assign(on(k), { type: 'in', qty, price, party: sup[s], ref }));
      for (const [dd, k, qty, note, e, status = 'approved', reason = ''] of reports) {
        const review = status === 'pending' ? { reviewedBy: '', reviewedAt: '' } : { reviewedBy: admin, reviewedAt: day(Math.min(dd + 1, 0)) };
        // its example photo, taken during the working day
        const [scene, label = ''] = SHOT[note] || ['boxes'], n = shots.length, photo = uid();
        shots.push({ id: photo, scene, label, date: day(dd), time: `${String(8 + (n * 5) % 9).padStart(2, '0')}:${String((n * 17 + 7) % 60).padStart(2, '0')}`,
          place: rab.no + ' · ' + rab.title, who: E[e][1] });
        entry(dd, Object.assign(on(k), { type: 'out', qty, note, empId: emp[e], status, reason, edited: false, photo }, review));
      }
      for (const [dd, e, bonus, note] of paid) {
        st.pay.push({ id: uid(), empId: emp[e], rabId: rab.id, date: day(dd), base: rab.workers.find((w) => w.empId === emp[e]).wage, allowance: bonus, deduction: 0, note });
      }
    });
    // stock counts are not on a RAB
    entry(-25, { type: 'adj', itemId: item.pen, qty: -5, note: 'Rusak' });
    entry(-1, { type: 'adj', itemId: item.paper, qty: -1, ref: 'OPN-11', note: 'Hasil stock opname' });
    entries.sort((a, b) => a[0] - b[0]);
    for (const [, tx] of entries) st.txs.push(Object.assign({ id: uid(), seq: ++st.seq }, tx));
    S.state = st;
    S.save();
    return shots;
  };

  g.S = S;
})(typeof window !== 'undefined' ? window : globalThis);
