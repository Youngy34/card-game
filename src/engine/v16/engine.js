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
// the meter track runs 0–3; you play a clash card if you have one you can play; one neutral
// card that stays in play per player (a new one replaces it).
export const DEFAULT_RULES16 = { openingHand: 6, handLimit: 8, meterMax: 3, burnMax: 0, superUses: 0, speedTie: 'cancel', maxRounds: 60,
  oneReveal: false, neutralMeter: 0, burnNeutrals: true, focusMeter: 0, focusDraw: false, blankClash: false,
  splitDecks: true, neutralHand: 3, greyPerRound: 1, confiscateFloor: 2,
  initiative: false, tableCards: false, refillAtReveal: false }
// Rules v17 switches (rules-overview 17.md), off for v16:
//   initiative: a token (G.init, 0 or 1) passed every round. Its holder wins speed ties (with
//     speedTie 'initiative') and goes first wherever an order is needed: choices after a reveal,
//     Confiscate payments, discarding down to the hand limit.
//   tableCards: a fighter's specials (cards marked special) and Super start face up on the table.
//     Read (orSelect) may take one into your hand instead of drawing, paying its meter; Charge
//     (orFetch) may put a special from your discard pile into your hand instead of gaining meter.
//     A taken special is an ordinary clash card from then on. The Super, once taken, costs
//     nothing to play and is removed from the game when played.
//   refillAtReveal: the neutral hand is refilled as soon as the neutral cards resolve.
// greyPerRound: grey each player adds to their own pile in the draw step (1 November: 1,
//   with HP raised about a quarter, so Converts and Guards always have grey to work on).
// confiscateFloor: Confiscate (the Warden) never takes a player below this many clash cards.
// Test switches, off unless set: lateGrey (grey from a clash lands when it ends) and
// guardHalf (a Guard clears half the pile, rounded up). Both tried 1 November, not adopted.
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
  if (X.table) Y.table = X.table.slice()
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
    const clash = (split ? f.deck.filter(i => f.cards[i].t !== 'N') : f.deck.slice()).filter(i => !(rules.tableCards && f.cards[i].special))
    const X = { f, hp: f.hp, pile: 0, meter: 0, deck: shuffle(clash, R), hand: [], discard: [], st: {}, next: {}, fx: {}, used: [], reshuffles: 0, supersUsed: 0 }
    if (rules.tableCards) {
      X.table = f.cards.map((c, i) => (c.special ? i : null)).filter(i => i !== null)   // specials still on the table
      X.superAt = f.sup ? 'table' : null                                               // 'table' | 'hand' | 'gone'
    }
    if (split) { X.ndeck = shuffle(f.deck.filter(i => f.cards[i].t === 'N'), R); X.nhand = []; X.ndiscard = []; X.nused = [] }
    drawCards(X, rules.openingHand, R)
    if (split) drawNeutral(X, rules.neutralHand ?? 3, R)
    return X
  }
  const A = mk(fa), B = mk(fb)
  const init = rules.initiative ? (rnd(R) < 0.5 ? 0 : 1) : null
  return { A, B, round: 1, rules, rng: R.s, phase: 'neutral', result: null, pending: null, clash: null, neutral: null, init }
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

// Rules v17: what a neutral card can do instead of its usual effect. Returns the options for
// card i: 'base' (its printed effect), { take: j } (Read: take special j, or 'S' for the Super,
// from the table, paying its meter) and { fetch: j } (Charge: put special j from your discard
// pile into your hand).
export function neutralModes16(X, i, rules) {
  const c = X.f.cards[i], out = ['base']
  if (!rules?.tableCards || !c) return out
  if (c.orSelect) {
    for (const j of X.table || []) if (X.meter >= X.f.cards[j].meter) out.push({ take: j })
    if (X.superAt === 'table' && X.f.sup && X.meter >= X.f.sup.meter) out.push({ take: 'S' })
  }
  if (c.orFetch) for (const j of new Set(X.discard.filter(d => X.f.cards[d.i].special).map(d => d.i))) out.push({ fetch: j })
  return out
}
export const tableCost = (X, j) => (j === 'S' ? X.f.sup.meter : X.f.cards[j].meter)

// acts: [actA, actB], each null (nothing), { kind: 'draw' } (the Breather), { kind: 'focus' }, { kind: 'neutral', i, opt }
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
      if (X.nhand) {
        const k = X.nhand.lastIndexOf(act.i); if (k < 0) throw new Error(`card ${act.i} isn't in the neutral hand`); X.nhand.splice(k, 1)
        if (c.stays) { if (X.inPlay != null) X.ndiscard.push(X.inPlay); X.inPlay = act.i }      // one in play: a new one replaces it
        else X.nused.push(act.i)
      }
      else { takeFromHand(X, act.i); X.used.push(act.i) }
      for (const [key, v] of Object.entries(c.thisRound || {})) X.fx[key] = (X.fx[key] || 0) + v
      const opt = act.opt && act.opt !== 'base' ? act.opt : null
      if (opt && !neutralModes16(X, act.i, G.rules).some(o => o !== 'base' && (o.take === opt.take && o.fetch === opt.fetch))) throw new Error(`${c.name} can't do that`)
      if (opt?.take !== undefined) {
        // Read: take a special or the Super from the table instead of drawing, paying its meter
        X.meter -= tableCost(X, opt.take)
        if (opt.take === 'S') X.superAt = 'hand'
        else { X.table = X.table.filter(j => j !== opt.take); X.hand.push(opt.take) }
        done.push({ kind: 'neutral', i: act.i, name: c.name, took: opt.take === 'S' ? X.f.sup.name : X.f.cards[opt.take].name, cost: tableCost(X, opt.take), sup: opt.take === 'S' })
        continue
      }
      if (opt?.fetch !== undefined) {
        // Charge: put a special from your discard pile into your hand instead of gaining meter
        const at = X.discard.findIndex(d => d.i === opt.fetch)
        X.discard.splice(at, 1); X.hand.push(opt.fetch)
        done.push({ kind: 'neutral', i: act.i, name: c.name, fetched: X.f.cards[opt.fetch].name })
        continue
      }
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
  // At the start of the clash step (after every On reveal effect): Shakedown's Confiscate
  FLOOR = confiscateFloor(G.rules)
  for (const k of [0, 1]) {
    const a = done[k]
    if (a?.kind !== 'neutral') continue
    const c = P[k].f.cards[a.i]
    for (let n = c.atClash?.confiscate || 0; n > 0; n--) owe(P[1 - k], 1, null, 1 - k, c.name)
  }
  // Rules v17: refill the neutral hand now (the draw step then has nothing to refill)
  if (G.rules.refillAtReveal) for (const X of P) {
    if (!X.nhand) continue
    for (const i of X.nused) X.ndiscard.push(i)
    X.nused = []
    drawNeutral(X, Math.max(0, (G.rules.neutralHand ?? 3) - X.nhand.length), R)
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
export const superReady = (X, rules) => (rules?.tableCards ? X.superAt === 'hand'
  : !!X.f.sup && X.meter >= X.f.sup.meter && !(rules?.superUses > 0 && X.supersUsed >= rules.superUses))
// …and playable this round (with one reveal, this round's meter isn't there yet)
const superPlayable = (X, rules) => superReady(X, rules) && (rules?.tableCards || X.meter - (X.pendingMeter || 0) >= X.f.sup.meter)

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
    if (c.t !== 'N') out.push(i)                      // a Locked card can be played: it's voided at the reveal
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

// Whether a neutral card bends this card's type this round (Armor: Converts; Mix-Up: Pressures)
const bent = (X, c) => (c.t === 'C' && !!X.fx.armor) || (c.t === 'P' && !!X.fx.mixup)

export const speedOf = (X, c) => c.speed + (X.fx.speed || 0) - (X.st.staggered ? STAGGER : 0)

// Who wins a same-type duel at equal speed: 0, 1, or -1 (cancel)
export function tieWinner16(A, B, rules, init = null) {
  if (rules.speedTie === 'initiative' && (init === 0 || init === 1)) return init
  if (rules.speedTie !== 'lowhp' || A.hp === B.hp) return -1
  return A.hp < B.hp ? 0 : 1
}

function play(X, i, ev, side, how, rules = {}) {
  if (i === 'S' && rules.tableCards) { X.superAt = 'gone'; X.supersUsed = (X.supersUsed || 0) + 1 }       // paid when taken; used once
  else if (i === 'S') { X.meter -= X.f.sup.meter; X.supersUsed = (X.supersUsed || 0) + 1 }
  else takeFromHand(X, i)
  X.used.push(i)
  const c = card16(X, i)
  if (c.cost) applyStatus(X.next, c.cost)
  ev.push({ side, kind: 'play', how, name: c.name, t: c.t, sup: i === 'S', ...(i === 'S' && rules.tableCards ? { gone: true } : {}) })
  return c
}

// Confiscate: Y discards n clash cards of their choice, never going below the floor
// (discardDownTo is exact: down to that many). Recorded as owed; paid with confiscate16.
export const confiscateFloor = rules => rules?.confiscateFloor ?? 2
let FLOOR = 2
function owe(Y, n, ev, side, from, down = false) {
  const h = Y.hand.length - (Y.owe || 0)
  const k = down ? Math.min(n, h) : Math.min(n, Math.max(0, h - FLOOR))
  if (k <= 0) return
  Y.owe = (Y.owe || 0) + k
  ev?.push({ side, kind: 'confiscate', n: k, from })
}

// The owed discards: a player discards the cards they choose (indices from hand)
export function confiscate16(G, side, cards) {
  const X = cloneP(side === 0 ? G.A : G.B)
  if (cards.length !== (X.owe || 0)) throw new Error(`discard exactly ${X.owe || 0}`)
  for (const i of cards) { takeFromHand(X, i); X.discard.push({ i, burned: false, confiscated: true }) }
  X.confiscated = (X.confiscated || 0) + cards.length
  X.owe = 0
  return { ...G, [side === 0 ? 'A' : 'B']: X }
}
export const owes = G => [G.A.owe || 0, G.B.owe || 0]
// The order players act in wherever an order is needed: the initiative holder first
export const initOrder = G => (G.init === 1 ? [1, 0] : [0, 1])

// One card resolving: its type effect, then its On hit status
function hit(X, Y, c, ev, side, how, rules = {}) {
  const e = { side, kind: 'hit', how, name: c.name, t: c.t }
  if (c.t === 'P') {
    e.build = c.build + (X.fx.pressureBuild || 0)
    e.chip = c.chip + (X.fx.attackChip || 0) + (X.fx.pressureChip || 0)
    // lateGrey (under test): grey from this clash lands when the clash ends, so an Ender cashes only what was already there
    if (rules.lateGrey) Y.fresh = (Y.fresh || 0) + e.build; else Y.pile += e.build
    Y.hp -= e.chip
  } else if (c.t === 'C') {
    e.cash = Y.pile
    e.chip = c.chip + (X.fx.convertChip || 0) + (X.fx.attackChip || 0)
    Y.pile = 0; Y.hp -= e.cash + e.chip
  } else if (c.t === 'R') {
    // guardHalf (under test): a Guard clears half the pile, rounded up, so grey can build across exchanges
    e.cleared = rules.guardHalf ? Math.ceil(X.pile / 2) : X.pile; X.pile -= e.cleared
    if (c.chip) { e.chip = c.chip; Y.hp -= c.chip }            // a Recover Super's second verb
  }
  ev.push(e)
  // Confiscate (the Warden): the target owes discards, chosen by them once the clash is over.
  // Their hand can't change before then, so the floor is checked now.
  let conf = (c.confiscate || 0) + (c.kind === 'grab' ? (X.fx.grabConfiscate || 0) : 0)
  for (; conf > 0; conf--) owe(Y, 1, ev, 1 - side, c.name)
  if (c.discardDownTo != null) { const h = Y.hand.length - (Y.owe || 0); if (h > c.discardDownTo) owe(Y, h - c.discardDownTo, ev, 1 - side, c.name, true) }
  // A card in play that ends when the opponent's Pressure hits (Shackles)
  const held = Y.inPlay != null ? Y.f.cards[Y.inPlay] : null
  if (c.t === 'P' && held?.endsOn === 'pressureHit') {
    Y.ndiscard = [...Y.ndiscard, Y.inPlay]; Y.inPlay = null
    ev.push({ side: 1 - side, kind: 'ended', name: held.name, by: c.name })
  }
  const ward = Y.inPlay != null ? Y.f.cards[Y.inPlay] : null
  if (c.onHit && c.t !== 'N' && ward?.prevent && (ward.prevent === c.onHit || (ward.prevent === 'lock' && c.onHit.lock))) {
    // a card in play (Breakfall) stops the status, and goes to the neutral discard
    Y.ndiscard = [...Y.ndiscard, Y.inPlay]; Y.inPlay = null
    ev.push({ side: 1 - side, kind: 'prevented', status: c.onHit, by: ward.name, from: c.name })
  } else if (c.onHit && c.t !== 'N') {
    applyStatus(Y.next, c.onHit)
    ev.push({ side: 1 - side, kind: 'status', status: c.onHit, from: c.name })
  }
}

const ko = (A, B) => (A.hp <= 0 ? 0 : B.hp <= 0 ? 1 : null)        // the side knocked out
const resultOf = (A, B) => { const k = ko(A, B); return k === null ? null : k === 0 ? 0 : 1 }

// Set both clash cards and resolve the clash. Returns the game waiting on a
// decision (G.pending: a follow-up, a Linker or an Ender) or with the clash done.
export function startClash16(G, a, b, lite = false) {
  FLOOR = confiscateFloor(G.rules)
  const A = cloneP(G.A, lite), B = cloneP(G.B, lite)
  const P = [A, B], ev = []
  const picks = [a ?? null, b ?? null]
  const played = picks.map((p, k) => (p === null ? null : play(P[k], p, ev, k, 'clash', G.rules)))
  // Lock: a card of a Locked type is spent but does nothing, as if nothing were played
  const voided = played.map((c, k) => !!c && locked(P[k], c.t))
  voided.forEach((v, k) => { if (v) ev.push({ side: k, kind: 'voided', name: played[k].name, t: played[k].t }) })
  const cards = played.map((c, k) => (voided[k] ? null : c))
  const [ca, cb] = cards
  let winner = -1, outcome
  if (!ca && !cb) outcome = 'none'
  else if (!ca || !cb) { winner = ca ? 0 : 1; outcome = 'unopposed' }
  else if (ca.t !== cb.t) {
    winner = BEATS16.has(ca.t + cb.t) ? 0 : 1; outcome = 'triangle'
    // Armor: this round, the armored player's Converts (not their Super) also beat Pressures
    if (ca.t === 'C' && !ca.sup && cb.t === 'P' && A.fx.armor) { winner = 0; outcome = 'armor' }
    else if (cb.t === 'C' && !cb.sup && ca.t === 'P' && B.fx.armor) { winner = 1; outcome = 'armor' }
    // Mix-Up: this round, the player's Pressures (not their Super) also beat Guards
    else if (ca.t === 'P' && !ca.sup && cb.t === 'R' && A.fx.mixup) { winner = 0; outcome = 'mixup' }
    else if (cb.t === 'P' && !cb.sup && ca.t === 'R' && B.fx.mixup) { winner = 1; outcome = 'mixup' }
  }
  else if (ca.t === 'R') outcome = 'guards'
  else if (G.rules.bendersLoseMirror && !ca.sup && !cb.sup && bent(A, ca) !== bent(B, cb)) {
    // A bent type (Armor's Converts, Mix-Up's Pressures) is slow: it loses any duel of its own type
    winner = bent(A, ca) ? 1 : 0; outcome = 'outpaced'
  }
  else {
    const sa = speedOf(A, ca), sb = speedOf(B, cb)
    if (sa !== sb) { winner = sa > sb ? 0 : 1; outcome = 'speed' }
    else {
      const tw = tieWinner16(G.A, G.B, G.rules, G.init)
      if (tw < 0) outcome = 'cancel'
      else { winner = tw; outcome = 'tie' }
    }
    ev.push({ kind: 'speeds', speeds: [sa, sb] })
  }
  if (outcome === 'guards') { hit(A, B, ca, ev, 0, 'clash', G.rules); hit(B, A, cb, ev, 1, 'clash', G.rules) }
  else if (winner >= 0) {
    const W = P[winner], L = P[1 - winner]
    hit(W, L, cards[winner], ev, winner, 'clash', G.rules)
    const lc = cards[1 - winner]
    if (lc && lc.onLossSelf) { L.pile += lc.onLossSelf; ev.push({ side: 1 - winner, kind: 'onLoss', n: lc.onLossSelf }) }
  }
  const clash = { picks, types: cards.map(c => c?.t ?? null), names: played.map(c => c?.name ?? null), voided, outcome, winner, events: ev, follow: null, combo: [] }
  let next = { ...G, A, B, phase: 'clash', clash, pending: null, result: resultOf(A, B) }
  if (next.result !== null || winner < 0) return finishClash(next)
  const wc = cards[winner], lc = cards[1 - winner]
  if (outcome === 'triangle' && wc.t === 'R' && lc.t === 'P') return ask(next, 'follow', winner)
  if (wc.starter && (outcome === 'triangle' || outcome === 'armor' || outcome === 'mixup' || outcome === 'outpaced' || outcome === 'speed' || outcome === 'tie' || outcome === 'unopposed')) return ask(next, 'link', winner)
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
  if (G.A.fresh || G.B.fresh) G = { ...G, A: { ...G.A, pile: G.A.pile + (G.A.fresh || 0), fresh: 0 }, B: { ...G.B, pile: G.B.pile + (G.B.fresh || 0), fresh: 0 } }
  return { ...G, pending: null, clash: { ...G.clash, done: true }, phase: G.result !== null ? 'over' : 'draw' }
}

// The player answers G.pending: a card index, 'S', or null (none / skip)
export function decideClash16(G, choice, lite = false) {
  const { stage, side, options } = G.pending
  FLOOR = confiscateFloor(G.rules)
  if (choice === undefined) choice = null
  if (choice !== null && !options.includes(choice)) throw new Error(`can't play that as a ${stage}`)
  if (choice === null) return stage === 'link' ? ask({ ...G, pending: null }, 'end', side) : finishClash(G)
  const A = cloneP(G.A, lite), B = cloneP(G.B, lite)
  const P = [A, B]
  const ev = G.clash.events.slice()
  const c = play(P[side], choice, ev, side, stage, G.rules)
  hit(P[side], P[1 - side], c, ev, side, stage, G.rules)
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
// draw 1, take grey (greyPerRound), and work out who must discard down to the hand limit.
export function startDraw16(G) {
  const R = { s: G.rng }
  const P = [cloneP(G.A), cloneP(G.B)]
  for (const X of P) {
    for (const i of X.used) if (i !== 'S') X.discard.push({ i, burned: false })
    X.used = []; X.fx = {}; X.pendingMeter = 0
    drawCards(X, 1, R)
    if (G.rules.greyPerRound) X.pile += G.rules.greyPerRound      // everyone takes grey with their draw
    if (X.nhand) {
      for (const i of X.nused) X.ndiscard.push(i)
      X.nused = []
      drawNeutral(X, Math.max(0, (G.rules.neutralHand ?? 3) - X.nhand.length), R)
    }
  }
  const over = P.map((X, k) => Math.max(0, X.hand.length - handLimitOf(X, P[1 - k], G.rules)))
  const g = { ...G, A: P[0], B: P[1], rng: R.s, phase: 'draw', discardDown: over }
  return over.some(n => n > 0) ? g : finishRound16(g)
}

// A player's clash hand limit: the rule, or lower under the opponent's card in play (Shackles)
export function handLimitOf(X, Y, rules) {
  const lim = rules.handLimit ?? 8
  const held = Y?.inPlay != null ? Y.f.cards[Y.inPlay] : null
  return held?.capHand ? Math.min(lim, held.capHand) : lim
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
  const init = G.rules.initiative && (G.init === 0 || G.init === 1) ? 1 - G.init : G.init ?? null
  return { ...G, A: P[0], B: P[1], round, init, phase: result === null ? 'neutral' : 'over', result, neutral: null, clash: null, pending: null, discardDown: null }
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
