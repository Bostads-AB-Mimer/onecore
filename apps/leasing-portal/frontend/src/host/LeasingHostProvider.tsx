import { type ReactNode, useMemo } from 'react'

import { createLeasingApi } from '../api/client'
import { LeasingHostContext } from './context'
import type { LeasingHostConfig } from './types'

type Props = LeasingHostConfig & { children: ReactNode }

/**
 * Wraps the leasing routes with what the pages need from their host.
 * The host mounts the UI lib's Toaster, like it mounts the router and query client.
 */
export function LeasingHostProvider({
  bffUrl,
  coreUrl,
  user,
  children,
}: Props) {
  const api = useMemo(
    () => createLeasingApi({ bffUrl, coreUrl }),
    [bffUrl, coreUrl]
  )
  const value = useMemo(
    () => ({ bffUrl, coreUrl, user, api }),
    [bffUrl, coreUrl, user, api]
  )

  return (
    <LeasingHostContext.Provider value={value}>
      {children}
    </LeasingHostContext.Provider>
  )
}
