//TODO Consider if all imports should be from the core, rather than 2 sources here

import type { components } from './api/generated/api-types'
import type { components as CoreComponents } from './api/core/generated/api-types'


// Tables/respopnse types from the generated schemas
export type Key = components['schemas']['Key']
export type KeySystem = components['schemas']['KeySystem']
export type KeyLoan = components['schemas']['KeyLoan']
export type Log = components['schemas']['Log']

// Tables/respopnse types from core API generated schemas
export type Property = CoreComponents['schemas']['Property']
export type RentalPropertyResponse = CoreComponents['schemas']['RentalPropertyResponse']
export type Lease = CoreComponents['schemas']['Lease']


// Request types
export type CreateKeyRequest = components['schemas']['CreateKeyRequest']
export type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']
export type CreateKeySystemRequest = components['schemas']['CreateKeySystemRequest']
export type UpdateKeySystemRequest = components['schemas']['UpdateKeySystemRequest']
export type CreateKeyLoanRequest = components['schemas']['CreateKeyLoanRequest']
export type UpdateKeyLoanRequest = components['schemas']['UpdateKeyLoanRequest']
export type RentalPropertyResponse = CoreComponents['schemas']['RentalPropertyResponse'];
export type LeaseDto = CoreComponents['schemas']['Lease']
export type Address = NonNullable<LeaseDto['address']>;
export type ApiTenant = NonNullable<LeaseDto['tenants']>[number];

// Key type definitions based on the existing codebase usage
export const KeyTypeLabels = {
  'LGH': 'Lägenhet',
  'PB': 'Postbox',
  'TP': 'Trapphus',
  'HUS': 'Hus',
  'GEM': 'Gemensamt',
} as const

export type KeyType = keyof typeof KeyTypeLabels

// key System type definitions
export const KeySystemTypeLabels = {
  'ELECTRONIC': 'Elektronisk',
  'MECHANICAL': 'Mekanisk',
  'HYBRID': 'Hybrid',
} as const

export type KeySystemType = keyof typeof KeySystemTypeLabels

// Custom types that aren't in the API (if needed)
export interface KeyLoanWithDetails extends KeyLoan {
  // additional computed properties
}