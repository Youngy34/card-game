# Deck-health duel (Branch B) — v0 sim

A small standalone sim for Branch B of Guardbreakers ("deck as health"). Nothing here imports or changes the Guardbreakers (Branch A) code; it lives only in this folder on the `deck-health` branch (cut from `v23`).

```
node deck-health/sim.mjs mirror --bot greedy -n 1000          # length, card use, seat, ties
node deck-health/sim.mjs ladder -n 400 [--ref greedy|sound]    # each bot against the reference, both seats
node deck-health/sim.mjs vs thumb greedy -n 400
options: --deck v0|v0_18   --noheal   --bands 4,9   --seed N   --bots a,b,c
```

## Rules v0

- Each player has their own 20-card deck. Shuffle, draw 5.
- **Each round:** draw up to 5. If you need more cards than your deck holds, you lose (both at once: a draw). Both play a card face down and reveal.
- **Different types:** Pressure beats Break, Break beats Guard, Guard beats Pressure.
- **Same type:** the lower rank (faster) wins. Equal rank: a tie, and both discard their card.
- **The loser** discards their card plus the winner's +x cards from hand (their choice, face up, in order).
- **The winner** takes their card back, face up. It stays known while it's in their hand.
- **A winning Guard heals:** put one card from your discard pile on the bottom of your deck.
- **+x from rank:** A–4 = +0, 5–9 = +1, 10–K = +2. Speed is the rank, so lighter cards are faster.
- **Health:** your deck count. A loss costs 1 + the winner's +x cards; if that's more than your deck, you're out.

**Deck v0 (each player):** Pressure A–8 (four +0, four +1); Break 8–K (8, 9 at +1; 10–K at +2); Guard A, 2, 3 (+0) and 5, 6, 7 (+1).

## Bots

| Bot | Plays | Discards / heals |
|---|---|---|
| `greedy` (reference) | The card with the best average outcome, assuming the opponent plays any card in their hand evenly. It samples their possible hands from public info. Outcomes are valued by a win-chance table over both deck counts, so lethal is exact. | Keep every type, then variety, then weight; heal the heaviest |
| `sound` | Equilibrium of the clash as a two-sided hidden-hand game (regret matching). Same value table. | as greedy |
| `sound1` | First version: assumed the opponent can see its hand (too cautious). Kept for the record. | as greedy |
| `greedyblind` / `blind` | greedy / sound, ignoring the opponent's face-up returned cards | as greedy |
| `thumb` | Rules of thumb: a random type among those held; Pressure fastest, Break heaviest, Guard any | as greedy |
| `half` | sound, but half its plays random | as greedy |
| `heavy` / `light` | Always the heaviest / lightest card | as greedy |
| `random` | Random card | random |
| `rplay`, `rdisc`, `cheat` | Diagnostics: random plays only, random discards only, sees the opponent's hand | |

## Results (24 Nov 2026)

Predictions and bars were written first: see `PREDICTIONS.md`. Raw output is in `results/`.

| Measure | Bar | Result | |
|---|---|---|---|
| Length (greedy mirror, 1000 games) | mean 10–15 | mean 15.3, median 15 (p10 11, p90 20); sound mirror 17.8 | **miss** (just over) |
| Seat 1 win rate | 47–53% | 47.2% ±3.1 (greedy), 49.5% (sound1) | pass (no first player exists) |
| Light / heavy share of plays | each ≥20% | +0 28%, +1 48%, +2 24% | pass |
| Random v reference | ≤30% | 18.6% v greedy; 36.6% v sound | pass v greedy, fail v sound |
| Thumb v reference | ≤42% | 25.9% v greedy; 41.7% v sound | pass |
| Lazy (heavy / light) v reference | ≤40% | 9.4% / 8.6% v greedy | pass |
| Face-up returned card | predicted 1–4 points | 16 points v greedy (greedyblind 33.8%) | miss (worth far more) |
| Double-out draws | ≤3% | 0–0.8% | pass |

Quick checks (not adopted): an 18-card deck (`v0_18`) brings length to 12.7 with the ladder unchanged (random 18.7%, thumb 29.2%). Turning the heal off barely shortens games (15.0) and makes random a little stronger (22.2%).

## EX pairs (24 Nov 2026, late evening) — `--ex`

**Rule:**
- Instead of one card, play two of the same type as one move, with the faster card's speed and the heavier card's +x.
- An EX beats any single card of the same type. EX against EX: the faster wins.
- The extra card is always lost. Win: take back one of the two, your choice, and discard the other. Lose: discard both, plus the winner's +x.

Predictions: `PREDICTIONS-ex.md`. Bots: `noex` (Greedy, never pairs), `alwaysex` (Greedy, pairs whenever it can), `randomex` (uniform over every move).

| Measure | Bar | v0 | EX |
|---|---|---|---|
| EX share of moves | 10–25% | — | **20.4%** (4.7 a game; wins 60%, 43% of them meet the same type) |
| Never EX v Greedy | costs 3–10 | — | **44.2%: costs 6** |
| Always EX v Greedy | costs ≥3 | — | **34.1%: costs 16** |
| Length (Greedy mirror) | ≤ v0 | 15.3 | **11.4** (median 11, p10 9, p90 14) |
| +2 share of plays | — | 24% | **30%**; heavy Break chosen 63% (v0 25%) |
| +0 share | ≥20% | 28% | 17% of moves as singles; 23% of cards played (light cards go into pairs) |
| Random / Thumb v Greedy | ≤20% / ≤30% | 18.6% / 25.9% | **18.2% / 26.8%** |
| Face-up cards worth | — | 16 points | 9 points (greedyblind 41.1%) |
| Seat | 47–53% | 47.2% | 51.5% |
| Sound v Greedy | 45–55% | 49.6% | 46.3% ±6.9 (200 games) |

## Guard rework (24 Nov 2026, ~22:40) — `--guard1 [--gmirror fatigue]`

**Rule (on top of EX):**
- Guards do no damage. All Guards are the same card: no speed, no +x, heal 1 on a win.
- EX pairs are for attacks only.
- Guard against Guard: nothing happens (`bounce`, the default) or both discard their Guard (`fatigue`).

Predictions: `PREDICTIONS-guard.md`.

**Bounce stalls:**
- Greedy mirror: 22% of games hit the 200-round cap; Guard mirrors are 80% of clashes.
- Sound mirror (80 games): Guards 53% of plays, Guard mirrors 35% of clashes, mean 21 rounds, 2 games capped, 45% of hands missing a type.
- Guards only leave the hand by losing to a Break, so they clog hands.

**Fatigue** (Greedy, 600-game mirror; ladder 400 a seat):

| Measure | v0 + EX | Fatigue |
|---|---|---|
| Length | 11.4 | 13.2 |
| Plays by type | P 26 / B 42 / G 33% | P 40 / B 32 / G 28% |
| Random / Thumb v Greedy | 18.2 / 26.8% | 20.6 / 31.2% |
| Never EX v Greedy | 44.2% | 49.9%: EX worth about 0 |
| Always EX v Greedy | 34.1% | 25.1% |
| Face-up cards (greedyblind) | 41.1% | 44.0% |
| Seat | 51.5% | 51.5% |

EX pairs by type: v0 + EX had Guard pairs (26% of pairs, winning 57%) and Break pairs winning 65%. Under fatigue, Break pairs win 53%.
