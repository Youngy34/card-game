// Replays the reference games from py_trace.py through the JavaScript engine
// and AI, and reports every difference.
//
// Usage: node tools/crosscheck/js_replay.mjs <trace.jsonl>

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { newPlayer, step, options } from '../../src/engine/engine.js'
import { grids, DEFAULT_WEIGHTS } from '../../src/engine/ai.js'
import { maximin, worstCase } from '../../src/engine/lp.js'
import { toEngineFighter, validateFighter } from '../../src/engine/fighters.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const load = id => {
  for (const p of [`${here}/../../data/fighters/${id}.json`, `${here}/../../data/variants/${id}.json`]) {
    if (fs.existsSync(p)) {
      const f = JSON.parse(fs.readFileSync(p, 'utf8'))
      const v = validateFighter(f)
      if (v.errors.length) throw new Error(`${id}: ${JSON.stringify(v.errors)}`)
      return toEngineFighter(f)
    }
  }
  throw new Error('no fighter ' + id)
}
const cache = {}
const fighter = id => (cache[id] ??= load(id))

const lines = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n')
let games = 0, rounds = 0, cells = 0, maxCell = 0, maxV = 0, worstGap = 0, fails = 0
const fail = (msg) => { fails++; if (fails <= 25) console.log('FAIL', msg) }
const eqState = (X, ref) =>
  X.hp === ref.hp && X.pile === ref.pile && JSON.stringify(X.hand) === JSON.stringify(ref.hand) &&
  JSON.stringify(X.cd1) === JSON.stringify(ref.cd1) && JSON.stringify(X.cd2) === JSON.stringify(ref.cd2) &&
  X.sup === ref.sup && (X.tlock ?? null) === (ref.tlock ?? null)

for (const line of lines) {
  const g = JSON.parse(line)
  const rules = { counterChip: g.mode, maxRounds: 60 }
  let A = newPlayer(fighter(g.a)), B = newPlayer(fighter(g.b))
  games++
  for (const [n, r] of g.rounds.entries()) {
    rounds++
    const where = `${g.mode} ${g.a} v ${g.b} game ${games} round ${n + 1}`
    const oa = options(A), ob = options(B)
    if (JSON.stringify(oa) !== JSON.stringify(r.oa) || JSON.stringify(ob) !== JSON.stringify(r.ob)) {
      fail(`${where}: options ${JSON.stringify([oa, ob])} vs ${JSON.stringify([r.oa, r.ob])}`); break
    }
    const G = grids(A, B, rules, DEFAULT_WEIGHTS)
    for (let i = 0; i < oa.length; i++) for (let j = 0; j < ob.length; j++) {
      cells++
      const d = Math.max(Math.abs(G.MA[i][j] - r.MA[i][j]), Math.abs(G.MB[i][j] - r.MB[i][j]))
      if (d > maxCell) maxCell = d
      if (d > 1e-9) fail(`${where}: grid cell ${i},${j} differs by ${d}`)
    }
    const sa = maximin(G.MA)
    const MBt = G.ob.map((_, j) => G.oa.map((_, i) => 1 - G.MB[i][j]))
    const sb = maximin(MBt)
    // values must match; our strategies must actually achieve them
    const dv = Math.max(Math.abs(sa.v - r.vA), Math.abs(sb.v - r.vB))
    if (dv > maxV) maxV = dv
    if (dv > 1e-7) fail(`${where}: game value ${sa.v}/${sb.v} vs ${r.vA}/${r.vB}`)
    const gap = Math.max(sa.v - worstCase(G.MA, sa.x), sb.v - worstCase(MBt, sb.x))
    if (gap > worstGap) worstGap = gap
    if (gap > 1e-7) fail(`${where}: strategy falls short of its value by ${gap}`)
    const s = step(A, B, r.a, r.b, rules)
    const ok = eqState(s.A, r.A) && eqState(s.B, r.B) && s.result === r.result &&
      s.resolved[0] === r.resolved[0] && s.resolved[1] === r.resolved[1] && s.quiet === r.quiet
    if (!ok) { fail(`${where}: board after ${r.a}/${r.b}\n  js ${JSON.stringify([s.A.hp, s.A.pile, s.A.hand, s.A.cd1, s.A.cd2, s.A.tlock, s.B.hp, s.B.pile, s.B.hand, s.B.cd1, s.B.cd2, s.B.tlock, s.result])}\n  py ${JSON.stringify([r.A, r.B, r.result])}`); break }
    A = s.A; B = s.B
  }
}
console.log(`${games} games, ${rounds} rounds, ${cells} grid cells compared`)
console.log(`largest grid difference ${maxCell.toExponential(2)}, largest game-value difference ${maxV.toExponential(2)}, largest strategy shortfall ${worstGap.toExponential(2)}`)
console.log(fails ? `${fails} FAILURES` : 'ALL MATCH')
process.exit(fails ? 1 : 0)
