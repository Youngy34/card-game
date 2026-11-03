# Yomi Playtest v18 — the app

The digital playtest table for **rules v18** (`rules-overview 18.md`): one 24-card deck gone through once, no neutral step (its effects are **On reveal riders** on clash cards), the shared defence core (Recall ×3, Charge ×2, Read ×2), **the time-out**, and specials that go back to the table. Built on 3 November 2026 (night) as its **own page**, with the new Hard partner; the v17 page stays as it was.

## The page

- **v18:** https://claude.ai/artifact/3gkhzd1DGfoym2R6dCFowo ("Yomi Playtest v18", private to Mark until shared). It started with an empty database, so it runs the bundled fighters and settings. It declares the same database rules as the v16 and v17 pages (fighters and settings: editors write; the playtest log: anyone who plays writes).
- **Unchanged:** the v17 page (https://claude.ai/artifact/XFLF2iRy3nzRB7qRiAjtaJ) and the v16 pages, with the old partner.

## Source

- GitHub `Youngy34/card-game`, branch **`v18`**, off `v17` at 2669910.
- **To rebuild:** `node tools/build-artifact.mjs --edition v18` (writes `dist/yomi-playtest-v18.html`), then publish it over the same artifact.
- v18 runs on the v16 engine and screens (`src/engine/v16/`, `src/app/v16/`) with rule switches on; v16 and v17 games are unchanged with them off.

| Switch (`data/v18/settings.json`) | What it does |
|---|---|
| `merged: true` (rules) | One deck and one hand; no neutral step. The round starts at the clash card, and each clash card's `reveal` rider fires once both are face up. |
| `timeout: true` (rules) | The deck never reshuffles. When a player draws their last card, the round finishes and the higher HP wins (equal HP: a draw). |
| `specialsReturn: true` (rules) | A special goes back to the table when it leaves the hand (played, discarded or Confiscated). |
| `knockdownLocks: true` (rules) | Knockdown Locks the knocked-down player's Pressures next round. |
| `pooled: 1`, `mySamples: 4` (ai) | The new Hard: one solve over all the dealt hands, with its own hand hidden too (its real hand and 3 dealt ones). See `rules-overview 18.md`, The Partner. |

## Fighters

| Fighter | HP | Deck (24) | Specials (1 meter) | Super (2 meter, once) |
|---|---|---|---|---|
| **Benchmark** (reference) | 34 | 17 attacks (Jab, Slash, Sweep, Shot, Throw, Big Swing, Wind-Up) and the core | Rising Strike; Breaker | Overdrive |
| **The Warden** (draft) | 32 | 17 attacks (Chain Lash, Ankle Hook, Chain Toss, Shakedown, Coil, Shackles, Chain Spin) and the core | Iron Haul; Chain Whip | Chain Prison |

Card by card in `rules-overview 18.md`, The Fighters.

## What's new on the page

- **Setup** explains v18 (one step a round, riders, the table, the time-out) and tosses for the initiative. The picker shows each fighter's HP and "24 cards + 2 specials". The difficulty notes give the new levels: Hard beats Medium about 59 games in 100 and Easy about 65.
- **The round starts at the clash card.** There's no "Play nothing" button while you hold a card (v18: you must play one).
- **After the reveal,** if your clash card is a **Read** with something to take, or a **Recall** with more than one attack to bring back, you choose: *Draw a card (N left in your deck)*, or tap a card to take it from the table (with its cost) or to bring it back. The initiative holder chooses first and the other player sees that choice above the cards; the partner decides in the same order. Charge and Shakedown need no choice.
- **The board** lists what each rider did ("Benchmark's Recall: brought Shot back from the discard pile"), above the clash's narration. The round log shows the same line for each round in place of v17's neutral line.
- **The HUD** shows the deck count, flagged "time-out near" at 3 cards or fewer. The Table row shows each special "· 1 meter" on the table or "· in hand" once taken (back on the table once it's used), and the Super "· in hand" or "· used".
- **Board notes** (while you choose) add the time-out once either deck is down to 4 (cards left on each side, and whether you're ahead), and any attack the opponent brought back with Recall ("it's in their hand").
- **The result** of a time-out reads "Time-out: Benchmark wins on HP" (or a draw), with both HP totals.
- **Settings:** the neutral-step dials are hidden; the partner has "Hands it deals itself" (4); "Use the defaults" restores this page's own settings (it used to restore the v16 ones, which would have brought back the old partner).
- **Lab:** plays v18 games and adds a Time-outs tile; the neutral-phase line is gone. Runs are slower than on v17 (the new partner does several times the work per decision): 100 Hard-v-Hard games take about half a minute.

## Checks (3 November)

- `node tools/test18.mjs`: 64 pass; `test17` (36), `test16` (96), `test16-warden` (28) still pass.
- The match logic, driven through 30 whole games (partner v partner, a scripted person, hot-seat): every phase reached, including the rider choice, Confiscate and time-outs.
- Browser smoke `tools/smoke/browser18.cjs`: every check passed on the last three runs, about 300 a run (the count varies with what the games offer; one earlier run missed a rare prompt by chance, so the test now plays on until each has come up) (whole games against Hard and against the Warden, the Read and Recall prompts, taking from the table, the time-out note and result, the log, Decks, Settings, the Lab, hot-seat, phone width).

## Known limits

- **The partner looks one round ahead,** so it undervalues specials and the Super (permanent), and it doesn't know about the time-out (it never plays to run the clock out). It doesn't weigh what Recall could bring back from the discard pile.
- **It doesn't learn your habits.** An always-Guard bot beats it 28.5%: a person who guards a lot will be punished less than they should be.
