// The sparring partner: the simulator's player, ported from yomi_sim.py.
//
// Each round it lists every pairing of the two players' available cards,
// scores the board each pairing produces with a value function, solves that
// grid as a zero-sum game for the mix the opponent can't exploit, and picks a
// card at random using those odds. It looks one round ahead, so anything that
// pays off later is valued only through the fixed weights below.

import { step, options, card, flowing, followupValue, convertChip, DEFAULT_RULES } from './engine.js'
import { maximin } from './lp.js'

export const DEFAULT_WEIGHTS = {
  alpha: 0.6,    // a grey token is worth 0.6 HP (it can be healed away)
  beta: 2.0,     // holding your Super is worth 2 HP
  opt: 0.4,      // each card in hand is worth 0.4 HP (options)
  gap: 1.5,      // -1.5 for each triangle type you can't play next round
  lethal: 2.0,   // -2 if the opponent's best Convert would kill you
  flowv: 1.5,    // +1.5 for being in Flow next round
  followv: 0.5,  // +0.5 per point of follow-up chip (e.g. Taunt), per round it stays live
  k: 0.28,       // steepness of the HP-difference -> win-probability curve
}

export function availableTypes(X) {
  const s = new Set()
  for (const i of options(X)) s.add(card(X, i).t)
  return s
}

function bestConvert(X, cashed) {
  let best = null
  for (const i of options(X)) {
    const c = card(X, i)
    if (c.t === 'C') { const v = convertChip(c, X, cashed); if (best === null || v > best) best = v }
  }
  return best
}

export function score(X, Y, evaluator, W) {
  const a = (evaluator === X && X.f.selfAlpha !== null && X.f.selfAlpha !== undefined) ? X.f.selfAlpha : W.alpha
  const pile = X.pile
  let e = X.hp - a * pile + W.opt * X.hand.length + (X.sup ? W.beta : 0)
  if (flowing(X)) e += W.flowv
  e += W.followv * followupValue(X)
  const av = availableTypes(X)
  for (const t of ['P', 'C', 'R']) if (!av.has(t)) e -= W.gap
  const mc = bestConvert(Y, pile)
  if (mc !== null && pile + mc >= X.hp) e -= W.lethal
  return e
}

// Estimated probability that A wins, as judged by `evaluator`
export function value(A, B, result, evaluator, W) {
  if (result !== null) return result
  return 1 / (1 + Math.exp(-W.k * (score(A, B, evaluator, W) - score(B, A, evaluator, W))))
}

// Both players' payoff grids for the current board.
// MA[i][j]: A's estimate that A wins after A plays oa[i] and B plays ob[j].
// MB[i][j]: B's estimate that A wins after the same pair.
export function grids(A, B, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS) {
  const oa = options(A), ob = options(B)
  const MA = [], MB = [], next = []
  for (const a of oa) {
    const ra = [], rb = [], rn = []
    for (const b of ob) {
      const s = step(A, B, a, b, rules)
      ra.push(value(s.A, s.B, s.result, s.A, W))
      rb.push(value(s.A, s.B, s.result, s.B, W))
      rn.push(s)
    }
    MA.push(ra); MB.push(rb); next.push(rn)
  }
  return { oa, ob, MA, MB, next }
}

// Each player's unexploitable mix for this round
export function mixes(A, B, rules, W) {
  const g = grids(A, B, rules, W)
  const sa = maximin(g.MA)
  // B maximises its own chance, 1 - P(A wins), with rows = B's options
  const MBt = g.ob.map((_, j) => g.oa.map((_, i) => 1 - g.MB[i][j]))
  const sb = maximin(MBt)
  return { ...g, x: sa.x, y: sb.x, vA: sa.v, vB: sb.v }
}

export function sample(p, rng) {
  const r = rng()
  let c = 0
  for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) return i }
  return p.length - 1
}
