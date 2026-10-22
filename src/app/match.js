// One match at the table: pure state transitions, no UI.
//
// Modes: 'ai' (you vs the sparring partner), 'hotseat' (two people, one
// device), 'watch' (the sparring partner against itself).
// Phases: 'pick' -> ('pass' between hot-seat picks) -> 'reveal' -> 'pick' ... 'over'

import { newPlayer, step, options, card, blocked, flowing, convertChip } from '../engine/engine.js'
import { mixes, levelMixes, LEVELS } from '../engine/ai.js'
import { roundRecord, winRoute } from '../engine/game.js'
import { toEngineFighter, fighterHash } from '../engine/fighters.js'
import { TYPE_LABEL } from '../engine/keywords.js'

// mulberry32 with its state kept in the match, so a match can be saved and resumed
export function rand(s) {
  const a = (s + 0x6D2B79F5) >>> 0
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a]
}

const HUMANS = { ai: [true, false], hotseat: [true, true], watch: [false, false] }

export function startMatch({ fighters, statuses, mode, settings, levels = ['hard', 'hard'], seed = (Math.random() * 2 ** 32) >>> 0, id }) {
  const f = fighters.map(toEngineFighter)
  const m = {
    id, mode, humans: HUMANS[mode], levels, json: fighters, statuses: statuses || ['', ''],
    f, rules: settings.rules, W: settings.ai, settingsUsed: settings,
    A: newPlayer(f[0]), B: newPlayer(f[1]),
    round: 1, picks: [null, null], phase: 'pick', picker: 0,
    history: [], result: null, seed, rng: seed, startedAt: Date.now(), mix: null,
  }
  return beginRound(m)
}

function beginRound(m) {
  const mix = mixes(m.A, m.B, m.rules, m.W)
  // the odds each sparring partner actually plays from, at its difficulty
  const play = m.humans.every(Boolean) ? [mix.x, mix.y]
    : levelMixes(mix, m.levels.map((l, k) => (m.humans[k] ? 'hard' : l)))
  let rng = m.rng
  const picks = [null, null]
  for (const side of [0, 1]) {
    if (m.humans[side]) continue
    const p = play[side]
    let r; [r, rng] = rand(rng)
    let c = 0, k = p.length - 1
    for (let i = 0; i < p.length; i++) { c += p[i]; if (r < c) { k = i; break } }
    picks[side] = (side === 0 ? mix.oa : mix.ob)[k]
  }
  const picker = m.humans[0] ? 0 : m.humans[1] ? 1 : null
  return { ...m, mix, play, rng, picks, phase: 'pick', picker }
}

// A human locks in a card
export function lockIn(m, side, pick) {
  const picks = m.picks.slice(); picks[side] = pick
  const next = { ...m, picks }
  if (picks[0] !== null && picks[1] !== null) return resolveRound(next)
  if (m.mode === 'hotseat') return { ...next, phase: 'pass', picker: side === 0 ? 1 : 0 }
  return next
}

export const continueAfterPass = m => ({ ...m, phase: 'pick' })

export function resolveRound(m) {
  const [a, b] = m.picks
  const events = []
  const s = step(m.A, m.B, a, b, m.rules, events)
  const record = roundRecord(m.round, m.A, m.B, a, b, s)
  const mixInfo = {
    a: m.mix.oa.map((o, i) => [card(m.A, o).name, round2(m.mix.x[i])]),
    b: m.mix.ob.map((o, i) => [card(m.B, o).name, round2(m.mix.y[i])]),
  }
  // what an easier sparring partner actually played from
  for (const [k, key, opts, X] of [[0, 'playedA', m.mix.oa, m.A], [1, 'playedB', m.mix.ob, m.B]]) {
    if (!m.humans[k] && m.levels[k] !== 'hard') mixInfo[key] = opts.map((o, i) => [card(X, o).name, round2(m.play[k][i])])
  }
  const entry = { ...record, picks: [a, b], events, mix: mixInfo, humans: m.humans }
  let result = s.result
  if (result === null && m.round >= m.rules.maxRounds) result = 0.5
  return {
    ...m, A: s.A, B: s.B, history: [...m.history, entry], phase: result === null ? 'reveal' : 'over',
    result, last: { before: [m.A, m.B], a, b, s, events },
  }
}

export const nextRound = m => beginRound({ ...m, round: m.round + 1, last: null })

const round2 = x => Math.round(x * 100) / 100

// ---- what the table shows -------------------------------------------------
// For each card in a player's list: whether it can be played now, and if not, why.
export function handView(X) {
  const opts = new Set(options(X))
  const bl = blocked(X)
  const lockers = {}
  for (const i of [...X.cd1, ...X.cd2]) {
    const c = X.f.cards[i]
    if (c.kw.lockout) lockers[c.t] = c.name
  }
  const why = (c, i) => {
    if (i === 'S' && !X.sup) return 'Used'
    if (X.cd1.includes(i)) return 'Cooldown · back next round'
    if (X.cd2.includes(i)) return 'Cooldown · back in 2 rounds'
    if (bl.has(c.t)) {
      if (X.tlock === c.t) return `Staggered · no ${TYPE_LABEL[c.t]} this round`
      if (lockers[c.t]) return `Locked out by ${lockers[c.t]}`
    }
    return 'Unavailable'
  }
  const list = X.f.cards.map((c, i) => ({ i, c, ok: opts.has(i), why: opts.has(i) ? null : why(c, i), space: X.cd1.includes(i) ? 1 : X.cd2.includes(i) ? 2 : 0 }))
  if (X.f.sup) list.push({ i: 'S', c: X.f.sup, ok: opts.has('S'), why: opts.has('S') ? null : why(X.f.sup, 'S'), space: 0, sup: true })
  return list
}

// Types this player can play this round
export function typesOpen(X) {
  const s = new Set(options(X).map(i => card(X, i).t))
  return ['P', 'C', 'R', 'T'].map(t => ({ t, open: s.has(t), has: [...X.f.cards, ...(X.sup ? [X.f.sup] : [])].some(c => c.t === t) }))
}

// The rules' lethal check: you're dead to a Convert when your pile + its chip >= your HP.
export function lethalTo(X, Y) {
  let best = null
  for (const i of options(Y)) {
    const c = card(Y, i)
    if (c.t === 'C') { const v = convertChip(c, Y, X.pile); if (best === null || v > best) best = v }
  }
  return best !== null && X.pile + best >= X.hp ? best : null
}

export { flowing, LEVELS }

// ---- the log entry -------------------------------------------------------
export function gameRecord(m) {
  const last = m.history[m.history.length - 1]
  return {
    id: m.id, v: 2,
    startedAt: m.startedAt, finishedAt: Date.now(),
    mode: m.mode, humans: m.humans, levels: m.levels,
    fighters: m.json.map((j, k) => ({ id: j.id, name: j.name, hash: fighterHash(j), status: m.statuses[k], json: j })),
    settings: m.settingsUsed,
    result: m.result, route: last ? winRoute(last, m.result) : null,
    rounds: m.history.map(({ events, humans, ...r }) => r),
    final: [{ hp: m.A.hp, pile: m.A.pile }, { hp: m.B.hp, pile: m.B.pile }],
  }
}

// Rebuild a match from its record of picks (after the page reloads)
export function replay(saved) {
  let m = startMatch({ fighters: saved.json, statuses: saved.statuses, mode: saved.mode, levels: saved.levels,
                       settings: saved.settingsUsed, seed: saved.seed, id: saved.id })
  m = { ...m, startedAt: saved.startedAt }
  for (const [a, b] of saved.picks) {
    m = resolveRound({ ...m, picks: [a, b] })
    if (m.phase === 'over') return m
    m = nextRound(m)
  }
  return { ...m, rng: saved.rng }
}

export function snapshot(m) {
  return { id: m.id, mode: m.mode, levels: m.levels, json: m.json, statuses: m.statuses, settingsUsed: m.settingsUsed,
           seed: m.seed, rng: m.rng, startedAt: m.startedAt, picks: m.history.map(h => h.picks) }
}
