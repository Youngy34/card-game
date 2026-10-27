// Validation and compilation of rules v13 fighter files (card format v3).
//
// validateFighter() returns { errors, warnings }. Errors are things the engine
// can't run or that break a rule (a throw can't be a linker, every strike needs
// an on-block value); the editor won't save a fighter with errors. Warnings are
// authoring guidelines from the rules (at least 2 enders, every direction
// covered) that are fine to break while testing.

import { DIRECTIONS, DIR_CODE, STRENGTHS, STR_CODE, ON_BLOCK, UNIVERSAL } from './rules.js'

const FIGHTER_FIELDS = ['schemaVersion', 'rules', 'id', 'name', 'epithet', 'concept', 'hp', 'cards', 'variantOf', 'notes']
const CARD_FIELDS = ['name', 'direction', 'speed', 'hit', 'onBlock', 'linker', 'ender', 'grey', 'bonus', 'keepInitiative',
                     'cooldown', 'art', 'notes']
export const MAX_CARDS = 16
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
  else if (Object.values(UNIVERSAL).some(u => u.name.toLowerCase() === card.name.trim().toLowerCase())) E(`"${card.name}" is a universal card's name.`)
  if (!DIRECTIONS.includes(card.direction)) { E('Direction must be horizontal, vertical or throw.'); return { errors, warnings } }
  const isThrow = card.direction === 'throw'
  if (!isInt(card.speed) || card.speed < 1 || card.speed > 10) E('Speed must be a whole number from 1 to 10 (higher is faster).')
  if (!isInt(card.hit) || card.hit < 0 || card.hit > 20) E('Hit must be a whole number from 0 to 20.')
  const cd = card.cooldown ?? 1
  if (cd !== 1 && cd !== 2) E('Cooldown must be 1 or 2.')

  if (isThrow) {
    if (card.onBlock !== undefined) E('Throws have no on-block value: Guard never blocks a throw.')
    if (card.linker !== undefined || card.ender !== undefined) E("Throws can't be linkers or enders.")
    if (card.grey !== undefined && (!isInt(card.grey) || card.grey < 0)) E('Grey must be a whole number, 0 or more.')
    if (card.speed > 5) W(`A fast throw (Speed ${card.speed}) beats Guard and slow strikes. The guidelines keep throws mostly at Speed 2–5, with fast ones as signature cards.`)
  } else {
    if (!(card.onBlock in ON_BLOCK)) E('Strikes need an on-block value: "+", "=" or "-".')
    if (card.linker !== undefined && card.ender !== undefined) E('One combo role per card: a linker or an ender, not both.')
    if (card.linker !== undefined) {
      if (!STRENGTHS.includes(card.linker)) E('A linker\'s strength must be light, medium or heavy.')
      if (!isInt(card.grey) || card.grey < 1) E('A linker needs grey: a whole number, 1 or more.')
    } else if (card.grey !== undefined) E('Only linkers and throws put grey on the pile. Make it a linker or remove the grey.')
    if (card.ender !== undefined && card.ender !== true) E('"ender" must be true or left out.')
  }
  if (card.ender !== true) {
    if (card.bonus !== undefined) E('Bonus damage only goes on an ender.')
    if (card.keepInitiative !== undefined) E('Keeping the initiative only goes on an ender.')
  } else {
    if (card.bonus !== undefined && (!isInt(card.bonus) || card.bonus < 0)) E('Bonus must be a whole number, 0 or more.')
    if (card.keepInitiative !== undefined && card.keepInitiative !== true) E('"keepInitiative" must be true or left out.')
  }
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
  if (f.rules !== 13) E('Fighter', 'This table plays rules v13 only: set "rules": 13. Older fighters play in the v11/v12 app.')
  if (typeof f.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(f.id)) E('Fighter', 'id must be lower-case letters, digits and hyphens.')
  if (!f.name || typeof f.name !== 'string' || !f.name.trim()) E('Fighter', 'Needs a name.')
  if (!isInt(f.hp) || f.hp < 1 || f.hp > 99) E('Fighter', 'HP must be a whole number from 1 to 99.')
  if (!Array.isArray(f.cards) || f.cards.length === 0) { E('Fighter', 'Needs a list of cards.'); return { errors, warnings } }
  if (f.cards.length > MAX_CARDS) E('Fighter', `At most ${MAX_CARDS} cards.`)
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
  // guidelines (rules-overview 13.md, Design Guidelines)
  const cards = f.cards
  const enders = cards.filter(c => c.ender).length, linkers = cards.filter(c => c.linker).length
  if (!linkers) W('Fighter', "No linkers: this fighter's combos can never reach an ender, so every hit is just the opener.")
  if (enders < 2) W('Fighter', `${enders} ender${enders === 1 ? '' : 's'}. The guidelines ask for at least 2, so opening with one doesn't strand a combo.`)
  for (const d of DIRECTIONS) if (!cards.some(c => c.direction === d)) W('Fighter', `No ${d} cards, so one defence never has to worry about this fighter.`)
  if (cards.length < 6 || cards.length > 11) W('Fighter', `${cards.length} cards. The guidelines aim for around 8–10 fighter cards.`)
  return { errors, warnings }
}

// ---- the engine's compiled form -----------------------------------------------
export function toEngineFighter(f) {
  const cards = f.cards.map((c, i) => {
    const dir = DIR_CODE[c.direction]
    return {
      i, name: c.name, dir, speed: c.speed, hit: c.hit,
      ob: dir === 'T' ? null : ON_BLOCK[c.onBlock],
      link: c.linker ? STR_CODE[c.linker] : null,
      ender: c.ender === true,
      grey: c.grey ?? 0, bonus: c.bonus ?? 0, keep: c.keepInitiative === true,
      cd: c.cooldown ?? 1,
      src: c,
    }
  })
  const mask = pred => cards.reduce((m, c) => (pred(c) ? m | (1 << c.i) : m), 0)
  return {
    id: f.id, name: f.name, hp: f.hp, cards,
    all: mask(() => true),
    linkers: mask(c => !!c.link), enders: mask(c => c.ender),
    dirs: { H: mask(c => c.dir === 'H'), V: mask(c => c.dir === 'V'), T: mask(c => c.dir === 'T') },
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
