import { z } from 'zod'
import { ComponentTypeSchema } from './component-type'

// ==================== ENUMS ====================

export const QuantityTypeEnum = z.enum([
  'UNIT',
  'METER',
  'SQUARE_METER',
  'CUBIC_METER',
])

// ==================== COMPONENT SUBTYPES ====================

// Query params for component subtypes
export const componentSubtypesQueryParamsSchema = z.object({
  typeId: z.string().uuid().optional(),
  subtypeName: z.string().optional(), // Search parameter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentSubtypeSchema = z.object({
  id: z.string().uuid(),
  subTypeName: z.string(),
  typeId: z.string().uuid(),
  xpandCode: z.string().nullable(),
  depreciationPrice: z.number().min(0),
  technicalLifespan: z.number().min(0),
  economicLifespan: z.number().min(0),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  componentType: ComponentTypeSchema.optional(),
})

// Create schema
export const CreateComponentSubtypeSchema = z.object({
  subTypeName: z.string().trim().min(1, 'Subtype name is required'),
  typeId: z.string().uuid(),
  xpandCode: z.string().trim().optional(),
  depreciationPrice: z.number().min(0).optional().default(0),
  technicalLifespan: z.number().min(0).optional().default(0),
  economicLifespan: z.number().min(0).optional().default(0),
  replacementIntervalMonths: z.number().int().min(0).optional().default(0),
  quantityType: QuantityTypeEnum,
})

// Update schema
export const UpdateComponentSubtypeSchema = z.object({
  subTypeName: z.string().trim().min(1).optional(),
  typeId: z.string().uuid().optional(),
  xpandCode: z.string().trim().min(1).optional(),
  depreciationPrice: z.number().min(0).optional(),
  technicalLifespan: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
  replacementIntervalMonths: z.number().int().min(0).optional(),
  quantityType: QuantityTypeEnum.optional(),
})

export type ComponentSubtype = z.infer<typeof ComponentSubtypeSchema>
export type CreateComponentSubtype = z.infer<
  typeof CreateComponentSubtypeSchema
>
export type UpdateComponentSubtype = z.infer<
  typeof UpdateComponentSubtypeSchema
>
