// The rules v13 engine: pure functions over plain state, no UI. The app, the
// Lab and the command-line simulator all play through this file.
//
// A game is a series of reveals. Each reveal is either a neutral exchange or a
// combo beat; both players pick a card face down, then reveal(G, a, b) returns
// the next state and an event describing what happened. When a neutral attack
// is Exposed and the defender has an attack that could counter it, reveal()
// first returns { pending } so the defender can choose: call it again with the
// counter (a card index) or null for no counter.
//
// Picks: a card index (a fighter's attack card), or a universal card's id:
// 'G' Guard (also the feint and the hold in combos), 'D' Duck, 'S' Step,
// 'BL' / 'BM' / 'BH' Break Light / Medium / Heavy.
//
// Cooldown spaces are bit masks of card indices: cd1 comes back after the next
// reveal, cd2 after the one after that. brk holds Breaks locked by a feint.

import { VS_DEFENCE, BREAK_IDS, BREAK_BIT, UNIVERSAL, DEFAULT_RULES } from './rules.js'

export function newPlayer(f) {
  return { f, hp: f.hp, pile: 0, cd1: 0, cd2: 0, brk: 0 }
}

// init: who holds the initiative at the start, 0 (A) or 1 (B)
export function newGame(fa, fb, rules = DEFAULT_RULES, init = 0) {
  return {
    R: { ...DEFAULT_RULES, ...rules }, A: newPlayer(fa), B: newPlayer(fb),
    init, startInit: init, mode: 'neutral', combo: null, n: 1, over: false, result: null,
  }
}

export const avail = X => X.f.all & ~(X.cd1 | X.cd2)
export function bits(m) { const out = []; for (let i = 0; m; i++, m >>>= 1) if (m & 1) out.push(i); return out }
export function popcount(m) { let n = 0; while (m) { m &= m - 1; n++ } return n }
export const player = (G, side) => (side ? G.B : G.A)

// What `side` may play this reveal, in display order.
export function options(G, side) {
  const X = side ? G.B : G.A
  if (G.mode === 'neutral') return [...bits(avail(X)), 'G', 'D', 'S']
  const c = G.combo
  if (c.att === side) {
    const open = c.links < G.R.comboCap
    const out = bits(avail(X) & ((open ? X.f.linkers : 0) | (c.landed > 0 ? X.f.enders : 0)))
    if (open) out.push('G')                      // the feint
    return out
  }
  const out = BREAK_IDS.filter(id => !(X.brk & BREAK_BIT[id]))
  out.push('G')                                  // the hold
  return out
}

// The attacks `side` could counter with after exposing an attack of this Speed:
// any that would win a clash against it. As written, the defender has just taken
// the initiative, so counts the bonus and wins ties. Under the experimental
// counterCheck 'reveal', the initiative counts as it stood at the reveal (G.init).
export function counterOptions(G, side, speed) {
  const X = side ? G.B : G.A, bonus = G.R.initiativeBonus
  if (G.R.counterCheck === 'reveal') {
    const holder = G.init === side
    const es = speed + (holder ? 0 : bonus)
    return bits(avail(X)).filter(i => { const cs = X.f.cards[i].speed + (holder ? bonus : 0); return cs > es || (cs === es && holder) })
  }
  return bits(avail(X)).filter(i => X.f.cards[i].speed + bonus >= speed)
}

export function label(G, side, pick) {
  if (typeof pick === 'number') return player(G, side).f.cards[pick].name
  return UNIVERSAL[pick]?.name ?? String(pick)
}

export function reveal(G, a, b, counter) {
  if (G.over) throw new Error('The game is over.')
  return G.mode === 'combo' ? comboBeat(G, a, b) : neutral(G, a, b, counter)
}

// ---- neutral ------------------------------------------------------------------
function neutral(G, a, b, counter) {
  const P = [G.A, G.B], picks = [a, b], bonus = G.R.initiativeBonus
  const atk = picks.map((p, k) => (typeof p === 'number' ? P[k].f.cards[p] : null))
  const hp = [P[0].hp, P[1].hp], pile = [P[0].pile, P[1].pile]
  const played = [[], []]
  for (const k of [0, 1]) if (atk[k]) played[k].push(picks[k])
  let init = G.init, combo = null
  const ev = { phase: 'neutral', n: G.n, picks: [a, b], init0: G.init, kind: 'defences', result: 'none', by: null, dmg: [0, 0], grey: [0, 0] }

  // a strike that lands starts a combo; a throw that lands deals its Hit and grey
  const land = (k, c) => {
    hp[1 - k] -= c.hit; ev.dmg[1 - k] += c.hit
    if (c.dir === 'T') { pile[1 - k] += c.grey; ev.grey[1 - k] += c.grey; init = k; return 'thrown' }
    combo = { att: k, links: 0, landed: 0, beat: 0 }
    ev.combo = k
    return 'hit'
  }

  if (atk[0] && atk[1]) {
    // any two attacks clash on Speed; the holder adds the bonus and wins ties
    const s = [atk[0].speed + (init === 0 ? bonus : 0), atk[1].speed + (init === 1 ? bonus : 0)]
    const w = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : init
    ev.kind = 'clash'; ev.speeds = s; ev.by = w
    ev.result = land(w, atk[w])
  } else if (atk[0] || atk[1]) {
    const k = atk[0] ? 0 : 1, c = atk[k], r = VS_DEFENCE[c.dir][picks[1 - k]]
    ev.kind = 'attack'; ev.by = k
    if (r === 'hit' || r === 'thrown') ev.result = land(k, c)
    else if (r === 'blocked') {
      ev.result = 'blocked'; ev.onBlock = c.ob
      if (c.ob > 0) init = k; else if (c.ob < 0) init = 1 - k
      if (G.R.blockGrey) { pile[1 - k] += G.R.blockGrey; ev.grey[1 - k] += G.R.blockGrey }
    } else if (r === 'evaded') {
      ev.result = 'evaded'; init = 1 - k
    } else {
      ev.result = 'exposed'; init = 1 - k
      const d = 1 - k
      const opts = counterOptions(G, d, c.speed)
      if (opts.length && counter === undefined) return { pending: { side: d, options: opts, speed: c.speed }, ev }
      if (counter !== undefined && counter !== null) {
        if (!opts.includes(counter)) throw new Error(`${label(G, d, counter)} can't counter ${c.name}.`)
        played[d].push(counter)
        ev.counter = { side: d, card: counter, result: land(d, P[d].f.cards[counter]), options: opts.length }
      } else ev.counter = { side: d, card: null, result: null, options: opts.length }
    }
  } else if (G.R.waitPasses) {
    init = 1 - init                                    // experimental: waiting hands over the turn
  }
  return finish(G, hp, pile, played, [null, null], init, combo, ev)
}

// ---- combos ---------------------------------------------------------------------
function comboBeat(G, a, b) {
  const c0 = G.combo, k = c0.att, d = 1 - k
  const P = [G.A, G.B], picks = [a, b], ap = picks[k], dp = picks[d]
  const hp = [P[0].hp, P[1].hp], pile = [P[0].pile, P[1].pile]
  const played = [[], []], locked = [null, null]
  let init = G.init, ended = false
  const combo = { ...c0, beat: c0.beat + 1 }
  const ev = { phase: 'combo', n: G.n, beat: combo.beat, att: k, picks: [a, b], init0: G.init, dmg: [0, 0], grey: [0, 0] }

  if (ap === 'G') {
    if (dp === 'G') { ev.result = 'dropped'; init = d; ended = true }          // feint into a hold
    else { ev.result = 'locked'; locked[d] = dp; combo.links++ }                // feint draws out a Break
  } else {
    const c = P[k].f.cards[ap]
    played[k].push(ap)
    if (c.ender) {
      const dmg = pile[d] + c.bonus
      ev.result = 'cashed'; ev.cashed = pile[d]; ev.bonus = c.bonus
      hp[d] -= dmg; ev.dmg[d] = dmg; pile[d] = 0
      init = c.keep ? k : d; ended = true
    } else if (dp !== 'G' && UNIVERSAL[dp].str === c.link) {
      ev.result = 'broken'; ev.cleared = pile[d]; pile[d] = 0; init = d; ended = true
    } else {
      ev.result = 'lands'; pile[d] += c.grey; ev.grey[d] = c.grey
      if (dp !== 'G') { ev.wrongBreak = dp; if (G.R.wrongBreakLocks) locked[d] = dp }
      combo.links++; combo.landed++
    }
  }
  ev.ended = ended
  return finish(G, hp, pile, played, locked, init, ended ? null : combo, ev)
}

// ---- end of every reveal: KO check, cooldown step, blowouts, the reveal limit ----
function tick(X, hp, pile, played, lockedBreak) {
  // 1. space 1 returns to hand; 2. space 2 slides to space 1; 3. played cards go on
  //    the space matching their Cooldown. A feinted Break goes on space 1.
  let cd1 = X.cd2, cd2 = 0
  for (const i of played) { if (X.f.cards[i].cd === 2) cd2 |= 1 << i; else cd1 |= 1 << i }
  return { f: X.f, hp, pile, cd1, cd2, brk: lockedBreak ? BREAK_BIT[lockedBreak] : 0 }
}

function finish(G, hp, pile, played, locked, init, combo, ev) {
  const N = {
    R: G.R, A: tick(G.A, hp[0], pile[0], played[0], locked[0]), B: tick(G.B, hp[1], pile[1], played[1], locked[1]),
    init, startInit: G.startInit, mode: combo ? 'combo' : 'neutral', combo, n: G.n + 1, over: false, result: null,
  }
  if (hp[0] <= 0 || hp[1] <= 0) {
    N.over = true; N.mode = 'neutral'; N.combo = null; ev.ko = true
    N.result = hp[0] > 0 ? 1 : hp[1] > 0 ? 0 : hp[0] === hp[1] ? 0.5 : hp[0] > hp[1] ? 1 : 0
  } else if (combo && !options(N, combo.att).length) {
    // the attacker has no legal card (at the cap with no ender): the combo blows out
    N.mode = 'neutral'; N.combo = null; N.init = 1 - combo.att; ev.blowout = true; ev.ended = true
  }
  if (!N.over && G.R.clock && N.mode === 'neutral' && N.n > G.R.clock) {
    // experimental round timer: time out at the end of a neutral reveal or a combo
    N.over = true; ev.timeout = true
    N.result = N.A.hp > N.B.hp ? 1 : N.A.hp < N.B.hp ? 0 : 0.5
  }
  if (!N.over && N.n > G.R.maxReveals) { N.over = true; N.result = 0.5; ev.limit = true }
  ev.init1 = N.init
  return { G: N, ev }
}
