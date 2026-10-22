// Andar Bahar: a middle card is shown, cards are dealt Andar, Bahar, Andar…
// The first card with the same rank as the middle card wins for its side.
import { rankOf } from '../../cards.js';
import { toList } from '../../store.js';

const RANK_WORD = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };

export const sideForIndex = (i) => (i % 2 === 0 ? 'andar' : 'bahar');

export default {
  id: 'andar-bahar',
  name: 'Andar Bahar',
  tagline: 'Pick a side. Watch the cards fall. The first card that matches the middle one wins.',
  config: { dealMs: 750 },
  sides: [
    { id: 'andar', label: 'Andar', sub: 'inside', pays: '1.9×' },
    { id: 'bahar', label: 'Bahar', sub: 'outside', pays: '2×' },
  ],
  steps: [
    ['One card goes in the middle.', 'Its number is the one to watch. Suits don’t matter.'],
    ['Put coins on Andar or Bahar.', 'Andar means inside, Bahar means outside.'],
    ['Cards are dealt to both sides, one by one.', 'The first card with the same number as the middle card wins for its side.'],
  ],
  payNote: 'Bahar pays 2×. Andar pays 1.9×, because Andar always gets the first card.',
  startRound(deck) { return { middle: deck.pop() }; },
  seen(r) { return [r.middle, ...toList(r.cards)].filter(Boolean); },
  dealStep(r, card) {
    const i = toList(r.cards).length;
    const set = { [`cards/${i}`]: card };
    if (rankOf(card) === rankOf(r.middle)) {
      set.winIndex = i;
      return { set, done: true, winner: sideForIndex(i) };
    }
    return { set, done: false };
  },
  // Coins returned to the player (stake included).
  payout(bet, winner) {
    if (bet.side !== winner) return 0;
    return bet.side === 'andar' ? bet.amount + Math.floor(bet.amount * 0.9) : bet.amount * 2;
  },
  mark(winner) { return winner === 'andar' ? 'A' : 'B'; },
  markLabel: { A: 'Andar', B: 'Bahar' },
  dealingText(r) { return `First ${RANK_WORD[rankOf(r.middle)] || rankOf(r.middle)} wins`; },
  winText(w) { return w === 'andar' ? 'Andar wins' : 'Bahar wins'; },
  botSide() { return Math.random() < 0.5 ? 'andar' : 'bahar'; },
};
