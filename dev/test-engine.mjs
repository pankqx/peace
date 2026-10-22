// Multiplayer simulation: 3 clients share one in-memory store, the host leaves mid-game.
// Run: node dev/test-engine.mjs
import { LocalStore, toList } from '../js/store.js';
import { RoomClient, BASE, newRoom } from '../js/games/core.js';
import { GAMES } from '../js/games/index.js';
import { rankOf } from '../js/cards.js';
import { cardValue } from '../js/games/dragon-tiger/rules.js';

Object.assign(BASE, { betMs: 600, minBetMs: 200, firstDealDelay: 20, resultMs: 150, hostTimeoutMs: 200 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

async function play(gameId, plan) {
  const rules = { ...GAMES[gameId], config: { dealMs: 20 } };
  const store = new LocalStore(newRoom(gameId, 'p1', 'Host', Date.now()));
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

await play('andar-bahar', () => ['andar', 'bahar', 'andar']);
await play('dragon-tiger', (i) => [['dragon', 'tiger', 'tie'][i % 3], 'tiger', 'dragon']);
process.exit(failed ? 1 : 0);
