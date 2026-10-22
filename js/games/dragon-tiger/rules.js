// Dragon Tiger: one card to Dragon, one to Tiger. Higher card wins. Ace low, King high.
import { rankOf } from '../../cards.js';

const VALUE = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
export const cardValue = (c) => VALUE[rankOf(c)] || Number(rankOf(c));

export default {
  id: 'dragon-tiger',
  name: 'Dragon Tiger',
  tagline: 'Two cards, one flip each. Back the Dragon or the Tiger — the higher card wins.',
  config: { dealMs: 1300, firstDealDelay: 700, resultMs: 5000, betMs: 12000 },
  sides: [
    { id: 'dragon', label: 'Dragon', sub: 'left card', pays: '2×' },
    { id: 'tie', label: 'Tie', sub: 'same number', pays: '9×' },
    { id: 'tiger', label: 'Tiger', sub: 'right card', pays: '2×' },
  ],
  steps: [
    ['One card goes to Dragon, one to Tiger.', 'Nothing else — just two cards.'],
    ['Put coins on the side you think gets the higher card.', 'Or on Tie if you think both numbers match.'],
    ['Higher card wins. Ace is lowest, King is highest.', 'If it’s a tie, Dragon and Tiger bets come back to you.'],
  ],
  payNote: 'Dragon and Tiger pay 2×. Tie pays 9×.',
  startRound() { return {}; },
  seen(r) { return [r.dragon, r.tiger].filter(Boolean); },
  dealStep(r, card) {
    if (!r.dragon) return { set: { dragon: card }, done: false };
    const d = cardValue(r.dragon), t = cardValue(card);
    return { set: { tiger: card }, done: true, winner: d > t ? 'dragon' : t > d ? 'tiger' : 'tie' };
  },
  payout(bet, winner) {
    if (winner === 'tie') return bet.side === 'tie' ? bet.amount * 9 : bet.amount;
    return bet.side === winner ? bet.amount * 2 : 0;
  },
  mark(winner) { return winner === 'dragon' ? 'D' : winner === 'tiger' ? 'T' : '='; },
  markLabel: { D: 'Dragon', T: 'Tiger', '=': 'Tie' },
  dealingText(r) { return r.dragon ? 'Now the Tiger…' : 'Dealing the Dragon…'; },
  winText(w) { return w === 'dragon' ? 'Dragon wins' : w === 'tiger' ? 'Tiger wins' : 'It’s a tie'; },
  botSide() { const x = Math.random(); return x < 0.08 ? 'tie' : x < 0.54 ? 'dragon' : 'tiger'; },
};
