# Character Drafts: v18, Vex, Bastion and Atlas

*8 November 2026, against `rules-overview 18.md` and the 4–7 November decisions (Knockdown: you lose every speed clash next round; Staggered: −3 speed; Safe; 26-card decks). Mark's brief: a rushdown (Vex), a counter-heavy fighter (Bastion), and a big, slow, damaging one (Atlas). Built from the 7 November roster sketch. All names are placeholders.*

***Status, 8 November (afternoon): added as written.*** *Mark: "Let's add them as written." All three are in the engine, the sim and a new playtest page, **https://claude.ai/artifact/SpKQuR7XBsYizp67ijACHA** ("Yomi Playtest v18 (8 Nov)"), from GitHub branch **`v18-roster`**. Simmed below: Atlas sits in the band, Vex just under it, and **Bastion well under it (about 30%)**. Nothing has been changed from the pitch; the fixes tested are in Where They Stand.*

## Where They Stand (8 November sim)

*Hard against Hard. 600 games a row (±4) unless marked; 300 games is ±5.5.*

| | vs Benchmark | vs Warden (300) | Mirror (300): median, time-outs |
|---|---|---|---|
| **Vex** (HP 30) | **43.0%** | 52.7% | 12 rounds, 1.7% |
| **Bastion** (HP 32) | **31.5%** (25.7% on a second seed, 300) | 34.8% | **17 rounds, 22%** |
| **Atlas** (HP 38) | **47.3%** | 44.0% | 12 rounds, 1.0% |

**The three against each other (600 games each):** Atlas beats Vex 54.6%; Atlas beats Bastion 62.3%; Vex beats Bastion 56.5%. Time-outs 5–7%, medians 13–14 rounds. The pitch predicted a triangle (Vex over Atlas over Bastion over Vex); the sim has a ladder instead, with Bastion at the bottom.

**Mindless bots against Hard, in each fighter's mirror (300 games, ±5):**

| | Pressure bot | Guard bot | Random |
|---|---|---|---|
| Vex | 25.7% | — | 25.0% |
| Bastion | — | **34.5%** | **35.2%** |
| Atlas | — | **34.2%** | 30.3% |
| *Benchmark (3 Nov, 1,000 games)* | *23%* | *28.5%* | *27%* |

### Vex: the HP costs her the points

- **She out-damages the Benchmark** (26.0 a game against 25.2) **but has 4 HP less.** At **HP 32** she wins **47%** (51.5% and 43.3% on two seeds, 300 each). That's the first fix to try.
- **She combos most often, for the least:** 2.3 combos a game at 5.5 HP each (the Benchmark: 1.3 at 9.4). Twin fires **0.4 times a game**.
- **Twin's cost shows:** she reaches the clash holding 2 cards or fewer 5% of the time (the Benchmark: about 1%).
- **Pressure spam isn't a problem:** the Pressure bot gets 26%.
- *Card use (her clash cards):* Quick Fang 19%, Recall 14%, Undercut 13%, Fang Rush 13%, Pommel Strike 12%, Read 10%, Charge 10%, Cross-Up 4%. Twin Fang, Heel Drop and Crossing Slash are mostly played inside combos and follow-ups (1.5–2% each as the clash card). Hundred Fang was never played.

### Bastion: his Guards make him readable

**Why he loses.** In a deck you go through once, the deck is the play mix. With 9 Recovers he guards in 46% of his clashes, so Converting into him is the obvious read: the Benchmark breaks his Guard **2.5 times a game** (1.4 in its own mirror). His Pressures should punish those Converts, but there are only 9 of them and they're slower than the Benchmark's, so its Pressures beat them too (1.15 Pressure clashes a game won on speed). He deals 23.4 a game and takes 30.5.

**What isn't the cause** (300 games each against the Benchmark):

| Change | Bastion wins |
|---|---|
| As written | 31.5% (600) |
| Against the 3 November Benchmark (no Safe cards) | 34.3% |
| Repulse with a Charge rider as well | 34.7% |
| Repulse knocks down instead of Staggering | 32.2% |
| Lockdown: On hit, Knockdown | 33.5% |
| Shield Bash also a Linker; Rim Shot Build 4, chip 1 | 35.8% |
| Both of those | 35.3% |
| Pressures at the Benchmark's speeds (Edge Jab 17, Shield Bash 15, Rim Shot 14) | 30.2% |
| HP 36 | 38.3% |
| Repulse ×2 out, a third Rim Shot and Sonic Cutter in (7 Recovers) | 24.5% |
| **Speeds, both attack changes, Lockdown's Knockdown and HP 34, together** | **47.2%, 46.3% (two seeds)** |

- **Safe isn't it.** The Benchmark's Pressures into him are mostly Safe (Jab and Shot, 58% of them), and only 39% of blocked Pressures in the matchup get a follow-up. But against a Benchmark with no Safe cards he still wins only 34%.
- **Repulse isn't mispriced.** Giving it a rider too barely moves him.
- **No one change fixes it; all of them together do.** Each of his attacks is a little weaker than the Benchmark's nearest card (slower, no Knockdown on his grab, Rim Shot smaller than Slash, only 2 Linkers to its 7), and it adds up. With them all brought level and HP 34, he's **the Benchmark plus two Repulses and more Counters**, at 47%. That works, but his identity is then thin.
- **His mirror drags:** median 17 rounds, **22% time-outs**, and the random and Guard bots win 35% because a quarter or more of their games run to the clock. Nine cards that never deal damage make long games.
- *Card use:* Recall 14%, Shield Bash 12%, Charge, Read, Shoulder Ram, Edge Jab 9–10% each, Repulse 8%, Lockdown, Sonic Cutter, Shield Slam 7% each, Aegis 3%, Rim Shot 2%, Shield Rush 1%, Final Bastion 0.4%.

### Atlas: in the band

- **47% against the Benchmark, 44% against the Warden** (300 games). He deals less (27.5 a game against 31.3) and lives on HP 38, as pitched.
- **He wins few speed clashes, as planned** (0.36 Pressure clashes a game won on speed, against the Benchmark's 1.41). His games see **3.1 Knockdowns a game** (both players together; 2.4 in Vex's games against the Benchmark).
- **Combos are rare and big:** 0.8 a game at 12.2 HP each.
- **The Guard bot does well in his mirror (34%).** Guarding pays when both sides' follow-ups are this big (rules Flag 1). Watch it at the table.
- *Card use:* Haft Strike 17%, Recall 15%, Earthsplitter 13%, Charge, Read 10% each, Ground Smash 8%, Hammer Spin 8%, Shoulder Check 7%, Overhead 5%, Lariat 3%, Hammer Sweep 3%.

### A rules bug the drafts found (fixed)

**Confiscate's floor was checked at the wrong moment.** Shakedown's Confiscate fires On reveal, and the floor ("unless they hold 2 or fewer") was checked then. If the player who owed the discard then won and comboed, they could discard below the floor, or owe more cards than they held (Twin's four-card combos crashed the sim). The rules say the check comes after the clash, so it does now. This affects every fighter against the Warden, not just Vex.

---

## The Shape

- **26 cards each, like the Benchmark:** the defence core (7) and 19 of their own. The time-out falls at the end of round 20.
- **Two specials (1 meter) and a Super (2 meter, once)** on the table, as usual.
- **Each fighter is the Benchmark bent one way.** Speed, type split and the size of their hits do most of the work. Riders are few and character-specific, and each card carries one effect.
- **New card text (now in the engine):** Twin (Vex), a Convert Starter (Vex's Cross-Up), Recovers that apply a status if they beat a Pressure (Bastion), and specials that are Recovers (Aegis).

## Speeds Across the Roster

| Fighter | HP | Pressures | Converts | Specials · Super |
|---|---|---|---|---|
| **Vex** | 30 | 19, 17, 16, 15, 14 | 6, 3 | Flying Fang 18, Cross-Up 9 · Hundred Fang 20 |
| Benchmark | 34 | 17, 15, 14, 13, 12 | 7, 3, 1 | Rising Strike 19, Breaker 9 · Overdrive 10 |
| Warden | 32 | 15, 14, 12 | 8, 6, 4, 3 | as v17 |
| **Bastion** | 32 | 16, 14, 13, 12 | 7, 4, 1 | Shield Rush 18, Aegis (a Guard) · Final Bastion (a Guard) |
| **Atlas** | 38 | 13, 12, 11, 11 | 5, 2, 1 | Lariat 17, Upheaval 9 · Avalanche 5 |

---

## Vex: Twin Fang (*Rushdown*)

**String, string, guard break.** The fastest Pressures in the game, the most Starters and Linkers, and the lowest HP. Their Pressure rarely beats hers, so what stops her is a Guard, and her Guard Breaks are waiting for that. *Like Chipp or Cammy.*

**HP 30. Pressure 13, Convert 6, Recover 7.**

| Card | × | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| Quick Fang | 3 | Pressure · Strike | 19 | Build 1, chip 1 | Safe, Starter, Linker | — |
| Fang Rush | 3 | Pressure · Strike | 17 | Build 2, chip 1 | Starter, Linker | — |
| Twin Fang | 3 | Pressure · Strike | 16 | Build 3, chip 1 | Linker | **Twin:** in a combo, a second Twin Fang can follow this one. |
| Crossing Slash | 2 | Pressure · Strike | 15 | Build 3, chip 1 | Linker, Counter | — |
| Heel Drop | 2 | Pressure · Strike | 14 | Build 3 | Ender | On hit: Knockdown |
| Undercut | 3 | Convert · Guard Break | 6 | chip 2 | Counter | — |
| Pommel Strike | 3 | Convert · Guard Break | 3 | chip 3 | Ender, Counter | — |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

- **6 Starters and 11 Linkers** (the Benchmark has 5 and 7); 8 Counters (31%); 3 Safe.
- **Specials:** **Cross-Up** (Convert · Guard Break · 9 · chip 2 · **Starter**): a guard break that opens a combo. **Flying Fang** (Pressure · Projectile · 18 · Build 2, chip 2 · Safe): a thrown blade.
- **Super: Hundred Fang.** Pressure · Strike · 20 · Build 4, chip 2 · Ender · On hit: Dizzy.

**How she plays**

- **Faster hits softer.** Each Pressure is a step faster than the Benchmark's nearest card and about a point of Build lighter. Her usual combo (Fang Rush, Twin Fang, Pommel Strike) does 10 plus their pile; the Benchmark's best (Lunge, Slash, Wind-Up) does 13 plus the pile.
- **Twin is her burst, paid for in cards.** Fang Rush, Twin Fang, Twin Fang, Pommel Strike does 14 plus the pile, but it spends four cards from a hand of about six. Recall is how she refills, and it can bring back a Twin Fang to make a pair.
- **Heel Drop ends a string on Knockdown.** Next round she wins every speed clash, Converts included, and they're sitting on the grey she just built.
- **Against her, the read is mostly Guard or not.** Their Pressure seldom wins a speed clash against hers, so their real choice is Guard (beats her Pressure) or Convert (beats her Guard).
- **Her specials are both halves of the mixup.** Holding Cross-Up says "guard and I combo you". Holding Flying Fang says "attack me and you lose the speed clash; guard and you get nothing".
- **Weakness:** 30 HP, Converts that lose most duels, and a deck the opponent can count. Staggered and Knockdown hurt her most, because speed is her edge.

---

## Bastion: the Sentinel (*Counter-puncher*)

**Hitting him is the mistake.** He has more Guards than anyone, a Counter on nearly every attack, and blocks that win the next round as well as this one. Opponents learn to Convert into him, and every one of his Pressures beats that. *Guile's patience with Sophitia's shield.* *(The sim says this loop doesn't pay as written: see Where They Stand.)*

**HP 32. Pressure 9, Convert 8, Recover 9 (the core and two Repulses).**

| Card | × | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| Edge Jab | 2 | Pressure · Strike | 16 | Build 1, chip 1 | Safe, Starter, Linker | — |
| Shield Bash | 3 | Pressure · Strike | 14 | Build 3, chip 1 | Starter, Counter | — |
| Rim Shot | 2 | Pressure · Strike | 13 | Build 3 | Counter | On hit: Staggered |
| Sonic Cutter | 2 | Pressure · Projectile | 12 | Build 3, chip 2 | Safe | — |
| Lockdown | 3 | Convert · Grab | 7 | chip 1 | Counter | — |
| Shoulder Ram | 3 | Convert · Guard Break | 4 | chip 3 | Ender, Counter | — |
| Shield Slam | 2 | Convert · Guard Break | 1 | chip 4 | Ender, Counter | — |
| **Repulse** | 2 | Recover · Guard | — | — | — | If this beats a Pressure: they're Staggered next round. |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

- **13 Counters (50%;** the Benchmark has 8); 5 Starters; 4 Safe.
- **Specials:** **Aegis** (Recover · Guard · if this beats a Pressure: Knockdown) and **Shield Rush** (Pressure · Strike · 18 · Build 3, chip 1 · Starter, Counter).
- **Super: Final Bastion.** Recover · Guard · if this beats a Pressure: they're Dizzy next round.

**How he plays**

- **Repulse keeps the Counter follow-up and gives up the core's rider.** A core Guard gains a card or meter whether it wins or loses. Repulse gains nothing unless it beats a Pressure; then it punishes as usual and Staggers them, even if the Pressure was Safe (Safe stops the follow-up, not the status).
- **Why 13 Counters:** the core already gives a follow-up to most blocked Pressures, so more Counters don't add follow-ups. They make every follow-up his best card.
- **His blocks escalate:** Repulse Staggers, Aegis knocks down, Final Bastion Dizzies. All three are public threats.
- **Stagger makes up for his slow hands.** Staggered, the Benchmark's Jab drops to 14 and its Lunge to 12, under Bastion's Edge Jab (16).
- **Weakness:** slow Pressures, and an opponent patient enough to Convert only when he's likely to Guard. With 9 cards that never deal damage, his games run long.

---

## Atlas: the Mountain (*Heavy hitter*)

**He loses the race and wins the exchange.** The slowest cards in the game, the biggest numbers and the most HP. Almost every same-type clash goes against him, so he wins rounds by reading the type, and when he does, it hurts. Knockdown on his big swings is how the slow fighter gets a round of speed. *Like Astaroth or Nightmare.*

**HP 38. Pressure 11, Convert 8, Recover 7.**

| Card | × | Type · kind | Speed | Values | Icons | Text |
|---|---|---|---|---|---|---|
| Haft Strike | 3 | Pressure · Strike | 13 | Build 3, chip 1 | Starter, Linker | — |
| Overhead | 3 | Pressure · Strike | 12 | Build 5, chip 1 | Linker, Counter | — |
| Ground Smash | 2 | Pressure · Projectile | 11 | Build 3, chip 2 | Safe | — |
| Hammer Sweep | 3 | Pressure · Strike | 11 | Build 4 | Ender | On hit: Knockdown |
| Shoulder Check | 2 | Convert · Guard Break | 5 | chip 2 | Counter | — |
| Hammer Spin | 3 | Convert · Guard Break | 2 | chip 4 | Ender, Counter | — |
| Earthsplitter | 3 | Convert · Guard Break | 1 | chip 5 | Ender | On hit: Knockdown |
| Recall, Charge, Read | 3, 2, 2 | Recover · Guard | — | — | — | The defence core |

- **3 Starters** (the fewest); 8 Counters; 2 Safe; 6 Knockdowns (the Benchmark has 5).
- **Specials:** **Lariat** (Pressure · Strike · 17 · Build 4, chip 1): his one quick hit. **Upheaval** (Convert · Guard Break · 9 · chip 4 · Ender, Counter): his one quick swing.
- **Super: Avalanche.** Convert · Guard Break · 5 · chip 7 · Ender · On hit: Knockdown.

**How he plays**

- **He's as good as knocked down every round.** Being the slowest means losing speed clashes, which is exactly what Knockdown does to everyone else. So the opponent's Pressure beats both his attacks, and only his Guard stops it.
- **That makes his Guard the deterrent.** His follow-ups are the biggest in the game, so Pressuring him is a gamble. The safe play into his Guard is a Convert, and any Pressure beats that.
- **Knockdown flips it for a round.** After Hammer Sweep or Earthsplitter, the opponent loses every speed clash next round, so for that round Atlas wins the mirrors.
- **Earthsplitter is the read, not the punish.** It has no Counter icon: it lands by beating a Guard or ending a combo (Haft Strike, Overhead, Earthsplitter does 15 plus the pile, and knocks them down).
- **His specials buy speed:** Lariat covers his Pressure side and Upheaval his Convert side.
- **Dropped from the sketch: "his heaviest swing Staggers him".** A speed cost doesn't bite on the slowest fighter, so Earthsplitter is priced by having no Counter instead.

---

## Flags

1. **Bastion is out of the band (about 30%).** The tested fix is above; the open question is whether a Guard-heavy deck can work when the deck is the play mix.
2. **Vex at HP 30 is just under the band (43%);** HP 32 gets 47%.
3. **The time-out with HP from 30 to 38** (rules Flag 5). It compares HP left, so to win a time-out against Atlas, Vex must have dealt 9 more damage than she's taken. In the sim the effect is small (5% of Vex v Atlas games time out; Atlas wins 58% of those), but I'd still switch it to compare HP lost.
4. **Speed statuses are nearly blank against Atlas.** Knockdown and Staggered barely change anything for the slowest fighter. The partner's Knockdown weight (1.5 HP) will overvalue them there.
5. **Guarding pays in the Bastion and Atlas mirrors** (Guard bots 34–35%, rules Flag 1). Bastion's comes mostly from time-outs.
6. **Bastion's Super and Aegis are Guards,** and come out rarely (0.4% and 3% of his clash cards).
7. **Twin drains her hand,** as intended: starved 5% of clashes.

## In the Code

GitHub `Youngy34/card-game`, branch **`v18-roster`** (off `v18-safe`).

- **Fighters:** `data/v18/vex.json`, `bastion.json`, `atlas.json`. The Bastion test variants are in `data/v18/variants/bastion-*.json`; `bastion-speed-all.json` is the 47% package.
- **New card fields:** `twin: true` on a Linker; `onBlock: "staggered" | "knockdown" | "dizzy"` on a Recover (Dizzy only on a Super); `special: true` is now allowed on a Recover (with no core rider).
- **Engine:** `src/engine/v16/engine.js` (Twin in `decideClash16`, onBlock in `startClash16`, Confiscate's floor in `finishClash`); card text and checks in `cards.js`; the page's Twin prompt in `src/app/v16/play16.js`.
- **Checks:** `node tools/test18-roster.mjs` (55 pass); `test18` (66), `test17` (36), `test16` (96), `test16-warden` (28) still pass; the browser smoke test (`tools/smoke/browser18.cjs`) 487 of 487, including a Twin prompt and a block status (Repulse, Aegis or Final Bastion) as Vex against Bastion.
- **Diagnosis tool:** `node tools/breakdown18.mjs bastion benchmark -n 300` (damage by source, clash wins by type pairing, combos and Twins, per side).

## Next

1. Mark playtests the three on the 8 November page.
2. Decide Bastion: take the 47% package (his attacks at the Benchmark's level, HP 34), or rethink how a counter-puncher works in a once-through deck.
3. Vex to HP 32.
4. The time-out comparing HP lost.
