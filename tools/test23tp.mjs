// Rule checks for the time-out penalty (17 Nov, claude/time-out penalty (17 Nov).md), edition data/v23tp:
// at a time-out, if only one deck is empty, its owner loses rules.timeoutPenalty HP before HP decides.
//   node tools/test23tp.mjs
import fs from 'fs'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, finishRound16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, features16 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const S = read('../data/v23tp/settings.json'), rules = { ...S.rules }
ok(rules.timeoutPenalty === 3 && rules.timeout && rules.timeoutShare && rules.chargeUp, 'v23tp: v23ab plus a 3 HP time-out penalty')
const BR = toFighter16(read('../data/v23tp/brawler.json')), ZO = toFighter16(read('../data/v23tp/zoner.json'))

// a game at the end of a round, with these HP and deck sizes
const at = (hpA, hpB, deckA, deckB, r = rules) => {
  const G = newGame16(BR, ZO, r, 7)
  return { ...G, round: 15, A: { ...G.A, hp: hpA, deck: G.A.deck.slice(0, deckA) }, B: { ...G.B, hp: hpB, deck: G.B.deck.slice(0, deckB) } }
}

// 1. Only one deck empty: its owner loses 3 HP, then HP decides
{
  const g = finishRound16(at(10, 8, 0, 2))
  ok(g.timedOut && g.deckPenalty?.side === 0 && g.A.hp === 7 && g.result === 0, `A ahead by 2 but out first: 10-3 = 7 < 8, B wins (${g.A.hp}, ${g.result})`)
  ok(g.deckPenalty.pre === 1 && g.deckPenalty.hp === 3, 'the result without the penalty is kept (A would have won)')
  const g2 = finishRound16(at(11, 8, 0, 2))
  ok(g2.result === 0.5 && g2.A.hp === 8, 'ahead by 3 and out first: a draw')
  const g3 = finishRound16(at(12, 8, 0, 2))
  ok(g3.result === 1 && g3.deckPenalty.pre === 1, 'ahead by 4 and out first: still wins')
  const g4 = finishRound16(at(8, 8, 3, 0))
  ok(g4.deckPenalty?.side === 1 && g4.B.hp === 5 && g4.result === 1, 'level and B out first: A wins (was a draw)')
  const g5 = finishRound16(at(2, 9, 0, 1))
  ok(g5.A.hp === -1 && g5.result === 0, 'the penalty can go below 0; it is just a loss on HP')
}
// 2. Both decks empty in the same round: nobody loses any
{
  const g = finishRound16(at(9, 8, 0, 0))
  ok(g.timedOut && !g.deckPenalty && g.A.hp === 9 && g.B.hp === 8 && g.result === 1, 'both out together: no penalty')
}
// 3. Off without the rule, and no time-out while both decks have cards
{
  const g = finishRound16(at(10, 8, 0, 2, { ...rules, timeoutPenalty: 0 }))
  ok(g.timedOut && !g.deckPenalty && g.A.hp === 10 && g.result === 1, 'timeoutPenalty 0: today\'s time-out')
  const g2 = finishRound16(at(10, 8, 1, 2))
  ok(!g2.timedOut && g2.result === null && !g2.deckPenalty && g2.A.hp === 10, 'decks not empty: the game goes on')
}
// 4. A KO at the end of the round isn't a time-out, so no penalty
{
  const g = finishRound16(at(0, 5, 0, 3))
  ok(g.result === 0 && !g.timedOut && !g.deckPenalty && g.A.hp === 0, 'KO first: no penalty')
}
// 5. The partner's feature: outFirst
{
  const f = (G, k) => features16(G, k).outFirst
  ok(f(at(10, 10, 3, 5, { ...rules, timeoutPenalty: 0 }), 0) === 0, 'outFirst is 0 without the rule')
  const g = at(10, 10, 4, 6)
  ok(Math.abs(f(g, 0) - 0.5) < 1e-9 && f(g, 1) === 0, `the smaller deck (4) scores 1 - 4/8 = 0.5, the other 0 (${f(g, 0)})`)
  ok(f(at(10, 10, 9, 12), 0) === 0, '9 cards left: too early to count')
  ok(f(at(10, 10, 5, 5), 0) === 0 && f(at(10, 10, 5, 5), 1) === 0, 'level decks: 0 for both')
  const p = at(10, 10, 5, 5); p.A = { ...p.A, pendingDraw: 1 }
  ok(Math.abs(f(p, 0) - 0.5) < 1e-9, 'a Guard draw still to come (lite lookahead) counts as gone: 4 left, 0.5')
}
// 6. Whole games: every penalised game has the bookkeeping right
{
  const W = { ...DEFAULT_W16, ...S.ai }
  let to = 0, pen = 0, bad = 0
  for (let s = 1; s <= 40; s++) {
    const g = playGame18(BR, ZO, { rules, levels: ['hard', 'hard'], W, seed: s })
    if (!g.timedOut) { if (g.penalty) bad++; continue }
    to++
    if (g.penalty) {
      pen++
      const k = g.penalty.side, d = g.final.map(x => x.deck)
      if (!(d[k] === 0 && d[1 - k] > 0)) bad++
    } else if ((g.final[0].deck === 0) !== (g.final[1].deck === 0)) bad++
  }
  ok(bad === 0, `whole games: the penalty lands exactly when one deck alone is empty (${to} time-outs, ${pen} penalised in 40 games)`)
}
console.log(`${passes} pass, ${fails} fail`)
process.exit(fails ? 1 : 0)
