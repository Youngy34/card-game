// Guard > Strike > Crush > Guard
const BEATS = { guard: 'strike', strike: 'crush', crush: 'guard' }

export function resolveClash(card0, card1) {
  const p0 = card0.priority
  const p1 = card1.priority
  const t0 = card0.type
  const t1 = card1.type

  // Both X → standoff regardless of type
  if (p0 === 'X' && p1 === 'X') {
    return { winner: 'standoff', reason: 'Both cards have X priority' }
  }

  // Same type
  if (t0 === t1) {
    if (p0 === 'X' || p1 === 'X') {
      return { winner: 'standoff', reason: `Same type (${t0}) with an X priority` }
    }
    if (p0 > p1) return { winner: 0, reason: `Higher priority (${p0} vs ${p1})` }
    if (p1 > p0) return { winner: 1, reason: `Higher priority (${p1} vs ${p0})` }
    return { winner: 'standoff', reason: `Priority tie (${p0} vs ${p1})` }
  }

  // Different types → triangle (X is treated as a type here for triangle purposes)
  if (BEATS[t0] === t1) return { winner: 0, reason: `${t0} beats ${t1}` }
  if (BEATS[t1] === t0) return { winner: 1, reason: `${t1} beats ${t0}` }

  // Shouldn't reach here with valid types
  return { winner: 'standoff', reason: 'Unknown type matchup' }
}

export function applyForceClashResult(rawResult, cards) {
  let result = { ...rawResult }
  for (let i = 0; i < 2; i++) {
    const card = cards[i]
    if (!card) continue
    for (const effect of card.clashEffects || []) {
      if (effect.type === 'forceClashResult' && effect.result === 'win' && effect.overrides === 'standoff') {
        if (result.winner === 'standoff') {
          result = {
            winner: i,
            reason: `${card.name} overrides standoff — ${cards[i].name} wins`,
            forced: true
          }
        }
      }
    }
  }
  return result
}

export function isValidComboFollow(prevCard, nextCard) {
  // Starter cannot be a follow-up
  if (nextCard.combo === 'starter') return false
  // If previous was Ender, chain is closed
  if (prevCard && prevCard.combo === 'ender') return false
  return true
}

export function canStartCombo(card) {
  // Any card can be the first in a punish chain (it's the winning clash card)
  return true
}

export function isComboFinished(chain) {
  if (chain.length === 0) return false
  return chain[chain.length - 1].combo === 'ender'
}

export function coinFlip() {
  return Math.random() < 0.5 ? 0 : 1
}
