// Yomi rules engine — rules v11. A port of the rules engine in yomi_sim.py
// (Player, apply_effect, step), cross-checked against it round by round.
//
// All effects read the board as it was at reveal; changes apply together
// ("state at reveal", proposed in the rules and built into the simulator).

export const BEATS = new Set(['PC', 'CR', 'RP'])           // winner+loser

export const DEFAULT_RULES = { counterChip: 'always', maxRounds: 60 }

// ---- player state ---------------------------------------------------------
// hand: sorted card indices; cd1/cd2: cooldown spaces (in arrival order);
// sup: Super still in hand; tlock: a type this player can't play this round.
export function newPlayer(f) {
  return { f, hp: f.hp, pile: 0, hand: f.cards.map((_, i) => i), cd1: [], cd2: [], sup: true, tlock: null }
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

// Adds this card's effect to the deltas, reading the board at reveal.
// ev (optional) collects a description of what happened, for the UI.
function applyEffect(c, me, op, dMe, dOp, flags, opp, rules, ev, side) {
  const kw = c.kw
  if (c.t === 'P') {
    let build = c.build, chip = c.chip
    if (kw.buildIfOppHas && op.pile >= kw.buildIfOppHas.tokens) build += kw.buildIfOppHas.build
    if (kw.buildPerOwnTokens) build += fl(me.pile / kw.buildPerOwnTokens)
    if (kw.chipPerOwnTokens) chip += fl(me.pile / kw.chipPerOwnTokens)
    if (kw.chipPerOppTokens) chip += fl(op.pile / kw.chipPerOppTokens)
    if (opp.t === 'C') chip += kw.chipOnWin || 0        // a resolving Pressure vs a Convert beat it
    if (opp.t === 'P') chip += kw.chipIfMirror || 0
    if (flowing(me)) { build += kw.flowBuild || 0; chip += kw.flowChip || 0 }
    dOp.pile += build; dOp.hp -= chip
    if (ev) { ev.push({ side, kind: 'build', n: build }); if (chip) ev.push({ side, kind: 'chip', n: chip }) }
  } else if (c.t === 'C') {
    const cash = op.pile
    let chip = convertChip(c, me, cash)
    if (opp.t === 'R') chip += kw.chipOnWin || 0          // a resolving Convert vs a Recover beat it
    dOp.hp -= cash + chip; dOp.pile -= op.pile
    if (kw.clearOwn) dMe.pile -= me.pile
    if (ev) {
      ev.push({ side, kind: 'cash', n: cash }); ev.push({ side, kind: 'chip', n: chip })
      if (kw.clearOwn && me.pile) ev.push({ side, kind: 'clearOwn', n: me.pile })
    }
  } else if (c.t === 'R') {
    let chip = recoverChip(c, me, me.pile)
    if (opp.t === 'P') chip += kw.chipOnWin || 0
    else if (rules.counterChip === 'strict') chip = 0             // a counter needs a Pressure to counter
    else if (rules.counterChip === 'attack' && !(opp.t === 'T' && opp.chip > 0)) chip = 0
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
export function step(A0, B0, a, b, rules = DEFAULT_RULES, ev = null) {
  const A = clone(A0), B = clone(B0)
  const ca = card(A, a), cb = card(B, b)
  const dA = { hp: 0, pile: 0 }, dB = { hp: 0, pile: 0 }, fA = {}, fB = {}
  let resA = true, resB = true
  if (ca.t !== 'T' && cb.t !== 'T' && ca.t !== cb.t) {
    if (BEATS.has(ca.t + cb.t)) resB = false; else resA = false
  }
  if (resA) applyEffect(ca, A, B, dA, dB, fA, cb, rules, ev, 0)
  else if (ca.kw.onLossSelf) { dA.pile += ca.kw.onLossSelf; if (ev) ev.push({ side: 0, kind: 'onLoss', n: ca.kw.onLossSelf }) }
  if (resB) applyEffect(cb, B, A, dB, dA, fB, ca, rules, ev, 1)
  else if (cb.kw.onLossSelf) { dB.pile += cb.kw.onLossSelf; if (ev) ev.push({ side: 1, kind: 'onLoss', n: cb.kw.onLossSelf }) }
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
    if (fA.stagger) ev.push({ side: 0, kind: 'stagger', t: fA.stagger })
    if (fB.stagger) ev.push({ side: 1, kind: 'stagger', t: fB.stagger })
    if (fA.ret) ev.push({ side: 0, kind: 'return' })
    if (fB.ret) ev.push({ side: 1, kind: 'return' })
  }
  return { A, B, result, resolved: [resA, resB], quiet, flags: [fA, fB] }
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
  if (ca.t === 'T' || cb.t === 'T') return 'typeless'
  if (ca.t === cb.t) return 'mirror'
  return BEATS.has(ca.t + cb.t) ? 'A' : 'B'
}
