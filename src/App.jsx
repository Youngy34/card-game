import { useReducer, useEffect, useCallback } from 'react'
import { gameReducer, initialState } from './engine/gameState.js'
import { loadGameData } from './engine/loader.js'
import CharacterSelect from './components/CharacterSelect.jsx'
import GameTable from './components/GameTable.jsx'
import PassDeviceModal from './components/PassDeviceModal.jsx'
import FallbackModal from './components/FallbackModal.jsx'
import GlobalParams from './components/GlobalParams.jsx'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const reload = useCallback(async () => {
    try {
      const gameData = await loadGameData()
      dispatch({ type: 'LOAD_DATA', gameData })
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR', error: e.message })
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const { phase, gameData, loadError, passDevice, fallbackQueue, globals, players, winner, winReason } = state

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#161b22', borderBottom: '1px solid #2d3748',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#e2e8f0', letterSpacing: 0.5 }}>
          ⚔ Card Game Playtest
        </span>
        {phase !== 'loading' && phase !== 'loadError' && phase !== 'setup' && (
          <button
            onClick={() => dispatch({ type: 'RESTART_GAME' })}
            style={{
              background: 'none', color: '#718096', border: '1px solid #4a5568',
              borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >
            ↩ New Match
          </button>
        )}
        <div style={{ marginLeft: 'auto', color: '#4a5568', fontSize: 12 }}>
          {phase !== 'loading' && gameData && `${gameData.characters.length} characters loaded`}
        </div>
      </div>

      {/* Params bar */}
      {gameData && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #1a202c' }}>
          <GlobalParams globals={globals} dispatch={dispatch} onReload={reload} />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#718096' }}>
            Loading character data…
          </div>
        )}

        {phase === 'loadError' && (
          <div style={{
            maxWidth: 480, margin: '60px auto', background: '#1a202c',
            border: '1px solid #c05621', borderRadius: 10, padding: 24,
          }}>
            <div style={{ color: '#f6ad55', fontWeight: 700, marginBottom: 8 }}>Failed to load data</div>
            <div style={{ color: '#a0aec0', fontSize: 13, marginBottom: 16 }}>{loadError}</div>
            <button
              onClick={reload}
              style={{ background: '#276749', color: '#9ae6b4', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {phase === 'setup' && gameData && (
          <CharacterSelect
            gameData={gameData}
            selectedCharacters={state.selectedCharacters}
            dispatch={dispatch}
            onStartGame={() => dispatch({ type: 'START_GAME' })}
          />
        )}

        {phase === 'gameOver' && (
          <div style={{
            maxWidth: 500, margin: '60px auto', textAlign: 'center',
            background: '#1a202c', border: '1px solid #4a5568', borderRadius: 14, padding: 40,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {winner !== null ? '🏆' : '⏱'}
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {winner !== null ? `${players[winner]?.name} wins!` : 'Match Stalled'}
            </div>
            <div style={{ color: '#718096', fontSize: 14, marginBottom: 24 }}>{winReason}</div>
            {players[0] && players[1] && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24 }}>
                {players.map((p, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ color: '#a0aec0', fontSize: 12 }}>{p.name}</div>
                    <div style={{ color: '#fc8181', fontSize: 20, fontWeight: 700 }}>{p.hp} HP</div>
                    <div style={{ color: '#718096', fontSize: 11 }}>{state.playerTurns[i]} turns</div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'RESTART_GAME' })}
              style={{
                background: '#276749', color: '#9ae6b4', border: 'none',
                borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              New Match
            </button>
          </div>
        )}

        {!['loading', 'loadError', 'setup', 'gameOver', 'passDevice'].includes(phase) && players[0] && (
          <GameTable state={state} dispatch={dispatch} />
        )}
      </div>

      {/* Modals */}
      {phase === 'passDevice' && passDevice && (
        <PassDeviceModal
          passDevice={passDevice}
          onConfirm={() => dispatch({ type: 'CONFIRM_PASS' })}
        />
      )}

      {phase === 'awaitingFallback' && fallbackQueue?.length > 0 && (
        <FallbackModal fallbackQueue={fallbackQueue} dispatch={dispatch} />
      )}
    </div>
  )
}
