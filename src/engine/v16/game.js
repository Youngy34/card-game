// Rules v16: whole games between sparring partners (or bots), round records
// shared with the app's log, and the balance report the Lab and sim16 print.

import { newGame16, applyNeutral16, runClash16, startDraw16, discardDown16, card16, statusList, DEFAULT_RULES16 } from './engine.js'
import { DEFAULT_W16, LEVELS16, BOTS16, clashMix16, neutralChoice16, bestChoice16, botNeutral, botClash, chooseDiscards, sampleIndex, afterNeutral, jointMix16 } from './ai.js'

export function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const snap16 = X => ({ hp: X.hp, pile: X.pile, hand: X.hand.length, meter: X.meter, deck: X.deck.length })

// The damage each side took this round, split by where it came from
function damageBy(ev) {
  const out = { clash: [0, 0], follow: [0, 0], link: [0, 0], end: [0, 0] }
  for (const e of ev) {
    if (e.kind !== 'hit') continue
    const d = (e.chip || 0) + (e.cash || 0)
    const target = e.t === 'R' && !e.chip ? null : 1 - e.side
    if (target === null || !d) continue
    out[e.how][target] += d
  }
  return out
}

// One round, compact, for the log and the reports
export function roundRecord16(n, before, G, neutral) {
  const c = G.clash
  const ev = c.events
  const dmg = damageBy(ev)
  return {
    n,
    neutral: neutral.map(a => (a ? { kind: a.kind, ...(a.name ? { name: a.name } : {}), ...(a.n !== undefined ? { n: a.n } : {}), ...(a.why ? { why: a.why } : {}) } : { kind: 'none' })),
    cards: c.names, types: c.types, supers: c.picks.map(p => p === 'S'),
    outcome: c.outcome, winner: c.winner,
    speeds: ev.find(e => e.kind === 'speeds')?.speeds || null,
    follow: c.follow, combo: c.combo, offered: c.offered || {},
    starterWon: c.winner >= 0 && ['triangle', 'armor', 'mixup', 'speed', 'tie', 'unopposed'].includes(c.outcome) && !!card16(c.winner === 0 ? G.A : G.B, c.picks[c.winner])?.starter,
    statuses: [statusList(G.A.next), statusList(G.B.next)],
    dmg, before, after: [snap16(G.A), snap16(G.B)],
    quiet: before[0].hp === G.A.hp && before[1].hp === G.B.hp && before[0].pile === G.A.pile && before[1].pile === G.B.pile,
  }
}

// How a game was won, from its last round
export function winRoute16(last, result) {
  if (!last || result === 0.5) return 'round limit'
  const w = result === 1 ? 0 : 1
  if (last.combo.length && last.combo[last.combo.length - 1].side === w) return last.combo.some(x => x.t === 'C') ? 'combo ending in a Convert' : 'combo'
  if (last.follow && last.follow.side === w) return last.follow.t === 'C' ? 'follow-up Convert' : 'follow-up Pressure'
  if (last.supers[w]) return 'Super'
  if (last.types[w] === 'C' && last.before[1 - w].pile > 0) return 'Convert cash'
  return 'chip'
}

// ---- decisions -----------------------------------------------------------------
export function aiNeutral(G, side, level, W, rng) {
  if (BOTS16[level]) return botNeutral(G, side, level, rng)
  return neutralChoice16(G, side, W, rng, level).act
}
export function aiClash(G, side, level, W, rng) {
  if (BOTS16[level]) return botClash(G, side, level, rng)
  const m = clashMix16(G, side, W, rng, level)
  return m.options[sampleIndex(m.x, rng)]
}
export const aiCombo = (g, p, W) => bestChoice16(g, p, W)

// One reveal: the setup card and the clash card are chosen together, without
// seeing the opponent's setup card
export function aiRound16(G, side, level, W, rng) {
  if (BOTS16[level]) {
    const act = botNeutral(G, side, level, rng)
    return { act, pick: botClash(afterNeutral(G, side, act, rng), side, level, rng) }
  }
  // The setup action is picked as in the two-phase neutral phase (its best clash card's
  // value against the opponent's mix, through the same softmax), then the clash card
  // from the solved mix within that action
  const m = jointMix16(G, side, W, rng, level)
  const acts = [...new Set(m.options.map(o => o.act))]
  const best = acts.map(a => Math.max(...m.options.map((o, i) => (o.act === a ? m.util[i] : -Infinity))))
  const a = acts[sampleIndex(softmaxP(best, LEVELS16[level]?.neutral ?? 60), rng)]
  const idx = m.options.map((o, i) => i).filter(i => m.options[i].act === a)
  let w = idx.map(i => m.x[i])
  if (w.reduce((t, v) => t + v, 0) < 1e-9) w = softmaxP(idx.map(i => m.util[i]), 60)
  return m.options[idx[sampleIndex(w, rng)]]
}
const softmaxP = (u, lambda) => {
  const mx = Math.max(...u), e = u.map(v => Math.exp(lambda * (v - mx))), t = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / t)
}

// ---- a whole game ------------------------------------------------------------------
export function playGame16(fa, fb, { rules = DEFAULT_RULES16, W = DEFAULT_W16, levels = ['hard', 'hard'], seed = 1, rng = mulberry(seed) } = {}) {
  let G = newGame16(fa, fb, rules, seed)
  const rounds = []
  while (G.result === null) {
    const before = [snap16(G.A), snap16(G.B)]
    let picks
    if (rules.oneReveal) {
      const both = [0, 1].map(k => aiRound16(G, k, levels[k], W, rng))
      G = applyNeutral16(G, both.map(b => b.act))
      picks = both.map(b => b.pick)
    } else {
      const acts = [0, 1].map(k => aiNeutral(G, k, levels[k], W, rng))
      G = applyNeutral16(G, acts)
      picks = [0, 1].map(k => aiClash(G, k, levels[k], W, rng))
    }
    const neutral = G.neutral
    G = runClash16(G, picks[0], picks[1], (g, p) => aiCombo(g, p, W))
    rounds.push(roundRecord16(G.round, before, G, neutral))
    if (G.result !== null) break
    G = startDraw16(G)
    while (G.phase === 'draw') {
      for (const k of [0, 1]) if (G.discardDown?.[k]) G = discardDown16(G, k, chooseDiscards(k === 0 ? G.A : G.B, G.discardDown[k]))
    }
  }
  return { result: G.result, rounds, reshuffles: [G.A.reshuffles, G.B.reshuffles], final: [snap16(G.A), snap16(G.B)] }
}

// ---- the report ------------------------------------------------------------------
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const pctile = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }

// Tally a list of games (from side 0's point of view for the win rate)
export function summarise16(games, fighters) {
  const n = games.length
  const R = { games: n, win: 0, routes: {}, lengths: [], totalRounds: 0, quiet: 0,
    outcomes: {}, neutral: [{}, {}], types: [{}, {}], plays: [{}, {}],
    guardWins: 0, guardWinsWithFollow: 0, followDmg: 0, followC: 0, follows: 0, guardWinsNoCounter: 0,
    combos: 0, comboLen: 0, comboDmg: 0, comboEnds: {}, starterWins: 0,
    statuses: {}, supers: [0, 0], burned: [0, 0], focused: [0, 0], reshuffles: [0, 0], handAfter: [[], []], sameType: 0, ties: 0 }
  for (const g of games) {
    R.win += g.result
    R.lengths.push(g.rounds.length)
    R.totalRounds += g.rounds.length
    const last = g.rounds[g.rounds.length - 1]
    const route = winRoute16(last, g.result)
    R.routes[route] = (R.routes[route] || 0) + 1
    for (const k of [0, 1]) R.reshuffles[k] += g.reshuffles?.[k] || 0
    for (const r of g.rounds) {
      if (r.quiet) R.quiet++
      R.outcomes[r.outcome] = (R.outcomes[r.outcome] || 0) + 1
      if (r.outcome === 'speed' || r.outcome === 'cancel' || r.outcome === 'tie') { R.sameType++; if (r.outcome === 'cancel') R.ties++ }
      for (const k of [0, 1]) {
        const a = r.neutral[k]
        const key = a.kind === 'neutral' ? (a.name || 'neutral card') : a.kind === 'burn' ? `burn ${a.n}` : a.kind
        R.neutral[k][key] = (R.neutral[k][key] || 0) + 1
        if (a.kind === 'burn') R.burned[k] += a.n
        if (a.kind === 'focus') R.focused[k]++
        const t = r.types[k] || '-'
        R.types[k][t] = (R.types[k][t] || 0) + 1
        if (r.cards[k]) R.plays[k][r.cards[k]] = (R.plays[k][r.cards[k]] || 0) + 1
        if (r.supers[k]) R.supers[k]++
        R.handAfter[k].push(r.after[k].hand)
        for (const s of r.statuses[k]) R.statuses[s] = (R.statuses[s] || 0) + 1
      }
      const w = r.winner
      if (w >= 0 && r.outcome === 'triangle' && r.types[w] === 'R' && r.types[1 - w] === 'P') {
        R.guardWins++
        if (!r.offered.follow) R.guardWinsNoCounter++
        if (r.follow) { R.follows++; R.followDmg += r.dmg.follow[1 - w]; if (r.follow.t === 'C') R.followC++ }
      }
      if (r.starterWon) R.starterWins++
      if (r.combo.length) {
        R.combos++
        R.comboLen += 1 + r.combo.length
        R.comboDmg += r.dmg.clash[1 - w] + r.dmg.link[1 - w] + r.dmg.end[1 - w]
        const end = r.combo.find(x => x.stage === 'end')
        const key = end ? end.name : 'no Ender'
        R.comboEnds[key] = (R.comboEnds[key] || 0) + 1
      }
    }
  }
  R.win /= Math.max(n, 1)
  R.median = median(R.lengths); R.p10 = pctile(R.lengths, 0.1); R.p90 = pctile(R.lengths, 0.9)
  R.margin = n ? 1.96 * Math.sqrt(Math.max(R.win * (1 - R.win), 0.01) / n) : 0
  R.handAvg = R.handAfter.map(a => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1))
  delete R.handAfter
  R.fighters = fighters
  return R
}

// Run n games, yielding to the page now and then so it stays responsive
export async function runBalance16(fa, fb, { n = 100, seed = 1, rules, W, levels = ['hard', 'hard'], signal, onProgress } = {}) {
  const games = []
  const rng = mulberry(seed * 7919 + 13)
  let t0 = Date.now()
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break
    const g = playGame16(fa, fb, { rules, W, levels, seed: seed * 100003 + i, rng })
    games.push(g)
    if (Date.now() - t0 > 60) { onProgress?.(i + 1); await new Promise(r => setTimeout(r, 0)); t0 = Date.now() }
  }
  onProgress?.(games.length)
  return summarise16(games, [fa, fb])
}
