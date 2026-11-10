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

// Rules v20 (heat): the page's vocabulary. useHeatWords() is called once at start on a heat page: the types
// read Pressure, Break and Guard (kinds: Heavy and Grab; Block), and card text prices specials and the Super in heat.
export const TEXT16 = { heat: null }
export function useHeatWords(rules) {
  TEXT16.heat = { special: rules.specialCost ?? 3, guardsQuiet: !!rules.guardsQuiet, charge: rules.words === 'charge' }
  Object.assign(LABEL16, { C: 'Break', R: 'Guard' })
  KINDS16.guardBreak.label = 'Heavy'
  KINDS16.guard.label = 'Block'
}

// The name of that power. It was heat on the v20 page and the first v21 page; since 10 Nov (Mark) it is Charge
// (rules.words: 'charge'): you're Fully Charged at your cap, a Break discharges it, a Guard drains it, and Charge
// built past the cap overloads as damage. hw(heat words, Charge words) picks the page's; HN() is the bare noun.
export const hw = (heat, charge) => (TEXT16.heat?.charge ? charge : heat)
export const HN = () => hw('heat', 'Charge')

// Combo and follow-up icons, printed on attacks
export const ICONS = {
  starter: { label: 'Starter', short: 'S', line: 'Starter: if it wins its clash, you may combo: a Linker carries it on, an Ender ends it.' },
  linker: { label: 'Linker', short: 'L', line: 'Linker: carries a combo on, after the Starter.' },
  ender: { label: 'Ender', short: 'E', line: 'Ender: ends a combo, straight after the Starter or after a Linker.' },
  counter: { label: 'Counter', short: 'Ct', line: 'Counter: can be the follow-up after your Guard beats a Pressure.' },
}
export const ICON_ORDER = ['starter', 'linker', 'ender', 'counter']
// Safe (rules v18, 6 Nov): a card property shown with the icons
export const SAFE_LINE = 'Safe: if a Guard beats this, it gets no follow-up.'
// Twin (rules v18, 8 Nov, Vex): a Linker that a second copy of itself can follow in a combo
export const twinLine = name => `Twin: in a combo, a second ${name} can follow this one.`

// Statuses last through the target's next round
export const STATUSES = {
  knockdown: { label: 'Knockdown', line: 'skips the neutral phase next round (v18: loses every speed clash next round)' },
  staggered: { label: 'Staggered', line: 'has −3 speed on their attacks next round' },
  dizzy: { label: 'Dizzy', line: 'plays no card next round: a free hit' },
}
export const LOCKABLE = { pressure: 'P', convert: 'C', recover: 'R' }

// Neutral-card effects that last this round (follow-ups and combos included)
export const THIS_ROUND = {
  convertChip: { label: 'Converts chip', line: n => `This round, your Converts chip +${n}.` },
  pressureBuild: { label: 'Pressures build', line: n => `This round, your Pressures build +${n}.` },
  pressureChip: { label: 'Pressures chip', line: n => `This round, your Pressures chip +${n}.` },
  attackChip: { label: 'Attacks chip', line: n => `This round, your attacks chip +${n}.` },
  speed: { label: 'Attack speed', line: n => `This round, your attacks are +${n} speed.` },
  armor: { label: 'Armor', line: () => 'This round, your Converts (not your Super) also beat Pressures.' },
  mixup: { label: 'Mix-Up', line: () => 'This round, your Pressures (not your Super) also beat Guards.' },
  parry: { label: 'Parry', line: () => 'This round, if your Guard beats a Pressure, your follow-up can be any attack, and it can start a combo.' },
  grabConfiscate: { label: 'Grabs Confiscate', line: () => 'This round, your Grabs Confiscate on hit.' },
}
// Neutral-card effects at the start of the clash step (after every On reveal effect)
export const AT_CLASH = {
  confiscate: { label: 'Confiscate', line: () => 'This round, at the start of the clash step: Confiscate.' },
}
export const CONFISCATE_LINE = 'Confiscate: they discard a clash card of their choice, unless they hold 2 or fewer.'
// Neutral-card effects that happen as soon as it's revealed
export const NOW = {
  draw: { label: 'Draw', line: n => `Draw ${n === 1 ? 'a' : n} clash card${n === 1 ? '' : 's'}.` },
  meter: { label: 'Meter', line: n => `Gain ${n} meter.` },
}

export const BASE_FIELDS16 = ['name', 'type', 'kind', 'speed', 'build', 'chip', 'copies', 'icons', 'onHit', 'cost', 'onLossSelf', 'meter', 'thisRound', 'now', 'stays', 'prevent', 'confiscate', 'discardDownTo', 'atClash', 'capHand', 'endsOn', 'special', 'orSelect', 'orFetch', 'reveal', 'parry', 'brace', 'noFollow', 'safe', 'twin', 'onBlock', 'blockConfiscate', 'throughSafe', 'followCombo', 'blockHeat', 'core', 'art', 'flavour', 'notes']

// Rules v18 riders: what a clash card does On reveal (when it's your clash card and isn't voided)
export const REVEAL18 = {
  meter: { label: 'Charge', line: n => `On reveal: gain ${n} meter.` },
  read: { label: 'Read', line: () => 'On reveal: draw a card, or take a special or your Super from the table, paying its meter.' },
  confiscate: { label: 'Shakedown', line: n => `On reveal: Confiscate${n > 1 ? ` ×${n}` : ''}.` },
  recall: { label: 'Recall', line: v => `On reveal: put ${v === 'attack' ? 'an attack' : 'a card'} from your discard pile into your hand.` },
}
export const MAX_COPIES18 = 3

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
  if (c.reveal) for (const [k, v] of Object.entries(c.reveal)) if (REVEAL18[k] && v) text.push(k === 'read' && TEXT16.heat ? 'On reveal: draw a card.' : REVEAL18[k].line(v))
  if (t === 'R' && c.parry) text.push('If it beats a Pressure, you may follow up with any attack from your hand, and it can start a combo.')
  else if (t === 'R' && c.brace === 'reflect') text.push("If it beats a Pressure: no follow-up; instead, the Pressure's Build goes onto its owner's pile.")
  else if (t === 'R' && c.brace === 'stagger') text.push("If it beats a Pressure: no follow-up; instead, they're Staggered next round.")
  else if (t === 'R' && c.noFollow) text.push('No follow-up.')
  else if (t === 'R') text.push('If it beats a Pressure, you may follow up with a Counter from your hand.')
  // Rules v21 (10 Nov): a fighter's own Guard pays out only if it beats a Pressure
  if (t === 'R' && c.throughSafe) text.push('You follow up even if the Pressure was Safe.')
  if (t === 'R' && c.followCombo) text.push('Your follow-up can start a combo.')
  if (t === 'R' && c.blockConfiscate) text.push(`If it beats a Pressure: Confiscate${c.blockConfiscate > 1 ? ` ×${c.blockConfiscate}` : ''}.`)
  if (t === 'R' && c.blockHeat) text.push(`If it beats a Pressure: gain ${HN()} equal to that Pressure's Build (up to your cap).`)
  if (t === 'R' && c.onBlock) text.push(`If it beats a Pressure: they're ${c.onBlock === 'knockdown' ? 'knocked down' : STATUSES[c.onBlock]?.label} next round${c.parry || c.brace || c.noFollow ? '' : ' (you still follow up)'}.`)
  if (c.twin) text.push(twinLine(c.name))
  if (c.stays) text.push(c.prevent ? `Stays in play. The next time a hit would ${({ knockdown: 'knock you down', staggered: 'stagger you', dizzy: 'leave you Dizzy', lock: 'Lock you' })[c.prevent]}, it doesn't: discard this.` : 'Stays in play.')
  if (c.now) text.push(Object.entries(c.now).filter(([k, v]) => NOW[k] && v).map(([k, v]) => NOW[k].line(v)).join(' ')
    + (c.orSelect ? ' Or take a special or your Super from the table instead, paying its meter.' : '')
    + (c.orFetch ? ' Or put a special from your discard pile into your hand instead.' : ''))
  if (c.capHand) text.push(`Their clash hand limit is ${c.capHand}.`)
  if (c.endsOn === 'pressureHit') text.push('Discard this when one of their Pressures hits you.')
  if (c.thisRound) for (const [k, v] of Object.entries(c.thisRound)) if (THIS_ROUND[k] && v) text.push(THIS_ROUND[k].line(v))
  if (c.atClash) for (const [k, v] of Object.entries(c.atClash)) if (AT_CLASH[k] && v) text.push(AT_CLASH[k].line(v))
  if (c.confiscate) text.push(`On hit: Confiscate${c.confiscate > 1 ? ` ×${c.confiscate}` : ''}.`)
  if (c.discardDownTo != null) text.push(`On hit: they discard down to ${c.discardDownTo} clash cards.`)
  if (c.onHit) text.push(typeof c.onHit === 'string' ? `On hit: ${STATUSES[c.onHit]?.label}.` : `On hit: ${statusText(c.onHit)} (no ${LABEL16[LOCKABLE[c.onHit.lock]]}s for them next round).`)
  if (TEXT16.heat) {
    if (isSuper) cost.push(hw('All your heat: buy it at max heat, at the end of a round. Once a game.', 'All your Charge: buy it when Fully Charged, at the end of a round. Once a game.'))
    if (c.special) cost.push(`Special: buy it from the table for ${TEXT16.heat.special} ${HN()} at the end of a round.`)
  } else {
    if (isSuper && c.meter) cost.push(`${c.meter} meter.`)
    if (c.special) cost.push(`Special: take it from the table for ${c.meter ?? 1} meter.`)
  }
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
  if (c.meter !== undefined) { if (!isSuper && !c.special) E('Only a Super or a special costs meter.'); else if (!isInt(c.meter) || c.meter < 1 || c.meter > 5) E('meter must be 1–5.') }
  if (c.special !== undefined && (t === 'N' || c.special !== true || (!isSuper && c.copies !== 1))) E('special is true, on an attack or a Recover with 1 copy.')
  if (c.special && t === 'R' && (c.reveal || c.core)) E('A Recover special has no rider: the core keeps those.')
  if (c.orSelect !== undefined && (t !== 'N' || c.orSelect !== true)) E('orSelect is true, on a neutral card.')
  if (c.orFetch !== undefined && (t !== 'N' || c.orFetch !== true)) E('orFetch is true, on a neutral card.')
  if (c.thisRound !== undefined) {
    if (t !== 'N') E('Only neutral cards have this-round effects.')
    else if (!c.thisRound || typeof c.thisRound !== 'object' || Object.keys(c.thisRound).some(k => !THIS_ROUND[k] || !isInt(c.thisRound[k]) || c.thisRound[k] < 1)) E(`thisRound takes ${Object.keys(THIS_ROUND).join(', ')}, each a whole number of 1 or more.`)
  } else if (t === 'N' && !c.now && !c.prevent && !c.atClash && !c.capHand) W('This neutral card does nothing.')
  if (c.confiscate !== undefined && (t === 'N' || t === 'R' || !isInt(c.confiscate) || c.confiscate < 1)) E('confiscate is a whole number of 1 or more, on attacks only.')
  if (c.discardDownTo !== undefined && (t === 'N' || !isInt(c.discardDownTo) || c.discardDownTo < 0)) E('discardDownTo is a whole number, on attacks only.')
  if (c.atClash !== undefined && (t !== 'N' || !c.atClash || Object.keys(c.atClash).some(k => !AT_CLASH[k] || !isInt(c.atClash[k]) || c.atClash[k] < 1))) E('atClash takes confiscate (a whole number), on neutral cards only.')
  if (c.capHand !== undefined && (t !== 'N' || !c.stays || !isInt(c.capHand) || c.capHand < 1)) E('capHand belongs on a neutral card that stays in play.')
  if (c.endsOn !== undefined && (t !== 'N' || !c.stays || c.endsOn !== 'pressureHit')) E('endsOn is pressureHit, on a neutral card that stays in play.')
  if (c.stays !== undefined && (t !== 'N' || typeof c.stays !== 'boolean')) E('stays is true or false, on neutral cards only.')
  if (c.prevent !== undefined) {
    if (t !== 'N' || !c.stays) E('prevent belongs on a neutral card that stays in play.')
    else if (!(STATUSES[c.prevent] || c.prevent === 'lock')) E('prevent must be knockdown, staggered, dizzy or lock.')
  }
  if (c.now !== undefined) {
    if (t !== 'N') E('Only neutral cards have reveal effects (now).')
    else if (!c.now || typeof c.now !== 'object' || Object.keys(c.now).some(k => !NOW[k] || !isInt(c.now[k]) || c.now[k] < 1)) E(`now takes ${Object.keys(NOW).join(', ')}, each a whole number of 1 or more.`)
  }
  // Rules v18 riders
  if (c.reveal !== undefined) {
    if (t === 'N' || isSuper) E('reveal riders go on clash cards (not neutral cards or Supers).')
    else if (!c.reveal || typeof c.reveal !== 'object' || !Object.keys(c.reveal).length) E('reveal takes meter, read, recall or confiscate.')
    else for (const [k, v] of Object.entries(c.reveal)) {
      if (!REVEAL18[k]) E(`reveal takes meter, read, recall or confiscate (not "${k}").`)
      else if (k === 'read' ? v !== true : k === 'recall' ? !(v === true || v === 'attack') : !isInt(v) || v < 1) E(k === 'read' ? 'reveal.read is true.' : k === 'recall' ? 'reveal.recall is true (any card) or "attack" (attacks only).' : `reveal.${k} is a whole number of 1 or more.`)
    }
  }
  if (c.parry !== undefined && (t !== 'R' || c.parry !== true)) E('parry is true, on a Recover.')
  if (c.brace !== undefined && (t !== 'R' || !['reflect', 'stagger'].includes(c.brace))) E('brace is "reflect" or "stagger", on a Recover.')
  if (c.parry && c.brace) E('A card is a Parry or a Brace, not both.')
  if (c.noFollow !== undefined && (t !== 'R' || c.noFollow !== true || c.parry || c.brace)) E('noFollow is true, on a Recover that is neither a Parry nor a Brace.')
  if (c.core !== undefined && c.core !== true) E('core is true (a card from the shared defence core).')
  if (c.safe !== undefined && (t !== 'P' || c.safe !== true)) E('safe is true, on a Pressure.')
  if (c.twin !== undefined && (c.twin !== true || !(c.icons || []).includes('linker'))) E('twin is true, on a Linker.')
  if (c.onBlock !== undefined) {
    if (t !== 'R') E('onBlock goes on a Recover (what it does if it beats a Pressure).')
    else if (!['knockdown', 'staggered', 'dizzy'].includes(c.onBlock)) E('onBlock is knockdown, staggered or dizzy.')
    else if (c.onBlock === 'dizzy' && !isSuper) E('Dizzy only appears on Supers.')
    if (c.brace) E('A Brace already does something instead of the follow-up: no onBlock as well.')
  }
  if (c.blockConfiscate !== undefined && (t !== 'R' || !isInt(c.blockConfiscate) || c.blockConfiscate < 1 || c.blockConfiscate > 3)) E('blockConfiscate is 1–3, on a Guard (Confiscate if it beats a Pressure).')
  for (const k of ['throughSafe', 'followCombo', 'blockHeat']) if (c[k] !== undefined && (t !== 'R' || c[k] !== true || c.brace || c.noFollow)) E(`${k} is true, on a Guard that follows up.`)
  return { errors, warnings }
}

export function validateFighter16(f) {
  const errors = [], warnings = []
  const add = (where, r) => { r.errors.forEach(msg => errors.push({ where, msg })); r.warnings.forEach(msg => warnings.push({ where, msg })) }
  if (!f || typeof f !== 'object') return { errors: [{ where: 'Fighter', msg: 'Not an object.' }], warnings }
  const merged = f.rules === 18                     // rules v18: one deck, riders on clash cards
  if (f.rules !== 16 && !merged) errors.push({ where: 'Fighter', msg: 'rules must be 16 (or 18 for a single v18 deck).' })
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
  const counters = f.cards.reduce((s, c) => s + ((c?.icons || []).includes('counter') && !(merged && c.special) ? c.copies || 0 : 0), 0)
  const neutral = f.cards.reduce((s, c) => s + (T16[c?.type] === 'N' && isInt(c?.copies) ? c.copies : 0), 0)
  const specials = f.cards.reduce((s, c) => s + (c?.special ? c.copies || 0 : 0), 0)
  const clash = size - neutral - (merged ? specials : 0)
  if (clash && counters / clash < 0.3) warnings.push({ where: 'Clash deck', msg: `${counters} Counters in ${clash} clash cards: aim for about a third, so a Guard usually has a punish.` })
  if (merged) {
    // Rules v18: one deck of clash cards, at most 3 of any card; the riders replace the neutral deck
    if (neutral) errors.push({ where: 'Deck', msg: 'A v18 deck has no neutral cards: put their effects on clash cards as riders.' })
    for (const c of f.cards) if (isInt(c?.copies) && c.copies > MAX_COPIES18) errors.push({ where: c.name, msg: `At most ${MAX_COPIES18} copies of a card (this has ${c.copies}).` })
    const riders = k => f.cards.reduce((s, c) => s + (c?.reveal?.[k] && !c.special ? c.copies || 0 : 0), 0)
    if (!riders('meter') && !TEXT16.heat) warnings.push({ where: 'Deck', msg: 'No card gains meter (a Charge rider).' })
    if (!riders('read') && !TEXT16.heat) warnings.push({ where: 'Deck', msg: 'No card can take from the table (a Read rider).' })
  } else if (neutral < 4) errors.push({ where: 'Neutral deck', msg: `Needs at least 4 neutral cards (a hand of 3, and one to draw); this has ${neutral}.` })
  else if (neutral < 6) warnings.push({ where: 'Neutral deck', msg: `${neutral} neutral cards cycle very fast with a neutral hand of 3.` })
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
    meter: isSuper ? (c.meter ?? 3) : c.special ? (c.meter ?? 1) : 0, special: !!c.special, orSelect: !!c.orSelect, orFetch: !!c.orFetch, thisRound: c.thisRound ?? null, now: c.now ?? null, stays: !!c.stays, prevent: c.prevent ?? null,
    confiscate: c.confiscate ?? 0, discardDownTo: c.discardDownTo ?? null, atClash: c.atClash ?? null, capHand: c.capHand ?? null, endsOn: c.endsOn ?? null,
    reveal: c.reveal ?? null, parry: !!c.parry, brace: c.brace ?? null, noFollow: !!c.noFollow, safe: !!c.safe,
    twin: !!c.twin, onBlock: c.onBlock ?? null,
    blockConfiscate: c.blockConfiscate ?? 0, throughSafe: !!c.throughSafe, followCombo: !!c.followCombo, blockHeat: !!c.blockHeat,
    sup: isSuper, src: c,
  }
}

// A fighter ready for the engine: distinct cards, and the deck as a list of card indices
export function toFighter16(f) {
  const cards = f.cards.map(c => norm(c, false))
  const deck = []
  cards.forEach((c, i) => { for (let k = 0; k < c.copies; k++) deck.push(i) })
  return { id: f.id, name: f.name, hp: f.hp, ...(f.greyCap ? { greyCap: f.greyCap } : {}), v16: true, cards, sup: f.super ? norm(f.super, true) : null, deck, ai: f.ai || null }
}
