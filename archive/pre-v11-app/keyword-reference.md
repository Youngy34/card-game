# Keyword & Effect Reference

The complete set of building blocks the rules engine understands, for authoring and tweaking characters. **Anything you can express with these keywords is auto-resolved by the app. Anything outside them falls to the manual fallback** (the app pauses and shows the card's `rawText` for you to apply by hand) — or you extend the engine. So always keep a plain-English `rawText` on every card, whatever else it has.

`NEW` = added this design pass · `RESERVED` = supported but no current card uses it · `REMOVED` = no longer in the vocabulary.

---

## Card fields (the schema)

| Field | Notes |
|---|---|
| `name` | |
| `type` | `strike` / `guard` / `crush` |
| `priority` | `1`–`3`, or `"X"` (no set Priority) |
| `damage` | integer |
| `combo` | `starter` / `linker` / `ender` |
| `copies` | how many in the deck |
| `clashEffects` | array of effects that resolve when the card wins a Clash (per their trigger/condition) |
| `neutralEffects` | array of effects that resolve when the card is played face up on a Neutral turn |
| `rawText` | human-readable rider — shown on the card and used by the manual fallback |
| `art` | optional path to a full-card PNG; if absent, the app draws the card from these fields |

A **character file** adds `baseHP`, `passive` (name + `rawText` + `effects[]`), `signatureCards[]`, and `superCard`.

## Card basics

- **Types & triangle:** `strike` (red) beats `crush`; `crush` (gold) beats `guard`; `guard` (blue) beats `strike`. Different types → triangle decides, ignoring Priority.
- **Priority:** `1`–`3` settles same-type Clashes (higher wins, tie = standoff). `"X"` = non-committal; stands off against its own type and against any other `X`.
- **Combo:** `starter` (launches, can't be a follow-up) · `linker` (continues a combo) · `ender` (ends it).

---

## Effect primitives

| Primitive | Parameters | Does | Example |
|---|---|---|---|
| `dealDamage` | `amount`, `target`, [`overrideAmount`] | Deal damage directly | Arc Bolt, Meteor, Sonic Cutter |
| `modifyDamage` | `amount` (±), `target`, [`per`], [`appliesTo`], [`condition`] | Add/subtract damage; can scale | Checkmate +3, Hundred Fang, Unflinching −2 |
| `draw` | `amount`, `target` | Draw cards | Bloodthirst, Vigilance, Phase |
| `opponentDiscards` | `amount`, `chooser` | Opponent discards; `chooser` decides who picks | Pre-empt (`self`), Disrupt (`opponent`), — (`random`) |
| `reduceNextDamage` | `amount`, `target`, `duration` | Reduce the next damage you take | Brace, Warding Glyph |
| `chargeSuper` | `amount` | Add to your Super gauge | Jab / Guard / Body Blow |
| `damageEvenOnLoss` | — | Card deals its printed damage even if it loses | Gutter Cut |
| `damageEvenOnStandoff` `NEW` | — | Card deals its printed damage even on a standoff | Final Atomic Buster |
| `forceClashResult` | `result`, `overrides`, [`optional`], [`cost`] | Override the Clash outcome | Ward Step |
| `revealHand` | `target` | Look at a hand (information only — no status) | Premonition |
| `returnFromDiscard` | `amount`, `to`, `filter` | Return a matching card from discard | Echoing Vision |
| `setTrap` | `trigger`, `window`, `effect` | Place a lingering trap that fires on a trigger | Ensnare, Lockdown, Taunt |
| `applyStatus` `RESERVED` | `status`, `target` | Apply a status keyword (see below) | — (Bleed/Stun/Knocked Down) |

## Shared parameters

- `target` — `self` or `opponent`.
- `chooser` — `self`, `opponent`, or `random`; who selects the card for `opponentDiscards`. `random` requires no interaction — the engine picks immediately.
- `amount` — integer (negative allowed for `modifyDamage`).
- `per` — scaling key; `amount` is multiplied per matching unit. In use: `otherCardInCombo` (Hundred Fang), `opponentCardBelow4` (Inevitability).
- `overrideAmount` — `{ amount, condition }`; replaces the base amount when the condition holds (Unravel: 1 → 2 at half HP).
- `appliesTo` — what a `modifyDamage` targets when it isn't the card's own damage; e.g. `incomingCombo` (Unflinching).
- `duration` — `nextInstance` (until the next hit) or `untilYourNextTurn` (one-turn window).
- `window` — for `setTrap`: `untilTriggered` (waits indefinitely) or `untilYourNextTurn` (one-turn).
- `to` / `filter` — for `returnFromDiscard`: destination (`hand`) and matcher (`{ hasEffectType: "revealHand" }`).
- `optional` / `cost` — for player-choice effects; e.g. Ward Step is `optional` with `cost: { type: "discardFromHand", amount: 1 }`.
- `result` / `overrides` — for `forceClashResult`: e.g. `result: "standoff"`, `overrides: "loss"`.

---

## Triggers (when an effect fires)

| Trigger | Fires when | Scope |
|---|---|---|
| `onWin` | this card wins its Clash | clash riders |
| `onWinClash` | you win any Clash | passives (Bloodthirst, Charge) |
| `onLoseClash` | you lose a Clash | passives (Unflinching) |
| `onWouldLoseClash` | at the moment you'd lose, before it resolves | conversion effects (Ward Step) |
| `onDealDamage` | you deal damage | passives (Disorient) |
| `opponentDeclaresClash` | opponent declares a Clash | traps (Ensnare, Lockdown) |
| `opponentTakesNeutralTurn` | opponent takes a Neutral turn | traps (Taunt) |

`neutralEffects` need no trigger — they fire when the card is played on a Neutral turn. A combo-member modifier with no trigger (e.g. Knee Bash) applies when the combo's damage is totalled, gated by its condition.

## Conditions (gate whether an effect applies)

| Condition | Parameters | True when |
|---|---|---|
| `isCounter` | — | you won the Clash on the opponent's turn |
| `opponentHandSizeAtMost` | `amount` | opponent holds ≤ amount cards |
| `opponentAtOrBelowHalfHP` | — | opponent at ≤ half their starting HP |
| `damageDealtAtLeast` | `amount` | the damage instance is ≥ amount |
| `firstTimePerTurn` | — | only the first time this turn |
| `comboHitCount` `RESERVED` | — | scale/threshold on combo length |
| `allOf` / `anyOf` | `conditions[]` | all / any of the nested conditions hold |
| `opponentForeseen` `REMOVED` | — | (Foreseen dropped) |
| `previousTurnWasNeutral` `REMOVED` | — | (Charge reworked to `isCounter`) |

Example compound: Disorient = `allOf: [ damageDealtAtLeast 4, firstTimePerTurn ]`.

---

## Lifecycles & the play area

A card with a lasting effect **stays face up in its owner's own area** until it ends, then goes to **that owner's discard**. Cards never cross to the opponent's area; nothing is ever removed from the game.

- **One-turn** — lasts until the start of your next turn. *Cleanup ritual: at the start of your turn, resolve or discard your one-turn cards before acting.* (`duration`/`window` = `untilYourNextTurn`.)
- **Until-triggered / until-spent** — sits with no time limit until its trigger fires or you spend it; skipped by the start-of-turn sweep. (`window` = `untilTriggered`.)

No effect lasts a fixed number of turns greater than one.

## Status keywords

Lingering debuffs use this small shared set so they behave consistently. Each is a card kept in **your** area that affects the opponent and is swept at the start of your next turn (applied via `applyStatus`):

- `bleed` — opponent takes 1 at the start of their turn (reapply to keep it going).
- `stunned` — opponent skips their next turn's action.
- `knockedDown` — opponent can't declare a Clash on their next turn (Neutral only).

---

## Authoring principles

- **Buff over nerf where equivalent.** Effects keyed to *your own action* ("your next won Clash +2") read cleaner and feel better than the same thing as a penalty. Effects about the opponent's *global state* (a tick, a skipped turn) are genuine debuffs — keep them as such; they still sit in your own area.
- **Lasting effect → card stays in your area.** Don't bolt a lasting effect onto a card that gets consumed mid-combo; let the card that creates the effect be its own marker.
- **Nothing is permanently removed** — everything cycles via reshuffle.
- **Vocabulary boundary.** If a rider only uses the keywords above, the app resolves it automatically. If it needs something new, either add it to the engine's vocabulary or let it run on the manual fallback — and either way, write clear `rawText` so the intent is always legible.
