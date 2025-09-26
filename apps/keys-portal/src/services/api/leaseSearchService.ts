import type {
  Lease as ApiLease,
  Tenant as ApiTenantArray,
  TenantAddress as AddressAlias,
} from '@/services/types'

import { GET } from './core/base-api'

export type Address = AddressAlias
type ApiTenant = ApiTenantArray[number]

export type Lease = {
  leaseId: string
  leaseStartDate: Date
  leaseEndDate?: Date

  rentalPropertyId: string
  rentalProperty?: {
    rentalPropertyId: string
    address?: Address
  }

  address?: Address
  rentInfo?: { currentRent?: { currentRent: number } }

  lastDebitDate?: Date
  noticeDate?: Date
  terminationDate?: Date
}

export type Tenant = {
  firstName: string
  lastName: string
  fullName: string
  nationalRegistrationNumber: string
  birthDate: Date
  address?: Address
  emailAddress?: string
  specialAttention?: boolean

  currentHousingContract?: Lease
  upcomingHousingContract?: Lease
  housingContracts: Lease[]
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

  const apiLeases = (data?.content ?? []) as ApiLease[]
  if (!Array.isArray(apiLeases) || apiLeases.length === 0) return null

  const contracts = apiLeases.map(toLeaseFromApi)

  const target = normalized
  let picked: ApiTenant | undefined
  for (const raw of apiLeases) {
    const ts = raw.tenants ?? []
    const hit = ts.find((t) => equalPnr(t?.nationalRegistrationNumber, target))
    if (hit) {
      picked = hit
      break
    }
  }
  if (!picked) picked = (apiLeases[0].tenants ?? [])[0]

  const base = toContactFromApi(picked, normalized)
  const { current, upcoming } = pickCurrentAndUpcoming(contracts)

  const tenant: Tenant = {
    firstName: base.firstName,
    lastName: base.lastName,
    fullName: base.fullName,
    nationalRegistrationNumber: base.nationalRegistrationNumber,
    birthDate: base.birthDate,
    address: base.address,
    emailAddress: base.emailAddress,
    specialAttention: base.specialAttention,

    currentHousingContract: current,
    upcomingHousingContract: upcoming,
    housingContracts: contracts,
  }

  return { tenant, contracts }
}

const d = (v?: string) => (v ? new Date(v) : undefined)

function toAddressFromApi(dto: any): Address | undefined {
  const addr = dto?.address
  if (!addr || typeof addr === 'string') return undefined
  if (addr.street || addr.city) {
    return {
      street: String(addr.street ?? ''),
      number: String(addr.number ?? ''),
      postalCode: String(addr.postalCode ?? ''),
      city: String(addr.city ?? ''),
    }
  }
  return undefined
}

function toLeaseFromApi(dto: ApiLease): Lease {
  const rp =
    dto.rentalProperty ?? ({} as NonNullable<ApiLease['rentalProperty']>)
  const addr = toAddressFromApi(dto) || toAddressFromApi(rp)

  return {
    leaseId: String(dto.leaseId),
    leaseStartDate: new Date(dto.leaseStartDate),
    leaseEndDate: d(dto.leaseEndDate),

    rentalPropertyId: String(dto.rentalPropertyId),
    rentalProperty: dto.rentalProperty
      ? {
          rentalPropertyId: String(rp.rentalPropertyId),
          address: addr,
        }
      : undefined,

    address: addr,
    rentInfo: {
      currentRent: { currentRent: dto.rentInfo?.currentRent?.currentRent ?? 0 },
    },

    lastDebitDate: d(dto.lastDebitDate),
    noticeDate: d(dto.noticeDate),
    terminationDate: d(dto.terminationDate),
  }
}

function toContactFromApi(hit: ApiTenant | undefined, fallbackPnr: string) {
  const firstName = String(hit?.firstName ?? '')
  const lastName = String(hit?.lastName ?? '')
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ').trim() || fallbackPnr

  return {
    firstName,
    lastName,
    fullName,
    nationalRegistrationNumber: String(
      hit?.nationalRegistrationNumber ?? fallbackPnr
    ),
    birthDate: hit?.birthDate
      ? new Date(hit.birthDate)
      : new Date('1900-01-01'),
    address: toAddressFromApi(hit),
    emailAddress: hit?.emailAddress ? String(hit.emailAddress) : undefined,
    specialAttention: Boolean(hit?.specialAttention ?? false),
  }
}

function pickCurrentAndUpcoming(leases: Lease[]) {
  const now = Date.now()
  const toMs = (d?: Date) => (d ? d.getTime() : undefined)

  let current: Lease | undefined
  let upcoming: Lease | undefined

  for (const l of leases) {
    const start = toMs(l.leaseStartDate)
    const end = toMs(l.leaseEndDate)
    if (start === undefined) continue

    if (start > now) {
      const upStart = upcoming
        ? (toMs(upcoming.leaseStartDate) ?? Infinity)
        : Infinity
      if (!upcoming || start < upStart) upcoming = l
    } else if (end === undefined || end >= now) {
      if (!current) current = l
      else if (start > (toMs(current.leaseStartDate) ?? -Infinity)) current = l
    }
  }
  return { current, upcoming }
}

const normalizePnr = (s: string) => (s ?? '').replace(/[^\d]/g, '')
const last10 = (s: string) => normalizePnr(s).slice(-10)
const equalPnr = (a?: string, b?: string) => last10(a ?? '') === last10(b ?? '')
