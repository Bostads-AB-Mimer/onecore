import { resolve } from '@/shared/lib/env'

/** Base URL of the leasing portal backend, prefix included. Empty disables the portal pages. */
export const leasingBffUrl = resolve('VITE_LEASING_BFF_URL', '')

export const isLeasingPortalEnabled = leasingBffUrl !== ''
