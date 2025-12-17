import { z } from 'zod'
import { ComponentModelSchema } from './component-model'

// ==================== ENUMS ====================

export const ComponentStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
])

export const SpaceTypeEnum = z.enum(['OBJECT'])

// ==================== COMPONENTS (INSTANCES) ====================

// Query params for components
export const componentsNewQueryParamsSchema = z.object({
  modelId: z.string().uuid().optional(),
  status: ComponentStatusEnum.optional(),
  serialNumber: z.string().optional(), // Trimming handled in adapter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// ComponentInstallation schema without component reference (to avoid circular reference)
// This is used when ComponentInstallations are included in Component responses
// For direct ComponentInstallation queries, use ComponentInstallationSchema in component-installation.ts
export const ComponentInstallationWithoutComponentSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: z.string().nullable(),
  spaceType: SpaceTypeEnum,
  installationDate: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  deinstallationDate: z
    .union([z.string(), z.date()])
    .nullable()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  orderNumber: z.string().nullable().optional(),
  cost: z.number().min(0),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
})

// Component instance response schema with installations included
// The componentInstallations field uses the "WithoutComponent" version to break circular reference
// This prevents infinite loops: Component -> Installation -> Component -> Installation -> ...
export const ComponentNewSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  serialNumber: z.string(),
  specifications: z.string().nullable().optional(),
  additionalInformation: z.string().nullable().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .nullable()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .nullable()
    .optional(),
  status: ComponentStatusEnum,
  quantity: z.number().min(0),
  economicLifespan: z.number().min(0),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  model: ComponentModelSchema.optional(),
  componentInstallations: z
    .array(ComponentInstallationWithoutComponentSchema)
    .optional(),
})

// Create schema
export const CreateComponentNewSchema = z.object({
  modelId: z.string().uuid(),
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .nullable()
    .optional(),
  status: ComponentStatusEnum.optional().default('ACTIVE'),
  quantity: z.number().min(0).default(1),
  economicLifespan: z.number().min(0),
})

// Update schema
export const UpdateComponentNewSchema = z.object({
  modelId: z.string().uuid().optional(),
  serialNumber: z.string().trim().min(1).optional(),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0).optional(),
  priceAtPurchase: z.number().min(0).optional(),
  depreciationPriceAtPurchase: z.number().min(0).optional(),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .nullable()
    .optional(),
  status: ComponentStatusEnum.optional(),
  quantity: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
})

export type ComponentNew = z.infer<typeof ComponentNewSchema>
export type CreateComponentNew = z.infer<typeof CreateComponentNewSchema>
export type UpdateComponentNew = z.infer<typeof UpdateComponentNewSchema>

// ==================== FILE SCHEMAS ====================

// Schema for component files (images)
export const ComponentFileSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  uploadedAt: z.string(),
  url: z.string().optional(), // Presigned URL
})

export type ComponentFile = z.infer<typeof ComponentFileSchema>
