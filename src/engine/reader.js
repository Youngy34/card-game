// The Reader: a sparring partner that learns its opponent's habits.
//
// What it learns is how the opponent departs from the unexploitable mix: in
// each situation, which types they play more or less often than that mix
// would. A situation is:
//   - both piles: empty, small (1-3) or 4 and up;
//   - what they played last round, and whether it won, lost or neither.
// Earlier games (from the playtest log) can seed it. It never sees the card
// being picked this round.
//
// Each round it predicts their type: the unexploitable mix for this board,
// scaled by their learned habits. Then it plays a blend of the unexploitable
// mix (Hard) and its best answer to that prediction, leaning towards the
// answer only as far as the evidence near this situation, and the size of the
// habit, justify. Against someone who plays the unexploitable mix it stays
// close to Hard; against habits it punishes them.

import { card } from './engine.js'

const TYPES = ['P', 'C', 'R']
export const READER = {
  smooth: 3,         // expected picks it takes to move a habit halfway from the level above
  beta: 25,          // how sharply it prefers its best answer (win chances, so 0.1 better = e^2.5 times as often)
  cap: 0.8,          // the most it ever leans away from the unexploitable mix
  k: 8,              // rounds seen near this situation at which it leans halfway to the cap
  gap: 0.15,         // it leans fully only once its prediction differs from the unexploitable mix by this much
  priorWeight: 0.5,  // each round from an earlier game counts half as much as one from this game
}

const bucket = p => (p === 0 ? 0 : p < 4 ? 1 : 2)
const key1 = (piles, o) => `${bucket(piles[o])}|${bucket(piles[1 - o])}`
function lastOf(prev, o) {
  if (!prev) return 'start'
  const won = (prev.outcome === 'A' && o === 0) || (prev.outcome === 'B' && o === 1)
  const lost = (prev.outcome === 'A' && o === 1) || (prev.outcome === 'B' && o === 0)
  return `${prev.types[o]}${won ? '+' : lost ? '-' : '='}`
}

// Each side's unexploitable mix this round, by type: [{ P, C, R }, { P, C, R }].
// Rounds record it (as `eq`) so the Reader can compare choices with it.
export function eqTypes(mx, A, B) {
  return [[mx.oa, mx.x, A], [mx.ob, mx.y, B]].map(([opts, x, X]) => {
    const p = { P: 0, C: 0, R: 0 }
    opts.forEach((i, k) => { const t = card(X, i).t; if (t in p) p[t] += x[k] })
    const s = p.P + p.C + p.R
    for (const t of TYPES) p[t] = s > 0 ? +(p[t] / s).toFixed(4) : 0
    return p
  })
}

// One observation per round of side o: the situation, the type chosen, and
// what the unexploitable mix would have played. Rounds without `eq` are skipped.
export function observe(rounds, o) {
  const out = []
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i], t = r.types?.[o]
    if (!TYPES.includes(t) || !r.before || !r.eq) continue
    const piles = [r.before[0].pile, r.before[1].pile]
    const k1 = key1(piles, o)
    out.push({ k1, k2: `${k1}|${lastOf(rounds[i - 1], o)}`, t, e: r.eq[o] })
  }
  return out
}

function tally(obs, w, T) {
  for (const x of obs) {
    for (const [tab, key] of [[T.all, 'all'], [T.k1, x.k1], [T.k2, x.k2]]) {
      const c = (tab[key] ??= { obs: { P: 0, C: 0, R: 0 }, exp: { P: 0, C: 0, R: 0 }, n: 0 })
      c.obs[x.t] += w; c.n += w
      for (const t of TYPES) c.exp[t] += w * (x.e[t] || 0)
    }
  }
  return T
}
// habit[t]: how many times more (or less) often than the unexploitable mix they play t
function habit(c, parent, s) {
  if (!c || !c.n) return parent
  const out = {}
  for (const t of TYPES) out[t] = (c.obs[t] + s * parent[t]) / (c.exp[t] + s)
  return out
}

// The Reader's mix for `side` this round.
//   mx: the round's grids and unexploitable mixes (ai.js mixes)
//   rounds: this game's rounds so far (each with types, before, outcome, eq)
//   A, B: the board now; prior: observations from earlier games (optional)
// Returns { x: odds over the Reader's options, read: { P, C, R, n, lean } }.
export function readerMix(mx, rounds, side, { A, B, prior = null, opts = READER } = {}) {
  const o = 1 - side
  const X = o === 0 ? A : B
  const oppOpts = o === 0 ? mx.oa : mx.ob, oppEq = o === 0 ? mx.x : mx.y
  const myEq = side === 0 ? mx.x : mx.y, myOpts = side === 0 ? mx.oa : mx.ob
  const typeOf = i => card(X, i).t
  const pEq = eqTypes(mx, A, B)[o]

  const T = { all: {}, k1: {}, k2: {} }
  if (prior) tally(prior, opts.priorWeight, T)
  tally(observe(rounds, o), 1, T)
  const k1 = key1([A.pile, B.pile], o), k2 = `${k1}|${lastOf(rounds[rounds.length - 1], o)}`
  let h = habit(T.all.all, { P: 1, C: 1, R: 1 }, opts.smooth)
  h = habit(T.k1[k1], h, opts.smooth)
  h = habit(T.k2[k2], h, opts.smooth)

  // prediction: this board's unexploitable mix, scaled by their habits
  const p = {}
  let s = 0
  for (const t of TYPES) { p[t] = pEq[t] * h[t]; s += p[t] }
  if (s <= 0) return { x: myEq, read: null }
  for (const t of TYPES) p[t] /= s
  const d = TYPES.reduce((a, t) => a + Math.abs(p[t] - pEq[t]), 0) / 2

  // spread each type's chance over its cards as the unexploitable mix would
  const within = {}
  oppOpts.forEach((i, k) => { const t = typeOf(i); (within[t] ??= []).push(k) })
  const q = new Array(oppOpts.length).fill(0)
  for (const [t, ks] of Object.entries(within)) {
    const tot = ks.reduce((a, k) => a + oppEq[k], 0)
    for (const k of ks) q[k] = (p[t] || 0) * (tot > 0 ? oppEq[k] / tot : 1 / ks.length)
  }

  // expected win chance of each of its options against that prediction
  const ev = myOpts.map((_, r) => q.reduce((acc, qq, k) => {
    if (!qq) return acc
    return acc + qq * (side === 1 ? 1 - mx.MB[k][r] : mx.MA[r][k])
  }, 0))
  const mxv = Math.max(...ev)
  const e = ev.map(v => Math.exp(opts.beta * (v - mxv)))
  const se = e.reduce((a, b) => a + b, 0)
  const n = (T.k1[k1]?.n || 0) + (T.k2[k2]?.n || 0)
  const lean = opts.cap * n / (n + opts.k) * Math.min(1, d / opts.gap)
  const x = myEq.map((v, r) => (1 - lean) * v + lean * e[r] / se)
  return { x, read: { P: +p.P.toFixed(3), C: +p.C.toFixed(3), R: +p.R.toFixed(3), n: +n.toFixed(1), lean: +lean.toFixed(2) } }
}
