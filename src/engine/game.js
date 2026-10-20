// Whole games, logs and balance reports.

import { newPlayer, step, card, options, outcome, DEFAULT_RULES } from './engine.js'
import { mixes, levelMixes, sample, availableTypes, DEFAULT_WEIGHTS } from './ai.js'

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One logged round, in a compact form shared by the app and the reports.
export function roundRecord(n, A, B, a, b, s) {
  const ca = card(A, a), cb = card(B, b)
  const lockedOut = X => !['P', 'C', 'R'].every(t => availableTypes(X).has(t))
  return {
    n,
    cards: [ca.name, cb.name], types: [ca.t, cb.t], supers: [a === 'S', b === 'S'],
    outcome: outcome(ca, cb), resolved: s.resolved,
    before: [{ hp: A.hp, pile: A.pile }, { hp: B.hp, pile: B.pile }],
    after: [{ hp: s.A.hp, pile: s.A.pile }, { hp: s.B.hp, pile: s.B.pile }],
    lockedOut: [lockedOut(A), lockedOut(B)],
    quiet: s.quiet,
  }
}

// How the game was won, from its last round
export function winRoute(last, result) {
  if (result === 0.5) return last.after[0].hp <= 0 ? 'draw (double KO)' : 'draw (round limit)'
  if (last.after[0].hp <= 0 && last.after[1].hp <= 0) return 'double KO'
  const loser = result === 1 ? 1 : 0
  const winner = 1 - loser
  const cashed = last.resolved[winner] && last.types[winner] === 'C' && last.before[loser].pile > 0
  return cashed ? 'Convert cash' : 'chip'
}

export function playAIGame(fa, fb, rng, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard']) {
  let A = newPlayer(fa), B = newPlayer(fb)
  const rounds = []
  const hard = levels[0] === 'hard' && levels[1] === 'hard'
  for (let n = 1; ; n++) {
    const m = mixes(A, B, rules, W)
    const [px, py] = hard ? [m.x, m.y] : levelMixes(m, levels)
    const i = sample(px, rng), j = sample(py, rng)
    const s = m.next[i][j]
    rounds.push(roundRecord(n, A, B, m.oa[i], m.ob[j], s))
    A = s.A; B = s.B
    if (s.result !== null) return { result: s.result, rounds }
    if (n >= rules.maxRounds) return { result: 0.5, rounds }
  }
}

// ---- reports ------------------------------------------------------------
const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }

// games: [{ result, rounds }], with side 0 = fighter A.
export function summarise(games, fa, fb) {
  const n = games.length
  const out = {
    games: n, win: 0, doubleKO: 0, draws: 0, lengths: [], quiet: 0, recoverMirrors: 0, totalRounds: 0,
    routes: {}, sides: [0, 1].map(k => ({
      plays: {}, resolved: {}, types: { P: 0, C: 0, R: 0, T: 0 }, superRounds: [], superUnused: 0, lockedOut: 0,
    })),
  }
  for (const g of games) {
    out.win += g.result
    out.lengths.push(g.rounds.length)
    const last = g.rounds[g.rounds.length - 1]
    const dko = last && last.after[0].hp <= 0 && last.after[1].hp <= 0
    if (dko) { out.doubleKO++; if (g.result === 0.5) out.draws++ }
    const r = last ? winRoute(last, g.result) : 'n/a'
    out.routes[r] = (out.routes[r] || 0) + 1
    const used = [false, false]
    for (const rd of g.rounds) {
      out.totalRounds++
      if (rd.quiet) out.quiet++
      if (rd.types[0] === 'R' && rd.types[1] === 'R') out.recoverMirrors++
      for (const k of [0, 1]) {
        const S = out.sides[k], nm = rd.cards[k]
        S.plays[nm] = (S.plays[nm] || 0) + 1
        S.resolved[nm] = (S.resolved[nm] || 0) + (rd.resolved[k] ? 1 : 0)
        S.types[rd.types[k]]++
        if (rd.supers[k]) { S.superRounds.push(rd.n); used[k] = true }
        if (rd.lockedOut[k]) S.lockedOut++
      }
    }
    for (const k of [0, 1]) if (!used[k]) out.sides[k].superUnused++
  }
  out.win /= n
  out.margin = 1.96 * Math.sqrt(0.25 / n)
  out.median = median(out.lengths)
  out.mean = out.lengths.reduce((a, b) => a + b, 0) / n
  out.p10 = pct(out.lengths, 0.1); out.p90 = pct(out.lengths, 0.9)
  out.fighters = [fa, fb]
  return out
}

// Play n AI games, yielding to the browser between batches. onProgress(done, n).
export async function runBalance(fa, fb, { n = 300, seed = 1, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard'], onProgress, signal } = {}) {
  const rng = mulberry32(seed)
  const games = []
  let t = Date.now()
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break
    games.push(playAIGame(fa, fb, rng, rules, W, levels))
    if (Date.now() - t > 30) {
      onProgress?.(i + 1, n)
      await new Promise(r => setTimeout(r, 0))
      t = Date.now()
    }
  }
  onProgress?.(games.length, n)
  return summarise(games, fa, fb)
}

export { options }
