# Yomi Playtest v13

The playtest table for **rules v13** (`rules-overview 13.md` in the Claude project): Horizontal, Vertical and Throw against Guard, Duck and Step; the initiative deciding clashes; and Killer Instinct-style combos with linkers, enders and breaks. Core rules only: meter, EX cards, Supers and printed properties are layers, off for now.

It's a separate app from the v11/v12 table in the repo root, which stays as it was. It has its own page on claude.ai and its own saved data. Shared pieces were copied from the old app rather than imported, so changing one app can't break the other: the zero-sum solver (`lp.js`), the difficulty levels, the data store, the screen layouts and styles, the build tool, and the smoke test's fake DOM (imported from `../tools/smoke/`, test-only).

- **Play** a full game against the sparring partner (Easy, Medium or Hard), against another person on one device, or watch two sparring partners.
- **Move lists**: every fighter's cards as a form or raw JSON, with validation. Card faces are written from the card data.
- **Lab**: bulk sparring-partner games on the current cards, reporting the rules' playtest targets.
- **Playtest log**: every finished game with a person in it, reveal by reveal.
- **Settings**: the initiative bonus, combo cap and first initiative; experimental rule switches; the sparring partner's weights.

## Running it locally

```
cd v13
python3 -m http.server 8000      # then open http://localhost:8000
```

## Tools

```
node v13/tools/test-engine.mjs                       # hand-checked rules cases
node v13/tools/sim.mjs vex atlas -n 200 --seed 1     # the simulator
node v13/tools/sim.mjs vex atlas --clock 30 --wrong-break-locks
node v13/tools/sim.mjs vex atlas --guard-damage card --throw-cashes --evade-cooldown
node v13/tools/build-artifact.mjs                    # -> v13/dist/yomi-playtest-v13.html
node --import ./tools/smoke/register.mjs v13/tools/smoke/run.mjs <vendor dir>
```

The smoke test needs Preact 10.24.3 and htm 3.1.1 source in `<vendor dir>/pkg/preact` and `<vendor dir>/pkg/htm` (git clones at their release tags), plus `<vendor dir>/node_modules/preact/` with `package.json` `{ "type": "module", "main": "index.js" }` and an `index.js` that re-exports `../../pkg/preact/src/index.js`.

## Card format (v3)

```json
{
  "schemaVersion": 3, "rules": 13,
  "id": "vex", "name": "Vex", "epithet": "Twin Fang", "concept": "One line for the fighter picker.",
  "hp": 30,
  "cards": [
    { "name": "Needle", "direction": "vertical", "speed": 8, "hit": 1, "onBlock": "=", "linker": "light", "grey": 2, "cooldown": 1 },
    { "name": "Crescent", "direction": "horizontal", "speed": 5, "hit": 2, "onBlock": "-", "ender": true, "bonus": 2, "cooldown": 2 },
    { "name": "Eviscerate", "direction": "vertical", "speed": 4, "hit": 3, "onBlock": "-", "ender": true, "keepInitiative": true, "cooldown": 2 },
    { "name": "Hilt Hook", "direction": "throw", "speed": 6, "hit": 2, "grey": 1, "cooldown": 1 }
  ]
}
```

| Field | Notes |
|---|---|
| `direction` | `horizontal`, `vertical` or `throw` |
| `speed` | 1–10, higher is faster |
| `hit` | Real damage when it connects in neutral |
| `onBlock` | Strikes only: `"+"`, `"="` or `"-"` |
| `linker` | `light`, `medium` or `heavy`, with `grey` (1 or more). Strikes only |
| `ender` | `true`, with optional `bonus` (extra damage on the cash) and `keepInitiative: true`. Strikes only |
| `grey` | A linker's grey, or a throw's grey on throw |
| `blockGrey` | Strikes only: grey on the blocker under the guard damage experiment (default 1) |
| `cooldown` | 1 or 2 (default 1) |
| `art`, `notes` | Optional |

The universal cards (Guard, Duck, Step and the three Breaks) are built in. Unknown fields are reported as problems, with a suggestion if one looks like a typo.

## The sparring partner

Each neutral reveal it plays every pairing of the two players' available cards, plays out any counter (by trying each) and any combo (solved beat by beat to its end), scores the board it reaches, and solves the grid as a zero-sum game. The board score is HP, minus 0.5 per grey on your pile, plus 2 for the initiative, plus 0.4 per attack card in hand, minus 1 per direction you can't attack in; the weights are in Settings. With the round timer on, a lead counts for more as time runs out. Easy and Medium use the v11 app's quantal-response levels (not yet calibrated for v13).

## Experiments (Settings, all off by default)

| Switch | What it does |
|---|---|
| Round timer (`clock`) | After this many reveals, at the end of a neutral reveal or combo, more HP wins; level HP draws |
| Guard damage (`guardDamage`) | A blocked strike puts grey on the blocker: `"card"` uses each strike's `blockGrey` (1 if unset), `"flat"` uses `blockGrey` from the settings for every strike |
| Throws cash the pile (`throwCashes`) | A throw that lands first cashes the thrown player's whole pile, as well as dealing its Hit |
| Evade cooldown (`evadeCooldown`) | Duck and Step go on cooldown 1; Guard never does |
| Counter check (`counterCheck: "reveal"`) | The counter check uses the initiative as it stood at the reveal: the holder's attacks keep their +3 |
| Waiting passes (`waitPasses`) | Two defences pass the initiative to the other player |
| Wrong break locks (`wrongBreakLocks`) | A Break of the wrong strength is locked for the next beat |

The Lab and the simulator also report **read strength**: each neutral reveal, the Hard mix for each player grouped by kind of move (Horizontal, Vertical, Throw, Guard, Duck, Step). *Focus* is the likeliest kind's share (an even spread is 17%); *shift* is how far the grouped mix moved since that player's previous neutral reveal (0% is the same guess every time).

`maxReveals` (default 100) is a safety net, not a rule: a game still going is a draw.

## Publishing

Build, run the smoke test, then publish `v13/dist/yomi-playtest-v13.html` to the v13 artifact (not the v11/v12 one). The page declares the `db`, `user` and `downloads` capabilities; `fighters/` and `settings/` are writable by editors only, `games/` by anyone who can use the page.
