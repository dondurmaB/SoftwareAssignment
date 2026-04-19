import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { FileText, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const register = useAuthStore(s => s.register)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim()
    const normalizedUsername = username.trim()

    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (normalizedUsername.length < 3) { toast.error('Username must be at least 3 characters'); return }
    if (!/^[A-Za-z0-9_.-]+$/.test(normalizedUsername)) {
      toast.error('Username can only contain letters, numbers, _, ., and -')
      return
    }

    setLoading(true)
    try {
      await register(normalizedEmail, normalizedUsername, password)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: 'var(--primary-light)', borderRadius: '50%', marginBottom: 14 }}>
            <FileText size={24} color="var(--primary)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Create account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Start collaborating on CollabDocs</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Username <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(letters, numbers, _ . -)</span></label>
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your_username"
              required
              minLength={3}
              maxLength={50}
              pattern="^[A-Za-z0-9_.-]+$"
            />
          </div>
          <div className="form-group">
            <label>Password <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(min. 8 chars)</span></label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading && <Loader2 size={16} className="spinner" />}
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
