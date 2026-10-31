// Rules v16 engine (rules-overview 16.md): a shuffled deck, hidden hands, and
// three phases a round.
//
//   1. Neutral: each player plays a neutral card, burns cards for meter, draws
//      an extra card, or does nothing. Both reveal together.
//   2. Clash: v15's clash (the triangle, speed for same-type attacks, two Guards
//      both clear), then a Guard's follow-up (a Counter) or a Starter's combo
//      (a Linker, then an Ender).
//   3. Draw: discard what you used, draw 1, discard down to the hand limit.
//
// Everything here is pure: each function takes a game state and returns a new
// one. Randomness (shuffles and draws) comes from G.rng, a mulberry32 state
// kept in the game, so a game can be saved and replayed from its decisions.
//
// A game:   { A, B, round, rules, rng, phase, result, pending, clash, log }
// A player: { f, hp, pile, meter, deck, hand, discard, st, next, fx, used, reshuffles }
//   deck, hand: card indices into f.cards (top of the deck = last)
//   discard:    [{ i, burned }] in the order played (top = last)
//   st / next:  this round's statuses / the ones collected for next round
//               ({ knockdown, staggered, dizzy, lock: { P, C, R } })
//   fx:         this round's neutral-card effects
//   used:       cards played this round, in order ('S' for the Super)

import { BEATS16, LABEL16, LOCKABLE } from './cards.js'

// superUses: 0 = reusable (meter is the only gate), 1 = once per game.
// burnMax: the most cards a player may burn in one neutral phase.
// oneReveal: the neutral phase and the clash share one reveal (a setup card and a
//   clash card placed together). The Breather's card arrives at the reveal (too late
//   to clash with, in time for a combo), and meter gained arrives after the clash.
// neutralMeter: a neutral card played also gains this much meter.
// burnNeutrals: whether a neutral card may be burned (false: it can only be played).
// focusMeter: the meter Focus gains (0: no Focus). focusDraw: Focus also draws a card,
//   replacing the Breather.
// blankClash: a player may place their Focus as a blank at the clash (playing nothing),
//   whether or not they hold a clash card.
// splitDecks: clash cards and neutral cards are separate decks, hands and discard piles;
//   the neutral hand is refilled to neutralHand cards in the draw step, and a neutral card
//   must be played each neutral step (Focus is a neutral card).
// As written since 31 October (evening): split decks with a neutral hand of 3; no burning;
// the meter track runs 0–4; you play a clash card if you have one you can play.
export const DEFAULT_RULES16 = { openingHand: 6, handLimit: 8, meterMax: 4, burnMax: 0, superUses: 0, speedTie: 'cancel', maxRounds: 60,
  oneReveal: false, neutralMeter: 0, burnNeutrals: true, focusMeter: 0, focusDraw: false, blankClash: false,
  splitDecks: true, neutralHand: 3 }
export const STAGGER = 3

// ---- randomness ------------------------------------------------------------
function rnd(R) {
  R.s = (R.s + 0x6D2B79F5) >>> 0
  let t = R.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function shuffle(a, R) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(R) * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t }
  return a
}

// ---- players ---------------------------------------------------------------
const cloneSt = s => (s.lock ? { ...s, lock: { ...s.lock } } : { ...s })
// lite: share the deck and discard (the clash never touches them)
export function cloneP(X, lite = false) {
  const Y = { ...X, deck: lite ? X.deck : X.deck.slice(), discard: lite ? X.discard : X.discard.slice(), hand: X.hand.slice(),
           st: cloneSt(X.st), next: cloneSt(X.next), fx: { ...X.fx }, used: X.used.slice() }
  if (X.nhand) { Y.nhand = X.nhand.slice(); Y.ndeck = lite ? X.ndeck : X.ndeck.slice(); Y.ndiscard = lite ? X.ndiscard : X.ndiscard.slice(); Y.nused = X.nused.slice() }
  return Y
}
export const card16 = (X, i) => (i === 'S' ? X.f.sup : X.f.cards[i])
export const locked = (X, t) => !!(X.st.lock && X.st.lock[t])
const takeFromHand = (X, i) => { const k = X.hand.lastIndexOf(i); if (k < 0) throw new Error(`card ${i} isn't in hand`); X.hand.splice(k, 1) }

function drawCards(X, n, R) {
  let drawn = 0
  for (let k = 0; k < n; k++) {
    if (!X.deck.length) {
      if (!X.discard.length) break
      X.deck = shuffle(X.discard.map(d => d.i), R)
      X.discard = []
      X.reshuffles = (X.reshuffles || 0) + 1
    }
    X.hand.push(X.deck.pop()); drawn++
  }
  return drawn
}

// Split decks: draw neutral cards, reshuffling the neutral discard when the neutral deck runs out
function drawNeutral(X, n, R) {
  let drawn = 0
  for (let k = 0; k < n; k++) {
    if (!X.ndeck.length) {
      if (!X.ndiscard.length) break
      X.ndeck = shuffle(X.ndiscard.slice(), R)
      X.ndiscard = []
    }
    X.nhand.push(X.ndeck.pop()); drawn++
  }
  return drawn
}

function applyStatus(next, s) {
  if (!s) return
  if (typeof s === 'string') next[s] = true
  else if (s.lock) next.lock = { ...(next.lock || {}), [LOCKABLE[s.lock]]: true }
}

// The statuses on a player, as short labels (for the table and the log)
export function statusList(st) {
  const out = []
  if (st.knockdown) out.push('Knockdown')
  if (st.staggered) out.push('Staggered')
  if (st.dizzy) out.push('Dizzy')
  for (const t of ['P', 'C', 'R']) if (st.lock?.[t]) out.push(`Lock ${LABEL16[t]}`)
  return out
}

// ---- a new game --------------------------------------------------------------
export function newGame16(fa, fb, rules = DEFAULT_RULES16, seed = 1) {
  rules = { ...DEFAULT_RULES16, ...rules }
  const R = { s: seed >>> 0 }
  const mk = f => {
    const split = !!rules.splitDecks
    const clash = split ? f.deck.filter(i => f.cards[i].t !== 'N') : f.deck.slice()
    const X = { f, hp: f.hp, pile: 0, meter: 0, deck: shuffle(clash, R), hand: [], discard: [], st: {}, next: {}, fx: {}, used: [], reshuffles: 0, supersUsed: 0 }
    if (split) { X.ndeck = shuffle(f.deck.filter(i => f.cards[i].t === 'N'), R); X.nhand = []; X.ndiscard = []; X.nused = [] }
    drawCards(X, rules.openingHand, R)
    if (split) drawNeutral(X, rules.neutralHand ?? 3, R)
    return X
  }
  const A = mk(fa), B = mk(fb)
  return { A, B, round: 1, rules, rng: R.s, phase: 'neutral', result: null, pending: null, clash: null, neutral: null }
}

// ---- 1. neutral phase ----------------------------------------------------------
export const skipsNeutral = X => !!(X.st.knockdown || X.st.dizzy)

// What a player may do this neutral phase
export function neutralOptions16(X, rules = DEFAULT_RULES16) {
  if (skipsNeutral(X)) return { skip: true, neutrals: [], maxBurn: 0 }
  if (rules.splitDecks && X.nhand) return { skip: false, neutrals: [...new Set(X.nhand)], maxBurn: 0, canDraw: false, canFocus: false, split: true, superDone: rules.superUses > 0 && X.supersUsed >= rules.superUses }
  const neutrals = [...new Set(X.hand.filter(i => X.f.cards[i].t === 'N'))]
  const meterMax = rules.meterMax ?? 3
  const superDone = rules.superUses > 0 && X.supersUsed >= rules.superUses
  const burnable = rules.burnNeutrals === false || rules.burnNeutrals === 0 ? X.hand.filter(i => X.f.cards[i].t !== 'N').length : X.hand.length
  const maxBurn = superDone ? 0 : Math.max(0, Math.min(meterMax - X.meter, burnable, rules.burnMax ?? 0))
  // focusDraw: Focus also draws a card, replacing the Breather (always available; its meter is capped)
  const canFocus = rules.focusDraw ? true : !superDone && (rules.focusMeter ?? 0) > 0 && X.meter < meterMax
  return { skip: false, neutrals, maxBurn, canDraw: true, canFocus, superDone }
}

// acts: [actA, actB], each null (nothing), { kind: 'draw' } (the Breather), { kind: 'focus' }, { kind: 'neutral', i }
// or { kind: 'burn', cards: [i, ...] } (only with burnMax above 0)
export function applyNeutral16(G, acts) {
  const R = { s: G.rng }
  const P = [cloneP(G.A), cloneP(G.B)]
  const meterMax = G.rules.meterMax ?? 3
  const done = []
  for (const k of [0, 1]) {
    const X = P[k]
    let act = acts[k] || null
    if (skipsNeutral(X)) act = { kind: 'skip', why: X.st.dizzy ? 'Dizzy' : 'Knockdown' }
    if (!act) { done.push({ kind: 'none' }); continue }
    if (act.kind === 'draw') { const n = drawCards(X, 1, R); done.push({ kind: 'draw', n }) }
    else if (act.kind === 'neutral') {
      const c = X.f.cards[act.i]
      if (!c || c.t !== 'N') throw new Error('not a neutral card')
      if (X.nhand) { const k = X.nhand.lastIndexOf(act.i); if (k < 0) throw new Error(`card ${act.i} isn't in the neutral hand`); X.nhand.splice(k, 1); X.nused.push(act.i) }
      else { takeFromHand(X, act.i); X.used.push(act.i) }
      for (const [key, v] of Object.entries(c.thisRound || {})) X.fx[key] = (X.fx[key] || 0) + v
      const superDone = G.rules.superUses > 0 && X.supersUsed >= G.rules.superUses
      const m = superDone ? 0 : Math.max(0, Math.min((G.rules.neutralMeter || 0) + (c.now?.meter || 0), meterMax - X.meter))
      gainMeter(X, m, G.rules)
      const drew = c.now?.draw ? drawCards(X, c.now.draw, R) : 0
      done.push({ kind: 'neutral', i: act.i, name: c.name, ...(m ? { meter: m } : {}), ...(c.now?.draw ? { drew } : {}) })
    } else if (act.kind === 'focus') {
      if (!neutralOptions16(X, G.rules).canFocus) throw new Error("can't Focus")
      const superDone = G.rules.superUses > 0 && X.supersUsed >= G.rules.superUses
      const m = superDone ? 0 : Math.max(0, Math.min(G.rules.focusMeter ?? 0, meterMax - X.meter))
      gainMeter(X, m, G.rules)
      const drew = G.rules.focusDraw ? drawCards(X, 1, R) : 0
      done.push({ kind: 'focus', n: m, ...(G.rules.focusDraw ? { drew } : {}) })
    } else if (act.kind === 'burn') {
      if ((G.rules.burnNeutrals === false || G.rules.burnNeutrals === 0) && act.cards.some(i => X.f.cards[i].t === 'N')) throw new Error("neutral cards can't be burned")
      const n = Math.min(act.cards.length, meterMax - X.meter, G.rules.burnMax ?? 0)
      const cards = act.cards.slice(0, n)
      for (const i of cards) { takeFromHand(X, i); X.discard.push({ i, burned: true }) }
      gainMeter(X, n, G.rules)
      done.push({ kind: 'burn', n, cards })
    } else done.push(act)
  }
  return { ...G, A: P[0], B: P[1], rng: R.s, phase: 'clash', neutral: done }
}

// Meter gained in the neutral phase; with one reveal it can't pay for a Super until after the clash
function gainMeter(X, n, rules) {
  X.meter += n
  if (rules.oneReveal && n) X.pendingMeter = (X.pendingMeter || 0) + n
}

// ---- 2. clash ----------------------------------------------------------------
// The distinct cards a player may set as their clash card ('S' = the Super)
export const superReady = (X, rules) => !!X.f.sup && X.meter >= X.f.sup.meter && !(rules?.superUses > 0 && X.supersUsed >= rules.superUses)
// …and playable this round (with one reveal, this round's meter isn't there yet)
const superPlayable = (X, rules) => superReady(X, rules) && X.meter - (X.pendingMeter || 0) >= X.f.sup.meter

// Every choice at the clash: the legal cards, plus the blank (null) where it's allowed.
// A Dizzy player has no choice: they play nothing.
export function clashChoices16(X, rules) {
  const o = clashOptions16(X, rules)
  if (X.st.dizzy) return []
  return rules?.blankClash === false || rules?.blankClash === 0 ? o : [...o, null]
}

export function clashOptions16(X, rules) {
  if (X.st.dizzy) return []
  const seen = new Set(), out = []
  for (const i of X.hand) {
    if (seen.has(i)) continue
    seen.add(i)
    const c = X.f.cards[i]
    if (c.t !== 'N' && !locked(X, c.t)) out.push(i)
  }
  if (superPlayable(X, rules) && !locked(X, X.f.sup.t)) out.push('S')
  return out
}

const canUse = (X, c) => !locked(X, c.t)
// Cards in hand (distinct) carrying an icon, plus the Super if it carries it and can be paid for
export function iconOptions(X, icon, rules) {
  const seen = new Set(), out = []
  for (const i of X.hand) {
    if (seen.has(i)) continue
    seen.add(i)
    const c = X.f.cards[i]
    if (c[icon] && canUse(X, c)) out.push(i)
  }
  const s = X.f.sup
  if (s && s[icon] && superPlayable(X, rules) && canUse(X, s)) out.push('S')
  return out
}

// Every attack (Pressure or Convert) a player could play now, the Super included if they can pay for it
function attackOptions(X, rules) {
  const seen = new Set(), out = []
  for (const i of X.hand) {
    if (seen.has(i)) continue
    seen.add(i)
    const c = X.f.cards[i]
    if ((c.t === 'P' || c.t === 'C') && canUse(X, c)) out.push(i)
  }
  const s = X.f.sup
  if (s && (s.t === 'P' || s.t === 'C') && superPlayable(X, rules) && canUse(X, s)) out.push('S')
  return out
}

export const speedOf = (X, c) => c.speed + (X.fx.speed || 0) - (X.st.staggered ? STAGGER : 0)

// Who wins a same-type duel at equal speed: 0, 1, or -1 (cancel)
export function tieWinner16(A, B, rules) {
  if (rules.speedTie !== 'lowhp' || A.hp === B.hp) return -1
  return A.hp < B.hp ? 0 : 1
}

function play(X, i, ev, side, how) {
  if (i === 'S') { X.meter -= X.f.sup.meter; X.supersUsed = (X.supersUsed || 0) + 1 }
  else takeFromHand(X, i)
  X.used.push(i)
  const c = card16(X, i)
  if (c.cost) applyStatus(X.next, c.cost)
  ev.push({ side, kind: 'play', how, name: c.name, t: c.t, sup: i === 'S' })
  return c
}

// One card resolving: its type effect, then its On hit status
function hit(X, Y, c, ev, side, how) {
  const e = { side, kind: 'hit', how, name: c.name, t: c.t }
  if (c.t === 'P') {
    e.build = c.build + (X.fx.pressureBuild || 0)
    e.chip = c.chip + (X.fx.attackChip || 0)
    Y.pile += e.build; Y.hp -= e.chip
  } else if (c.t === 'C') {
    e.cash = Y.pile
    e.chip = c.chip + (X.fx.convertChip || 0) + (X.fx.attackChip || 0)
    Y.pile = 0; Y.hp -= e.cash + e.chip
  } else if (c.t === 'R') {
    e.cleared = X.pile; X.pile = 0
    if (c.chip) { e.chip = c.chip; Y.hp -= c.chip }            // a Recover Super's second verb
  }
  ev.push(e)
  if (c.onHit && c.t !== 'N') {
    applyStatus(Y.next, c.onHit)
    ev.push({ side: 1 - side, kind: 'status', status: c.onHit, from: c.name })
  }
}

const ko = (A, B) => (A.hp <= 0 ? 0 : B.hp <= 0 ? 1 : null)        // the side knocked out
const resultOf = (A, B) => { const k = ko(A, B); return k === null ? null : k === 0 ? 0 : 1 }

// Set both clash cards and resolve the clash. Returns the game waiting on a
// decision (G.pending: a follow-up, a Linker or an Ender) or with the clash done.
export function startClash16(G, a, b, lite = false) {
  const A = cloneP(G.A, lite), B = cloneP(G.B, lite)
  const P = [A, B], ev = []
  const picks = [a ?? null, b ?? null]
  const cards = picks.map((p, k) => (p === null ? null : play(P[k], p, ev, k, 'clash')))
  const [ca, cb] = cards
  let winner = -1, outcome
  if (!ca && !cb) outcome = 'none'
  else if (!ca || !cb) { winner = ca ? 0 : 1; outcome = 'unopposed' }
  else if (ca.t !== cb.t) {
    winner = BEATS16.has(ca.t + cb.t) ? 0 : 1; outcome = 'triangle'
    // Armor: this round, the armored player's Converts (not their Super) also beat Pressures
    if (ca.t === 'C' && !ca.sup && cb.t === 'P' && A.fx.armor) { winner = 0; outcome = 'armor' }
    else if (cb.t === 'C' && !cb.sup && ca.t === 'P' && B.fx.armor) { winner = 1; outcome = 'armor' }
  }
  else if (ca.t === 'R') outcome = 'guards'
  else {
    const sa = speedOf(A, ca), sb = speedOf(B, cb)
    if (sa !== sb) { winner = sa > sb ? 0 : 1; outcome = 'speed' }
    else {
      const tw = tieWinner16(G.A, G.B, G.rules)
      if (tw < 0) outcome = 'cancel'
      else { winner = tw; outcome = 'tie' }
    }
    ev.push({ kind: 'speeds', speeds: [sa, sb] })
  }
  if (outcome === 'guards') { hit(A, B, ca, ev, 0, 'clash'); hit(B, A, cb, ev, 1, 'clash') }
  else if (winner >= 0) {
    const W = P[winner], L = P[1 - winner]
    hit(W, L, cards[winner], ev, winner, 'clash')
    const lc = cards[1 - winner]
    if (lc && lc.onLossSelf) { L.pile += lc.onLossSelf; ev.push({ side: 1 - winner, kind: 'onLoss', n: lc.onLossSelf }) }
  }
  const clash = { picks, types: cards.map(c => c?.t ?? null), names: cards.map(c => c?.name ?? null), outcome, winner, events: ev, follow: null, combo: [] }
  let next = { ...G, A, B, phase: 'clash', clash, pending: null, result: resultOf(A, B) }
  if (next.result !== null || winner < 0) return finishClash(next)
  const wc = cards[winner], lc = cards[1 - winner]
  if (outcome === 'triangle' && wc.t === 'R' && lc.t === 'P') return ask(next, 'follow', winner)
  if (wc.starter && (outcome === 'triangle' || outcome === 'armor' || outcome === 'speed' || outcome === 'tie' || outcome === 'unopposed')) return ask(next, 'link', winner)
  return finishClash(next)
}

const ICON_FOR = { follow: 'counter', link: 'linker', end: 'ender' }
function ask(G, stage, side) {
  const X = side === 0 ? G.A : G.B
  const options = stage === 'follow' && X.fx.parry ? attackOptions(X, G.rules) : iconOptions(X, ICON_FOR[stage], G.rules)
  G = { ...G, clash: { ...G.clash, offered: { ...(G.clash.offered || {}), [stage]: options.length } } }
  if (!options.length) {
    if (stage === 'link') return ask(G, 'end', side)
    return finishClash(G)
  }
  return { ...G, pending: { stage, side, options } }
}

function finishClash(G) {
  return { ...G, pending: null, clash: { ...G.clash, done: true }, phase: G.result !== null ? 'over' : 'draw' }
}

// The player answers G.pending: a card index, 'S', or null (none / skip)
export function decideClash16(G, choice, lite = false) {
  const { stage, side, options } = G.pending
  if (choice === undefined) choice = null
  if (choice !== null && !options.includes(choice)) throw new Error(`can't play that as a ${stage}`)
  if (choice === null) return stage === 'link' ? ask({ ...G, pending: null }, 'end', side) : finishClash(G)
  const A = cloneP(G.A, lite), B = cloneP(G.B, lite)
  const P = [A, B]
  const ev = G.clash.events.slice()
  const c = play(P[side], choice, ev, side, stage)
  hit(P[side], P[1 - side], c, ev, side, stage)
  const clash = { ...G.clash, events: ev }
  if (stage === 'follow') clash.follow = { side, name: c.name, t: c.t }
  else clash.combo = [...clash.combo, { side, stage, name: c.name, t: c.t }]
  const next = { ...G, A, B, clash, pending: null, result: resultOf(A, B) }
  if (next.result !== null) return finishClash(next)
  if (stage === 'follow' && P[side].fx.parry && c.starter) return ask(next, 'link', side)     // Parry: the punish can combo
  if (stage !== 'link') return finishClash(next)
  return ask(next, 'end', side)
}

// Run a whole clash, answering each decision with decide(G, pending)
export function runClash16(G, a, b, decide, lite = false) {
  let g = startClash16(G, a, b, lite)
  while (g.pending) g = decideClash16(g, decide(g, g.pending), lite)
  return g
}

// ---- 3. draw phase ---------------------------------------------------------------
// Discard what was used (in the order played; the Super returns beside the deck),
// draw 1, and work out who must discard down to the hand limit.
export function startDraw16(G) {
  const R = { s: G.rng }
  const P = [cloneP(G.A), cloneP(G.B)]
  for (const X of P) {
    for (const i of X.used) if (i !== 'S') X.discard.push({ i, burned: false })
    X.used = []; X.fx = {}; X.pendingMeter = 0
    drawCards(X, 1, R)
    if (X.nhand) {
      for (const i of X.nused) X.ndiscard.push(i)
      X.nused = []
      drawNeutral(X, Math.max(0, (G.rules.neutralHand ?? 3) - X.nhand.length), R)
    }
  }
  const over = P.map(X => Math.max(0, X.hand.length - (G.rules.handLimit ?? 8)))
  const g = { ...G, A: P[0], B: P[1], rng: R.s, phase: 'draw', discardDown: over }
  return over.some(n => n > 0) ? g : finishRound16(g)
}

// A player discards cards (indices from hand) down to the hand limit
export function discardDown16(G, side, cards) {
  const X = cloneP(side === 0 ? G.A : G.B)
  const need = G.discardDown[side]
  if (cards.length !== need) throw new Error(`discard exactly ${need}`)
  for (const i of cards) { takeFromHand(X, i); X.discard.push({ i, burned: false }) }
  const dd = G.discardDown.slice(); dd[side] = 0
  const g = { ...G, [side === 0 ? 'A' : 'B']: X, discardDown: dd }
  return dd.some(n => n > 0) ? g : finishRound16(g)
}

// Statuses move on (next round's become this round's), and the next round begins
export function finishRound16(G) {
  const P = [cloneP(G.A, true), cloneP(G.B, true)]
  for (const X of P) { X.st = X.next; X.next = {} }
  const round = G.round + 1
  const result = round > (G.rules.maxRounds ?? 60) ? 0.5 : null
  return { ...G, A: P[0], B: P[1], round, phase: result === null ? 'neutral' : 'over', result, neutral: null, clash: null, pending: null, discardDown: null }
}

// ---- what a player can see -------------------------------------------------------
// The cards a player can't see of the opponent's: their deck plus their hand plus
// their burned cards (all face down), as card indices.
export function unseenPool(Y) {
  const pool = Y.deck.concat(Y.hand)
  for (const d of Y.discard) if (d.burned) pool.push(d.i)
  return pool
}

// For the table: how many of each card a player still has out of sight
export function unseenCounts(Y) {
  const n = Y.f.cards.map(() => 0)
  for (const i of unseenPool(Y)) n[i]++
  return n
}
