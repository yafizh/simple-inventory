/* export.js — writes one "export document" to Excel (.xlsx), PDF, PNG or CSV. No libraries:
   - xlsx: SpreadsheetML files in a small ZIP writer (stored, no compression); numbers and dates stay real values
   - pdf : minimal PDF 1.4 with the built-in Helvetica fonts, A4 landscape, header row repeated on every page
   - png : the same layout drawn on a canvas at 2x
   Document shape:
   { title, app, subtitle: [lines], summary: [{label, value, type, note}],
     sections: [{ title, note, sheet, empty, groups: [{label, span}], columns: [{label, type, max}], rows: [[value]], foot: [value] }] }
   Column types: text · date (ISO) · qty · sqty (signed, shows +) · amt · int. null = no value (shown as —). */
(function (g) {
  'use strict';
  const COL = { text: '#1d2430', muted: '#5d6878', faint: '#8a94a3', line: '#e3e7ec', strong: '#9aa4b2', head: '#f3f5f8', tile: '#f8f9fb' };
  // the logo (img/logo.svg) on a 32×32 grid: a rounded blue tile with a closed box, its faces in solid colours
  const LOGO = {
    tile: '#1f5fbf', r: 8,
    faces: [['#ffffff', [[16, 5.5], [25, 10.75], [16, 16], [7, 10.75]]],
      ['#c5d5ee', [[7, 10.75], [16, 16], [16, 26.5], [7, 21.25]]],
      ['#86a9dc', [[25, 10.75], [16, 16], [16, 26.5], [25, 21.25]]]],
    tape: [[20.5, 8.125], [11.5, 13.375]],
  };
  const isNum = (type) => type !== 'text' && type !== 'date';

  /** Display text for PDF/PNG, using the language's number and date format. */
  function show(v, type) {
    if (v === null || v === undefined || v === '') return type === 'text' || !type ? '' : '—';
    switch (type) {
      case 'qty': return g.fmtQty(v);
      case 'sqty': return (v > 0 ? '+' : '') + g.fmtQty(v);
      case 'amt': return g.fmtAmt(v);
      case 'int': return String(v);
      case 'date': return g.fmtDate(v);
      default: return String(v);
    }
  }

  // ===================================================================================  layout (PDF + PNG)
  function colWidths(sec, size, measure) {
    const pad = size * 0.6;
    const ws = sec.columns.map((c, j) => {
      let w = measure(c.label, size * 0.92, true);
      for (const r of sec.rows) w = Math.max(w, measure(show(r[j], c.type), size, false));
      if (sec.foot) w = Math.max(w, measure(show(sec.foot[j], c.type), size, true));
      if (c.type === 'text') w = Math.min(w, size * (c.max || 18));
      return w + pad * 2;
    });
    if (sec.groups) {
      let j = 0;
      for (const gr of sec.groups) {
        const span = ws.slice(j, j + gr.span).reduce((a, b) => a + b, 0);
        const need = measure(gr.label || '', size * 0.92, true) + pad * 2;
        if (need > span) ws[j + gr.span - 1] += need - span;
        j += gr.span;
      }
    }
    return ws;
  }
  function naturalWidth(doc, o) {
    let w = Math.min((doc.summary || []).length, 3) * o.fs * 16; // more tiles than fit wrap into rows
    for (const sec of doc.sections) w = Math.max(w, colWidths(sec, o.fs, o.measure).reduce((a, b) => a + b, 0));
    return w + 2 * o.margin;
  }

  /** Turns the document into drawing operations (text / line / rect) in top-left coordinates, split into pages. */
  function layout(doc, o) {
    const { measure, fs, lw } = o;
    const M = o.margin, W = o.width, H = o.height, avail = W - 2 * M;
    const pages = [];
    let ops, y;
    const newPage = () => { ops = []; pages.push(ops); y = M; };
    newPage();
    const room = (h) => { if (y + h > H - M && y > M + 1) { newPage(); return true; } return false; };
    const fit = (s, w, size, bold) => {
      if (measure(s, size, bold) <= w + 0.01) return s; // small tolerance for float rounding
      while (s.length > 1 && measure(s + '…', size, bold) > w) s = s.slice(0, -1);
      return s + '…';
    };
    const text = (x, base, s, size, opt = {}) => {
      s = String(s);
      if (!s) return;
      if (opt.w != null) s = fit(s, opt.w, size, opt.bold);
      const tw = measure(s, size, opt.bold);
      const lx = opt.align === 'right' ? x - tw : opt.align === 'center' ? x - tw / 2 : x;
      ops.push({ k: 'text', x: lx, y: base, s, size, bold: !!opt.bold, color: opt.color || COL.text });
    };
    const line = (x1, y1, x2, y2, color = COL.line, width = lw) => ops.push({ k: 'line', x1, y1, x2, y2, color, lw: width });
    const rect = (x, yy, w, h, fill, stroke) => ops.push({ k: 'rect', x, y: yy, w, h, fill, stroke, lw });

    // heading: the title, and on the right the logo with the app name
    text(M, y + fs * 1.9, doc.title, fs * 2, { bold: true });
    if (doc.app) {
      text(W - M, y + fs * 1.9, doc.app, fs, { align: 'right', color: COL.muted });
      const s = fs * 2.2; // centred on the name's lower-case letters
      ops.push({ k: 'logo', x: W - M - measure(doc.app, fs, false) - fs * 0.6 - s, y: y + fs * 1.9 - fs * 0.35 - s / 2, s });
    }
    y += fs * 2.7;
    for (const s of doc.subtitle || []) { text(M, y + fs * 1.1, s, fs * 1.05, { color: COL.muted }); y += fs * 1.6; }
    y += fs * 0.6;
    line(M, y, W - M, y, COL.strong);
    y += fs * 1.6;

    // summary tiles
    if (doc.summary && doc.summary.length) {
      const n = doc.summary.length, gap = fs, th = fs * 5.4;
      // a tile is at least as wide as its longest line; tiles that do not fit in one row wrap into rows of equal length
      const need = 2 * fs + Math.max(...doc.summary.map((s) => Math.max(measure(s.label, fs * 0.95), measure(show(s.value, s.type), fs * 1.5, true), measure(s.note || '', fs * 0.85))));
      const fits = Math.max(1, Math.min(n, Math.floor((avail + gap) / (need + gap))));
      const per = Math.ceil(n / Math.ceil(n / fits));
      const tw = Math.min((avail - gap * (per - 1)) / per, Math.max(need, fs * 20));
      doc.summary.forEach((s, i) => {
        if (i % per === 0) { if (i) y += th + gap; room(th); }
        const x = M + (i % per) * (tw + gap), inner = tw - 2 * fs;
        rect(x, y, tw, th, COL.tile, COL.line);
        text(x + fs, y + fs * 1.7, s.label, fs * 0.95, { color: COL.muted, w: inner });
        text(x + fs, y + fs * 3.5, show(s.value, s.type), fs * 1.5, { bold: true, w: inner });
        if (s.note) text(x + fs, y + fs * 4.75, s.note, fs * 0.85, { color: COL.faint, w: inner });
      });
      y += th + fs * 2.2;
    }

    // tables
    for (const sec of doc.sections) {
      const cols = sec.columns;
      let size = fs;
      let ws = colWidths(sec, size, measure);
      let total = ws.reduce((a, b) => a + b, 0);
      if (total > avail) { const k = avail / total; ws = ws.map((w) => w * k); size *= k; total = avail; } // shrink to fit the page
      else { let j = cols.findIndex((c) => c.grow); if (j < 0) j = cols.findIndex((c) => c.type === 'text'); if (j >= 0) { ws[j] += avail - total; total = avail; } }
      const pad = size * 0.6, rh = size * 2.1, right = M + total;
      const xs = [];
      ws.reduce((x, w) => { xs.push(x); return x + w; }, M);
      const cellX = (j) => (isNum(cols[j].type) ? xs[j] + ws[j] - pad : xs[j] + pad);
      const head = () => {
        if (sec.groups) {
          let j = 0;
          for (const gr of sec.groups) {
            if (gr.label) {
              const x1 = xs[j], x2 = xs[j + gr.span - 1] + ws[j + gr.span - 1];
              text((x1 + x2) / 2, y + rh * 0.64, gr.label, size * 0.92, { bold: true, color: COL.muted, align: 'center' });
              line(x1 + pad, y + rh - lw, x2 - pad, y + rh - lw);
            }
            j += gr.span;
          }
          y += rh;
        }
        rect(M, y, total, rh, COL.head);
        cols.forEach((c, j) => text(cellX(j), y + rh * 0.64, c.label, size * 0.92, { bold: true, color: COL.muted, align: isNum(c.type) ? 'right' : 'left', w: ws[j] - pad * 2 }));
        y += rh;
        line(M, y, right, y, COL.strong);
      };
      const row = (r, bold) => cols.forEach((c, j) => text(cellX(j), y + rh * 0.64, bold && r[j] == null ? '' : show(r[j], c.type), size, {
        bold, align: isNum(c.type) ? 'right' : 'left', w: ws[j] - pad * 2,
        color: r[j] == null && isNum(c.type) ? COL.faint : COL.text,
      }));

      room(fs * 3.8 + rh * (sec.groups ? 3 : 2)); // keep the title with the first rows
      if (sec.title) { text(M, y + fs * 1.3, sec.title, fs * 1.35, { bold: true }); y += fs * 2; }
      if (sec.note) { text(M, y + fs, sec.note, fs * 0.95, { color: COL.muted }); y += fs * 1.7; }
      y += fs * 0.3;
      head();
      if (!sec.rows.length) {
        text(M + total / 2, y + rh * 0.64, sec.empty || '—', size, { color: COL.faint, align: 'center' });
        y += rh;
        line(M, y, right, y);
      }
      for (const r of sec.rows) {
        if (room(rh)) head();
        row(r);
        y += rh;
        line(M, y, right, y);
      }
      if (sec.foot) {
        if (room(rh)) head();
        rect(M, y, total, rh, COL.head);
        line(M, y, right, y, COL.strong, lw * 1.5);
        row(sec.foot, true);
        y += rh;
      }
      y += fs * 2.4;
    }
    const height = y - fs * 2.4 + M;

    if (o.footer) {
      pages.forEach((p, i) => {
        ops = p;
        text(M, H - M * 0.5, o.footer, fs * 0.85, { color: COL.faint });
        text(W - M, H - M * 0.5, o.pageLabel(i + 1, pages.length), fs * 0.85, { color: COL.faint, align: 'right' });
      });
    }
    return { pages, height };
  }

  // ===================================================================================  PDF
  // Helvetica and Helvetica-Bold widths (1/1000 em) for characters 32..126, from the standard AFM files
  const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  // Unicode -> WinAnsi for the few characters outside Latin-1 that the app uses
  const WIN = { 0x2013: 0x96, 0x2014: 0x97, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x20AC: 0x80, 0x2212: 0x2D, 0x00A0: 0x20 };
  const WIDE = { 0x97: 1000, 0x85: 1000, 0x95: 350, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333 };
  function winAnsi(s) {
    let out = '';
    for (const ch of String(s)) {
      let c = ch.codePointAt(0);
      if (WIN[c] !== undefined) c = WIN[c];
      else if (c > 255 || (c >= 127 && c < 160) || (c < 32)) c = 63; // not in the built-in font: '?'
      out += String.fromCharCode(c);
    }
    return out;
  }
  function pdfMeasure(s, size, bold) {
    const tbl = bold ? HELVB : HELV;
    let w = 0;
    for (const ch of winAnsi(s)) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? tbl[c - 32] : WIDE[c] || 556; }
    return (w * size) / 1000;
  }
  const pdfStr = (s) => '(' + winAnsi(s).replace(/[\\()]/g, '\\$&') + ')';

  function toPdf(doc, opts = {}) {
    const W = 842, H = 595; // A4 landscape, points
    const L = layout(doc, { width: W, height: H, margin: 36, fs: 8, lw: 0.6, measure: pdfMeasure, footer: opts.footer || doc.title, pageLabel: opts.pageLabel || ((i, n) => i + ' / ' + n) });
    const n = (x) => String(Math.round(x * 100) / 100);
    const rgb = (hex) => [1, 3, 5].map((i) => n(parseInt(hex.substr(i, 2), 16) / 255)).join(' ');
    /** The logo as paths, in its own graphics state: the tile (corners as Bézier curves), the faces filled and
        outlined in the tile colour, and the tape line. op.x / op.y is its top left, op.s its size. */
    const logo = (op) => {
      const k = op.s / 32, pt = (x, y) => `${n(op.x + x * k)} ${n(H - op.y - y * k)}`;
      const r = LOGO.r, c = r * 0.4477; // control points at r × (1 − 0.5523) from the corner
      const tile = `${pt(r, 0)} m ${pt(32 - r, 0)} l ${pt(32 - c, 0)} ${pt(32, c)} ${pt(32, r)} c ${pt(32, 32 - r)} l ${pt(32, 32 - c)} ${pt(32 - c, 32)} ${pt(32 - r, 32)} c `
        + `${pt(r, 32)} l ${pt(c, 32)} ${pt(0, 32 - c)} ${pt(0, 32 - r)} c ${pt(0, r)} l ${pt(0, c)} ${pt(c, 0)} ${pt(r, 0)} c h`;
      const faces = LOGO.faces.map(([fill, pts]) => `${rgb(fill)} rg ${pts.map(([x, y], i) => `${pt(x, y)} ${i ? 'l' : 'm'}`).join(' ')} h B`).join(' ');
      return `q ${rgb(LOGO.tile)} rg ${tile} f ${rgb(LOGO.tile)} RG 1 j ${n(1.1 * k)} w ${faces} `
        + `1 J ${n(1.6 * k)} w ${pt(...LOGO.tape[0])} m ${pt(...LOGO.tape[1])} l S Q`;
    };
    const streams = L.pages.map((ops) => ops.map((op) => {
      if (op.k === 'text') return `BT /${op.bold ? 'F2' : 'F1'} ${n(op.size)} Tf ${rgb(op.color)} rg ${n(op.x)} ${n(H - op.y)} Td ${pdfStr(op.s)} Tj ET`;
      if (op.k === 'line') return `${rgb(op.color)} RG ${n(op.lw)} w ${n(op.x1)} ${n(H - op.y1)} m ${n(op.x2)} ${n(H - op.y2)} l S`;
      if (op.k === 'logo') return logo(op);
      const r = `${n(op.x)} ${n(H - op.y - op.h)} ${n(op.w)} ${n(op.h)} re`;
      return (op.fill ? `${rgb(op.fill)} rg ${r} f` : '') + (op.stroke ? ` ${rgb(op.stroke)} RG ${n(op.lw)} w ${r} S` : '');
    }).join('\n'));
    const d = new Date(), p2 = (x) => String(x).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const objs = [null,
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${streams.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] /Count ${streams.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      `<< /Title ${pdfStr(doc.title)} /Producer (Simple Inventory prototype) /CreationDate (D:${stamp}) >>`];
    streams.forEach((s) => {
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length + 1} 0 R >>`);
      objs.push(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
    });
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offs = [];
    for (let i = 1; i < objs.length; i++) { offs.push(out.length); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  // ===================================================================================  PNG
  const MAX_CANVAS = 32000;
  function toPng(doc) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const font = (size, bold) => `${bold ? 600 : 400} ${size}px ${FONT}`;
    const measure = (s, size, bold) => { ctx.font = font(size, bold); return ctx.measureText(s).width; };
    const base = { margin: 28, fs: 13, lw: 1, measure };
    const width = Math.ceil(Math.max(960, naturalWidth(doc, base)));
    const L = layout(doc, Object.assign({ width, height: Infinity }, base));
    const height = Math.ceil(L.height);
    const scale = height * 2 <= MAX_CANVAS && width * 2 <= MAX_CANVAS ? 2 : 1;
    if (height > MAX_CANVAS || width > MAX_CANVAS) return Promise.reject(new Error('too-large'));
    c.width = width * scale;
    c.height = height * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    for (const op of L.pages[0]) {
      if (op.k === 'text') { ctx.font = font(op.size, op.bold); ctx.fillStyle = op.color; ctx.fillText(op.s, op.x, op.y); }
      else if (op.k === 'line') { ctx.strokeStyle = op.color; ctx.lineWidth = op.lw; ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke(); }
      else if (op.k === 'logo') {
        ctx.save();
        ctx.translate(op.x, op.y);
        ctx.scale(op.s / 32, op.s / 32);
        ctx.fillStyle = LOGO.tile;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0, 0, 32, 32, LOGO.r); else ctx.rect(0, 0, 32, 32);
        ctx.fill();
        ctx.strokeStyle = LOGO.tile;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.1;
        for (const [fill, pts] of LOGO.faces) {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.stroke();
        }
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(...LOGO.tape[0]);
        ctx.lineTo(...LOGO.tape[1]);
        ctx.stroke();
        ctx.restore();
      } else {
        if (op.fill) { ctx.fillStyle = op.fill; ctx.fillRect(op.x, op.y, op.w, op.h); }
        if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw; ctx.strokeRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1); }
      }
    }
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
  }

  // ===================================================================================  XLSX
  // cell styles: [numFmtId, fontId, fillId, borderId, horizontal]
  const XF = {
    '': [0, 0, 0, 0], title: [0, 2, 0, 0], h2: [0, 1, 0, 0], muted: [0, 3, 0, 0], bold: [0, 1, 0, 0],
    head: [0, 1, 2, 1], headR: [0, 1, 2, 1, 'right'], group: [0, 1, 0, 1, 'center'],
    int: [3, 0, 0, 0], dec: [4, 0, 0, 0], qdec: [165, 0, 0, 0], date: [164, 0, 0, 0],
    foot: [0, 1, 2, 2], intB: [3, 1, 2, 2], decB: [4, 1, 2, 2], qdecB: [165, 1, 2, 2], dateB: [164, 1, 2, 2],
  };
  const XF_KEYS = Object.keys(XF);
  const st = (k) => XF_KEYS.indexOf(k);
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd-mmm-yyyy"/><numFmt numFmtId="165" formatCode="#,##0.0###"/></numFmts>'
    + '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5D6878"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F5F8"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>'
    + '<border><left/><right/><top/><bottom style="thin"><color rgb="FF9AA4B2"/></bottom><diagonal/></border>'
    + '<border><left/><right/><top style="thin"><color rgb="FF1D2430"/></top><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${XF_KEYS.length}">` + XF_KEYS.map((k) => {
      const [nf, f, fl, b, h] = XF[k];
      return `<xf numFmtId="${nf}" fontId="${f}" fillId="${fl}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${h ? ` applyAlignment="1"><alignment horizontal="${h}"/></xf>` : '/>'}`;
    }).join('') + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const xmlEsc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const colName = (j) => { let s = ''; for (j += 1; j > 0; j = Math.floor((j - 1) / 26)) s = String.fromCharCode(65 + ((j - 1) % 26)) + s; return s; };
  const excelDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

  function cellOf(v, type, bold) {
    if (v === null || v === undefined || v === '') return { v: '', s: st(bold ? 'foot' : '') };
    if (type === 'date') return { v: excelDate(v), n: true, s: st(bold ? 'dateB' : 'date') };
    if (isNum(type)) {
      const k = Number.isInteger(v) || type === 'int' ? 'int' : type === 'amt' ? 'dec' : 'qdec';
      return { v, n: true, s: st(bold ? k + 'B' : k) };
    }
    return { v, s: st(bold ? 'foot' : '') };
  }
  function heading(doc) {
    return [[{ v: doc.title, s: st('title') }], ...(doc.subtitle || []).map((s) => [{ v: s, s: st('muted') }]), []];
  }
  function summarySheet(doc, name) {
    const rows = heading(doc);
    for (const s of doc.summary) rows.push([{ v: s.label, s: st('bold') }, cellOf(s.value, s.type), { v: s.note || '', s: st('muted') }]);
    return { name, rows, merges: [], widths: [26, 18, 34] };
  }
  function tableSheet(doc, sec, name) {
    const rows = heading(doc), merges = [];
    if (sec.title) rows.push([{ v: sec.title, s: st('h2') }]);
    if (sec.note) rows.push([{ v: sec.note, s: st('muted') }]);
    if (sec.groups) {
      const r = [];
      let j = 0;
      for (const gr of sec.groups) {
        for (let k = 0; k < gr.span; k++) r.push({ v: k === 0 ? gr.label || '' : '', s: st(gr.label ? 'group' : '') });
        if (gr.span > 1 && gr.label) merges.push(`${colName(j)}${rows.length + 1}:${colName(j + gr.span - 1)}${rows.length + 1}`);
        j += gr.span;
      }
      rows.push(r);
    }
    rows.push(sec.columns.map((c) => ({ v: c.label, s: st(isNum(c.type) ? 'headR' : 'head') })));
    const freeze = rows.length;
    for (const r of sec.rows) rows.push(r.map((v, j) => cellOf(v, sec.columns[j].type)));
    if (sec.foot) rows.push(sec.foot.map((v, j) => cellOf(v, sec.columns[j].type, true)));
    const widths = sec.columns.map((c, j) => {
      let w = c.label.length;
      for (const r of sec.rows) w = Math.max(w, show(r[j], c.type).length);
      return Math.min(Math.max(w + 2, 8), 50);
    });
    return { name, rows, merges, widths, freeze };
  }
  function sheetXml(sh) {
    const pane = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
    const cols = '<cols>' + sh.widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    const data = sh.rows.map((r, i) => `<row r="${i + 1}">` + r.map((c, j) => {
      const a = colName(j) + (i + 1);
      if (c.n) return `<c r="${a}" s="${c.s}"><v>${c.v}</v></c>`;
      if (c.v === '') return c.s ? `<c r="${a}" s="${c.s}"/>` : '';
      return `<c r="${a}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + pane + '<sheetFormatPr defaultRowHeight="15"/>' + cols + `<sheetData>${data}</sheetData>` + merges + '</worksheet>';
  }
  function toXlsx(doc, opts = {}) {
    const used = new Set();
    const sheetName = (s) => {
      let base = String(s || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Sheet', name = base, i = 2;
      while (used.has(name.toLowerCase())) name = base.slice(0, 28) + ' ' + i++;
      used.add(name.toLowerCase());
      return name;
    };
    const sheets = [];
    if (doc.summary && doc.summary.length) sheets.push(summarySheet(doc, sheetName(opts.summaryName || 'Summary')));
    for (const sec of doc.sections) sheets.push(tableSheet(doc, sec, sheetName(sec.sheet || sec.title)));
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const files = [
      ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
      ['_rels/.rels', X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', X + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets>`
        + sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', STYLES],
      ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
    ];
    return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ZIP, stored (no compression) — enough for a valid .xlsx
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder();
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (const [name, text] of files) {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true);
      c.setUint32(42, offset, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      central.push(new Uint8Array(c.buffer), nb);
      offset += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
  }

  // ===================================================================================  CSV (one table)
  function toCsv(sec) {
    let gi = 0, left = 0, glabel = '';
    const header = sec.columns.map((c) => {
      if (sec.groups) {
        while (left === 0 && gi < sec.groups.length) { glabel = sec.groups[gi].label || ''; left = sec.groups[gi].span; gi++; }
        left--;
      }
      return glabel ? glabel + ' ' + c.label : c.label;
    });
    const rows = sec.rows.map((r) => r.map((v) => (v == null ? '' : v)));
    if (sec.foot) rows.push(sec.foot.map((v) => (v == null ? '' : v)));
    return new Blob([C.csv(header, rows)], { type: 'text/csv;charset=utf-8' });
  }

  g.X = { toXlsx, toPdf, toPng, toCsv, layout, pdfMeasure, winAnsi };
})(typeof window !== 'undefined' ? window : globalThis);
