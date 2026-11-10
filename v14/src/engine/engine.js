// The rules v14 engine: pure functions over plain state, no UI. The app, the
// Lab and the command-line simulator all play through this file.
//
// A game is a series of reveals. Both players pick one available card face
// down; reveal(G, a, b) (a and b are card indices) returns the next state and
// an event describing what happened.
//
// Cooldown spaces are bit masks of card indices: cd1 comes back after the next
// reveal, cd2 after the one after that.

import { beats, mirrorActs, DEFAULT_RULES, CODES } from './rules.js'

export function newPlayer(f) {
  return { f, hp: f.hp, pile: 0, cd1: 0, cd2: 0, meter: 0 }
}

export function newGame(fa, fb, rules = DEFAULT_RULES) {
  return { R: { ...DEFAULT_RULES, ...rules }, A: newPlayer(fa), B: newPlayer(fb), n: 1, over: false, result: null }
}

export const avail = X => X.f.all & ~(X.cd1 | X.cd2)
export function bits(m) { const out = []; for (let i = 0; m; i++, m >>>= 1) if (m & 1) out.push(i); return out }
export function popcount(m) { let n = 0; while (m) { m &= m - 1; n++ } return n }
export const player = (G, side) => (side ? G.B : G.A)

// What `side` may play this reveal: every card not cooling down.
export const options = (G, side) => bits(avail(side ? G.B : G.A))

// The types a player can't play this reveal (every card of that type is cooling down)
export function missingTypes(X) {
  const av = avail(X)
  return CODES.filter(t => X.f.byType[t] && !(X.f.byType[t] & av))
}

export const label = (G, side, pick) => player(G, side).f.cards[pick].name

// ---- one reveal ---------------------------------------------------------------
export function reveal(G, a, b) {
  if (G.over) throw new Error('The game is over.')
  const P = [G.A, G.B], picks = [a, b], R = G.R
  for (const k of [0, 1]) {
    if (!((avail(P[k]) >> picks[k]) & 1)) throw new Error(`${P[k].f.cards[picks[k]]?.name ?? 'That card'} can't be played now.`)
  }
  const cards = [P[0].f.cards[a], P[1].f.cards[b]]
  const hp = [P[0].hp, P[1].hp], pile = [P[0].pile, P[1].pile], meter = [P[0].meter || 0, P[1].meter || 0]
  const ev = {
    n: G.n, picks: [a, b], types: [cards[0].t, cards[1].t],
    out: [missingTypes(P[0]).join(''), missingTypes(P[1]).join('')],   // types each side was missing
    kind: 'win', by: null, result: null, effects: [null, null],
    dmg: [0, 0], chip: [0, 0], grey: [0, 0], cashed: [0, 0], cleared: [0, 0], meter: [0, 0],
  }

  // card w takes effect; l is the other player
  const apply = (w, l) => {
    const c = cards[w], cl = cards[l]
    switch (c.t) {
      case 'S':
        pile[l] += c.grey; ev.grey[l] += c.grey
        hp[l] -= c.chip; ev.dmg[l] += c.chip; ev.chip[l] += c.chip
        return 'hit'
      case 'H': case 'G': {
        const cash = pile[l]
        hp[l] -= cash + c.chip; ev.dmg[l] += cash + c.chip; ev.chip[l] += c.chip; ev.cashed[l] = cash
        pile[l] = 0
        return 'cash'
      }
      case 'F': {
        ev.cleared[w] = pile[w]; pile[w] = 0
        const g = Math.min(R.focusMeter || 0, Math.max((R.meterMax ?? 3) - meter[w], 0))
        meter[w] += g; ev.meter[w] += g
        return 'clear'
      }
      case 'B':
        if (cl.t === 'S') { pile[l] += cl.grey; ev.grey[l] += cl.grey; return 'turnback' }
        if (cl.t === 'H') { const g = R.blockedHeavyGrey || 0; pile[l] += g; ev.grey[l] += g; return 'stopped' }
        if (cl.t === 'F') {
          if (R.wheel === 'first') { ev.grey[l] += pile[l]; pile[l] *= 2; return 'double' }
          return 'fizzle'
        }
        return 'guard'                                  // Block against Block, in a mirror that takes effect
    }
    return null
  }

  if (cards[0].t === cards[1].t) {
    ev.kind = 'mirror'
    const both = mirrorActs(R, cards[0].t)
    if (both) { ev.effects = [apply(0, 1), apply(1, 0)]; ev.result = 'trade' }
    else ev.result = 'cancel'
  } else {
    const w = beats(R.wheel, cards[0].t, cards[1].t) ? 0 : 1
    ev.by = w
    ev.result = apply(w, 1 - w)
    ev.effects[w] = ev.result
  }
  return finish(G, hp, pile, meter, picks, ev)
}

// ---- end of every reveal: KO check, cooldown step, the reveal limit ----------------
function tick(X, hp, pile, meter, i) {
  // 1. space 1 returns to hand; 2. space 2 slides to space 1; 3. the played card
  //    goes on the space matching its Cooldown.
  const bit = 1 << i, cd = X.f.cards[i].cd
  return { f: X.f, hp, pile, cd1: X.cd2 | (cd === 1 ? bit : 0), cd2: cd === 2 ? bit : 0, meter }
}

function finish(G, hp, pile, meter, picks, ev) {
  const N = {
    R: G.R, A: tick(G.A, hp[0], pile[0], meter[0], picks[0]), B: tick(G.B, hp[1], pile[1], meter[1], picks[1]),
    n: G.n + 1, over: false, result: null,
  }
  if (hp[0] <= 0 || hp[1] <= 0) {
    N.over = true; ev.ko = true
    if (hp[0] <= 0 && hp[1] <= 0) ev.doubleKO = true
    // a double KO goes to whoever ends least below 0; an exact tie is a draw
    N.result = hp[0] > 0 ? 1 : hp[1] > 0 ? 0 : hp[0] === hp[1] ? 0.5 : hp[0] > hp[1] ? 1 : 0
  }
  if (!N.over && N.n > G.R.maxReveals) { N.over = true; N.result = 0.5; ev.limit = true }
  return { G: N, ev }
}
