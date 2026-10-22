import { LocalStore, toList } from '../js/store.js';
import { RoomClient, CONFIG, newRoom, winAmount } from '../js/games/andar-bahar/engine.js';
import { rankOf } from '../js/cards.js';
Object.assign(CONFIG, { betMs: 600, minBetMs: 200, dealMs: 20, firstDealDelay: 20, resultMs: 150, hostTimeoutMs: 200 });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const store = new LocalStore(newRoom('p1', 'Host', Date.now()));
const a = new RoomClient(store, 'p1'), b = new RoomClient(store, 'p2'), c = new RoomClient(store, 'p3');
await sleep(10);
await b.join('Bee'); await c.join('Cee');
await a.start();
let rounds = 0, errors = [];
const total = () => Object.values(store.state.players).reduce((s, p) => s + p.chips, 0);
let lastN = 0;
for (let k = 0; k < 4000 && rounds < 10; k++) {
  await sleep(25);
  const r = store.state.round;
  if (r.phase === 'betting' && r.n !== lastN) {
    lastN = r.n;
    const before = { ...Object.fromEntries(Object.entries(store.state.players).map(([k, p]) => [k, p.chips])) };
    await a.placeBet('andar', 100); await a.placeBet('andar', 50);
    await b.placeBet('bahar', 10); await b.placeBet('andar', 10); // moves bet
    if (rounds === 5) { // host leaves mid game
      store.state.players.p1.online = false; await store.update({}); a.destroy();
    }
    if (rounds !== 5 || true) await c.placeBet('bahar', 500);
    await sleep(5);
    const bets = store.state.bets;
    if (bets.p2 && (bets.p2.side !== 'andar' || bets.p2.amount !== 10)) errors.push('move bet failed ' + JSON.stringify(bets.p2));
    // wait for result settled
    let res; for (let j = 0; j < 2000; j++) { await sleep(15); res = store.state.round; if (res.phase === 'result' && res.settled) break; }
    await sleep(30);
    const cards = toList(res.cards);
    if (rankOf(cards[cards.length - 1]) !== rankOf(res.middle)) errors.push('last card not match');
    if (cards.slice(0, -1).some(x => rankOf(x) === rankOf(res.middle))) errors.push('earlier match missed');
    const exp = (res.winIndex % 2 === 0) ? 'andar' : 'bahar';
    if (exp !== res.winner) errors.push('winner side wrong');
    for (const [pid, bet] of Object.entries(bets)) {
      const want = before[pid] - bet.amount + (bet.side === res.winner ? winAmount(bet.side, bet.amount) : 0);
      if (store.state.players[pid].chips !== want) errors.push(`chips wrong ${pid} r${res.n}: ${store.state.players[pid].chips} vs ${want}`);
    }
    rounds++;
    console.log(`round ${res.n}: middle ${res.middle}, ${cards.length} cards, ${res.winner} wins, host=${store.state.meta.host}, chips`, Object.values(store.state.players).map(p => p.chips).join('/'));
  }
}
console.log('history', JSON.stringify(store.state.history));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL CHECKS PASSED', 'rounds', rounds);
process.exit(0);
