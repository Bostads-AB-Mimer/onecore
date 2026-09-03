// Client-side counting over the loaded roots' walk trees — the one source
// for every count, greying and exclusion question. One post-order pass over
// ~22k leaves is milliseconds, so filter toggles cost no request.
// Roots whose tree hasn't loaded answer "unknown": no count, never excluded.

import type {
  CheckState,
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from './selection'
import { nodeCheckState } from './selection'
import type { RentalObject, WalkNode } from './treeRows'

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

export interface FacetIndex {
  // Every node of an indexed walk has an entry (the post-order pass fills
  // zeros), so a missing key means "root not loaded", never "no matches".
  countByKey: ReadonlyMap<string, number> // node key → objects matching filter
  totalByKey: ReadonlyMap<string, number> // node key → objects, filter ignored
  matchedRentalIds: ReadonlySet<string> // matching rental ids — leaf rows read
}

/** One post-order pass over the loaded walks: filtered and unfiltered counts
 * per node key, rolled up the tree as it unwinds. */
export function buildFacetIndex(
  walks: readonly WalkNode[],
  filter: ObjectFilter
): FacetIndex {
  const countByKey = new Map<string, number>()
  const totalByKey = new Map<string, number>()
  const matchedRentalIds = new Set<string>()
  const subtypesByType = compileSubtypes(filter)

  const visit = (walk: WalkNode): { count: number; total: number } => {
    if (walk.object) {
      const matched = matches(walk.object, filter.types, subtypesByType)
      if (matched) matchedRentalIds.add(walk.object.code)
      return { count: matched ? 1 : 0, total: 1 }
    }
    let count = 0
    let total = 0
    for (const child of walk.children) {
      const sums = visit(child)
      count += sums.count
      total += sums.total
    }
    countByKey.set(walk.node.key, count)
    totalByKey.set(walk.node.key, total)
    return { count, total }
  }
  for (const walk of walks) visit(walk)

  return { countByKey, totalByKey, matchedRentalIds }
}

/** The active filter plus whatever objects have arrived for it. Everything
 * the picker asks about a node goes through this. */
export interface ObjectFilterView {
  filter: ObjectFilter
  facets: FacetIndex
}

// Keyed on the node itself (its parent for uncounted object leaves), not its
// root: selected nodes keep the root of the grouping they were picked under.
const facetKnown = (
  view: ObjectFilterView,
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'ancestors'>
): boolean => {
  const key =
    node.level === 'object'
      ? (node.ancestors[node.ancestors.length - 1] ?? node.key)
      : node.key
  return view.facets.totalByKey.has(key)
}

/** Objects under a node matching the active filter — the "Antal" column.
 * Undefined until the node's root's objects have arrived; a missing key under
 * a settled root is a branch that truly holds nothing, so it reads 0. */
export function nodeCount(
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'ancestors'>,
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
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'ancestors'>,
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
  node: Pick<PropertyTreeNode, 'key' | 'level' | 'ancestors'>,
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
