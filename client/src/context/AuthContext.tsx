import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Permission, User } from '../types'
import { fetchMe, getStoredToken, loginRequest, setStoredToken, refreshSession } from '../api/http'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const u = await fetchMe()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password)
    setStoredToken(data.token)
    setUser(data.user)
  }, [])

  const can = useCallback(
    (permission: Permission) => {
      return Boolean(user?.permissions.includes(permission))
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser: async () => {
        const token = getStoredToken()
        if (!token) return
        const u = await refreshSession()
        setUser(u)
      },
      can,
    }),
    [user, loading, login, logout, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
