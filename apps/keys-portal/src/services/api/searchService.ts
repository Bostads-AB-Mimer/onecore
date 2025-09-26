import { GET } from './core/base-api'
import type { RentalPropertyResponse, LeaseDto } from '@/services/types'
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

export class SearchService {
  isValidRentalId(rentalId: string): boolean {
    const rentalIdPattern = /^[\d-]+$/
    return rentalIdPattern.test(rentalId) && rentalId.length >= 5
  }

  isValidPnr(pnr: string): boolean {
    return /^(?:\d{6}|\d{8})-?\d{4}$/.test((pnr ?? '').trim())
  }

async searchByRentalId(rentalId: string): Promise<RentalObjectSearchResult[]> {
  if (!rentalId.trim() || !this.isValidRentalId(rentalId)) return []

  const { data, error } = await GET('/rental-properties/by-rental-object-code/{rentalObjectCode}', {
    params: { path: { rentalObjectCode: rentalId } },
  })
  if (error || !data) return []

  const payload = data as any
  const rp: RentalPropertyResponse | any = (payload?.content ?? payload)

  const computedRentalId =
    rp.id ??
    rp.code ??
    rp.number ??
    rp?.property?.id ??
    rp?.property?.code ??
    rentalId

  const address =
    rp.address ??
    rp?.property?.address ??
    'Okänd adress'

  const type =
    rp.type ??
    rp?.property?.type ??
    rp?.property?.rentalType ??
    'unknown'

  const name = address !== 'Okänd adress' ? address : (type ?? 'Okänd typ')

  return [{
    rentalId: String(computedRentalId),
    name,
    type: String(type),
    address: String(address),
  }]
}

private getPropertyName(rp: RentalPropertyResponse | any): string {
  const address = this.getPropertyAddress(rp)
  if (address && address !== 'Okänd adress') return address
  return rp.type ?? rp?.property?.type ?? 'Okänd typ'
}

private getPropertyAddress(rp: RentalPropertyResponse | any): string {
  return rp.address ?? rp?.property?.address ?? 'Okänd adress'
}


  async searchLeasesByPnr(pnr: string): Promise<RentalObjectSearchResult[]> {
    if (!this.isValidPnr(pnr)) return []

    const { data, error } = await GET('/leases/by-pnr/{pnr}/includingAllLeases', {
      params: { path: { pnr } },
    })
    if (error) return []

    const leases = (data?.content ?? []) as LeaseDto[]
    if (!Array.isArray(leases) || leases.length === 0) return []

    const results = leases
      .map((l) => this.mapLeaseToSearchResult(l))
      .filter((x): x is RentalObjectSearchResult => Boolean(x))

    const seen = new Set<string>()
    return results.filter(r => {
      if (!r.rentalId) return false
      if (seen.has(r.rentalId)) return false
      seen.add(r.rentalId)
      return true
    })
  }

  private mapLeaseToSearchResult(l: LeaseDto): RentalObjectSearchResult | null {
    const x = l as unknown as Record<string, any>

    const rentalId =
      x.rentalObjectCode ??
      x.rentalObjectId ??
      x?.rentalObject?.code ??
      x?.property?.code ??
      x.propertyId

    if (!rentalId) return null

    const address =
      x?.property?.address ??
      x?.rentalObject?.address ??
      x?.address ??
      'Okänd adress'

    const type =
      x?.rentalType ??
      x?.rentalObject?.type ??
      x?.property?.type ??
      'unknown'

    const name = address !== 'Okänd adress' ? address : (type ?? 'Okänd typ')

    return {
      rentalId: String(rentalId),
      name,
      type: String(type),
      address: String(address),
    }
  }
}

export const searchService = new SearchService()

function toPhoneNumbers(phone?: string): LibPhoneNumber[] | undefined {
  if (!phone) return undefined
  return [{ phoneNumber: String(phone), type: 'mobile', isMainNumber: true }]
}

function toAddressFromDto(dto: any): LibAddress | undefined {
  const addr = dto?.address
  if (!addr) return undefined
  if (typeof addr === 'string') {
    return undefined
  }
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

function toContactFromApi(hit: any, fallbackPnr: string): LibContact {
  const firstName = String(hit?.firstName ?? hit?.givenName ?? '')
  const lastName = String(hit?.lastName ?? hit?.surname ?? '')
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const pnr =
    String(hit?.pnr ?? hit?.personalNumber ?? hit?.ssn ?? fallbackPnr)

  return {
    contactCode: String(hit?.contactCode ?? hit?.id ?? hit?.tenantId ?? ''),
    contactKey: String(hit?.contactKey ?? hit?.id ?? hit?.tenantId ?? ''),
    leaseIds: undefined,
    leases: undefined,
    firstName,
    lastName,
    fullName: fullName || pnr, 
    nationalRegistrationNumber: pnr,
    birthDate: new Date('1900-01-01'),
    address: toAddressFromDto(hit),
    phoneNumbers: toPhoneNumbers(hit?.phone ?? hit?.mobile),
    emailAddress: hit?.email ? String(hit.email) : undefined,
    isTenant: true,
    parkingSpaceWaitingList: undefined,
    specialAttention: Boolean(hit?.specialAttention ?? false),
  }
}

function toLeaseFromDto(dto: any): LibLease {
  const start = dto?.startDate ?? dto?.leaseStartDate;
  const end   = dto?.endDate   ?? dto?.leaseEndDate;
  const termination = dto?.terminationDate
  const notice      = dto?.noticeDate
  const lastDebit   = dto?.lastDebitDate
  const rentalProp = dto?.rentalProperty ?? dto?.property ?? {};
  const addr = toAddressFromDto(dto) || toAddressFromDto(rentalProp);

  return {
    leaseId: String(dto?.id ?? dto?.leaseId ?? ''),
    leaseNumber: String(dto?.number ?? dto?.leaseNumber ?? ''),
    leaseStartDate: start ? new Date(start) : new Date(),
    leaseEndDate:   end ? new Date(end) : undefined,
    status: (dto?.status ?? 'ACTIVE') as LibLease['status'],
    tenantContactIds: dto?.tenantContactIds ?? undefined,
    tenants: undefined,
    rentalPropertyId: String(dto?.rentalPropertyId ?? dto?.propertyId ?? ''),
    rentalProperty: rentalProp
      ? {
          rentalPropertyId: String(rentalProp?.id ?? rentalProp?.rentalPropertyId ?? ''),
          apartmentNumber: Number(rentalProp?.apartmentNumber ?? 0),
          size: Number(rentalProp?.size ?? 0),
          type: String(rentalProp?.type ?? dto?.type ?? 'HOUSING'),
          address: addr,
          rentalPropertyType: String(rentalProp?.rentalPropertyType ?? ''),
          additionsIncludedInRent: String(rentalProp?.additionsIncludedInRent ?? ''),
          otherInfo: rentalProp?.otherInfo ? String(rentalProp.otherInfo) : undefined,
          roomTypes: undefined,
          lastUpdated: undefined,
        }
      : undefined,

    type: String(dto?.type ?? 'HOUSING'),
    rentInfo: undefined,
    address: addr,

    noticeGivenBy: dto?.noticeGivenBy ?? undefined,
    noticeDate: dto?.noticeDate ? new Date(dto.noticeDate) : undefined,
    noticeTimeTenant: dto?.noticeTimeTenant ?? undefined,
    preferredMoveOutDate: dto?.preferredMoveOutDate ? new Date(dto.preferredMoveOutDate) : undefined,
    terminationDate: dto?.terminationDate ? new Date(dto.terminationDate) : undefined,
    contractDate: dto?.contractDate ? new Date(dto.contractDate) : undefined,
    lastDebitDate: dto?.lastDebitDate ? new Date(dto.lastDebitDate) : undefined,
    approvalDate: dto?.approvalDate ? new Date(dto.approvalDate) : undefined,
    residentialArea: undefined,
  };
}


function pickCurrentAndUpcoming(leases: LibLease[]): {
  current?: LibLease
  upcoming?: LibLease
} {
  const now = Date.now()

  const toMs = (d: unknown): number | undefined => {
    if (!d) return undefined
    const t = d instanceof Date ? d.getTime() : new Date(d as any).getTime()
    return Number.isNaN(t) ? undefined : t
  }

  let current: LibLease | undefined
  let upcoming: LibLease | undefined

  for (const l of leases) {
    const start = toMs(l.leaseStartDate)
    const end = toMs(l.leaseEndDate)

    if (start === undefined) continue

    if (start > now) {
      const upcomingStart = upcoming ? (toMs(upcoming.leaseStartDate) ?? Infinity) : Infinity
      if (!upcoming || start < upcomingStart) {
        upcoming = l
      }
    } else if (end === undefined || end >= now) {
      if (!current) {
        current = l
      } else {
        const currentStart = toMs(current.leaseStartDate) ?? -Infinity
        if (start > currentStart) current = l
      }
    }
  }

  return { current, upcoming }
}



const normalizePnr = (s: string) => (s ?? '').replace(/[^\d]/g, '');
const last10 = (s: string) => normalizePnr(s).slice(-10);
const equalPnr = (a?: string, b?: string) => last10(a ?? '') === last10(b ?? '');

export async function fetchTenantAndLeasesByPnr(
  pnr: string
): Promise<{ tenant: LibTenant; contracts: LibLease[] } | null> {
  const normalized = normalizePnr(pnr)

  if (!/^\d{10}(\d{2})?$/.test(normalized)) return null

  const { data, error } = await GET('/leases/by-pnr/{pnr}/includingAllLeases', {
    params: { path: { pnr: normalized } },
  })
  if (error) return null

  const leaseDtos = (data?.content ?? []) as LeaseDto[]
  if (!Array.isArray(leaseDtos) || leaseDtos.length === 0) return null

  const contracts = leaseDtos.map((d) => toLeaseFromDto(d))
  const housingContracts = contracts as [LibLease, ...LibLease[]]

  const target = normalized
  let picked: any | null = null

  for (const raw of leaseDtos as any[]) {
    const ts: any[] = raw?.tenants ?? raw?.leaseTenants ?? [];
    const hit = ts.find(t => equalPnr(t?.pnr ?? t?.personalNumber ?? t?.ssn, target));
  if (hit) { picked = hit; break; }
}


  if (!picked) {
    const firstLease = (leaseDtos as any[])[0]
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
    isAboutToLeave: Boolean(current?.leaseEndDate && current.leaseEndDate < new Date()),
  }

  return { tenant, contracts }
}


