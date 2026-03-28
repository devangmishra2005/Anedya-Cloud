import axios from 'axios'
import type { HistoryResponse, IotSnapshot, Permission, User, RoleRow } from '../types'

const TOKEN_KEY = 'iot_jwt'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const t = getStoredToken()
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      setStoredToken(null)
    }
    return Promise.reject(err)
  },
)

export async function loginRequest(email: string, password: string) {
  const { data } = await http.post<{ token: string; user: User }>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function fetchMe() {
  const { data } = await http.get<{ user: User }>('/auth/me')
  return data.user
}

export async function refreshSession() {
  const { data } = await http.post<{ token: string; user: User }>('/auth/refresh')
  setStoredToken(data.token)
  return data.user
}

export async function fetchSnapshot() {
  const { data } = await http.get<IotSnapshot>('/iot/snapshot')
  return data
}

export async function fetchHistory(metric: 'temperature' | 'humidity', from: number, to: number) {
  const { data } = await http.get<HistoryResponse>('/iot/history', {
    params: { metric, from, to },
  })
  return data
}

export async function setRelay(state: boolean) {
  const { data } = await http.post('/iot/relay', { state })
  return data
}

export async function listUsers() {
  const { data } = await http.get<{ users: User[] }>('/users')
  return data.users
}

export async function createUser(payload: {
  email: string
  password: string
  name: string
  role: string
}) {
  const { data } = await http.post<{ user: User }>('/users', payload)
  return data.user
}

export async function patchUser(
  id: string,
  payload: { name?: string; role?: string; active?: boolean },
) {
  const { data } = await http.patch<{ user: User }>(`/users/${id}`, payload)
  return data.user
}

export async function fetchRolesCatalog() {
  const { data } = await http.get<{
    roles: RoleRow[]
    allPermissions: { key: Permission; label: string }[]
  }>('/roles')
  return data
}

export async function updateRolePermissions(roleKey: string, permissionKeys: Permission[]) {
  const { data } = await http.patch<{ role: RoleRow }>(`/roles/${roleKey}/permissions`, {
    permissionKeys,
  })
  return data.role
}
