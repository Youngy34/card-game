// The sparring partner for rules v14.
//
// Each reveal it lists every pairing of the two players' available cards,
// plays each one out, values the result, and solves that grid as a zero-sum
// game for the mix the opponent can't exploit (the same approach as the v11
// and v13 partners). With depth 2 (the default) the value of each pairing is
// itself the solved value of the next reveal's grid, so it sees what comes
// back off cooldown and what the opponent will be missing. Depth 1 is the
// throwaway bot of the 28 October rough check.
//
// A board is valued by a score per player, turned into a win chance:
//   HP − alpha × grey on your pile (grey past lethal counts as lethal) + meter × pips
// Payoffs are win chances in [0, 1], so the difficulty levels and the solver
// carry over from the v11 app unchanged.

import { reveal, options } from './engine.js'
import { maximin } from './lp.js'

export const DEFAULT_WEIGHTS = {
  alpha: 0.5,   // a grey token on your pile costs 0.5 HP (a cash turns it into damage; a Focus clears it)
  meter: 1.5,   // each pip of meter is worth 1.5 HP (only matters when Focus gains meter)
  k: 0.2,       // steepness of the score-difference -> win-chance curve
  depth: 2,     // reveals looked ahead: 1, 2 or 3 (3 is slow in the Lab)
}

export function score(G, side, W) {
  const X = side ? G.B : G.A
  return X.hp - W.alpha * Math.min(X.pile, Math.max(X.hp, 0)) + (W.meter || 0) * (X.meter || 0)
}

// Estimated chance that A wins from a board (or the result, if over)
export function boardValue(G, W) {
  if (G.over) return G.result
  return 1 / (1 + Math.exp(-W.k * (score(G, 0, W) - score(G, 1, W))))
}

// A thinking context: weights plus a memo of solved positions. One per game
// (the memo is only valid for one pair of fighters, rules and weights).
export function newContext(W = DEFAULT_WEIGHTS) {
  return { W: { ...DEFAULT_WEIGHTS, ...W }, memo: new Map() }
}

const key = (G, d) => {
  const a = G.A, b = G.B
  return `${d}|${a.hp},${a.pile},${a.cd1},${a.cd2},${a.meter}|${b.hp},${b.pile},${b.cd1},${b.cd2},${b.meter}`
}

export const depthOf = W => Math.min(3, Math.max(1, Math.round(W.depth || 1)))

// A's win chance from G, looking d reveals ahead
export function value(G, d, ctx) {
  if (G.over) return G.result
  if (d <= 0) return boardValue(G, ctx.W)
  const k = key(G, d)
  const hit = ctx.memo.get(k)
  if (hit !== undefined) return hit
  const oa = options(G, 0), ob = options(G, 1)
  const v = maximin(oa.map(a => ob.map(b => value(reveal(G, a, b).G, d - 1, ctx)))).v
  if (ctx.memo.size > 200000) ctx.memo.clear()
  ctx.memo.set(k, v)
  return v
}

// The grid for this reveal: M[i][j] = A's win chance after A plays oa[i] and B plays ob[j]
export function grid(G, ctx) {
  const d = depthOf(ctx.W)
  const oa = options(G, 0), ob = options(G, 1)
  const M = oa.map(a => ob.map(b => value(reveal(G, a, b).G, d - 1, ctx)))
  return { oa, ob, M }
}

// Both players' unexploitable mixes for the current reveal.
export function mixes(G, ctx) {
  const { oa, ob, M } = grid(G, ctx)
  const sa = maximin(M)
  const MBt = ob.map((_, j) => oa.map((_, i) => 1 - M[i][j]))   // rows = B's options, payoff to B
  const sb = maximin(MBt)
  return { oa, ob, MA: M, MBt, x: sa.x, y: sb.x, vA: sa.v, vB: sb.v }
}

// ---- difficulty (carried over from the v11 app) -----------------------------------
// Easier levels make mistakes that scale with their cost: each card is played
// with a chance that grows with how good it looks (a quantal response mix).
// `lambda` is how sharply it prefers better cards: 0 is random, higher values
// approach Hard.
export const LEVELS = {
  easy: { label: 'Easy', lambda: 5, about: 'Loose: often picks a weaker card when the choice is close, and now and then misses a big one.' },
  medium: { label: 'Medium', lambda: 20, about: 'Mostly sound: rarely misses a big play, but loose when the choice is close.' },
  hard: { label: 'Hard', lambda: null, about: 'The full sparring partner: the unexploitable mix every reveal.' },
}

export const softmax = (u, lambda) => {
  let mx = -Infinity
  for (const v of u) if (v > mx) mx = v
  const e = u.map(v => Math.exp(lambda * (v - mx)))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / s)
}

export function quantal(M, Mt, lambda, maxIters = 6000) {
  const n = M.length, m = Mt.length
  let x = new Array(n).fill(1 / n), y = new Array(m).fill(1 / m)
  const a0 = Math.min(0.5, 2 / lambda), warm = 200
  let res = 1
  for (let t = 0; t < maxIters && res > 1e-6; t++) {
    const a = t < warm ? a0 : a0 * warm / t
    const ux = M.map(row => row.reduce((s, v, j) => s + v * y[j], 0))
    const uy = Mt.map(row => row.reduce((s, v, i) => s + v * x[i], 0))
    const bx = softmax(ux, lambda), by = softmax(uy, lambda)
    res = 0
    for (let i = 0; i < n; i++) { const d = bx[i] - x[i]; if (Math.abs(d) > res) res = Math.abs(d); x[i] += a * d }
    for (let j = 0; j < m; j++) { const d = by[j] - y[j]; if (Math.abs(d) > res) res = Math.abs(d); y[j] += a * d }
  }
  return { x, y, res }
}

// The odds each side actually plays from, given its level. Hard is the exact mix.
export function levelMixes(mx, levels = ['hard', 'hard']) {
  const out = [mx.x, mx.y]
  for (const k of [0, 1]) {
    const lambda = LEVELS[levels[k]]?.lambda
    if (lambda === null || lambda === undefined) continue
    const q = quantal(mx.MA, mx.MBt, lambda)
    out[k] = k === 0 ? q.x : q.y
  }
  return out
}

export function sampleIndex(p, r) {
  let c = 0
  for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) return i }
  return p.length - 1
}
