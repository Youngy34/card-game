// Rule checks for the v16 engine: each scenario sets up hands and checks the
// result against rules-overview 16.md.   node tools/test16.mjs

import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, applyNeutral16, startClash16, decideClash16, startDraw16, discardDown16, clashOptions16, neutralOptions16, runClash16, unseenPool } from '../src/engine/v16/engine.js'

const raw = JSON.parse(fs.readFileSync(new URL('../data/v16/benchmark.json', import.meta.url)))
const v = validateFighter16(raw)
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
ok(!v.errors.length, `Benchmark validates: ${JSON.stringify(v.errors)}`)
const F = toFighter16(raw)
const id = name => F.cards.findIndex(c => c.name === name)
const [JAB, SLASH, SWEEP, THROW, SWING, GUARD, WIND, STEP] = ['Jab', 'Slash', 'Sweep', 'Throw', 'Big Swing', 'Guard', 'Wind-Up', 'Step In'].map(id)
ok(F.deck.length === 24, 'deck is 24 cards')

const rules = { openingHand: 6, handLimit: 8, meterMax: 3, burnMax: 3, superUses: 0, speedTie: 'cancel', maxRounds: 60 }
function setup(handA, handB, patch = {}) {
  let G = newGame16(F, F, rules, 7)
  G = { ...G, A: { ...G.A, hand: handA.slice(), ...(patch.A || {}) }, B: { ...G.B, hand: handB.slice(), ...(patch.B || {}) }, rules: { ...rules, ...(patch.rules || {}) } }
  return applyNeutral16(G, [null, null])
}

// 1. Pressure beats Convert, then a combo: Jab -> Slash -> Big Swing cashes it all
{
  let G = setup([JAB, SLASH, SWING], [THROW, GUARD], { B: { pile: 3 } })
  G = startClash16(G, JAB, THROW)
  ok(G.clash.winner === 0 && G.clash.outcome === 'triangle', 'Jab beats Throw')
  ok(G.B.pile === 5 && G.B.hp === 29, `Jab builds 2, chips 1 (pile ${G.B.pile}, hp ${G.B.hp})`)
  ok(G.pending?.stage === 'link' && G.pending.options.includes(SLASH), 'a winning Starter asks for a Linker')
  G = decideClash16(G, SLASH)
  ok(G.B.pile === 9 && G.B.hp === 28, 'Slash links: Build 4, chip 1')
  ok(G.pending?.stage === 'end' && G.pending.options.includes(SWING), 'then an Ender')
  G = decideClash16(G, SWING)
  ok(G.B.pile === 0 && G.B.hp === 28 - 9 - 3, `Big Swing cashes 9 and chips 3 (hp ${G.B.hp})`)
  ok(G.clash.done && G.phase === 'draw', 'clash done')
  ok(G.A.hand.length === 0 && G.A.used.join() === [JAB, SLASH, SWING].join(), 'combo cards left the hand, in order')
}
// 2. Skip the Linker, straight to the Ender; and a beaten Starter doesn't combo
{
  let G = setup([JAB, SWEEP], [THROW])
  G = startClash16(G, JAB, THROW)
  ok(G.pending?.stage === 'end', 'no Linker in hand: straight to the Ender')
  G = decideClash16(G, SWEEP)
  ok(G.B.next.knockdown === true, 'Sweep On hit: Knockdown for next round')
  G = startDraw16(G)
  ok(G.B.st.knockdown && neutralOptions16(G.B, G.rules).skip, 'knocked down: skips the neutral phase')
  let H = setup([JAB, SLASH], [GUARD, SWING])
  H = startClash16(H, JAB, GUARD)
  ok(H.clash.winner === 1, 'Guard beats Jab')
  ok(H.pending?.stage === 'follow' && H.pending.options.length === 1 && H.pending.options[0] === SWING, 'Guard follow-up: Counters only (Big Swing, not Jab)')
}
// 3. Guard follow-up: never a combo, any Counter, cashes the On loss tokens
{
  let G = setup([JAB], [GUARD, SLASH, JAB], { A: { pile: 4 } })
  G = startClash16(G, JAB, GUARD)
  ok(G.pending?.options.join() === String(SLASH), 'only Slash is a Counter in hand')
  G = decideClash16(G, SLASH)
  ok(G.A.pile === 8 && G.A.hp === 29 && G.clash.done && !G.pending, 'follow-up Slash lands; no combo after it')
  ok(G.B.pile === 0, 'the Guard cleared its own pile')
  let H = setup([JAB], [GUARD, JAB])
  H = startClash16(H, JAB, GUARD)
  ok(!H.pending && H.clash.done && H.clash.offered.follow === 0, 'no Counter in hand: no follow-up')
}
// 4. Speed: the faster wins; a tie cancels or goes to less HP
{
  let G = setup([JAB], [SLASH])
  G = startClash16(G, JAB, SLASH)
  ok(G.clash.winner === 0 && G.clash.outcome === 'speed', 'Jab 17 beats Slash 14')
  G = setup([JAB], [JAB])
  G = startClash16(G, JAB, JAB)
  ok(G.clash.outcome === 'cancel' && G.A.hp === 30 && G.B.hp === 30, 'a speed tie cancels')
  G = setup([JAB], [JAB], { A: { hp: 20 }, rules: { speedTie: 'lowhp' } })
  G = startClash16(G, JAB, JAB)
  ok(G.clash.winner === 0 && G.clash.outcome === 'tie', 'lowhp: the player on less HP wins the tie')
  G = setup([JAB], [SLASH], { A: { st: { staggered: true } } })
  G = startClash16(G, JAB, SLASH)
  ok(G.clash.outcome === 'cancel', 'Staggered: Jab 17 - 3 = 14 ties Slash')
}
// 5. Two Guards both clear; Guard vs Convert gets cashed
{
  let G = setup([GUARD], [GUARD], { A: { pile: 5 }, B: { pile: 2 } })
  G = startClash16(G, GUARD, GUARD)
  ok(G.A.pile === 0 && G.B.pile === 0 && G.clash.outcome === 'guards', 'two Guards both clear')
  G = setup([GUARD], [THROW], { A: { pile: 5 } })
  G = startClash16(G, GUARD, THROW)
  ok(G.A.hp === 30 - 5 - 2 && G.A.pile === 0 && G.clash.winner === 1, 'Throw cashes 5 and chips 2 through a Guard')
}
// 6. Neutral phase: draw, burn for meter, neutral cards' effects
{
  let G = newGame16(F, F, rules, 3)
  const h0 = G.A.hand.length, d0 = G.A.deck.length
  G = { ...G, A: { ...G.A, hand: [WIND, ...G.A.hand.slice(1)] } }
  const burn = G.B.hand.slice(0, 3)
  G = applyNeutral16(G, [{ kind: 'neutral', i: WIND }, { kind: 'burn', cards: burn }])
  ok(G.A.fx.convertChip === 2 && G.A.hand.length === h0 - 1, 'Wind-Up: Converts chip +2 this round')
  ok(G.B.meter === 3 && G.B.hand.length === 3 && G.B.discard.filter(d => d.burned).length === 3, 'burning 3 cards gives 3 meter, face down')
  ok(clashOptions16(G.B, G.rules).includes('S'), 'the Super is playable at 3 meter')
  let H = newGame16(F, F, rules, 3)
  H = applyNeutral16(H, [{ kind: 'draw' }, null])
  ok(H.A.hand.length === 7 && H.A.deck.length === d0 - 1, 'draw an extra card')
  // Step In: +2 speed, Slash 16 beats nothing faster than 16
  let S = setup([SLASH], [SLASH, STEP])
  S = applyNeutral16({ ...S, phase: 'neutral' }, [null, { kind: 'neutral', i: STEP }])
  S = startClash16(S, SLASH, SLASH)
  ok(S.clash.winner === 1, 'Step In: +2 speed wins the Slash duel')
  // burn limit
  let L = newGame16(F, F, { ...rules, burnMax: 1 }, 3)
  ok(neutralOptions16(L.A, L.rules).maxBurn === 1, 'burnMax 1')
  L = applyNeutral16(L, [{ kind: 'burn', cards: L.A.hand.slice(0, 3) }, null])
  ok(L.A.meter === 1 && L.A.hand.length === 5, 'only 1 burned with burnMax 1')
}
// 7. The Super: Dizzy, the free hit, and once-per-game
{
  let G = setup([JAB], [GUARD], { A: { meter: 3 }, B: { pile: 4 } })
  G = startClash16(G, 'S', GUARD)
  ok(G.A.meter === 0 && G.B.hp === 30 - 4 - 5 && G.B.next.dizzy, 'Overdrive cashes 4, chips 5, Dizzy')
  G = startDraw16(G)
  ok(clashOptions16(G.B, G.rules).length === 0 && neutralOptions16(G.B, G.rules).skip, 'Dizzy: no neutral action, no clash card')
  G = applyNeutral16(G, [null, null])
  const handA = G.A.hand.concat([JAB, SLASH, SWING])
  G = { ...G, A: { ...G.A, hand: handA } }
  G = startClash16(G, JAB, null)
  ok(G.clash.outcome === 'unopposed' && G.pending?.stage === 'link', 'the free hit lands unopposed and a Starter combos')
  let U = setup([JAB], [GUARD], { A: { meter: 3, supersUsed: 1 }, rules: { superUses: 1 } })
  ok(!clashOptions16(U.A, U.rules).includes('S'), 'superUses 1: no second Super')
}
// 8. Lock: a locked type can't be played, follow-ups and combos included
{
  let G = setup([JAB, THROW, GUARD], [GUARD], { A: { st: { lock: { C: true } } } })
  ok(!clashOptions16(G.A, G.rules).includes(THROW), 'Lock Convert: no Throw')
  let H = setup([JAB], [GUARD, SWING, SLASH], { B: { st: { lock: { C: true } } } })
  H = startClash16(H, JAB, GUARD)
  ok(H.pending?.options.join() === String(SLASH), 'Lock Convert: no Big Swing follow-up')
}
// 9. Draw phase: discard in order, draw 1, hand limit, reshuffle
{
  let G = setup([JAB, SLASH, SWING], [THROW])
  G = runClash16(G, JAB, THROW, (g, p) => p.options[0])
  G = startDraw16(G)
  const top = G.A.discard.slice(-3).map(d => d.i)
  ok(top.join() === [JAB, SLASH, SWING].join(), 'discarded in the order played (last on top)')
  ok(G.A.hand.length === 1, 'drew 1')
  let H = setup([GUARD, GUARD, GUARD, GUARD, GUARD, GUARD, JAB, JAB, JAB], [GUARD])
  H = runClash16(H, GUARD, GUARD, () => null)
  H = startDraw16(H)
  ok(H.phase === 'draw' && H.discardDown[0] === 1, `over the hand limit: discard ${H.discardDown?.[0]}`)
  H = discardDown16(H, 0, [JAB])
  ok(H.phase === 'neutral' && H.A.hand.length === 8, 'down to 8')
  let E = setup([JAB], [GUARD], { A: { deck: [], discard: [{ i: SLASH, burned: true }, { i: THROW, burned: false }] } })
  E = runClash16(E, JAB, GUARD, () => null)
  E = startDraw16(E)
  ok(E.A.reshuffles === 1 && E.A.hand.length === 1 && E.A.deck.length === 2, 'empty deck: the discard (burned cards too) is shuffled in')
}
// 10. What the opponent can't see
{
  const G = setup([JAB], [GUARD], { B: { deck: [SWING, THROW], discard: [{ i: SLASH, burned: true }, { i: JAB, burned: false }] } })
  ok(unseenPool(G.B).sort().join() === [SWING, THROW, GUARD, SLASH].sort().join(), 'unseen: deck + hand + burned, not face-up discards')
}
console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
