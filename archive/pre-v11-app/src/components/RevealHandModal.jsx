import Card from './Card.jsx'

export default function RevealHandModal({ state, dispatch }) {
  const { revealHandState, players } = state
  if (!revealHandState) return null

  const { viewerIdx, targetIdx } = revealHandState
  const viewer = players[viewerIdx]
  const target = players[targetIdx]
  const hand = target?.hand || []

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: '#1a202c',
        border: '2px solid #553c9a',
        borderRadius: 12,
        padding: '28px 32px',
        maxWidth: 600,
        width: '90%',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{ color: '#d6bcfa', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {viewer?.name} looks at {target?.name}'s hand
          </div>
          <div style={{ color: '#718096', fontSize: 12 }}>
            {hand.length} card{hand.length !== 1 ? 's' : ''} — information only, no state change
          </div>
        </div>

        {hand.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
            {target?.name}'s hand is empty
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {hand.map((card, i) => (
              <Card key={card._id ?? i} card={card} />
            ))}
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'DISMISS_HAND_REVEAL' })}
          style={{
            background: '#553c9a', color: '#d6bcfa',
            border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', alignSelf: 'flex-end',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
