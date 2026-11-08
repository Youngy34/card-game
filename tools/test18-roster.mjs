// Rule checks for the 8 November v18 roster drafts (characters v18 draft.md): Vex, Bastion and Atlas,
// and the card text they brought: Twin (a second copy of a Linker), a Convert Starter, Recovers that
// put a status on a Pressure they beat (onBlock), and specials that are Recovers.
//   node tools/test18-roster.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, validateCard16, cardLines16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, startDraw16, clashChoices16, speedOf } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, bestChoice16 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const rules = { ...read('../data/v18/settings.json').rules }
const W18 = { ...DEFAULT_W16, ...read('../data/v18/settings.json').ai }
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }

// 1. The three fighters validate, with the draft's numbers
const want = { vex: [30, 13, 6, 7, 8], bastion: [32, 9, 8, 9, 13], atlas: [38, 11, 8, 7, 8] }
for (const [n, [hp, p, c, r, ct]] of Object.entries(want)) {
  const f = read(`../data/v18/${n}.json`)
  const v = validateFighter16(f)
  ok(!v.errors.length && !v.warnings.length, `${n} validates ${JSON.stringify(v)}`)
  const own = f.cards.filter(x => !x.special), cnt = t => own.filter(x => x.type === t).reduce((s, x) => s + x.copies, 0)
  const counters = own.filter(x => (x.icons || []).includes('counter')).reduce((s, x) => s + x.copies, 0)
  ok(f.hp === hp && cnt('pressure') === p && cnt('convert') === c && cnt('recover') === r && counters === ct,
    `${n}: HP ${f.hp}, P/C/R ${cnt('pressure')}/${cnt('convert')}/${cnt('recover')}, ${counters} Counters`)
  ok(f.cards.filter(x => x.special).length === 2 && f.super, `${n}: two specials and a Super`)
}
{
  ok(validateCard16({ name: 'X', type: 'recover', kind: 'guard', copies: 1, onBlock: 'dizzy' }).errors.some(e => /Dizzy/.test(e)), 'Dizzy on a Recover that isn\'t a Super is refused')
  ok(validateCard16({ name: 'X', type: 'pressure', kind: 'strike', speed: 15, build: 2, copies: 1, onBlock: 'staggered' }).errors.length > 0, 'onBlock on a Pressure is refused')
  ok(validateCard16({ name: 'X', type: 'pressure', kind: 'strike', speed: 15, build: 2, copies: 1, icons: ['starter'], twin: true }).errors.some(e => /Linker/.test(e)), 'Twin on a card that isn\'t a Linker is refused')
  ok(!validateCard16({ name: 'X', type: 'recover', kind: 'guard', copies: 1, special: true, meter: 1, onBlock: 'knockdown' }).errors.length, 'a Recover special is allowed')
  ok(validateCard16({ name: 'X', type: 'recover', kind: 'guard', copies: 1, special: true, meter: 1, reveal: { meter: 2 } }).errors.length > 0, 'a Recover special with a core rider is refused')
}

const V = toFighter16(read('../data/v18/vex.json')), B = toFighter16(read('../data/v18/bastion.json')), A = toFighter16(read('../data/v18/atlas.json'))
const BM = toFighter16(read('../data/v18/benchmark.json'))
const id = (f, n) => { const i = f.cards.findIndex(c => c.name === n); if (i < 0) throw new Error(`${f.name} has no ${n}`); return i }
const setup = (fa, fb, patchA = {}, patchB = {}, init = 0) => {
  const G = newGame16(fa, fb, rules, 7)
  return { ...G, init, A: { ...G.A, ...patchA }, B: { ...G.B, ...patchB } }
}

// 2. Twin: Fang Rush beats a Convert; Twin Fang, a second Twin Fang, then Pommel Strike
{
  const RUSH = id(V, 'Fang Rush'), TWIN = id(V, 'Twin Fang'), POM = id(V, 'Pommel Strike'), CROSS = id(V, 'Crossing Slash'), SWING = id(BM, 'Big Swing')
  let G = startClash16(setup(V, BM, { hand: [RUSH, TWIN, TWIN, TWIN, POM] }, { hand: [SWING], pile: 4, hp: 34 }), RUSH, SWING)
  ok(G.pending?.stage === 'link' && G.pending.options.includes(TWIN), 'Fang Rush beat Big Swing: a Linker is offered')
  G = decideClash16(G, TWIN)
  ok(G.pending?.stage === 'link' && G.pending.twin && G.pending.options.join() === `${TWIN}`, 'after Twin Fang, only a second Twin Fang is offered as a Linker')
  G = decideClash16(G, TWIN)
  ok(G.pending?.stage === 'end', 'after the second Twin Fang: the Ender (no third)')
  G = decideClash16(G, POM)
  // chip 1 + 1 + 1, Build 2 + 3 + 3 = 8 on a pile of 4: Pommel cashes 12 and chips 3
  ok(G.B.hp === 34 - 3 - 12 - 3 && G.B.pile === 0, `four-card Twin combo: 14 plus the pile of 4 = 18 (HP ${G.B.hp})`)
  ok(G.A.hand.filter(i => i === TWIN).length === 1 && G.clash.combo.length === 3, 'it spent both Twin Fangs and the Ender')
  G = startClash16(setup(V, BM, { hand: [RUSH, TWIN, POM] }, { hand: [SWING] }), RUSH, SWING)
  G = decideClash16(G, TWIN)
  ok(G.pending?.stage === 'end', 'one Twin Fang in hand: straight to the Ender')
  G = startClash16(setup(V, BM, { hand: [RUSH, CROSS, TWIN, POM] }, { hand: [SWING] }), RUSH, SWING)
  G = decideClash16(G, CROSS)
  ok(G.pending?.stage === 'end', 'a Linker without Twin: straight to the Ender, even holding a Twin Fang')
  G = startClash16(setup(V, BM, { hand: [RUSH, TWIN, TWIN, POM] }, { hand: [SWING] }), RUSH, SWING)
  G = decideClash16(decideClash16(G, TWIN), null)
  ok(G.pending?.stage === 'end', 'declining the second Twin Fang goes to the Ender')
  // the partner answers a Twin step with a legal choice
  G = startClash16(setup(V, BM, { hand: [RUSH, TWIN, TWIN, POM] }, { hand: [SWING], pile: 5 }), RUSH, SWING)
  G = decideClash16(G, TWIN)
  const c = bestChoice16(G, G.pending, W18)
  ok(c === null || c === TWIN, `the partner's Twin choice is legal (${c})`)
  ok(cardLines16(read('../data/v18/vex.json').cards.find(x => x.name === 'Twin Fang')).text.some(t => /Twin: in a combo, a second Twin Fang/.test(t)), 'Twin Fang\'s card text')
}

// 3. A Convert Starter: Cross-Up beats a Guard and combos
{
  const X = id(V, 'Cross-Up'), TWIN = id(V, 'Twin Fang'), POM = id(V, 'Pommel Strike'), GUARD = id(BM, 'Charge')
  let G = startClash16(setup(V, BM, { hand: [X, TWIN, POM] }, { hand: [GUARD], pile: 3, hp: 34 }), X, GUARD)
  ok(G.clash.winner === 0 && G.pending?.stage === 'link', 'Cross-Up (a Convert Starter) beat a Guard: combo')
  G = decideClash16(decideClash16(G, TWIN), POM)
  // Cross-Up cashes 3 + chip 2; Twin Fang Build 3 chip 1; Pommel cashes 3 + chip 3
  ok(G.B.hp === 34 - 5 - 1 - 6, `cash, build, cash: 12 (HP ${G.B.hp})`)
}

// 4. Recovers with a status: Repulse Staggers and still follows up; Aegis knocks down; Final Bastion Dizzies
{
  const REP = id(B, 'Repulse'), AEG = id(B, 'Aegis'), SLAM = id(B, 'Shield Slam'), JAB = id(BM, 'Jab'), LUNGE = id(BM, 'Lunge'), THROW = id(BM, 'Throw')
  let G = startClash16(setup(B, BM, { hand: [REP, SLAM] }, { hand: [LUNGE], pile: 0 }), REP, LUNGE)
  ok(G.B.next.staggered && G.pending?.stage === 'follow', 'Repulse beat Lunge: Staggered, and the Counter follow-up is offered')
  ok(G.clash.events.filter(e => e.kind === 'reveal').length === 0, 'Repulse has no core rider')
  G = startClash16(setup(B, BM, { hand: [REP, SLAM] }, { hand: [JAB] }), REP, JAB)
  ok(G.B.next.staggered && !G.pending, 'against a Safe Jab: Staggered, but no follow-up')
  G = startClash16(setup(B, BM, { hand: [REP] }, { hand: [THROW] }), REP, THROW)
  ok(!G.B.next.staggered && G.clash.winner === 1, 'Throw beats Repulse: no status')
  G = startClash16(setup(B, BM, { hand: [AEG, SLAM] }, { hand: [LUNGE] }), AEG, LUNGE)
  ok(G.B.next.knockdown && G.pending?.stage === 'follow', 'Aegis (a Recover special) beat Lunge: knocked down, and a follow-up')
  G = decideClash16(G, SLAM)
  ok(G.A.used.includes(AEG), 'Aegis was played from hand')
  G = startDraw16(G)
  ok(G.A.table.includes(AEG), 'Aegis goes back to the table after use')
  // Final Bastion: the Super, taken from the table, Dizzies a Pressure it beats
  G = startClash16(setup(B, BM, { hand: [SLAM], superAt: 'hand' }, { hand: [LUNGE, JAB] }), 'S', LUNGE)
  ok(G.B.next.dizzy && G.pending?.stage === 'follow' && G.A.superAt === 'gone', 'Final Bastion beat Lunge: Dizzy, a follow-up, and the Super is gone')
  G = decideClash16(G, SLAM)
  G = startDraw16(G)
  ok(G.B.st.dizzy && clashChoices16(G.B, rules).length === 0, 'next round the Dizzy player has no card to play')
}

// 5. Rim Shot Staggers on hit; a Staggered card is 3 slower
{
  const RIM = id(B, 'Rim Shot'), THROW = id(BM, 'Throw'), JAB = id(BM, 'Jab')
  let G = startClash16(setup(B, BM, { hand: [RIM] }, { hand: [THROW, JAB] }), RIM, THROW)
  ok(G.B.next.staggered, 'Rim Shot beat Throw: Staggered')
  G = startDraw16(G)
  ok(speedOf(G.B, BM.cards[JAB]) === 14, `Staggered, the Benchmark's Jab is 14 (${speedOf(G.B, BM.cards[JAB])})`)
}

// 6. Atlas: Earthsplitter knocks down, and a knocked-down opponent loses the next speed clash to his slow cards
{
  const ES = id(A, 'Earthsplitter'), HAFT = id(A, 'Haft Strike'), GUARD = id(BM, 'Read'), JAB = id(BM, 'Jab')
  let G = startClash16(setup(A, BM, { hand: [ES, HAFT] }, { hand: [GUARD, JAB], pile: 2, hp: 34 }), ES, GUARD)
  ok(G.B.next.knockdown && G.B.hp === 34 - 2 - 5, `Earthsplitter beat a Guard: cash 2, chip 5, Knockdown (HP ${G.B.hp})`)
  G = startDraw16(G)
  G = startClash16({ ...G, phase: 'clash' }, HAFT, JAB)
  ok(G.clash.winner === 0 && G.clash.outcome === 'speed', 'knocked down, Jab (17) loses to Haft Strike (13)')
}

// 7. Confiscate's floor is checked after the clash: Shakedown owes a card On reveal, then Vex combos her hand away
{
  const WD = toFighter16(read('../data/v18/warden.json'))
  const RUSH = id(V, 'Fang Rush'), TWIN = id(V, 'Twin Fang'), POM = id(V, 'Pommel Strike'), SHAKE = id(WD, 'Shakedown')
  let G = startClash16(setup(V, WD, { hand: [RUSH, TWIN, TWIN, POM] }, { hand: [SHAKE] }), RUSH, SHAKE)
  ok(G.A.owe === 1, `Shakedown On reveal: Vex owes 1 (holding 3 after her clash card) (${G.A.owe})`)
  G = decideClash16(decideClash16(decideClash16(G, TWIN), TWIN), POM)
  ok(G.A.hand.length === 0 && (G.A.owe || 0) === 0, `after the Twin combo she holds nothing, and owes nothing (${G.A.owe})`)
  G = startClash16(setup(V, WD, { hand: [RUSH, TWIN, POM, POM, POM] }, { hand: [SHAKE] }), RUSH, SHAKE)
  G = decideClash16(decideClash16(G, TWIN), POM)
  ok(G.A.hand.length === 2 && (G.A.owe || 0) === 0, 'a normal combo down to 2 cards: the floor holds, nothing owed')
}

// 8. Whole games run for every pairing, inside the time-out
{
  const F = { vex: V, bastion: B, atlas: A, benchmark: BM }
  let games = 0, twins = 0, blocks = 0
  for (const [a, b] of [['vex', 'benchmark'], ['bastion', 'benchmark'], ['atlas', 'benchmark'], ['vex', 'atlas'], ['atlas', 'bastion'], ['bastion', 'vex']]) {
    for (let s = 1; s <= 2; s++) {
      const g = playGame18(F[a], F[b], { rules, W: W18, seed: s })
      games++
      ok(g.result !== null && g.rounds.length <= 21, `${a} v ${b} seed ${s}: ends (${g.rounds.length} rounds)`)
      for (const r of g.rounds) { if (r.combo.filter(x => x.stage === 'link').length === 2) twins++ }
    }
  }
  ok(games === 12, '12 games played')
  console.log(`(${twins} Twin combos in ${games} games)`)
}

console.log(`${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
