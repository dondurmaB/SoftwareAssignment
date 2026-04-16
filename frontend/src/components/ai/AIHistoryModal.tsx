interface Props { docId: string; onClose: () => void }

export default function AIHistoryModal({ docId, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true">AI</span>
            <h2>AI Interaction History</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close AI history">
            ×
          </button>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              AI interaction history is temporarily disabled.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              The AI assistant was merged before its API contract and frontend dependencies were fully integrated. This modal stays in a safe placeholder state until the feature is completed end-to-end.
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13 }}>
              Document ID: {docId || 'No document selected'}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
