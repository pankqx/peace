import { installCardDefs, cardEl, rankOf } from './cards.js';
import { LocalStore, toList } from './store.js';
import { onlineReady, openFirebaseStore } from './firebase-store.js';
import { RoomClient, CONFIG, newRoom, makeCode, runBot, winAmount } from './games/andar-bahar/engine.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const RANK_WORD = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };
const rankWord = (code) => RANK_WORD[rankOf(code)] || rankOf(code);
const AVATAR_COLORS = ['#EFA53A', '#E5677F', '#7EC8C0', '#B9A3F0', '#F3DC9A', '#8FD07A', '#F29C6B', '#7FB2F0'];

// ---------- identity ----------
const store_ = (() => { try { return window.localStorage; } catch { return null; } })();
const remember = (k, v) => { try { store_ && store_.setItem(k, v); } catch {} };
const recall = (k) => { try { return store_ && store_.getItem(k); } catch { return null; } };
function playerId() {
  let id = recall('peace.pid');
  if (!id) {
    id = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    remember('peace.pid', id);
  }
  return id;
}
const PID = playerId();

// ---------- UI helpers ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function formMsg(msg) { $('form-msg').textContent = msg || ''; }
const avatarColor = (id) => AVATAR_COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- home ----------
function setupHome() {
  const hero = [['.hero-card--andar', 'QD', true], ['.hero-card--middle', 'KH', false], ['.hero-card--bahar', 'KS', false]];
  for (const [sel, code, down] of hero) {
    const c = cardEl(code, { faceDown: down });
    if (code === 'KS') c.classList.add('is-match');
    document.querySelector(sel).append(c);
  }
  $('name').value = recall('peace.name') || '';
  const params = new URLSearchParams(location.search);
  const code = (params.get('r') || '').toUpperCase();
  if (code) {
    $('code').value = code;
    formMsg('');
    $('form-msg').textContent = '';
  }

  $('entry').addEventListener('submit', async (e) => {
    e.preventDefault();
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

  // Arriving from a shared link with a saved name: join straight away.
  if (code && recall('peace.name') && onlineReady()) {
    enterOnline(code, recall('peace.name'), false).catch((err) => formMsg(err.message));
  } else if (code) {
    formMsg('');
    $('name').focus();
    $('form-msg').textContent = '';
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
    await store.create(newRoom(PID, name, store.now()));
  } else {
    store = await openFirebaseStore(code);
    if (!(await store.exists())) throw new Error(`No room called ${code}. Check the code and try again.`);
  }
  const client = new RoomClient(store, PID);
  await waitForState(client);
  await client.join(name);
  history.replaceState(null, '', `?r=${code}`);
  window.addEventListener('pagehide', () => store.leave(PID));
  startGame(client, { code, solo: false });
}

function waitForState(client) {
  return new Promise((res) => {
    if (client.state) return res();
    const off = client.onChange((s) => { if (s) { off(); res(); } });
  });
}

async function startSolo(name) {
  const store = new LocalStore(newRoom(PID, name, Date.now()));
  const client = new RoomClient(store, PID);
  const bots = [['bot-ravi', 'Ravi'], ['bot-anu', 'Anu'], ['bot-kabir', 'Kabir']].map(([id, n]) => {
    const b = new RoomClient(store, id);
    b.join(n, { bot: true });
    runBot(b);
    return b;
  });
  await waitForState(client);
  history.replaceState(null, '', '?solo');
  startGame(client, { code: 'SOLO', solo: true, bots });
  setTimeout(() => client.start(), 400);
}

// ---------- game ----------
function startGame(client, opts) {
  $('home').hidden = true;
  $('game').hidden = false;
  $('topbar-game').hidden = false;
  $('room-code').textContent = opts.solo ? 'Solo' : opts.code;
  document.title = opts.solo ? 'Solo — Andar Bahar' : `Room ${opts.code} — Andar Bahar`;
  window.scrollTo(0, 0);
  new GameView(client, opts);
}

class GameView {
  constructor(client, opts) {
    this.c = client;
    this.opts = opts;
    this.chip = Number(recall('peace.chip')) || 50;
    this.round = -1;
    this.middle = null;
    this.dealt = { andar: 0, bahar: 0 };
    this.lastChips = null;
    this.bannerRound = -1;
    this.buildChips();
    this.bind();
    client.onChange((s) => s && this.render(s));
    const loop = () => { this.tickTimer(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.addEventListener('resize', () => { this.layoutLane('andar'); this.layoutLane('bahar'); });
  }

  buildChips() {
    const row = $('chip-row');
    row.innerHTML = CONFIG.chipValues.map((v) =>
      `<button class="chip" type="button" role="radio" data-v="${v}" aria-checked="${v === this.chip}" aria-label="${v} chips"><span>${v}</span></button>`).join('') +
      `<button class="chip-clear" type="button" id="clear-btn" hidden>Clear bet</button>`;
  }

  bind() {
    $('chip-row').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip && !chip.disabled) {
        this.chip = Number(chip.dataset.v);
        remember('peace.chip', this.chip);
        $('chip-row').querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(b === chip)));
      }
      if (e.target.closest('#clear-btn')) this.c.clearBet();
    });
    document.querySelectorAll('.side').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const res = await this.c.placeBet(btn.dataset.side, this.chip);
        if (!res.ok) toast(res.reason);
        else if (navigator.vibrate) navigator.vibrate(12);
      }));
    $('share-btn').addEventListener('click', () => this.share());
    $('status-actions').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'start') this.c.start();
      if (a.dataset.act === 'deal') this.c.dealNow();
      if (a.dataset.act === 'share') this.share();
      if (a.dataset.act === 'refill') this.c.refill();
    });
  }

  async share() {
    if (this.opts.solo) { toast('Solo games can’t be shared. Create a room to play with friends.'); return; }
    const url = `${location.origin}${location.pathname}?r=${this.opts.code}`;
    const text = `Join my Andar Bahar table. Room code ${this.opts.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Andar Bahar', text, url }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(url); toast('Room link copied. Send it to your friends.'); }
    catch { toast(`Room code: ${this.opts.code}`); }
  }

  render(s) {
    const r = s.round || { n: 0, phase: 'lobby' };
    const me = s.players && s.players[PID];
    const myBet = this.c.myBet(s);

    // chips
    if (me) {
      $('my-chips').textContent = fmt(me.chips);
      if (this.lastChips !== null && me.chips > this.lastChips) {
        const bank = document.querySelector('.bank');
        bank.classList.remove('bump'); void bank.offsetWidth; bank.classList.add('bump');
      }
      this.lastChips = me.chips;
    }

    // new round: clear the table
    if (r.n !== this.round) {
      this.round = r.n;
      this.dealt = { andar: 0, bahar: 0 };
      $('cards-andar').innerHTML = '';
      $('cards-bahar').innerHTML = '';
      $('lane-andar').classList.remove('is-winner');
      $('lane-bahar').classList.remove('is-winner');
    }

    this.renderMiddle(r);
    this.renderDealt(r);
    this.renderStatus(s, r, me, myBet);
    this.renderSides(s, r, me, myBet);
    this.renderPlayers(s, r);
    this.renderHistory(s);

  }

  renderMiddle(r) {
    const slot = $('middle-slot');
    if (!r.middle) { slot.innerHTML = ''; this.middle = null; return; }
    if (this.middle === `${r.n}:${r.middle}`) return;
    this.middle = `${r.n}:${r.middle}`;
    slot.innerHTML = '';
    const card = cardEl(r.middle, { faceDown: true });
    slot.append(card);
    requestAnimationFrame(() => setTimeout(() => { card.classList.remove('is-down'); card.classList.add('shine'); }, 120));
  }

  renderDealt(r) {
    const cards = toList(r.cards);
    const lanes = { andar: [], bahar: [] };
    cards.forEach((c, i) => lanes[i % 2 === 0 ? 'andar' : 'bahar'].push([c, i]));
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
      this.layoutLane(side);
      const animate = fresh.length <= 2; // skip the flight when catching up on join
      const mid = $('middle-slot').getBoundingClientRect();
      for (const el of fresh) {
        if (animate) {
          const rc = el.getBoundingClientRect();
          el.style.setProperty('--fx', `${mid.left + mid.width / 2 - (rc.left + rc.width / 2)}px`);
          el.style.setProperty('--fy', `${mid.top + mid.height / 2 - (rc.top + rc.height / 2)}px`);
          el.classList.add('dealt');
          setTimeout(() => el.classList.remove('is-down'), 260);
        } else el.classList.remove('is-down');
      }
    }
    if (r.phase === 'result' && r.winner) {
      $(`lane-${r.winner}`).classList.add('is-winner');
      const win = document.querySelector(`.lane-cards .card[data-i="${r.winIndex}"]`);
      if (win) setTimeout(() => { win.classList.add('is-match', 'shine'); }, 300);
    }
  }

  layoutLane(side) {
    const box = $(`cards-${side}`);
    const cards = [...box.children];
    if (!cards.length) return;
    const W = box.clientWidth;
    const cw = cards[0].getBoundingClientRect().width || 56;
    const n = cards.length;
    const step = n > 1 ? Math.min(cw * 0.62, (W - cw) / (n - 1)) : 0;
    cards.forEach((c, i) => { c.style.left = `${Math.round(i * step)}px`; c.style.zIndex = i; });
  }

  renderStatus(s, r, me, myBet) {
    const main = $('status-main');
    const actions = $('status-actions');
    const host = this.c.isHost;
    let html = '', act = '';
    $('timer').hidden = r.phase !== 'betting';
    if (r.phase === 'lobby') {
      const count = Object.values(s.players || {}).filter((p) => p.online !== false).length;
      html = `Waiting for players<small>${count} at the table. Share the room code <b>${this.opts.code}</b> with friends.</small>`;
      act = (host ? `<button class="btn btn-gold btn-small" data-act="start">Start game</button>` : '') +
        `<button class="btn btn-ghost btn-small" data-act="share">Share link</button>`;
      if (!host) html += '<small>The host starts the game.</small>';
    } else if (r.phase === 'betting') {
      html = `Place your bets<small id="countdown">Bets close soon</small>`;
      if (host && !this.opts.solo) act = `<button class="btn btn-ghost btn-small" data-act="deal">Deal now</button>`;
      if (this.opts.solo && myBet) act = `<button class="btn btn-ghost btn-small" data-act="deal">Deal now</button>`;
    } else if (r.phase === 'dealing') {
      html = `Dealing…<small>First ${rankWord(r.middle)} wins</small>`;
    } else if (r.phase === 'result') {
      const title = `<span class="res-${r.winner}">${r.winner === 'andar' ? 'Andar' : 'Bahar'} wins</span>`;
      let sub = '<small>Next round in a moment</small>';
      if (r.settled && myBet) {
        const won = myBet.side === r.winner;
        const amt = won ? winAmount(myBet.side, myBet.amount) - myBet.amount : myBet.amount;
        sub = `<small class="${won ? 'res-win' : 'res-lose'}">${won ? `You won ${fmt(amt)} chips` : `You lost ${fmt(amt)} chips`}</small><small>Next round in a moment</small>`;
      } else if (r.settled) sub = '<small>You sat this one out. Next round in a moment.</small>';
      html = title + sub;
    }
    if (me && me.chips < CONFIG.chipValues[0] && !myBet && r.phase !== 'dealing') {
      act += `<button class="btn btn-gold btn-small" data-act="refill">Get ${CONFIG.refillChips} free chips</button>`;
    }
    if (main.dataset.k !== html) { main.innerHTML = html; main.dataset.k = html; }
    if (actions.dataset.k !== act) { actions.innerHTML = act; actions.dataset.k = act; }
  }

  tickTimer() {
    const r = this.c.round;
    if (r.phase !== 'betting') return;
    const left = Math.max(0, r.endsAt - this.c.now());
    const frac = Math.min(1, left / CONFIG.betMs);
    $('timer-fill').style.transform = `scaleX(${frac})`;
    $('timer').classList.toggle('is-low', left < 4000);
    const cd = document.getElementById('countdown');
    const secs = Math.ceil(left / 1000);
    if (cd && cd.dataset.s !== String(secs)) { cd.dataset.s = secs; cd.textContent = secs > 0 ? `Bets close in ${secs}s` : 'Bets closed'; }
    const open = this.c.canBet();
    document.querySelectorAll('.side').forEach((b) => (b.disabled = !open));
  }

  renderSides(s, r, me, myBet) {
    const open = this.c.canBet();
    const totals = { andar: 0, bahar: 0 }, counts = { andar: 0, bahar: 0 };
    for (const b of Object.values(s.bets || {})) {
      if (b && b.round === r.n) { totals[b.side] += b.amount; counts[b.side]++; }
    }
    for (const side of ['andar', 'bahar']) {
      const btn = document.querySelector(`.side--${side}`);
      btn.disabled = !open;
      const mine = myBet && myBet.side === side;
      btn.classList.toggle('is-mine', !!mine);
      $(`mine-${side}`).textContent = mine ? `Your bet: ${fmt(myBet.amount)}` : open ? (myBet ? 'Tap to switch' : 'Tap to bet') : '—';
      $(`total-${side}`).textContent = counts[side] ? `${counts[side]} ${counts[side] === 1 ? 'player' : 'players'}, ${fmt(totals[side])} chips` : '';
    }
    const chips = me ? me.chips : 0;
    $('chip-row').querySelectorAll('.chip').forEach((b) => (b.disabled = Number(b.dataset.v) > chips));
    $('clear-btn').hidden = !(myBet && open);
    $('bet-hint').textContent = !open
      ? (r.phase === 'lobby' ? 'Betting opens when the game starts.' : 'Bets are closed. Watch the cards!')
      : myBet ? 'Tap your side again to add more chips.' : 'Choose a chip, then tap a side.';
  }

  renderPlayers(s, r) {
    const list = Object.entries(s.players || {})
      .sort((a, b) => (b[1].online !== false) - (a[1].online !== false) || b[1].chips - a[1].chips);
    $('players').innerHTML = list.map(([id, p]) => {
      const b = s.bets && s.bets[id];
      let pill = '';
      if (r.phase === 'result' && r.settled && r.net && r.net[id] != null) {
        const n = r.net[id];
        pill = `<span class="pbet ${n > 0 ? 'win' : 'lose'}">${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}</span>`;
      } else if (b && b.round === r.n) {
        pill = `<span class="pbet ${b.side}">${b.side === 'andar' ? 'Andar' : 'Bahar'} ${fmt(b.amount)}</span>`;
      }
      const tags = [id === s.meta.host ? 'host' : '', p.bot ? 'bot' : '', p.online === false ? 'away' : ''].filter(Boolean).join(', ');
      return `<li class="player${id === PID ? ' is-me' : ''}${p.online === false ? ' is-off' : ''}">
        <span class="avatar" style="--a:${avatarColor(id)}">${esc((p.name || '?')[0].toUpperCase())}</span>
        <span><span class="player-name">${esc(p.name || 'Player')}${id === PID ? ' (you)' : ''}</span>
        <span class="player-meta">${fmt(p.chips)} chips${tags ? `, ${tags}` : ''}</span></span>
        ${pill}</li>`;
    }).join('');
  }

  renderHistory(s) {
    const h = s.history || {};
    const keys = Object.keys(h).map(Number).filter((k) => h[k]).sort((a, b) => a - b).slice(-20);
    $('history').innerHTML = keys.length
      ? keys.map((k) => `<li class="${h[k]}" title="Round ${k}: ${h[k] === 'A' ? 'Andar' : 'Bahar'}">${h[k]}</li>`).join('')
      : '<li class="history-empty">No rounds yet</li>';
  }

}

installCardDefs();
setupHome();
