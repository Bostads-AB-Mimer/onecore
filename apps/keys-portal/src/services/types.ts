// Import directly from types, only for generics like pagination, all specific response types come from generated api-types
import { keys } from '@onecore/types'

import type { paths, components } from './api/core/generated/api-types'

// Re-export pagination types from @onecore/types
export type PaginatedResponse<T> = keys.PaginatedResponse<T>
export type PaginationMeta = keys.PaginationMeta
export type PaginationLinks = keys.PaginationLinks

// Tables/response types from the generated schemas
export type Key = components['schemas']['Key']
export type KeyDetails = components['schemas']['KeyDetails']
export type KeySystem = components['schemas']['KeySystem']
export type KeyLoan = components['schemas']['KeyLoan']
export type KeyLoanWithDetails = components['schemas']['KeyLoanWithDetails']
export type KeyBundle = components['schemas']['KeyBundle']
export type KeyBundleDetailsResponse =
  components['schemas']['KeyBundleDetailsResponse']
export type BundleWithLoanedKeysInfo =
  components['schemas']['BundleWithLoanedKeysInfo']
export type Log = components['schemas']['Log']
export type KeyNote = components['schemas']['KeyNote']
export type Receipt = components['schemas']['Receipt']
export type KeyEvent = components['schemas']['KeyEvent']

// DAX types (access control cards)
export type Card = components['schemas']['Card']
export type CardDetails = components['schemas']['CardDetails']
export type CardOwner = components['schemas']['CardOwner']

// Tables/respopnse types from core API generated schemas
export type Property = components['schemas']['Property']
export type Lease = components['schemas']['Lease']
export type Tenant = components['schemas']['Lease']['tenants'][number]
export type TenantAddress = NonNullable<
  components['schemas']['Lease']['tenants'][number]['address']
>

// Contact type from registered Contact schema in OpenAPI
export type Contact = components['schemas']['Contact']

// Request types
export type CreateKeyRequest = components['schemas']['CreateKeyRequest']
export type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']
export type CreateKeySystemRequest =
  components['schemas']['CreateKeySystemRequest']
export type UpdateKeySystemRequest =
  components['schemas']['UpdateKeySystemRequest']
export type CreateKeyBundleRequest =
  components['schemas']['CreateKeyBundleRequest']
export type UpdateKeyBundleRequest =
  components['schemas']['UpdateKeyBundleRequest']
export type CreateKeyLoanRequest = components['schemas']['CreateKeyLoanRequest']
export type UpdateKeyLoanRequest = components['schemas']['UpdateKeyLoanRequest']
export type CreateKeyNoteRequest = components['schemas']['CreateKeyNoteRequest']
export type UpdateKeyNoteRequest = components['schemas']['UpdateKeyNoteRequest']
export type CreateReceiptRequest = components['schemas']['CreateReceiptRequest']
export type CreateKeyEventRequest =
  components['schemas']['CreateKeyEventRequest']
export type UpdateKeyEventRequest =
  components['schemas']['UpdateKeyEventRequest']

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

// Key System Schema API types
// Note: These differ from receipt types because the backend APIs have inconsistent response structures
// - Receipts API: Returns { content: { url, expiresIn, fileId } } (nested content wrapper)
// - Schema API: Returns { url, expiresIn } (no content wrapper)

// Presigned download URL (GET /key-systems/{id}/download-schema)
export type KeySystemSchemaDownloadUrlResponse = NonNullable<
  paths['/key-systems/{id}/download-schema']['get']['responses']['200']['content']['application/json']
>

// Key type definitions aligned with database enum
export const KeyTypeLabels = {
  HN: 'Huvudnyckel',
  FS: 'Fastighet',
  MV: 'Motorvärmarnyckel',
  LGH: 'Lägenhet',
  PB: 'Postbox',
  GAR: 'Garagenyckel',
  LOK: 'Lokalnyckel',
  HL: 'Hänglås',
  FÖR: 'Förrådsnyckel',
  SOP: 'Sopsug',
  ÖVR: 'Övrigt',
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

// Lease type constant values - matches services/leasing/src/constants/leaseTypes.ts
// String values taken from Xpand
export const leaseTypes = {
  housingContract: 'Bostadskontrakt',
  campusContract: 'Campuskontrakt',
  garageContract: 'Garagekontrakt',
  cooperativeTenancyContract: 'Kooperativ hyresrätt',
  commercialTenantContract: 'Lokalkontrakt',
  renegotiationContract: 'Omförhandlingskontrakt',
  otherContract: 'Övrigt',
  parkingspaceContract: 'P-Platskontrakt',
} as const

export type LeaseType = keyof typeof leaseTypes

// ----- Key Loans (UI/domain) -----
// Loan type labels in Swedish
export const LoanTypeLabels = {
  TENANT: 'Hyresgäst',
  MAINTENANCE: 'Underhåll',
} as const

export type LoanType = keyof typeof LoanTypeLabels

// Helper to get filter options for loan types
export function getLoanTypeFilterOptions() {
  return Object.entries(LoanTypeLabels).map(([value, label]) => ({
    value,
    label,
  }))
}

// ----- Logs (UI/domain) -----
// Event type - represents the action performed (creation, update, delete)
export type LogEventType = 'creation' | 'update' | 'delete'

// Object type - represents the type of object the log entry refers to
export type LogObjectType =
  | 'key'
  | 'keySystem'
  | 'keyLoan'
  | 'keyBundle'
  | 'receipt'
  | 'keyEvent'
  | 'signature'
  | 'keyNote'

// Grouped log type for displaying multiple logs for the same object
export interface GroupedLog {
  objectId: string
  count: number
  latestLog: Log
  logs: Log[]
}

// ----- Key Events (UI/domain) -----
// Key event type labels in Swedish
export const KeyEventTypeLabels = {
  FLEX: 'Flex',
  ORDER: 'Extranyckel',
  LOST: 'Bortappad',
} as const

export type KeyEventType = keyof typeof KeyEventTypeLabels

// Key event status labels in Swedish
export const KeyEventStatusLabels = {
  ORDERED: 'Beställd',
  RECEIVED: 'Inkommen',
  COMPLETED: 'Klar',
} as const

export type KeyEventStatus = keyof typeof KeyEventStatusLabels

// Helper function to get display label for a key event (combines type + status)
export function getKeyEventDisplayLabel(event: {
  type: KeyEventType
  status: KeyEventStatus
}): string {
  const typeLabel = KeyEventTypeLabels[event.type]
  const statusLabel = KeyEventStatusLabels[event.status]
  return `${typeLabel} ${statusLabel.toLowerCase()}`
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
// Uses KeyDetails to include keySystem directly (no separate keySystemMap needed)
export interface ReceiptData {
  lease: Lease
  tenants: Tenant[]
  keys: KeyDetails[] // Keys with keySystem included for display
  receiptType: 'LOAN' | 'RETURN'
  operationDate?: Date
  loanId?: string // Key loan UUID, used for QR code on printed receipt
  missingKeys?: KeyDetails[] // For RETURN: keys not returned (unchecked, non-disposed)
  disposedKeys?: KeyDetails[] // For RETURN: keys that were disposed
  cards?: Card[] // For RETURN: cards that were returned (checked in dialog)
  missingCards?: Card[] // For RETURN: cards not returned (unchecked in dialog)
  comment?: string // Optional comment for the receipt (max 280 chars)
}

export interface MaintenanceReceiptData {
  contact: string // Contact code (e.g., F088710)
  contactName: string // Company name (from Contact.fullName)
  contactPerson: string | null
  description?: string | null
  keys: KeyDetails[] // Keys with keySystem included for display
  receiptType: 'LOAN' | 'RETURN'
  operationDate?: Date
  loanId?: string // Key loan UUID, used for QR code on printed receipt
  missingKeys?: KeyDetails[] // For RETURN: keys not returned (unchecked, non-disposed)
  disposedKeys?: KeyDetails[] // For RETURN: keys that were disposed
  cards?: Card[] // For RETURN: cards that were returned (checked in dialog)
  missingCards?: Card[] // For RETURN: cards not returned (unchecked in dialog)
}
