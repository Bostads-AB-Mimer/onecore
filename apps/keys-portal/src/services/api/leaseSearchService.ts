import type { Lease, Tenant } from '@/services/types'

import { GET } from './core/base-api'

function isMaculated(lease: Lease): boolean {
  const n = (lease.leaseNumber ?? '').trim()
  // Check if lease number contains 'M' or 'm' (e.g., "01M", "02M2", "07M")
  if (n && /[Mm]/.test(n)) return true

  const idTail = (lease.leaseId ?? '').split('/').pop() ?? ''
  // Check if lease ID tail contains 'M' or 'm'
  if (idTail && /[Mm]/.test(idTail.trim())) return true

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

export async function fetchTenantAndLeasesByContactCode(
  contactCode: string
): Promise<{ tenant: Tenant; contracts: Lease[] } | null> {
  const normalized = contactCode.trim().toUpperCase()

  const { data, error } = await GET('/leases/by-contact-code/{contactCode}', {
    params: { path: { contactCode: normalized } },
  })
  if (error || !data) return null

  // API returns { content: Lease[] } similar to other endpoints
  const raw = (data as any)?.content ?? []
  const deduped = dedupeLeases(Array.isArray(raw) ? raw : [])
  const contracts = deduped.filter((l) => !isMaculated(l)) // ⬅️ hide /..M
  if (contracts.length === 0) return null

  // Find the tenant with matching contact code
  const picked: Tenant | undefined =
    contracts
      .flatMap((l) => l.tenants ?? [])
      .find((t) => t?.contactCode === normalized) ??
    (contracts[0].tenants ?? [])[0]

  if (!picked) return null

  return { tenant: picked, contracts }
}
