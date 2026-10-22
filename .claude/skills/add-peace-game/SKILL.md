---
name: add-peace-game
description: Add a new multiplayer card game (Teen Patti, War, Hi-Lo, Baccarat-style, etc.) to the peace repo (pankqx/peace), reusing its vintage SVG cards, room codes, Firebase/solo store, shared betting engine and coin UI. Use whenever the user wants another game on the peace site, asks to "add a game", or wants to change how Andar Bahar or Dragon Tiger plays.
---

# Add a game to peace

peace is a static GitHub Pages site (no build step; `.github/workflows/pages.yml` deploys `main`).
Games are multiplayer through a shared "room store": Firebase Realtime Database online, an
in-memory store for solo play. One browser — the **host/dealer** — runs the game loop;
everyone else only places their own bets.

## How games plug in
1. `js/games/core.js` — shared engine (`RoomClient`): betting phase, dealing loop, settlement,
   host takeover, bots. You normally don't touch it.
2. `js/games/<id>/rules.js` — the game itself. Copy `dragon-tiger/rules.js` (simplest) and fill in:
   - `id`, `name`, `tagline`, `config` (timing overrides), `sides` (`{id, label, sub, pays}`),
   - `steps` (exactly 3 `[bold, detail]` lines of plain English) and `payNote`,
   - `startRound(deck)` → fields for the new round (pop any cards shown before betting),
   - `seen(r)` → cards already shown (used to rebuild the deck on host takeover),
   - `dealStep(r, card)` → `{ set: {roundField: value}, done, winner, delay? }`,
   - `payout(bet, winner)` → coins returned **including the stake** (0 = lost, stake = refund),
   - `mark(winner)`, `markLabel`, `dealingText(r)`, `winText(winner)`, `botSide()`.
3. Register it in `js/games/index.js`.
4. Add a view class in `js/views.js` and register it in `VIEWS`. It must:
   - render the table markup into the given element, including `STATUS_HTML`,
   - give every betting spot `data-side="<side id>"` (that makes it tappable) and a
     `<span class="bettors" data-bettors="<side id>">` (that shows who bet there),
   - return `{ dealt, flipped, match }` from `render()` so sounds play, and expose `flashTarget()`.
5. Add side colours in `css/style.css` (`.zone--<side>, .side--<side>, .mark-<side>, ... { --side: ... }`),
   a home picker style `.pick--<id>`, a hero layout in `HERO` in `js/app.js`, and a history letter
   mapping in `SIDE_MARK`.

## Rules that keep it fair and working
- Only the host writes `round`; players write only their own `players/{pid}` and `bets/{pid}`.
  Coins always change through `transaction`.
- Never store the unseen deck in the database (players could read it). The host keeps it in memory.
- Firebase turns number-keyed objects into arrays — read lists with `toList()`.
- Copy says "coins", never "chips" or real money. Coins are just for fun.

## Test before pushing
1. Add the game to `dev/test-engine.mjs` with its own correctness check, then `node dev/test-engine.mjs`.
   It plays 10 rounds with 3 clients, drops the host mid-game and checks every payout.
2. `python3 -m http.server` and play solo rounds in a headless browser at 390×844 (phone),
   1440×900 and 1920×960 (laptop — the whole game must fit without scrolling).

## Commit
Commit in small steps as the user's own git identity (`pankqx`, `pankqx@gmail.com`),
with no co-author trailers, and push to `main`.
