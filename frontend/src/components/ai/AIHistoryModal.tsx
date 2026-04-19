import { useEffect, useState } from 'react'
import { aiApi } from '../../api'
import type { AIHistoryItem } from '../../types'
import { Bot, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRelativeBackendDate } from '../../utils/dates'

interface Props {
  docId: number
  onClose: () => void
}

const actionLabels: Record<string, string> = {
  rewrite: 'Rewrite',
  summarize: 'Summarize',
  translate: 'Translate',
  enhance: 'Enhance',
}

export default function AIHistoryModal({ docId, onClose }: Props) {
  const [history, setHistory] = useState<AIHistoryItem[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    aiApi.getHistory(docId)
      .then((response) => setHistory(response.data))
      .catch((err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        const message = typeof detail === 'string'
          ? detail
          : (err as { message?: string })?.message ?? 'Failed to load AI history.'
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [docId])

  const interactionStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>Completed</span>
      case 'failed':
        return <span className="badge badge-danger">Failed</span>
      case 'canceled':
        return <span className="badge" style={{ background: '#fff7ed', color: '#c2410c' }}>Canceled</span>
      default:
        return <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>In progress</span>
    }
  }

  const decisionStatusBadge = (status?: string | null) => {
    if (!status || status === 'pending') {
      return <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>Pending decision</span>
    }
    if (status === 'accepted') return <span className="badge badge-success">Accepted</span>
    return <span className="badge badge-danger">Rejected</span>
  }

  const emptySuggestionMessage = (item: AIHistoryItem) => {
    if (item.status === 'failed') return 'Generation failed before a suggestion was saved.'
    if (item.status === 'canceled') return 'Interaction was canceled before a suggestion was saved.'
    return 'No persisted suggestion was saved for this interaction.'
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
          ) : error ? (
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--danger)' }}>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>AI history could not be loaded.</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{error}</div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bot size={36} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No AI interactions yet</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.interaction_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === item.interaction_id ? null : item.interaction_id)}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={14} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{actionLabels[item.action] ?? item.action}</span>
                      {interactionStatusBadge(item.status)}
                      {decisionStatusBadge(item.decision_status)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      by @{item.username} · {formatRelativeBackendDate(item.created_at)} · {item.model_name}
                    </div>
                  </div>
                  {expanded === item.interaction_id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>

                {expanded === item.interaction_id && (
                  <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ marginBottom: 6 }}>Original text</label>
                      <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
                        {item.selected_text}
                      </div>
                    </div>

                    {item.suggested_text ? (
                      <div>
                        <label style={{ marginBottom: 6 }}>AI suggestion</label>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
                          {item.suggested_text}
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                        {emptySuggestionMessage(item)}
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
