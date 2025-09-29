//TODO Consider if all imports should be from the core, rather than 2 sources here

import type { components } from './api/generated/api-types'
import type { components as CoreComponents } from './api/core/generated/api-types'

// TODO kika varför denna är fel
export type Log1 = components['schemas']['Log']

// Tables/respopnse types from the generated schemas
export type Key = CoreComponents['schemas']['Key']
export type KeySystem = CoreComponents['schemas']['KeySystem']
export type KeyLoan = CoreComponents['schemas']['KeyLoan']
export type Log = CoreComponents['schemas']['Log']

// Tables/respopnse types from core API generated schemas
export type Property = CoreComponents['schemas']['Property']
export type Lease = CoreComponents['schemas']['Lease']
export type Tenant = CoreComponents['schemas']['Lease']['tenants'][number]
export type TenantAddress = NonNullable<
  CoreComponents['schemas']['Lease']['tenants'][number]['address']
>

// Request types
export type CreateKeyRequest = components['schemas']['CreateKeyRequest']
export type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']
export type CreateKeySystemRequest =
  components['schemas']['CreateKeySystemRequest']
export type UpdateKeySystemRequest =
  components['schemas']['UpdateKeySystemRequest']
export type CreateKeyLoanRequest = components['schemas']['CreateKeyLoanRequest']
export type UpdateKeyLoanRequest = components['schemas']['UpdateKeyLoanRequest']
export type RentalPropertyResponse =
  CoreComponents['schemas']['RentalPropertyResponse']

// Key type definitions based on the existing codebase usage
export const KeyTypeLabels = {
  LGH: 'Lägenhet',
  PB: 'Postbox',
  TP: 'Trapphus',
  HUS: 'Hus',
  GEM: 'Gemensamt',
  FS: 'Fastighet',
  HN: 'Huvudnyckel',
} as const

export type KeyType = keyof typeof KeyTypeLabels

// key System type definitions
export const KeySystemTypeLabels = {
  ELECTRONIC: 'Elektronisk',
  MECHANICAL: 'Mekanisk',
  HYBRID: 'Hybrid',
} as const

export type KeySystemType = keyof typeof KeySystemTypeLabels

// Custom types that aren't in the API (if needed)
export interface KeyLoanWithDetails extends KeyLoan {
  // additional computed properties
}

// TODO: Needs to be added to api-types
export const leaseTypeLabels = {
  housingContract: 'Bostadskontrakt',
  campusContract: 'Campuskontrakt',
  garageContract: 'Garagekontrakt',
  cooperativeTenancyContract: 'Kooperativ hyresrätt',
  commercialTenantContract: 'Lokalkontrakt',
  renegotiationContract: 'Omförhandlingskontrakt',
  otherContract: 'Övrigt',
  parkingspaceContract: 'P-Platskontrakt',
  unknown: 'Okänd kontraktstyp',
} as const

export type LeaseType = keyof typeof leaseTypeLabels

export function mapLeaseTypeKeyFromRaw(raw?: string): LeaseType {
  const s = (raw ?? '').trim().toLowerCase()
  if (s.startsWith('bostadskontrakt')) return 'housingContract'
  if (s.startsWith('campuskontrakt')) return 'campusContract'
  if (s.startsWith('garagekontrakt')) return 'garageContract'
  if (s.startsWith('kooperativ')) return 'cooperativeTenancyContract'
  if (s.startsWith('lokalkontrakt')) return 'commercialTenantContract'
  if (s.startsWith('omförhandlingskontrakt')) return 'renegotiationContract'
  if (s.startsWith('p-platskontrakt')) return 'parkingspaceContract'
  if (s.startsWith('övrigt')) return 'otherContract'
  return 'unknown'
}
