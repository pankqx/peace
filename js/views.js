// Table renderers for each game. Each view builds its own table markup (including the shared
// status block) and returns events the GameView turns into sounds and effects.
import { cardEl } from './cards.js';
import { toList } from './store.js';

export const STATUS_HTML = `
  <div class="status" id="status">
    <p class="status-main" id="status-main">Waiting…</p>
    <div class="timer" id="timer" hidden><div class="timer-fill" id="timer-fill"></div></div>
    <div class="status-actions" id="status-actions"></div>
  </div>`;

const zoneAttrs = (side, label) =>
  `data-side="${side}" role="button" tabindex="0" aria-label="Bet on ${label}"`;

const $ = (id) => document.getElementById(id);

// Drops a card into a slot face down, flies it in from `fromEl`, then flips it.
function dealInto(slot, code, fromEl, { animate = true, flipDelay = 260 } = {}) {
  const el = cardEl(code, { faceDown: true });
  slot.append(el);
  if (!animate) { el.classList.remove('is-down'); return el; }
  if (fromEl) {
    const a = fromEl.getBoundingClientRect(), b = el.getBoundingClientRect();
    el.style.setProperty('--fx', `${a.left + a.width / 2 - (b.left + b.width / 2)}px`);
    el.style.setProperty('--fy', `${a.top + a.height / 2 - (b.top + b.height / 2)}px`);
  }
  el.classList.add('dealt');
  setTimeout(() => el.classList.remove('is-down'), flipDelay);
  return el;
}

// ---------------- Andar Bahar ----------------
export class AndarBaharView {
  constructor(table, rules) {
    this.rules = rules;
    this.round = -1;
    this.middle = null;
    this.dealt = { andar: 0, bahar: 0 };
    const [andar, bahar] = rules.sides;
    table.className = 'table table--ab';
    table.innerHTML = `
      <div class="lane zone zone--andar" id="lane-andar" ${zoneAttrs('andar', 'Andar')}>
        <div class="zone-head"><span class="zone-name">${andar.label}</span><span class="zone-sub">${andar.sub}, <span data-pays="andar">pays ${andar.pays}</span></span>
          <span class="bettors" data-bettors="andar"></span></div>
        <div class="lane-cards" id="cards-andar"></div>
      </div>
      <div class="center">
        <div class="middle-slot" id="middle-slot"></div>
        ${STATUS_HTML}
      </div>
      <div class="lane zone zone--bahar" id="lane-bahar" ${zoneAttrs('bahar', 'Bahar')}>
        <div class="zone-head"><span class="zone-name">${bahar.label}</span><span class="zone-sub">${bahar.sub}, <span data-pays="bahar">pays ${bahar.pays}</span></span>
          <span class="bettors" data-bettors="bahar"></span></div>
        <div class="lane-cards" id="cards-bahar"></div>
      </div>`;
    window.addEventListener('resize', () => { this.layout('andar'); this.layout('bahar'); });
  }

  render(s, r) {
    const ev = { dealt: 0, flipped: false, match: false };
    if (r.n !== this.round) {
      this.round = r.n;
      this.dealt = { andar: 0, bahar: 0 };
      $('cards-andar').innerHTML = '';
      $('cards-bahar').innerHTML = '';
    }
    $('lane-andar').classList.toggle('is-winner', r.phase === 'result' && r.winner === 'andar');
    $('lane-bahar').classList.toggle('is-winner', r.phase === 'result' && r.winner === 'bahar');

    const slot = $('middle-slot');
    if (!r.middle) { slot.innerHTML = ''; this.middle = null; }
    else if (this.middle !== `${r.n}:${r.middle}`) {
      this.middle = `${r.n}:${r.middle}`;
      slot.innerHTML = '';
      const card = cardEl(r.middle, { faceDown: true });
      slot.append(card);
      requestAnimationFrame(() => setTimeout(() => card.classList.remove('is-down'), 140));
      ev.flipped = true;
    }

    const lanes = { andar: [], bahar: [] };
    toList(r.cards).forEach((c, i) => lanes[i % 2 === 0 ? 'andar' : 'bahar'].push([c, i]));
    for (const side of ['andar', 'bahar']) {
      const box = $(`cards-${side}`);
      const list = lanes[side];
      if (list.length < this.dealt[side]) { box.innerHTML = ''; this.dealt[side] = 0; }
      const fresh = [];
      for (let k = this.dealt[side]; k < list.length; k++) {
        const [code, i] = list[k];
        const el = cardEl(code, { faceDown: true });
        el.dataset.i = i;
        box.append(el);
        fresh.push(el);
      }
      this.dealt[side] = list.length;
      this.layout(side);
      const animate = fresh.length <= 2; // when joining mid-round, just show the cards
      for (const el of fresh) {
        if (!animate) { el.classList.remove('is-down'); continue; }
        const a = slot.getBoundingClientRect(), b = el.getBoundingClientRect();
        el.style.setProperty('--fx', `${a.left + a.width / 2 - (b.left + b.width / 2)}px`);
        el.style.setProperty('--fy', `${a.top + a.height / 2 - (b.top + b.height / 2)}px`);
        el.classList.add('dealt');
        setTimeout(() => el.classList.remove('is-down'), 240);
      }
      if (animate) ev.dealt += fresh.length;
    }
    if (r.phase === 'result' && r.winIndex != null) {
      const win = document.querySelector(`.lane-cards .card[data-i="${r.winIndex}"]`);
      if (win && !win.classList.contains('is-match')) {
        setTimeout(() => win.classList.add('is-match', 'shine'), 280);
        ev.match = true;
      }
    }
    return ev;
  }

  layout(side) {
    const box = $(`cards-${side}`);
    if (!box) return;
    const cards = [...box.children];
    if (!cards.length) return;
    const W = box.clientWidth;
    const cw = cards[0].getBoundingClientRect().width || 64;
    const n = cards.length;
    const step = n > 1 ? Math.min(cw * 0.66, (W - cw) / (n - 1)) : 0;
    cards.forEach((c, i) => { c.style.left = `${Math.round(i * step)}px`; c.style.zIndex = i; });
  }

  flashTarget() { return $('middle-slot'); }
}

// ---------------- Dragon Tiger ----------------
export class DragonTigerView {
  constructor(table, rules) {
    this.rules = rules;
    this.round = -1;
    this.shown = { dragon: null, tiger: null };
    const [dragon, tie, tiger] = rules.sides;
    const zone = (sd) => `
      <div class="zone dt-zone zone--${sd.id}" id="zone-${sd.id}" ${zoneAttrs(sd.id, sd.label)}>
        <div class="zone-head"><span class="zone-name">${sd.label}</span><span class="zone-sub" data-pays="${sd.id}">pays ${sd.pays}</span></div>
        <div class="dt-slot" id="slot-${sd.id}"><div class="dt-slot-empty"></div></div>
        <span class="bettors" data-bettors="${sd.id}"></span>
      </div>`;
    table.className = 'table table--dt';
    table.innerHTML = `
      <div class="dt-row">
        ${zone(dragon)}
        <div class="dt-mid">
          <div class="dt-vs" aria-hidden="true">VS</div>
          <div class="zone dt-tie zone--tie" id="zone-tie" ${zoneAttrs('tie', 'Tie')}>
            <span class="zone-name">${tie.label}</span><span class="zone-sub" data-pays="tie">pays ${tie.pays}</span>
            <span class="bettors" data-bettors="tie"></span>
          </div>
        </div>
        ${zone(tiger)}
      </div>
      ${STATUS_HTML}
      <div class="dt-shoe" id="dt-shoe" aria-hidden="true"></div>`;
  }

  render(s, r) {
    const ev = { dealt: 0, flipped: false, match: false };
    if (r.n !== this.round) {
      this.round = r.n;
      this.shown = { dragon: null, tiger: null };
      for (const side of ['dragon', 'tiger']) $(`slot-${side}`).innerHTML = '<div class="dt-slot-empty"></div>';
    }
    for (const side of ['dragon', 'tiger']) {
      const code = r[side];
      if (code && this.shown[side] !== code) {
        this.shown[side] = code;
        const slot = $(`slot-${side}`);
        slot.innerHTML = '';
        const fresh = r.phase === 'dealing' || (r.phase === 'result' && side === 'tiger');
        dealInto(slot, code, $('dt-shoe'), { animate: fresh, flipDelay: 380 });
        if (fresh) ev.dealt++;
      }
    }
    const res = r.phase === 'result';
    for (const id of ['dragon', 'tiger', 'tie']) $(`zone-${id}`).classList.toggle('is-winner', res && r.winner === id);
    for (const id of ['dragon', 'tiger']) $(`zone-${id}`).classList.toggle('is-loser', res && r.winner !== id && r.winner !== 'tie');
    if (res && !this.matched) { this.matched = r.n; ev.match = true; }
    if (!res) this.matched = null;
    return ev;
  }

  flashTarget() { return document.querySelector('.dt-vs'); }
}

export const VIEWS = { 'andar-bahar': AndarBaharView, 'dragon-tiger': DragonTigerView };
