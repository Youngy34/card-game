# Playtest App — the v20 page (heat)

**Page:** https://claude.ai/artifact/9U6NPwg6kUEtYrceFVfqTN ("Yomi Playtest v20 (heat)"). Rules: `rules-overview 20.md`. Built from branch `v20-heat` with `node tools/build-artifact.mjs --edition v20`. Its own saved edits, settings and playtest log: nothing carries over from the v18 or v19 pages.

**Fighters:** the Benchmark, the Warden, Vex, Bastion and Atlas, at their v20 HP and heat caps (`data/v20/`: HP 23, 24, 20, 22 and 28 since the evening of 9 November).

## What's different from the v19 page

- **The words.** Types read **Pressure, Break, Guard**; kinds read Strike and Projectile, **Heavy** and Grab, **Block**. Card text prices specials and the Super in heat, and Read just draws.
- **Heat on your side.** Each HUD shows that fighter's **Heat n/cap** in hot tokens: what their winning Pressures built, up to their own cap. At the cap it flags **Max: your Pressures land in full** (their Build is straight damage; the round's heat just stops). The striped end of each HP bar is still the damage the *other* fighter's heat threatens.
- **No meter track** and no Charge.
- **The table** shows each special at **3 heat** and the Super at **its cap (max)**, or *in hand* or *used*.
- **The shop.** After the reveal, the button reads **Draw · 1 heat each · spend heat · pass the initiative.** If you can afford anything, **Spend heat** comes up: tap a card to buy it, or **Keep your heat**. The initiative holder buys first; the second buyer sees the first's purchase. One card a round.
- **The log** lists what each player bought, and each round's HP and heat.
- **Board notes** say when either fighter is near or at max heat, what a winning Break of yours would spend, and what they bought last round.
- **Settings** has **A special costs (heat)** (3), **Heat each player gains each round** (1) and **At max heat, the round's heat** (stops at the cap, as written since the evening of 9 November; the other choice is the first page's 1 damage a round). If you saved Settings on this page before the evening update, **Back to defaults** brings the new rule in. The cap for a fighter that prints none is 9; every v20 fighter prints its own (the Decks tab's **Heat cap** tile).
- **The Lab** runs v20 matchups with the partner shopping as it does in play.

## The sparring partner

Hard as on v18 (it plays as if neither hand is visible). In the shop it tries each option, nothing included, and keeps the one whose next clash it rates best; Easy and Medium soften that choice. Bots buy the first special they can pay for, or the Super. Against Hard (Benchmark mirror): Medium wins 45%, Easy 29%, random play 23%.
