import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchHistory, fetchSnapshot, setRelay } from '../api/http'
import { PermissionGate } from '../components/PermissionGate'
import { useAuth } from '../context/AuthContext'
import type { HistoryPoint, IotSnapshot } from '../types'

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MetricChart({
  title,
  data,
  unit,
  color,
}: {
  title: string
  data: HistoryPoint[]
  unit: string
  color: string
}) {
  const chartData = data.map((p) => ({
    label: formatTime(p.ts),
    v: p.value,
    ts: p.ts,
  }))
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        <span className="muted">{unit}</span>
      </div>
      <div style={{ width: '100%', height: 260, marginTop: '0.75rem' }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8b94a7', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#8b94a7', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              contentStyle={{
                background: '#141922',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#8b94a7' }}
              formatter={(value) => [`${value ?? '—'} ${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={color}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user, logout, can } = useAuth()
  const [snap, setSnap] = useState<IotSnapshot | null>(null)
  const [snapErr, setSnapErr] = useState<string | null>(null)
  const [tempHist, setTempHist] = useState<HistoryPoint[]>([])
  const [humHist, setHumHist] = useState<HistoryPoint[]>([])
  const [relayBusy, setRelayBusy] = useState(false)

  const loadSnapshot = useCallback(async () => {
    try {
      const s = await fetchSnapshot()
      setSnap(s)
      setSnapErr(null)
    } catch {
      setSnapErr('Unable to load live telemetry.')
    }
  }, [])

  const loadHistory = useCallback(async () => {
    if (!can('view_analytics')) return
    const now = Math.floor(Date.now() / 1000)
    const from = now - 24 * 3600
    try {
      const [t, h] = await Promise.all([
        fetchHistory('temperature', from, now),
        fetchHistory('humidity', from, now),
      ])
      setTempHist(t.points)
      setHumHist(h.points)
    } catch {
      /* charts optional */
    }
  }, [can])

  useEffect(() => {
    void loadSnapshot()
    const id = window.setInterval(() => void loadSnapshot(), 4000)
    return () => window.clearInterval(id)
  }, [loadSnapshot])

  useEffect(() => {
    void loadHistory()
    const id = window.setInterval(() => void loadHistory(), 60000)
    return () => window.clearInterval(id)
  }, [loadHistory])

  async function toggleRelay(next: boolean) {
    if (!can('control_relay')) return
    setRelayBusy(true)
    try {
      await setRelay(next)
      await loadSnapshot()
    } finally {
      setRelayBusy(false)
    }
  }

  return (
    <div className="layout-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">IoT dashboard</span>
          <span className="brand-sub">
            Signed in as {user?.name} · {user?.roleLabel}
            {snap?.source === 'mock' ? ' · demo data' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <nav className="nav-links">
            <NavLink className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')} to="/" end>
              Dashboard
            </NavLink>
            <PermissionGate permission="manage_users">
              <NavLink
                className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}
                to="/admin"
              >
                Administration
              </NavLink>
            </PermissionGate>
          </nav>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      {snapErr ? <p className="login-error">{snapErr}</p> : null}

      <section className="grid-metrics">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Device</span>
            <span className={`badge ${snap?.online ? 'badge-ok' : 'badge-warn'}`}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: snap?.online ? 'var(--success)' : 'var(--warn)',
                }}
              />
              {snap?.online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="metric-value" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
            {snap?.deviceId ?? '—'}
          </div>
          {snap?.note ? <p className="muted" style={{ marginTop: '0.5rem' }}>{snap.note}</p> : null}
        </div>
        <div className="card">
          <span className="metric-label">Temperature</span>
          <div className="metric-value">{snap != null ? `${snap.temperatureC}°C` : '—'}</div>
        </div>
        <div className="card">
          <span className="metric-label">Humidity</span>
          <div className="metric-value">{snap != null ? `${snap.humidityPct}%` : '—'}</div>
        </div>
        <div className="card">
          <span className="metric-label">Relay</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="metric-value" style={{ fontSize: '1.25rem' }}>
              {snap == null ? '—' : snap.relayOn ? 'ON' : 'OFF'}
            </span>
            <PermissionGate
              permission="control_relay"
              fallback={<span className="muted">Read-only</span>}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={relayBusy || snap == null}
                onClick={() => toggleRelay(!snap!.relayOn)}
              >
                {relayBusy ? 'Working…' : snap?.relayOn ? 'Turn OFF' : 'Turn ON'}
              </button>
            </PermissionGate>
          </div>
        </div>
      </section>

      <PermissionGate permission="view_analytics">
        <h2 className="page-title" style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>
          Historical trends (24h)
        </h2>
        <p className="page-desc" style={{ marginBottom: '1rem' }}>
          Pulled via the backend from Anedya when API keys are configured; otherwise synthetic series for demos.
        </p>
        <div className="charts-grid">
          <MetricChart title="Temperature" data={tempHist} unit="°C" color="#3d9dff" />
          <MetricChart title="Humidity" data={humHist} unit="%" color="#7c5cff" />
        </div>
      </PermissionGate>
    </div>
  )
}
