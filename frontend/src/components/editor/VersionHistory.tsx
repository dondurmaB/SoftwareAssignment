import { useEffect } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import { RotateCcw, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatRelativeBackendDate } from '../../utils/dates'

interface Props {
  docId: number
  onClose: () => void
  onRestored: (content: string) => void
}

export default function VersionHistory({ docId, onClose, onRestored }: Props) {
  const { versions, fetchVersions, restoreVersion } = useDocumentStore()

  useEffect(() => { fetchVersions(docId) }, [docId, fetchVersions])

  const handleRestore = async (versionId: number, vnum: number) => {
    if (!confirm(`Restore to version ${vnum}? Current content will be replaced with that checkpoint.`)) return
    try {
      const doc = await restoreVersion(docId, versionId)
      toast.success(`Restored to version ${vnum}`)
      onRestored(doc.current_content)
    } catch {
      toast.error('Failed to restore version')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color="var(--primary)" />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Version History</h3>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {versions.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No versions yet</div>
        ) : (
          versions.map((v, i) => (
            <div key={v.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: v.is_current ? 'var(--primary)' : 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: v.is_current ? '#fff' : 'var(--primary)', flexShrink: 0 }}>
                {v.version_number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {v.is_current ? 'Current version' : `Version ${v.version_number}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 1 }}>
                  {formatRelativeBackendDate(v.created_at)}
                </div>
              </div>
              {!v.is_current && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(v.id, v.version_number)} style={{ flexShrink: 0 }}>
                  <RotateCcw size={12} /> Restore
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
