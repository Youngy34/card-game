# Strike v2: predictions and pass bars (written before the full run, 25 Nov 2026, ~07:20)

## Rules (Mark, 06:45–06:50) — switch `--strike2`

- **Every card has Speed, Power and Guard.** The higher Speed hits first; equal Speed, both hit at once.
- **Any hit costs your played card.** On top, discard **Power minus Guard** (never below 0) from hand, your choice.
- **Power more than Guard stuns:** your card doesn't hit back. Otherwise it hits back, though it's still lost.
- **A card that was never hit returns to your hand,** face up.
- **If both players would go out in the same clash, the faster hit wins** (equal Speed: a draw).

## Deck `strike2` (each player, 24 cards)

The balance check (`balance.mjs`) found that with three small stats, only about five card kinds can all earn a place. Every larger set had dead cards.

| Card | Family | Speed | Power | Guard | Copies |
|---|---|---|---|---|---|
| Jab | Strike | 6 | 1 | 0 | 4 |
| Straight | Strike | 5 | 2 | 0 | 4 |
| Sweep | Break | 4 | 2 | 1 | 4 |
| Haymaker | Break | 3 | 3 | 0 | 4 |
| Counter | Guard | 1 | 1 | 2 | 8 |

**Static best mix:** Jab 3%, Straight 22%, Sweep 10%, Haymaker 13%, Counter 52%.

## Predictions (Greedy reference)

| Measure | Prediction |
|---|---|
| Cards lost per clash (both players) | about 3 |
| Length | about 10–11 rounds |
| Both players lose cards | about 35% of clashes |
| Draws | under 2% (the faster hit decides) |
| Card use | Counter most (30–40%); Jab least (5–10%); every card ≥5% |
| Random / Thumb v Greedy | 12–18% / 22–30% |
| Seat | 47–53% |

## Pass bars

- **Length** 10–15.
- **Draws** ≤3%.
- **Every card** ≥5% of plays, results 35–65%.
- **Random** ≤20%, **Thumb** ≤30%.
- **Both lose cards** ≤45% of clashes.
- **Seat** 47–53%.
