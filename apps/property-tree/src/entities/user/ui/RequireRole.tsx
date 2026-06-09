import type { ReactNode } from 'react'

import { useUser } from '../hooks/useUser'
import { hasAnyRole } from '../roles'

type Props = {
  roles: string[]
  children: ReactNode
}

export function RequireRole({ roles, children }: Props) {
  const userState = useUser()

  if (userState.tag !== 'success') return null

  if (!hasAnyRole(userState.user, roles)) return null

  return children
}
