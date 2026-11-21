/* sample-photos.js — the example photos of the sample data's work reports. They are drawings (SVG) of the work done,
   with a stamp like a timestamp camera: the time, the day and date, the RAB and the employee (in Indonesian, like the
   rest of the data). js/store.js says which work report gets which picture; js/app.js saves them with the other
   photos when the sample data is loaded. */
(function (g) {
  'use strict';
  const W = 1024, H = 768;
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');
  const FONT = 'font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"';

  // ---- settings: a wall with a tiled floor, or a wall with a wooden desk
  const room = (floor = 560) => `
    <rect width="${W}" height="${floor}" fill="url(#wall)"/>
    <rect y="${floor - 14}" width="${W}" height="14" fill="#cfc7bb"/>
    <rect y="${floor}" width="${W}" height="${H - floor}" fill="#d8d3cb"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${i * 160 - 120} ${H}L${i * 150 - 20} ${floor}" stroke="#c6c0b6" stroke-width="2"/>`).join('')}
    <path d="M0 ${floor + 60}H${W}M0 ${floor + 140}H${W}" stroke="#c6c0b6" stroke-width="2"/>`;
  const desk = (top = 500) => `
    <rect width="${W}" height="${top}" fill="url(#wall)"/>
    <rect y="${top}" width="${W}" height="${H - top}" fill="url(#wood)"/>
    <rect y="${top}" width="${W}" height="6" fill="#8a5a33" opacity=".5"/>`;
  const shadow = (cx, cy, rx, ry = 18) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".14"/>`;

  // ---- things
  /** A closed cardboard box: front face at x, y (w × h), its top and right side behind it, taped over the middle. */
  function box(x, y, w, h, mark) {
    const d = w * 0.22, e = d * 0.55;
    return `
      <polygon points="${pts([[x, y], [x + d, y - e], [x + w + d, y - e], [x + w, y]])}" fill="#e0b47c"/>
      <polygon points="${pts([[x + w, y], [x + w + d, y - e], [x + w + d, y + h - e], [x + w, y + h]])}" fill="#a87843"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9965c"/>
      <polygon points="${pts([[x + w / 2 - 11, y], [x + w / 2 - 11 + d, y - e], [x + w / 2 + 11 + d, y - e], [x + w / 2 + 11, y]])}" fill="#a3713b" opacity=".75"/>
      <rect x="${x + w / 2 - 11}" y="${y}" width="22" height="${h * 0.3}" fill="#a3713b" opacity=".75"/>
      ${mark ? `<text x="${x + w / 2}" y="${y + h * 0.68}" text-anchor="middle" ${FONT} font-size="${Math.round(w / 8)}" font-weight="700" fill="#3a2a1c" opacity=".75" transform="rotate(-4 ${x + w / 2} ${y + h * 0.68})">${esc(mark)}</text>` : ''}`;
  }
  /** A roll of brown packing tape lying on the floor. */
  const tapeRoll = (cx, cy) => `${shadow(cx, cy + 34, 70, 14)}
    <ellipse cx="${cx}" cy="${cy}" rx="64" ry="34" fill="#8e5d2c"/><ellipse cx="${cx}" cy="${cy - 8}" rx="64" ry="34" fill="#b07a3f"/>
    <ellipse cx="${cx}" cy="${cy - 8}" rx="30" ry="16" fill="#d8d3cb"/><ellipse cx="${cx}" cy="${cy - 8}" rx="30" ry="16" fill="none" stroke="#7a4f24" stroke-width="5"/>`;
  /** A steel filing cabinet with four drawers, wrapped in packing tape for the move. */
  function cabinet(x, y, w, h) {
    const dh = (h - 30) / 4;
    return `${shadow(x + w / 2, y + h + 4, w * 0.6)}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#9aa4af"/>
      <rect x="${x + w - 14}" y="${y}" width="14" height="${h}" rx="4" fill="#7f8994"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${x + 12}" y="${y + 12 + i * (dh + 2)}" width="${w - 38}" height="${dh - 6}" rx="4" fill="#aeb7c1" stroke="#8a949f" stroke-width="2"/>
        <rect x="${x + w / 2 - 34}" y="${y + 12 + i * (dh + 2) + dh / 2 - 12}" width="44" height="12" rx="4" fill="#5f6a76"/>
        <rect x="${x + w / 2 - 30}" y="${y + 22 + i * (dh + 2)}" width="36" height="20" rx="2" fill="#f4f1e8"/>`).join('')}
      <rect x="${x - 4}" y="${y + h * 0.3}" width="${w + 8}" height="26" fill="#a5733c" opacity=".85"/>
      <rect x="${x - 4}" y="${y + h * 0.7}" width="${w + 8}" height="26" fill="#a5733c" opacity=".85"/>
      <rect x="${x + w / 2 - 13}" y="${y - 4}" width="26" height="${h + 8}" fill="#a5733c" opacity=".85"/>`;
  }
  /** A plastic snap folder (map plastik) at an angle, with papers inside and a label on it. */
  function folder(cx, cy, angle, color, label) {
    return `<g transform="rotate(${angle} ${cx} ${cy})">
      <rect x="${cx - 230}" y="${cy - 150}" width="460" height="310" rx="10" fill="#000" opacity=".12" transform="translate(8 10)"/>
      <rect x="${cx - 222}" y="${cy - 142}" width="440" height="290" fill="#fbfbf8"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${cx - 190}" y="${cy - 100 + i * 34}" width="${i % 3 === 2 ? 250 : 370}" height="10" rx="5" fill="#c9ced6"/>`).join('')}
      <rect x="${cx - 230}" y="${cy - 150}" width="460" height="310" rx="10" fill="${color}" opacity=".55"/>
      <rect x="${cx - 230}" y="${cy - 150}" width="460" height="56" rx="10" fill="${color}" opacity=".5"/>
      <circle cx="${cx}" cy="${cy - 122}" r="13" fill="#fff" opacity=".85"/><circle cx="${cx}" cy="${cy - 122}" r="6" fill="${color}"/>
      ${label ? `<rect x="${cx - 110}" y="${cy - 40}" width="220" height="74" rx="6" fill="#fff"/>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" ${FONT} font-size="36" font-weight="700" fill="#2b3442">${esc(label)}</text>` : ''}
    </g>`;
  }
  /** A blue ballpoint pen lying on the desk. */
  const pen = (x, y, angle) => `<g transform="rotate(${angle} ${x} ${y})">
    <rect x="${x + 6}" y="${y + 8}" width="300" height="22" rx="11" fill="#000" opacity=".12"/>
    <rect x="${x}" y="${y}" width="300" height="22" rx="11" fill="#e9eef6"/>
    <rect x="${x + 70}" y="${y + 8}" width="200" height="6" rx="3" fill="#2f5fd0" opacity=".7"/>
    <polygon points="${pts([[x + 300, y + 3], [x + 330, y + 11], [x + 300, y + 19]])}" fill="#c9d2de"/>
    <rect x="${x - 10}" y="${y - 2}" width="84" height="26" rx="10" fill="#1f4fa3"/>
    <rect x="${x + 6}" y="${y - 10}" width="64" height="8" rx="4" fill="#173d80"/>
  </g>`;
  /** An office printer; paper (with its title) comes out of the front. */
  function printer(x, y, w, title) {
    const h = w * 0.42;
    return `${shadow(x + w / 2, y + h + 6, w * 0.55, 20)}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#dde1e6"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h * 0.34}" rx="18" fill="#c6ccd3"/>
      <rect x="${x + w * 0.12}" y="${y - 40}" width="${w * 0.76}" height="56" rx="6" fill="#fbfbf8" transform="skewX(-8)" transform-origin="${x + w / 2} ${y}"/>
      <rect x="${x + w - 120}" y="${y + h * 0.12}" width="80" height="18" rx="6" fill="#56606c"/>
      <circle cx="${x + w - 52}" cy="${y + h * 0.12 + 9}" r="5" fill="#3ddc84"/>
      <rect x="${x + w * 0.1}" y="${y + h * 0.62}" width="${w * 0.8}" height="16" rx="8" fill="#9aa2ad"/>
      <g transform="translate(${x + w * 0.2} ${y + h * 0.62 + 6})">
        <rect width="${w * 0.6}" height="150" fill="#fdfdfb"/><rect width="${w * 0.6}" height="150" fill="none" stroke="#e1e4e8" stroke-width="2"/>
        <text x="${w * 0.3}" y="44" text-anchor="middle" ${FONT} font-size="26" font-weight="700" fill="#2b3442">${esc(title || '')}</text>
        ${[0, 1, 2].map((i) => `<rect x="30" y="${68 + i * 24}" width="${w * 0.6 - (i === 2 ? 140 : 60)}" height="9" rx="4" fill="#c9ced6"/>`).join('')}
      </g>`;
  }
  /** A bottle of black printer ink, its label saying what it is. */
  const ink = (x, y, open) => `${shadow(x + 55, y + 232, 70, 14)}
    <rect x="${x}" y="${y + 40}" width="110" height="190" rx="18" fill="#1d1f24"/>
    <rect x="${x + 6}" y="${y + 52}" width="14" height="160" rx="7" fill="#fff" opacity=".12"/>
    <rect x="${x + 14}" y="${y + 100}" width="82" height="78" rx="6" fill="#f2f2f0"/>
    <text x="${x + 55}" y="${y + 135}" text-anchor="middle" ${FONT} font-size="20" font-weight="800" fill="#1d1f24">TINTA</text>
    <text x="${x + 55}" y="${y + 162}" text-anchor="middle" ${FONT} font-size="17" font-weight="700" fill="#1d1f24">HITAM</text>
    ${open ? `<rect x="${x + 38}" y="${y + 14}" width="34" height="30" rx="4" fill="#3a3d44"/>`
    : `<rect x="${x + 22}" y="${y}" width="66" height="46" rx="8" fill="#2b2e35"/>`}`;
  /** A steel shelf with binders and boxes, and printed labels on the front of each shelf. */
  function shelf(x, y, w, h) {
    const lv = [0, 1, 2], sh = h / 3, colors = ['#3f6fb5', '#2f8f6b', '#c4513f', '#d9a42c', '#6b5fb0'];
    return `${shadow(x + w / 2, y + h + 8, w * 0.55, 18)}
      <rect x="${x}" y="${y}" width="16" height="${h + 10}" fill="#76808c"/><rect x="${x + w - 16}" y="${y}" width="16" height="${h + 10}" fill="#76808c"/>
      ${lv.map((i) => {
        const sy = y + (i + 1) * sh;
        const items = [0, 1, 2, 3, 4, 5, 6].map((j) => {
          const bw = 52 + (j * 13) % 30, bx = x + 30 + j * ((w - 60) / 7), bh = sh - 40 - (j * 7 + i * 11) % 30;
          return `<rect x="${bx}" y="${sy - bh}" width="${bw}" height="${bh}" rx="3" fill="${colors[(i * 3 + j) % 5]}"/>
            <rect x="${bx + bw / 2 - 12}" y="${sy - bh + 16}" width="24" height="34" rx="2" fill="#fff" opacity=".85"/>`;
        }).join('');
        return `${items}<rect x="${x}" y="${sy}" width="${w}" height="20" fill="#a9b2bc"/>
          ${[0, 1, 2].map((k) => `<rect x="${x + 60 + k * (w - 120) / 3}" y="${sy + 2}" width="104" height="30" rx="2" fill="#fff" stroke="#cfd5dc"/>
            <text x="${x + 112 + k * (w - 120) / 3}" y="${sy + 24}" text-anchor="middle" ${FONT} font-size="19" font-weight="700" fill="#2b3442">${'ABC'[i]}-0${k + 1}</text>`).join('')}`;
      }).join('')}`;
  }

  // ---- the scenes, one per kind of work. o: { label } — what is written on the folder or paper
  const SCENES = {
    boxes: () => room(560) + shadow(512, 600, 380, 26)
      + box(230, 450, 200, 150) + box(440, 450, 200, 150, 'CABANG') + box(650, 450, 200, 150)
      + box(335, 300, 200, 150) + box(545, 300, 200, 150) + box(440, 150, 200, 150) + tapeRoll(900, 640),
    cabinets: () => room(600) + cabinet(170, 240, 200, 360) + cabinet(410, 240, 200, 360) + cabinet(650, 240, 200, 360),
    folders: (o) => desk(260) + folder(520, 470, -9, '#3f7fd6') + folder(500, 480, 4, '#2f9b6f') + folder(512, 490, -2, '#e2a72e', o.label),
    pens: () => desk(330) + `<g transform="translate(160 210)">${box(0, 120, 380, 230, 'PULPEN')}</g>`
      + pen(600, 470, -14) + pen(620, 520, -10) + pen(590, 575, -6) + pen(640, 630, -3),
    print: (o) => desk(470) + printer(232, 300, 560, o.label),
    ink: () => desk(470) + printer(110, 250, 460, '') + ink(640, 360, false) + ink(800, 380, true),
    labels: () => room(600) + shelf(180, 60, 660, 450),
  };

  /** The time stamp of a timestamp camera, at the bottom: time | day and date, then the RAB and the employee. */
  function stamp(p) {
    const [y, m, d] = String(p.date).split('-').map(Number);
    const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `<rect y="${H - 250}" width="${W}" height="250" fill="url(#fade)"/>
      <g ${FONT} fill="#fff">
        <text x="40" y="${H - 118}" font-size="68" font-weight="700" textLength="190" lengthAdjust="spacingAndGlyphs">${esc(p.time)}</text>
        <rect x="252" y="${H - 172}" width="4" height="58" fill="#fff" opacity=".9"/>
        <text x="274" y="${H - 148}" font-size="28" font-weight="600">${esc(day)}</text>
        <text x="274" y="${H - 118}" font-size="28">${esc(`${d} ${MONTHS[m - 1]} ${y}`)}</text>
        <text x="40" y="${H - 70}" font-size="28" font-weight="600">${esc(p.place)}</text>
        <text x="40" y="${H - 32}" font-size="26" opacity=".85">${esc(p.who)}</text>
      </g>`;
  }
  /** p: { scene, label, date (YYYY-MM-DD), time (HH:MM), place, who } → the picture as SVG text. */
  function svg(p) {
    const draw = SCENES[p.scene] || SCENES.boxes;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs>
        <linearGradient id="wall" x2="0" y2="1"><stop offset="0" stop-color="#eee9e1"/><stop offset="1" stop-color="#e0d9ce"/></linearGradient>
        <linearGradient id="wood" x2="0" y2="1"><stop offset="0" stop-color="#b9865a"/><stop offset="1" stop-color="#9a6a42"/></linearGradient>
        <linearGradient id="fade" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>
        <radialGradient id="vignette" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
      </defs>
      ${draw(p)}
      <rect width="${W}" height="${H}" fill="url(#vignette)"/>
      ${stamp(p)}
    </svg>`;
  }

  g.SamplePhotos = { svg, blob: (p) => new Blob([svg(p)], { type: 'image/svg+xml' }), scenes: Object.keys(SCENES) };
})(typeof window !== 'undefined' ? window : globalThis);
