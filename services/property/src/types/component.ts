import { z } from 'zod'

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

export const SpaceTypeEnum = z.enum(['OBJECT'])

// ==================== COMPONENT CATEGORIES ====================

// Query params for component categories
export const componentCategoriesQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentCategorySchema = z.object({
  id: z.string().uuid(),
  categoryName: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Create schema
export const CreateComponentCategorySchema = z.object({
  categoryName: z.string().trim().min(1, 'Category name is required'),
  description: z.string().trim().min(1, 'Description is required'),
})

// Update schema
export const UpdateComponentCategorySchema = z.object({
  categoryName: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
})

export type ComponentCategory = z.infer<typeof ComponentCategorySchema>
export type CreateComponentCategory = z.infer<
  typeof CreateComponentCategorySchema
>
export type UpdateComponentCategory = z.infer<
  typeof UpdateComponentCategorySchema
>


// ==================== COMPONENT TYPES ====================

// Query params for component types
export const componentTypesQueryParamsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentTypeSchema = z.object({
  id: z.string().uuid(),
  typeName: z.string(),
  categoryId: z.string().uuid(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: ComponentCategorySchema.optional(),
})

// Create schema
export const CreateComponentTypeSchema = z.object({
  typeName: z.string().trim().min(1, 'Type name is required'),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(1, 'Description is required'),
})

// Update schema
export const UpdateComponentTypeSchema = z.object({
  typeName: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().min(1).optional(),
})

export type ComponentType = z.infer<typeof ComponentTypeSchema>
export type CreateComponentType = z.infer<typeof CreateComponentTypeSchema>
export type UpdateComponentType = z.infer<typeof UpdateComponentTypeSchema>

// ==================== COMPONENT SUBTYPES ====================

// Query params for component subtypes
export const componentSubtypesQueryParamsSchema = z.object({
  typeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentSubtypeSchema = z.object({
  id: z.string().uuid(),
  subTypeName: z.string(),
  typeId: z.string().uuid(),
  xpandCode: z.string().optional(),
  depreciationPrice: z.number().min(0),
  technicalLifespan: z.number().min(0),
  economicLifespan: z.number().min(0),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
  componentType: ComponentTypeSchema.optional(),
})

// Create schema
export const CreateComponentSubtypeSchema = z.object({
  subTypeName: z.string().trim().min(1, 'Subtype name is required'),
  typeId: z.string().uuid(),
  xpandCode: z.string().trim().optional(),
  depreciationPrice: z.number().min(0),
  technicalLifespan: z.number().min(0),
  economicLifespan: z.number().min(0),
  replacementIntervalMonths: z.number().int().min(0),
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

// ==================== COMPONENT MODELS ====================

// Query params for component models
export const componentModelsQueryParamsSchema = z.object({
  componentSubtypeId: z.string().uuid().optional(),
  manufacturer: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentModelSchema = z.object({
  id: z.string().uuid(),
  modelName: z.string(),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string(),
  technicalSpecification: z.string().nullable(),
  installationInstructions: z.string().nullable(),
  dimensions: z.string().nullable(),
  coclassCode: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  subtype: ComponentSubtypeSchema.optional(),
})

// Create schema
export const CreateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1, 'Model name is required'),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string().trim().min(1, 'Manufacturer is required'),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
})

// Update schema
export const UpdateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1).optional(),
  componentSubtypeId: z.string().uuid().optional(),
  currentPrice: z.number().min(0).optional(),
  currentInstallPrice: z.number().min(0).optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  manufacturer: z.string().trim().min(1).optional(),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
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
  spaceId: z.string().uuid().nullable(),
  spaceType: SpaceTypeEnum,
  installationDate: z.date(),
  deinstallationDate: z.date().nullable(),
  orderNumber: z.string().optional(),
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
  warrantyStartDate: z.date().nullable(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum,
  quantity: z.number().min(0),
  economicLifespan: z.number().min(0),
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
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum.optional().default('ACTIVE'),
  quantity: z.number().min(0).default(1),
  economicLifespan: z.number().min(0),
})

// Update schema
export const UpdateComponentNewSchema = z.object({
  modelId: z.string().uuid().optional(),
  serialNumber: z.string().trim().min(1).optional(),
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  priceAtPurchase: z.number().min(0).optional(),
  depreciationPriceAtPurchase: z.number().min(0).optional(),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum.optional(),
  quantity: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
})

export type ComponentNew = z.infer<typeof ComponentNewSchema>
export type CreateComponentNew = z.infer<typeof CreateComponentNewSchema>
export type UpdateComponentNew = z.infer<typeof UpdateComponentNewSchema>

// ==================== COMPONENT INSTALLATIONS ====================

// Query params for component installations
export const componentInstallationsQueryParamsSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Full ComponentInstallation schema with component reference
// Used for direct ComponentInstallation queries where the full component details are needed
// Can include the component field because it references ComponentNewSchema (not circular at this level)
export const ComponentInstallationSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  spaceType: SpaceTypeEnum,
  installationDate: z.date(),
  deinstallationDate: z.date().nullable(),
  orderNumber: z.string().optional(),
  cost: z.number().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  component: ComponentNewSchema.optional(),
})

// Create schema
export const CreateComponentInstallationSchema = z.object({
  componentId: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
  spaceType: SpaceTypeEnum,
  installationDate: z.coerce.date(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().optional(),
  cost: z.number().min(0),
})

// Update schema
export const UpdateComponentInstallationSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  spaceType: SpaceTypeEnum.optional(),
  installationDate: z.coerce.date().optional(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().optional(),
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
