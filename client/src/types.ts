export type Permission =
  | 'view_dashboard'
  | 'control_relay'
  | 'view_analytics'
  | 'manage_users'

export interface User {
  id: string
  email: string
  name: string
  role: string
  roleLabel: string
  permissions: Permission[]
  active?: boolean
  createdAt?: number
}

export interface IotSnapshot {
  source: string
  deviceId: string
  online: boolean
  temperatureC: number
  humidityPct: number
  relayOn: boolean
  updatedAt: number
  note?: string
}

export interface HistoryPoint {
  ts: number
  value: number
}

export interface HistoryResponse {
  source?: string
  metric: string
  points: HistoryPoint[]
}

export interface RoleRow {
  id: string
  key: string
  label: string
  permissions: string[]
}
