import { z } from 'zod'
import { ComponentSchema, SpaceTypeEnum } from './component-instance'

// ==================== COMPONENT INSTALLATIONS ====================

// Query params for component installations
export const componentInstallationsQueryParamsSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().optional(), // Char(15) keycmobj format, not UUID
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Full ComponentInstallation schema with component reference
// Used for direct ComponentInstallation queries where the full component details are needed
// Can include the component field because it references ComponentSchema (not circular at this level)
export const ComponentInstallationSchema = z.object({
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
  component: ComponentSchema.optional(),
})

// Create schema
export const CreateComponentInstallationSchema = z.object({
  componentId: z.string().uuid(),
  spaceId: z.string().nullable().optional(),
  spaceType: SpaceTypeEnum,
  installationDate: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  deinstallationDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  orderNumber: z.string().trim().nullable().optional(),
  cost: z.number().min(0),
})

// Update schema
export const UpdateComponentInstallationSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().nullable().optional(),
  spaceType: SpaceTypeEnum.optional(),
  installationDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  deinstallationDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  orderNumber: z.string().trim().nullable().optional(),
  cost: z.number().min(0).optional(),
})

export type ComponentInstallation = z.infer<typeof ComponentInstallationSchema>
export type CreateComponentInstallation = z.infer<
  typeof CreateComponentInstallationSchema
>
export type UpdateComponentInstallation = z.infer<
  typeof UpdateComponentInstallationSchema
>
