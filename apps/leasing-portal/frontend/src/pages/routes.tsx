import type { RouteObject } from 'react-router-dom'

import { StartPage } from './StartPage'

/**
 * Mounted by a host under its own prefix: property-tree at /uthyrning, the
 * standalone shell at /. Links inside pages stay relative for that reason.
 */
export const leasingRoutes: RouteObject[] = [
  {
    index: true,
    element: <StartPage />,
    handle: { title: 'Uthyrning' },
  },
]
