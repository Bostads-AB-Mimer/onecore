import type { Lease, Tenant } from '@/services/types'

import { GET } from './core/base-api'

export async function fetchTenantAndLeasesByPnr(
  pnr: string
): Promise<{ tenant: Tenant; contracts: Lease[] } | null> {
  const normalized = normalizePnr(pnr)
  if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

  const { data, error } = await GET('/leases/by-pnr/{pnr}/includingAllLeases', {
    params: { path: { pnr: normalized } },
  })
  if (error) return null

  const contracts = (data?.content ?? []) as Lease[]
  if (!Array.isArray(contracts) || contracts.length === 0) return null

  const target = normalized
  const picked: Tenant | undefined =
    contracts
      .flatMap((l) => l.tenants ?? [])
      .find((t) => equalPnr(t?.nationalRegistrationNumber, target)) ??
    (contracts[0].tenants ?? [])[0]

  if (!picked) return null

  return {
    tenant: picked,
    contracts,
  }
}
const normalizePnr = (s: string) => (s ?? '').replace(/[^\d]/g, '')
const last10 = (s: string) => normalizePnr(s).slice(-10)
const equalPnr = (a?: string, b?: string) => last10(a ?? '') === last10(b ?? '')
