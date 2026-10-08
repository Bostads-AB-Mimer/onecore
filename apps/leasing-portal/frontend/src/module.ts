import type { OnecoreModule } from '@onecore/ui'
import { Handshake, Home, Sparkles } from 'lucide-react'

import { LeasingModuleHost } from './host/LeasingModuleHost'
import { leasingRoutes } from './pages/routes'

/** What a host needs to mount the leasing portal: routes, menu and host wrapper. */
export const leasingModule: OnecoreModule = {
  id: 'leasing',
  basePath: '/uthyrning',
  title: 'Uthyrning',
  routes: leasingRoutes,
  navigation: [
    {
      label: 'Uthyrning',
      icon: Handshake,
      children: [
        {
          label: 'Bostad',
          to: 'bostad',
          icon: Home,
          children: [
            {
              label: 'Poängfritt',
              to: 'bostad/poangfritt',
              icon: Sparkles,
              disabled: true,
            },
          ],
        },
        // Hidden until their pages exist; the routes already resolve.
        // { label: 'Bilplats', to: 'bilplats', icon: Car },
        // { label: 'Förråd', to: 'forrad', icon: Archive },
      ],
    },
  ],
  Host: LeasingModuleHost,
}
