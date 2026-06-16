import { drawCards } from './loader.js'

// Returns { stateUpdates, fallbackNeeded, logEntries }
// stateUpdates is a partial state patch; merge it onto state in the reducer.

export function executeNeutralEffects(card, ownerIdx, state) {
  const updates = {}
  const logs = []
  const fallbacks = []

  for (const effect of card.neutralEffects || []) {
    const result = executeEffect(effect, ownerIdx, state, { card, context: 'neutral' })
    if (result.fallback) {
      fallbacks.push({ card, effect, context: 'neutral play' })
    } else {
      mergeUpdates(updates, result.updates)
      logs.push(...(result.logs || []))
    }
  }

  return { updates, logs, fallbacks }
}

export function executeClashEffects(card, ownerIdx, clashResult, state, chainIndex = 0) {
  const updates = {}
  const logs = []
  const fallbacks = []

  for (const effect of card.clashEffects || []) {
    if (!conditionMet(effect, ownerIdx, clashResult, state, chainIndex)) continue
    const result = executeEffect(effect, ownerIdx, state, { card, context: 'clash', clashResult, chainIndex })
    if (result.fallback) {
      fallbacks.push({ card, effect, context: `${card.name} clash effect` })
    } else {
      mergeUpdates(updates, result.updates)
      logs.push(...(result.logs || []))
    }
  }

  return { updates, logs, fallbacks }
}

export function executePassiveEffects(passive, ownerIdx, trigger, state, extra = {}) {
  const updates = {}
  const logs = []
  const fallbacks = []

  for (const effect of passive.effects || []) {
    if (effect.trigger !== trigger) continue
    if (!passiveConditionMet(effect, ownerIdx, state, extra)) continue
    const result = executeEffect(effect, ownerIdx, state, { passive, context: 'passive', trigger, ...extra })
    if (result.fallback) {
      fallbacks.push({ card: passive, effect, context: `${passive.name} passive` })
    } else {
      mergeUpdates(updates, result.updates)
      logs.push(...(result.logs || []))
    }
  }

  return { updates, logs, fallbacks }
}

function conditionMet(effect, ownerIdx, clashResult, _state, _chainIndex) {
  if (!effect.trigger) return true
  if (effect.trigger === 'onWin') return clashResult.winner === ownerIdx
  if (effect.trigger === 'onLoss') return clashResult.winner !== ownerIdx && clashResult.winner !== 'standoff'
  return true
}

function passiveConditionMet(effect, ownerIdx, state, extra) {
  if (!effect.condition) return true
  const cond = effect.condition
  if (cond.type === 'firstTimePerTurn') {
    return state.players[ownerIdx].unflinchingAvailable === true
  }
  return true
}

function executeEffect(effect, ownerIdx, state, _ctx) {
  const oppIdx = 1 - ownerIdx

  switch (effect.type) {
    case 'chargeSuper': {
      return chargeSuper(ownerIdx, effect.amount, state)
    }

    case 'draw': {
      const target = effect.target === 'self' ? ownerIdx : oppIdx
      return drawEffect(target, effect.amount, state)
    }

    case 'dealDamage': {
      const target = effect.target === 'opponent' ? oppIdx : ownerIdx
      return dealDamageEffect(target, effect.amount)
    }

    case 'opponentDiscards': {
      return opponentDiscardsEffect(oppIdx, effect.amount, state)
    }

    case 'reduceNextDamage': {
      const target = effect.target === 'self' ? ownerIdx : oppIdx
      return reduceNextDamageEffect(target, effect.amount, state)
    }

    case 'setTrap': {
      return setTrapEffect(ownerIdx, effect, state)
    }

    case 'modifyDamage':
    case 'damageEvenOnLoss':
    case 'forceClashResult':
      // Handled inline in combat resolution, not here
      return { updates: {}, logs: [] }

    default:
      return { fallback: true }
  }
}

function chargeSuper(ownerIdx, amount, state) {
  const player = state.players[ownerIdx]
  const newGauge = player.superGauge + amount
  const threshold = state.globals.superGaugeThreshold
  const logs = [`${player.name} charges Super (+${amount}) → ${Math.min(newGauge, threshold)}/${threshold}`]

  const updates = {}
  // Just update the gauge; handleSuperUnlock in the reducer hands out the card
  updates[`players.${ownerIdx}.superGauge`] = Math.min(newGauge, threshold)

  return { updates, logs }
}

function drawEffect(targetIdx, amount, state) {
  const player = state.players[targetIdx]
  const { deck, discard, drawn } = drawCards(player.deck, player.discard, amount)
  const logs = [`${player.name} draws ${drawn.length} card${drawn.length !== 1 ? 's' : ''}`]
  return {
    updates: {
      [`players.${targetIdx}.deck`]: deck,
      [`players.${targetIdx}.discard`]: discard,
      [`players.${targetIdx}.hand`]: [...player.hand, ...drawn]
    },
    logs
  }
}

function dealDamageEffect(targetIdx, amount) {
  return {
    updates: { [`_pendingDamage.${targetIdx}`]: amount },
    logs: []
  }
}

function opponentDiscardsEffect(oppIdx, amount, state) {
  const opp = state.players[oppIdx]
  // For MVP: discard from top of hand (first card)
  const toDiscard = opp.hand.slice(0, amount)
  const remaining = opp.hand.slice(amount)
  const logs = toDiscard.length > 0
    ? [`${opp.name} discards: ${toDiscard.map(c => c.name).join(', ')}`]
    : [`${opp.name} has no cards to discard`]
  return {
    updates: {
      [`players.${oppIdx}.hand`]: remaining,
      [`players.${oppIdx}.discard`]: [...opp.discard, ...toDiscard]
    },
    logs
  }
}

function reduceNextDamageEffect(targetIdx, amount, state) {
  const current = state.players[targetIdx].damageReduction || 0
  return {
    updates: { [`players.${targetIdx}.damageReduction`]: current + amount },
    logs: [`${state.players[targetIdx].name} reduces next incoming damage by ${amount}`]
  }
}

function setTrapEffect(ownerIdx, effect, state) {
  const trap = {
    owner: ownerIdx,
    trigger: effect.trigger,
    window: effect.window,
    effect: effect.effect,
    setOnTurn: state.turnNumber
  }
  const logs = [`${state.players[ownerIdx].name} sets a trap!`]
  return {
    updates: { traps: [...state.traps, trap] },
    logs
  }
}

// Compute total combo damage, applying all modifiers in order
export function computeComboDamage(chain, executorIdx, loserIdx, state) {
  let total = 0
  const logs = []

  for (let i = 0; i < chain.length; i++) {
    const card = chain[i]
    let cardDmg = card.damage

    // modifyDamage effects (e.g. Hundred Fang: +1 per other card in chain before it)
    for (const effect of card.clashEffects || []) {
      if (effect.type === 'modifyDamage' && effect.per === 'otherCardInCombo') {
        cardDmg += effect.amount * i // i cards came before this one
        logs.push(`${card.name}: +${effect.amount * i} (${i} prior chain cards)`)
      }
    }

    total += cardDmg
  }

  // Loser's passive: Unflinching (modifyDamage on first loss per turn)
  const loser = state.players[loserIdx]
  if (loser.unflinchingAvailable) {
    const passive = loser.passive
    for (const effect of passive?.effects || []) {
      if (
        effect.type === 'modifyDamage' &&
        effect.trigger === 'onLoseClash' &&
        effect.appliesTo === 'incomingCombo' &&
        effect.condition?.type === 'firstTimePerTurn'
      ) {
        total = Math.max(0, total + effect.amount)
        logs.push(`${loser.name} Unflinching: ${effect.amount} damage`)
      }
    }
  }

  // Brace / damageReduction status
  const reduction = loser.damageReduction || 0
  if (reduction > 0) {
    total = Math.max(0, total - reduction)
    logs.push(`${loser.name} damage reduction: -${reduction}`)
  }

  return { total, logs }
}

// Check and fire traps when opponent takes a neutral turn
export function checkTrapsTrigger(trigger, actorIdx, state) {
  const updates = {}
  const logs = []
  const remainingTraps = []

  for (const trap of state.traps) {
    if (trap.owner !== 1 - actorIdx) { remainingTraps.push(trap); continue }
    if (trap.trigger !== trigger) { remainingTraps.push(trap); continue }

    // Fire the trap
    if (trap.effect.type === 'dealDamage') {
      const targetIdx = trap.effect.target === 'opponent' ? actorIdx : trap.owner
      updates[`_pendingDamage.${targetIdx}`] = (updates[`_pendingDamage.${targetIdx}`] || 0) + trap.effect.amount
      logs.push(`Trap fires! ${state.players[actorIdx].name} takes ${trap.effect.amount} damage`)
    }
    // Trap consumed; don't push to remaining
  }

  updates.traps = remainingTraps
  return { updates, logs }
}

// Expire traps at start of ownerIdx's turn
export function expireTraps(ownerIdx, state) {
  const remaining = state.traps.filter(trap => {
    if (trap.owner !== ownerIdx) return true
    if (trap.window === 'untilYourNextTurn') return false
    return true
  })
  return remaining
}

function mergeUpdates(target, source) {
  for (const [k, v] of Object.entries(source)) {
    target[k] = v
  }
}
