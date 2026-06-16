# Rules Overview

## Concept

A 1v1 card game inspired by fighting games. Each player picks a fighter and plays a single small deck (currently fewer than 20 cards; exact size TBD). A match is a single round: it ends as soon as one player’s HP reaches 0.

Aesthetically the game leans **Guilty Gear** — most fighters carry a weapon or have a signature gimmick, but everyone still shares a grounded base of normal strikes, guards, and grabs. This keeps room for wildly different archetypes (zoners, rushdown, and pure grapplers alike) while a shared foundation keeps the game readable across matchups.

## The Card

There is only **one type of card**. Every card is a valid Clash card; some cards also carry an optional **Neutral ability** used on a Neutral turn instead. Each card shows:

- **Type** — Strike (red), Guard (blue), or Crush (gold)
- **Priority** — a number 1–3, or **X** (X = no set Priority; see Clash)
- **Damage**
- **Combo category** — Starter, Linker, or Ender
- **Clash ability** (optional rider) — text that resolves when the card wins a Clash
- **Neutral ability** (optional) — what the card does if played face up on a Neutral turn

## The Setup

1. Each player picks a fighter. Fighters have their own **base HP** and a **passive ability**.
1. Each player sets aside one card from their deck face down — their **Super card**. It is not shuffled in and cannot be drawn normally.
1. Shuffle the rest of the deck and draw an opening hand of 5 (hand size still to be confirmed).
1. The fighter with the **lowest base HP takes the first turn** (coin flip if tied).

## Turn Structure

Players alternate turns. On your turn you take **one** of two actions, then draw 1 card at the end of your turn:

- **Neutral turn** — play one card face up for its Neutral ability, then discard it (some cards have no Neutral ability and so can’t be played this way).
- **Declare a Clash** — initiate a Clash (below).

Clashing is **optional** — you are never forced to attack. Nothing hard-stops a player from taking Neutral turns indefinitely; on its own that can’t win a game, since damage normally comes from Clashes — though some cards’ Neutral abilities deal damage directly (a zoner’s whole plan is built on this).

**Start-of-turn cleanup.** Before you take your action, resolve or discard any **one-turn lingering cards** you have in play (see Lingering Effects & the Play Area). This is the single, consistent moment lingering effects expire.

**Running out of cards:** if you ever need to draw and your deck is empty, shuffle your discard pile to form a new deck and continue. Decks are small and are expected to recycle through a match. (The set-aside Super card is never shuffled in.)

## Clash

When you declare a Clash:

1. You (the declarer) set one card from hand face down.
1. Your opponent responds by setting one card from hand face down.
1. Both reveal simultaneously.

**Regardless of the outcome, it becomes the opponent’s turn next** — the response is part of resolving your turn, not a turn of its own.

### Type beats (the triangle)

|Type      |Colour|Flavour                              |
|----------|------|-------------------------------------|
|**Strike**|Red   |Quick, regular attacks               |
|**Guard** |Blue  |Counters, blocks, reversals          |
|**Crush** |Gold  |Big, slow, powerful attacks and grabs|

- Guard beats Strike
- Strike beats Crush
- Crush beats Guard

The triangle decides any Clash between **two different types**, regardless of Priority — with one exception: two **X** cards (see below).

### Priority and X

**Priority** is a number **1–3**, or **X**. **X means the card has no set Priority** — a non-committal, defensive action. Any type can be X, and any type can also carry a numeric Priority and Damage — **Guards included** (a Guard is not automatically X; it can have a Priority and Damage value like any other card).

Priority and X only come into play when the triangle does not already decide the Clash — that is, in **same-type** Clashes and in **X-vs-X**:

- **Same type, both numbered** (Strike vs Strike, Guard vs Guard, Crush vs Crush) — **higher Priority wins; equal Priority is a standoff.**
- **Same type, one card is X** — **standoff.** An X card neither beats nor is beaten by its own type. (So, for example, a Priority-3 Guard does *not* beat a basic X Guard — they stand off.)
- **Both cards are X** (any types) — **standoff,** even across types. Two non-committal cards resolve to nothing, so the triangle is ignored in this case.

An X card still uses the triangle against a **numbered card of a different type** — e.g. an X Strike beats a numbered Crush (a grab) and loses to a numbered Guard — but it stands off against anything X and against its own type.

### Outcomes

- **Loser:** their card is discarded with no effect — no damage, no abilities. *(Exception: a few specific cards deal damage even when they lose. This is a rare, flavourful rider, not the default.)*
- **Standoff:** both cards are discarded with no effect. The Clash is **resolved — it does not replay.** The active player proceeds to their end-of-turn draw, then it becomes the opponent’s turn. *(Exception: a few specific cards deal their damage even on a standoff — e.g. an unstoppable Super that cannot be neutralised by an X card, a Priority tie, or a loss-to-standoff effect.)*
- **Unable/unwilling to respond:** if the opponent can’t or won’t set a Clash card, the declarer may run a combo from their card as normal (a free punish). If neither plays a card, nothing happens and the turn ends.
- **Winner:** proceeds to Punish.

## Punish (Combos)

The winning Clash card is the **first hit** of the combo. The winner may then chain follow-up cards from hand, governed by combo category:

- **Starter** — can win a Clash and launch a combo, but **cannot be added as a follow-up** (nothing chains into it). Guard cards are typically Starters — you block to *create* an opening, you don’t “block” mid-flurry.
- **Linker** — can be added as a follow-up; the combo can continue after it.
- **Ender** — can be added as a follow-up; the combo **stops** after it. Enders are typically the highest-damage cards in the game.

There is no hard cap on combo length — chains are limited naturally by card design (Linkers are relatively scarce) and by the fact that every follow-up spends a card from your hand. Once the combo ends, total the damage from all cards in the chain, then resolve their abilities in the order played. All cards are discarded afterward unless stated otherwise.

## Lingering Effects & the Play Area

Most cards resolve at once and go straight to the discard. A few carry a **lasting or delayed effect** — a trap, a self-buff, a status. These follow one rule that keeps the physical game clean and unambiguous.

**A card with a lasting effect stays face up in its owner’s own area until the effect ends, then goes to that owner’s discard.** Cards never cross into the opponent’s area — even a debuff stays on your side, with its text stating who it hits (e.g. *“your opponent takes 1 at the start of their turn”*). Each player’s cards live only in their own area, so cleanup is never ambiguous and nothing lands in the wrong discard.

**Nothing is ever removed from the game.** Every card cycles. A lingering card is simply out of your discard/deck loop while it’s active, and returns to your discard when it ends. (The set-aside Super is the only card that begins outside the deck, and it too is earned and then cycles.)

**Effects use only two lifecycles:**

- **One-turn** — the card lasts until the start of your next turn. *At the start of your turn, before acting, resolve or discard your one-turn cards.* The card’s presence is the timer — you never count turns. *(e.g. Brace, Warding Glyph, Taunt.)*
- **Until-triggered / until-spent** — the card sits with no time limit until its trigger fires or you spend it, then resolves and discards. These are *not turn-sensitive* and are skipped by the start-of-turn cleanup. *(e.g. the traps Ensnare and Lockdown.)*

No effect lasts a set number of turns greater than one: a lingering card is always either swept on your next turn or waiting on a trigger.

**Prefer a self-buff to an opponent-debuff where they’re equivalent.** An effect keyed to *your own action* (“your next won Clash deals +2”) reads as a clean list of your own advantages and feels better than the same thing written as a penalty — so favour that framing. Effects about the opponent’s *global state* regardless of what you do (a recurring tick, a skipped turn) are genuine debuffs and stay as such; they still sit as a card in *your* own area.

**Status building blocks.** Lingering debuffs draw on a small shared set so they behave consistently. Each is a card kept in your area that affects the opponent and is swept at the start of your next turn (tools for future cards — not every character uses them):

- **Bleed** — your opponent takes 1 at the start of their turn (reapply to keep it going).
- **Stunned** — your opponent skips their next turn’s action.
- **Knocked Down** — your opponent cannot declare a Clash on their next turn (Neutral only).

## Super

Each player sets aside one **Super card** at the start (see The Setup). It cannot be drawn normally; instead it is **earned during the match** — once you meet the Super condition, take your Super card into hand and play it like any other card.

**The gauge — charging via the basics.** Your Super is charged on a simple **gauge** (a counter, tracked separately from your deck). Only the **shared basics** can charge it: each basic carries the Neutral ability *“discard this to charge your Super +1.”* So on a Neutral turn you may play a basic for this ability instead of for a Clash — it goes to your discard like any played card, and your gauge ticks up by 1. When the gauge reaches **3** *(starting value — tune in playtest)*, take your Super card into hand and play it like any other card.

Notes that make this work cleanly:

- **No card is removed from the game.** The discarded basic goes to your normal discard pile and reshuffles back in — your deck is always the full, tuned deck. The gauge itself is just a count.
- **It’s a real choice with an opportunity cost.** Charging deals no damage and uses no card effect; you spend the whole turn on it (and give up a basic — your guaranteed type coverage / clean combo fodder for that cycle) while your opponent gets a free turn. You still draw at end of turn, so a charge turn is card-neutral, not card-positive.
- **It is gated and self-limiting.** You can only charge with a basic in hand, and banking basics thins them until your next reshuffle — so you can’t charge every turn at will.

What happens to the gauge after a Super is taken, whether a Super carries any extra cost, and the exact threshold are still to be confirmed.

## Character Identity

Identity is expressed through three layers, not a unique resource system per character (which would mean a steep per-character learning curve):

- **The shared basics** — every fighter runs the *exact same* three basic cards: a basic Strike, a basic Guard, and a basic Crush, at 2 copies each (6 cards). They carry no Clash rider, but each has one Neutral ability — *“discard this to charge your Super +1”* (see Super) — giving the universal cards a second, universal job. Versatile cards with clean combo routes, they guarantee every player always has access to each type and a reliable fallback combo, make any opponent partly readable from turn one, and double as your only means of charging a Super.
- **Retuned archetype cards** — the rest of the deck fills familiar roles (a cheap poke, a launcher, a finisher, etc.) but with character-specific numbers, flavour, and especially **riders**. Differentiating through abilities rather than raw stats is what makes a card feel like *that fighter’s* move, and it’s cheap to vary without re-testing from scratch.
- **A passive ability** that reshapes the core loop, e.g.:
  - *Rushdown* — after winning a Clash, your next Clash card is played face up
  - *Grappler* — your Crush cards don’t lose to Guard on the first Clash of the match
  - *Defensive* — when you would lose a Clash, you may discard a card from hand to make it a standoff instead
  - *Counter-puncher* — when you win a Clash on your opponent’s turn (a counter), deal +2 damage

## Win Condition

Reduce your opponent’s HP to 0.

## Open Questions / To Decide

- **Deck size** — currently fewer than 20. In the current builds this is 6 shared basics + 8 character cards (a 14-card deck) plus 1 Super set aside. Exact size still to confirm.
- **Opening hand size** — currently 5; to confirm alongside deck size and draw amount.
- **Draw amount** — drawing 1 per turn is the current default; combo-heavy turns are naturally card-negative, so this is a key tuning knob for combo length and hand pressure.
- **Super tuning** — the charge mechanic is set (basics carry “discard to charge +1”; gauge to 3). Still to confirm: the exact threshold (3 to start), what happens to the gauge after a Super is taken (reset for a second Super, or one-and-done), and whether playing a Super carries any extra cost. See **Super**, above.
- **Base HP spread** — the roster currently runs 18 to 30. Confirm whether a gap this wide is healthy, or whether going first needs to compensate fragility more (or less).
- **Counter-bonus stacking (Bastion)** — Charge (+2), Knee Bash (+1), and Final Bastion (+3) all reward winning on the opponent’s turn and can stack on one counter; watch the ceiling on his biggest punish and trim if needed.
