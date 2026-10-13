import { Navigate, type RouteObject } from 'react-router-dom'

import { BostadPage } from './BostadPage'
import { PoangsattPage } from './PoangsattPage'
import { ShellPage } from './ShellPage'

/**
 * Mounted by a host under its own prefix: property-tree at /uthyrning, the
 * standalone shell at /. Links inside pages stay relative for that reason.
 */
export const leasingRoutes: RouteObject[] = [
  // The module root is not a page of its own.
  { index: true, element: <Navigate to="bostad" replace /> },
  {
    path: 'bostad',
    element: <BostadPage />,
    handle: { title: 'Bostad' },
  },
  {
    path: 'bostad/poangfritt',
    element: <ShellPage title="Poängfritt" />,
    handle: { title: 'Poängfritt' },
  },
  {
    path: 'bostad/poangsatt/:tab?',
    element: <PoangsattPage />,
    handle: { title: 'Poängsatt' },
  },
  {
    path: 'bilplats',
    element: <ShellPage title="Bilplats" />,
    handle: { title: 'Bilplats' },
  },
  {
    path: 'forrad',
    element: <ShellPage title="Förråd" />,
    handle: { title: 'Förråd' },
  },
]
