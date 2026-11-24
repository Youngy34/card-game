# Guard rework: predictions and pass bars (written before the run, 24 Nov 2026, ~22:30)

## The rule (v0 + EX, plus this) — switch `--guard1`

- **Guards do no damage:** a winning Guard makes the loser discard only the Pressure they played.
- **Guard against Guard:** nothing happens; both take their Guard back (face up).
- **All Guards are the same card:** no speed, no +x, heal 1 on a win.
- **EX pairs are for attacks only** (Pressure or Break).

## Predictions (Greedy reference, against v0 + EX)

| Measure | v0 + EX | Prediction |
|---|---|---|
| Length | 11.4 | about 13 (12–14): Guard wins deal less, and Guard mirrors do nothing |
| Guard mirrors | — | about 8% of rounds |
| Plays by type | P 26%, B 42%, G 33% | P ~29%, B ~43%, G ~28% (Guard is a safe play against Guard and Pressure, so Break punishes it) |
| EX share of moves | 20% | about 17% (no Guard pairs) |
| Never EX v Greedy | 44% | 43–47% |
| Random / Thumb v Greedy | 18% / 27% | 17–21% / 24–30% |
| Seat | 51.5% | 47–53% |

## Pass bars

- **Length** 10–15.
- **Every type** ≥20% of plays.
- **Random** ≤20%, **Thumb** ≤30% v Greedy.
- **EX still a decision:** never using it costs ≥3 points, always using it costs ≥3.
- **Seat** 47–53%.
