# Both act, two actions, and the knockdown: predictions (written before the runs, 22–23 Nov)

From `claude/both act and knockdown - idea ready to sim (22 Nov).md`, against v24 (`data/v23o3r2d1`, stored results):

- Away spells of 3+ clashes: 15–20% (v24 18.1%).
- Swing up 2–5 points (v24 12.6%).
- Never Overdriving costs about 5–10 points (v24 15–17).
- Charge ups 3–4 a game (the idea doc says v24 about 2.5; the stored v24 figure is 6.0, so read this as "not more than v24").
- Brawler at Far with 2 or fewer choices: 33–36% (v24 32.3%).
- Time-outs flat to up 3 (v24 9.8%).
- Balance within 3 points; the first player 48–52%.
- The knockdown's fitted price about 0.5–1.0 HP.

**Pass bar:** stuck spells (away spells of 3+) no worse than v24 (18.1%), swing under about 18%, never Overdriving costs under 10 points, Brawler at Far ≤2 choices no worse than 36%.

Claude's added expectation, from the 10-game smoke run: charge ups well above v24 (9+ a game) and hands smaller; the second player wins the next clash more often than the first.

## The runs

- Step 1: `data/v23ba` (v23tp2's rules and partner, plus `bothAct: 2`), against v23's stored results (`today`, v23tp2).
- Step 2: one refit round (`data/v23ba1`), the same measures, against v24's stored results (different partner, older knockdown).
- Step 3, only if swing ≥ 18% in step 2: `--set noMoveOd=true` on the refit partner.
- Each: `tools/turns.mjs` 600 + 600 games; `luck.mjs rangetest` kinds `nod0,nod1,odg0,odg1` at 300 each seat order (1,200 per kind); a quick Hard v Medium check (`lvl:medium0,lvl:medium1`, 150 each seat order, 600 games).
