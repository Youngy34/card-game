# Yomi Playtest v18 — the app

The digital playtest table for **rules v18** (`rules-overview 18.md`): one deck gone through once, no neutral step (its effects are **On reveal riders** on clash cards), the shared defence core (Recall ×3, Charge ×2, Read ×2), **the time-out**, and specials that go back to the table. First built on 3 November 2026 (night) with the new Hard partner; **rebuilt on 7 November** with the 26-card Benchmark, **Safe** Pressures and the new **Knockdown** (you lose every speed clash next round); **8 November** adds the draft fighters **Vex, Bastion and Atlas** (`characters v18 draft.md`).

## The pages

- **Current (8 November): https://claude.ai/artifact/SpKQuR7XBsYizp67ijACHA** ("Yomi Playtest v18 (8 Nov)", private to Mark until shared). Built from branch **`v18-roster`**: the 7 November page plus Vex, Bastion and Atlas, Twin, Recovers with a status on a block, Recover specials, and Confiscate's floor checked after the clash. Its database started empty, so it runs the bundled fighters and settings; it declares the same database rules as the earlier pages. It's a new page because a session with network access off can change only pages it created.
- **7 November: https://claude.ai/artifact/RFc7cnTjT6XvTKDkY73HLA** ("Yomi Playtest v18 (7 Nov)"). Built from branch **`v18-safe`**. Its database started empty, so it runs the bundled fighters and settings. It declares the same database rules as the earlier pages (fighters and settings: editors write; the playtest log: anyone who plays writes).
- **3 November:** https://claude.ai/artifact/3gkhzd1DGfoym2R6dCFowo ("Yomi Playtest v18"): the 24-card Benchmark and the old Knockdown (Lock Pressure), from branch `v18`. It was made in an earlier session, and a session can only republish artifacts it created, which is why the 7 November build is a new page. Its playtest log stays on it.
- **Unchanged:** the v17 page (https://claude.ai/artifact/XFLF2iRy3nzRB7qRiAjtaJ) and the v16 pages, with the old partner.

## Source

- GitHub `Youngy34/card-game`, branch **`v18-roster`** (off `v18-safe`, which is off `v18`).
- **To rebuild:** `node tools/build-artifact.mjs --edition v18` (writes `dist/yomi-playtest-v18.html`), then publish it over the current page, from the session that created it, or as a new page (declaring the same database rules).
- v18 runs on the v16 engine and screens (`src/engine/v16/`, `src/app/v16/`) with rule switches on; v16 and v17 games are unchanged with them off.

| Switch (`data/v18/settings.json`) | What it does |
|---|---|
| `merged: true` (rules) | One deck and one hand; no neutral step. The round starts at the clash card, and each clash card's `reveal` rider fires once both are face up. |
| `timeout: true` (rules) | The deck never reshuffles. When a player draws their last card, the round finishes and the higher HP wins (equal HP: a draw). |
| `specialsReturn: true` (rules) | A special goes back to the table when it leaves the hand (played, discarded or Confiscated). |
| `knockdownSlow: true` (rules, 6 November) | A knocked-down player loses every speed clash next round (same-type attacks, ties included, even holding the initiative); if both are down, speeds compare as usual. Replaces `knockdownLocks` (Lock Pressure), now off. |
| `pooled: 1`, `mySamples: 4` (ai) | The new Hard: one solve over all the dealt hands, with its own hand hidden too (its real hand and 3 dealt ones). See `rules-overview 18.md`, The Partner. |

**Safe** is a card field, not a switch: `"safe": true` on a Pressure means a Recover that beats it gets no follow-up.

## Fighters

| Fighter | HP | Deck | Specials (1 meter) | Super (2 meter, once) |
|---|---|---|---|---|
| **Benchmark** (reference) | 34 | **26**: 19 attacks and the core (below) | Rising Strike; Breaker | Overdrive |
| **The Warden** (draft) | 32 | **26** (8 Nov; 24 before, now `variants/warden-24.json`): 19 attacks (Chain Lash ×3, Ankle Hook ×3, Chain Toss ×3, Shakedown ×2, Haul In ×1, Coil ×2, Shackles ×2, Chain Spin ×3) and the core. **No combo icons; his grabs chip 5–6** (8 Nov). Chain Toss is Safe, Build 3, chip 2. | Iron Haul; Chain Whip | Chain Prison |
| **Vex** (draft, 8 Nov) | 30 | 26: 13 Pressures (Quick Fang, Fang Rush, Twin Fang, Crossing Slash, Heel Drop), 6 Converts (Undercut, Pommel Strike) and the core | Cross-Up (a Convert Starter); Flying Fang | Hundred Fang (Dizzy) |
| **Bastion** (draft, 8 Nov) | **36** (32 as drafted) | 26 (Lockdown knocks down, Shield Bash links, Rim Shot Build 4, chip 1, Pressures at the Benchmark's speeds): 9 Pressures (Edge Jab, Shield Bash, Rim Shot, Sonic Cutter), 8 Converts (Lockdown, Shoulder Ram, Shield Slam), Repulse ×2 and the core | Aegis (a Guard); Shield Rush | Final Bastion (a Guard) |
| **Atlas** (draft, 8 Nov) | 38 | 26: 11 Pressures (Haft Strike, Overhead, Ground Smash, Hammer Sweep), 8 Converts (Shoulder Check, Hammer Spin, Earthsplitter) and the core | Lariat; Upheaval | Avalanche |

**The Benchmark, 7 November** (`data/v18/benchmark.json`; the 3 November deck is `data/v18/variants/benchmark-3nov.json`):

| Card | × | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| Jab | 2 | Pressure · Strike | 17 | Build 1, chip 1 | **Safe**, Starter, Linker | — |
| Lunge | 3 | Pressure · Strike | 15 | Build 3, chip 1 | Starter, Linker | — |
| Slash | 2 | Pressure · Strike | 14 | Build 4, chip 1 | Linker, Counter | — |
| Sweep | 2 | Pressure · Strike | 13 | Build 3 | Ender | On hit: Knockdown |
| Shot | 2 | Pressure · Projectile | 12 | Build 3, chip 2 | **Safe** | — |
| Throw | 3 | Convert · Grab | 7 | chip 1 | Counter | On hit: Knockdown |
| Big Swing | 3 | Convert · Guard Break | 3 | chip 3 | Ender, Counter | — |
| Wind-Up | 2 | Convert · Guard Break | 1 | chip 4 | Ender | — |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

11 Pressures, 8 Converts, 7 Recovers; 8 Counters (31%); 4 Safe cards. The time-out falls at the end of round 20.

## What's on the page

- **Setup** explains v18 (one step a round, riders, the table, the time-out, Safe cards and Knockdown) and tosses for the initiative. The picker shows each fighter's HP and deck size ("26 cards + 2 specials").
- **Safe** shows as a badge beside the combo icons (hover for the rule). When a Guard beats a Safe card, the narration says "…is Safe: no follow-up", and the follow-up step is skipped.
- **Knockdown:** while you choose, the board notes say who is knocked down and that they lose every speed clash, and the Pressure and Convert duel notes say so too ("you're knocked down, so you lose it whatever the speeds"). A speed clash decided by Knockdown is narrated as such, with both speeds.
- **Speed ties:** the duel notes now say a tie goes to the initiative holder (they used to say a tie cancels, from v16).
- **The round starts at the clash card.** There's no "Play nothing" button while you hold a card (v18: you must play one).
- **After the reveal,** if your clash card is a **Read** with something to take, or a **Recall** with more than one attack to bring back, you choose: *Draw a card (N left in your deck)*, or tap a card to take it from the table (with its cost) or to bring it back. The initiative holder chooses first and the other player sees that choice above the cards; the partner decides in the same order. Charge and Shakedown need no choice.
- **The board** lists what each rider did, above the clash's narration. The round log shows the same line for each round.
- **The HUD** shows the deck count, flagged "time-out near" at 3 cards or fewer, and the Table row with each special and the Super.
- **Board notes** add the time-out once either deck is down to 4, and any attack the opponent brought back with Recall.
- **Settings** and **Lab** as on 3 November (100 Hard-v-Hard games take about a minute).

## The 8 November additions

- **Twin** (`twin: true` on a Linker, Vex's Twin Fang): after it's played as a Linker, a second copy can follow as another Linker. The page asks "Twin: play the second copy as another Linker", with "No second Linker" to go on to the Ender.
- **A status on a block** (`onBlock` on a Recover: Bastion's Repulse Staggers, Aegis knocks down, Final Bastion leaves them Dizzy): it lands when the Recover beats a Pressure, as well as the usual follow-up (a Safe Pressure stops the follow-up, not the status). Narrated as "…turns the blow aside: they're Staggered next round."
- **Recover specials** (Aegis): taken from the table with Read like any special, and back on the table after use.
- **The Warden at 26 cards** (8 November, republished on the same page): Haul In ×1 (cut to fit 24 on 3 November, Convert · Grab · 9 · chip 2 · Counter) and a third Ankle Hook, so every deck times out at the end of round 20. Then **Chain Toss is Safe** (Mark: at least one Safe card for him), and not a Starter (a long-range move doesn't start combos), at Build 3, chip 2 like Shot: 42% against the Benchmark (44% before; 47% while it was a Safe Starter).
- **The Warden as a grappler, not a combo fighter** (8 November, later, Mark): no combo icons on any of his cards (Counter stays: a follow-up isn't a combo), and every grab +3 chip (Shakedown, Haul In, Shackles, Iron Haul 5; Coil, Chain Prison 6). 50.8% against the Benchmark; but he beats Vex 73%.
- **Bastion at HP 36** (8 November, later, Mark): Knockdown on Lockdown, Shield Bash a Linker, Rim Shot Build 4, chip 1, his Pressures at the Benchmark's speeds. 53% against the Benchmark (about 30% as drafted).
- **Confiscate's floor is checked after the clash:** a player who owed a discard On reveal and then spent cards on a combo never discards below 2.

## Checks (8 November)

- `node tools/test18-roster.mjs`: 61 pass (the three fighters, Twin, the Convert Starter, the block statuses, Recover specials, Confiscate's floor, whole games for every pairing). `test18` (66), `test17` (36), `test16` (96), `test16-warden` (28) still pass.
- Browser smoke `tools/smoke/browser18.cjs`: 487 of 487 on the first build and 445, 447, 405 and 395 on the four later builds (the count depends on how many games it takes for each prompt to come up), with no page errors, now also playing as Vex against Bastion until the Twin prompt and a block status have come up, and as Atlas against Vex. Run with the installed Chrome (Playwright's launcher pointed at `/usr/bin/google-chrome`) and Preact 10.24.3 and htm 3.1.1 source clones.

## Checks (7 November)

- `node tools/test18.mjs`: 66 pass (the Knockdown checks rewritten for the new rule; the time-out check now follows the deck size); `test17` (36), `test16` (96), `test16-warden` (28) still pass.
- Browser smoke `tools/smoke/browser18.cjs` (its deck checks now read `data/v18/benchmark.json`): 464 of 464 on the published build, with no page errors, including a time-out and a take from the table. One earlier run missed the take-from-the-table prompt by chance (473 of 474); the test plays on until each prompt comes up, up to 6 more games.
- Run with Preact 10.24.3 and htm 3.1.1 source clones from GitHub (npm's registry isn't reachable from these sessions).

## Known limits

- **The partner looks one round ahead,** so it undervalues specials and the Super, and it doesn't know about the time-out. It doesn't weigh what Recall could bring back.
- **Its Knockdown weight** (1.5 HP, in Settings) was set for the old Knockdown (Lock Pressure). The new one is milder, so the partner may overvalue knocking you down.
- **It doesn't learn your habits.** An always-Guard bot beats it 26–28%: a person who guards a lot will be punished less than they should be.
