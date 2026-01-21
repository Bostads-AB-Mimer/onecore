import { z } from 'zod'

export const PaginationMetaSchema = z.object({
  totalRecords: z.number(),
  page: z.number(),
  limit: z.number(),
  count: z.number(),
})

export const PaginationLinksSchema = z.object({
  href: z.string(),
  rel: z.enum(['self', 'first', 'last', 'prev', 'next']),
})

/**
 * Factory function to create a paginated response schema for any content type
 *
 * @example
 * ```typescript
 * import { paginatedResponseSchema } from '@onecore/types'
 * import { TenantSchema } from './tenant'
 *
 * const response = paginatedResponseSchema(TenantSchema).parse(data)
 * // response.content is Tenant[]
 * // response._meta is PaginationMeta
 * // response._links is PaginationLinks[]
 * ```
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  contentSchema: T
) =>
  z.object({
    content: z.array(contentSchema),
    _meta: PaginationMetaSchema,
    _links: z.array(PaginationLinksSchema),
  })

// Inferred types for convenience
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
export type PaginationLinks = z.infer<typeof PaginationLinksSchema>
