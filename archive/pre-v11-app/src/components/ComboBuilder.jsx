import { useState } from 'react'
import Card from './Card.jsx'
import Hand from './Hand.jsx'

export default function ComboBuilder({ state, dispatch }) {
  const { comboExecutor, comboChain, players } = state
  const [selectedIdx, setSelectedIdx] = useState(null)
  if (comboExecutor === null) return null

  const executor = players[comboExecutor]
  const lastCard = comboChain[comboChain.length - 1]
  const chainClosed = lastCard?.combo === 'ender'

  // Determine which hand cards are valid follow-ups
  const validIndices = executor.hand
    .map((card, i) => {
      if (chainClosed) return null
      if (card.combo === 'starter') return null
      if (lastCard?.combo === 'ender') return null
      return i
    })
    .filter(i => i !== null)

  const totalDmg = comboChain.reduce((sum, c) => sum + (c.damage || 0), 0)

  function playCard() {
    if (selectedIdx === null) return
    dispatch({ type: 'PLAY_COMBO_CARD', cardIndex: selectedIdx })
    setSelectedIdx(null)
  }

  return (
    <div style={{
      background: '#1a202c', border: '1px solid #276749', borderRadius: 10,
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ color: '#9ae6b4', fontWeight: 700, fontSize: 13 }}>
        {executor.name}'s Combo
        {totalDmg > 0 && (
          <span style={{ color: '#fc8181', marginLeft: 10 }}>
            Total so far: {totalDmg} dmg
          </span>
        )}
      </div>

      {/* Chain so far */}
      <div>
        <div style={{ color: '#718096', fontSize: 11, marginBottom: 6 }}>Chain:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {comboChain.map((card, i) => (
            <div key={card._id ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Card card={card} small />
              <span style={{ color: '#a0aec0', fontSize: 9 }}>{card.damage} dmg</span>
              {i < comboChain.length - 1 && (
                <span style={{ position: 'absolute', transform: 'translateX(38px)', color: '#4a5568' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Available follow-ups */}
      {!chainClosed && (
        <div>
          <Hand
            cards={executor.hand}
            label="Add to chain (Linkers & Enders only)"
            selectedIndex={selectedIdx}
            selectableIndices={validIndices}
            onSelect={i => setSelectedIdx(selectedIdx === i ? null : i)}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!chainClosed && selectedIdx !== null && (
          <button
            onClick={playCard}
            style={btnStyle('#276749', '#9ae6b4')}
          >
            Chain {executor.hand[selectedIdx]?.name}
          </button>
        )}
        {!chainClosed && (
          <button
            onClick={() => dispatch({ type: 'END_COMBO' })}
            style={btnStyle('#2d3748', '#a0aec0')}
          >
            End Combo ({totalDmg} dmg total)
          </button>
        )}
        {chainClosed && (
          <button
            onClick={() => dispatch({ type: 'END_COMBO' })}
            style={btnStyle('#276749', '#9ae6b4')}
          >
            Apply {totalDmg} damage
          </button>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  }
}
