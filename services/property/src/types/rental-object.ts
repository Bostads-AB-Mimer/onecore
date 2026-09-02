import { property } from '@onecore/types'
import { z } from 'zod'

import { PropertyGroupingSchema } from './property-tree'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here. The query-param schemas below
// stay local: they are this service's validation, not shared shapes.
export const {
  RENTAL_OBJECT_TYPES,
  RentalObjectTypeSchema,
  RentalObjectSummarySchema,
  RentalObjectSubtypeSchema,
} = property
export type RentalObjectType = property.RentalObjectType
export type RentalObjectSummary = property.RentalObjectSummary
export type RentalObjectSubtype = property.RentalObjectSubtype

export const GetRentalObjectsQueryParamsSchema = z
  .object({
    propertyCode: z.string().min(1).optional(),
    buildingCode: z.string().min(1).optional(),
    exclude: z
      .union([RentalObjectTypeSchema, z.array(RentalObjectTypeSchema)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
  })
  .refine((q) => !!q.propertyCode !== !!q.buildingCode, {
    message: 'Provide exactly one of propertyCode or buildingCode.',
  })

export type GetRentalObjectsQueryParams = z.infer<
  typeof GetRentalObjectsQueryParamsSchema
>

export const { RentalObjectDetailsSchema } = property
export type RentalObjectDetails = property.RentalObjectDetails

const repeatable = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.array(schema)])
    .transform((v) => (Array.isArray(v) ? v : [v]) as z.infer<T>[])
    .optional()

/**
 * Where to look for rental objects. The parameters are alternatives — an
 * object matches if it falls under ANY of them — so one query can span
 * "everything in this district plus this one building elsewhere".
 *
 * Shared by the search and the details lookup, which take the same selection
 * and must therefore resolve it identically.
 */
export const RentalObjectScopeParamsSchema = z.object({
  costCenterIds: repeatable(z.string().uuid()),
  kvvAreaIds: repeatable(z.string().uuid()),
  marketAreaCodes: repeatable(z.string().min(1)),
  propertyCodes: repeatable(z.string().min(1)),
  buildingCodes: repeatable(z.string().min(1)),
  staircaseCodes: repeatable(z.string().min(1)),
  parkingAreaCodes: repeatable(z.string().min(1)),
  // Individually picked objects — a client ticking leaves in the tree sends
  // them as their own scope. Capped at 200 because they ride in the query
  // string: 500 ids is ~12KB, past nginx's default 8k header buffer. Roll-up
  // collapses full parents, so a real selection never approaches this.
  rentalIds: repeatable(z.string().min(1)).pipe(
    z.array(z.string()).max(200).optional()
  ),
})

export type RentalObjectScopeParams = z.infer<
  typeof RentalObjectScopeParamsSchema
>

const SCOPE_KEYS = Object.keys(
  RentalObjectScopeParamsSchema.shape
) as (keyof RentalObjectScopeParams)[]

/** Named so the refine reads the scope keys only: the search schema extends
 * this one, and `types`/`subtypes` are filters, not scopes. */
const hasAnyScope = (query: RentalObjectScopeParams): boolean =>
  SCOPE_KEYS.some((key) => (query[key]?.length ?? 0) > 0)

const NO_SCOPE = { message: 'Provide at least one scope to search within.' }

/**
 * The listing-only values for a selection's objects. Takes the same scopes as
 * the search rather than property codes: a client shouldn't have to know which
 * fastighet a trapphus sits in, and resolving it here keeps the sold-stock
 * filter on the server.
 */
export const GetRentalObjectDetailsQueryParamsSchema =
  RentalObjectScopeParamsSchema.refine(hasAnyScope, NO_SCOPE)

export type GetRentalObjectDetailsQueryParams = z.infer<
  typeof GetRentalObjectDetailsQueryParamsSchema
>

/**
 * Scoped search across rental objects, narrowed by type and subtype.
 *
 * Subtypes are given as `type:code` pairs because a subtype code is only
 * unique within its object type.
 */
export const SearchRentalObjectsQueryParamsSchema =
  RentalObjectScopeParamsSchema.extend({
    types: repeatable(RentalObjectTypeSchema),
    subtypes: repeatable(z.string().min(1)),
    q: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(500).optional().default(50),
  }).refine(hasAnyScope, NO_SCOPE)

export type SearchRentalObjectsQueryParams = z.infer<
  typeof SearchRentalObjectsQueryParamsSchema
>
