import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'

import { useAuthStore } from '../store/authStore'
import { useDocumentStore } from '../store/documentStore'
import { useCollaboration } from '../hooks/useCollaboration'
import { useAutoSave } from '../hooks/useAutoSave'

import EditorToolbar from '../components/editor/EditorToolbar'
import PresenceBar from '../components/editor/PresenceBar'
import SaveStatusBar from '../components/editor/SaveStatusBar'
import VersionHistory from '../components/editor/VersionHistory'
import ShareModal from '../components/editor/ShareModal'
import AIPanel from '../components/ai/AIPanel'
import AIHistoryModal from '../components/ai/AIHistoryModal'

import type { ActiveUser } from '../types'
import toast from 'react-hot-toast'
import { ArrowLeft, Share2, Clock, Bot, History, Loader2, Edit2, Check, X } from 'lucide-react'

type RightPanel = 'none' | 'ai' | 'versions'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const docId = id ? parseInt(id) : undefined
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { currentDoc, fetchDocument, updateTitle, setSaveStatus, saveStatus } = useDocumentStore()

  const [loading, setLoading] = useState(true)
  const [rightPanel, setRightPanel] = useState<RightPanel>('none')
  const [showShare, setShowShare] = useState(false)
  const [showAIHistory, setShowAIHistory] = useState(false)
  const [presence, setPresence] = useState<ActiveUser[]>([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editorContent, setEditorContent] = useState('')

  const remoteEditRef = useRef(false)
  const isInitialLoadRef = useRef(true)

  // Load document
  useEffect(() => {
    if (!docId) return
    isInitialLoadRef.current = true
    fetchDocument(docId)
      .then(doc => { setEditorContent(doc.current_content); setTitleDraft(doc.title) })
      .catch(() => { toast.error('Document not found'); navigate('/dashboard') })
      .finally(() => setLoading(false))
  }, [docId, fetchDocument, navigate])

  const canEdit = currentDoc?.role === 'owner' || currentDoc?.role === 'editor'

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      CharacterCount,
    ],
    content: '',
    editable: false,
    onUpdate: ({ editor }) => {
      if (remoteEditRef.current) return
      setEditorContent(editor.getHTML())
      setSaveStatus('unsaved')
    },
  })

  // Set initial content
  useEffect(() => {
    if (!editor || !editorContent) return
    if (editor.getText().trim() !== '') return
    remoteEditRef.current = true
    editor.commands.setContent(editorContent, false)
    remoteEditRef.current = false
    setTimeout(() => { isInitialLoadRef.current = false }, 400)
  }, [editor, editorContent])

  // Sync editable
  useEffect(() => { if (editor) editor.setEditable(canEdit) }, [editor, canEdit])

  // Auto-save
  useAutoSave(docId, editorContent)

  // Real-time collaboration
  const handleRemoteEdit = useCallback((content: string, userId: number) => {
    if (userId === user?.id) return
    if (!editor) return
    remoteEditRef.current = true
    const { from, to } = editor.state.selection
    editor.commands.setContent(content, false)
    try { editor.commands.setTextSelection({ from, to }) } catch {}
    remoteEditRef.current = false
  }, [editor, user?.id])

  const handlePresenceChange = useCallback((users: ActiveUser[]) => {
    setPresence(users)
  }, [])

  const { connected, sendEdit } = useCollaboration({
    docId: docId ?? 0,
    onRemoteEdit: handleRemoteEdit,
    onPresenceChange: handlePresenceChange,
    enabled: !loading && !!docId,
  })

  // Broadcast local edits
  useEffect(() => {
    if (remoteEditRef.current || isInitialLoadRef.current || !editorContent || !connected) return
    sendEdit(editorContent)
  }, [editorContent, connected, sendEdit])

  // Title save
  const saveTitle = async () => {
    if (!docId || !titleDraft.trim()) return
    try { await updateTitle(docId, titleDraft.trim()); setEditingTitle(false) }
    catch { toast.error('Failed to update title') }
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} className="spinner" color="var(--primary)" />
    </div>
  )
  if (!currentDoc) return null

  const wordCount = editor?.storage.characterCount?.words?.() ?? 0

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 200, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /></button>

        {editingTitle && canEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input className="input" value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              style={{ maxWidth: 320, padding: '5px 10px', fontSize: 15, fontWeight: 600 }} autoFocus />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={saveTitle}><Check size={14} color="var(--success)" /></button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingTitle(false)}><X size={14} /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, cursor: canEdit ? 'pointer' : 'default', minWidth: 0 }}
            onClick={() => canEdit && setEditingTitle(true)}>
            <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentDoc.title}</span>
            {canEdit && <Edit2 size={13} color="var(--text-light)" style={{ flexShrink: 0 }} />}
          </div>
        )}

        <PresenceBar users={presence} connected={connected} myUserId={user?.id ?? 0} />
        <SaveStatusBar status={saveStatus} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          <button className={`btn btn-sm ${rightPanel === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRightPanel(p => p === 'ai' ? 'none' : 'ai')} title="AI Assistant">
            <Bot size={15} /> AI
          </button>
          <button className={`btn btn-sm ${rightPanel === 'versions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRightPanel(p => p === 'versions' ? 'none' : 'versions')} title="Version History">
            <History size={15} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAIHistory(true)} title="AI History">
            <Clock size={15} />
          </button>
          {currentDoc.role === 'owner' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowShare(true)}>
              <Share2 size={15} /> Share
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <EditorToolbar editor={canEdit ? editor : null} />
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 820, margin: '0 auto', background: 'var(--surface)', minHeight: '100%', boxShadow: 'var(--shadow-sm)' }}>
              <EditorContent editor={editor} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '5px 24px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
            <span>{wordCount} words</span>
            <span style={{ marginLeft: 'auto' }}>
              {currentDoc.role !== 'owner' && <><span className={`badge badge-${currentDoc.role}`}>{currentDoc.role}</span>&nbsp;mode</>}
            </span>
          </div>
        </div>

        {rightPanel !== 'none' && (
          <div style={{ width: 360, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            {rightPanel === 'ai' && docId && (
              <AIPanel editor={editor} docId={docId} onClose={() => setRightPanel('none')} canEdit={canEdit} />
            )}
            {rightPanel === 'versions' && docId && (
              <VersionHistory docId={docId} onClose={() => setRightPanel('none')}
                onRestored={(content) => {
                  if (editor) { remoteEditRef.current = true; editor.commands.setContent(content, false); remoteEditRef.current = false; setEditorContent(content) }
                }} />
            )}
          </div>
        )}
      </div>

      {showShare && docId && <ShareModal docId={docId} onClose={() => setShowShare(false)} />}
      {showAIHistory && docId && <AIHistoryModal docId={docId} onClose={() => setShowAIHistory(false)} />}
    </div>
  )
}
