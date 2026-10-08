// eslint-disable-next-line no-restricted-imports -- the one allowed package import
import { leasingModule } from '@onecore/leasing-portal-frontend'
import type { OnecoreModule } from '@onecore/ui'

/**
 * Optional frontend modules mounted in this app. The only place module
 * packages are imported: vite.config.ts aliases a package not listed in
 * ONECORE_FRONTEND_MODULES to ./disabledModule.ts, so its code never enters the bundle.
 */
export const modules: OnecoreModule[] = [leasingModule].filter(
  (m): m is OnecoreModule => m !== null
)
