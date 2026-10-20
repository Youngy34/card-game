// Plain-language account of a resolved round, from the engine's events.

import { card, outcome } from '../engine/engine.js'
import { TYPE_LABEL } from '../engine/keywords.js'

export function outcomeLine(ca, cb) {
  const o = outcome(ca, cb)
  if (o === 'typeless') return { title: 'Both resolve', sub: ca.t === 'T' && cb.t === 'T' ? 'Two typeless cards' : 'A typeless card neither wins nor loses' }
  if (o === 'mirror') return { title: `${TYPE_LABEL[ca.t]} mirror`, sub: 'Same type: both resolve' }
  const [w, l] = o === 'A' ? [ca, cb] : [cb, ca]
  return { title: `${TYPE_LABEL[w.t]} beats ${TYPE_LABEL[l.t]}`, sub: `${w.name} resolves; ${l.name} is beaten`, winner: o === 'A' ? 0 : 1 }
}

// One line per player: what their card did
export function eventLines(last, names) {
  const [A, B] = last.before
  const cards = [card(A, last.a), card(B, last.b)]
  const lines = [[], []]
  for (const e of last.events) {
    const me = names[e.side], op = names[1 - e.side]
    const L = lines[e.side]
    switch (e.kind) {
      case 'build': L.push(`builds ${e.n} on ${op}'s pile`); break
      case 'cash': L.push(e.n ? `cashes ${e.n} from ${op}'s pile` : `cashes an empty pile`); break
      case 'chip': L.push(`chips ${e.n}`); break
      case 'clear': L.push(e.n ? `clears ${e.n} from ${me}'s pile` : `clears an empty pile`); break
      case 'clearOwn': L.push(`also clears ${e.n} from ${me}'s own pile`); break
      case 'selfAdd': L.push(`costs ${e.n} on ${me}'s own pile`); break
      case 'onLoss': L.push(`on loss, adds ${e.n} to ${me}'s own pile`); break
      case 'lock': L.push(`pushes ${op}'s card one space further on cooldown`); break
      case 'stagger': L.push(`staggers: ${op} can't play a ${TYPE_LABEL[e.t]} next round`); break
      case 'return': L.push(`returns a card from cooldown`); break
    }
  }
  return [0, 1].map(k => ({
    card: cards[k].name,
    text: lines[k].length ? lines[k].join(', ') : !last.s.resolved[k] ? 'is beaten' : 'does nothing',
    beaten: !last.s.resolved[k],
  }))
}

export function deltaLine(before, after) {
  const d = after.hp - before.hp, p = after.pile - before.pile
  const parts = []
  if (d) parts.push(`${d > 0 ? '+' : ''}${d} HP`)
  if (p) parts.push(`${p > 0 ? '+' : ''}${p} grey`)
  return parts.join(' · ') || 'no change'
}
