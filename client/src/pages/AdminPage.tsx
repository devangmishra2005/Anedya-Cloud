import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import {
  createUser,
  fetchRolesCatalog,
  listUsers,
  patchUser,
  updateRolePermissions,
} from '../api/http'
import { useAuth } from '../context/AuthContext'
import type { Permission, RoleRow, User } from '../types'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'viewer', label: 'Viewer' },
]

export function AdminPage() {
  const { user, logout, refreshUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [permCatalog, setPermCatalog] = useState<{ key: Permission; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'roles'>('users')

  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState('operator')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, cat] = await Promise.all([listUsers(), fetchRolesCatalog()])
      setUsers(u)
      setRoles(cat.roles)
      setPermCatalog(cat.allPermissions)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreateUser(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    try {
      await createUser({
        email: createEmail,
        name: createName,
        password: createPassword,
        role: createRole,
      })
      setCreateEmail('')
      setCreateName('')
      setCreatePassword('')
      setMessage('User created.')
      await load()
    } catch {
      setMessage('Could not create user (duplicate email?).')
    }
  }

  async function onToggleActive(u: User) {
    await patchUser(u.id, { active: !u.active })
    await load()
  }

  async function onChangeRole(u: User, role: string) {
    await patchUser(u.id, { role })
    await load()
    if (u.id === user?.id) await refreshUser()
  }

  const [selectedRole, setSelectedRole] = useState<string>('operator')
  const [permDraft, setPermDraft] = useState<Permission[]>([])

  useEffect(() => {
    const r = roles.find((x) => x.key === selectedRole)
    if (r) setPermDraft(r.permissions as Permission[])
  }, [selectedRole, roles])

  async function saveRolePermissions(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    try {
      await updateRolePermissions(selectedRole, permDraft)
      setMessage('Role permissions updated. Users receive changes on refresh or re-login.')
      await load()
      await refreshUser()
    } catch {
      setMessage('Could not update role.')
    }
  }

  function togglePerm(p: Permission) {
    setPermDraft((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  return (
    <div className="layout-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Administration</span>
          <span className="brand-sub">Users and role templates · {user?.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <nav className="nav-links">
            <NavLink className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')} to="/" end>
              Dashboard
            </NavLink>
            <NavLink
              className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}
              to="/admin"
            >
              Administration
            </NavLink>
          </nav>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={'btn' + (tab === 'users' ? ' btn-primary' : '')} onClick={() => setTab('users')}>
          Users
        </button>
        <button type="button" className={'btn' + (tab === 'roles' ? ' btn-primary' : '')} onClick={() => setTab('roles')}>
          Role permissions
        </button>
      </div>

      {message ? <p className="muted" style={{ marginBottom: '1rem', color: 'var(--warn)' }}>{message}</p> : null}

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && tab === 'users' ? (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="card">
            <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
              Create user
            </h2>
            <form onSubmit={onCreateUser} style={{ display: 'grid', gap: '0.65rem', maxWidth: 420 }}>
              <input className="input" placeholder="Full name" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
              <input className="input" placeholder="Email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required />
              <input className="input" placeholder="Temporary password" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required />
              <select className="input" value={createRole} onChange={(e) => setCreateRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
                Create
              </button>
            </form>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
              All users
            </h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="input"
                        style={{ maxWidth: 160, padding: '0.35rem 0.5rem' }}
                        value={u.role}
                        onChange={(e) => void onChangeRole(u, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{u.active === false ? <span className="badge badge-warn">Inactive</span> : <span className="badge badge-ok">Active</span>}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" disabled={u.id === user?.id} onClick={() => void onToggleActive(u)}>
                        {u.active === false ? 'Activate' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && tab === 'roles' ? (
        <div className="card">
          <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
            Permission templates
          </h2>
          <p className="page-desc">
            Admins can define which capabilities each role carries. The Admin role must always retain user management.
          </p>
          <form onSubmit={saveRolePermissions} style={{ display: 'grid', gap: '1rem', maxWidth: 560 }}>
            <label className="muted">
              Role
              <select className="input" style={{ marginTop: '0.35rem' }} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {permCatalog.map((p) => (
                <label key={p.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={permDraft.includes(p.key)} onChange={() => togglePerm(p.key)} />
                  <span>
                    <strong style={{ fontWeight: 600 }}>{p.key}</strong>
                    <span className="muted"> — {p.label}</span>
                  </span>
                </label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>
              Save role
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
