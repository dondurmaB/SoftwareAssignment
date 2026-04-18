import { Check, Loader2, AlertCircle, Edit3 } from 'lucide-react'
import type { SaveStatus } from '../../types'

const configs = {
  saved:   { icon: <Check size={13} />,                       label: 'Saved',       color: 'var(--success)' },
  saving:  { icon: <Loader2 size={13} className="spinner" />, label: 'Saving…',     color: 'var(--text-muted)' },
  unsaved: { icon: <Edit3 size={13} />,                       label: 'Unsaved',     color: 'var(--warning)' },
  error:   { icon: <AlertCircle size={13} />,                 label: 'Save failed', color: 'var(--danger)' },
}

export default function SaveStatusBar({ status }: { status: SaveStatus }) {
  const cfg = configs[status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: cfg.color }}>
      {cfg.icon}<span>{cfg.label}</span>
    </div>
  )
}
