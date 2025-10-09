// Import directly from types, only for generics like pagination, all specific response types come from generated api-types
import { keys } from '@onecore/types'

import type { paths, components } from './api/core/generated/api-types'

// Re-export pagination types from @onecore/types
export type PaginatedResponse<T> = keys.v1.PaginatedResponse<T>
export type PaginationMeta = keys.v1.PaginationMeta
export type PaginationLinks = keys.v1.PaginationLinks

// Tables/response types from the generated schemas
export type Key = components['schemas']['Key']
export type KeySystem = components['schemas']['KeySystem']
export type KeyLoan = components['schemas']['KeyLoan']
export type Log = components['schemas']['Log']
export type KeyNote = components['schemas']['KeyNote']
export type Receipt = components['schemas']['Receipt']

// Tables/respopnse types from core API generated schemas
export type Property = components['schemas']['Property']
export type Lease = components['schemas']['Lease']
export type Tenant = components['schemas']['Lease']['tenants'][number]
export type TenantAddress = NonNullable<
  components['schemas']['Lease']['tenants'][number]['address']
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
  components['schemas']['RentalPropertyResponse']
export type CreateKeyNoteRequest = components['schemas']['CreateKeyNoteRequest']
export type UpdateKeyNoteRequest = components['schemas']['UpdateKeyNoteRequest']
export type CreateReceiptRequest =
  paths['/receipts']['post']['requestBody']['content']['application/json']

// List by lease (GET /receipts/by-lease/{leaseId}) -> array in "content"
export type ReceiptListItem = NonNullable<
  NonNullable<
    paths['/receipts/by-lease/{leaseId}']['get']['responses']['200']['content']['application/json']
  >['content']
>[number]

// Get by key loan (GET /receipts/by-key-loan/{keyLoanId}) -> single "content"
export type ReceiptByKeyLoan = NonNullable<
  NonNullable<
    paths['/receipts/by-key-loan/{keyLoanId}']['get']['responses']['200']['content']['application/json']
  >['content']
>

// Upload file response (POST /receipts/{id}/upload) -> "content"
export type UploadFileResponse = NonNullable<
  NonNullable<
    paths['/receipts/{id}/upload']['post']['responses']['200']['content']['application/json']
  >['content']
>

// Presigned download URL (GET /receipts/{id}/download) -> "content"
export type DownloadUrlResponse = NonNullable<
  NonNullable<
    paths['/receipts/{id}/download']['get']['responses']['200']['content']['application/json']
  >['content']
>

// Key type definitions aligned with database enum
export const KeyTypeLabels = {
  LGH: 'Lägenhet',
  PB: 'Postbox',
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

// Helper to get filter options for key system types
export function getKeySystemTypeFilterOptions() {
  return Object.entries(KeySystemTypeLabels).map(([value, label]) => ({
    value,
    label,
  }))
}

// Helper to get filter options for key system status
export function getKeySystemStatusFilterOptions() {
  return [
    { label: 'Aktiv', value: 'true' },
    { label: 'Inaktiv', value: 'false' },
  ]
}

// Helper to get filter options for key types
export function getKeyTypeFilterOptions() {
  return Object.entries(KeyTypeLabels).map(([value, label]) => ({
    value,
    label,
  }))
}

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

// ----- Logs (UI/domain) -----
// Event type labels in Swedish
export const LogEventTypeLabels = {
  creation: 'Skapad',
  update: 'Uppdaterad',
  delete: 'Raderad',
} as const

export type LogEventType = keyof typeof LogEventTypeLabels

// Object type labels in Swedish
export const LogObjectTypeLabels = {
  key: 'Nyckel',
  keySystem: 'Nyckelsystem',
  keyLoan: 'Nyckellån',
} as const

export type LogObjectType = keyof typeof LogObjectTypeLabels

// Grouped log type for displaying multiple logs for the same object
export interface GroupedLog {
  objectId: string
  count: number
  latestLog: Log
  logs: Log[]
}

// Filter parameters for log search
export interface LogFilterParams {
  eventType?: LogEventType[]
  objectType?: LogObjectType[]
  userName?: string
  q?: string
  eventTimeFrom?: string
  eventTimeTo?: string
}

// ----- Receipts (UI/domain) -----
// Note: Receipt API types are already defined above (lines 39-75) from generated OpenAPI types

// UI-only helper type for PDF generation
export interface ReceiptData {
  lease: Lease
  tenants: Tenant[]
  keys: Key[]
  receiptType: 'LOAN' | 'RETURN'
  operationDate?: Date
}
