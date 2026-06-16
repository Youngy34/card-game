import { useState } from 'react'
import PlayerBoard from './PlayerBoard.jsx'
import ClashZone from './ClashZone.jsx'
import ComboBuilder from './ComboBuilder.jsx'
import MatchLog from './MatchLog.jsx'
import Hand from './Hand.jsx'

export default function GameTable({ state, dispatch }) {
  const { phase, activePlayer, players, clashZone, deviceHolder, comboExecutor } = state
  const [selectedCard, setSelectedCard] = useState(null)
  const [actionMode, setActionMode] = useState(null) // 'neutral' | 'clash' | null

  if (!players[0] || !players[1]) return null

  // Determine which player is "active" from UI perspective (who holds the device)
  const viewingPlayer = deviceHolder ?? activePlayer

  const isClashPhase = phase === 'awaitingClashResponse'
  const isActionPhase = phase === 'awaitingAction'
  const isRevealPhase = phase === 'revealingClash'
  const isComboPhase = phase === 'buildingCombo'

  const player = players[viewingPlayer]
  const opponent = players[1 - viewingPlayer]

  // Which cards in hand are valid for current action
  function getSelectableIndices() {
    if (isClashPhase && viewingPlayer !== clashZone.declarer) {
      return player.hand.map((_, i) => i)
    }
    if (!actionMode) return []
    if (actionMode === 'clash' || actionMode === 'neutral') {
      return player.hand.map((_, i) => i)
    }
    return []
  }

  function handleCardSelect(idx) {
    if (selectedCard === idx) {
      setSelectedCard(null)
    } else {
      setSelectedCard(idx)
    }
  }

  function confirmAction() {
    if (selectedCard === null) return

    if (actionMode === 'neutral') {
      dispatch({ type: 'TAKE_NEUTRAL', cardIndex: selectedCard })
    } else if (actionMode === 'clash') {
      dispatch({ type: 'DECLARE_CLASH', cardIndex: selectedCard })
    } else if (phase === 'awaitingClashResponse') {
      dispatch({ type: 'RESPOND_CLASH', cardIndex: selectedCard })
    }
    setSelectedCard(null)
    setActionMode(null)
  }

  function passResponse() {
    dispatch({ type: 'RESPOND_CLASH', cardIndex: null })
    setSelectedCard(null)
    setActionMode(null)
  }

  function cancelAction() {
    setSelectedCard(null)
    setActionMode(null)
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>

      {/* Main table */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Turn / phase banner */}
        <div style={{
          background: '#1a202c', borderRadius: 8, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: '#a0aec0', fontSize: 12 }}>Turn {state.turnNumber}</span>
          <span style={{ color: '#4a5568' }}>|</span>
          <span style={{ color: '#f6e05e', fontSize: 12, fontWeight: 700 }}>
            {phaseLabel(phase, viewingPlayer, players, clashZone, comboExecutor)}
          </span>
          {state.traps.length > 0 && (
            <span style={{ color: '#fc8181', fontSize: 11, marginLeft: 'auto' }}>
              ⚠ {state.traps.length} active trap{state.traps.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Opponent board (hand hidden) */}
        <PlayerBoard
          player={opponent}
          isActive={activePlayer === 1 - viewingPlayer}
          isOpponent={true}
          showHand={true}
        />

        {/* Clash zone */}
        {(clashZone.declarer !== null || clashZone.cards[0] || clashZone.cards[1]) && (
          <ClashZone clashZone={clashZone} players={players} />
        )}

        {/* Combo builder */}
        {isComboPhase && comboExecutor === viewingPlayer && (
          <ComboBuilder state={state} dispatch={dispatch} />
        )}

        {/* Reveal button */}
        {isRevealPhase && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => dispatch({ type: 'CONFIRM_REVEAL' })}
              style={{
                background: '#744210', color: '#f6ad55', border: '1px solid #c05621',
                borderRadius: 8, padding: '10px 24px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚡ Reveal Cards
            </button>
          </div>
        )}

        {/* Active player board */}
        <PlayerBoard
          player={player}
          isActive={activePlayer === viewingPlayer}
          isOpponent={false}
          showHand={!isComboPhase || comboExecutor !== viewingPlayer}
          handProps={{
            selectedIndex: selectedCard,
            selectableIndices: getSelectableIndices(),
            onSelect: handleCardSelect,
          }}
        >
          {/* Action buttons */}
          {isActionPhase && activePlayer === viewingPlayer && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!actionMode && (
                <>
                  <button onClick={() => setActionMode('neutral')} style={btnStyle('#1a365d', '#90cdf4')}>
                    ◎ Take Neutral Turn
                  </button>
                  <button onClick={() => setActionMode('clash')} style={btnStyle('#422936', '#fc8181')}>
                    ⚔ Declare Clash
                  </button>
                  <button onClick={() => dispatch({ type: 'SKIP_TURN' })} style={btnStyle('#2d3748', '#718096')}>
                    ⏭ Pass Turn
                  </button>
                </>
              )}
              {actionMode && (
                <>
                  <span style={{ color: '#a0aec0', fontSize: 12, alignSelf: 'center' }}>
                    {actionMode === 'neutral' ? 'Select a card to play neutrally:' : 'Select a card to clash with:'}
                  </span>
                  <button
                    onClick={confirmAction}
                    disabled={selectedCard === null}
                    style={btnStyle('#276749', selectedCard !== null ? '#9ae6b4' : '#4a5568')}
                  >
                    {selectedCard !== null
                      ? `Confirm: ${player.hand[selectedCard]?.name}`
                      : 'Select a card first'}
                  </button>
                  <button onClick={cancelAction} style={btnStyle('#2d3748', '#718096')}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {/* Clash response */}
          {isClashPhase && viewingPlayer !== clashZone.declarer && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#f6ad55', fontSize: 12, alignSelf: 'center' }}>
                Respond to the Clash:
              </span>
              <button
                onClick={confirmAction}
                disabled={selectedCard === null}
                style={btnStyle('#276749', selectedCard !== null ? '#9ae6b4' : '#4a5568')}
              >
                {selectedCard !== null
                  ? `Respond with: ${player.hand[selectedCard]?.name}`
                  : 'Select a card first'}
              </button>
              <button onClick={passResponse} style={btnStyle('#742a2a', '#fc8181')}>
                No Response (take free punish)
              </button>
            </div>
          )}
        </PlayerBoard>

      </div>

      {/* Log sidebar */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <MatchLog log={state.log} />
      </div>

    </div>
  )
}

function phaseLabel(phase, viewingPlayer, players, clashZone, comboExecutor) {
  const vname = players[viewingPlayer]?.name
  switch (phase) {
    case 'awaitingAction': return `${vname}'s turn — choose an action`
    case 'awaitingClashResponse': return `${vname} — respond to the Clash`
    case 'revealingClash': return 'Clash declared — ready to reveal'
    case 'buildingCombo': return `${players[comboExecutor]?.name} builds combo`
    default: return phase
  }
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  }
}
