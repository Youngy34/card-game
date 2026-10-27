// Rules v13 vocabulary, in one place so the engine, the card faces and the
// validator agree: directions, on-block values, combo roles, the universal
// cards every fighter shares, and the generated card text.
//
// Source: rules-overview 13.md (core rules only: neutral, combos, cooldown).
// Meter, EX cards, Supers and printed properties are layers, off for now.

export const DIRECTIONS = ['horizontal', 'vertical', 'throw']
export const DIR_CODE = { horizontal: 'H', vertical: 'V', throw: 'T' }
export const DIR_LABEL = { H: 'Horizontal', V: 'Vertical', T: 'Throw' }

export const STRENGTHS = ['light', 'medium', 'heavy']
export const STR_CODE = { light: 'L', medium: 'M', heavy: 'H' }
export const STR_LABEL = { L: 'Light', M: 'Medium', H: 'Heavy' }

// On block: + the striker takes or keeps the initiative, = it doesn't move,
// - the blocker takes it. A typed minus sign (−) is read as '-'.
export const ON_BLOCK = { '+': 1, '=': 0, '-': -1, '−': -1 }
export const OB_TEXT = { 1: '+', 0: '=', [-1]: '−' }

// The universal cards. Guard, Duck and Step are held in hand and never go on
// cooldown; the three Breaks are the combo stack, picked up only to defend a
// combo, and go on cooldown only when a feint locks one.
export const UNIVERSAL = {
  G: { id: 'G', name: 'Guard', group: 'defence',
       neutral: 'Blocks Horizontals and Verticals. Throws beat it.',
       combo: 'In a combo: a feint when attacking, a hold when defending.' },
  D: { id: 'D', name: 'Duck', group: 'defence',
       neutral: 'Exposes Horizontals and Throws. Verticals hit it.' },
  S: { id: 'S', name: 'Step', group: 'defence',
       neutral: 'Exposes Verticals and evades Throws. Horizontals hit it.' },
  BL: { id: 'BL', name: 'Break Light', group: 'break', str: 'L' },
  BM: { id: 'BM', name: 'Break Medium', group: 'break', str: 'M' },
  BH: { id: 'BH', name: 'Break Heavy', group: 'break', str: 'H' },
}
export const DEFENCE_IDS = ['G', 'D', 'S']
export const BREAK_IDS = ['BL', 'BM', 'BH']
export const BREAK_BIT = { BL: 1, BM: 2, BH: 4 }
export const EVADE_BIT = { D: 1, S: 2 }
for (const id of BREAK_IDS) {
  const s = STR_LABEL[UNIVERSAL[id].str]
  UNIVERSAL[id].combo = `Breaks a ${s} linker: your whole pile clears, you take the initiative and the combo ends.`
}

// A lone attack against a defence (rules: "Attack against defence")
export const VS_DEFENCE = {
  H: { G: 'blocked', D: 'exposed', S: 'hit' },
  V: { G: 'blocked', D: 'hit', S: 'exposed' },
  T: { G: 'thrown', D: 'exposed', S: 'evaded' },
}

export const DEFAULT_RULES = {
  initiativeBonus: 3,          // +Speed in clashes for the holder, who also wins ties
  comboCap: 3,                 // most linkers and feints in one combo
  firstInitiative: 'random',   // 'random' | 'a' | 'b'
  maxReveals: 100,             // a safety net, not a rule: a game still going after this many reveals is a draw
  // Experimental switches, off by default (the defaults are rules v13 as written).
  // They exist to test fixes for passivity (rules-overview 13.md, Open Questions).
  clock: 0,                    // a round timer in reveals (0 = off): once it runs out, at the end of
                               //   the next neutral reveal, the player with more HP wins (equal HP draws)
  counterCheck: 'after',       // 'after': the counter counts the defender's new +3 (as written)
                               // 'reveal': initiative as it stood at the reveal, so the holder's
                               //   attacks keep their +3 and the defender gets none
  guardDamage: 'off',          // a blocked strike puts grey on the blocker: 'off', 'flat' (blockGrey
                               //   for every strike) or 'card' (each strike's own Block grey, else 1)
  blockGrey: 1,                // the 'flat' amount
  throwCashes: false,          // a throw that lands first cashes the thrown player's whole pile
  evadeCooldown: false,        // Duck and Step go on cooldown 1 (Guard never does)
  waitPasses: false,           // two defences pass the initiative to the other player
  wrongBreakLocks: false,      // a Break of the wrong strength is locked for the next beat, like a feinted one
}

// ---- card text -------------------------------------------------------------
// The face is written from the card's fields, so it always matches the engine.

export function comboLine(c) {
  if (c.linker) return `${STR_LABEL[STR_CODE[c.linker]] || c.linker} linker · ${c.grey ?? 0} grey`
  if (c.ender) {
    let s = 'Ender: cash the pile'
    if (c.bonus) s += `, plus ${c.bonus} damage`
    if (c.keepInitiative) s += '; you keep the initiative'
    return s
  }
  return null
}

export function cardText(c, opts = {}) {
  const lines = []
  const combo = comboLine(c)
  if (combo) lines.push(combo)
  if (c.direction === 'throw' && c.grey) lines.push(`On throw: also puts ${c.grey} grey on their pile.`)
  if (opts.guard && c.direction !== 'throw') lines.push(`Guard damage: ${c.blockGrey ?? 1} grey on the blocker.`)
  return lines
}

export const dirOf = c => DIR_CODE[c.direction] || 'H'
