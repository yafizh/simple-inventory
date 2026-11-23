/* app.js — the pages and who may open them. Everything bought or used is for a RAB.
   - supervisor : RAB (read only), Reports (the summary and one page per table), and the stock card of an item
   - admin      : Input (purchases and adjustments), Work reports (approve, reject or correct what the employees sent),
                  RAB (with its purchases, work reports and wages), Reports, Master data (items, employees, types of
                  work, units, users), and the stock card of an item
   - pegawai    : Report work (on the RAB lines given to them: a use with a photo, and their own reports)
   Only employees send work reports. They wait until the admin approves them; only approved ones are in the stock.
   Routes: #/input, #/input/<id>, #/reports, #/reports/<id>, #/rab, #/rab/<id|new>, #/rab/<id>/edit, #/report (summary),
   #/report/<rab|stock|movement|wages>, #/stock/<itemId>, #/work, #/master/<items|employees|jobs|units|users>. Without a
   signed-in user every route shows the sign-in page. */
(function () {
  'use strict';
  const main = document.getElementById('main');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = main) => root.querySelector(sel);
  const $$ = (sel, root = main) => [...root.querySelectorAll(sel)];
  const num = (v) => (String(v).trim() === '' ? null : Number(v));
  const today = () => S.today();
  // in = a purchase for a RAB, out = a use reported as work on a RAB, adj = an adjustment after a stock count
  const TYPE = {
    in: { label: () => t('Purchase'), short: () => t('Buy'), badge: 'ok' },
    out: { label: () => t('Work report'), short: () => t('Use'), badge: 'info' },
    adj: { label: () => t('Adjustment'), short: () => t('Adj.'), badge: 'warn' },
  };
  const badge = (type) => `<span class="badge ${TYPE[type].badge}">${esc(TYPE[type].short())}</span>`;
  const dash = '<span class="faint">—</span>';
  /** Line icons on a 24×24 grid, drawn with the text colour (see .ico in css/app.css). */
  const ICON = {
    input: '<path d="M12 3.5v9"/><path d="M8 8.5l4 4 4-4"/><path d="M3.5 14.5h4l1.5 2.5h6l1.5-2.5h4"/><path d="M3.5 14.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3.5"/>',
    reports: '<path d="M9 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="3.5" rx="1"/><path d="M9 13.5l2 2 4-4"/>',
    rab: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    report: '<path d="M4 4v15a1 1 0 0 0 1 1h15"/><path d="M8.5 16v-4"/><path d="M13 16V8"/><path d="M17.5 16v-6"/>',
    items: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',
    employees: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-.5A5.5 5.5 0 0 1 8 14h2a5.5 5.5 0 0 1 5.5 5.5v.5"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.2a5.5 5.5 0 0 1 3.5 5.3v.5"/>',
    jobs: '<path d="M3 18.5h18"/><path d="M5 18.5v-2a7 7 0 0 1 14 0v2"/><path d="M10 9.8V6.5a2 2 0 0 1 4 0v3.3"/>',
    units: '<rect x="2.5" y="7.5" width="19" height="9" rx="1.5"/><path d="M6.5 7.5v3"/><path d="M10.5 7.5v4.5"/><path d="M14.5 7.5v3"/><path d="M18.5 7.5v4.5"/>',
    users: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10.5" r="2"/><path d="M6 15.5a3 3 0 0 1 6 0"/><path d="M15 10h3"/><path d="M15 14h3"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>',
    warehouse: '<path d="M3 20.5V9l9-5.5L21 9v11.5"/><path d="M7 20.5V12h10v8.5"/><path d="M7 16h10"/>',
    movement: '<path d="M4 8h15"/><path d="M15 4l4 4-4 4"/><path d="M20 16H5"/><path d="M9 12l-4 4 4 4"/>',
    wages: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4"/><path d="M18 10v4"/>',
    updown: '<path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
    key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13l9.5-9.5"/><path d="M16.5 6.5l2.5 2.5"/><path d="M14 9l2 2"/>',
    data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/>',
    out: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 8.5l2 2"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/>',
    cloudOk: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/><path d="M9.5 13.8l1.8 1.8 3.4-3.6"/>',
    cloudOff: '<path d="M9.5 9.2a6 6 0 0 1 8.6 1.34 4 4 0 0 1 1.9 6.8"/><path d="M15.5 18.5H7a4.75 4.75 0 0 1-1.3-9.3"/><path d="M3.5 3.5l17 17"/>',
    sync: '<path d="M19.5 11A7.5 7.5 0 0 0 6.2 7.2L4.5 9"/><path d="M4.5 4.5V9H9"/><path d="M4.5 13a7.5 7.5 0 0 0 13.3 3.8L19.5 15"/><path d="M19.5 19.5V15H15"/>',
    alert: '<path d="M12 3.5l9 15.5H3z"/><path d="M12 10v4"/><path d="M12 16.8v.2"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  };
  const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;
  // a work report sent by an employee waits for the admin, who approves or rejects it
  const REVIEW = {
    pending: { label: () => t('Waiting'), badge: 'warn' },
    approved: { label: () => t('Approved'), badge: 'ok' },
    rejected: { label: () => t('Rejected'), badge: 'err' },
  };
  const reviewBadge = (tx) => { const r = REVIEW[tx.status || 'approved']; return `<span class="badge ${r.badge}">${esc(r.label())}</span>`; };
  /** Where an entry opens: a work report on its review page, anything else on the input page. */
  const openUrl = (tx) => (tx.type === 'out' && tx.rabId ? '#/reports/' : '#/input/') + tx.id;
  const signedQty = (tx) => (tx.type === 'in' ? '+' : tx.type === 'adj' && tx.qty > 0 ? '+' : '') + fmtQty(C.signed(tx));

  function toast(msg, kind = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3000);
  }
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---- export menu (Excel / PDF / image / CSV). build() returns the export document, see js/export.js
  function now() { const d = new Date(); return fmtDate(today()) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function exportMenu(extraCsv) {
    const items = [['xlsx', t('Excel (.xlsx)')], ['pdf', t('PDF')], ['png', t('Image (.png)')]]
      .concat(extraCsv || [['csv', t('CSV')]]);
    return `<details class="menu no-print"><summary class="btn primary-outline">${esc(t('Export'))} ▾</summary>
      <div class="menu-list" role="menu">${items.map(([k, label]) => `<button type="button" role="menuitem" data-x="${esc(k)}">${esc(label)}</button>`).join('')}</div></details>`;
  }
  /** Wires an export menu: build() gives the document, base is the file name without extension. */
  function wireExport(build, base) {
    const menu = $('details.menu');
    menu.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-x]');
      if (!b) return;
      menu.open = false;
      const kind = b.dataset.x, doc = build();
      try {
        let blob, ext = kind;
        const name0 = typeof base === 'function' ? base() : base; // worked out on each export: the period may have changed
        if (kind === 'xlsx') blob = X.toXlsx(doc, { summaryName: t('Summary') });
        else if (kind === 'pdf') blob = X.toPdf(doc, { footer: doc.app + ' · ' + doc.title, pageLabel: (i, n) => t('Page {i} of {n}', { i, n }) });
        else if (kind === 'png') blob = await X.toPng(doc);
        else { const i = Number(kind.split(':')[1] || 0); blob = X.toCsv(doc.sections[i]); ext = 'csv'; }
        const name = `${name0}${kind.includes(':') ? '_' + C.key(doc.sections[Number(kind.split(':')[1])].sheet).replace(/\s+/g, '-') : ''}.${ext}`;
        download(name, blob);
        toast(t('Exported {file}.', { file: name }));
      } catch (err) {
        console.error(err);
        toast(err.message === 'too-large' ? t('Too many rows for one image. Use PDF or Excel instead.') : t('Export failed.'), 'err');
      }
    });
  }
  document.addEventListener('click', (e) => { document.querySelectorAll('details.menu[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });

  // ---- form in a dialog, used for the master data. Dialogs can open on top of each other (item → new unit).
  let dlgSeq = 0;
  const INPUT = { password: 'type="password" autocomplete="new-password"', number: 'type="number" step="any" min="0" inputmode="decimal"', date: 'type="date"' };
  /** o: { title, fields: [{ name, label, type: 'text'|'password'|'number'|'date'|'select'|'checkbox', options: () => [[value, label]], add, addLabel, hint,
      placeholder, when(get) → false hides the field }], values, save(values) → [errors], saveLabel, remove() → error | '' (deleted) | null (cancelled),
      change(name, get, set) runs when the user changes a field } */
  function formDialog(o) {
    const n = ++dlgSeq, v = o.values || {};
    const opts = (f, sel) => f.options().map(([k, label]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const field = (f) => {
      const id = `d${n}-${f.name}`, hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
      if (f.type === 'checkbox') return `<div class="field" data-f="${f.name}"><label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${v[f.name] !== false ? 'checked' : ''}> ${esc(f.label)}</label>${hint}</div>`;
      const input = f.type === 'select'
        ? `<div class="with-btn"><select id="${id}" name="${f.name}">${opts(f, v[f.name] || '')}</select>${f.add ? `<button type="button" data-add="${f.name}">+ ${esc(f.addLabel)}</button>` : ''}</div>`
        : `<input id="${id}" name="${f.name}" ${INPUT[f.type] || ''} value="${esc(v[f.name] || '')}" placeholder="${esc(f.placeholder || '')}">`;
      return `<div class="field" data-f="${f.name}"><label for="${id}">${esc(f.label)}</label>${input}${hint}</div>`;
    };
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `<form novalidate autocomplete="off">
      <h2>${esc(o.title)}</h2>
      <div class="dlg-body">${o.fields.map(field).join('')}</div>
      <div class="errs"></div>
      <div class="form-actions">
        ${o.remove ? `<button type="button" class="danger" data-a="del">${esc(t('Delete'))}</button>` : ''}<span class="spacer"></span>
        <button type="button" data-a="cancel">${esc(t('Cancel'))}</button><button type="submit" class="primary">${esc(o.saveLabel || t('Save'))}</button>
      </div></form>`;
    const form = $('form', dlg);
    const showErrs = (list) => { $('.errs', dlg).innerHTML = `<div class="alert err" role="alert">${list.length === 1 ? esc(list[0]) : `<ul>${list.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`}</div>`; };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};
      for (const f of o.fields) out[f.name] = f.type === 'checkbox' ? form.elements[f.name].checked : form.elements[f.name].value;
      const errs = o.save(out);
      if (errs.length) showErrs(errs); else dlg.close();
    });
    dlg.addEventListener('click', (e) => {
      const a = e.target.closest('button[data-a]'), add = e.target.closest('button[data-add]');
      if (a && a.dataset.a === 'cancel') dlg.close();
      if (a && a.dataset.a === 'del') { const err = o.remove(); if (err) showErrs([err]); else if (err === '') dlg.close(); }
      if (add) {
        const f = o.fields.find((x) => x.name === add.dataset.add);
        f.add((id) => { form.elements[f.name].innerHTML = opts(f, id); });
      }
    });
    const get = (name) => (form.elements[name].type === 'checkbox' ? form.elements[name].checked : form.elements[name].value);
    const applyWhen = () => o.fields.forEach((f) => { if (f.when) $(`[data-f="${f.name}"]`, dlg).hidden = !f.when(get); });
    form.addEventListener('change', applyWhen);
    if (o.change) form.addEventListener('change', (e) => o.change(e.target.name, get, (name, value) => { form.elements[name].value = value; }));
    applyWhen();
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
    const inputs = [...dlg.querySelectorAll('input:not([type=checkbox]), select')].filter((el) => !el.closest('[hidden]'));
    (inputs.find((el) => !el.value) || inputs[0]).focus();
  }

  // ---- photos (kept by js/photos.js). Object URLs made for a page are released when the page changes.
  const urls = [];
  const blobUrl = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
  const errBox = (list) => `<div class="alert err" role="alert">${list.length === 1 ? esc(list[0]) : `<ul>${list.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`}</div>`;
  /** A photo picker inside box: a large "Add photo" button (a phone offers the camera or the gallery), then a preview
      with Change and Remove. currentId is the photo a transaction already has.
      Returns { has(), save() → Promise of the photo id to store on the transaction ('' = none) }. */
  function photoField(box, currentId) {
    const st = { id: currentId || '', blob: null };
    box.innerHTML = `<div class="photo-pick">
      <input type="file" accept="image/*" id="f-photo" class="sr-only">
      <label for="f-photo" class="photo-drop">${icon('camera')}<span>${esc(t('Add photo'))}</span></label>
      <div class="photo-prev" hidden><img alt="${esc(t('Photo'))}">
        <div class="row"><label for="f-photo" class="btn sm">${esc(t('Change photo'))}</label><button type="button" class="sm">${esc(t('Remove photo'))}</button></div></div>
    </div>`;
    const input = $('input', box), drop = $('.photo-drop', box), prev = $('.photo-prev', box), img = $('img', box);
    const show = (blob) => { img.src = blobUrl(blob); prev.hidden = false; drop.hidden = true; };
    if (st.id) Photos.get(st.id).then((blob) => { if (blob && st.id) show(blob); }).catch(() => {});
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      Photos.shrink(file).then((blob) => { st.blob = blob; st.id = ''; show(blob); })
        .catch(() => { input.value = ''; toast(t('This file is not a picture the browser can open.'), 'err'); });
    });
    $('button', box).addEventListener('click', () => { st.blob = null; st.id = ''; input.value = ''; prev.hidden = true; drop.hidden = false; });
    return { has: () => !!(st.id || st.blob), save: () => (st.blob ? Photos.put(st.blob) : Promise.resolve(st.id)) };
  }
  /** Saves a checked transaction together with its photo. oldPhoto is the photo it had before. Returns { errors, tx }. */
  async function saveTx(x, photo, oldPhoto) {
    let id;
    try { id = await photo.save(); } catch (e) { console.error(e); return { errors: [t('The photo could not be saved in this browser.')] }; }
    const res = S.put(Object.assign({}, x, { photo: id }));
    if (res.errors.length) { if (id !== oldPhoto) Photos.remove(id); return res; }
    if (oldPhoto && oldPhoto !== id) Photos.remove(oldPhoto);
    return res;
  }
  /** Deletes a transaction and its photo. Returns an error message or ''. */
  function removeTx(id) {
    const tx = S.get(id), err = S.remove(id);
    if (!err && tx && tx.photo) Photos.remove(tx.photo);
    return err;
  }
  /** Shows the photo of a transaction in a dialog. */
  function viewPhoto(tx) {
    Photos.get(tx.photo).then((blob) => {
      if (!blob) { toast(t('The photo is not on this device.'), 'err'); return; }
      const dlg = document.createElement('dialog');
      dlg.className = 'dlg photo';
      dlg.innerHTML = `<img alt="${esc(t('Photo'))}"><div class="cap"><div><strong>${esc(tx.item)}</strong> · ${esc((fmtQty(Math.abs(tx.qty)) + ' ' + tx.unit).trim())}</div>
        <div class="muted small">${esc([fmtDate(tx.date), tx.emp, tx.note].filter(Boolean).join(' · '))}</div></div>
        <div class="form-actions"><span class="spacer"></span><button type="button">${esc(t('Close'))}</button></div>`;
      $('img', dlg).src = blobUrl(blob);
      $('button', dlg).addEventListener('click', () => dlg.close());
      dlg.addEventListener('close', () => dlg.remove());
      document.body.appendChild(dlg);
      dlg.showModal();
    }).catch(() => toast(t('The photo is not on this device.'), 'err'));
  }

  // =====================================================================================  Input
  /** The admin's entry form:
      - Purchase (in) : an item of an open RAB, with its purchase price and supplier (everything bought is for a RAB)
      - Adjustment    : after a stock count, + found / − missing or damaged, not on a RAB
      Work reports are sent by the employees and checked on the Work reports page. An entry keeps its type when it is
      changed. An old use without a RAB (from before) can still be changed here. */
  let lastType = 'in', lastDate = null, lastRab = '';
  let inputPreset = null; // set by the RAB page for the next new entry: { type, rabId }

  function viewInput(id) {
    const editing = id ? S.get(id) : null;
    if (id && !editing) { toast(t('Transaction not found.'), 'err'); location.hash = '#/input'; return; }
    if (editing && editing.type === 'out' && editing.rabId) { location.hash = '#/reports/' + id; return; } // checked on its own page
    // opened from a RAB page or a stock card: Back, Cancel, Save and Delete go back there
    const back = /^#\/(rab|stock)\//.test(from) ? from : '';
    const preset = editing ? null : inputPreset;
    inputPreset = null;
    const v = editing || { type: preset ? preset.type : lastType, date: lastDate || today(), rabId: preset ? preset.rabId : lastRab };
    // an entry from before purchases and use were tied to a RAB may stay without one
    const legacy = !!(editing && editing.type !== 'adj' && !editing.rabId);
    const rabs = S.rabs().filter((r) => r.status === 'open' || (editing && editing.rabId === r.id));
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(editing ? t('Edit transaction') : t('New transaction'))}</h1>
        ${legacy ? `<div class="sub">${esc(t('This entry is from before purchases and use were tied to a RAB. It can stay without one.'))}</div>` : ''}</div>
        ${back ? `<div class="actions"><a class="btn" href="${esc(back)}">← ${esc(t('Back'))}</a></div>` : ''}</div>
      <div class="input-grid">
        <form class="card" id="txForm" novalidate autocomplete="off">
          <div class="seg" role="radiogroup" aria-label="${esc(t('Type'))}">
            ${(editing ? [editing.type] : ['in', 'adj']).map((k) => `<label><input type="radio" name="type" value="${k}" ${v.type === k ? 'checked' : ''}><span>${esc(TYPE[k].label())}</span></label>`).join('')}
          </div>
          <div class="form">
            <div class="field wide2" id="w-rab"><label for="f-rab">${esc(t('RAB'))}</label>
              <select id="f-rab" name="rab"><option value="">${esc(legacy ? t('— none (old entry) —') : t('— choose —'))}</option>
                ${rabs.map((r) => `<option value="${esc(r.id)}" ${v.rabId === r.id ? 'selected' : ''}>${esc(r.no + ' · ' + r.title)}</option>`).join('')}</select>
              <span class="hint" id="h-rab"></span></div>
            <div class="field"><label for="f-date">${esc(t('Date'))}</label><input type="date" id="f-date" name="date" value="${esc(v.date)}" max="${today()}" required></div>
            <div class="field wide2"><label for="f-item">${esc(t('Item'))}</label>
              <input id="f-item" name="item" list="dl-items" value="${esc(v.item || '')}" placeholder="${esc(t('Type the item name or code'))}" required>
              <datalist id="dl-items"></datalist></div>
            <div class="field"><label for="f-qty" id="l-qty"></label><input type="number" step="any" inputmode="decimal" id="f-qty" name="qty" value="${v.qty ?? ''}" required><span class="hint" id="h-qty"></span></div>
            <div class="field" id="w-emp"><label for="f-emp">${esc(t('Employee'))}</label><select id="f-emp" name="emp"></select><span class="hint">${esc(t('Who did the work.'))}</span></div>
            <div class="field" id="w-price"><label for="f-price">${esc(t('Purchase price / unit'))}</label><input type="number" step="any" min="0" inputmode="decimal" id="f-price" name="price" value="${editing && editing.type === 'in' ? editing.price : ''}"></div>
            <div class="field"><label>${esc(t('Total'))}</label><div class="readout" id="o-total">—</div></div>
            <div class="field" id="w-party"><label for="f-party">${esc(t('Supplier'))}</label><input id="f-party" name="party" value="${esc(editing && editing.type === 'in' ? editing.party : '')}" placeholder="${esc(t('Optional'))}"></div>
            <div class="field" id="w-ref"><label for="f-ref">${esc(t('Reference no.'))}</label><input id="f-ref" name="ref" value="${esc(v.ref || '')}"></div>
            <div class="field wide"><label for="f-note" id="l-note"></label><input id="f-note" name="note" value="${esc(v.note || '')}"></div>
            <div class="field wide"><label for="f-photo">${esc(t('Photo'))}</label><div id="w-photo"></div><span class="hint" id="h-photo"></span></div>
          </div>
          <div id="errs"></div>
          <div class="form-actions">
            ${editing ? `<button type="button" class="danger" id="b-del">${esc(t('Delete'))}</button><span class="spacer"></span><a class="btn" href="${esc(back || '#/input')}">${esc(t('Cancel'))}</a>` : '<span class="spacer"></span>'}
            <button type="submit" class="primary">${esc(editing ? t('Save changes') : t('Save'))}</button>
          </div>
        </form>
        <aside class="card" id="itemInfo"></aside>
      </div>
      ${editing ? '' : `<div class="card flush"><div class="card-head"><h2>${esc(t('Latest entries'))}</h2></div><div id="latest"></div></div>`}`;

    const form = $('#txForm');
    const photo = photoField($('#w-photo'), editing ? editing.photo : '');
    const type = () => form.type.value;
    const rabNow = () => (type() === 'adj' ? null : S.rab(form.rab.value));
    const val = () => {
      const k = type(), it = S.findItem(form.item.value);
      return {
        id: editing ? editing.id : undefined, type: k, date: form.date.value, item: form.item.value, itemId: it ? it.id : '',
        rabId: k === 'adj' ? '' : form.rab.value, empId: k === 'out' ? form.emp.value : '',
        qty: num(form.qty.value), price: k === 'in' ? num(form.price.value) : 0,
        party: k === 'in' ? form.party.value : '', ref: k === 'out' ? '' : form.ref.value, note: form.note.value,
      };
    };
    /** Items to choose from: the RAB's items (for a work report only those with something left), or any item for an adjustment. */
    function itemList() {
      const rab = rabNow(), keep = (x) => x.active || (editing && editing.itemId === x.id);
      if (rab) {
        return S.rabLines(rab).filter((l) => type() === 'in' || l.left > 0 || (editing && editing.lineId === l.id))
          .map((l) => S.find('items', l.itemId)).filter((x) => x && keep(x));
      }
      return type() === 'adj' || legacy ? S.list('items').filter(keep) : [];
    }
    /** Employees to choose from for a work report: the ones on the RAB. */
    function empList() {
      const rab = rabNow(), keep = (x) => x.active || (editing && editing.empId === x.id);
      if (rab) return rab.workers.map((w) => S.find('employees', w.empId)).filter((x) => x && keep(x));
      return legacy ? S.list('employees').filter(keep) : [];
    }
    function fillLists() {
      $('#dl-items').innerHTML = itemList().map((x) => `<option value="${esc(x.name)}" label="${esc([x.code, S.unitName(x)].filter(Boolean).join(' · '))}">`).join('');
      const emps = empList(), cur = form.emp.value || v.empId || '';
      form.emp.innerHTML = `<option value="">${esc(t('— choose —'))}</option>` + emps.map((x) => `<option value="${esc(x.id)}">${esc(x.name + (x.dept ? ' — ' + x.dept : ''))}</option>`).join('');
      form.emp.value = emps.some((x) => x.id === cur) ? cur : emps.length === 1 ? emps[0].id : '';
      $('#h-rab').textContent = rabNow() || legacy ? '' : rabs.length ? t('Choose the RAB first: the item list shows its items.') : t('There is no open RAB. Make one under RAB first.');
    }
    function qtyLabel() {
      const unit = S.unitName(S.findItem(form.item.value));
      $('#l-qty').textContent = (type() === 'adj' ? t('Quantity (+ / −)') : t('Quantity')) + (unit ? ` (${unit})` : '');
    }
    function onType() {
      const k = type();
      $('#w-rab').hidden = k === 'adj' || (legacy && k === 'out'); // an old use stays without a RAB
      $('#w-emp').hidden = k !== 'out';
      $('#w-price').hidden = k !== 'in';
      $('#w-party').hidden = k !== 'in';
      $('#w-ref').hidden = k === 'out';
      form.ref.placeholder = k === 'in' ? t('Invoice, delivery note…') : t('Stock count sheet…');
      $('#l-note').textContent = k === 'out' ? t('Work done') : t('Note');
      form.note.placeholder = k === 'out' ? t('What was it used for?') : t('Optional');
      $('#h-qty').textContent = k === 'adj' ? t('Use + for stock found, − for stock missing or damaged') : '';
      form.qty.min = k === 'adj' ? '' : '0';
      $('#h-photo').textContent = k === 'in' ? t('A photo of the receipt. Optional.') : k === 'out' ? t('A photo of the work. Optional.') : t('Optional');
      fillLists();
      qtyLabel();
      onCalc();
    }
    function onCalc() {
      const x = val(), out = $('#o-total');
      if (x.type === 'in') {
        out.textContent = x.qty && x.price ? fmtAmt(C.round(x.qty * x.price, 2)) : '—';
        out.title = '';
      } else {
        const info = itemState(x);
        out.textContent = info && x.qty ? fmtAmt(C.round(Math.abs(x.qty) * info.avg, 2)) : '—';
        out.title = t('Valued at the average cost');
      }
    }
    function itemState(x) {
      if (!x.itemId) return null;
      const others = S.txs().filter((tx) => !editing || tx.id !== editing.id);
      return C.stock(others, x.date || today()).find((s) => s.key === x.itemId) || null;
    }
    /** The side panel: stock of the item, its line on the RAB, and what the open RABs still need of it. */
    function onItem() {
      const x = val(), box = $('#itemInfo'), name = C.clean(x.item), it = S.find('items', x.itemId), rab = rabNow();
      if (!name) box.innerHTML = `<p class="muted">${esc(S.state.items.length ? t('Type an item name or code to see its stock.') : t('No items yet.'))}</p>`;
      else if (!it) {
        box.innerHTML = `<h2>${esc(name)}</h2><p class="muted">${esc(x.type === 'adj' ? t('Not in the item master yet. Add it under Items first.')
          : t('Not in the item master yet. Add it on the RAB with New item.'))}</p>`;
      } else {
        const s = itemState(x) || { qty: 0, avg: 0, value: 0, lastIn: null };
        const unit = S.unitName(it), qu = (q) => (fmtQty(q) + ' ' + unit).trim();
        const line = rab && S.rabLines(rab).find((l) => l.itemId === it.id), need = S.needs().get(it.id);
        box.innerHTML = `<h2>${esc(it.name)}</h2>${it.code ? `<div class="muted small code">${esc(it.code)}</div>` : ''}
          <div class="big">${esc(fmtQty(s.qty))} <span class="muted">${esc(unit)}</span></div>
          <div class="muted small">${esc(t('Current stock'))} ${esc(t('on {date}', { date: fmtDate(x.date || today()) }))}</div>
          <dl class="kv">
            <dt>${esc(t('Average cost'))}</dt><dd class="num">${esc(fmtAmt(s.avg))}</dd>
            <dt>${esc(t('Stock value'))}</dt><dd class="num">${esc(fmtAmt(s.value))}</dd>
            <dt>${esc(t('Last purchase price'))}</dt><dd class="num">${s.lastIn == null ? '—' : esc(fmtAmt(s.lastIn))}</dd>
          </dl>
          ${!rab ? '' : line ? `<h3>${esc(rab.no)}</h3><dl class="kv">
              <dt>${esc(t('Planned'))}</dt><dd class="num">${esc(qu(line.qty))}</dd>
              <dt>${esc(t('Bought'))}</dt><dd class="num">${esc(qu(line.bought))}</dd>
              <dt>${esc(t('Used'))}</dt><dd class="num">${esc(qu(line.used))}</dd>
              ${line.waiting ? `<dt>${esc(t('Waiting for approval'))}</dt><dd class="num">${esc(qu(line.waiting))}</dd>` : ''}
              <dt>${esc(t('Left'))}</dt><dd class="num">${esc(qu(line.left))}</dd></dl>`
            : `<div class="alert err">${esc(t('{item} is not on {no}. Add it to the RAB first.', { item: it.name, no: rab.no }))}</div>`}
          ${need ? `<h3>${esc(t('Needed on open RABs'))}</h3><dl class="kv">${need.rabs.map((r) => `<dt>${esc(r.no)}</dt><dd class="num">${esc(qu(r.qty))}</dd>`).join('')}</dl>
            ${need.qty > s.qty ? `<p><span class="badge warn">${esc(t('Short {qty}', { qty: qu(C.round(need.qty - s.qty, 4)) }))}</span></p>` : ''}` : ''}`;
      }
      qtyLabel();
      onCalc();
    }
    /** Picking a known item shows its full name (a code may have been typed) and fills in the last purchase price. */
    function onItemPicked() {
      const x = val(), it = S.find('items', x.itemId);
      if (!it) return;
      form.item.value = it.name;
      const s = itemState(x);
      if (x.type === 'in' && s && s.lastIn != null && !form.price.value.trim()) form.price.value = s.lastIn;
      onCalc();
    }
    function renderLatest() {
      const box = $('#latest');
      if (!box) return;
      const list = S.txs().slice().sort((a, b) => b.seq - a.seq).slice(0, 6);
      box.innerHTML = list.length ? txTable(list, { compact: true }) : `<p class="empty">${esc(t('No transactions yet.'))}</p>`;
      wireTable(box, renderLatest);
    }

    $$('input[name=type]').forEach((r) => r.addEventListener('change', () => { onType(); onItem(); }));
    form.rab.addEventListener('change', () => { fillLists(); onItem(); });
    form.item.addEventListener('input', onItem);
    form.item.addEventListener('change', onItemPicked);
    form.date.addEventListener('change', onItem);
    form.qty.addEventListener('input', onCalc);
    form.price.addEventListener('input', onCalc);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const x = val();
      const errors = S.put(x, true).errors; // check first, so a photo is only stored for an entry that is saved
      if (x.type === 'out' && x.rabId && !C.clean(x.note)) errors.push(t('Describe the work this was used for.'));
      const res = errors.length ? { errors } : await saveTx(x, photo, editing ? editing.photo : '');
      if (res.errors.length) { $('#errs').innerHTML = errBox(res.errors); return; }
      if (editing) { toast(t('Changes saved.')); location.hash = back || '#/input'; return; }
      lastType = x.type; lastDate = x.date;
      if (x.rabId) lastRab = x.rabId;
      toast(t('Saved: {type} {qty} {item}.', { type: TYPE[x.type].label().toLowerCase(), qty: (fmtQty(Math.abs(res.tx.qty)) + ' ' + res.tx.unit).trim(), item: res.tx.item }));
      viewInput(); // fresh form, keeps type, date and RAB
      $('#f-item').focus();
    });
    if (editing) {
      $('#b-del').addEventListener('click', () => {
        if (!confirm(t('Delete this transaction?'))) return;
        const err = removeTx(editing.id);
        if (err) { $('#errs').innerHTML = errBox([err]); return; }
        toast(t('Transaction deleted.'));
        location.hash = back || '#/input';
      });
    }
    onType();
    onItem();
    renderLatest();
  }

  // =====================================================================================  Stock card
  /** Table of entries, for the latest entries on Input and the stock card. Rows open the edit form, unless opts.readonly.
      opts.compact: fewer columns · opts.noItem: no item column (a stock card is about one item). */
  function txTable(list, opts = {}) {
    const rows = C.run(S.txs()).rows, full = !opts.compact;
    // [header, class, cell(tx, figures)]
    const cols = [
      [t('Date'), '', (tx) => `<td class="nowrap">${esc(fmtDate(tx.date))}</td>`],
      [t('Type'), '', (tx) => `<td>${badge(tx.type)}</td>`],
      !opts.noItem && [t('Item'), '', (tx) => `<td class="name">${esc(tx.item)}</td>`],
      [t('RAB'), '', (tx) => `<td>${tx.rabNo ? `<a class="nowrap" href="#/rab/${esc(tx.rabId)}">${esc(tx.rabNo)}</a>${full ? `<div class="muted small">${esc(tx.rabTitle)}</div>` : ''}` : dash}</td>`],
      [t('Quantity'), 'num', (tx) => `<td class="num">${esc(signedQty(tx))} <span class="muted">${esc(tx.unit)}</span></td>`],
      full && [t('Price'), 'num', (tx) => `<td class="num">${tx.type === 'in' ? esc(fmtAmt(tx.price)) : dash}</td>`],
      [t('Total'), 'num', (tx, r) => { const v = txTotal(tx, r); return `<td class="num">${v ? esc(fmtAmt(v)) : dash}</td>`; }],
      full && [t('Supplier'), '', (tx) => `<td>${esc(tx.party)}</td>`],
      full && [t('Employee'), '', (tx) => `<td>${esc(tx.emp)}</td>`],
      full && [t('Ref.'), '', (tx) => `<td class="nowrap">${esc(tx.ref)}</td>`],
      full && [t('Note'), '', (tx) => `<td class="note">${esc(tx.note)}</td>`],
      [t('Stock after'), 'num', (tx, r) => `<td class="num">${esc(fmtQty(r.after))}</td>`],
    ].filter(Boolean);
    return `<div class="tbl-wrap"><table class="tbl tx">
      <thead><tr>${cols.map(([h, cls]) => `<th${cls ? ` class="${cls}"` : ''}>${esc(h)}</th>`).join('')}<th class="no-print"></th></tr></thead>
      <tbody>${list.map((tx) => {
        const r = rows.get(tx.id) || {};
        const report = tx.type === 'out' && tx.rabId; // a work report is rejected on its own page, not deleted
        return `<tr class="${opts.readonly ? '' : 'clickable'}" data-id="${esc(tx.id)}" data-url="${esc(openUrl(tx))}">${cols.map((c) => c[2](tx, r)).join('')}
          <td class="actions no-print">${tx.photo ? `<button type="button" class="sm photo">${esc(t('Photo'))}</button>` : ''}${opts.readonly ? ''
            : `<a class="btn sm" href="${esc(openUrl(tx))}">${esc(report ? t('Check') : t('Edit'))}</a>${report ? ''
              : `<button type="button" class="sm ghost del" title="${esc(t('Delete'))}" aria-label="${esc(t('Delete'))}">✕</button>`}`}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }
  /** Value of an entry: a purchase at its price, a use or an adjustment at the average cost. */
  const txTotal = (tx, r) => (tx.type === 'in' ? C.round(tx.qty * (tx.price || 0), 2) : Math.abs((r && r.cost) || 0));
  function wireTable(box, rerender) {
    $$('tr[data-id]', box).forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.photo')) viewPhoto(S.get(tr.dataset.id));
        else if (tr.classList.contains('clickable') && !e.target.closest('a,button')) location.hash = tr.dataset.url;
      });
      const del = $('.del', tr);
      if (del) del.addEventListener('click', () => {
        if (!confirm(t('Delete this transaction?'))) return;
        const err = removeTx(tr.dataset.id);
        if (err) { toast(err, 'err'); return; }
        toast(t('Transaction deleted.'));
        rerender();
      });
    });
  }

  /** Export document for a stock card (oldest first, like a ledger). */
  function stockDoc(it) {
    const rows = C.run(S.txs()).rows;
    const list = C.sort(S.txs()).filter((tx) => tx.itemId === it.id);
    return {
      title: t('Stock card') + ' — ' + it.name, app: t('Simple Inventory'),
      subtitle: [[it.code, S.unitName(it)].filter(Boolean).join(' · '), t('{n} transactions', { n: list.length }) + ' · ' + t('Created {date}', { date: now() })].filter(Boolean),
      sections: [{
        title: '', sheet: t('Stock card'), empty: t('No transactions yet.'),
        columns: [
          { label: t('Date'), type: 'date' }, { label: t('Type'), type: 'text' }, { label: t('RAB'), type: 'text' }, { label: t('Work / project'), type: 'text', max: 20, grow: true },
          { label: t('Quantity'), type: 'sqty' }, { label: t('Price'), type: 'amt' }, { label: t('Total'), type: 'amt' },
          { label: t('Supplier'), type: 'text', max: 16 }, { label: t('Employee'), type: 'text', max: 14 }, { label: t('Ref.'), type: 'text' }, { label: t('Note'), type: 'text', max: 18 },
          { label: t('Stock after'), type: 'qty' },
        ],
        rows: list.map((tx) => {
          const r = rows.get(tx.id);
          return [tx.date, TYPE[tx.type].label(), tx.rabNo, tx.rabTitle, C.signed(tx), tx.type === 'in' ? tx.price : null, txTotal(tx, r) || null, tx.party, tx.emp, tx.ref, tx.note, r.after];
        }),
      }],
    };
  }
  /** The stock card of one item: every purchase, work report and adjustment with the stock after it, newest first.
      Opened from Items, the Report, a RAB page or the input page. The admin can open an entry to change it. */
  function viewStock(id) {
    const it = S.find('items', id);
    if (!it) { toast(t('Item not found.'), 'err'); location.hash = '#/'; return; }
    const manage = S.me().role === 'admin', unit = S.unitName(it), qu = (q) => (fmtQty(q) + ' ' + unit).trim();
    const s = C.stock(S.txs(), today()).find((x) => x.key === id) || { qty: 0, avg: 0, value: 0 };
    const need = S.needs().get(id);
    const list = C.sort(S.txs()).reverse().filter((tx) => tx.itemId === id);
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(it.name)}</h1><div class="sub">${esc([t('Stock card'), it.code, unit].filter(Boolean).join(' · '))}</div></div>
        <div class="actions no-print"><button type="button" onclick="history.back()">← ${esc(t('Back'))}</button><button type="button" onclick="window.print()">${esc(t('Print'))}</button>${exportMenu()}</div></div>
      <div class="tiles t3">
        <div class="tile"><div class="k">${esc(t('On hand'))}</div><div class="v">${esc(qu(s.qty))}</div><div class="f">${esc(t('at {date}', { date: fmtDate(today()) }))}</div></div>
        <div class="tile"><div class="k">${esc(t('Stock value'))}</div><div class="v">${esc(fmtAmt(s.value))}</div><div class="f">${esc(t('Average cost'))} ${esc(fmtAmt(s.avg))}</div></div>
        <div class="tile"><div class="k">${esc(t('Needed on open RABs'))}</div><div class="v">${need ? esc(qu(need.qty)) : '—'}</div>
          <div class="f">${need ? esc(need.rabs.map((r) => r.no).join(', ')) : '&nbsp;'}${need && need.qty > s.qty ? ` <span class="badge warn">${esc(t('Short {qty}', { qty: qu(C.round(need.qty - s.qty, 4)) }))}</span>` : ''}</div></div>
      </div>
      <div class="card"><div id="tbl"></div></div>`;
    const box = $('#tbl');
    box.innerHTML = list.length ? txTable(list, { readonly: !manage, noItem: true }) + `<div class="muted small foot">${esc(t('{n} transactions', { n: list.length }))}</div>`
      : `<p class="empty">${esc(t('No transactions yet.'))}</p>`;
    wireTable(box, () => viewStock(id));
    wireExport(() => stockDoc(it), `${t('stock-card')}_${C.key(it.code || it.name).replace(/\s+/g, '-')}_${today()}`);
  }

  // =====================================================================================  Reports
  /** The reports, under LAPORAN in the menu: the summary (#/report: the headline figures and the charts) and one page
      per table (#/report/<key>, see REPORTS). They share one period, so it stays when going from one to another. */
  const period = { from: '', to: '', zero: false, ready: false };
  function presets() {
    const d = today(), [y, m] = d.split('-').map(Number);
    const ym = (yy, mm) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 7);
    const last = ym(y, m - 1);
    return {
      month: [d.slice(0, 7) + '-01', d],
      last: [last + '-01', C.dayBefore(d.slice(0, 7) + '-01')],
      year: [y + '-01-01', d],
    };
  }
  /** The first report opened starts on this month; after that the period stays as the user leaves it. */
  function initPeriod() {
    if (period.ready) return;
    [period.from, period.to] = presets().month;
    period.ready = true;
  }
  /** The headline figures of the report, for the tiles on screen and for the exports. */
  function reportSummary(r) {
    const span = r.fromTxt + ' – ' + r.toTxt;
    return [
      { label: t('Purchases'), value: r.purchases, type: 'amt', note: span },
      { label: t('Material used'), value: r.used, type: 'amt', note: t('{n} work reports', { n: r.reports }) + (r.waiting ? ' · ' + t('{n} waiting for approval', { n: r.waiting }) : '') },
      { label: t('Wages paid'), value: r.salaries, type: 'amt', note: t('{n} employees paid', { n: r.pay.length }) },
      { label: t('Total cost'), value: r.cost, type: 'amt', note: t('Material used + wages paid') },
      { label: t('Stock value'), value: r.stockValue, type: 'amt', note: t('{n} items · at {date}', { n: r.stock.filter((s) => s.qty > 0).length, date: fmtDate(r.asOf) }) },
      { label: t('Stock adjustments'), value: r.adjValue, type: 'amt', note: t('Stock found − missing or damaged') },
    ];
  }
  /** Cost per RAB in the period (purchases, material used and wages paid), with its number, work, status and progress today. */
  function rabWork(txs, from, to) {
    return C.rabCosts(txs, S.pays(), from, to).map((w) => {
      const rab = S.rab(w.rabId);
      if (!rab) return null;
      const p = S.rabProgress(rab);
      return Object.assign(w, { no: rab.no, title: rab.title, state: p.state, done: p.done, lines: p.lines.length });
    }).filter(Boolean).sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true }));
  }
  /** All the figures of the reports for the period. The stock is counted at its end (asOf). */
  function reportData() {
    const txs = S.txs();
    const asOf = period.to || today();
    const stock = C.stock(txs, asOf);
    const mv = C.movement(txs, period.from, period.to);
    const sum = (list, k) => C.round(list.reduce((a, x) => a + x[k], 0), 2);
    const stockValue = sum(stock, 'value'), purchases = sum(mv, 'inValue'), used = sum(mv, 'outCost'), adjValue = sum(mv, 'adjValue');
    const inPeriod = (d) => (!period.from || d >= period.from) && (!period.to || d <= period.to);
    const reports = txs.filter((tx) => tx.type === 'out' && inPeriod(tx.date)).length; // approved ones: S.txs() has no others
    const waiting = S.workReports().filter((tx) => tx.status === 'pending' && inPeriod(tx.date)).length;
    const shown = stock.filter((s) => period.zero || s.qty !== 0);
    const fromTxt = period.from ? fmtDate(period.from) : '…', toTxt = period.to ? fmtDate(period.to) : '…';
    const pay = C.payroll(S.pays(), period.from, period.to), salaries = sum(pay, 'total'), cost = C.round(used + salaries, 2);
    const work = rabWork(txs, period.from, period.to);
    return { txs, asOf, stock, shown, mv, pay, work, sum, stockValue, purchases, used, adjValue, reports, waiting, salaries, cost, fromTxt, toTxt };
  }

  /** The table reports, each on its own page and in the menu: label (menu and title), icon, asOf (counted on one date
      instead of over the period), note (what the table shows), table (HTML), wire (after it is shown) and section
      (the table in an export document). */
  const REPORTS = (() => {
    const z = (v) => (v ? v : null); // exports show — instead of 0, like the screen
    const av = (v) => `<td class="num">${v ? esc(fmtAmt(v)) : dash}</td>`; // amount, or — for 0
    const qv = (q, v) => `<td class="num">${q ? esc(fmtQty(q)) : dash}</td>` + (v === undefined ? '' : `<td class="num">${v ? esc(fmtAmt(v)) : dash}</td>`);
    const itemLink = (s) => `<a href="#/stock/${esc(s.key)}">${esc(s.item)}</a>`;
    const none = (cols, msg) => `<tr><td colspan="${cols}" class="empty">${esc(msg)}</td></tr>`;
    const note = {
      rab: (r) => t('Purchases, material used and wages paid per RAB from {from} to {to}. Total cost is material used + wages paid.', { from: r.fromTxt, to: r.toTxt }) + ' ' + t('Status and progress are as of today.'),
      stock: (r) => t('Stock on {date}, valued at moving average cost.', { date: fmtDate(r.asOf) }),
      movement: (r) => t('Opening + bought − used ± adjustment = closing, for {from} to {to}.', { from: r.fromTxt, to: r.toTxt }),
      wages: (r) => t('Wages paid from {from} to {to}.', { from: r.fromTxt, to: r.toTxt }),
    };
    return {
      rab: {
        label: 'RAB costs', icon: 'receipt', note: note.rab,
        table: ({ work, sum }) => `<table class="tbl">
          <thead><tr><th>${esc(t('RAB'))}</th><th>${esc(t('Status'))}</th><th>${esc(t('Progress'))}</th><th class="num">${esc(t('Reports'))}</th><th class="num">${esc(t('Purchases'))}</th>
            <th class="num">${esc(t('Material used'))}</th><th class="num">${esc(t('Wages paid'))}</th><th class="num">${esc(t('Total cost'))}</th></tr></thead>
          <tbody>${work.length ? work.map((w) => `<tr class="clickable" data-id="${esc(w.rabId)}">
            <td><span class="nowrap">${esc(w.no)}</span><div class="muted small">${esc(w.title)}</div></td><td>${rabBadge(w.state)}</td>
            <td class="nowrap">${esc(t('{done} of {n} lines done', { done: w.done, n: w.lines }))}</td>
            <td class="num">${w.reports || dash}</td>${av(w.purchases)}${av(w.material)}${av(w.wages)}<td class="num">${esc(fmtAmt(w.total))}</td></tr>`).join('')
            : none(8, t('No RAB work or wages in this period.'))}</tbody>
          ${work.length ? `<tfoot><tr><td colspan="3">${esc(t('Total'))}</td><td class="num">${sum(work, 'reports')}</td><td class="num">${esc(fmtAmt(sum(work, 'purchases')))}</td>
            <td class="num">${esc(fmtAmt(sum(work, 'material')))}</td><td class="num">${esc(fmtAmt(sum(work, 'wages')))}</td><td class="num">${esc(fmtAmt(sum(work, 'total')))}</td></tr></tfoot>` : ''}
        </table>`,
        // a RAB opens on its page
        wire: (box) => $$('tr[data-id]', box).forEach((tr) => tr.addEventListener('click', () => { location.hash = '#/rab/' + tr.dataset.id; })),
        section: (r) => ({
          title: t('RAB costs'), sheet: t('RAB'), empty: t('No RAB work or wages in this period.'), note: note.rab(r),
          columns: [
            { label: t('No.'), type: 'text' }, { label: t('Work / project'), type: 'text', max: 26, grow: true }, { label: t('Status'), type: 'text' },
            { label: t('Progress'), type: 'text', max: 22 }, { label: t('Reports'), type: 'int' }, { label: t('Purchases'), type: 'amt' }, { label: t('Material used'), type: 'amt' },
            { label: t('Wages paid'), type: 'amt' }, { label: t('Total cost'), type: 'amt' },
          ],
          rows: r.work.map((w) => [w.no, w.title, RAB_STATE[w.state].label(), t('{done} of {n} lines done', { done: w.done, n: w.lines }), w.reports, z(w.purchases), z(w.material), z(w.wages), w.total]),
          foot: r.work.length ? [t('Total'), null, null, null, r.sum(r.work, 'reports'), r.sum(r.work, 'purchases'), r.sum(r.work, 'material'), r.sum(r.work, 'wages'), r.sum(r.work, 'total')] : null,
        }),
      },
      stock: {
        label: 'Stock on hand', icon: 'warehouse', asOf: true, note: note.stock,
        table: ({ shown, stockValue }) => `<table class="tbl">
          <thead><tr><th>${esc(t('Item'))}</th><th>${esc(t('Unit'))}</th><th class="num">${esc(t('On hand'))}</th><th class="num">${esc(t('Average cost'))}</th><th class="num">${esc(t('Value'))}</th>
            <th class="num">${esc(t('Last purchase price'))}</th><th>${esc(t('Last movement'))}</th></tr></thead>
          <tbody>${shown.length ? shown.map((s) => `<tr>
            <td>${itemLink(s)}</td><td>${esc(s.unit)}</td><td class="num">${esc(fmtQty(s.qty))}</td><td class="num">${esc(fmtAmt(s.avg))}</td><td class="num">${esc(fmtAmt(s.value))}</td>
            <td class="num">${s.lastIn == null ? '—' : esc(fmtAmt(s.lastIn))}</td><td class="nowrap">${esc(fmtDate(s.lastDate))}</td></tr>`).join('')
            : none(7, t('No stock.'))}</tbody>
          ${shown.length ? `<tfoot><tr><td colspan="4">${esc(t('Total'))}</td><td class="num">${esc(fmtAmt(stockValue))}</td><td colspan="2"></td></tr></tfoot>` : ''}
        </table>`,
        section: (r) => ({
          title: t('Stock on hand'), sheet: t('Stock'), empty: t('No stock.'), note: note.stock(r),
          columns: [
            { label: t('Item'), type: 'text', max: 24, grow: true }, { label: t('Unit'), type: 'text' }, { label: t('On hand'), type: 'qty' }, { label: t('Average cost'), type: 'amt' },
            { label: t('Value'), type: 'amt' }, { label: t('Last purchase price'), type: 'amt' }, { label: t('Last movement'), type: 'date' },
          ],
          rows: r.shown.map((s) => [s.item, s.unit, s.qty, C.round(s.avg, 2), s.value, s.lastIn, s.lastDate]),
          foot: r.shown.length ? [t('Total'), null, null, null, r.stockValue, null, null] : null,
        }),
      },
      movement: {
        label: 'Stock movement', icon: 'movement', note: note.movement,
        table: ({ mv, sum, purchases, used, adjValue }) => `<table class="tbl">
          <thead>
            <tr><th rowspan="2">${esc(t('Item'))}</th><th rowspan="2">${esc(t('Unit'))}</th><th class="num grp" colspan="2">${esc(t('Opening'))}</th><th class="num grp" colspan="2">${esc(t('Bought'))}</th>
              <th class="num grp" colspan="2">${esc(t('Used'))}</th><th class="num grp" colspan="2">${esc(t('Adjustment'))}</th><th class="num grp" colspan="2">${esc(t('Closing'))}</th></tr>
            <tr>${[0, 1, 2, 3, 4].map(() => `<th class="num sub">${esc(t('qty'))}</th><th class="num sub">${esc(t('value'))}</th>`).join('')}</tr>
          </thead>
          <tbody>${mv.length ? mv.map((m) => `<tr><td>${itemLink(m)}</td><td>${esc(m.unit)}</td>
            ${qv(m.openQty, m.openValue)}${qv(m.inQty, m.inValue)}${qv(m.outQty, m.outCost)}${qv(m.adjQty, m.adjValue)}${qv(m.closeQty, m.closeValue)}</tr>`).join('')
            : none(12, t('No movement in this period.'))}</tbody>
          ${mv.length ? `<tfoot><tr><td colspan="2">${esc(t('Total'))}</td>
            <td></td><td class="num">${esc(fmtAmt(sum(mv, 'openValue')))}</td><td></td><td class="num">${esc(fmtAmt(purchases))}</td>
            <td></td><td class="num">${esc(fmtAmt(used))}</td><td></td><td class="num">${esc(fmtAmt(adjValue))}</td>
            <td></td><td class="num">${esc(fmtAmt(sum(mv, 'closeValue')))}</td></tr></tfoot>` : ''}
        </table>`,
        section: (r) => ({
          title: t('Stock movement'), sheet: t('Movement'), empty: t('No movement in this period.'), note: note.movement(r),
          groups: [{ label: '', span: 2 }, { label: t('Opening'), span: 2 }, { label: t('Bought'), span: 2 }, { label: t('Used'), span: 2 },
            { label: t('Adjustment'), span: 2 }, { label: t('Closing'), span: 2 }],
          columns: [{ label: t('Item'), type: 'text', max: 20, grow: true }, { label: t('Unit'), type: 'text' }]
            .concat([0, 1, 2, 3, 4].flatMap(() => [{ label: t('qty'), type: 'qty' }, { label: t('value'), type: 'amt' }])),
          rows: r.mv.map((m) => [m.item, m.unit, z(m.openQty), z(m.openValue), z(m.inQty), z(m.inValue), z(m.outQty), z(m.outCost), z(m.adjQty), z(m.adjValue),
            z(m.closeQty), z(m.closeValue)]),
          foot: r.mv.length ? [t('Total'), null, null, r.sum(r.mv, 'openValue'), null, r.purchases, null, r.used, null, r.adjValue, null, r.sum(r.mv, 'closeValue')] : null,
        }),
      },
      wages: {
        label: 'Wages per employee', icon: 'wages', note: note.wages,
        table: ({ pay, sum, salaries }) => `<table class="tbl">
          <thead><tr><th>${esc(t('Employee'))}</th><th>${esc(t('Department'))}</th><th class="num">${esc(t('Payments'))}</th><th class="num">${esc(t('Wage'))}</th>
            <th class="num">${esc(t('Allowance / bonus'))}</th><th class="num">${esc(t('Deduction'))}</th><th class="num">${esc(t('Total'))}</th></tr></thead>
          <tbody>${pay.length ? pay.map((x) => `<tr><td>${esc(x.emp)}</td><td>${esc(x.dept)}</td><td class="num">${x.count}</td><td class="num">${esc(fmtAmt(x.base))}</td>
            ${av(x.allowance)}${av(x.deduction)}<td class="num">${esc(fmtAmt(x.total))}</td></tr>`).join('')
            : none(7, t('No wages paid in this period.'))}</tbody>
          ${pay.length ? `<tfoot><tr><td colspan="3">${esc(t('Total'))}</td><td class="num">${esc(fmtAmt(sum(pay, 'base')))}</td><td class="num">${esc(fmtAmt(sum(pay, 'allowance')))}</td>
            <td class="num">${esc(fmtAmt(sum(pay, 'deduction')))}</td><td class="num">${esc(fmtAmt(salaries))}</td></tr></tfoot>` : ''}
        </table>`,
        section: (r) => ({
          title: t('Wages per employee'), sheet: t('Wages'), empty: t('No wages paid in this period.'), note: note.wages(r),
          columns: [
            { label: t('Employee'), type: 'text', max: 24, grow: true }, { label: t('Department'), type: 'text', max: 18 }, { label: t('Payments'), type: 'int' },
            { label: t('Wage'), type: 'amt' }, { label: t('Allowance / bonus'), type: 'amt' }, { label: t('Deduction'), type: 'amt' }, { label: t('Total'), type: 'amt' },
          ],
          rows: r.pay.map((x) => [x.emp, x.dept, x.count, x.base, z(x.allowance), z(x.deduction), x.total]),
          foot: r.pay.length ? [t('Total'), null, null, r.sum(r.pay, 'base'), r.sum(r.pay, 'allowance'), r.sum(r.pay, 'deduction'), r.salaries] : null,
        }),
      },
    };
  })();
  const isReport = (key) => Object.prototype.hasOwnProperty.call(REPORTS, key);

  /** Export document of the whole report (the summary page): the headline figures and the four tables. */
  function reportDoc(r) {
    return {
      title: t('Report'), app: t('Simple Inventory'),
      subtitle: [t('Period: {from} – {to}', { from: r.fromTxt, to: r.toTxt }), t('Created {date}', { date: now() })],
      summary: reportSummary(r),
      sections: Object.values(REPORTS).map((R) => R.section(r)),
    };
  }
  /** Export document of one table report: its title, the period (or the date the stock is counted on) and the table. */
  function tableDoc(key, r) {
    const R = REPORTS[key];
    return {
      title: t(R.label), app: t('Simple Inventory'),
      subtitle: [R.asOf ? t('As of {date}', { date: fmtDate(r.asOf) }) : t('Period: {from} – {to}', { from: r.fromTxt, to: r.toTxt }), t('Created {date}', { date: now() })],
      summary: [],
      sections: [Object.assign(R.section(r), { title: '' })], // the document's title already names the table
    };
  }

  /** The four charts of the summary. Colour follows the figure: stock value, purchases, material used and wages
      keep their colour in every chart. */
  const SERIES = {
    value: () => ({ name: t('Stock value'), color: 'var(--series-1)' }),
    purchases: () => ({ name: t('Purchases'), color: 'var(--series-2)' }),
    used: () => ({ name: t('Material used'), color: 'var(--series-3)' }),
    wages: () => ({ name: t('Wages paid'), color: 'var(--series-4)' }),
  };
  function drawCharts(tl, stock, work) {
    const empty = (id, msg) => { $(id).innerHTML = `<p class="empty">${esc(msg)}</p>`; };
    const axisFmt = (max) => { const u = compactUnit(max); return (v) => fmtCompact(v, u); };
    const keysHint = t('Use the left and right arrow keys to read the values.');
    /** The largest rows, with the rest added up as "Other". */
    const top = (list, by, n, cols, label, other) => {
      const all = list.slice().sort((a, b) => b[by] - a[by]);
      const rows = all.slice(0, n).map((x) => ({ label: label(x), values: cols.map((k) => x[k]) })), rest = all.slice(n);
      if (rest.length) rows.push({ label: other(rest.length), other: true, values: cols.map((k) => C.round(rest.reduce((a, x) => a + x[k], 0), 2)) });
      return rows;
    };

    if (!tl) {
      const msg = S.state.txs.length ? t('No movement in this period.') : t('No transactions yet.');
      empty('#c-value', msg); empty('#c-flow', msg);
    } else {
      const B = tl.buckets, u = tl.unit;
      const points = B.map((b) => ({
        label: u === 'day' ? fmtDate(b.start) : u === 'week' ? fmtDate(b.start) + ' – ' + fmtDate(b.end) : u === 'month' ? fmtMonth(b.start) : b.start.slice(0, 4),
        tick: u === 'day' || u === 'week' ? fmtShort(b.start) : u === 'month' ? fmtMonth(b.start) : b.start.slice(0, 4),
      }));
      const table = { label: t('Table'), first: t('Period') };
      Charts.time($('#c-value'), { type: 'area', points, fmt: fmtAmt, axisFmt, keysHint, table, label: t('Stock value trend'),
        series: [Object.assign(SERIES.value(), { values: B.map((b) => b.value) })] });
      if (!B.some((b) => b.purchases || b.used)) empty('#c-flow', t('No purchases or material used in this period.'));
      else Charts.time($('#c-flow'), { type: 'columns', points, fmt: fmtAmt, axisFmt, keysHint, table, label: t('Purchases and material used'),
        series: [Object.assign(SERIES.purchases(), { values: B.map((b) => b.purchases) }), Object.assign(SERIES.used(), { values: B.map((b) => b.used) })] });
    }

    const held = stock.filter((s) => s.value > 0);
    if (!held.length) empty('#c-stock', t('No stock.'));
    else Charts.hbars($('#c-stock'), { rows: top(held, 'value', 8, ['value'], (x) => x.item, (n) => t('Other ({n} items)', { n })), series: [SERIES.value()], fmt: fmtAmt, tipFmt: (v) => fmtCompact(v) });

    const costly = work.filter((w) => w.material || w.wages);
    if (!costly.length) empty('#c-rab', t('No RAB work or wages in this period.'));
    else Charts.hbars($('#c-rab'), { rows: top(costly, 'total', 8, ['material', 'wages'], (x) => x.no + ' · ' + x.title, (n) => t('Other ({n} RABs)', { n })),
      series: [SERIES.used(), SERIES.wages()], fmt: fmtAmt, axisFmt });
  }

  /** The filter of a report page: the period, with This month / Last month / This year; or for the stock only the date it
      is counted on, with the choice to show items with zero stock. */
  function periodFilter(asOf) {
    if (asOf) {
      return `<div class="filters card no-print">
        <div class="field"><label for="pt">${esc(t('As of'))}</label><input type="date" id="pt" value="${esc(period.to)}"></div>
        <label class="check"><input type="checkbox" id="zero" ${period.zero ? 'checked' : ''}> ${esc(t('Show items with zero stock'))}</label></div>`;
    }
    return `<div class="filters card no-print">
        <div class="field"><label for="pf">${esc(t('From'))}</label><input type="date" id="pf" value="${esc(period.from)}"></div>
        <div class="field"><label for="pt">${esc(t('To'))}</label><input type="date" id="pt" value="${esc(period.to)}"></div>
        <div class="row">
          <button type="button" class="sm" data-p="month">${esc(t('This month'))}</button>
          <button type="button" class="sm" data-p="last">${esc(t('Last month'))}</button>
          <button type="button" class="sm" data-p="year">${esc(t('This year'))}</button>
        </div></div>`;
  }
  /** A changed date or checkbox shows the figures again (render); a preset opens the page again with its dates (open). */
  function wirePeriod(render, open) {
    const P = presets(), on = (sel, f) => { const el = $(sel); if (el) el.addEventListener('change', f); };
    on('#pf', (e) => { period.from = e.target.value; render(); });
    on('#pt', (e) => { period.to = e.target.value; render(); });
    on('#zero', (e) => { period.zero = e.target.checked; render(); });
    $$('[data-p]').forEach((b) => b.addEventListener('click', () => { [period.from, period.to] = P[b.dataset.p]; open(); }));
  }
  /** Page head of a report: its title, what it shows (#rep-sub, filled in on each render), Print and the export menu. */
  const reportHead = (title, menu) => `
      <div class="page-head"><div><h1>${esc(title)}</h1><div class="sub" id="rep-sub"></div></div>
        <div class="actions no-print"><button type="button" onclick="window.print()">${esc(t('Print'))}</button>${menu}</div></div>`;

  /** The summary: the headline figures and the four charts. Its export is the whole report, with all four tables. */
  function viewReport() {
    initPeriod();
    main.innerHTML = reportHead(t('Summary'), exportMenu([['csv:0', t('CSV — RAB costs')], ['csv:1', t('CSV — stock on hand')], ['csv:2', t('CSV — stock movement')], ['csv:3', t('CSV — wages')]]))
      + `${periodFilter(false)}<div id="rep"></div>`;
    let cur = null; // figures of the last render, reused by the export
    wirePeriod(render, viewReport);
    wireExport(() => reportDoc(cur), () => `${t('report')}_${period.from || 'start'}_${period.to || 'end'}`);

    function render() {
      const r = cur = reportData();
      $('#rep-sub').textContent = t('Period: {from} – {to}', { from: r.fromTxt, to: r.toTxt });
      // the charts cover the part of the period that has data: from the first transaction, up to today or the last one
      const sorted = C.sort(r.txs), first = sorted.length ? sorted[0].date : '', last = sorted.length ? sorted[sorted.length - 1].date : '';
      const cf = period.from > first ? period.from : first, ce = [period.to || '9999-12-31', last > today() ? last : today()].sort()[0];
      const tl = first && cf <= ce ? C.timeline(r.txs, cf, ce) : null;
      // the two ranked charts link to the table with their figures
      const see = (key) => `<a class="small nowrap no-print" href="#/report/${key}">${esc(t('See table'))} →</a>`;
      $('#rep').innerHTML = `
        <div class="tiles">${reportSummary(r).map((x) =>
          `<div class="tile"><div class="k">${esc(x.label)}</div><div class="v">${esc(fmtAmt(x.value))}</div><div class="f">${esc(x.note) || '&nbsp;'}</div></div>`).join('')}</div>
        <div class="charts">${[
          ['c-value', t('Stock value trend'), tl ? t('Value of all stock at the end of each {unit}.', { unit: t(tl.unit) }) : '', ''],
          ['c-flow', t('Purchases and material used'), tl ? t('Total per {unit}.', { unit: t(tl.unit) }) : '', ''],
          ['c-stock', t('Stock value by item'), t('at {date}', { date: fmtDate(r.asOf) }) + ' · ' + t('Largest first.'), 'stock'],
          ['c-rab', t('Cost by RAB'), (period.from || period.to ? r.fromTxt + ' – ' + r.toTxt : t('All dates')) + ' · ' + t('Largest first.'), 'rab'],
        ].map(([id, title, sub, key]) => `<div class="card"><div class="chart-head"><div><h2>${esc(title)}</h2><div class="muted small">${esc(sub)}</div></div>${key ? see(key) : ''}</div>
          <div id="${id}"></div></div>`).join('')}</div>`;
      drawCharts(tl, r.stock, r.work);
    }
    render();
  }
  /** One table report on its own page (key of REPORTS). Its export is that table. */
  function viewTableReport(key) {
    const R = REPORTS[key];
    initPeriod();
    main.innerHTML = reportHead(t(R.label), exportMenu()) + `${periodFilter(R.asOf)}<div class="card flush"><div class="tbl-wrap" id="rep"></div></div>`;
    let cur = null;
    wirePeriod(render, () => viewTableReport(key));
    wireExport(() => tableDoc(key, cur), () => C.key(t(R.label)).replace(/\s+/g, '-') + '_' + (R.asOf ? period.to || today() : `${period.from || 'start'}_${period.to || 'end'}`));
    function render() {
      const r = cur = reportData();
      $('#rep-sub').textContent = R.note(r);
      $('#rep').innerHTML = R.table(r);
      if (R.wire) R.wire($('#rep'));
    }
    render();
  }

  // =====================================================================================  Master data
  const status = (row) => (row.active ? `<span class="badge ok">${esc(t('Active'))}</span>` : `<span class="badge off">${esc(t('Inactive'))}</span>`);
  const MASTER = {
    items: {
      title: () => t('Items'), add: () => t('Add item'), edit: () => t('Edit item'), empty: () => t('No items yet.'), search: () => t('Code, name, unit…'),
      fields: (row) => [
        { name: 'code', label: t('Code'), placeholder: t('Optional') },
        { name: 'name', label: t('Name') },
        { name: 'unitId', label: t('Unit'), type: 'select', options: () => [['', t('— choose —')]].concat(S.list('units').map((u) => [u.id, u.name])),
          add: (done) => editMaster('units', null, null, (u) => done(u.id)), addLabel: t('New unit'),
          hint: row && S.usage('items', row.id) ? t('Changing the unit does not convert the quantities already entered.') : '' },
        { name: 'note', label: t('Note'), placeholder: t('Optional') },
        { name: 'active', label: t('Active'), type: 'checkbox', hint: t('Inactive items cannot be chosen in new transactions.') },
      ],
      head: () => [t('Code'), t('Name'), t('Unit'), [t('Stock')], t('Note'), t('Status')],
      // cells: text is escaped, [text] is right-aligned, { html } is used as is. The name opens the stock card.
      row: (x, ctx) => [x.code, { html: `<a href="#/stock/${esc(x.id)}" title="${esc(t('Stock card'))}">${esc(x.name)}</a>` }, S.unitName(x),
        [fmtQty((ctx.stock.get(x.id) || { qty: 0 }).qty)], x.note, { html: status(x) }],
      text: (x) => [x.code, x.name, S.unitName(x), x.note],
    },
    employees: {
      title: () => t('Employees'), add: () => t('Add employee'), edit: () => t('Edit employee'), empty: () => t('No employees yet.'), search: () => t('Employee no., name, department…'),
      fields: () => [
        { name: 'code', label: t('Employee no.'), placeholder: t('Optional') },
        { name: 'name', label: t('Name') },
        { name: 'dept', label: t('Department'), placeholder: t('Optional') },
        { name: 'active', label: t('Active'), type: 'checkbox', hint: t('Inactive employees cannot be chosen in new transactions.') },
      ],
      head: () => [t('Employee no.'), t('Name'), t('Department'), [t('Work reports')], t('Status')],
      row: (x) => [x.code, x.name, x.dept, [fmtQty(S.usage('employees', x.id))], { html: status(x) }],
      text: (x) => [x.code, x.name, x.dept],
    },
    // types of work (jenis pekerjaan): what an employee does on a RAB
    jobs: {
      title: () => t('Types of work'), add: () => t('Add type of work'), edit: () => t('Edit type of work'), empty: () => t('No types of work yet.'), search: () => t('Name, note…'),
      fields: () => [
        { name: 'name', label: t('Name'), placeholder: t('Bricklayer, tiling, painting…') },
        { name: 'note', label: t('Note'), placeholder: t('Optional') },
        { name: 'active', label: t('Active'), type: 'checkbox', hint: t('Inactive types of work cannot be given to anyone new on a RAB.') },
      ],
      head: () => [t('Name'), t('Note'), [t('RABs')], t('Status')],
      row: (x) => [x.name, x.note, [fmtQty(S.usage('jobs', x.id))], { html: status(x) }],
      text: (x) => [x.name, x.note],
    },
    units: {
      title: () => t('Units'), add: () => t('Add unit'), edit: () => t('Edit unit'), empty: () => t('No units yet.'), search: () => t('Name, note…'),
      fields: () => [
        { name: 'name', label: t('Name'), placeholder: t('pcs, box, kg…') },
        { name: 'note', label: t('Note'), placeholder: t('Optional') },
      ],
      head: () => [t('Name'), t('Note'), [t('Items')]],
      row: (x) => [x.name, x.note, [fmtQty(S.usage('units', x.id))]],
      text: (x) => [x.name, x.note],
    },
    users: {
      title: () => t('Users'), add: () => t('Add user'), edit: () => t('Edit user'), empty: () => t('No users yet.'), search: () => t('Username, name, role…'),
      list: () => S.users(), find: (id) => S.user(id), put: (v) => S.putUser(v, S.me().id), remove: (id) => S.removeUser(id, S.me().id),
      fields: (row) => [
        { name: 'username', label: t('Username') },
        { name: 'role', label: t('Role'), type: 'select', options: () => S.ROLES.map((k) => [k, ROLE[k].label()]) },
        { name: 'empId', label: t('Employee'), type: 'select', when: (get) => get('role') === 'pegawai',
          options: () => [['', t('— choose —')]].concat(S.list('employees').map((e) => [e.id, e.name + (e.dept ? ' — ' + e.dept : '')])) },
        { name: 'name', label: t('Name'), when: (get) => get('role') !== 'pegawai' },
        { name: 'password', label: t('Password'), type: 'password', hint: row ? t('Leave empty to keep the current password.') : t('At least 6 characters.') },
        { name: 'active', label: t('Active'), type: 'checkbox', hint: t('Inactive users cannot sign in.') },
      ],
      head: () => [t('Username'), t('Name'), t('Role'), t('Status')],
      row: (x) => [x.username, x.name, ROLE[x.role].label(), { html: status(x) }],
      text: (x) => [x.username, x.name, ROLE[x.role].label()],
    },
  };
  // the store functions of a list; items, employees, types of work and units share the general ones
  const mList = (kind) => (MASTER[kind].list ? MASTER[kind].list() : S.list(kind));
  const mFind = (kind, id) => (MASTER[kind].find ? MASTER[kind].find(id) : S.find(kind, id));
  const mLabel = (kind, row) => (MASTER[kind].label ? MASTER[kind].label(row) : row.name);
  function removeMaster(kind, row) {
    if (!confirm(t('Delete {name}?', { name: mLabel(kind, row) }))) return null;
    const err = MASTER[kind].remove ? MASTER[kind].remove(row.id) : S.removeMaster(kind, row.id);
    if (!err) toast(t('Deleted: {name}.', { name: mLabel(kind, row) }));
    return err;
  }
  /** Opens the add (no id) or edit form. done(row) runs after a save, done(null) after a delete. */
  function editMaster(kind, id, preset, done) {
    const M = MASTER[kind], row = id ? mFind(kind, id) : null;
    formDialog({
      title: row ? M.edit() : M.add(),
      fields: M.fields(row), change: M.change,
      values: row ? (kind === 'users' && row.role === 'pegawai' ? Object.assign({}, row, { name: '' }) : row)
        : Object.assign({ active: true }, kind === 'items' ? { code: S.nextCode() } : null, kind === 'users' ? { role: 'pegawai' } : null, preset),
      save: (v) => {
        const input = Object.assign({ id: row ? row.id : undefined }, v);
        const res = M.put ? M.put(input) : S.putMaster(kind, input);
        if (res.errors.length) return res.errors;
        toast(t('Saved: {name}.', { name: mLabel(kind, res.row) }));
        if (done) done(res.row);
        return [];
      },
      remove: row ? () => { const err = removeMaster(kind, row); if (err === '' && done) done(null); return err; } : null,
    });
  }

  const mq = { items: '', employees: '', jobs: '', units: '', users: '' };
  function viewMaster(kind) {
    if (!MASTER[kind]) kind = 'items';
    const M = MASTER[kind];
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(M.title())}</h1><div class="sub">${esc(t('Master data'))} · ${esc(t('Click a row to edit it.'))}${kind === 'items' ? ' ' + esc(t('Click a name to see its stock card.')) : ''}</div></div>
        <div class="actions"><button type="button" class="primary" id="b-add">+ ${esc(M.add())}</button></div></div>
      <div class="card">
        <div class="filters"><div class="field grow"><label for="mq">${esc(t('Search'))}</label><input type="search" id="mq" value="${esc(mq[kind])}" placeholder="${esc(M.search())}"></div></div>
        <div id="tbl"></div>
      </div>`;
    const refresh = () => { viewMaster(kind); if (kind === 'users') shell(); };
    const cell = (c, tag) => (Array.isArray(c) ? `<${tag} class="num">${esc(c[0])}</${tag}>` : `<${tag}>${c && c.html ? c.html : esc(c)}</${tag}>`);
    function render() {
      const q = mq[kind].trim().toLowerCase();
      const all = mList(kind), list = all.filter((x) => !q || M.text(x).join(' ').toLowerCase().includes(q));
      const ctx = { stock: new Map(kind === 'items' ? C.stock(S.txs(), today()).map((s) => [s.key, s]) : []) };
      const box = $('#tbl');
      box.innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl master">
          <thead><tr>${M.head().map((h) => cell(h, 'th')).join('')}<th></th></tr></thead>
          <tbody>${list.map((x) => `<tr class="clickable" data-id="${esc(x.id)}">${M.row(x, ctx).map((c) => cell(c, 'td')).join('')}
            <td class="actions"><button type="button" class="sm edit">${esc(t('Edit'))}</button><button type="button" class="sm ghost del" title="${esc(t('Delete'))}" aria-label="${esc(t('Delete'))}">✕</button></td></tr>`).join('')}</tbody>
        </table></div><div class="muted small foot">${esc(t('{n} rows', { n: list.length }))}</div>`
        : `<p class="empty">${esc(all.length ? t('Nothing matches the search.') : M.empty())}</p>`;
      $$('tr[data-id]', box).forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('a')) return; // the item name opens its stock card
          if (e.target.closest('.del')) { const err = removeMaster(kind, mFind(kind, tr.dataset.id)); if (err) toast(err, 'err'); else if (err === '') refresh(); }
          else editMaster(kind, tr.dataset.id, null, refresh);
        });
      });
    }
    $('#mq').addEventListener('input', (e) => { mq[kind] = e.target.value; render(); });
    $('#b-add').addEventListener('click', () => editMaster(kind, null, null, refresh));
    render();
  }

  // =====================================================================================  RAB (work plan)
  /** A work plan: which items and how much, who does the work for which wage, what was bought for it and what was used.
      Wages are paid from the RAB page. Admins edit, supervisors read. */
  const RAB_STATE = {
    open: { label: () => t('In progress'), badge: 'info' },
    done: { label: () => t('Complete'), badge: 'ok' },
    closed: { label: () => t('Closed'), badge: 'off' },
  };
  const rabBadge = (state) => `<span class="badge ${RAB_STATE[state].badge}">${esc(RAB_STATE[state].label())}</span>`;
  /** Work reports (uses sent by employees) with their photo. opts.emp / opts.rab / opts.status add those columns,
      opts.act adds Approve and Reject to the waiting ones (admin), opts.click opens a row on its review page. */
  function reportTable(list, opts = {}) {
    // why it was rejected, and whether the admin changed it
    const notes = (tx) => (tx.status === 'rejected' && tx.reason ? `<div class="muted small">${esc(tx.reason)}</div>` : '')
      + (tx.edited ? `<div class="muted small">${esc(t('Changed by the admin'))}</div>` : '');
    const thumb = (tx) => (tx.photo ? `<button type="button" class="thumb" aria-label="${esc(t('Photo'))}"></button>` : '');
    const acts = (tx) => (opts.act && tx.status === 'pending'
      ? `<button type="button" class="sm" data-approve>${esc(t('Approve'))}</button><button type="button" class="sm danger" data-reject>${esc(t('Reject'))}</button>` : '');
    // on a phone the row shows as this card instead of the columns
    const card = (tx) => `<td class="m"><div class="mc">${thumb(tx)}<div class="mc-body">
        <div class="mc-top"><span>${esc(tx.item)}</span><span class="nowrap">${esc(fmtQty(tx.qty))} <span class="muted">${esc(tx.unit)}</span></span></div>
        <div class="mc-meta">${esc([fmtDate(tx.date), opts.emp ? tx.emp : '', opts.rab && tx.rabNo ? tx.rabNo + ' · ' + tx.rabTitle : ''].filter(Boolean).join(' · '))}</div>
        ${tx.note ? `<div>${esc(tx.note)}</div>` : ''}
        <div class="mc-foot">${opts.status ? reviewBadge(tx) : ''}${acts(tx) ? `<span class="spacer"></span>${acts(tx)}` : ''}</div>
        ${opts.status ? notes(tx) : ''}</div></div></td>`;
    return `<div class="tbl-wrap"><table class="tbl cards">
      <thead><tr><th>${esc(t('Date'))}</th>${opts.emp ? `<th>${esc(t('Employee'))}</th>` : ''}${opts.rab ? `<th>${esc(t('RAB'))}</th>` : ''}
        <th>${esc(t('Item'))}</th><th class="num">${esc(t('Quantity'))}</th><th>${esc(t('Work done'))}</th><th>${esc(t('Photo'))}</th>
        ${opts.status ? `<th>${esc(t('Status'))}</th>` : ''}${opts.act ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map((tx) => `<tr class="${opts.click ? 'clickable' : ''}" data-id="${esc(tx.id)}" data-url="${esc(openUrl(tx))}"><td class="nowrap">${esc(fmtDate(tx.date))}</td>
        ${opts.emp ? `<td>${esc(tx.emp)}</td>` : ''}
        ${opts.rab ? `<td>${tx.rabNo ? `<span class="nowrap">${esc(tx.rabNo)}</span><div class="muted small">${esc(tx.rabTitle)}</div>` : dash}</td>` : ''}
        <td>${esc(tx.item)}</td><td class="num">${esc(fmtQty(tx.qty))} <span class="muted">${esc(tx.unit)}</span></td><td class="muted">${esc(tx.note)}</td>
        <td>${thumb(tx) || dash}</td>
        ${opts.status ? `<td class="status">${reviewBadge(tx)}${notes(tx)}</td>` : ''}
        ${opts.act ? `<td class="actions">${acts(tx)}</td>` : ''}
        ${card(tx)}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  /** The photos of the rows of a table (a row can show its photo twice: in its column and in its phone card). */
  function wireThumbs(box) {
    $$('tr[data-id]', box).forEach((tr) => {
      const tx = S.get(tr.dataset.id), thumbs = $$('.thumb', tr);
      if (!thumbs.length) return;
      Photos.get(tx.photo).then((blob) => {
        if (!blob) return;
        const url = blobUrl(blob);
        thumbs.forEach((b) => { b.style.backgroundImage = `url(${url})`; });
      }).catch(() => {});
      thumbs.forEach((b) => b.addEventListener('click', () => viewPhoto(tx)));
    });
  }
  /** Rows of a table that open the entry: a purchase on the input page, a work report on its review page (admin). */
  function wireOpen(box) {
    $$('tr.clickable[data-id]', box).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a,button')) location.hash = tr.dataset.url; }));
  }
  /** Approve and Reject on the waiting reports of a table. done runs after a decision. */
  function wireReview(box, done) {
    $$('[data-approve]', box).forEach((b) => b.addEventListener('click', () => {
      const res = S.approve(b.closest('tr').dataset.id);
      if (res.errors.length) { toast(res.errors.join(' '), 'err'); return; }
      toast(t('Report approved: {qty} {item}.', { qty: (fmtQty(res.tx.qty) + ' ' + S.unitName(S.find('items', res.tx.itemId))).trim(), item: S.find('items', res.tx.itemId).name }));
      done();
    }));
    $$('[data-reject]', box).forEach((b) => b.addEventListener('click', () => rejectDialog(b.closest('tr').dataset.id, done)));
  }
  /** Reject a work report: the reason is required, the employee sees it. */
  function rejectDialog(id, done) {
    const tx = S.get(id);
    formDialog({
      title: t('Reject the report of {name}', { name: tx.emp }),
      fields: [{ name: 'reason', label: t('Reason'), placeholder: t('What is wrong? The employee sees this.'),
        hint: [fmtDate(tx.date), tx.rabNo, (fmtQty(tx.qty) + ' ' + tx.unit).trim() + ' ' + tx.item].join(' · ') }],
      saveLabel: t('Reject'),
      save: (v) => {
        const res = S.reject(id, v.reason);
        if (res.errors.length) return res.errors;
        toast(t('Report rejected.'));
        done();
        return [];
      },
    });
  }

  /** The "pay the wages of a RAB" dialog: a payment for everyone on it who has a wage and is not paid yet. done runs after. */
  function payWagesDialog(rab, done) {
    formDialog({
      title: t('Pay RAB wages') + ' · ' + rab.no,
      fields: [{ name: 'date', label: t('Paid on'), type: 'date', hint: t('Adds a payment for every employee on the RAB who has a wage and is not paid yet for it.') }],
      values: { date: today() },
      save: (v) => {
        const res = S.payAll(rab.id, v.date);
        if (res.errors.length) return res.errors;
        if (res.count) toast(t('{n} payments added.', { n: res.count }));
        else toast(t('Nothing to add: everyone on {no} is already paid.', { no: rab.no }), 'err');
        done();
        return [];
      },
    });
  }

  const rabFilter = { q: '', state: '' };
  function viewRabs() {
    const manage = S.me().role === 'admin';
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(t('RAB'))}</h1><div class="sub">${esc(t('Work plans: what to buy and use, and who does the work.'))}</div></div>
        ${manage ? `<div class="actions"><button type="button" class="primary" id="b-add">+ ${esc(t('New RAB'))}</button></div>` : ''}</div>
      <div class="card">
        <div class="filters">
          <div class="field grow"><label for="rq">${esc(t('Search'))}</label><input type="search" id="rq" value="${esc(rabFilter.q)}" placeholder="${esc(t('No., work, item, employee…'))}"></div>
          <div class="field"><label for="rs">${esc(t('Status'))}</label><select id="rs"><option value="">${esc(t('All statuses'))}</option>
            ${Object.keys(RAB_STATE).map((k) => `<option value="${k}" ${rabFilter.state === k ? 'selected' : ''}>${esc(RAB_STATE[k].label())}</option>`).join('')}</select></div>
        </div>
        <div id="tbl"></div>
      </div>`;
    function render() {
      const q = rabFilter.q.trim().toLowerCase();
      const list = S.rabs().map((r) => Object.assign({ rab: r, team: S.rabWages(r) }, S.rabProgress(r))).filter((x) => (!rabFilter.state || x.state === rabFilter.state) &&
        (!q || [x.rab.no, x.rab.title, x.rab.note].concat(x.lines.flatMap((l) => [l.item, l.code]), x.team.flatMap((w) => [w.emp, w.job])).join(' ').toLowerCase().includes(q)));
      const box = $('#tbl');
      box.innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('No.'))}</th><th>${esc(t('Date'))}</th><th>${esc(t('Work / project'))}</th><th>${esc(t('Employees'))}</th>
            <th>${esc(t('Progress'))}</th><th>${esc(t('Status'))}</th></tr></thead>
          <tbody>${list.map((x) => `<tr class="clickable" data-id="${esc(x.rab.id)}">
            <td class="nowrap">${esc(x.rab.no)}</td><td class="nowrap">${esc(fmtDate(x.rab.date))}</td>
            <td class="name">${esc(x.rab.title)}${x.rab.note ? `<div class="muted small">${esc(x.rab.note)}</div>` : ''}</td>
            <td>${x.team.map((w) => esc(w.emp) + (w.job ? ` <span class="muted small">(${esc(w.job)})</span>` : '')).join(', ')}</td>
            <td class="nowrap">${esc(t('{done} of {n} lines done', { done: x.done, n: x.lines.length }))}<div class="muted small">${esc([t('{n} reports', { n: x.reports }), t('{n} purchases', { n: x.purchases })].join(' · '))}${x.waiting ? ` · <span class="warn-text">${esc(t('{n} waiting', { n: x.waiting }))}</span>` : ''}</div></td>
            <td>${rabBadge(x.state)}</td></tr>`).join('')}</tbody>
        </table></div><div class="muted small foot">${esc(t('{n} rows', { n: list.length }))}</div>`
        : `<p class="empty">${esc(S.state.rabs.length ? t('No RABs match the filter.') : t('No RABs yet.'))}</p>`;
      $$('tr[data-id]', box).forEach((tr) => tr.addEventListener('click', () => { location.hash = '#/rab/' + tr.dataset.id; }));
    }
    $('#rq').addEventListener('input', (e) => { rabFilter.q = e.target.value; render(); });
    $('#rs').addEventListener('change', (e) => { rabFilter.state = e.target.value; render(); });
    if (manage) $('#b-add').addEventListener('click', () => { location.hash = '#/rab/new'; });
    render();
  }

  /** One RAB, opened to be read: its status, planned cost, the cost so far and what was bought for it; the employees
      with their wage (the admin pays them from here); the items with what was bought and used and the stock; the
      purchases (the admin adds one from here) and the work reports (the admin approves them here too). The admin
      changes the RAB itself on #/rab/<id>/edit (edit = true): a form with the two lists. id 'new' opens an empty form.
      The supervisor reads the same page. */
  function viewRab(id, edit) {
    const admin = S.me().role === 'admin';
    const rab = id === 'new' ? null : S.rab(id);
    if (!rab && (id !== 'new' || !admin)) { if (id !== 'new') toast(t('RAB not found.'), 'err'); location.hash = '#/rab'; return; }
    const ro = !!rab && !(admin && edit); // read the RAB, or the admin's form
    const v = rab || { no: S.nextRabNo(), date: today(), title: '', note: '', status: 'open' };
    const prog = rab ? S.rabProgress(rab) : null;
    const open = !rab || rab.status === 'open';
    const team = rab ? S.rabWages(rab) : []; // saved workers with their reports and payment
    const stockNow = new Map(C.stock(S.txs(), today()).map((s) => [s.key, s]));
    const avgOf = (itemId) => (stockNow.get(itemId) || { avg: 0 }).avg, stockOf = (itemId) => (stockNow.get(itemId) || { qty: 0 }).qty;
    // purchases are in the stock; the work reports are shown whatever their status
    const buys = rab ? C.sort(S.txs()).reverse().filter((tx) => tx.rabId === rab.id && tx.type === 'in') : [];
    const reports = rab ? S.workReports().filter((tx) => tx.rabId === rab.id) : [];
    const waiting = reports.filter((tx) => tx.status === 'pending').length;
    // a line with purchases or reports (any status) keeps its item and cannot be removed
    const lineHas = (lineId) => !!lineId && S.all().some((x) => x.lineId === lineId && x.type !== 'adj');
    // inactive items and employees can only stay where they already are
    const keepItems = new Set(rab ? rab.lines.map((l) => l.itemId) : []), keepEmps = new Set(rab ? rab.workers.map((w) => w.empId) : []);
    const keepJobs = new Set(rab ? rab.workers.map((w) => w.jobId).filter(Boolean) : []);
    const itemOptions = () => S.list('items').filter((x) => x.active || keepItems.has(x.id))
      .map((x) => `<option value="${esc(x.name)}" label="${esc([x.code, S.unitName(x)].filter(Boolean).join(' · '))}">`).join('');
    const emps = S.list('employees').filter((x) => x.active || keepEmps.has(x.id));
    const jobOptions = (jobId) => `<option value="">${esc(t('— choose —'))}</option>` + S.list('jobs').filter((x) => x.active || keepJobs.has(x.id))
      .map((x) => `<option value="${esc(x.id)}" ${jobId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const est = (itemId, qty) => (itemId && qty > 0 && avgOf(itemId) ? C.round(qty * avgOf(itemId), 2) : 0);
    const amtCell = (val) => (val ? esc(fmtAmt(val)) : dash);
    const qtyCell = (val) => (val ? esc(fmtQty(val)) : dash);
    const sumOf = (list, f) => C.round(list.reduce((a, x) => a + (f(x) || 0), 0), 2);
    const del = (label) => `<button type="button" class="sm ghost del" aria-label="${esc(label)}" title="${esc(label)}">✕</button>`;
    /** Stock today, and how much is short while the open RAB still needs more than that (waiting reports and what is left). */
    const stockCell = (itemId, need) => {
      if (!itemId) return dash;
      const q = stockOf(itemId);
      return esc(fmtQty(q)) + (open && need > q ? `<div><span class="badge warn">${esc(t('Short {qty}', { qty: fmtQty(C.round(need - q, 4)) }))}</span></div>` : '');
    };
    /** Used (approved), with what is still waiting for approval under it. */
    const usedCell = (used, wait) => qtyCell(used) + (wait ? `<div class="warn-text small">${esc(t('+{qty} waiting', { qty: fmtQty(wait) }))}</div>` : '');
    /** Paid or not, with Pay / Edit for the admin (act). */
    const paidCell = (w, act) => {
      const btn = (label) => (act ? ` <button type="button" class="sm" data-pay="${esc(w.empId)}">${esc(label)}</button>` : '');
      if (w && w.pay) return `<span class="badge ok">${esc(t('Paid'))}</span> <span class="muted small">${esc(fmtAmt(w.pay.total) + ' · ' + fmtDate(w.pay.date))}</span>${btn(t('Edit'))}`;
      return w && w.wage ? `<span class="badge warn">${esc(t('Not paid'))}</span>${btn(t('Pay'))}` : dash;
    };
    /** Planned cost (from the plan), cost so far (material used + wages paid) and what was bought for the RAB. */
    function costTiles() {
      const rows = C.run(S.txs()).rows;
      const material = sumOf(reports.filter((tx) => tx.status === 'approved'), (tx) => (rows.get(tx.id) || {}).used), paid = sumOf(team, (w) => (w.pay ? w.pay.total : 0));
      const bought = sumOf(buys, (tx) => C.round(tx.qty * tx.price, 2));
      const estMaterial = sumOf(prog.lines, (l) => est(l.itemId, l.qty)), wages = sumOf(team, (w) => w.wage);
      const tile = (k, val, f) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${esc(fmtAmt(val))}</div><div class="f">${esc(f)}</div></div>`;
      return tile(t('Planned cost'), C.round(estMaterial + wages, 2), t('Est. material {a} + wages {b}', { a: fmtAmt(estMaterial), b: fmtAmt(wages) }))
        + tile(t('Cost so far'), C.round(material + paid, 2), t('Material used {a} + wages paid {b}', { a: fmtAmt(material), b: fmtAmt(paid) }))
        + tile(t('Bought for this RAB'), bought, t('{n} purchases', { n: buys.length }));
    }

    /** w: { empId, jobId, wage, saved } — saved rows show their reports and payment */
    function workerRow(w, n) {
      const info = w.saved ? team.find((x) => x.empId === w.empId) : null, locked = !!(info && (info.reports || info.pay));
      if (ro) {
        return `<tr><td class="n">${n}</td><td>${esc(info.emp)}${info.dept ? `<div class="muted small">${esc(info.dept)}</div>` : ''}</td><td>${info.job ? esc(info.job) : dash}</td>
          <td class="num">${amtCell(info.wage)}</td><td class="num">${qtyCell(info.reports)}</td><td>${paidCell(info, admin)}</td></tr>`;
      }
      const lock = locked ? `disabled title="${esc(t('This employee has reported work or is paid on this RAB.'))}"` : '';
      return `<tr data-saved="${w.saved ? 1 : ''}">
        <td class="n">${n}</td>
        <td><select name="emp" aria-label="${esc(t('Employee'))}" ${lock}><option value="">${esc(t('— choose —'))}</option>
          ${emps.map((e) => `<option value="${esc(e.id)}" ${w.empId === e.id ? 'selected' : ''}>${esc(e.name + (e.dept ? ' — ' + e.dept : ''))}</option>`).join('')}</select></td>
        <td><select name="job" aria-label="${esc(t('Type of work'))}">${jobOptions(w.jobId)}</select></td>
        <td><input name="wage" type="number" step="any" min="0" inputmode="decimal" value="${w.wage ?? ''}" placeholder="0" aria-label="${esc(t('Wage'))}"></td>
        <td class="num">${qtyCell(info && info.reports)}</td><td>${info ? paidCell(info, false) : dash}</td>
        <td class="actions">${locked ? '' : del(t('Remove employee'))}</td></tr>`;
    }
    /** l: { id, item (name), itemId, qty, bought, used, waiting, left, need } */
    function lineRow(l, n) {
      const it = S.find('items', l.itemId), used = l.used || 0, wait = l.waiting || 0, bought = l.bought || 0, locked = lineHas(l.id);
      if (ro) {
        return `<tr><td class="n">${n}</td><td><a href="#/stock/${esc(l.itemId)}">${esc(l.item)}</a></td><td class="num">${esc(fmtQty(l.qty))}</td><td class="muted">${esc(S.unitName(it))}</td>
          <td class="num">${qtyCell(bought)}</td><td class="num">${usedCell(used, wait)}</td><td class="num">${qtyCell(l.left)}</td>
          <td class="num">${stockCell(l.itemId, l.need)}</td><td class="num">${amtCell(est(l.itemId, l.qty))}</td></tr>`;
      }
      const lock = locked ? `disabled title="${esc(t('This line already has purchases or work reports.'))}"` : '';
      return `<tr data-line="${esc(l.id || '')}" data-used="${used}" data-waiting="${wait}" data-bought="${bought}">
        <td class="n">${n}</td>
        <td><input name="item" list="dl-items" value="${esc(l.item || '')}" placeholder="${esc(t('Type the item name or code'))}" aria-label="${esc(t('Item'))}" ${lock}></td>
        <td><input name="qty" type="number" step="any" min="0" inputmode="decimal" value="${l.qty ?? ''}" aria-label="${esc(t('Planned'))}"></td>
        <td class="muted unit"></td>
        <td class="num">${qtyCell(bought)}</td><td class="num">${usedCell(used, wait)}</td><td class="num left"></td><td class="num stock"></td><td class="num est"></td>
        <td class="actions">${locked ? '' : del(t('Remove line'))}</td></tr>`;
    }
    // the RAB's own fields: in the page head when reading, a form when editing
    const head = ro ? '' : `<div class="card"><div class="form">
          <div class="field"><label for="r-no">${esc(t('No.'))}</label><input id="r-no" name="no" value="${esc(v.no)}"></div>
          <div class="field"><label for="r-date">${esc(t('Date'))}</label><input type="date" id="r-date" name="date" value="${esc(v.date)}"></div>
          <div class="field"><label for="r-status">${esc(t('Status'))}</label><select id="r-status" name="status">
            <option value="open" ${v.status === 'open' ? 'selected' : ''}>${esc(t('Open'))}</option><option value="closed" ${v.status === 'closed' ? 'selected' : ''}>${esc(t('Closed'))}</option></select>
            <span class="hint">${esc(t('Employees only see open RABs. A closed RAB takes no more purchases or reports.'))}</span></div>
          <div class="field wide"><label for="r-title">${esc(t('Work / project'))}</label><input id="r-title" name="title" value="${esc(v.title)}" placeholder="${esc(t('What is the work for?'))}"></div>
          <div class="field wide"><label for="r-note">${esc(t('Note'))}</label><input id="r-note" name="note" value="${esc(v.note)}" placeholder="${esc(t('Optional'))}"></div>
        </div></div>`;
    const buyTable = (list) => `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${esc(t('Date'))}</th><th>${esc(t('Item'))}</th><th class="num">${esc(t('Quantity'))}</th><th class="num">${esc(t('Price'))}</th><th class="num">${esc(t('Total'))}</th>
        <th>${esc(t('Supplier'))}</th><th>${esc(t('Ref.'))}</th><th>${esc(t('Photo'))}</th></tr></thead>
      <tbody>${list.map((tx) => `<tr class="${admin ? 'clickable' : ''}" data-id="${esc(tx.id)}" data-url="${esc(openUrl(tx))}"><td class="nowrap">${esc(fmtDate(tx.date))}</td>
        <td>${esc(tx.item)}${tx.note ? `<div class="muted small">${esc(tx.note)}</div>` : ''}</td>
        <td class="num">${esc(fmtQty(tx.qty))} <span class="muted">${esc(tx.unit)}</span></td><td class="num">${esc(fmtAmt(tx.price))}</td><td class="num">${esc(fmtAmt(C.round(tx.qty * tx.price, 2)))}</td>
        <td>${esc(tx.party)}</td><td class="nowrap">${esc(tx.ref)}</td><td>${tx.photo ? `<button type="button" class="thumb" aria-label="${esc(t('Photo'))}"></button>` : dash}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${esc(t('Total'))}</td><td class="num">${esc(fmtAmt(sumOf(list, (tx) => C.round(tx.qty * tx.price, 2))))}</td><td colspan="3"></td></tr></tfoot>
    </table></div>`;

    const title = !rab ? t('New RAB') : ro ? rab.no : t('Edit {no}', { no: rab.no });
    const actions = ro
      ? `<a class="btn" href="#/rab">← ${esc(t('All RABs'))}</a>${admin ? `<a class="btn" href="#/rab/${esc(rab.id)}/edit">${icon('edit')}${esc(t('Edit'))}</a>` : ''}`
      : `<a class="btn" href="${esc(rab ? '#/rab/' + rab.id : '#/rab')}">← ${esc(t('Back'))}</a>`;
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(title)}${ro ? rabBadge(prog.state) : ''}</h1>
        ${rab ? `<div class="sub">${esc(rab.title)}</div>` : ''}
        ${ro ? `<div class="sub">${esc([fmtDate(rab.date), rab.note].filter(Boolean).join(' · '))}</div>` : ''}</div>
        <div class="actions">${actions}</div></div>
      ${ro ? `<div class="tiles t3">${costTiles()}</div>` : ''}
      ${ro ? '' : '<form id="rabForm" novalidate autocomplete="off">'}
        ${head}
        <div class="card flush">
          <div class="card-head"><div><h2>${esc(t('Employees and wages'))}</h2>
            <div class="muted small">${esc(t('Who works on this RAB, the type of work each one does, and one wage each for the whole RAB. They can all use the items below.'))}</div></div>
            ${ro && admin ? `<button type="button" id="b-pay">${esc(t('Pay wages'))}…</button>` : ''}</div>
          <div class="tbl-wrap"><table class="tbl lines">
            <thead><tr><th class="n">#</th><th>${esc(t('Employee'))}</th><th>${esc(t('Type of work'))}</th><th class="num">${esc(t('Wage'))}</th><th class="num">${esc(t('Reports'))}</th><th>${esc(t('Paid'))}</th>${ro ? '' : '<th></th>'}</tr></thead>
            <tbody id="team"></tbody>
            <tfoot><tr><td colspan="3">${esc(t('Total'))}</td><td class="num" id="o-wage"></td><td colspan="${ro ? 2 : 3}"></td></tr></tfoot>
          </table></div>
          ${ro ? '' : `<div class="card-pad"><div class="row"><button type="button" id="b-emp">+ ${esc(t('Add employee'))}</button><button type="button" id="b-newjob">+ ${esc(t('New type of work'))}</button></div></div>`}
        </div>
        <div class="card flush">
          <div class="card-head"><div><h2>${esc(t('Items'))}</h2>
            <div class="muted small">${esc(t('The items and quantities planned for this work.'))} ${esc(t('Est. cost uses today’s average cost.'))}</div></div></div>
          <div class="tbl-wrap"><table class="tbl lines">
            <thead><tr><th class="n">#</th><th>${esc(t('Item'))}</th><th class="num">${esc(t('Planned'))}</th><th>${esc(t('Unit'))}</th><th class="num">${esc(t('Bought'))}</th>
              <th class="num">${esc(t('Used'))}</th><th class="num">${esc(t('Left'))}</th><th class="num">${esc(t('In stock'))}</th><th class="num">${esc(t('Est. cost'))}</th>${ro ? '' : '<th></th>'}</tr></thead>
            <tbody id="lines"></tbody>
            <tfoot><tr><td colspan="8">${esc(t('Total'))}</td><td class="num" id="o-est"></td>${ro ? '' : '<td></td>'}</tr></tfoot>
          </table></div>
          ${ro ? '' : `<datalist id="dl-items">${itemOptions()}</datalist>
          <div class="card-pad">
            <div class="row"><button type="button" id="b-line">+ ${esc(t('Add line'))}</button><button type="button" id="b-newitem">+ ${esc(t('New item'))}</button></div>
            <div id="errs"></div>
            <div class="form-actions">
              ${rab ? `<button type="button" class="danger" id="b-del">${esc(t('Delete'))}</button>` : ''}<span class="spacer"></span>
              <a class="btn" href="${esc(rab ? '#/rab/' + rab.id : '#/rab')}">${esc(t('Cancel'))}</a><button type="submit" class="primary">${esc(rab ? t('Save changes') : t('Save'))}</button>
            </div>
          </div>`}
        </div>
      ${ro ? '' : '</form>'}
      ${ro ? `<div class="card flush"><div class="card-head"><div><h2>${esc(t('Purchases'))}</h2>
          <div class="muted small">${esc(t('What was bought for this RAB. What is left over stays in stock for other RABs.'))}</div></div>
          ${admin && open ? `<button type="button" id="b-buy">+ ${esc(t('Purchase'))}</button>` : ''}</div><div id="buys"></div></div>
        <div class="card flush"><div class="card-head"><div><h2>${esc(t('Work reports'))}</h2>
          <div class="muted small">${esc(t('Sent by the employees. Only approved reports count as used.'))}${waiting ? ` <span class="warn-text">${esc(t('{n} waiting for approval', { n: waiting }))}</span>` : ''}</div></div></div>
          <div id="reps"></div></div>` : ''}`;

    const tbody = $('#lines'), tteam = $('#team');
    /** Pay one employee their wage on this RAB, or change or delete their payment. done runs after. */
    function payDialog(empId, done) {
      const w = team.find((x) => x.empId === empId), p = w && w.pay;
      if (!w) return;
      formDialog({
        title: t('Wage of {name} on {no}', { name: w.emp, no: rab.no }),
        fields: [
          { name: 'date', label: t('Paid on'), type: 'date' },
          { name: 'base', label: t('Wage'), type: 'number', hint: p ? '' : t('Filled in from the wages of the employee on the RAB.') },
          { name: 'allowance', label: t('Allowance / bonus'), type: 'number', placeholder: '0' },
          { name: 'deduction', label: t('Deduction'), type: 'number', placeholder: '0' },
          { name: 'note', label: t('Note'), placeholder: t('Optional') },
        ],
        values: p ? { date: p.date, base: p.base, allowance: p.allowance || '', deduction: p.deduction || '', note: p.note } : { date: today(), base: w.wage },
        save: (vals) => {
          const res = S.putPay(Object.assign({ id: p ? p.id : undefined, rabId: rab.id, empId }, vals));
          if (res.errors.length) return res.errors;
          toast(t('Saved: {name}.', { name: w.emp + ' · ' + rab.no }));
          done();
          return [];
        },
        remove: p ? () => {
          if (!confirm(t('Delete the payment of {name}?', { name: w.emp }))) return null;
          S.removePay(p.id);
          toast(t('Payment deleted.'));
          done();
          return '';
        } : null,
      });
    }
    if (ro) {
      tteam.innerHTML = team.map((w, i) => workerRow(Object.assign({ saved: true }, w), i + 1)).join('');
      tbody.innerHTML = prog.lines.map((l, i) => lineRow(l, i + 1)).join('');
      $('#o-wage').innerHTML = amtCell(sumOf(team, (w) => w.wage));
      $('#o-est').innerHTML = amtCell(sumOf(prog.lines, (l) => est(l.itemId, l.qty)));
      $('#buys').innerHTML = buys.length ? buyTable(buys) : `<p class="empty">${esc(t('Nothing bought for this RAB yet.'))}</p>`;
      $('#reps').innerHTML = reports.length ? reportTable(reports, { emp: true, status: true, act: admin, click: admin }) : `<p class="empty">${esc(t('No work reported yet.'))}</p>`;
      for (const box of [$('#buys'), $('#reps')]) { wireThumbs(box); wireOpen(box); }
      if (!admin) return;
      // the admin pays the wages, buys for the RAB and approves the work reports here; the page shows the result
      const again = () => viewRab(rab.id);
      wireReview($('#reps'), () => { again(); updateNav(); });
      tteam.addEventListener('click', (e) => { const b = e.target.closest('[data-pay]'); if (b) payDialog(b.dataset.pay, again); });
      $('#b-pay').addEventListener('click', () => payWagesDialog(rab, again));
      if (open) $('#b-buy').addEventListener('click', () => { inputPreset = { type: 'in', rabId: rab.id }; location.hash = '#/input'; });
      return;
    }

    const form = $('#rabForm');
    // ---- employees and wages
    const collectTeam = () => $$('tr', tteam).map((tr) => ({ empId: $('[name=emp]', tr).value, jobId: $('[name=job]', tr).value, wage: num($('[name=wage]', tr).value), saved: !!tr.dataset.saved }));
    function renderTeam(list) {
      tteam.innerHTML = list.map((w, i) => workerRow(w, i + 1)).join('');
      wageTotal();
    }
    const wageTotal = () => { $('#o-wage').innerHTML = amtCell(sumOf(collectTeam(), (w) => w.wage)); };
    tteam.addEventListener('input', wageTotal);
    tteam.addEventListener('click', (e) => {
      const b = e.target.closest('.del');
      if (!b) return;
      const list = collectTeam();
      list.splice($$('tr', tteam).indexOf(b.closest('tr')), 1);
      renderTeam(list.length ? list : [{}]);
    });
    $('#b-emp').addEventListener('click', () => { renderTeam(collectTeam().concat([{}])); $('tr:last-child [name=emp]', tteam).focus(); });
    // a type of work that is not in the master data yet: add it, then give it to the last employee without one
    $('#b-newjob').addEventListener('click', () => editMaster('jobs', null, null, (row) => {
      if (!row) return;
      keepJobs.add(row.id);
      const list = collectTeam(), i = list.map((w) => !w.jobId).lastIndexOf(true);
      if (i >= 0) list[i].jobId = row.id; else list.push({ jobId: row.id });
      renderTeam(list);
      $(`tr:nth-child(${i >= 0 ? i + 1 : list.length}) [name=${i >= 0 && list[i].empId ? 'wage' : 'emp'}]`, tteam).focus();
    }));

    // ---- items
    const collect = () => $$('tr', tbody).map((tr) => {
      const it = S.findItem($('[name=item]', tr).value);
      return { id: tr.dataset.line || undefined, item: $('[name=item]', tr).value, itemId: it ? it.id : '', qty: num($('[name=qty]', tr).value),
        used: Number(tr.dataset.used) || 0, waiting: Number(tr.dataset.waiting) || 0, bought: Number(tr.dataset.bought) || 0 };
    });
    const blankLine = (l) => !l.id && !C.clean(l.item) && l.qty === null;
    function renderLines(list) {
      tbody.innerHTML = list.map((l, i) => lineRow(l, i + 1)).join('');
      $$('tr', tbody).forEach(update);
      estTotal();
    }
    /** Unit, what is left, the stock and the estimate of one row. */
    function update(tr) {
      const it = S.findItem($('[name=item]', tr).value), qty = num($('[name=qty]', tr).value);
      const used = Number(tr.dataset.used) || 0, wait = Number(tr.dataset.waiting) || 0;
      $('.unit', tr).textContent = S.unitName(it);
      $('.left', tr).innerHTML = qty > 0 ? qtyCell(C.round(Math.max(qty - used - wait, 0), 4)) : dash;
      $('.stock', tr).innerHTML = stockCell(it && it.id, qty > 0 ? C.round(Math.max(qty - used, 0), 4) : 0);
      $('.est', tr).innerHTML = amtCell(est(it && it.id, qty));
    }
    const estTotal = () => { $('#o-est').innerHTML = amtCell(sumOf(collect(), (l) => est(l.itemId, l.qty))); };
    tbody.addEventListener('input', (e) => { update(e.target.closest('tr')); estTotal(); });
    tbody.addEventListener('change', (e) => {
      if (e.target.name !== 'item') return;
      const it = S.findItem(e.target.value);
      if (it) e.target.value = it.name; // a code may have been typed
    });
    tbody.addEventListener('click', (e) => {
      const b = e.target.closest('.del');
      if (!b) return;
      const list = collect();
      list.splice($$('tr', tbody).indexOf(b.closest('tr')), 1);
      renderLines(list.length ? list : [{}]);
    });
    $('#b-line').addEventListener('click', () => { renderLines(collect().concat([{}])); $('tr:last-child [name=item]', tbody).focus(); });
    // an item that is not in the master data yet: add it, then put it on a new line
    $('#b-newitem').addEventListener('click', () => editMaster('items', null, null, (row) => {
      if (!row) return;
      keepItems.add(row.id);
      $('#dl-items').innerHTML = itemOptions();
      const list = collect();
      if (list.length && blankLine(list[list.length - 1])) list.pop();
      renderLines(list.concat([{ item: row.name, itemId: row.id }]));
      $('tr:last-child [name=qty]', tbody).focus();
    }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // empty rows are left out
      const lines = collect().filter((l) => !blankLine(l));
      const workers = collectTeam().filter((w) => w.saved || w.empId || w.wage !== null);
      const res = S.putRab({ id: rab ? rab.id : undefined, no: form.no.value, date: form.date.value, status: form.status.value, title: form.title.value, note: form.note.value, lines, workers });
      if (res.errors.length) { $('#errs').innerHTML = errBox(res.errors); return; }
      toast(t('Saved: {name}.', { name: res.row.no }));
      // back to the RAB (a new one opens), so purchases can be added next
      const to = '#/rab/' + res.row.id;
      if (location.hash === to) viewRab(res.row.id); else location.hash = to;
    });
    if (rab) {
      $('#b-del').addEventListener('click', () => {
        if (!confirm(t('Delete {name}?', { name: rab.no }))) return;
        const err = S.removeRab(rab.id);
        if (err) { $('#errs').innerHTML = errBox([err]); return; }
        toast(t('Deleted: {name}.', { name: rab.no }));
        location.hash = '#/rab';
      });
    }
    renderTeam(team.length ? team.map((w) => ({ empId: w.empId, jobId: w.jobId, wage: w.wage, saved: true })) : [{}]);
    renderLines(rab ? prog.lines : [{}]);
    if (!rab) form.title.focus();
  }

  // =====================================================================================  Work reports (admin)
  /** Every work report the employees sent, with the waiting ones first in view: approve, reject, or open one to check
      and correct it. */
  const repFilter = { q: '', status: 'pending', rab: '' };
  function viewReports() {
    const all = S.workReports(), rabs = S.rabs().filter((r) => all.some((x) => x.rabId === r.id));
    if (!rabs.some((r) => r.id === repFilter.rab)) repFilter.rab = '';
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(t('Work reports'))}</h1>
        <div class="sub">${esc(t('Sent by the employees. Only approved reports count in the stock and the costs. Click a report to check or correct it.'))}</div></div></div>
      <div class="card">
        <div class="filters">
          <div class="field grow"><label for="wq">${esc(t('Search'))}</label><input type="search" id="wq" value="${esc(repFilter.q)}" placeholder="${esc(t('Employee, item, work done…'))}"></div>
          <div class="field"><label for="ws">${esc(t('Status'))}</label><select id="ws">
            ${['pending', 'approved', 'rejected', ''].map((k) => `<option value="${k}" ${repFilter.status === k ? 'selected' : ''}>${esc(k ? REVIEW[k].label() : t('All'))}</option>`).join('')}</select></div>
          <div class="field"><label for="wr">${esc(t('RAB'))}</label><select id="wr"><option value="">${esc(t('All'))}</option>
            ${rabs.map((r) => `<option value="${esc(r.id)}" ${repFilter.rab === r.id ? 'selected' : ''}>${esc(r.no + ' · ' + r.title)}</option>`).join('')}</select></div>
        </div>
        <div id="tbl"></div>
      </div>`;
    function render() {
      const q = repFilter.q.trim().toLowerCase(), list0 = S.workReports();
      const list = list0.filter((x) => (!repFilter.status || x.status === repFilter.status) && (!repFilter.rab || x.rabId === repFilter.rab)
        && (!q || [x.emp, x.item, x.code, x.note, x.rabNo, x.rabTitle, x.reason].join(' ').toLowerCase().includes(q)));
      const box = $('#tbl');
      box.innerHTML = list.length ? reportTable(list, { emp: true, rab: true, status: true, act: true, click: true }) + `<div class="muted small foot">${esc(t('{n} reports', { n: list.length }))}</div>`
        : `<p class="empty">${esc(!list0.length ? t('No work reported yet.') : repFilter.status === 'pending' && !q && !repFilter.rab ? t('Nothing is waiting for approval.') : t('No reports match the filter.'))}</p>`;
      wireThumbs(box);
      wireOpen(box);
      wireReview(box, () => { render(); updateNav(); });
    }
    $('#wq').addEventListener('input', (e) => { repFilter.q = e.target.value; render(); });
    $('#ws').addEventListener('change', (e) => { repFilter.status = e.target.value; render(); });
    $('#wr').addEventListener('change', (e) => { repFilter.rab = e.target.value; render(); });
    render();
  }

  /** One work report, for the admin to check. Waiting: approve it as it is or after correcting it, or reject it.
      Approved: it can still be corrected or rejected. Rejected: it stays as it is. The employee who sent it stays. */
  function viewReview(id) {
    const tx = S.get(id);
    if (!tx || tx.type !== 'out' || !tx.rabId) { toast(t('Work report not found.'), 'err'); location.hash = '#/reports'; return; }
    const back = /^#\/(rab|stock)\//.test(from) ? from : '#/reports';
    const st = tx.status, locked = st === 'rejected', emp = S.find('employees', tx.empId);
    // the report's own RAB, and the other open RABs this employee works on
    const rabs = S.rabs().filter((r) => r.id === tx.rabId || (r.status === 'open' && r.workers.some((w) => w.empId === tx.empId)));
    const decided = st !== 'pending' && tx.reviewedBy ? t('{status} by {name} on {date}.', { status: REVIEW[st].label(), name: tx.reviewedBy, date: fmtDate(tx.reviewedAt) }) : '';
    main.innerHTML = `
      <div class="page-head"><div><h1>${esc(t('Work report'))}</h1><div class="sub">${esc([emp ? emp.name : '', fmtDate(tx.date)].filter(Boolean).join(' · '))}</div></div>
        <div class="actions"><a class="btn" href="${esc(back)}">← ${esc(t('Back'))}</a></div></div>
      <div class="input-grid">
        <form class="card" id="revForm" novalidate autocomplete="off">
          <div class="review-head">${reviewBadge(tx)}<span class="muted small">${esc(decided)}</span>${tx.edited ? `<span class="muted small">${esc(t('Changed by the admin'))}</span>` : ''}</div>
          ${locked ? `<div class="alert err">${esc(t('Reason'))}: ${esc(tx.reason)}</div>` : ''}
          <fieldset class="plain" ${locked ? 'disabled' : ''}><div class="form">
            <div class="field wide2"><label for="r-rab">${esc(t('RAB'))}</label><select id="r-rab" name="rab">
              ${rabs.map((r) => `<option value="${esc(r.id)}" ${r.id === tx.rabId ? 'selected' : ''}>${esc(r.no + ' · ' + r.title)}</option>`).join('')}</select></div>
            <div class="field"><label for="r-date">${esc(t('Date'))}</label><input type="date" id="r-date" name="date" value="${esc(tx.date)}" max="${today()}"></div>
            <div class="field wide2"><label for="r-line">${esc(t('Item'))}</label><select id="r-line" name="line"></select></div>
            <div class="field"><label for="r-qty" id="l-qty">${esc(t('Quantity'))}</label><input type="number" step="any" min="0" inputmode="decimal" id="r-qty" name="qty" value="${tx.qty}"></div>
            <div class="field wide"><label>${esc(t('Employee'))}</label><div class="val">${esc(emp ? emp.name + (emp.dept ? ' — ' + emp.dept : '') : '?')}</div></div>
            <div class="field wide"><label for="r-note">${esc(t('Work done'))}</label><input id="r-note" name="note" value="${esc(tx.note)}"></div>
            <div class="field wide"><label for="f-photo">${esc(t('Photo'))}</label><div id="w-photo"></div></div>
          </div></fieldset>
          <div id="errs"></div>
          <div class="form-actions">
            ${locked ? '' : `<button type="button" class="danger" id="b-reject">${esc(t('Reject'))}…</button>`}<span class="spacer"></span>
            <a class="btn" href="${esc(back)}">${esc(locked ? t('Close') : t('Cancel'))}</a>
            ${st === 'pending' ? `<button type="submit" class="primary">${esc(t('Approve'))}</button>` : st === 'approved' ? `<button type="submit" class="primary">${esc(t('Save changes'))}</button>` : ''}
          </div>
        </form>
        <aside class="card" id="itemInfo"></aside>
      </div>`;
    const form = $('#revForm');
    const photo = photoField($('#w-photo'), tx.photo);
    const rabNow = () => S.rab(form.rab.value);
    /** Room for this report on a line: planned, less what the other reports (approved or waiting) take. */
    const room = (l) => C.round(l.qty - S.lineReported(l.id, tx.id), 4);
    function fillLines() {
      const rab = rabNow(), cur = form.line.value || tx.lineId;
      const lines = rab ? S.rabLines(rab).filter((l) => room(l) > 0 || l.id === tx.lineId) : [];
      form.line.innerHTML = lines.map((l) => `<option value="${esc(l.id)}" ${l.id === cur ? 'selected' : ''}>${esc(t('{item} ({left} left)', { item: l.item, left: (fmtQty(room(l)) + ' ' + l.unit).trim() }))}</option>`).join('');
    }
    /** The side panel: the stock before this report and the room on the RAB line. */
    function onLine() {
      const rab = rabNow(), l = rab && S.rabLines(rab).find((x) => x.id === form.line.value), box = $('#itemInfo');
      if (!l) { box.innerHTML = `<p class="muted">${esc(t('Choose an item.'))}</p>`; return; }
      const qu = (q) => (fmtQty(q) + ' ' + l.unit).trim(), qty = num(form.qty.value) || 0;
      const s = C.stock(S.txs().filter((x) => x.id !== tx.id), form.date.value || today()).find((x) => x.key === l.itemId) || { qty: 0, avg: 0 };
      $('#l-qty').textContent = t('Quantity') + (l.unit ? ` (${l.unit})` : '');
      box.innerHTML = `<h2>${esc(l.item)}</h2>${l.code ? `<div class="muted small code">${esc(l.code)}</div>` : ''}
        <div class="big">${esc(fmtQty(s.qty))} <span class="muted">${esc(l.unit)}</span></div>
        <div class="muted small">${esc(t('In stock on {date}, before this report', { date: fmtDate(form.date.value || today()) }))}</div>
        ${!locked && qty > s.qty ? `<p><span class="badge warn">${esc(t('Short {qty}', { qty: qu(C.round(qty - s.qty, 4)) }))}</span></p>` : ''}
        <dl class="kv"><dt>${esc(t('Average cost'))}</dt><dd class="num">${esc(fmtAmt(s.avg))}</dd>
          <dt>${esc(t('Value of this report'))}</dt><dd class="num">${esc(fmtAmt(C.round(qty * s.avg, 2)))}</dd></dl>
        <h3>${esc(rab.no)}</h3><dl class="kv">
          <dt>${esc(t('Planned'))}</dt><dd class="num">${esc(qu(l.qty))}</dd>
          <dt>${esc(t('Other reports'))}</dt><dd class="num">${esc(qu(S.lineReported(l.id, tx.id)))}</dd>
          <dt>${esc(t('Room for this report'))}</dt><dd class="num">${esc(qu(room(l)))}</dd></dl>`;
    }
    form.rab.addEventListener('change', () => { form.line.value = ''; fillLines(); onLine(); });
    form.line.addEventListener('change', onLine);
    form.qty.addEventListener('input', onLine);
    form.date.addEventListener('change', onLine);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (locked) return;
      const rab = rabNow(), line = rab && rab.lines.find((l) => l.id === form.line.value), it = line && S.find('items', line.itemId);
      // approving a waiting report saves the corrections with it; an approved one stays approved
      const x = { id: tx.id, type: 'out', date: form.date.value, item: it ? it.name : '', itemId: it ? it.id : '', rabId: rab ? rab.id : '', empId: tx.empId,
        qty: num(form.qty.value), ref: tx.ref, note: form.note.value, status: 'approved' };
      const errors = S.put(x, true).errors;
      if (!C.clean(x.note)) errors.push(t('Describe the work this was used for.'));
      const res = errors.length ? { errors } : await saveTx(x, photo, tx.photo);
      if (res.errors.length) { $('#errs').innerHTML = errBox(res.errors); return; }
      toast(st === 'pending' ? t('Report approved: {qty} {item}.', { qty: (fmtQty(res.tx.qty) + ' ' + res.tx.unit).trim(), item: res.tx.item }) : t('Changes saved.'));
      location.hash = back;
    });
    if (!locked) $('#b-reject').addEventListener('click', () => rejectDialog(tx.id, () => { location.hash = back; }));
    fillLines();
    onLine();
  }
  // =====================================================================================  Report work (pegawai)
  /** The employee's page, made for a phone: a form to report work on an item of their open RABs, the RABs themselves
      (their wage, who they work with, and per item what is planned, reported and left), and their own reports with the
      admin's decision. A report waits until the admin approves it. */
  function viewWork() {
    const me = S.me(), emp = S.find('employees', me.empId);
    const tasks = S.tasks(me.empId);
    const open = tasks.flatMap((x) => x.lines.filter((l) => l.left > 0).map((l) => Object.assign({ rab: x.rab }, l)));
    const qu = (q, unit) => (fmtQty(q) + ' ' + unit).trim();
    const mates = (rab) => rab.workers.filter((w) => w.empId !== me.empId).map((w) => {
      const name = (S.find('employees', w.empId) || { name: '?' }).name, job = S.jobOf(rab, w.empId);
      return job ? `${name} (${job})` : name;
    });
    // an item of a RAB can be reported while something is left; it is done once everything planned is reported
    const lineAct = (l) => (l.left > 0 ? `<button type="button" class="sm" data-line="${esc(l.id)}">${esc(t('Report this'))}</button>` : rabBadge('done'));
    const reported = (l) => (l.used + l.waiting ? qu(C.round(l.used + l.waiting, 4), l.unit) : '');
    const waitNote = (l) => (l.waiting ? `<div class="warn-text small">${esc(t('{qty} waiting for approval', { qty: qu(l.waiting, l.unit) }))}</div>` : '');
    const rabCard = (x) => `<div class="card flush">
        <div class="card-head"><div><h2>${esc(x.rab.no + ' · ' + x.rab.title)}</h2>
          <div class="muted small">${esc([x.job ? t('Your work: {job}', { job: x.job }) : '', t('Your wage: {wage}', { wage: x.wage ? fmtAmt(x.wage) : '—' }), mates(x.rab).length ? t('With {names}', { names: mates(x.rab).join(', ') }) : ''].filter(Boolean).join(' · '))}</div></div></div>
        <div class="tbl-wrap"><table class="tbl cards">
          <thead><tr><th>${esc(t('Item'))}</th><th class="num">${esc(t('Planned'))}</th><th class="num">${esc(t('Reported'))}</th><th class="num">${esc(t('Left'))}</th><th></th></tr></thead>
          <tbody>${x.lines.map((l) => `<tr><td>${esc(l.item)}</td><td class="num">${esc(qu(l.qty, l.unit))}</td>
            <td class="num">${reported(l) ? esc(reported(l)) : dash}${waitNote(l)}</td>
            <td class="num">${l.left ? esc(qu(l.left, l.unit)) : dash}</td>
            <td class="actions">${lineAct(l)}</td>
            <td class="m"><div class="mc"><div class="mc-body">
              <div class="mc-top"><span>${esc(l.item)}</span>${lineAct(l)}</div>
              <div class="mc-meta">${esc([`${t('Planned')} ${qu(l.qty, l.unit)}`, reported(l) ? `${t('Reported')} ${reported(l)}` : '', l.left ? `${t('Left')} ${qu(l.left, l.unit)}` : ''].filter(Boolean).join(' · '))}</div>
              ${waitNote(l)}</div></div></td></tr>`).join('')}</tbody>
        </table></div></div>`;
    main.innerHTML = `<div class="narrow">
      <div class="page-head"><div><h1>${esc(t('Report work'))}</h1><div class="sub">${esc([me.name, emp && emp.dept].filter(Boolean).join(' · '))}</div></div></div>
      ${open.length ? `<form class="card work" id="workForm" novalidate autocomplete="off">
        <h2>${esc(t('New report'))}</h2>
        <div class="form">
          <div class="field wide"><label for="f-line">${esc(t('Work (RAB)'))}</label>
            <select id="f-line" name="line"><option value="">${esc(t('— choose —'))}</option>
              ${open.map((l) => `<option value="${esc(l.id)}" ${open.length === 1 ? 'selected' : ''}>${esc(`${l.rab.no} · ${l.rab.title} — ${l.item}`)}</option>`).join('')}</select>
            <span class="hint" id="h-line"></span></div>
          <div class="field"><label for="f-date">${esc(t('Date'))}</label><input type="date" id="f-date" name="date" value="${today()}" max="${today()}" required></div>
          <div class="field"><label for="f-qty" id="l-qty">${esc(t('Quantity'))}</label><input type="number" step="any" min="0" inputmode="decimal" id="f-qty" name="qty" required></div>
          <div class="field wide"><label for="f-note">${esc(t('Work done'))}</label><input id="f-note" name="note" placeholder="${esc(t('What was it used for?'))}" required></div>
          <div class="field wide"><label for="f-photo">${esc(t('Photo'))}</label><div id="w-photo"></div><span class="hint">${esc(t('A photo of the work or of the items taken.'))}</span></div>
        </div>
        <div id="errs"></div>
        <div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">${esc(t('Send report'))}</button></div>
      </form>` : ''}
      ${tasks.length ? tasks.map(rabCard).join('') : `<div class="card"><p class="empty">${esc(t('No work given to you yet. The admin gives out work in a RAB.'))}</p></div>`}
      <div class="card flush"><div class="card-head"><h2>${esc(t('My reports'))}</h2></div><div id="mine"></div></div>
    </div>`;

    // their own work reports, newest first, with the admin's decision
    const list = S.workReports().filter((tx) => tx.empId === me.empId);
    const box = $('#mine');
    box.innerHTML = list.length ? reportTable(list, { rab: true, status: true }) : `<p class="empty">${esc(t('No reports yet.'))}</p>`;
    wireThumbs(box);
    if (!open.length) return;

    const form = $('#workForm');
    const photo = photoField($('#w-photo'), '');
    const line = () => open.find((x) => x.id === form.line.value) || null;
    function onLine() {
      const l = line();
      $('#l-qty').textContent = t('Quantity') + (l && l.unit ? ` (${l.unit})` : '');
      form.qty.max = l ? l.left : '';
      const s = l && C.stock(S.txs(), form.date.value || today()).find((x) => x.key === l.itemId);
      $('#h-line').textContent = l ? t('Left on the RAB: {left} · In stock: {stock}', { left: qu(l.left, l.unit), stock: qu(s ? s.qty : 0, l.unit) }) : '';
    }
    form.line.addEventListener('change', onLine);
    form.date.addEventListener('change', onLine);
    $$('button[data-line]').forEach((b) => b.addEventListener('click', () => {
      form.line.value = b.dataset.line;
      onLine();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      form.qty.focus({ preventScroll: true });
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const l = line(), errors = [];
      // a report is always a use in the employee's own name, on an item of one of their RABs
      const x = l && { type: 'out', date: form.date.value, item: l.item, itemId: l.itemId, empId: me.empId, qty: num(form.qty.value), ref: '', note: form.note.value, rabId: l.rab.id };
      if (!l) errors.push(t('Choose the work you did.'));
      else errors.push(...S.put(x, true).errors);
      if (!C.clean(form.note.value)) errors.push(t('Describe the work this was used for.'));
      if (!photo.has()) errors.push(t('Add a photo.'));
      const res = errors.length ? { errors } : await saveTx(x, photo, '');
      if (res.errors.length) { $('#errs').innerHTML = errBox(res.errors); return; }
      // with sync, a report made offline or in manual mode stays on this device until the next sync
      const v = { qty: qu(res.tx.qty, res.tx.unit), item: res.tx.item };
      toast(Sync.enabled && (!Sync.online || Sync.mode === 'manual')
        ? t('Report saved on this device: {qty} {item}. It is sent with the next sync.', v) : t('Report sent: {qty} {item}. It waits for approval.', v));
      viewWork();
    });
    onLine();
  }

  // =====================================================================================  Sign in
  function langPicker(sel) {
    sel.innerHTML = Object.entries(I18N.LANGS).map(([k, v]) => `<option value="${k}" ${k === I18N.lang ? 'selected' : ''}>${esc(v)}</option>`).join('');
    sel.addEventListener('change', () => I18N.setLang(sel.value));
  }
  function viewLogin() {
    // the demo accounts of this device, or of the server for a device that has no data yet
    const local = S.users().filter((u) => u.demo && u.active).map((u) => ({ role: u.role, username: u.username, demo: u.demo }));
    const demo = (local.length ? local : Sync.demo.map((u) => ({ role: u.role, username: u.username, demo: u.password })))
      .filter((u) => ROLE[u.role]).sort((a, b) => S.ROLES.indexOf(a.role) - S.ROLES.indexOf(b.role));
    main.innerHTML = `
      <div class="login">
        <div class="login-brand"><img class="logo" src="img/logo.svg" alt="" width="56" height="56">
          <h1>${esc(t('Simple Inventory'))}</h1><p>${esc(t('Stock, work reports and wages per RAB'))}</p></div>
        <form class="card" id="loginForm" novalidate>
          <div class="field"><label for="l-user">${esc(t('Username'))}</label><input id="l-user" name="username" autocomplete="username" autocapitalize="none" required></div>
          <div class="field"><label for="l-pass">${esc(t('Password'))}</label><input type="password" id="l-pass" name="password" autocomplete="current-password" required></div>
          <div id="errs"></div>
          <button type="submit" class="primary">${esc(t('Sign in'))}</button>
          <div class="field"><label for="l-lang">${esc(t('Language'))}</label><select id="l-lang"></select></div>
          ${installEvt ? `<button type="button" id="b-install">${icon('download')}${esc(t('Install app'))}</button>` : ''}
        </form>
        ${demo.length ? `<div class="card flush"><div class="card-head"><div><h2>${esc(t('Demo accounts'))}</h2><div class="muted small">${esc(t('Click one to fill in the form.'))}</div></div></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('Role'))}</th><th>${esc(t('Username'))}</th><th>${esc(t('Password'))}</th></tr></thead>
          <tbody>${demo.map((u) => `<tr class="clickable" data-u="${esc(u.username)}" data-p="${esc(u.demo)}"><td>${esc(ROLE[u.role].label())}</td><td>${esc(u.username)}</td><td>${esc(u.demo)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      </div>`;
    const form = $('#loginForm');
    langPicker($('#l-lang'));
    $$('tr[data-u]').forEach((tr) => tr.addEventListener('click', () => { form.username.value = tr.dataset.u; form.password.value = tr.dataset.p; form.querySelector('button').focus(); }));
    if (installEvt) $('#b-install').addEventListener('click', install);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.username.value, pass = form.password.value, btn = $('button[type=submit]', form);
      const fail = (msg) => { $('#errs').innerHTML = errBox([msg]); };
      // known on this device: signed in at once, also offline; a sync token is fetched when there is none yet
      const me = S.login(name, pass);
      if (me) {
        route();
        if (Sync.enabled && Sync.online && !Sync.hasToken(me.id)) Sync.login(name, pass).then(() => Sync.now()).catch(() => {});
        return;
      }
      if (!Sync.enabled) { fail(t('Wrong username or password.')); return; }
      // not known here (a new device, or a new account): the server checks it and sends the data
      btn.disabled = true;
      try {
        await Sync.login(name, pass);
        if (S.login(name, pass)) route(); else fail(t('Wrong username or password.'));
      } catch (err) {
        fail(err.status === 401 ? t('Wrong username or password.') : t('The server cannot be reached. Sign in once while online.'));
      } finally { btn.disabled = false; }
    });
    form.username.focus();
  }

  // =====================================================================================  Shell
  const ROLE = {
    supervisor: { label: () => t('Supervisor') },
    admin: { label: () => t('Admin') },
    pegawai: { label: () => t('Employee') },
  };
  /** The menu. A role sees the entries that list it. */
  const NAV = [
    { page: 'work', label: 'Report work', icon: 'reports', roles: ['pegawai'] },
    { page: 'input', label: 'Input', icon: 'input', roles: ['admin'] },
    { page: 'reports', label: 'Work reports', icon: 'reports', roles: ['admin'] },
    { page: 'rab', label: 'RAB', icon: 'rab', roles: ['admin', 'supervisor'] },
    // the reports: the summary, then one page per table (REPORTS)
    { group: 'Reports', roles: ['admin', 'supervisor'] },
    { page: 'report', label: 'Summary', icon: 'report', roles: ['admin', 'supervisor'] },
    ...Object.keys(REPORTS).map((k) => ({ page: 'report/' + k, label: REPORTS[k].label, icon: REPORTS[k].icon, roles: ['admin', 'supervisor'] })),
    { group: 'Master data', roles: ['admin'] },
    { page: 'master/items', label: 'Items', icon: 'items', roles: ['admin'] },
    { page: 'master/employees', label: 'Employees', icon: 'employees', roles: ['admin'] },
    { page: 'master/jobs', label: 'Types of work', icon: 'jobs', roles: ['admin'] },
    { page: 'master/units', label: 'Units', icon: 'units', roles: ['admin'] },
    { page: 'master/users', label: 'Users', icon: 'users', roles: ['admin'] },
  ];
  /** The page each role starts on. */
  const HOME = { pegawai: 'work', admin: 'input', supervisor: 'report' };
  /** Pages outside the menu: the stock card of an item, opened from Items, the Report, a RAB page or the input page. */
  const EXTRA = { stock: ['admin', 'supervisor'] };
  /** Replaces all data with the sample. Its work reports come with example photos (drawn by js/sample-photos.js),
      saved like any photo once the old ones are deleted. Resolves when they are saved; never fails: the sample
      still works without its photos. */
  function loadSampleData() {
    const shots = S.loadSample(today());
    return Photos.clear()
      .then(() => Promise.all(shots.map((p) => Photos.put(SamplePhotos.blob(p), p.id))))
      .catch((e) => console.warn('The sample photos could not be saved.', e));
  }
  /** Load the sample data or delete everything (admin). */
  function dataDialog() {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `<h2>${esc(t('Data'))}</h2>
      <p class="muted">${esc(Sync.enabled ? t('With sync, this also changes the data on the server and on every device.') : t('Prototype — data is saved in this browser only.'))}</p>
      <div class="data-acts">
        <div><button type="button" data-a="sample">${esc(t('Load sample data'))}</button>
          <div class="hint">${esc(t('Replaces all data with three sample RABs and their purchases, work reports (with example photos) and wages.'))}</div></div>
        <div><button type="button" class="danger" data-a="clear">${esc(t('Delete all data'))}</button>
          <div class="hint">${esc(t('Deletes RABs, purchases, work reports, wage payments, photos and master data, and the accounts of employees.'))}</div></div>
      </div>
      <div class="form-actions"><span class="spacer"></span><button type="button" data-a="close">${esc(t('Close'))}</button></div>`;
    dlg.addEventListener('click', async (e) => {
      const a = e.target.closest('button[data-a]');
      if (!a) return;
      if (a.dataset.a === 'sample') {
        if (!S.isEmpty() && !confirm(t('Replace all current data with sample data?'))) return;
        await loadSampleData(); // with its photos saved, so the page shows them
        toast(t('Sample data loaded.'));
      } else if (a.dataset.a === 'clear') {
        if (!confirm(t('Delete ALL data — RABs, purchases, work reports, wage payments, photos and master data? The accounts of employees are deleted too. This cannot be undone.'))) return;
        S.clear(); Photos.clear(); toast(t('All data deleted.'));
      }
      dlg.close();
      if (a.dataset.a === 'close') return;
      const home = '#/' + HOME[S.me().role]; // the page that was open may show data that is gone
      if (location.hash === home) route(); else location.hash = home;
    });
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  }
  /** The menu of a user. Work reports shows how many are waiting for the admin. */
  function navHtml(me) {
    const waiting = me.role === 'admin' ? S.workReports().filter((x) => x.status === 'pending').length : 0;
    return NAV.filter((n) => n.roles.includes(me.role)).map((n) => (n.group ? `<div class="nav-group">${esc(t(n.group))}</div>`
      : `<a href="#/${n.page}" data-page="${n.page}">${icon(n.icon)}${esc(t(n.label))}${n.page === 'reports' && waiting
        ? `<span class="count" title="${esc(t('{n} waiting for approval', { n: waiting }))}">${waiting}</span>` : ''}</a>`)).join('');
  }
  let curPage = ''; // the menu entry of the page shown
  function markNav() {
    document.querySelectorAll('.nav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.page === curPage);
      if (a.dataset.page === curPage) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  /** After an approval or rejection: the number waiting in the menu. */
  function updateNav() {
    const me = S.me();
    if (!me) return;
    document.getElementById('nav').innerHTML = navHtml(me);
    markNav();
  }
  /** Initials for the avatar: the first letters of the first two words of a name. */
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  /** Sidebar for the signed-in user: their menu, the sync status, and at the bottom their name, which opens a menu
      with change password, Data (admin), install, the sync mode, the language and sign out. */
  function shell() {
    const me = S.me();
    document.body.classList.toggle('signed-out', !me);
    if (!me) { syncStatus(); return; }
    document.getElementById('nav').innerHTML = navHtml(me);
    const box = document.getElementById('meBox');
    const radio = (on, attr, label) => `<button type="button" role="menuitemradio" aria-checked="${on}" ${attr}>${icon('check', on ? '' : 'blank')}${esc(label)}</button>`;
    box.innerHTML = `<div id="syncBox"></div><details class="menu user-menu">
      <summary title="${esc(t('Account'))}"><span class="avatar" aria-hidden="true">${esc(initials(me.name))}</span>
        <span class="who"><strong>${esc(me.name)}</strong><span class="muted small">${esc(ROLE[me.role].label())} · ${esc(me.username)}</span></span>${icon('updown')}</summary>
      <div class="menu-list" role="menu">
        <button type="button" role="menuitem" data-a="pass">${icon('key')}${esc(t('Change password'))}</button>
        ${me.role === 'admin' ? `<button type="button" role="menuitem" data-a="data">${icon('data')}${esc(t('Data'))}…</button>` : ''}
        ${installEvt ? `<button type="button" role="menuitem" data-a="install">${icon('download')}${esc(t('Install app'))}</button>` : ''}
        ${Sync.enabled ? `<div class="menu-sep" role="separator"></div>
          <div class="menu-label">${esc(t('Sync'))}</div>
          ${radio(Sync.mode === 'auto', 'data-sync="auto"', t('Automatic'))}${radio(Sync.mode === 'manual', 'data-sync="manual"', t('Manual'))}
          <button type="button" role="menuitem" data-a="sync">${icon('sync')}${esc(t('Sync now'))}</button>` : ''}
        <div class="menu-sep" role="separator"></div>
        <div class="menu-label">${esc(t('Language'))}</div>
        ${Object.entries(I18N.LANGS).map(([k, label]) => radio(k === I18N.lang, `data-lang="${k}"`, label)).join('')}
        <div class="menu-sep" role="separator"></div>
        <button type="button" role="menuitem" data-a="out">${icon('out')}${esc(t('Sign out'))}</button>
      </div></details>`;
    $('.menu-list', box).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.closest('details').open = false;
      if (b.dataset.lang) { if (b.dataset.lang !== I18N.lang) I18N.setLang(b.dataset.lang); }
      else if (b.dataset.sync) { Sync.setMode(b.dataset.sync); shell(); }
      else if (b.dataset.a === 'sync') Sync.now();
      else if (b.dataset.a === 'install') install();
      else if (b.dataset.a === 'data') dataDialog();
      else if (b.dataset.a === 'out') signOut();
      else if (b.dataset.a === 'pass') changePassword(me);
    });
    syncStatus();
  }

  // ---- offline and sync (js/sync.js): what is shown, and installing the app
  /** The state of the sync in a few words, with its icon and colour; null when the app does not sync. */
  function syncInfo() {
    if (!Sync.enabled) return null;
    const n = Sync.pending, hhmm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    if (Sync.busy) return { cls: 'busy', icon: 'sync', text: t('Syncing…') };
    if (!Sync.online) return { cls: 'off', icon: 'cloudOff', text: n ? t('Offline · {n} not sent', { n }) : t('Offline') };
    if (Sync.error === 'sign-in') return { cls: 'err', icon: 'alert', text: t('Sign in again to sync') };
    if (Sync.error) return { cls: 'err', icon: 'alert', text: t('Sync failed · try again') };
    if (n) return { cls: 'wait', icon: 'cloud', text: t('{n} changes not sent', { n }) };
    return { cls: 'ok', icon: 'cloudOk', text: Sync.last ? t('Synced {time}', { time: hhmm(Sync.last) }) : t('Not synced yet') };
  }
  /** The sync status above the user in the sidebar, and its icon in the top bar of a phone. Clicking syncs now; when
      the sign-in has expired, it signs out, to sign in again. */
  function syncStatus() {
    const s = S.me() && syncInfo(), box = document.getElementById('syncBox'), mini = document.getElementById('syncMini');
    mini.hidden = !s;
    document.querySelector('.foot-note').textContent = Sync.enabled ? t('Data is kept on this device and synced with the server.') : t('Prototype — data is saved in this browser only.');
    if (!s) { if (box) box.innerHTML = ''; return; }
    if (box) box.innerHTML = `<button type="button" class="sync-pill ${s.cls}" title="${esc(t('Sync now'))}">${icon(s.icon)}<span>${esc(s.text)}</span></button>`;
    mini.className = `ghost icon-btn sync-mini ${s.cls}`;
    mini.title = s.text;
    mini.innerHTML = icon(s.icon) + (Sync.pending ? `<span class="n">${Sync.pending}</span>` : '');
  }
  function syncClick() { if (Sync.error === 'sign-in') signOut(); else Sync.now(); }
  document.getElementById('meBox').addEventListener('click', (e) => { if (e.target.closest('.sync-pill')) syncClick(); });
  document.getElementById('syncMini').addEventListener('click', syncClick);
  let dirty = false; // something was typed on the page shown
  main.addEventListener('input', () => { dirty = true; });
  /** Data came from other devices: the menu (waiting reports) and the page show it, unless something is being typed
      or a dialog is open (then the next page shows it). */
  function refresh() {
    updateNav();
    if (!S.me() || dirty || document.querySelector('dialog[open]')) return;
    const y = window.scrollY;
    route(true);
    window.scrollTo(0, y);
  }
  // installing as an app (PWA): the browser offers it once the app qualifies; shown in the user menu and on the sign-in page
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (S.me()) shell(); else if (!dirty) route(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast(t('App installed.')); if (S.me()) shell(); });
  function install() { if (installEvt) installEvt.prompt().catch(() => {}); }
  function signOut() {
    S.logout();
    history.replaceState(null, '', location.pathname + location.search); // the next user starts on their own home page
    route();
  }
  function changePassword(me) {
    formDialog({
      title: t('Change password'),
      fields: [
        { name: 'current', label: t('Current password'), type: 'password' },
        { name: 'next', label: t('New password'), type: 'password', hint: t('At least 6 characters.') },
        { name: 'again', label: t('New password again'), type: 'password' },
      ],
      save: (v) => {
        const err = v.next !== v.again ? t('The two new passwords are not the same.') : S.changePassword(me.id, v.current, v.next);
        if (!err) toast(t('Password changed.'));
        return err ? [err] : [];
      },
    });
  }
  let here = '', from = ''; // this page and the one before it (the input page goes back to a RAB or stock card)
  /** Shows the page of the address. keep: the same page again with new data (keeps the drawer and the scroll). */
  function route(keep) {
    if (location.hash !== here) { from = here; here = location.hash; }
    const me = S.me();
    const [, page = '', id, sub] = (location.hash || '').split('/');
    document.querySelectorAll('dialog.dlg').forEach((d) => d.close());
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    dirty = false;
    if (keep !== true) { setNav(false); window.scrollTo(0, 0); }
    shell();
    if (!me) { viewLogin(); return; }
    // a page that is not in this role's menu (or one of its extra pages) sends the user to their home page
    const cur = page === 'master' ? 'master/' + (MASTER[id] ? id : 'items') : page === 'report' && isReport(id) ? 'report/' + id : page;
    const mine = NAV.filter((n) => n.page && n.roles.includes(me.role));
    if (!mine.some((n) => n.page === cur) && !(EXTRA[page] || []).includes(me.role)) { location.hash = '#/' + HOME[me.role]; return; }
    curPage = cur;
    markNav();
    if (page === 'report') { if (isReport(id)) viewTableReport(id); else viewReport(); }
    else if (page === 'reports') { if (id) viewReview(id); else viewReports(); }
    else if (page === 'master') viewMaster(id);
    else if (page === 'work') viewWork();
    else if (page === 'stock') viewStock(id);
    else if (page === 'rab') { if (id) viewRab(id, sub === 'edit'); else viewRabs(); }
    else viewInput(id);
  }

  // the sidebar is a drawer on small screens
  const navToggle = document.getElementById('navToggle');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }
  navToggle.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  document.getElementById('navBackdrop').addEventListener('click', () => setNav(false));
  document.querySelector('.nav').addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setNav(false);
    document.querySelectorAll('details.menu[open]').forEach((d) => { d.open = false; });
  });

  document.title = t('Simple Inventory');
  document.documentElement.lang = I18N.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });

  window.addEventListener('hashchange', route);
  // works offline once loaded (sw.js); not possible when opened as a file
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  Sync.onChange(syncStatus);
  Sync.onData = refresh;
  Sync.start().then(() => {
    // this device's data; a new device that syncs gets it from the server when someone signs in, one that does not
    // starts with the sample data (once its photos are saved)
    if (S.load() || Sync.enabled) { route(); Sync.ready(); } else loadSampleData().then(route);
  });
})();
