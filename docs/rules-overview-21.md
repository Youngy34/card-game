# Rules Overview — v21 (nine Guards, three specials)

*10 November 2026, from Mark's decisions that morning. **v21 is v20 with five changes.** Everything not listed here is as `claude/rules-overview 20.md`.*

**Status: playable.** The v21 page: https://claude.ai/artifact/1LhMpcixH4DzyLrmjNxJBp ("Yomi Playtest v21 (nine Guards)"; `claude/app/playtest-app v21 guide.md`). Code: not on GitHub yet (this session had read-only access); the full change is backed up in `claude/sim/v21.patch.xz.b64`, to apply on branch `v20-heat`.

## What Changed From v20 (Mark, 10 November)

1. **Nine Guards in every deck: Recall ×3, Read ×3, and the fighter's own Guard ×3.** Mark found Guards too rare at the table: under v20 a player held no Guard in about 3 rounds in 10 (Atlas against Vex, 5 in 10).
2. **A fighter's own Guard pays out only if it beats a Pressure.** Recall and Read pay out win or lose; the own Guard rewards the right read. (It douses and follows up like any Guard.)
3. **Two Guards do nothing.** Heat is yours now, and nobody attacked, so nobody's heat is doused.
4. **Decks are 28 cards** (each fighter cut one of its own cards to make room). **The table holds three specials, one of each type, and the Super,** whichever type suits the fighter. 32 cards a fighter in all.
5. **The Guard special is the strong version of the fighter's own Guard** (as Aegis is to Repulse).

*Kept from v20 after testing:* specials stay on the table rather than in the deck (in the deck they stop being public threats, and heat piles up: a fifth of rounds at max heat); specials cost 3 heat; one card a round from the table.

## The Own Guards and the New Specials

| Fighter | HP (v20) | Own Guard ×3: if it beats a Pressure | Third special | Cut |
|---|---|---|---|---|
| **Benchmark** | 23 (23) | **Block:** nothing more (the plain reference) | **Parry** (Guard): they're Staggered | a Wind-Up (×2) |
| **The Warden** | 23 (24) | **Bind:** Confiscate 1 | **Iron Grip** (Guard): Confiscate 2 | a Chain Spin (×2) |
| **Vex** | 21 (20) | **Slip:** you follow up even if the Pressure was Safe | **Afterimage** (Guard): your follow-up can start a combo | a Crossing Slash (×2) |
| **Bastion** | 23 (22) | **Repulse:** they're Staggered (×3, from ×1) | **Shield Charge** (Break · Heavy, speed 8, chip 3) | — |
| **Atlas** | 26 (28) | **Take the Hit:** gain heat equal to that Pressure's Build, up to your cap (it never becomes damage) | **Immovable** (Guard): they're knocked down | a Hammer Sweep (×2) |

Each fighter's table now: one Pressure, one Break and one Guard special, and the Super (Break for the Benchmark, the Warden and Atlas; Pressure for Vex; Guard for Bastion). Caps unchanged (9, 8, 8, 8, 10).

**Rules text for the new effects** (engine fields `blockConfiscate`, `throughSafe`, `followCombo`, `blockHeat`): each fires only when the Guard is the clash card and beats a Pressure. *Confiscate* is paid after the clash, as usual, with the floor of 2. *Afterimage's* follow-up is still a Counter; if it's a Starter, it opens a Pressure combo. *Take the Hit's* heat stops at the cap, so it can never overflow into damage.

## Sim Check (10 November: the partner on Hard against itself)

**Every matchup, two seeds of 300 (600 games, ±4; row's win rate):**

| | Benchmark | Warden | Vex | Bastion | Atlas | **Average** |
|---|---|---|---|---|---|---|
| **Benchmark** | | 48% | 48% | 48% | 50% | **49%** |
| **The Warden** | 52% | | 50% | 48.5% | **55.5%** | **51.5%** |
| **Vex** | 52% | 50% | | 52% | 53% | **51.5%** |
| **Bastion** | 52% | 51.5% | 48% | | 52.5% | **51%** |
| **Atlas** | 50% | **44.5%** | 47% | 47.5% | | **47%** |

- **Every fighter 47–51.5%; every matchup 44.5–55.5%,** the Warden over Atlas the one at the edge (57% under v20 too).
- **Time-outs 0–8%** a matchup (most 2–5%); median 12–13 rounds. The first pass (v20 HP) had the Warden and Atlas at 55% on average; the HP above came from it.
- **No Guard in hand: 2–13% of rounds** for every fighter (v20: 13–51%). Bought Guard specials count.
- **Guard-heavy fighters:** the Warden plays a Guard in about 48% of his clashes against Vex, Atlas about 45% against Bastion; Take the Hit is Atlas's most played card (15%).
- **The Warden squeezes hard:** Vex discards 4 cards a game to his Confiscates.

**Mindless bots against Hard (Benchmark mirror, two seeds of 200, ±6), each never buying** (bots that buy greedily drain their own heat, which flattered the v20 doc's figures):

| | v21 | v20, never buying (one seed) |
|---|---|---|
| Pressure every round | 24–26% | 25% |
| Guard every round | 28–32% | — |
| Random | 32–33% | 26% |

**The Benchmark mirror** (seed 5): 53%, median 12, time-outs 3%. Heat does 42% of the damage; a player's track is at 0–2 in 65% of rounds and at max in 6%; 69% of games see max heat. Each player buys 2.8–2.9 specials a game; hands hold 7.0 cards at the clash.

## Design Flags

1. **The Warden's Confiscate** (Shakedown, Coil, Bind ×3, Iron Grip): 4 cards a game from Vex. It's his plan, but watch whether it feels oppressive at the table.
2. **The Warden over Atlas, 55.5%.** Both are slow and Guard-heavy now.
3. **Afterimage is rarely played** (0.6% of Vex's clash cards). The partner may undervalue it (it looks one round ahead); check at the table before changing it.
4. **Guard-heavy play:** Atlas and the Warden Guard nearly half the time. Opponents should read it and Break; does it feel like turtling at the table?
5. **The Benchmark's Block is strictly weaker** than every other fighter's own Guard; that's the point of a reference, and HP covers it (49% average).
6. **Atlas and Bastion both have a Knockdown Guard special** (Immovable, Aegis).
7. **Supers still rare** (0.03 bought a game). The review's suggestion (the Super is live at max heat rather than bought) is still open.
8. **Mindless play:** Pressure 25% is where v20 was; random play is a few points better than v20 (33% against 26%, one seed). Not fixed, and worth watching.

## Open Questions

1. Do nine Guards feel right at the table, or too many?
2. Does choosing between three specials make the shop a real choice?
3. The own Guards: does each feel like its fighter?
4. The Super rule (live at max heat, not bought).

## Running It

- **Page:** https://claude.ai/artifact/1LhMpcixH4DzyLrmjNxJBp, built with `node tools/build-artifact.mjs --edition v21` (edition `v21` in `src/editions.js`).
- **Fighters and settings:** `data/v21/` (`guardsQuiet: true` in `settings.json`; on the page, Settings: **Two Guards**).
- **Sim:** `node tools/sim18.mjs --edition v21 game <a> <b> -n 300`.
- **Checks:** `node tools/test21.mjs` (73 pass); `test20` (67), `test18` (66), `test18-roster` (114), `test17` (36), `test16` (96), `test16-warden` (28) still pass. Browser: `node tools/smoke/browser21.cjs dist/yomi-playtest-v21.html <vendor dir>` (157 of 157).
- **Code changes:** `engine.js` (the four Guard effects after a Guard beats a Pressure; `guardsQuiet`; per-card heat prices and the review's `superPrice` test switch), `cards.js` (fields, validation, card text), `narrate16.js`, `play16.js`, `settings16.js`, `decks16.js` (the list shows "28 cards + 3 specials").
