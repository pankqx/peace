# peace

Card games to play with friends in the browser — phone or laptop, no app, no sign-up.

**Andar Bahar** — share a 4-letter room code, everyone picks Andar or Bahar, and the first card matching the middle card wins. Play chips only, no real money.

## Play
- Online: open the site, type your name, **Create a room**, share the link.
- Solo: **Practise solo with 3 bots** works without any setup.

## Turning on online rooms
See [SETUP.md](SETUP.md) — a free Firebase Realtime Database, about 5 minutes.

## How it's built
Plain HTML, CSS and JavaScript modules — no build step, served by GitHub Pages.

| Path | What it does |
| --- | --- |
| `js/cards.js` | Hand-built SVG playing cards (faces, court cards, back) |
| `js/store.js` | Room store interface + in-memory store for solo play |
| `js/firebase-store.js` | Same interface backed by Firebase Realtime Database |
| `js/games/andar-bahar/engine.js` | Rules, betting, dealing, payouts, host takeover, bots |
| `js/app.js` | Home screen and game table UI |
| `database.rules.json` | Firebase security rules |
| `dev/test-engine.mjs` | Multiplayer simulation test: `node dev/test-engine.mjs` |

One player's browser acts as the dealer (the host). If the host leaves, the next player who joined takes over automatically and the round carries on.

## Roadmap
- Admin panel
- More games on the same table and card set
