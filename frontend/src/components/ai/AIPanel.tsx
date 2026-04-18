import { useState, useRef } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { aiApi } from '../../api'
import { Bot, X, Wand2, Check, RotateCcw, Square, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AIAction } from '../../types'
import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor | null
  docId: number
  onClose: () => void
  canEdit: boolean
}

// Backend supports: rewrite | summarize | translate | enhance
const FEATURES: { value: AIAction; label: string; desc: string }[] = [
  { value: 'rewrite',   label: 'Rewrite',   desc: 'Improve clarity and flow' },
  { value: 'summarize', label: 'Summarize', desc: 'Create a concise summary' },
  { value: 'translate', label: 'Translate', desc: 'Translate to another language' },
  { value: 'enhance',   label: 'Enhance',   desc: 'Improve structure and style' },
]

export default function AIPanel({ editor, docId, onClose, canEdit }: Props) {
  const [action, setAction] = useState<AIAction>('rewrite')
  const [targetLang, setTargetLang] = useState('French')
  const [editedSuggestion, setEditedSuggestion] = useState('')
  const [phase, setPhase] = useState<'configure' | 'result'>('configure')
  const previousContentRef = useRef<string>('')

  const { streaming, streamedText, suggestionId, error, startStream, cancelStream, reset } = useAIStream()

  const getSelectedText = () => {
    if (!editor) return ''
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }

  const buildOptions = (): Record<string, string> => {
    if (action === 'translate') return { target_language: targetLang }
    return {}
  }

  const handleRun = () => {
    const selectedText = getSelectedText()
    if (!selectedText.trim()) { toast.error('Select some text first'); return }
    setEditedSuggestion('')
    setPhase('result')
    startStream({ documentId: docId, action, selectedText, options: buildOptions() })
  }

  const displayText = editedSuggestion || streamedText

  const handleAccept = async () => {
    if (!suggestionId || !editor) return
    const finalText = editedSuggestion || streamedText
    try {
      previousContentRef.current = editor.getHTML()
      const { from, to } = editor.state.selection
      if (from !== to) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, finalText).run()
      } else {
        editor.chain().focus().insertContent(finalText).run()
      }
      await aiApi.decideOnSuggestion(suggestionId, 'accepted')
      toast.success('Suggestion applied')
      resetPanel()
    } catch {
      toast.error('Failed to apply suggestion')
    }
  }

  const handleReject = async () => {
    if (suggestionId) {
      try { await aiApi.decideOnSuggestion(suggestionId, 'rejected') } catch {}
    }
    resetPanel()
  }

  const handleUndo = () => {
    if (previousContentRef.current && editor) {
      editor.commands.setContent(previousContentRef.current)
      previousContentRef.current = ''
      toast('Change undone')
    }
  }

  const resetPanel = () => { reset(); setPhase('configure'); setEditedSuggestion('') }

  const selectedText = getSelectedText()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} color="var(--primary)" />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>AI Writing Assistant</h3>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {!canEdit && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Viewers cannot use the AI assistant.
          </div>
        )}

        {phase === 'configure' && canEdit && (
          <>
            <div className="form-group">
              <label>Feature</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FEATURES.map(f => (
                  <label key={f.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius)', border: `1px solid ${action === f.value ? 'var(--primary)' : 'var(--border)'}`, background: action === f.value ? 'var(--primary-light)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.1s' }}>
                    <input type="radio" name="action" value={f.value} checked={action === f.value} onChange={() => setAction(f.value)} style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {action === 'translate' && (
              <div className="form-group">
                <label>Target language</label>
                <select className="input" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                  {['French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Arabic', 'Chinese', 'Japanese', 'Korean', 'Russian'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Selected text {!selectedText && <span style={{ color: 'var(--danger)', fontWeight: 400 }}>(none selected)</span>}</label>
              <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 100, overflowY: 'auto', color: selectedText ? 'var(--text)' : 'var(--text-light)', fontStyle: selectedText ? 'normal' : 'italic' }}>
                {selectedText || 'Select text in the editor, then run AI'}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleRun} disabled={!selectedText.trim()}>
              <Wand2 size={15} /> Run AI
            </button>
          </>
        )}

        {phase === 'result' && canEdit && (
          <>
            <div className="form-group">
              <label>Original text</label>
              <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, maxHeight: 100, overflowY: 'auto' }}>
                {getSelectedText() || '(selection)'}
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ margin: 0 }}>AI Suggestion {streaming && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(generating…)</span>}</label>
                {streaming && (
                  <button className="btn btn-ghost btn-sm" onClick={cancelStream} style={{ color: 'var(--danger)' }}>
                    <Square size={12} /> Cancel
                  </button>
                )}
              </div>

              {error ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fff5f5', padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', border: '1px solid #fecaca' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              ) : (
                <textarea className="input" value={streaming ? streamedText : displayText}
                  onChange={e => !streaming && setEditedSuggestion(e.target.value)}
                  readOnly={streaming} rows={8}
                  placeholder={streaming ? '' : 'Edit suggestion before accepting…'}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, background: streaming ? 'var(--surface2)' : 'var(--surface)' }} />
              )}

              {streaming && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  <Loader2 size={12} className="spinner" /> Generating…
                </div>
              )}
            </div>

            {!streaming && !error && displayText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleAccept}><Check size={15} /> Accept & Apply</button>
                <button className="btn btn-secondary" onClick={handleReject}><X size={15} /> Reject</button>
                {previousContentRef.current && (
                  <button className="btn btn-ghost" onClick={handleUndo} style={{ fontSize: 13 }}>
                    <RotateCcw size={13} /> Undo last acceptance
                  </button>
                )}
              </div>
            )}

            {!streaming && (
              <button className="btn btn-ghost btn-sm" onClick={resetPanel} style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                ← Try different feature
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
