import type { Lease } from '@/services/types'

import { GET } from './core/base-api'

// Helper functions from leaseSearchService
function isMaculated(lease: Lease): boolean {
  const n = (lease.leaseNumber ?? '').trim()
  if (n && /[Mm]$/.test(n)) return true

  const idTail = (lease.leaseId ?? '').split('/').pop() ?? ''
  if (idTail && /[Mm]$/.test(idTail.trim())) return true

  return false
}

function dedupeLeases(leases: Lease[]): Lease[] {
  const seen = new Set<string>()
  return (leases ?? []).filter((l) => {
    const id =
      l.leaseId ??
      (l.rentalPropertyId && l.leaseNumber
        ? `${l.rentalPropertyId}/${l.leaseNumber}`
        : undefined)

    const key =
      id ??
      JSON.stringify({ rp: l.rentalPropertyId ?? '', ln: l.leaseNumber ?? '' })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Fetch leases by move-in date range
 * @param fromDateStart - ISO date string for start of range (e.g., '2025-10-01')
 * @param fromDateEnd - ISO date string for end of range (e.g., '2025-10-31')
 * @returns Array of leases with move-in dates within the specified range
 */
export async function fetchLeasesByMoveInDateRange(
  fromDateStart: string,
  fromDateEnd: string
): Promise<Lease[]> {
  // First, fetch minimal lease list with date filter
  const { data, error } = await GET('/leases', {
    params: {
      query: {
        fromDateStart,
        fromDateEnd,
      },
    },
  })
  if (error) return []
  const minimalLeases = data?.content ?? []

  // Then fetch full details for each lease
  const leaseDetailsPromises = minimalLeases.map((minimalLease) =>
    fetchLeaseById(minimalLease.leaseId ?? '')
  )
  const leaseDetails = await Promise.all(leaseDetailsPromises)

  // Filter out null results and apply deduplication and maculation filter
  const validLeases = leaseDetails.filter(
    (lease): lease is Lease => lease !== null
  )
  const deduped = dedupeLeases(validLeases)
  const filtered = deduped.filter((l) => !isMaculated(l))
  return filtered
}

/**
 * Fetch leases by move-out date range (lastDebitDate)
 * @param lastDebitDateStart - ISO date string for start of range (e.g., '2025-10-01')
 * @param lastDebitDateEnd - ISO date string for end of range (e.g., '2025-10-31')
 * @returns Array of leases with move-out dates within the specified range
 */
export async function fetchLeasesByMoveOutDateRange(
  lastDebitDateStart: string,
  lastDebitDateEnd: string
): Promise<Lease[]> {
  // First, fetch minimal lease list with date filter
  const { data, error } = await GET('/leases', {
    params: {
      query: {
        lastDebitDateStart,
        lastDebitDateEnd,
      },
    },
  })
  if (error) return []
  const minimalLeases = data?.content ?? []

  // Then fetch full details for each lease
  const leaseDetailsPromises = minimalLeases.map((minimalLease) =>
    fetchLeaseById(minimalLease.leaseId ?? '')
  )
  const leaseDetails = await Promise.all(leaseDetailsPromises)

  // Filter out null results and apply deduplication and maculation filter
  const validLeases = leaseDetails.filter(
    (lease): lease is Lease => lease !== null
  )
  const deduped = dedupeLeases(validLeases)
  const filtered = deduped.filter((l) => !isMaculated(l))
  return filtered
}

/**
 * Fetch a single lease by ID
 * @param leaseId - The lease ID
 * @returns The lease object or null if not found
 */
export async function fetchLeaseById(leaseId: string): Promise<Lease | null> {
  const { data, error } = await GET('/leases/{id}', {
    params: {
      path: { id: leaseId },
    },
  })
  if (error) return null
  return (data?.content as Lease) ?? null
}
