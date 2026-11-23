// Checks for the both-act candidate (22 Nov): bothAct, knockdownNoOption under it, noMoveOd.
//   node tools/test23ba.mjs
import fs from 'fs'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'
import { buyOptions20 } from '../src/engine/v16/engine.js'

const root = new URL('..', import.meta.url).pathname
const S = JSON.parse(fs.readFileSync(`${root}data/v23ba/settings.json`, 'utf8'))
const fa = toFighter16(JSON.parse(fs.readFileSync(`${root}data/v23ba/brawler.json`, 'utf8')))
const fb = toFighter16(JSON.parse(fs.readFileSync(`${root}data/v23ba/zoner.json`, 'utf8')))
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const kindOf = o => (o === 'M' ? 'move' : o === 'O' ? 'od' : String(o).startsWith('U:') ? 'chargeUp' : String(o).startsWith('Z:') ? 'zone' : String(o))

for (const noMoveOd of [false, true]) {
  const rules = { ...S.rules, noMoveOd }, W = { ...DEFAULT_W16, ...S.ai }
  for (let seed = 1; seed <= 12; seed++) {
    const log = []
    // record every end-of-round pick: who, what, the round's holder, and whether the picker was knocked down this round
    const buyer = (G, k, rng) => {
      const opts = buyOptions20(G, k)
      const X = k === 0 ? G.A : G.B
      ok(!(X.next?.knockdown && opts.some(o => o !== null)), 'a knocked-down player has no actions')
      const pick = opts[Math.floor(rng() * opts.length)]
      log.push({ round: G.round, k, pick, init: G.init })
      return pick
    }
    const g = playGame18(fa, fb, { rules, W, seed, buyers: [buyer, buyer] })
    ok(g.result !== null, 'the game ends')
    const byRound = {}
    for (const e of log) (byRound[e.round] = byRound[e.round] || []).push(e)
    for (const es of Object.values(byRound)) {
      const h = es[0].init
      // the holder acts first: once the other player has picked, the holder doesn't pick again
      const firstOther = es.findIndex(e => e.k !== h)
      if (firstOther >= 0) ok(!es.slice(firstOther).some(e => e.k === h), 'the holder acts first')
      for (const k of [0, 1]) {
        const mine = es.filter(e => e.k === k && e.pick !== null)
        ok(mine.length <= 2, 'at most two actions each')
        const kinds = mine.map(e => kindOf(e.pick))
        ok(new Set(kinds).size === kinds.length, 'the actions are different')
        if (noMoveOd) ok(!(kinds.includes('move') && kinds.includes('od')), 'noMoveOd: not both')
      }
    }
  }
}
// both players act in the same end of round (somewhere in a few games)
{
  const rules = { ...S.rules }, W = { ...DEFAULT_W16, ...S.ai }
  let both = 0
  for (let seed = 1; seed <= 6; seed++) for (const r of playGame18(fa, fb, { rules, W, seed }).rounds) if (r.bought?.[0] && r.bought?.[1]) both++
  ok(both > 0, 'both players act in the same end of round')
}
console.log(`${pass} pass, ${fail} fail`)
