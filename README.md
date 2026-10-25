# Yomi Playtest

The digital playtest table for *Yomi*, the 1v1 fighting-game card game. The signed-off fighters play rules v11 (move lists, cooldown, single-use Supers). Drafts play **rules v12** (kinds of move, speed, Guard and Counter turn-backs, Setups), from `rules-overview 12.md` in the Claude project; a fighter's file says which rules it plays, and a matchup needs both fighters on the same rules.

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
| `data/reference/*.json` | Reference fighters for benchmarking, shown in the app and runnable by name in `tools/sim.mjs`, but left out of `--all` and the Lab's round-robin. Currently the Dummy. |
| `data/drafts/*.json` | Rules v12 drafts, shown in the app (marked Draft) and runnable by name, but left out of `--all` and the Lab's round-robin. Currently Clarence, the v12 starter. |
| `data/variants/*.json` | Earlier versions and test variants, runnable by name in `tools/sim.mjs` (not shown in the app) |
| `data/settings.json` | Default rules and sparring-partner weights |
| `src/engine/` | The rules engine and sparring partner, plain JavaScript with no UI (runs in the browser and in Node) |
| `src/app/` | The screens (Preact and htm, loaded from a CDN) |
| `tools/sim.mjs` | The simulator: command-line balance runs on the same engine and JSON (replaces `yomi_sim.py`) |
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
- `super`: the Super, or `null` for a reference fighter with no Super (the Dummy). The validator warns about it, since every real fighter has one.
- `variantOf` (variants only): the fighter it was copied from.
- `rules` (optional): `12` for a rules v12 fighter. Leave it out for v11.

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
| `kind` | Rules v12 only, and required there: `strike` or `projectile` (Pressure), `heavy` or `grab` (Convert), `guard` or `counter` (Recover), `setup` (typeless) |
| `speed` | Rules v12 attacks only, and required there: 11–20 for a Pressure, 1–10 for a Convert, higher is faster |

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
| `knockdown` | "resolves" or "recover" | Convert | Knockdown: (if it beats a Recover,) the opponent can't play a Pressure next round. |
| `offBalance` | true | Recover | If it beats a Pressure, the opponent is off-balance: they can't play a Recover next round. |
| `returnCard` | true | Any | Return one card from your cooldown track to your hand. |
| `selfAdd` | 2 | Any | Cost: add 2 tokens to your own pile. |
| `onLossSelf` | 2 | Pressure, Convert, Recover | Cost: on loss, add 2 tokens to your own pile. |
| `lockout` | true | Any (not on a Super) | Cost: on cooldown, you can't play another card of this type. |

A value of 1 on a "for every" field reads as "for every token". Scaling chip on a Recover adds up (`chipPerCleared` plus `chipPerHpLost`); in the simulator only one applied, which no current card relies on.

All effects read the board as it was at the reveal, and the changes apply together (the "state at reveal" proposal, as in the simulator).

### Rules v12 in the engine

For a fighter with `"rules": 12` (see `rules-overview 12.md`):

- **Different types:** the triangle decides. Every Pressure is faster than every Convert, so Pressure still beats Convert.
- **Two attacks of the same type:** two Projectiles cancel and two Grabs tech (neither resolves, whatever their speeds); otherwise the faster card wins, and a tie trades (both resolve). The beaten card's On loss text applies.
- **Two Recovers:** both resolve, each clearing its own pile.
- **A Guard or Counter that beats a Pressure turns its numbers back,** as the Pressure would have landed them: a Guard puts its Build on the attacker's own pile, and a Counter turns its chip back on the attacker. (A Projectile's chip no longer gets through a Guard: dropped on 25 October 2026.)
- **A Setup** never wins or loses. If the opponent played a Pressure or Convert, the Setup is interrupted and none of its text applies; otherwise it takes effect.
- **Validation:** Recovers and Setups deal no chip (a Recover Super that chips is only a warning, since it's an open question), every attack has a speed in its band, and two warnings cover the authoring guidelines: Counters need Pressures that chip, and speed is a cost (no plain card both faster and at least as big as its same-type sibling).
- **The Settings screen's Recover-chip rule only applies to v11 fighters.**

## Difficulty

Against the sparring partner you can pick Easy, Medium or Hard on the Play screen. Hard is the simulator's player, unchanged. The easier levels make mistakes that scale with their cost: each card is played with a chance that grows with how good it looks (a "quantal response" mix), so close calls become coin flips but big blunders stay rare. One number per level sets how sharply it prefers better cards (`LEVELS` in `src/engine/ai.js`: Easy 5, Medium 20).

Calibrated on 20 October 2026 in the four mirror matchups, 2,000 games per pairing: Hard beats Medium about 62–38, Medium beats Easy about 60–40, and Hard beats Easy about 69–31. A player choosing at random still beats Hard about 22% of the time (12% as the Gambler, 32% as Atlas).

The Lab can give each fighter its own level, and the command line takes `--levels hard,easy`. Logged games record the level they were played at.

## The simulator

```
node tools/sim.mjs --list
node tools/sim.mjs gambler bastion -n 500 --seed 5
node tools/sim.mjs --all -n 300
node tools/sim.mjs bastion-sc2 atlas --counter attack
node tools/sim.mjs vex vex --levels hard,easy
node tools/sim.mjs clarence clarence -n 500 --seed 5    # rules v12
```

For rules v12 fighters the report adds quiet rounds by cause, how same-type attacks were settled (speed, trades, cancels, techs), how often Guards and Counters turned a Pressure back and by how much, Setups interrupted, and how games end.

The full guide (reading the output, the value function, what to trust) is `claude/sim/yomi-sim guide.md` in the Claude project.

**The Python simulator, `yomi_sim.py`, is retired** (20 October 2026). This engine replaces it. The cross-check below replays reference games recorded with it and compares every round: both players' options, both payoff grids, both game values and the board afterwards. On 20 October 2026 it matched on 322 games (2,798 rounds), covering the signed-off roster, every version in `data/variants/`, all three counter-chip settings, Rising Stakes, Taunt, card return and Cooldown 2. Five old Python versions use mechanics since ruled out and weren't ported: `gambler-edge`, `bastion-htl`, `bastion-typelock`, `vex-pre` and `atlas-v1`.

```
python3 tools/crosscheck/py_trace.py <folder with yomi_sim.py> trace.jsonl
node tools/crosscheck/js_replay.mjs trace.jsonl
```

Seeded runs here won't reproduce the exact figures in the Python-era tables (the random number generators differ), only the same figures within noise.

## Publishing

```
node tools/build-artifact.mjs
node --import ./tools/smoke/register.mjs tools/smoke/run.mjs <vendor dir>
```

then publish `dist/yomi-playtest.html` to the same artifact. The page declares the `db`, `user` and `downloads` capabilities; `fighters/` and `settings/` are writable by editors only, `games/` by anyone who can use the page.
