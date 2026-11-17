// Rule checks for charge up and the fighter abilities (17 Nov, claude/fighter abilities and charge up (17 Nov).md),
// edition data/v23ab: charge up (discard an attack, gain its Charge); Clinch (the Brawler: a Guard that beats a Pressure
// at Close knocks them down); Zone (the Zoner: at Far, set a Pressure face down; a move to Close before the end of the
// next round sets it off for its Damage).
//   node tools/test23ab.mjs
import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, buyOptions20, applyBuy20, startDraw16, finishRound16, heatOf } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const S = read('../data/v23ab/settings.json'), rules = { ...S.rules }
ok(rules.chargeUp && rules.overdriveSpeed && rules.knockdownNoOption && !rules.exchange, 'v23ab: charge up, EX Overdrive, the new knockdown')
const J = { brawler: read('../data/v23ab/brawler.json'), zoner: read('../data/v23ab/zoner.json') }
for (const n of ['brawler', 'zoner']) ok(!validateFighter16(J[n]).errors.length, `${n} validates ${JSON.stringify(validateFighter16(J[n]).errors)}`)
ok(validateFighter16({ ...J.brawler, ability: 'flight' }).errors.length > 0, 'an unknown ability is refused')
const BR = toFighter16(J.brawler), ZO = toFighter16(J.zoner)
ok(BR.ability === 'clinch' && ZO.ability === 'zone', 'abilities load')
const id = (f, n) => f.cards.findIndex(c => c.name === n), b = n => id(BR, n), z = n => id(ZO, n)
const base = (handA, handB, range, init = 0) => { const G = newGame16(BR, ZO, rules, 5); return { ...G, init, range, A: { ...G.A, at: range, hand: handA }, B: { ...G.B, at: range, hand: handB } } }

// 1. Clinch: a Brawler Guard beats a Pressure at Close: knockdown, even against Safe; not at Far
{
  const g = startClash16(base([b('Block')], [z('Shot')], 'close'), b('Block'), z('Shot'))
  ok(g.clash.winner === 0 && g.B.next.knockdown, 'Clinch: Block beats Shot at Close, the Zoner is knocked down')
  const g2 = startClash16(base([b('Block')], [z('Poke')], 'close'), b('Block'), z('Poke'))
  ok(g2.B.next.knockdown, 'Clinch works against a Safe Pressure (Poke)')
  const g3 = startClash16(base([b('Block')], [z('Shot')], 'far'), b('Block'), z('Shot'))
  ok(g3.clash.winner === 0 && !g3.B.next.knockdown, 'no Clinch at Far')
  const g4 = startClash16(base([b('Hook')], [z('Block')], 'close', 1), b('Hook'), z('Block'))
  ok(g4.clash.winner === 1 && !g4.A.next.knockdown, 'the Zoner has no Clinch')
  const g5 = startClash16(base([b('Step In')], [z('Fade Shot')], 'close'), b('Step In'), z('Fade Shot'))
  ok(g5.B.next.knockdown && g5.range === 'close', 'Step In beats Fade Shot at Close: knockdown, and it stays Close')
}
// 2. Charge up: discard an attack, gain its Charge (up to the cap); Guards can't be burned
{
  let G = startDraw16(startClash16(base([b('Haymaker'), b('Block'), b('Jab')], [z('Block')], 'far'), null, z('Block')))
  const o = buyOptions20(G, 0)
  ok(o.includes(`U:${b('Haymaker')}`) && o.includes(`U:${b('Jab')}`) && !o.includes(`U:${b('Block')}`), `charge up offered for attacks only (${o.join(',')})`)
  const before = heatOf(G, 0), hand = (G.A.hand.filter(i => i === b('Haymaker')).length)
  const g2 = applyBuy20(G, 0, `U:${b('Haymaker')}`)
  ok(heatOf(g2, 0) === before + 2 && g2.A.hand.filter(i => i === b('Haymaker')).length === hand - 1 && g2.A.discard.some(d => d.i === b('Haymaker')), 'Haymaker burned for 2 Charge')
  const full = { ...G, B: { ...G.B, pile: 5 } }
  ok(heatOf(applyBuy20(full, 0, `U:${b('Haymaker')}`), 0) === 6, 'charge up stops at the cap (6)')
  const off = { ...G, rules: { ...G.rules, chargeUp: false } }
  ok(!buyOptions20(off, 0).some(x => String(x).startsWith('U:')), 'no charge up without the rule')
}
// 3. Zone: set at Far; a move to Close (an attack's ending, a Charge move) sets it off; it expires after the next round
{
  let G = startDraw16(startClash16(base([b('Block')], [z('Shot'), z('Block')], 'far'), b('Block'), z('Block')))
  ok(buyOptions20(G, 1).includes(`Z:${z('Shot')}`) && !buyOptions20(G, 0).some(x => String(x).startsWith('Z:')), 'the Zoner can Zone at Far; the Brawler can\'t')
  const shots = G.B.hand.filter(i => i === z('Shot')).length
  let g = applyBuy20(G, 1, `Z:${z('Shot')}`)
  ok(g.B.zone === z('Shot') && g.B.hand.filter(i => i === z('Shot')).length === shots - 1, 'the zone is set, out of the hand')
  // a Charge move to Close sets it off: 2 Damage to the Brawler
  const hp = g.A.hp, gm = applyBuy20({ ...g, B: { ...g.B, pile: 2 } }, 0, 'M')
  ok(gm.range === 'close' && gm.A.hp === hp - 2 && gm.B.zone == null && gm.B.discard.some(d => d.zone), `moving to Close into the zone: 2 Damage (${hp} → ${gm.A.hp})`)
  // an attack's ending: Dash Punch lands from Far
  const gz = { ...g, A: { ...g.A, hand: [b('Dash Punch')] }, B: { ...g.B, hand: [z('Charged Blast')] }, phase: 'clash' }
  const hp2 = gz.A.hp, gc = startClash16(gz, b('Dash Punch'), z('Charged Blast'))
  ok(gc.range === 'close' && gc.A.hp === hp2 - 2 && gc.B.zone == null, 'Dash Punch lands from Far into the zone: it hits')
  const gs = { ...G, range: 'close', A: { ...G.A, at: 'close' }, B: { ...G.B, at: 'close' } }
  ok(!buyOptions20(gs, 1).some(x => String(x).startsWith('Z:')), 'no Zone at Close')
  // expiry: set in round R, still there after R ends, gone after R+1 ends
  const r = g.round, e1 = finishRound16({ ...g, discardDown: [0, 0] })
  ok(e1.B.zone === z('Shot'), 'the zone lasts into the next round')
  const e2 = finishRound16({ ...e1, discardDown: [0, 0] })
  ok(e2.B.zone == null && e2.B.discard.some(d => d.zone), 'and ends after it')
}
// 4. Knocked down: no charge up, no Zone
{
  const g = startDraw16(startClash16(base([b('Block'), b('Haymaker')], [z('Shot'), z('Arc Shot')], 'close'), b('Block'), z('Shot')))
  ok(buyOptions20(g, 1).length === 1, 'the Clinched Zoner has no end-of-round option')
}
// 5. Whole games: charge up, Clinch and Zone all happen
{
  let cu = 0, zs = 0, zh = 0, cl = 0
  const W = { ...DEFAULT_W16, ...S.ai }
  for (let s = 1; s <= 20; s++) {
    const g = playGame18(BR, ZO, { rules, W, seed: s, onRound: (rec, G) => { for (const e of G.clash.events) { if (e.kind === 'zoneHit') zh++; if (e.clinch) cl++ } } })
    for (const r of g.rounds) for (const k of [0, 1]) { if (r.bought?.[k]?.chargeUp) cu++; if (r.bought?.[k]?.zone) zs++ }
    ok(g.result !== null, `game ${s} finishes`)
  }
  ok(cu > 5 && zs > 3 && cl > 2, `20 games: ${cu} charge ups, ${zs} zones set, ${zh} zone hits in clashes, ${cl} Clinches`)
  console.log(`(20 games: ${cu} charge ups, ${zs} zones set, ${zh} zone hits in clashes, ${cl} Clinches)`)
}
console.log(`${passes}/${passes + fails} pass`)
process.exit(fails ? 1 : 0)
