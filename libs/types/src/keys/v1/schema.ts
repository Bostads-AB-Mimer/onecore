import { z } from 'zod'

export const KeyTypeSchema = z.enum(['LGH', 'PB', 'FS', 'HN'])
export const KeySystemTypeSchema = z.enum([
  'MECHANICAL',
  'ELECTRONIC',
  'HYBRID',
])

export const KeySchema = z.object({
  id: z.string().uuid(),
  keyName: z.string(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema,
  keySystemId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const KeyLoanSchema = z.object({
  id: z.string().uuid(),
  keys: z.string(),
  contact: z.string().optional(),
  contact2: z.string().optional(),
  lease: z.string().optional(),
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
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

export const LogSchema = z.object({
  id: z.string().uuid(),
  userName: z.string(),
  eventType: z.enum(['creation', 'update', 'delete']),
  objectType: z.enum(['key', 'keySystem', 'keyLoan']),
  eventTime: z.coerce.date(),
  description: z.string().nullable().optional(),
})

// Request schemas for API endpoints
export const CreateKeyRequestSchema = z.object({
  keyName: z.string(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema,
  keySystemId: z.string().uuid().nullable().optional(),
})

export const UpdateKeyRequestSchema = z.object({
  keyName: z.string().optional(),
  keySequenceNumber: z.number().optional(),
  flexNumber: z.number().optional(),
  rentalObjectCode: z.string().optional(),
  keyType: KeyTypeSchema.optional(),
  keySystemId: z.string().uuid().nullable().optional(),
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
  lease: z.string().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  createdBy: z.string().nullable().optional(),
})

export const UpdateKeyLoanRequestSchema = z.object({
  keys: z.string().optional(),
  contact: z.string().optional(),
  contact2: z.string().optional(),
  lease: z.string().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

// Request schemas for logs

export const CreateLogRequestSchema = z.object({
  userName: z.string(),
  eventType: z.enum(['creation', 'update', 'delete']),
  objectType: z.enum(['key', 'keySystem', 'keyLoan']),
  description: z.string().nullable().optional(),
})
