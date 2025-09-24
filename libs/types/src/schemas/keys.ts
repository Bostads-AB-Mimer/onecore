import { z } from 'zod'

export const KeyTypeSchema = z.enum(['LGH', 'PB', 'FS', 'HN'])

export const KeySystemTypeSchema = z.enum(['MECHANICAL', 'ELECTRONIC', 'HYBRID'])

export const KeySchema = z.object({
  id: z.string().uuid(),
  key_name: z.string(),
  key_sequence_number: z.number().optional(),
  flex_number: z.number().optional(),
  rental_object: z.string().optional(),
  key_type: KeyTypeSchema,
  key_system_id: z.string().uuid().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export const KeyLoanSchema = z.object({
  id: z.string().uuid(),
  keys: z.string(),
  contact: z.string().optional(),
  lease: z.string().optional(),
  returned_at: z.coerce.date().nullable().optional(),
  available_to_next_tenant_from: z.coerce.date().nullable().optional(),
  picked_up_at: z.coerce.date().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
})

export const KeySystemSchema = z.object({
  id: z.string().uuid(),
  system_code: z.string(),
  name: z.string(),
  manufacturer: z.string().optional(),
  type: KeySystemTypeSchema,
  property_ids: z.string().optional(),
  installation_date: z.coerce.date().nullable().optional(),
  is_active: z.boolean().optional(),
  description: z.string().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
})

export const LogSchema = z.object({
  id: z.string().uuid(),
  user_name: z.string(),
  event_type: z.enum(['creation', 'update', 'delete']),
  object_type: z.enum(['key', 'key_system', 'key_loan']),
  event_time: z.coerce.date(),
  description: z.string().nullable().optional(),
})

// Request schemas for API endpoints
export const CreateKeyRequestSchema = z.object({
  key_name: z.string(),
  key_sequence_number: z.number().optional(),
  flex_number: z.number().optional(),
  rental_object: z.string().optional(),
  key_type: KeyTypeSchema,
  key_system_id: z.string().uuid().nullable().optional(),
})

export const UpdateKeyRequestSchema = z.object({
  key_name: z.string().optional(),
  key_sequence_number: z.number().optional(),
  flex_number: z.number().optional(),
  rental_object: z.string().optional(),
  key_type: KeyTypeSchema.optional(),
  key_system_id: z.string().uuid().nullable().optional(),
})

// Request schemas for key systems

export const CreateKeySystemRequestSchema = z.object({
  systemCode: z.string(),
  name: z.string(),
  manufacturer: z.string().optional(),
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
  lease: z.string().optional(),
  pickedUpAt: z.coerce.date().nullable().optional(),
  availableToNextTenantFrom: z.coerce.date().nullable().optional(),
  createdBy: z.string().nullable().optional(),
})

export const UpdateKeyLoanRequestSchema = z.object({
  keys: z.string().optional(),
  contact: z.string().optional(),
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
  objectType: z.enum(['key', 'key_system', 'key_loan']),
  description: z.string().nullable().optional(),
})

export const UpdateLogRequestSchema = z.object({
  userName: z.string().optional(),
  eventType: z.enum(['creation', 'update', 'delete']).optional(),
  objectType: z.enum(['key', 'key_system', 'key_loan']).optional(),
  description: z.string().nullable().optional(),
})