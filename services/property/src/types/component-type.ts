import { z } from 'zod'
import { ComponentCategorySchema } from './component-category'

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
  description: z.string().nullable(),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  category: ComponentCategorySchema.optional(),
})

// Create schema
export const CreateComponentTypeSchema = z.object({
  typeName: z.string().trim().min(1, 'Type name is required'),
  categoryId: z.string().uuid(),
  description: z.string().trim().optional(),
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
