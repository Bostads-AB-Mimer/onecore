import { Outlet } from 'react-router-dom'
import { LeasingHostProvider } from '@onecore/leasing-portal-frontend'

import { useUser } from '@/entities/user'

import {
  isLeasingPortalEnabled,
  leasingBffUrl,
} from '@/shared/lib/leasingPortal'

import { authConfig } from '@/authConfig'

/**
 * Hosts the leasing portal pages under /uthyrning. Property-tree keeps the
 * frame (header, search, sidebar); the leasing package owns the content.
 */
export function LeasingPortalPage() {
  // React Query's structural sharing keeps `user.user` stable across refetches.
  const user = useUser()

  if (!isLeasingPortalEnabled) {
    return (
      <div className="p-6 text-muted-foreground">
        Uthyrningsportalen är inte konfigurerad för den här miljön.
      </div>
    )
  }

  if (user.tag !== 'success') {
    return <div className="p-6">Laddar...</div>
  }

  return (
    <LeasingHostProvider
      bffUrl={leasingBffUrl}
      coreUrl={authConfig.apiUrl}
      user={user.user}
    >
      <Outlet />
    </LeasingHostProvider>
  )
}
