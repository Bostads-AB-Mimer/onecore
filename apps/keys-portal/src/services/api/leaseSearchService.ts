// leaseSearchService.ts
import type { Lease, Tenant } from '@/services/types'

import { GET } from './core/base-api'

// ---------- helpers ----------
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

function normalizePnr(s: string) {
  return (s ?? '').replace(/[^\d]/g, '')
}
const last10 = (s: string) => normalizePnr(s).slice(-10)
const equalPnr = (a?: string, b?: string) => last10(a ?? '') === last10(b ?? '')

// ---------- queries ----------
export async function fetchLeasesByRentalPropertyId(
  rentalPropertyId: string,
  {
    includeUpcomingLeases = true,
    includeTerminatedLeases = true,
    includeContacts = true,
  }: {
    includeUpcomingLeases?: boolean
    includeTerminatedLeases?: boolean
    includeContacts?: boolean
  } = {}
): Promise<Lease[]> {
  const { data, error } = await GET(
    '/leases/by-rental-property-id/{rentalPropertyId}',
    {
      params: {
        path: { rentalPropertyId },
        query: {
          includeUpcomingLeases,
          includeTerminatedLeases,
          includeContacts,
        },
      },
    }
  )
  if (error) return []
  const list = (data?.content ?? []) as Lease[]
  const deduped = dedupeLeases(Array.isArray(list) ? list : [])
  const filtered = deduped.filter((l) => !isMaculated(l)) // ⬅️ hide /..M
  return filtered
}

export async function fetchTenantAndLeasesByPnr(
  pnr: string
): Promise<{ tenant: Tenant; contracts: Lease[] } | null> {
  const normalized = normalizePnr(pnr)
  if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

  const { data, error } = await GET('/leases/by-pnr/{pnr}/includingAllLeases', {
    params: { path: { pnr: normalized } },
  })
  if (error) return null

  const raw = (data?.content ?? []) as Lease[]
  const deduped = dedupeLeases(Array.isArray(raw) ? raw : [])
  const contracts = deduped.filter((l) => !isMaculated(l)) // ⬅️ hide /..M
  if (contracts.length === 0) return null

  const target = normalized
  const picked: Tenant | undefined =
    contracts
      .flatMap((l) => l.tenants ?? [])
      .find((t) => equalPnr(t?.nationalRegistrationNumber, target)) ??
    (contracts[0].tenants ?? [])[0]

  if (!picked) return null

  return { tenant: picked, contracts }
}
