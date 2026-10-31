// The v16 sparring partner. Hands are hidden now, so it can't solve the round
// the way the v15 partner did. Instead it guesses: it deals the opponent a few
// possible hands from the cards it can't see (their deck, their hand and their
// burned cards), solves the clash for each as v15 did (every pairing scored a
// round ahead, then the mix the opponent can't exploit), and plays the average
// of those mixes. Follow-ups, Linkers and Enders it picks greedily, by the same
// value function. In the neutral phase it scores each action by the clash it
// leads to, and picks among them with a little randomness, so it isn't readable.
//
// Known limits: it never bluffs on purpose, it assumes the opponent did nothing
// in the neutral phase when weighing its own action, and it can't see payoffs
// beyond the next round (a knockdown is worth only what the weights say).

import { maximin } from '../lp.js'
import { clashOptions16, neutralOptions16, runClash16, decideClash16, unseenPool, card16, superReady } from './engine.js'

export const DEFAULT_W16 = {
  alpha: 0.6,        // a grey token on you costs 0.6 HP
  card: 0.5,         // each card in hand is worth 0.5 HP
  meter: 0.4,        // each point of meter is worth 0.4 HP
  superReady: 1.5,   // having the meter for your Super is worth 1.5 HP more
  knockdown: 0.8,    // being knocked down next round costs 0.8 HP
  lock: 1.5,         // each type locked next round costs 1.5 HP
  staggered: 0.4,    // being staggered next round costs 0.4 HP
  dizzy: 5,          // being dizzy next round costs 5 HP
  k: 0.22,           // steepness of the HP-lead -> win-chance curve
  samples: 6,        // opponent hands dealt for each clash decision
  neutralSamples: 3, // ... and for each neutral-phase decision
}

export const LEVELS16 = {
  easy: { label: 'Easy', lambda: 5, neutral: 8, about: 'Loose: often picks a weaker card when the choice is close.' },
  medium: { label: 'Medium', lambda: 20, neutral: 25, about: 'Mostly sound, but loose when the choice is close.' },
  hard: { label: 'Hard', lambda: null, neutral: 60, about: 'The full sparring partner: the mix you can\'t exploit, against the hands you might hold.' },
}
// Mindless bots, for testing that sound play beats them
export const BOTS16 = {
  random: { label: 'Random bot', about: 'Picks at random every time.' },
  pressure: { label: 'Pressure bot', about: 'Plays a Pressure whenever it holds one; otherwise at random. Draws in the neutral phase.' },
  attack: { label: 'Attack bot', about: 'Plays an attack whenever it holds one. Draws in the neutral phase.' },
  guard: { label: 'Guard bot', about: 'Plays a Guard whenever it holds one. Draws in the neutral phase.' },
}

// ---- value -----------------------------------------------------------------
export function score16(X, W, rules) {
  let e = X.hp - W.alpha * X.pile + W.card * X.hand.length + W.meter * X.meter
  if (superReady(X, rules)) e += W.superReady
  const n = X.next
  if (n.knockdown) e -= W.knockdown
  if (n.staggered) e -= W.staggered
  if (n.dizzy) e -= W.dizzy
  if (n.lock) for (const t of ['P', 'C', 'R']) if (n.lock[t]) e -= W.lock
  return e
}
// The chance that A wins, as the value function sees it
export function value16(G, W) {
  if (G.result !== null && G.result !== undefined) return G.result
  return 1 / (1 + Math.exp(-W.k * (score16(G.A, W, G.rules) - score16(G.B, W, G.rules))))
}

// Follow-ups, Linkers and Enders: the choice (or none) that leaves the board
// best for the chooser, playing any Ender still to come the same way
export function bestChoice16(G, pending, W) {
  const side = pending.side
  let best = null, bestV = -Infinity
  for (const c of [null, ...pending.options]) {
    let g = decideClash16(G, c, true)
    while (g.pending) g = decideClash16(g, bestChoice16(g, g.pending, W), true)
    const v = side === 0 ? value16(g, W) : 1 - value16(g, W)
    if (v > bestV + 1e-12) { bestV = v; best = c }
  }
  return best
}

// ---- dealing the opponent a hand ----------------------------------------------
function dealHand(pool, n, rng) {
  const p = pool.slice(), out = []
  for (let k = 0; k < n && p.length; k++) {
    const j = Math.floor(rng() * p.length)
    out.push(p[j]); p[j] = p[p.length - 1]; p.pop()
  }
  return out
}
// A view of the game where the opponent of `side` holds `hand`
function withHand(G, side, hand) {
  const o = side === 0 ? 'B' : 'A'
  return { ...G, [o]: { ...G[o], hand } }
}

// The clash grid for `side` against one possible opponent hand: rows are its
// options, columns the opponent's, entries its chance of winning
function grid(G, side, W) {
  const me = side === 0 ? G.A : G.B, op = side === 0 ? G.B : G.A
  const rows = clashOptions16(me, G.rules), cols = clashOptions16(op, G.rules)
  const R = rows.length ? rows : [null], C = cols.length ? cols : [null]
  const decide = (g, p) => bestChoice16(g, p, W)
  const M = R.map(r => C.map(c => {
    const g = side === 0 ? runClash16(G, r, c, decide, true) : runClash16(G, c, r, decide, true)
    const v = value16(g, W)
    return side === 0 ? v : 1 - v
  }))
  return { rows: R, cols: C, M }
}

const softmax = (u, lambda) => {
  const mx = Math.max(...u)
  const e = u.map(v => Math.exp(lambda * (v - mx)))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / s)
}

// The mix `side` plays its clash card from, over the opponent hands it deals.
// Returns { options, x, value, util }.
export function clashMix16(G, side, W, rng, level = 'hard', hands = null) {
  const op = side === 0 ? G.B : G.A
  const pool = unseenPool(op)
  const K = hands ? hands.length : W.samples
  let rows = null, x = null, util = null, value = 0
  for (let s = 0; s < K; s++) {
    const hand = hands ? hands[s] : dealHand(pool, op.hand.length, rng)
    const g = grid(withHand(G, side, hand), side, W)
    if (!rows) { rows = g.rows; x = rows.map(() => 0); util = rows.map(() => 0) }
    const sol = maximin(g.M)
    // the opponent's own unexploitable mix against this hand, to score each row
    const Mt = g.cols.map((_, j) => g.rows.map((_, i) => 1 - g.M[i][j]))
    const y = maximin(Mt).x
    for (let i = 0; i < rows.length; i++) {
      x[i] += sol.x[i] / K
      let u = 0
      for (let j = 0; j < y.length; j++) u += g.M[i][j] * y[j]
      util[i] += u / K
    }
    value += sol.v / K
  }
  const lambda = LEVELS16[level]?.lambda
  if (lambda) x = softmax(util, lambda)
  return { options: rows, x, value, util }
}

// ---- the neutral phase -----------------------------------------------------------
// The cards a player would give up first: the ones it holds most copies of,
// and the most of whose type it holds
export function burnOrder(X) {
  const copies = {}, types = {}
  for (const i of X.hand) { copies[i] = (copies[i] || 0) + 1; const t = X.f.cards[i].t; types[t] = (types[t] || 0) + 1 }
  return X.hand.slice().sort((a, b) => (copies[b] + 0.5 * types[X.f.cards[b].t]) - (copies[a] + 0.5 * types[X.f.cards[a].t]))
}

// Every action a player could take in the neutral phase
export function neutralActions16(X, rules) {
  const o = neutralOptions16(X, rules)
  if (o.skip) return [null]
  const acts = [{ kind: 'draw' }]
  for (const i of o.neutrals) acts.push({ kind: 'neutral', i })
  const order = burnOrder(X)
  for (let n = 1; n <= o.maxBurn && n < X.hand.length; n++) acts.push({ kind: 'burn', cards: order.slice(0, n) })
  return acts
}

// What `side` would hold after an action (the opponent's action unknown: taken as nothing)
function afterNeutral(G, side, act, rng) {
  const key = side === 0 ? 'A' : 'B'
  const X = { ...G[key], hand: G[key].hand.slice(), fx: { ...G[key].fx } }
  if (act.kind === 'draw') {
    if (X.deck.length) X.hand.push(X.deck[Math.floor(rng() * X.deck.length)])      // it doesn't know its deck order
  } else if (act.kind === 'neutral') {
    X.hand.splice(X.hand.lastIndexOf(act.i), 1)
    for (const [k, v] of Object.entries(X.f.cards[act.i].thisRound || {})) X.fx[k] = (X.fx[k] || 0) + v
  } else if (act.kind === 'burn') {
    for (const i of act.cards) X.hand.splice(X.hand.lastIndexOf(i), 1)
    X.meter += act.cards.length
  }
  return { ...G, [key]: X }
}

export function neutralChoice16(G, side, W, rng, level = 'hard') {
  const X = side === 0 ? G.A : G.B, op = side === 0 ? G.B : G.A
  const acts = neutralActions16(X, G.rules)
  if (acts.length === 1) return { acts, p: [1], values: [null], act: acts[0] }
  const pool = unseenPool(op)
  const hands = Array.from({ length: W.neutralSamples }, () => dealHand(pool, op.hand.length, rng))
  const values = acts.map(a => clashMix16(afterNeutral(G, side, a, rng), side, W, rng, 'hard', hands).value)
  const p = softmax(values, LEVELS16[level]?.neutral ?? 60)
  let r = rng(), k = p.length - 1
  for (let i = 0; i < p.length; i++) { r -= p[i]; if (r < 0) { k = i; break } }
  return { acts, p, values, act: acts[k] }
}

// ---- bots and small decisions ------------------------------------------------------
const pickRandom = (a, rng) => a[Math.floor(rng() * a.length)]

export function botNeutral(G, side, bot, rng) {
  const X = side === 0 ? G.A : G.B
  const acts = neutralActions16(X, G.rules)
  if (bot === 'random') return pickRandom(acts, rng)
  return acts[0]                                    // draw (or the forced skip)
}

export function botClash(G, side, bot, rng) {
  const X = side === 0 ? G.A : G.B
  const opts = clashOptions16(X, G.rules)
  if (!opts.length) return null
  const want = { pressure: ['P'], attack: ['P', 'C'], guard: ['R'] }[bot]
  if (want) {
    const fit = opts.filter(i => want.includes(card16(X, i).t))
    if (fit.length) return pickRandom(fit, rng)
  }
  return pickRandom(opts, rng)
}

// Discarding down to the hand limit: the most redundant cards go first
export function chooseDiscards(X, n) { return burnOrder(X).slice(0, n) }

export function sampleIndex(p, rng) {
  let r = rng()
  for (let i = 0; i < p.length; i++) { r -= p[i]; if (r < 0) return i }
  return p.length - 1
}
