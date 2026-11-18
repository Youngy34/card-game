# Turns and Footwork Test (18 November): Option B

*Rules and reasoning: `claude/turns and footwork - idea ready to sim (18 Nov).md`. Predictions were written first, in `PREDICTIONS.md`. Code: branch `v23`.*

## Verdict

**Don't adopt B as written** (nor A, tested after: see Option A below). It fixes being *stuck* at the weak range, but it makes "I can barely play anything" more common, which was Mark's complaint. All three partners show it, and the partner on the second refit too. **Footwork is the cause.** Turns on their own are worth keeping as a candidate.

How sure: **confident about footwork**. Every partner shows the same thing, and a strong player loses nothing by never using it. **Moderately sure about turns alone**: that's one run on a partner fitted with footwork.

## What was built

- **Turns:** only the player holding the initiative takes the end-of-round turn, then the token passes.
- **Two actions:** taken from the usual menu plus footwork. At most one move (either kind) and one zone a turn. Passing ends the turn.
- **Footwork:** move the fight by discarding a Guard.
- **Overdrive:**
  - taken once, it covers your next clash;
  - taken as both actions (4 Charge), it covers your next two clashes.
- **Knockdown:** your next turn has one action, and you lose every speed clash in your next clash. The old "no option the round it lands" is off under turns.
- **The partner:** for the first of two actions, it takes its best 3 single actions and tries each with its best second.
- Editions:
  - `data/v23turn`: today's partner (v23tp2), not refit;
  - `data/v23turn1`: first refit;
  - `data/v23turn2`: second refit.
- Checks: `tools/test23turn.mjs` (26 pass). The older suites still pass, and today's rules give the same results as before.

## Results (Hard v Hard, Brawler v Zoner, 1,200 games each, both seat orders)

| | Today (v23tp2) | B, today's partner | B, refit 1 | B, refit 2 | Turns, no footwork* |
|---|---|---|---|---|---|
| Brawler at Far: ≤2 choices | 29.8% | 44.3% | 44.2% | 42.0% | 31.7% |
| Brawler at Far: 1 choice | 6.4% | 14.0% | 14.6% | 13.0% | 5.9% |
| Brawler: games with 3+ clashes in a row at ≤2 choices | 22.3% | 40.7% | 38.7% | 35.8% | 22.0% |
| Brawler: games with 2+ in a row at 1 choice | 8.1% | 15.9% | 16.5% | 14.6% | 5.4% |
| Brawler: away spells of 3+ clashes | 31.4% | 15.5% | 16.8% | 17.4% | 23.6% |
| Brawler: mean away spell | 2.25 | 1.55 | 1.57 | 1.62 | 1.84 |
| Brawler: hand at the clash | 5.40 | 4.66 | 4.64 | 4.69 | 5.14 |
| Brawler: share of clashes Guarded | 41.4% | 36.3% | 35.4% | 35.4% | 39.3% |
| Zoner at Close: ≤2 choices | 17.3% | 27.1% | 26.3% | 26.9% | 16.9% |
| Range changes a game | 4.4 | 6.8 | 6.6 | 6.2 | 5.5 |
| Moves answered straight back | 28% | 38% | 37% | 34% | 27% |
| Brawler win | 45.3% | 46.6% | 46.5% | 46.3% | 46.2% |
| First player win | 47.8% | 49.5% | 48.5% | 50.5% | 48.0% |
| Time-outs | 9.4% | 2.7% | 2.4% | 2.8% | 6.9% |
| Swing | 13.4% | 19.0% | 17.6% | 17.6% | 15.8% |
| Median rounds | 13 | 13 | 12 | 12 | 13 |

*Turns and two actions with footwork switched off. It used the refit-2 partner, which was fitted with footwork.

Other measurements:
- **Mirror swing** (Brawler / Zoner): today 23.8% / 13.4%; B refit 1 19.7% / 17.5%; B refit 2 21.7% / 20.7%.
- **Mirror time-outs:** today 10.3% / 9.3%; B refit 2 3.7% / 5.7%.
- **Guard draws per player per game** (`luck.mjs`, 1,200 games): 3.76 today, 2.81 under B.
- **Footwork use:** 2.0 a game, about one per player.

**The skill ladder** (`luck.mjs`, against Hard, 1,200 games each). Read as the variant's win rate against Hard:

| | Today | B, refit 2 |
|---|---|---|
| Random | 14.0% | 13.5% |
| Medium | 34.1% | 37.2% |
| Never Overdrives | 46.0% | **35.1%** |
| Never uses footwork | — | **49.7%** |

**Overdrive:**
- 4.9 buys a game, the same as today;
- the double (4 Charge for two clashes) is bought 0.14 times a game. The partner can't see the second clash, so it undervalues this.
- Damage in the clash after a move plus Overdrive turn is 2.76, against 2.39 after other Overdrives: no big setup spike.
- A zone set off by the Zoner's own footwork in the same turn: 0.06 a game, which is rare.

**Fitted prices under B** (refit 2), in HP:
- Charge 0.28 (today 0.34);
- a card in hand about 1.0 (a Pressure 1.04, a Guard 1.00);
- **a knockdown 0.81 (today 0.46):** losing an action matters;
- being at your own range 0.16;
- holding the token at the start of a clash −0.10. It means the opponent just had their turn.

## Predictions against results

- Brawler at Far ≤2 choices to about 15%: **missed badly** (42–44%).
- Range changes 6–9 a game: **hit** (6.2–6.8).
- Swing up 2–5 points: **hit, at the top** (+4.2 to +5.6).
- Time-outs flat to down 3: **missed, in a good direction** (down 6.6–7.0).
- Balance within 3 points: **hit.**
- First player 50–55%: **hit or just under** (48.5–50.5%).
- Overdrive buys rise: **missed** (flat).
- Never Overdriving costs more than 3.6 points: **hit, hugely** (15 points).

**Pass bars:**
- Choices: **failed.**
- Swing: passed, at the edge.
- Time-outs: passed.
- Balance: passed.
- First player: passed.
- Medium at or under 40%: passed.
- Ping-pong: passed (34–38% of moves answered straight back).

## Why the prediction missed

The idea doc treated footwork as a way out for cards you can't use. But **a Guard is never dead**: it's playable at both ranges. Footwork turns one of your live cards into a move.

Players also Guard less in the clash (35% against 41%), so Guards draw about one card fewer per player per game. Together that's about two cards fewer per player per game, and 0.7 fewer cards at every clash. Having few choices stops being a weak-range problem and becomes a whole-game one. Stuck spells get shorter, but each clash has fewer options, at both ranges.

Footwork is close to break-even on average: never using it costs nothing against Hard. A strong player gains nothing by having it, and the table pays for it in rules and smaller hands.

The run without footwork confirms the cause. With turns and two actions alone:
- choices are where they are today;
- stuck spells are shorter (3+ spells 31% → 24%);
- swing is up 2 points;
- time-outs are 7%.

## Other things learned

- **Under turns, Overdrive matters much more:** never using it costs 15 points, against 4 today. The defender can't meet an EX with their own in the same clash. Overdrive isn't a reflex (it's bought in about 40% of turns), but if defence feels hopeless at the table, the lever the idea doc named is still there: a reversal.
- **The knockdown's price nearly doubles** under turns (0.46 → 0.81 HP), because one action instead of two is a real loss.
- **Two actions already let you turn a dead card into a move:** charge up a Throw at Far (2 Charge), then move with it, in one turn. That's a way out that costs a dead card, not a live one.

## Option A: Today's Rules Plus Footwork (Today's Partner Only, 18 November, Evening)

*Mark asked for this after B. It's today's rules (both players choose one end-of-round option, in initiative order) plus footwork, run with `--set footwork=true` on `data/v23tp2`. There was no refit. Predictions were added to `PREDICTIONS.md` before the run.*

**Verdict: worse than B, and it fails the same bar.** It has B's card cost and adds ping-pong.

| | Today | A | B (today's partner) |
|---|---|---|---|
| Brawler at Far: ≤2 choices | 29.8% | **54.2%** | 44.3% |
| Brawler at Far: 1 choice | 6.4% | 22.5% | 14.0% |
| Brawler: games with 3+ clashes in a row at ≤2 choices | 22.3% | **54.2%** | 40.7% |
| Brawler: games with 2+ in a row at 1 choice | 8.1% | 30.8% | 15.9% |
| Brawler: away spells of 3+ | 31.4% | 22.2% | 15.5% |
| Brawler: hand at the clash | 5.40 | 4.38 | 4.66 |
| Share of clashes Guarded | 41% | 32% | 36% |
| End-of-round moves a game | 3.6 | 6.6 (footwork 3.2) | 4.6 |
| Range changes a game | 4.4 | 5.3 | 6.8 |
| Moves answered straight back | 28% | **43%** | 38% |
| Brawler win | 45.3% | 48.5% | 46.6% |
| First player | 47.8% | 53.2% | 49.5% |
| Time-outs | 9.4% | 3.2% | 2.7% |
| Swing | 13.4% | 6.8% | 19.0% |

Other measurements:
- **Mirrors:** Brawler mirror swing 20.1%, time-outs 5.0%; Zoner mirror swing 9.7%, time-outs 7.3%.
- **Guard draws per player per game:** 2.72 (today 3.76).
- **Ladder against Hard** (1,200 games each):
  - never footwork 45.8%, so footwork is worth about 4 points;
  - never Overdrive 40.7% (today 46.0%);
  - Medium 38.5% (today 34.1%).

**Why:**
- Footwork is used more than under B (3.2 a game, against 2.1), so hands shrink further.
- **Both players act at every end of round, so the second chooser can undo a move at once:**
  - 6.6 moves a game produce only 5.3 range changes;
  - 43% of moves are answered straight back, often costing a Guard each.
- Swing falls, probably because smaller hands mean fewer combos. That's a side effect, not a reason to take it.
- Under A, footwork is worth about 4 points to Hard, but mostly as a way to cancel the opponent's move.

**Predictions against results:**
- choices 38–44%: **missed, worse** (54%);
- ping-pong above B's: **hit** (43%);
- stuck spells (3+) 20–25%: **hit** (22%);
- never footwork within 3 points: **just missed** (4 points, inside the noise).

Files: `A_*.json`, `ladder_A_*.json`.

## Suggested next step

Sim **turns plus a footwork that doesn't cost a card**: discard a Guard to move, then draw a card. It's hand-neutral. It runs the deck about one card faster per player per game, and time-outs have room (3–7% under turns).

Compare it with **turns alone**, each with its own refit. Option D (start with 2 Charge) is still the cheapest test of the opening.

## Files

- `PREDICTIONS.md`: written before the runs.
- `<edition>_bz/zb/bb/zz.json` (`tools/turns.mjs`) and `<edition>_pool.json` (both seat orders pooled). Editions: `v23tp2`, `v23turn`, `v23turn1`, `v23turn2`.
- `nofw_*.json`: turns without footwork.
- `ladder_v23tp2_*.json` and `ladder_v23turn2_*.json` (`tools/luck.mjs`).
- Refit weights: `tools/fit-weights-v23turn1.json` and `tools/fit-weights-v23turn2.json`. The recordings were in `/tmp/fits` and weren't kept.
