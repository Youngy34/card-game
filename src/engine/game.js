// Whole games, logs and balance reports.

import { newPlayer, step, card, options, outcome, DEFAULT_RULES } from './engine.js'
import { mixes, levelMixes, sample, availableTypes, withFollowScore, DEFAULT_WEIGHTS } from './ai.js'

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One logged round, in a compact form shared by the app and the reports.
export function roundRecord(n, A, B, a, b, s) {
  const ca = card(A, a), cb = card(B, b)
  const lockedOut = X => !['P', 'C', 'R'].every(t => availableTypes(X).has(t))
  return {
    n,
    cards: [ca.name, cb.name], types: [ca.t, cb.t], supers: [a === 'S', b === 'S'],
    outcome: outcome(ca, cb), resolved: s.resolved,
    before: [{ hp: A.hp, pile: A.pile }, { hp: B.hp, pile: B.pile }],
    after: [{ hp: s.A.hp, pile: s.A.pile }, { hp: s.B.hp, pile: s.B.pile }],
    lockedOut: [lockedOut(A), lockedOut(B)],
    quiet: s.quiet,
    // rules v12: each card's kind and speed, and what Guards and Counters turned back
    ...(s.turn ? { kinds: [ca.kind, cb.kind], speeds: [ca.speed, cb.speed], turn: s.turn } : {}),
    // rules v15: kinds and speeds, and what a Recover that beat a Pressure did next
    ...(s.recoverWin !== undefined ? {
      v15: true, kinds: [ca.kind, cb.kind], speeds: [ca.speed, cb.speed], recoverWin: s.recoverWin, fixed: s.fixed || 0,
      followed: s.followed ? { side: s.followed.side, name: s.followed.name, t: s.followed.t, hp: s.followed.hp, cashed: s.followed.t === 'C' ? s.followed.pileBefore : 0 } : null,
    } : {}),
  }
}

// How the game was won, from its last round
export function winRoute(last, result) {
  if (result === 0.5) return last.after[0].hp <= 0 ? 'draw (double KO)' : 'draw (round limit)'
  if (last.after[0].hp <= 0 && last.after[1].hp <= 0) return 'double KO'
  const loser = result === 1 ? 1 : 0
  const winner = 1 - loser
  if (last.v15) {
    if (last.followed && last.followed.side === winner) return last.followed.t === 'C' ? 'follow-up Convert' : 'follow-up Pressure'
    if (last.fixed && last.recoverWin === winner) return 'fixed punish'
  }
  const cashed = last.resolved[winner] && last.types[winner] === 'C' && last.before[loser].pile > 0
  if (cashed) return 'Convert cash'
  if (last.turn && last.turn[loser].chip > 0) return 'turn-back (Counter)'
  return 'chip'
}

export function playAIGame(fa, fb, rng, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard']) {
  if ((fa.v15 || fb.v15) && !rules.followScore) rules = withFollowScore(rules, W)
  let A = newPlayer(fa), B = newPlayer(fb)
  const rounds = []
  const hard = levels[0] === 'hard' && levels[1] === 'hard'
  for (let n = 1; ; n++) {
    const m = mixes(A, B, rules, W)
    const [px, py] = hard ? [m.x, m.y] : levelMixes(m, levels)
    const i = sample(px, rng), j = sample(py, rng)
    const s = m.next[i][j]
    rounds.push(roundRecord(n, A, B, m.oa[i], m.ob[j], s))
    A = s.A; B = s.B
    if (s.result !== null) return { result: s.result, rounds }
    if (n >= rules.maxRounds) return { result: 0.5, rounds }
  }
}

// ---- reports ------------------------------------------------------------
const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }

// Rules v12: how same-type attacks were settled, what Setups did, and what
// Guards and Counters turned back. Kept apart so v11 reports are unchanged.
function tally12(out, rd) {
  const V = (out.v12 ??= {
    sameType: 0, bySpeed: 0, trades: 0, cancels: 0, techs: 0,
    setups: 0, interrupted: 0,
    guarded: 0, guardBuild: 0, countered: 0, counterChip: 0,
    quietBy: { recovers: 0, cancel: 0, tech: 0, other: 0 },
  })
  const same = rd.types[0] === rd.types[1] && (rd.types[0] === 'P' || rd.types[0] === 'C')
  if (same) {
    V.sameType++
    if (rd.outcome === 'trade') V.trades++
    else if (rd.outcome === 'cancel') V.cancels++
    else if (rd.outcome === 'tech') V.techs++
    else V.bySpeed++
  }
  for (const k of [0, 1]) {
    if (rd.types[k] === 'T') { V.setups++; if (!rd.resolved[k]) V.interrupted++ }
    const t = rd.turn[k]
    if (rd.types[k] === 'P' && rd.types[1 - k] === 'R' && !rd.resolved[k]) {
      if (rd.kinds[1 - k] === 'guard') { V.guarded++; V.guardBuild += t.build }
      else { V.countered++; V.counterChip += t.chip }
    }
  }
  if (rd.quiet) {
    const q = rd.outcome === 'recovers' ? 'recovers' : rd.outcome === 'cancel' ? 'cancel' : rd.outcome === 'tech' ? 'tech' : 'other'
    V.quietBy[q]++
  }
}

// Rules v15: same-type attacks, ties, Recover wins and their follow-ups.
function tally15(out, rd) {
  const V = (out.v15 ??= {
    sameType: 0, bySpeed: 0, ties: 0, recoverWins: 0, followP: 0, followC: 0, noFollow: 0, followHp: 0, fixed: 0, fixedHp: 0,
    quietBy: { recovers: 0, tie: 0, other: 0 },
  })
  if (rd.types[0] === rd.types[1] && (rd.types[0] === 'P' || rd.types[0] === 'C')) {
    V.sameType++
    if (rd.outcome === 'cancel') V.ties++; else V.bySpeed++
  }
  if (rd.recoverWin >= 0) {
    V.recoverWins++
    if (rd.followed) { if (rd.followed.t === 'C') V.followC++; else V.followP++; V.followHp += rd.followed.hp }
    else if (rd.fixed) { V.fixed++; V.fixedHp += rd.fixed }
    else V.noFollow++
  }
  if (rd.quiet) V.quietBy[rd.outcome === 'recovers' ? 'recovers' : rd.outcome === 'cancel' ? 'tie' : 'other']++
}

// games: [{ result, rounds }], with side 0 = fighter A.
export function summarise(games, fa, fb) {
  const n = games.length
  const out = {
    games: n, win: 0, doubleKO: 0, draws: 0, lengths: [], quiet: 0, recoverMirrors: 0, totalRounds: 0,
    v12: null,       // rules v12 clash counts, when the fighters play v12
    v15: null,       // rules v15 clash and follow-up counts
    routes: {}, sides: [0, 1].map(k => ({
      plays: {}, resolved: {}, types: { P: 0, C: 0, R: 0, T: 0 }, superRounds: [], superUnused: 0, lockedOut: 0,
    })),
  }
  for (const g of games) {
    out.win += g.result
    out.lengths.push(g.rounds.length)
    const last = g.rounds[g.rounds.length - 1]
    const dko = last && last.after[0].hp <= 0 && last.after[1].hp <= 0
    if (dko) { out.doubleKO++; if (g.result === 0.5) out.draws++ }
    const r = last ? winRoute(last, g.result) : 'n/a'
    out.routes[r] = (out.routes[r] || 0) + 1
    const used = [false, false]
    for (const rd of g.rounds) {
      out.totalRounds++
      if (rd.quiet) out.quiet++
      if (rd.types[0] === 'R' && rd.types[1] === 'R') out.recoverMirrors++
      if (rd.v15) tally15(out, rd)
      else if (rd.kinds) tally12(out, rd)
      for (const k of [0, 1]) {
        const S = out.sides[k], nm = rd.cards[k]
        S.plays[nm] = (S.plays[nm] || 0) + 1
        S.resolved[nm] = (S.resolved[nm] || 0) + (rd.resolved[k] ? 1 : 0)
        S.types[rd.types[k]]++
        if (rd.supers[k]) { S.superRounds.push(rd.n); used[k] = true }
        if (rd.lockedOut[k]) S.lockedOut++
      }
    }
    for (const k of [0, 1]) if (!used[k]) out.sides[k].superUnused++
  }
  out.win /= n
  out.margin = 1.96 * Math.sqrt(0.25 / n)
  out.median = median(out.lengths)
  out.mean = out.lengths.reduce((a, b) => a + b, 0) / n
  out.p10 = pct(out.lengths, 0.1); out.p90 = pct(out.lengths, 0.9)
  out.fighters = [fa, fb]
  return out
}

// Play n AI games, yielding to the browser between batches. onProgress(done, n).
export async function runBalance(fa, fb, { n = 300, seed = 1, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard'], onProgress, signal } = {}) {
  const rng = mulberry32(seed)
  const games = []
  let t = Date.now()
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break
    games.push(playAIGame(fa, fb, rng, rules, W, levels))
    if (Date.now() - t > 30) {
      onProgress?.(i + 1, n)
      await new Promise(r => setTimeout(r, 0))
      t = Date.now()
    }
  }
  onProgress?.(games.length, n)
  return summarise(games, fa, fb)
}

export { options }
