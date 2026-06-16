const TYPE_COLOR = { strike: '#c53030', guard: '#2b6cb0', crush: '#b7791f' }
const TYPE_LABEL = { strike: 'STRIKE', guard: 'GUARD', crush: 'CRUSH' }
const COMBO_COLOR = { starter: '#276749', linker: '#553c9a', ender: '#c05621' }

export default function Card({
  card,
  faceDown = false,
  selected = false,
  selectable = false,
  onClick,
  small = false,
  glowing = false,
}) {
  if (!card) return null

  if (faceDown) {
    return (
      <div style={{
        width: small ? 70 : 100,
        height: small ? 98 : 140,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #1a365d 0%, #2a4a7f 100%)',
        border: '2px solid #4a6fa5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: small ? 20 : 28, color: '#4a6fa5',
        flexShrink: 0,
      }}>
        ⬡
      </div>
    )
  }

  const typeColor = TYPE_COLOR[card.type] || '#555'
  const comboColor = COMBO_COLOR[card.combo] || '#555'
  const isX = card.priority === 'X'
  const priorityLabel = isX ? 'X' : card.priority

  const hasArt = !!card.art

  if (hasArt) {
    return (
      <div
        onClick={selectable ? onClick : undefined}
        style={{
          width: small ? 70 : 100,
          height: small ? 98 : 140,
          borderRadius: 8,
          overflow: 'hidden',
          border: `2px solid ${selected ? '#f6e05e' : glowing ? '#68d391' : '#555'}`,
          cursor: selectable ? 'pointer' : 'default',
          flexShrink: 0,
          transition: 'border-color 0.15s, transform 0.15s',
          transform: selected ? 'translateY(-8px)' : glowing ? 'translateY(-3px)' : 'none',
          boxShadow: selected ? '0 0 0 2px #f6e05e88' : 'none',
        }}
      >
        <img src={card.art} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  // Data mode card
  const clashText = (card.clashEffects || [])
    .filter(e => e.type !== 'damageEvenOnLoss' || true)
    .map(effectToText).filter(Boolean).join(' ')
  const clashDisplay = clashText || card.rawText?.match(/^(?!Neutral:)(.+)/)?.[1]?.trim() || ''
  const neutralText = (card.neutralEffects || []).map(effectToText).filter(Boolean).join(' ')
  const neutralDisplay = neutralText || card.rawText?.match(/Neutral:\s*(.+)/)?.[1]?.trim() || ''

  return (
    <div
      onClick={selectable ? onClick : undefined}
      title={card.rawText || ''}
      style={{
        width: small ? 70 : 100,
        height: small ? 98 : 140,
        borderRadius: 8,
        background: '#1a202c',
        border: `2px solid ${selected ? '#f6e05e' : glowing ? '#68d391' : '#2d3748'}`,
        cursor: selectable ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'border-color 0.15s, transform 0.15s',
        transform: selected ? 'translateY(-8px)' : glowing ? 'translateY(-3px)' : 'none',
        boxShadow: selected ? '0 0 0 2px #f6e05e88' : glowing ? '0 0 8px #68d39166' : 'none',
        userSelect: 'none',
        fontSize: small ? 9 : 11,
      }}
    >
      {/* Type header */}
      <div style={{
        background: typeColor, color: '#fff', padding: small ? '2px 4px' : '3px 6px',
        fontWeight: 700, fontSize: small ? 8 : 9, letterSpacing: 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{TYPE_LABEL[card.type]}</span>
        <span style={{
          background: comboColor, borderRadius: 3, padding: '0 3px',
          fontSize: small ? 7 : 8, letterSpacing: 0,
        }}>{(card.combo || '').toUpperCase()}</span>
      </div>

      {/* Name */}
      <div style={{
        padding: small ? '2px 4px' : '4px 6px',
        fontWeight: 700, color: '#e2e8f0',
        fontSize: small ? 8 : 10,
        lineHeight: 1.2,
        flexShrink: 0,
      }}>{card.name}</div>

      {/* Stats */}
      <div style={{
        padding: small ? '0 4px' : '0 6px',
        display: 'flex', gap: 6, color: '#a0aec0',
        fontSize: small ? 8 : 9, flexShrink: 0,
      }}>
        <span>P:<strong style={{ color: '#e2e8f0' }}>{priorityLabel}</strong></span>
        <span>D:<strong style={{ color: '#fc8181' }}>{card.damage}</strong></span>
      </div>

      {!small && (
        <>
          <div style={{ flex: 1, padding: '3px 6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {clashDisplay && (
              <div style={{ color: '#fbd38d', fontSize: 9, lineHeight: 1.3 }}>
                <span style={{ color: '#f6ad55', fontWeight: 700 }}>⚔ </span>{clashDisplay}
              </div>
            )}
            {neutralDisplay && (
              <div style={{ color: '#9ae6b4', fontSize: 9, lineHeight: 1.3 }}>
                <span style={{ color: '#68d391', fontWeight: 700 }}>◎ </span>{neutralDisplay}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function effectToText(eff) {
  if (!eff) return ''
  switch (eff.type) {
    case 'chargeSuper': return `Charge Super +${eff.amount}`
    case 'draw': return `Draw ${eff.amount}`
    case 'dealDamage': return `Deal ${eff.amount} damage to ${eff.target}`
    case 'opponentDiscards': return `Opponent discards ${eff.amount}`
    case 'reduceNextDamage': return `Reduce next damage by ${eff.amount}`
    case 'setTrap': return `Set trap: deal ${eff.effect?.amount ?? '?'} on opp neutral`
    case 'modifyDamage': return eff.per ? `+${eff.amount} per chain card` : `${eff.amount > 0 ? '+' : ''}${eff.amount} damage`
    case 'damageEvenOnLoss': return 'Deals damage even on loss'
    case 'forceClashResult': return "Can't be standoff; wins instead"
    default: return eff.type
  }
}
