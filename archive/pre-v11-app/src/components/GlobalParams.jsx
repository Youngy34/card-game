import { useState } from 'react'

const PARAMS = [
  { key: 'handSize', label: 'Hand Size', type: 'number', min: 1, max: 10 },
  { key: 'drawPerTurn', label: 'Draw Per Turn', type: 'number', min: 0, max: 5 },
  { key: 'superGaugeThreshold', label: 'Super Gauge Threshold', type: 'number', min: 1, max: 10 },
  { key: 'gaugeResetAfterSuper', label: 'Gauge Resets After Super', type: 'boolean' },
  { key: 'simTurnCapPerPlayer', label: 'Turn Cap Per Player', type: 'number', min: 10, max: 200 },
]

export default function GlobalParams({ globals, dispatch, onReload }) {
  const [open, setOpen] = useState(false)

  if (!globals) return null

  return (
    <div style={{
      background: '#1a202c', border: '1px solid #2d3748', borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '10px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          color: '#a0aec0', fontSize: 12, fontWeight: 700, letterSpacing: 1,
        }}
      >
        <span>{open ? '▼' : '▶'}</span>
        GLOBAL PARAMETERS
        <button
          onClick={e => { e.stopPropagation(); onReload?.() }}
          style={{
            marginLeft: 'auto', background: '#2d3748', color: '#a0aec0',
            border: 'none', borderRadius: 5, padding: '3px 8px',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          ↺ Reload Data
        </button>
      </button>

      {open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PARAMS.map(p => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#718096', fontSize: 12, width: 190 }}>{p.label}</span>
              {p.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={!!globals[p.key]}
                  onChange={e => dispatch({ type: 'UPDATE_GLOBALS', patch: { [p.key]: e.target.checked } })}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
              ) : (
                <input
                  type="number"
                  value={globals[p.key] ?? ''}
                  min={p.min} max={p.max}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v)) dispatch({ type: 'UPDATE_GLOBALS', patch: { [p.key]: v } })
                  }}
                  style={{
                    width: 60, background: '#0f1419', border: '1px solid #4a5568',
                    color: '#e2e8f0', borderRadius: 5, padding: '3px 6px',
                    fontSize: 13, textAlign: 'center',
                  }}
                />
              )}
            </div>
          ))}
          <p style={{ color: '#4a5568', fontSize: 11, margin: 0 }}>
            Changes take effect from the next match. "Reload Data" re-reads JSON files without restarting.
          </p>
        </div>
      )}
    </div>
  )
}
