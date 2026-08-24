// Client-side counting over the loaded roots' rental objects — the one source
// for every count, greying and exclusion question. One pass over ~22k rows is
// milliseconds vs a 1.2 s server query, so filter toggles cost no request.
// Unloaded roots answer "unknown": no count, never excluded.

import type { RentalObjectSummary as RentalObject } from '@/services/api/core/rentalObjectService'

import type {
  CheckState,
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from './selection'
import {
  nodeCheckState,
  nodeKey,
  parkingAreaKey,
  staircaseKey,
} from './selection'

export type { RentalObject }

/** Every object-level restriction the picker applies. A new dimension is
 * added here, in matches and in filterSignature — nowhere else. */
export interface ObjectFilter {
  types: ReadonlySet<RentalObjectType>
  subtypeKeys: ReadonlySet<string> // 'type:code' keys; empty = unrestricted
}

/** Subtype restrictions are per type: picking "Carport" narrows bilplatser
 * and leaves bostäder alone. A type with no subtype picked is unrestricted. */
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

/** The object's ancestor chain, shallowest first: property → building →
 * staircase, or property → parkingArea (property-scoped — a markyta can span
 * two fastigheter). Counts roll up the chain; the object hangs under its end. */
export function objectAncestorKeys(object: RentalObject): string[] {
  const keys: string[] = []
  if (object.propertyCode) keys.push(nodeKey('property', object.propertyCode))
  if (object.buildingCode) {
    keys.push(nodeKey('building', object.buildingCode))
    if (object.staircaseCode) {
      keys.push(staircaseKey(object.buildingCode, object.staircaseCode))
    }
  }
  if (object.parkingAreaCode && object.propertyCode) {
    keys.push(parkingAreaKey(object.propertyCode, object.parkingAreaCode))
  }
  return keys
}

/** The node the object hangs under — the deepest link of its ancestor chain. */
export function objectParentKey(object: RentalObject): string | undefined {
  const keys = objectAncestorKeys(object)
  return keys.length > 0 ? keys[keys.length - 1] : undefined
}

/** An object as a node under its parent; selectable=false keeps it display-only. */
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
  // Sparse: only keys some object counted into are present. Whether a missing
  // key means 0 or "not loaded" is settledRootKeys' call, not key presence.
  countByKey: ReadonlyMap<string, number> // node key → objects matching filter
  totalByKey: ReadonlyMap<string, number> // node key → objects, filter ignored
  matchedRentalIds: ReadonlySet<string> // matching rental ids — leaf rows read
  /** Root keys whose objects have resolved: below them a missing key is a
   * true zero; everywhere else it's "not loaded" — no count, never excluded. */
  settledRootKeys: ReadonlySet<string>
}

const NO_ROOTS: ReadonlySet<string> = new Set()

/** One pass over the objects: filtered and unfiltered counts per node key. */
export function buildFacetIndex(
  objects: readonly RentalObject[],
  filter: ObjectFilter,
  settledRootKeys: ReadonlySet<string> = NO_ROOTS
): FacetIndex {
  const countByKey = new Map<string, number>()
  const totalByKey = new Map<string, number>()
  const matchedRentalIds = new Set<string>()
  const subtypesByType = compileSubtypes(filter)

  for (const object of objects) {
    const matched = matches(object, filter.types, subtypesByType)
    if (matched) matchedRentalIds.add(object.rentalId)
    for (const key of objectAncestorKeys(object)) {
      totalByKey.set(key, (totalByKey.get(key) ?? 0) + 1)
      countByKey.set(key, (countByKey.get(key) ?? 0) + (matched ? 1 : 0))
    }
  }

  return { countByKey, totalByKey, matchedRentalIds, settledRootKeys }
}

/** The active filter plus whatever objects have arrived for it. Everything
 * the picker asks about a node goes through this. */
export interface ObjectFilterView {
  filter: ObjectFilter
  facets: FacetIndex
}

// A node's counts are known once its root's objects have resolved — the root
// is the node's first ancestor, or the node itself at the top.
const facetKnown = (
  view: ObjectFilterView,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>
): boolean => view.facets.settledRootKeys.has(node.ancestors[0] ?? node.key)

/** Objects under a node matching the active filter — the "Antal" column.
 * Undefined until the node's root's objects have arrived; a missing key under
 * a settled root is a branch that truly holds nothing, so it reads 0. */
export function nodeCount(
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  view: ObjectFilterView
): number | undefined {
  if (!facetKnown(view, node)) return undefined
  return view.facets.countByKey.get(node.key) ?? 0
}

/** Nothing under the node can match: greyed, unselectable, dropped on apply.
 * With no filter active every object matches, so this then only catches
 * branches holding no objects at all. Unknown nodes (objects not loaded) are
 * never excluded. */
export function nodeExcluded(
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'value' | 'ancestors'>,
  view: ObjectFilterView
): boolean {
  if (!facetKnown(view, node)) return false
  // Object nodes aren't counted per key; they match by rental id.
  if (node.level === 'object') {
    return !view.facets.matchedRentalIds.has(node.value)
  }
  return (view.facets.countByKey.get(node.key) ?? 0) === 0
}

/** Some but not all of the node's objects match — a selected node then renders
 * indeterminate, since "checked" would claim its greyed members too. */
export function nodePartiallyExcluded(
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  view: ObjectFilterView
): boolean {
  if (!facetKnown(view, node)) return false
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
  covered: ReadonlySet<string>
): CheckState {
  const state = nodeCheckState(selection, node, covered)
  return state === 'checked' && nodePartiallyExcluded(node, view)
    ? 'indeterminate'
    : state
}

/** The selection minus excluded nodes (filtered empty, or truly empty).
 * Excluded nodes stay latent in the underlying selection, so relaxing the
 * filter restores the filtered ones. */
export function filterSelection(
  selection: PropertyTreeSelection,
  view: ObjectFilterView
): PropertyTreeSelection {
  const next = new Map<string, PropertyTreeNode>()
  for (const [key, node] of selection) {
    if (!nodeExcluded(node, view)) next.set(key, node)
  }
  return next
}

/** A node whose count is the sum of its properties' — levels above property. */
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
