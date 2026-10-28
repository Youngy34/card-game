// Whole games, reveal records and balance reports for rules v14.

import { newGame, reveal, label, player } from './engine.js'
import { newContext, mixes, levelMixes, sampleIndex, DEFAULT_WEIGHTS } from './ai.js'
import { DEFAULT_RULES, CODES, TYPE_LABEL } from './rules.js'

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

// What a pick was, as its type code: 'S' 'H' 'G' 'F' 'B'
export const playCode = (G, side, pick) => player(G, side).f.cards[pick].t

// One logged reveal, in a compact form shared by the app, the log and the reports.
export function revealRecord(G, ev, N) {
  const r = {
    n: ev.n, cards: [label(G, 0, ev.picks[0]), label(G, 1, ev.picks[1])],
    types: ev.types, out: ev.out,
    kind: ev.kind, by: ev.by, result: ev.result, effects: ev.effects,
    dmg: ev.dmg, chip: ev.chip, grey: ev.grey, cashed: ev.cashed, cleared: ev.cleared,
    after: [{ hp: N.A.hp, pile: N.A.pile }, { hp: N.B.hp, pile: N.B.pile }],
  }
  if (ev.ko) r.ko = true
  if (ev.doubleKO) r.doubleKO = true
  if (ev.limit) r.limit = true
  return r
}

// How a game ended, from its last reveal
export function winRoute(last, result) {
  if (!last) return 'n/a'
  if (last.limit) return 'draw (reveal limit)'
  if (last.doubleKO) return result === 0.5 ? 'double KO, level' : 'double KO'
  if (result === 0.5) return 'draw'
  const w = result === 1 ? 0 : 1
  const t = last.kind === 'mirror' ? last.types[w] : last.types[last.by]
  return t === 'S' ? 'Strike chip' : t === 'H' ? 'Heavy' : t === 'G' ? 'Grab' : TYPE_LABEL[t] || t
}

export function playAIGame(fa, fb, rng, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard']) {
  let G = newGame(fa, fb, rules)
  const ctx = newContext(W)
  const hard = levels[0] === 'hard' && levels[1] === 'hard'
  const reveals = []
  while (!G.over) {
    const mx = mixes(G, ctx)
    const [px, py] = hard ? [mx.x, mx.y] : levelMixes(mx, levels)
    const a = mx.oa[sampleIndex(px, rng())], b = mx.ob[sampleIndex(py, rng())]
    const r = reveal(G, a, b)
    reveals.push(revealRecord(G, r.ev, r.G))
    G = r.G
  }
  return { result: G.result, reveals }
}

// ---- reports ----------------------------------------------------------------------
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const quant = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n }
const byType = v => Object.fromEntries(CODES.map(t => [t, typeof v === 'function' ? v(t) : v]))

export function emptyStats() {
  return {
    games: 0, win: 0, draws: 0, lengths: [], reveals: 0,
    mirrors: 0, trades: 0, results: {}, wonBy: byType(0),
    // squeeze[m][t]: plays of type t by a player whose opponent was missing type m
    squeeze: byType(() => byType(0)),
    damage: byType(0), cashed: 0, chip: 0, cashes: 0, emptyCashes: 0, clears: 0, cleared: 0,
    turnbacks: 0, turnbackGrey: 0, stopped: 0, doubles: 0, doubleGrey: 0, fizzles: 0,
    peaks: [], routes: {}, doubleKOs: 0,
    sides: [0, 1].map(() => ({ plays: byType(0), won: byType(0), lost: byType(0), mirror: byType(0), cards: {}, wins: 0 })),
  }
}

// Add one game (side 0 = fighter A) to a running summary.
export function addGame(S, g) {
  S.games++
  S.win += g.result
  if (g.result === 0.5) S.draws++
  S.lengths.push(g.reveals.length)
  const last = g.reveals[g.reveals.length - 1]
  bump(S.routes, winRoute(last, g.result))
  if (last?.doubleKO) S.doubleKOs++
  let peak = 0
  for (const r of g.reveals) {
    S.reveals++
    peak = Math.max(peak, r.after[0].pile, r.after[1].pile)
    bump(S.results, r.result)
    if (r.kind === 'mirror') { S.mirrors++; if (r.result === 'trade') S.trades++ }
    else S.wonBy[r.types[r.by]]++
    for (const k of [0, 1]) {
      const t = r.types[k], side = S.sides[k]
      side.plays[t]++
      const C = (side.cards[r.cards[k]] ??= { t, plays: 0, won: 0, lost: 0, mirror: 0 })
      C.plays++
      if (r.kind === 'mirror') { side.mirror[t]++; C.mirror++ }
      else if (r.by === k) { side.won[t]++; C.won++ }
      else { side.lost[t]++; C.lost++ }
      for (const m of r.out?.[1 - k] || '') S.squeeze[m][t]++
      // effects this card had
      const e = r.effects?.[k]
      if (e === 'cash') { S.cashes++; if (!r.cashed[1 - k]) S.emptyCashes++ }
      if (e === 'clear') { S.clears++; S.cleared += r.cleared[k] }
      if (e === 'turnback') { S.turnbacks++; S.turnbackGrey += r.grey[1 - k] }
      if (e === 'stopped') S.stopped++
      if (e === 'double') { S.doubles++; S.doubleGrey += r.grey[1 - k] }
      if (e === 'fizzle') S.fizzles++
      // damage to the other player came from this card
      const d = r.dmg[1 - k]
      if (d > 0 && r.effects?.[k]) { S.damage[t] += d; S.cashed += r.cashed[1 - k]; S.chip += r.chip[1 - k] }
    }
  }
  S.peaks.push(peak)
  if (g.result === 1) S.sides[0].wins++; else if (g.result === 0) S.sides[1].wins++
  return S
}

export function finishStats(S, fa, fb) {
  const n = Math.max(S.games, 1)
  return {
    ...S,
    winRate: S.win / n, margin: 1.96 * Math.sqrt(0.25 / n),
    median: median(S.lengths), p10: quant(S.lengths, 0.1), p90: quant(S.lengths, 0.9),
    mean: S.lengths.reduce((a, b) => a + b, 0) / n,
    mirrorRate: S.reveals ? S.mirrors / S.reveals : null,
    medianPeak: median(S.peaks), maxPeak: S.peaks.length ? Math.max(...S.peaks) : null,
    meanCash: S.cashes ? S.cashed / S.cashes : null,
    fighters: [fa, fb],
  }
}

export function summarise(games, fa, fb) {
  const S = emptyStats()
  for (const g of games) addGame(S, g)
  return finishStats(S, fa, fb)
}

// Play n games, yielding to the browser between batches. onProgress(done, n).
export async function runBalance(fa, fb, { n = 200, seed = 1, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard'], onProgress, signal } = {}) {
  const rng = mulberry32(seed)
  const S = emptyStats()
  let t = Date.now()
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break
    addGame(S, playAIGame(fa, fb, rng, rules, W, levels))
    if (Date.now() - t > 30) {
      onProgress?.(i + 1, n)
      await new Promise(r => setTimeout(r, 0))
      t = Date.now()
    }
  }
  onProgress?.(S.games, n)
  return finishStats(S, fa, fb)
}

// The squeeze table: for each type the opponent was missing, the share of each
// type played. Rows with no data are left out.
export function squeezeRows(S) {
  return CODES.map(m => {
    const row = S.squeeze[m], tot = CODES.reduce((s, t) => s + row[t], 0)
    return tot ? { missing: m, n: tot, share: byType(t => row[t] / tot) } : null
  }).filter(Boolean)
}
