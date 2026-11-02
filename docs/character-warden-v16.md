# Character Draft — the Warden (v16, draft 2, simmed)

*1 November 2026, against `rules-overview 16.md`. Mark's brief: a fighter who likes to grab, whose plan is making the opponent discard, limiting their options. **Draft 2 has been simmed against the Benchmark** (sparring partner Hard against Hard). He's playable on the new v16 page, "Yomi Playtest v16 · Warden". Names are placeholders.*

## Decisions and Changes (1 November)

- **Mark: his Pressures should chip,** or against fast Convert spam he can't cash the grey he builds. Chain Lash and Ankle Hook now chip 1. In sim it mattered against a Convert-spam bot, not against Hard (see *Sim Results*).
- **Death Grip is cut.** It was a trap in sim: he won more often barred from it, even with +2 chip added. Its slot went to a **second Read** (his own card flow turned out to matter most) and a **third Shakedown**.
- **HP stays 38,** the Benchmark's. Draft 1 needed HP 40–41 to break even; the new neutral deck closed the gap instead.
- **Slam stays plain.** Making it a second cashing Ender changed nothing measurable.

## The Pitch

**He takes your options away.** A chain-wielding jailer: he drags you in, wraps you up and strips your hand. His grabs beat Guards and every Counter he holds is a grab. Shakedown takes a card before the clash, Coil takes one on hit, Shackles caps your hand at 5, and his Super cuts it to 3.

- **No passive.**
- **No card says "+X if their hand is small".** The rules already pay for it: fewer Counters, shorter combos, narrower reads.

## Confiscate

> **Confiscate:** the opponent discards a clash card of their choice, unless they hold 2 or fewer. Never their Super.

- **Their choice** keeps it quick and keeps their hand hidden. The discard pile is public, so what they throw away is a tell.
- **The floor at 2** keeps a real choice in every clash.

## Clash Deck (20)

| Card | Copies | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| **Chain Lash** | 4 | Pressure · Strike | 15 | Build 3, chip 1 | Starter, Linker | — |
| **Ankle Hook** | 2 | Pressure · Strike | 12 | Build 3, chip 1 | Ender | **On hit:** Knockdown. |
| **Haul In** | 4 | Convert · Grab | 9 | chip 2 | Counter | — |
| **Coil** | 2 | Convert · Grab | 4 | chip 3 | Ender, Counter | **On hit:** Confiscate. |
| **Slam** | 2 | Convert · Grab | 2 | chip 4 | Counter | — |
| **Chain Guard** | 6 | Recover · Guard | — | — | — | — |

- **Pressure 6, Convert 8, Guard 6; 8 Counters, all grabs.**
- **He loses Pressure duels and wins grab duels** against the Benchmark (Chain Lash 15 against Jab 17; Haul In 9 against Throw 7).

## Neutral Deck (10)

| Card | Copies | Text |
|---|---|---|
| **Charge** | 3 | **On reveal:** gain 1 meter. |
| **Read** | 2 | **On reveal:** draw 2 clash cards (whatever the Benchmark settles). |
| **Shakedown** | 3 | **This round,** at the start of the clash step: Confiscate. |
| **Shackles** | 2 | **Stays in play.** Their clash hand limit is 5. Discard this when one of their Pressures hits you. |

- **Shakedown waits for the clash step** because Read also happens On reveal, and the floor would depend on which went first.
- **Shackles is checked in the draw step,** like the usual limit of 8. Hitting him with a Pressure breaks it, which invites the attack his Guard punishes.

## Super — Chain Prison

**Convert · Grab · speed 10 · chip 3 · Counter · Cost:** 3 meter · **On hit:** they discard down to 3 clash cards (their choice).

---

## Sim Results (1 November)

*Hard against Hard, 300 games a row (about ±6) unless noted. The Benchmark mirror gives 47% from seat noise alone. Engine note: the GitHub `v16-rules` branch predates grey each round (only the live page has it), so the patch re-adds it; the Benchmark mirror then matched the 1 November calibration (median 14 rounds, Guard / Pressure / Convert 42 / 29 / 29%, combos 17% of rounds).*

### Getting to draft 2

| Version (against the Benchmark) | Warden wins |
|---|---|
| Draft 1 as pitched (Pressures chip 0) | 43%, 40% (two seeds) |
| Pressures chip 1 | 38%, 43% |
| …and Slam an Ender | 39% |
| …at HP 40 / 41 / 42 | 51% / 50.5% / 55% (two seeds each) |
| **Draft 2** (no Death Grip, Read ×2, Shakedown ×3, HP 38) | **54%, 51%, 51%** (52% over 900 games) |

### What moved it

Against draft 1 with chip at HP 38 (43% on the same seed):

| Change | Warden wins |
|---|---|
| Chain Lash at Jab's speed and values (17, Build 2, chip 1) | 54% |
| His neutral deck on the Benchmark's clash deck | 52% |
| His clash deck with the Benchmark's neutral deck | 46% |
| **Who picks the discard:** they do / random / they show 2 and he picks / he picks from their whole hand | 43 / 45 / 48 / 55% |

### Draft 2 against the Benchmark

- **52% over 900 games, median 14 rounds.** (The details below come from 300–500 of them.)
- **Their hand at the clash: 4.6** (7.3 in the Benchmark mirror). About **4.2 cards Confiscated a game**, 3.0 of them by Shakedown before the clash. Shackles is in play 44% of rounds.
- **What they throw away:** Guard 35%, Sweep 20%, Throw 17%, Slash 10%, Jab 10%, Big Swing 8%.
- **His neutral step:** Charge 29%, Shakedown 24%, Read 22%, Shackles 18% (7% skipped, knocked down). **Clash cards:** Guard 41%, Convert 34%, Pressure 25%.
- **His Super is rare:** 0.25 a game, against the Benchmark's 0.43.

### What each neutral card is worth

(His wins when barred from it; under the baseline means it's worth having.)

| | Baseline | Read | Shackles | Shakedown | Charge | Death Grip |
|---|---|---|---|---|---|---|
| Draft 1 with chip, HP 40 | 49% | **38%** | 42% | 46% | 45% | **54%** (a trap; 54% with +2 chip too) |
| Draft 2 | 54% | 46% | **43%** | 45% | 52% | — |

### Convert spam (Mark's question)

A bot that plays its fastest Convert whenever it can, against Hard (the bot's wins):

| Benchmark | Draft 1, chip 0 | Draft 1, chip 1 | Chip 1, Slam an Ender, HP 42 | Draft 2 |
|---|---|---|---|---|
| 16% | 31% | 23% | 17% | 23% |

### Mindless bots and the mirror

- **Benchmark-deck bots against draft 2 on Hard** (the bot's wins): Guard every round 29%, Pressure every round 28%, any attack 26%, random 28%, Convert 23%. In the Benchmark mirror: 28 / 22 / 19 / 23%.
- **Warden mirror:** median **17 rounds** (the Benchmark's is 14); hands 4.6 each; 5.2 Confiscated each a game; Supers 1.1 each a game; Shackles up 53% of rounds.

### If Read drops to draw 1 (the tuned candidate)

Both fighters on Read draw 1, against the tuned Benchmark: **62%**. With Shakedown ×2 and Charge ×4: **52%**. At HP 34 instead: 46%.

## What the Sims Say

1. **Chip on his Pressures doesn't move him against Hard** (40–43% either way), **but it does against Convert spam** (the bot's wins fall from 31% to 23%). Kept. What the Convert bot exploits is mostly the sparring partner, which keeps Guarding into it (Guard 44% of his cards, losing 25% of all rounds to it); the Benchmark's Hard does the same.
2. **In v16, a fast Pressure is worth more than a fast Convert.** Draft 1 lost Pressure duels 74–79% and the Benchmark comboed off them; he won grab duels 66–74%, but a Convert win only cashes. Matching Jab's speed alone took him from 43% to 54%. **Roster implication:** draft 3's interleaving (Vex wins every Pressure duel, Atlas every Convert duel) isn't an even trade once Starters combo.
3. **"Their choice" lets them dump Guards,** the card his grabs want to beat (35% of discards). So Confiscate pushes their hand towards Pressure, the type that beats his grabs. Letting him pick from two they show was worth +5; from their whole hand, +12.
4. **His own card flow matters most.** Read was the most valuable card in draft 1 even with one copy. A Confiscate is Read in reverse, so he's in the card war on both sides.
5. **Death Grip was a Rush:** a tell ("I'm grabbing") whose payoff (one Confiscate) is worth less than the slot. Cut.
6. **Read's draw number sets his strength.** Under draw 1, the Benchmark can't refill (hand 3.75 at the clash) and he wins 62%. The fix is ready: Shakedown ×2, Charge ×4.

## How He Plays

- **The loop.** Opponents stop Guarding against his grabs and Pressure him; his Guard beats Pressure and every Counter is a grab. Shackles makes Pressure their way out, which feeds that. When they Convert to beat his Guard, Haul In wins most grab duels and his Pressure beats any Convert.
- **The card war.** Their way back is drawing. Shackles wastes Read's extra cards, Ankle Hook's knockdown skips their neutral step, and Chain Prison hits a full hand hardest.
- **What a small hand does:** fewer Counters (their Guards stop punishing, so his Pressure gets safer), shorter combos, and a hand you can count. The catch: fewer Guards for his grabs to beat, so he leans towards Pressure and Guard as they shrink.
- **The Ender choice:** Chain Lash, Chain Lash, **Coil** cashes 6 and chips 5: **11 HP and a Confiscate.** Ending on **Ankle Hook** leaves 9 grey and knocks them down: no Read next round.

## Flags

1. **Being squeezed must still feel like playing.** The Benchmark sits at 2–3 clash cards in 27% of clashes. Check at the table that it feels cornered rather than shut out.
2. **The mirror runs long** (median 17 against 14): both hands sit near 4.6 and Supers come out 1.1 times a game each.
3. **Charge is weak for him** (barred, he barely notices) and his Super is rare against the Benchmark. A Charge could become something else, or Chain Prison could cost less.
4. **Mindless play does a few points better against him** than in the Benchmark mirror (Pressure spam 28% against 22%). The partner doesn't adapt to habits, so the Reader would tell us more; it would also show whether he really punishes Guard spam (unconfirmed: the Guard bot gets 29%, the same as in the mirror).
5. **Overlap with Atlas:** with the Warden in, Atlas should own Guard Breaks and leave grabs to him.
6. **Opponent-facing by nature.** Kept to one keyword and one limit.

## Next

1. **Play him at the table:** he's on the new v16 page, "Yomi Playtest v16 · Warden" (https://claude.ai/artifact/6nhiH3itWrpzQZbCHKXWdu), with Confiscate prompts for a human player. Both fighters are at HP 38 there; at 25 against 25 he wins 55% (400 games, ±5).
2. **If the Benchmark moves to Read draw 1,** switch him to Shakedown ×2, Charge ×4.
3. **Port the Reader,** then re-check the mindless bots against him.

## In the Code

`sim/warden-engine.patch` applies to `Youngy34/card-game` branch `v16-rules` (commit a5f827d). It adds grey each round (`greyPerRound`, default 1) and the Benchmark at HP 38; Confiscate (`confiscate` on attacks, `atClash` on neutral cards, `discardDownTo` on the Super, floor `confiscateFloor` 2); Shackles (`capHand`, `endsOn: "pressureHit"`); the partner's valuation and discard choice (`confiscateBy` test switch: victim, random, reveal2, taker); a Convert bot; `data/v16/warden.json`; `tools/test16-warden.mjs` (28 checks; the 96 existing checks still pass); and `tools/warden-study.mjs` for the breakdowns above. `sim/warden-app.patch`, applied after it, puts him on the playtest page (see `app/playtest-app v16 guide.md`).

## History

- **Draft 1 (1 November, pitched):** Pressures chip 0, Read ×1, Shakedown ×2, Death Grip ×2 ("this round, your Grabs Confiscate on hit"), Shackles ×2, Charge ×3, HP 38. Simmed at 40–43%.
