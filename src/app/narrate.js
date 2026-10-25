// Plain-language account of a resolved round, from the engine's events.

import { card, outcome } from '../engine/engine.js'
import { TYPE_LABEL, KINDS } from '../engine/keywords.js'

const kindOf = c => KINDS[c.kind]?.label || TYPE_LABEL[c.t]

export function outcomeLine(ca, cb) {
  const o = outcome(ca, cb)
  // rules v12
  if (o === 'trade') return { title: `${kindOf(ca)} trade`, sub: `Same speed (${ca.speed}): both land` }
  if (o === 'cancel') return { title: 'Projectiles cancel', sub: 'They collide: neither lands' }
  if (o === 'tech') return { title: 'Grabs tech', sub: 'Neither lands' }
  if (o === 'recovers') return { title: 'Both defend', sub: 'Each clears their own pile; no attack to turn back' }
  if (o === 'setup') {
    if (ca.t === 'T' && cb.t === 'T') return { title: 'Two Setups', sub: 'Both take effect' }
    const [s, x] = ca.t === 'T' ? [ca, cb] : [cb, ca]
    if (x.t === 'P' || x.t === 'C') return { title: 'Setup interrupted', sub: `${x.name} lands; ${s.name} doesn't finish` }
    return { title: 'Setup lands', sub: `${s.name} takes effect; ${x.name} clears its own pile` }
  }
  if ((o === 'A' || o === 'B') && ca.kind && ca.t === cb.t) {
    const [w, l] = o === 'A' ? [ca, cb] : [cb, ca]
    return { title: `${kindOf(w)} is faster`, sub: `${w.name} (speed ${w.speed}) beats ${l.name} (speed ${l.speed})`, winner: o === 'A' ? 0 : 1 }
  }
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
      // rules v12
      case 'faster': L.push(`is faster (speed ${e.n} to ${e.m})`); break
      case 'cancel': L.push('collides with the other projectile, and both cancel'); break
      case 'tech': L.push('is teched'); break
      case 'interrupted': L.push("is interrupted and doesn't finish"); break
      case 'turnBuild': L.push(`is guarded: its ${e.n} Build goes on ${me}'s own pile`); break
      case 'chipThrough': L.push(`but its ${e.n} chip gets through the guard`); break
      case 'turnChip': L.push(`is countered: its ${e.n} chip hits ${me}`); break
      case 'knockdown': L.push(`knocks ${op} down: no Pressure next round`); break
    }
  }
  const beaten = k => (last.s.beaten ? last.s.beaten[k] : !last.s.resolved[k])
  return [0, 1].map(k => ({
    card: cards[k].name,
    text: lines[k].length ? lines[k].join(', ') : beaten(k) ? 'is beaten' : !last.s.resolved[k] ? "doesn't land" : 'does nothing',
    beaten: beaten(k),
  }))
}

export function deltaLine(before, after) {
  const d = after.hp - before.hp, p = after.pile - before.pile
  const parts = []
  if (d) parts.push(`${d > 0 ? '+' : ''}${d} HP`)
  if (p) parts.push(`${p > 0 ? '+' : ''}${p} grey`)
  return parts.join(' · ') || 'no change'
}
