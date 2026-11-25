# Strike / Throw / Armour: predictions and pass bars (written before the run, 25 Nov 2026, ~08:10)

## Rules (Mark, 07:41–08:04) — switches `--noheal --token`

- **Three attack types in a triangle:** Strike beats Throw, Throw beats Armour, Armour beats Strike. In the sim these are v0's P, B and G slots.
- **Same type: the faster card wins,** for every type with no exceptions (Throws included).
- **Exact speed tie: the advantage token decides.** The holder wins the clash, then passes the token to the opponent. One player starts with it, at random.
- **The loser discards their card plus the winner's +x from hand.** The winner takes their card back, face up.
- **No heal, no EX.**
- **Every clash has exactly one loser,** so a double knock-out can't happen.

## Arms

| Arm | Deck | Values |
|---|---|---|
| **A: uneven** (v0's numbers) | 20 cards. Strike speed 1–4 at +0 and 5–8 at +1; Throw 8–9 at +1 and 10–13 at +2; Armour 1–3 at +0 and 5–7 at +1. | Throw hits hardest |
| **B: even** | 18 cards, 6 per type. Every type: speed 1, 2, 3 at +0; speed 5, 6, 7 at +1. | Every type the same |

## Predictions (Greedy reference)

| Measure | A: uneven | B: even |
|---|---|---|
| Length | about 15 (v0 without the heal ran 15.0) | about 14 (13–16) |
| Token decides | about 6% of clashes | about 8% |
| Plays by type (Strike / Throw / Armour) | ~30 / 40 / 30% | each 28–38% |
| Random v Greedy | 19–23% | 20–24% |
| Thumb v Greedy | 25–30% | 27–31% |
| "Always one type when held" v Greedy | ≤30% each | ≤30% each |
| Heavy (+x) share of plays | ≥20% | ≥25% |
| Seat | 47–53% | 47–53% |
| Draws | 0% | 0% |

**Expected difference:** even values lose 1–3 points of skill at most. Unequal values were never shown to add skill.

## Pass bars

- **Length** 10–15.
- **Every type** ≥20% of plays; heavy cards ≥20%.
- **Random** ≤25%, **Thumb** ≤32%. These are looser than v0's, because the heal and EX are gone.
- **"Always one type"** ≤35%.
- **Seat** 47–53%.
- **Draws** 0%.
