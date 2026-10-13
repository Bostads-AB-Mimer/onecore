import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, type AuthConfig } from '../src'

export const config: AuthConfig = {
  keycloakUrl: 'https://auth.example',
  keycloakRealm: 'onecore',
  clientId: 'leasing',
  redirectUri: 'https://app.example/callback',
  coreUrl: 'https://core.example',
}

/** A wrapper for renderHook, plus its query client so a test can force a refetch. */
export function makeWrapper() {
  const queryClient = new QueryClient()

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider config={config}>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }
  return { wrapper, queryClient }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const profile = {
  id: 'user-1',
  name: 'Test Testsson',
  email: 'test@example.com',
  employeeId: 'YY2333',
  source: 'keycloak',
  realm_access: { roles: ['leasing'] },
}
