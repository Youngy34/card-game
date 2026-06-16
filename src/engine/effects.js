import { drawCards } from './loader.js'

// ─── Unified condition checker ────────────────────────────────────────────────

export function checkCondition(condition, ownerIdx, state, extra = {}) {
  if (!condition) return true
  const opp = state.players[1 - ownerIdx]
  switch (condition.type) {
    case 'firstTimePerTurn':
      return state.players[ownerIdx].unflinchingAvailable === true
    case 'isCounter':
      return state.isCounterCombo === true
    case 'previousTurnWasNeutral':
      return state.players[ownerIdx].lastTurnWasNeutral === true
    case 'opponentHandSizeAtMost':
      return opp.hand.length <= condition.amount
    case 'opponentAtOrBelowHalfHP':
      return opp.hp <= opp.maxHP / 2
    case 'opponentForeseen':
      return (opp.statuses || []).some(s => s.type === 'foreseen')
    case 'damageDealtAtLeast':
      return (extra.damageDealt || 0) >= condition.amount
    case 'allOf':
      return (condition.conditions || []).every(c => checkCondition(c, ownerIdx, state, extra))
    default:
      return true
  }
}

// ─── Effect executors ─────────────────────────────────────────────────────────

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

export function executeClashEffects(card, ownerIdx, clashResult, state) {
  const updates = {}
  const logs = []
  const fallbacks = []

  for (const effect of card.clashEffects || []) {
    if (!triggerMet(effect, ownerIdx, clashResult)) continue
    if (!checkCondition(effect.condition, ownerIdx, state, { isCounter: state.isCounterCombo })) continue
    const result = executeEffect(effect, ownerIdx, state, { card, context: 'clash', clashResult })
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
    if (!checkCondition(effect.condition, ownerIdx, state, extra)) continue
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

function triggerMet(effect, ownerIdx, clashResult) {
  if (!effect.trigger) return true
  if (effect.trigger === 'onWin') return clashResult.winner === ownerIdx
  if (effect.trigger === 'onLoss') return clashResult.winner !== ownerIdx && clashResult.winner !== 'standoff'
  return true
}

function executeEffect(effect, ownerIdx, state, _ctx) {
  const oppIdx = 1 - ownerIdx

  switch (effect.type) {
    case 'chargeSuper':
      return chargeSuper(ownerIdx, effect.amount, state)

    case 'draw': {
      const target = effect.target === 'self' ? ownerIdx : oppIdx
      return drawEffect(target, effect.amount, state)
    }

    case 'dealDamage': {
      const target = effect.target === 'opponent' ? oppIdx : ownerIdx
      let amount = effect.amount
      if (effect.overrideAmount) {
        const condOk = checkCondition(effect.overrideAmount.condition, ownerIdx, state, {})
        if (condOk) amount = effect.overrideAmount.amount
      }
      return dealDamageEffect(target, amount)
    }

    case 'opponentDiscards':
      return opponentDiscardsEffect(oppIdx, effect.amount, state)

    case 'reduceNextDamage': {
      const target = effect.target === 'self' ? ownerIdx : oppIdx
      return reduceNextDamageEffect(target, effect.amount, state)
    }

    case 'setTrap':
      return setTrapEffect(ownerIdx, effect, state)

    case 'modifyDamage':
    case 'damageEvenOnLoss':
    case 'forceClashResult':
      // Handled in combat resolution / computeComboDamage
      return { updates: {}, logs: [] }

    default:
      return { fallback: true }
  }
}

// ─── Effect primitives ────────────────────────────────────────────────────────

function chargeSuper(ownerIdx, amount, state) {
  const player = state.players[ownerIdx]
  const newGauge = player.superGauge + amount
  const threshold = state.globals.superGaugeThreshold
  const logs = [`${player.name} charges Super (+${amount}) → ${Math.min(newGauge, threshold)}/${threshold}`]
  return {
    updates: { [`players.${ownerIdx}.superGauge`]: Math.min(newGauge, threshold) },
    logs
  }
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
  return { updates: { [`_pendingDamage.${targetIdx}`]: amount }, logs: [] }
}

function opponentDiscardsEffect(oppIdx, amount, state) {
  const opp = state.players[oppIdx]
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
  return {
    updates: { traps: [...state.traps, trap] },
    logs: [`${state.players[ownerIdx].name} sets a trap (fires on: ${effect.trigger})`]
  }
}

// ─── Combo damage calculation ─────────────────────────────────────────────────

export function computeComboDamage(chain, executorIdx, loserIdx, state) {
  let total = 0
  const logs = []
  const oppHand = state.players[loserIdx].hand

  for (let i = 0; i < chain.length; i++) {
    const card = chain[i]
    let cardDmg = card.damage

    for (const effect of card.clashEffects || []) {
      if (effect.type !== 'modifyDamage') continue

      if (effect.per === 'otherCardInCombo') {
        const bonus = effect.amount * i
        if (bonus !== 0) {
          cardDmg += bonus
          logs.push(`${card.name}: +${bonus} (${i} prior chain card${i !== 1 ? 's' : ''})`)
        }
        continue
      }

      if (effect.per === 'opponentCardBelow4') {
        const below4 = Math.max(0, 4 - oppHand.length)
        const bonus = effect.amount * below4
        if (bonus !== 0) {
          cardDmg += bonus
          logs.push(`${card.name}: +${bonus} (opponent ${oppHand.length} card${oppHand.length !== 1 ? 's' : ''}, ${below4} below 4)`)
        }
        continue
      }

      // Conditional flat modifier (Knee Bash isCounter, Outthink opponentForeseen, etc.)
      const condOk = checkCondition(effect.condition, executorIdx, state, { isCounter: state.isCounterCombo })
      if (condOk) {
        cardDmg += effect.amount
        logs.push(`${card.name}: ${effect.amount > 0 ? '+' : ''}${effect.amount} (${conditionLabel(effect.condition)})`)
      }
    }

    total += cardDmg
  }

  // Executor's passive: modifyDamage on clash win (e.g. Bastion's Charge)
  const execPassive = state.players[executorIdx].passive
  for (const eff of execPassive?.effects || []) {
    if (eff.type !== 'modifyDamage') continue
    if (eff.trigger && eff.trigger !== 'onWinClash') continue
    const condOk = checkCondition(eff.condition, executorIdx, state, { isCounter: state.isCounterCombo })
    if (condOk) {
      total = Math.max(0, total + eff.amount)
      logs.push(`${state.players[executorIdx].name} ${execPassive.name}: ${eff.amount > 0 ? '+' : ''}${eff.amount} damage`)
    }
  }

  // Loser's passive: reduce incoming combo damage (e.g. Atlas's Unflinching)
  const loserPassive = state.players[loserIdx].passive
  for (const eff of loserPassive?.effects || []) {
    if (eff.type !== 'modifyDamage') continue
    if (eff.trigger !== 'onLoseClash') continue
    if (eff.appliesTo !== 'incomingCombo') continue
    const condOk = checkCondition(eff.condition, loserIdx, state, {})
    if (condOk) {
      total = Math.max(0, total + eff.amount) // amount is negative
      logs.push(`${state.players[loserIdx].name} ${loserPassive.name}: ${eff.amount} damage`)
    }
  }

  // Brace / reduceNextDamage status
  const reduction = state.players[loserIdx].damageReduction || 0
  if (reduction > 0) {
    total = Math.max(0, total - reduction)
    logs.push(`${state.players[loserIdx].name} damage reduction: -${reduction}`)
  }

  return { total, logs }
}

// ─── Trap system ──────────────────────────────────────────────────────────────

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
    // Trap is always consumed on firing regardless of window
  }

  updates.traps = remainingTraps
  return { updates, logs }
}

export function expireTraps(ownerIdx, state) {
  // Remove traps owned by ownerIdx whose window expires at the owner's next turn
  return state.traps.filter(trap => {
    if (trap.owner !== ownerIdx) return true
    if (trap.window === 'untilYourNextTurn') return false
    return true // 'untilTriggered' traps persist until fired
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mergeUpdates(target, source) {
  for (const [k, v] of Object.entries(source)) {
    target[k] = v
  }
}

function conditionLabel(condition) {
  if (!condition) return 'unconditional'
  switch (condition.type) {
    case 'isCounter': return 'counter combo'
    case 'opponentForeseen': return 'opponent Foreseen'
    case 'opponentHandSizeAtMost': return `opp ≤${condition.amount} cards`
    case 'previousTurnWasNeutral': return 'prev turn neutral'
    case 'opponentAtOrBelowHalfHP': return 'opp at half HP'
    default: return condition.type
  }
}
