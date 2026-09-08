// Maps a property-tree selection onto the rental-object endpoints' scopes.
// A node's `value` is the criterion the tree stores for it, which is a name at
// three levels and a code at the rest — so the levels below take `value` and
// those three take `id`. Both object endpoints read the result.

import type {
  PropertyTreeLevel,
  PropertyTreeNode,
} from '@/entities/property-tree'

import type { RentalObjectScopeParams } from '@/services/api/core/propertyTreeService'

export type RentalObjectScopes = RentalObjectScopeParams

type ScopeKey = keyof RentalObjectScopes

const LEVEL_TO_SCOPE: Record<PropertyTreeLevel, ScopeKey> = {
  district: 'costCenterIds',
  kvvArea: 'kvvAreaIds',
  marketArea: 'marketAreaCodes',
  property: 'propertyCodes',
  building: 'buildingCodes',
  parkingArea: 'parkingAreaCodes',
  staircase: 'staircaseCodes',
  object: 'rentalIds',
}

/** Levels the search scopes by id; the rest send the node's stored value.
 * These are exactly the levels whose criterion is a name rather than a code —
 * a property's value is its fastighetsbeteckning, the search wants fstcode. */
const ID_LEVELS: ReadonlySet<PropertyTreeLevel> = new Set([
  'district',
  'kvvArea',
  'property',
])

/** Scope params for the selected nodes. Scopes are OR-ed server-side, so
 * overlapping levels are harmless. Values are sorted so ticking the same nodes
 * in a different order produces the same query key. */
export function selectionToScopes(
  nodes: Iterable<PropertyTreeNode>
): RentalObjectScopes {
  const out: RentalObjectScopes = {}
  for (const node of nodes) {
    const value = ID_LEVELS.has(node.level) ? node.id : node.value
    if (!value) continue
    const key = LEVEL_TO_SCOPE[node.level]
    out[key] = [...(out[key] ?? []), value]
  }
  for (const values of Object.values(out)) values?.sort()
  return out
}

export function hasAnyScope(scopes: RentalObjectScopes): boolean {
  return Object.values(scopes).some((values) => values && values.length > 0)
}
