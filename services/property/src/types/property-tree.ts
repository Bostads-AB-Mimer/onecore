import { property } from '@onecore/types'
import { z } from 'zod'

// One way of organising properties. Everything BELOW the property level is
// identical across groupings; only the levels above differ, and never by
// more than one intermediate level.
export const PropertyGroupingSchema = z.enum([
  'costCenter',
  'marketArea',
  'company',
])

export type PropertyGrouping = z.infer<typeof PropertyGroupingSchema>

// What a tree node can be: the structural levels below a group, plus the
// rental-object types as leaves.
export const PROPERTY_TREE_STRUCTURAL_TYPES = [
  'property',
  'building',
  'staircase',
  'parkingArea',
] as const

export const PROPERTY_TREE_NODE_TYPES = [
  ...PROPERTY_TREE_STRUCTURAL_TYPES,
  ...property.RENTAL_OBJECT_TYPES,
] as const

export type PropertyTreeNodeType = (typeof PROPERTY_TREE_NODE_TYPES)[number]

// One node shape for every level below a group: `code` is the level's id
// (fstcode/bygcode/vancode/ytacode/rentalId), `name` what a user reads,
// subtype a building's or object's type. Leaves omit `children`.
// Depth-stamped via factories, not recursive: swagger's $refStrategy 'none'
// degrades self-references (and reused zod instances) to any/invalid TS.
const nodeFields = () => ({
  type: z.enum(PROPERTY_TREE_NODE_TYPES),
  code: z.string(),
  name: z.string().nullable(),
  subtypeCode: z.string().nullable(),
  subtypeName: z.string().nullable(),
})

const leafNode = () => z.object(nodeFields())
const depth1Node = () =>
  z.object({ ...nodeFields(), children: z.array(leafNode()).optional() })
const depth2Node = () =>
  z.object({ ...nodeFields(), children: z.array(depth1Node()).optional() })

export const PropertyTreeNodeSchema = z.object({
  ...nodeFields(),
  children: z.array(depth2Node()).optional(),
})

export type PropertyTreeNode = z.infer<typeof PropertyTreeNodeSchema>
export type PropertyTreeChildNode = NonNullable<
  PropertyTreeNode['children']
>[number]

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
  properties: z.array(PropertyTreeNodeSchema),
})

/**
 * A property tree rooted at one grouping value: root → groups → property
 * nodes, each carrying its whole subtree down to the rental-object leaves.
 *
 * Properties hang off groups only — never off the root as well. Mentioning
 * the same schema twice in one definition makes zod-to-json-schema emit an
 * internal self-reference that openapi-typescript renders as invalid TS
 * (see the node stamping above).
 */
export const PropertyTreeSchema = z.object({
  grouping: PropertyGroupingSchema,
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  groups: z.array(PropertyTreeGroupSchema),
})

export type PropertyTree = z.infer<typeof PropertyTreeSchema>
