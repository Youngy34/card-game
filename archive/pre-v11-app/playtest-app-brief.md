# Build Brief — Card Game Playtest App

## 1. Purpose

A digital playtest table for the 1v1 fighting-game card game, so you can iterate on balance without designing, printing, and cutting physical cards every cycle. It loads your character decks, runs the rules automatically wherever they're deterministic, and falls back gracefully where a card's ability is too bespoke to auto-resolve. It must be **data-driven**: adding a character or retuning a card/rule is an edit to data you hold outside the app, never a code change.

**Locked decisions (from playtest planning):**
- AI opponent is a **basic rule-based heuristic** — no LLM-quality play, no API calls.
- Card/character data is authored and maintained **outside the app** as JSON files; you hold the source of truth.
- A simulation **turn cap of 50 turns per player** ends runaway games (a sim safeguard, not a game rule). Capped games are **tallied separately and excluded from win rates**.
- Prefer **configurable over hardcoded** wherever practical (paths, conventions, parameters), since structure is still settling.

**Success looks like:** you edit a JSON file, reload, and within a minute you're testing a matchup — and after a session you can read off *who won, how, and why* to guide the next tweak.

## 2. The one principle everything hangs on: data-driven, not hardcoded

No character, card, or balance number is baked into the engine. Three data layers:

- **Global parameters** — hand size (5), draw-per-turn (1), Super gauge threshold (3), deck size, whether the gauge resets after a Super, the art base path, etc. Exposed as **live controls** so you can change them mid-session and re-test.
- **The shared basics** — the 6 universal cards, defined once and injected into every deck.
- **Characters** — base HP, passive, 8 signature cards, Super.

The shared basics and global parameters live in the same external JSON store as the characters. Changing any layer re-derives decks and behaviour on the next match. A card the engine doesn't fully understand never breaks the app; it routes to the manual fallback (§6).

## 3. Card & character data — external JSON (your source of truth)

You maintain the data as JSON files in a folder the app reads at startup (e.g. one file per character, plus a basics/params file). A **Reload** button re-reads the folder so a tweak takes effect without restarting. No in-app editing and no importer — the files are authoritative.

Every card uses one schema (matching your "one type of card" design):

| Field | Notes |
|---|---|
| `name` | |
| `type` | strike / guard / crush |
| `priority` | 1–3 or `X` |
| `damage` | integer |
| `combo` | starter / linker / ender |
| `copies` | |
| `clashEffects` | array of structured effects (resolve on winning a Clash / per their condition) |
| `neutralEffects` | array of structured effects (resolve when played face-up on a Neutral turn) |
| `rawText` | human-readable rider — used in data-mode rendering (§8) and by the manual fallback |
| `art` | **optional** path to a **full card-design PNG** (the entire card face), resolved against a configurable base path. If set, it replaces the app-generated card face; if absent, the app generates the face from the data fields. Visual only — the engine **always** reads stats/effects from the data fields, never from the image. |

A character file adds: `baseHP`, `passive` (a structured effect with a trigger), `signatureCards[]`, `superCard`.

## 4. The deterministic rules engine (auto-resolve everything here)

Fully automated, because it's unambiguous:

- **Setup** — pick fighters, auto-set-aside each Super, build the 14-card deck, shuffle, draw opening hands, assign first turn to lowest base HP (coin flip if tied).
- **Turn loop** — present the active player's only two options (Neutral turn or Declare Clash), then auto-draw 1 at end of turn.
- **Clash resolution** — full triangle and Priority/X logic: different types → triangle (Guard>Strike>Crush>Guard); same type both numbered → higher Priority wins, tie = standoff; same type with an X → standoff; both X (any types) → standoff; X vs numbered different-type → triangle applies.
- **Outcome handling** — loser discards (no effect), standoff discards both with **no replay**, no-response → free punish, winner proceeds to Punish. The engine must allow **either participant** to win: a responder who wins runs the punish on the declarer's turn (Bastion's counter identity), and the turn still passes to the opponent afterward.
- **Combos** — enforce category legality (Starter can't be a follow-up, Ender stops the chain, Linker continues), total damage across the chain, resolve effects in play order, then discard.
- **Draw / reshuffle** — auto-reshuffle the discard when the deck empties; Super never shuffled in.
- **Super gauge** — track the counter, increment when a basic is discarded for its charge ability, hand the Super to its owner at threshold.

Hidden information is enforced in code: each player (human or AI) only ever sees what they're entitled to. Clash cards are committed face-down and revealed simultaneously, so neither side can peek (except where a card like Premonition explicitly grants sight).

## 5. The effect & ability system (the real engineering)

Almost every rider in the current roster reduces to a **small vocabulary of effect primitives + conditions**, so most "un-automatable" abilities are in fact automatable.

**Effect primitives:** `dealDamage`, `modifyDamage(±n)`, `draw`, `opponentDiscards`, `reduceNextDamage`, `applyStatus`, `revealHand`, `returnFromDiscard`, `setTrap`, `chargeSuper`, `damageEvenOnLoss`, `forceClashResult` (override standoff/loss).

**Conditions / triggers:** `onWin`, `onLoss`, `onNeutralPlay`, `isCounter` (won on opponent's turn), `opponentForeseen`, `opponentHandSize ≤ n`, `opponentAtOrBelowHalfHP`, `firstTimePerTurn`, `previousTurnWasNeutral`, `comboHitCount`.

That covers, deterministically: every Liora spell (incl. Unravel's half-HP scaling and Ensnare/Lockdown traps), Bloodthirst, Gutter Cut, Vigilance, Body Splash, Disrupt, all of Sibyl's Foreseen/hand-size riders, Charge, Knee Bash, the Super modifiers, and the damage-reduction statuses.

Two parts deserve explicit care:

1. **A trigger/status system with timing windows.** Several abilities are delayed or turn-scoped: Taunt ("if your opponent takes a Neutral turn before your next turn…"), traps, Foreseen decay ("until the end of your next turn"), and the "first time each turn" triggers (Unflinching, Ward Step, Disorient). The engine needs turn-scoped counters that reset on the correct boundary, plus a queue for delayed triggers.
2. **A defined effect-resolution order**, because overrides collide. Worked example from your docs: compute the raw clash result → Ward Step may convert a loss to a standoff → Atlas's Super ("cannot become a standoff… Atlas wins instead") must override *that*. Give effects an ordering/priority and surface it in a debug log.

## 6. The fallback (manual only)

For any effect the engine can't auto-resolve, or any novel rider you haven't encoded yet, the engine **pauses and asks you**: it shows the card's `rawText` and a free-form input ("apply the effect, then tell me the result — damage dealt, cards moved, statuses set"). This guarantees nothing is ever un-playable and keeps the table running for any card while you decide whether a new effect is worth promoting into the structured vocabulary. (No AI adjudication — the app makes no API calls.)

## 7. Modes

- **Hot-seat (human vs human)** — the MVP; replaces the physical cards immediately.
- **Basic AI opponent** — a rule-based heuristic (e.g. value-weighted: prefer winning Clashes by type/Priority reads, charge the Super when a basic is spare and no good attack exists, extend combos while damage-positive). No LLM. It only ever sees its entitled state and commits Clash cards blind.
- **AI vs AI batch simulation** — *the highest-leverage feature for balancing.* Run a matchup N times unattended using the same heuristic and report aggregate stats (§9). A match that reaches **50 turns per player** with no result is ended and recorded as a **stall**, tallied separately and kept out of win rates — both a safeguard and a balance signal.

## 8. Card presentation / UI

Keep the overall UI **simple**. Each card renders in one of two modes, chosen per card by whether it has art:

- **Art mode (when `art` is set):** the PNG is a **complete, full-card design** and is shown as the entire card face — it fully replaces the generated layout, and the app draws no text over it. Art is **purely cosmetic**: the engine always reads stats and effects from the JSON, never from the image, so cards with and without art behave identically in the rules.
- **Data mode (no art — your current state):** the app **generates** the whole card face from the JSON so every card is fully legible without any art. Type-coloured (**Strike = red, Guard = blue, Crush = gold**), with the name, a stat line (Priority 1–3/X, Damage, and a Combo badge: Starter / Linker / Ender), and the Clash + Neutral ability text labelled distinctly.

A deck can mix the two freely — finished cards show their PNG, unfinished ones show the generated face — so art is added incrementally with **zero UI rework**: drop in a PNG, set the card's `art`, done. The whole card art replaces the need for the app to lay out any details in text.

Useful for iteration: an **inspect toggle** that shows the underlying data view for any card even when it has art, so you can confirm a finished card's image still matches the live numbers while balancing.

Beyond the card face, the table needs: both hands (yours visible, opponent's hidden), HP and Super gauge per player, deck/discard counts, the current Clash (face-down → reveal), and a running match log.

## 9. Balance instrumentation (make the app earn its keep)

Every match logs to a readable timeline and feeds aggregate stats. Track at minimum: winner and final HP, who went first, match length in turns, damage by source (Clash combos vs Neutral spells vs Supers vs traps), Supers fired, and stalls. Turn-cap stalls are counted **separately** from wins/losses. A dashboard over a batch run should answer your open questions directly:

- **HP spread (18–30):** win rate by base-HP gap, and first-turn win % — does going first compensate fragility?
- **Super tuning:** how often a Super actually fires at threshold 3; effect of changing the threshold live.
- **Stall / no-draw risk:** *your rules define no draw condition.* The 50-turn cap catches non-progressing games; surface their frequency per matchup as a finding (e.g. two non-Liora decks both refusing to Clash), not a crash.

## 10. Technical notes for building in Claude

- **Build target: a local React app via Claude Code** (Sonnet on Pro). The external-JSON source of truth and full-card PNG loading both need a real project folder, which Claude Code gives you and claude.ai artifacts don't.
- **No Anthropic API integration anywhere** — basic AI is heuristic, cards are authored externally, the fallback is manual. Zero runtime API cost.
- **Suggested project shape:** a small dev server (e.g. Vite + React). Card JSON in something like `/data`; full-card PNGs in a folder you choose — keep the **art base path configurable** (a global parameter) rather than hardcoded, since the structure isn't settled. Both read at startup and on Reload.
- **Persistence:** because this is a local app (not a claude.ai artifact), normal `localStorage` is fine for tuning presets, match logs, and last-used settings. Also offer JSON **export/import of config and logs** so you can version your balance passes.
- Keep all rules logic in plain, well-separated modules (engine / effects / AI / UI) so retuning never means touching the renderer.

## 11. Suggested phasing

1. **MVP** — external-JSON loading + Reload, deterministic engine, hot-seat H2H, card-face UI (data mode now, art mode ready), manual fallback for any rider, live global parameters, basic match log. *This alone ends the printing.*
2. **Effects engine** — structured primitives + the trigger/status system auto-resolving the common riders; defined resolution order.
3. **Basic AI** — heuristic opponent with strict hidden-info enforcement.
4. **Batch simulation + dashboards** — N-game runs with the 50-turn cap; win-rate / length / damage-source / first-turn / stall stats.

## 12. Remaining open decisions

- **Art base path / folder structure** — left configurable (a global parameter); settle the default once you decide how to organise the PNGs. Nothing else hardcodes a path.
