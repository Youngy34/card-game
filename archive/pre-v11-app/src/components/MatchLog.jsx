import { useRef, useEffect } from 'react'

export default function MatchLog({ log }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div style={{
      background: '#0f1419', border: '1px solid #2d3748', borderRadius: 10,
      display: 'flex', flexDirection: 'column',
      height: 320, overflow: 'hidden',
    }}>
      <div style={{
        color: '#718096', fontSize: 11, fontWeight: 700, letterSpacing: 1,
        padding: '8px 12px', borderBottom: '1px solid #2d3748',
      }}>
        MATCH LOG
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {log.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: 12, marginTop: 8 }}>No events yet</div>
        )}
        {log.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.4 }}>
            <span style={{ color: '#4a5568', flexShrink: 0, minWidth: 28 }}>T{entry.turn ?? i}</span>
            <span style={{ color: '#a0aec0' }}>{entry.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
