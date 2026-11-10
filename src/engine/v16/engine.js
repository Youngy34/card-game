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
  initiative: false, tableCards: false, refillAtReveal: false,
  merged: false, specialsReturn: false, timeout: false, knockdownLocks: false, knockdownSlow: false, greyCap: 0, greyOverflow: false, cashOnWin: false, comboSameType: false,
  heat: false, specialCost: 3, roundHeatCaps: false }
// Rules v18 switches (rules-overview 18.md), off for v16 and v17:
//   merged: one deck, one hand and one discard pile; no neutral step. A round is the clash and the
//     end of the round. Neutral effects live on clash cards as riders that fire On reveal (when the
//     card is your clash card and isn't voided), in initiative order: reveal.meter (Charge),
//     reveal.read (Read: draw a card, or take a special or your Super from the table, paying its
//     meter) and reveal.confiscate. A Recover with parry lets its follow-up be any attack and start
//     a combo; one with brace gives no follow-up and instead reflects the beaten Pressure's Build
//     onto its owner's pile ('reflect') or Staggers them ('stagger'); one with noFollow simply gives no follow-up.
//   specialsReturn: a special that leaves your hand (played, discarded, Confiscated) goes back to
//     the table, to be taken again; it never sits in the discard pile.
//   timeout: the deck never reshuffles. When a player's deck is empty at the end of a round (they
//     drew its last card), the game ends: the higher HP wins, equal HP is a draw.
//   knockdownLocks: Knockdown means Lock Pressure next round (getting up, you can guard or go for
//     a big reversal, but not a quick strike), since there is no neutral step to skip.
//   knockdownSlow (6 Nov, replaces knockdownLocks): a knocked-down player loses every speed clash next
//     round (same-type attacks, ties included); if both are down, speeds compare as usual.
//   greyCap (8 Nov, test): at the end of the round, after the grey, a pile that has reached greyCap is
//     cashed: its owner loses that much HP and the pile empties. 0 = no cap. Checked at the end of the round,
//     so a winning Convert still cashes everything and a combo's Ender still has its pile.
//   greyOverflow (8 Nov, test): with a cap, the pile instead can't go above it. Grey beyond the cap is lost as
//     HP at once and the pile stays at the cap, so only a Convert takes the whole pile. A fighter may set its
//     own cap (fighter greyCap), used whenever the rule's cap is on.
//   comboSameType (8 Nov, test, Mark): a combo continues only with cards of its Starter's type: Pressures
//     into Pressures, Converts into Converts. Two separate combo lines; a Convert line can only follow a
//     Convert that won, so it never touches a player who read it with a Pressure.
//   cashOnWin (8 Nov, test): only a Convert that wins the clash cashes the pile; a Convert played as a
//     follow-up, Linker or Ender just deals its damage.
// Rules v20 (9 Nov, Mark): heat. The tokens are the attacker's power, not the defender's burden.
//   heat: a player's heat is the pile on their opponent (X.pile is Y's heat), so the clash resolves
//     exactly as before: a winning Pressure adds its Build to the winner's heat, a Convert (Break)
//     that wins the clash spends all the winner's heat as damage, a Guard that beats a Pressure
//     douses the attacker's heat. What changes: the cap that stops a player's heat is their own
//     (X.oppCap: the cap that limits the pile on X is the opponent's fighter's), so past your cap,
//     heat you gain lands as straight damage. There is no meter: at the end of the round, after
//     the grey (1 heat each), each player in initiative order may spend heat on one card from the
//     table: a special for specialCost, or the Super for their whole cap (only at max heat).
//     Read just draws. Charge leaves the core.
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
const takeFromHand = (X, i) => {
  const k = X.hand.lastIndexOf(i); if (k < 0) throw new Error(`card ${i} isn't in hand`); X.hand.splice(k, 1)
  if (X.known) { const q = X.known.indexOf(i); if (q >= 0) { X.known = X.known.slice(); X.known.splice(q, 1) } }
}

function drawCards(X, n, R) {
  let drawn = 0
  for (let k = 0; k < n; k++) {
    if (!X.deck.length) {
      if (X.noReshuffle || !X.discard.length) break         // rules v18 (timeout): one pass, no reshuffle
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
    const split = !!rules.splitDecks && !rules.merged
    const clash = (split ? f.deck.filter(i => f.cards[i].t !== 'N') : f.deck.slice()).filter(i => !(rules.tableCards && f.cards[i].special))
    const X = { f, hp: f.hp, pile: 0, meter: 0, deck: shuffle(clash, R), hand: [], discard: [], st: {}, next: {}, fx: {}, used: [], reshuffles: 0, supersUsed: 0 }
    if (rules.timeout) X.noReshuffle = true
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
  if (rules.heat) {
    // Rules v20: the pile on A is B's heat, so it stops at B's cap (and the other way round)
    const own = f => f.greyCap || rules.greyCap || 0
    A.oppCap = own(fb); B.oppCap = own(fa)
    for (const X of [A, B]) { X.heatRules = true; const cap = own(X.f); X.heatCost = { special: rules.specialCost ?? 3, sup: cap, supPrice: rules.superPrice === 'half' ? Math.ceil(cap / 2) : rules.superPrice === 'free' ? 0 : cap } }   // superPrice (local test, 10 Nov): the Super still needs max heat, but costs half the cap, or nothing
  }
  const init = rules.initiative ? (rnd(R) < 0.5 ? 0 : 1) : null
  return { A, B, round: 1, rules, rng: R.s, phase: rules.merged ? 'clash' : 'neutral', result: null, pending: null, clash: null, neutral: null, init }
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
export const tableCost = (X, j) => (X.heatCost ? (j === 'S' ? (X.heatCost.supPrice ?? X.heatCost.sup) : (X.f.cards[j].heatPrice ?? X.heatCost.special)) : j === 'S' ? X.f.sup.meter : X.f.cards[j].meter)

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
  if (down) Y.oweDown = true
  ev?.push({ side, kind: 'confiscate', n: k, from })
}

// The owed discards: a player discards the cards they choose (indices from hand)
export function confiscate16(G, side, cards) {
  const X = cloneP(side === 0 ? G.A : G.B)
  if (cards.length !== (X.owe || 0)) throw new Error(`discard exactly ${X.owe || 0}`)
  for (const i of cards) { takeFromHand(X, i); toDiscard(X, i, G.rules, { confiscated: true }) }
  X.confiscated = (X.confiscated || 0) + cards.length
  X.owe = 0; X.oweDown = false
  return { ...G, [side === 0 ? 'A' : 'B']: X }
}
export const owes = G => [G.A.owe || 0, G.B.owe || 0]
// The order players act in wherever an order is needed: the initiative holder first
export const initOrder = G => (G.init === 1 ? [1, 0] : [0, 1])

// A player's grey cap: the fighter's own, else the rule's; 0 when the rule's cap is off
// Rules v20 (heat): the pile on X is the opponent's heat, so its cap is the opponent's (X.oppCap)
export const capOf = (X, rules) => (rules?.greyCap ? (rules.heat && X.oppCap ? X.oppCap : X.f.greyCap || rules.greyCap) : 0)
// greyOverflow (test): grey above the cap is lost as HP now; returns how much spilled
function spill(X, rules) {
  const cap = rules?.greyOverflow ? capOf(X, rules) : 0
  if (!cap || X.pile <= cap) return 0
  const n = X.pile - cap
  X.pile = cap; X.hp -= n
  return n
}

// One card resolving: its type effect, then its On hit status
function hit(X, Y, c, ev, side, how, rules = {}) {
  const e = { side, kind: 'hit', how, name: c.name, t: c.t }
  if (c.t === 'P') {
    e.build = c.build + (X.fx.pressureBuild || 0)
    e.chip = c.chip + (X.fx.attackChip || 0) + (X.fx.pressureChip || 0)
    // lateGrey (under test): grey from this clash lands when the clash ends, so an Ender cashes only what was already there
    if (rules.lateGrey) Y.fresh = (Y.fresh || 0) + e.build; else { Y.pile += e.build; const n = spill(Y, rules); if (n) e.spill = n }
    Y.hp -= e.chip
  } else if (c.t === 'C') {
    // cashOnWin (test): a Convert played after the clash (follow-up, Linker, Ender) doesn't cash
    e.cash = rules.cashOnWin && how !== 'clash' ? 0 : Y.pile
    e.chip = c.chip + (X.fx.convertChip || 0) + (X.fx.attackChip || 0)
    Y.pile -= e.cash; Y.hp -= e.cash + e.chip
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

// Rules v18: what a Read rider can do: draw a card, or take a special or the Super from the
// table, paying its meter
export function readModes18(X) {
  const out = ['draw']
  if (X.heatRules) return out                                     // rules v20: Read just draws; heat buys at the end of the round
  for (const j of X.table || []) if (X.meter >= X.f.cards[j].meter) out.push({ take: j })
  if (X.superAt === 'table' && X.f.sup && X.meter >= X.f.sup.meter) out.push({ take: 'S' })
  return out
}
// The choice a Read rider makes when no one chooses for it: a special it can afford, then the Super, then a draw
export const defaultRead18 = X => { const m = readModes18(X); return m.find(o => o !== 'draw' && o.take !== 'S') || m.find(o => o !== 'draw') || 'draw' }

// Rules v18: the clash cards' On reveal riders, in initiative order (the holder's first).
// opts[k] is Read's choice for side k ('draw' or { take: j }); undefined takes the default.
// lite (the partner looking ahead): a drawn card is counted, not drawn, since it doesn't know its deck order.
function revealRiders(G, P, cards, opts, lite, ev) {
  const R = { s: G.rng }
  const meterMax = G.rules.meterMax ?? 3
  for (const k of initOrder(G)) {
    const c = cards[k], X = P[k], Y = P[1 - k]
    if (!c) continue
    if (c.parry) X.fx.parry = 1
    const rv = c.reveal
    if (!rv) continue
    if (rv.meter) {
      const m = Math.max(0, Math.min(rv.meter, meterMax - X.meter))
      X.meter += m
      ev.push({ side: k, kind: 'reveal', what: 'meter', n: m, wasted: rv.meter - m, name: c.name })
    }
    if (rv.read) {
      const modes = readModes18(X)
      let o = opts?.[k]
      if (o === undefined || o === null) o = defaultRead18(X)
      if (o !== 'draw' && !modes.some(m => m !== 'draw' && m.take === o.take)) throw new Error(`${c.name} can't take that`)
      if (o === 'draw') {
        let n = 0
        if (lite) { if (X.deck.length) { X.pendingDraw = (X.pendingDraw || 0) + 1; n = 1 } }
        else n = drawCards(X, 1, R)
        ev.push({ side: k, kind: 'reveal', what: 'draw', n, name: c.name })
      } else {
        const cost = tableCost(X, o.take)
        X.meter -= cost
        if (o.take === 'S') X.superAt = 'hand'
        else { X.table = X.table.filter(j => j !== o.take); X.hand.push(o.take) }
        ev.push({ side: k, kind: 'reveal', what: 'take', took: o.take === 'S' ? X.f.sup.name : X.f.cards[o.take].name, sup: o.take === 'S', cost, name: c.name })
      }
    }
    if (rv.recall) {
      // Recall: put a card of your choice from your discard pile into your hand (any card; specials never sit there)
      const only = rv.recall === 'attack'
      const modes = recallModes18(X, only)
      if (modes.length) {
        let o = opts?.[k]
        if (!o || o.recall === undefined) o = defaultRecall18(X, only)
        if (!modes.some(m => m.recall === o.recall)) throw new Error(`${c.name} can't recall that`)
        const at = X.discard.findIndex(d => d.i === o.recall)
        if (at < 0) throw new Error(`${c.name} can't recall that`)
        X.discard = X.discard.slice(); X.discard.splice(at, 1); X.hand.push(o.recall)
        X.known = [...(X.known || []), o.recall]                 // it came from the face-up pile: the opponent knows it's there
        ev.push({ side: k, kind: 'reveal', what: 'recall', recalled: X.f.cards[o.recall].name, name: c.name })
      } else ev.push({ side: k, kind: 'reveal', what: 'recall', recalled: null, name: c.name })
    }
    if (rv.confiscate) for (let n = rv.confiscate; n > 0; n--) owe(Y, 1, ev, 1 - k, c.name)
  }
  return R.s
}
// Rules v18 (test): what a Recall rider can bring back, one option per distinct card in the discard pile
// attacksOnly (a card with reveal.recall: 'attack'): Recovers can't be brought back
export const recallModes18 = (X, attacksOnly = false) => [...new Set(X.discard.map(d => d.i))].filter(i => !attacksOnly || X.f.cards[i].t !== 'R').map(i => ({ recall: i }))
// When no one chooses: the card with the most to offer (combo and Counter icons, then its numbers)
export function defaultRecall18(X, attacksOnly = false) {
  let best = null, bv = -Infinity
  for (const o of recallModes18(X, attacksOnly)) {
    const c = X.f.cards[o.recall]
    const v = (c.starter ? 1 : 0) + (c.ender ? 1 : 0) + (c.counter ? 1 : 0) + (c.linker ? 0.5 : 0) + (c.t === 'R' ? 0.8 : 0) + ((c.build || 0) + (c.chip || 0)) / 4
    if (v > bv) { bv = v; best = o }
  }
  return best
}

// Set both clash cards and resolve the clash. Returns the game waiting on a
// decision (G.pending: a follow-up, a Linker or an Ender) or with the clash done.
// opts (rules v18): each side's Read choice, if its clash card has a Read rider.
export function startClash16(G, a, b, lite = false, opts = null) {
  FLOOR = confiscateFloor(G.rules)
  const A = cloneP(G.A, lite), B = cloneP(G.B, lite)
  const P = [A, B], ev = []
  const picks = [a ?? null, b ?? null]
  const played = picks.map((p, k) => (p === null ? null : play(P[k], p, ev, k, 'clash', G.rules)))
  // Lock: a card of a Locked type is spent but does nothing, as if nothing were played
  const voided = played.map((c, k) => !!c && locked(P[k], c.t))
  voided.forEach((v, k) => { if (v) ev.push({ side: k, kind: 'voided', name: played[k].name, t: played[k].t }) })
  const cards = played.map((c, k) => (voided[k] ? null : c))
  const rng = G.rules.merged ? revealRiders(G, P, cards, opts, lite, ev) : G.rng
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
    // Rules v18 (6 Nov): a knocked-down player loses every speed clash (ties included); both down, compare as usual
    const ka = !!(G.rules.knockdownSlow && A.st.knockdown), kb = !!(G.rules.knockdownSlow && B.st.knockdown)
    if (ka !== kb) { winner = ka ? 1 : 0; outcome = 'speed'; ev.push({ kind: 'downSlow', side: ka ? 0 : 1 }) }
    else if (sa !== sb) { winner = sa > sb ? 0 : 1; outcome = 'speed' }
    else {
      const tw = tieWinner16(G.A, G.B, G.rules, G.init)
      if (tw < 0) outcome = 'cancel'
      else { winner = tw; outcome = 'tie' }
    }
    ev.push({ kind: 'speeds', speeds: [sa, sb] })
  }
  // guardsQuiet (rules v21, 10 Nov, Mark): two Guards do nothing; heat is yours, and nobody attacked
  if (outcome === 'guards' && !G.rules.guardsQuiet) { hit(A, B, ca, ev, 0, 'clash', G.rules); hit(B, A, cb, ev, 1, 'clash', G.rules) }
  else if (winner >= 0) {
    const W = P[winner], L = P[1 - winner]
    hit(W, L, cards[winner], ev, winner, 'clash', G.rules)
    const lc = cards[1 - winner]
    if (lc && lc.onLossSelf) { L.pile += lc.onLossSelf; ev.push({ side: 1 - winner, kind: 'onLoss', n: lc.onLossSelf, spill: spill(L, G.rules) }) }
    // Rules v18: a Brace that beats a Pressure gives no follow-up; instead the Pressure's Build
    // goes onto its owner's pile (reflect), or they're Staggered next round (stagger)
    const wcd = cards[winner]
    // Rules v18 (8 Nov, Bastion): a Recover with onBlock puts a status on them when it beats a Pressure,
    // as well as its follow-up (Safe stops the follow-up, not the status)
    if (outcome === 'triangle' && wcd.onBlock && wcd.t === 'R' && lc?.t === 'P') {
      applyStatus(L.next, wcd.onBlock)
      ev.push({ side: 1 - winner, kind: 'status', status: wcd.onBlock, from: wcd.name, block: true })
    }
    // Rules v21 (10 Nov): a fighter's own Guard pays out if it beats a Pressure
    if (outcome === 'triangle' && wcd.t === 'R' && lc?.t === 'P') {
      for (let n = wcd.blockConfiscate || 0; n > 0; n--) owe(L, 1, ev, 1 - winner, wcd.name)
      if (wcd.blockHeat) {
        // the blocker's heat is the pile on the attacker; it stops at the blocker's cap (no damage from it)
        const cap = capOf(L, G.rules), before = L.pile
        L.pile = cap ? Math.max(before, Math.min(cap, before + (lc.build || 0))) : before + (lc.build || 0)
        ev.push({ side: winner, kind: 'blockHeat', n: L.pile - before, name: wcd.name })
      }
    }
    if (outcome === 'triangle' && wcd.brace && wcd.t === 'R' && lc?.t === 'P') {
      if (wcd.brace === 'reflect') { const n = lc.build || 0; L.pile += n; ev.push({ side: winner, kind: 'brace', reflect: n, name: wcd.name, spill: spill(L, G.rules) }) }
      else { applyStatus(L.next, 'staggered'); ev.push({ side: 1 - winner, kind: 'status', status: 'staggered', from: wcd.name }) }
    }
  }
  const clash = { picks, types: cards.map(c => c?.t ?? null), names: played.map(c => c?.name ?? null), voided, outcome, winner, events: ev, follow: null, combo: [] }
  let next = { ...G, A, B, rng, phase: 'clash', clash, pending: null, result: resultOf(A, B) }
  if (next.result !== null || winner < 0) return finishClash(next)
  const wc = cards[winner], lc = cards[1 - winner]
  if (outcome === 'triangle' && wc.t === 'R' && lc.t === 'P') {
    // Safe Pressures (6 Nov) can't be followed up
    const safe = lc.safe && !wc.throughSafe                         // rules v21: a Guard can follow up through Safe
    if (safe && !wc.brace && !wc.noFollow) ev.push({ kind: 'safe', side: 1 - winner, name: lc.name })
    if (wc.followCombo) next = { ...next, clash: { ...next.clash, followCombo: winner } }
    return wc.brace || wc.noFollow || safe ? finishClash(next) : ask(next, 'follow', winner)
  }
  if (wc.starter && (outcome === 'triangle' || outcome === 'armor' || outcome === 'mixup' || outcome === 'outpaced' || outcome === 'speed' || outcome === 'tie' || outcome === 'unopposed')) return ask(next, 'link', winner)
  return finishClash(next)
}

const ICON_FOR = { follow: 'counter', link: 'linker', end: 'ender' }
function ask(G, stage, side) {
  const X = side === 0 ? G.A : G.B
  let options = stage === 'follow' && X.fx.parry ? attackOptions(X, G.rules) : iconOptions(X, ICON_FOR[stage], G.rules)
  // comboSameType (test): Linkers and Enders of the Starter's type only (the Starter: the clash card, or a Parry follow-up)
  if (G.rules.comboSameType && stage !== 'follow') {
    const lineT = G.clash.follow?.side === side ? G.clash.follow.t : G.clash.types[side]
    options = options.filter(i => (i === 'S' ? X.f.sup : X.f.cards[i]).t === lineT)
  }
  G = { ...G, clash: { ...G.clash, offered: { ...(G.clash.offered || {}), [stage]: options.length } } }
  if (!options.length) {
    if (stage === 'link') return ask(G, 'end', side)
    return finishClash(G)
  }
  return { ...G, pending: { stage, side, options } }
}

function finishClash(G) {
  if (G.A.fresh || G.B.fresh) {
    const land = X => { const Y = { ...X, pile: X.pile + (X.fresh || 0), fresh: 0 }; spill(Y, G.rules); return Y }
    G = { ...G, A: land(G.A), B: land(G.B) }
  }
  // Confiscate's floor is checked after the clash (8 Nov fix): a player who owed a discard On reveal and then
  // spent cards on a combo never discards below the floor (or, for "discard down to", below nothing)
  const settle = X => { if (!X.owe) return X; const max = X.oweDown ? X.hand.length : Math.max(0, X.hand.length - confiscateFloor(G.rules)); return X.owe > max ? { ...X, owe: max } : X }
  if (G.A.owe || G.B.owe) G = { ...G, A: settle(G.A), B: settle(G.B) }
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
  if (stage === 'follow' && (P[side].fx.parry || G.clash.followCombo === side) && c.starter) return ask(next, 'link', side)     // Parry (and a followCombo Guard, rules v21): the punish can combo
  if (stage !== 'link') return finishClash(next)
  // Twin (8 Nov, Vex): a second copy of the same card can follow it as a second Linker (two Linkers at most)
  if (c.twin && clash.combo.filter(x => x.side === side && x.stage === 'link').length === 1 && P[side].hand.includes(choice) && canUse(P[side], c)) {
    return { ...next, clash: { ...clash, offered: { ...(clash.offered || {}), twin: 1 } }, pending: { stage: 'link', side, options: [choice], twin: true } }
  }
  return ask(next, 'end', side)
}

// Run a whole clash, answering each decision with decide(G, pending)
export function runClash16(G, a, b, decide, lite = false, opts = null) {
  let g = startClash16(G, a, b, lite, opts)
  while (g.pending) g = decideClash16(g, decide(g, g.pending), lite)
  return g
}

// ---- 3. draw phase ---------------------------------------------------------------
// Discard what was used (in the order played; the Super returns beside the deck),
// draw 1, take grey (greyPerRound), and work out who must discard down to the hand limit.
export function startDraw16(G) {
  const R = { s: G.rng }
  const P = [cloneP(G.A), cloneP(G.B)]
  const capCash = [0, 0], capSpill = [0, 0]
  for (const [k, X] of P.entries()) {
    for (const i of X.used) if (i !== 'S') toDiscard(X, i, G.rules)
    X.used = []; X.fx = {}; X.pendingMeter = 0
    drawCards(X, 1, R)
    if (G.rules.greyPerRound) X.pile += G.rules.greyPerRound      // everyone takes grey with their draw
    // roundHeatCaps (test, 9 Nov): the round's heat stops at the cap; only attacks overflow as damage
    if (G.rules.roundHeatCaps && capOf(X, G.rules) && X.pile > capOf(X, G.rules)) X.pile = Math.max(capOf(X, G.rules), X.pile - G.rules.greyPerRound)
    // greyCap (test): a pile that has reached the cap is cashed now
    // (greyOverflow: the pile never passes its cap; the round's grey spills over as HP instead)
    if (G.rules.greyOverflow) capSpill[k] = spill(X, G.rules)
    else if (G.rules.greyCap && X.pile >= capOf(X, G.rules)) { capCash[k] = X.pile; X.hp -= X.pile; X.pile = 0 }
    if (X.nhand) {
      for (const i of X.nused) X.ndiscard.push(i)
      X.nused = []
      drawNeutral(X, Math.max(0, (G.rules.neutralHand ?? 3) - X.nhand.length), R)
    }
  }
  const g = { ...G, A: P[0], B: P[1], rng: R.s, phase: 'draw', capCash, capSpill }
  // Rules v20: before discarding down, each player in initiative order may spend heat at the table
  if (G.rules.heat) return nextBuy20({ ...g, phase: 'buy', bought: [null, null], buyLeft: initOrder(g) })
  return toDiscardDown(g)
}
// The draw step's last part: who must discard down to the hand limit (or on to the next round)
function toDiscardDown(g) {
  const P = [g.A, g.B]
  const over = P.map((X, k) => Math.max(0, X.hand.length - handLimitOf(X, P[1 - k], g.rules)))
  g = { ...g, phase: 'draw', discardDown: over }
  return over.some(n => n > 0) ? g : finishRound16(g)
}

// ---- rules v20: heat -----------------------------------------------------------------
// A player's heat: the pile on their opponent
export const heatOf = (G, side) => (side === 0 ? G.B : G.A).pile
// A player's own heat cap (the most heat they can hold; the Super's price)
export const ownCap = (X, rules) => X.heatCost?.sup ?? (X.f.greyCap || rules?.greyCap || 0)
// What a player may buy at the end of the round: null (nothing), a special on the table they can
// pay for, or 'S' (the Super, only at max heat, for all of it). One card a round.
export function buyOptions20(G, side) {
  const X = side === 0 ? G.A : G.B, heat = heatOf(G, side)
  const out = [null]
  for (const j of X.table || []) if (heat >= tableCost(X, j)) out.push(j)
  if (X.superAt === 'table' && X.f.sup && X.heatCost?.sup > 0 && heat >= X.heatCost.sup) out.push('S')
  return out
}
// Skip players with nothing they can buy; stop at the next player who has a choice
function nextBuy20(g) {
  const left = g.A.hp <= 0 || g.B.hp <= 0 ? [] : g.buyLeft.slice()          // a KO at the end of the round: no shopping
  while (left.length && buyOptions20(g, left[0]).length < 2) left.shift()
  if (!left.length) { const { buyLeft, ...rest } = g; return toDiscardDown(rest) }
  return { ...g, buyLeft: left, buying: left[0] }
}
// Pay for a card from the table with heat (no turn order, no phase change): the partner looks ahead with it
export function applyBuy20(G, side, choice) {
  if (choice === null || choice === undefined) return G
  const X = cloneP(side === 0 ? G.A : G.B, true), Y = { ...(side === 0 ? G.B : G.A) }
  const cost = tableCost(X, choice)
  Y.pile -= cost
  if (choice === 'S') X.superAt = 'hand'
  else { X.table = X.table.filter(j => j !== choice); X.hand.push(choice) }
  const bought = (G.bought || [null, null]).slice()
  bought[side] = { name: choice === 'S' ? X.f.sup.name : X.f.cards[choice].name, cost, sup: choice === 'S' }
  return side === 0 ? { ...G, A: X, B: Y, bought } : { ...G, A: Y, B: X, bought }
}
// The player whose turn it is to buy answers: null (nothing), a special's index, or 'S'
export function buy20(G, side, choice) {
  if (G.phase !== 'buy' || G.buying !== side) throw new Error('not your turn to buy')
  if (choice === undefined) choice = null
  if (!buyOptions20(G, side).includes(choice)) throw new Error("can't buy that")
  const g = applyBuy20({ ...G, buyLeft: G.buyLeft.filter(k => k !== side), buying: null }, side, choice)
  return nextBuy20(g)
}

// A card leaving play or hand: to the discard pile, or (rules v18, specialsReturn) a special back to the table
function toDiscard(X, i, rules, extra = {}) {
  if (rules?.specialsReturn && X.f.cards[i].special) { X.table = [...(X.table || []), i]; return }
  X.discard.push({ i, burned: false, ...extra })
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
  for (const i of cards) { takeFromHand(X, i); toDiscard(X, i, G.rules) }
  const dd = G.discardDown.slice(); dd[side] = 0
  const g = { ...G, [side === 0 ? 'A' : 'B']: X, discardDown: dd }
  return dd.some(n => n > 0) ? g : finishRound16(g)
}

// Statuses move on (next round's become this round's), and the next round begins
export function finishRound16(G) {
  const P = [cloneP(G.A, true), cloneP(G.B, true)]
  for (const X of P) {
    X.st = X.next; X.next = {}
    // Rules v18: Knockdown is Lock Pressure next round
    if (G.rules.knockdownLocks && X.st.knockdown) X.st = { ...X.st, lock: { ...(X.st.lock || {}), P: true } }
  }
  const round = G.round + 1
  let result = round > (G.rules.maxRounds ?? 60) ? 0.5 : null
  // greyCap (test): a pile cashed at the end of the round can KO (both down: the one less far below 0 wins)
  if (P[0].hp <= 0 || P[1].hp <= 0) result = P[0].hp <= 0 && P[1].hp <= 0 ? (P[0].hp > P[1].hp ? 1 : P[0].hp < P[1].hp ? 0 : 0.5) : P[0].hp <= 0 ? 0 : 1
  // Rules v18: a deck that's run out ends the game at the end of the round; the higher HP wins
  let timedOut = false
  if (result === null && G.rules.timeout && (!P[0].deck.length || !P[1].deck.length)) {
    timedOut = true
    result = P[0].hp > P[1].hp ? 1 : P[0].hp < P[1].hp ? 0 : 0.5
  }
  const init = G.rules.initiative && (G.init === 0 || G.init === 1) ? 1 - G.init : G.init ?? null
  return { ...G, A: P[0], B: P[1], round, init, phase: result === null ? (G.rules.merged ? 'clash' : 'neutral') : 'over', result, ...(timedOut ? { timedOut } : {}), neutral: null, clash: null, pending: null, discardDown: null }
}

// ---- what a player can see -------------------------------------------------------
// The cards a player can't see of the opponent's: their deck plus their hand plus
// their burned cards (all face down), as card indices.
export function unseenPool(Y) {
  const pool = Y.deck.concat(Y.hand)
  for (const d of Y.discard) if (d.burned) pool.push(d.i)
  return pool
}
// Rules v18: the cards in Y's hand the opponent knows about (specials taken from the table, cards
// recalled from the face-up discard pile), and the pool the rest of the hand could come from
export function hiddenSplit(Y) {
  const pool = unseenPool(Y), known = []
  const take = i => { const q = pool.lastIndexOf(i); if (q >= 0) { pool[q] = pool[pool.length - 1]; pool.pop(); known.push(i) } }
  const left = Y.hand.slice(), drop = i => { const q = left.indexOf(i); if (q < 0) return false; left.splice(q, 1); return true }
  for (const i of Y.known || []) if (drop(i)) take(i)
  for (const i of left) if (Y.f.cards[i].special) take(i)
  return { known, pool }
}

// For the table: how many of each card a player still has out of sight
export function unseenCounts(Y) {
  const n = Y.f.cards.map(() => 0)
  for (const i of unseenPool(Y)) n[i]++
  return n
}
