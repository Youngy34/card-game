// Yomi rules engine — rules v11 and v12. The v11 rules are a port of the rules
// engine in yomi_sim.py (Player, apply_effect, step), cross-checked against it
// round by round. A fighter with "rules": 12 plays v12 (see rules-overview 12):
// kinds, speed, Guard and Counter turn-backs, and Setups that attacks interrupt.
//
// All effects read the board as it was at reveal; changes apply together
// ("state at reveal", proposed in the rules and built into the simulator).

export const BEATS = new Set(['PC', 'CR', 'RP'])           // winner+loser

export const DEFAULT_RULES = { counterChip: 'always', maxRounds: 60 }

// ---- player state ---------------------------------------------------------
// hand: sorted card indices; cd1/cd2: cooldown spaces (in arrival order);
// sup: Super still in hand; tlock: a type this player can't play this round.
export function newPlayer(f) {
  return { f, hp: f.hp, pile: 0, hand: f.cards.map((_, i) => i), cd1: [], cd2: [], sup: !!f.sup, tlock: null }
}
const clone = X => ({ ...X, hand: X.hand.slice(), cd1: X.cd1.slice(), cd2: X.cd2.slice() })
export const card = (X, i) => (i === 'S' ? X.f.sup : X.f.cards[i])

export function blocked(X) {
  const bl = new Set()
  if (X.tlock) bl.add(X.tlock)
  for (const i of X.cd1) if (X.f.cards[i].kw.lockout) bl.add(X.f.cards[i].t)
  for (const i of X.cd2) if (X.f.cards[i].kw.lockout) bl.add(X.f.cards[i].t)
  return bl
}

// The cards this player may choose from, in a fixed order (hand order, then 'S').
export function options(X) {
  const bl = blocked(X)
  const o = X.hand.filter(i => !bl.has(X.f.cards[i].t))
  if (X.sup && !bl.has(X.f.sup.t)) o.push('S')
  return o.length ? o : X.hand.slice()          // fallback: never seen in practice
}

export function flowing(X) {
  if (!X.f.flow) return false
  return X.cd1.some(i => X.f.cards[i].kw.flowCard)
}

// On cooldown: your Converts chip +n (Taunt), anywhere on the track
export function oncdChip(X) {
  let s = 0
  for (const i of X.cd1) s += X.f.cards[i].kw.onCooldownConvertChip || 0
  for (const i of X.cd2) s += X.f.cards[i].kw.onCooldownConvertChip || 0
  return s
}
// Bonus chip x rounds it stays live, for the AI's value function
export function followupValue(X) {
  let s = 0
  for (const i of X.cd1) s += X.f.cards[i].kw.onCooldownConvertChip || 0
  for (const i of X.cd2) s += 2 * (X.f.cards[i].kw.onCooldownConvertChip || 0)
  return s
}

const fl = Math.floor
export function convertChip(c, me, cashed = 0) {
  const kw = c.kw
  let ch = c.chip + oncdChip(me)
  if (flowing(me)) ch += kw.flowChip || 0
  if (kw.chipPerOwnTokens) ch += fl(me.pile / kw.chipPerOwnTokens)
  if (kw.chipPerCashed) ch += fl(cashed / kw.chipPerCashed)
  if (kw.chipPerHpLost) ch += fl((me.f.hp - me.hp) / kw.chipPerHpLost)
  return ch
}

export function recoverChip(c, me, cleared) {
  const kw = c.kw
  let ch = c.chip
  if (kw.chipPerCleared) ch += fl(cleared / kw.chipPerCleared)
  if (kw.chipPerHpLost) ch += fl((me.f.hp - me.hp) / kw.chipPerHpLost)
  return ch
}

// A Pressure's Build and chip as it would land against `opp`, read at reveal.
// Also what a Guard or Counter turns back when it beats this Pressure.
export function pressureNumbers(c, me, op, opp) {
  const kw = c.kw
  let build = c.build, chip = c.chip
  if (kw.buildIfOppHas && op.pile >= kw.buildIfOppHas.tokens) build += kw.buildIfOppHas.build
  if (kw.buildPerOwnTokens) build += fl(me.pile / kw.buildPerOwnTokens)
  if (kw.chipPerOwnTokens) chip += fl(me.pile / kw.chipPerOwnTokens)
  if (kw.chipPerOppTokens) chip += fl(op.pile / kw.chipPerOppTokens)
  if (opp.t === 'C') chip += kw.chipOnWin || 0        // a resolving Pressure vs a Convert beat it
  if (opp.t === 'P') chip += kw.chipIfMirror || 0
  if (flowing(me)) { build += kw.flowBuild || 0; chip += kw.flowChip || 0 }
  return { build, chip }
}

// ---- rules v12 ----------------------------------------------------------
// Who resolves, who's beaten, and what kind of clash it was.
//   Different types: the triangle decides (every Pressure is faster than every Convert).
//   Two attacks of one type: two Projectiles cancel, two Grabs tech, otherwise
//   the faster card wins and a tie trades (both resolve).
//   Two Recovers: both resolve. A Setup: attacks interrupt it; it never wins or loses.
// outcome: 'A' | 'B' (that side won) | 'trade' | 'cancel' | 'tech' | 'recovers' | 'setup'
export function clash12(ca, cb) {
  const ta = ca.t, tb = cb.t
  const attack = t => t === 'P' || t === 'C'
  if (ta === 'T' || tb === 'T') {
    return { res: [!(ta === 'T' && attack(tb)), !(tb === 'T' && attack(ta))], beaten: [false, false], outcome: 'setup' }
  }
  if (ta !== tb) {
    const aWins = BEATS.has(ta + tb)
    return { res: [aWins, !aWins], beaten: [!aWins, aWins], outcome: aWins ? 'A' : 'B' }
  }
  if (ta === 'R') return { res: [true, true], beaten: [false, false], outcome: 'recovers' }
  if (ca.kind === 'projectile' && cb.kind === 'projectile') return { res: [false, false], beaten: [false, false], outcome: 'cancel' }
  if (ca.kind === 'grab' && cb.kind === 'grab') return { res: [false, false], beaten: [false, false], outcome: 'tech' }
  if (ca.speed > cb.speed) return { res: [true, false], beaten: [false, true], outcome: 'A' }
  if (cb.speed > ca.speed) return { res: [false, true], beaten: [true, false], outcome: 'B' }
  return { res: [true, true], beaten: [false, false], outcome: 'trade' }
}

// A Guard or Counter that beats a Pressure turns its numbers back: a Guard puts
// its Build on the attacker's own pile; a Counter turns its chip back on the
// attacker. (A Projectile's chip getting through a Guard was dropped on
// 25 October 2026: with Counter as a candidate for removal, it left
// Projectiles losing only to faster Strikes.)
function turnBack(ca, cb, A, B, cl, dA, dB, ev) {
  const t = [{ build: 0, chip: 0 }, { build: 0, chip: 0 }]
  const sides = [[0, ca, cb, A, B, dA], [1, cb, ca, B, A, dB]]
  for (const [k, c, oc, me, op, dMe] of sides) {
    if (!cl.beaten[k] || c.t !== 'P' || oc.t !== 'R') continue
    const { build, chip } = pressureNumbers(c, me, op, oc)
    if (oc.kind === 'guard') { dMe.pile += build; t[k].build = build }
    else if (oc.kind === 'counter' && chip) { dMe.hp -= chip; t[k].chip = chip }
    if (ev) {
      if (t[k].build) ev.push({ side: k, kind: 'turnBuild', n: t[k].build })
      if (t[k].chip) ev.push({ side: k, kind: 'turnChip', n: t[k].chip })
    }
  }
  return t
}

// Adds this card's effect to the deltas, reading the board at reveal.
// ev (optional) collects a description of what happened, for the UI.
function applyEffect(c, me, op, dMe, dOp, flags, opp, rules, ev, side) {
  const kw = c.kw
  if (c.t === 'P') {
    const { build, chip } = pressureNumbers(c, me, op, opp)
    dOp.pile += build; dOp.hp -= chip
    if (ev) { ev.push({ side, kind: 'build', n: build }); if (chip) ev.push({ side, kind: 'chip', n: chip }) }
  } else if (c.t === 'C') {
    const cash = op.pile
    let chip = convertChip(c, me, cash)
    if (opp.t === 'R') chip += kw.chipOnWin || 0          // a resolving Convert vs a Recover beat it
    dOp.hp -= cash + chip; dOp.pile -= op.pile
    if (kw.clearOwn) dMe.pile -= me.pile
    if (kw.knockdown === 'resolves' || (kw.knockdown === 'recover' && opp.t === 'R')) { flags.stagger = 'P'; flags.knockdown = true }
    if (ev) {
      ev.push({ side, kind: 'cash', n: cash }); ev.push({ side, kind: 'chip', n: chip })
      if (kw.clearOwn && me.pile) ev.push({ side, kind: 'clearOwn', n: me.pile })
    }
  } else if (c.t === 'R') {
    let chip = recoverChip(c, me, me.pile)
    if (opp.t === 'P') chip += kw.chipOnWin || 0
    else if (me.f.v12) { /* v12: the counter-chip test rules don't apply */ }
    else if (rules.counterChip === 'strict') chip = 0             // a counter needs a Pressure to counter
    else if (rules.counterChip === 'attack' && !(opp.t === 'T' && opp.chip > 0)) chip = 0
    if (kw.offBalance && opp.t === 'P') { flags.stagger = 'R'; flags.offBalance = true }   // it beat a Pressure
    dMe.pile -= me.pile; dOp.hp -= chip
    if (ev) { ev.push({ side, kind: 'clear', n: me.pile }); if (chip) ev.push({ side, kind: 'chip', n: chip }) }
  } else {
    const chip = c.chip + (flowing(me) ? (kw.flowChip || 0) : 0)
    dOp.hp -= chip
    if (ev && chip) ev.push({ side, kind: 'chip', n: chip })
  }
  if (kw.selfAdd) { dMe.pile += kw.selfAdd; if (ev) ev.push({ side, kind: 'selfAdd', n: kw.selfAdd }) }
  if (kw.returnCard) flags.ret = true
  if (kw.lock) flags.lock = true
  if (kw.stagger && opp.t === kw.stagger) flags.stagger = kw.stagger
}

// Resolve one round. a, b: the cards played (index or 'S').
// Returns { A, B, result, resolved: [resA, resB], quiet, events, flags }.
// result: null (game goes on), 1 (A wins), 0 (B wins), 0.5 (draw).
export function step(A0, B0, a, b, rules = DEFAULT_RULES, ev = null, follow) {
  if (A0.f.v15 || B0.f.v15) return step15(A0, B0, a, b, rules, ev, follow)
  const A = clone(A0), B = clone(B0)
  const ca = card(A, a), cb = card(B, b)
  const dA = { hp: 0, pile: 0 }, dB = { hp: 0, pile: 0 }, fA = {}, fB = {}
  const v12 = !!(A.f.v12 || B.f.v12)
  let resA = true, resB = true, beatA, beatB, cl = null
  if (v12) {
    cl = clash12(ca, cb); [resA, resB] = cl.res; [beatA, beatB] = cl.beaten
    if (ev) clashEvents(ca, cb, cl, ev)
  } else {
    if (ca.t !== 'T' && cb.t !== 'T' && ca.t !== cb.t) {
      if (BEATS.has(ca.t + cb.t)) resB = false; else resA = false
    }
    beatA = !resA; beatB = !resB
  }
  if (resA) applyEffect(ca, A, B, dA, dB, fA, cb, rules, ev, 0)
  else if (beatA && ca.kw.onLossSelf) { dA.pile += ca.kw.onLossSelf; if (ev) ev.push({ side: 0, kind: 'onLoss', n: ca.kw.onLossSelf }) }
  if (resB) applyEffect(cb, B, A, dB, dA, fB, ca, rules, ev, 1)
  else if (beatB && cb.kw.onLossSelf) { dB.pile += cb.kw.onLossSelf; if (ev) ev.push({ side: 1, kind: 'onLoss', n: cb.kw.onLossSelf }) }
  const turn = v12 ? turnBack(ca, cb, A, B, cl, dA, dB, ev) : null
  const hp0 = [A.hp, B.hp], piles0 = [A.pile, B.pile]
  A.hp += dA.hp; A.pile = Math.max(0, A.pile + dA.pile)
  B.hp += dB.hp; B.pile = Math.max(0, B.pile + dB.pile)
  const quiet = A.hp === hp0[0] && B.hp === hp0[1] && A.pile === piles0[0] && B.pile === piles0[1]
  let result = null
  if (A.hp <= 0 || B.hp <= 0) {                     // double KO: least below 0 wins, tie = draw
    if (A.hp <= 0 && B.hp <= 0) result = A.hp > B.hp ? 1 : B.hp > A.hp ? 0 : 0.5
    else result = B.hp <= 0 ? 1 : 0
  }
  // cooldown step
  const sides = [[A, a, ca, fA, fB], [B, b, cb, fB, fA]]
  for (const [X, played, c, mine, theirs] of sides) {
    if (mine.ret) {
      if (X.cd2.length) insertSorted(X.hand, X.cd2.shift())
      else if (X.cd1.length) insertSorted(X.hand, X.cd1.shift())
    }
    for (const i of X.cd1) insertSorted(X.hand, i)
    X.cd1 = X.cd2; X.cd2 = []
    X.tlock = theirs.stagger || null                    // Rim Shot: applies after a Super too
    if (played === 'S') X.sup = false                    // Supers are removed from the game
    else {
      removeFrom(X.hand, played)
      const space = Math.min(2, c.cd + (theirs.lock ? 1 : 0))
      ;(space === 1 ? X.cd1 : X.cd2).push(played)
    }
    if (X.f.rising && (X.f.risingCap === null || X.pile < X.f.risingCap)) X.pile += X.f.rising
  }
  if (ev) {
    if (fA.lock) ev.push({ side: 0, kind: 'lock' })
    if (fB.lock) ev.push({ side: 1, kind: 'lock' })
    for (const [side, F] of [[0, fA], [1, fB]]) {
      if (F.stagger) ev.push({ side, kind: F.knockdown ? 'knockdown' : F.offBalance ? 'offBalance' : 'stagger', t: F.stagger })
    }
    if (fA.ret) ev.push({ side: 0, kind: 'return' })
    if (fB.ret) ev.push({ side: 1, kind: 'return' })
  }
  const out = { A, B, result, resolved: [resA, resB], quiet, flags: [fA, fB] }
  if (v12) { out.beaten = [beatA, beatB]; out.outcome = cl.outcome; out.turn = turn }
  return out
}

// What happened in the clash itself, for the table's narration (v12)
function clashEvents(ca, cb, cl, ev) {
  if (cl.outcome === 'cancel') for (const side of [0, 1]) ev.push({ side, kind: 'cancel' })
  else if (cl.outcome === 'tech') for (const side of [0, 1]) ev.push({ side, kind: 'tech' })
  else if (cl.outcome === 'setup') {
    if (!cl.res[0]) ev.push({ side: 0, kind: 'interrupted' })
    if (!cl.res[1]) ev.push({ side: 1, kind: 'interrupted' })
  } else if ((cl.outcome === 'A' || cl.outcome === 'B') && ca.t === cb.t) {
    const w = cl.outcome === 'A' ? 0 : 1
    ev.push({ side: w, kind: 'faster', n: [ca.speed, cb.speed][w], m: [ca.speed, cb.speed][1 - w] })
  }
}

function insertSorted(arr, v) {
  if (arr.includes(v)) return
  let i = 0
  while (i < arr.length && arr[i] < v) i++
  arr.splice(i, 0, v)
}
function removeFrom(arr, v) {
  const i = arr.indexOf(v)
  if (i >= 0) arr.splice(i, 1)
}

export function outcome(ca, cb) {
  if (ca.v15 || cb.v15) return clash15(ca, cb).outcome
  if (ca.kind || cb.kind) return clash12(ca, cb).outcome     // v12 cards always have a kind
  if (ca.t === 'T' || cb.t === 'T') return 'typeless'
  if (ca.t === cb.t) return 'mirror'
  return BEATS.has(ca.t + cb.t) ? 'A' : 'B'
}


// ---- rules v15 ----------------------------------------------------------
// v11's triangle and grey economy with v12's kinds and speed (rules-overview 15):
//   Different types: the triangle decides.
//   Two attacks of one type: the faster card wins; a tie cancels (neither resolves).
//   Two Recovers: both clear their own piles. No damage.
//   A Recover that beats a Pressure pays off by rules.recoverPayoff:
//     'any'      the Recover's owner may play one attack from hand, unopposed
//     'pressure' as 'any', but the follow-up must be a Pressure
//     'fixed'    the attacker takes rules.fixedDamage (default 2) to HP
//     'none'     nothing beyond clearing (the baseline: Recovers only defend)
// Typeless cards are Setups, played in a setup step before the clash; the
// engine doesn't run that step yet, so v15 move lists carry no typeless cards.
// outcome: 'A' | 'B' | 'cancel' | 'recovers'
export function clash15(ca, cb) {
  const ta = ca.t, tb = cb.t
  if (ta !== tb) {
    const aWins = BEATS.has(ta + tb)
    return { res: [aWins, !aWins], beaten: [!aWins, aWins], outcome: aWins ? 'A' : 'B' }
  }
  if (ta === 'R') return { res: [true, true], beaten: [false, false], outcome: 'recovers' }
  if (ca.speed > cb.speed) return { res: [true, false], beaten: [false, true], outcome: 'A' }
  if (cb.speed > ca.speed) return { res: [false, true], beaten: [true, false], outcome: 'B' }
  return { res: [false, false], beaten: [false, false], outcome: 'cancel' }
}

// The side whose Recover beat a Pressure this round (and so earns the payoff),
// or -1. Experiment: a Projectile thrown from range leaves nothing to punish.
export function recoverWinner15(ca, cb, rules = {}) {
  const cl = clash15(ca, cb)
  let w = (cl.outcome === 'A' && ca.t === 'R' && cb.t === 'P') ? 0
        : (cl.outcome === 'B' && cb.t === 'R' && ca.t === 'P') ? 1 : -1
  if (w >= 0 && rules.projectileSafe && (w === 0 ? cb : ca).kind === 'projectile') w = -1
  return w
}

// The attacks a Recover's owner may follow up with: any available attack in
// hand (or the Super) other than the card just played, of an allowed type.
export function followCandidates(X, played, payoff) {
  const bl = blocked(X)
  const ok = t => (payoff === 'pressure' ? t === 'P' : (t === 'P' || t === 'C')) && !bl.has(t)
  const out = X.hand.filter(i => i !== played && ok(X.f.cards[i].t))
  if (X.sup && played !== 'S' && ok(X.f.sup.t)) out.push('S')
  return out
}

const NO_CARD = { t: null, kind: null, kw: {} }

// follow: [fA, fB], each undefined (choose automatically), null (no follow-up)
// or a card index / 'S'. Automatic choice uses rules.followScore(state, side)
// when given (the sparring partner's value function), otherwise a greedy
// estimate of damage dealt.
function step15(A0, B0, a, b, rules, ev, follow = [undefined, undefined]) {
  const payoff = rules.recoverPayoff || 'any'
  const ca = card(A0, a), cb = card(B0, b)
  const cl = clash15(ca, cb)
  const w = recoverWinner15(ca, cb, rules)
  if (w >= 0 && (payoff === 'any' || payoff === 'pressure') && follow[w] === undefined) {
    const X = w === 0 ? A0 : B0, played = w === 0 ? a : b
    const cands = [null, ...followCandidates(X, played, payoff)]
    let best = null, bestV = -Infinity
    for (const c of cands) {
      const f = [undefined, undefined]; f[w] = c
      const s = step15(A0, B0, a, b, rules, null, f)
      const v = rules.followScore ? rules.followScore(s, w) : greedyFollow(s, A0, B0, w)
      if (v > bestV + 1e-12) { bestV = v; best = c }
    }
    const f = [undefined, undefined]; f[w] = best
    return step15(A0, B0, a, b, rules, ev, f)
  }

  const A = clone(A0), B = clone(B0)
  const dA = { hp: 0, pile: 0 }, dB = { hp: 0, pile: 0 }, fA = {}, fB = {}
  if (ev) clashEvents15(ca, cb, cl, ev)
  const [resA, resB] = cl.res, [beatA, beatB] = cl.beaten
  if (resA) applyEffect(ca, A, B, dA, dB, fA, cb, rules, ev, 0)
  else if (beatA && ca.kw.onLossSelf) { dA.pile += ca.kw.onLossSelf; if (ev) ev.push({ side: 0, kind: 'onLoss', n: ca.kw.onLossSelf }) }
  if (resB) applyEffect(cb, B, A, dB, dA, fB, ca, rules, ev, 1)
  else if (beatB && cb.kw.onLossSelf) { dB.pile += cb.kw.onLossSelf; if (ev) ev.push({ side: 1, kind: 'onLoss', n: cb.kw.onLossSelf }) }
  const hp0 = [A.hp, B.hp], piles0 = [A.pile, B.pile]
  A.hp += dA.hp; A.pile = Math.max(0, A.pile + dA.pile)
  B.hp += dB.hp; B.pile = Math.max(0, B.pile + dB.pile)

  // The Recover's payoff, on the board the clash left
  let followed = null, fixed = 0
  if (w >= 0) {
    const [X, Y, FX] = w === 0 ? [A, B, fA] : [B, A, fB]
    if (payoff === 'fixed') {
      fixed = rules.fixedDamage ?? 2
      Y.hp -= fixed
      if (ev) ev.push({ side: w, kind: 'punish', n: fixed })
    } else if ((payoff === 'any' || payoff === 'pressure') && follow[w] !== null && follow[w] !== undefined) {
      const fi = follow[w], fc = card(X, fi)
      const dX = { hp: 0, pile: 0 }, dY = { hp: 0, pile: 0 }
      const before = { hp: Y.hp, pile: Y.pile }
      if (ev) ev.push({ side: w, kind: 'followUp', name: fc.name })
      applyEffect(fc, X, Y, dX, dY, FX, NO_CARD, rules, ev, w)
      X.hp += dX.hp; X.pile = Math.max(0, X.pile + dX.pile)
      Y.hp += dY.hp; Y.pile = Math.max(0, Y.pile + dY.pile)
      followed = { side: w, i: fi, name: fc.name, t: fc.t, hp: before.hp - Y.hp, pileBefore: before.pile, pileAfter: Y.pile }
    }
  }

  const quiet = A.hp === hp0[0] && B.hp === hp0[1] && A.pile === piles0[0] && B.pile === piles0[1]
  let result = null
  if (A.hp <= 0 || B.hp <= 0) {
    if (A.hp <= 0 && B.hp <= 0) result = A.hp > B.hp ? 1 : B.hp > A.hp ? 0 : 0.5
    else result = B.hp <= 0 ? 1 : 0
  }
  // cooldown step: the played card, and a follow-up, go on cooldown
  const sides = [[A, a, ca, fA, fB, 0], [B, b, cb, fB, fA, 1]]
  for (const [X, played, c, mine, theirs, k] of sides) {
    if (mine.ret) {
      if (X.cd2.length) insertSorted(X.hand, X.cd2.shift())
      else if (X.cd1.length) insertSorted(X.hand, X.cd1.shift())
    }
    for (const i of X.cd1) insertSorted(X.hand, i)
    X.cd1 = X.cd2; X.cd2 = []
    X.tlock = theirs.stagger || null
    const put = (pi, pc) => {
      if (pi === 'S') { X.sup = false; return }
      removeFrom(X.hand, pi)
      const space = Math.min(2, pc.cd + (theirs.lock ? 1 : 0))
      ;(space === 1 ? X.cd1 : X.cd2).push(pi)
    }
    put(played, c)
    if (followed && followed.side === k) put(followed.i, card(X, followed.i))
  }
  if (ev) {
    for (const [side, F] of [[0, fA], [1, fB]]) {
      if (F.lock) ev.push({ side, kind: 'lock' })
      if (F.stagger) ev.push({ side, kind: F.knockdown ? 'knockdown' : 'stagger', t: F.stagger })
    }
  }
  return { A, B, result, resolved: [resA, resB], beaten: [beatA, beatB], outcome: cl.outcome,
           quiet, flags: [fA, fB], followed, fixed, recoverWin: w }
}

// Without the sparring partner's value function: HP dealt, plus 0.6 per token
// built, minus 0.4 for the card it costs. A KO beats everything.
function greedyFollow(s, A0, B0, w) {
  const [X0, Y0, X, Y] = w === 0 ? [A0, B0, s.A, s.B] : [B0, A0, s.B, s.A]
  if (s.result !== null) return (w === 0 ? s.result : 1 - s.result) * 1000
  const dealt = (Y0.hp - Y.hp) + 0.6 * (Y.pile - Y0.pile)
  return dealt - (s.followed ? 0.4 : 0)
}

function clashEvents15(ca, cb, cl, ev) {
  if (cl.outcome === 'cancel') for (const side of [0, 1]) ev.push({ side, kind: 'tie', n: ca.speed })
  else if ((cl.outcome === 'A' || cl.outcome === 'B') && ca.t === cb.t) {
    const w = cl.outcome === 'A' ? 0 : 1
    ev.push({ side: w, kind: 'faster', n: [ca.speed, cb.speed][w], m: [ca.speed, cb.speed][1 - w] })
  }
}
