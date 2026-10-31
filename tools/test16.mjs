// Rule checks for the v16 engine: each scenario sets up hands and checks the
// result against rules-overview 16.md.   node tools/test16.mjs

import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, applyNeutral16, startClash16, decideClash16, startDraw16, discardDown16, clashOptions16, neutralOptions16, runClash16, unseenPool, DEFAULT_RULES16, clashChoices16 } from '../src/engine/v16/engine.js'
import { neutralActions16 } from '../src/engine/v16/ai.js'

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
  ok(G.B.meter === 3 && !clashOptions16(G.B, G.rules).includes('S'), 'Overdrive needs 4 meter: not playable at 3')
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
// 7. The Super: Dizzy (on a Super that has it), the free hit, and once-per-game
{
  const FD = { ...F, sup: { ...F.sup, onHit: 'dizzy', meter: 3 } }
  let G = setup([JAB], [GUARD], { A: { meter: 3, f: FD }, B: { pile: 4 } })
  G = startClash16(G, 'S', GUARD)
  ok(G.A.meter === 0 && G.B.hp === 30 - 4 - 5 && G.B.next.dizzy, 'Overdrive cashes 4, chips 5, Dizzy')
  G = startDraw16(G)
  ok(clashOptions16(G.B, G.rules).length === 0 && neutralOptions16(G.B, G.rules).skip, 'Dizzy: no neutral action, no clash card')
  G = applyNeutral16(G, [null, null])
  const handA = G.A.hand.concat([JAB, SLASH, SWING])
  G = { ...G, A: { ...G.A, hand: handA } }
  G = startClash16(G, JAB, null)
  ok(G.clash.outcome === 'unopposed' && G.pending?.stage === 'link', 'the free hit lands unopposed and a Starter combos')
  let U = setup([JAB], [GUARD], { A: { meter: 4, supersUsed: 1 }, rules: { superUses: 1 } })
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
// 12. Breather and Focus as separate cards (focusDraw off); no burning
{
  const W = { ...DEFAULT_RULES16, focusDraw: false }
  ok(W.burnMax === 0 && W.focusMeter === 1, 'no burning, Focus gains 1')
  let G = newGame16(F, F, W, 5)
  const o = neutralOptions16(G.A, W)
  ok(o.maxBurn === 0 && o.canFocus, 'no burn option; Focus available')
  ok(!neutralActions16(G.A, W).some(a => a.kind === 'burn') && neutralActions16(G.A, W).some(a => a.kind === 'focus'), 'the partner considers Focus, never a burn')
  const h0 = G.A.hand.length
  G = applyNeutral16(G, [{ kind: 'focus' }, { kind: 'draw' }])
  ok(G.A.meter === 1 && G.A.hand.length === h0 && G.B.hand.length === h0 + 1, 'Focus: +1 meter, no card spent; the Breather draws')
  ok(G.neutral[0].kind === 'focus' && G.neutral[0].n === 1, 'Focus is recorded')
  let full = newGame16(F, F, W, 5); full = { ...full, A: { ...full.A, meter: 4 } }
  ok(!neutralOptions16(full.A, W).canFocus, "no Focus at full meter")
  let threw = false; try { applyNeutral16(full, [{ kind: 'focus' }, null]) } catch { threw = true }
  ok(threw, 'Focus at full meter is refused')
  let once = newGame16(F, F, { ...W, superUses: 1 }, 5); once = { ...once, A: { ...once.A, supersUsed: 1 } }
  ok(!neutralOptions16(once.A, once.rules).canFocus, 'no Focus once a once-per-game Super is spent')
  // Focus meter pays for this round's Super in two steps
  let S = newGame16(F, F, W, 5); S = { ...S, A: { ...S.A, meter: 3 } }
  S = applyNeutral16(S, [{ kind: 'focus' }, null])
  ok(clashOptions16(S.A, S.rules).includes('S'), "two steps: Focus's meter can pay for this round's Super")
  let R = newGame16(F, F, { ...W, oneReveal: true }, 5); R = { ...R, A: { ...R.A, meter: 3 } }
  R = applyNeutral16(R, [{ kind: 'focus' }, null])
  ok(!clashOptions16(R.A, R.rules).includes('S'), "one reveal: Focus's meter arrives after the clash")
}
// 13. As written (31 October): a neutral card or Focus (draw a card and gain 1 meter); Super 4 meter
{
  const W = { ...DEFAULT_RULES16 }
  ok(W.focusDraw && W.burnMax === 0 && W.meterMax === 4, 'as written: Focus draws and gains meter, no burning, meter 0–4')
  ok(F.sup.meter === 4 && F.sup.onHit === 'knockdown', 'Overdrive: 4 meter, knocks down')
  let G = newGame16(F, F, W, 9)
  const acts = neutralActions16(G.A, W)
  ok(!acts.some(a => a.kind === 'draw' || a.kind === 'burn') && acts.some(a => a.kind === 'focus'), 'options: Focus or a neutral card')
  const h0 = G.A.hand.length, d0 = G.A.deck.length
  G = applyNeutral16(G, [{ kind: 'focus' }, null])
  ok(G.A.meter === 1 && G.A.hand.length === h0 + 1 && G.A.deck.length === d0 - 1, 'Focus: +1 meter and a card')
  let full = newGame16(F, F, W, 9); full = { ...full, A: { ...full.A, meter: 4 } }
  ok(neutralOptions16(full.A, W).canFocus, 'Focus is always available')
  full = applyNeutral16(full, [{ kind: 'focus' }, null])
  ok(full.A.meter === 4 && full.A.hand.length === h0 + 1 && full.neutral[0].n === 0, 'at full meter, Focus still draws')
  let S = setup([JAB], [GUARD], { A: { meter: 3 }, rules: W })
  ok(!clashOptions16(S.A, S.rules).includes('S'), 'no Super at 3 meter')
  S = setup([JAB], [GUARD], { A: { meter: 4 }, B: { pile: 2 }, rules: W })
  S = startClash16(S, 'S', GUARD)
  ok(S.A.meter === 0 && S.B.hp === 30 - 2 - 5 && S.B.next.knockdown, 'Overdrive: 4 meter, cashes, chips 5, knocks down')
}
// 14. Focus as the clash blank: anyone may play nothing; a Dizzy player has no choice
{
  const W = { ...DEFAULT_RULES16 }
  let G = setup([JAB, GUARD], [JAB], { rules: W })
  ok(clashChoices16(G.A, W).includes(null) && clashChoices16(G.A, W).includes(JAB), 'the blank is a choice alongside legal cards')
  ok(!clashChoices16(G.A, { ...W, blankClash: false }).includes(null), 'blankClash off: no blank while you hold a card')
  let D = setup([JAB], [JAB], { A: { st: { dizzy: true } }, rules: W })
  ok(clashChoices16(D.A, W).length === 0, 'Dizzy: no choice at all')
  let P = setup([JAB, GUARD], [JAB, SLASH, SWING], { B: { pile: 0 }, rules: W })
  P = startClash16(P, null, JAB)
  ok(P.clash.outcome === 'unopposed' && P.clash.winner === 1 && P.A.pile === 2 && P.A.hp === 29, "a blank against a Jab: the Jab lands (builds 2, chips 1)")
  ok(P.pending?.stage === 'link', '…and a Starter landing on a blank combos')
  let Q = setup([GUARD], [JAB], { A: { pile: 5 }, rules: W })
  Q = startClash16(Q, GUARD, null)
  ok(Q.clash.outcome === 'unopposed' && Q.A.pile === 0 && !Q.pending, 'a Guard against a blank clears, with no follow-up')
}
console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
