// Plain-language account of a reveal, from the engine's event.

import { player } from '../engine/engine.js'
import { UNIVERSAL, OB_TEXT, STR_LABEL, DIR_LABEL } from '../engine/rules.js'

const nameOf = (G, side, pick) => (typeof pick === 'number' ? player(G, side).f.cards[pick].name : UNIVERSAL[pick].name)
const cardOf = (G, side, pick) => (typeof pick === 'number' ? player(G, side).f.cards[pick] : null)
const VERB = { G: 'guards', D: 'ducks', S: 'steps' }

// { title, sub, lines[] } for the reveal that took G0 to N
export function describe(G0, ev, N, names) {
  const lines = []
  let title = '', sub = ''
  const holder = ev.init1
  const initLine = (from, to) => (from === to ? `The initiative stays with ${names[to]}.` : `${names[to]} takes the initiative.`)

  if (ev.phase === 'neutral') {
    const [a, b] = ev.picks
    if (ev.kind === 'defences') {
      title = 'Both defend'
      sub = `${nameOf(G0, 0, a)} and ${nameOf(G0, 1, b)}: nothing happens. ${initLine(ev.init0, holder)}`
    } else if (ev.kind === 'clash') {
      const w = ev.by, l = 1 - w
      const cw = cardOf(G0, w, ev.picks[w]), cl = cardOf(G0, l, ev.picks[l])
      const sp = k => `${cardOf(G0, k, ev.picks[k]).speed}${ev.init0 === k ? ` + ${G0.R.initiativeBonus}` : ''}`
      title = `Clash · ${names[w]} is faster`
      sub = `${cw.name} (${sp(w)}${ev.init0 === w ? ` = ${ev.speeds[w]}` : ''}) beats ${cl.name} (${sp(l)}${ev.init0 === l ? ` = ${ev.speeds[l]}` : ''})${ev.speeds[0] === ev.speeds[1] ? ', and the initiative holder wins ties' : ''}.`
      lines.push(landLine(ev.result, w, cw, ev, names))
    } else {
      const k = ev.by, d = 1 - k, c = cardOf(G0, k, ev.picks[k]), def = ev.picks[d]
      if (ev.result === 'hit') {
        title = 'Hit'
        sub = `${c.name} (${DIR_LABEL[c.dir]}) catches ${names[d]}'s ${UNIVERSAL[def].name}.`
        lines.push(landLine('hit', k, c, ev, names))
      } else if (ev.result === 'thrown') {
        title = 'Thrown'
        sub = `${c.name} beats ${names[d]}'s Guard.`
        lines.push(landLine('thrown', k, c, ev, names))
      } else if (ev.result === 'blocked') {
        title = `Blocked · ${OB_TEXT[ev.onBlock]}`
        sub = `${names[d]} guards ${c.name}. ${initLine(ev.init0, holder)}`
        if (ev.grey[d]) lines.push(`Guard damage: ${ev.grey[d]} grey on ${names[d]}'s pile${G0.R.throwCashes ? ', which a throw would cash' : ''}.`)
      } else if (ev.result === 'evaded') {
        title = 'Evaded'
        sub = `${names[d]} steps ${c.name} and takes the initiative. No counter after an evade.`
      } else if (ev.result === 'exposed') {
        title = 'Exposed'
        sub = `${names[d]} ${VERB[def]} ${c.name} and takes the initiative.`
        const ct = ev.counter
        if (ct?.card !== null && ct?.card !== undefined) {
          const cc = cardOf(G0, d, ct.card)
          lines.push(`Counter: ${cc.name} (${cc.speed} + ${G0.R.initiativeBonus} against ${c.speed}). ${landLine(ct.result, d, cc, ev, names)}`)
        } else if (ct?.options) lines.push(`${names[d]} could counter, but doesn't.`)
        else lines.push(`Nothing of ${names[d]}'s is fast enough to counter ${c.name} (Speed ${c.speed}).`)
      }
    }
  } else {
    const k = ev.att, d = 1 - k
    const ap = ev.picks[k], dp = ev.picks[d]
    const c = cardOf(G0, k, ap)
    const defWord = dp === 'G' ? 'holds' : `plays ${UNIVERSAL[dp].name}`
    if (ev.result === 'lands') {
      title = `Lands · pile ${player(N, d).pile}`
      sub = `${c.name} (${STR_LABEL[c.link]}, ${c.grey} grey) lands. ${names[d]} ${dp === 'G' ? 'holds' : `guessed ${UNIVERSAL[dp].name}`}.`
      if (ev.wrongBreak && G0.R.wrongBreakLocks) lines.push(`The wrong guess locks ${UNIVERSAL[dp].name} for the next beat.`)
    } else if (ev.result === 'broken') {
      title = 'Broken'
      sub = `${UNIVERSAL[dp].name} reads ${c.name}. ${names[d]}'s pile${ev.cleared ? ` (${ev.cleared})` : ''} clears, ${names[d]} takes the initiative, and the combo ends.`
    } else if (ev.result === 'locked') {
      title = 'Feint'
      sub = `${names[k]} holds back and ${names[d]}'s ${UNIVERSAL[dp].name} is locked for the next beat.`
    } else if (ev.result === 'dropped') {
      title = 'Dropped'
      sub = `${names[k]} feints and ${names[d]} holds. The combo ends; the grey stays on the pile, and ${names[d]} takes the initiative.`
    } else if (ev.result === 'cashed') {
      title = `Cashed · ${ev.dmg[d]} damage`
      sub = `${c.name} cashes ${ev.cashed} grey${ev.bonus ? ` plus ${ev.bonus}` : ''}. ${names[d]} ${defWord === 'holds' ? 'held' : `played ${UNIVERSAL[dp].name}, which does nothing against an ender`}. ${ev.init1 === k ? `${names[k]} keeps the initiative.` : `${names[d]} takes the initiative.`}`
    }
  }
  if (ev.blowout) lines.push(`Blowout: ${names[1 - holder]} has no legal card left, so the combo ends. The grey stays, and ${names[holder]} takes the initiative.`)
  if (ev.ko) lines.push(`K.O.`)
  if (ev.timeout) lines.push('Time out: the player with more HP wins.')
  if (ev.limit) lines.push(`Reveal limit reached (${G0.R.maxReveals}): a draw.`)
  return { title, sub, lines }
}

function landLine(result, k, c, ev, names) {
  const d = 1 - k
  if (result === 'thrown') {
    const cash = ev.throwCash ? `${c.hit} damage plus ${ev.throwCash} cashed from ${names[d]}'s pile` : `${c.hit} damage`
    return `${cash}${c.grey ? `, then ${c.grey} grey on ${names[d]}'s pile` : ''}. ${names[k]} takes the initiative.`
  }
  return `${c.hit} damage, and ${names[k]} starts a combo.`
}

export function deltaLine(before, after) {
  const d = after.hp - before.hp, p = after.pile - before.pile
  const parts = []
  if (d) parts.push(`${d > 0 ? '+' : ''}${d} HP`)
  if (p) parts.push(`${p > 0 ? '+' : ''}${p} grey`)
  return parts.join(' · ') || 'no change'
}
