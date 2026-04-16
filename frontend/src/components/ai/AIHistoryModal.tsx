import { useEffect, useState } from 'react'
import { aiApi } from '../../api'
import type { AIInteraction } from '../../types'
import { Bot, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Props { docId: string; onClose: () => void }

const featureLabels: Record<string, string> = {
  rewrite: 'Rewrite', summarize: 'Summarize', translate: 'Translate',
  enhance: 'Enhance', grammar: 'Fix Grammar', custom: 'Custom',
}

export default function AIHistoryModal({ docId, onClose }: Props) {
  const [history, setHistory] = useState<AIInteraction[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    aiApi.getHistory(docId)
      .then(r => setHistory(r.data))
      .finally(() => setLoading(false))
  }, [docId])

  const statusBadge = (status?: string) => {
    if (!status || status === 'pending') return <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>Pending</span>
    if (status === 'accepted') return <span className="badge badge-success">Accepted</span>
    return <span className="badge badge-danger">Rejected</span>
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} color="var(--primary)" />
            <h2>AI Interaction History</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bot size={36} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No AI interactions yet</p>
            </div>
          ) : (
            history.map(item => (
              <div key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={14} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{featureLabels[item.feature] ?? item.feature}</span>
                      {statusBadge(item.decision_status)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      by {item.user_name} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })} · {item.model_name}
                    </div>
                  </div>
                  {expanded === item.id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>

                {expanded === item.id && (
                  <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ marginBottom: 6 }}>Original text</label>
                      <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
                        {item.selected_text}
                      </div>
                    </div>
                    {item.suggested_text && (
                      <div>
                        <label style={{ marginBottom: 6 }}>AI suggestion</label>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
                          {item.suggested_text}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
