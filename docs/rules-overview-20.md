# Rules Overview — v20 (heat)

*Drafted 9 November 2026 from Mark's decisions that afternoon. This is v19's tested rules, adopted, plus **heat**: the tokens are your fighter powering up, not a burden on the defender. v18 and the v19 test page stay playable on their own pages.*

- ***v19, adopted:*** *Counters only on Pressures; each fighter's own cap with overflow; a Break (Convert) cashes only as the clash card; two combo lines.*
- ***Heat:*** *the tokens your winning Pressures build are yours. They stop at your own cap; past it, every point you gain lands as straight damage. A Break that beats a Guard spends all of it. A Guard that beats your Pressure douses it.*
- ***No meter:*** *specials cost 3 heat and the Super your whole cap, bought at the end of a round. Read just draws; Charge leaves the core.*
- ***New names:*** *Pressure, Break, Guard.*

**Status: playable.** The v20 page: https://claude.ai/artifact/9U6NPwg6kUEtYrceFVfqTN (`claude/app/playtest-app v20 guide.md`). Code: GitHub `Youngy34/card-game`, branch `v20-heat`. The numbers here are a first balance pass, against the sparring partner.

**Decisions (Mark, 9 November):**

- **v19 adopted.** Mark played the v19 test page and all four questions felt good: blocking on a small pile, Pressure combos, the Convert lines as a reward for a read, and full piles bleeding 1 a round.
- **Tokens stay a consequence of losing a read.** Tokens only from blocking (a guard meter) was weighed and dropped: being punished for a correct read feels worse than the opposite.
- **The theme: tokens are your fighter powering up (heat).** Composure, balance, poise and armour were weighed; heat won once it could absorb the meter.
- **Your own cap.** When you hit your max you're powered up, and every attack lands in full: heat past your cap is straight damage.
- **Meter folds into heat.** Specials and the Super are bought with heat, so there's one track to build and a real choice between cashing it and spending it.
- **Types renamed Pressure, Break, Guard.**
- **The core is six: Recall ×3 and Read ×3** (Charge gone), and each deck gains one of its own cards to stay at 26.
- **Buying happens at the end of the round, the initiative holder first.** Read just draws.
- **Prices: a special 3 heat; the Super your whole cap** (so only at max heat).

**Claude's calls (to confirm):**

- **One card a round** from the table, per player.
- **The shop comes after the round's heat and before discarding down,** so a special you buy counts towards the hand limit (the Super doesn't, as in v18).
- **A KO at the end of the round closes the shop.**
- **Two Guards douse each other's heat** (as two Recovers cleared both piles).
- **Kinds renamed to fit:** Heavy (was Guard Break) and Grab are Breaks; the core's kind is Block.
- **Each deck's extra card,** HP and caps retuned, and Vex's Hundred Fang knocks down instead of Dizzy (The Fighters, below).
- **The partner shops** by scoring each option (nothing included) by the next round's clash, against the same dealt hands.

---

## Setup

1. Each player picks a fighter. **Toss for the initiative token.**
2. Put your **specials and Super face up on the table.** Shuffle your **deck** (26 cards).
3. Draw an **opening hand of 6.** Heat 0.

## The Round

### 1. The clash (simultaneous)

1. **Everyone places one card face down** (you must, if you hold one). A Dizzy player's slot stays empty.
2. **Reveal together.** A card of a Locked type is voided: it does nothing, riders included.
3. **On reveal riders,** the initiative holder's first: Read draws a card; Recall puts an attack from your discard pile into your hand (chosen now, the holder first).
4. **Resolve.** **Different types:** **Pressure beats Break, Break beats Guard, Guard beats Pressure.** **Same type:** the faster card wins; a knocked-down player loses every speed clash; **a tie goes to the initiative holder.** **Two Guards:** each douses the other's heat.
5. **Follow-up or combo** (only the winner acts). A **Guard** that beat a Pressure may follow up with a Counter (every Counter is a Pressure), unless that Pressure was **Safe**. A **Starter** that won may combo: a Linker, then an Ender, **of the Starter's type only**; an Ender can come straight after the Starter, and always ends the combo. Grabs stay out of combos, except the Warden's line.
6. **Confiscate:** owed discards are paid, the holder first.
7. **Check for KO.**

### 2. End of round

1. **Discard the cards you used.** A special goes back to the table; a played Super is removed from the game.
2. **Draw 1.**
3. **Everyone gains 1 heat.** At your cap, it lands on your opponent as 1 damage instead.
4. **The shop,** the holder first (below).
5. **Discard down to your hand limit** (8), the holder first.
6. Last round's statuses end. **Pass the initiative token.**
7. **The time-out:** if either player's deck is empty, the game ends now.

## Heat

- **Your heat is yours:** it sits on your side, counted against your own cap, printed on your fighter.
- **You gain it** when your Pressure wins: its Build, as the clash card, a follow-up, a Linker or an Ender. And 1 at the end of every round.
- **Your cap:** your heat can't go above it. **Heat you'd gain past your cap lands on your opponent as straight damage, at once.** At max, every Pressure that lands is full damage, and the round's heat burns them for 1.
- **You spend it** when your **Break wins the clash:** all your heat as damage, plus its chip. A Break played as a follow-up, Linker or Ender just deals its chip.
- **You lose it** when **their Guard beats your Pressure:** they douse all your heat (and may follow up). Two Guards douse each other's.
- **Or you spend it at the shop** (below). Heat spent there is heat a Break can't cash.

*In the engine, your heat is stored as the pile on your opponent, so the clash resolves exactly as v19 did; only whose cap applies, and the shop, are new (`heat` in `data/v20/settings.json`).*

## The Shop (end of round)

- **The initiative holder first, then the other player,** each may buy **one card** from their own table:
  - **a special for 3 heat:** it goes into your hand. When it leaves your hand (played, discarded or Confiscated) it goes back to the table, to be bought again;
  - **the Super, for your whole cap,** so only at max heat: it goes beside your hand (not counting towards the hand limit) and is removed from the game once played.
- **Purchases are public:** the second player sees the first's.
- **Read no longer takes from the table.** There's no meter and no Charge.

## Riders

| Rider | On reveal | Where |
|---|---|---|
| **Read** | Draw a card. | The core: 3 cards |
| **Recall** | Put an attack from your discard pile into your hand. | The core: 3 cards |
| **Shakedown** | Confiscate. | The Warden's own grab |

A rider fires when its card is your clash card and isn't voided, **win or lose.** A recalled card is yours at once (it can be this round's follow-up), and the opponent knows it's in your hand.

## The Defence Core

Every deck holds the same six Guards: **Recall ×3, Read ×3.** None deals damage; each is beaten by a Break; each, if it beats a Pressure, douses the attacker's heat and may follow up with a Counter.

## Statuses

- **Knockdown:** next round, you lose every speed clash (ties included; both down, compare as usual).
- **Staggered:** −3 speed next round.
- **Dizzy:** you play nothing next round (Supers only).
- **Lock:** only as a very strong effect with a real tradeoff.
- **Bleed** (a future fighter): needs rewording for heat (Design Flags).
- Statuses, installs and traps are marked by the card that caused them, left beside the affected player until the effect ends.

## The Time-Out

The deck never reshuffles. When a player draws their last card, the round finishes and **the higher HP wins;** equal HP is a draw. With 26 cards and a hand of 6, that's the end of round 20 (sooner for a player who draws with Read).

## Authoring Rules (changes from v18 and v19)

- **26 cards: the core (6) and 20 of the fighter's own.** At most 3 copies of any card.
- **Counters are Pressures.** Breaks don't carry Counter.
- **Combo lines:** a Linker or Ender continues only the line of its Starter's type. Long-range moves aren't Starters; grabs aren't in combos (the Warden excepted).
- **Throws should usually knock down.**
- **A cap is offence now** (Design Flag 1): price it with HP.
- *Unchanged:* type effects are fixed; every Break chips; Guards never deal damage; Dizzy only on Supers; specials are threats, not surprises.

---

## The Fighters (v20, first pass)

| Fighter | HP (v19) | Cap (v19) | Extra card (to reach 26) | Other |
|---|---|---|---|---|
| **Benchmark** | 26 (32) | 9 (9) | Wind-Up ×3 (the Break line had 3 Starters to 2 Enders) | — |
| **The Warden** | 27 (31) | 8 (9) | Haul In ×2 (his grab line had one Starter) | — |
| **Vex** | 22 (32) | 8 (7) | Crossing Slash ×3 | **Hundred Fang knocks down** (was Dizzy) |
| **Bastion** | 26 (36) | 8 (6) | Sonic Cutter ×3 (a Safe Counter, for a counter-puncher) | — |
| **Atlas** | 32 (34) | 10 (12) | Shoulder Check ×3 (the Break line had 2 Starters to 3 Enders) | — |

Specials (3 heat each) and Supers (the fighter's cap) as on v19's cards. Card lists: `data/v20/`, and the Decks tab on the page.

**Why the HP fell so far:** under v19, a cap was defence (how much grey you could soak). Under heat it's offence: a low cap reaches max sooner, after which every Pressure and the round's heat land as damage, and it makes the Super cheaper. With v19's values, Vex (cap 7) and Bastion (cap 6) won about 67% and Atlas (cap 12) 31%. The shop also takes heat that would have been cashed, so games ran longer (time-outs 24%). Lower HP all round, caps pulled towards 8–10, and Hundred Fang's Dizzy (worth about 11 points of Vex's win rate at 8 heat) fixed both.

## Sim Check (9 November, the sparring partner on Hard against itself)

**Every matchup** (two seeds, 400 games a matchup; row's win rate):

| | Benchmark | Warden | Vex | Bastion | Atlas | **Average** |
|---|---|---|---|---|---|---|
| **Benchmark** | | 49% | 53% | 47% | 47% | **49%** |
| **The Warden** | 51% | | 49% | 45% | 54% | **50%** |
| **Vex** | 47% | 52% | | 54% | 53% | **51%** |
| **Bastion** | 53% | 55% | 46% | | 49% | **51%** |
| **Atlas** | 53% | 46% | 47% | 51% | | **49%** |

- **Every fighter 49–51%, every matchup 45–55%.**
- **Time-outs 7%** overall (3–8% a matchup, except **Atlas–Warden 14%**). Median game 11–13 rounds.
- **The shop:** each fighter buys about 2–2.5 specials a game, and plays specials about 1.3 times a game (v18: 0.6–0.8). **Supers are bought 0.06–0.18 times a game per fighter** (Vex most, the Benchmark least) **and played 0.01–0.15** (v18: 0.01–0.02 played): most that are bought sit in hand. Only Vex's Hundred Fang comes out often.
- **Heat past the cap** deals about 3 HP a game at the end of rounds, and ends about 1 game in 10.

**The Benchmark mirror** (300 games): 52%, median 11, time-outs 6%. Games end: Break cash 46%, chip 15%, combo 12%, the round's heat at max 10%, a combo ending in a Break 7%. Combos 39% of rounds; a Guard beats a Pressure in 23% of rounds and follows up 45% of the time.

**Mindless bots against Hard** (Benchmark mirror, 300 games, ±5): **Pressure every round 6.5%** (v19 24%), **Guard every round 15%** (v19 29%), random 22% (v19 32%). Easy 27%, Medium 45%. The bots shop greedily (the first special they can pay for), which spends heat they'd otherwise cash, so read the Pressure bot's number as partly the shopping.

**Tested and not adopted:**

| Variant (Benchmark mirror unless named) | Result |
|---|---|
| No shop (specials unaffordable) | Time-outs 7% against 12% with it: the shop is a heat sink |
| Specials 4 or 5 heat | Fewer bought (3.9, 3.4 a game), time-outs no better |
| **2 heat each round** (on the first-pass decks) | **Time-outs 0–2%** even in Atlas–Warden, but games shorter (median 9–11) and heat at max ends 14–17% of games |
| The Benchmark's cap 5, 7, 9, 11, 13 against cap 9 | 62%, 55%, 44%, 43%, 46% (150 games, ±8): below 9 each point is worth a few points of win rate; above 9, nearly nothing |

## Design Flags

1. **A cap is offence now, and HP pays for it.** Vex and Bastion are 10 HP lower than on v19; Bastion no longer has more HP than the Benchmark (Mark: higher HP suits him). Above 9 a cap buys almost nothing, so a high cap can't be traded for HP. To give Bastion his HP back, his deck has to deal less damage, or a high cap needs a payoff of its own.
2. **Supers are still rare, except Vex's.** Buying one empties a full bar, worth a whole cash, and the partner undervalues the Super; once bought, most sit in hand unplayed. Levers: the Super needs max heat but costs less (say half your cap), or it spends your heat when played rather than when bought.
3. **Atlas–Warden times out 14%** (two slow fighters). 2 heat a round fixes it but shortens every game.
4. **The shop drains damage:** heat bought into specials isn't cashed. That's the intended tradeoff, but it's why HP had to fall.
5. **Bigger hands:** about 6.8 cards at the clash (v18: 5.8), since bought specials join the hand. Hand size is the dial for hidden information; watch whether reads feel thinner.
6. **Guard spam looks solved in the sim** (15%), but the partner still doesn't learn habits. Check at the table.
7. **The partner's shopping** looks one round ahead: it doesn't save up for the Super, and it still doesn't know about the time-out.
8. **Bleed** ("extra grey each round until a Recover clears your pile") reads oddly under heat: your wound feeding their heat. It needs rewording before that fighter is built.

## Open Questions

1. **Does owning heat feel better than grey at the table?** That was the reason for the flip.
2. **One card a round from the shop,** or as many as you can pay for?
3. **Specials back to the table after each use** (3 heat a use), or bought once for the game?
4. **The Super's price** (Flag 2).
5. **Fighter identity under heat:** caps as offence; Bastion's HP (Flag 1).
6. **The time-out tie-break** compares HP left; comparing HP lost is still the alternative.
7. **The physical heat track:** a track on the fighter card as long as their cap, filled with hot tokens.

## Running It

- **Page:** https://claude.ai/artifact/9U6NPwg6kUEtYrceFVfqTN, built with `node tools/build-artifact.mjs --edition v20`.
- **Code:** branch `v20-heat`. Engine switches `heat` and `specialCost` (in `src/engine/v16/engine.js`: `buyOptions20`, `buy20`, `applyBuy20`, `heatOf`, `ownCap`); the partner's `chooseBuy20` and the bots' `botBuy20` in `ai.js`. The page's words (Pressure, Break, Guard; prices in heat) come from `useHeatWords` in `cards.js`, switched on when the page's settings have `heat`.
- **Fighters and settings:** `data/v20/`.
- **Sim:** `node tools/sim18.mjs --edition v20 game benchmark warden -n 300` (any fighter by name or path; `--set specialCost=4`, `--set greyPerRound=2`, `--hp a,b`).
- **Checks:** `node tools/test20.mjs` (65 pass); `test18` (66), `test18-roster` (114), `test17` (36), `test16` (96), `test16-warden` (28) still pass. Browser: `node tools/smoke/browser20.cjs dist/yomi-playtest-v20.html <vendor dir>` (92 checks: games against the partner and hot seat, the shop, the words, a phone screen).
