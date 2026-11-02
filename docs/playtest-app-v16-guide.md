# Yomi Playtest v16 — the app

The digital playtest table for **rules v16** (`rules-overview 16.md`): split clash and neutral decks, hidden hands, the neutral step, combos, statuses, meter, and grey each round. Built on 31 October 2026 as its **own page**; the v11/v12, v13, v14 and v15 pages stay as they were.

## Two v16 pages (1 November)

- **The Warden page (current):** https://claude.ai/artifact/6nhiH3itWrpzQZbCHKXWdu ("Yomi Playtest v16 · Warden", private to Mark until shared). Everything the first page does, plus **the Warden** (`character-warden v16 draft.md`) and his Confiscate prompts. Published 1 November because that session couldn't update the first page (network access was off, so it could only change pages it created). Mark chose to **start it fresh**: its database began empty, so it runs the bundled fighters (Benchmark at **HP 38**, Warden at 38) and the default settings. It declares the same database rules as the first page.
- **The first page, unchanged since 1 November (early):** https://claude.ai/artifact/BwqWsi4LievrksJUf13NEc. Its database still holds Mark's saved Benchmark (HP 25), his settings and the playtest log so far.
- **HP note:** on the first page Mark played the Benchmark at HP 25. At 25 against 25, the Warden wins 55% (400 games, ±5; median 9 rounds), so both at 25 is fair if he wants short games again. Change HP in **Decks**.
- **The v15 page, unchanged:** https://claude.ai/artifact/TkmJPV3eK49MPyB6wANJrN.

## Source

- GitHub `Youngy34/card-game`, branch **`v16-rules`** (commit a5f827d, 31 October). **It doesn't have the 1 November changes** (grey each round and the `lateGrey` / `guardHalf` test switches were only on the first page). Both are restored in the patches below; the first page's code was compared line by line where it differed.
- **To rebuild the Warden page:** check out a5f827d, apply `sim/warden-engine.patch`, then `sim/warden-app.patch` (both in this project), then `node tools/build-artifact.mjs --edition v16`. The Warden page's `<title>` reads "Yomi Playtest v16 · Warden" (edited after the build).
- v16 has its own engine (`src/engine/v16/`) and its own screens (`src/app/v16/`); the shared pieces are the store, the styles and the build.

## Fighters

| Fighter | Status | HP | Decks |
|---|---|---|---|
| **Benchmark** | Reference | 38 | Clash (20): Jab ×4, Slash ×2, Sweep ×2, Throw ×3, Big Swing ×3, Guard ×6. Neutral (10): Charge ×2, Read ×2, Rush ×2, Wind-Up ×2, Parry, Breakfall. Super: Overdrive (3 meter, knocks down) |
| **The Warden** | Draft | 38 | Clash (20): Chain Lash ×4, Ankle Hook ×2, Haul In ×4, Coil ×2, Slam ×2, Chain Guard ×6. Neutral (10): Charge ×3, Read ×2, Shakedown ×3, Shackles ×2. Super: Chain Prison (3 meter, discard down to 3) |

A fighter file is still one list of cards: the engine puts neutral cards in the neutral deck and the rest in the clash deck. `tools/fixtures/benchmark16-tuned.json` is a tuned candidate (Charge ×3, Read draws 1, Rush gives +2 chip) that isn't on the page. Make variants in **Decks** to try things.

## What the page does

- **Play:** you against the sparring partner (Easy, Medium or Hard), two players on one device, or watching two partners.
  - **Neutral step:** pick one of your 3 neutral cards and play it; your clash hand is shown below for reference. Both reveal together. A knocked-down or Dizzy player skips it. A card that stays in play (Breakfall, Shackles) shows in your HUD as "In play".
  - **Confiscate (against the Warden):** when Shakedown is revealed, or Coil or Chain Prison hits you, you pick the clash cards to discard ("Confiscate: discard N"). Shakedown's comes before the clash cards are chosen; the others once the clash is over, with the clash still on screen. In hot-seat play the device changes hands first. Under Shackles, your HUD shows **Hand limit 5** and the draw step's discard says why.
  - **Clash:** pick a card from your clash hand, or the Super when you have the meter. A card of a Locked type is marked "Locked: voided": you can play it, but it does nothing. With no clash cards, you play nothing automatically.
  - **Follow-ups and combos:** when your Guard beats a Pressure, you pick a Counter (or any attack, under Parry), or none. When your Starter wins, you pick a Linker, then an Ender, or skip either.
  - **Draw step:** "Draw · take 1 grey · next round" discards what you used to the right piles, draws a clash card, refills your neutral hand and adds the grey to both piles. (With the dial at 0 it reads "Draw · next round".) Over the clash hand limit, you pick what to discard.
  - **The HUDs** show HP, grey, meter (three pips), the clash hand, deck and discard, the neutral hand, deck and discard, any card in play, a capped hand limit, statuses, and the Super's meter (gold when it's ready).
  - **Board notes** (on by default): lethal range, live Supers, live neutral effects, cards in play (including Shackles' limit), statuses, the Counters among the clash cards you haven't seen of theirs, and the speed duels they could win.
  - **The round log** lists what each player lost to Confiscate.
  - **The deck panels** show each card's copies: yours by hand, deck and discard; theirs by unseen and seen.
- **Two players on one device:** hands are hidden, so the screen asks for the device to change hands before every private choice (Confiscate included).
- **Decks:** card faces with their copies, HP, the type mix and Counter count, validation (including at least 4 neutral cards), and the full JSON for everything else. Cards with Confiscate carry its reminder text.
- **Lab:** bulk games on the current decks, with each side Easy, Medium, Hard or a mindless bot. The report covers win rate, length, quiet rounds, combos, Guard wins and follow-ups, Supers, statuses, how games end, clash outcomes, each side's neutral cards (by name), types and clash cards, hand size at the clash, cards Confiscated (and which), and cards in play. **Run the exploit check** plays each mindless bot (Pressure, any attack, Guard, **Convert**, random) and Easy against Hard in a fighter's mirror.
- **Playtest log:** every finished game with a person in it, round by round, with the exact decks and settings.
- **Settings:** the rule dials and the partner's weights. Number fields take whatever you type; a value out of range is outlined in amber and ignored until it's fixed.

### The rule dials

| Setting | As written | Notes |
|---|---|---|
| Opening hand | 6 | Clash cards |
| Clash hand limit | 8 | The Super doesn't count. Shackles lowers the opponent's to 5 while it's in play |
| Neutral hand | 3 | Refilled each draw step |
| Grey taken each round | 1 | Added to your own pile in the draw step (0 is the game before 1 November) |
| Confiscate floor | 2 | Confiscate never takes a player below this many clash cards |
| Meter track maximum | 3 | Each Super prints its own cost |
| Burning: most cards a round | 0 (off) | The first draft's meter source |
| The Super | Reusable | Or once per game |
| Speed ties | Cancel | Or the player on less HP wins |
| Round limit | 60 | Counts as a draw |

Engine switches the page doesn't show, for sim tests: `splitDecks`, `focusDraw`, `focusMeter`, `blankClash`, `oneReveal`, `neutralMeter`, `burnNeutrals`, `guardHalf` (a Guard clears half the pile), `lateGrey` (grey from a clash lands when it ends), `bendersLoseMirror`, and `confiscateBy` (who picks a Confiscated card: `victim` as written, `random`, `reveal2` (they show 2, the Warden picks), `taker` (the Warden picks from their whole hand)). Armor and Mix-Up remain as engine effects for tests; they're off the Benchmark because they change what beats what.

## The sparring partner

- **The clash:** it deals you possible clash hands (6 by default) from the clash cards it hasn't seen, solves the clash grid for each (every pairing scored a round ahead, then the mix you can't exploit), and plays the average of those mixes. It sees both revealed neutral cards.
- **Follow-ups, Linkers and Enders:** the choice that leaves the board best by its value function.
- **The neutral step:** it scores each neutral card in its hand by the clash it leads to, and picks among them with a little randomness. After its own Shakedown it assumes you hold one card fewer.
- **Confiscate:** as the victim, it tries discarding each card it holds and keeps the hand whose next clash it values most (one card at a time; by redundancy for 3 or more, and for bots).
- **The value function:** HP, grey on you (0.6 a token), clash cards in hand (0.5 each; cards owed to a Confiscate, and cards over a Shackles limit after the next draw, count for nothing), meter (0.4 a point, plus 1.5 with the Super ready), a card in play (0.4), and next round's statuses (Knockdown 0.8, each Lock 1.5, Staggered 0.4, Dizzy 5).
- **Easy and Medium** play its mix more loosely. **The Reader isn't ported yet.**
- **Limits:** it never bluffs on purpose, it only looks one round ahead (so it undervalues meter and cards that pay off later, such as Breakfall and Shackles), and it doesn't adapt to your habits (so an always-Guard or always-Convert player does better against it than they should).
- **The mindless bots** play the first neutral card in their hand. The Convert bot plays its fastest Convert (the Super when it can) whenever it holds one.

## Calibration

**1 November, with 1 grey a round** (Benchmark mirror at HP 38, Hard vs Hard, 600 games): median 14 rounds; Supers 0.85 a game; clash cards Guard / Pressure / Convert 42 / 30 / 28%; combos 16% of rounds; quiet rounds 12%. Piles at the start of a round average 2.4 (median 1); 7% of rounds start with an empty pile and 8% of Guards clear nothing. **Against Hard** (300 games each, the other player's win %): Pressure every round 22%, any attack 19%, Guard every round 28%, random 23%, Easy 31%, Medium 39%. The restored source reproduced this (100 games: median 14, 42 / 29 / 29%, combos 17%, quiet 11%).

**The Warden against the Benchmark** (Hard vs Hard, 900 games): 52%; full results in `character-warden v16 draft.md`.

**31 October, before grey each round** (HP 30, 600 games):

| | |
|---|---|
| Median length | 14 rounds |
| Supers a game (both players) | 0.8 |
| Neutral step | Read 24%, Wind-Up 22%, Charge 20%, Rush 17%, Parry 9%, Breakfall 7% |
| Clash cards: Guard / Pressure / Convert | 44 / 30 / 27% |
| Clash hand after a round | 6.2 |
| Guard wins with no Counter in hand | 3% |
| Combos | 16% of rounds |
| Quiet rounds | 25% |
| Partner barred from Charge / Read / Rush / Wind-Up / Parry / Breakfall wins | 44 / **29** / **54** / 45 / 51 / 46.5% |

**Against Hard, before grey each round:** Pressure every round 18%, any attack 17%, **Guard every round 34%**, random 23%, Easy 33%, Medium 40%.

**The tuned candidate** (Charge ×3, Read draws 1, Rush +2 chip, before grey each round): Supers 1.2 a game; clash cards 39 / 34 / 27%; Charge and Read both about 38–39% when barred; Rush and Breakfall still about 51%.

**History:** the first draft (burn up to 3 a round) had 4.8 Supers a game; capping burning fixed that; a kept Focus card replaced burning; split decks replaced the kept Focus; triangle-bending neutral cards (Armor, Mix-Up) balanced the triangle but made plays unbeatable (speed ties 20% of clashes) and were dropped; piles were nearly always empty until grey each round. Full comparisons: `sim/v16 neutral-phase variants.md` and the rules doc's Sim History.

## Fixes

- **31 October:** discarding two cards crashed the page (the discard picks shared the selected-card state with the neutral screen; they now have their own). The live page showed old cards because the database held saved copies of the Benchmark and the settings: always check the database before republishing.
- **1 November:** the Settings help said Overdrive costs 4 meter; it costs 3.

## Where the data lives

- `data/v16/benchmark.json`, `data/v16/warden.json` and `data/v16/settings.json`: the bundled fighters and the default dials and weights. `tools/fixtures/`: the one-deck Benchmark (for older rule checks), the tuned candidate, and the Warden's sim variants (`tools/fixtures/warden/`).
- Each page's database (ArtifactData tool, with the page's URL): `fighters/<id>` (`benchmark16`, `warden16`), `settings/match`, `games/<id>`. **Saved settings override the bundled defaults.** On the first page Mark has saved `fighters/benchmark16` (HP 25) and `settings/match` (ties cancel, 1 grey a round). The Warden page's database started empty. **Check it before republishing.**
- **Making edits official:** read `fighters/<id>` from the database, write it to `data/v16/<file>.json`, rebuild with `--edition v16`, republish, then delete the database copy.

## Card format (v16)

```json
{ "name": "Sweep", "type": "pressure", "kind": "strike", "speed": 13, "build": 3, "chip": 0, "copies": 2,
  "icons": ["ender"], "onHit": "knockdown" }
{ "name": "Read", "type": "neutral", "copies": 2, "now": { "draw": 2 } }
{ "name": "Rush", "type": "neutral", "copies": 2, "thisRound": { "pressureBuild": 3 } }
{ "name": "Breakfall", "type": "neutral", "copies": 1, "stays": true, "prevent": "knockdown" }
{ "name": "Coil", "type": "convert", "kind": "grab", "speed": 4, "chip": 3, "icons": ["ender", "counter"], "confiscate": 1, "copies": 2 }
{ "name": "Shakedown", "type": "neutral", "atClash": { "confiscate": 1 }, "copies": 3 }
{ "name": "Shackles", "type": "neutral", "stays": true, "capHand": 5, "endsOn": "pressureHit", "copies": 2 }
```

- **type:** pressure, convert, recover or neutral. **kind:** strike or projectile; guardBreak or grab; guard.
- **speed:** 11–19 for a Pressure (20 on a Super), 1–10 for a Convert. **build**, **chip**, **copies** (1–8).
- **icons:** any of starter, linker, ender, counter.
- **onHit:** knockdown, staggered, dizzy (Supers only), or `{ "lock": "pressure" | "convert" | "recover" }`.
- **cost:** the same, on yourself next round. **onLossSelf:** tokens on your own pile if it's beaten.
- **confiscate** (attacks): On hit, Confiscate that many times. **discardDownTo** (attacks and Supers): On hit, they discard down to that many.
- **Neutral cards:** `now` (on reveal: draw, meter); `thisRound` (convertChip, pressureBuild, pressureChip, attackChip, speed, parry, grabConfiscate; armor and mixup for tests); `atClash` (`confiscate`, at the start of the clash step); `stays` (true: stays in play) with `prevent` (knockdown, staggered, dizzy or lock), or `capHand` (the opponent's clash hand limit) and `endsOn: "pressureHit"`.
- **The Super:** `meter` (its cost, 1–5, default 3); no copies.

## Checks

- `node tools/test16.mjs`: 96 rule checks on the engine (split decks and the neutral hand, Charge, Read, Rush, Wind-Up, Parry, Breakfall and cards in play, Lock voiding, combos, follow-ups, speed and ties, statuses, the Super, the draw step, reshuffles, what the partner can't see, the earlier one-deck variants, and Armor and Mix-Up).
- `node tools/test16-warden.mjs`: 28 checks on Confiscate (its floor, Shakedown after Read, Coil, follow-ups, Death Grip), Shackles (the limit, and what ends it), Chain Prison, grey each round, and whole games.
- `tools/smoke/browser16.cjs <page> <vendor dir>`: Chromium click-through of the built page. The vendor dir holds `pkg/preact` (tag 10.24.3) and `pkg/htm` (tag 3.1.1) as source clones from GitHub (npm was blocked on 1 November). It plays five games against Hard, three against the Warden (answering Confiscate prompts and seeing Shackles' limit) and one hot-seat game, and checks the draw step's grey, the log, Decks, Settings (grey and Confiscate floor), the Lab and the exploit check, and a phone-width watch game. Passed on 1 November: 176 checks.
- `tools/sim16.mjs`: `game` and `exploit` from the command line, with every rule dial as a flag (including `--greyPerRound`, `--confiscateFloor`, `--lateGrey`, `--guardHalf`) and `--ban <card>` for barred-card tests. `tools/warden-study.mjs` gives the damage, hand and type-pairing breakdowns used for the Warden.
