// Vintage SVG playing cards. Card codes: rank + suit, e.g. "AS", "TD" (T = 10), "QH".
// Shared gradients, textures and symbols live in one hidden <svg> injected once,
// so each card stays light. Paper and ink-wear textures are painted once on a canvas.

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const RANK_LABEL = { T: '10' };
const RED = new Set(['H', 'D']);
const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANK_NAME = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King', T: '10' };

export const rankOf = (code) => code[0];
export const suitOf = (code) => code[1];
export const cardName = (code) =>
  `${RANK_NAME[rankOf(code)] || rankOf(code)} of ${SUIT_NAME[suitOf(code)]}`;

// Old printing-house inks
const INK = {
  red: '#A92A1E',
  black: '#1F1B17',
  gold: '#D3A13A',
  blue: '#25427A',
  green: '#3E5F35',
  skin: '#F1DDBA',
  cream: '#F4EBD6',
  line: '#1F1B17',
};

const SUIT_PATHS = {
  H: '<path d="M50 90C21 67 4 50 4 31 4 15 16 5 29 5c10 0 17 6 21 14 4-8 11-14 21-14 13 0 25 10 25 26 0 19-17 36-46 59z"/>',
  D: '<path d="M50 3c10 18 22 34 39 47C72 63 60 79 50 97 40 79 28 63 11 50 28 37 40 21 50 3z"/>',
  S: '<path d="M50 5c12 20 44 34 44 57 0 14-11 22-23 22-9 0-16-5-19-11 1 9 6 17 14 22H34c8-5 13-13 14-22-3 6-10 11-19 11C17 84 6 76 6 62 6 39 38 25 50 5z"/>',
  C: '<circle cx="50" cy="28" r="19"/><circle cx="28" cy="57" r="19"/><circle cx="72" cy="57" r="19"/><path d="M42 40h16v20H42z"/><path d="M46 58c0 16-4 29-14 37h36c-10-8-14-21-14-37z"/>',
};

function rosette(cx, cy, count, rx, ry, stroke, width, opacity) {
  let s = `<g fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}">`;
  for (let i = 0; i < count; i++) {
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${(180 / count) * i} ${cx} ${cy})"/>`;
  }
  return s + '</g>';
}

function petals(cx, cy, count, r, len, w, fill, opacity) {
  let s = `<g fill="${fill}" opacity="${opacity}">`;
  for (let i = 0; i < count; i++) {
    s += `<path transform="rotate(${(360 / count) * i} ${cx} ${cy})" d="M${cx} ${cy - r}c${w} ${-len * 0.45} ${w * 0.4} ${-len} 0 ${-len}c${-w * 0.4} 0 ${-w} ${len * 0.55} 0 ${len}z"/>`;
  }
  return s + '</g>';
}

// ---------- textures (painted once) ----------
function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paperTexture() {
  const W = 800, H = 1120;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rand(7);
  g.fillStyle = '#EEE3C8';
  g.fillRect(0, 0, W, H);
  // blotchy age stains
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 220;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.03 + r() * 0.07;
    grd.addColorStop(0, `rgba(150,105,45,${a})`);
    grd.addColorStop(1, 'rgba(150,105,45,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // light patches
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = r() * H, rad = 50 + r() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,250,235,.10)');
    grd.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // paper fibres
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, len = 4 + r() * 18, ang = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? `rgba(110,80,40,${0.05 + r() * 0.08})` : `rgba(255,252,240,${0.08 + r() * 0.1})`;
    g.lineWidth = 0.5 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // grain
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  g.putImageData(img, 0, 0);
  // foxing spots
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(130,80,30,${0.06 + r() * 0.12})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 0.8 + r() * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL('image/jpeg', 0.82);
}

function wearTexture() {
  const W = 500, H = 700;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rand(42);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  // tiny ink dropouts where the press missed
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.6})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 0.3 + r() * 1.1, 0, Math.PI * 2);
    g.fill();
  }
  // faint scratches
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H, len = 10 + r() * 50, ang = r() * Math.PI;
    g.strokeStyle = `rgba(0,0,0,${0.15 + r() * 0.3})`;
    g.lineWidth = 0.4 + r() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  return c.toDataURL('image/png');
}

const DEFS = (paper, wear) => `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<defs>
  <image id="pc-paper-img" href="${paper}" width="500" height="700" preserveAspectRatio="none"/>
  <clipPath id="pc-clip" clipPathUnits="userSpaceOnUse"><rect width="250" height="350" rx="16"/></clipPath>
  <clipPath id="pc-half-clip" clipPathUnits="userSpaceOnUse"><rect x="54" y="44" width="142" height="131"/></clipPath>
  <clipPath id="pc-court-clip" clipPathUnits="userSpaceOnUse"><rect x="54" y="44" width="142" height="262"/></clipPath>
  <mask id="pc-wear" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="250" height="350">
    <image href="${wear}" width="250" height="350" preserveAspectRatio="none"/>
  </mask>
  <radialGradient id="pc-age" cx=".5" cy=".5" r=".75">
    <stop offset=".55" stop-color="#8A5A20" stop-opacity="0"/>
    <stop offset=".9" stop-color="#8A5A20" stop-opacity=".16"/>
    <stop offset="1" stop-color="#5E3A10" stop-opacity=".38"/>
  </radialGradient>
  <linearGradient id="pc-gilt" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#E9C46A"/><stop offset=".45" stop-color="#C08E2E"/><stop offset=".7" stop-color="#9A6E1F"/><stop offset="1" stop-color="#D9B15A"/>
  </linearGradient>
  <pattern id="pc-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <path d="M0 0V4" stroke="${INK.line}" stroke-width=".7" opacity=".55"/>
  </pattern>
  <pattern id="pc-grid" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <path d="M0 0H5M0 0V5" stroke="${INK.line}" stroke-width=".8"/>
  </pattern>
  <pattern id="pc-ermine" width="12" height="12" patternUnits="userSpaceOnUse">
    <rect width="12" height="12" fill="${INK.cream}"/>
    <path d="M6 3l-1.6 4h3.2zM6 7v3" fill="${INK.line}" stroke="${INK.line}" stroke-width=".8"/>
  </pattern>
  <pattern id="pc-back-lattice" width="12" height="12" patternUnits="userSpaceOnUse">
    <path d="M6 0L12 6 6 12 0 6z" fill="none" stroke="#EAD9B4" stroke-width=".7" opacity=".55"/>
    <circle cx="6" cy="6" r="1.2" fill="#EAD9B4" opacity=".6"/>
  </pattern>
  ${Object.entries(SUIT_PATHS).map(([k, p]) => `<symbol id="pc-suit-${k}" viewBox="0 0 100 100">${p}</symbol>`).join('')}
  <symbol id="pc-back" viewBox="0 0 250 350">
    <g clip-path="url(#pc-clip)">
      <use href="#pc-paper-img" x="-120" y="-200"/>
      <rect x="11" y="11" width="228" height="328" rx="8" fill="#6A1B16"/>
      <rect x="11" y="11" width="228" height="328" rx="8" fill="url(#pc-back-lattice)"/>
      <g mask="url(#pc-wear)" fill="none">
        <rect x="18" y="18" width="214" height="314" rx="5" stroke="#EAD9B4" stroke-width="1.6"/>
        <rect x="23" y="23" width="204" height="304" rx="3" stroke="#EAD9B4" stroke-width=".7"/>
        <ellipse cx="125" cy="175" rx="90" ry="120" fill="#6A1B16" stroke="#EAD9B4" stroke-width="1.6"/>
        <ellipse cx="125" cy="175" rx="84" ry="114" stroke="#D3A13A" stroke-width=".8" stroke-dasharray="2 3"/>
        ${rosette(125, 175, 32, 70, 22, '#EAD9B4', 0.8, 0.6)}
        ${rosette(125, 175, 20, 40, 12, '#D3A13A', 0.8, 0.85)}
        ${petals(125, 175, 12, 20, 20, 8, '#D3A13A', 0.95)}
        <circle cx="125" cy="175" r="19" fill="#4A100D" stroke="#EAD9B4" stroke-width="1.6"/>
        <use href="#pc-suit-S" x="114" y="164" width="22" height="22" fill="#EAD9B4"/>
        ${[[125, 46, 0], [125, 304, 180]].map(([x, y, a]) =>
          `<path transform="rotate(${a} ${x} ${y})" d="M${x - 26} ${y}q13-14 26-2q13-12 26 2q-13 8-26 2q-13 6-26-2z" fill="#D3A13A"/>`).join('')}
      </g>
      <rect width="250" height="350" fill="url(#pc-age)"/>
    </g>
  </symbol>
</defs>
</svg>`;

export function installCardDefs() {
  if (document.getElementById('pc-back')) return;
  document.body.insertAdjacentHTML('afterbegin', DEFS(paperTexture(), wearTexture()));
}

// ---------- number cards ----------
const COL = { L: 80, C: 125, R: 170 };
const PIPS = {
  2: [['C', 72], ['C', 278]],
  3: [['C', 72], ['C', 175], ['C', 278]],
  4: [['L', 72], ['R', 72], ['L', 278], ['R', 278]],
  5: [['L', 72], ['R', 72], ['C', 175], ['L', 278], ['R', 278]],
  6: [['L', 72], ['R', 72], ['L', 175], ['R', 175], ['L', 278], ['R', 278]],
  7: [['L', 72], ['R', 72], ['C', 123], ['L', 175], ['R', 175], ['L', 278], ['R', 278]],
  8: [['L', 72], ['R', 72], ['C', 123], ['L', 175], ['R', 175], ['C', 227], ['L', 278], ['R', 278]],
  9: [['L', 72], ['R', 72], ['L', 140], ['R', 140], ['C', 175], ['L', 210], ['R', 210], ['L', 278], ['R', 278]],
  10: [['L', 72], ['R', 72], ['C', 106], ['L', 140], ['R', 140], ['L', 210], ['R', 210], ['C', 244], ['L', 278], ['R', 278]],
};

const suitUse = (suit, x, y, size, fill, flip = false) =>
  `<use href="#pc-suit-${suit}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="${fill}"${flip ? ` transform="rotate(180 ${x} ${y})"` : ''}/>`;

function aceCenter(suit, ink) {
  const big = suit === 'S' ? 112 : 92;
  return `
    <ellipse cx="125" cy="175" rx="78" ry="96" fill="none" stroke="${INK.line}" stroke-width="1.2" opacity=".75"/>
    <ellipse cx="125" cy="175" rx="73" ry="91" fill="none" stroke="${INK.line}" stroke-width=".5" stroke-dasharray="1.5 2.5" opacity=".7"/>
    ${petals(125, 175, 18, 80, 10, 4, INK.gold, 0.9)}
    ${suit === 'S' ? `<g fill="none" stroke="${INK.line}" stroke-width="1">
        <path d="M80 236c-14-8-14-26 2-28M170 236c14-8 14-26-2-28"/>
        <path d="M86 112c-14 6-14 24 0 30M164 112c14 6 14 24 0 30"/></g>` : ''}
    ${suitUse(suit, 125, 175, big, ink)}
    ${suit === 'S' ? `<use href="#pc-suit-S" x="${125 - big / 2 + 10}" y="${175 - big / 2 + 10}" width="${big - 20}" height="${big - 20}" fill="none" stroke="${INK.cream}" stroke-width="1.2"/>` : ''}`;
}

// ---------- court figures (top half; mirrored for the bottom) ----------
// Panel spans x 54..196, y 44..306; the figure half is y 44..175, centred on x = 125.
const L = `stroke="${INK.line}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;

function robe(p) {
  return `
    <path d="M56 175V146c4-14 22-28 44-36l12-3h26l12 3c22 8 40 22 44 36v29z" fill="${p.robe}" ${L}/>
    <path d="M56 175V146c4-14 22-28 44-36l12-3h26l12 3c22 8 40 22 44 36v29z" fill="url(#pc-hatch)" opacity=".35"/>
    <path d="M56 160c14-10 30-18 46-24l2 8c-16 6-32 13-46 23z" fill="${p.trim}" ${L}/>
    <path d="M194 160c-14-10-30-18-46-24l-2 8c16 6 32 13 46 23z" fill="${p.trim}" ${L}/>
    <path d="M56 146c4-14 22-28 44-36l-6 10c-16 8-30 18-38 30z" fill="${p.lining}" ${L}/>
    <path d="M194 146c-4-14-22-28-44-36l6 10c16 8 30 18 38 30z" fill="${p.lining}" ${L}/>`;
}

function face(cx, top, w, opts = {}) {
  const x1 = cx - w / 2, x2 = cx + w / 2, bottom = top + 32;
  const eyeY = top + 13;
  return `
    <path d="M${x1} ${top}c0 20 6 ${bottom - top - 2} ${w / 2} ${bottom - top}c${w / 2 - 0} -2 ${w / 2} -${bottom - top - 22} ${w / 2} -${bottom - top}z" fill="${INK.skin}" ${L}/>
    <path d="M${cx - 12} ${eyeY - 4}q5-3 9-1M${cx + 3} ${eyeY - 5}q5-2 9 1" fill="none" ${L} stroke-width="1.2"/>
    <path d="M${cx - 11} ${eyeY}q4-3 8 0q-4 2-8 0zM${cx + 3} ${eyeY}q4-3 8 0q-4 2-8 0z" fill="${INK.cream}" ${L} stroke-width="1"/>
    <circle cx="${cx - 7}" cy="${eyeY - 0.3}" r="1.3" fill="${INK.line}"/><circle cx="${cx + 7}" cy="${eyeY - 0.3}" r="1.3" fill="${INK.line}"/>
    <path d="M${cx} ${eyeY - 1}l-2 9q2 2 4 0" fill="none" ${L} stroke-width="1.1"/>
    ${opts.lips ? `<path d="M${cx - 4} ${eyeY + 15}q4-2 8 0q-4 3-8 0z" fill="${INK.red}" ${L} stroke-width=".8"/>` : `<path d="M${cx - 3} ${eyeY + 16}q3 1 6 0" fill="none" ${L} stroke-width="1"/>`}
    ${opts.cheeks ? `<circle cx="${cx - 9}" cy="${eyeY + 9}" r="2.5" fill="${INK.red}" opacity=".25"/><circle cx="${cx + 9}" cy="${eyeY + 9}" r="2.5" fill="${INK.red}" opacity=".25"/>` : ''}`;
}

function curls(x, y, n, dir, fill) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const yy = y + i * 7;
    s += `<path d="M${x} ${yy}c${dir * -8} 0 ${dir * -9} 7 ${dir * -3} 8c${dir * 4} 1 ${dir * 5}-4 ${dir * 2}-5" fill="${fill}" ${L} stroke-width="1.1"/>`;
  }
  return s;
}

function king(p) {
  return `
    <g>
      <path d="M150 116l22-66 5 2-20 66z" fill="${INK.cream}" ${L}/>
      <path d="M171 50l3-6 3 8z" fill="${INK.cream}" ${L}/>
      <path d="M143 112l16 6M147 108l8 12" ${L} stroke-width="3" stroke="${INK.gold}"/>
      <path d="M147 108l8 12" ${L} fill="none"/>
    </g>
    ${robe(p)}
    <path d="M109 108h10l-6 67H97z" fill="url(#pc-ermine)" ${L}/>
    <path d="M131 108h10l12 67h-16z" fill="url(#pc-ermine)" ${L}/>
    <path d="M119 108h12l6 67h-24z" fill="${INK.gold}" ${L}/>
    <path d="M119 108h12l6 67h-24z" fill="url(#pc-grid)" opacity=".5"/>
    <path d="M100 106q25 16 50 0l2 7q-27 18-54 0z" fill="${INK.gold}" ${L}/>
    <path d="M105 82c-6 8-6 20-1 28 3 3 7 2 8-1-4-8-4-16-2-24z" fill="${INK.cream}" ${L}/>
    <path d="M145 82c6 8 6 20 1 28-3 3-7 2-8-1 4-8 4-16 2-24z" fill="${INK.cream}" ${L}/>
    ${face(125, 70, 34)}
    <path d="M110 94c2 14 8 24 15 27 7-3 13-13 15-27-4 6-9 9-15 9s-11-3-15-9z" fill="${INK.cream}" ${L}/>
    <path d="M116 104q3 6 2 12M125 108v12M134 104q-3 6-2 12" fill="none" ${L} stroke-width=".9"/>
    <path d="M113 96q6-5 12-2q6-3 12 2q-6 3-12 1q-6 2-12-1z" fill="${INK.cream}" ${L} stroke-width="1.1"/>
    <path d="M102 72V56l8 6 6-15 9 13 9-13 6 15 8-6v16z" fill="${INK.gold}" ${L}/>
    <path d="M102 66h46" fill="none" ${L}/>
    <circle cx="116" cy="47" r="2.8" fill="${INK.red}" ${L} stroke-width="1"/>
    <circle cx="134" cy="47" r="2.8" fill="${INK.red}" ${L} stroke-width="1"/>
    <circle cx="125" cy="61" r="2.6" fill="${INK.blue}" ${L} stroke-width="1"/>
    <path d="M108 69h3M117 69h3M130 69h3M139 69h3" ${L} stroke-width="1.6"/>
    <path d="M139 120q8-6 12 0q2 6-6 8q-6 0-6-8z" fill="${INK.skin}" ${L}/>`;
}

function queen(p) {
  return `
    ${robe(p)}
    <path d="M100 112c10 20 40 20 50 0l4 63H96z" fill="${INK.cream}" ${L}/>
    <path d="M100 112c10 20 40 20 50 0l4 63H96z" fill="url(#pc-grid)" opacity=".35"/>
    <path d="M110 128l15 47 15-47" fill="none" ${L} stroke="${p.trim}" stroke-width="5"/>
    <path d="M110 128l15 47 15-47" fill="none" ${L}/>
    <path d="M104 74c-12 10-14 32-6 50 4 2 8 0 9-3-6-14-5-30 3-42z" fill="${INK.gold}" ${L}/>
    <path d="M146 74c12 10 14 32 6 50-4 2-8 0-9-3 6-14 5-30-3-42z" fill="${INK.gold}" ${L}/>
    <path d="M102 88q2 14-2 26M148 88q-2 14 2 26" fill="none" ${L} stroke-width=".9"/>
    ${face(125, 72, 30, { lips: true, cheeks: true })}
    <path d="M110 76q15-8 30 0l-2-6q-13-6-26 0z" fill="${INK.gold}" ${L}/>
    <path d="M106 68v-10l7 5 5-12 7 10 7-10 5 12 7-5v10z" fill="${INK.gold}" ${L}/>
    <path d="M125 51q-3-6 0-9q3 3 0 9z" fill="${INK.red}" ${L} stroke-width="1"/>
    <circle cx="113" cy="55" r="2" fill="${INK.blue}"/><circle cx="137" cy="55" r="2" fill="${INK.blue}"/>
    <path d="M104 108q21 14 42 0" fill="none" stroke="${INK.cream}" stroke-width="3.2" stroke-dasharray=".1 4.2" stroke-linecap="round"/>
    <path d="M86 146l-6-40" fill="none" ${L} stroke="${INK.green}" stroke-width="2.4"/>
    <path d="M83 128q-10-2-12-10q10 0 13 8zM84 120q8-6 14-2q-6 6-14 4z" fill="${INK.green}" ${L} stroke-width="1"/>
    <circle cx="80" cy="102" r="8" fill="${INK.red}" ${L}/>
    <path d="M76 100q4-4 8 0q-4 6-8 0zM80 96q4 3 0 8" fill="none" ${L} stroke-width=".9"/>
    <path d="M80 140q4-8 12-6q4 6-2 12q-8 2-10-6z" fill="${INK.skin}" ${L}/>`;
}

function jack(p) {
  return `
    <path d="M86 175l-6-86" fill="none" ${L} stroke="${INK.gold}" stroke-width="3"/>
    <path d="M86 175l-6-86" fill="none" ${L} stroke-width=".8"/>
    <path d="M80 88q-14 6-10 22l10-8zM80 88q12 2 12 16l-10-4z" fill="${INK.cream}" ${L}/>
    ${robe(p)}
    <path d="M60 175l84-58 8 6-80 52zM190 175l-84-58-8 6 80 52z" fill="${p.trim}" ${L}/>
    <circle cx="125" cy="134" r="7" fill="${INK.red}" ${L}/>
    <circle cx="125" cy="134" r="3" fill="${INK.gold}" ${L} stroke-width="1"/>
    <path d="M102 104q23 14 46 0l4 8q-27 16-54 0z" fill="${INK.cream}" ${L}/>
    <path d="M102 104q23 14 46 0l4 8q-27 16-54 0z" fill="url(#pc-grid)" opacity=".4"/>
    <path d="M105 72c-8 10-9 24-4 36 3 2 7 1 8-2-4-10-3-22 2-30z" fill="${INK.gold}" ${L}/>
    <path d="M145 72c8 10 9 24 4 36-3 2-7 1-8-2 4-10 3-22-2-30z" fill="${INK.gold}" ${L}/>
    ${curls(101, 98, 2, 1, INK.gold)}${curls(149, 98, 2, -1, INK.gold)}
    ${face(125, 72, 30)}
    <path d="M115 94q5-4 10-1q5-3 10 1M115 94q-4 1-4-3M135 94q4 1 4-3" fill="none" ${L} stroke-width="1.1"/>
    <path d="M100 72l4-16q21-10 42 0l4 16z" fill="${p.robe}" ${L}/>
    <path d="M100 72l4-16q21-10 42 0l4 16z" fill="url(#pc-hatch)" opacity=".3"/>
    <path d="M99 66h52v7H99z" fill="${INK.gold}" ${L}/>
    <path d="M106 66v7M114 66v7M122 66v7M130 66v7M138 66v7M146 66v7" ${L} stroke-width=".9"/>
    <path d="M146 58q16-14 26-6q-10 0-24 10" fill="${INK.cream}" ${L}/>
    <path d="M78 116q4-8 12-6q4 6-2 12q-8 2-10-6z" fill="${INK.skin}" ${L}/>`;
}

const COURT = { K: king, Q: queen, J: jack };
const PALETTE = {
  H: { robe: INK.red, trim: INK.gold, lining: INK.blue },
  D: { robe: INK.red, trim: INK.blue, lining: INK.gold },
  S: { robe: INK.blue, trim: INK.gold, lining: INK.red },
  C: { robe: INK.green, trim: INK.gold, lining: INK.red },
};

function courtPanel(rank, suit, ink) {
  const half = `<g clip-path="url(#pc-half-clip)"><g transform="translate(125 44) scale(1.24) translate(-125 -46)">${COURT[rank](PALETTE[suit])}</g></g>
    <rect x="60" y="48" width="24" height="24" rx="3" fill="${INK.cream}" opacity=".85"/>${suitUse(suit, 72, 60, 20, ink)}`;
  return `
    <rect x="54" y="44" width="142" height="262" fill="${INK.cream}" opacity=".35"/>
    <g clip-path="url(#pc-court-clip)">
      <g>${half}</g>
      <g transform="rotate(180 125 175)">${half}</g>
    </g>
    <path d="M54 175h142" stroke="${INK.line}" stroke-width="1.2"/>
    <rect x="54" y="44" width="142" height="262" fill="none" stroke="${INK.line}" stroke-width="1.8"/>
    <rect x="51" y="41" width="148" height="268" fill="none" stroke="${INK.line}" stroke-width=".6"/>`;
}

// ---------- card faces ----------
function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function faceSVG(code) {
  const rank = rankOf(code), suit = suitOf(code);
  const ink = RED.has(suit) ? INK.red : INK.black;
  const label = RANK_LABEL[rank] || rank;
  const idx = `
    <text x="27" y="52" text-anchor="middle" font-family="'Playfair Display', Georgia, 'Times New Roman', serif" font-weight="900"
      font-size="${label.length > 1 ? 32 : 38}" letter-spacing="${label.length > 1 ? -3 : 0}" fill="${ink}">${label}</text>
    ${suitUse(suit, 27, 72, 21, ink)}`;
  let center;
  if (rank === 'A') center = aceCenter(suit, ink);
  else if ('JQK'.includes(rank)) center = courtPanel(rank, suit, ink);
  else {
    const n = rank === 'T' ? 10 : Number(rank);
    center = PIPS[n].map(([c, y]) => suitUse(suit, COL[c], y, 46, ink, y > 176)).join('');
  }
  // Each card gets its own patch of the shared paper, so no two look the same.
  const h = hash(code);
  const ox = -(h % 240), oy = -((h >>> 8) % 340);
  return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${cardName(code)}">
    <g clip-path="url(#pc-clip)">
      <use href="#pc-paper-img" x="${ox}" y="${oy}"/>
      <g mask="url(#pc-wear)">
        ${center}
        <g>${idx}</g>
        <g transform="rotate(180 125 175)">${idx}</g>
      </g>
      <rect width="250" height="350" fill="url(#pc-age)"/>
      <rect x="1" y="1" width="248" height="348" rx="15" fill="none" stroke="#B89A66" stroke-width="1.6" opacity=".7"/>
    </g>
  </svg>`;
}

export const backSVG = () =>
  `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href="#pc-back"/></svg>`;

// Builds a flippable card. faceDown shows the back.
export function cardEl(code, { faceDown = false, className = '' } = {}) {
  const el = document.createElement('div');
  el.className = `card ${className}${faceDown ? ' is-down' : ''}`;
  if (code) el.dataset.code = code;
  el.innerHTML = `<div class="card-inner">
    <div class="card-face card-front">${code ? faceSVG(code) : ''}</div>
    <div class="card-face card-back">${backSVG()}</div>
  </div>`;
  return el;
}
