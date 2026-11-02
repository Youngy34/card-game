// Warden study (1 November 2026): one matchup, with a breakdown of damage by source,
// type pairings, and hand sizes. Prints one JSON line.
//   node tools/warden-study.mjs <a.json|name> <b.json|name> -n 300 --seed 1 [--levels hard,hard] [--ban Card] [--rule k=v,...]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { playGame16, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const n = +opt('-n', 300), seed = +opt('--seed', 1), levels = opt('--levels', 'hard,hard').split(','), ban = opt('--ban', null)
const extra = opt('--rule', '')
const settings = JSON.parse(fs.readFileSync(`${root}/data/v16/settings.json`, 'utf8'))
const rules = { ...settings.rules }
for (const kv of extra.split(',').filter(Boolean)) { const [k, v] = kv.split('='); rules[k] = isNaN(+v) ? v : +v }
const W = { ...DEFAULT_W16, ...settings.ai, ...(ban ? { ban, banSide: 0 } : {}) }
const load = name => toFighter16(JSON.parse(fs.readFileSync(name.endsWith('.json') ? name : `${root}/data/v16/${name}.json`, 'utf8')))
const [fa, fb] = [load(args[0]), load(args[1])]

const rng = mulberry(seed * 7919 + 13)
const S = { n, win: 0, rounds: [], dmg: [{}, {}], pair: {}, hand: [[], []], conf: [0, 0], supers: [0, 0], types: [{}, {}], shackles: 0, shacklesEnded: 0, comboRounds: [0, 0], greyAtStart: [[], []] }
for (let i = 0; i < n; i++) {
  const g = playGame16(fa, fb, { rules, W, levels, seed: seed * 100003 + i, rng })
  S.win += g.result
  S.rounds.push(g.rounds.length)
  for (const r of g.rounds) {
    for (const k of [0, 1]) {
      // damage dealt BY side k, by stage, split into chip and cash, from the hit events
      S.hand[k].push(r.handAtClash[k])
      S.conf[k] += r.confiscated[k].length
      if (r.supers[k]) S.supers[k]++
      const t = r.types[k] || '-'
      S.types[k][t] = (S.types[k][t] || 0) + 1
      S.greyAtStart[k].push(r.before[k].pile)
      if (r.combo.length && r.combo[0].side === k) S.comboRounds[k]++
    }
    const key = `${r.types[0] || '-'}${r.types[1] || '-'}`
    S.pair[key] = S.pair[key] || { n: 0, w0: 0, w1: 0 }
    S.pair[key].n++
    if (r.winner === 0) S.pair[key].w0++
    if (r.winner === 1) S.pair[key].w1++
    for (const k of [0, 1]) for (const [stage, v] of Object.entries(r.dmg)) S.dmg[k][stage] = (S.dmg[k][stage] || 0) + v[1 - k]
    if (r.after[0].inPlay === 'Shackles') S.shackles++
  }
}
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1)
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const T = S.rounds.reduce((s, v) => s + v, 0)
const out = {
  a: fa.name, b: fb.name, n, levels, ban, rules: extra || null,
  win: +(S.win / n).toFixed(3), margin: +(1.96 * Math.sqrt(0.25 / n)).toFixed(3), median: med(S.rounds),
  dmgPerGame: S.dmg.map(d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, +(v / n).toFixed(1)]))),
  handAtClash: S.hand.map(a => +mean(a).toFixed(2)),
  confPerGame: S.conf.map(v => +(v / n).toFixed(2)),
  supersPerGame: S.supers.map(v => +(v / n).toFixed(2)),
  types: S.types.map(t => { const tot = Object.values(t).reduce((s, v) => s + v, 0); return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +(100 * v / tot).toFixed(0)])) }),
  combosPerGame: S.comboRounds.map(v => +(v / n).toFixed(2)),
  shacklesUp: +(S.shackles / T).toFixed(2),
  greyAtStart: S.greyAtStart.map(a => +mean(a).toFixed(2)),
  pairs: Object.fromEntries(Object.entries(S.pair).sort((x, y) => y[1].n - x[1].n).map(([k, v]) => [k, `${(100 * v.n / T).toFixed(0)}% of rounds, side0 wins ${(100 * v.w0 / v.n).toFixed(0)}%, side1 ${(100 * v.w1 / v.n).toFixed(0)}%`])),
}
console.log(JSON.stringify(out))
