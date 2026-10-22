# peace

Card games to play with friends in the browser — phone or laptop, no app, no sign-up.

- **Andar Bahar**: everyone picks Andar or Bahar, and the first card matching the middle card wins.
- **Dragon Tiger**: one card each to Dragon and Tiger. Higher card wins, or bet on a Tie.

Share a 4-letter room code to play together. Coins are just for fun, no real money.

## Play
- Online: open the site, type your name, **Create a room**, share the link.
- Starting coins: 1,000 each by default. The room creator can pick another amount under **Starting coins** (or change it in the lobby before the game starts).
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
| `js/games/core.js` | Shared engine: betting, dealing loop, payouts, host takeover, bots |
| `js/games/<game>/rules.js` | Each game's rules (Andar Bahar, Dragon Tiger) |
| `js/views.js` | Each game's table layout and card animations |
| `js/fx.js` | Sounds, flying coins, result flash |
| `js/app.js` | Home screen, game picker and shared game screen |
| `database.rules.json` | Firebase security rules |
| `dev/test-engine.mjs` | Multiplayer simulation test: `node dev/test-engine.mjs` |

One player's browser acts as the dealer (the host). If the host leaves, the next player who joined takes over automatically and the round carries on.

## Roadmap
- Admin panel
- More games on the same table and card set (see `.claude/skills/add-peace-game`)
