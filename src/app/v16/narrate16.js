// Plain-English lines for a v16 round: the neutral actions, the clash's outcome,
// and what each card did.

import { LABEL16, STATUSES, LOCKABLE } from '../../engine/v16/cards.js'

export function neutralLine16(a, f) {
  if (!a) return 'did nothing'
  switch (a.kind) {
    case 'draw': return a.n ? 'took a Breather: drew a card' : 'tried to draw (no cards left)'
    case 'focus': return a.drew !== undefined
      ? `focused: ${a.drew ? 'drew a card' : 'no card to draw'}${a.n ? ` and gained ${a.n} meter` : ' (meter full)'}`
      : `focused: gained ${a.n} meter`
    case 'neutral': if (a.pending) return `played ${a.name}`
      if (a.took) return `played ${a.name}: took ${a.took} from the table (${a.cost} meter)${a.sup ? ': their Super is live' : ''}`
      if (a.fetched) return `played ${a.name}: put ${a.fetched} from their discard pile into their hand`
      return `played ${a.name}${a.drew !== undefined || a.meter ? `: ${[a.drew !== undefined ? (a.drew ? 'drew a clash card' : 'no clash card to draw') : null, a.meter ? `gained ${a.meter} meter` : (a.drew !== undefined ? 'meter full' : null)].filter(Boolean).join(', ')}` : ''}`
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
    case 'none': return { title: 'Nobody plays', sub: 'Both players played nothing.' }
    case 'armor': return { title: `${c.names[c.winner]} armors through ${c.names[1 - c.winner]}`, sub: 'Armor: this round, a Convert also beats a Pressure.' }
    case 'mixup': return { title: `${c.names[c.winner]} mixes up ${c.names[1 - c.winner]}`, sub: 'Mix-Up: this round, a Pressure also beats a Guard.' }
    case 'unopposed': return { title: `${c.names[c.winner]} lands`, sub: c.voided?.[1 - c.winner] ? `${names[1 - c.winner]}'s ${c.names[1 - c.winner]} was voided (Locked), so it lands unopposed.` : `${names[1 - c.winner]} played nothing, so it lands unopposed.` }
    case 'guards': return { title: 'Both Guard', sub: 'Two Guards: each player clears their own pile.' }
    case 'cancel': return { title: `${a} and ${b} tie`, sub: 'Same type, same speed: the tie cancels and neither lands.' }
    case 'tie': return { title: `${c.names[c.winner]} wins the tie`, sub: `Same speed: the tie goes to ${names[c.winner]}.` }
    case 'speed': {
      const sp = c.events.find(e => e.kind === 'speeds')?.speeds || []
      const down = c.events.find(e => e.kind === 'downSlow')
      if (down) return { title: `${c.names[c.winner]} wins the speed clash`, sub: `${names[down.side]} is knocked down, so they lose every speed clash this round (speed ${sp[c.winner]} against ${sp[1 - c.winner]}).` }
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
    } else if (e.kind === 'status') out.push(e.block ? `${them}'s ${e.from} turns the blow aside: ${names[e.side]} is ${e.status === 'knockdown' ? 'knocked down' : status(e.status)} next round.` : `${names[e.side]} is hit with ${status(e.status)} (from ${e.from}) for next round.`)
    else if (e.kind === 'safe') out.push(`${who}'s ${e.name} is Safe: no follow-up.`)
    else if (e.kind === 'onLoss') out.push(`${who}'s beaten card adds ${e.n} to their own pile.`)
    else if (e.kind === 'prevented') out.push(`${who}'s ${e.by} stops the ${typeof e.status === 'string' ? (STATUSES[e.status]?.label || e.status).toLowerCase() : 'Lock'}, and is discarded.`)
    else if (e.kind === 'voided') out.push(`${who}'s ${e.name} is voided: their ${LABEL16[e.t]}s are Locked.`)
    else if (e.kind === 'play' && e.sup) out.push(e.gone ? `${who} plays their Super, ${e.name}: it's used up for the game.` : `${who} spends meter on ${e.name}.`)
    else if (e.kind === 'confiscate') out.push(`${e.from} Confiscates: ${who} discards ${e.n} clash card${e.n === 1 ? '' : 's'} of their choice.`)
    else if (e.kind === 'ended') out.push(`${them}'s ${e.by} hits: ${who}'s ${e.name} is broken and discarded.`)
  }
  return out
}
