# Deck-health duel v0: predictions and pass bars (written before the first run, 24 Nov 2026)

Branch B only. Rules and deck: see `README.md`.

## Predictions

| Measure | Prediction | Why |
|---|---|---|
| Game length (Sound mirror) | mean 13 rounds (11–15), median 13 | You die on the 16th card lost. A decided clash costs the loser about 2 cards (1 + average +x of the winning card), Guard heals give back about 0.2 a round, ties about 5% of rounds. The loser takes ~16, the winner ~9–10, so ~26 cards / ~2 a round. |
| Seat 1 win rate (Sound mirror) | 50% ±2 | There is no first player: play is simultaneous and the decks mirror. This is a symmetry/bug check, not a balance result. |
| Double-out draws | under 1% | Needs a tie while both decks are empty. |
| Light (+0) share of plays | about 35% | |
| Heavy (+2) share of plays | about 25% | Only Breaks carry +2 and Breaks are 30% of the deck. |
| Within-type choice (when holding both a light and a heavier card of the type you play) | each weight picked at least 30% of the time | Light wins mirrors, heavy wins bigger against the victim type. |
| Sound v Random | Random wins 28–32% | Core is a simultaneous guess and games are short (~13 clashes), so luck is high. Random loses on weight choice, discards and lethal. |
| Sound v Thumb (rules-of-thumb mid player) | Thumb wins 38–44% | Thumb manages its hand sensibly but doesn't read. |
| Sound v Half (half its plays random) | Half wins 40–45% | |
| Face-up returned card (Blind v Sound) | Blind wins 46–49% (worth 1–4 points) | Known cards narrow the opponent's hand, mostly late in a winning streak. |
| Lazy: always heaviest / always lightest | 30–38% / 32–40% | |
| Hand missing a type at reveal | about 25–30% of hands | Hypergeometric from 8/6/6. |

## Pass bars

| Bar | Pass if |
|---|---|
| Length | mean 10–15 rounds |
| Seat | 47–53% |
| Fast and heavy both played | light ≥20% and heavy ≥20% of plays |
| Skill: Random v Sound | ≤30% |
| Skill: Thumb v Sound | ≤42% |
| Lazy bots v Sound | ≤40% each |
| Draws | ≤3% |

Confidence: length and seat high (~75%). Card use medium (~60%). Skill ladder low (~40% that Random ≤30%): the type guess is a pure simultaneous guess and the game is short.
