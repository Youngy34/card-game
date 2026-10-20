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
  return { ...g, MBt, x: sa.x, y: sb.x, vA: sa.v, vB: sb.v }
}

// ---- difficulty -----------------------------------------------------------
// Easier levels make mistakes that scale with their cost. Instead of the exact
// unexploitable mix, each card is played with a chance that grows with how
// good it looks against the opponent's likely play: close calls become coin
// flips, but throwing away a big win is rare. (In game theory, a "quantal
// response equilibrium".) `lambda` is how sharply it prefers better cards:
// 0 is random, and higher values approach Hard. Payoffs are win chances, so a
// card 0.1 worse than the best is played e^(-0.1 * lambda) times as often.
//
// Calibrated 20 October 2026 in the four mirror matchups (2,000 games per pairing):
// Hard beats Medium about 62-38, Medium beats Easy about 60-40, Hard beats Easy
// about 69-31. A player choosing at random still beats Hard about 22% of the time.
export const LEVELS = {
  easy: { label: 'Easy', lambda: 5, about: 'Loose: often picks a weaker card when the choice is close, and now and then misses a big one.' },
  medium: { label: 'Medium', lambda: 20, about: 'Mostly sound: rarely misses a big play, but loose when the choice is close.' },
  hard: { label: 'Hard', lambda: null, about: 'The full sparring partner: the unexploitable mix every round.' },
}

const softmax = (u, lambda) => {
  let mx = -Infinity
  for (const v of u) if (v > mx) mx = v
  const e = u.map(v => Math.exp(lambda * (v - mx)))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / s)
}

// Both players' mixes when both judge with the same lambda (found by damped
// iteration). M: rows = player 1's options, payoff to player 1; Mt: rows =
// player 2's options, payoff to player 2.
export function quantal(M, Mt, lambda, maxIters = 6000) {
  const n = M.length, m = Mt.length
  let x = new Array(n).fill(1 / n), y = new Array(m).fill(1 / m)
  // Steps sized to lambda, then shrinking (smoothed fictitious play): with a
  // fixed step the two mixes can chase each other round in circles instead of
  // settling; shrinking steps are guaranteed to settle in games like this one.
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

// The odds each side actually plays from, given its level ('hard', 'medium', 'easy').
// Hard is the exact unexploitable mix.
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

export function sample(p, rng) {
  const r = rng()
  let c = 0
  for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) return i }
  return p.length - 1
}
