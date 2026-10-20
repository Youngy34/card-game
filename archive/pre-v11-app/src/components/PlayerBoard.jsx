import Hand from './Hand.jsx'
import PlayArea from './PlayArea.jsx'

const GAUGE_COLOR = ['#4299e1', '#68d391', '#f6ad55']

export default function PlayerBoard({
  player,
  isActive,
  isOpponent,
  children,
  showHand = true,
  handProps = {},
  playAreaTraps = [],
}) {
  if (!player) return null

  const hpPct = Math.max(0, player.hp / player.maxHP)
  const hpColor = hpPct > 0.5 ? '#68d391' : hpPct > 0.25 ? '#f6ad55' : '#fc8181'
  const gaugeMax = 3 // display max
  const gaugeFill = Math.min(player.superGauge, gaugeMax)

  return (
    <div style={{
      background: isActive ? '#1a2f1a' : '#1a202c',
      border: `1px solid ${isActive ? '#276749' : '#2d3748'}`,
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isActive && (
          <span style={{
            background: '#276749', color: '#9ae6b4',
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: 1,
          }}>ACTIVE</span>
        )}
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{player.name}</span>
        <span style={{ color: '#718096', fontSize: 11 }}>{isOpponent ? '(Opponent)' : '(You)'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#718096', fontSize: 11 }}>
            Deck: {player.deck.length} | Discard: {player.discard.length}
          </span>
        </div>
      </div>

      {/* HP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#a0aec0', fontSize: 11, width: 24 }}>HP</span>
        <div style={{
          flex: 1, height: 12, background: '#2d3748', borderRadius: 6, overflow: 'hidden',
        }}>
          <div style={{
            width: `${hpPct * 100}%`, height: '100%',
            background: hpColor, borderRadius: 6,
            transition: 'width 0.3s ease, background 0.3s ease',
          }} />
        </div>
        <span style={{ color: hpColor, fontWeight: 700, fontSize: 13, minWidth: 52, textAlign: 'right' }}>
          {player.hp} / {player.maxHP}
        </span>
      </div>

      {/* Super gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#a0aec0', fontSize: 11, width: 24 }}>SUP</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: gaugeMax }).map((_, i) => (
            <div key={i} style={{
              width: 18, height: 12, borderRadius: 3,
              background: i < gaugeFill ? GAUGE_COLOR[i] : '#2d3748',
              border: `1px solid ${i < gaugeFill ? GAUGE_COLOR[i] : '#4a5568'}`,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        {player.superInHand && (
          <span style={{
            color: '#f6e05e', fontSize: 10, fontWeight: 700,
            background: '#744210', padding: '1px 5px', borderRadius: 4,
          }}>SUPER IN HAND</span>
        )}
        {player.damageReduction > 0 && (
          <span style={{
            color: '#90cdf4', fontSize: 10, fontWeight: 700,
            background: '#1a365d', padding: '1px 5px', borderRadius: 4,
          }}>🛡 -{player.damageReduction} next dmg</span>
        )}
      </div>

      {/* Play area — face-up lingering cards (traps, one-turn buffs) */}
      {(playAreaTraps.length > 0 || (player.playAreaCards || []).length > 0) && (
        <PlayArea
          traps={playAreaTraps}
          buffCards={player.playAreaCards || []}
          label={isOpponent ? `${player.name}'s Play Area` : 'Your Play Area'}
        />
      )}

      {/* Hand */}
      {showHand && (
        <Hand
          cards={player.hand}
          hidden={isOpponent}
          label={isOpponent ? 'Opponent hand' : 'Your hand'}
          {...handProps}
        />
      )}

      {/* Extra content (action buttons etc) */}
      {children}
    </div>
  )
}
