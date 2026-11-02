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
import { clashOptions16, clashChoices16, neutralOptions16, runClash16, decideClash16, unseenPool, card16, superReady, handLimitOf, confiscateFloor, neutralModes16, tableCost } from './engine.js'

export const DEFAULT_W16 = {
  alpha: 0.6,        // a grey token on you costs 0.6 HP
  card: 0.5,         // each card in hand is worth 0.5 HP
  meter: 0.4,        // each point of meter is worth 0.4 HP
  inPlay: 0.4,       // a neutral card staying in play (Breakfall) is worth 0.4 HP
  superReady: 1.5,   // having the meter for your Super is worth 1.5 HP more
  knockdown: 0.8,    // being knocked down next round costs 0.8 HP
  lock: 1.5,         // each type locked next round costs 1.5 HP
  staggered: 0.4,    // being staggered next round costs 0.4 HP
  dizzy: 5,          // being dizzy next round costs 5 HP
  owned: 1,          // rules v17: each special taken from the table (yours for the game) is worth 1 HP
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
  convert: { label: 'Convert bot', about: 'Plays its fastest Convert (the Super when it can) whenever it holds one; otherwise at random.' },
}

// ---- value -----------------------------------------------------------------
// Y (the opponent) matters for one thing: a card of theirs in play that caps X's hand (Shackles).
// Cards X owes to a Confiscate are already gone; under a cap, the cards over it after the
// next draw will be discarded, so they count for nothing.
export function score16(X, W, rules, Y = null) {
  let h = X.hand.length - (X.owe || 0) + (X.pendingDraw || 0)
  if (Y) { const lim = handLimitOf(X, Y, rules || {}); if (h + 1 > lim) h -= h + 1 - lim }
  let e = X.hp - W.alpha * X.pile + W.card * h + W.meter * X.meter + (X.inPlay != null ? (W.inPlay ?? 0.4) : 0)
  if (X.table) e += (W.owned ?? 1) * (X.f.cards.filter(c => c.special).length - X.table.length)
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
  return 1 / (1 + Math.exp(-W.k * (score16(G.A, W, G.rules, G.B) - score16(G.B, W, G.rules, G.A))))
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
  const rows = clashChoices16(me, G.rules), cols = clashChoices16(op, G.rules)
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

// One reveal: the setup card and the clash card are one secret choice, made
// without seeing the opponent's setup card. Rows are (setup action, clash card)
// pairs; columns the opponent's pairs, over the opponent hands it deals.
// Returns { options: [{ act, pick }], x, value, util }.
export function jointMix16(G, side, W, rng, level = 'hard') {
  const me = side === 0 ? G.A : G.B, op = side === 0 ? G.B : G.A
  const myActs = neutralActions16(me, G.rules, W.ban)
  const pool = unseenPool(op)
  const K = W.samples
  let rows = null, x = null, util = null, value = 0
  for (let s = 0; s < K; s++) {
    const Gs = withHand(G, side, dealHand(pool, op.hand.length, rng))
    const opActs = neutralActions16(side === 0 ? Gs.B : Gs.A, G.rules)
    const blocks = myActs.map(a => {
      const Ga = afterNeutral(Gs, side, a, rng)
      return opActs.map(b => grid(afterNeutral(Ga, 1 - side, b, rng), side, W))
    })
    const R = [], M = []
    myActs.forEach((a, ai) => blocks[ai][0].rows.forEach((r, ri) => {
      R.push({ act: a, pick: r })
      M.push(opActs.flatMap((b, bi) => blocks[ai][bi].M[ri]))
    }))
    if (!rows) { rows = R; x = R.map(() => 0); util = R.map(() => 0) }
    const sol = maximin(M)
    const C = M[0].length
    const Mt = Array.from({ length: C }, (_, j) => M.map(row => 1 - row[j]))
    const y = maximin(Mt).x
    for (let i = 0; i < rows.length; i++) {
      x[i] += sol.x[i] / K
      let u = 0
      for (let j = 0; j < y.length; j++) u += M[i][j] * y[j]
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
// ban (testing only): 'neutral', 'focus' or 'burn', an option this partner won't take
export function neutralActions16(X, rules, ban = null) {
  const o = neutralOptions16(X, rules)
  if (o.skip) return [null]
  if (o.split) {
    // Split decks: a neutral card from the neutral hand must be played. ban (testing only) may name a card.
    const acts = rules?.tableCards
      ? o.neutrals.flatMap(i => neutralModes16(X, i, rules).map(opt => (opt === 'base' ? { kind: 'neutral', i } : { kind: 'neutral', i, opt })))
      : o.neutrals.map(i => ({ kind: 'neutral', i }))
    const kept = acts.filter(a => X.f.cards[a.i].name !== ban)
    return kept.length ? kept : acts.length ? acts : [null]
  }
  const acts = rules?.focusDraw ? [] : [{ kind: 'draw' }]
  if (o.canFocus && (ban !== 'focus' || rules?.focusDraw)) acts.push({ kind: 'focus' })
  if (ban !== 'neutral') for (const i of o.neutrals) acts.push({ kind: 'neutral', i })
  if (ban === 'burn') return acts
  const noN = rules?.burnNeutrals === false || rules?.burnNeutrals === 0
  const order = burnOrder(X).filter(i => !noN || X.f.cards[i].t !== 'N')
  for (let n = 1; n <= o.maxBurn && n < X.hand.length; n++) acts.push({ kind: 'burn', cards: order.slice(0, n) })
  return acts
}

// What `side` would hold after an action (the opponent's action unknown: taken as nothing).
// With one reveal, this is also the state it picks its clash card from: a drawn card
// arrives too late to clash with (counted as pendingDraw), and new meter can't pay for a Super yet.
export function afterNeutral(G, side, act, rng) {
  const key = side === 0 ? 'A' : 'B'
  const X = { ...G[key], hand: G[key].hand.slice(), fx: { ...G[key].fx } }
  const R = G.rules || {}, meterMax = R.meterMax ?? 3
  const gain = n => { X.meter += n; if (R.oneReveal && n) X.pendingMeter = (X.pendingMeter || 0) + n }
  if (!act) return G
  if (act.kind === 'draw') {
    if (R.oneReveal) X.pendingDraw = 1
    else if (X.deck.length) X.hand.push(X.deck[Math.floor(rng() * X.deck.length)])      // it doesn't know its deck order
  } else if (act.kind === 'neutral') {
    const c = X.f.cards[act.i]
    if (X.nhand) { X.nhand = X.nhand.slice(); X.nhand.splice(X.nhand.lastIndexOf(act.i), 1); if (c.stays) X.inPlay = act.i }
    else X.hand.splice(X.hand.lastIndexOf(act.i), 1)
    for (const [k, v] of Object.entries(c.thisRound || {})) X.fx[k] = (X.fx[k] || 0) + v
    const opt = act.opt && act.opt !== 'base' ? act.opt : null
    if (opt?.take !== undefined) {
      X.meter -= tableCost(X, opt.take)
      if (opt.take === 'S') X.superAt = 'hand'
      else { X.table = X.table.filter(j => j !== opt.take); X.hand.push(opt.take) }
      return { ...G, [key]: X }
    }
    if (opt?.fetch !== undefined) {
      const at = X.discard.findIndex(d => d.i === opt.fetch)
      X.discard = X.discard.slice(); X.discard.splice(at, 1); X.hand.push(opt.fetch)
      return { ...G, [key]: X }
    }
    const superDone = R.superUses > 0 && X.supersUsed >= R.superUses
    if (!superDone) gain(Math.max(0, Math.min((R.neutralMeter || 0) + (c.now?.meter || 0), meterMax - X.meter)))
    for (let n = 0; n < (c.now?.draw || 0); n++) {
      if (R.oneReveal) X.pendingDraw = (X.pendingDraw || 0) + 1
      else if (X.deck.length) X.hand.push(X.deck[Math.floor(rng() * X.deck.length)])     // it doesn't know its deck order
    }
    if (c.atClash?.confiscate) {
      // Shakedown: the opponent will discard before the clash; which card is unknown, so one fewer is dealt
      const ok = side === 0 ? 'B' : 'A', Y = G[ok]
      const k = Math.min(c.atClash.confiscate, Math.max(0, Y.hand.length - confiscateFloor(R)))
      if (k > 0) return { ...G, [key]: X, [ok]: { ...Y, hand: Y.hand.slice(0, Y.hand.length - k) } }
    }
  } else if (act.kind === 'focus') {
    const superDone = R.superUses > 0 && X.supersUsed >= R.superUses
    if (!superDone) gain(Math.max(0, Math.min(R.focusMeter ?? 0, meterMax - X.meter)))
    if (R.focusDraw) {
      if (R.oneReveal) X.pendingDraw = 1
      else if (X.deck.length) X.hand.push(X.deck[Math.floor(rng() * X.deck.length)])
    }
  } else if (act.kind === 'burn') {
    for (const i of act.cards) X.hand.splice(X.hand.lastIndexOf(i), 1)
    gain(act.cards.length)
  }
  return { ...G, [key]: X }
}

export function neutralChoice16(G, side, W, rng, level = 'hard') {
  const X = side === 0 ? G.A : G.B, op = side === 0 ? G.B : G.A
  const acts = neutralActions16(X, G.rules, W.banSide == null || W.banSide === side ? W.ban : null)
  if (acts.length === 1) return { acts, p: [1], values: [null], act: acts[0] }
  const pool = unseenPool(op)
  const hands = Array.from({ length: W.neutralSamples }, () => dealHand(pool, op.hand.length, rng))
  const values = acts.map(a => clashMix16(afterNeutral(G, side, a, rng), side, W, rng, 'hard', hands).value)
  const p = softmax(values, LEVELS16[level]?.neutral ?? 60)
  let r = rng(), k = p.length - 1
  for (let i = 0; i < p.length; i++) { r -= p[i]; if (r < 0) { k = i; break } }
  return { acts, p, values, act: acts[k] }
}

// Rules v17: once both neutral cards are revealed, the partner picks its card's option (Read: draw
// or take from the table; Charge: meter or fetch) by the clash each leads to. acts: both players'
// neutral actions (the other's opt, if already chosen, is included).
export function chooseMode16(G, side, acts, W, rng) {
  const X = side === 0 ? G.A : G.B
  const a = acts[side]
  if (!a || a.kind !== 'neutral') return undefined
  const modes = neutralModes16(X, a.i, G.rules)
  if (modes.length < 2) return undefined
  const op = side === 0 ? G.B : G.A
  const pool = unseenPool(op)
  const hands = Array.from({ length: W.neutralSamples }, () => dealHand(pool, op.hand.length, rng))
  let best = modes[0], bestV = -Infinity
  for (const opt of modes) {
    let g = afterNeutral(G, side, { ...a, opt }, rng)
    if (acts[1 - side]) g = afterNeutral(g, 1 - side, acts[1 - side], rng)
    const v = clashMix16(g, side, W, rng, 'hard', hands).value
    if (v > bestV + 1e-9) { bestV = v; best = opt }
  }
  return best === 'base' ? undefined : best
}

// ---- bots and small decisions ------------------------------------------------------
const pickRandom = (a, rng) => a[Math.floor(rng() * a.length)]

export function botNeutral(G, side, bot, rng) {
  const X = side === 0 ? G.A : G.B
  const acts = neutralActions16(X, G.rules)
  if (bot === 'random') return pickRandom(acts, rng)
  return acts[0]                                    // the Breather (or the forced skip)
}

export function botClash(G, side, bot, rng) {
  const X = side === 0 ? G.A : G.B
  const opts = clashOptions16(X, G.rules)
  if (!opts.length) return null
  if (bot === 'convert') {
    const cv = opts.filter(i => card16(X, i).t === 'C').sort((a, b) => card16(X, b).speed - card16(X, a).speed)
    if (cv.length) return cv[0]
  }
  const want = { pressure: ['P'], attack: ['P', 'C'], guard: ['R'] }[bot]
  if (want) {
    const fit = opts.filter(i => want.includes(card16(X, i).t))
    if (fit.length) return pickRandom(fit, rng)
  }
  return pickRandom(opts, rng)
}

// Discarding down to the hand limit: the most redundant cards go first
export function chooseDiscards(X, n) { return burnOrder(X).slice(0, n) }

// Confiscate: the victim discards the cards it will miss least. The sparring partner tries
// each distinct card and keeps the hand whose next clash it values most (one card at a time);
// bots, and big discards, go by redundancy.
// by (rules.confiscateBy, a test switch): 'victim' (as written), 'taker' (the Warden picks from
// their whole hand), 'reveal2' (the victim shows the 2 it minds losing least; the taker picks one),
// or 'random'. levels: [victim's level, taker's level].
export function chooseConfiscate(G, side, n, W, rng, level = 'hard', by = 'victim', takerLevel = 'hard') {
  const key = side === 0 ? 'A' : 'B'
  const X = G[key]
  const out = []
  let hand = X.hand.slice()
  if (by === 'random') { for (let k = 0; k < n; k++) out.push(hand.splice(Math.floor(rng() * hand.length), 1)[0]); return out }
  if (by === 'victim' && (BOTS16[level] || n > 2)) return chooseDiscards({ ...X, hand }, n)
  const Wq = { ...W, samples: Math.min(W.samples, 3) }
  const evalOf = (h0) => {
    const cands = [...new Set(h0)]
    return cands.map(i => {
      const h = h0.slice(); h.splice(h.lastIndexOf(i), 1)
      const g = { ...G, phase: 'clash', [key]: { ...X, hand: h, owe: 0 } }
      return { i, v: clashMix16(g, side, Wq, rng, 'hard').value }        // the victim's chance with that card gone
    }).sort((a, b) => b.v - a.v)
  }
  for (let k = 0; k < n; k++) {
    let pick
    if (by === 'victim') pick = evalOf(hand)[0].i
    else if (by === 'taker') pick = BOTS16[takerLevel] ? hand[Math.floor(rng() * hand.length)] : evalOf(hand).at(-1).i
    else {                                                                // reveal2
      const e = evalOf(hand)
      const shown = e.slice(0, 2)
      // the victim may show two copies of one card, if it holds them and minds them least
      pick = BOTS16[takerLevel] ? shown[Math.floor(rng() * shown.length)].i : shown.at(-1).i
    }
    out.push(pick); hand.splice(hand.lastIndexOf(pick), 1)
  }
  return out
}

export function sampleIndex(p, rng) {
  let r = rng()
  for (let i = 0; i < p.length; i++) { r -= p[i]; if (r < 0) return i }
  return p.length - 1
}
