# Yomi Playtest v17 — the app

The digital playtest table for **rules v17** (`rules-overview 17.md`): v16's split decks, neutral step and clash, plus **the initiative token**, **specials and Supers on the table**, and **the shared neutral core** (Charge ×2, Read ×2). Built on 1 November 2026 (evening) as its **own page**; the v16 pages stay as they were.

## The page

- **v17:** https://claude.ai/artifact/XFLF2iRy3nzRB7qRiAjtaJ ("Yomi Playtest v17", private to Mark until shared). It started with an empty database, so it runs the bundled fighters and settings. It declares the same database rules as the v16 pages (fighters, settings, the playtest log).
- **Unchanged:** the v16 · Warden page (https://claude.ai/artifact/6nhiH3itWrpzQZbCHKXWdu), the first v16 page (https://claude.ai/artifact/BwqWsi4LievrksJUf13NEc) and the v15 page.

## Source

- GitHub `Youngy34/card-game`, branch **`v17`** (pushed 2 November), off `v16-rules` at a5f827d. It holds everything since then: grey each round, the Warden and Confiscate, v17, the tests and these docs (`docs/`).
- **To rebuild:** `node tools/build-artifact.mjs --edition v17` (writes `dist/yomi-playtest-v17.html`). `--edition v16` rebuilds the v16 · Warden page from the same code (change its `<title>` to "Yomi Playtest v16 · Warden" after the build).
- The project's `sim/v17.patch.xz.b64` parts (and the older Warden patches) are a backup from before the push; the branch supersedes them.
- v17 runs on the v16 engine and screens (`src/engine/v16/`, `src/app/v16/`) with four rule flags switched on; v16 games are unchanged with them off.

| Flag (`data/v17/settings.json`) | What it does |
|---|---|
| `initiative: true` | A token, tossed for at the start, passes every round. Its holder chooses first after a reveal, pays Confiscates first and discards down first. |
| `speedTie: "initiative"` | The holder wins speed ties in the clash. |
| `tableCards: true` | Cards marked `special` (and the Super) start on the table, not in the clash deck. Read with `orSelect` can take one, paying its `meter`; Charge with `orFetch` can return a special from the discard to hand. A played Super is removed from the game. |
| `refillAtReveal: false` | Off since late 1 November: the neutral hand refills at the end of the round, with the clash draw, the grey and the token pass (the button reads "Draw · take 1 grey · pass the initiative"). Set it true to refill at the reveal instead. |

## Fighters

| Fighter | HP | Neutral (10) | Specials (1 meter) | Super (2 meter, once) |
|---|---|---|---|---|
| **Benchmark** (reference) | 38 | Charge ×2, Read ×2, Rush ×2, Wind-Up ×2, Parry, Breakfall | Rising Strike (P 19, B2 c1, Starter/Linker); Breaker (C Guard Break 9, chip 3, Ender/Counter) | Overdrive (C 10, chip 5, Ender, Knockdown) |
| **The Warden** (draft) | 34 | Charge ×2, Read ×2, Shakedown ×3, Shackles ×3 | Chain Whip (P 18, B2 c1, Starter/Linker); Iron Haul (C Grab 10, chip 2, Counter, Confiscate) | Chain Prison (C Grab 10, chip 3, Counter, discard down to 3) |

Clash decks (20) are as v16. Confirmed by Mark on 2 November: **Charge gains 2 meter (two copies)**, specials cost 1, the **Super costs 2**, and **Read draws 1** (each with its "Or…" option). Each is one field on the card in Decks.

## What's new on the page

- **Setup** explains v17 and tosses for the initiative.
- **After the neutral reveal,** if your Read or Charge has an option you can use, you choose it: **"Read: choose"** offers *Draw a clash card* or each table card you can afford (*Take Rising Strike from the table (1 meter)*), with the cards shown; **"Charge: choose"** offers *Gain 2 meter* or *Put [special] from your discard pile into your hand*. The holder chooses first and the other player sees that choice; the sparring partner decides in the same order.
- **The HUD** shows an **Initiative** flag on the holder, and a **Table** row: each special and the Super, with its cost, or "taken", "in hand" or "used". The Super appears in your hand only once you've taken it.
- **Board notes** say who holds the initiative (and so wins ties), and warn when the opponent's Super is in their hand.
- **Discarding down and Confiscate** go in initiative order: a person discards before a later partner chooses.
- **The round log** records what each player took from the table or fetched back.
- **Settings:** the speed-tie choice adds "The initiative holder wins the tie (v17)".
- **Lab:** reports specials and Supers taken, fetched and played, hand size at the clash, and Confiscates; the exploit check includes a Convert bot.
- **Decks:** a card's `special: true` and `meter` (default 1) put it on the table; `orSelect` / `orFetch` give Read and Charge their options. Validation allows one copy of a special, on attacks only.

## Checks (2 November)

- `node tools/test17.mjs`: 36 pass (initiative order, ties, table, Read and Charge options, Super removed after use, the end-of-round refill).
- `node tools/test16.mjs`: 96 pass; `node tools/test16-warden.mjs`: 28 pass (v16 unchanged).
- Browser smoke `tools/smoke/browser17.cjs`: 201/201 on this build (the count varies with what the games offer) (whole games against Hard, hot-seat, the option prompt, the Table row, the log, Settings, Lab, phone width). `browser16.cjs`: 176/176 on the v16 build.
- Sims: `node tools/sim16.mjs --settings v17/settings.json …` (300 games a row; results in `rules-overview 17.md`, Sim Check).

## Known limits

- **The sparring partner looks one round ahead,** so it undervalues specials (permanent) and saving for the Super. Treat its Super and special numbers as a floor.
- **The partner doesn't value holding the initiative** beyond the tie it wins this round.
