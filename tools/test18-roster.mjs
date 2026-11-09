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
const want = { vex: [30, 13, 6, 7, 8], bastion: [36, 9, 8, 9, 13], atlas: [38, 11, 8, 7, 8] }     // Bastion: HP 36 since the afternoon of 8 Nov
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

{
  const w = read('../data/v18/warden.json'), own = w.cards.filter(x => !x.special)
  ok(!validateFighter16(w).errors.length && own.reduce((s, x) => s + x.copies, 0) === 26, 'the Warden is 26 cards (8 Nov), like the others')
  ok(own.find(x => x.name === 'Haul In')?.copies === 1 && own.find(x => x.name === 'Ankle Hook')?.copies === 3, 'his two new cards: Haul In and a third Ankle Hook')
  const toss = own.find(x => x.name === 'Chain Toss')
  ok(toss?.safe === true && !(toss.icons || []).length && toss.build === 3 && toss.chip === 2, 'Chain Toss is Safe, with no icons, Build 3, chip 2 (like Shot)')
  const combo = w.cards.concat([w.super]).flatMap(x => (x.icons || []).filter(i => i !== 'counter').map(i => `${x.name}:${i}`)).sort().join()
  ok(combo === 'Ankle Hook:linker,Chain Lash:starter,Coil:ender', `the Warden has one combo route: Chain Lash, Ankle Hook, Coil (${combo})`)
  ok(w.cards.concat([w.super]).filter(x => x.kind === 'grab').map(x => x.chip).join() === '3,3,4,3,3,4', 'his grabs +1 chip: 3, or 4 on Coil and Chain Prison')
  const bas = read('../data/v18/bastion.json').cards
  ok(bas.find(x => x.name === 'Lockdown')?.onHit === 'knockdown' && bas.find(x => x.name === 'Shield Bash')?.icons.includes('linker') && bas.find(x => x.name === 'Rim Shot')?.build === 4, "Bastion's better attacks: Lockdown knocks down, Shield Bash links, Rim Shot Build 4")
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

// 8. The grey cap (test switch): a pile that reaches it at the end of the round is cashed
{
  const capRules = { ...rules, greyCap: 9 }
  const mk = (pa, pb) => { const G = newGame16(BM, BM, capRules, 3); return { ...G, phase: 'clash', A: { ...G.A, ...pa }, B: { ...G.B, ...pb } } }
  const JAB = id(BM, 'Jab'), REC = id(BM, 'Recall')
  let G = startClash16(mk({ hand: [REC], pile: 7, hp: 30 }, { hand: [JAB], pile: 2 }), REC, JAB)
  ok(G.A.pile === 0, 'Recall beat Jab: the pile of 7 is cleared')
  G = startClash16(mk({ hand: [JAB], pile: 0, hp: 30 }, { hand: [JAB], pile: 8, hp: 30 }), JAB, JAB)
  const before = G.B.pile
  G = startDraw16(G)
  ok(before === 8 && G.B.pile === 0 && G.B.hp === 30 - 9 && G.capCash?.[1] === 9, `a pile of 8 plus the round's grey reaches 9 and is cashed for 9 (HP ${G.B.hp}, pile ${G.B.pile})`)
  ok(G.A.pile > 0 && G.A.pile < 9 && G.capCash?.[0] === 0, `the other pile, under the cap, stays (${G.A.pile})`)
  G = startClash16(mk({ hand: [JAB], hp: 30 }, { hand: [JAB], pile: 9, hp: 5 }), JAB, JAB)
  G = startDraw16(G)
  ok(G.result === 1 && G.phase === 'over', `a cap cash that KOs ends the game (result ${G.result})`)
  G = startDraw16(startClash16({ ...mk({ hand: [JAB] }, { hand: [JAB], pile: 12 }), rules }, JAB, JAB))
  ok(G.B.pile >= 13 && !G.capCash?.[1], 'with no cap, a big pile stays')
}

// 8b. Overflow cap and cash-on-win (test switches, 8 Nov evening)
{
  const oRules = { ...rules, greyCap: 9, greyOverflow: true }
  const mk = (r, pa, pb, fa = BM, fb = BM) => { const G = newGame16(fa, fb, r, 3); return { ...G, phase: 'clash', A: { ...G.A, ...pa }, B: { ...G.B, ...pb } } }
  const JAB = id(BM, 'Jab'), SLASH = id(BM, 'Slash'), BIG = id(BM, 'Big Swing'), THROW = id(BM, 'Throw'), REC = id(BM, 'Recall')
  // a Pressure that takes the pile past the cap: the pile stops at 9, the rest is lost as HP now
  let G = startClash16(mk(oRules, { hand: [SLASH], hp: 30 }, { hand: [THROW], pile: 8, hp: 30 }), SLASH, THROW)
  const jab = BM.cards[JAB], sl = BM.cards[SLASH], over = 8 + sl.build - 9
  ok(over > 0 && G.B.pile === 9 && G.B.hp === 30 - sl.chip - over, `Slash on a pile of 8: pile ${G.B.pile}, HP ${G.B.hp} (chip ${sl.chip} + ${over} spilled)`)
  const spilled = G.clash.events.find(e => e.kind === 'hit')?.spill
  ok(spilled === over, `the hit records the spill (${spilled})`)
  // the round's grey on a full pile spills too, and the pile stays at the cap
  G = startDraw16(startClash16(mk(oRules, { hand: [JAB], hp: 30 }, { hand: [JAB], pile: 9, hp: 30 }, ), JAB, JAB))
  ok(G.B.pile === 9 && G.capSpill?.[1] === 1 && !G.capCash?.[1], `a full pile takes the round's grey as 1 HP and stays at 9 (pile ${G.B.pile}, spill ${G.capSpill?.[1]})`)
  // a winning Convert still takes the whole pile
  G = startClash16(mk(oRules, { hand: [THROW], hp: 30 }, { hand: [REC], pile: 9, hp: 30 }), THROW, REC)
  ok(G.B.pile === 0 && G.B.hp === 30 - 9 - BM.cards[THROW].chip, `Throw beats Recall on a full pile: all 9 cashed (HP ${G.B.hp})`)
  // a fighter's own cap
  const low = toFighter16({ ...read('../data/v18/benchmark.json'), greyCap: 6 })
  G = startClash16(mk(oRules, { hand: [JAB], hp: 30 }, { hand: [THROW], pile: 5, hp: 30 }, BM, low), JAB, THROW)
  ok(G.B.pile === 6, `a fighter with cap 6 stops at 6 (pile ${G.B.pile})`)
  G = startClash16(mk({ ...rules, greyCap: 0 }, { hand: [JAB], hp: 30 }, { hand: [THROW], pile: 5, hp: 30 }, BM, low), JAB, THROW)
  ok(G.B.pile === 5 + jab.build, `with the rule's cap off, a fighter's own cap does nothing (pile ${G.B.pile})`)
  G = startDraw16(startClash16(mk({ ...rules, greyCap: 9 }, { hand: [JAB] }, { hand: [JAB], pile: 6, hp: 30 }, BM, low), JAB, JAB))
  ok(G.capCash?.[1] > 0 && G.B.pile === 0, `cash-mode cap uses the fighter's own cap (cashed ${G.capCash?.[1]})`)
  // cash-on-win: a Convert Ender only deals its damage
  const wRules = { ...oRules, cashOnWin: true }
  for (const [r, cashes] of [[oRules, true], [wRules, false]]) {
    G = startClash16(mk(r, { hand: [JAB, BIG], hp: 30 }, { hand: [THROW], pile: 4, hp: 30 }), JAB, THROW)
    while (G.pending) G = decideClash16(G, G.pending.options.includes(BIG) ? BIG : null)
    const end = G.clash.combo.find(x => x.name === 'Big Swing')
    const pile = 4 + jab.build
    ok(!!end && (cashes ? G.B.pile === 0 : G.B.pile === pile), `Jab → Big Swing, cashOnWin ${!!r.cashOnWin}: pile after ${G.B.pile}`)
  }
  G = startClash16(mk(wRules, { hand: [THROW], hp: 30 }, { hand: [REC], pile: 6, hp: 30 }), THROW, REC)
  ok(G.B.pile === 0, 'cashOnWin: a Convert that wins the clash still cashes')
}

// 8c. The v19 set (8 Nov evening): no Convert links or ends a combo; each fighter's cap; the page's rules
{
  const S19 = read('../data/v19/settings.json').rules
  ok(S19.greyCap === 9 && S19.greyOverflow === true && S19.cashOnWin === true && S19.comboSameType === true, 'v19 settings: cap 9, overflow, Converts cash only on a win, two combo lines')
  const want19 = { benchmark: [32, 9], warden: [31, 9], vex: [32, 7], bastion: [36, 6], atlas: [34, 12] }
  const lines19 = { benchmark: 'Big Swing>Wind-Up', warden: 'Haul In>Coil', vex: 'Undercut,Cross-Up>Pommel Strike', bastion: 'Shoulder Ram>Shield Slam', atlas: 'Shoulder Check>Hammer Spin' }
  for (const [n, [hp, cap]] of Object.entries(want19)) {
    const f = read(`../data/v19/${n}.json`), v = validateFighter16(f)
    const all = [...f.cards, ...(f.super ? [f.super] : [])]
    // the night's two lines: each fighter's Convert line is one Starter (or two, Vex) into one Ender, no Linkers, and no grabs but the Warden's
    const cv = all.filter(c => c.type === 'convert'), names = k => cv.filter(c => (c.icons || []).includes(k)).map(c => c.name).join(',')
    const line = `${names('starter')}>${names('ender')}`
    ok(!v.errors.length, `v19 ${n} validates`)
    ok(line === lines19[n] && !names('linker'), `v19 ${n}: Convert line ${line} (want ${lines19[n]}), no Convert Linkers`)
    ok(n === 'warden' || !cv.some(c => c.kind === 'grab' && (c.icons || []).some(i => ['starter', 'linker', 'ender'].includes(i))), `v19 ${n}: no grab in a combo`)
    ok(f.hp === hp && (f.greyCap || 9) === cap, `v19 ${n}: HP ${f.hp} (want ${hp}), cap ${f.greyCap || 9} (want ${cap})`)
    ok(all.some(c => c.type === 'pressure' && (c.icons || []).includes('starter')), `v19 ${n} still has a Starter`)
  }
  const g = playGame18(toFighter16(read('../data/v19/bastion.json')), toFighter16(read('../data/v19/atlas.json')), { rules: { ...rules, ...S19 }, W: W18, seed: 4 })
  const maxPile = Math.max(...g.rounds.flatMap(r => [r.after[0].pile, r.after[1].pile].map((p, k) => p - [6, 12][k])))
  ok(g.result !== null && maxPile <= 0, `a v19 game: Bastion's pile never passes 6, Atlas's never 12 (worst ${maxPile} over)`)
}

// 8d. Same-type combo lines (test switch comboSameType, 8 Nov night): Pressures into Pressures, Converts into Converts
{
  const LB = toFighter16(read('../data/v19/variants/lines/benchmark.json'))
  const S19 = { ...rules, ...read('../data/v19/settings.json').rules, comboSameType: true }
  const mk = (pa, pb) => { const G = newGame16(LB, LB, S19, 3); return { ...G, phase: 'clash', A: { ...G.A, ...pa }, B: { ...G.B, ...pb } } }
  const BIG = id(LB, 'Big Swing'), WIND = id(LB, 'Wind-Up'), SWEEP = id(LB, 'Sweep'), JAB = id(LB, 'Jab'), SLASH = id(LB, 'Slash'), REC = id(LB, 'Recall'), THROW = id(LB, 'Throw')
  ok(LB.cards[BIG].starter && LB.cards[WIND].ender && !LB.cards[THROW].starter, 'the line Benchmark: Big Swing a Starter, Wind-Up an Ender, Throw (a grab) neither')
  // a Convert Starter that beats a Guard: offered Wind-Up only (not Sweep, a Pressure Ender)
  let G = startClash16(mk({ hand: [BIG, WIND, SWEEP, SLASH], hp: 30 }, { hand: [REC], pile: 6, hp: 30 }), BIG, REC)
  ok(G.pending && G.pending.stage === 'end' && G.pending.options.includes(WIND) && !G.pending.options.includes(SWEEP), `Big Swing beats Recall: the Ender offered is Wind-Up, not Sweep (${JSON.stringify(G.pending?.options)})`)
  const hpAfterCash = G.B.hp
  ok(G.B.pile === 0 && hpAfterCash === 30 - 6 - LB.cards[BIG].chip, `Big Swing cashes the 6 (HP ${hpAfterCash})`)
  G = decideClash16(G, WIND)
  ok(G.B.hp === hpAfterCash - LB.cards[WIND].chip, `Wind-Up as the Ender deals its ${LB.cards[WIND].chip} (HP ${G.B.hp})`)
  // a Pressure Starter: Pressure Linkers and Enders only
  G = startClash16(mk({ hand: [JAB, SLASH, WIND, SWEEP], hp: 30 }, { hand: [THROW], hp: 30 }), JAB, THROW)
  ok(G.pending?.stage === 'link' && G.pending.options.includes(SLASH) && !G.pending.options.includes(WIND), 'Jab beats Throw: Linkers offered are Pressures')
  G = decideClash16(G, SLASH)
  ok(G.pending?.stage === 'end' && G.pending.options.includes(SWEEP) && !G.pending.options.includes(WIND), `then the Ender offered is Sweep, not Wind-Up (${JSON.stringify(G.pending?.options)})`)
  // with the switch off, a Pressure Starter could end on Wind-Up
  G = startClash16({ ...mk({ hand: [JAB, WIND], hp: 30 }, { hand: [THROW], hp: 30 }), rules: { ...S19, comboSameType: false } }, JAB, THROW)
  ok(G.pending?.options?.includes(WIND), 'without the switch, Jab could end on Wind-Up')
}

// 8e. The page's Linker step offers Enders too (9 Nov, Mark: an Ender can follow the Starter or a Linker, and always ends the combo)
{
  const M = await import('../src/app/v16/match16.js')
  const S19 = read('../data/v19/settings.json')
  const fj = read('../data/v19/benchmark.json')
  let m = M.startMatch16({ fighters: [fj, fj], mode: 'ai', settings: { rules: { ...rules, ...S19.rules }, ai: W18 }, seed: 11 })
  const LB = toFighter16(fj), JAB = id(LB, 'Jab'), SLASH = id(LB, 'Slash'), SWEEP = id(LB, 'Sweep'), WIND = id(LB, 'Wind-Up'), THROW = id(LB, 'Throw'), BIG = id(LB, 'Big Swing'), REC = id(LB, 'Recall')
  const at = (ha, hb, a, b) => { const G0 = m.G; const G = startClash16({ ...G0, phase: 'clash', A: { ...G0.A, hand: ha, hp: 30 }, B: { ...G0.B, hand: hb, hp: 30, pile: 4 } }, a, b); return { ...m, G, phase: 'stage', decisions: { ...(m.decisions || {}), stages: [] } } }
  let s = at([JAB, SLASH, SWEEP, WIND], [THROW], JAB, THROW)
  let o = M.stageOptions(s)
  ok(s.G.pending?.stage === 'link' && o.link.includes(SLASH) && o.end.includes(SWEEP) && !o.end.includes(WIND), `after Jab: Slash to carry on, or Sweep to finish (not Wind-Up, a Convert) ${JSON.stringify(o)}`)
  let after = M.chooseStageCard(s, SWEEP)
  const combo = after.G.clash?.combo || after.last?.clash?.combo || []
  ok(combo.length === 1 && combo[0].name === 'Sweep' && combo[0].stage === 'end' && after.phase !== 'stage', `Jab → Sweep straight away ends the combo (${JSON.stringify(combo)}, phase ${after.phase})`)
  after = M.stopCombo(at([JAB, SLASH, SWEEP], [THROW], JAB, THROW))
  ok(after.phase !== 'stage' && !(after.G.clash?.combo || after.last?.clash?.combo || []).length, '"Stop here" ends it with nothing played')
  s = at([BIG, WIND, SWEEP], [REC], BIG, REC)
  ok(s.G.pending?.stage === 'end' && s.G.pending.options.includes(WIND) && !s.G.pending.options.includes(SWEEP), 'Big Swing beats Recall: the Ender step, Wind-Up only (no Convert Linkers to offer)')
}

// 9. Whole games run for every pairing, inside the time-out
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
