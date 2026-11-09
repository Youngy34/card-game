// Rule checks for rules v20 (heat, 9 Nov): your heat is the pile on your opponent; it stops at your own cap and
// past it lands as straight damage; a Break that wins the clash spends it all; a Guard that beats your Pressure
// douses it; 1 heat each a round; no meter: at the end of the round, in initiative order, one card each from the
// table (a special for 3 heat, the Super at max heat for all of it); Read just draws; the core is Recall and Read.
//   node tools/test20.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, cardLines16, TEXT16, useHeatWords, LABEL16, KINDS16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, startDraw16, readModes18, heatOf, ownCap, buyOptions20, buy20, applyBuy20, capOf, discardDown16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, chooseBuy20, botBuy20 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../data/v20/settings.json')
const rules = { ...S.rules }, W = { ...DEFAULT_W16, ...S.ai }
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const names = ['benchmark', 'warden', 'vex', 'bastion', 'atlas']
const J = Object.fromEntries(names.map(n => [n, read(`../data/v20/${n}.json`)]))

// 0. The decks: 26 cards, the core Recall x3 and Read x3, no Charge, specials with no meter
for (const n of names) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  const deck = f.cards.filter(c => !c.special).reduce((s, c) => s + c.copies, 0)
  ok(deck === 26, `${n}: 26 cards (${deck})`)
  const core = f.cards.filter(c => c.core).map(c => `${c.name}x${c.copies}`).join(' ')
  ok(core === 'Recallx3 Readx3', `${n}: core Recall x3, Read x3 (${core})`)
  ok(!f.cards.some(c => c.reveal?.meter), `${n}: no Charge`)
  ok(f.greyCap > 0, `${n}: prints its own heat cap`)
}
const id = (f, n) => f.cards.findIndex(c => c.name === n)
const BM = toFighter16(J.benchmark), AT = toFighter16(J.atlas), VX = toFighter16(J.vex)
const [JAB, LUNGE, SLASH, SHOT, THROW, SWING, WIND, RECALL, READ, RISE, BREAK] = ['Jab', 'Lunge', 'Slash', 'Shot', 'Throw', 'Big Swing', 'Wind-Up', 'Recall', 'Read', 'Rising Strike', 'Breaker'].map(n => id(BM, n))
const base = (fa, fb, patchA = {}, patchB = {}, init = 0) => {
  const G = newGame16(fa, fb, rules, 5)
  return { ...G, init, A: { ...G.A, ...patchA }, B: { ...G.B, ...patchB } }
}

// 1. Caps: the pile on you is the opponent's heat, so it stops at their cap
{
  const G = newGame16(VX, AT, rules, 3)
  ok(capOf(G.A, rules) === J.atlas.greyCap && capOf(G.B, rules) === J.vex.greyCap, `the pile on Vex stops at Atlas's cap, the pile on Atlas at Vex's (${capOf(G.A, rules)}, ${capOf(G.B, rules)})`)
  ok(ownCap(G.A, rules) === J.vex.greyCap && ownCap(G.B, rules) === J.atlas.greyCap, 'each fighter\'s own cap')
  ok(G.A.meter === 0 && !G.A.hand.concat(G.A.deck).some(i => G.A.f.cards[i].reveal?.meter), 'no meter, no Charge')
}
// 2. A winning Pressure builds the winner's heat; past the winner's own cap it lands as damage
{
  let G = startClash16(base(BM, BM, { hand: [LUNGE] }, { hand: [THROW] }), LUNGE, THROW)
  ok(heatOf(G, 0) === BM.cards[LUNGE].build && heatOf(G, 1) === 0, `Lunge beats Throw: +${BM.cards[LUNGE].build} heat for the winner (${heatOf(G, 0)})`)
  const cap = ownCap(G.A, rules)
  G = startClash16(base(BM, BM, { hand: [SLASH] }, { hand: [THROW], pile: cap - 1, hp: 20 }), SLASH, THROW)
  const build = BM.cards[SLASH].build, chip = BM.cards[SLASH].chip
  ok(heatOf(G, 0) === cap && G.B.hp === 20 - chip - (build - 1), `at ${cap - 1} heat, Slash (Build ${build}) fills to the cap and ${build - 1} lands as damage (HP ${G.B.hp})`)
  const ev = G.clash.events.find(e => e.kind === 'hit')
  ok(ev.spill === build - 1, 'the event records the overflow')
}
// 3. Low and high caps: Vex's heat stops at 8, Atlas's at 10
{
  const fang = id(VX, 'Twin Fang'), sm = id(AT, 'Earthsplitter')
  const G = startClash16(base(VX, AT, { hand: [fang] }, { hand: [sm], pile: J.vex.greyCap, hp: 30 }), fang, sm)
  ok(heatOf(G, 0) === J.vex.greyCap && G.B.hp < 30 - VX.cards[fang].chip, `Vex at max: Twin Fang's whole Build lands on Atlas as damage (${30 - G.B.hp})`)
  const H = startClash16(base(AT, VX, { hand: [id(AT, 'Overhead')] }, { hand: [id(VX, 'Undercut')], pile: J.vex.greyCap }), id(AT, 'Overhead'), id(VX, 'Undercut'))
  ok(heatOf(H, 0) === Math.min(J.atlas.greyCap, J.vex.greyCap + AT.cards[id(AT, 'Overhead')].build), `Atlas holds more: ${heatOf(H, 0)} of ${J.atlas.greyCap}`)
}
// 4. A Break that beats a Guard spends all the winner's heat, plus chip; a Guard that beats a Pressure douses the attacker's
{
  let G = startClash16(base(BM, BM, { hand: [SWING] }, { hand: [RECALL], pile: 7, hp: 25 }), SWING, RECALL)
  ok(heatOf(G, 0) === 0 && G.B.hp === 25 - 7 - BM.cards[SWING].chip, `Big Swing beats Recall: 7 heat spent plus ${BM.cards[SWING].chip} chip (${25 - G.B.hp})`)
  G = startClash16(base(BM, BM, { hand: [LUNGE] }, { hand: [RECALL, LUNGE], pile: 6 }), LUNGE, RECALL)
  ok(heatOf(G, 0) === 0, 'Recall beats Lunge: Lunge\'s owner\'s 6 heat is doused')
  ok(G.pending?.stage === 'follow' && G.pending.side === 1, 'and the Guard may follow up')
  G = startClash16(base(BM, BM, { hand: [RECALL], pile: 4 }, { hand: [READ], pile: 5 }), RECALL, READ)
  ok(G.A.pile === 0 && G.B.pile === 0, 'two Guards douse each other\'s heat')
}
// 5. Read just draws
{
  const G = base(BM, BM, { hand: [READ] }, { hand: [JAB], pile: 9 })
  ok(JSON.stringify(readModes18(G.A)) === '["draw"]', 'Read just draws, whatever the heat')
  const H = startClash16(G, READ, JAB)
  ok(H.A.hand.length === 1 && H.clash.events.some(e => e.what === 'draw'), 'Read drew a card')
}
// 6. The end of the round: 1 heat each, then the shop in initiative order (holder first), one card each
{
  let G = base(BM, BM, { hand: [JAB, JAB, SHOT], pile: 2, used: [] }, { hand: [THROW], pile: 8, used: [] }, 1)
  G = { ...G, phase: 'draw', clash: null }
  G = startDraw16(G)
  ok(heatOf(G, 0) === 9 && heatOf(G, 1) === 3, `1 heat each (${heatOf(G, 0)}, ${heatOf(G, 1)})`)
  ok(G.phase === 'buy' && G.buying === 1, `the holder (side 1) buys first (${G.phase}, ${G.buying})`)
  ok(JSON.stringify(buyOptions20(G, 1)) === JSON.stringify([null, RISE, BREAK]), `side 1 at 3 heat: nothing, or a special (${JSON.stringify(buyOptions20(G, 1))})`)
  ok(buyOptions20(G, 0).includes('S'), 'side 0 at max heat (9): the Super is on offer')
  let caught = false; try { buy20(G, 0, RISE) } catch { caught = true }
  ok(caught, 'side 0 can\'t buy before the holder')
  G = buy20(G, 1, BREAK)
  ok(heatOf(G, 1) === 0 && G.B.hand.includes(BREAK) && !G.B.table.includes(BREAK), 'side 1 bought Breaker for 3 heat: in hand, off the table')
  ok(G.phase === 'buy' && G.buying === 0, 'then side 0')
  G = buy20(G, 0, 'S')
  ok(heatOf(G, 0) === 0 && G.A.superAt === 'hand', 'side 0 bought the Super with all 9 heat')
  ok(G.bought[0]?.sup && G.bought[0].cost === 9 && G.bought[1]?.name === 'Breaker', 'the purchases are recorded')
  ok(G.phase !== 'buy', `the shop closes (${G.phase})`)
}
// 7. Not enough heat, or a KO at the end of the round: no shop
{
  let G = base(BM, BM, { pile: 0, used: [] }, { pile: 0, used: [] }, 0)
  G = startDraw16({ ...G, phase: 'draw', clash: null })
  ok(G.phase !== 'buy', `1 heat each is too little to buy: no shop (${G.phase})`)
  // the first v20 page (roundHeatCaps off): the round's heat past the cap lands as damage, and a KO then closes the shop
  let H = newGame16(BM, BM, { ...rules, roundHeatCaps: false }, 5)
  H = { ...H, init: 0, A: { ...H.A, pile: 9, used: [], hp: 1 }, B: { ...H.B, pile: 2, used: [] }, phase: 'draw', clash: null }
  H = startDraw16(H)
  ok(H.phase === 'over' && H.result === 0, `round heat as damage: past side 1's cap it KOs side 0, and the shop doesn't open (${H.phase}, ${H.result})`)
  // as written (9 Nov, Mark): the round's heat stops at the cap; at max it does nothing
  let K = base(BM, BM, { pile: 9, used: [], hp: 1 }, { pile: 2, used: [] }, 0)
  ok(rules.roundHeatCaps === true, 'v20 settings: the round\'s heat stops at the cap')
  K = startDraw16({ ...K, phase: 'draw', clash: null })
  ok(K.A.hp === 1 && heatOf(K, 1) === 9 && K.result === null, `at max, the round's heat does nothing (HP ${K.A.hp}, heat ${heatOf(K, 1)})`)
}
// 8. A special leaves your hand back to the table; the Super is used once
{
  let G = base(BM, BM, { hand: [RISE], table: [BREAK] }, { hand: [THROW] })
  G = startClash16(G, RISE, THROW)
  while (G.pending) G = decideClash16(G, null)
  G = startDraw16(G)
  while (G.phase === 'buy') G = buy20(G, G.buying, null)
  ok(G.A.table.includes(RISE), 'Rising Strike went back to the table once played')
}
// 9. The partner shops, and whole games run with it
{
  let G = base(BM, BM, { pile: 0, used: [] }, { pile: 8, used: [] }, 0)
  G = startDraw16({ ...G, phase: 'draw', clash: null })
  const r = () => 0.42
  const c = chooseBuy20(G, G.buying, W, r)
  ok(c === null || buyOptions20(G, G.buying).includes(c), `the partner picks a legal option (${c})`)
  ok(botBuy20(G, G.buying, 'pressure', r) === RISE, 'bots take the first special they can pay for')
  ok(applyBuy20(G, G.buying, RISE).B.pile === 6, 'a look-ahead purchase pays without moving the round on')
  let spent = 0, games = 0, timeouts = 0
  for (let s = 1; s <= 4; s++) {
    const g = playGame18(BM, toFighter16(J.warden), { rules, W, seed: s })
    games++; if (g.timedOut) timeouts++
    for (const rd of g.rounds) for (const b of rd.bought || []) if (b) spent += b.cost
    ok(g.result !== null, `game ${s} ends (${g.result}, ${g.rounds.length} rounds)`)
  }
  ok(spent > 0, `heat was spent at the table (${spent} over ${games} games)`)
}
// 10. The page's words: Pressure, Break, Guard; Read just draws; prices in heat
{
  ok(!TEXT16.heat && LABEL16.C === 'Convert', 'other editions keep their words')
  useHeatWords(rules)
  ok(LABEL16.C === 'Break' && LABEL16.R === 'Guard' && KINDS16.guardBreak.label === 'Heavy' && KINDS16.guard.label === 'Block', 'heat words: Break, Guard; Heavy, Block')
  const t = cardLines16(J.benchmark.cards.find(c => c.name === 'Read'))
  ok(t.text[0] === 'On reveal: draw a card.', `Read: ${t.text[0]}`)
  const sp = cardLines16(J.benchmark.cards.find(c => c.name === 'Breaker'))
  ok(sp.cost.join(' ').includes('3 heat'), `a special costs 3 heat (${sp.cost})`)
  const su = cardLines16(J.benchmark.super, { isSuper: true })
  ok(su.cost.join(' ').includes('All your heat'), `the Super costs all your heat (${su.cost})`)
}
console.log(`${passes}/${passes + fails} pass`)
process.exit(fails ? 1 : 0)
