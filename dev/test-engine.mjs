// Multiplayer simulation: 3 clients share one in-memory store, the host leaves mid-game.
// Run: node dev/test-engine.mjs
import { LocalStore, toList } from '../js/store.js';
import { RoomClient, BASE, newRoom, coinValuesFor, potPayouts } from '../js/games/core.js';
import { GAMES } from '../js/games/index.js';
import { rankOf } from '../js/cards.js';
import { cardValue } from '../js/games/dragon-tiger/rules.js';

Object.assign(BASE, { betMs: 600, minBetMs: 200, firstDealDelay: 20, resultMs: 150, hostTimeoutMs: 200 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

async function play(gameId, plan) {
  const rules = { ...GAMES[gameId], config: { dealMs: 20 } };
  const store = new LocalStore(newRoom(gameId, 'p1', 'Host', Date.now(), 1000, 'fixed'));
  const a = new RoomClient(store, 'p1', rules), b = new RoomClient(store, 'p2', rules), c = new RoomClient(store, 'p3', rules);
  await sleep(10);
  await b.join('Bee'); await c.join('Cee');
  await a.start();
  const errors = [];
  let rounds = 0, lastN = 0;
  for (let k = 0; k < 6000 && rounds < 10; k++) {
    await sleep(20);
    const r = store.state.round;
    if (r.phase !== 'betting' || r.n === lastN) continue;
    lastN = r.n;
    const before = Object.fromEntries(Object.entries(store.state.players).map(([id, p]) => [id, p.chips]));
    const [sa, sb, sc] = plan(rounds);
    if (rounds !== 5) { await a.placeBet(sa, 100); await a.placeBet(sa, 50); }
    await b.placeBet(sc, 10); await b.placeBet(sb, 10); // second call moves the bet
    if (rounds === 5) { store.state.players.p1.online = false; await store.update({}); a.destroy(); }
    await c.placeBet(sc, 50);
    await sleep(5);
    const bets = JSON.parse(JSON.stringify(store.state.bets || {}));
    if (bets.p2 && (bets.p2.side !== sb || bets.p2.amount !== 10)) errors.push('move bet failed');
    let res;
    for (let j = 0; j < 2000; j++) { await sleep(15); res = store.state.round; if (res.phase === 'result' && res.settled) break; }
    await sleep(40);
    // game-specific correctness
    if (gameId === 'andar-bahar') {
      const cards = toList(res.cards);
      if (rankOf(cards.at(-1)) !== rankOf(res.middle)) errors.push('last card not a match');
      if (cards.slice(0, -1).some((x) => rankOf(x) === rankOf(res.middle))) errors.push('missed an earlier match');
      if ((res.winIndex % 2 === 0 ? 'andar' : 'bahar') !== res.winner) errors.push('wrong winner side');
    } else {
      const d = cardValue(res.dragon), t = cardValue(res.tiger);
      const want = d > t ? 'dragon' : t > d ? 'tiger' : 'tie';
      if (want !== res.winner) errors.push(`wrong DT winner ${res.dragon} ${res.tiger} ${res.winner}`);
    }
    for (const [pid, bet] of Object.entries(bets)) {
      const want = before[pid] - bet.amount + rules.payout(bet, res.winner);
      if (store.state.players[pid].chips !== want) errors.push(`coins wrong for ${pid} in round ${res.n}: ${store.state.players[pid].chips} vs ${want}`);
    }
    rounds++;
    console.log(`  ${gameId} round ${res.n}: ${res.winner} wins, host=${store.state.meta.host}, coins ${Object.values(store.state.players).map((p) => p.chips).join('/')}`);
  }
  [a, b, c].forEach((x) => x.destroy());
  if (store.state.meta.host !== 'p2') errors.push('host takeover did not happen');
  console.log(errors.length ? `${gameId}: FAILED\n  ` + errors.join('\n  ') : `${gameId}: all checks passed (${rounds} rounds)`);
  failed += errors.length;
}

// Players vs players: winners split the losers' coins.
{
  const errs = [];
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) errs.push(`${msg}: ${JSON.stringify(a)}`); };
  eq(potPayouts([{ pid: 'me', side: 'andar', amount: 100 }, { pid: 'op', side: 'bahar', amount: 100 }], 'andar'), { me: 200, op: 0 }, 'one vs one');
  eq(potPayouts([{ pid: 'me', side: 'andar', amount: 100 }, { pid: 'op', side: 'bahar', amount: 100 }], 'bahar'), { me: 0, op: 200 }, 'one vs one, I lose');
  eq(potPayouts([{ pid: 'a', side: 'andar', amount: 300 }, { pid: 'b', side: 'andar', amount: 100 }, { pid: 'c', side: 'bahar', amount: 200 }], 'andar'), { a: 450, b: 150, c: 0 }, 'split by stake');
  eq(potPayouts([{ pid: 'a', side: 'andar', amount: 50 }, { pid: 'b', side: 'andar', amount: 50 }], 'bahar'), { a: 50, b: 50 }, 'nobody won, refund');
  eq(potPayouts([{ pid: 'a', side: 'dragon', amount: 50 }, { pid: 'b', side: 'tiger', amount: 30 }, { pid: 'c', side: 'tie', amount: 10 }], 'tie'), { a: 0, b: 0, c: 90 }, 'tie takes all');
  // coins are conserved with awkward splits
  for (let t = 0; t < 300; t++) {
    const bets = Array.from({ length: 2 + (t % 7) }, (_, i) => ({ pid: 'p' + i, side: Math.random() < 0.5 ? 'andar' : 'bahar', amount: 10 * (1 + Math.floor(Math.random() * 37)) }));
    const out = potPayouts(bets, 'andar');
    const inSum = bets.reduce((x, b) => x + b.amount, 0), outSum = Object.values(out).reduce((x, v) => x + v, 0);
    if (inSum !== outSum) { errs.push(`coins not conserved ${inSum} vs ${outSum}`); break; }
  }
  // the engine uses pot mode end to end
  const rules = { ...GAMES['dragon-tiger'], config: { dealMs: 20 } };
  const store = new LocalStore(newRoom('dragon-tiger', 'a', 'A', Date.now(), 1000, 'pot'));
  const A = new RoomClient(store, 'a', rules), B = new RoomClient(store, 'b', rules);
  await sleep(10); await B.join('B'); await A.start(); await sleep(10);
  await A.placeBet('dragon', 100); await B.placeBet('tiger', 100);
  for (let j = 0; j < 400; j++) { await sleep(15); if (store.state.round.phase === 'result' && store.state.round.settled) break; }
  await sleep(30);
  const w = store.state.round.winner, ca = store.state.players.a.chips, cb = store.state.players.b.chips;
  const want = w === 'dragon' ? [1100, 900] : w === 'tiger' ? [900, 1100] : [1000, 1000];
  if (ca !== want[0] || cb !== want[1]) errs.push(`pot round wrong: ${w} ${ca}/${cb}`);
  if (ca + cb !== 2000) errs.push('room total changed in pot mode');
  [A, B].forEach((x) => x.destroy());
  console.log(errs.length ? 'players vs players: FAILED\n  ' + errs.join('\n  ') : `players vs players: all checks passed (${w} won, ${ca}/${cb})`);
  failed += errs.length;
}

// Starting coins chosen by the room creator.
{
  const rules = GAMES['andar-bahar'];
  const store = new LocalStore(newRoom('andar-bahar', 'h', 'Host', Date.now(), 5000));
  const h = new RoomClient(store, 'h', rules), g = new RoomClient(store, 'g', rules);
  await sleep(10);
  await g.join('Guest');
  const errs = [];
  if (store.state.players.g.chips !== 5000) errs.push('joiner did not get 5,000');
  if (g.coinValues().join() !== coinValuesFor(5000).join()) errs.push('coin values not scaled');
  if (!(await g.setStartCoins(200))) {} else errs.push('non-host changed start coins');
  await h.setStartCoins(2000);
  await sleep(5);
  if (store.state.meta.startCoins !== 2000 || store.state.players.g.chips !== 2000 || store.state.players.h.chips !== 2000) errs.push('lobby reset failed');
  await h.start();
  await sleep(5);
  if (await h.setStartCoins(9000)) errs.push('start coins changed after game started');
  const def = new LocalStore(newRoom('andar-bahar', 'x', 'X', Date.now()));
  if (def.state.players.x.chips !== 1000) errs.push('default is not 1,000');
  const huge = new LocalStore(newRoom('andar-bahar', 'y', 'Y', Date.now(), 99999999));
  if (huge.state.players.y.chips !== 1000000) errs.push('not capped at 10,00,000');
  [h, g].forEach((x) => x.destroy());
  console.log(errs.length ? 'starting coins: FAILED\n  ' + errs.join('\n  ') : 'starting coins: all checks passed');
  failed += errs.length;
}

await play('andar-bahar', () => ['andar', 'bahar', 'andar']);
await play('dragon-tiger', (i) => [['dragon', 'tiger', 'tie'][i % 3], 'tiger', 'dragon']);
process.exit(failed ? 1 : 0);
