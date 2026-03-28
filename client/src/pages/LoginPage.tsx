import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch {
      setError('Invalid email or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: '1.25rem' }}>
          <span className="brand-title">IoT operations</span>
          <span className="brand-sub">Sign in to the Anedya-backed dashboard</span>
        </div>
        {error ? <div className="login-error">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <label className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Email
          </label>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ marginBottom: '0.85rem' }}
          />
          <label className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ marginBottom: '1.1rem' }}
          />
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', lineHeight: 1.5 }}>
          Demo: <strong>admin@demo.local</strong> / <span className="mono">Admin123!</span> — operator and
          viewer accounts use the same pattern with their role names.
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          <Link to="/" className="muted">
            ← Back
          </Link>
        </p>
      </div>
    </div>
  )
}
