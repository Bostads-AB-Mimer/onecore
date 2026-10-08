import { Outlet } from 'react-router-dom'
import type { OnecoreModule } from '@onecore/ui'

import { useUser } from '@/entities/user'

import { resolve } from '@/shared/lib/env'

import { authConfig } from '@/authConfig'

/**
 * Hosts a module's pages under its basePath. Property-tree keeps the frame
 * (header, search, sidebar); the module owns the content.
 */
export function ModulePage({ module }: { module: OnecoreModule }) {
  // React Query's structural sharing keeps `user.user` stable across refetches.
  const user = useUser()

  if (user.tag !== 'success') {
    return <div className="p-6">Laddar...</div>
  }

  return (
    <module.Host user={user.user} coreUrl={authConfig.apiUrl} env={resolve}>
      <Outlet />
    </module.Host>
  )
}
