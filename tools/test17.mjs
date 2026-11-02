// Rule checks for rules v17 (rules-overview 17.md): the initiative token, specials and the
// Super on the table, Read's and Charge's options, the single-use Super, refilling at the reveal.
//   node tools/test17.mjs

import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, applyNeutral16, startClash16, decideClash16, startDraw16, finishRound16, clashOptions16, neutralModes16, superReady, initOrder, runClash16 } from '../src/engine/v16/engine.js'
import { playGame16 } from '../src/engine/v16/game.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const settings = read('../data/v17/settings.json')
const rules = { ...settings.rules }
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
for (const n of ['benchmark', 'warden']) ok(!validateFighter16(read(`../data/v17/${n}.json`)).errors.length, `${n} v17 validates`)
const F = toFighter16(read('../data/v17/benchmark.json'))
const id = n => F.cards.findIndex(c => c.name === n)
const [JAB, SLASH, SWEEP, THROW, SWING, GUARD, CHARGE, READ, RUSH, RISE, BREAK] = ['Jab', 'Slash', 'Sweep', 'Throw', 'Big Swing', 'Guard', 'Charge', 'Read', 'Rush', 'Rising Strike', 'Breaker'].map(id)

// 1. Setup: specials and the Super on the table, not in the deck; a token holder
{
  const G = newGame16(F, F, rules, 3)
  ok(G.init === 0 || G.init === 1, `someone holds the initiative (${G.init})`)
  ok(G.A.table.join() === [RISE, BREAK].join() && G.A.superAt === 'table', 'specials and Super start on the table')
  ok(![...G.A.deck, ...G.A.hand].some(i => i === RISE || i === BREAK), 'specials are not in the deck')
  ok(G.A.deck.length + G.A.hand.length === 20, `20 clash cards (${G.A.deck.length + G.A.hand.length})`)
  ok(!superReady(G.A, G.rules) && !clashOptions16(G.A, G.rules).includes('S'), 'the Super is not playable from the table')
}
const base = (patchA = {}, patchB = {}, init = 0) => {
  const G = newGame16(F, F, rules, 5)
  return { ...G, init, A: { ...G.A, ...patchA }, B: { ...G.B, ...patchB } }
}
// 2. Read: take a special from the table (1 meter) instead of drawing; the Super (2)
{
  let G = base({ meter: 1, nhand: [READ, CHARGE, RUSH] }, { nhand: [CHARGE, RUSH, RUSH] })
  const modes = neutralModes16(G.A, READ, G.rules)
  ok(modes.length === 3 && modes.some(o => o.take === RISE) && modes.some(o => o.take === BREAK) && !modes.some(o => o.take === 'S'), `Read's options at 1 meter: draw, Rising Strike, Breaker (${JSON.stringify(modes)})`)
  const hand = G.A.hand.length
  G = applyNeutral16(G, [{ kind: 'neutral', i: READ, opt: { take: RISE } }, { kind: 'neutral', i: CHARGE }])
  ok(G.A.meter === 0 && G.A.hand.length === hand + 1 && G.A.hand.includes(RISE) && !G.A.table.includes(RISE), 'took Rising Strike for 1 meter, no draw')
  ok(G.B.meter === 2, 'their Charge gained 2')
  ok(G.A.nhand.length === 2 && G.B.nhand.length === 2, 'no neutral draw at the reveal')
  { const D = startDraw16(runClash16(G, null, null, () => null)); ok(D.A.nhand.length === 3 && D.B.nhand.length === 3 && D.A.pile === 1, 'the end of the round: neutral hands refilled with the clash draw and the grey') }
  let H = base({ meter: 2, nhand: [READ, CHARGE, RUSH] })
  ok(neutralModes16(H.A, READ, H.rules).some(o => o.take === 'S'), 'at 2 meter the Super can be taken')
  H = applyNeutral16(H, [{ kind: 'neutral', i: READ, opt: { take: 'S' } }, null])
  ok(H.A.superAt === 'hand' && H.A.meter === 0 && superReady(H.A, H.rules), 'the Super is in hand, paid for')
  ok(clashOptions16(H.A, H.rules).includes('S'), 'and playable as a clash card')
  let bad = false
  try { applyNeutral16(base({ meter: 0, nhand: [READ, CHARGE, RUSH] }), [{ kind: 'neutral', i: READ, opt: { take: RISE } }, null]) } catch { bad = true }
  ok(bad, "can't take a special without the meter")
}
// 3. A taken special is an ordinary card: played, discarded, fetched back by Charge
{
  let G = base({ meter: 1, nhand: [READ, CHARGE, RUSH], hand: [JAB] }, { hand: [THROW] })
  G = applyNeutral16(G, [{ kind: 'neutral', i: READ, opt: { take: RISE } }, null])
  G = startClash16(G, RISE, THROW)
  ok(G.clash.winner === 0 && G.pending?.stage === 'link', 'Rising Strike beats Throw and starts a combo')
  G = decideClash16(G, null); G = startDraw16(G)
  ok(G.A.discard.some(d => d.i === RISE), 'it goes to the discard pile')
  ok(neutralModes16(G.A, CHARGE, G.rules).some(o => o.fetch === RISE), 'Charge can fetch it back')
  const m = G.A.meter
  G = applyNeutral16({ ...G, A: { ...G.A, nhand: [CHARGE, RUSH, RUSH] } }, [{ kind: 'neutral', i: CHARGE, opt: { fetch: RISE } }, null])
  ok(G.A.hand.includes(RISE) && !G.A.discard.some(d => d.i === RISE) && G.A.meter === m, 'fetched instead of gaining meter')
}
// 4. The Super: single use, gone after it's played (won or not)
{
  let G = base({ superAt: 'hand', hand: [GUARD] }, { hand: [JAB, GUARD], pile: 4 })
  G = startClash16(G, 'S', GUARD)
  ok(G.clash.winner === 0 && G.A.superAt === 'gone', 'Overdrive lands and is used up')
  G = startDraw16(G)
  ok(!superReady(G.A, G.rules) && !clashOptions16(G.A, G.rules).includes('S'), 'no Super afterwards')
  let H = base({ superAt: 'hand', hand: [GUARD] }, { hand: [JAB] })
  H = startClash16(H, 'S', JAB)
  ok(H.clash.winner === 1 && H.A.superAt === 'gone', 'a beaten Super is gone too')
}
// 5. Initiative: wins speed ties, passes every round, orders choices
{
  let G = base({ hand: [JAB] }, { hand: [JAB] }, 1)
  G = startClash16(G, JAB, JAB)
  ok(G.clash.outcome === 'tie' && G.clash.winner === 1, 'Jab against Jab: the holder (B) wins the tie')
  ok(initOrder(G).join() === '1,0', 'B goes first')
  G = finishRound16(startDraw16({ ...G, pending: null }).phase === 'draw' ? startDraw16({ ...G, pending: null }) : { ...G, pending: null, A: G.A, B: G.B })
  ok(G.init === 0, `the token passes (${G.init})`)
}
// 6. Whole games run, with specials taken and Supers used
{
  let took = 0, supers = 0, games = 0
  const W = toFighter16(read('../data/v17/warden.json'))
  for (let s = 0; s < 8; s++) {
    const g = playGame16(s % 2 ? W : F, F, { rules, levels: ['hard', 'hard'], seed: 70 + s })
    games++
    ok(g.result !== null, 'game finishes')
    for (const r of g.rounds) { took += r.neutral.filter(a => a.took).length; supers += r.supers.filter(Boolean).length }
  }
  ok(took > 0, `specials and Supers are taken from the table (${took} in ${games} games)`)
  ok(supers <= 2 * games, `at most one Super each a game (${supers})`)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
