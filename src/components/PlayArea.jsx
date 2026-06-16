const TYPE_COLOR = { strike: '#c53030', guard: '#2b6cb0', crush: '#b7791f' }
const TYPE_LABEL = { strike: 'STRIKE', guard: 'GUARD', crush: 'CRUSH' }

const TRIGGER_LABEL = {
  opponentDeclaresClash: 'Fires: opp declares Clash',
  opponentTakesNeutralTurn: 'Fires: opp takes Neutral',
}

const EXPIRES_LABEL = {
  untilYourNextTurn: 'Expires: your next turn',
  untilTriggered: 'Expires: when triggered',
  nextInstance: 'Expires: next hit',
}

function CardShell({ card, badgeLabel, badgeColor, footerLines }) {
  if (!card) {
    return (
      <div style={{
        width: 130, borderRadius: 8, padding: '8px 10px',
        background: '#1a202c', border: '2px solid #4a5568',
        display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
      }}>
        <div style={{ color: '#a0aec0', fontSize: 10 }}>Unknown card</div>
      </div>
    )
  }

  const typeColor = TYPE_COLOR[card.type] || '#555'

  return (
    <div style={{
      width: 130, borderRadius: 8, overflow: 'hidden',
      background: '#1a202c', border: '2px solid #4a5568',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Type header */}
      <div style={{
        background: typeColor, color: '#fff', padding: '3px 6px',
        fontWeight: 700, fontSize: 9, letterSpacing: 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{TYPE_LABEL[card.type]}</span>
        <span style={{
          background: badgeColor, color: '#fff',
          borderRadius: 3, padding: '0 4px', fontSize: 8, letterSpacing: 0,
        }}>{badgeLabel}</span>
      </div>

      {/* Name */}
      <div style={{ padding: '4px 7px 2px', fontWeight: 700, color: '#e2e8f0', fontSize: 11, lineHeight: 1.2 }}>
        {card.name}
      </div>

      {/* Stats */}
      <div style={{ padding: '0 7px', display: 'flex', gap: 6, color: '#a0aec0', fontSize: 9 }}>
        <span>P:<strong style={{ color: '#e2e8f0' }}>{card.priority}</strong></span>
        <span>D:<strong style={{ color: '#fc8181' }}>{card.damage}</strong></span>
      </div>

      {/* Full rawText */}
      {card.rawText && (
        <div style={{ padding: '5px 7px', color: '#cbd5e0', fontSize: 10, lineHeight: 1.45 }}>
          {card.rawText}
        </div>
      )}

      {/* Footer — lifecycle info */}
      <div style={{
        marginTop: 'auto', padding: '5px 7px',
        borderTop: '1px solid #2d3748',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {footerLines.map((line, i) => (
          <div key={i} style={{ color: line.color || '#718096', fontSize: 9, fontWeight: line.bold ? 600 : 400 }}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function TrapCard({ trap }) {
  const footerLines = [
    { text: TRIGGER_LABEL[trap.trigger] || `Trigger: ${trap.trigger}`, color: '#fc8181', bold: true },
    { text: EXPIRES_LABEL[trap.window] || trap.window, color: '#718096' },
  ]
  return (
    <CardShell
      card={trap.sourceCard}
      badgeLabel="TRAP"
      badgeColor="#744210"
      footerLines={footerLines}
    />
  )
}

function BuffCard({ item }) {
  const expiresLabel = EXPIRES_LABEL[item.expiresWhen] || item.expiresWhen
  const effectLabel = item.effectType === 'reduceNextDamage'
    ? `Blocks ${item.amount} incoming damage`
    : item.effectType

  const footerLines = [
    { text: effectLabel, color: '#90cdf4', bold: true },
    { text: expiresLabel, color: '#718096' },
  ]
  return (
    <CardShell
      card={item.card}
      badgeLabel="BUFF"
      badgeColor="#2c5282"
      footerLines={footerLines}
    />
  )
}

export default function PlayArea({ traps = [], buffCards = [], label }) {
  const total = traps.length + buffCards.length
  if (total === 0) return null

  return (
    <div>
      <div style={{ color: '#a0aec0', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        {label || 'Play Area'} — {total} active card{total !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {traps.map((trap, i) => <TrapCard key={`trap-${i}`} trap={trap} />)}
        {buffCards.map((item, i) => <BuffCard key={`buff-${i}`} item={item} />)}
      </div>
    </div>
  )
}
