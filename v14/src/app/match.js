// One match at the table: pure state transitions, no UI.
//
// Modes: 'ai' (you vs the sparring partner), 'hotseat' (two people, one
// device), 'watch' (the sparring partner against itself).
// Phases: 'pick' -> ('pass' between hot-seat picks) -> 'reveal' -> 'pick' ... 'over'

import { newGame, reveal, options, player, label, missingTypes } from '../engine/engine.js'
import { newContext, mixes, levelMixes, sampleIndex, LEVELS } from '../engine/ai.js'
import { revealRecord, winRoute, playCode } from '../engine/game.js'
import { toEngineFighter, fighterHash } from '../engine/fighters.js'

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
    f, settingsUsed: settings, ctx: newContext(settings.ai),
    G: newGame(f[0], f[1], settings.rules),
    picks: [null, null], phase: 'pick', picker: 0,
    history: [], actions: [], result: null, seed, rng: seed, startedAt: Date.now(), last: null,
  }
  return beginReveal(m)
}

function beginReveal(m) {
  const mix = mixes(m.G, m.ctx)
  const play = m.humans.every(Boolean) ? [mix.x, mix.y]
    : levelMixes(mix, m.levels.map((l, k) => (m.humans[k] ? 'hard' : l)))
  let rng = m.rng
  const picks = [null, null]
  for (const side of [0, 1]) {
    if (m.humans[side]) continue
    let r; [r, rng] = rand(rng)
    picks[side] = (side === 0 ? mix.oa : mix.ob)[sampleIndex(play[side], r)]
  }
  const picker = m.humans[0] ? 0 : m.humans[1] ? 1 : null
  return { ...m, mix, play, rng, picks, phase: 'pick', picker }
}

// A person locks in a card
export function lockIn(m, side, pick) {
  if (!options(m.G, side).includes(pick)) throw new Error("That card can't be played now.")
  const picks = m.picks.slice(); picks[side] = pick
  const next = { ...m, picks }
  if (picks[0] !== null && picks[1] !== null) return resolveReveal(next)
  if (m.mode === 'hotseat') return { ...next, phase: 'pass', picker: side === 0 ? 1 : 0 }
  return next
}

export const continueAfterPass = m => ({ ...m, phase: 'pick' })

export function resolveReveal(m) {
  const [a, b] = m.picks
  return settle(m, a, b, reveal(m.G, a, b))
}

function settle(m, a, b, r) {
  const record = revealRecord(m.G, r.ev, r.G)
  const opts = side => (side === 0 ? m.mix.oa : m.mix.ob)
  const row = (side, p) => opts(side).map((o, i) => [label(m.G, side, o), round2(p[i]), playCode(m.G, side, o)])
  const mixInfo = { a: row(0, m.mix.x), b: row(1, m.mix.y) }
  for (const [k, key] of [[0, 'playedA'], [1, 'playedB']]) {
    if (!m.humans[k] && m.levels[k] !== 'hard') mixInfo[key] = row(k, m.play[k])
  }
  const entry = { ...record, mix: mixInfo }
  return {
    ...m, G: r.G, history: [...m.history, entry], actions: [...m.actions, [a, b]],
    phase: r.G.over ? 'over' : 'reveal', result: r.G.over ? r.G.result : null,
    last: { G0: m.G, ev: r.ev, N: r.G },
  }
}

export const nextReveal = m => beginReveal({ ...m, last: null })

const round2 = x => Math.round(x * 100) / 100

// ---- what the table shows -------------------------------------------------------
// The cards a player sees this reveal, playable or not, and why not.
export function handView(m, side) {
  const X = player(m.G, side)
  const opts = new Set(options(m.G, side))
  return X.f.cards.map(c => {
    const ok = opts.has(c.i)
    const why = ok ? null : (X.cd1 >> c.i) & 1 ? 'Cooldown · back next reveal' : 'Cooldown · back in 2 reveals'
    return { id: c.i, card: c.src, t: c.t, ok, why }
  })
}

export const missing = (m, side) => missingTypes(player(m.G, side))

export { LEVELS }

// ---- the log entry -----------------------------------------------------------------
export function gameRecord(m) {
  const last = m.history[m.history.length - 1]
  return {
    id: m.id, v: 4, rules: 14,
    startedAt: m.startedAt, finishedAt: Date.now(),
    mode: m.mode, humans: m.humans, levels: m.levels,
    fighters: m.json.map((j, k) => ({ id: j.id, name: j.name, hash: fighterHash(j), status: m.statuses[k], json: j })),
    settings: m.settingsUsed,
    result: m.result, route: winRoute(last, m.result),
    reveals: m.history.map(({ mix, ...r }) => r),
    final: [{ hp: m.G.A.hp, pile: m.G.A.pile }, { hp: m.G.B.hp, pile: m.G.B.pile }],
  }
}

// Rebuild a match from its recorded actions (after the page updates)
export function replay(saved) {
  let m = startMatch({ fighters: saved.json, statuses: saved.statuses, mode: saved.mode, levels: saved.levels,
                       settings: saved.settingsUsed, seed: saved.seed, id: saved.id })
  m = { ...m, startedAt: saved.startedAt }
  for (const [a, b] of saved.actions) {
    m = settle({ ...m, picks: [a, b] }, a, b, reveal(m.G, a, b))
    if (m.phase === 'over') return m
    m = nextReveal(m)
  }
  return { ...m, rng: saved.rng }
}

export function snapshot(m) {
  return { id: m.id, mode: m.mode, levels: m.levels, json: m.json, statuses: m.statuses, settingsUsed: m.settingsUsed,
           seed: m.seed, rng: m.rng, startedAt: m.startedAt, actions: m.actions }
}
