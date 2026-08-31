import type { Lease, Tenant } from '@/services/types'

import { GET } from './core/base-api'

export function dedupeLeases(leases: Lease[]): Lease[] {
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
export const equalPnr = (a?: string, b?: string) =>
  last10(a ?? '') === last10(b ?? '')

// ---------- queries ----------
// includeContacts has to be passed explicitly: core defaults it to false, and
// without it `tenants` comes back undefined.
export async function fetchLeasesByRentalPropertyId(
  rentalObjectCode: string
): Promise<Lease[]> {
  const { data, error } = await GET(
    '/leases/by-rental-object-code/{rentalObjectCode}',
    {
      params: {
        path: { rentalObjectCode },
        query: { includeContacts: true },
      },
    }
  )
  if (error) return []
  return dedupeLeases((data?.content ?? []) as Lease[])
}

export async function fetchTenantAndLeasesByPnr(
  pnr: string
): Promise<{ tenant: Tenant; contracts: Lease[] } | null> {
  const normalized = normalizePnr(pnr)
  if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

  const { data, error } = await GET('/leases/by-pnr/{pnr}', {
    params: {
      path: { pnr: normalized },
      query: { includeContacts: true },
    },
  })
  if (error) return null

  const contracts = dedupeLeases((data?.content ?? []) as Lease[])
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
    params: {
      path: { contactCode: normalized },
      query: { includeContacts: true },
    },
  })
  if (error) return null

  const contracts = dedupeLeases((data?.content ?? []) as Lease[])
  if (contracts.length === 0) return null

  const picked: Tenant | undefined =
    contracts
      .flatMap((l) => l.tenants ?? [])
      .find((t) => t?.contactCode === normalized) ??
    (contracts[0].tenants ?? [])[0]

  if (!picked) return null

  return { tenant: picked, contracts }
}
