import { z } from 'zod'
import {
  KeyTypeSchema,
  KeySystemTypeSchema,
  ReceiptTypeSchema,
  ReceiptFormatSchema,
  LoanTypeSchema,
  KeyEventTypeSchema,
  KeyEventStatusSchema,
  SignatureResourceTypeSchema,
  // Main entity schemas
  KeySchema,
  KeyLoanSchema,
  KeySystemSchema,
  LogSchema,
  KeyNoteSchema,
  KeyBundleSchema,
  KeyWithLoanAndEventSchema,
  KeyBundleWithLoanStatusResponseSchema,
  BundleWithLoanedKeysInfoSchema,
  KeyEventSchema,
  ReceiptSchema,
  KeyWithLoanStatusSchema,
  KeyLoanWithDetailsSchema,
  SignatureSchema,
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
  UploadBase64RequestSchema,
  ErrorResponseSchema,
  NotFoundResponseSchema,
  BadRequestResponseSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
  CreateKeyBundleRequestSchema,
  UpdateKeyBundleRequestSchema,
  CreateKeyEventRequestSchema,
  UpdateKeyEventRequestSchema,
  BulkUpdateFlexRequestSchema,
  CreateSignatureRequestSchema,
  UpdateSignatureRequestSchema,
  SendSignatureRequestSchema,
  SimpleSignWebhookPayloadSchema,
  // Pagination schemas
  PaginationMetaSchema,
  PaginationLinksSchema,
} from './schema'

// Enum types
export type KeyType = z.infer<typeof KeyTypeSchema>
export type KeySystemType = z.infer<typeof KeySystemTypeSchema>
export type KeyEventType = z.infer<typeof KeyEventTypeSchema>
export type KeyEventStatus = z.infer<typeof KeyEventStatusSchema>

// Main entity types
export type Key = z.infer<typeof KeySchema>
export type KeyLoan = z.infer<typeof KeyLoanSchema>
export type KeyLoanWithDetails = z.infer<typeof KeyLoanWithDetailsSchema>
export type KeySystem = z.infer<typeof KeySystemSchema>
export type Log = z.infer<typeof LogSchema>
export type KeyEvent = z.infer<typeof KeyEventSchema>
export type KeyWithLoanStatus = z.infer<typeof KeyWithLoanStatusSchema>

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
export type LoanType = z.infer<typeof LoanTypeSchema>
export type Receipt = z.infer<typeof ReceiptSchema>
export type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>
export type UpdateReceiptRequest = z.infer<typeof UpdateReceiptRequestSchema>
export type UploadBase64Request = z.infer<typeof UploadBase64RequestSchema>

// Error response types
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type NotFoundResponse = z.infer<typeof NotFoundResponseSchema>
export type BadRequestResponse = z.infer<typeof BadRequestResponseSchema>

// Request types for key notes
export type KeyNote = z.infer<typeof KeyNoteSchema>
export type CreateKeyNoteRequest = z.infer<typeof CreateKeyNoteRequestSchema>
export type UpdateKeyNoteRequest = z.infer<typeof UpdateKeyNoteRequestSchema>

// Request types for key bundles
export type KeyBundle = z.infer<typeof KeyBundleSchema>
export type CreateKeyBundleRequest = z.infer<
  typeof CreateKeyBundleRequestSchema
>
export type UpdateKeyBundleRequest = z.infer<
  typeof UpdateKeyBundleRequestSchema
>

// Key bundle types (with loan and event status)
export type KeyWithLoanAndEvent = z.infer<typeof KeyWithLoanAndEventSchema>
export type KeyBundleWithLoanStatusResponse = z.infer<
  typeof KeyBundleWithLoanStatusResponseSchema
>
export type BundleWithLoanedKeysInfo = z.infer<
  typeof BundleWithLoanedKeysInfoSchema
>

// Request types for key events
export type CreateKeyEventRequest = z.infer<typeof CreateKeyEventRequestSchema>
export type UpdateKeyEventRequest = z.infer<typeof UpdateKeyEventRequestSchema>

// Bulk update request types
export type BulkUpdateFlexRequest = z.infer<typeof BulkUpdateFlexRequestSchema>

// Signature types
export type SignatureResourceType = z.infer<typeof SignatureResourceTypeSchema>
export type Signature = z.infer<typeof SignatureSchema>
export type CreateSignatureRequest = z.infer<
  typeof CreateSignatureRequestSchema
>
export type UpdateSignatureRequest = z.infer<
  typeof UpdateSignatureRequestSchema
>
export type SendSignatureRequest = z.infer<typeof SendSignatureRequestSchema>
export type SimpleSignWebhookPayload = z.infer<
  typeof SimpleSignWebhookPayloadSchema
>

// Pagination types
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
export type PaginationLinks = z.infer<typeof PaginationLinksSchema>
export type PaginatedResponse<T> = {
  content: T[]
  _meta: PaginationMeta
  _links: PaginationLinks[]
}
