// keys-portal/src/services/types.ts
import type { components } from './api/generated/api-types'

// Extract types from the generated schemas
export type KeyLoan = components['schemas']['KeyLoan']
export type Key = components['schemas']['Key']
export type KeySystem = components['schemas']['KeySystem']
export type Log = components['schemas']['Log']

// Custom types that aren't in the API (if needed)
export interface KeyLoanWithDetails extends KeyLoan {
  // additional computed properties
}