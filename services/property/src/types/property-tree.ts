import { z } from 'zod'

import { CostCenterTreePropertySchema } from './cost-center'

// One way of organising properties. Everything BELOW the property level is
// identical across groupings (see CostCenterTreePropertySchema); only the
// levels above differ, and never by more than one intermediate level.
export const PropertyGroupingSchema = z.enum([
  'costCenter',
  'marketArea',
  'company',
])

export type PropertyGrouping = z.infer<typeof PropertyGroupingSchema>

// Marknadsområde (babya) — a flat attribute on the property, so this is a
// list of roots rather than a hierarchy.
export const MarketAreaSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
})

export type MarketAreaSummary = z.infer<typeof MarketAreaSummarySchema>

// The level between the root and its properties. The cost-center grouping
// uses it for KVV-areas; groupings without an intermediate level emit a
// single group mirroring the root, so consumers always walk the same path.
export const PropertyTreeGroupSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  // Only the cost-center grouping has a responsible user; core expands it to
  // a Keycloak user there and leaves it null for the others.
  responsibleKeycloakUserId: z.string().nullable(),
  properties: z.array(CostCenterTreePropertySchema),
})

/**
 * A property tree rooted at one grouping value: root → groups → properties,
 * and below that the shared building/trapphus/parkeringsområde structure.
 *
 * Deliberately NOT a recursive node shape. The service generates swagger with
 * `$refStrategy: 'none'`, under which a self-referencing schema degrades to
 * `any` and the generated frontend types lose all safety. Depth above the
 * property level is two at most, so the explicit shape costs nothing today.
 *
 * Properties hang off groups only — never off the root as well. Mentioning
 * the same schema twice in one definition makes zod-to-json-schema emit an
 * internal self-reference that openapi-typescript renders as invalid TS.
 */
export const PropertyTreeSchema = z.object({
  grouping: PropertyGroupingSchema,
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  groups: z.array(PropertyTreeGroupSchema),
})

export type PropertyTree = z.infer<typeof PropertyTreeSchema>
