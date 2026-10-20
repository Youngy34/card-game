import { useState } from 'react'

export default function FallbackModal({ fallbackQueue, dispatch }) {
  const [note, setNote] = useState('')

  if (!fallbackQueue || fallbackQueue.length === 0) return null
  const current = fallbackQueue[0]

  function applyAndContinue() {
    dispatch({ type: 'APPLY_FALLBACK', log: note || `Manual: ${current.context}` })
    setNote('')
  }

  function skip() {
    dispatch({ type: 'DISMISS_FALLBACK' })
    setNote('')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: '#1a202c', border: '1px solid #c05621', borderRadius: 14,
        padding: '32px 40px', maxWidth: 460, width: '90%',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ color: '#f6ad55', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          ⚠ MANUAL EFFECT ({fallbackQueue.length} pending)
        </div>
        <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>
          {current.card?.name}
        </div>
        <div style={{
          background: '#2d3748', borderRadius: 8, padding: '10px 14px',
          color: '#cbd5e0', fontSize: 13, lineHeight: 1.5,
        }}>
          <strong style={{ color: '#f6ad55' }}>Card text:</strong><br />
          {current.card?.rawText || '(no text)'}
        </div>
        <div style={{ color: '#a0aec0', fontSize: 12 }}>
          Context: <em>{current.context}</em>
        </div>
        <div style={{ color: '#718096', fontSize: 12 }}>
          Apply this effect manually on the table, then confirm below.
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note for match log (e.g. 'dealt 2 damage to Vex')"
          style={{
            background: '#0f1419', border: '1px solid #4a5568', borderRadius: 6,
            color: '#e2e8f0', padding: '8px 12px', fontSize: 12,
            resize: 'vertical', minHeight: 56, fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={applyAndContinue} style={{
            flex: 1, background: '#276749', color: '#9ae6b4',
            border: 'none', borderRadius: 7, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Done — continue
          </button>
          <button onClick={skip} style={{
            background: '#2d3748', color: '#718096',
            border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 13, cursor: 'pointer',
          }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
