interface EditorLike {
  state: {
    selection: {
      from: number
      to: number
    }
    doc: {
      textBetween: (from: number, to: number, separator: string) => string
    }
  }
}

interface Props {
  editor: EditorLike | null
  docId: string
  onClose: () => void
  canEdit: boolean
}

export default function AIPanel({ editor, docId, onClose, canEdit }: Props) {
  const selectedText = editor
    ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true">AI</span>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>AI Writing Assistant</h3>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close AI panel">
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 13, lineHeight: 1.6 }}>
          <strong>Stabilized placeholder</strong>
          <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
            The AI assistant UI was merged before its frontend dependencies and backend contract were ready. This panel is intentionally held in a safe placeholder state until the full AI feature is integrated end-to-end.
          </div>
        </div>

        <div className="form-group">
          <label>Document ID</label>
          <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13 }}>
            {docId || 'No document selected'}
          </div>
        </div>

        <div className="form-group">
          <label>Selected text</label>
          <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto', color: selectedText ? 'var(--text)' : 'var(--text-light)', fontStyle: selectedText ? 'normal' : 'italic' }}>
            {selectedText || 'Select text in the editor once AI backend support is ready.'}
          </div>
        </div>

        <div style={{ background: canEdit ? 'var(--surface2)' : '#fff1f2', border: `1px solid ${canEdit ? 'var(--border)' : '#fecdd3'}`, borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13, color: canEdit ? 'var(--text-muted)' : '#9f1239' }}>
          {canEdit
            ? 'AI actions are disabled in this build to avoid broken requests and inconsistent editor behavior.'
            : 'Viewer access is read-only. AI actions remain unavailable.'}
        </div>
      </div>
    </div>
  )
}
