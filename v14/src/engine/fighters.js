// Validation and compilation of rules v14 fighter files (card format v4).
//
// validateFighter() returns { errors, warnings }. Errors are things the engine
// can't run or that break a rule; the editor won't save a fighter with errors.
// Warnings are guidelines from rules-overview 14.md (one card of each type,
// every attack chips) that are fine to break while testing.

import { TYPES, TYPE_CODE, CODES, TYPE_LABEL } from './rules.js'

const FIGHTER_FIELDS = ['schemaVersion', 'rules', 'id', 'name', 'epithet', 'concept', 'hp', 'cards', 'variantOf', 'notes']
const CARD_FIELDS = ['name', 'type', 'grey', 'chip', 'cooldown', 'art', 'notes']
export const MAX_CARDS = 12
const isInt = v => Number.isInteger(v)

function suggest(key, options) {
  let best = null, bestD = 4
  for (const o of options) {
    const d = lev(key.toLowerCase(), o.toLowerCase())
    if (d < bestD) { bestD = d; best = o }
  }
  return best
}
function lev(a, b) {
  const m = a.length, n = b.length, dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[m][n]
}

export function validateCard(card) {
  const errors = [], warnings = []
  const E = m => errors.push(m), W = m => warnings.push(m)
  if (!card || typeof card !== 'object' || Array.isArray(card)) { E('Card is not an object.'); return { errors, warnings } }
  for (const key of Object.keys(card)) {
    if (!CARD_FIELDS.includes(key)) {
      const s = suggest(key, CARD_FIELDS)
      E(`Unknown field "${key}"${s ? ` (did you mean "${s}"?)` : ''}. The engine would ignore it.`)
    }
  }
  if (!card.name || typeof card.name !== 'string' || !card.name.trim()) E('Needs a name.')
  if (!TYPES.includes(card.type)) { E('Type must be strike, heavy, grab, focus or block.'); return { errors, warnings } }
  const t = TYPE_CODE[card.type]
  const cd = card.cooldown ?? 1
  if (cd !== 1 && cd !== 2) E('Cooldown must be 1 or 2.')
  if (t === 'S') {
    if (!isInt(card.grey) || card.grey < 0 || card.grey > 20) E('A Strike needs grey: a whole number from 0 to 20.')
  } else if (card.grey !== undefined) E(`Only Strikes print grey. A ${TYPE_LABEL[t]} ${t === 'F' || t === 'B' ? "doesn't" : 'cashes the pile instead'}.`)
  if (t === 'S' || t === 'H' || t === 'G') {
    if (!isInt(card.chip) || card.chip < 0 || card.chip > 20) E(`A ${TYPE_LABEL[t]} needs chip: a whole number from 0 to 20.`)
    else if (card.chip < 1) W('Every Strike, Heavy and Grab chips at least 1: grey alone can be cleared away, and a chipless attack stalled games in the rough check.')
  } else if (card.chip !== undefined) E(`A ${TYPE_LABEL[t]} never deals damage: remove its chip.`)
  for (const k of ['art', 'notes']) if (card[k] !== undefined && typeof card[k] !== 'string') E(`"${k}" must be text.`)
  return { errors, warnings }
}

export function validateFighter(f) {
  const errors = [], warnings = []
  const E = (where, msg) => errors.push({ where, msg }), W = (where, msg) => warnings.push({ where, msg })
  if (!f || typeof f !== 'object' || Array.isArray(f)) { E('Fighter', 'Not an object.'); return { errors, warnings } }
  for (const key of Object.keys(f)) {
    if (!FIGHTER_FIELDS.includes(key)) {
      const s = suggest(key, FIGHTER_FIELDS)
      E('Fighter', `Unknown field "${key}"${s ? ` (did you mean "${s}"?)` : ''}.`)
    }
  }
  if (f.rules !== 14) E('Fighter', 'This table plays rules v14 only: set "rules": 14. Older fighters play in the v13 or v11/v12 apps.')
  if (typeof f.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(f.id)) E('Fighter', 'id must be lower-case letters, digits and hyphens.')
  if (!f.name || typeof f.name !== 'string' || !f.name.trim()) E('Fighter', 'Needs a name.')
  if (!isInt(f.hp) || f.hp < 1 || f.hp > 99) E('Fighter', 'HP must be a whole number from 1 to 99.')
  if (!Array.isArray(f.cards) || f.cards.length === 0) { E('Fighter', 'Needs a list of cards.'); return { errors, warnings } }
  if (f.cards.length > MAX_CARDS) E('Fighter', `At most ${MAX_CARDS} cards.`)
  if (f.cards.length < 3) E('Fighter', 'At least 3 cards, so there is always one to play: up to two can be cooling down at once.')
  const names = new Set()
  f.cards.forEach((c, i) => {
    const where = c?.name || `Card ${i + 1}`
    const v = validateCard(c)
    v.errors.forEach(m => E(where, m))
    v.warnings.forEach(m => W(where, m))
    if (c?.name) {
      const n = c.name.trim().toLowerCase()
      if (names.has(n)) E(where, 'Two cards share this name.')
      names.add(n)
    }
  })
  if (errors.length) return { errors, warnings }
  // guidelines (rules-overview 14.md)
  const count = t => f.cards.filter(c => TYPE_CODE[c.type] === t).length
  for (const t of CODES) {
    const n = count(t)
    if (!n) W('Fighter', `No ${TYPE_LABEL[t]}. The base game gives every fighter one card of each type, so the opponent never has to fear what a ${TYPE_LABEL[t]} beats.`)
    else if (n > 1) W('Fighter', `${n} ${TYPE_LABEL[t]}s. The base game has one of each type. More is a layer: a type that's almost always available removes "it's cooling down" as a tell, and an always-available Strike stalled games in the rough check.`)
  }
  const cd2 = f.cards.filter(c => (c.cooldown ?? 1) === 2).length
  if (cd2 > 2) W('Fighter', `${cd2} cards on Cooldown 2. With five cards it's a big lever: the guidelines use it on one or two at most.`)
  return { errors, warnings }
}

// ---- the engine's compiled form -----------------------------------------------
export function toEngineFighter(f) {
  const cards = f.cards.map((c, i) => ({
    i, name: c.name, t: TYPE_CODE[c.type],
    grey: c.grey ?? 0, chip: c.chip ?? 0, cd: c.cooldown ?? 1,
    src: c,
  }))
  const mask = pred => cards.reduce((m, c) => (pred(c) ? m | (1 << c.i) : m), 0)
  return {
    id: f.id, name: f.name, hp: f.hp, cards,
    all: mask(() => true),
    byType: Object.fromEntries(CODES.map(t => [t, mask(c => c.t === t)])),
    src: f,
  }
}

// A short, stable fingerprint of a fighter's rules-relevant content, so game
// logs can record exactly which version of a fighter was played.
export function fighterHash(f) {
  const strip = c => { const { art, notes, ...rest } = c; return rest }
  const s = stableStringify({ hp: f.hp, cards: f.cards.map(strip) })
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return h.toString(36)
}

export function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}
