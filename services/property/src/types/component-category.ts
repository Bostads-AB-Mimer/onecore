import { z } from 'zod'

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
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
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
