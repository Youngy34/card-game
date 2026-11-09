# Test: Counters Only on Pressures, With a Grey Cap (8 November 2026)

*Mark's idea: Counter icons sit mostly on Converts, so a Guard that beats a Pressure clears its own pile **and** cashes theirs, which loosens the triangle's read. Put Counters only on Pressures, and stop Pressure spam with a cap: a pile that reaches it is cashed for damage regardless. "Cap doesn't have to be 9, whatever works." First simmed on the Benchmark mirror; then (Mark: "Try it") all five fighters were converted and put on their own page.*

**Playable: the v19 test page, https://claude.ai/artifact/TDrkScu7TZrGNnmHyHxhL9** ("Yomi Playtest v19 test (overflow cap)"). **Since the night of 8 November it plays the overflow version with two combo lines** (the last two sections: the pile stops at its cap, a Convert cashes only as the clash card, Converts combo only into Converts, every fighter retuned). The first version described below (cash at the cap) is in git as tag `v19-cashcap` and in `data/v19/cashcap/`. The v18 page is unchanged.

## All Five Fighters (the first v19 test set, now `data/v19/cashcap/`)

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

Code: `greyOverflow`, `cashOnWin`, `capOf` and `spill` in `engine.js`; the partner values grey above the cap as certain damage (`score16`); spills are recorded per hit (`spill`, counted in damage) and at the end of the round (`capSpill`); `sim18.mjs` reports them. Checks in `tools/test18-roster.mjs` (76 pass). Variants `data/v19/variants/benchmark-cap{5,7,11,13}.json`.

## 8 Nov Evening: The v19 Set, Converted (Now on the Page)

Mark: go with the two rules; a Convert converts only as the initial hit, or only Pressures are used in combos. Both, as one idea: **a Convert cashes only as the clash card** (the rule, `cashOnWin`), so **no Convert carries a Linker or Ender icon** (how cards are written). Plus the **overflow cap of 9** and **a fighter's own cap**.

### The Fighters

| | HP | Grey cap | What changed |
|---|---|---|---|
| **Benchmark** | 32 | 9 | Big Swing, Wind-Up, Breaker and Overdrive lose Ender; Sweep is the only Ender |
| **The Warden** | 31 | 9 | Coil loses Ender: his route is Chain Lash into Ankle Hook (Knockdown), no Ender. Grabs back to +1 (Shakedown, Haul In, Shackles, Iron Haul 3; Coil, Chain Prison 4) |
| **Vex** | 31 | **7** | Pommel Strike loses Ender; Heel Drop and Hundred Fang end her combos |
| **Bastion** | 36 | **6** | Shoulder Ram and Shield Slam lose Ender, so Rim Shot gains it (×3, from ×2); Repulse ×1 (from ×2): 8 Guards, still the most |
| **Atlas** | 34 | **12** | Hammer Spin, Earthsplitter, Upheaval and Avalanche lose Ender; Hammer Sweep is the only Ender |

**The caps as identity:** Atlas soaks Pressure that would bury anyone else, but a Convert read on a full pile is a huge hit; Vex is fragile but never has much to cash; Bastion is the wall: hits trickle through, never a big opening.

### How It Got There

| Step | Result |
|---|---|
| Strip Convert Enders, Vex cap 7 HP 32, Atlas cap 12 HP 37 | Warden 64% average (his +3 grabs, with Convert wins now the main kill); Vex 42%; Bastion's mirror times out 54%, his matchups up to 27% (no Ender left) |
| Warden grabs +2 / +1 | vs Benchmark 55% / 52%, vs Vex 63% / 51%: **+1** |
| Bastion: Rim Shot Ender at HP 38 / 36; no Ender at HP 34 | 58% / 48% / 39% against the Benchmark, but time-outs ~20% whatever the HP |
| Bastion: 8 Guards (HP 36, 34, 32) | 61%, 56%, 51%; time-outs 12%, 11%, 7% |
| Bastion: 8 Guards, cap 6 (HP 36, 35) / cap 5 (HP 36) | 45%, 47% / 47%, time-outs 7–8%; **his mirror 8%** (from 24–54%) |
| All five with Bastion cap 6 HP 38 | averages 46–52.5%, but time-outs 7–13% in most matchups: less damage in the game without Convert Enders and cap cashes |
| **Every HP −2 (Vex −1)** | time-outs 2–9%; Atlas v Vex 62% (seed 5) |
| Atlas cap 11 HP 35 / cap 12 HP 34 / cap 10 HP 36, seed 9 | vs Vex 54.5 / 51.5 / 54.4%, vs Benchmark 53%: **cap 12, HP 34** |

### The Round-Robin (Final Set, Seed 9, 300 Games Each, ±5.7; Row's Win Rate)

| | vs Bench. | vs Warden | vs Vex | vs Bastion | vs Atlas | Average |
|---|---|---|---|---|---|---|
| **Benchmark** (32, cap 9) | — | 43% | 51% | 47% | 46% | 47% |
| **Warden** (31, cap 9) | 57% | — | 46% | 48.5% | 55% | 51% |
| **Vex** (31, cap 7) | 49% | 54% | — | 48.5% | 48% | 50% |
| **Bastion** (36, cap 6) | 53% | 51.5% | 51.5% | — | 51% | 52% |
| **Atlas** (34, cap 12) | 54% | 45% | 52% | 49% | — | 50% |

- **Medians 12–16 rounds; time-outs 1–9%** (Bastion's mirror 8.7%, Bastion v Benchmark 7%, the rest 1–6%).
- **How games end:** a Convert cash in 44–67% (most in the Warden's and Atlas's mirrors), combos 3–20% (most in Vex's mirror), a full pile's grey at the end of a round 6–13%.
- **Bots against Hard, Benchmark mirror:** Pressure 20%, Guard 27%, Convert 30%, random 31%, Easy 32%, Medium 43%. **In Bastion's mirror** (200 games, ±7): Pressure 16%, Guard 32% (35.5% under the cash cap), random 33%, Easy and Medium 44.5%: in his mirror, skill counts for less.
- **Seed 5 (Atlas at HP 35) for comparison:** averages 47–54%; Atlas 54%, and 62% against Vex there: the reason for HP 34.

### The Page

- **The HUD shows each pile against its own cap** ("5/6"), with **"Full: more grey costs HP"** when it's at the cap. The fighter picker and the deck list show each fighter's cap.
- **Board notes:** your pile (or theirs) is full: grey now is lost as HP, and a Convert that wins the clash cashes it all; or one Pressure hit from full. When a full pile takes the round's grey, the next round opens with it ("End of round 6: Vex's pile was full, so the round's grey cost 1 HP.").
- **Narration:** "Slash puts 4 grey on Vex and chips 1. Vex's pile is full: 3 of it is lost as HP."
- **Setup** states both rules. **Settings:** "At the cap" (Overflow, or Cash as in the first test) and "When a Convert cashes" (only as the clash card, or whenever it hits, as v18). **Decks:** a Grey cap tile with − and + (— uses the rule's).
- **Checks:** browser smoke test 431 of 431 on the v19 page and 483 of 483 on the v18 page; `tools/test18-roster.mjs` 98 pass (the v19 set: no Convert Linker or Ender, each HP and cap, piles never pass their caps).

**If adopted:** this is the v19 candidate. The Convert Enders are gone, so "Ender" now always means a Pressure that builds (or knocks down); combos are a building tool and Converts are the kill. Watch at the table whether combos still feel worth landing (about 3–5 HP of grey each), and whether full piles bleeding 1 a round reads well.

## 8 Nov Night: Two Combo Lines (On the Page)

Mark: Converts (guard breaks) could combo, but only into Converts; Pressures only into Pressures. Two separate combo lines, and guard breaks combo without breaking the triangle. **Grabs stay out of combos, except perhaps the Warden's.**

**The rule** (switch `comboSameType`): *a combo continues only with cards of its Starter's type.* It replaces "Converts are never Linkers or Enders". A Convert line can only follow a Convert that won (they Guarded, or played a slower Convert), so it never touches a player who read it with a Pressure. The clash card has already cashed the pile, so a Convert line's other cards deal their damage as plain HP.

**The lines:** one guard-break Starter into one Ender, no Linkers (Convert combos hit as straight HP, so they're kept short):

| | Convert line | Notes |
|---|---|---|
| **Benchmark** | Big Swing → Wind-Up | Throw is a grab: not in it |
| **The Warden** | Haul In → Coil | grabs (Mark: maybe for him) |
| **Vex** | Undercut or Cross-Up → Pommel Strike | Cross-Up used to lead into her Pressures; now it starts this line. **HP 32** (from 31) |
| **Bastion** | Shoulder Ram → Shield Slam | Lockdown is a grab: not in it |
| **Atlas** | Shoulder Check → Hammer Spin | Earthsplitter as the Ender made him 54% on average (59% against the Benchmark); Hammer Spin (4, no Knockdown) instead |

**The Benchmark mirror** (seed 5; today's v19 Benchmark in brackets):

- **The triangle holds.** A player on 5+ who loses with a Pressure loses the pile 0% of the time (0%); with a Convert 41% (43%); with a Guard 100%, losing 11.2 HP (10.7). On 0–4, a lost Guard costs 4.8 HP (4.1).
- **Bots against Hard:** Pressure 19% (20%), Guard 29% (27%), Convert 28% (30%), random 27% (31%), Easy 28% (32%), Medium 42% (43%).
- **Combos in 30.5% of rounds (24%), 5.0 HP each (3.3); median 13 rounds (14), time-outs 3.7% (6%).** A combo ending in a Convert ends 10% of games.
- **The mix:** Pressure up about a point, Convert down a point, Guard level, as the triangle's maths predicts (raising what a Convert win pays makes the answer to Converts, Pressure, more common).
- **The line is worth about 6%:** the line Benchmark beats today's 56% (400 games).
- **Guard spam isn't fixed in the sim** (Guard bot 29%): the partner doesn't adapt to a habit, so it plays its usual mix against a player who always Guards. A person who spots a guarder now gets more for each Convert read.

**The roster** (two seeds of 300, so 600 games a matchup, ±4; row's win rate):

| | vs Bench. | vs Warden | vs Vex | vs Bastion | vs Atlas | Average |
|---|---|---|---|---|---|---|
| **Benchmark** (32, cap 9) | — | 47% | 51% | 45% | 50% | 48% |
| **Warden** (31, cap 9) | 53% | — | 51.5% | 45% | 54% | 51% |
| **Vex** (32, cap 7) | 49% | 48.5% | — | 51% | 48% | 49% |
| **Bastion** (36, cap 6) | 55% | 55% | 49% | — | 47% | 52% |
| **Atlas** (34, cap 12) | 50% | 46% | 52% | 53% | — | 50% |

- **Time-outs 0–8%** (most 1–6%; Bastion's mirror 5–6%, from 8.7% without lines). Medians 12–15.
- First pass, before the Atlas and Vex changes (one seed): averages 47–54%, Atlas 59% against the Benchmark, Vex 42% against Bastion.

Files: the five fighters as tuned are now `data/v19/` (copies in `data/v19/variants/lines/final/`; the first pass in `data/v19/variants/lines/`), with `comboSameType: true` in `data/v19/settings.json`. Checks in `tools/test18-roster.mjs` (110 pass): a Convert Starter is offered only Convert Enders, a Pressure Starter only Pressures, a Convert Ender after the cash deals only its own damage; each fighter's line as listed, no Convert Linkers, no grab in a combo but the Warden's.

**On the page** (8 Nov, 21:40): setup states the rule ("a combo continues only with cards of its Starter's type: Pressures into Pressures, Converts into Converts"); Settings has **Combo lines** (two lines, v19; or one, v18); the combo prompts only offer cards of the line's type. Browser smoke test 442 of 442 on the v19 page, 481 of 481 on the v18 page.

**9 Nov: an Ender can follow the Starter straight away** (Mark: Enders can be played after the Starter or after a Linker, and always end the combo; both lines follow the same rule). The engine always allowed it (a Convert line is Starter → Ender because there are no Convert Linkers, not because of a different rule), but the page hid it: at the Linker step an Ender was greyed out as "Not a Linker" behind a "Skip the Linker" button. Now the Linker step offers both ("Combo: play a Linker, or an Ender to finish"); an Ender played there ends the combo; "Stop here" ends it with nothing. A Linker or Ender of the other type is labelled "Pressures only" (or "Converts only"). The card reminders now read "a Linker carries it on, an Ender ends it". Both pages republished (v18 and v19); browser smoke test 459 of 459 (v19) and 454 of 454 (v18); `tools/test18-roster.mjs` 114 pass.
