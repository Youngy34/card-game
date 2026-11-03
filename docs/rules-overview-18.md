# Rules Overview — v18

*Drafted 2 November 2026 (late) from Mark's decisions that evening; revised 3 November (the defence core carries Charge, Read and Recall; HP 34) and that night (a new Hard partner, and the playtest page). **v17's game on one deck and one step a round:** the neutral step is folded into the clash, its effects now riders on clash cards. v11 to v17 stay available; v17 is unchanged in `rules-overview 17.md` and on its own playtest page.*

- ***One deck, one hand, one discard pile:*** *24 cards, at most 3 of any card, gone through once.*
- ***One step a round:*** *both players place a clash card face down and reveal together. What the neutral cards did now happens* ***On reveal*** *of the clash card that carries it.*
- ***A shared defence core*** *in every deck: Recall ×3, Charge ×2, Read ×2. Every one is a Guard with a Counter follow-up, and each brings something back: a card, meter, or a draw.*
- ***The time-out:*** *the deck never reshuffles. When a player draws their last card, the round finishes and the higher HP wins.*
- ***Specials go back to the table*** *after use, to be taken again.*

**Status: playable.** The v18 page: https://claude.ai/artifact/3gkhzd1DGfoym2R6dCFowo (`claude/app/playtest-app v18 guide.md`). It also runs in the sim (`tools/sim18.mjs`). **Open now:** Recovers are the strongest cards to spam (an always-Guard bot beats Hard 28.5%, v17 18%) and Supers almost never come out in sim (Design Flags 1–2). **The Hard partner was rebuilt on 3 November** (The Partner, below): every v18 number in this doc is against the new one.

**Decisions (Mark, 2 November, evening):**

- **A 20-minute game.** One pass of the deck (about 30 minutes) times the game out as soon as someone reaches its end.
- **24 cards, gone through once,** rather than a smaller deck with a reshuffle: the hand swap that would hide the hand at the reshuffle was rejected. Refreshing the whole hand every round wasn't ruled out, but it's a different game (cards stop being a cost).
- **At most 3 copies of any card.**
- **Fixed decks, with a shared defence core.** Bolt-on cards chosen before a match (Yomi 2's gems) are a later layer, under a name other than "gems" (Style was suggested).
- **Specials and the Super stay each fighter's own.**
- **The neutral step goes into the clash.** Its effects become riders that fire whatever the clash's outcome.

**Decisions (Mark, 3 November):**

- **Charge and Read go on the Recovers,** not on attacks: they're recovering moves, and with a fixed number in a deck that never reshuffles, they can't be spammed.
- **Every Recover keeps a Counter follow-up.** Mark's concern: with four of seven Recovers dealing no damage, Pressure would be too safe. The sim agreed that version dragged (Variants).
- **One gains meter, one draws, one brings a card back from the discard pile** (Recall).
- **HP 34** for the Benchmark (38 before): 12-round games, few time-outs, and random play held at v17's level.
- **Fix the Hard partner, then build the v18 page on it** (evening).

**Claude's calls (to confirm):**

- **Riders fire On reveal,** win or lose (winning resources would snowball), in initiative order, and **only on the clash card;** a choice (Read's, Recall's) is made after both cards are face up, the holder first.
- **The core's split:** Recall ×3, Charge ×2, Read ×2. **Read keeps its option to take from the table,** since it's the only way to buy a special or the Super.
- **Recall takes attacks only:** letting it take any card made a defensive loop (Variants).
- **Played specials go back to the table** (Mark noted the opponent can see when one is in hand, which is already true in a one-pass deck).
- **Knockdown is Lock Pressure next round,** since there's no neutral step to skip.
- **A tied time-out is a draw** (the double-KO rule).
- **The Warden at HP 32** (against the Benchmark's 34).
- **The new Hard partner:** it plays as if neither hand is visible (The Partner, below). Its weights are unchanged.
- **Fighter changes** to fit 24 cards (The Fighters below). Rush, the Wind-Up power-up, Breakfall, Parry and Brace are gone. Shakedown and Shackles become grabs. Shot and Wind-Up (the Benchmark's) and Chain Toss and Chain Spin (the Warden's) are plain attacks now that the riders sit on the core.

---

## Setup

1. Each player picks a fighter. **Toss for the initiative token.**
2. Put your **specials and Super face up on the table.** Shuffle your **deck** (24 cards).
3. Draw an **opening hand of 6.** Meter 0, piles empty.

## The Round

### 1. The clash (simultaneous)

1. **Everyone places one card face down** (you must, if you hold one). A Dizzy player's marker fills their slot.
2. **Reveal together.** A card of a Locked type is voided: it does nothing, riders included.
3. **On reveal riders,** the initiative holder's first (Riders, below). A choice is made now, the holder first, so the other player sees it.
4. **Resolve.** **Different types:** the triangle decides. **Same type:** the faster card wins; **a speed tie goes to the initiative holder.** **Two Recovers:** both clear their own pile.
5. **Follow-up or combo** (only the winner acts): a **Recover** that beat a Pressure may follow up with a Counter. A Starter that won may combo: a Linker, then an Ender.
6. **Confiscate:** owed discards are paid, the holder first.
7. **Check for KO.**

### 2. End of round

All together, as in v17:

1. **Discard the cards you used.** A special goes back to the table; a played Super is removed from the game.
2. **Draw 1.**
3. **Discard down to your hand limit** (8), the holder first.
4. **Everyone adds 1 grey to their own pile.** Last round's statuses end.
5. **Pass the initiative token.**
6. **The time-out:** if either player's deck is empty, the game ends now (The Time-Out, below).

## Riders

A rider is text on a clash card that fires **On reveal**: when the card is your clash card and isn't voided, **whether it wins or loses.** It doesn't fire when the card is played as a follow-up or in a combo.

| Rider | On reveal | Where |
|---|---|---|
| **Charge** | Gain 2 meter. | The core: 2 cards |
| **Read** | Draw a card, **or** take a special or your Super from the table, paying its meter. | The core: 2 cards |
| **Recall** | Put an attack from your discard pile into your hand. | The core: 3 cards |
| **Shakedown** | Confiscate (they discard a card of their choice after the clash, unless they hold 2 or fewer). | A fighter's own card (the Warden) |

- **A card you take or recall on reveal is yours at once:** it can be the follow-up that same round.
- **Riders are open:** like any card text, the opponent knows which of your cards carry them, and counts them as they're played. A recalled card comes from the face-up discard pile, so both players know it's back in your hand.
- **Recall doesn't move the clock:** it takes from the discard pile, not the deck. Read's draw does (one round nearer the time-out).

## The Defence Core

Every deck holds the same seven Recovers. None deals damage; each is beaten by a Convert. **Every one, if it beats a Pressure, may follow up with a Counter from your hand.**

| Card | Copies | On reveal |
|---|---|---|
| **Recall** | 3 | Put an attack from your discard pile into your hand. |
| **Charge** | 2 | Gain 2 meter. |
| **Read** | 2 | Draw a card, or take a special or your Super from the table, paying its meter. |

## Meter, Specials and the Super

- **Meter runs 0–3.** Its only source is the core's Charge (2 meter each).
- **Read buys cards from the table:** a **special costs 1** meter and goes into your hand. **When it leaves your hand** (played, discarded or Confiscated), **it goes back to the table**, to be taken again for 1. It never sits in the discard pile.
- **The Super costs 2,** goes into your hand (not counting towards the hand limit), and **is removed from the game once played.**
- **What's public:** what's on the table, and what you take and when.

## The Time-Out

- **The deck never reshuffles.** You see each card once.
- **When a player draws the last card of their deck** (at the end of a round, or with a Read), the round finishes, then **the game ends: the higher HP wins; equal HP is a draw.**
- With 24 cards and a hand of 6, that's at the end of round 18 (sooner for a player who draws with Read).

## Statuses

As v17, except **Knockdown: next round, your Pressures are Locked** (voided if played). Getting up, you can guard or go for a big reversal, but not a quick strike: the attacker has a mixup between Pressure and Convert. Lock, Staggered and Dizzy are unchanged.

## Authoring Rules (changes from v17)

- **Every card gets played.** In a one-pass deck you play about one card per card you draw, so the deck's mix is your play mix. There are no filler cards: a weak card is a weak play every time it's drawn.
- **24 cards: the defence core (7) and 17 of the fighter's own.** At most 3 copies of any card.
- **The shared riders (Charge, Read, Recall) live on the core.** A fighter's own riders (Shakedown) can sit on its attacks, on full-strength cards priced as usual (a little slower, or no combo icon).
- **Specials are threats, not surprises:** the opponent sees you take one. A special should be worth having when they know it's coming (fast, safe, awkward to play around).
- *Unchanged:* type effects are fixed; every Convert chips; Recovers never deal damage; Dizzy only on Supers; Lock on slow cards, Enders or cards with a cost; about a third of the deck as Counters.

---

## The Fighters

### The Benchmark (v18)

**HP 34. 24 cards, two specials, a Super. No passive.**

| Card | Copies | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| **Jab** | 3 | Pressure · Strike | 17 | Build 2, chip 1 | Starter, Linker | — |
| **Slash** | 2 | Pressure · Strike | 14 | Build 4, chip 1 | Linker, Counter | — |
| **Sweep** | 2 | Pressure · Strike | 13 | Build 3 | Ender | On hit: Knockdown |
| **Shot** *(new)* | 3 | Pressure · Projectile | 15 | Build 2, chip 1 | Starter | — |
| **Throw** | 2 | Convert · Grab | 7 | chip 2 | Counter | — |
| **Big Swing** | 2 | Convert · Guard Break | 3 | chip 3 | Ender, Counter | — |
| **Wind-Up** *(new)* | 3 | Convert · Guard Break | 2 | chip 3 | Ender, Counter | — |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

- **Split:** Pressure 10, Convert 7, Recover 7; 9 attacks with Counter (plus the core's follow-ups); 6 Starters.
- **Specials (on the table, 1 meter):** Rising Strike (Pressure · Strike · 19 · Build 2, chip 1 · Starter, Linker), Breaker (Convert · Guard Break · 9 · chip 3 · Ender, Counter). **Super:** Overdrive (Convert · Guard Break · 10 · chip 5 · Ender · On hit: Knockdown · 2 meter, once). All as v17.
- *Wind-Up* reuses the old power-up's name ("Load the heavy one"): it's now a slow heavy.

### The Warden (v18)

**HP 32** (34 in v17).

| Card | Copies | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| **Chain Lash** | 3 | Pressure · Strike | 15 | Build 3, chip 1 | Starter, Linker | — |
| **Ankle Hook** | 2 | Pressure · Strike | 12 | Build 3, chip 1 | Ender | On hit: Knockdown |
| **Chain Toss** *(new)* | 3 | Pressure · Projectile | 14 | Build 2, chip 1 | Starter | — |
| **Shakedown** | 2 | Convert · Grab | 8 | chip 2 | Counter | **On reveal: Confiscate** |
| **Coil** | 2 | Convert · Grab | 4 | chip 3 | Ender, Counter | On hit: Confiscate |
| **Shackles** | 2 | Convert · Grab | 6 | chip 2 | Counter | On hit: they discard down to 5 |
| **Chain Spin** *(new)* | 3 | Convert · Guard Break | 3 | chip 3 | Ender, Counter | — |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

- **Split:** Pressure 8, Convert 9, Recover 7; 9 attacks with Counter; 6 Starters.
- **Left out to fit 24:** Haul In and Slam. **Changed:** Shakedown (was a neutral card, Confiscate before the clash) is a grab that Confiscates on reveal; Shackles (was a card in play capping their hand at 5) is a grab that cuts their hand to 5 on hit.
- **Specials and Super** as v17: Iron Haul, Chain Whip; Chain Prison (2 meter, once).

---

## Sim Check (3 November, night: the new partner, 500 games a row, Hard against Hard)

*The partner looks one round ahead, doesn't know about the time-out, and undervalues the Super: read Super numbers as a floor. "Starved": going into the clash holding 2 cards or fewer. The v17 columns are v17 against its own (old) partner.*

| | v17 mirror | **v18 mirror** | v17 Warden v Benchmark | **v18 Warden v Benchmark** |
|---|---|---|---|---|
| HP | 38 | **34** | 34 v 38 | **32 v 34** |
| Win (side 0) | 50% | 50%, 53% (two seeds) | 47% | 56%, 49%, 51% (three seeds: 52% overall) |
| Median game (10–90%) | 12 (9–15) | **12 (9–15)** | 13 (9–16) | 12–13 (9–16) |
| Time-outs | — | **1%**, 2% | — | 2%, 2%, 3% |
| Loser's deck at the KO: 2 cards or fewer | **36%** | **3%**, 4% | 34% | 7%, 6%, 8% |
| Combos | 28% of rounds, 7.9 HP | 27%, 7.8 HP | 26%, 6.4 HP | 24%, 6.9 HP |
| Blocked Pressures followed up | 93% | 95–97% | 84% | 95–96% |
| Hand at the clash (starved) | 5.9 (1%) | 5.8 (2%) | Benchmark 3.7 (24%) | Benchmark 4.1 (15–18%) |
| Recovers, of all clash cards | 36% | 38% | — | Warden 38% |
| Supers played, a game (each) | 0.36 | **0.01–0.02** | Warden 0.05, Benchmark 0.61 | Warden 0.04–0.05, Benchmark 0.03 |
| Specials played, a game (each) | 1.7 | 0.7–0.8 | 1.9, 1.7 | 0.6–0.7, 0.5–0.65 |
| Meter gained (lost at the cap), a game | — | 2.5 (0.1) | — | 2.6 (0.2) |
| Read, a game: drew · took a special · took the Super | — | 0.4 · 0.85 · 0.01 | — | Warden 0.45 · 0.8 · 0.06 |
| Recalls, a game | — | 1.75 | — | 1.8 |

- **The time-out does its job for hidden hands:** in v17 a third of games were decided with the loser's deck at 2 cards or fewer (their hand all but known); in v18 about one in twenty-five. No game reshuffles.
- **The things flagged on 2 November are fixed:** time-outs 17% → 1–2%; hands back to v17's size; blocked Pressures punished again; and with Read off the Starters, no more taking the Super mid-combo.
- **The new partner barely moves the balance numbers** (both sides share it): the mirror and the Warden are where they were with the old one.

**Bots against Hard (Benchmark mirror, 1,000 games, ±3):** random 27%, 27% (two seeds; v17 25%); Pressure every round 23% (v17 17%); **Guard every round 28.5%** (v17 18%). *From 300 games each (±5):* any attack 16%, Convert 17%. The random bot's rider choices are random too, as in v17.

**The levels (1,000 games, ±3):** Medium beats Hard 41%, Easy 35%.

## The Partner (3 November, night)

**The old Hard wasn't the strongest setting.** Mark asked why Medium beat Hard. Over 1,000 games it didn't (52% and 46% on two seeds; 49% in v17, where the earlier 43% came from 200 games), but a sharper version of Medium did: a bot that plays the best reply to the mix it expects beat Hard 54–56%, in v17 too (54%).

**Why:** Hard dealt you six possible hands and solved the clash for each separately, as if you could see its own hand, then averaged the six answers. That made it too cautious: it guarded against threats you couldn't actually aim at it. Against the first fix (one solve, but still as if you could see its hand), the sharp bot won 53% of games while winning slightly *fewer* clashes (43% to 43.5%): its edge was taking the bigger wins, not reading Hard better. That pointed at the hidden hand.

**The fix:** one solve over all the guessed hands, on both sides. Hard still deals you six hands; it now also deals itself three more, as you might guess its hand, and picks the mix for its real hand that does best across every pairing, with you replying for each hand you might hold, knowing its mix but not its cards. Cards each side knows about stay in the dealt hands: specials taken from the table, and cards recalled from the face-up discard pile. Medium and Easy soften the same answer.

| Test (Benchmark mirror, sides swapped halfway) | Games | Result |
|---|---|---|
| One solve over your hands only, against the old Hard | 2,000 | 52% |
| The sharp reply against it | 2,000 | 54% (still beaten) |
| **One solve over both hands (the new Hard), against the old Hard** | 1,200 | **55%** |
| The sharp reply against the new Hard | 1,200 | **49%** (no longer wins) |
| A sharp reply built on the new solve, against the new Hard | 1,000 | 51% |
| The new Hard against one solve over your hands only | 1,200 | 53.5% |
| Medium, Easy against the new Hard | 1,000 each | 41%, 35% |
| 12 guessed hands instead of 6 (your hands only) | 1,000 | 51% |

**The weights stay as they were.** The partner's win estimates are overconfident (in v18 Hard-against-Hard games, positions it rates 92% are won 79% of the time; 8% → 23%), and a fit to game results values a card in hand at about 1.3 HP (it uses 0.5). But playing with the fitted values gains nothing: a flatter win curve (k 0.11) 50%, cards at 1.3 HP 49%, both 49–50%, meter at 0 49% (1,000–2,000 games each, against the same partner with the old weights). The fit reads correlation, not cause, so it only shows the estimates are off as predictions, not that the partner chooses badly.

*v16 and v17 keep the old partner* (the switches are `pooled` and `mySamples` in `data/v18/settings.json`), so their pages and numbers are unchanged. v18 numbers from before this change were against the old partner: the Variants below say so.

### Variants

**3 November: the defence core** (old partner; Benchmark mirror, 500 games; the bots 300 games, ±5):

| Core | Pressure bot | Guard bot | Median (time-outs) at HP 38 | At HP 34 |
|---|---|---|---|---|
| 2 Nov: Guard 3, Parry 2, Brace 2; Charge and Read on Wind-Up and Shot | 32% | 27% | 14 (17%) | 12 (6%) |
| Guard 3; Charge 2 and Read 2 with no follow-up | 33% | 31% | **16 (33%)** | 14 (15%) |
| The same, the blocked Pressure's Build bounced back | 31% | 31% | 15 (26%) | 14 (13%) |
| All Counter: Recall ×3 (any card), Charge ×2, Read ×2 | 23% | 30% | 15 (16%) | 13 (4%) |
| **All Counter, Recall attacks only (adopted)** | 27% | 32% | 14 (8%) | **12 (3%)** |

- **No follow-up on four of seven Recovers dragged the game:** a third of games timed out at HP 38, and Pressure took a bigger share of plays (36%).
- **Recall on any card made a defensive loop:** a third of recalls brought back a Charge, a Read or another Recall, Recovers rose to 41% of plays, and games ran longer. Attacks only fixed both.
- **Random play and the time-out:** the random bot wins about 44% of the games that time out, against about 25% of the rest (a narrow HP lead at the end is close to a coin flip). HP 34 cuts time-outs, which held random play at 26–28% (29% at HP 38).
- **The Warden against the HP 34 Benchmark** (old partner): 41% at HP 30, 49% at 32, 57% at 34. With the new partner, 52% at 32 (three seeds).
- **Meter cap 4:** lost meter 0.2 → 0.0 a game; nothing else measurable. No longer needed.

**2 November: the first drafts** (old partner; Benchmark mirror at HP 38, 500 games): riders on weak attacks (Shot Build 1, chip 0, no icons; Wind-Up chip 1) ran a median of **17 rounds with 62% time-outs**. A quarter of all plays were the weak rider cards. That's where the rule *every card gets played* came from. With full-strength riders but no combo icons, the median was 16 with 42% time-outs. Brace Staggering instead of reflecting, and specials not returning to the table, made no measurable difference. The 2 November decks are kept as `benchmark-2nov.json` and `warden-2nov.json`.

## Design Flags

1. **Recovers are the cards to spam:** an always-Guard bot beats Hard 28.5% (v17 18%, against v17's partner; 32% against the old v18 partner, so most of it is the cards). Every Recover now gives a resource and still punishes, and the partner doesn't adapt to habits; a person will Convert into it. A one-pass deck caps it at seven Recovers. Levers: six Recovers; a Convert that punishes guarding (a status, or a bigger cash); or one core card without the follow-up.
2. **Supers almost never come out** (0.01–0.02 a game for the Benchmark, against 0.36 in v17). Read is the only way to the table, with two Reads in the deck, and a special is always waiting there, so the partner spends every Read on a special or a draw. Partly the partner (it undervalues the Super), but the route is narrow. Levers: a third Read (Recall ×2); let Charge take the Super instead of gaining meter; or the Super costs 1 more and is taken with Charge.
3. **Specials come out less** (0.6–0.8 a game against 1.7): the same Read bottleneck as Flag 2.
4. **Counter-only Supers:** Chain Prison was played 0.04–0.05 times a game. Give it Ender, as v17 Flag 2 suggested.
5. **In principle the time-out favours the fighter with more HP:** it compares HP left, so a lower-HP fighter must get further ahead. It hasn't shown in the sim (time-outs are rare now), but it grows with HP gaps. The alternative is to compare HP lost.
6. **The Warden squeezes less:** the Benchmark is starved at 15–18% of his clashes (v17 24%).
7. **The partner doesn't know about the time-out,** so it never plays to run the clock out or catch up before it. Humans will. It also ignores what Recall could bring back from the discard pile.

*Resolved since 2 November:* time-outs (17% → 1–2%), Read on a Starter taking the Super mid-combo, smaller hands, follow-ups lost to Brace, Parry being no better than a Guard (both gone), meter lost at the cap (0.1–0.2 a game). *3 November, night:* the Hard partner (The Partner, above): it now beats the old one 55%, the sharp reply no longer beats it, and Medium and Easy sit below it (41%, 35%).

## Open Questions

1. **Do riders read well at the table,** or should Charge, Read and Recall be icons, like the combo icons?
2. **Specials back to the table, or one use each?** The sim can't tell them apart.
3. **The Super's route to the hand** (Flag 2).
4. **Knockdown as Lock Pressure:** keep the name for the flavour, or fold it into Lock?
5. **The time-out tie-break** (a draw) and what it compares (HP left or HP lost).
6. **The 3-card slot for styles,** and when to add them.
7. *From v17:* who starts with the initiative, and its measured value; combo length and breakers.

## Running It

- **Page:** https://claude.ai/artifact/3gkhzd1DGfoym2R6dCFowo, built with `node tools/build-artifact.mjs --edition v18`; see `docs/playtest-app-v18-guide.md`.
- **Code:** GitHub `Youngy34/card-game`, branch `v18`, off `v17` at 2669910. Engine: `src/engine/v16/engine.js` with rule switches `merged`, `specialsReturn`, `timeout` and `knockdownLocks`; v16 and v17 play unchanged with them off.
- **Fighters and settings:** `data/v18/` (`benchmark.json`, `warden.json`, `settings.json`); the drafts and today's test cores in `data/v18/variants/`.
- **The partner:** `pooled: 1` (one solve over all the dealt hands, `bayesMaximin` in `src/engine/lp.js`) and `mySamples: 4` (its own hand hidden too: its real hand and 3 dealt ones, `bayesGame`), in `settings.json`'s `ai`. `hiddenSplit` (engine) keeps known cards (specials in hand, recalled cards, tracked in `X.known`) in every dealt hand. `playGame18` takes `Ws: [W0, W1]` to pit two partners against each other.
- **Card fields:** `reveal` (`{ "meter": 2 }`, `{ "read": true }`, `{ "recall": "attack" }` or `true` for any card, `{ "confiscate": 1 }`), `noFollow: true`, `parry: true`, `brace: "reflect" | "stagger"`, `core: true`; a v18 fighter file has `"rules": 18`.
- **Sim:** `node tools/sim18.mjs game benchmark warden -n 500` (v18), `node tools/sim18.mjs v17 benchmark warden` (the same report for v17), `exploit benchmark`, with `--levels random,hard`, `--set meterMax=4`, `--hp 34,34`.
- **Checks:** `node tools/test18.mjs` (64 pass); `test17` (36), `test16` (96) and `test16-warden` (28) still pass. Browser: `node tools/smoke/browser18.cjs dist/yomi-playtest-v18.html <vendor dir>` (all pass, about 300 checks a run).

## Kept From v17

The triangle, speed and its bands, grey each round, combos and Starter/Linker/Ender, the Counter follow-up, statuses (Knockdown redefined), the initiative token (ties and order), specials and the Super on the table (1 and 2 meter), the single-use Super, the hand limit of 8, an opening hand of 6, Confiscate and its floor of 2.

## Removed

**Compared with v17:** the neutral deck, neutral hand and neutral step; Charge and Read as neutral cards (now the core's Recovers); Rush, the Wind-Up power-up, Breakfall and Parry; Shackles in play and Shakedown before the clash; Charge's fetch from the discard pile; reshuffling; Knockdown skipping the neutral step; the 20-card clash deck; more than 3 copies of a card; Haul In and Slam (the Warden); HP 38 (the Benchmark).

**Within v18 (3 November):** the 2 November core (Guard, Parry, Brace) and the riders on Shot, Wind-Up, Chain Toss and Chain Spin.
