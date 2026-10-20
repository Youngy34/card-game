export default function PassDeviceModal({ passDevice, onConfirm }) {
  if (!passDevice) return null
  const { to, message } = passDevice

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#1a202c', border: '1px solid #4a5568', borderRadius: 14,
        padding: '40px 48px', textAlign: 'center', maxWidth: 360,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontSize: 40 }}>📱</div>
        <div style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>
          Pass the device
        </div>
        <div style={{
          color: '#f6e05e', fontSize: 16, fontWeight: 600,
          background: '#2d3748', borderRadius: 8, padding: '10px 16px',
        }}>
          {message || `Player ${(to ?? 0) + 1}'s turn`}
        </div>
        <div style={{ color: '#718096', fontSize: 13 }}>
          Hand the device to that player, then tap below.
        </div>
        <button
          onClick={onConfirm}
          style={{
            background: '#276749', color: '#9ae6b4',
            border: 'none', borderRadius: 8, padding: '12px 24px',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}
        >
          I have the device — continue
        </button>
      </div>
    </div>
  )
}
