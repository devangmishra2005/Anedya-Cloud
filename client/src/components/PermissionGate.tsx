import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Permission } from '../types'

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) return fallback
  return children
}
