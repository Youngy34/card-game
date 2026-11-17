// Rule checks for the new test fighters (17 Nov, claude/new test fighters (17 Nov).md), edition data/v23tf:
//   the new knockdown (knockdownNoOption): knocked down this round, you take no end-of-round option, so no move and no
//   Overdrive (you flip back); in your next clash you lose every speed clash; then it's over;
//   Step In / Sidestep (guardTo): a Guard that beats a Pressure ends the fight at its range, overriding the on-block range;
//   Catch (followAny): its follow-up can be any Pressure in reach, not just a Counter.
//   node tools/test23tf.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, cardLines16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, buyOptions20, startDraw16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }

const S = read('../data/v23tf/settings.json'), rules = { ...S.rules }
ok(rules.knockdownNoOption && rules.knockdownSlow && !rules.exchange && rules.rangeStart === 'far', 'v23tf: new knockdown, no exchange, starts at Far')
const J = { brawler: read('../data/v23tf/brawler.json'), zoner: read('../data/v23tf/zoner.json') }
for (const n of ['brawler', 'zoner']) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  ok(f.cards.reduce((s, c) => s + c.copies, 0) === 30, `${n}: 30 cards`)
  const att = f.cards.filter(c => c.type !== 'recover')
  const live = r => att.filter(c => c.reach === 'both' || c.reach === r).reduce((s, c) => s + c.copies, 0)
  ok(n === 'brawler' ? live('close') === 21 && live('far') === 12 : live('far') === 18 && live('close') === 15, `${n}: live attacks by range`)
}
ok(validateFighter16({ ...J.brawler, cards: [...J.brawler.cards, { name: 'Bad', type: 'pressure', kind: 'strike', speed: 12, build: 1, chip: 1, copies: 1, reach: 'both', guardTo: 'far' }] }).errors.length > 0, 'guardTo on an attack is refused')
ok(cardLines16(J.brawler.cards.find(c => c.name === 'Step In')).text.some(l => /ends at Close/.test(l)), 'Step In card text')
ok(cardLines16(J.brawler.cards.find(c => c.name === 'Catch')).text.some(l => /any Pressure/.test(l)), 'Catch card text')

const BR = toFighter16(J.brawler), ZO = toFighter16(J.zoner)
const id = (f, n) => { const i = f.cards.findIndex(c => c.name === n); if (i < 0) throw new Error(n); return i }
const b = n => id(BR, n), z = n => id(ZO, n)
const base = (handA, handB, range, init = 0) => {
  const G = newGame16(BR, ZO, rules, 5)
  return { ...G, init, range, A: { ...G.A, at: range, hand: handA }, B: { ...G.B, at: range, hand: handB } }
}

// 1. Step In beats a Fade Shot at Close: the fight stays at Close (Fade Shot would have ended it at Far)
{
  const g = startClash16(base([b('Step In')], [z('Fade Shot')], 'close'), b('Step In'), z('Fade Shot'))
  ok(g.clash.winner === 0 && g.range === 'close', `Step In beats Fade Shot at Close: stays Close (${g.range})`)
  const g2 = startClash16(base([b('Block')], [z('Fade Shot')], 'close'), b('Block'), z('Fade Shot'))
  ok(g2.clash.winner === 0 && g2.range === 'far', `Block beats Fade Shot at Close: Far, its on-block range (${g2.range})`)
}
// 2. Step In beats a Pressure at Far: the fight ends at Close, and the follow-up is played at Close (Hook reaches)
{
  const g = startClash16(base([b('Step In'), b('Hook')], [z('Shot')], 'far'), b('Step In'), z('Shot'))
  ok(g.clash.winner === 0 && g.range === 'close', `Step In at Far: Close (${g.range})`)
  ok(g.pending?.stage === 'follow' && g.pending.options.includes(b('Hook')), 'the follow-up is at Close: Hook is offered')
}
// 3. Sidestep beats a Dash Punch at Far: stays Far (Dash Punch would have ended it at Close)
{
  const g = startClash16(base([b('Dash Punch')], [z('Sidestep')], 'far', 1), b('Dash Punch'), z('Sidestep'))
  ok(g.clash.winner === 1 && g.range === 'far', `Sidestep beats Dash Punch at Far: stays Far (${g.range})`)
  const g2 = startClash16(base([b('Haymaker')], [z('Sidestep'), z('Arc Shot')], 'close', 1), b('Haymaker'), z('Sidestep'))
  ok(g2.clash.winner === 1 && g2.range === 'far', `Sidestep beats Haymaker at Close: Far (${g2.range})`)
  ok(g2.pending?.options?.includes(z('Arc Shot')), 'the follow-up is at Far: Arc Shot (Far only) is offered')
}
// 4. Catch: any Pressure in reach can follow up (Haymaker isn't a Counter); Block offers only Counters
{
  const g = startClash16(base([b('Catch'), b('Haymaker'), b('Jab')], [z('Shot')], 'close'), b('Catch'), z('Shot'))
  ok(g.pending?.stage === 'follow' && g.pending.options.includes(b('Haymaker')) && g.pending.options.includes(b('Jab')), 'Catch offers Haymaker and Jab')
  ok(!g.pending.options.includes(b('Body Slam')), 'Catch offers no Breaks')
  const g2 = startClash16(base([b('Block'), b('Haymaker')], [z('Shot')], 'close'), b('Block'), z('Shot'))
  ok(!g2.pending, 'Block with only a Haymaker: no follow-up')
  const g3 = startClash16(base([b('Catch'), b('Haymaker')], [z('Poke')], 'close'), b('Catch'), z('Poke'))
  ok(!g3.pending, 'Catch against a Safe Pressure (Poke): no follow-up')
  const g4 = startClash16(base([b('Catch'), b('Jab'), b('Haymaker')], [z('Shot')], 'far'), b('Catch'), z('Shot'))
  ok(g4.pending?.options?.includes(b('Haymaker')) && !g4.pending.options.includes(b('Jab')), 'Catch at Far: Haymaker, not Jab (out of reach)')
}
// 5. The new knockdown: a Throw lands; the thrown player has no end-of-round option, the thrower does
{
  let G = base([b('Throw')], [z('Block'), z('Poke')], 'close')
  G = { ...G, A: { ...G.A, pile: 4 }, B: { ...G.B, pile: 4 } }            // both have 4 Charge (each player's Charge is the pile on the other)
  let g = startClash16(G, b('Throw'), z('Block'))
  ok(g.clash.winner === 0 && g.B.next.knockdown, 'Throw beats Block: the Zoner is knocked down')
  g = startDraw16(g)
  ok(buyOptions20(g, 1).length === 1 && buyOptions20(g, 1)[0] === null, `the knocked-down Zoner has no option (${JSON.stringify(buyOptions20(g, 1))})`)
  ok(buyOptions20(g, 0).includes('M') && buyOptions20(g, 0).includes('O'), 'the thrower can move or Overdrive')
  const off = { ...g, rules: { ...g.rules, knockdownNoOption: false } }
  ok(buyOptions20(off, 1).includes('M'), 'without the rule, the thrown player could move')
}
// 6. Whole games run, with knockdowns and the Guard lines firing; a knocked-down player never takes the option
{
  let kd = 0, guardTo = 0, bad = 0, n = 0
  for (let s = 1; s <= 30; s++) {
    const g = playGame18(BR, ZO, { rules, seed: s, onRound: (rec, G) => { for (const e of G.clash.events) if (e.kind === 'guardTo') guardTo++ } })
    n++
    for (const r of g.rounds || []) for (const k of [0, 1]) if ((r.statuses?.[k] || []).includes('Knockdown')) { kd++; if (r.bought?.[k]) bad++ }
    ok(g.result === 0 || g.result === 1 || g.result === 0.5, `game ${s} finishes`)
  }
  ok(n === 30 && kd > 20 && guardTo > 20, `30 games with knockdowns (${kd}) and Guard range lines (${guardTo})`)
  ok(bad === 0, `no knocked-down player took the end-of-round option (${bad})`)
}
console.log(`${passes}/${passes + fails} pass`)
process.exit(fails ? 1 : 0)
