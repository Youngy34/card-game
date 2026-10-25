// Card format v2 — the single registry of card fields and keywords.
//
// Everything that knows about card keywords reads this file: the rules engine
// (via normalise), the card-face text, the editor's form and its validation.
// To add a new kind of effect: add it here, then handle it in engine.js.
//
// Types: 'pressure' | 'convert' | 'recover' | 'typeless'
// Internally the engine uses the sim's one-letter codes: P, C, R, T.

export const TYPES = ['pressure', 'convert', 'recover', 'typeless']
export const TYPE_CODE = { pressure: 'P', convert: 'C', recover: 'R', typeless: 'T' }
export const CODE_TYPE = { P: 'pressure', C: 'convert', R: 'recover', T: 'typeless' }
export const TYPE_NAME = { P: 'Pressure', C: 'Convert', R: 'Recover', T: 'typeless card' }
export const TYPE_LABEL = { P: 'Pressure', C: 'Convert', R: 'Recover', T: 'Typeless' }
// The card each type beats (winner -> loser)
export const BEATEN_BY = { P: 'C', C: 'R', R: 'P' }

// ---- rules v12: kinds and speed -------------------------------------------
// A v12 fighter ("rules": 12) gives every card a kind, and every attack a speed.
// The type still decides clashes between types; the kind decides how a card
// lands, and speed decides clashes between two attacks of the same type.
export const KINDS = {
  strike:     { t: 'P', label: 'Strike' },
  projectile: { t: 'P', label: 'Projectile', line: 'Its chip gets through a Guard. Two Projectiles cancel.' },
  heavy:      { t: 'C', label: 'Heavy' },
  grab:       { t: 'C', label: 'Grab', line: 'Two Grabs tech.' },
  guard:      { t: 'R', label: 'Guard', line: "If it beats a Pressure, that Pressure's Build goes on its owner's own pile." },
  counter:    { t: 'R', label: 'Counter', line: "If it beats a Pressure, that Pressure's chip hits its owner." },
  setup:      { t: 'T', label: 'Setup', line: 'Interrupted if the opponent attacks.' },
}
export const KINDS_OF = { P: ['strike', 'projectile'], C: ['heavy', 'grab'], R: ['guard', 'counter'], T: ['setup'] }
// Speed bands: higher is faster, and every Pressure is faster than every Convert
export const SPEED_BAND = { P: [11, 20], C: [1, 10] }
export const DEFAULT_SPEED = { strike: 17, projectile: 13, heavy: 3, grab: 7 }

const every = (k, unit) => (k === 1 ? `every ${unit}` : `every ${k} ${unit}s`)
const tokens = n => `${n} token${n === 1 ? '' : 's'}`

// zone: 'text' (rules text), 'cost' (the card's cost zone), 'marker'
// kind: 'int' (positive whole number), 'bool', 'type' (one of P/C/R), 'pair'
// types: card types it may go on. superOk: allowed on a Super.
export const KEYWORDS = [
  {
    key: 'buildIfOppHas', kind: 'pair', zone: 'text', types: ['P'], superOk: true,
    fields: [{ key: 'tokens', label: 'Opponent has at least', min: 1, max: 30 },
             { key: 'build', label: 'Extra Build', min: 1, max: 20 }],
    label: 'Extra Build against a loaded pile',
    text: v => `+${v.build} Build if the opponent already has ${v.tokens} or more tokens.`,
  },
  {
    key: 'buildPerOwnTokens', kind: 'int', zone: 'text', types: ['P'], superOk: true, min: 1, max: 20,
    label: 'Build per token in your own pile', unit: 'tokens per +1',
    text: k => `+1 Build for ${every(k, 'token')} in your own pile.`,
  },
  {
    key: 'flowBuild', kind: 'int', zone: 'text', types: ['P'], superOk: true, min: 1, max: 20,
    label: 'Extra Build while flowing', needsFlow: true,
    text: n => `+${n} Build while flowing.`,
  },
  {
    key: 'chipPerOwnTokens', kind: 'int', zone: 'text', types: ['P', 'C'], superOk: true, min: 1, max: 20,
    label: 'Chip per token in your own pile', unit: 'tokens per +1',
    text: k => `+1 chip for ${every(k, 'token')} in your own pile.`,
  },
  {
    key: 'chipPerOppTokens', kind: 'int', zone: 'text', types: ['P'], superOk: true, min: 1, max: 20,
    label: "Chip per token in the opponent's pile", unit: 'tokens per +1',
    text: k => `+1 chip for ${every(k, 'token')} the opponent has.`,
  },
  {
    key: 'chipPerCashed', kind: 'int', zone: 'text', types: ['C'], superOk: true, min: 1, max: 20,
    label: 'Chip per token it cashes', unit: 'tokens per +1',
    text: k => `+1 chip for ${every(k, 'token')} it cashes.`,
  },
  {
    key: 'chipPerCleared', kind: 'int', zone: 'text', types: ['R'], superOk: true, min: 1, max: 20,
    label: 'Chip per token it clears', unit: 'tokens per +1',
    text: k => `+1 chip for ${every(k, 'token')} it clears.`,
  },
  {
    key: 'chipPerHpLost', kind: 'int', zone: 'text', types: ['C', 'R'], superOk: true, min: 1, max: 20,
    label: "Chip per HP you've lost", unit: 'HP per +1',
    text: k => `+1 chip for ${k === 1 ? 'every HP' : `every ${k} HP`} you've lost.`,
  },
  {
    key: 'chipIfMirror', kind: 'int', zone: 'text', types: ['P'], superOk: true, min: 1, max: 20,
    label: 'Extra chip in a Pressure mirror',
    text: n => `+${n} chip if the opponent also played a Pressure.`,
  },
  {
    key: 'chipOnWin', kind: 'int', zone: 'text', types: ['P', 'C', 'R'], superOk: true, min: 1, max: 20,
    label: 'Extra chip when it wins',
    text: (n, t) => `+${n} chip if it beats a ${TYPE_NAME[BEATEN_BY[t]]}.`,
  },
  {
    key: 'flowChip', kind: 'int', zone: 'text', types: ['P', 'C', 'T'], superOk: true, min: 1, max: 20,
    label: 'Extra chip while flowing', needsFlow: true,
    text: n => `+${n} chip while flowing.`,
  },
  {
    key: 'clearOwn', kind: 'bool', zone: 'text', types: ['C'], superOnly: true,
    label: 'Also clear your own pile (Super only: a second verb)',
    text: () => 'Also clear your own pile.',
  },
  {
    key: 'onCooldownConvertChip', kind: 'int', zone: 'text', types: ['P', 'C', 'R', 'T'], superOk: false, min: 1, max: 20,
    label: 'On cooldown: your Converts chip more',
    text: n => `On cooldown: your Converts chip +${n}.`,
  },
  {
    key: 'lock', kind: 'bool', zone: 'text', types: ['P', 'C', 'R', 'T'], superOk: true,
    label: "Lock: push the opponent's card further on cooldown",
    text: () => "The opponent's played card goes one space further on cooldown.",
  },
  {
    key: 'stagger', kind: 'type', zone: 'text', types: ['P', 'C', 'R', 'T'], superOk: true,
    label: "Stagger: stop the opponent playing a type next round",
    text: (v, t) => {
      const T = TYPE_CODE[v], n = TYPE_NAME[T]
      if (BEATEN_BY[t] === T) return `If it beats a ${n}, the opponent can't play a ${n} next round.`
      if (t === T) return `If the opponent also played a ${n}, they can't play a ${n} next round.`
      return `If the opponent played a ${n}, they can't play a ${n} next round.`
    },
  },
  {
    key: 'knockdown', kind: 'choice', zone: 'text', types: ['C'], superOk: true,
    options: [['resolves', 'Whenever it resolves'], ['recover', 'Only if it beats a Recover']],
    label: "Knockdown: the opponent can't play a Pressure next round",
    text: v => (v === 'recover'
      ? "Knockdown: if it beats a Recover, the opponent can't play a Pressure next round."
      : "Knockdown: the opponent can't play a Pressure next round."),
  },
  {
    key: 'returnCard', kind: 'bool', zone: 'text', types: ['P', 'C', 'R', 'T'], superOk: true,
    label: 'Return a card from your cooldown to your hand',
    text: () => 'Return one card from your cooldown track to your hand.',
  },
  // ---- costs ----
  {
    key: 'selfAdd', kind: 'int', zone: 'cost', types: ['P', 'C', 'R', 'T'], superOk: true, min: 1, max: 20,
    label: 'Cost: add tokens to your own pile',
    text: n => `Add ${tokens(n)} to your own pile.`,
  },
  {
    key: 'onLossSelf', kind: 'int', zone: 'cost', types: ['P', 'C', 'R'], superOk: true, min: 1, max: 20,
    label: 'Cost: on loss, add tokens to your own pile',
    text: n => `On loss: add ${tokens(n)} to your own pile.`,
  },
  {
    key: 'lockout', kind: 'bool', zone: 'cost', types: ['P', 'C', 'R', 'T'], superOk: false,
    label: "Cost: on cooldown, you can't play this type",
    text: (_, t) => `On cooldown: you can't play another ${TYPE_NAME[t]}.`,
  },
]

export const KEYWORD = Object.fromEntries(KEYWORDS.map(k => [k.key, k]))

// Plain fields every card has. Everything else on a card must be a keyword.
export const BASE_FIELDS = ['name', 'type', 'kind', 'speed', 'build', 'chip', 'cooldown', 'flowCard', 'art', 'flavour', 'notes']

export const PASSIVES = {
  flow: {
    label: 'Flow',
    text: () => "You're flowing while a Flow card of yours is on cooldown space 1.",
  },
  risingStakes: {
    label: 'Rising Stakes',
    text: v => `At the end of every round, add ${tokens(v.tokens)} to your own pile`
      + (v.whilePileUnder ? ` while it has fewer than ${v.whilePileUnder}.` : '.'),
  },
}

// The lines printed on a card: { text: [...], cost: [...] }
export function cardLines(card, { isSuper = false } = {}) {
  const t = TYPE_CODE[card.type]
  const text = [], cost = []
  for (const k of KEYWORDS) {
    const v = card[k.key]
    if (v === undefined || v === null || v === false || v === 0) continue
    ;(k.zone === 'cost' ? cost : text).push(k.text(v, t))
  }
  return { text, cost }
}
