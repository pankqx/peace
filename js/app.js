import { installCardDefs, cardEl } from './cards.js';
import { LocalStore } from './store.js';
import { onlineReady, openFirebaseStore } from './firebase-store.js';
import { RoomClient, newRoom, makeCode, runBot, clampStart } from './games/core.js';
import { GAMES, GAME_LIST } from './games/index.js';
import { VIEWS } from './views.js';
import { sound, flyCoin, coinBurst, flash } from './fx.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const AVATAR_COLORS = ['#EFA53A', '#E5677F', '#7EC8C0', '#B9A3F0', '#F3DC9A', '#8FD07A', '#F29C6B', '#7FB2F0'];
const SIDE_MARK = { A: 'andar', B: 'bahar', D: 'dragon', T: 'tiger', '=': 'tie' };

// ---------- identity ----------
const ls = (() => { try { return window.localStorage; } catch { return null; } })();
const remember = (k, v) => { try { ls && ls.setItem(k, v); } catch {} };
const recall = (k) => { try { return ls && ls.getItem(k); } catch { return null; } };
function playerId() {
  let id = recall('peace.pid');
  if (!id) {
    id = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    remember('peace.pid', id);
  }
  return id;
}
const PID = playerId();

// ---------- helpers ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
const formMsg = (msg) => { $('form-msg').textContent = msg || ''; };
const avatarColor = (id) => AVATAR_COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- home ----------
const HERO = {
  'andar-bahar': [['QD', true], ['KH', false], ['KS', false, 'is-match']],
  'dragon-tiger': [['KH', false, 'is-match'], ['', true], ['7S', false]],
};
let selectedGame = GAMES[recall('peace.game')] ? recall('peace.game') : 'andar-bahar';
const START_PRESETS = [500, 1000, 2000, 5000, 10000];
let startCoins = clampStart(recall('peace.start') || 1000);
let payMode = recall('peace.mode') === 'fixed' ? 'fixed' : 'pot';
const MODE_NOTE = {
  pot: 'Players vs players: winners take the losers’ coins, shared by how much each bet. If nobody wins, everyone gets their coins back.',
  fixed: 'The bank pays fixed amounts, like 2× on a win. Nobody loses coins to another player.',
};
const MODE_SHORT = { pot: 'players pay', fixed: 'bank pays' };

function updateSettingsLabel() {
  $('start-label').textContent = `${fmt(startCoins)} coins, ${MODE_SHORT[payMode]}`;
}

function setMode(m) {
  payMode = m === 'fixed' ? 'fixed' : 'pot';
  remember('peace.mode', payMode);
  $('mode-pills').querySelectorAll('.start-pill').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === payMode)));
  $('mode-note').textContent = MODE_NOTE[payMode];
  updateSettingsLabel();
  showGameInfo(selectedGame);
}

function payNoteFor(rules, mode) {
  return mode === 'pot' ? MODE_NOTE.pot : rules.payNote;
}
const coinLabel = (v) => (v >= 1000 && v % 1000 === 0 ? `${v / 1000}K` : String(v));

function setStart(v, fromCustom = false) {
  startCoins = clampStart(v);
  remember('peace.start', startCoins);
  updateSettingsLabel();
  $('start-pills').querySelectorAll('.start-pill').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.v) === startCoins)));
  if (!fromCustom) $('start-custom').value = START_PRESETS.includes(startCoins) ? '' : startCoins;
}

function setupStartCoins() {
  $('start-pills').innerHTML = START_PRESETS.map((v) =>
    `<button class="start-pill" type="button" role="radio" data-v="${v}" aria-checked="false">${fmt(v)}</button>`).join('');
  $('start-pills').addEventListener('click', (e) => {
    const b = e.target.closest('.start-pill');
    if (b) setStart(Number(b.dataset.v));
  });
  $('start-custom').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= 1) setStart(v, true);
  });
  $('start-custom').addEventListener('change', (e) => { if (e.target.value) setStart(e.target.value); });
  $('mode-pills').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  setStart(startCoins);
  setMode(payMode);
}

function showGameInfo(id) {
  const g = GAMES[id];
  selectedGame = id;
  remember('peace.game', id);
  $('game-title').textContent = g.name;
  $('game-lede').textContent = g.tagline;
  $('steps').innerHTML = g.steps.map(([b, t]) => `<li><b>${b}</b> ${t}</li>`).join('');
  $('pay-note').textContent = `${payNoteFor(g, payMode)} Coins are just for fun — no real money.`;
  $('picker').querySelectorAll('.pick').forEach((p) => p.setAttribute('aria-checked', String(p.dataset.game === id)));
  const slots = document.querySelectorAll('#hero-table .hero-card');
  HERO[id].forEach(([code, down, cls], i) => {
    slots[i].innerHTML = '';
    if (!code && down) { slots[i].append(cardEl('', { faceDown: true })); return; }
    const c = cardEl(code, { faceDown: down });
    if (cls) c.classList.add(cls);
    slots[i].append(c);
  });
  $('hero-table').dataset.game = id;
}

function setupHome() {
  $('picker').innerHTML = GAME_LIST.map((g) => `
    <button class="pick pick--${g.id}" type="button" role="radio" data-game="${g.id}" aria-checked="false">
      <span class="pick-name">${g.name}</span>
      <span class="pick-sub">${g.sides.map((s) => s.label).join(', ')}</span>
    </button>`).join('');
  $('picker').addEventListener('click', (e) => {
    const p = e.target.closest('.pick');
    if (p) showGameInfo(p.dataset.game);
  });
  showGameInfo(selectedGame);
  setupStartCoins();

  $('name').value = recall('peace.name') || '';
  const params = new URLSearchParams(location.search);
  const code = (params.get('r') || '').toUpperCase();
  if (code) $('code').value = code;

  $('entry').addEventListener('submit', async (e) => {
    e.preventDefault();
    sound.unlock();
    const action = e.submitter ? e.submitter.dataset.action : 'create';
    const name = $('name').value.trim().slice(0, 16);
    if (!name) { formMsg('Type your name first.'); $('name').focus(); return; }
    remember('peace.name', name);
    if (action === 'solo') return startSolo(name);
    if (!onlineReady()) { formMsg('Online rooms are not switched on yet. Try solo practice for now.'); return; }
    const btns = e.currentTarget.querySelectorAll('button');
    btns.forEach((b) => (b.disabled = true));
    try {
      if (action === 'join') {
        const c = $('code').value.trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(c)) { formMsg('Room codes are 4 letters, like ABCD.'); return; }
        await enterOnline(c, name, false);
      } else {
        await enterOnline(null, name, true);
      }
    } catch (err) {
      console.error(err);
      formMsg(err.message || 'Could not connect. Check your internet and try again.');
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  });

  if (code && recall('peace.name') && onlineReady()) {
    enterOnline(code, recall('peace.name'), false).catch((err) => formMsg(err.message));
  } else if (code) {
    $('name').focus();
    toast(`Type your name and tap Join to enter room ${code}.`);
  }
}

async function enterOnline(code, name, create) {
  formMsg('');
  let store;
  if (create) {
    for (let i = 0; i < 6; i++) {
      code = makeCode();
      store = await openFirebaseStore(code);
      if (!(await store.exists())) break;
    }
    await store.create(newRoom(selectedGame, PID, name, store.now(), startCoins, payMode));
  } else {
    store = await openFirebaseStore(code);
    if (!(await store.exists())) throw new Error(`No room called ${code}. Check the code and try again.`);
  }
  const room = await store.read();
  const rules = GAMES[(room && room.meta && room.meta.game) || 'andar-bahar'] || GAMES['andar-bahar'];
  const client = new RoomClient(store, PID, rules);
  await waitForState(client);
  await client.join(name);
  history.replaceState(null, '', `?r=${code}`);
  window.addEventListener('pagehide', () => store.leave(PID));
  startGame(client, { code, solo: false, store });
}

function waitForState(client) {
  return new Promise((res) => {
    if (client.state) return res();
    const off = client.onChange((s) => { if (s) { off(); res(); } });
  });
}

async function startSolo(name) {
  const rules = GAMES[selectedGame];
  const store = new LocalStore(newRoom(rules.id, PID, name, Date.now(), startCoins, payMode));
  const client = new RoomClient(store, PID, rules);
  const bots = [['bot-ravi', 'Ravi'], ['bot-anu', 'Anu'], ['bot-kabir', 'Kabir']].map(([id, n]) => {
    const b = new RoomClient(store, id, rules);
    b.join(n, { bot: true });
    b.stopBot = runBot(b);
    return b;
  });
  await waitForState(client);
  history.replaceState(null, '', '?solo');
  startGame(client, { code: 'SOLO', solo: true, bots, store });
  setTimeout(() => client.start(), 400);
}

function startGame(client, opts) {
  $('home').hidden = true;
  $('game').hidden = false;
  $('topbar-game').hidden = false;
  document.body.classList.add('in-game');
  $('room-game').textContent = client.rules.name;
  $('room-code').textContent = opts.solo ? 'Solo' : opts.code;
  document.title = opts.solo ? `Solo — ${client.rules.name}` : `Room ${opts.code} — ${client.rules.name}`;
  window.scrollTo(0, 0);
  new GameView(client, opts);
}

// ---------- game screen ----------
class GameView {
  constructor(client, opts) {
    this.c = client;
    this.rules = client.rules;
    this.opts = opts;
    this.cfg = client.cfg;
    this.chip = Number(recall('peace.chip')) || 50;
    this.start = null;
    this.view = new VIEWS[this.rules.id]($('table'), this.rules);
    this.lastChips = null;
    this.resultRound = -1;
    this.lastTick = null;
    this.lastPhase = null;
    $('game').dataset.game = this.rules.id;
    this.buildSides();
    this.bind();
    client.onChange((s) => s && this.render(s));
    const loop = () => { this.tickTimer(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.syncMute();
  }

  buildSides() {
    $('sides').style.setProperty('--n', this.rules.sides.length);
    $('sides').innerHTML = this.rules.sides.map((sd) => `
      <button class="side side--${sd.id}" type="button" data-side="${sd.id}">
        <span class="side-name">${sd.label}</span>
        <span class="side-pays" data-pays="${sd.id}">pays ${sd.pays}</span>
        <span class="side-mine" id="mine-${sd.id}"></span>
        <span class="bettors" data-bettors="${sd.id}"></span>
      </button>`).join('');
  }

  buildChips() {
    const values = this.c.coinValues();
    if (!values.includes(this.chip)) this.chip = values[1];
    $('chip-row').innerHTML = values.map((v, i) =>
      `<button class="coin" type="button" role="radio" data-v="${v}" data-t="${i}" aria-checked="${v === this.chip}" aria-label="${fmt(v)} coins"><span>${coinLabel(v)}</span></button>`).join('') +
      `<button class="chip-clear" type="button" id="clear-btn" hidden>Clear bet</button>`;
  }

  bind() {
    $('chip-row').addEventListener('click', (e) => {
      const coin = e.target.closest('.coin');
      if (coin && !coin.disabled) {
        this.chip = Number(coin.dataset.v);
        remember('peace.chip', this.chip);
        $('chip-row').querySelectorAll('.coin').forEach((b) => b.setAttribute('aria-checked', String(b === coin)));
        sound.play('tick');
      }
      if (e.target.closest('#clear-btn')) { this.c.clearBet(); sound.play('coin'); }
    });
    const betOn = async (target) => {
      const side = target.dataset.side;
      if (!this.c.canBet()) { toast(this.c.round.phase === 'lobby' ? 'Betting opens when the game starts.' : 'Bets are closed. Wait for the next round.'); return; }
      const res = await this.c.placeBet(side, this.chip);
      if (!res.ok) { toast(res.reason); return; }
      sound.play('coin');
      const coinBtn = $('chip-row').querySelector(`.coin[data-v="${this.chip}"]`);
      if (!res.moved) flyCoin(coinBtn, target, coinBtn ? coinBtn.dataset.t : 2);
      if (navigator.vibrate) navigator.vibrate(12);
    };
    document.addEventListener('click', (e) => {
      const t = e.target.closest('#game [data-side]');
      if (t) betOn(t);
    });
    document.addEventListener('keydown', (e) => {
      const t = e.target.closest && e.target.closest('#table [data-side]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); betOn(t); }
    });
    $('share-btn').addEventListener('click', () => this.share());
    $('mute-btn').addEventListener('click', () => { sound.toggle(); this.syncMute(); });
    $('leave-btn').addEventListener('click', () => this.leave());
    $('table').addEventListener('change', (e) => {
      if (e.target.id === 'start-select') this.c.setStartCoins(Number(e.target.value));
      if (e.target.id === 'mode-select') this.c.setPayMode(e.target.value);
    });
    $('table').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      e.stopPropagation();
      if (a.dataset.act === 'start') this.c.start();
      if (a.dataset.act === 'deal') this.c.dealNow();
      if (a.dataset.act === 'share') this.share();
      if (a.dataset.act === 'refill') this.c.refill();
    });
  }

  syncMute() {
    const m = sound.muted;
    $('mute-btn').setAttribute('aria-pressed', String(m));
    $('mute-btn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    $('mute-btn').classList.toggle('is-muted', m);
  }

  async leave() {
    const bet = this.c.myBet();
    if (bet && this.c.round.phase !== 'result' && !confirm('Leave the room? Your coins on the table this round stay there.')) return;
    if (this.opts.bots) this.opts.bots.forEach((b) => { b.stopBot && b.stopBot(); b.destroy(); });
    await this.c.leave();
    if (this.opts.store && this.opts.store.leave) this.opts.store.leave(PID);
    location.href = location.pathname;
  }

  async share() {
    if (this.opts.solo) { toast('Solo games can’t be shared. Create a room to play with friends.'); return; }
    const url = `${location.origin}${location.pathname}?r=${this.opts.code}`;
    const text = `Join my ${this.rules.name} table. Room code ${this.opts.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: this.rules.name, text, url }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(url); toast('Room link copied. Send it to your friends.'); }
    catch { toast(`Room code: ${this.opts.code}`); }
  }

  render(s) {
    const r = s.round || { n: 0, phase: 'lobby' };
    const me = s.players && s.players[PID];
    const myBet = this.c.myBet(s);
    if (this.mode !== this.c.payMode()) {
      const changed = this.mode != null;
      this.mode = this.c.payMode();
      $('rules-mini').textContent = `${this.rules.steps.map(([b]) => b).join(' ')} ${payNoteFor(this.rules, this.mode)}`;
      if (changed) toast(this.mode === 'pot' ? 'Players vs players: winners take the losers’ coins.' : 'The bank pays winners fixed amounts.');
    }
    if (this.start !== this.c.startCoins()) {
      const changed = this.start !== null;
      this.start = this.c.startCoins();
      this.buildChips();
      if (changed) toast(`Starting coins set to ${fmt(this.start)}. Everyone has been reset.`);
    }

    if (me) {
      $('my-chips').textContent = fmt(me.chips);
      this.lastChips = me.chips;
    }

    if (r.phase === 'betting' && this.lastPhase !== 'betting') sound.play('start');
    this.lastPhase = r.phase;

    const ev = this.view.render(s, r);
    if (ev.dealt) sound.play('deal');
    if (ev.flipped) setTimeout(() => sound.play('flip'), 140);
    if (ev.match) setTimeout(() => sound.play('match'), 250);

    this.renderStatus(s, r, me, myBet);
    this.renderSides(s, r, me, myBet);
    this.renderBettors(s, r);
    this.renderPays(s, r);
    this.renderPlayers(s, r);
    this.renderHistory(s);

    if (r.phase === 'result' && r.settled && this.resultRound !== r.n) {
      this.resultRound = r.n;
      flash($('table'), this.rules.winText(r.winner), `flash--${r.winner}`);
      const myNet = r.net && r.net[PID];
      if (myBet && myNet != null) {
        setTimeout(() => sound.play(myNet > 0 ? 'win' : myNet === 0 ? 'coin' : 'lose'), 350);
        if (myNet > 0) {
          coinBurst(this.view.flashTarget(), $('bank'), 16);
          const bank = $('bank');
          setTimeout(() => { bank.classList.remove('bump'); void bank.offsetWidth; bank.classList.add('bump'); }, 1000);
        }
      }
    }
  }

  renderStatus(s, r, me, myBet) {
    const main = $('status-main');
    const actions = $('status-actions');
    if (!main) return;
    const host = this.c.isHost;
    let html = '', act = '';
    $('timer').hidden = r.phase !== 'betting';
    if (r.phase === 'lobby') {
      const count = Object.values(s.players || {}).filter((p) => p.online !== false).length;
      const start = this.c.startCoins();
      html = `Waiting for players<small>${count} at the table. Share the room code <b>${esc(this.opts.code)}</b> with friends.</small><small>Everyone starts with ${fmt(start)} coins.</small>`;
      const presets = [...new Set([...START_PRESETS, start])].sort((a, b) => a - b);
      const mode = this.c.payMode();
      html += `<small>${mode === 'pot' ? 'Players vs players: winners take the losers’ coins.' : 'The bank pays winners fixed amounts.'}</small>`;
      act = (host ? `<button class="btn btn-gold btn-small" data-act="start">Start game</button>
        <label class="start-edit"><span>Winners paid by</span><select id="mode-select" aria-label="Who pays the winners">
        <option value="pot"${mode === 'pot' ? ' selected' : ''}>Other players</option>
        <option value="fixed"${mode === 'fixed' ? ' selected' : ''}>The bank</option></select></label>
        <label class="start-edit"><span>Starting coins</span><select id="start-select" aria-label="Starting coins for each player">
        ${presets.map((v) => `<option value="${v}"${v === start ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select></label>` : '') +
        `<button class="btn btn-ghost btn-small" data-act="share">Share link</button>`;
      if (!host) html += '<small>The host starts the game.</small>';
    } else if (r.phase === 'betting') {
      html = `Place your bets<small id="countdown">Bets close soon</small>`;
      if ((host && !this.opts.solo) || (this.opts.solo && myBet)) act = `<button class="btn btn-ghost btn-small" data-act="deal">Deal now</button>`;
    } else if (r.phase === 'dealing') {
      html = `Dealing…<small>${esc(this.rules.dealingText(r))}</small>`;
    } else if (r.phase === 'result') {
      let sub = '<small>Next round in a moment</small>';
      if (r.settled && myBet && r.net && r.net[PID] != null) {
        const net = r.net[PID];
        const line = net > 0 ? `You won ${fmt(net)} coins` : net === 0 ? 'Your coins came back' : `You lost ${fmt(-net)} coins`;
        sub = `<small class="${net > 0 ? 'res-win' : net < 0 ? 'res-lose' : ''}">${line}</small><small>Next round in a moment</small>`;
      } else if (r.settled) sub = '<small>You sat this one out. Next round in a moment.</small>';
      html = `<span class="res res--${r.winner}">${esc(this.rules.winText(r.winner))}</span>${sub}`;
    }
    if (me && me.chips < this.c.minCoin() && !myBet && r.phase !== 'dealing') {
      act += `<button class="btn btn-gold btn-small" data-act="refill">Get ${fmt(this.c.refillAmount())} free coins</button>`;
    }
    if (main.dataset.k !== html) { main.innerHTML = html; main.dataset.k = html; }
    if (actions.dataset.k !== act) { actions.innerHTML = act; actions.dataset.k = act; }
  }

  tickTimer() {
    const r = this.c.round;
    const open = this.c.canBet();
    document.body.classList.toggle('bets-open', open);
    if (r.phase !== 'betting') { this.lastTick = null; return; }
    const left = Math.max(0, r.endsAt - this.c.now());
    const fill = $('timer-fill');
    if (fill) fill.style.transform = `scaleX(${Math.min(1, left / this.cfg.betMs)})`;
    const timer = $('timer');
    if (timer) timer.classList.toggle('is-low', left < 4000);
    const secs = Math.ceil(left / 1000);
    const cd = document.getElementById('countdown');
    if (cd && cd.dataset.s !== String(secs)) { cd.dataset.s = secs; cd.textContent = secs > 0 ? `Bets close in ${secs}s` : 'Bets closed'; }
    if (secs <= 3 && secs > 0 && this.lastTick !== secs) { this.lastTick = secs; sound.play('tick'); }
    document.querySelectorAll('.side').forEach((b) => (b.disabled = !open));
  }

  renderSides(s, r, me, myBet) {
    const open = this.c.canBet();
    for (const sd of this.rules.sides) {
      const mine = myBet && myBet.side === sd.id;
      document.querySelectorAll(`[data-side="${sd.id}"]`).forEach((el) => el.classList.toggle('is-mine', !!mine));
      const btn = document.querySelector(`.side--${sd.id}`);
      if (btn) btn.disabled = !open;
      const m = $(`mine-${sd.id}`);
      if (m) m.textContent = mine ? `Your bet: ${fmt(myBet.amount)}` : '';
    }
    const coins = me ? me.chips : 0;
    $('chip-row').querySelectorAll('.coin').forEach((b) => (b.disabled = Number(b.dataset.v) > coins));
    $('clear-btn').hidden = !(myBet && open);
    $('bet-hint').textContent = !open
      ? (r.phase === 'lobby' ? 'Betting opens when the game starts.' : 'Bets are closed. Watch the cards!')
      : myBet ? 'Tap your side again to add more coins.' : 'Choose a coin, then tap a side.';
  }

  // Shows who bet where, right on the betting spots.
  renderBettors(s, r) {
    const by = {};
    for (const [id, b] of Object.entries(s.bets || {})) {
      if (!b || b.round !== r.n) continue;
      (by[b.side] = by[b.side] || []).push([id, b.amount]);
    }
    const net = (r.phase === 'result' && r.settled && r.net) || null;
    for (const sd of this.rules.sides) {
      const list = (by[sd.id] || []).sort((a, b) => (b[0] === PID) - (a[0] === PID) || b[1] - a[1]);
      const total = list.reduce((t, [, a]) => t + a, 0);
      const pills = list.slice(0, 5).map(([id, amt]) => {
        const p = (s.players && s.players[id]) || {};
        const n = net && net[id] != null ? net[id] : null;
        const tail = n == null ? fmt(amt) : n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0';
        return `<span class="bettor${id === PID ? ' is-me' : ''}${n > 0 ? ' won' : n < 0 ? ' lost' : ''}">
          <i style="--a:${avatarColor(id)}">${esc((p.name || '?')[0].toUpperCase())}</i>${esc(id === PID ? 'You' : p.name || 'Player')} <b>${tail}</b></span>`;
      }).join('') + (list.length > 5 ? `<span class="bettor more">+${list.length - 5}</span>` : '') +
        (list.length ? `<span class="bettor total">${fmt(total)}</span>` : '');
      document.querySelectorAll(`[data-bettors="${sd.id}"]`).forEach((el) => {
        if (el.dataset.k !== pills) { el.innerHTML = pills; el.dataset.k = pills; }
      });
    }
  }

  // Fixed mode shows the game's odds. Players-vs-players shows what a win would pay right now.
  renderPays(s, r) {
    const mode = this.c.payMode();
    const totals = {};
    let all = 0;
    for (const b of Object.values(s.bets || {})) {
      if (!b || b.round !== r.n) continue;
      totals[b.side] = (totals[b.side] || 0) + b.amount;
      all += b.amount;
    }
    for (const sd of this.rules.sides) {
      let text = `pays ${sd.pays}`;
      if (mode === 'pot') {
        const mine = totals[sd.id] || 0;
        if (!all) text = 'winners take the pot';
        else if (!mine) text = `win up to ${fmt(all)}`;
        else text = `pays ×${(all / mine).toFixed(2).replace(/\.?0+$/, '')} now`;
      }
      document.querySelectorAll(`[data-pays="${sd.id}"]`).forEach((el) => { if (el.textContent !== text) el.textContent = text; });
    }
  }

  renderPlayers(s, r) {
    const list = Object.entries(s.players || {})
      .sort((a, b) => (b[1].online !== false) - (a[1].online !== false) || b[1].chips - a[1].chips);
    const html = list.map(([id, p]) => {
      const b = s.bets && s.bets[id];
      let pill = '';
      if (r.phase === 'result' && r.settled && r.net && r.net[id] != null) {
        const n = r.net[id];
        pill = `<span class="pbet ${n > 0 ? 'win' : n < 0 ? 'lose' : ''}">${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}</span>`;
      } else if (b && b.round === r.n) {
        const sd = this.rules.sides.find((x) => x.id === b.side);
        pill = `<span class="pbet side-${b.side}">${sd ? sd.label : b.side} ${fmt(b.amount)}</span>`;
      }
      const tags = [id === s.meta.host ? 'dealer' : '', p.bot ? 'bot' : '', p.online === false ? 'away' : ''].filter(Boolean).join(', ');
      return `<li class="player${id === PID ? ' is-me' : ''}${p.online === false ? ' is-off' : ''}">
        <span class="avatar" style="--a:${avatarColor(id)}">${esc((p.name || '?')[0].toUpperCase())}</span>
        <span class="player-text"><span class="player-name">${esc(p.name || 'Player')}${id === PID ? ' (you)' : ''}</span>
        <span class="player-meta"><span class="mini-coin"></span>${fmt(p.chips)}${tags ? `, ${tags}` : ''}</span></span>
        ${pill}</li>`;
    }).join('');
    if ($('players').dataset.k !== html) { $('players').innerHTML = html; $('players').dataset.k = html; }
  }

  renderHistory(s) {
    const h = s.history || {};
    const keys = Object.keys(h).map(Number).filter((k) => h[k]).sort((a, b) => a - b).slice(-24);
    const html = keys.length
      ? keys.map((k) => `<li class="mark-${SIDE_MARK[h[k]] || 'x'}" title="Round ${k}: ${this.rules.markLabel[h[k]] || h[k]}">${h[k]}</li>`).join('')
      : '<li class="history-empty">No rounds yet</li>';
    if ($('history').dataset.k !== html) { $('history').innerHTML = html; $('history').dataset.k = html; }
  }
}

installCardDefs();
setupHome();
