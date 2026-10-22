// Andar Bahar game rules + room client. Pure logic, no DOM — runs the same in solo and online.
//
// Room shape:
//   meta    { host, created, game: 'andar-bahar' }
//   players { [pid]: { name, chips, joined, online, bot? } }
//   round   { n, phase: lobby|betting|dealing|result, middle, cards[], startedAt, endsAt, nextAt,
//             winner, winIndex, net{pid: +/-chips}, settled }
//   bets    { [pid]: { side, amount, round } }
//   history { [n]: 'A' | 'B' }
import { SUITS, RANKS, rankOf } from '../../cards.js';
import { toList } from '../../store.js';

export const CONFIG = {
  startChips: 1000,
  refillChips: 500,
  chipValues: [10, 50, 100, 500],
  betMs: 15000,
  minBetMs: 4000, // when everyone has bet, deal after at least this long
  dealMs: 750,
  firstDealDelay: 600,
  resultMs: 5500,
  hostTimeoutMs: 4000,
  maxPlayers: 12,
};

export const SIDES = { andar: 'Andar', bahar: 'Bahar' };

export function fullDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return d;
}

export function shuffle(arr) {
  const a = arr.slice();
  const rnd = new Uint32Array(a.length);
  globalThis.crypto.getRandomValues(rnd);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// First card goes to Andar, so Andar wins slightly more often and pays a bit less.
export const sideForIndex = (i) => (i % 2 === 0 ? 'andar' : 'bahar');
export const winAmount = (side, amount) =>
  side === 'andar' ? amount + Math.floor(amount * 0.9) : amount * 2;

export function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rnd = new Uint32Array(4);
  globalThis.crypto.getRandomValues(rnd);
  return Array.from(rnd, (v) => letters[v % letters.length]).join('');
}

export function newRoom(pid, name, now) {
  return {
    meta: { host: pid, created: now, game: 'andar-bahar' },
    players: { [pid]: { name, chips: CONFIG.startChips, joined: now, online: true } },
    round: { n: 0, phase: 'lobby' },
  };
}

export class RoomClient {
  constructor(store, pid) {
    this.store = store;
    this.pid = pid;
    this.state = null;
    this.busy = false;
    this.deck = null;
    this.deckRound = -1;
    this.hostMissingSince = null;
    this.listeners = new Set();
    this.unsub = store.subscribe((s) => {
      this.state = s;
      this.listeners.forEach((fn) => fn(s));
      this.tick();
    });
    this.timer = setInterval(() => this.tick(), 250);
  }

  onChange(fn) { this.listeners.add(fn); if (this.state) fn(this.state); return () => this.listeners.delete(fn); }
  now() { return this.store.now(); }
  get round() { return (this.state && this.state.round) || { n: 0, phase: 'lobby' }; }
  get me() { return this.state && this.state.players && this.state.players[this.pid]; }
  get isHost() { return !!(this.state && this.state.meta && this.state.meta.host === this.pid); }
  myBet(s = this.state) {
    const b = s && s.bets && s.bets[this.pid];
    return b && b.round === this.round.n ? b : null;
  }

  async join(name, extra = {}) {
    const s = this.state || {};
    const existing = s.players && s.players[this.pid];
    const count = Object.values(s.players || {}).filter((p) => p.online !== false).length;
    if (!existing && count >= CONFIG.maxPlayers) throw new Error('This room is full. Ask the host for a new room.');
    await this.store.update({
      [`players/${this.pid}`]: {
        ...(existing || {}),
        ...extra,
        name,
        chips: existing ? existing.chips : CONFIG.startChips,
        joined: existing ? existing.joined : this.now(),
        online: true,
      },
    });
    this.store.presence(this.pid);
  }

  // ---------- player actions ----------
  canBet() {
    const r = this.round;
    return r.phase === 'betting' && this.now() < r.endsAt - 300;
  }

  async placeBet(side, amount) {
    if (!this.canBet()) return { ok: false, reason: 'Bets are closed for this round.' };
    const n = this.round.n;
    const cur = this.myBet();
    if (cur && cur.side !== side) {
      // Move the whole bet to the other side.
      await this.store.update({ [`bets/${this.pid}/side`]: side });
      return { ok: true };
    }
    const paid = await this.store.transaction(`players/${this.pid}/chips`, (c) => {
      if (c == null) return c;
      return c >= amount ? c - amount : undefined;
    });
    if (!paid.committed) return { ok: false, reason: 'Not enough chips for that.' };
    await this.store.transaction(`bets/${this.pid}`, (b) => ({
      side,
      amount: (b && b.round === n ? b.amount : 0) + amount,
      round: n,
    }));
    return { ok: true };
  }

  async clearBet() {
    if (!this.canBet()) return;
    const n = this.round.n;
    let refund = 0;
    await this.store.transaction(`bets/${this.pid}`, (b) => {
      refund = b && b.round === n ? b.amount : 0;
      return null;
    });
    if (refund) await this.store.transaction(`players/${this.pid}/chips`, (c) => (c == null ? c : c + refund));
  }

  async refill() {
    await this.store.transaction(`players/${this.pid}/chips`, (c) =>
      c == null ? c : c < CONFIG.chipValues[0] ? CONFIG.refillChips : undefined);
  }

  async start() { if (this.isHost && this.round.phase === 'lobby') await this.newRound(); }
  async dealNow() {
    if (this.isHost && this.round.phase === 'betting') await this.store.update({ 'round/endsAt': this.now() });
  }

  // ---------- host loop ----------
  async tick() {
    const s = this.state;
    if (!s || !s.meta || this.busy) return;
    this.busy = true;
    try {
      await this.maybeTakeOver(s);
      if (s.meta.host !== this.pid) return;
      const r = s.round || { n: 0, phase: 'lobby' };
      const now = this.now();
      if (r.phase === 'betting') {
        const everyoneBet = this.everyoneBet(s, r.n);
        if (now >= r.endsAt || (everyoneBet && now >= r.startedAt + CONFIG.minBetMs)) {
          await this.store.update({ 'round/phase': 'dealing', 'round/nextAt': now + CONFIG.firstDealDelay });
        }
      } else if (r.phase === 'dealing') {
        if (now >= (r.nextAt || 0)) await this.dealOne(s, r, now);
      } else if (r.phase === 'result') {
        if (!r.settled) await this.settle(s, r);
        else if (now >= r.endsAt) await this.newRound();
      }
    } finally {
      this.busy = false;
    }
  }

  everyoneBet(s, n) {
    const active = Object.entries(s.players || {}).filter(([, p]) => p.online !== false);
    if (!active.length) return false;
    return active.every(([id, p]) => {
      const b = s.bets && s.bets[id];
      return (b && b.round === n) || p.chips < CONFIG.chipValues[0];
    });
  }

  async maybeTakeOver(s) {
    const host = s.meta.host;
    const hp = s.players && s.players[host];
    if (hp && hp.online !== false) { this.hostMissingSince = null; return; }
    const now = this.now();
    if (!this.hostMissingSince) this.hostMissingSince = now;
    if (now - this.hostMissingSince < CONFIG.hostTimeoutMs) return;
    const next = Object.entries(s.players || {})
      .filter(([, p]) => p.online !== false && !p.bot)
      .sort((a, b) => a[1].joined - b[1].joined)[0];
    if (!next || next[0] !== this.pid) return;
    await this.store.transaction('meta/host', (cur) => (cur === host || cur == null ? this.pid : undefined));
    this.hostMissingSince = null;
  }

  deckFor(r) {
    if (this.deckRound !== r.n || !this.deck) {
      // Fresh host (or host takeover): shuffle every card not yet seen this round.
      const seen = new Set([r.middle, ...toList(r.cards)]);
      this.deck = shuffle(fullDeck().filter((c) => !seen.has(c)));
      this.deckRound = r.n;
    }
    return this.deck;
  }

  async dealOne(s, r, now) {
    const cards = toList(r.cards);
    const deck = this.deckFor(r);
    const card = deck.pop();
    if (!card) return;
    const i = cards.length;
    const updates = { [`round/cards/${i}`]: card, 'round/nextAt': now + CONFIG.dealMs };
    if (rankOf(card) === rankOf(r.middle)) {
      const winner = sideForIndex(i);
      Object.assign(updates, {
        'round/phase': 'result',
        'round/winner': winner,
        'round/winIndex': i,
        'round/settled': false,
        'round/endsAt': now + CONFIG.resultMs,
        [`history/${r.n}`]: winner === 'andar' ? 'A' : 'B',
      });
      // Keep only the last 30 results.
      if (r.n > 30) updates[`history/${r.n - 30}`] = null;
    }
    await this.store.update(updates);
  }

  async settle(s, r) {
    const net = {};
    const payouts = [];
    for (const [pid, b] of Object.entries(s.bets || {})) {
      if (!b || b.round !== r.n) continue;
      if (b.side === r.winner) {
        const win = winAmount(b.side, b.amount);
        net[pid] = win - b.amount;
        payouts.push([pid, win]);
      } else net[pid] = -b.amount;
    }
    await this.store.update({ 'round/settled': true, 'round/net': Object.keys(net).length ? net : null });
    for (const [pid, win] of payouts) {
      await this.store.transaction(`players/${pid}/chips`, (c) => (c == null ? c : c + win));
    }
  }

  async newRound() {
    const now = this.now();
    const n = (this.round.n || 0) + 1;
    const deck = shuffle(fullDeck());
    const middle = deck.pop();
    this.deck = deck;
    this.deckRound = n;
    await this.store.update({
      round: { n, phase: 'betting', middle, startedAt: now, endsAt: now + CONFIG.betMs },
      bets: null,
    });
  }

  destroy() {
    clearInterval(this.timer);
    if (this.unsub) this.unsub();
    this.listeners.clear();
  }
}

// Simple bots for solo mode: they bet a random chip on a random side each round.
export function runBot(client) {
  let lastRound = -1;
  const t = setInterval(async () => {
    const r = client.round;
    const me = client.me;
    if (!me || r.phase !== 'betting' || r.n === lastRound) return;
    lastRound = r.n;
    if (me.chips < CONFIG.chipValues[0]) { await client.refill(); return; }
    if (Math.random() < 0.15) return; // sits this one out
    const wait = 1200 + Math.random() * 6000;
    setTimeout(async () => {
      const options = CONFIG.chipValues.filter((v) => v <= (client.me?.chips || 0) && v <= 100);
      if (!options.length) return;
      const amount = options[Math.floor(Math.random() * options.length)];
      const side = Math.random() < 0.5 ? 'andar' : 'bahar';
      await client.placeBet(side, amount);
      if (Math.random() < 0.3) await client.placeBet(side, options[0]);
    }, wait);
  }, 400);
  return () => clearInterval(t);
}
