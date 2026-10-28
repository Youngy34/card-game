// Plain-language account of a reveal, from the engine's event.

import { player } from '../engine/engine.js'
import { TYPE_LABEL } from '../engine/rules.js'

const cardOf = (G, side, pick) => player(G, side).f.cards[pick]

// What one card did when it took effect against the other player
function effectLine(G0, ev, k, names) {
  const d = 1 - k, c = cardOf(G0, k, ev.picks[k]), other = cardOf(G0, d, ev.picks[d])
  switch (ev.effects[k]) {
    case 'hit': return `${c.name} lands: ${c.grey} grey on ${names[d]}'s pile and ${c.chip} chip.`
    case 'cash': return ev.cashed[d]
      ? `${c.name} cashes ${names[d]}'s pile of ${ev.cashed[d]}, then ${c.chip} chip: ${ev.dmg[d]} damage.`
      : `${c.name} catches ${names[d]} with an empty pile: just ${c.chip} chip.`
    case 'clear': return ev.cleared[k] ? `${c.name} clears ${names[k]}'s pile of ${ev.cleared[k]}.` : `${c.name} has nothing to clear: ${names[k]}'s pile was empty.`
    case 'turnback': return `${names[d]}'s ${other.name} is blocked: its ${other.grey} grey goes back on ${names[d]}'s own pile.`
    case 'stopped': return ev.grey[d] ? `${names[d]}'s ${other.name} is blocked and leaves them open: ${ev.grey[d]} grey on their own pile.` : `${names[d]}'s ${other.name} is blocked and simply stopped.`
    case 'double': return `${names[d]}'s ${other.name} is blocked: their pile doubles (+${ev.grey[d]}).`
    case 'fizzle': return `${names[d]}'s ${other.name} is blocked and fizzles: no clear.`
    case 'guard': return 'Both guard.'
  }
  return ''
}

const WHY = {
  'S>H': 'a quick hit stuffs the big swing', 'S>G': 'a quick hit stuffs the grab',
  'H>G': 'the big swing hits the grabber stepping in', 'H>F': 'the heavy hit breaks the armour',
  'G>F': 'a throw beats armour', 'G>B': 'a throw breaks the guard',
  'F>S': 'the armour absorbs the quick hit', 'F>B': "nobody's hitting, so the Focus recovers freely",
  'B>S': 'the guard stops the hit', 'B>H': 'the guard stops the big swing',
  'B>F': 'the guard catches the Focus', 'H>B': 'the heavy hit breaks the guard',
  'G>H': 'the quick grab catches the wind-up', 'F>G': 'the burst of armour blows the grabber away',
  'F>H': 'the armour rides out the slow swing',
}

// { title, sub, lines[] } for the reveal that took G0 to N
export function describe(G0, ev, N, names) {
  const lines = []
  let title = '', sub = ''
  const [ta, tb] = ev.types
  const ca = cardOf(G0, 0, ev.picks[0]), cb = cardOf(G0, 1, ev.picks[1])
  if (ev.kind === 'mirror') {
    if (ev.result === 'cancel') {
      title = `${TYPE_LABEL[ta]} mirror · cancel`
      sub = `${ca.name} and ${cb.name} cancel out: nothing happens, and both go on cooldown.`
    } else {
      title = `${TYPE_LABEL[ta]} mirror · both take effect`
      sub = `${ca.name} and ${cb.name} both land.`
      for (const k of [0, 1]) { const l = effectLine(G0, ev, k, names); if (l && ev.effects[k] !== 'guard') lines.push(l) }
      if (ev.effects[0] === 'guard') lines.push('Both guard: nothing happens.')
    }
  } else {
    const w = ev.by, l = 1 - w
    const cw = cardOf(G0, w, ev.picks[w]), cl = cardOf(G0, l, ev.picks[l])
    const why = WHY[`${cw.t}>${cl.t}`]
    title = `${TYPE_LABEL[cw.t]} beats ${TYPE_LABEL[cl.t]}`
    sub = `${names[w]}'s ${cw.name} beats ${names[l]}'s ${cl.name}${why ? `: ${why}` : ''}.`
    lines.push(effectLine(G0, ev, w, names))
  }
  if (ev.ko) lines.push(ev.doubleKO ? 'Double K.O.: whoever ends least below 0 wins.' : 'K.O.')
  if (ev.limit) lines.push(`Reveal limit reached (${G0.R.maxReveals}): a draw.`)
  return { title, sub, lines: lines.filter(Boolean) }
}

export function deltaLine(before, after) {
  const d = after.hp - before.hp, p = after.pile - before.pile
  const parts = []
  if (d) parts.push(`${d > 0 ? '+' : ''}${d} HP`)
  if (p) parts.push(`${p > 0 ? '+' : ''}${p} grey`)
  return parts.join(' · ') || 'no change'
}
