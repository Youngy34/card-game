import { buildDeck, drawCards } from './loader.js'
import { resolveClash, applyForceClashResult, isValidComboFollow, isComboFinished, coinFlip } from './rules.js'
import {
  executeNeutralEffects, executeClashEffects, executePassiveEffects,
  computeComboDamage, checkTrapsTrigger, expireTraps
} from './effects.js'

// ─── Initial state ───────────────────────────────────────────────────────────

export const initialState = {
  gameData: null,
  loadError: null,
  phase: 'loading',
  passDevice: null,
  deviceHolder: null,
  players: [null, null],
  selectedCharacters: [null, null],
  activePlayer: 0,
  clashZone: { declarer: null, cards: [null, null], revealed: false, result: null },
  comboExecutor: null,
  comboChain: [],
  isCounterCombo: false,
  fallbackQueue: [],
  afterFallback: null,
  traps: [],
  turnNumber: 0,
  playerTurns: [0, 0],
  log: [],
  winner: null,
  winReason: null,
  globals: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addLog(state, entries) {
  const arr = Array.isArray(entries) ? entries : [entries]
  return { ...state, log: [...state.log, ...arr.map(msg => ({ msg, turn: state.turnNumber }))] }
}

function applyPatch(state, patch) {
  if (!patch || Object.keys(patch).length === 0) return state
  const s = { ...state }
  const newPlayers = [...state.players]

  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith('_')) continue
    if (key === 'traps') { s.traps = value; continue }
    if (key.startsWith('players.')) {
      const parts = key.split('.')
      const i = parseInt(parts[1])
      newPlayers[i] = { ...newPlayers[i], [parts[2]]: value }
      continue
    }
    s[key] = value
  }

  s.players = newPlayers
  return s
}

function extractDamage(patch) {
  const out = {}
  for (const [k, v] of Object.entries(patch || {})) {
    if (k.startsWith('_pendingDamage.')) out[parseInt(k.split('.')[1])] = v
  }
  return out
}

function applyDamage(state, damages) {
  if (!damages || Object.keys(damages).length === 0) return { state, logs: [] }
  const newPlayers = [...state.players]
  const logs = []
  for (const [idxStr, amt] of Object.entries(damages)) {
    const i = parseInt(idxStr)
    const newHP = Math.max(0, newPlayers[i].hp - amt)
    newPlayers[i] = { ...newPlayers[i], hp: newHP }
    logs.push(`${newPlayers[i].name} takes ${amt} damage → ${newHP} HP`)
  }
  return { state: { ...state, players: newPlayers }, logs }
}

function checkGameOver(state) {
  for (let i = 0; i < 2; i++) {
    if (state.players[i].hp <= 0) {
      const winner = 1 - i
      return { ...state, phase: 'gameOver', winner, winReason: `${state.players[i].name} ran out of HP` }
    }
  }
  const cap = state.globals.simTurnCapPerPlayer
  if (state.playerTurns[0] >= cap && state.playerTurns[1] >= cap) {
    return { ...state, phase: 'gameOver', winner: null, winReason: `Turn cap reached (${cap} turns per player) — stall` }
  }
  return null
}

function makePlayer(char, basics, globals) {
  const { deck, superCard } = buildDeck(char, basics)
  const { deck: remaining, discard: _, drawn: hand } = drawCards(deck, [], globals.handSize)
  return {
    characterId: char.id,
    name: char.name,
    hp: char.baseHP,
    maxHP: char.baseHP,
    superGauge: 0,
    hand,
    deck: remaining,
    discard: [],
    superCard,
    superInHand: false,
    passive: char.passive,
    unflinchingAvailable: true,
    damageReduction: 0,
    lastTurnWasNeutral: false,
    statuses: [],
  }
}

function passTo(state, to, message, nextPhase) {
  return { ...state, phase: 'passDevice', passDevice: { to, message, nextPhase }, deviceHolder: null }
}

function endTurn(state, drawnBy, { wasNeutral = false } = {}) {
  // Clear the clash zone between turns
  let s = { ...state, clashZone: { declarer: null, cards: [null, null], revealed: false, result: null } }
  const player = s.players[drawnBy]
  const { deck, discard, drawn } = drawCards(player.deck, player.discard, s.globals.drawPerTurn)
  const newPlayers = [...s.players]
  newPlayers[drawnBy] = { ...player, hand: [...player.hand, ...drawn], deck, discard, lastTurnWasNeutral: wasNeutral }
  s = { ...s, players: newPlayers }
  if (drawn.length > 0) s = addLog(s, `${player.name} draws ${drawn.length} card${drawn.length !== 1 ? 's' : ''}`)

  // Expire traps set by the player whose turn is about to start (the opponent)
  const nextActive = 1 - drawnBy
  s = { ...s, traps: expireTraps(nextActive, s) }

  // Reset turn-scoped state for next active player
  const np2 = [...s.players]
  np2[nextActive] = { ...np2[nextActive], unflinchingAvailable: true }
  s = { ...s, players: np2 }

  // Advance turn
  const newPlayerTurns = [...s.playerTurns]
  newPlayerTurns[drawnBy]++
  s = { ...s, turnNumber: s.turnNumber + 1, activePlayer: nextActive, playerTurns: newPlayerTurns }

  // Check stall
  const over = checkGameOver(s)
  if (over) return over

  return passTo(s, nextActive, `Pass to ${s.players[nextActive].name}`, 'awaitingAction')
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function gameReducer(state, action) {
  switch (action.type) {

    case 'LOAD_DATA': {
      return { ...state, gameData: action.gameData, globals: action.gameData.globals, phase: 'setup', loadError: null }
    }

    case 'LOAD_ERROR': {
      return { ...state, loadError: action.error, phase: 'loadError' }
    }

    case 'SELECT_CHARACTER': {
      const sel = [...state.selectedCharacters]
      sel[action.playerIndex] = action.characterId
      return { ...state, selectedCharacters: sel }
    }

    case 'START_GAME': {
      const { gameData, globals } = state
      const char0 = gameData.characters.find(c => c.id === state.selectedCharacters[0])
      const char1 = gameData.characters.find(c => c.id === state.selectedCharacters[1])
      const p0 = makePlayer(char0, gameData.basics, globals)
      const p1 = makePlayer(char1, gameData.basics, globals)

      let first
      if (p0.hp < p1.hp) first = 0
      else if (p1.hp < p0.hp) first = 1
      else first = coinFlip()

      const reason = p0.hp !== p1.hp
        ? `${[p0, p1][first].name} has lower base HP`
        : 'Coin flip'

      let s = {
        ...state,
        players: [p0, p1],
        activePlayer: first,
        clashZone: { declarer: null, cards: [null, null], revealed: false, result: null },
        comboExecutor: null, comboChain: [], isCounterCombo: false,
        fallbackQueue: [], afterFallback: null,
        traps: [], turnNumber: 0, playerTurns: [0, 0],
        log: [], winner: null, winReason: null,
      }
      s = addLog(s, [`Match start: ${p0.name} vs ${p1.name}`, `${[p0, p1][first].name} goes first (${reason})`])
      return passTo(s, first, `Pass to ${[p0, p1][first].name} — your turn`, 'awaitingAction')
    }

    case 'UPDATE_GLOBALS': {
      return { ...state, globals: { ...state.globals, ...action.patch } }
    }

    case 'CONFIRM_PASS': {
      const { passDevice } = state
      if (!passDevice) return state
      return { ...state, phase: passDevice.nextPhase, passDevice: null, deviceHolder: passDevice.to }
    }

    case 'TAKE_NEUTRAL': {
      const { activePlayer } = state
      const player = state.players[activePlayer]
      const card = player.hand[action.cardIndex]
      if (!card) return state

      // Remove card from hand
      const newHand = player.hand.filter((_, i) => i !== action.cardIndex)
      let s = { ...state, players: state.players.map((p, i) => i === activePlayer ? { ...p, hand: newHand } : p) }
      s = addLog(s, `${player.name} takes Neutral: plays ${card.name}`)

      // Check traps: opponent set a "opponentTakesNeutralTurn" trap
      const { updates: trapUp, logs: trapLogs } = checkTrapsTrigger('opponentTakesNeutralTurn', activePlayer, s)
      s = applyPatch(s, trapUp)
      if (trapLogs.length) s = addLog(s, trapLogs)
      const trapDmg = extractDamage(trapUp)
      if (Object.keys(trapDmg).length > 0) {
        const { state: s2, logs: dmgLogs } = applyDamage(s, trapDmg)
        s = s2
        s = addLog(s, dmgLogs)
        const over = checkGameOver(s)
        if (over) return over
      }

      // Execute neutral effects
      const { updates, logs: effLogs, fallbacks } = executeNeutralEffects(card, activePlayer, s)
      s = applyPatch(s, updates)
      if (effLogs.length) s = addLog(s, effLogs)

      // Apply any immediate damage from effects
      const pending = extractDamage(updates)
      if (Object.keys(pending).length > 0) {
        const { state: s2, logs: dmgLogs } = applyDamage(s, pending)
        s = s2; s = addLog(s, dmgLogs)
        const over = checkGameOver(s)
        if (over) return over
      }

      // Handle super gauge — check if player now has super
      s = handleSuperUnlock(s, activePlayer)

      // Discard the card
      const pp = [...s.players]
      pp[activePlayer] = { ...pp[activePlayer], discard: [...pp[activePlayer].discard, card] }
      s = { ...s, players: pp }

      // Fallback for unresolved effects
      if (fallbacks.length > 0) {
        return { ...s, phase: 'awaitingFallback', fallbackQueue: fallbacks, afterFallback: { type: 'END_NEUTRAL', drawnBy: activePlayer } }
      }

      return endTurn(s, activePlayer, { wasNeutral: true })
    }

    case 'DECLARE_CLASH': {
      const { activePlayer } = state
      const player = state.players[activePlayer]
      const card = player.hand[action.cardIndex]
      if (!card) return state

      const newHand = player.hand.filter((_, i) => i !== action.cardIndex)
      const newCards = [...state.clashZone.cards]
      newCards[activePlayer] = card

      let s = {
        ...state,
        players: state.players.map((p, i) => i === activePlayer ? { ...p, hand: newHand } : p),
        clashZone: { declarer: activePlayer, cards: newCards, revealed: false, result: null },
      }
      s = addLog(s, `${player.name} declares a Clash`)

      // Fire traps that trigger when a Clash is declared (e.g. Ensnare, Lockdown)
      const { updates: trapUp, logs: trapLogs } = checkTrapsTrigger('opponentDeclaresClash', activePlayer, s)
      s = applyPatch(s, trapUp)
      if (trapLogs.length) s = addLog(s, trapLogs)
      const trapDmg = extractDamage(trapUp)
      if (Object.keys(trapDmg).length > 0) {
        const { state: s2, logs: dmgLogs } = applyDamage(s, trapDmg)
        s = s2; s = addLog(s, dmgLogs)
        const over = checkGameOver(s)
        if (over) return over
      }

      const responder = 1 - activePlayer
      return passTo(s, responder, `Pass to ${s.players[responder].name} — respond to Clash`, 'awaitingClashResponse')
    }

    case 'RESPOND_CLASH': {
      const responder = 1 - state.clashZone.declarer
      let s = state
      if (action.cardIndex !== null && action.cardIndex !== undefined) {
        const player = s.players[responder]
        const card = player.hand[action.cardIndex]
        if (!card) return s
        const newHand = player.hand.filter((_, i) => i !== action.cardIndex)
        const newCards = [...s.clashZone.cards]
        newCards[responder] = card
        s = {
          ...s,
          players: s.players.map((p, i) => i === responder ? { ...p, hand: newHand } : p),
          clashZone: { ...s.clashZone, cards: newCards },
        }
        s = addLog(s, `${s.players[responder].name} responds to the Clash`)
      } else {
        s = addLog(s, `${s.players[responder].name} does not respond — free punish`)
      }
      return { ...s, phase: 'revealingClash' }
    }

    case 'CONFIRM_REVEAL': {
      let s = { ...state, clashZone: { ...state.clashZone, revealed: true } }
      const { declarer } = s.clashZone
      const responder = 1 - declarer
      const cardD = s.clashZone.cards[declarer]
      const cardR = s.clashZone.cards[responder]

      // No response
      if (!cardR) {
        s = addLog(s, `${s.players[declarer].name} gets a free punish`)
        s = { ...s, clashZone: { ...s.clashZone, result: { winner: declarer, reason: 'No response' } } }
        return startCombo(s, declarer)
      }

      // Resolve clash
      let result = resolveClash(cardD, cardR)
      // Map 0/1 to absolute player indices: 0 = declarer, 1 = responder in resolveClash
      if (result.winner === 0) result = { ...result, winner: declarer }
      else if (result.winner === 1) result = { ...result, winner: responder }

      // Apply forceClashResult overrides
      const cardsForForce = [null, null]
      cardsForForce[declarer] = cardD
      cardsForForce[responder] = cardR
      result = applyForceClashResult(result, cardsForForce)

      s = addLog(s, `Clash: ${cardD.name} (${s.players[declarer].name}) vs ${cardR.name} (${s.players[responder].name}) → ${result.winner === 'standoff' ? 'STANDOFF' : s.players[result.winner].name + ' wins'} (${result.reason})`)
      s = { ...s, clashZone: { ...s.clashZone, result } }

      if (result.winner === 'standoff') {
        // Discard both cards
        const np = [...s.players]
        np[declarer] = { ...np[declarer], discard: [...np[declarer].discard, cardD] }
        np[responder] = { ...np[responder], discard: [...np[responder].discard, cardR] }
        s = { ...s, players: np }
        s = addLog(s, 'Standoff — both cards discarded, no replay')
        return endTurn(s, s.activePlayer)
      }

      const winner = result.winner
      const loser = 1 - winner

      // damageEvenOnLoss: check loser's card
      const loserCard = s.clashZone.cards[loser]
      if (loserCard) {
        for (const eff of loserCard.clashEffects || []) {
          if (eff.type === 'damageEvenOnLoss') {
            const np = [...s.players]
            const dmg = loserCard.damage
            np[winner] = { ...np[winner], hp: Math.max(0, np[winner].hp - dmg) }
            s = { ...s, players: np }
            s = addLog(s, `${loserCard.name} (${s.players[loser].name}) deals ${dmg} damage even on loss`)
            const over = checkGameOver(s)
            if (over) return over
          }
        }
      }

      // Discard loser's card
      const np = [...s.players]
      if (loserCard) np[loser] = { ...np[loser], discard: [...np[loser].discard, loserCard] }
      s = { ...s, players: np }

      // onWin clash effects for winner's card
      const winnerCard = s.clashZone.cards[winner]
      if (winnerCard) {
        const { updates, logs: effLogs, fallbacks } = executeClashEffects(winnerCard, winner, result, s)
        s = applyPatch(s, updates)
        if (effLogs.length) s = addLog(s, effLogs)
        const pending = extractDamage(updates)
        if (Object.keys(pending).length > 0) {
          const { state: s2, logs: dmgLogs } = applyDamage(s, pending)
          s = s2; s = addLog(s, dmgLogs)
          const over = checkGameOver(s)
          if (over) return over
        }
        if (fallbacks.length > 0) {
          return { ...s, phase: 'awaitingFallback', fallbackQueue: fallbacks, afterFallback: { type: 'START_COMBO', executor: winner } }
        }
      }

      // Passive: onWinClash (Bloodthirst)
      const winnerPassive = s.players[winner].passive
      if (winnerPassive) {
        const { updates, logs: passLogs, fallbacks } = executePassiveEffects(winnerPassive, winner, 'onWinClash', s)
        s = applyPatch(s, updates)
        if (passLogs.length) s = addLog(s, passLogs)
        if (fallbacks.length > 0) {
          return { ...s, phase: 'awaitingFallback', fallbackQueue: fallbacks, afterFallback: { type: 'START_COMBO', executor: winner } }
        }
      }

      // Passive: onLoseClash (Unflinching — mark for use in combo damage)
      const loserPassive = s.players[loser].passive
      if (loserPassive) {
        for (const eff of loserPassive.effects || []) {
          if (eff.trigger === 'onLoseClash' && eff.condition?.type === 'firstTimePerTurn') {
            if (s.players[loser].unflinchingAvailable) {
              s = addLog(s, `${s.players[loser].name} Unflinching ready — combo damage reduced`)
            }
          }
        }
      }

      return startCombo(s, winner)
    }

    case 'PLAY_COMBO_CARD': {
      const { comboExecutor, comboChain } = state
      const player = state.players[comboExecutor]
      const card = player.hand[action.cardIndex]
      if (!card) return state

      const lastCard = comboChain[comboChain.length - 1]
      if (comboChain.length > 0 && !isValidComboFollow(lastCard, card)) {
        return addLog(state, `Cannot play ${card.name} here (${card.combo} not valid as follow-up)`)
      }

      const newHand = player.hand.filter((_, i) => i !== action.cardIndex)
      const newChain = [...comboChain, card]
      let s = {
        ...state,
        players: state.players.map((p, i) => i === comboExecutor ? { ...p, hand: newHand } : p),
        comboChain: newChain,
      }
      s = addLog(s, `${player.name} chains ${card.name} (${card.damage} dmg)`)

      if (isComboFinished(newChain)) {
        return resolveCombo(s)
      }
      return s
    }

    case 'END_COMBO': {
      return resolveCombo(state)
    }

    case 'APPLY_FALLBACK': {
      // Manual result applied: patch state and continue
      let s = applyPatch(state, action.patch || {})
      if (action.log) s = addLog(s, action.log)
      const remaining = s.fallbackQueue.slice(1)
      if (remaining.length > 0) {
        return { ...s, fallbackQueue: remaining }
      }
      return resumeAfterFallback({ ...s, fallbackQueue: [], phase: 'temp' })
    }

    case 'DISMISS_FALLBACK': {
      const remaining = state.fallbackQueue.slice(1)
      if (remaining.length > 0) {
        return { ...state, fallbackQueue: remaining }
      }
      return resumeAfterFallback({ ...state, fallbackQueue: [], phase: 'temp' })
    }

    case 'SKIP_TURN': {
      let s = addLog(state, `${state.players[state.activePlayer].name} passes their turn`)
      return endTurn(s, state.activePlayer, { wasNeutral: true })
    }

    case 'RESTART_GAME': {
      return { ...initialState, gameData: state.gameData, globals: state.gameData?.globals, phase: 'setup' }
    }

    default:
      return state
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function handleSuperUnlock(state, playerIdx) {
  const player = state.players[playerIdx]
  if (!player.superInHand && player.superGauge >= state.globals.superGaugeThreshold) {
    const np = [...state.players]
    np[playerIdx] = {
      ...player,
      superInHand: true,
      hand: [...player.hand, player.superCard],
      superGauge: state.globals.gaugeResetAfterSuper ? 0 : player.superGauge,
    }
    let s = { ...state, players: np }
    s = addLog(s, `${player.name} earns their Super — ${player.superCard.name} added to hand!`)
    return s
  }
  return state
}

function startCombo(state, executor) {
  const winnerCard = state.clashZone.cards[executor]
  const chain = winnerCard ? [winnerCard] : []
  const newClashCards = [...state.clashZone.cards]
  newClashCards[executor] = null

  // isCounter: the winner is the responder, not the declarer
  const isCounterCombo = executor !== state.activePlayer

  let s = {
    ...state,
    comboExecutor: executor,
    comboChain: chain,
    isCounterCombo,
    clashZone: { ...state.clashZone, cards: newClashCards },
  }

  if (winnerCard) s = addLog(s, `${s.players[executor].name} begins combo with ${winnerCard.name} (${winnerCard.damage} dmg)`)

  // If winning card is an Ender, auto-resolve
  if (winnerCard && isComboFinished(chain)) {
    return resolveCombo(s)
  }

  // If winning card is a Starter/Linker, check if executor even has follow-ups
  // Always enter buildingCombo so they can choose
  if (state.deviceHolder !== executor) {
    return passTo(s, executor, `Pass to ${s.players[executor].name} — build your combo`, 'buildingCombo')
  }
  return { ...s, phase: 'buildingCombo' }
}

function resolveCombo(state) {
  const { comboExecutor, comboChain } = state
  const loser = 1 - comboExecutor

  const { total, logs: dmgLogs } = computeComboDamage(comboChain, comboExecutor, loser, state)

  // Mark Unflinching as used and consume damage reduction
  const np = [...state.players]
  const loserUpdates = { damageReduction: 0 }
  if (np[loser].unflinchingAvailable) loserUpdates.unflinchingAvailable = false
  np[loser] = { ...np[loser], ...loserUpdates }

  let s = { ...state, players: np }
  if (dmgLogs.length) s = addLog(s, dmgLogs)

  const { state: s2, logs: applyLogs } = applyDamage(s, { [loser]: total })
  s = s2
  if (applyLogs.length) s = addLog(s, applyLogs)
  s = addLog(s, `${s.players[comboExecutor].name} combo total: ${total} damage (${comboChain.map(c => c.name).join(' → ')})`)

  const over = checkGameOver(s)
  if (over) return over

  // Discard combo chain
  const np2 = [...s.players]
  np2[comboExecutor] = {
    ...np2[comboExecutor],
    discard: [...np2[comboExecutor].discard, ...comboChain],
  }
  s = { ...s, players: np2, comboChain: [], comboExecutor: null }

  // Draw for the active player (the turn declarer), then pass to opponent
  return endTurn(s, s.activePlayer)
}

function resumeAfterFallback(state) {
  const { afterFallback } = state
  if (!afterFallback) return { ...state, phase: 'awaitingAction' }
  if (afterFallback.type === 'END_NEUTRAL') return endTurn(state, afterFallback.drawnBy)
  if (afterFallback.type === 'START_COMBO') return startCombo(state, afterFallback.executor)
  return state
}
