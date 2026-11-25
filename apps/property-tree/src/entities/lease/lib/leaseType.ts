import type { components } from '@/services/api/core/generated/api-types'

type LeaseType = components['schemas']['LeaseSearchResult']['leaseType']

// Contract types (Kontraktstyp) the lease list can filter on. The values are
// the LeaseType names the lease search matches. Campuskontrakt,
// Korttidsuthyrning and the like only exist on leases that ended in Xpand;
// the search counts them as Övrigt.
export const LEASE_TYPE_FILTER_OPTIONS = [
  { label: 'Bostadskontrakt', value: 'Bostadskontrakt' },
  { label: 'Lokalkontrakt', value: 'Lokalkontrakt' },
  { label: 'Garagekontrakt', value: 'Garagekontrakt' },
  { label: 'P-Platskontrakt', value: 'P-Platskontrakt' },
  { label: 'Övrigt', value: 'Övrigt' },
] as const satisfies readonly { label: string; value: LeaseType }[]

export type LeaseTypeFilter =
  (typeof LEASE_TYPE_FILTER_OPTIONS)[number]['value']

export const isLeaseTypeFilter = (value: string): value is LeaseTypeFilter =>
  LEASE_TYPE_FILTER_OPTIONS.some((option) => option.value === value)
