---
name: add-peace-game
description: Add a new multiplayer card game (Teen Patti, War, Blackjack vs dealer, Higher or Lower, etc.) to the peace repo (pankqx/peace), reusing its SVG cards, room codes, Firebase/solo store and host-driven game loop. Use whenever the user wants another game on the peace site, asks to "add a game", or wants to change how Andar Bahar plays.
---

# Add a game to peace

peace is a static GitHub Pages site (no build step). Games are multiplayer through a
shared "room store": Firebase Realtime Database online, an in-memory store for solo play.
One browser — the **host** — runs the game loop; everyone else only places their own actions.

## Read these first
- `js/games/andar-bahar/engine.js` — the reference game. Copy its shape.
- `js/store.js` — store interface: `subscribe`, `update({ 'a/b': v })`, `transaction(path, fn)`, `now()`.
- `js/cards.js` — `cardEl(code, { faceDown })`, `rankOf`, `suitOf`, `SUITS`, `RANKS`. Card codes are like `AS`, `TD` (10), `QH`.
- `js/app.js` — home screen and table UI (`GameView`).

## Rules for a new game

1. **Engine file** at `js/games/<game-id>/engine.js`, no DOM code. Export:
   - `CONFIG` (timings, chip values),
   - `newRoom(pid, name, now)` setting `meta.game = '<game-id>'`,
   - a `RoomClient` class with player actions and a `tick()` host loop.
2. **Room data stays small and flat**: `meta`, `players`, `round`, per-player actions keyed by pid
   (like `bets/{pid}`), and `history`. Tag every action with `round: n` and ignore stale ones.
3. **Only the host writes `round`**. Players write only their own `players/{pid}` and action nodes.
   Money-like values (chips) always change through `transaction`.
4. **Never store the unseen deck in the database** (any player could read it). The host keeps
   the shuffled deck in memory; on host takeover, rebuild it from cards not yet shown.
5. **Host takeover**: keep `maybeTakeOver` behaviour — if the host is offline for
   `hostTimeoutMs`, the earliest-joined online human becomes host.
6. **Settle once**: write `round/settled: true` together with results, then pay out.
7. **Bots** for solo mode: a `runBot(client)` that acts with a random delay.
8. Firebase turns objects with number keys into arrays — read lists with `toList()`.

## UI
- Add the game to the home screen as a choice; keep the same entry form (name, create, join, solo).
- Reuse the felt table, brass rail, chips row and player list styles in `css/style.css`.
  Keep tap targets at least 44px; check at 390×844 (phone) and 1440×900 (laptop).
- "How to play" is at most 3 short steps in plain English, plus one line on payouts.
  Say "chips are just for fun — no real money".

## Test before pushing
1. Write `dev/test-<game-id>.mjs` modelled on `dev/test-engine.mjs`: 3 clients on one
   `LocalStore`, fast timings, play 10 rounds, drop the host mid-game, and assert payouts.
   Run with `node dev/test-<game-id>.mjs`.
2. Serve with `python3 -m http.server` and play a solo round in a headless browser at both sizes.

## Commit
Commit in small steps as the user's own git identity (`pankqx`, `pankqx@gmail.com`),
with no co-author trailers, and push to `main` — GitHub Pages deploys from there.
