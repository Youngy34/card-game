// Rules v14 vocabulary, in one place so the engine, the card faces and the
// validator agree: the five types, the wheel, the experiments and the
// generated card text.
//
// Source: rules-overview 14.md (base game). Five types, each beating the next
// two around the wheel: Strike -> Heavy -> Grab -> Focus -> Block -> Strike.

export const TYPES = ['strike', 'heavy', 'grab', 'focus', 'block']
export const TYPE_CODE = { strike: 'S', heavy: 'H', grab: 'G', focus: 'F', block: 'B' }
export const CODES = ['S', 'H', 'G', 'F', 'B']
export const TYPE_LABEL = { S: 'Strike', H: 'Heavy', G: 'Grab', F: 'Focus', B: 'Block' }
export const ATTACKS = ['S', 'H', 'G']          // the types that print Chip

// Each wheel lists the types in order; each type beats the next two.
// 'v14' is the rules as written. The other two are the alternatives from the
// 28 October discussion, kept as an experiment (rules-overview 14.md,
// Considered and Rejected). Under them Block beats Focus: in the first draft a
// blocked Focus doubled its owner's pile; in the alternative it fizzles.
export const WHEELS = {
  v14: { order: ['S', 'H', 'G', 'F', 'B'], label: 'Strike → Heavy → Grab → Focus → Block (rules v14)' },
  first: { order: ['S', 'H', 'G', 'B', 'F'], label: 'Strike → Heavy → Grab → Block → Focus (the first draft: a blocked Focus doubles its pile)' },
  alt: { order: ['F', 'S', 'G', 'H', 'B'], label: 'Focus → Strike → Grab → Heavy → Block (Heavy and Grab swapped: a blocked Focus fizzles)' },
}
const wheelOf = w => WHEELS[w] || WHEELS.v14

// Does type x beat type y on this wheel?
export function beats(wheel, x, y) {
  const o = wheelOf(wheel).order
  const d = (o.indexOf(y) - o.indexOf(x) + 5) % 5
  return d === 1 || d === 2
}
export function beatsList(wheel, x) {
  const o = wheelOf(wheel).order, i = o.indexOf(x)
  return [o[(i + 1) % 5], o[(i + 2) % 5]]
}
export function losesTo(wheel, x) {
  const o = wheelOf(wheel).order, i = o.indexOf(x)
  return [o[(i + 4) % 5], o[(i + 3) % 5]]
}

export const DEFAULT_RULES = {
  maxReveals: 100,            // a safety net, not a rule: a game still going after this many reveals is a draw
  // Experiments, off by default (the defaults are rules v14 as written).
  wheel: 'v14',               // 'v14' | 'first' | 'alt' (see WHEELS)
  mirrors: 'none',            // 'none': two cards of a type cancel (as written)
                              // 'all': both take effect (a double KO is then possible)
                              // 'focus': only two Focuses take effect (both clear), the one mirror the rule strains on
  blockedHeavyGrey: 0,        // grey a blocked Heavy puts on its owner's own pile (as written: 0, it's simply stopped)
}

// ---- card text -------------------------------------------------------------
// The face is written from the card's fields and the wheel, so it always
// matches the engine.

const list = codes => codes.map(c => TYPE_LABEL[c]).join(' and ')

export function winText(c, rules = DEFAULT_RULES) {
  const t = TYPE_CODE[c.type]
  const R = { ...DEFAULT_RULES, ...rules }
  if (t === 'S') return `Wins: ${c.grey ?? 0} grey on their pile, then ${c.chip ?? 0} chip.`
  if (t === 'H' || t === 'G') return `Wins: cashes their pile, then ${c.chip ?? 0} chip.`
  if (t === 'F') return 'Wins: clears your own pile.'
  // Block: it turns back the attack's Grey
  const parts = []
  for (const x of beatsList(R.wheel, 'B')) {
    if (x === 'S') parts.push("turns a Strike's grey back on its owner")
    if (x === 'H') parts.push(R.blockedHeavyGrey ? `a Heavy puts ${R.blockedHeavyGrey} grey on its owner` : 'stops a Heavy')
    if (x === 'F') parts.push(R.wheel === 'first' ? "doubles a Focus's pile" : 'a Focus fizzles')
  }
  return `Wins: ${parts.join('; ')}.`
}

export function cardText(c, rules = DEFAULT_RULES) {
  const R = { ...DEFAULT_RULES, ...rules }
  const t = TYPE_CODE[c.type]
  return [winText(c, R), `Beats ${list(beatsList(R.wheel, t))}.`]
}

export const typeOf = c => TYPE_CODE[c.type] || 'S'
