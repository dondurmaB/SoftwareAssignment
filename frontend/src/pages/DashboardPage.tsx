import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDocumentStore } from '../store/documentStore'
import toast from 'react-hot-toast'
import { Plus, FileText, LogOut, Trash2, Clock, Users, Loader2, Search } from 'lucide-react'
import type { DocumentListItem } from '../types'
import { formatRelativeBackendDate } from '../utils/dates'

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const { documents, fetchDocuments, createDocument, deleteDocument } = useDocumentStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showNewDoc, setShowNewDoc] = useState(false)

  useEffect(() => {
    fetchDocuments().finally(() => setLoading(false))
  }, [fetchDocuments])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim() || 'Untitled Document'
    setCreating(true)
    try {
      const doc = await createDocument(title)
      setShowNewDoc(false)
      setNewTitle('')
      navigate(`/doc/${doc.id}`)
    } catch {
      toast.error('Failed to create document')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, doc: DocumentListItem) => {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    try {
      await deleteDocument(doc.id)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const filtered = documents.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
  const owned = filtered.filter(d => d.role === 'owner')
  const shared = filtered.filter(d => d.role !== 'owner')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: 18 }}>CollabDocs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>@{user?.username}</span>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/login') }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Documents</h1>
          <button className="btn btn-primary" onClick={() => setShowNewDoc(true)}>
            <Plus size={16} /> New Document
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 28 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Loader2 size={28} className="spinner" color="var(--primary)" />
          </div>
        ) : (
          <>
            {owned.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Owned by me</h2>
                <DocGrid docs={owned} onOpen={id => navigate(`/doc/${id}`)} onDelete={handleDelete} />
              </section>
            )}
            {shared.length > 0 && (
              <section>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Shared with me</h2>
                <DocGrid docs={shared} onOpen={id => navigate(`/doc/${id}`)} onDelete={handleDelete} />
              </section>
            )}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
                <FileText size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p style={{ fontSize: 16 }}>{search ? 'No documents match your search' : 'No documents yet'}</p>
                {!search && <p style={{ fontSize: 14, marginTop: 6 }}>Create your first document to get started</p>}
              </div>
            )}
          </>
        )}
      </main>

      {showNewDoc && (
        <div className="modal-backdrop" onClick={() => setShowNewDoc(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Document</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNewDoc(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Document title</label>
                  <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Untitled Document" autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewDoc(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function DocGrid({ docs, onOpen, onDelete }: { docs: DocumentListItem[], onOpen: (id: number) => void, onDelete: (e: React.MouseEvent, doc: DocumentListItem) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
      {docs.map(doc => (
        <div key={doc.id} className="card" onClick={() => onOpen(doc.id)}
          style={{ cursor: 'pointer', padding: 18, transition: 'transform 0.1s, box-shadow 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <FileText size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
            </div>
            {doc.role === 'owner' && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={e => onDelete(e, doc)} style={{ flexShrink: 0 }}>
                <Trash2 size={14} color="var(--text-muted)" />
              </button>
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={`badge badge-${doc.role}`}>{doc.role}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
              <Clock size={12} />
              {formatRelativeBackendDate(doc.updated_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
