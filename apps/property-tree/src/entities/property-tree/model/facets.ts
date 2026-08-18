// Client-side counting over the rental objects of the loaded roots — the one
// source for every count, greying and exclusion question. One pass over ~22k
// rows is a few milliseconds where the equivalent server query is 1.2 s, so
// filter toggles cost no request. Roots whose objects haven't arrived answer
// "unknown": no count, never excluded.

import type { RentalObjectSummary as RentalObject } from '@/services/api/core/rentalObjectService'

import type {
  CheckState,
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from './selection'
import { isTypeFilterActive, nodeCheckState, nodeKey } from './selection'

export type { RentalObject }

/**
 * Every object-level restriction the picker applies. Sets are restrictions, so
 * an empty subtype set means "no subtype restriction". A new dimension is added
 * here, in matches and in filterSignature — nowhere else.
 */
export interface ObjectFilter {
  types: ReadonlySet<RentalObjectType>
  /** `type:code` keys, matching useRentalObjectSubtypes' subtypeKey. */
  subtypeKeys: ReadonlySet<string>
}

/**
 * Subtype restrictions are per type, not global: picking "Carport" under
 * Bilplatser narrows bilplatser and leaves bostäder alone, because each type
 * button carries its own subtype menu. A type with no subtype picked is
 * unrestricted.
 */
type CompiledFilter = ReadonlyMap<RentalObjectType, ReadonlySet<string>>

const compileSubtypes = (filter: ObjectFilter): CompiledFilter => {
  const byType = new Map<RentalObjectType, Set<string>>()
  for (const key of filter.subtypeKeys) {
    const at = key.indexOf(':')
    if (at <= 0) continue
    const type = key.slice(0, at) as RentalObjectType
    const codes = byType.get(type) ?? new Set<string>()
    codes.add(key.slice(at + 1))
    byType.set(type, codes)
  }
  return byType
}

const matches = (
  object: RentalObject,
  types: ReadonlySet<RentalObjectType>,
  subtypesByType: CompiledFilter
): boolean => {
  if (!types.has(object.type)) return false
  const codes = subtypesByType.get(object.type)
  if (!codes) return true
  return !!object.subtypeCode && codes.has(object.subtypeCode)
}

/** Memoisation key for one filter. Order-independent, never persisted. */
export function filterSignature(filter: ObjectFilter): string {
  const types = [...filter.types].sort().join(',')
  const subtypes = [...filter.subtypeKeys].sort().join(',')
  return `${types}|${subtypes}`
}

/**
 * The tree nodes one object counts towards. Each level counts independently —
 * a building's count includes its trapphus' objects — mirroring how the server
 * aggregates. Parking areas are property-scoped because one physical area can
 * be split between two fastigheter (see treeRows).
 */
export function nodeKeysForObject(object: RentalObject): string[] {
  const keys: string[] = []
  if (object.propertyCode) keys.push(nodeKey('property', object.propertyCode))
  if (object.buildingCode) {
    keys.push(nodeKey('building', object.buildingCode))
    if (object.staircaseCode) {
      keys.push(
        nodeKey('staircase', `${object.buildingCode}-${object.staircaseCode}`)
      )
    }
  }
  if (object.parkingAreaCode && object.propertyCode) {
    keys.push(
      nodeKey('parkingArea', `${object.propertyCode}:${object.parkingAreaCode}`)
    )
  }
  return keys
}

/**
 * The one node an object hangs directly under — where its row is drawn, and
 * therefore whose children it is for roll-up. Distinct from nodeKeysForObject,
 * which returns every level the object counts towards.
 */
export function objectParentKey(object: RentalObject): string | undefined {
  if (object.parkingAreaCode && object.propertyCode) {
    return nodeKey(
      'parkingArea',
      `${object.propertyCode}:${object.parkingAreaCode}`
    )
  }
  if (object.buildingCode && object.staircaseCode) {
    return nodeKey(
      'staircase',
      `${object.buildingCode}-${object.staircaseCode}`
    )
  }
  if (object.buildingCode) return nodeKey('building', object.buildingCode)
  if (object.propertyCode) return nodeKey('property', object.propertyCode)
  return undefined
}

/** An object as a node under its parent. `selectable: false` keeps it out of
 * the selection where a consumer doesn't let objects be picked individually. */
export function objectNode(
  object: RentalObject,
  parent: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  selectable = true
): PropertyTreeNode {
  return {
    key: nodeKey('object', object.rentalId),
    level: 'object',
    value: object.rentalId,
    label: object.code ?? object.rentalId,
    ancestors: [...parent.ancestors, parent.key],
    ...(selectable ? {} : { selectable: false }),
  }
}

export interface FacetIndex {
  /** node key → objects matching the filter. Zero entries are present, so a
   * missing key means "not loaded" and never "no matches". */
  countByKey: ReadonlyMap<string, number>
  /** node key → objects regardless of the filter. */
  totalByKey: ReadonlyMap<string, number>
  /** Rental ids matching the filter — leaf rows read this. */
  matchedRentalIds: ReadonlySet<string>
  /** false until at least one root's objects query has resolved (an empty
   * result counts as resolved). */
  ready: boolean
}

/** One pass over the objects: filtered and unfiltered counts per node key. */
export function buildFacetIndex(
  objects: readonly RentalObject[],
  filter: ObjectFilter,
  ready: boolean
): FacetIndex {
  const countByKey = new Map<string, number>()
  const totalByKey = new Map<string, number>()
  const matchedRentalIds = new Set<string>()
  const subtypesByType = compileSubtypes(filter)

  for (const object of objects) {
    const matched = matches(object, filter.types, subtypesByType)
    if (matched) matchedRentalIds.add(object.rentalId)
    for (const key of nodeKeysForObject(object)) {
      totalByKey.set(key, (totalByKey.get(key) ?? 0) + 1)
      countByKey.set(key, (countByKey.get(key) ?? 0) + (matched ? 1 : 0))
    }
  }

  return { countByKey, totalByKey, matchedRentalIds, ready }
}

/** The active filter plus whatever objects have arrived for it. Everything
 * the picker asks about a node goes through this. */
export interface ObjectFilterView {
  filter: ObjectFilter
  facets: FacetIndex
}

/** True when the filter restricts anything at all. */
export function isObjectFilterActive(view: ObjectFilterView): boolean {
  return (
    isTypeFilterActive(view.filter.types) || view.filter.subtypeKeys.size > 0
  )
}

const facetKnown = (view: ObjectFilterView, key: string): boolean =>
  view.facets.ready && view.facets.totalByKey.has(key)

/** Objects under a node matching the active filter — the "Antal" column.
 * Undefined until the node's root's objects have arrived. */
export function nodeCount(
  node: Pick<PropertyTreeNode, 'key'>,
  view: ObjectFilterView
): number | undefined {
  if (!facetKnown(view, node.key)) return undefined
  return view.facets.countByKey.get(node.key)
}

/** Nothing under the node matches: greyed, unselectable, dropped on apply.
 * Unknown nodes (objects not loaded) are never excluded. */
export function nodeExcluded(
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'value' | 'ancestors'>,
  view: ObjectFilterView
): boolean {
  if (!isObjectFilterActive(view)) return false
  // Object nodes aren't counted per key; they match by rental id, gated on
  // their property being counted so unloaded selections stay untouched.
  if (node.level === 'object') {
    const propertyKey = node.ancestors.find((k) => k.startsWith('property:'))
    if (!propertyKey || !facetKnown(view, propertyKey)) return false
    return !view.facets.matchedRentalIds.has(node.value)
  }
  if (!facetKnown(view, node.key)) return false
  return (view.facets.countByKey.get(node.key) ?? 0) === 0
}

/** Some but not all of the node's objects match — a selected node then renders
 * indeterminate, since "checked" would claim its greyed members too. */
export function nodePartiallyExcluded(
  node: Pick<PropertyTreeNode, 'key'>,
  view: ObjectFilterView
): boolean {
  if (!facetKnown(view, node.key)) return false
  const count = view.facets.countByKey.get(node.key) ?? 0
  const total = view.facets.totalByKey.get(node.key) ?? 0
  return count > 0 && count < total
}

/** The checkbox state of one tree row: what the selection says, except that a
 * selected node holding filtered-out objects reads indeterminate. */
export function rowCheckState(
  selection: PropertyTreeSelection,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  view: ObjectFilterView,
  covered?: ReadonlySet<string>
): CheckState {
  const state = nodeCheckState(selection, node, covered)
  return state === 'checked' && nodePartiallyExcluded(node, view)
    ? 'indeterminate'
    : state
}

/** The selection minus nodes the filter empties. Excluded nodes stay latent in
 * the underlying selection, so relaxing the filter restores them. */
export function filterSelection(
  selection: PropertyTreeSelection,
  view: ObjectFilterView
): PropertyTreeSelection {
  if (!isObjectFilterActive(view)) return selection
  const next = new Map<string, PropertyTreeNode>()
  for (const [key, node] of selection) {
    if (!nodeExcluded(node, view)) next.set(key, node)
  }
  return next
}

/** Whether one object row is filtered out. Rows only render once their root's
 * objects arrived, so the id set is authoritative for every drawn row. */
export function objectRowExcluded(
  object: { rentalId: string; propertyCode: string | null },
  view: ObjectFilterView
): boolean {
  if (!isObjectFilterActive(view)) return false
  const propertyKey = object.propertyCode
    ? nodeKey('property', object.propertyCode)
    : undefined
  if (!propertyKey || !facetKnown(view, propertyKey)) return false
  return !view.facets.matchedRentalIds.has(object.rentalId)
}

/** A node whose count is the sum of its properties' — the levels above the
 * property, which objects don't name. */
export interface AncestorCounts {
  key: string
  propertyKeys: readonly string[]
}

/** Roll property counts up onto the kvvArea and root nodes. */
export function addAncestorCounts(
  facets: FacetIndex,
  ancestry: readonly AncestorCounts[]
): FacetIndex {
  if (ancestry.length === 0) return facets
  const countByKey = new Map(facets.countByKey)
  const totalByKey = new Map(facets.totalByKey)

  for (const { key, propertyKeys } of ancestry) {
    let count = 0
    let total = 0
    let known = false
    for (const propertyKey of propertyKeys) {
      const propertyTotal = facets.totalByKey.get(propertyKey)
      if (propertyTotal === undefined) continue
      known = true
      count += facets.countByKey.get(propertyKey) ?? 0
      total += propertyTotal
    }
    // Only claim a count when at least one property below is loaded, so the
    // node falls back to the server's numbers instead of showing zero.
    if (!known) continue
    countByKey.set(key, count)
    totalByKey.set(key, total)
  }

  return { ...facets, countByKey, totalByKey }
}
