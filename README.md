# Yomi Playtest

The digital playtest table for *Yomi*, the 1v1 fighting-game card game, on rules v11 (move lists, cooldown, single-use Supers).

- **Play** a full game against the sparring partner (the simulator's player), against another person on one device, or watch two sparring partners.
- **Move lists**: every fighter's cards, editable as a form or as raw JSON, with validation. Card text is written from each card's effects, so the face always matches what the engine does.
- **Lab**: bulk sparring-partner games on the current cards, edits included: win rates, double KOs, game length and card use.
- **Playtest log**: every finished game with a person in it, round by round, with the exact cards and settings it was played with.
- **Settings**: rule variants (when a Recover's chip lands) and the sparring partner's weights.

The live version is published on claude.ai. Card edits, variants, settings and the log are saved in that page's own database, so they follow you across devices and Claude can read them back.

## Running it locally

There's nothing to install or build. Serve the folder with any static server and open it:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

Locally, edits and the log are kept in that browser only.

## Folders

| Path | What's there |
|---|---|
| `data/fighters/*.json` | The signed-off fighters (the source of truth) |
| `data/settings.json` | Default rules and sparring-partner weights |
| `src/engine/` | The rules engine and sparring partner, plain JavaScript with no UI (runs in the browser and in Node) |
| `src/app/` | The screens (Preact and htm, loaded from a CDN) |
| `tools/sim.mjs` | Command-line balance runs on the same engine and JSON |
| `tools/crosscheck/` | Proves the JavaScript engine plays exactly the same game as `yomi_sim.py` |
| `tools/smoke/` | Click-through test of the built page in a fake browser |
| `tools/build-artifact.mjs` | Packs the app into one page for publishing (`dist/yomi-playtest.html`) |
| `archive/pre-v11-app/` | The old Strike/Guard/Crush app, for reference only |

## Card format (v2)

A fighter file:

```json
{
  "schemaVersion": 2,
  "id": "bastion",
  "name": "Bastion",
  "epithet": "the Sentinel",
  "concept": "One line for the fighter picker.",
  "hp": 21,
  "passive": null,
  "ai": { "ownGreyValue": 0.3 },
  "cards": [ /* 8 cards */ ],
  "super": { /* the Super */ }
}
```

- `passive`: `null`, `{ "flow": true }` (you're flowing while a Flow card of yours is on cooldown space 1), or `{ "risingStakes": { "tokens": 1, "whilePileUnder": 1 } }` (`whilePileUnder` optional).
- `ai.ownGreyValue` (optional): how the sparring partner values its own grey tokens, in HP. The default is 0.6; the Gambler uses 0.3 because her grey is her fuel.
- `variantOf` (variants only): the fighter it was copied from.

A card:

```json
{ "name": "Rim Shot", "type": "pressure", "build": 3, "chip": 0, "cooldown": 1, "stagger": "convert", "lockout": true }
```

| Field | Notes |
|---|---|
| `name` | Unique within the fighter |
| `type` | `pressure`, `convert`, `recover` or `typeless` |
| `build` | Pressure only, at least 1 |
| `chip` | 0 or more; every Convert needs at least 1 |
| `cooldown` | 1 or 2 (ignored on a Super) |
| `flowCard` | `true` marks a Flow card |
| `art` | Optional URL of a full card-design image, shown instead of the generated face |
| `flavour`, `notes` | Optional text |

Effects and costs, added as extra fields. Any other field is reported as a problem, with a suggestion if it looks like a typo.

| Field | Example value | Card types | Card text |
|---|---|---|---|
| `buildIfOppHas` | { "tokens": 4, "build": 2 } | Pressure | +2 Build if the opponent already has 4 or more tokens. |
| `buildPerOwnTokens` | 2 | Pressure | +1 Build for every 2 tokens in your own pile. |
| `flowBuild` | 2 | Pressure | +2 Build while flowing. |
| `chipPerOwnTokens` | 2 | Pressure, Convert | +1 chip for every 2 tokens in your own pile. |
| `chipPerOppTokens` | 2 | Pressure | +1 chip for every 2 tokens the opponent has. |
| `chipPerCashed` | 2 | Convert | +1 chip for every 2 tokens it cashes. |
| `chipPerCleared` | 2 | Recover | +1 chip for every 2 tokens it clears. |
| `chipPerHpLost` | 2 | Convert, Recover | +1 chip for every 2 HP you've lost. |
| `chipIfMirror` | 2 | Pressure | +2 chip if the opponent also played a Pressure. |
| `chipOnWin` | 2 | Pressure, Convert, Recover | +2 chip if it beats a Convert (a Recover, a Pressure). |
| `flowChip` | 2 | Pressure, Convert, Typeless | +2 chip while flowing. |
| `clearOwn` | true | Convert (Super only) | Also clear your own pile. |
| `onCooldownConvertChip` | 2 | Any (not on a Super) | On cooldown: your Converts chip +2. |
| `lock` | true | Any | The opponent's played card goes one space further on cooldown. |
| `stagger` | "convert" | Any | If it beats a Convert, the opponent can't play a Convert next round. |
| `returnCard` | true | Any | Return one card from your cooldown track to your hand. |
| `selfAdd` | 2 | Any | Cost: add 2 tokens to your own pile. |
| `onLossSelf` | 2 | Pressure, Convert, Recover | Cost: on loss, add 2 tokens to your own pile. |
| `lockout` | true | Any (not on a Super) | Cost: on cooldown, you can't play another card of this type. |

A value of 1 on a "for every" field reads as "for every token". Scaling chip on a Recover adds up (`chipPerCleared` plus `chipPerHpLost`); in the simulator only one applied, which no current card relies on.

All effects read the board as it was at the reveal, and the changes apply together (the "state at reveal" proposal, as in the simulator).

## Checking the engine

```
node tools/sim.mjs gambler bastion -n 500 --seed 5
node tools/sim.mjs --all -n 300
python3 tools/crosscheck/py_trace.py <folder with yomi_sim.py> trace.jsonl
node tools/crosscheck/js_replay.mjs trace.jsonl
```

The cross-check replays reference games from `yomi_sim.py` and compares the board after every round, both sparring partners' payoff grids and their game values. On 20 October 2026 it matched on 288 games (2,430 rounds), covering the counter-chip variants, Rising Stakes, Taunt, card return and Cooldown 2.

## Publishing

```
node tools/build-artifact.mjs
node --import ./tools/smoke/register.mjs tools/smoke/run.mjs <vendor dir>
```

then publish `dist/yomi-playtest.html` to the same artifact. The page declares the `db`, `user` and `downloads` capabilities; `fighters/` and `settings/` are writable by editors only, `games/` by anyone who can use the page.
