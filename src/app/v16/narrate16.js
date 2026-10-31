// Plain-English lines for a v16 round: the neutral actions, the clash's outcome,
// and what each card did.

import { LABEL16, STATUSES, LOCKABLE } from '../../engine/v16/cards.js'

export function neutralLine16(a, f) {
  if (!a) return 'did nothing'
  switch (a.kind) {
    case 'draw': return a.n ? 'drew an extra card' : 'tried to draw (no cards left)'
    case 'neutral': return `played ${a.name}`
    case 'burn': return `burned ${a.n} card${a.n === 1 ? '' : 's'} for meter`
    case 'skip': return `${a.why === 'Dizzy' ? 'is Dizzy' : 'is knocked down'}: no neutral action`
    case 'none': return 'did nothing'
    default: return a.kind
  }
}

const status = s => (typeof s === 'string' ? STATUSES[s]?.label : `Lock ${LABEL16[LOCKABLE[s.lock]]}`)

export function outcomeTitle16(c, names) {
  const [a, b] = c.names
  switch (c.outcome) {
    case 'none': return { title: 'Nobody plays', sub: 'Neither player had a card to play.' }
    case 'unopposed': return { title: `${c.names[c.winner]} lands`, sub: `${names[1 - c.winner]} played nothing, so it lands unopposed.` }
    case 'guards': return { title: 'Both Guard', sub: 'Two Guards: each player clears their own pile.' }
    case 'cancel': return { title: `${a} and ${b} tie`, sub: 'Same type, same speed: the tie cancels and neither lands.' }
    case 'tie': return { title: `${c.names[c.winner]} wins the tie`, sub: `Same speed: the tie goes to ${names[c.winner]}, on less HP.` }
    case 'speed': {
      const sp = c.events.find(e => e.kind === 'speeds')?.speeds || []
      return { title: `${c.names[c.winner]} is faster`, sub: `Two ${LABEL16[c.types[0]]}s: speed ${sp[c.winner]} beats ${sp[1 - c.winner]}.` }
    }
    default: {
      const w = c.winner, wt = c.types[w], lt = c.types[1 - w]
      const why = { PC: 'a quick strike beats a wind-up', CR: 'a Convert breaks a Guard', RP: 'a Guard stops a strike' }[wt + lt]
      return { title: `${c.names[w]} beats ${c.names[1 - w]}`, sub: `${LABEL16[wt]} beats ${LABEL16[lt]}: ${why}.` }
    }
  }
}

export function narrate16(ev, names) {
  const out = []
  const how = { clash: '', follow: 'Follow-up: ', link: 'Linker: ', end: 'Ender: ' }
  for (const e of ev) {
    const who = names[e.side], them = names[1 - e.side]
    if (e.kind === 'hit') {
      if (e.t === 'P') out.push(`${how[e.how]}${e.name} puts ${e.build} grey on ${them}${e.chip ? ` and chips ${e.chip}` : ''}.`)
      else if (e.t === 'C') out.push(`${how[e.how]}${e.name} ${e.cash ? `cashes ${them}'s ${e.cash} grey` : 'cashes an empty pile'} and chips ${e.chip}: ${e.cash + e.chip} damage.`)
      else if (e.t === 'R') out.push(`${who}'s ${e.name} clears ${e.cleared ? `${e.cleared} grey` : 'an empty pile'}${e.chip ? ` and chips ${e.chip}` : ''}.`)
    } else if (e.kind === 'status') out.push(`${names[e.side]} is hit with ${status(e.status)} (from ${e.from}) for next round.`)
    else if (e.kind === 'onLoss') out.push(`${who}'s beaten card adds ${e.n} to their own pile.`)
    else if (e.kind === 'play' && e.sup) out.push(`${who} spends meter on ${e.name}.`)
  }
  return out
}
