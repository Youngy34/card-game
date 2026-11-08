// Where each side's damage comes from in a v18 matchup: clash wins by type pairing, follow-ups,
// combos, and the damage each brings, per side. For diagnosing a fighter that sims out of band.
//   node tools/breakdown18.mjs bastion benchmark -n 300 --seed 5

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { playGame18, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const n = +opt('-n', 300), seed = +opt('--seed', 5)
const settings = JSON.parse(fs.readFileSync(`${root}/data/v18/settings.json`, 'utf8'))
const W = { ...DEFAULT_W16, ...settings.ai }
const load = name => toFighter16(JSON.parse(fs.readFileSync(name.endsWith('.json') ? `${root}/${name}` : `${root}/data/v18/${name}.json`, 'utf8')))
const F = [load(args[0]), load(args[1] || args[0])]

const S = [0, 1].map(() => ({ dealt: { clash: 0, follow: 0, link: 0, end: 0 }, wins: {}, losses: {}, follows: 0, combos: 0, twins: 0, comboDmg: 0, rounds: 0, hpLeftWin: [], safeBlocked: 0 }))
const rng = mulberry(seed * 7919 + 13)
let win = 0
for (let i = 0; i < n; i++) {
  const g = playGame18(F[0], F[1], { rules: settings.rules, W, seed: seed * 100003 + i, rng })
  win += g.result
  for (const r of g.rounds) {
    for (const k of [0, 1]) {
      S[k].rounds++
      for (const st of ['clash', 'follow', 'link', 'end']) S[k].dealt[st] += r.dmg[st][1 - k]
    }
    const w = r.winner
    if (w >= 0 && r.types[0] && r.types[1]) {
      const key = `${r.types[w]}>${r.types[1 - w]}${r.outcome === 'speed' || r.outcome === 'tie' ? ' (speed)' : ''}`
      S[w].wins[key] = (S[w].wins[key] || 0) + 1
      S[1 - w].losses[key] = (S[1 - w].losses[key] || 0) + 1
    }
    if (r.follow) S[r.follow.side].follows++
    if (r.combo.length) { const k = r.combo[0].side; S[k].combos++; S[k].comboDmg += r.dmg.clash[1 - k] + r.dmg.link[1 - k] + r.dmg.end[1 - k]; if (r.combo.filter(x => x.stage === 'link').length === 2) S[k].twins++ }
  }
}
const per = v => (v / n).toFixed(2)
console.log(`${F[0].name} v ${F[1].name}: ${(100 * win / n).toFixed(1)}% (${n} games)`)
for (const k of [0, 1]) {
  const s = S[k], tot = Object.values(s.dealt).reduce((a, b) => a + b, 0)
  console.log(`${F[k].name}: damage dealt a game ${per(tot)} (clash ${per(s.dealt.clash)}, follow-up ${per(s.dealt.follow)}, Linker ${per(s.dealt.link)}, Ender ${per(s.dealt.end)}) · follow-ups ${per(s.follows)} · combos ${per(s.combos)} (${(s.comboDmg / Math.max(1, s.combos)).toFixed(1)} HP each; Twin ${per(s.twins)})`)
  console.log(`   clash wins a game: ${Object.entries(s.wins).sort((a, b) => b[1] - a[1]).map(([k2, v]) => `${k2} ${per(v)}`).join(', ')}`)
}
