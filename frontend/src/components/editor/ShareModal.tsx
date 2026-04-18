import { useEffect, useState } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { Users, X, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props { docId: number; onClose: () => void }

export default function ShareModal({ docId, onClose }: Props) {
  const { permissions, fetchPermissions, shareDocument, updatePermission, removePermission } = useDocumentStore()
  const [identifier, setIdentifier] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchPermissions(docId) }, [docId, fetchPermissions])

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await shareDocument(docId, identifier.trim(), role)
      toast.success(`Shared with ${identifier}`)
      setIdentifier('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to share')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: 'editor' | 'viewer') => {
    try {
      await updatePermission(docId, userId, newRole)
      toast.success('Role updated')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to update role')
    }
  }

  const handleRemove = async (userId: number, username: string) => {
    if (!confirm(`Remove ${username}'s access?`)) return
    try {
      await removePermission(docId, userId)
      toast.success('Access removed')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Failed to remove')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--primary)" />
            <h2>Share Document</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleShare} style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={identifier} onChange={e => setIdentifier(e.target.value)}
              placeholder="Email or username" required style={{ flex: 1 }} />
            <select className="input" value={role} onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
              style={{ width: 110, flexShrink: 0 }}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ flexShrink: 0 }}>
              {loading ? <Loader2 size={14} className="spinner" /> : null} Invite
            </button>
          </form>

          <div>
            <label style={{ marginBottom: 10, display: 'block' }}>People with access</label>
            {permissions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No one else has access yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {permissions.map(p => (
                  <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {p.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>@{p.username}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</div>
                    </div>
                    {p.role === 'owner' ? (
                      <span className="badge badge-owner">Owner</span>
                    ) : (
                      <>
                        <select className="input" value={p.role} onChange={e => handleRoleChange(p.user_id, e.target.value as 'editor' | 'viewer')}
                          style={{ width: 100, padding: '4px 8px', fontSize: 12 }}>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleRemove(p.user_id, p.username)}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
