/* calc.js — stock maths for the simple prototype. No DOM access, so it also runs in Node for tests.
   A transaction: { id, seq, date:'YYYY-MM-DD', type:'in'|'out'|'adj', itemId, item, unit, qty, price, party, ref, note, rabId }
   - in  : a purchase for a RAB, qty > 0, price = purchase price per unit (cost)
   - out : a use (a work report on a RAB), qty > 0, valued at the moving average cost. Nothing is sold, so it has no price.
   - adj : qty is signed (+ found / − missing), valued at the current average cost
   Items are identified by itemId (the item master, see store.js). item and unit are the names to show; store.js fills
   them in from the master data. Without an itemId the name is the identity (case and extra spaces ignored). */
(function (g) {
  'use strict';
  const tr = (s, v) => (g.t ? g.t(s, v) : s.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));

  /** Round half up (away from zero), decimal-safe. */
  function round(x, dp = 2) {
    const n = Number(x);
    if (!isFinite(n)) return 0;
    const s = Math.sign(n) || 1;
    return s * Number(Math.round(Number(Math.abs(n) + 'e' + dp)) + 'e-' + dp) || 0;
  }
  const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  const key = (s) => clean(s).toLowerCase();
  const itemKey = (t) => t.itemId || key(t.item);
  const signed = (t) => (t.type === 'out' ? -t.qty : t.qty);
  const sort = (txs) => txs.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0)));
  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  const dayBefore = (iso) => addDays(iso, -1);

  /** Walk the transactions in date order and keep a moving average cost per item.
      opts.until: only transactions up to and including this date.
      Returns { items: Map(key -> state), rows: Map(txId -> figures), firstNegative } */
  function run(txs, opts = {}) {
    const items = new Map();
    const rows = new Map();
    let firstNegative = null;
    for (const t of sort(txs)) {
      if (opts.until && t.date > opts.until) break;
      const k = itemKey(t);
      let s = items.get(k);
      if (!s) {
        s = { key: k, item: clean(t.item), unit: '', qty: 0, value: 0, avg: 0, lastIn: null, lastDate: null, count: 0 };
        items.set(k, s);
      }
      s.item = clean(t.item); // latest spelling wins
      if (clean(t.unit)) s.unit = clean(t.unit);
      const before = s.qty;
      const d = signed(t);
      const after = round(before + d, 4);
      let cost; // stock value change: + into stock, − out of stock
      if (t.type === 'in') cost = round(t.qty * t.price, 2);
      else if (after === 0) cost = -s.value; // last unit out takes the remaining value (no rounding residue)
      else cost = round(d * s.avg, 2);
      s.qty = after;
      s.value = round(s.value + cost, 2);
      if (s.qty > 0) s.avg = s.value / s.qty; // when stock is 0 keep the last average
      if (t.type === 'in') s.lastIn = t.price;
      s.lastDate = t.date;
      s.count++;
      if (s.qty < 0 && !firstNegative) firstNegative = { tx: t, item: s.item, unit: s.unit, available: before };
      // used: the cost of a use (out) at moving average cost
      rows.set(t.id, { before, after, cost, avgAfter: s.avg, used: t.type === 'out' ? -cost : 0 });
    }
    return { items, rows, firstNegative };
  }

  function negativeError(neg) {
    const t = neg.tx;
    return tr('Stock of {item} would go below zero on {date}: {available} {unit} available, {need} {unit} going out.', {
      item: neg.item, date: g.fmtDate ? g.fmtDate(t.date) : t.date, unit: neg.unit,
      available: g.fmtQty ? g.fmtQty(neg.available) : neg.available,
      need: g.fmtQty ? g.fmtQty(Math.abs(signed(t))) : Math.abs(signed(t)),
    }).replace(/ {2,}/g, ' ').replace(/ +([,.])/g, '$1'); // tidy when the item has no unit
  }

  /** Check one transaction (new or edited) against all others. Returns a list of error messages. */
  function validate(txs, t) {
    const errs = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) errs.push(tr('Enter a date.'));
    if (!clean(t.item)) errs.push(tr('Choose an item.'));
    if (!['in', 'out', 'adj'].includes(t.type)) errs.push(tr('Choose a transaction type.'));
    if (!isFinite(t.qty) || t.qty === null) errs.push(tr('Enter a quantity.'));
    else if (t.type === 'adj' ? t.qty === 0 : t.qty <= 0) errs.push(t.type === 'adj' ? tr('Adjustment quantity cannot be 0. Use + for stock found and − for stock missing.') : tr('Quantity must be more than 0.'));
    if (t.type === 'in' && (!isFinite(t.price) || t.price === null || t.price < 0)) errs.push(tr('Enter the purchase price per unit (0 or more).'));
    if (errs.length) return errs;
    const r = run(txs.filter((x) => x.id !== t.id).concat([t]));
    if (r.firstNegative) errs.push(negativeError(r.firstNegative));
    return errs;
  }

  /** Can this transaction be deleted without making stock negative later on? Returns an error message or ''. */
  function checkDelete(txs, id) {
    const r = run(txs.filter((x) => x.id !== id));
    return r.firstNegative ? negativeError(r.firstNegative) : '';
  }

  /** Stock on hand per item at the end of a date. */
  function stock(txs, asOf) {
    const r = run(txs, { until: asOf || '9999-12-31' });
    return [...r.items.values()].sort((a, b) => a.item.localeCompare(b.item));
  }

  /** Stock movement per item for a period: opening + bought − used ± adjustment = closing.
      outCost is the cost of what was used, at moving average cost. */
  function movement(txs, from, to) {
    const f = from || '0000-01-01', e = to || '9999-12-31';
    if (f > e) return []; // a period that ends before it starts has no movement
    const open = run(txs, { until: dayBefore(f) }).items;
    const close = run(txs, { until: e });
    const out = new Map();
    const blank = (s) => ({
      key: s.key, item: s.item, unit: s.unit,
      openQty: 0, openValue: 0, inQty: 0, inValue: 0, outQty: 0, outCost: 0, adjQty: 0, adjValue: 0,
      closeQty: s.qty, closeValue: s.value,
    });
    for (const s of close.items.values()) out.set(s.key, blank(s));
    for (const s of open.values()) { const m = out.get(s.key); m.openQty = s.qty; m.openValue = s.value; }
    for (const t of txs) {
      if (t.date < f || t.date > e) continue;
      const m = out.get(itemKey(t));
      const row = close.rows.get(t.id);
      if (t.type === 'in') { m.inQty += t.qty; m.inValue += row.cost; }
      else if (t.type === 'out') { m.outQty += t.qty; m.outCost += row.used; }
      else { m.adjQty += t.qty; m.adjValue += row.cost; }
    }
    const list = [...out.values()].filter((m) => m.openQty || m.closeQty || m.inQty || m.outQty || m.adjQty);
    for (const m of list) {
      for (const k of ['inValue', 'outCost', 'adjValue']) m[k] = round(m[k], 2);
      for (const k of ['inQty', 'outQty', 'adjQty']) m[k] = round(m[k], 4);
    }
    return list.sort((a, b) => a.item.localeCompare(b.item));
  }

  /** Figures over time for the charts, from..to (both required), grouped per day, week, month or year depending on
      how long the period is. Returns { unit, buckets: [{ start, end, purchases, used, value }] } where used is the cost
      of what was used and value is the value of all stock at the end of the bucket. */
  function timeline(txs, from, to) {
    const r = run(txs, { until: to });
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    const unit = days <= 31 ? 'day' : days <= 182 ? 'week' : days <= 1100 ? 'month' : 'year';
    const keyOf = (iso) => {
      if (unit === 'day') return iso;
      if (unit === 'week') return addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7)); // its Monday
      return iso.slice(0, unit === 'month' ? 7 : 4);
    };
    const buckets = [], byKey = new Map();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const k = keyOf(d);
      let b = byKey.get(k);
      if (!b) { b = { start: d, end: d, purchases: 0, used: 0, change: 0, value: 0 }; byKey.set(k, b); buckets.push(b); }
      b.end = d;
    }
    let value = 0; // stock value before the period
    for (const t of txs) {
      const row = r.rows.get(t.id);
      if (!row) continue; // after the period
      if (t.date < from) { value += row.cost; continue; }
      const b = byKey.get(keyOf(t.date));
      b.change += row.cost;
      if (t.type === 'in') b.purchases += row.cost;
      if (t.type === 'out') b.used += row.used;
    }
    for (const b of buckets) {
      value += b.change;
      b.value = round(value, 2); b.purchases = round(b.purchases, 2); b.used = round(b.used, 2);
      delete b.change;
    }
    return { unit, buckets };
  }

  /** A salary payment: { id, empId, emp, dept, month: 'YYYY-MM', date, base, allowance, deduction, note }. */
  const payTotal = (p) => round((p.base || 0) + (p.allowance || 0) - (p.deduction || 0), 2);
  /** Salaries paid in a period, counted on the date they were paid and added up per employee. */
  function payroll(pays, from, to) {
    const f = from || '0000-01-01', e = to || '9999-12-31', out = new Map();
    for (const p of pays) {
      if (p.date < f || p.date > e) continue;
      let r = out.get(p.empId);
      if (!r) { r = { empId: p.empId, emp: p.emp, dept: p.dept, count: 0, base: 0, allowance: 0, deduction: 0, total: 0 }; out.set(p.empId, r); }
      r.count++; r.base += p.base; r.allowance += p.allowance; r.deduction += p.deduction;
    }
    const list = [...out.values()];
    for (const r of list) {
      for (const k of ['base', 'allowance', 'deduction']) r[k] = round(r[k], 2);
      r.total = payTotal(r);
    }
    return list.sort((a, b) => a.emp.localeCompare(b.emp));
  }

  /** Cost of each work plan (RAB) in a period: what was bought for it (purchases, by date), the material used (the cost
      of its work reports at moving average cost, by report date) and the wages paid on it (by the date paid).
      total = material used + wages paid: what is bought but not used stays in stock for other RABs.
      Payments without a RAB (the old monthly salaries) are left out.
      Returns [{ rabId, purchases, reports, material, payments, wages, total }]. */
  function rabCosts(txs, pays, from, to) {
    const f = from || '0000-01-01', e = to || '9999-12-31', out = new Map();
    if (f > e) return [];
    const rows = run(txs, { until: e }).rows;
    const get = (id) => {
      let r = out.get(id);
      if (!r) { r = { rabId: id, purchases: 0, reports: 0, material: 0, payments: 0, wages: 0, total: 0 }; out.set(id, r); }
      return r;
    };
    for (const t of txs) {
      if (!t.rabId || t.date < f || t.date > e || t.type === 'adj') continue;
      const r = get(t.rabId), row = rows.get(t.id);
      if (t.type === 'in') r.purchases += row ? row.cost : 0;
      else { r.reports++; r.material += row ? row.used : 0; }
    }
    for (const p of pays) {
      if (!p.rabId || p.date < f || p.date > e) continue;
      const r = get(p.rabId);
      r.payments++; r.wages += payTotal(p);
    }
    const list = [...out.values()];
    for (const r of list) {
      for (const k of ['purchases', 'material', 'wages']) r[k] = round(r[k], 2);
      r.total = round(r.material + r.wages, 2);
    }
    return list;
  }

  /** CSV with plain numbers (dot decimals), UTF-8 BOM so Excel opens it with the right characters. */
  function csv(header, rows) {
    const q = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [header, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
  }

  g.C = { tr, round, clean, key, itemKey, signed, sort, addDays, dayBefore, timeline, payTotal, payroll, rabCosts, run, validate, checkDelete, stock, movement, csv };
})(typeof window !== 'undefined' ? window : globalThis);
