import type { ActiveUser } from '../../types'
import { Wifi, WifiOff } from 'lucide-react'

interface Props {
  users: ActiveUser[]
  connected: boolean
  myUserId: number
}

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22']

export default function PresenceBar({ users, connected, myUserId }: Props) {
  const others = users.filter(u => u.user_id !== myUserId)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
        {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span>{connected ? 'Live' : 'Reconnecting…'}</span>
      </div>
      {others.length > 0 && (
        <>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {others.slice(0, 5).map((u, i) => (
              <div key={u.user_id} title={u.username}
                style={{ width: 26, height: 26, borderRadius: '50%', background: COLORS[i % COLORS.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid var(--surface)', cursor: 'default', flexShrink: 0 }}>
                {u.username[0].toUpperCase()}
              </div>
            ))}
            {others.length > 5 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{others.length - 5}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>
              {others.length === 1 ? '1 other editing' : `${others.length} others editing`}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
