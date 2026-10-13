import type { ReactNode } from 'react'

import { AuthConfigContext, type AuthConfig } from './context'

export function AuthProvider({
  config,
  children,
}: {
  config: AuthConfig
  children: ReactNode
}) {
  return (
    <AuthConfigContext.Provider value={config}>
      {children}
    </AuthConfigContext.Provider>
  )
}
