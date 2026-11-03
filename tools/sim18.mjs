// Rules v18 simulator (rules-overview 18.md): one deck, riders on clash cards, the time-out,
// with the v16/v17 sparring partner. It also runs v17 games and reports both the same way, so
// the two can be compared side by side.
//
//   node tools/sim18.mjs game benchmark benchmark -n 300 --seed 5        # a v18 matchup
//   node tools/sim18.mjs game benchmark warden --set meterMax=4           # a rule changed
//   node tools/sim18.mjs v17 benchmark warden -n 300                      # the same report for v17
//   node tools/sim18.mjs exploit benchmark -n 200                         # mindless bots against Hard
//   node tools/sim18.mjs game data/v18/variants/x.json benchmark          # a fighter file by path
//
// --set k=v (repeatable) changes a rule; --ai k=v a partner weight; --hp a,b sets both HPs;
// --brace stagger|reflect changes the core Brace; --json prints the summary as JSON.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { playGame16, playGame18, summarise16, winRoute16, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const opts = name => { const out = []; let i; while ((i = args.indexOf(name)) >= 0) out.push(args.splice(i, 2)[1]); return out }
const flag = name => { const i = args.indexOf(name); if (i >= 0) { args.splice(i, 1); return true } return false }
const n = +opt('-n', 300), seed = +opt('--seed', 5), levels = opt('--levels', 'hard,hard').split(',')
const json = flag('--json')
const hpSet = opt('--hp', null)
const brace = opt('--brace', null)
const sets = opts('--set'), aiSets = opts('--ai')
const mode = args[0]
const v17 = mode === 'v17'
const edition = v17 ? 'v17' : 'v18'

const settings = JSON.parse(fs.readFileSync(`${root}/data/${edition}/settings.json`, 'utf8'))
const rules = { ...settings.rules }
const parse = v => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v)
for (const s of sets) { const [k, v] = s.split('='); rules[k] = parse(v) }
const W = { ...DEFAULT_W16, ...settings.ai }
for (const s of aiSets) { const [k, v] = s.split('='); W[k] = +v }

function load(name, side) {
  const p = name.endsWith(".json") ? (path.isAbsolute(name) ? name : `${root}/${name}`) : `${root}/data/${edition}/${name}.json`
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (hpSet) f.hp = +hpSet.split(',')[side]
  if (brace) for (const c of f.cards) if (c.brace) c.brace = brace
  const v = validateFighter16(f)
  if (v.errors.length) { console.error(name, v.errors); process.exit(1) }
  return toFighter16(f)
}

const play = v17 ? playGame16 : playGame18
function run(a, b, lv, sd = seed) {
  const fa = load(a, 0), fb = load(b, 1)
  const rng = mulberry(sd * 7919 + 13)
  const games = []
  for (let i = 0; i < n; i++) games.push(play(fa, fb, { rules, W, levels: lv, seed: sd * 100003 + i, rng }))
  return summarise18(games, [fa, fb])
}

// ---- the summary ----------------------------------------------------------------
function summarise18(games, F) {
  const R = summarise16(games, F.map(f => f.name))
  const G = games.length
  const specials = F.map(f => new Set(f.cards.filter(c => c.special).map(c => c.name)))
  const X = { timeouts: 0, timeoutWins: 0, koGames: 0, koWins: 0, timeoutMargin: [], deckEnd: [[], []], loserDeckAtKO: [], reshuffled: 0,
    meter: [0, 0], wasted: [0, 0], reads: [{ draw: 0, special: 0, super: 0 }, { draw: 0, special: 0, super: 0 }], recalls: [0, 0],
    specialsPlayed: [0, 0], supersPlayed: [0, 0], braceReflect: [0, 0], parryFollow: [0, 0], starved: [0, 0], clashes: [0, 0] }
  for (const g of games) {
    if (g.timedOut) { X.timeouts++; X.timeoutWins += g.result; X.timeoutMargin.push(Math.abs(g.final[0].hp - g.final[1].hp)) } else { X.koGames++; X.koWins += g.result }
    for (const k of [0, 1]) X.deckEnd[k].push(g.final[k].deck)
    if (g.reshuffles.some(v => v > 0)) X.reshuffled++
    if (!g.timedOut && g.result !== 0.5) { const loser = g.result === 1 ? 1 : 0; X.loserDeckAtKO.push(g.final[loser].deck) }
    for (const r of g.rounds) {
      for (const k of [0, 1]) {
        const names = [r.cards[k], ...(r.follow?.side === k ? [r.follow.name] : []), ...r.combo.filter(c => c.side === k).map(c => c.name)].filter(Boolean)
        X.specialsPlayed[k] += names.filter(nm => specials[k].has(nm)).length
        X.supersPlayed[k] += names.filter(nm => nm === F[k].sup?.name).length
        if (r.handAtClash) { X.clashes[k]++; if (r.handAtClash[k] <= 2) X.starved[k]++ }
      }
      for (const e of r.reveals || []) {
        if (e.kind === 'brace') { X.braceReflect[e.side]++; continue }
        if (e.what === 'meter') { X.meter[e.side] += e.n; X.wasted[e.side] += e.wasted }
        else if (e.what === 'draw') X.reads[e.side].draw++
        else if (e.what === 'take') X.reads[e.side][e.sup ? 'super' : 'special']++
        else if (e.what === 'recall' && e.recalled) X.recalls[e.side]++
      }
      if (r.parry) for (const k of [0, 1]) if (r.parry[k] && r.follow?.side === k) X.parryFollow[k]++
    }
  }
  // the time-out is a route of its own (summarise16 files it under its last round)
  R.routes = {}
  for (const g of games) {
    const key = g.timedOut ? 'time-out' : winRoute16(g.rounds[g.rounds.length - 1], g.result)
    R.routes[key] = (R.routes[key] || 0) + 1
  }
  return { ...R, x: X }
}

const pct = x => (100 * x).toFixed(1) + '%'
const per = (v, d = 2) => (v / Math.max(1, nGames)).toFixed(d)
let nGames = n
const share = (o, tot) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / tot)}`).join(', ')
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
const bucket = a => { const b = { '0': 0, '1–2': 0, '3–5': 0, '6+': 0 }; for (const v of a) b[v === 0 ? '0' : v <= 2 ? '1–2' : v <= 5 ? '3–5' : '6+']++; return Object.entries(b).map(([k, v]) => `${k}: ${pct(v / Math.max(1, a.length))}`).join(' · ') }

function report(r) {
  const X = r.x, Rn = r.totalRounds
  nGames = r.games
  console.log(`${edition} · ${r.fighters.join(' v ')} · ${r.games} games`)
  console.log(`win (side 0) ${pct(r.win)} (±${(100 * r.margin).toFixed(1)}) · median ${r.median} rounds (10–90%: ${r.p10.toFixed(0)}–${r.p90.toFixed(0)}) · time-outs ${pct(X.timeouts / r.games)}${X.timeouts ? ` (HP margin ${avg(X.timeoutMargin).toFixed(1)}; side 0 wins ${pct(X.timeoutWins / X.timeouts)} of them, ${pct(X.koWins / Math.max(1, X.koGames))} of the rest)` : ''} · games with a reshuffle ${pct(X.reshuffled / r.games)}`)
  console.log(`how games end: ${share(r.routes, r.games)}`)
  console.log(`deck left at the end: ${avg(X.deckEnd[0]).toFixed(1)} / ${avg(X.deckEnd[1]).toFixed(1)} · loser's deck at the KO: ${bucket(X.loserDeckAtKO)}`)
  console.log(`outcomes: ${share(r.outcomes, Rn)} · speed ties to the holder ${pct((r.tieByInit[0] + r.tieByInit[1]) / Rn)}`)
  console.log(`combos ${pct(r.combos / Rn)} of rounds, ${(r.comboLen / Math.max(r.combos, 1)).toFixed(2)} cards, ${(r.comboDmg / Math.max(r.combos, 1)).toFixed(1)} HP · Guard beats Pressure ${pct(r.guardWins / Rn)}, followed up ${pct(r.follows / Math.max(r.guardWins, 1))} (${(r.followDmg / Math.max(r.follows, 1)).toFixed(1)} HP)`)
  console.log(`statuses a game: ${Object.entries(r.statuses).map(([k, v]) => `${k} ${(v / r.games).toFixed(2)}`).join(', ') || 'none'}`)
  for (const k of [0, 1]) {
    const T = Object.values(r.types[k]).reduce((s, v) => s + v, 0)
    const dist = Object.entries(r.handClashDist[k]).sort((a, b) => a[0] - b[0]).map(([h, p]) => `${h}:${(100 * p).toFixed(0)}`).join(' ')
    console.log(`side ${k} (${r.fighters[k]}): types ${share(r.types[k], T)} · Supers played ${per(X.supersPlayed[k])} (as the clash card ${per(r.supers[k])}) · specials played ${per(X.specialsPlayed[k])} · confiscated ${per(r.conf[k])}`)
    console.log(`        plays ${share(r.plays[k], T)}`)
    console.log(`        hand at the clash ${r.handClashAvg[k].toFixed(2)} [${dist}] · starved (≤2) ${pct(X.starved[k] / Math.max(1, X.clashes[k]))}`)
    if (!v17) console.log(`        meter gained ${per(X.meter[k], 1)} (wasted at the cap ${per(X.wasted[k], 1)}) · Read: drew ${per(X.reads[k].draw)}, took a special ${per(X.reads[k].special)}, took the Super ${per(X.reads[k].super)} · Recalls ${per(X.recalls[k])} · Brace reflects ${per(X.braceReflect[k])} · Parry follow-ups ${per(X.parryFollow[k])}`)
    else console.log(`        neutral: ${share(r.neutral[k], Rn)} · taken: ${Object.entries(r.took[k]).map(([nm, v]) => `${nm} ${per(v)}`).join(', ')} · fetched ${per(r.fetched[k])}`)
  }
}

const t0 = Date.now()
if (mode === 'game' || mode === 'v17') {
  const r = run(args[1], args[2] || args[1], levels)
  if (json) console.log(JSON.stringify(r)); else report(r)
} else if (mode === 'exploit') {
  const name = args[1] || 'benchmark'
  const out = []
  for (const bot of ['pressure', 'attack', 'guard', 'convert', 'random', 'easy', 'medium']) {
    const r = run(name, name, [bot, 'hard'])
    out.push({ bot, win: r.win, median: r.median })
    if (!json) console.log(`${bot.padEnd(9)} beats Hard ${pct(r.win)} (±${(100 * r.margin).toFixed(0)}), median ${r.median} rounds`)
  }
  if (json) console.log(JSON.stringify(out))
} else {
  console.log('usage: node tools/sim18.mjs game <a> [b] | v17 <a> [b] | exploit [fighter]  [-n games] [--seed s] [--set k=v] [--ai k=v] [--hp a,b] [--brace reflect|stagger] [--levels hard,easy] [--json]')
}
if (!json) console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
