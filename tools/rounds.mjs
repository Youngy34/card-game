// How big rounds get, in and out of Overdrive, and where the fight spends its time (17 Nov, the new test fighters).
//   node tools/rounds.mjs --edition v23tf brawler zoner -n 300 --seed 5 [--json]
// Hard v Hard with the edition's fitted partner. For every round: the damage the clash winner dealt (clash card,
// follow-up and combo cards) and whether they were in Overdrive. Per game: the biggest round. Per fighter: the share of
// rounds that started at its own range; Charge built and how it was spent.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { playGame18, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = k => { const i = args.indexOf(k); if (i >= 0) { args.splice(i, 1); return true } return false }
const edition = opt('--edition', 'v23tf'), n = +opt('-n', 300), seed = +opt('--seed', 5), json = flag('--json')
const settings = JSON.parse(fs.readFileSync(`${root}/data/${edition}/settings.json`, 'utf8'))
const rules = { ...settings.rules }, W = { ...DEFAULT_W16, ...settings.ai }
const load = name => toFighter16(JSON.parse(fs.readFileSync(`${root}/data/${edition}/${name}.json`, 'utf8')))
const [a, b] = [args[0] || 'brawler', args[1] || args[0] || 'zoner']
const fa = load(a), fb = load(b), prefs = [fa.prefers, fb.prefers]

const rng = mulberry(seed * 7919 + 13)
const rows = { normal: [], od: [] }, bigNormal = [], bigOD = [], bigAny = []
const home = [0, 0], moves = [0, 0], ods = [0, 0], kdBlocked = [0, 0], odClash = { n: 0, won: 0, lost: 0, speed: 0 }
let rounds = 0, wins = 0, decided = 0
for (let i = 0; i < n; i++) {
  const g = playGame18(fa, fb, { rules, W, seed: seed * 100003 + i, rng })
  if (g.result !== 0.5) { decided++; if (g.result === 1) wins++ }
  let bn = 0, bo = 0
  for (const r of g.rounds) {
    rounds++
    for (const k of [0, 1]) if (r.rangeAt === prefs[k]) home[k]++
    for (const k of [0, 1]) { if (r.bought?.[k]?.move) moves[k]++; if (r.bought?.[k]?.od) ods[k]++ }
    for (const k of [0, 1]) if (r.od?.[k]) { odClash.n++; if (r.winner === k) odClash.won++; if (r.winner === 1 - k) odClash.lost++; if (r.outcome === 'speed' || r.outcome === 'tie') odClash.speed++ }
    const w = r.winner
    if (w == null || w < 0) continue
    const l = 1 - w, dmg = r.before[l].hp - r.after[l].hp
    if (dmg <= 0) continue
    if (r.od?.[w]) { rows.od.push(dmg); bo = Math.max(bo, dmg) } else { rows.normal.push(dmg); bn = Math.max(bn, dmg) }
  }
  bigNormal.push(bn); bigOD.push(bo); bigAny.push(Math.max(bn, bo))
}
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
const share = (a, f) => a.filter(f).length / Math.max(1, a.length)
const hist = a => { const h = {}; for (const v of a) h[v] = (h[v] || 0) + 1; return h }
const out = {
  edition, matchup: [fa.name, fb.name], n, side0Wins: wins / Math.max(1, decided),
  homeShare: home.map(v => v / rounds), odClash: { rounds: odClash.n, wonShare: odClash.won / Math.max(1, odClash.n), lostShare: odClash.lost / Math.max(1, odClash.n), speedShare: odClash.speed / Math.max(1, odClash.n) }, movesPerGame: moves.map(v => v / n), odPerGame: ods.map(v => v / n),
  roundDamage: {
    normal: { rounds: rows.normal.length, mean: avg(rows.normal), max: Math.max(0, ...rows.normal), over6: share(rows.normal, v => v > 6), hist: hist(rows.normal) },
    od: { rounds: rows.od.length, mean: avg(rows.od), max: Math.max(0, ...rows.od), over6: share(rows.od, v => v > 6), atLeast9: share(rows.od, v => v >= 9), hist: hist(rows.od) },
  },
  biggestRoundPerGame: { any: avg(bigAny), normal: avg(bigNormal), gamesWithA7Plus: share(bigAny, v => v >= 7), gamesWithA9Plus: share(bigAny, v => v >= 9), gamesWithNormalOver6: share(bigNormal, v => v > 6) },
}
if (json) console.log(JSON.stringify(out))
else console.log(JSON.stringify(out, null, 1))
