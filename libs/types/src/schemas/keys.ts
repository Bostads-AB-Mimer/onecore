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
  lease: z.string().optional(),
  returnedAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  pickedUp_at: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
})

export const KeySystemSchema = z.object({
  id: z.string().uuid(),
  system_code: z.string(),
  name: z.string(),
  manufacturer: z.string().optional(),
  type: KeySystemTypeSchema,
  property_ids: z.string().optional(),
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
  objectType: z.enum(['key', 'key_system', 'key_loan']),
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
