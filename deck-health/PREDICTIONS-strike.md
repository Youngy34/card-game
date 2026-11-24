# Strike v1: rules, deck, predictions and pass bars (written before the run, 24 Nov 2026, ~23:40)

Mark (23:10–23:33): no passive rounds. Every card is an attack with a Guard value, Exceed-style, kept inside our own shell (deck as health, a strike every round, simultaneous reveals, a surviving card returns to hand). Switch: `--strike`.

## Rules

- **Every card has Speed, Power and Guard.** Power is at least 1, so no round is passive. Family names (Strike, Break, Guard) are labels for reading the card, not a rule.
- **Each round:** draw up to 5; both set one card face down; reveal together.
- **The higher Speed hits first.** Equal Speed: both hit at once.
- **A hit:**
    - the player hit discards cards from hand equal to the Power, their choice;
    - if the Power is **more than** the card's Guard, that card **breaks** (it's discarded, and if it hadn't hit yet, it doesn't);
    - otherwise it survives and, if it hasn't hit yet, hits back.
- **A card that didn't break goes back to its owner's hand,** face up. A broken card is discarded.
- **You're out** if you need more cards than your deck holds (same as v0).
- No heal, no EX in v1 (EX is parked: pairs leak information under simultaneous reveals).

## Deck v1 (each player, 24 cards)

| Card | Family | Speed | Power | Guard | Copies |
|---|---|---|---|---|---|
| Jab | Strike | 6 | 1 | 0 | 3 |
| Straight | Strike | 5 | 2 | 0 | 3 |
| Check | Strike | 5 | 1 | 1 | 3 |
| Sweep | Break | 4 | 2 | 0 | 3 |
| Haymaker | Break | 3 | 3 | 0 | 2 |
| Armour Slam | Break | 2 | 2 | 1 | 2 |
| Parry | Guard | 2 | 1 | 1 | 3 |
| Counter | Guard | 1 | 2 | 2 | 3 |
| Fortress | Guard | 1 | 1 | 3 | 2 |

The triangle in the numbers:
- **Strike beats Break:** fast Power 1–2 breaks Guard 0.
- **Break beats Guard:** Power 2–3 beats Guard 1–2.
- **Guard beats Strike:** it absorbs Power 1 and hits back.

The exceptions are deliberate (Straight breaks Parry; Counter holds against Sweep; Armour Slam holds against a Jab).

## Predictions (Greedy reference)

| Measure | Prediction |
|---|---|
| Cards lost per clash (both players) | about 3.3 |
| Length | about 10 rounds (8–12): 24 cards, a loser near 20 lost, a winner near 13 |
| Clashes where both players lose cards | about 45% |
| Plays by family | Strike ~40%, Break ~30%, Guard ~30% |
| Each card's share of plays | every card ≥4% |
| Each card's result when played (loses fewer cards than the opponent) | every card 35–65% |
| Random / Thumb v Greedy | 15–20% / 25–32% |
| Seat | 47–53% |
| Draws (both out) | 2–4% |
| Sound v Greedy | 45–55% |

## Pass bars

- **Length** 10–15 (deck size is the lever if it misses).
- **No dominant or dead card:** every card ≥4% of plays and 35–65% results.
- **Random** ≤20%, **Thumb** ≤30% v Greedy.
- **Seat** 47–53%.
- **Draws** ≤5%.
