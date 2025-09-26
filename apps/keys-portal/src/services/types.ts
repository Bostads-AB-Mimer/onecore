import type { components } from './api/generated/api-types'
import type { components as CoreComponents } from './api/core/generated/api-types'

// Extract types from the generated schemas
export type Key = components['schemas']['Key']
export type KeySystem = components['schemas']['KeySystem']
export type KeyLoan = components['schemas']['KeyLoan']
export type Log = components['schemas']['Log']
export type Property = CoreComponents['schemas']['Property']
export type CreateKeyRequest = components['schemas']['CreateKeyRequest']
export type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']
export type CreateKeySystemRequest = components['schemas']['CreateKeySystemRequest']
export type UpdateKeySystemRequest = components['schemas']['UpdateKeySystemRequest']
export type CreateKeyLoanRequest = components['schemas']['CreateKeyLoanRequest']
export type UpdateKeyLoanRequest = components['schemas']['UpdateKeyLoanRequest']

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