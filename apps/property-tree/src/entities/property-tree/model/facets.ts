// Client-side counting over the rental objects of the loaded roots.
//
// The tree ships per-type counts per node, which is why only the object-type
// filter can currently grey a branch or move its "Antal". Counting the objects
// here instead makes every dimension on the object row behave the same way,
// with no request per filter change — one pass over ~22k rows is a few
// milliseconds where the equivalent server query is 1.2 s.

import type { RentalObjectSummary as RentalObject } from '@/services/api/core/rentalObjectService'

import type {
  CheckState,
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from './selection'
import {
  countForTypes,
  isTypeFilterActive,
  nodeCheckState,
  nodeExcludedByTypes,
  nodeKey,
  nodePartiallyExcludedByTypes,
  objectTypeExcluded,
} from './selection'

export type { RentalObject }

/**
 * Every object-level restriction the picker applies. Sets are restrictions, so
 * an empty subtype set means "no subtype restriction". A new dimension is added
 * here, in objectMatches and in filterSignature — nowhere else.
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

export function objectMatches(
  object: RentalObject,
  filter: ObjectFilter
): boolean {
  return matches(object, filter.types, compileSubtypes(filter))
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

/** An object as a selectable node under its parent. */
export function objectNode(
  object: RentalObject,
  parent: Pick<PropertyTreeNode, 'key' | 'ancestors'>
): PropertyTreeNode {
  return {
    key: nodeKey('object', object.rentalId),
    level: 'object',
    value: object.rentalId,
    label: object.code ?? object.rentalId,
    ancestors: [...parent.ancestors, parent.key],
    // Its own type, so a type filter greys and drops it like any other node.
    typeCounts: {
      residence: 0,
      parkingSpace: 0,
      facility: 0,
      other: 0,
      [object.type]: 1,
    },
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
  /** false until at least one root's objects have arrived. */
  ready: boolean
}

export const PENDING_FACETS: FacetIndex = {
  countByKey: new Map(),
  totalByKey: new Map(),
  matchedRentalIds: new Set(),
  ready: false,
}

/** One pass over the objects: filtered and unfiltered counts per node key. */
export function buildFacetIndex(
  objects: readonly RentalObject[],
  filter: ObjectFilter
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

  return {
    countByKey,
    totalByKey,
    matchedRentalIds,
    ready: objects.length > 0,
  }
}

/**
 * The active filter plus whatever objects have arrived for it. Everything the
 * picker asks about a node goes through this: while the objects are still
 * loading each question falls back to the tree's own per-type counts, so the
 * UI behaves exactly as it did before and never blanks mid-load.
 */
export interface ObjectFilterView {
  filter: ObjectFilter
  facets: FacetIndex
  /** Subtype captions, for the fallback — object rows carry captions. */
  subtypeNames: ReadonlySet<string>
}

/** True when the filter restricts anything at all. */
export function isObjectFilterActive(view: ObjectFilterView): boolean {
  return (
    isTypeFilterActive(view.filter.types) || view.filter.subtypeKeys.size > 0
  )
}

const facetKnown = (view: ObjectFilterView, key: string): boolean =>
  view.facets.ready && view.facets.totalByKey.has(key)

/** Objects under a node matching the active filter — the "Antal" column. */
export function nodeCount(
  node: Pick<PropertyTreeNode, 'key' | 'typeCounts'>,
  view: ObjectFilterView
): number | undefined {
  if (facetKnown(view, node.key)) return view.facets.countByKey.get(node.key)
  return countForTypes(node, view.filter.types)
}

/** Nothing under the node matches: greyed, unselectable, dropped on apply. */
export function nodeExcluded(
  node: Pick<PropertyTreeNode, 'key' | 'typeCounts'>,
  view: ObjectFilterView
): boolean {
  if (facetKnown(view, node.key)) {
    if (!isObjectFilterActive(view)) return false
    return (view.facets.countByKey.get(node.key) ?? 0) === 0
  }
  return nodeExcludedByTypes(node, view.filter.types)
}

/** Some but not all of the node's objects match — a selected node then renders
 * indeterminate, since "checked" would claim its greyed members too. */
export function nodePartiallyExcluded(
  node: Pick<PropertyTreeNode, 'key' | 'typeCounts'>,
  view: ObjectFilterView
): boolean {
  if (facetKnown(view, node.key)) {
    const count = view.facets.countByKey.get(node.key) ?? 0
    const total = view.facets.totalByKey.get(node.key) ?? 0
    return count > 0 && count < total
  }
  return nodePartiallyExcludedByTypes(node, view.filter.types)
}

/** The checkbox state of one tree row: what the selection says, except that a
 * selected node holding filtered-out objects reads indeterminate. */
export function rowCheckState(
  selection: PropertyTreeSelection,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors' | 'typeCounts'>,
  view: ObjectFilterView
): CheckState {
  const state = nodeCheckState(selection, node)
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

/**
 * Whether one object row is filtered out. Gated per property rather than on
 * the global ready flag: rows under a root whose objects haven't arrived must
 * keep using the caption fallback instead of greying wholesale.
 */
export function objectRowExcluded(
  object: {
    rentalId: string
    type: RentalObjectType
    subtypeName: string | null
    propertyCode: string | null
  },
  view: ObjectFilterView
): boolean {
  const propertyKey = object.propertyCode
    ? nodeKey('property', object.propertyCode)
    : undefined
  if (propertyKey && facetKnown(view, propertyKey)) {
    return !view.facets.matchedRentalIds.has(object.rentalId)
  }
  // Fallback: rows carry captions, not codes, so the pre-load check matches on
  // names — and only for types that actually have a subtype picked.
  if (objectTypeExcluded(view.filter.types, object.type)) return true
  const restricted = compileSubtypes(view.filter).has(object.type)
  if (!restricted) return false
  return !object.subtypeName || !view.subtypeNames.has(object.subtypeName)
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
