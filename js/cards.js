// Premium SVG playing cards. Card codes: rank + suit, e.g. "AS", "TD" (T = 10), "QH".
// All gradients/symbols live in one shared <svg> injected once, so each card stays light.

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

const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<defs>
  <linearGradient id="pc-ivory" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFDF7"/><stop offset=".55" stop-color="#FBF4E4"/><stop offset="1" stop-color="#F1E5C8"/>
  </linearGradient>
  <linearGradient id="pc-brass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F7E6AE"/><stop offset=".3" stop-color="#D2AE58"/><stop offset=".55" stop-color="#8E6B23"/>
    <stop offset=".8" stop-color="#E8CD82"/><stop offset="1" stop-color="#B08A3A"/>
  </linearGradient>
  <linearGradient id="pc-brass-v" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F7E6AE"/><stop offset=".5" stop-color="#C9A24A"/><stop offset="1" stop-color="#8E6B23"/>
  </linearGradient>
  <linearGradient id="pc-red" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#D8402F"/><stop offset="1" stop-color="#97180F"/>
  </linearGradient>
  <linearGradient id="pc-ink" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#34344A"/><stop offset="1" stop-color="#0E0E18"/>
  </linearGradient>
  <radialGradient id="pc-peacock" cx=".5" cy=".45" r=".75">
    <stop offset="0" stop-color="#1F7A80"/><stop offset=".6" stop-color="#0E4A52"/><stop offset="1" stop-color="#062A30"/>
  </radialGradient>
  <radialGradient id="pc-court-K" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#17676E"/><stop offset="1" stop-color="#083A41"/></radialGradient>
  <radialGradient id="pc-court-Q" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#93303D"/><stop offset="1" stop-color="#5A1220"/></radialGradient>
  <radialGradient id="pc-court-J" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#3B3F8C"/><stop offset="1" stop-color="#1D1F52"/></radialGradient>
  <pattern id="pc-lattice" width="16" height="16" patternUnits="userSpaceOnUse">
    <path d="M8 0L16 8 8 16 0 8z" fill="none" stroke="#D4AF5A" stroke-width=".7" opacity=".35"/>
    <circle cx="8" cy="8" r="1.1" fill="#D4AF5A" opacity=".4"/>
  </pattern>
  <pattern id="pc-lattice-fine" width="10" height="10" patternUnits="userSpaceOnUse">
    <path d="M5 0L10 5 5 10 0 5z" fill="none" stroke="#F3DC9A" stroke-width=".5" opacity=".28"/>
  </pattern>
  ${Object.entries(SUIT_PATHS).map(([k, p]) => `<symbol id="pc-suit-${k}" viewBox="0 0 100 100">${p}</symbol>`).join('')}
  <symbol id="pc-back" viewBox="0 0 250 350">
    <rect x="0" y="0" width="250" height="350" rx="18" fill="#F6EEDB"/>
    <rect x="7" y="7" width="236" height="336" rx="13" fill="url(#pc-peacock)"/>
    <rect x="7" y="7" width="236" height="336" rx="13" fill="url(#pc-lattice)"/>
    <rect x="16" y="16" width="218" height="318" rx="9" fill="none" stroke="url(#pc-brass)" stroke-width="2.2"/>
    <rect x="22" y="22" width="206" height="306" rx="6" fill="none" stroke="url(#pc-brass)" stroke-width=".8" opacity=".8"/>
    ${rosette(125, 175, 36, 78, 24, '#E2C277', 0.9, 0.55)}
    ${rosette(125, 175, 24, 46, 14, '#F3DC9A', 0.8, 0.7)}
    <circle cx="125" cy="175" r="98" fill="none" stroke="url(#pc-brass)" stroke-width="1.4" opacity=".75"/>
    <circle cx="125" cy="175" r="92" fill="none" stroke="#E2C277" stroke-width=".6" stroke-dasharray="2 4" opacity=".7"/>
    ${petals(125, 175, 12, 22, 22, 9, 'url(#pc-brass-v)', 0.95)}
    <circle cx="125" cy="175" r="21" fill="#0A3B42" stroke="url(#pc-brass)" stroke-width="2"/>
    <path d="M125 161l9 14-9 14-9-14z" fill="url(#pc-brass)"/>
    ${[[42, 42], [208, 42], [42, 308], [208, 308]].map(([x, y]) =>
      `<g transform="translate(${x} ${y})"><path d="M0-9L9 0 0 9-9 0z" fill="url(#pc-brass)"/><circle r="2.4" fill="#0A3B42"/></g>`).join('')}
  </symbol>
</defs>
</svg>`;

export function installCardDefs() {
  if (document.getElementById('pc-back')) return;
  document.body.insertAdjacentHTML('afterbegin', DEFS);
}

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

const CRESTS = {
  K: `<path d="M-27 13V-7l13 12L0-17 14 5 27-7v20z" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8"/>
      <rect x="-28" y="13" width="56" height="7" rx="1.5" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8"/>
      <circle cx="-27" cy="-9" r="3.6" fill="#E9573F"/><circle cx="0" cy="-19" r="4" fill="#E9573F"/><circle cx="27" cy="-9" r="3.6" fill="#E9573F"/>
      <circle cx="-13" cy="16.5" r="1.8" fill="#0A3B42"/><circle cx="0" cy="16.5" r="1.8" fill="#0A3B42"/><circle cx="13" cy="16.5" r="1.8" fill="#0A3B42"/>`,
  Q: `<path d="M0 16C-11 2-10-11 0-22 10-11 11 2 0 16z" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8"/>
      <path d="M0 16C-15 10-26-1-27-13-15-11-6-3 0 16z" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8" opacity=".92"/>
      <path d="M0 16C15 10 26-1 27-13 15-11 6-3 0 16z" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8" opacity=".92"/>
      <path d="M-22 19Q0 27 22 19" fill="none" stroke="url(#pc-brass)" stroke-width="2.4" stroke-linecap="round"/>`,
  J: `<path d="M0 26V8" stroke="url(#pc-brass)" stroke-width="2.4" stroke-linecap="round"/>
      ${[-1, 1].map((d) => [0, 1, 2, 3].map((i) => `<path d="M0 ${20 - i * 7}l${d * (16 - i * 2)} ${-8}" stroke="#E2C277" stroke-width="1.1" opacity=".75"/>`).join('')).join('')}
      <ellipse cx="0" cy="-6" rx="15" ry="19" fill="url(#pc-brass)" stroke="#5c4413" stroke-width=".8"/>
      <ellipse cx="0" cy="-4" rx="9" ry="12" fill="#0F6A6F"/>
      <ellipse cx="0" cy="-2" rx="4.6" ry="6" fill="#1D1F52"/>`,
};

function courtPanel(rank, suit, ink) {
  const half = `
    <g transform="translate(125 88)">${CRESTS[rank]}</g>
    <text x="125" y="160" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="900"
      font-size="54" fill="url(#pc-brass-v)" stroke="#3d2c08" stroke-width=".6">${rank}</text>
    ${suitUse(suit, 80, 68, 20, '#F6EEDB')}`;
  return `
    <rect x="56" y="44" width="138" height="262" rx="8" fill="url(#pc-court-${rank})"/>
    <rect x="56" y="44" width="138" height="262" rx="8" fill="url(#pc-lattice-fine)"/>
    <path d="M56 175h138" stroke="url(#pc-brass)" stroke-width="1.2"/>
    <circle cx="125" cy="175" r="5" fill="url(#pc-brass)"/>
    <g>${half}</g>
    <g transform="rotate(180 125 175)">${half}</g>
    <rect x="56" y="44" width="138" height="262" rx="8" fill="none" stroke="url(#pc-brass)" stroke-width="2.4"/>
    <rect x="61" y="49" width="128" height="252" rx="5" fill="none" stroke="${ink}" stroke-width=".8" opacity=".55"/>`;
}

function aceCenter(suit, ink) {
  return `
    <circle cx="125" cy="175" r="74" fill="none" stroke="url(#pc-brass)" stroke-width="1.6"/>
    <circle cx="125" cy="175" r="68" fill="none" stroke="url(#pc-brass)" stroke-width=".6" stroke-dasharray="1.5 3.5"/>
    ${petals(125, 175, 16, 74, 14, 6, 'url(#pc-brass-v)', 0.9)}
    ${suitUse(suit, 125, 175, 96, ink)}`;
}

export function faceSVG(code) {
  const rank = rankOf(code), suit = suitOf(code);
  const ink = RED.has(suit) ? 'url(#pc-red)' : 'url(#pc-ink)';
  const label = RANK_LABEL[rank] || rank;
  const idx = `
    <text x="27" y="52" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800"
      font-size="${label.length > 1 ? 34 : 38}" letter-spacing="${label.length > 1 ? -3 : 0}" fill="${ink}">${label}</text>
    ${suitUse(suit, 27, 72, 22, ink)}`;
  let center;
  if (rank === 'A') center = aceCenter(suit, ink);
  else if ('JQK'.includes(rank)) center = courtPanel(rank, suit, ink);
  else {
    const n = rank === 'T' ? 10 : Number(rank);
    center = PIPS[n].map(([c, y]) => suitUse(suit, COL[c], y, 46, ink, y > 176)).join('');
  }
  return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${cardName(code)}">
    <rect x="0" y="0" width="250" height="350" rx="18" fill="url(#pc-ivory)"/>
    <rect x="1" y="1" width="248" height="348" rx="17" fill="none" stroke="#D9CBA6" stroke-width="1.5"/>
    <rect x="9" y="9" width="232" height="332" rx="12" fill="none" stroke="url(#pc-brass)" stroke-width="1.1" opacity=".85"/>
    ${center}
    <g>${idx}</g>
    <g transform="rotate(180 125 175)">${idx}</g>
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
