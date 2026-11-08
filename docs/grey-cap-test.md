# Test: Counters Only on Pressures, With a Grey Cap (8 November 2026)

*Mark's idea: Counter icons sit mostly on Converts, so a Guard that beats a Pressure clears its own pile **and** cashes theirs, which loosens the triangle's read. Put Counters only on Pressures, and stop Pressure spam with a cap: a pile that reaches it is cashed for damage regardless. "Cap doesn't have to be 9, whatever works." Simmed on the Benchmark mirror only; no fighter has been converted, and nothing is on the playtest page.*

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

## Not Done Yet

- **No fighter has been converted.** The Warden's punishes stop being grabs (which fixes the Vex matchup), Bastion's counter identity needs rethinking, and every deck's Counters move to Pressures.
- **The playtest page** doesn't show the cap: it needs the pile shown against the cap, the cap cash narrated, and the switch in Settings.

## In the Code

GitHub `Youngy34/card-game`, branch `v18-roster`: `greyCap` in `src/engine/v16/engine.js` (`startDraw16`, `finishRound16`), the partner valuing a pile that will reach the cap as certain damage (`score16` in `ai.js`), cap cashes recorded per round (`game.js`) and reported by `node tools/sim18.mjs ... --set greyCap=9`. Checks in `tools/test18-roster.mjs` (66 pass).
