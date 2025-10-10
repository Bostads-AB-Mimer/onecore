import { z } from 'zod'
import {
  KeyTypeSchema,
  KeySystemTypeSchema,
  ReceiptTypeSchema,
  ReceiptFormatSchema,
  // Main entity schemas
  KeySchema,
  KeyLoanSchema,
  KeySystemSchema,
  LogSchema,
  KeyNoteSchema,
  ReceiptSchema,
  // Request schemas
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateLogRequestSchema,
  CreateReceiptRequestSchema,
  UpdateReceiptRequestSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
  BulkUpdateFlexRequestSchema,
  // Pagination schemas
  PaginationMetaSchema,
  PaginationLinksSchema,
} from './schema'

// Enum types
export type KeyType = z.infer<typeof KeyTypeSchema>
export type KeySystemType = z.infer<typeof KeySystemTypeSchema>

// Main entity types
export type Key = z.infer<typeof KeySchema>
export type KeyLoan = z.infer<typeof KeyLoanSchema>
export type KeySystem = z.infer<typeof KeySystemSchema>
export type Log = z.infer<typeof LogSchema>

// Request types for keys
export type CreateKeyRequest = z.infer<typeof CreateKeyRequestSchema>
export type UpdateKeyRequest = z.infer<typeof UpdateKeyRequestSchema>

// Request types for key systems
export type CreateKeySystemRequest = z.infer<
  typeof CreateKeySystemRequestSchema
>
export type UpdateKeySystemRequest = z.infer<
  typeof UpdateKeySystemRequestSchema
>

// Request types for key loans
export type CreateKeyLoanRequest = z.infer<typeof CreateKeyLoanRequestSchema>
export type UpdateKeyLoanRequest = z.infer<typeof UpdateKeyLoanRequestSchema>

// Request types for logs
export type CreateLogRequest = z.infer<typeof CreateLogRequestSchema>

// Receipt types
export type ReceiptType = z.infer<typeof ReceiptTypeSchema>
export type ReceiptFormat = z.infer<typeof ReceiptFormatSchema>
export type Receipt = z.infer<typeof ReceiptSchema>
export type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>
export type UpdateReceiptRequest = z.infer<typeof UpdateReceiptRequestSchema>

// Request types for key notes
export type KeyNote = z.infer<typeof KeyNoteSchema>
export type CreateKeyNoteRequest = z.infer<typeof CreateKeyNoteRequestSchema>
export type UpdateKeyNoteRequest = z.infer<typeof UpdateKeyNoteRequestSchema>

// Bulk update request types
export type BulkUpdateFlexRequest = z.infer<typeof BulkUpdateFlexRequestSchema>

// Pagination types
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
export type PaginationLinks = z.infer<typeof PaginationLinksSchema>
export type PaginatedResponse<T> = {
  content: T[]
  _meta: PaginationMeta
  _links: PaginationLinks[]
}
