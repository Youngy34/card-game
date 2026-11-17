// Rule checks for range endings (16 Nov, claude/range endings (16 Nov).md), on the v23 dial rules:
//   every attack shows where the fight ends on hit (hitTo) and, for a Pressure, if it's Guarded (blockTo);
//   a winning attack applies its on-hit range, a Guarded Pressure its on-block range, a beaten attack nothing;
//   it applies at once, so follow-ups and combo cards are played at the new range; only attacks move the fight;
//   Stand Firm (holdGround) stops a Pressure's on-block range; Evade (blockCharge) builds 2 Charge.
//   node tools/test23r.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, cardLines16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }

for (const ed of ['v23r', 'v23n']) {
  const S = read(`../data/${ed}/settings.json`)
  ok(S.rules.rangeEnds && S.rules.range && S.rules.guardDraw === 'unbeaten', `${ed}: range endings and the dial on`)
  ok(ed === 'v23r' ? S.rules.overdrive === 3 : !S.rules.overdrive, `${ed}: Overdrive ${ed === 'v23r' ? 'on' : 'off'}`)
}
const S = read('../data/v23r/settings.json')
const rules = { ...S.rules }
const J = { brawler: read('../data/v23r/brawler.json'), zoner: read('../data/v23r/zoner.json') }

// 0. Decks
for (const n of ['brawler', 'zoner']) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  ok(f.cards.reduce((s, c) => s + c.copies, 0) === 30, `${n}: 30 cards`)
  ok(!f.cards.some(c => c.move || c.blockMove), `${n}: no win-or-lose movers, no Guard that moves the fight`)
  ok(f.cards.filter(c => c.type === 'recover').reduce((s, c) => s + c.copies, 0) === 9, `${n}: 9 Guards`)
}
ok(validateFighter16({ ...J.brawler, cards: [...J.brawler.cards, { name: 'Bad', type: 'convert', kind: 'grab', speed: 5, build: 2, chip: 2, copies: 1, reach: 'close', blockTo: 'far' }] }).errors.length > 0, 'a Break with an on-block range is refused')
ok(validateFighter16({ ...J.brawler, cards: [...J.brawler.cards, { name: 'Bad', type: 'recover', kind: 'guard', copies: 1, hitTo: 'far' }] }).errors.length > 0, 'a Guard with an ending range is refused')

const BR = toFighter16(J.brawler), ZO = toFighter16(J.zoner)
const id = (f, n) => { const i = f.cards.findIndex(c => c.name === n); if (i < 0) throw new Error(n); return i }
const base = (handA, handB, range, init = 0) => {
  const G = newGame16(BR, ZO, rules, 5)
  return { ...G, init, range, A: { ...G.A, at: range, hand: handA }, B: { ...G.B, at: range, hand: handB } }
}
const b = n => id(BR, n), z = n => id(ZO, n)
ok(cardLines16(J.zoner.cards.find(c => c.name === 'Dive Kick')).text.some(l => /On hit: the fight ends at Far/.test(l)) &&
   cardLines16(J.zoner.cards.find(c => c.name === 'Dive Kick')).text.some(l => /Guarded: the fight ends at Close/.test(l)), 'card text shows both endings')

// 1. A fireball stays where it is, hit or block
{
  const g = startClash16(base([b('Block')], [z('Shot')], 'far'), b('Block'), z('Shot'))
  ok(g.clash.winner === 0 && g.range === 'far', `Shot Guarded at Far: stays Far (${g.range})`)
  const g2 = startClash16(base([b('Body Slam')], [z('Shot')], 'close'), b('Body Slam'), z('Shot'))
  ok(g2.clash.winner === 1 && g2.range === 'close', 'Shot lands at Close (it reaches both now): stays Close')
}
// 2. A rush from Far: Close if it lands, Close if it's Guarded, nothing if a faster attack beats it
{
  const g = startClash16(base([b('Dash Punch')], [z('Block')], 'far'), b('Dash Punch'), z('Block'))
  ok(g.clash.winner === 1 && g.range === 'close', `Dash Punch Guarded from Far: Close (${g.range})`)
  const g2 = startClash16(base([b('Dash Punch')], [z('Charged Blast')], 'far'), b('Dash Punch'), z('Charged Blast'))
  ok(g2.clash.winner === 0 && g2.range === 'close', 'Dash Punch lands from Far: Close')
  const g3 = startClash16(base([b('Dash Punch')], [z('Poke')], 'far'), b('Dash Punch'), z('Poke'))
  ok(g3.clash.winner === 1 && g3.range === 'far', `Dash Punch beaten by a faster Poke: stays Far (${g3.range})`)
}
// 3. Knockback: Haymaker sends them to Far on hit, nothing on block
{
  const g = startClash16(base([b('Haymaker')], [z('Throw')], 'close'), b('Haymaker'), z('Throw'))
  ok(g.clash.winner === 0 && g.range === 'far', `Haymaker lands at Close: Far (${g.range})`)
  const g2 = startClash16(base([b('Haymaker')], [z('Block')], 'close'), b('Haymaker'), z('Block'))
  ok(g2.clash.winner === 1 && g2.range === 'close', 'Haymaker Guarded: stays Close')
  const g3 = startClash16(base([b('Suplex')], [z('Block')], 'close'), b('Suplex'), z('Block'))
  ok(g3.clash.winner === 0 && g3.range === 'far', 'Suplex (a Break) beats a Guard: Far')
}
// 4. The superman-punch pattern (Dive Kick): Far on hit, Close if Guarded
{
  const g = startClash16(base([b('Block'), b('Hook')], [z('Dive Kick')], 'far'), b('Block'), z('Dive Kick'))
  ok(g.clash.winner === 0 && g.range === 'close', `Dive Kick Guarded: Close (${g.range})`)
  // and the Guard's follow-up is played at the new range: a Close-only Counter is offered
  ok(g.pending?.stage === 'follow' && g.pending.options.includes(b('Hook')), 'after the block moves it to Close, Hook (Close only) can follow up')
  const g2 = startClash16(base([b('Leaping Slam')], [z('Dive Kick')], 'far'), b('Leaping Slam'), z('Dive Kick'))
  ok(g2.clash.winner === 1 && g2.range === 'far', 'Dive Kick lands: Far')
}
// 5. Breaks reel in on hit (Harpoon), and a Break that's beaten does nothing
{
  const g = startClash16(base([b('Block')], [z('Harpoon')], 'far'), b('Block'), z('Harpoon'))
  ok(g.clash.winner === 1 && g.range === 'close', 'Harpoon beats a Guard at Far: Close')
  const g2 = startClash16(base([b('Dash Punch')], [z('Harpoon')], 'far'), b('Dash Punch'), z('Harpoon'))
  ok(g2.clash.winner === 0 && g2.range === 'close', 'Harpoon beaten by Dash Punch: the winner decides (Close)')
  const g3 = startClash16(base([b('Leaping Slam')], [z('Poke')], 'far'), b('Leaping Slam'), z('Poke'))
  ok(g3.clash.winner === 1 && g3.range === 'far', 'Leaping Slam beaten by a Pressure: stays Far')
}
// 6. No cancelling: two movers, the winner's applies
{
  const g = startClash16(base([b('Dash Punch')], [z('Fade Shot')], 'close', 1), b('Dash Punch'), z('Fade Shot'))
  ok(g.clash.winner === 1 && g.range === 'far', `Fade Shot wins the tie (initiative): Far (${g.range})`)
  const g2 = startClash16(base([b('Dash Punch')], [z('Fade Shot')], 'far', 0), b('Dash Punch'), z('Fade Shot'))
  ok(g2.clash.winner === 0 && g2.range === 'close', 'Dash Punch wins the tie: Close')
}
// 7. Stand Firm holds its ground; Block doesn't
{
  const g = startClash16(base([b('Stand Firm')], [z('Fade Shot')], 'close'), b('Stand Firm'), z('Fade Shot'))
  ok(g.clash.winner === 0 && g.range === 'close', `Stand Firm beats Fade Shot: stays Close (${g.range})`)
  ok(g.clash.events.some(e => e.kind === 'holdGround'), 'Stand Firm logs holding its ground')
  const g2 = startClash16(base([b('Block')], [z('Fade Shot')], 'close'), b('Block'), z('Fade Shot'))
  ok(g2.clash.winner === 0 && g2.range === 'far', 'Block beats Fade Shot: Far (the Pressure was Guarded)')
}
// 8. Evade builds 2 Charge if it beats a Pressure (the Zoner's Charge is the pile on the Brawler)
{
  const G = base([b('Jab')], [z('Evade')], 'close')
  const g = startClash16(G, b('Jab'), z('Evade'))
  ok(g.clash.winner === 1 && g.A.pile === G.A.pile + 2, `Evade beats Jab: +2 Charge (${G.A.pile} to ${g.A.pile})`)
  const G2 = { ...G, A: { ...G.A, pile: 7 } }               // the Zoner's cap is 8
  ok(startClash16(G2, b('Jab'), z('Evade')).A.pile === 8, 'Evade stops at the cap')
  const g3 = startClash16(base([b('Throw')], [z('Evade')], 'close'), b('Throw'), z('Evade'))
  ok(g3.A.pile === 0, 'Evade beaten by a Break: no Charge')
}
// 9. Combos: a rush-in Starter from Far opens Close-only Linkers; a combo card's ending applies as it lands
{
  const g = startClash16(base([b('Dash Punch'), b('Jab'), b('Uppercut')], [z('Charged Blast')], 'far'), b('Dash Punch'), z('Charged Blast'))
  ok(g.range === 'close' && g.pending?.stage === 'link' && g.pending.options.includes(b('Jab')), 'Dash Punch from Far into a Close-only Jab')
  const g2 = decideClash16(g, b('Jab'))
  ok(g2.pending?.stage === 'end' && g2.pending.options.includes(b('Uppercut')), 'then a Close-only Uppercut to end')
  const h = startClash16(base([b('Body Slam')], [z('Poke'), z('Hop Kick')], 'close'), b('Body Slam'), z('Poke'))
  ok(h.clash.winner === 1 && h.pending?.side === 1, 'Poke beats Body Slam and may combo')
  let h2 = h.pending.stage === 'link' ? decideClash16(h, null) : h
  h2 = decideClash16(h2, z('Hop Kick'))
  ok(h2.range === 'far', `Poke into Hop Kick (Ender, Far on hit): Far (${h2.range})`)
}
// 10. Whole games run, with and without Overdrive
for (const ed of ['v23r', 'v23n']) {
  const S2 = read(`../data/${ed}/settings.json`), W = { ...DEFAULT_W16, ...S2.ai }
  const F = [toFighter16(read(`../data/${ed}/brawler.json`)), toFighter16(read(`../data/${ed}/zoner.json`))]
  let done = 0, moved = 0
  for (let s = 1; s <= 6; s++) {
    const r = playGame18(F[s % 2], F[1 - s % 2], { rules: { ...S2.rules }, W, seed: s, levels: ['hard', s % 3 ? 'hard' : 'random'] })
    if (r.result !== null) done++
    moved += (r.rounds || []).filter(x => x.rangeAt && x.range !== x.rangeAt).length
  }
  ok(done === 6, `${ed}: 6 games finish (${done})`)
  ok(moved > 0, `${ed}: the fight moves (${moved} range changes in 6 games)`)
}

console.log(`${passes}/${passes + fails} pass`)
if (fails) process.exit(1)
