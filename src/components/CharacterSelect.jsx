export default function CharacterSelect({ gameData, selectedCharacters, dispatch, onStartGame }) {
  const { characters } = gameData

  function select(playerIndex, charId) {
    dispatch({ type: 'SELECT_CHARACTER', playerIndex, characterId: charId })
  }

  const bothSelected = selectedCharacters[0] && selectedCharacters[1]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 24,
      maxWidth: 700, margin: '0 auto', padding: 24,
    }}>
      <h2 style={{ color: '#e2e8f0', margin: 0, textAlign: 'center' }}>Select Fighters</h2>

      {[0, 1].map(pi => (
        <div key={pi}>
          <div style={{ color: '#718096', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            PLAYER {pi + 1}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {characters.map(char => {
              const isSelected = selectedCharacters[pi] === char.id
              const takenByOther = selectedCharacters[1 - pi] === char.id
              return (
                <button
                  key={char.id}
                  onClick={() => !takenByOther && select(pi, char.id)}
                  disabled={takenByOther}
                  style={{
                    background: isSelected ? '#276749' : takenByOther ? '#1a1a1a' : '#1a202c',
                    border: `2px solid ${isSelected ? '#68d391' : takenByOther ? '#2d3748' : '#4a5568'}`,
                    borderRadius: 10, padding: '12px 16px',
                    color: takenByOther ? '#4a5568' : '#e2e8f0',
                    cursor: takenByOther ? 'not-allowed' : 'pointer',
                    textAlign: 'left', minWidth: 160,
                    opacity: takenByOther ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{char.name}</div>
                  <div style={{ color: '#718096', fontSize: 11, marginTop: 2 }}>{char.archetype}</div>
                  <div style={{ color: '#fc8181', fontSize: 12, marginTop: 4 }}>HP: {char.baseHP}</div>
                  <div style={{ color: '#a0aec0', fontSize: 11, marginTop: 2 }}>{char.passive?.name}</div>
                  {takenByOther && (
                    <div style={{ color: '#c05621', fontSize: 10, marginTop: 3 }}>
                      Taken by Player {2 - pi}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <button
        onClick={onStartGame}
        disabled={!bothSelected}
        style={{
          background: bothSelected ? '#276749' : '#1a202c',
          color: bothSelected ? '#9ae6b4' : '#4a5568',
          border: `1px solid ${bothSelected ? '#276749' : '#2d3748'}`,
          borderRadius: 8, padding: '14px', fontSize: 16, fontWeight: 700,
          cursor: bothSelected ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
        }}
      >
        {bothSelected ? 'Start Match' : 'Select both fighters to continue'}
      </button>
    </div>
  )
}
