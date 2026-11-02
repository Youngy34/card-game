// Rule checks for the Warden's mechanics (character-warden v16 draft.md) and grey each round.
//   node tools/test16-warden.mjs

import fs from 'fs'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, applyNeutral16, startClash16, decideClash16, startDraw16, discardDown16, confiscate16, owes, runClash16 } from '../src/engine/v16/engine.js'
import { chooseConfiscate, DEFAULT_W16 } from '../src/engine/v16/ai.js'
import { mulberry, playGame16 } from '../src/engine/v16/game.js'

const load = p => toFighter16(JSON.parse(fs.readFileSync(new URL(p, import.meta.url))))
const W = load('./fixtures/warden/w1.json'), B = load('../data/v16/benchmark.json')
const wi = n => W.cards.findIndex(c => c.name === n), bi = n => B.cards.findIndex(c => c.name === n)
const [LASH, HOOK, HAUL, COIL, SLAM, CGUARD, CHARGE, READ, SHAKE, GRIP, SHACK] =
  ['Chain Lash', 'Ankle Hook', 'Haul In', 'Coil', 'Slam', 'Chain Guard', 'Charge', 'Read', 'Shakedown', 'Death Grip', 'Shackles'].map(wi)
const [JAB, SLASH, THROW, SWING, GUARD, BREAD, BCHARGE] = ['Jab', 'Slash', 'Throw', 'Big Swing', 'Guard', 'Read', 'Charge'].map(bi)

let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const rules = { openingHand: 6, handLimit: 8, meterMax: 3, burnMax: 0, superUses: 0, speedTie: 'cancel', maxRounds: 60, splitDecks: true, neutralHand: 3, greyPerRound: 1, confiscateFloor: 2 }
function setup(hA, hB, patch = {}) {
  let G = newGame16(W, B, rules, 11)
  G = { ...G, A: { ...G.A, hand: hA.slice(), ...(patch.A || {}) }, B: { ...G.B, hand: hB.slice(), ...(patch.B || {}) } }
  return G
}
const neutral = (G, a, b) => applyNeutral16({ ...G, A: { ...G.A, nhand: [a, CHARGE, CHARGE] }, B: { ...G.B, nhand: [b, BCHARGE, BCHARGE] } }, [{ kind: 'neutral', i: a }, { kind: 'neutral', i: b }])

// 1. Coil on hit: Confiscate, owed by the opponent and paid after the clash
{
  let G = neutral(setup([COIL], [GUARD, JAB, JAB, THROW], { B: { pile: 3 } }), CHARGE, BCHARGE)
  G = startClash16(G, COIL, GUARD)
  ok(G.clash.winner === 0 && G.B.hp === 38 - 3 - 3, `Coil beats Guard: cash 3, chip 3 (hp ${G.B.hp})`)
  ok(G.B.owe === 1, `Coil Confiscates: they owe 1 (owe ${G.B.owe})`)
  G = confiscate16(G, 1, [JAB])
  ok(G.B.hand.length === 2 && G.B.owe === 0 && G.B.discard.at(-1).i === JAB, 'paid: Jab to their discard, hand 2')
}
// 2. The floor: never below 2
{
  let G = neutral(setup([COIL], [GUARD, JAB, THROW]), CHARGE, BCHARGE)
  G = startClash16(G, COIL, GUARD)
  ok(G.B.hand.length === 2 && !G.B.owe, `hand of 2 after playing their card: nothing owed (owe ${G.B.owe || 0})`)
}
// 3. Shakedown: Confiscate at the start of the clash, after their Read has drawn
{
  let G = setup([LASH], [GUARD, GUARD])
  G = neutral(G, SHAKE, BREAD)
  ok(G.B.hand.length === 4 && G.B.owe === 1, `Read drew 2 first, then Shakedown: hand 4, owe 1 (hand ${G.B.hand.length}, owe ${G.B.owe})`)
  let H = neutral(setup([LASH], [GUARD, GUARD]), SHAKE, BCHARGE)
  ok(!H.B.owe, 'Shakedown against a hand of 2: nothing')
}
// 4. Death Grip: Grabs Confiscate on hit; Coil under it Confiscates twice; Pressures don't
{
  let G = neutral(setup([HAUL], [GUARD, JAB, JAB, THROW, SWING]), GRIP, BCHARGE)
  G = startClash16(G, HAUL, GUARD)
  ok(G.B.owe === 1, `Haul In under Death Grip: owe 1 (${G.B.owe})`)
  let H = neutral(setup([COIL], [GUARD, JAB, JAB, THROW, SWING]), GRIP, BCHARGE)
  H = startClash16(H, COIL, GUARD)
  ok(H.B.owe === 2, `Coil under Death Grip: owe 2 (${H.B.owe})`)
  let K = neutral(setup([LASH], [THROW, JAB, JAB, GUARD]), GRIP, BCHARGE)
  K = startClash16(K, LASH, THROW)
  ok(!K.B.owe, 'Death Grip: a Pressure hit Confiscates nothing')
}
// 5. A Guard follow-up Coil Confiscates
{
  let G = neutral(setup([CGUARD, COIL], [JAB, GUARD, GUARD, THROW]), CHARGE, BCHARGE)
  G = startClash16(G, CGUARD, JAB)
  ok(G.pending?.stage === 'follow' && G.pending.options.includes(COIL), 'Chain Guard beats Jab: Coil is a Counter')
  G = decideClash16(G, COIL)
  ok(G.B.owe === 1, `follow-up Coil: owe 1 (${G.B.owe})`)
}
// 6. Shackles: their limit is 5 in the draw step; a Pressure hit ends it, a beaten Pressure doesn't
{
  let G = neutral(setup([CGUARD, HAUL], [JAB, GUARD, GUARD, THROW, SWING, SLASH, GUARD]), SHACK, BCHARGE)
  ok(G.A.inPlay === SHACK, 'Shackles stays in play')
  G = runClash16(G, CGUARD, GUARD, () => null)
  G = startDraw16(G)
  ok(G.discardDown?.[1] === 2 && G.discardDown?.[0] === 0, `their 6 + draw = 7, over a limit of 5: discard 2 (${G.discardDown})`)
  ok(G.A.pile === 1 && G.B.pile === 1, `grey each round: both piles 1 (${G.A.pile}, ${G.B.pile})`)
  G = discardDown16(G, 1, [GUARD, GUARD])
  ok(G.B.hand.length === 5 && G.phase === 'neutral', 'discarded down to 5')
  let H = neutral(setup([HAUL, CGUARD], [JAB, GUARD, GUARD]), SHACK, BCHARGE)
  H = startClash16(H, HAUL, JAB)
  ok(H.A.inPlay == null && H.A.ndiscard.includes(SHACK), 'their Jab beats Haul In: Shackles ends')
  let K = neutral(setup([CGUARD], [JAB, GUARD, GUARD]), SHACK, BCHARGE)
  K = runClash16(K, CGUARD, JAB, () => null)
  ok(K.A.inPlay === SHACK, 'a Jab that his Guard beats: Shackles stays')
}
// 7. Chain Prison: they discard down to 3 (after its cash)
{
  let G = neutral(setup([CGUARD], [JAB, GUARD, GUARD, THROW, SWING, SLASH, GUARD], { A: { meter: 3 }, B: { pile: 4 } }), CHARGE, BCHARGE)
  G = startClash16(G, CGUARD, JAB)
  ok(G.pending?.options.includes('S'), 'Chain Prison is a Counter')
  G = decideClash16(G, 'S')
  ok(G.B.owe === 3 && G.B.hand.length === 6, `down to 3 from 6: owe 3 (${G.B.owe})`)
  ok(G.A.meter === 0, 'paid 3 meter')
}
// 8. The partner's choice: it pays what it owes, from its own hand
{
  let G = neutral(setup([COIL], [GUARD, JAB, JAB, THROW, SWING]), CHARGE, BCHARGE)
  G = startClash16(G, COIL, GUARD)
  const pick = chooseConfiscate(G, 1, G.B.owe, DEFAULT_W16, mulberry(3))
  ok(pick.length === 1 && G.B.hand.includes(pick[0]), `partner discards one card it holds (${pick.map(i => B.cards[i].name)})`)
}
// 9. Whole games run, and every owed card is paid
{
  let paid = 0
  for (let s = 0; s < 6; s++) {
    const g = playGame16(W, B, { rules, levels: ['hard', 'hard'], seed: 40 + s })
    paid += g.rounds.reduce((t, r) => t + r.confiscated[1].length, 0)
    ok(g.result !== null, 'game finishes')
  }
  ok(paid > 0, `Confiscates happen in play (${paid} in 6 games)`)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
