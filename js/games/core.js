// Shared table-game engine: rooms, betting, host-driven dealing, payouts, host takeover, bots.
// Each game supplies a small "rules" object (see andar-bahar/rules.js, dragon-tiger/rules.js).
//
// Room shape:
//   meta    { host, created, game }
//   players { [pid]: { name, chips, joined, online, bot? } }   // chips = coins
//   round   { n, phase: lobby|betting|dealing|result, startedAt, endsAt, nextAt,
//             winner, settled, net{pid: +/-}, ...game fields }
//   bets    { [pid]: { side, amount, round } }
//   history { [n]: mark }
import { SUITS, RANKS } from '../cards.js';

export const BASE = {
  startChips: 1000,
  minStart: 100,
  maxStart: 1000000,
  betMs: 15000,
  minBetMs: 4000,
  dealMs: 750,
  firstDealDelay: 600,
  resultMs: 5500,
  hostTimeoutMs: 4000,
  maxPlayers: 12,
  historyKeep: 30,
};

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

export function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rnd = new Uint32Array(4);
  globalThis.crypto.getRandomValues(rnd);
  return Array.from(rnd, (v) => letters[v % letters.length]).join('');
}

// Starting coins the room creator picked (default 1,000), kept within sane limits.
export function clampStart(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return BASE.startChips;
  return Math.min(BASE.maxStart, Math.max(BASE.minStart, n));
}

// Coin buttons grow with the room's starting coins so big rooms don't need 100 taps.
export function coinValuesFor(start) {
  if (start >= 50000) return [500, 1000, 5000, 10000];
  if (start >= 5000) return [100, 500, 1000, 5000];
  if (start >= 2000) return [50, 100, 500, 1000];
  return [10, 50, 100, 500];
}

// How winners get paid:
//   'pot'   — players vs players: winners split the losers' coins (stake back + share by stake).
//   'fixed' — the bank pays each game's fixed odds (2×, 1.9×, 9×).
export const PAY_MODES = ['pot', 'fixed'];

// Players-vs-players settlement. Returns { pid: coins returned (stake included) }.
// Losers' coins are shared among winners in proportion to their stakes; leftover coins from
// rounding go to the biggest winners so the room's total never changes. If nobody won,
// everyone gets their stake back.
export function potPayouts(bets, winner) {
  const winners = bets.filter((b) => b.side === winner);
  const losersTotal = bets.filter((b) => b.side !== winner).reduce((t, b) => t + b.amount, 0);
  const winTotal = winners.reduce((t, b) => t + b.amount, 0);
  const out = {};
  if (!winTotal) { for (const b of bets) out[b.pid] = b.amount; return out; }
  for (const b of bets) out[b.pid] = 0;
  let given = 0;
  for (const b of winners) {
    const share = Math.floor((losersTotal * b.amount) / winTotal);
    out[b.pid] = b.amount + share;
    given += share;
  }
  let left = losersTotal - given;
  const order = winners.slice().sort((a, b) => b.amount - a.amount || (a.pid < b.pid ? -1 : 1));
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) out[order[i].pid] += 1;
  return out;
}

export function newRoom(game, pid, name, now, startCoins = BASE.startChips, payMode = 'pot') {
  const start = clampStart(startCoins);
  return {
    meta: { host: pid, created: now, game, startCoins: start, payMode: PAY_MODES.includes(payMode) ? payMode : 'pot' },
    players: { [pid]: { name, chips: start, joined: now, online: true } },
    round: { n: 0, phase: 'lobby' },
  };
}

export class RoomClient {
  constructor(store, pid, rules) {
    this.store = store;
    this.pid = pid;
    this.rules = rules;
    this.cfg = { ...BASE, ...(rules.config || {}) };
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
    this.timer = setInterval(() => this.tick(), 200);
  }

  onChange(fn) { this.listeners.add(fn); if (this.state) fn(this.state); return () => this.listeners.delete(fn); }
  now() { return this.store.now(); }
  get round() { return (this.state && this.state.round) || { n: 0, phase: 'lobby' }; }
  get me() { return this.state && this.state.players && this.state.players[this.pid]; }
  get isHost() { return !!(this.state && this.state.meta && this.state.meta.host === this.pid); }
  startCoins() { return clampStart((this.state && this.state.meta && this.state.meta.startCoins) || this.cfg.startChips); }
  coinValues() { return coinValuesFor(this.startCoins()); }
  // Rooms made before this setting existed keep fixed payouts.
  payMode() { const m = this.state && this.state.meta && this.state.meta.payMode; return PAY_MODES.includes(m) ? m : 'fixed'; }
  minCoin() { return this.coinValues()[0]; }
  refillAmount() { return Math.max(this.minCoin(), Math.round(this.startCoins() / 2)); }

  myBet(s = this.state) {
    const b = s && s.bets && s.bets[this.pid];
    return b && b.round === ((s && s.round && s.round.n) || 0) ? b : null;
  }

  async join(name, extra = {}) {
    const s = this.state || {};
    const existing = s.players && s.players[this.pid];
    const count = Object.values(s.players || {}).filter((p) => p.online !== false).length;
    if (!existing && count >= this.cfg.maxPlayers) throw new Error('This room is full. Ask the host for a new room.');
    await this.store.update({
      [`players/${this.pid}`]: {
        ...(existing || {}),
        ...extra,
        name,
        chips: existing ? existing.chips : this.startCoins(),
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
      await this.store.update({ [`bets/${this.pid}/side`]: side });
      return { ok: true, moved: true };
    }
    const paid = await this.store.transaction(`players/${this.pid}/chips`, (c) => {
      if (c == null) return c;
      return c >= amount ? c - amount : undefined;
    });
    if (!paid.committed) return { ok: false, reason: 'Not enough coins for that.' };
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
      c == null ? c : c < this.minCoin() ? this.refillAmount() : undefined);
  }

  // Host only, before the first round.
  async setPayMode(mode) {
    if (!this.isHost || this.round.phase !== 'lobby' || !PAY_MODES.includes(mode)) return false;
    await this.store.update({ 'meta/payMode': mode });
    return true;
  }

  // Host only, before the first round: change everyone's starting coins.
  async setStartCoins(value) {
    if (!this.isHost || this.round.phase !== 'lobby') return false;
    const start = clampStart(value);
    const updates = { 'meta/startCoins': start };
    for (const id of Object.keys(this.state.players || {})) updates[`players/${id}/chips`] = start;
    await this.store.update(updates);
    return true;
  }

  async start() { if (this.isHost && this.round.phase === 'lobby') await this.newRound(); }
  async dealNow() {
    if (this.isHost && this.round.phase === 'betting') await this.store.update({ 'round/endsAt': this.now() });
  }
  async leave() {
    try { await this.store.update({ [`players/${this.pid}/online`]: false }); } catch {}
    this.destroy();
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
        if (now >= r.endsAt || (everyoneBet && now >= r.startedAt + this.cfg.minBetMs)) {
          await this.store.update({ 'round/phase': 'dealing', 'round/nextAt': now + this.cfg.firstDealDelay });
        }
      } else if (r.phase === 'dealing') {
        if (now >= (r.nextAt || 0)) await this.dealOne(r, now);
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
      return (b && b.round === n) || p.chips < this.minCoin();
    });
  }

  async maybeTakeOver(s) {
    const host = s.meta.host;
    const hp = s.players && s.players[host];
    if (hp && hp.online !== false) { this.hostMissingSince = null; return; }
    const now = this.now();
    if (!this.hostMissingSince) this.hostMissingSince = now;
    if (now - this.hostMissingSince < this.cfg.hostTimeoutMs) return;
    const next = Object.entries(s.players || {})
      .filter(([, p]) => p.online !== false && !p.bot)
      .sort((a, b) => a[1].joined - b[1].joined)[0];
    if (!next || next[0] !== this.pid) return;
    await this.store.transaction('meta/host', (cur) => (cur === host || cur == null ? this.pid : undefined));
    this.hostMissingSince = null;
  }

  deckFor(r) {
    if (this.deckRound !== r.n || !this.deck) {
      // Fresh host (or a takeover): shuffle every card not yet shown this round.
      const seen = new Set(this.rules.seen(r));
      this.deck = shuffle(fullDeck().filter((c) => !seen.has(c)));
      this.deckRound = r.n;
    }
    return this.deck;
  }

  async dealOne(r, now) {
    const deck = this.deckFor(r);
    const card = deck.pop();
    if (!card) return;
    const step = this.rules.dealStep(r, card);
    const updates = { 'round/nextAt': now + (step.delay || this.cfg.dealMs) };
    for (const [k, v] of Object.entries(step.set)) updates[`round/${k}`] = v;
    if (step.done) {
      Object.assign(updates, {
        'round/phase': 'result',
        'round/winner': step.winner,
        'round/settled': false,
        'round/endsAt': now + this.cfg.resultMs,
        [`history/${r.n}`]: this.rules.mark(step.winner),
      });
      if (r.n > this.cfg.historyKeep) updates[`history/${r.n - this.cfg.historyKeep}`] = null;
    }
    await this.store.update(updates);
  }

  async settle(s, r) {
    const net = {};
    const payouts = [];
    const bets = Object.entries(s.bets || {})
      .filter(([, b]) => b && b.round === r.n)
      .map(([pid, b]) => ({ pid, side: b.side, amount: b.amount }));
    const pot = this.payMode() === 'pot' ? potPayouts(bets, r.winner) : null;
    for (const b of bets) {
      const back = pot ? pot[b.pid] : this.rules.payout(b, r.winner);
      net[b.pid] = back - b.amount;
      if (back > 0) payouts.push([b.pid, back]);
    }
    await this.store.update({ 'round/settled': true, 'round/net': Object.keys(net).length ? net : null });
    for (const [pid, back] of payouts) {
      await this.store.transaction(`players/${pid}/chips`, (c) => (c == null ? c : c + back));
    }
  }

  async newRound() {
    const now = this.now();
    const n = (this.round.n || 0) + 1;
    const deck = shuffle(fullDeck());
    const fields = this.rules.startRound(deck);
    this.deck = deck;
    this.deckRound = n;
    await this.store.update({
      round: { ...fields, n, phase: 'betting', startedAt: now, endsAt: now + this.cfg.betMs },
      bets: null,
    });
  }

  destroy() {
    clearInterval(this.timer);
    if (this.unsub) this.unsub();
    this.listeners.clear();
  }
}

// Solo-mode bots: a random coin on a side picked by the game's botSide().
export function runBot(client) {
  let lastRound = -1;
  const t = setInterval(async () => {
    const r = client.round;
    const me = client.me;
    if (!me || r.phase !== 'betting' || r.n === lastRound) return;
    lastRound = r.n;
    if (me.chips < client.minCoin()) { await client.refill(); return; }
    if (Math.random() < 0.15) return;
    setTimeout(async () => {
      const options = client.coinValues().slice(0, 3).filter((v) => v <= (client.me?.chips || 0));
      if (!options.length) return;
      const amount = options[Math.floor(Math.random() * options.length)];
      const side = client.rules.botSide();
      await client.placeBet(side, amount);
      if (Math.random() < 0.3) await client.placeBet(side, options[0]);
    }, 1200 + Math.random() * 6000);
  }, 400);
  return () => clearInterval(t);
}
