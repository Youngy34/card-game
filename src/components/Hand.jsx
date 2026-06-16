import Card from './Card.jsx'

export default function Hand({
  cards = [],
  hidden = false,
  selectedIndex = null,
  selectableIndices = null,  // null = all selectable, [] = none, [0,1,...] = specific
  onSelect,
  label,
  superInHand = false,
}) {
  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#4a5568', padding: '8px 0', fontSize: 13 }}>
        {label && <div style={{ marginBottom: 4, color: '#718096', fontWeight: 600, fontSize: 12 }}>{label}</div>}
        No cards in hand
      </div>
    )
  }

  return (
    <div>
      {label && (
        <div style={{ color: '#718096', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          {label} ({cards.length} card{cards.length !== 1 ? 's' : ''})
        </div>
      )}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        {cards.map((card, i) => {
          const isSelectable = selectableIndices === null
            ? true
            : selectableIndices.includes(i)

          return (
            <Card
              key={card._id ?? i}
              card={card}
              faceDown={hidden}
              selected={selectedIndex === i}
              selectable={!hidden && isSelectable}
              glowing={!hidden && isSelectable && selectableIndices !== null && selectableIndices.length > 0}
              onClick={() => onSelect?.(i)}
            />
          )
        })}
      </div>
    </div>
  )
}
