// Validation and normalisation of fighter JSON (card format v2).
//
// validateFighter() returns { errors, warnings }. Errors are things the engine
// can't run or that break a fixed rule (Type Effects Are Fixed, every Convert
// chips); the editor won't save a fighter with errors. Warnings are authoring
// guidelines (8 cards, 2 of each type) that are fine to break while testing.

import { KEYWORDS, KEYWORD, BASE_FIELDS, TYPES, TYPE_CODE, PASSIVES, BEATEN_BY } from './keywords.js'

const FIGHTER_FIELDS = ['schemaVersion', 'id', 'name', 'epithet', 'concept', 'hp', 'passive', 'ai', 'cards', 'super',
                        'variantOf', 'notes']
const isInt = v => Number.isInteger(v)

function suggest(key, options) {
  // closest known field, for "did you mean" on typos
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

export function validateCard(card, { isSuper = false, hasFlow = false } = {}) {
  const errors = [], warnings = []
  const E = m => errors.push(m), W = m => warnings.push(m)
  if (!card || typeof card !== 'object') { E('Card is not an object.'); return { errors, warnings } }
  if (!card.name || typeof card.name !== 'string' || !card.name.trim()) E('Needs a name.')
  if (!TYPES.includes(card.type)) { E(`Type must be one of ${TYPES.join(', ')}.`); return { errors, warnings } }
  const t = TYPE_CODE[card.type]

  // unknown fields: the typo catcher
  const known = [...BASE_FIELDS, ...KEYWORDS.map(k => k.key)]
  for (const key of Object.keys(card)) {
    if (!known.includes(key)) {
      const s = suggest(key, known)
      E(`Unknown field "${key}"${s ? ` (did you mean "${s}"?)` : ''}. The engine would ignore it.`)
    }
  }

  const build = card.build ?? 0, chip = card.chip ?? 0
  if (!isInt(build) || build < 0) E('Build must be a whole number, 0 or more.')
  if (!isInt(chip) || chip < 0) E('Chip must be a whole number, 0 or more.')
  if (t === 'P' && build < 1) E('A Pressure must build at least 1 (Type Effects Are Fixed).')
  if (t !== 'P' && build > 0) E('Only a Pressure builds. A card that builds is a Pressure.')
  if (t === 'C' && chip < 1) E('Every Convert must print chip (minimum 1).')
  if (!isSuper) {
    const cd = card.cooldown ?? 1
    if (cd !== 1 && cd !== 2) E('Cooldown must be 1 or 2.')
  } else if (card.cooldown !== undefined && card.cooldown !== null) {
    W('A Super never goes on cooldown, so its Cooldown is ignored.')
  }
  if (card.flowCard && isSuper) E("A Super never goes on cooldown, so it can't be a Flow card.")
  if (card.flowCard && !hasFlow) W("Marked as a Flow card, but this fighter doesn't have the Flow passive.")

  for (const k of KEYWORDS) {
    const v = card[k.key]
    if (v === undefined || v === null || v === false) continue
    if (!k.types.includes(t)) { E(`"${k.label}" can't go on a ${card.type} card.`); continue }
    if (isSuper && k.superOk === false) E(`"${k.label}" does nothing on a Super, which never goes on cooldown.`)
    if (!isSuper && k.superOnly) E(`"${k.label}" is allowed only on a Super (dual verbs).`)
    if (k.needsFlow && !hasFlow) W(`"${k.label}" needs the Flow passive to ever apply.`)
    if (k.kind === 'int') {
      if (!isInt(v) || v < (k.min ?? 1) || v > (k.max ?? 99)) E(`"${k.label}" must be a whole number from ${k.min ?? 1} to ${k.max ?? 99}.`)
    } else if (k.kind === 'bool') {
      if (v !== true) E(`"${k.label}" must be true or left out.`)
    } else if (k.kind === 'type') {
      const T = TYPE_CODE[v]
      if (!T || T === 'T') E(`"${k.label}" must name pressure, convert or recover.`)
      else if (t !== 'T' && BEATEN_BY[T] === t) E(`A ${card.type} card is always beaten by a ${v}, so this stagger could never happen.`)
      else if (t !== 'T' && t !== T && BEATEN_BY[t] !== T) E('This stagger could never happen.')
    } else if (k.kind === 'pair') {
      if (typeof v !== 'object') { E(`"${k.label}" needs ${k.fields.map(f => f.key).join(' and ')}.`); continue }
      for (const f of k.fields) {
        if (!isInt(v[f.key]) || v[f.key] < f.min || v[f.key] > f.max) E(`"${k.label}": ${f.label} must be a whole number from ${f.min} to ${f.max}.`)
      }
      const extra = Object.keys(v).filter(x => !k.fields.some(f => f.key === x))
      if (extra.length) E(`"${k.label}" has unknown field${extra.length > 1 ? 's' : ''} ${extra.join(', ')}.`)
    }
  }
  if (t === 'T' && card.onLossSelf) E('A typeless card never loses, so it has no On loss.')
  // Authoring guidelines
  const isDefensiveName = /\b(block|dodge|brace|guard)\b/i.test(card.name || '')
  if (t === 'R' && chip > 0 && isDefensiveName) W('A card that sounds purely defensive never chips; a Recover that chips is a counter, and its name should say so.')
  if (t !== 'T' && chip > 4) W('Chip above 4 on a typed card is unusually high (usually 1–2).')
  return { errors, warnings }
}

export function validateFighter(f) {
  const errors = [], warnings = []
  const add = (where, r) => {
    r.errors.forEach(m => errors.push({ where, msg: m }))
    r.warnings.forEach(m => warnings.push({ where, msg: m }))
  }
  if (!f || typeof f !== 'object') return { errors: [{ where: 'Fighter', msg: 'Not a fighter object.' }], warnings }
  for (const key of Object.keys(f)) {
    if (!FIGHTER_FIELDS.includes(key)) {
      const s = suggest(key, FIGHTER_FIELDS)
      errors.push({ where: 'Fighter', msg: `Unknown field "${key}"${s ? ` (did you mean "${s}"?)` : ''}.` })
    }
  }
  if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) errors.push({ where: 'Fighter', msg: 'id must be lower-case letters, numbers and dashes.' })
  if (!f.name) errors.push({ where: 'Fighter', msg: 'Needs a name.' })
  if (!isInt(f.hp) || f.hp < 1 || f.hp > 99) errors.push({ where: 'Fighter', msg: 'HP must be a whole number from 1 to 99.' })
  let hasFlow = false
  if (f.passive) {
    for (const key of Object.keys(f.passive)) {
      if (!PASSIVES[key]) errors.push({ where: 'Passive', msg: `Unknown passive "${key}". Known: ${Object.keys(PASSIVES).join(', ')}.` })
    }
    hasFlow = !!f.passive.flow
    const rs = f.passive.risingStakes
    if (rs && (!isInt(rs.tokens) || rs.tokens < 1)) errors.push({ where: 'Passive', msg: 'Rising Stakes needs tokens (1 or more).' })
  }
  if (f.ai) {
    for (const key of Object.keys(f.ai)) if (key !== 'ownGreyValue') errors.push({ where: 'AI', msg: `Unknown AI setting "${key}".` })
    const a = f.ai.ownGreyValue
    if (a !== undefined && (typeof a !== 'number' || a < 0 || a > 2)) errors.push({ where: 'AI', msg: 'ownGreyValue must be a number from 0 to 2.' })
  }
  if (!Array.isArray(f.cards) || f.cards.length === 0) {
    errors.push({ where: 'Move list', msg: 'Needs a list of cards.' })
    return { errors, warnings }
  }
  const names = new Set()
  f.cards.forEach((c, i) => {
    add(c?.name || `Card ${i + 1}`, validateCard(c, { hasFlow }))
    if (c?.name) {
      if (names.has(c.name)) errors.push({ where: c.name, msg: 'Two cards share this name.' })
      names.add(c.name)
    }
  })
  if (f.super === null) warnings.push({ where: 'Super', msg: 'No Super. Fine for a reference fighter like the Dummy; every real fighter has one.' })
  else if (!f.super) errors.push({ where: 'Super', msg: 'Needs a Super (or "super": null for a reference fighter).' })
  else {
    add(f.super.name || 'Super', validateCard(f.super, { isSuper: true, hasFlow }))
    if (names.has(f.super.name)) errors.push({ where: f.super.name, msg: 'The Super shares a name with a card.' })
  }
  if (f.cards.length !== 8) warnings.push({ where: 'Move list', msg: `A move list is 8 cards plus a Super (this has ${f.cards.length}).` })
  for (const t of ['pressure', 'convert', 'recover']) {
    const n = f.cards.filter(c => c?.type === t).length
    if (n < 2) warnings.push({ where: 'Move list', msg: `Move lists carry at least 2 of each triangle type (${n} ${t}).` })
  }
  if (hasFlow && !f.cards.some(c => c?.flowCard)) warnings.push({ where: 'Passive', msg: 'Flow needs at least one Flow card, or she can never be flowing.' })
  return { errors, warnings }
}

// ---- engine form ---------------------------------------------------------
function engineCard(c, isSuper) {
  const kw = {}
  for (const k of KEYWORDS) {
    const v = c[k.key]
    if (v === undefined || v === null || v === false) continue
    kw[k.key] = k.kind === 'type' ? TYPE_CODE[v] : v
  }
  if (c.flowCard) kw.flowCard = true
  return {
    name: c.name, t: TYPE_CODE[c.type], build: c.build ?? 0, chip: c.chip ?? 0,
    cd: isSuper ? 0 : (c.cooldown ?? 1), sup: isSuper, kw, src: c,
  }
}

export function toEngineFighter(f) {
  const rs = f.passive?.risingStakes
  return {
    id: f.id, name: f.name, hp: f.hp,
    cards: f.cards.map(c => engineCard(c, false)),
    sup: f.super ? engineCard(f.super, true) : null,
    flow: !!f.passive?.flow,
    rising: rs ? rs.tokens : 0,
    risingCap: rs?.whilePileUnder ?? null,
    selfAlpha: f.ai?.ownGreyValue ?? null,
    src: f,
  }
}

// A short, stable fingerprint of a fighter's rules-relevant content, so game
// logs can record exactly which version of a fighter was played.
export function fighterHash(f) {
  const strip = c => { const { art, flavour, notes, ...rest } = c; return rest }
  const core = { hp: f.hp, passive: f.passive ?? null, ai: f.ai ?? null,
                 cards: f.cards.map(strip), super: f.super ? strip(f.super) : null }
  const s = stableStringify(core)
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

export { KEYWORD }
