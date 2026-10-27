// Whole games, reveal records and balance reports for rules v13.

import { newGame, reveal, label, player } from './engine.js'
import { newContext, mixes, levelMixes, counterChoices, pickCounter, sampleIndex, DEFAULT_WEIGHTS } from './ai.js'
import { DEFAULT_RULES } from './rules.js'

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

export function firstInit(rules, r) {
  return rules.firstInitiative === 'a' ? 0 : rules.firstInitiative === 'b' ? 1 : r < 0.5 ? 0 : 1
}

// What a pick was, in one code: 'H' / 'V' / 'T' for an attack, else the universal id
export function playCode(G, side, pick) {
  return typeof pick === 'number' ? player(G, side).f.cards[pick].dir : pick
}
// An attack's combo role: 'L' / 'M' / 'H' linker, 'E' ender, or null
const roleOf = (G, side, pick) => {
  if (typeof pick !== 'number') return null
  const c = player(G, side).f.cards[pick]
  return c.ender ? 'E' : c.link
}

// One logged reveal, in a compact form shared by the app, the log and the reports.
export function revealRecord(G, ev, N) {
  const r = {
    n: ev.n, phase: ev.phase === 'combo' ? 'C' : 'N',
    cards: [label(G, 0, ev.picks[0]), label(G, 1, ev.picks[1])],
    play: [playCode(G, 0, ev.picks[0]), playCode(G, 1, ev.picks[1])],
    role: [roleOf(G, 0, ev.picks[0]), roleOf(G, 1, ev.picks[1])],
    result: ev.result, init: [ev.init0, ev.init1],
    dmg: ev.dmg, grey: ev.grey,
    after: [{ hp: N.A.hp, pile: N.A.pile }, { hp: N.B.hp, pile: N.B.pile }],
  }
  if (ev.phase === 'neutral') {
    r.kind = ev.kind; r.by = ev.by
    if (ev.speeds) r.speeds = ev.speeds
    if (ev.onBlock !== undefined) r.onBlock = ev.onBlock
    if (ev.combo !== undefined) r.combo = ev.combo
    if (ev.throwCash) r.throwCash = ev.throwCash
    if (ev.counter) {
      const c = ev.counter
      r.counter = { side: c.side, card: c.card === null ? null : label(G, c.side, c.card), result: c.result, options: c.options }
    }
  } else {
    r.beat = ev.beat; r.att = ev.att
    for (const f of ['cashed', 'bonus', 'cleared', 'wrongBreak', 'ended']) if (ev[f] !== undefined) r[f] = ev[f]
  }
  if (ev.blowout) r.blowout = true
  if (ev.ko) r.ko = true
  if (ev.limit) r.limit = true
  if (ev.timeout) r.timeout = true
  return r
}

// How a game ended, from its last reveal
export function winRoute(last, result) {
  if (!last) return 'n/a'
  if (last.limit) return 'draw (reveal limit)'
  if (last.timeout) return result === 0.5 ? 'time out, level HP' : 'time out'
  if (result === 0.5) return 'draw'
  if (last.phase === 'C') return last.result === 'cashed' ? 'ender' : 'combo'
  if (last.counter?.result) return last.counter.result === 'thrown' ? 'counter throw' : 'counter hit'
  return last.result === 'thrown' ? 'throw' : 'hit'
}

// ---- read strength ------------------------------------------------------------------
// How much the board tells you. Each neutral reveal, the Hard mix for each player
// is grouped by kind of move (Horizontal, Vertical, Throw, Guard, Duck, Step):
//   focus: the share of the most likely kind (1/6 ≈ 17% is an even spread)
//   shift: how far that grouped mix moved since the player's previous neutral
//          reveal (half the summed differences: 0% = the same guess again)
export function kindMix(G, side, opts, p) {
  const m = {}
  opts.forEach((o, i) => { const k = playCode(G, side, o); m[k] = (m[k] || 0) + p[i] })
  return m
}
export function mixShift(a, b) {
  let d = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) d += Math.abs((a[k] || 0) - (b[k] || 0))
  return d / 2
}
const top = m => Math.max(...Object.values(m))

export function playAIGame(fa, fb, rng, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard']) {
  const init = firstInit(rules, rng())
  let G = newGame(fa, fb, rules, init)
  const ctx = newContext(W)
  const hard = levels[0] === 'hard' && levels[1] === 'hard'
  const reveals = []
  const read = { focus: 0, shift: 0, nf: 0, ns: 0 }, prev = [null, null]
  while (!G.over) {
    const mx = mixes(G, ctx)
    if (G.mode === 'neutral') {
      for (const k of [0, 1]) {
        const m = kindMix(G, k, k ? mx.ob : mx.oa, k ? mx.y : mx.x)
        read.focus += top(m); read.nf++
        if (prev[k]) { read.shift += mixShift(prev[k], m); read.ns++ }
        prev[k] = m
      }
    }
    const [px, py] = hard ? [mx.x, mx.y] : levelMixes(mx, levels)
    const a = mx.oa[sampleIndex(px, rng())], b = mx.ob[sampleIndex(py, rng())]
    let r = reveal(G, a, b)
    if (r.pending) {
      const ch = counterChoices(G, a, b, r.pending, ctx)
      r = reveal(G, a, b, pickCounter(ch, levels[r.pending.side], rng()))
    }
    reveals.push(revealRecord(G, r.ev, r.G))
    G = r.G
  }
  return { result: G.result, startInit: init, reveals, read }
}

// ---- reports ----------------------------------------------------------------------
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const quant = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n }

export function emptyStats() {
  return {
    games: 0, win: 0, draws: 0, startWin: 0, lengths: [], neutral: 0, beats: 0,
    results: {}, clashes: 0, counters: { hit: 0, thrown: 0, declined: 0, none: 0 },
    combos: 0, comboEnds: { ender: 0, broken: 0, dropped: 0, blowout: 0, ko: 0 }, linkersLanded: 0, comboDamage: 0,
    holds: 0, breakPlays: { BL: 0, BM: 0, BH: 0 }, broken: 0, wrongBreak: 0, breakVsEnder: 0, breakVsFeint: 0,
    feints: 0, locked: 0, dropped: 0,
    damage: { opener: 0, counter: 0, throw: 0, ender: 0 },
    leftover: 0, leftoverGrey: 0, maxPiles: [], throwCash: 0, throwCashes: 0, guardGrey: 0,
    read: { focus: 0, shift: 0, nf: 0, ns: 0 },
    minus: 0, minusGuard: 0, minusDefend: 0, holderAttack: 0, twoDef: 0, streaks: [],
    routes: {},
    sides: [0, 1].map(() => ({ neutral: {}, counter: {}, linker: {}, ender: {}, wins: 0 })),
  }
}

// Add one game (side 0 = fighter A) to a running summary.
export function addGame(S, g) {
  S.games++
  S.win += g.result
  if (g.result === 0.5) S.draws++
  S.startWin += g.startInit === 0 ? g.result : 1 - g.result
  if (g.read) for (const k of ['focus', 'shift', 'nf', 'ns']) S.read[k] += g.read[k]
  S.lengths.push(g.reveals.length)
  const last = g.reveals[g.reveals.length - 1]
  const route = winRoute(last, g.result)
  S.routes[route] = (S.routes[route] || 0) + 1
  let run = 0, holder = null, peak = 0, comboOpen = null
  for (const r of g.reveals) {
    peak = Math.max(peak, r.after[0].pile, r.after[1].pile)
    if (r.phase === 'N') {
      S.neutral++
      bump(S.results, r.result)
      if (r.kind === 'clash') S.clashes++
      if (r.kind === 'defences') S.twoDef++
      if (r.throwCash) { S.throwCashes++; S.throwCash += r.throwCash }
      if (r.result === 'blocked') S.guardGrey += r.grey[0] + r.grey[1]
      const h = r.init[0], m = 1 - h
      S.minus++
      if (r.play[m] === 'G') S.minusGuard++
      if (['G', 'D', 'S'].includes(r.play[m])) S.minusDefend++
      if (!['G', 'D', 'S'].includes(r.play[h])) S.holderAttack++
      if (h === holder) run++; else { if (holder !== null) S.streaks.push(run); holder = h; run = 1 }
      for (const k of [0, 1]) bump(S.sides[k].neutral, r.cards[k])
      if (r.counter) {
        if (r.counter.card) { bump(S.counters, r.counter.result); bump(S.sides[r.counter.side].counter, r.counter.card) }
        else if (r.counter.options) S.counters.declined++
        else S.counters.none++
      }
      // damage by source
      const dealt = r.dmg[0] + r.dmg[1]
      if (dealt) {
        if (r.counter?.card) S.damage.counter += dealt
        else if (r.result === 'thrown') S.damage.throw += dealt
        else S.damage.opener += dealt
      }
      if (r.combo !== undefined) { S.combos++; comboOpen = { dmg: dealt, linkers: 0 }; if (r.ko) S.comboEnds.ko++ }
    } else {
      S.beats++
      const k = r.att, d = 1 - k
      const a = r.play[k], b = r.play[d]
      if (b === 'G') S.holds++; else S.breakPlays[b]++
      if (a === 'G') {
        S.feints++
        if (r.result === 'locked') { S.locked++; S.breakVsFeint++ } else S.dropped++
      } else if (r.role[k] === 'E') {
        bump(S.sides[k].ender, r.cards[k])
        if (b !== 'G') S.breakVsEnder++
        S.damage.ender += r.dmg[d]
      } else {
        bump(S.sides[k].linker, r.cards[k])
        if (r.result === 'broken') S.broken++
        else { S.linkersLanded++; if (comboOpen) comboOpen.linkers++; if (b !== 'G') S.wrongBreak++ }
      }
      if (comboOpen) comboOpen.dmg += r.dmg[d]
      if (r.ended || r.ko) {
        const how = r.ko && r.result !== 'cashed' ? 'ko' : r.blowout ? 'blowout' : r.result === 'cashed' ? 'ender' : r.result
        if (S.comboEnds[how] !== undefined) S.comboEnds[how]++
        if (comboOpen) S.comboDamage += comboOpen.dmg
        if ((how === 'dropped' || how === 'blowout') && r.after[d].pile > 0) { S.leftover++; S.leftoverGrey += r.after[d].pile }
        comboOpen = null
      }
    }
  }
  if (comboOpen) S.comboDamage += comboOpen.dmg            // a combo whose opener KOed, or a game cut short
  if (holder !== null) S.streaks.push(run)
  S.maxPiles.push(peak)
  if (g.result === 1) S.sides[0].wins++; else if (g.result === 0) S.sides[1].wins++
  return S
}

export function finishStats(S, fa, fb) {
  const n = Math.max(S.games, 1)
  return {
    ...S,
    winRate: S.win / n, margin: 1.96 * Math.sqrt(0.25 / n), startRate: S.startWin / n,
    median: median(S.lengths), p10: quant(S.lengths, 0.1), p90: quant(S.lengths, 0.9),
    mean: S.lengths.reduce((a, b) => a + b, 0) / n,
    avgStreak: S.streaks.length ? S.streaks.reduce((a, b) => a + b, 0) / S.streaks.length : null,
    linkersPerCombo: S.combos ? S.linkersLanded / S.combos : null,
    revealsPerHit: S.combos ? S.neutral / S.combos : null,
    medianPeakPile: median(S.maxPiles),
    readFocus: S.read.nf ? S.read.focus / S.read.nf : null,
    readShift: S.read.ns ? S.read.shift / S.read.ns : null,
    fighters: [fa, fb],
  }
}

export function summarise(games, fa, fb) {
  const S = emptyStats()
  for (const g of games) addGame(S, g)
  return finishStats(S, fa, fb)
}

// Play n games, yielding to the browser between batches. onProgress(done, n).
export async function runBalance(fa, fb, { n = 200, seed = 1, rules = DEFAULT_RULES, W = DEFAULT_WEIGHTS, levels = ['hard', 'hard'], onProgress, signal } = {}) {
  const rng = mulberry32(seed)
  const S = emptyStats()
  let t = Date.now()
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break
    addGame(S, playAIGame(fa, fb, rng, rules, W, levels))
    if (Date.now() - t > 30) {
      onProgress?.(i + 1, n)
      await new Promise(r => setTimeout(r, 0))
      t = Date.now()
    }
  }
  onProgress?.(S.games, n)
  return finishStats(S, fa, fb)
}
