// Rule checks for option B (18 Nov, claude/turns and footwork - idea ready to sim (18 Nov).md), edition data/v23turn:
// only the initiative holder takes the end-of-round turn, with two actions; footwork (move by discarding a Guard);
// at most one move and one zone a turn; Overdrive once covers one clash, twice two; a knockdown leaves one action.
//   node tools/test23turn.mjs
import fs from 'fs'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, buyOptions20, buy20, applyBuy20, startDraw16, finishRound16, heatOf, turnActionsOf } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, chooseBuy20 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const S = read('../data/v23turn/settings.json'), rules = { ...S.rules }
ok(rules.turns && rules.footwork && rules.turnActions === 2, 'v23turn: turns, footwork, two actions')
const BR = toFighter16(read('../data/v23turn/brawler.json')), ZO = toFighter16(read('../data/v23turn/zoner.json'))
const id = (f, n) => f.cards.findIndex(c => c.name === n), b = n => id(BR, n), z = n => id(ZO, n)
const base = (handA, handB, range, init = 0, R = rules) => { const G = newGame16(BR, ZO, R, 5); return { ...G, init, range, A: { ...G.A, at: range, hand: handA }, B: { ...G.B, at: range, hand: handB } } }
const endOf = (G, a, bb) => startDraw16(startClash16(G, a, bb))

// 1. Only the initiative holder buys, twice
{
  const G = endOf(base([b('Block'), b('Step In'), b('Haymaker')], [z('Block'), z('Shot'), z('Sidestep')], 'far', 0), b('Block'), z('Block'))
  ok(G.phase === 'buy' && G.buying === 0 && G.buyLeft.join() === '0,0', `holder 0 has two picks (${G.buyLeft})`)
  const G1 = endOf(base([b('Block'), b('Step In')], [z('Block'), z('Shot'), z('Sidestep')], 'far', 1), b('Block'), z('Block'))
  ok(G1.buying === 1 && G1.buyLeft.join() === '1,1', 'holder 1 buys; player 0 never does')
  // footwork offered for each Guard; Charge move absent without 2 Charge
  const o = buyOptions20(G, 0)
  ok(o.includes(`W:${b('Step In')}`) && !o.includes(`W:${b('Haymaker')}`) && !o.includes('M'), `footwork offered for Guards only (${o.join(',')})`)
  // footwork: the Guard goes, the fight moves to Close
  const n = G.A.hand.length
  let g = buy20(G, 0, `W:${b('Step In')}`)
  ok(g.range === 'close' && g.A.at === 'close' && g.B.at === 'close' && g.A.hand.length === n - 1 && g.A.discard.some(d => d.i === b('Step In')), 'footwork: Step In discarded, now Close')
  ok(g.phase === 'buy' && g.buying === 0, 'a second action is offered')
  const o2 = buyOptions20(g, 0)
  ok(!o2.some(x => x === 'M' || String(x).startsWith('W:')), `no second move in a turn (${o2.join(',')})`)
  g = buy20(g, 0, `U:${b('Haymaker')}`)
  ok(g.phase !== 'buy' && g.bought[0].acts.length === 2 && g.bought[0].move === 'close' && g.bought[0].chargeUp && g.bought[0].footwork, 'two actions recorded on one turn')
  ok(!g.bought[1], 'the other player bought nothing')
  // passing ends the turn
  const gp = buy20(G, 0, null)
  ok(gp.phase !== 'buy', 'passing ends the turn')
}
// 2. Overdrive: once covers the next clash; twice, the next two (the round finishes once the turn is over)
{
  let G = endOf(base([b('Block'), b('Jab')], [z('Block'), z('Shot')], 'close', 0), b('Block'), z('Block'))
  G = { ...G, B: { ...G.B, pile: 6 } }
  let g = buy20(G, 0, 'O')
  ok(g.phase === 'buy' && buyOptions20(g, 0).includes('O'), 'a second Overdrive action is offered')
  g = buy20(g, 0, 'O')
  ok(g.phase === 'clash' && heatOf(g, 0) === 2 && g.A.od && g.A.odNext === 1, `two Overdrive actions: 4 Charge, in Overdrive with one more clash to come (${heatOf(g, 0)}, ${g.A.odNext})`)
  const h = startDraw16(startClash16(g, g.A.hand[0], g.B.hand[0]))
  ok(h.buying !== 0 && (h.phase !== 'buy' || h.buying === 1), 'the next turn is the other player\'s')
  let f = h; while (f.phase === 'buy') f = buy20(f, f.buying, null)
  ok(f.A.od && !f.A.odNext, 'still in Overdrive for the second clash')
  let G2 = endOf(base([b('Block'), b('Jab')], [z('Block'), z('Shot')], 'close', 0), b('Block'), z('Block'))
  G2 = buy20(buy20({ ...G2, B: { ...G2.B, pile: 2 } }, 0, 'O'), 0, null)
  ok(G2.A.od && !G2.A.odNext, 'one Overdrive action: one clash')
  let f3 = startDraw16(startClash16(G2, G2.A.hand[0], G2.B.hand[0])); while (f3.phase === 'buy') f3 = buy20(f3, f3.buying, null)
  ok(!f3.A.od, 'then out of it')
}
// 3. Knockdown: one action on your next turn
{
  // Clinch: Block beats Shot at Close; the Zoner is knocked down. Zoner holds the token: one action now
  const G = endOf(base([b('Block'), b('Jab')], [z('Shot'), z('Block'), z('Sidestep'), z('Poke')], 'close', 1), b('Block'), z('Shot'))
  ok(G.B.next.knockdown && turnActionsOf(G, 1) === 1 && G.buyLeft.join() === '1', `knocked down on your turn: one action (${G.buyLeft})`)
  ok(buyOptions20(G, 1).some(x => String(x).startsWith('W:')), 'knocked down, you may still move with that action')
  // knocked down on the other player's turn: the next turn has one action
  const H = endOf(base([b('Block'), b('Jab')], [z('Shot'), z('Block'), z('Sidestep')], 'close', 0), b('Block'), z('Shot'))
  ok(H.buying === 0 && H.buyLeft.length === 2, 'the Brawler, holding the token, takes two')
  let h = buy20(H, 0, null)
  ok(h.init === 1 && h.B.st.knockdown, 'next round: the Zoner holds the token, still down')
  const h2 = endOf(h, h.A.hand[0], h.B.hand.find(i => i === z('Block')))
  ok(h2.buying === 1 && h2.buyLeft.length === 1, `that turn has one action (${h2.buyLeft})`)
}
// 4. Zone and footwork: a zone goes off when the Zoner's own footwork moves to Close
{
  let G = endOf(base([b('Block')], [z('Block'), z('Shot'), z('Sidestep')], 'far', 1), b('Block'), z('Block'))
  let g = buy20(G, 1, `Z:${z('Shot')}`)
  const hp = g.A.hp
  ok(!buyOptions20(g, 1).some(x => String(x).startsWith('Z:')), 'one zone a turn')
  g = buy20(g, 1, `W:${z('Sidestep')}`)
  ok(g.range === 'close' && g.A.hp === hp - 2 && g.B.zone == null, `zone then footwork in one turn: 2 Damage (${hp} → ${g.A.hp})`)
}
// 5. Today's rules are untouched without the switch
{
  const off = { ...rules, turns: false, footwork: false }
  const G = endOf(base([b('Block'), b('Step In')], [z('Block'), z('Sidestep'), z('Shot')], 'far', 0, off), b('Block'), z('Block'))
  ok(G.buyLeft.join() === '0,1' && !buyOptions20(G, 0).some(x => String(x).startsWith('W:')), 'without turns: both choose once, no footwork')
}
// 6. The partner plays whole games under turns
{
  const W = { ...DEFAULT_W16, ...S.ai }
  let acts = 0, two = 0, other = 0, games = 0
  for (let s = 1; s <= 6; s++) {
    const g = playGame18(BR, ZO, { rules, W, seed: s }); games++
    for (const r of g.rounds) for (const k of [0, 1]) { const bt = r.bought?.[k]; if (!bt) continue; if (k !== r.init) other++; acts++; if (bt.acts?.length === 2) two++ }
  }
  ok(other === 0, `only the holder ever acts (${other} off-turn)`)
  ok(acts > 0 && two > 0, `turns taken: ${acts}, with two actions: ${two}`)
}
console.log(`${passes} pass, ${fails} fail`)
if (fails) process.exit(1)
