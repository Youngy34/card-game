// Rule checks for rules v18 (rules-overview 18.md): one deck and one step, riders On reveal
// (Charge, Read, Recall, Shakedown), the defence cores, specials returning to the table, Knockdown as
// Lock Pressure, the time-out, and the v18 partner's solvers and hidden-hand dealing.
//   node tools/test18.mjs

import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, startDraw16, finishRound16, clashOptions16, superReady, readModes18, recallModes18, confiscate16, hiddenSplit } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, clashMix16 } from '../src/engine/v16/ai.js'
import { maximin, bayesMaximin, bayesGame, worstCase } from '../src/engine/lp.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const rules = { ...read('../data/v18/settings.json').rules }
const W18 = { ...DEFAULT_W16, ...read('../data/v18/settings.json').ai }
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
for (const n of ['benchmark', 'warden', 'variants/benchmark-2nov', 'variants/warden-2nov']) { const v = validateFighter16(read(`../data/v18/${n}.json`)); ok(!v.errors.length, `${n} v18 validates ${JSON.stringify(v.errors)}`) }
{
  const bad = read('../data/v18/benchmark.json'); bad.cards[0].copies = 4
  ok(validateFighter16(bad).errors.some(e => /At most 3/.test(e.msg)), 'four copies of a card is refused')
  const neut = read('../data/v17/benchmark.json'); neut.rules = 18
  ok(validateFighter16(neut).errors.some(e => /no neutral cards/.test(e.msg)), 'a v18 deck with neutral cards is refused')
}
// Sections 1-8 use the 2 November decks (riders on Shot and Wind-Up, Parry and Brace in the core) to check those mechanics
const F = toFighter16(read('../data/v18/variants/benchmark-2nov.json'))
const Wd = toFighter16(read('../data/v18/variants/warden-2nov.json'))
const F3 = toFighter16(read('../data/v18/benchmark.json')), W3 = toFighter16(read('../data/v18/warden.json'))
const id = (f, n) => f.cards.findIndex(c => c.name === n)
const [JAB, SLASH, SWEEP, SHOT, THROW, SWING, WIND, GUARD, PARRY, BRACE, RISE, BREAK] =
  ['Jab', 'Slash', 'Sweep', 'Shot', 'Throw', 'Big Swing', 'Wind-Up', 'Guard', 'Parry', 'Brace', 'Rising Strike', 'Breaker'].map(n => id(F, n))

// 1. Setup: one deck of 24, specials and the Super on the table, straight to the clash
{
  const G = newGame16(F, F, rules, 3)
  ok(G.phase === 'clash' && !G.A.nhand, `one step: the round starts at the clash (${G.phase})`)
  ok(G.A.deck.length + G.A.hand.length === 24 && G.A.hand.length === 6, `24 cards, 6 in hand (${G.A.deck.length + G.A.hand.length})`)
  ok(G.A.table.join() === [RISE, BREAK].join() && G.A.superAt === 'table', 'specials and the Super start on the table')
}
const base = (patchA = {}, patchB = {}, init = 0) => {
  const G = newGame16(F, F, rules, 5)
  return { ...G, init, A: { ...G.A, ...patchA }, B: { ...G.B, ...patchB } }
}
// 2. Charge: Wind-Up gains 2 meter On reveal, won or lost, capped at the track; nothing when voided
{
  let G = startClash16(base({ hand: [WIND] }, { hand: [JAB] }), WIND, JAB)
  ok(G.A.meter === 2 && G.clash.winner === 1, 'Wind-Up loses to Jab but still gains 2 meter')
  G = startClash16(base({ hand: [WIND], meter: 2 }, { hand: [GUARD] }), WIND, GUARD)
  ok(G.A.meter === 3 && G.clash.events.some(e => e.what === 'meter' && e.wasted === 1), 'capped at 3: one point wasted')
  G = startClash16(base({ hand: [WIND], st: { lock: { C: true } } }, { hand: [GUARD] }), WIND, GUARD)
  ok(G.A.meter === 0 && G.clash.voided[0], 'a voided Wind-Up gains nothing')
}
// 3. Read: Shot takes a special (paying), or the Super, or draws; the Super can end the same combo
{
  let G = base({ hand: [SHOT, JAB], meter: 1 }, { hand: [THROW] })
  ok(readModes18(G.A).length === 3, `at 1 meter: draw, Rising Strike or Breaker (${JSON.stringify(readModes18(G.A))})`)
  G = startClash16(G, SHOT, THROW, false, [{ take: BREAK }, undefined])
  ok(G.A.meter === 0 && G.A.hand.includes(BREAK) && !G.A.table.includes(BREAK), 'took Breaker for 1 meter')
  ok(G.pending?.stage === 'link', 'Shot (a Starter) beat Throw: combo')
  let H = base({ hand: [SHOT, JAB], meter: 2 }, { hand: [THROW], pile: 4 })
  H = startClash16(H, SHOT, THROW, false, [{ take: 'S' }, undefined])
  ok(H.A.superAt === 'hand' && H.A.meter === 0, 'took the Super on reveal')
  ok(H.pending?.stage === 'link', 'and the combo is open')
  H = decideClash16(H, null)
  ok(H.pending?.stage === 'end' && H.pending.options.includes('S'), 'the Super is offered as the Ender in the same round')
  H = decideClash16(H, 'S')
  ok(H.A.superAt === 'gone' && H.B.next.knockdown, 'Overdrive ends it, knocks down and is used up')
  const deck = base({ hand: [SHOT] }, { hand: [GUARD] }).A.deck.length
  let D = startClash16(base({ hand: [SHOT] }, { hand: [GUARD] }), SHOT, GUARD, false, ['draw', undefined])
  ok(D.A.hand.length === 1 && D.A.deck.length === deck - 1, 'or draws a card')
}
// 4. Riders fire only on the clash card: a Wind-Up played as a follow-up gains nothing
{
  let G = startClash16(base({ hand: [GUARD, WIND] }, { hand: [JAB] }), GUARD, JAB)
  ok(G.pending?.stage === 'follow' && G.pending.options.includes(WIND), 'Guard beats Jab: Wind-Up can follow up')
  G = decideClash16(G, WIND)
  ok(G.A.meter === 0, 'no meter from a follow-up')
}
// 5. Parry: any attack as the follow-up, and it can combo; Brace: no follow-up, the Build bounces back
{
  let G = startClash16(base({ hand: [PARRY, JAB, SWING] }, { hand: [SLASH] }), PARRY, SLASH)
  ok(G.pending?.stage === 'follow' && G.pending.options.includes(JAB), 'Parry: Jab (no Counter icon) can follow up')
  G = decideClash16(G, JAB)
  ok(G.pending?.stage === 'link' || G.pending?.stage === 'end', 'and starts a combo')
  let H = startClash16(base({ hand: [BRACE, THROW] }, { hand: [SLASH], pile: 0 }), BRACE, SLASH)
  ok(!H.pending && H.B.pile === 4 && H.clash.winner === 0, `Brace beats Slash: no follow-up, Slash's Build 4 goes on their pile (${H.B.pile})`)
}
// 6. A played special goes back to the table (not the discard); so does a Confiscated one
{
  let G = startClash16(base({ hand: [RISE] }, { hand: [THROW] }), RISE, THROW)
  while (G.pending) G = decideClash16(G, null)
  G = startDraw16(G)
  ok(G.A.table.includes(RISE) && !G.A.discard.some(d => d.i === RISE), 'Rising Strike is back on the table')
  const W = Wd, BG = F
  let H = newGame16(W, BG, rules, 9)
  H = { ...H, B: { ...H.B, hand: [RISE, JAB, JAB], table: [BREAK], owe: 1 } }
  H = confiscate16(H, 1, [RISE])
  ok(H.B.table.includes(RISE) && !H.B.discard.some(d => d.i === RISE), 'a Confiscated special goes back to the table')
}
// 7. Knockdown is Lock Pressure next round
{
  let G = base({ hand: [SWEEP] }, { hand: [THROW] })
  G = startClash16(G, SWEEP, THROW)
  ok(G.B.next.knockdown, 'Sweep knocks down')
  G = finishRound16({ ...G, pending: null })
  ok(G.B.st.lock?.P, 'the knocked-down player has Pressure Locked')
  G = startClash16({ ...G, A: { ...G.A, hand: [GUARD] }, B: { ...G.B, hand: [JAB] } }, GUARD, JAB)
  ok(G.clash.voided[1], 'their Jab is voided')
}
// 8. The time-out: no reshuffle; a deck run out ends the game at the end of the round, higher HP winning
{
  let G = base({ hand: [JAB], deck: [JAB], hp: 20 }, { hand: [GUARD], deck: [GUARD, GUARD, GUARD], hp: 25 })
  G = startClash16(G, JAB, GUARD)
  while (G.pending) G = decideClash16(G, null)
  G = startDraw16(G)
  ok(G.phase === 'over' && G.timedOut && G.result === 0, `A drew their last card: time-out, B (more HP) wins (${G.phase}, ${G.result})`)
  let H = base({ hand: [], deck: [], discard: [{ i: JAB }] }, {})
  H = startDraw16({ ...H, clash: { done: true } })
  ok(H.A.hand.length === 0, 'an empty deck never reshuffles')
}
// 8b. A Recover with noFollow gives no follow-up; Recall brings a card back from the discard pile
{
  const C4 = toFighter16(read('../data/v18/variants/benchmark-core4a.json'))
  const C2 = toFighter16(read('../data/v18/variants/benchmark-core2.json'))
  const ix = (f, n) => f.cards.findIndex(c => c.name === n)
  let G = newGame16(C2, C2, rules, 7)
  G = { ...G, init: 0, A: { ...G.A, hand: [ix(C2, 'Charge'), ix(C2, 'Throw')] }, B: { ...G.B, hand: [ix(C2, 'Jab')] } }
  G = startClash16(G, ix(C2, 'Charge'), ix(C2, 'Jab'))
  ok(G.clash.winner === 0 && !G.pending && G.A.meter === 2, 'a no-follow-up Charge beats Jab, gains 2 meter, offers no follow-up')
  let H = newGame16(C4, C4, rules, 7)
  const REC = ix(C4, 'Recall'), SWG = ix(C4, 'Big Swing'), GRD = ix(C4, 'Charge')
  H = { ...H, init: 0, A: { ...H.A, hand: [REC], discard: [{ i: SWG }, { i: GRD }] }, B: { ...H.B, hand: [ix(C4, 'Throw')] } }
  ok(recallModes18(H.A, true).length === 1 && recallModes18(H.A).length === 2, 'attacks-only Recall can only take the attack')
  H = startClash16(H, REC, ix(C4, 'Throw'), false, [{ recall: SWG }, undefined])
  ok(H.A.hand.includes(SWG) && !H.A.discard.some(d => d.i === SWG), 'Recall puts Big Swing back in hand, even when it loses')
  let bad = false
  try { startClash16({ ...H, A: { ...H.A, hand: [REC], discard: [{ i: GRD }] } }, REC, ix(C4, 'Throw'), false, [{ recall: GRD }, undefined]) } catch { bad = true }
  ok(bad, "attacks-only Recall can't take a Recover")
}
// 9. Whole games finish, with riders firing and the time-out sometimes deciding
{
  let timeouts = 0, takes = 0, meter = 0, games = 0
  for (let s = 0; s < 10; s++) {
    const g = playGame18(s % 2 ? W3 : F3, F3, { rules, W: W18, levels: ['hard', 'hard'], seed: 80 + s })
    games++
    ok(g.result === 0 || g.result === 1 || g.result === 0.5, 'game finishes')
    ok(g.rounds.length <= 19, `no game outlasts the deck (${g.rounds.length} rounds)`)
    if (g.timedOut) timeouts++
    for (const r of g.rounds) for (const e of r.reveals) { if (e.what === 'take' || e.what === 'recall') takes++; if (e.what === 'meter') meter += e.n }
  }
  ok(takes > 0 && meter > 0, `the default decks' riders fire: ${meter} meter gained, ${takes} cards taken or recalled in ${games} games`)
}

// 10. The v18 partner: one solve over the dealt hands, both hands hidden, known cards kept
{
  let rs = 99; const r = () => (rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648
  let gapA = 0, gapB = 0, same = 0
  for (let t = 0; t < 300; t++) {
    const K = 1 + Math.floor(r() * 5), n = 1 + Math.floor(r() * 6)
    const Ms = Array.from({ length: K }, () => { const c = 1 + Math.floor(r() * 6); return Array.from({ length: n }, () => Array.from({ length: c }, () => r())) })
    const a = bayesMaximin(Ms)
    gapA = Math.max(gapA, Math.abs(Ms.reduce((s, M) => s + worstCase(M, a.x), 0) / K - a.v))
    if (K === 1) same = Math.max(same, Math.abs(maximin(Ms[0]).v - a.v))
    const g = bayesGame([Ms])
    gapB = Math.max(gapB, Math.abs(g.v - a.v))
  }
  ok(gapA < 1e-7, `bayesMaximin: its mix guarantees its value (gap ${gapA})`)
  ok(same < 1e-7, 'bayesMaximin with one game is maximin')
  ok(gapB < 1e-7, 'bayesGame with one hand of ours is bayesMaximin')
  // a game where hiding our hand matters: knowing it, they'd always guard against our one Convert
  const hid = bayesGame([[[[0.9, 0.1], [0.4, 0.6]]], [[[0.4, 0.6], [0.9, 0.1]]]])
  ok(hid.v > 0.5, `hiding which hand we hold is worth something (${hid.v.toFixed(3)})`)
  // known cards stay in every dealt hand
  const REC = F3.cards.findIndex(c => c.name === 'Recall'), SHOT = F3.cards.findIndex(c => c.name === 'Shot')
  let G = newGame16(F3, F3, rules, 11)
  G = { ...G, init: 0, A: { ...G.A, hand: [REC, ...G.A.hand.filter(i => i !== REC).slice(0, 4)], discard: [{ i: SHOT }] } }
  G = startClash16(G, REC, G.B.hand[0], false, [{ recall: SHOT }, undefined])
  ok((G.A.known || []).includes(SHOT) && hiddenSplit(G.A).known.includes(SHOT), 'a recalled card is known to be in hand')
  ok(!hiddenSplit(G.A).pool.includes(SHOT) || G.A.deck.includes(SHOT) || G.A.hand.filter(i => i === SHOT).length > 1, "the known copy isn't also dealt at random")
  const mix = clashMix16(G, 1, W18, () => 0.5)
  ok(Math.abs(mix.x.reduce((s, v) => s + v, 0) - 1) < 1e-9 && mix.util.length === mix.options.length, 'the new partner returns a full mix and a value for each card')
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
