# Test: Counters Only on Pressures, With a Grey Cap (8 November 2026)

*Mark's idea: Counter icons sit mostly on Converts, so a Guard that beats a Pressure clears its own pile **and** cashes theirs, which loosens the triangle's read. Put Counters only on Pressures, and stop Pressure spam with a cap: a pile that reaches it is cashed for damage regardless. "Cap doesn't have to be 9, whatever works." First simmed on the Benchmark mirror; then (Mark: "Try it") all five fighters were converted and put on their own page.*

**Playable: the v19 test page, https://claude.ai/artifact/TDrkScu7TZrGNnmHyHxhL9** ("Yomi Playtest v19 test (grey cap)"): the five fighters below, cap 9. The v18 page is unchanged.

## All Five Fighters (the v19 test set, `data/v19/`)

**Counters moved to Pressures.** Every Convert loses its Counter icon. Gaining it:

- **Benchmark:** Lunge, Slash, Sweep (7 Counters).
- **Warden:** Chain Lash, Ankle Hook, Chain Whip (6); his punish now knocks down.
- **Vex:** Fang Rush, Crossing Slash, Heel Drop (7).
- **Bastion:** every Pressure: Edge Jab, Shield Bash, Rim Shot, Sonic Cutter, Shield Rush (9).
- **Atlas:** Overhead, Hammer Sweep, Lariat (6).

**Tuned after the first sims:**

- **The Warden: HP 33, grabs +3** (Shakedown, Haul In, Shackles, Iron Haul 5; Coil, Chain Prison 6). His grabs are no longer his punishes, so they can hit hard without wrecking Vex.
- **Bastion: HP 38. Atlas: HP 40.** Vex (30) and the Benchmark (34) are unchanged.

| Under cap 9, before tuning | vs Benchmark | | After tuning (two seeds of 400) | vs Benchmark |
|---|---|---|---|---|
| Warden (HP 32, grabs +1) | 40% | | Warden (grabs +3) | 53% at HP 34 (two seeds); at HP 33, 48% (round-robin) |
| Vex (HP 30) | 51% | | Vex | 52% |
| Bastion (HP 36) | 42% | | Bastion (HP 38) | 51% |
| Atlas (HP 38) | 45% | | Atlas (HP 40) | 49% |

*Warden vs Vex before tuning: Vex 62%; with grabs +3 at HP 32: even (50.7%).*

**The round-robin** (300 games each, ±5.5; row's win rate):

| | vs Bench. | vs Warden | vs Vex | vs Bastion | vs Atlas | Average |
|---|---|---|---|---|---|---|
| **Benchmark** (34) | — | 52% | 47% | 48.5% | 49% | 49% |
| **Warden** (33) | 48% | — | 53% | 56% | 51% | 52% |
| **Vex** (30) | 53% | 47% | — | 50% | 46% | 49% |
| **Bastion** (38) | 51.5% | 44% | 50% | — | 52% | 49% |
| **Atlas** (40) | 51% | 49% | 54% | 48% | — | 51% |

Medians 11–14 rounds; time-outs 0–4%.

**Mirrors** (300 games): the Warden median 10, Vex 11, Atlas 12, all 0% time-outs; **Bastion median 17, 25% time-outs** (the cap cashes only 0.7 times a game in his mirror: nine Guards keep both piles clear). The Guard bot gets 35.5% in Bastion's mirror (time-outs) and 34% in Atlas's.

**Compared with v18 the spread is much tighter:** every fighter averages 49–52%, every matchup is 44–56%, and the Warden–Vex problem (73% at its worst under v18) is gone at the root, since his punishes are no longer grabs.

**Still open:** Bastion's mirror drags (25% time-outs; 24% under v18); HP now runs from 30 to 40, so the time-out comparing HP left matters more (comparing HP lost is the recommended alternative); Guard spam (about 30%) is unchanged by this rule.

## The v19 Test Page

- **The HUD shows each pile against the cap** ("7/9"), with "Cashed at the end of the round" when this round's grey will take it there.
- **Board notes** warn when your pile (or theirs) is one Pressure hit from the cap, or will reach it with the round's grey, and the next round opens with what was cashed ("End of round 6: Vex's grey reached the cap of 9 and was cashed for 11 damage."). A game ended by a cap cash says so on the result screen.
- **Settings** has a **Grey cap** dial (0 = off). Setup states the rule.
- **Checks:** the browser smoke test runs against either edition (`SMOKE_EDITION=v19`): 708 of 710 and 573 of 574 on two runs; each miss was a prompt that comes up by chance (a take from the table, the Twin step, the time-out warning, which cap games rarely reach), and each passed on the other run. The v18 build still passes (581 of 581).

## The Rules Tested

- **Counters only on Pressures.** The Benchmark's Throw, Big Swing and Breaker lose Counter; Lunge and Sweep gain it (Slash keeps it): 7 Counters, all Pressures (`data/v18/variants/benchmark-counterP.json`).
- **The grey cap** (rule switch `greyCap`): at the end of the round, after the grey, a pile that has reached the cap is cashed: its owner loses that much HP and the pile empties. Checked at the end of the round, so a winning Convert still cashes everything (no cap on a winning Convert's cash) and a combo's Ender still has its pile. A cap cash can KO.
- **Why the cap is needed, not optional:** a Convert loses to a Pressure, so a player who Pressures every round can only be cashed off a Guard win. With Convert follow-ups gone, the cap is what stops their grey piling up for ever.

## Results

*Hard against Hard in the Benchmark mirror; bots against Hard. 300 games a row (±5.5), seed 5; cap 9 also on seed 9.*

| | Mirror | Median (time-outs) | Cap cashes a game (HP each) | Games ended by the cap | Pressure bot | Guard bot | Random |
|---|---|---|---|---|---|---|---|
| **v18 now** | 52% | 13 (1.7%) | — | — | 31% | 30% | 30% |
| Counters on Pressures, no cap | 50% | 14 (3%) | — | — | 34% | 28% | 25% |
| …cap 7 | 53% | 12 (0%) | 2.3 (9.4) | 27% | 19% | 33% | 25% |
| **…cap 9** | **51%, 50%** | **12 (0%)** | **1.6–1.8 (11)** | **20%** | **23%, 20%** | **31%** | **28%** |
| …cap 12 | 50% | 12 (1.3%) | 0.9 (13) | 16% | 29% | 28% | 23% |
| …cap 15 | 50% | 13 (1.3%) | 0.3 (17) | 13% | 28.5% | 30% | 28% |
| …cap 9, no Safe cards | 46% | 12 (0%) | 1.8 (11) | — | 29% | 31% | 28% |

## What It Does

- **It stops Pressure spam.** At cap 9 the Pressure bot falls from 31% (34% with Counters moved and no cap) to **21%** over two seeds. The spammer never Guards, so their pile only grows (a grey a round, plus every Pressure follow-up) until it bursts.
- **Cap 9 is the sweet spot.** At 7 the cap takes over (2.3 cashes a game, 27% of games end on one) and the Guard bot creeps up to 33%. At 12 and above Pressure spam comes back (29%).
- **Time-outs go** (0%), and games are a round shorter (median 12).
- **The cap becomes a main source of damage:** about 1.7 cashes a game at 11 HP each, roughly half a health bar, and 20% of games end on one. Piles overshoot: combos and follow-ups build past 9 within a round. Converts still close most games (a combo ending in a Convert 43%, a Convert cash 24%).
- **It acts like an automatic Ender.** A two-card combo with no Ender (Lunge, Slash: Build 7) often reaches the cap by the end of the round. Combo damage within the round falls (6.3 HP from 8.5) because the cap empties piles before Enders get them.
- **Follow-ups now build** (0.7 HP of chip each, from 4.3 when they cashed).

## What It Doesn't Do

- **Guard spam is unchanged** (30% → 31%). I'd guessed Convert follow-ups caused it; they don't. A player who guards every round always has an empty pile, so the Converts that beat them only chip, and the partner doesn't learn the habit. That's a separate lever (Convert chip, or a partner that adapts).
- **Safe still earns its place.** Cutting it bought nothing: the mirror went to 46% and the Pressure bot up to 29% (one seed, inside the noise but the wrong way).
- **The type split didn't move:** about 36% Pressure, 35% Guard, 29% Convert in every version. Whether the reads feel tighter at the table is a playtest question; the partner plays a solved mix either way.

## In the Code

GitHub `Youngy34/card-game`, branch `v18-roster`: `greyCap` in `src/engine/v16/engine.js` (`startDraw16`, `finishRound16`), the partner valuing a pile that will reach the cap as certain damage (`score16` in `ai.js`), cap cashes recorded per round (`game.js`) and reported by `node tools/sim18.mjs ... --set greyCap=9`. Checks in `tools/test18-roster.mjs` (66 pass). The v19 test set is `data/v19/` (five fighters and `settings.json` with `greyCap: 9`); the page is edition `v19` (`node tools/build-artifact.mjs --edition v19`). The page code: the cap in the HUD and setup (`play16.js`), board notes and the cap-cash line (`match16.js`), the Settings dial (`settings16.js`).

## 8 Nov Evening: An Overflow Cap, and Cashing Only on a Win

Mark's point: with Convert Enders, a loaded player can be cashed whatever they play (a faster Pressure combos into a Convert). And the cap does the same: on 7, losing anything that adds grey takes the pile past 9 and empties it. Two test switches:

- **`greyOverflow`**: the pile can't go above the cap. Grey beyond it is lost as HP at once, and the pile stays at the cap (the round's 1 grey too). So a loaded player who loses bleeds, but only a Convert takes the whole pile.
- **`cashOnWin`**: only a Convert that wins the clash cashes. A Convert played as a Linker, Ender or follow-up just deals its damage.
- **A fighter's own cap** (`greyCap` on the fighter), used whenever the rule's cap is on.

### Does the Triangle Come Back?

A player on a pile of 5+ loses the clash. How often is the pile taken that round (and the HP they lose), by what they played. Benchmark mirror, 200 games:

| | Lost with a Pressure | Lost with a Convert | Lost with a Guard |
|---|---|---|---|
| v18 (no cap) | 43% | 58% | 100% |
| v19 test (cap 9, cashes) | 66% (8.4 HP) | 96% (11.8) | 100% (8.9) |
| cap 9 + cash on a win only | 65% (8.8) | 92% (10.8) | 100% (8.8) |
| overflow cap 9 | 20% (5.3) | 62% (8.9) | 100% (9.8) |
| **overflow + cash on a win only** | **0% (4.1)** | **37% (8.0)** | **100% (10.2)** |

Only the two together give a clean triangle: a Pressure that loses never loses the pile, a Convert loses it only to a faster Convert, a Guard always does. Either alone does little: with the cash-everything cap, cutting Convert Enders just hands the kills to the cap (cap cashes end 50% of games).

### The Game It Makes

Benchmark mirror, 300 games; bots against Hard, 300 games each (±5).

| | Median (time-outs) | How games end | Combo HP | Pressure bot | Guard bot | Random |
|---|---|---|---|---|---|---|
| v19 test (cap 9, cashes) | 12 (0%) | combo→Convert 43%, Convert 24%, cap 20% | 6.3 | 23% | 31% | 28% |
| overflow only | 13 (1.7%) | combo→Convert 34%, Convert 33% | 9.4 | 30% | 36% | 28% |
| **overflow + cash on a win** | **14 (5%)** | **Convert 43%, combo→Convert 19% (chip), chip 16%, cap 9%** | **4.7** | **24%** | **29%** | **32%** |

- **Convert reads become the kill.** Pressure spam stays down (24%), Guard spam is a touch lower (29%).
- **Combos get weaker** (4.7 HP, from 6.3): they build and end on chip. Convert Enders are now worse than Pressure Enders, so fighters' Enders want a look.
- **Games run longer** (median 14, time-outs 5%, inside the band). Full piles are common: the round's grey spills about 4–5 HP a game.
- Overflow alone is worse than the v19 test: combos ending on a Convert cash a full pile, and the Guard bot climbs to 36%.

### A Fighter's Own Cap

Benchmark with its own cap against Benchmark on 9, overflow + cash on a win, 300 games each (±5.7):

| Own cap | 5 | 7 | 9 | 11 | 13 |
|---|---|---|---|---|---|
| Win | 37% | 43% | 49% (mirror) | 49% | 57% |
| Time-outs | 2% | 5% | 5% | 6% | 9% |
| Games ending on a Convert cash | 35% | 41% | 43% | 44% | 50% |

- **A higher cap is better**, about 2–2.5% a point: roughly a point of HP each. Bleeding is certain damage; a big pile is only lost to a Convert read, and a Guard clears it.
- **It changes how you're beaten.** A low-cap fighter dies to Pressure (follow-ups and combos end more games against cap 5); a high-cap fighter dies to a Convert read (half the games against cap 13), and time-outs creep up.
- The opponent's mix barely moves (Pressure 38% against cap 5, 36% against cap 13), so in the sim it's mostly a stat. At the table it may read stronger: on a cap-5 fighter you never fear a big cash.

Code: `greyOverflow`, `cashOnWin`, `capOf` and `spill` in `engine.js`; the partner values grey above the cap as certain damage (`score16`); spills are recorded per hit (`spill`, counted in damage) and at the end of the round (`capSpill`); `sim18.mjs` reports them. Checks in `tools/test18-roster.mjs` (76 pass). Variants `data/v19/variants/benchmark-cap{5,7,11,13}.json`. Not on a page yet.
