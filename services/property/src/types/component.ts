import { z } from 'zod'

export const componentsQueryParamsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('maintenance'),
    maintenanceUnit: z.string().min(1, {
      message: 'maintenanceUnit cannot be empty when type is maintenance',
    }),
  }),
  z.object({
    type: z.literal('residence'),
    residenceCode: z.string().min(1, {
      message: 'residenceCode cannot be empty when type is residence',
    }),
  }),
])

export const ComponentSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  details: z.object({
    manufacturer: z.string().nullable(),
    typeDesignation: z.string().nullable(),
  }),
  dates: z.object({
    installation: z.date().nullable(),
    warrantyEnd: z.date().nullable(),
  }),
  classification: z.object({
    componentType: z.object({
      code: z.string(),
      name: z.string(),
    }),
    category: z.object({
      code: z.string(),
      name: z.string(),
    }),
  }),
  maintenanceUnits: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
  ),
})

// Create schema
export const CreateComponentNewSchema = z.object({
  modelId: z.string().uuid(),
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  specifications: z.string().trim().optional(),
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
