import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { LeasingHostProvider } from '../src/host/LeasingHostProvider'
import type { LeasingUser } from '../src/host/types'

export const testUser: LeasingUser = {
  id: 'user-1',
  name: 'Test Testsson',
  email: 'test@example.com',
  roles: ['leasing'],
}

export const bffUrl = 'http://bff.test/leasing-portal'
export const coreUrl = 'http://core.test'

/** A host like property-tree would be: query client plus the leasing provider. */
export function TestHost({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <LeasingHostProvider bffUrl={bffUrl} coreUrl={coreUrl} user={testUser}>
        {children}
      </LeasingHostProvider>
    </QueryClientProvider>
  )
}

/** Stubs fetch to answer the BFF profile route. Returns the mock for call assertions. */
export function stubProfileFetch(
  body: unknown = {
    id: 'user-1',
    email: 'test@example.com',
    source: 'keycloak',
  },
  status = 200
) {
  const fetchMock = vi.fn(
    async (_input: Request) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
