# Yomi Playtest v14

The playtest table for **rules v14** (`rules-overview 14.md` in the Claude project): the base game of five types, each beating the next two around the wheel Strike → Heavy → Grab → Focus → Block, with one card of each type per fighter. Strikes build grey, Heavies and Grabs cash it, Focus clears your own, and Block turns a Strike's grey back on the striker.

It's a separate app from the v13 table (`v13/`) and the v11/v12 table (repo root), which stay as they were. It has its own page on claude.ai and its own saved data. It was copied from the v13 app and keeps its shell, data store, zero-sum solver, difficulty levels, styles, build tool and smoke test; the engine, the sparring partner, the card faces, the editor's card form, the Lab report, the log and the settings are rewritten for the wheel.

- **Play** a full game against the sparring partner (Easy, Medium or Hard), against another person on one device, or watch two sparring partners. Optional reading hints explain what the opponent's cooling-down type and the piles mean.
- **Move lists**: every fighter's cards as a form or raw JSON, with validation. Card faces are written from the card data and the wheel.
- **Lab**: bulk sparring-partner games on the current cards: win rate, length, mirrors, which type wins reveals, damage by type, per-card play and win rates, and the squeeze table.
- **Playtest log**: every finished game with a person in it, reveal by reveal.
- **Settings**: the reveal limit, experiments, and the sparring partner's weights and lookahead.

## Running it locally

```
cd v14
python3 -m http.server 8000      # then open http://localhost:8000
```

## Tools

```
node v14/tools/test-engine.mjs                         # hand-checked rules cases
node v14/tools/sim.mjs vex atlas -n 300 --seed 7       # the simulator
node v14/tools/sim.mjs vex atlas --depth 1             # the 28 Oct rough-check bot
node v14/tools/sim.mjs vex atlas --wheel alt --mirrors all --blocked-heavy 2
node v14/tools/build-artifact.mjs                      # -> v14/dist/yomi-playtest-v14.html
node --import ./tools/smoke/register.mjs v14/tools/smoke/run.mjs <vendor dir>
```

The smoke test needs Preact 10.24.3 and htm 3.1.1 source in `<vendor dir>/pkg/preact` and `<vendor dir>/pkg/htm` (git clones at their release tags), plus `<vendor dir>/node_modules/preact/` with `package.json` `{ "type": "module", "main": "index.js" }` and an `index.js` that re-exports `../../pkg/preact/src/index.js`.

## Card format (v4)

```json
{
  "schemaVersion": 4, "rules": 14,
  "id": "vex", "name": "Vex", "epithet": "Twin Fang", "concept": "One line for the fighter picker.",
  "hp": 21,
  "cards": [
    { "name": "Flick Cut", "type": "strike", "grey": 1, "chip": 2, "cooldown": 1 },
    { "name": "Crescent", "type": "heavy", "chip": 1, "cooldown": 1 },
    { "name": "Hilt Hook", "type": "grab", "chip": 2, "cooldown": 1 },
    { "name": "Poise", "type": "focus", "cooldown": 1 },
    { "name": "Cross Guard", "type": "block", "cooldown": 1 }
  ]
}
```

| Field | Notes |
|---|---|
| `type` | `strike`, `heavy`, `grab`, `focus` or `block` |
| `grey` | Strikes only: grey added to the opponent's pile when it wins, and turned back on its owner when blocked |
| `chip` | Strikes, Heavies and Grabs: damage straight to HP when it wins (after the cash, for Heavies and Grabs) |
| `cooldown` | 1 or 2 (default 1) |
| `art`, `notes` | Optional |

The base game is one card of each type; more cards of a type are allowed for testing and flagged as a guideline. At least 3 cards, since up to two can be cooling down at once.

## The sparring partner

Each reveal it plays every pairing of the two players' available cards and solves the grid as a zero-sum game. With lookahead 2 (the default), each pairing is valued by solving the next reveal's grid too, so it sees what comes back off cooldown and what the opponent will be missing. Boards are scored as HP minus 0.5 per grey on your pile (grey past lethal counts as lethal), turned into a win chance. Lookahead 1 is the throwaway bot of the 28 October rough check; 3 is slow in the Lab. Easy and Medium use the v11 app's quantal-response levels.

## Experiments (Settings, all off by default)

| Switch | What it does |
|---|---|
| Wheel (`wheel`) | `first`: the first draft, Strike → Heavy → Grab → Block → Focus, where a blocked Focus doubles its pile. `alt`: Focus → Strike → Grab → Heavy → Block (Heavy and Grab swapped), where a blocked Focus fizzles |
| Mirrors (`mirrors`) | `all`: two cards of a type both take effect (a double KO is possible: whoever ends least below 0 wins). `focus`: only two Focuses take effect |
| Blocked Heavy grey (`blockedHeavyGrey`) | Grey a blocked Heavy puts on its owner's pile (as written, 0) |

`maxReveals` (default 100) is a safety net, not a rule: a game still going is a draw.

## Publishing

Build, run the smoke test, then publish `v14/dist/yomi-playtest-v14.html` to the v14 artifact (not the v13 or v11/v12 ones). The page declares the `db`, `user` and `downloads` capabilities; `fighters/` and `settings/` are writable by editors only, `games/` by anyone who can use the page.
