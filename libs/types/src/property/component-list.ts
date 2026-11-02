import { z } from 'zod'

export const ComponentSortKeySchema = z.enum([
  'installed',
  'model',
  'serialNumber',
  'specifications',
  'quantity',
])
export type ComponentSortKey = z.infer<typeof ComponentSortKeySchema>

export const SortOrderSchema = z.enum(['asc', 'desc'])
export type SortOrder = z.infer<typeof SortOrderSchema>

export const ComponentInstallationFilterSchema = z.enum([
  'installed',
  'notInstalled',
  'unknownDate',
])
export type ComponentInstallationFilter = z.infer<
  typeof ComponentInstallationFilterSchema
>

// The component imports write 1900-01-01 when Xpand has no installation date.
export const FIRST_KNOWN_INSTALLATION_YEAR = 1901

export const ComponentsListQuerySchema = z.object({
  sortBy: ComponentSortKeySchema.optional(),
  sortOrder: SortOrderSchema.optional(),
  installation: ComponentInstallationFilterSchema.optional(),
  installedBefore: z.coerce
    .number()
    .int()
    .min(FIRST_KNOWN_INSTALLATION_YEAR + 1)
    .max(9999)
    .optional(),
  specifications: z.string().optional(),
})
