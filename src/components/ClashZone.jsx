import Card from './Card.jsx'

export default function ClashZone({ clashZone, players }) {
  const { declarer, cards, revealed, result } = clashZone
  if (declarer === null && !cards[0] && !cards[1]) return null

  const responder = declarer !== null ? 1 - declarer : null
  const resultColor = result?.winner === 'standoff' ? '#f6ad55'
    : result?.winner !== undefined && result?.winner !== null ? '#68d391' : '#e2e8f0'

  return (
    <div style={{
      background: '#1a202c',
      border: '1px solid #4a5568',
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{ color: '#a0aec0', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
        CLASH ZONE
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Player 0 card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#718096' }}>{players[0]?.name}</span>
          {cards[0]
            ? <Card card={cards[0]} faceDown={!revealed} />
            : <EmptySlot />}
        </div>

        {/* VS / Result */}
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: resultColor, fontWeight: 700, fontSize: 16 }}>
                {result.winner === 'standoff'
                  ? 'STANDOFF'
                  : `${players[result.winner]?.name} WINS`}
              </span>
              <span style={{ color: '#718096', fontSize: 10 }}>{result.reason}</span>
            </div>
          ) : (
            <span style={{ color: '#4a5568', fontSize: 20, fontWeight: 700 }}>VS</span>
          )}
        </div>

        {/* Player 1 card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#718096' }}>{players[1]?.name}</span>
          {cards[1]
            ? <Card card={cards[1]} faceDown={!revealed} />
            : <EmptySlot />}
        </div>
      </div>

      {declarer !== null && !result && (
        <div style={{ fontSize: 11, color: '#718096' }}>
          {players[declarer]?.name} declared the Clash
          {responder !== null && !cards[responder] && ` — waiting for ${players[responder]?.name} to respond`}
        </div>
      )}
    </div>
  )
}

function EmptySlot() {
  return (
    <div style={{
      width: 100, height: 140, borderRadius: 8,
      border: '2px dashed #2d3748',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#4a5568', fontSize: 22,
    }}>
      —
    </div>
  )
}
