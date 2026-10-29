// Rules v15 simulator (rules-overview 15): v11's triangle with speed deciding
// same-type attacks, and a choice of Recover payoff.
//
//   node tools/sim15.mjs rr --payoff any -n 400 --seed 5      # round-robin, Hard vs Hard
//   node tools/sim15.mjs exploit --payoff pressure -n 200     # bots vs Hard in each mirror
//   node tools/sim15.mjs game vex atlas --payoff fixed        # one matchup, full report
//
// --payoff any | pressure | fixed | none     (--fixed 2 sets the fixed damage)
// Output is JSON on the last line when --json is given.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toEngineFighter, validateFighter } from '../src/engine/fighters.js'
import { newPlayer, step, options, card } from '../src/engine/engine.js'
import { mixes, sample, withFollowScore, DEFAULT_WEIGHTS } from '../src/engine/ai.js'
import { mulberry32 } from '../src/engine/game.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const n = +opt('-n', 300), seed = +opt('--seed', 5), payoff = opt('--payoff', 'any'), fixedDamage = +opt('--fixed', 2)
const maxRounds = +opt('--max', 100)
const projectileSafe = args.includes('--projsafe'); if (projectileSafe) args.splice(args.indexOf('--projsafe'), 1)
const dir = opt('--dir', 'data/v15')
const json = args.includes('--json'); if (json) args.splice(args.indexOf('--json'), 1)
const mode = args[0]
const settings = JSON.parse(fs.readFileSync(`${root}/data/settings.json`, 'utf8'))
const W = { ...DEFAULT_WEIGHTS, ...settings.ai }
const rules = withFollowScore({ maxRounds, recoverPayoff: payoff, fixedDamage, projectileSafe }, W)

export function load(name) {
  const p = name.endsWith('.json') ? name : `${root}/${dir}/${name}.json`
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  const v = validateFighter(f)
  if (v.errors.length) { console.error(name, v.errors); process.exit(1) }
  return toEngineFighter(f)
}

// Bots: 'hard' (the sparring partner), 'attack' (a random attack every round),
// 'pressure' (a random Pressure when it has one, else a random attack),
// 'random' (any available card at random).
function choose(bot, X, mx, side, rng) {
  if (bot === 'hard') {
    const p = side === 0 ? mx.x : mx.y, o = side === 0 ? mx.oa : mx.ob
    return o[sample(p, rng)]
  }
  const o = options(X)
  const pick = arr => arr[Math.floor(rng() * arr.length)]
  if (bot === 'random') return pick(o)
  const atk = o.filter(i => ['P', 'C', 'T'].includes(card(X, i).t) && (card(X, i).t !== 'T' || card(X, i).chip > 0))
  if (bot === 'pressure') { const pr = o.filter(i => card(X, i).t === 'P'); if (pr.length) return pick(pr) }
  return atk.length ? pick(atk) : pick(o)
}

export function playGame(fa, fb, rng, bots = ['hard', 'hard']) {
  let A = newPlayer(fa), B = newPlayer(fb)
  const g = { rounds: 0, result: null, peakPile: 0, quiet: 0, quietBy: { recovers: 0, cancel: 0, other: 0 },
    types: [{ P: 0, C: 0, R: 0, T: 0 }, { P: 0, C: 0, R: 0, T: 0 }], plays: [{}, {}],
    sameType: 0, cancels: 0, recoverWins: 0, follows: { P: 0, C: 0, none: 0 }, followHp: 0, followCash: 0,
    fixedHp: 0, cashes: [], route: null }
  for (let r = 1; ; r++) {
    const mx = bots.includes('hard') ? mixes(A, B, rules, W) : null
    const a = choose(bots[0], A, mx, 0, rng), b = choose(bots[1], B, mx, 1, rng)
    const ca = card(A, a), cb = card(B, b)
    const s = step(A, B, a, b, rules)
    g.rounds = r
    for (const [k, c] of [[0, ca], [1, cb]]) { g.types[k][c.t]++; g.plays[k][c.name] = (g.plays[k][c.name] || 0) + 1 }
    if (ca.t === cb.t && ca.t !== 'R') { g.sameType++; if (s.outcome === 'cancel') g.cancels++ }
    if (s.quiet) { g.quiet++; g.quietBy[s.outcome === 'recovers' ? 'recovers' : s.outcome === 'cancel' ? 'cancel' : 'other']++ }
    // cashes in the clash
    for (const [k, c, Y] of [[0, ca, B], [1, cb, A]]) if (s.resolved[k] && c.t === 'C') g.cashes.push(Y.pile)
    if (s.recoverWin >= 0) {
      g.recoverWins++
      if (s.followed) {
        g.follows[s.followed.t]++; g.followHp += s.followed.hp
        if (s.followed.t === 'C') { g.cashes.push(s.followed.pileBefore); g.followCash += s.followed.pileBefore }
      } else if (payoff === 'any' || payoff === 'pressure') g.follows.none++
      g.fixedHp += s.fixed
    }
    g.peakPile = Math.max(g.peakPile, s.A.pile, s.B.pile)
    if (s.result !== null) {
      const loser = s.result === 1 ? 1 : 0, w = 1 - loser
      const loserBefore = loser === 0 ? A : B
      if (s.result === 0.5) g.route = 'draw'
      else if (s.followed && s.followed.side === w) g.route = s.followed.t === 'C' ? 'follow-up Convert' : 'follow-up Pressure'
      else if (s.fixed && s.recoverWin === w) g.route = 'fixed punish'
      else if (s.resolved[w] && [ca, cb][w].t === 'C' && loserBefore.pile > 0) g.route = 'Convert cash'
      else g.route = 'chip'
      g.result = s.result
      return g
    }
    A = s.A; B = s.B
    if (r >= maxRounds) { g.result = 0.5; g.route = 'round limit'; return g }
  }
}

const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length ? (s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2) : 0 }
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1)

export function runMatch(na, nb, games, sd, bots = ['hard', 'hard']) {
  const fa = load(na), fb = load(nb), rng = mulberry32(sd)
  const gs = []
  for (let i = 0; i < games; i++) gs.push(playGame(fa, fb, rng, bots))
  const R = gs.reduce((x, g) => x + g.rounds, 0)
  const sum = k => gs.reduce((x, g) => x + g[k], 0)
  const types = [0, 1].map(k => { const t = { P: 0, C: 0, R: 0, T: 0 }; for (const g of gs) for (const x of 'PCRT') t[x] += g.types[k][x]; const tot = t.P + t.C + t.R + t.T; return { P: t.P / tot, C: t.C / tot, R: t.R / tot, T: t.T / tot } })
  const plays = [0, 1].map(k => { const p = {}; let tot = 0; for (const g of gs) for (const [nm, v] of Object.entries(g.plays[k])) { p[nm] = (p[nm] || 0) + v; tot += v } for (const nm in p) p[nm] /= tot; return p })
  const routes = {}; for (const g of gs) routes[g.route] = (routes[g.route] || 0) + 1 / games
  const fol = { P: 0, C: 0, none: 0 }; for (const g of gs) for (const k in fol) fol[k] += g.follows[k]
  const cashes = gs.flatMap(g => g.cashes)
  return {
    a: na, b: nb, bots, games, win: mean(gs.map(g => g.result)),
    median: median(gs.map(g => g.rounds)), limit: gs.filter(g => g.route === 'round limit').length / games,
    quiet: sum('quiet') / R, quietRecovers: gs.reduce((x, g) => x + g.quietBy.recovers, 0) / R, quietCancel: gs.reduce((x, g) => x + g.quietBy.cancel, 0) / R,
    sameType: sum('sameType') / R, cancelsOfSame: sum('cancels') / Math.max(sum('sameType'), 1),
    recoverWins: sum('recoverWins') / R, follows: fol, followHpPer: sum('followHp') / Math.max(fol.P + fol.C, 1),
    peakPile: median(gs.map(g => g.peakPile)), cashMedianNonzero: median(cashes.filter(c => c > 0)), cashZero: cashes.filter(c => c === 0).length / Math.max(cashes.length, 1),
    types, plays, routes,
  }
}

const pct = x => (100 * x).toFixed(1) + '%'
if (mode === 'game') {
  const r = runMatch(args[1], args[2], n, seed)
  console.log(JSON.stringify(r, null, 1))
} else if (mode === 'rr') {
  const names = ['atlas', 'bastion', 'gambler', 'vex']
  const out = []
  for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) {
    const r = runMatch(names[i], names[j], n, seed + i * 10 + j)
    out.push(r)
    if (!json) console.log(`${names[i].padEnd(8)} v ${names[j].padEnd(8)} ${pct(r.win)}  median ${r.median}  limit ${pct(r.limit)}  quiet ${pct(r.quiet)} (R-mirrors ${pct(r.quietRecovers)}, ties ${pct(r.quietCancel)})  peak pile ${r.peakPile}  R beats P ${pct(r.recoverWins)}  follow P/C/none ${r.follows.P}/${r.follows.C}/${r.follows.none}`)
  }
  if (json) console.log(JSON.stringify(out))
} else if (mode === 'exploit') {
  const names = ['atlas', 'bastion', 'gambler', 'vex']
  const out = []
  for (const bot of ['attack', 'pressure', 'random']) for (const nm of names) {
    const r = runMatch(nm, nm, n, seed + names.indexOf(nm), [bot, 'hard'])
    out.push({ bot, fighter: nm, win: r.win, median: r.median })
    if (!json) console.log(`${bot.padEnd(9)} ${nm.padEnd(8)} beats Hard ${pct(r.win)}  (median ${r.median})`)
  }
  if (json) console.log(JSON.stringify(out))
} else {
  console.log('usage: node tools/sim15.mjs rr|exploit|game [a b] --payoff any|pressure|fixed|none [-n games] [--seed s] [--json]')
}
