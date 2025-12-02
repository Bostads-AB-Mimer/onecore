import { z } from 'zod'

// ==================== HELPERS ====================

// Xpand ID validation - variable length IDs (max 15 chars) from legacy system
const xpandIdSchema = z.string().max(15, {
  message: 'ID must be at most 15 characters (Xpand legacy format)',
})

// ==================== ENUMS ====================

export const QuantityTypeEnum = z.enum([
  'UNIT',
  'METER',
  'SQUARE_METER',
  'CUBIC_METER',
])

export const ComponentStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
])

// ==================== COMPONENT TYPES ====================

// Query params for component types
export const componentTypesQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentTypeSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Create schema
export const CreateComponentTypeSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
})

// Update schema
export const UpdateComponentTypeSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').optional(),
})

export type ComponentType = z.infer<typeof ComponentTypeSchema>
export type CreateComponentType = z.infer<typeof CreateComponentTypeSchema>
export type UpdateComponentType = z.infer<typeof UpdateComponentTypeSchema>

// ==================== COMPONENT SUBTYPES ====================

// Query params for component subtypes
export const componentSubtypesQueryParamsSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentSubtypeSchema = z.object({
  id: z.string().uuid(),
  componentTypeId: z.string().uuid(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  componentType: ComponentTypeSchema.optional(),
})

// Create schema
export const CreateComponentSubtypeSchema = z.object({
  componentTypeId: z.string().uuid(),
  description: z.string().trim().min(1, 'Description is required'),
})

// Update schema
export const UpdateComponentSubtypeSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Description is required').optional(),
})

export type ComponentSubtype = z.infer<typeof ComponentSubtypeSchema>
export type CreateComponentSubtype = z.infer<
  typeof CreateComponentSubtypeSchema
>
export type UpdateComponentSubtype = z.infer<
  typeof UpdateComponentSubtypeSchema
>

// ==================== COMPONENT MODELS ====================

// Query params for component models
export const componentModelsQueryParamsSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  subtypeId: z.string().uuid().optional(),
  manufacturer: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentModelSchema = z.object({
  id: z.string().uuid(),
  componentTypeId: z.string().uuid(),
  subtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string(),
  technicalLifespan: z.number().min(0),
  technicalSpecification: z.string().nullable(),
  installationInstructions: z.string().nullable(),
  economicLifespan: z.number().min(0),
  dimensions: z.string().nullable(),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
  coclassCode: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  componentType: ComponentTypeSchema.optional(),
  subtype: ComponentSubtypeSchema.optional(),
})

// Create schema
export const CreateComponentModelSchema = z.object({
  componentTypeId: z.string().uuid(),
  subtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string().trim().min(1, 'Manufacturer is required'),
  technicalLifespan: z.number().min(0),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  economicLifespan: z.number().min(0),
  dimensions: z.string().trim().optional(),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
  coclassCode: z.string().trim().min(1, 'CoClass code is required'),
})

// Update schema
export const UpdateComponentModelSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  subtypeId: z.string().uuid().optional(),
  currentPrice: z.number().min(0).optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  manufacturer: z.string().trim().min(1).optional(),
  technicalLifespan: z.number().min(0).optional(),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  economicLifespan: z.number().min(0).optional(),
  dimensions: z.string().trim().optional(),
  replacementIntervalMonths: z.number().int().min(0).optional(),
  quantityType: QuantityTypeEnum.optional(),
  coclassCode: z.string().trim().min(1).optional(),
})

export type ComponentModel = z.infer<typeof ComponentModelSchema>
export type CreateComponentModel = z.infer<typeof CreateComponentModelSchema>
export type UpdateComponentModel = z.infer<typeof UpdateComponentModelSchema>

// ==================== COMPONENTS ====================

// Query params for components
export const componentsNewQueryParamsSchema = z.object({
  modelId: z.string().uuid().optional(),
  status: ComponentStatusEnum.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// ComponentInstallation schema without component reference (to avoid circular reference)
// This is used when ComponentInstallations are included in Component responses
// For direct ComponentInstallation queries, use ComponentInstallationSchema below
export const ComponentInstallationWithoutComponentSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: xpandIdSchema.nullable(),
  buildingPartId: xpandIdSchema.nullable(),
  installationDate: z.date(),
  deinstallationDate: z.date().nullable(),
  orderNumber: z.string(),
  cost: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Component instance response schema with installations included
// The componentInstallations field uses the "WithoutComponent" version to break circular reference
// This prevents infinite loops: Component -> Installation -> Component -> Installation -> ...
export const ComponentNewSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  serialNumber: z.string(),
  specifications: z.string().nullable(),
  additionalInformation: z.string().nullable(),
  warrantyStartDate: z.date().nullable(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  ncsCode: z.string().regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format'),
  status: ComponentStatusEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
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
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format'),
  status: ComponentStatusEnum.optional().default('ACTIVE'),
})

// Update schema
export const UpdateComponentNewSchema = z.object({
  modelId: z.string().uuid().optional(),
  serialNumber: z.string().trim().min(1).optional(),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  priceAtPurchase: z.number().min(0).optional(),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum.optional(),
})

export type ComponentNew = z.infer<typeof ComponentNewSchema>
export type CreateComponentNew = z.infer<typeof CreateComponentNewSchema>
export type UpdateComponentNew = z.infer<typeof UpdateComponentNewSchema>

// ==================== COMPONENT INSTALLATIONS ====================

// Query params for component installations
export const componentInstallationsQueryParamsSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: xpandIdSchema.optional(),
  buildingPartId: xpandIdSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Full ComponentInstallation schema with component reference
// Used for direct ComponentInstallation queries where the full component details are needed
// Can include the component field because it references ComponentNewSchema (not circular at this level)
export const ComponentInstallationSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: xpandIdSchema.nullable(),
  buildingPartId: xpandIdSchema.nullable(),
  installationDate: z.date(),
  deinstallationDate: z.date().nullable(),
  orderNumber: z.string(),
  cost: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  component: ComponentNewSchema.optional(),
})

// Create schema
export const CreateComponentInstallationSchema = z.object({
  componentId: z.string().uuid(),
  spaceId: xpandIdSchema.optional(),
  buildingPartId: xpandIdSchema.optional(),
  installationDate: z.coerce.date(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().min(1, 'Order number is required'),
  cost: z.number().min(0),
})

// Update schema
export const UpdateComponentInstallationSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: xpandIdSchema.optional(),
  buildingPartId: xpandIdSchema.optional(),
  installationDate: z.coerce.date().optional(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().min(1).optional(),
  cost: z.number().min(0).optional(),
})

export type ComponentInstallation = z.infer<typeof ComponentInstallationSchema>
export type CreateComponentInstallation = z.infer<
  typeof CreateComponentInstallationSchema
>
export type UpdateComponentInstallation = z.infer<
  typeof UpdateComponentInstallationSchema
>

// ==================== COMMON RESPONSE TYPES ====================

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    content: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
