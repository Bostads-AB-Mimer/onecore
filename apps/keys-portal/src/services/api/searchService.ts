import { GET } from './core/base-api'
import type { RentalPropertyResponse, Lease } from '@/services/types'
import type {
  Tenant as LibTenant,
  Lease as LibLease,
  Contact as LibContact,
  Address as LibAddress,
  PhoneNumber as LibPhoneNumber,
} from '@/../../libs/types/src/types'

export interface RentalObjectSearchResult {
  rentalId: string
  name: string
  type: string
  address: string
}

class SearchService {
  /* ---------------- validators ---------------- */
  isValidRentalId(rentalId: string): boolean {
    const rentalIdPattern = /^[\d-]+$/
    return rentalIdPattern.test(rentalId) && rentalId.length >= 5
  }

  isValidPnr(pnr: string): boolean {
    return /^(?:\d{6}|\d{8})-?\d{4}$/.test((pnr ?? '').trim())
  }

  /* ---------------- search by rental object code ---------------- */
  async searchByRentalId(
    rentalId: string
  ): Promise<RentalObjectSearchResult[]> {
    if (!rentalId.trim() || !this.isValidRentalId(rentalId)) return []

    const { data, error } = await GET(
      '/rental-properties/by-rental-object-code/{rentalObjectCode}',
      { params: { path: { rentalObjectCode: rentalId } } }
    )
    if (error || !data) return []

    const payload = data as any
    const rp: RentalPropertyResponse | any = payload?.content ?? payload

    const computedRentalId =
      rp.id ??
      rp.code ??
      rp.number ??
      rp?.property?.id ??
      rp?.property?.code ??
      rentalId

    const address = rp.address ?? rp?.property?.address ?? 'Okänd adress'
    const type =
      rp.type ?? rp?.property?.type ?? rp?.property?.rentalType ?? 'unknown'
    const name = address !== 'Okänd adress' ? address : (type ?? 'Okänd typ')

    return [
      {
        rentalId: String(computedRentalId),
        name: String(name),
        type: String(type),
        address: String(address),
      },
    ]
  }

  /* ---------------- compact object list from PNR ---------------- */
  async searchLeasesByPnr(pnr: string): Promise<RentalObjectSearchResult[]> {
    if (!this.isValidPnr(pnr)) return []

    const { data, error } = await GET(
      '/leases/by-pnr/{pnr}/includingAllLeases',
      {
        params: { path: { pnr } },
      }
    )
    if (error) return []

    const leases = (data?.content ?? []) as Lease[]
    if (!Array.isArray(leases) || leases.length === 0) return []

    const results = leases
      .map((l) => this.mapLeaseToSearchResult(l))
      .filter((x): x is RentalObjectSearchResult => Boolean(x))

    const seen = new Set<string>()
    return results.filter((r) => {
      if (!r.rentalId) return false
      if (seen.has(r.rentalId)) return false
      seen.add(r.rentalId)
      return true
    })
  }

  async fetchTenantAndLeasesByPnr(
    pnr: string
  ): Promise<{ tenant: Tenant; contracts: Lease[] } | null> {
    const normalized = normalizePnr(pnr)
    if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

    const { data, error } = await GET(
      '/leases/by-pnr/{pnr}/includingAllLeases',
      {
        params: { path: { pnr: normalized } },
      }
    )
    if (error) return null

    const leaseDtos = (data?.content ?? []) as Lease[]
    if (!Array.isArray(leaseDtos) || leaseDtos.length === 0) return null

    const contracts = leaseDtos.map(toLeaseFromDto)

    const target = normalized
    let picked: ApiTenant | undefined

    for (const raw of leaseDtos) {
      const ts = raw.tenants ?? []
      const hit = ts.find((t) =>
        equalPnr(t?.nationalRegistrationNumber, target)
      )
      if (hit) {
        picked = hit
        break
      }
    }
    if (!picked) picked = (leaseDtos[0].tenants ?? [])[0]

    const base = toContactFromApi(picked, normalized)
    const { current, upcoming } = pickCurrentAndUpcoming(contracts)

    const tenant: Tenant = {
      contactCode: base.contactCode,
      contactKey: base.contactKey,
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
      parkingSpaceContracts: [],
      housingContracts: contracts,
      isAboutToLeave: Boolean(
        current?.leaseEndDate && current.leaseEndDate < new Date()
      ),
    }

    return { tenant, contracts }
  }

  private mapLeaseToSearchResult(l: LeaseDto): RentalObjectSearchResult | null {
    const x = l as unknown as Record<string, any>

    const rentalId =
      l.rentalPropertyId ??
      l.rentalProperty?.rentalPropertyId ??
      (l as any)?.rentalObjectCode ??
      (l as any)?.propertyId

    if (!rentalId) return null

    const address = l.address ?? l.rentalProperty?.address ?? 'Okänd adress'
    const type = l.type ?? l.rentalProperty?.type ?? 'unknown'
    const name = address !== 'Okänd adress' ? address : (type ?? 'Okänd typ')

    return {
      rentalId: String(rentalId),
      name: String(name),
      type: String(type),
      address: String(address),
    }
  }
}

export const searchService = new SearchService()

export async function fetchTenantAndLeasesByPnr(pnr: string) {
  return searchService.fetchTenantAndLeasesByPnr(pnr)
}
export async function searchByRentalId(rentalId: string) {
  return searchService.searchByRentalId(rentalId)
}
export async function searchLeasesByPnr(pnr: string) {
  return searchService.searchLeasesByPnr(pnr)
}

const d = (v?: string) => (v ? new Date(v) : undefined)

function toAddressFromDto(dto: any): Address | undefined {
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

function toLeaseFromDto(dto: LeaseDto): Lease {
  const rentalProp =
    dto.rentalProperty ?? ({} as NonNullable<LeaseDto['rentalProperty']>)
  const addr = toAddressFromDto(dto) || toAddressFromDto(rentalProp)

  return {
    leaseId: String(dto.leaseId),
    leaseNumber: String(dto.leaseNumber),
    leaseStartDate: new Date(dto.leaseStartDate),
    leaseEndDate: d(dto.leaseEndDate),
    status: dto.status,
    tenantContactIds: dto.tenantContactIds ?? undefined,

    rentalPropertyId: String(dto.rentalPropertyId),
    rentalProperty: dto.rentalProperty
      ? {
          rentalPropertyId: String(rentalProp.rentalPropertyId),
          apartmentNumber: Number(rentalProp.apartmentNumber ?? 0),
          size: Number(rentalProp.size ?? 0),
          type: String(rentalProp.type ?? dto.type ?? 'HOUSING'),
          address: addr,
          rentalPropertyType: String(rentalProp.rentalPropertyType ?? ''),
          additionsIncludedInRent: String(
            rentalProp.additionsIncludedInRent ?? ''
          ),
          otherInfo: rentalProp.otherInfo
            ? String(rentalProp.otherInfo)
            : undefined,
          roomTypes: (rentalProp.roomTypes ?? undefined) as any,
          lastUpdated: d(rentalProp.lastUpdated),
        }
      : undefined,

    type: String(dto.type ?? 'HOUSING'),
    rentInfo: dto.rentInfo
      ? {
          currentRent: {
            rentId: dto.rentInfo.currentRent.rentId,
            leaseId: dto.rentInfo.currentRent.leaseId,
            currentRent: dto.rentInfo.currentRent.currentRent,
            vat: dto.rentInfo.currentRent.vat,
            additionalChargeDescription:
              dto.rentInfo.currentRent.additionalChargeDescription,
            additionalChargeAmount:
              dto.rentInfo.currentRent.additionalChargeAmount,
            rentStartDate: d(dto.rentInfo.currentRent.rentStartDate),
            rentEndDate: d(dto.rentInfo.currentRent.rentEndDate),
          },
        }
      : undefined,

    address: addr,

    noticeGivenBy: dto.noticeGivenBy ?? undefined,
    noticeDate: d(dto.noticeDate),
    noticeTimeTenant: dto.noticeTimeTenant ?? undefined,
    preferredMoveOutDate: d(dto.preferredMoveOutDate),
    terminationDate: d(dto.terminationDate),
    contractDate: d(dto.contractDate),
    lastDebitDate: d(dto.lastDebitDate),
    approvalDate: d(dto.approvalDate),

    residentialArea: dto.residentialArea
      ? { code: dto.residentialArea.code, caption: dto.residentialArea.caption }
      : undefined,
  }
}

function toContactFromApi(hit: ApiTenant | undefined, fallbackPnr: string) {
  const firstName = String(hit?.firstName ?? '')
  const lastName = String(hit?.lastName ?? '')
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const pnr = String(hit?.nationalRegistrationNumber ?? fallbackPnr)

  const birthDate = hit?.birthDate
    ? new Date(hit.birthDate)
    : new Date('1900-01-01')

  return {
    contactCode: String(hit?.contactCode ?? ''),
    contactKey: String(hit?.contactKey ?? ''),
    firstName,
    lastName,
    fullName: fullName || pnr,
    nationalRegistrationNumber: pnr,
    birthDate,
    address: toAddressFromDto(hit),
    emailAddress: hit?.emailAddress ? String(hit.emailAddress) : undefined,
    specialAttention: Boolean(hit?.specialAttention ?? false),
  }
}

function pickCurrentAndUpcoming(leases: Lease[]): {
  current?: Lease
  upcoming?: Lease
} {
  const now = Date.now()
  const toMs = (d?: Date) => (d ? d.getTime() : undefined)

  let current: Lease | undefined
  let upcoming: Lease | undefined

  for (const l of leases) {
    const start = toMs(l.leaseStartDate)
    const end = toMs(l.leaseEndDate)
    if (start === undefined) continue

    if (start > now) {
      const upcomingStart = upcoming
        ? (toMs(upcoming.leaseStartDate) ?? Infinity)
        : Infinity
      if (!upcoming || start < upcomingStart) upcoming = l
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

export async function fetchTenantAndLeasesByPnr(
  pnr: string
): Promise<{ tenant: LibTenant; contracts: LibLease[] } | null> {
  const normalized = normalizePnr(pnr)

  if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

  const { data, error } = await GET('/leases/by-pnr/{pnr}/includingAllLeases', {
    params: { path: { pnr: normalized } },
  })
  if (error) return null

  const Leases = (data?.content ?? []) as Lease[]
  if (!Array.isArray(Leases) || Leases.length === 0) return null

  const contracts = Leases.map((d) => toLeaseFromDto(d))
  const housingContracts = contracts as [LibLease, ...LibLease[]]

  const target = normalized
  let picked: any | null = null

  for (const raw of Leases as any[]) {
    const ts: any[] = raw?.tenants ?? raw?.leaseTenants ?? []
    const hit = ts.find((t) =>
      equalPnr(t?.pnr ?? t?.personalNumber ?? t?.ssn, target)
    )
    if (hit) {
      picked = hit
      break
    }
  }

  if (!picked) {
    const firstLease = (Leases as any[])[0]
    picked = (firstLease?.tenants ?? firstLease?.leaseTenants ?? [])[0] ?? {}
  }

  const baseContact: LibContact = toContactFromApi(picked, normalized)

  const { current, upcoming } = pickCurrentAndUpcoming(contracts)

  const tenant: LibTenant = {
    contactCode: baseContact.contactCode,
    contactKey: baseContact.contactKey,
    leaseIds: baseContact.leaseIds,
    firstName: baseContact.firstName,
    lastName: baseContact.lastName,
    fullName: baseContact.fullName,
    nationalRegistrationNumber: baseContact.nationalRegistrationNumber,
    birthDate: baseContact.birthDate,
    address: baseContact.address,
    phoneNumbers: baseContact.phoneNumbers,
    emailAddress: baseContact.emailAddress,
    specialAttention: baseContact.specialAttention,
    currentHousingContract: current,
    upcomingHousingContract: upcoming,
    parkingSpaceContracts: [],
    housingContracts: housingContracts,
    isAboutToLeave: Boolean(
      current?.leaseEndDate && current.leaseEndDate < new Date()
    ),
  }

  return { tenant, contracts }
}
