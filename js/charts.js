/* charts.js — small charts for the report, built from plain HTML and SVG (no library).
   Everything is positioned in %, so a chart follows the width of its container without being redrawn.
   Names (items, series) are always written with textContent, never as HTML.
   - Charts.time(el, o)  : values over time, as a line with a soft fill ('area') or as columns ('columns')
   - Charts.hbars(el, o) : one or two horizontal bars per named row (ranked lists)
   Colours are CSS values such as 'var(--series-1)', see css/app.css. */
(function (g) {
  'use strict';
  const h = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
  const svg = (tag, attrs) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

  /** Round axis from min to max with about n steps: { lo, hi, ticks, pos(v) → 0..100 }. */
  function scale(min, max, n = 4) {
    if (!(max > min)) max = min + 1;
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const a = Math.floor(min / step + 1e-9), b = Math.ceil(max / step - 1e-9);
    const ticks = [];
    for (let i = a; i <= b; i++) ticks.push(Number((i * step).toPrecision(12)));
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    return { lo, hi, ticks, pos: (v) => ((v - lo) / (hi - lo)) * 100 };
  }

  function legend(series) {
    const box = h('div', 'ch-legend');
    for (const s of series) {
      const item = h('span', 'ch-legend-item');
      const sw = h('span', 'ch-swatch');
      sw.style.background = s.color;
      item.append(sw, h('span', '', s.name));
      box.appendChild(item);
    }
    return box;
  }

  /** One tooltip per chart: a title and a row per series (value first, then the name). x, y are relative to root. */
  function tooltip(root) {
    const box = h('div', 'ch-tip');
    box.hidden = true;
    root.appendChild(box);
    return {
      show(title, rows, x, y) {
        box.textContent = '';
        box.appendChild(h('div', 'ch-tip-title', title));
        for (const r of rows) {
          const row = h('div', 'ch-tip-row'), key = h('span', 'ch-key');
          key.style.background = r.color;
          row.append(key, h('strong', '', r.value), h('span', 'ch-tip-name', r.name));
          box.appendChild(row);
        }
        box.hidden = false;
        const w = box.offsetWidth, ht = box.offsetHeight, W = root.clientWidth;
        let left = x + 12;
        if (left + w > W) left = x - 12 - w;
        box.style.left = Math.max(0, Math.min(left, W - w)) + 'px';
        box.style.top = (y - ht - 10 < 0 ? y + 16 : y - ht - 10) + 'px';
      },
      hide() { box.hidden = true; },
    };
  }

  /** The same figures as a table, folded away under the chart. */
  function tableTwin(label, head, rows) {
    const d = h('details', 'ch-table');
    d.appendChild(h('summary', '', label));
    const table = h('table', 'tbl'), thead = h('thead'), tb = h('tbody'), tr = h('tr');
    head.forEach((x, i) => tr.appendChild(h('th', i ? 'num' : '', x)));
    thead.appendChild(tr);
    for (const r of rows) {
      const row = h('tr');
      r.forEach((x, i) => row.appendChild(h('td', i ? 'num' : 'nowrap', x)));
      tb.appendChild(row);
    }
    table.append(thead, tb);
    const wrap = h('div', 'tbl-wrap');
    wrap.appendChild(table);
    d.appendChild(wrap);
    return d;
  }

  /** o: { type: 'area' | 'columns', points: [{ label, tick }], series: [{ name, color, values }],
          fmt(v) for exact values, axisFmt(max) → fmt(v) for the axis, label, keysHint, table: { label, first } } */
  function time(el, o) {
    const N = o.points.length, S = o.series;
    const sc = scale(0, Math.max(0, ...S.flatMap((s) => s.values)));
    const af = o.axisFmt(sc.hi);
    const columns = o.type === 'columns';
    // x position of point i in %: columns sit in the middle of their band, line points run edge to edge
    const xAt = (i) => (columns ? ((i + 0.5) / N) * 100 : N === 1 ? 50 : (i / (N - 1)) * 100);

    const root = h('div', 'ch');
    if (S.length > 1) root.appendChild(legend(S));
    const body = h('div', 'ch-body'), yAxis = h('div', 'ch-y'), plot = h('div', 'ch-plot'), xAxis = h('div', 'ch-x');
    yAxis.style.width = Math.max(...sc.ticks.map((v) => af(v).length)) + 1 + 'ch';
    for (const v of sc.ticks) {
      const lab = h('span', '', af(v));
      lab.style.bottom = sc.pos(v) + '%';
      yAxis.appendChild(lab);
      const line = h('div', 'ch-grid' + (v === 0 ? ' base' : ''));
      line.style.bottom = sc.pos(v) + '%';
      plot.appendChild(line);
    }

    const active = h('div', columns ? 'ch-band' : 'ch-cross');
    active.hidden = true;
    plot.appendChild(active);
    const dots = [];
    if (columns) {
      active.style.width = 100 / N + '%';
      o.points.forEach((p, i) => {
        const group = h('div', 'ch-cols');
        group.style.left = (i / N) * 100 + '%';
        group.style.width = 100 / N + '%';
        for (const s of S) {
          const bar = h('div', 'ch-col');
          bar.style.height = sc.pos(s.values[i]) + '%';
          bar.style.background = s.color;
          group.appendChild(bar);
        }
        plot.appendChild(group);
      });
    } else {
      const pic = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ch-svg', 'aria-hidden': 'true' });
      for (const s of S) {
        const pts = s.values.map((v, i) => `${xAt(i).toFixed(3)} ${(100 - sc.pos(v)).toFixed(3)}`);
        if (N > 1) {
          const fill = svg('path', { d: `M${pts.join('L')}L100 100L0 100Z`, class: 'ch-area' });
          fill.style.fill = s.color;
          const line = svg('path', { d: 'M' + pts.join('L'), class: 'ch-line' });
          line.style.stroke = s.color;
          pic.append(fill, line);
        }
        const dot = h('div', 'ch-dot');
        dot.style.background = s.color;
        dot.hidden = N > 1; // a single point has no line, so its dot is always shown
        dots.push(dot);
      }
      plot.append(pic, ...dots);
    }

    const every = Math.ceil(N / (o.maxTicks || 6));
    o.points.forEach((p, i) => {
      if (i % every) return;
      const lab = h('span', (i / every) % 2 ? 'alt' : '', p.tick); // every second label is dropped on narrow screens
      lab.style.left = xAt(i) + '%';
      xAxis.appendChild(lab);
    });

    // hover and keyboard: the pointer only has to be near a date, not on a mark
    const tip = tooltip(root);
    let cur = -1;
    function show(i, y) {
      cur = i;
      active.hidden = false;
      active.style.left = (columns ? (i / N) * 100 : xAt(i)) + '%';
      dots.forEach((dot, k) => {
        dot.hidden = false;
        dot.style.left = xAt(i) + '%';
        dot.style.bottom = sc.pos(S[k].values[i]) + '%';
      });
      const x = plot.offsetLeft + (xAt(i) / 100) * plot.clientWidth;
      tip.show(o.points[i].label, S.map((s) => ({ color: s.color, value: o.fmt(s.values[i]), name: s.name })), x, y == null ? plot.offsetTop + 24 : y);
    }
    function hide() {
      cur = -1;
      active.hidden = true;
      if (N > 1) dots.forEach((dot) => { dot.hidden = true; });
      tip.hide();
    }
    plot.addEventListener('pointermove', (e) => {
      const r = plot.getBoundingClientRect(), f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const i = columns ? Math.min(N - 1, Math.floor(f * N)) : Math.round(f * (N - 1));
      show(i, e.clientY - root.getBoundingClientRect().top);
    });
    plot.addEventListener('pointerleave', hide);
    plot.tabIndex = 0;
    plot.setAttribute('role', 'img');
    plot.setAttribute('aria-label', o.label + '. ' + o.keysHint);
    plot.addEventListener('focus', () => { if (plot.matches(':focus-visible')) show(N - 1); });
    plot.addEventListener('blur', hide);
    plot.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      show(Math.min(N - 1, Math.max(0, (cur < 0 ? N - 1 : cur) + step)));
    });

    body.append(yAxis, plot, h('div'), xAxis);
    root.appendChild(body);
    root.appendChild(tableTwin(o.table.label, [o.table.first].concat(S.map((s) => s.name)), o.points.map((p, i) => [p.label].concat(S.map((s) => o.fmt(s.values[i]))))));
    el.replaceChildren(root);
  }

  /** o: { rows: [{ label, values: [one per series], other }], series: [{ name, color }], fmt(v), tipFmt(v), axisFmt(max) → fmt(v) }
      With tipFmt every bar gets its value at the tip and there is no axis; otherwise a value axis is drawn below. */
  function hbars(el, o) {
    const S = o.series, vals = o.rows.flatMap((r) => r.values);
    const sc = scale(Math.min(0, ...vals), Math.max(0, ...vals), 3);
    const barH = S.length > 1 ? 10 : 14, rowH = S.length * barH + (S.length - 1) * 2 + 16;
    const root = h('div', 'ch');
    if (S.length > 1) root.appendChild(legend(S));
    const body = h('div', 'hb'), names = h('div', 'hb-names'), plot = h('div', 'hb-plot'), inner = h('div', 'hb-inner');
    plot.style.height = o.rows.length * rowH + 'px';
    if (o.tipFmt) inner.style.right = Math.max(...vals.map((v) => o.tipFmt(v).length)) + 2 + 'ch'; // room for the value at the tip
    const af = o.tipFmt ? null : o.axisFmt(Math.max(Math.abs(sc.lo), sc.hi));
    const xAxis = h('div', 'ch-x');
    for (const v of sc.ticks) {
      if (!af && v !== 0) continue;
      const line = h('div', 'hb-grid' + (v === 0 ? ' base' : ''));
      line.style.left = sc.pos(v) + '%';
      inner.appendChild(line);
      if (af) { const lab = h('span', '', af(v)); lab.style.left = sc.pos(v) + '%'; xAxis.appendChild(lab); }
    }
    const tip = tooltip(root), zero = sc.pos(0);
    o.rows.forEach((r, i) => {
      const name = h('div', 'hb-name', r.label);
      name.title = r.label;
      name.style.height = name.style.lineHeight = rowH + 'px';
      names.appendChild(name);
      const band = h('div', 'hb-band' + (r.other ? ' other' : ''));
      band.style.top = i * rowH + 'px';
      band.style.height = rowH + 'px';
      r.values.forEach((v, k) => {
        const bar = h('div', 'hb-bar' + (v < 0 ? ' neg' : ''));
        const x = sc.pos(v), top = 8 + k * (barH + 2);
        bar.style.cssText = `top:${top}px;height:${barH}px;left:${Math.min(x, zero)}%;width:${Math.abs(x - zero)}%`;
        bar.style.background = S[k].color;
        band.appendChild(bar);
        if (o.tipFmt) {
          const lab = h('span', 'hb-tip', o.tipFmt(v));
          lab.style.cssText = `top:${top}px;line-height:${barH}px;left:${x}%`;
          band.appendChild(lab);
        }
      });
      const rows = () => S.map((s, k) => ({ color: s.color, value: o.fmt(r.values[k]), name: s.name }));
      band.addEventListener('pointermove', (e) => { const b = root.getBoundingClientRect(); tip.show(r.label, rows(), e.clientX - b.left, e.clientY - b.top); });
      band.addEventListener('pointerleave', tip.hide);
      band.tabIndex = 0;
      band.setAttribute('role', 'img');
      band.setAttribute('aria-label', r.label + ': ' + S.map((s, k) => s.name + ' ' + o.fmt(r.values[k])).join(', '));
      band.addEventListener('focus', () => { if (band.matches(':focus-visible')) tip.show(r.label, rows(), plot.offsetLeft + 24, plot.offsetTop + i * rowH); });
      band.addEventListener('blur', tip.hide);
      inner.appendChild(band);
    });
    plot.appendChild(inner);
    body.append(names, plot);
    if (af) { const pad = h('div', 'hb-axis'); pad.appendChild(xAxis); body.append(h('div'), pad); }
    root.appendChild(body);
    el.replaceChildren(root);
  }

  g.Charts = { scale, time, hbars };
})(typeof window !== 'undefined' ? window : globalThis);
