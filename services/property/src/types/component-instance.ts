import { z } from 'zod'
import { ComponentModelSchema } from './component-model'

// ==================== ENUMS ====================

export const ComponentStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
])

export const SpaceTypeEnum = z.enum(['OBJECT', 'PropertyObject'])

export const ComponentConditionEnum = z.enum([
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
])

// ==================== COMPONENTS (INSTANCES) ====================

// Query params for components
export const componentsQueryParamsSchema = z.object({
  modelId: z.string().uuid().optional(),
  status: ComponentStatusEnum.optional(),
  serialNumber: z.string().optional(), // Trimming handled in adapter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Residence schema for navigation (just the id we need for routing)
export const ResidenceRefSchema = z.object({
  id: z.string(),
})

// PropertyStructure schema for room/residence information
export const PropertyStructureSchema = z.object({
  roomId: z.string().nullable().optional(),
  roomCode: z.string().nullable().optional(),
  roomName: z.string().nullable().optional(),
  residenceId: z.string().nullable().optional(),
  residenceCode: z.string().nullable().optional(),
  residenceName: z.string().nullable().optional(),
  rentalId: z.string().nullable().optional(),
  buildingCode: z.string().nullable().optional(),
  buildingName: z.string().nullable().optional(),
  residence: ResidenceRefSchema.nullable().optional(),
})

// PropertyObject schema with property structures
// Note: id is Char(15) keycmobj format, not UUID
export const PropertyObjectSchema = z.object({
  id: z.string(),
  propertyStructures: z.array(PropertyStructureSchema).optional(),
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
  propertyObject: PropertyObjectSchema.nullable().optional(),
})

// Component instance response schema with installations included
// The componentInstallations field uses the "WithoutComponent" version to break circular reference
// This prevents infinite loops: Component -> Installation -> Component -> Installation -> ...
export const ComponentSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  serialNumber: z.string().nullable(),
  specifications: z.string().nullable().optional(),
  additionalInformation: z.string().nullable().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .nullable()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z.string().nullable().optional(),
  status: ComponentStatusEnum,
  condition: ComponentConditionEnum.nullable().optional(),
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
export const CreateComponentSchema = z.object({
  modelId: z.string().uuid(),
  serialNumber: z.string().trim().nullable().optional(),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z.string().trim().nullable().optional(),
  status: ComponentStatusEnum.optional().default('ACTIVE'),
  condition: ComponentConditionEnum.nullable().optional(),
  quantity: z.number().min(0).default(1),
  economicLifespan: z.number().min(0),
})

// Update schema
export const UpdateComponentSchema = z.object({
  modelId: z.string().uuid().optional(),
  serialNumber: z.string().trim().nullable().optional(),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  warrantyMonths: z.number().int().min(0).optional(),
  priceAtPurchase: z.number().min(0).optional(),
  depreciationPriceAtPurchase: z.number().min(0).optional(),
  ncsCode: z.string().trim().nullable().optional(),
  status: ComponentStatusEnum.optional(),
  condition: ComponentConditionEnum.nullable().optional(),
  quantity: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
})

export type Component = z.infer<typeof ComponentSchema>
export type CreateComponent = z.infer<typeof CreateComponentSchema>
export type UpdateComponent = z.infer<typeof UpdateComponentSchema>

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
