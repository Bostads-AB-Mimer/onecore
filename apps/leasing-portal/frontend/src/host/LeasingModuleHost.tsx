import type { ModuleHostProps } from '@onecore/ui'

import { LeasingHostProvider } from './LeasingHostProvider'

/** Host wrapper for the module contract: reads the BFF url from the host's config. */
export function LeasingModuleHost({
  user,
  coreUrl,
  env,
  children,
}: ModuleHostProps) {
  // Empty when the BFF is not configured: pages that call it show their own error.
  const bffUrl = env('VITE_LEASING_BFF_URL', '')

  return (
    <LeasingHostProvider bffUrl={bffUrl} coreUrl={coreUrl} user={user}>
      {children}
    </LeasingHostProvider>
  )
}
