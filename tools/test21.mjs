// Rule checks for rules v21 (10 Nov): v20 with nine Guards (Recall x3, Read x3 and the fighter's own Guard x3),
// 28-card decks, two Guards doing nothing, three specials on the table (one of each type), and the own Guards'
// effects, which fire only when the Guard beats a Pressure: Confiscate (Bind, Iron Grip), a follow-up through Safe
// (Slip), a follow-up that can start a combo (Afterimage), heat from the blocked Pressure's Build (Take the Hit).
//   node tools/test21.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, cardLines16, useHeatWords } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, heatOf, capOf } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../data/v21/settings.json')
const rules = { ...S.rules }, W = { ...DEFAULT_W16, ...S.ai }
useHeatWords(rules)
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const names = ['benchmark', 'warden', 'vex', 'bastion', 'atlas']
const J = Object.fromEntries(names.map(n => [n, read(`../data/v21/${n}.json`)]))
const OWN = { benchmark: 'Block', warden: 'Bind', vex: 'Slip', bastion: 'Repulse', atlas: 'Take the Hit' }

// 0. The decks: 28 cards, nine Guards (Recall x3, Read x3, the fighter's own x3), three specials (one of each type), a Super
for (const n of names) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  const deck = f.cards.filter(c => !c.special)
  ok(deck.reduce((s, c) => s + c.copies, 0) === 28, `${n}: 28 cards`)
  const guards = deck.filter(c => c.type === 'recover').map(c => `${c.name}x${c.copies}`).sort().join(' ')
  ok(guards === [`Recallx3`, `Readx3`, `${OWN[n]}x3`].sort().join(' '), `${n}: nine Guards (${guards})`)
  const sp = f.cards.filter(c => c.special).map(c => c.type).sort().join(' ')
  ok(sp === 'convert pressure recover', `${n}: a special of each type (${sp})`)
  ok(!!f.super, `${n}: a Super`)
  ok(deck.every(c => c.copies <= 3), `${n}: at most 3 of a card`)
}
const F = Object.fromEntries(names.map(n => [n, toFighter16(J[n])]))
const id = (f, n) => f.cards.findIndex(c => c.name === n)
const base = (fa, fb, patchA = {}, patchB = {}, init = 0) => {
  const G = newGame16(fa, fb, rules, 5)
  return { ...G, init, A: { ...G.A, ...patchA }, B: { ...G.B, ...patchB } }
}
const BM = F.benchmark
const [JAB, LUNGE, SLASH, RECALL, BLOCK, READ] = ['Jab', 'Lunge', 'Slash', 'Recall', 'Block', 'Read'].map(n => id(BM, n))

// 1. Two Guards do nothing: both players keep their heat
{
  const G = startClash16(base(BM, BM, { hand: [BLOCK], pile: 4 }, { hand: [BLOCK], pile: 3 }), BLOCK, BLOCK)
  ok(G.clash.outcome === 'guards' && heatOf(G, 0) === 3 && heatOf(G, 1) === 4, `two Guards: heat kept (${heatOf(G, 0)}, ${heatOf(G, 1)})`)
  const R2 = { ...rules, guardsQuiet: false }
  const g = newGame16(BM, BM, R2, 5)
  const H = startClash16({ ...g, init: 0, A: { ...g.A, hand: [BLOCK], pile: 4 }, B: { ...g.B, hand: [BLOCK], pile: 3 } }, BLOCK, BLOCK)
  ok(heatOf(H, 0) === 0 && heatOf(H, 1) === 0, 'with the switch off, two Guards douse each other (v20)')
}
// 2. A Guard still douses a Pressure it beats; Block does nothing more
{
  const G = startClash16(base(BM, BM, { hand: [BLOCK, SLASH] }, { hand: [LUNGE], pile: 0 }, 0), BLOCK, LUNGE)
  ok(G.clash.winner === 0 && G.pending?.stage === 'follow', 'Block beats Lunge and may follow up')
}
// 3. Bind: Confiscate 1 when it beats a Pressure; nothing when it loses
{
  const WD = F.warden, BIND = id(WD, 'Bind')
  let G = startClash16(base(WD, BM, { hand: [BIND] }, { hand: [LUNGE, JAB, SLASH, RECALL, READ] }), BIND, LUNGE)
  ok(G.B.owe === 1, `Bind beats Lunge: they owe 1 (${G.B.owe})`)
  const THR = id(BM, 'Throw')
  G = startClash16(base(WD, BM, { hand: [BIND] }, { hand: [THR, JAB, SLASH, RECALL, READ] }), BIND, THR)
  ok(!G.B.owe, 'Bind beaten by a Break: no Confiscate')
  const GRIP = id(WD, 'Iron Grip')
  G = startClash16(base(WD, BM, { hand: [GRIP] }, { hand: [LUNGE, JAB, SLASH, RECALL, READ] }), GRIP, LUNGE)
  ok(G.B.owe === 2, `Iron Grip: they owe 2 (${G.B.owe})`)
}
// 4. Slip follows up through a Safe Pressure; Read doesn't
{
  const VX = F.vex, SLIP = id(VX, 'Slip'), RD = id(VX, 'Read'), FANG = id(VX, 'Fang Rush')
  let G = startClash16(base(VX, BM, { hand: [SLIP, FANG] }, { hand: [JAB] }), SLIP, JAB)
  ok(G.pending?.stage === 'follow', 'Slip beats a Safe Jab: Vex may still follow up')
  G = startClash16(base(VX, BM, { hand: [RD, FANG] }, { hand: [JAB] }), RD, JAB)
  ok(!G.pending, 'Read beats a Safe Jab: no follow-up')
}
// 5. Afterimage: the follow-up can start a combo (Pressure line)
{
  const VX = F.vex, AI = id(VX, 'Afterimage'), FANG = id(VX, 'Fang Rush'), TWIN = id(VX, 'Twin Fang'), SLIP = id(VX, 'Slip')
  let G = startClash16(base(VX, BM, { hand: [AI, FANG, TWIN] }, { hand: [LUNGE] }), AI, LUNGE)
  ok(G.pending?.stage === 'follow', 'Afterimage beats Lunge: follow-up')
  G = decideClash16(G, FANG)
  ok(G.pending?.stage === 'link' && G.pending.options.includes(TWIN), 'the follow-up (Fang Rush, a Starter) opens a combo')
  let H = startClash16(base(VX, BM, { hand: [SLIP, FANG, TWIN] }, { hand: [LUNGE] }), SLIP, LUNGE)
  H = decideClash16(H, FANG)
  ok(!H.pending, 'after Slip, the follow-up does not combo')
}
// 6. Take the Hit: heat equal to the blocked Pressure's Build, up to Atlas's cap, no damage from it
{
  const AT = F.atlas, TAKE = id(AT, 'Take the Hit')
  let G = startClash16(base(AT, BM, { hand: [TAKE] }, { hand: [SLASH], pile: 0 }), TAKE, SLASH)
  ok(heatOf(G, 0) === BM.cards[SLASH].build, `Take the Hit beats Slash: +${BM.cards[SLASH].build} heat (${heatOf(G, 0)})`)
  const cap = capOf(newGame16(AT, BM, rules, 1).B, rules)
  G = startClash16(base(AT, BM, { hand: [TAKE] }, { hand: [SLASH], pile: cap - 1, hp: 20 }), TAKE, SLASH)
  ok(heatOf(G, 0) === cap && G.B.hp === 20, `near the cap: stops at ${cap}, no damage (heat ${heatOf(G, 0)}, HP ${G.B.hp})`)
  const THR = id(BM, 'Throw')
  G = startClash16(base(AT, BM, { hand: [TAKE] }, { hand: [THR], pile: 0 }), TAKE, THR)
  ok(heatOf(G, 0) === 0, 'beaten by a Break: no heat')
}
// 7. Card text
{
  const t = n => cardLines16(J[n].cards.find(c => c.name === OWN[n])).text.join(' ')
  ok(/Confiscate/.test(t('warden')), 'Bind says Confiscate')
  ok(/Safe/.test(t('vex')), 'Slip mentions Safe')
  ok(/heat equal/.test(t('atlas')), 'Take the Hit says heat')
  ok(/combo/.test(cardLines16(J.vex.cards.find(c => c.name === 'Afterimage')).text.join(' ')), 'Afterimage says combo')
}
// 8. Whole games run in every matchup
for (const a of names) for (const b of names) {
  const g = playGame18(F[a], F[b], { rules, W, levels: ['hard', 'hard'], seed: 7 })
  ok(g.result !== null && g.rounds.length > 3, `${a} v ${b} plays to a result`)
}
console.log(`${passes}/${passes + fails} pass`)
process.exit(fails ? 1 : 0)
