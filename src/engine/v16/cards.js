// Rules v16 cards: the card format, its validation and its card text.
//
// v16 (rules-overview 16.md) plays from a shuffled deck. A fighter file lists
// each distinct card once with its number of `copies`; the Super sits beside
// the deck. Types: pressure, convert, recover, neutral. Internally the engine
// uses one-letter codes: P, C, R, N.
//
// A card:
//   { "name": "Sweep", "type": "pressure", "kind": "strike", "speed": 13,
//     "build": 3, "chip": 0, "copies": 2, "icons": ["ender"], "onHit": "knockdown" }

export const TYPES16 = ['pressure', 'convert', 'recover', 'neutral']
export const T16 = { pressure: 'P', convert: 'C', recover: 'R', neutral: 'N' }
export const TYPE16 = { P: 'pressure', C: 'convert', R: 'recover', N: 'neutral' }
export const LABEL16 = { P: 'Pressure', C: 'Convert', R: 'Recover', N: 'Neutral' }
export const BEATS16 = new Set(['PC', 'CR', 'RP'])           // winner + loser

export const KINDS16 = {
  strike: { t: 'P', label: 'Strike' },
  projectile: { t: 'P', label: 'Projectile' },
  guardBreak: { t: 'C', label: 'Guard Break' },
  grab: { t: 'C', label: 'Grab' },
  guard: { t: 'R', label: 'Guard' },
}
export const KINDS_OF16 = { P: ['strike', 'projectile'], C: ['guardBreak', 'grab'], R: ['guard'], N: [] }
export const SPEED_BAND16 = { P: [11, 20], C: [1, 10] }

// Combo and follow-up icons, printed on attacks
export const ICONS = {
  starter: { label: 'Starter', short: 'S', line: 'Starter: if it wins its clash, you may combo (a Linker, then an Ender).' },
  linker: { label: 'Linker', short: 'L', line: 'Linker: can be played second in a combo.' },
  ender: { label: 'Ender', short: 'E', line: 'Ender: can end a combo.' },
  counter: { label: 'Counter', short: 'Ct', line: 'Counter: can be the follow-up after your Guard beats a Pressure.' },
}
export const ICON_ORDER = ['starter', 'linker', 'ender', 'counter']

// Statuses last through the target's next round
export const STATUSES = {
  knockdown: { label: 'Knockdown', line: 'skips the neutral phase next round' },
  staggered: { label: 'Staggered', line: 'has −3 speed on their attacks next round' },
  dizzy: { label: 'Dizzy', line: 'plays no card next round: a free hit' },
}
export const LOCKABLE = { pressure: 'P', convert: 'C', recover: 'R' }

// Neutral-card effects that last this round (follow-ups and combos included)
export const THIS_ROUND = {
  convertChip: { label: 'Converts chip', line: n => `This round, your Converts chip +${n}.` },
  pressureBuild: { label: 'Pressures build', line: n => `This round, your Pressures build +${n}.` },
  attackChip: { label: 'Attacks chip', line: n => `This round, your attacks chip +${n}.` },
  speed: { label: 'Attack speed', line: n => `This round, your attacks are +${n} speed.` },
}

export const BASE_FIELDS16 = ['name', 'type', 'kind', 'speed', 'build', 'chip', 'copies', 'icons', 'onHit', 'cost', 'onLossSelf', 'meter', 'thisRound', 'art', 'flavour', 'notes']

const isInt = v => Number.isInteger(v)
const statusName = s => (typeof s === 'string' ? STATUSES[s]?.label : s && s.lock ? `Lock ${LABEL16[LOCKABLE[s.lock]]}` : null)

// The status a card inflicts (or costs), as text
export function statusText(s, self = false) {
  if (!s) return null
  if (typeof s === 'string') return self ? `you're ${STATUSES[s].label.toLowerCase()}` : STATUSES[s].label
  if (s.lock) return self ? `Lock your ${LABEL16[LOCKABLE[s.lock]]}s` : `Lock ${LABEL16[LOCKABLE[s.lock]]}`
  return null
}

// Card text lines, written from the card's fields
export function cardLines16(c, { isSuper = false } = {}) {
  const text = [], cost = []
  const t = T16[c.type]
  if (t === 'R') text.push('If it beats a Pressure, you may follow up with a Counter from your hand.')
  if (c.thisRound) for (const [k, v] of Object.entries(c.thisRound)) if (THIS_ROUND[k] && v) text.push(THIS_ROUND[k].line(v))
  if (c.onHit) text.push(typeof c.onHit === 'string' ? `On hit: ${STATUSES[c.onHit]?.label}.` : `On hit: ${statusText(c.onHit)} (no ${LABEL16[LOCKABLE[c.onHit.lock]]}s for them next round).`)
  if (isSuper && c.meter) cost.push(`${c.meter} meter.`)
  if (c.cost) cost.push(typeof c.cost === 'string' ? `Next round, you're ${STATUSES[c.cost]?.label}.` : `Next round, you can't play a ${LABEL16[LOCKABLE[c.cost.lock]]}.`)
  if (c.onLossSelf) cost.push(`On loss: add ${c.onLossSelf} token${c.onLossSelf > 1 ? 's' : ''} to your own pile.`)
  return { text, cost }
}

function validStatus(s, E, where) {
  if (typeof s === 'string') { if (!STATUSES[s]) E(`${where} must be knockdown, staggered, dizzy, or { "lock": "pressure" | "convert" | "recover" }.`); return }
  if (!s || typeof s !== 'object' || !LOCKABLE[s.lock] || Object.keys(s).length !== 1) E(`${where} must be knockdown, staggered, dizzy, or { "lock": "pressure" | "convert" | "recover" }.`)
}

export function validateCard16(c, { isSuper = false } = {}) {
  const errors = [], warnings = []
  const E = m => errors.push(m), W = m => warnings.push(m)
  if (!c || typeof c !== 'object') { E('Card is not an object.'); return { errors, warnings } }
  if (!c.name || typeof c.name !== 'string') E('Needs a name.')
  const t = T16[c.type]
  if (!t) { E('Type must be pressure, convert, recover or neutral.'); return { errors, warnings } }
  for (const k of Object.keys(c)) if (!BASE_FIELDS16.includes(k)) E(`Unknown field "${k}".`)
  if (isSuper && t === 'N') E('A Super must be an attack or a Recover.')
  if (!isSuper) { if (!isInt(c.copies) || c.copies < 1 || c.copies > 8) E('copies must be a whole number from 1 to 8.') }
  else if (c.copies !== undefined) E('A Super has no copies: it sits beside your deck.')
  if (t !== 'N') {
    if (!KINDS16[c.kind] || KINDS16[c.kind].t !== t) E(`Kind must be ${KINDS_OF16[t].join(' or ')} for a ${c.type}.`)
  } else if (c.kind !== undefined) E('Neutral cards have no kind.')
  const band = SPEED_BAND16[t]
  if (band) {
    const top = isSuper ? 20 : band[1] - (t === 'P' ? 1 : 0)
    if (!isInt(c.speed) || c.speed < band[0] || c.speed > (isSuper ? band[1] : top)) E(`Speed must be ${band[0]}–${isSuper ? band[1] : top}${t === 'P' && !isSuper ? ' (20 is kept for Supers)' : ''}.`)
  } else if (c.speed !== undefined) E('Only attacks have a speed.')
  if (t === 'P') { if (!isInt(c.build) || c.build < 1) E('A Pressure needs a Build of at least 1.') }
  else if (c.build) E('Only Pressures build.')
  if (c.chip !== undefined && (!isInt(c.chip) || c.chip < 0)) E('chip must be 0 or more.')
  if (t === 'C' && !(c.chip >= 1)) E('Every Convert chips (chip 1 or more).')
  if ((t === 'R' || t === 'N') && c.chip) { if (isSuper && t === 'R') W('A Recover Super that deals damage is a second verb (allowed on Supers).'); else E(`A ${t === 'R' ? 'Recover' : 'neutral card'} never deals damage.`) }
  if (c.icons !== undefined) {
    if (!Array.isArray(c.icons) || c.icons.some(i => !ICONS[i])) E('icons must be a list of starter, linker, ender, counter.')
    else if (t === 'R' || t === 'N') E('Only attacks carry combo icons.')
  }
  if (c.onHit !== undefined) { validStatus(c.onHit, E, 'onHit'); if (t === 'N') E('A neutral card never hits.'); if (c.onHit === 'dizzy' && !isSuper) E('Dizzy only appears on Supers.') }
  if (c.cost !== undefined) validStatus(c.cost, E, 'cost')
  if (c.onLossSelf !== undefined && (!isInt(c.onLossSelf) || c.onLossSelf < 1)) E('onLossSelf must be 1 or more.')
  if (c.meter !== undefined) { if (!isSuper) E('Only a Super costs meter.'); else if (!isInt(c.meter) || c.meter < 1 || c.meter > 5) E('meter must be 1–5.') }
  if (c.thisRound !== undefined) {
    if (t !== 'N') E('Only neutral cards have this-round effects.')
    else if (!c.thisRound || typeof c.thisRound !== 'object' || Object.keys(c.thisRound).some(k => !THIS_ROUND[k] || !isInt(c.thisRound[k]) || c.thisRound[k] < 1)) E(`thisRound takes ${Object.keys(THIS_ROUND).join(', ')}, each a whole number of 1 or more.`)
  } else if (t === 'N') W('This neutral card does nothing.')
  return { errors, warnings }
}

export function validateFighter16(f) {
  const errors = [], warnings = []
  const add = (where, r) => { r.errors.forEach(msg => errors.push({ where, msg })); r.warnings.forEach(msg => warnings.push({ where, msg })) }
  if (!f || typeof f !== 'object') return { errors: [{ where: 'Fighter', msg: 'Not an object.' }], warnings }
  if (f.rules !== 16) errors.push({ where: 'Fighter', msg: 'rules must be 16.' })
  if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) errors.push({ where: 'Fighter', msg: 'id must be lower-case letters, numbers and dashes.' })
  if (!f.name) errors.push({ where: 'Fighter', msg: 'Needs a name.' })
  if (!isInt(f.hp) || f.hp < 1 || f.hp > 99) errors.push({ where: 'Fighter', msg: 'HP must be a whole number from 1 to 99.' })
  if (f.passive) errors.push({ where: 'Fighter', msg: 'Passives aren\'t supported under rules v16 yet.' })
  if (!Array.isArray(f.cards) || !f.cards.length) { errors.push({ where: 'Deck', msg: 'Needs cards.' }); return { errors, warnings } }
  const names = new Set()
  f.cards.forEach((c, i) => {
    add(c?.name || `Card ${i + 1}`, validateCard16(c))
    if (c?.name) { if (names.has(c.name)) errors.push({ where: c.name, msg: 'Two cards share this name.' }); names.add(c.name) }
  })
  if (f.super === null) warnings.push({ where: 'Super', msg: 'No Super.' })
  else if (!f.super) errors.push({ where: 'Super', msg: 'Needs a Super (or "super": null).' })
  else {
    add(f.super.name || 'Super', validateCard16(f.super, { isSuper: true }))
    if (names.has(f.super.name)) errors.push({ where: f.super.name, msg: 'The Super shares a name with a card.' })
  }
  const size = deckSize(f)
  if (size < 12 || size > 40) errors.push({ where: 'Deck', msg: `A deck is 12–40 cards (this has ${size}).` })
  const counters = f.cards.reduce((s, c) => s + ((c?.icons || []).includes('counter') ? c.copies || 0 : 0), 0)
  if (size && counters / size < 0.25) warnings.push({ where: 'Deck', msg: `${counters} Counters in ${size} cards: the rules ask for at least 6 in 24, so a Guard usually has a punish.` })
  for (const t of ['P', 'C', 'R']) if (!f.cards.some(c => T16[c?.type] === t)) warnings.push({ where: 'Deck', msg: `No ${LABEL16[t]}s.` })
  return { errors, warnings }
}

export const deckSize = f => (f.cards || []).reduce((s, c) => s + (isInt(c?.copies) ? c.copies : 0), 0)

// ---- engine form -----------------------------------------------------------
function norm(c, isSuper) {
  const icons = new Set(c.icons || [])
  return {
    name: c.name, t: T16[c.type], kind: c.kind || null, speed: c.speed ?? null,
    build: c.build ?? 0, chip: c.chip ?? 0, copies: isSuper ? 0 : c.copies,
    starter: icons.has('starter'), linker: icons.has('linker'), ender: icons.has('ender'), counter: icons.has('counter'),
    onHit: c.onHit ?? null, cost: c.cost ?? null, onLossSelf: c.onLossSelf ?? 0,
    meter: isSuper ? (c.meter ?? 3) : 0, thisRound: c.thisRound ?? null,
    sup: isSuper, src: c,
  }
}

// A fighter ready for the engine: distinct cards, and the deck as a list of card indices
export function toFighter16(f) {
  const cards = f.cards.map(c => norm(c, false))
  const deck = []
  cards.forEach((c, i) => { for (let k = 0; k < c.copies; k++) deck.push(i) })
  return { id: f.id, name: f.name, hp: f.hp, v16: true, cards, sup: f.super ? norm(f.super, true) : null, deck, ai: f.ai || null }
}
