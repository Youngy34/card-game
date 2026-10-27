// The sparring partner for rules v13.
//
// Neutral: it lists every pairing of the two players' available cards, plays
// each one out, values the result, and solves that grid as a zero-sum game for
// the mix the opponent can't exploit (the same approach as the v11 simulator).
// It looks one neutral reveal ahead, but plays out everything that reveal
// starts: a counter is chosen by trying each one, and a combo is solved beat
// by beat to its end, so the value of landing a hit includes the whole combo
// guessing game that follows.
//
// A neutral board is valued by a score per player, turned into a win chance:
//   HP − alpha × grey on your pile + init if you hold the initiative
//      + opt × attack cards available − gap × directions you can't attack in
// Payoffs are win chances in [0, 1], so the difficulty levels and the solver
// carry over from the v11 app unchanged.

import { reveal, options, avail, popcount } from './engine.js'
import { maximin } from './lp.js'

export const DEFAULT_WEIGHTS = {
  alpha: 0.5,   // a grey token on your pile costs 0.5 HP (the next ender cashes it; a break clears it)
  init: 2.0,    // holding the initiative is worth 2 HP
  opt: 0.4,     // each attack card available next reveal is worth 0.4 HP
  gap: 1.0,     // −1 for each direction (Horizontal, Vertical, Throw) you have but can't play
  k: 0.2,       // steepness of the score-difference -> win-chance curve
}

export function score(G, side, W) {
  const X = side ? G.B : G.A
  const av = avail(X)
  let e = X.hp - W.alpha * X.pile + W.opt * popcount(av)
  if (G.init === side) e += W.init
  for (const d of ['H', 'V', 'T']) if (X.f.dirs[d] && !(X.f.dirs[d] & av)) e -= W.gap
  return e
}

// Estimated chance that A wins from a neutral board (or the result, if over).
// With the experimental round timer on, a lead counts for more as time runs
// out (the curve steepens), so waiting costs whoever is behind.
export function boardValue(G, W) {
  if (G.over) return G.result
  let k = W.k
  if (G.R.clock) k *= Math.sqrt(G.R.clock / Math.max(G.R.clock - G.n + 1, 1))
  return 1 / (1 + Math.exp(-k * (score(G, 0, W) - score(G, 1, W))))
}

// A thinking context: weights plus a memo of solved combo positions. One per
// game (the memo is only valid for one pair of fighters, rules and weights).
export function newContext(W = DEFAULT_WEIGHTS) {
  return { W: { ...DEFAULT_WEIGHTS, ...W }, memo: new Map() }
}

const key = G => {
  const a = G.A, b = G.B, c = G.combo
  return `${a.hp},${a.pile},${a.cd1},${a.cd2},${a.brk},${b.hp},${b.pile},${b.cd1},${b.cd2},${b.brk},${G.init},${c.att},${c.links},${c.landed}${G.R.clock ? ',' + G.n : ''}`
}

export function stateValue(G, ctx) {
  if (G.over) return G.result
  if (G.mode === 'combo') return solveCombo(G, ctx).v
  return boardValue(G, ctx.W)
}

// A combo beat as a zero-sum grid, solved to the end of the combo.
export function solveCombo(G, ctx) {
  const k = key(G)
  const hit = ctx.memo.get(k)
  if (hit) return hit
  const oa = options(G, 0), ob = options(G, 1)
  const M = oa.map(a => ob.map(b => stateValue(reveal(G, a, b).G, ctx)))
  const s = maximin(M)
  const out = { v: s.v, oa, ob, M, x: s.x }
  if (ctx.memo.size > 200000) ctx.memo.clear()
  ctx.memo.set(k, out)
  return out
}

// The best counter for the defender after an Exposed result, and each option's value.
export function counterChoices(G, a, b, pending, ctx) {
  const side = pending.side
  return [null, ...pending.options].map(c => {
    const r = reveal(G, a, b, c)
    const v = stateValue(r.G, ctx)
    return { c, v, mine: side === 0 ? v : 1 - v }        // `mine`: the defender's own win chance
  })
}

// The neutral grid: M[i][j] = A's win chance after A plays oa[i] and B plays
// ob[j], with any counter chosen by the defender to suit themselves.
export function neutralGrid(G, ctx) {
  const oa = options(G, 0), ob = options(G, 1)
  const M = oa.map(a => ob.map(b => {
    const r = reveal(G, a, b)
    if (!r.pending) return stateValue(r.G, ctx)
    const ch = counterChoices(G, a, b, r.pending, ctx)
    let best = ch[0]
    for (const x of ch) if (x.mine > best.mine) best = x
    return best.v
  }))
  return { oa, ob, M }
}

// Both players' unexploitable mixes for the current reveal (neutral or combo).
export function mixes(G, ctx) {
  const g = G.mode === 'combo' ? solveCombo(G, ctx) : neutralGrid(G, ctx)
  const { oa, ob, M } = g
  const sa = g.x ? { x: g.x, v: g.v } : maximin(M)
  const MBt = ob.map((_, j) => oa.map((_, i) => 1 - M[i][j]))   // rows = B's options, payoff to B
  const sb = maximin(MBt)
  return { oa, ob, MA: M, MBt, x: sa.x, y: sb.x, vA: sa.v, vB: sb.v }
}

// ---- difficulty (carried over from the v11 app) -----------------------------------
// Easier levels make mistakes that scale with their cost: each card is played
// with a chance that grows with how good it looks (a quantal response mix).
// `lambda` is how sharply it prefers better cards: 0 is random, higher values
// approach Hard. The same rule picks counters.
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

// The counter a sparring partner plays at its level: Hard takes the best;
// easier levels pick by quantal response over the options' values.
export function pickCounter(choices, level, r) {
  const lambda = LEVELS[level]?.lambda
  if (lambda === null || lambda === undefined) {
    let best = choices[0]
    for (const x of choices) if (x.mine > best.mine + 1e-12) best = x
    return best.c
  }
  return choices[sampleIndex(softmax(choices.map(x => x.mine), lambda), r)].c
}

export function sampleIndex(p, r) {
  let c = 0
  for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) return i }
  return p.length - 1
}
