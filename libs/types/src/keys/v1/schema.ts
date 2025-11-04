import { z } from 'zod'

// Pagination schemas (reusable across all endpoints)
export const PaginationMetaSchema = z.object({
  totalRecords: z.number(),
  page: z.number(),
  limit: z.number(),
  count: z.number(),
})

export const PaginationLinksSchema = z.object({
  href: z.string(),
  rel: z.enum(['self', 'first', 'last', 'prev', 'next']),
})

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  contentSchema: T
) =>
  z.object({
    content: z.array(contentSchema),
    _meta: PaginationMetaSchema,
    _links: z.array(PaginationLinksSchema),
  })

export const KeyTypeSchema = z.enum([
  'HN',
  'FS',
  'MV',
  'LGH',
  'PB',
  'GAR',
  'LOK',
  'HL',
  'FÖR',
  'SOP',
  'ÖVR',
])
export const KeySystemTypeSchema = z.enum([
  'MECHANICAL',
  'ELECTRONIC',
  'HYBRID',
])

export const KeySchema = z.object({
  id: z.string().uuid(),
  keyName: z.string(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().nullable().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema,
  keySystemId: z.string().uuid().nullable().optional(),
  disposed: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const KeyLoanSchema = z.object({
  id: z.string().uuid(),
  keys: z.string(),
  contact: z.string().optional(),
  contact2: z.string().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

export const KeySystemSchema = z.object({
  id: z.string().uuid(),
  systemCode: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  managingSupplier: z.string().nullable().optional(),
  type: KeySystemTypeSchema,
  propertyIds: z.string().optional(),
  installationDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
  schemaFileId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

export const LogSchema = z.object({
  id: z.string().uuid(),
  userName: z.string(),
  eventType: z.enum(['creation', 'update', 'delete']),
  objectType: z.enum([
    'key',
    'keySystem',
    'keyLoan',
    'keyBundle',
    'keyLoanMaintenanceKeys',
    'receipt',
    'keyEvent',
    'signature',
    'keyNote',
  ]),
  objectId: z.string().uuid().nullable().optional(),
  eventTime: z.coerce.date(),
  description: z.string().nullable().optional(),
  // All context (rentalObjectCode, contactId, keyEvent data) is now fetched via JOINs
  // when filtering/displaying logs - not stored in the logs table
})

export const KeyNoteSchema = z.object({
  id: z.string().uuid(),
  rentalObjectCode: z.string(),
  description: z.string(),
})

export const KeyBundleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keys: z.string(),
  description: z.string().nullable().optional(),
})

export const KeyLoanMaintenanceKeysSchema = z.object({
  id: z.string().uuid(),
  keys: z.string(),
  company: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
})

// Key loan maintenance keys with enriched keys data (for optimized endpoint)
export const KeyLoanMaintenanceKeysWithDetailsSchema =
  KeyLoanMaintenanceKeysSchema.extend({
    // Array of full key objects instead of just IDs
    keysArray: z.array(KeySchema),
  })

// Key Event schemas (defined here before usage in KeyWithMaintenanceLoanStatusSchema)
export const KeyEventTypeSchema = z.enum(['FLEX', 'ORDER', 'LOST'])
export const KeyEventStatusSchema = z.enum(['ORDERED', 'RECEIVED', 'COMPLETED'])

export const KeyEventSchema = z.object({
  id: z.string().uuid(),
  keys: z.string(),
  type: KeyEventTypeSchema,
  status: KeyEventStatusSchema,
  workOrderId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// Key with maintenance loan status (for key bundle table view)
export const KeyWithMaintenanceLoanStatusSchema = KeySchema.extend({
  maintenanceLoan: KeyLoanMaintenanceKeysSchema.nullable(),
  latestEvent: KeyEventSchema.nullable(),
})

// Response schema for key bundle with loan status endpoint
export const KeyBundleWithLoanStatusResponseSchema = z.object({
  bundle: KeyBundleSchema,
  keys: z.array(KeyWithMaintenanceLoanStatusSchema),
})

// Request schemas for API endpoints
export const CreateKeyRequestSchema = z.object({
  keyName: z.string(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().nullable().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema,
  keySystemId: z.string().uuid().nullable().optional(),
})

export const UpdateKeyRequestSchema = z.object({
  keyName: z.string().optional(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().nullable().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema.optional(),
  keySystemId: z.string().uuid().nullable().optional(),
  disposed: z.boolean().optional(),
})

// Request schemas for key systems

export const CreateKeySystemRequestSchema = z.object({
  systemCode: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  type: KeySystemTypeSchema,
  propertyIds: z.string().optional(),
  installationDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
})

export const UpdateKeySystemRequestSchema = z.object({
  systemCode: z.string().optional(),
  name: z.string().optional(),
  manufacturer: z.string().optional(),
  type: KeySystemTypeSchema.optional(),
  propertyIds: z.string().optional(),
  installationDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
})

// Request schemas for key loans

export const CreateKeyLoanRequestSchema = z.object({
  keys: z.string(),
  contact: z.string().optional(),
  contact2: z.string().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  createdBy: z.string().nullable().optional(),
})

export const UpdateKeyLoanRequestSchema = z.object({
  keys: z.string().optional(),
  contact: z.string().optional(),
  contact2: z.string().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

// Request schemas for logs

export const CreateLogRequestSchema = z.object({
  userName: z.string(),
  eventType: z.enum(['creation', 'update', 'delete']),
  objectType: z.enum([
    'key',
    'keySystem',
    'keyLoan',
    'keyBundle',
    'keyLoanMaintenanceKeys',
    'receipt',
    'keyEvent',
    'signature',
    'keyNote',
  ]),
  objectId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  // rentalObjectCode and contactId removed - context fetched via JOINs when needed
})

// Receipt schemas

export const ReceiptTypeSchema = z.enum(['LOAN', 'RETURN'])
export const ReceiptFormatSchema = z.enum(['DIGITAL', 'PHYSICAL'])

export const ReceiptSchema = z.object({
  id: z.string().uuid(),
  keyLoanId: z.string().uuid(),
  receiptType: ReceiptTypeSchema,
  type: ReceiptFormatSchema,
  fileId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const CreateReceiptRequestSchema = z.object({
  keyLoanId: z.string().uuid(),
  receiptType: ReceiptTypeSchema,
  type: ReceiptFormatSchema.optional(),
  fileId: z.string().optional(),
})

export const UpdateReceiptRequestSchema = z.object({
  fileId: z.string().optional(),
})

export const UploadBase64RequestSchema = z.object({
  fileContent: z.string().min(1, 'File content is required'),
  fileName: z.string().optional(),
  metadata: z.record(z.string()).optional(),
})

// Error response schemas (for OpenAPI/Swagger documentation)
export const ErrorResponseSchema = z.object({
  error: z.string().optional(),
  reason: z.string().optional(),
})

export const NotFoundResponseSchema = z.object({
  reason: z.string(),
})

export const BadRequestResponseSchema = z.object({
  reason: z.string(),
})

// File operation response schemas
export const SchemaDownloadUrlResponseSchema = z.object({
  url: z.string(),
  expiresIn: z.number(),
})

// Request schemas for key notes

export const CreateKeyNoteRequestSchema = z.object({
  rentalObjectCode: z.string(),
  description: z.string(),
})

export const UpdateKeyNoteRequestSchema = z.object({
  rentalObjectCode: z.string().optional(),
  description: z.string().optional(),
})

// Request schemas for key bundles

export const CreateKeyBundleRequestSchema = z.object({
  name: z.string(),
  keys: z.string(),
  description: z.string().nullable().optional(),
})

export const UpdateKeyBundleRequestSchema = z.object({
  name: z.string().optional(),
  keys: z.string().optional(),
  description: z.string().nullable().optional(),
})

// Request schemas for key loan maintenance keys

export const CreateKeyLoanMaintenanceKeysRequestSchema = z.object({
  keys: z.string(),
  company: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  description: z.string().nullable().optional(),
})

export const UpdateKeyLoanMaintenanceKeysRequestSchema = z.object({
  keys: z.string().optional(),
  company: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  description: z.string().nullable().optional(),
})

// Request schemas for key events

export const CreateKeyEventRequestSchema = z.object({
  keys: z.string(),
  type: KeyEventTypeSchema,
  status: KeyEventStatusSchema,
  workOrderId: z.string().uuid().nullable().optional(),
})

export const UpdateKeyEventRequestSchema = z.object({
  keys: z.string().optional(),
  type: KeyEventTypeSchema.optional(),
  status: KeyEventStatusSchema.optional(),
  workOrderId: z.string().uuid().nullable().optional(),
})

// Bulk flex update request schema
export const BulkUpdateFlexRequestSchema = z.object({
  rentalObjectCode: z.string(),
  flexNumber: z.number().int().min(1).max(3),
})

// Key with enriched active loan status (for optimized endpoint)
export const KeyWithLoanStatusSchema = KeySchema.extend({
  // Active loan fields (null if no active loan)
  activeLoanId: z.string().uuid().nullable(),
  activeLoanContact: z.string().nullable(),
  activeLoanContact2: z.string().nullable(),
  activeLoanPickedUpAt: z.coerce.date().nullable(),
  activeLoanAvailableFrom: z.coerce.date().nullable(),
  // Previous loan data (for returned keys - to show who returned it)
  prevLoanAvailableFrom: z.coerce.date().nullable(),
  prevLoanContact: z.string().nullable(),
  prevLoanContact2: z.string().nullable(),
  // Active or recent maintenance loan fields (null if no maintenance loan)
  maintenanceLoanId: z.string().uuid().nullable(),
  maintenanceLoanCompany: z.string().nullable(),
  maintenanceLoanPickedUpAt: z.coerce.date().nullable(),
  maintenanceLoanReturnedAt: z.coerce.date().nullable(),
  // Optional latest key event (included when includeLatestEvent=true query param is set)
  latestEvent: KeyEventSchema.nullable().optional(),
})

// Key loan with enriched keys and receipts data (for optimized endpoint)
export const KeyLoanWithDetailsSchema = KeyLoanSchema.extend({
  // Array of full key objects instead of just IDs
  keysArray: z.array(KeySchema),
  // Array of receipts for this loan
  receipts: z.array(ReceiptSchema),
})

// Signature schemas (polymorphic - supports any document type)

export const SignatureResourceTypeSchema = z.enum([
  'receipt',
  // Future: 'lease_agreement', 'work_order', 'inspection_report'
])

export const SignatureSchema = z.object({
  id: z.string().uuid(),
  resourceType: SignatureResourceTypeSchema,
  resourceId: z.string().uuid(),
  simpleSignDocumentId: z.number().int(),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable().optional(),
  status: z.string(),
  sentAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable().optional(),
  lastSyncedAt: z.coerce.date().nullable().optional(),
})

export const CreateSignatureRequestSchema = z.object({
  resourceType: SignatureResourceTypeSchema,
  resourceId: z.string().uuid(),
  simpleSignDocumentId: z.number().int(),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable().optional(),
  status: z.string().default('sent'),
})

export const UpdateSignatureRequestSchema = z.object({
  status: z.string().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  lastSyncedAt: z.coerce.date().nullable().optional(),
})

// SimpleSign API request schema
export const SendSignatureRequestSchema = z.object({
  resourceType: SignatureResourceTypeSchema,
  resourceId: z.string().uuid(),
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  pdfBase64: z.string().min(1, 'PDF content is required'),
})

// SimpleSign webhook payload schema (minimal - we only need key fields)
export const SimpleSignWebhookPayloadSchema = z.object({
  id: z.number().int(), // SimpleSign document ID
  status: z.string(),
  status_updated_at: z.string(),
  // Other fields can be added as needed
})
