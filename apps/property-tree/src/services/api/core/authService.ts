import { resolve } from '@/shared/lib/env'

import type { components } from './generated/api-types'

export const authService = {
  async getUsersByRole(
    roleName: string
  ): Promise<components['schemas']['KeycloakUser'][]> {
    const baseUrl = resolve('VITE_CORE_API_URL', 'http://localhost:5010')
    const res = await fetch(
      `${baseUrl}/auth/roles/${encodeURIComponent(roleName)}/users`,
      { credentials: 'include' }
    )
    if (!res.ok) throw new Error(`Failed to fetch users for role ${roleName}`)
    const body = await res.json()
    return body.content as components['schemas']['KeycloakUser'][]
  },
}
