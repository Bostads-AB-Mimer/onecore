// Selection model for the hierarchical audience picker (MIM-1938).
// A selection stores exactly the nodes the user checked — no ancestor or
// descendant expansion. Checked state cascades visually: a selected node
// covers its whole subtree, and every ancestor of a selected node renders
// as indeterminate.

import type { RentalObjectType } from '@/services/api/core/rentalObjectService'

export type PropertyTreeLevel =
  | 'district'
  | 'kvvArea'
  // Marknadsområde (babya) — an alternative top level to district/KVV-area,
  // grouping the same properties a different way.
  | 'marketArea'
  | 'property'
  | 'building'
  | 'parkingArea'
  | 'staircase'
  // A single rental object. Only selectable where a consumer opts in;
  // elsewhere the leaf rows just mirror their parent.
  | 'object'

// Object-type vocabulary, used end-to-end (rows, filter buttons, URL params,
// audienceObjectTypes wire enum). Swedish only at the label layer. Comes from
// the objects endpoint so the picker can't drift from what it returns.
export type { RentalObjectType }

export const ALL_RENTAL_OBJECT_TYPES: readonly RentalObjectType[] = [
  'residence',
  'parkingSpace',
  'facility',
  'other',
]

export interface PropertyTreeNode {
  /** Unique node key, e.g. 'district:61110' or 'building:504-017'. */
  key: string
  level: PropertyTreeLevel
  /** The audienceCriteria value stored for this node (name/code per level). */
  value: string
  /** Display label for chips and rows. */
  label: string
  /** Keys of the node's ancestors, outermost first. */
  ancestors: string[]
  /** Backing entity id, where `value` doesn't identify the node on its own.
   * Required on district, KVV-area and property: their criteria store a name
   * or a fastighetsbeteckning, while the rental-object search scopes on
   * cost-centre ids and fstcode. Unset for the other levels, whose `value` is
   * already the code. */
  id?: string
  /** false = display-only (inherits checked state but cannot be toggled). */
  selectable?: boolean
  /** Object counts per type, for the object-type filter's greying/exclusion.
   * Undefined (tree not loaded yet) = never excluded. */
  typeCounts?: Record<RentalObjectType, number>
}

export type PropertyTreeSelection = ReadonlyMap<string, PropertyTreeNode>

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

export const emptySelection: PropertyTreeSelection = new Map()

/** True when the type filter restricts anything (a strict subset is active). */
export function isTypeFilterActive(
  activeTypes: ReadonlySet<RentalObjectType>
): boolean {
  return activeTypes.size < ALL_RENTAL_OBJECT_TYPES.length
}

/** An excluded object type: greyed rows, never selectable. */
export function objectTypeExcluded(
  activeTypes: ReadonlySet<RentalObjectType>,
  type: RentalObjectType
): boolean {
  return isTypeFilterActive(activeTypes) && !activeTypes.has(type)
}

/**
 * Whether one object row is filtered out, by type or by subtype.
 *
 * Subtypes are matched on the caption, because that is what an object row
 * carries; `activeSubtypeNames` is derived from the selected `type:code`
 * keys. An empty set means no subtype restriction — the type filter alone
 * decides. Unlike types, subtypes cannot grey tree nodes: there are far too
 * many to precompute per node, so that waits on a facet-count endpoint.
 */
export function objectExcluded(
  activeTypes: ReadonlySet<RentalObjectType>,
  activeSubtypeNames: ReadonlySet<string>,
  object: { type: RentalObjectType; subtypeName: string | null }
): boolean {
  if (objectTypeExcluded(activeTypes, object.type)) return true
  if (activeSubtypeNames.size === 0) return false
  return !object.subtypeName || !activeSubtypeNames.has(object.subtypeName)
}

/** True when ALL of the node's objects are of excluded types — the node is
 * rendered greyed/unchecked and dropped from the applied criteria. */
export function nodeExcludedByTypes(
  node: Pick<PropertyTreeNode, 'typeCounts'>,
  activeTypes: ReadonlySet<RentalObjectType>
): boolean {
  if (!isTypeFilterActive(activeTypes) || !node.typeCounts) return false
  for (const type of activeTypes) {
    if ((node.typeCounts[type] ?? 0) > 0) return false
  }
  return true
}

/**
 * How many objects a node holds of the currently active types — the "Antal"
 * column. Reflects the type filter, so a building shows 12 with only parking
 * active and 86 with everything. Undefined before the tree has loaded.
 */
export function countForTypes(
  node: Pick<PropertyTreeNode, 'typeCounts'>,
  activeTypes: ReadonlySet<RentalObjectType>
): number | undefined {
  if (!node.typeCounts) return undefined
  let total = 0
  for (const type of ALL_RENTAL_OBJECT_TYPES) {
    if (activeTypes.has(type)) total += node.typeCounts[type] ?? 0
  }
  return total
}

/** True when the node holds objects BOTH inside and outside the active types.
 * A selected node then renders indeterminate — "checked" would claim its
 * greyed (excluded) members too. Display-only; the selection is untouched. */
export function nodePartiallyExcludedByTypes(
  node: Pick<PropertyTreeNode, 'typeCounts'>,
  activeTypes: ReadonlySet<RentalObjectType>
): boolean {
  if (!isTypeFilterActive(activeTypes) || !node.typeCounts) return false
  let activeCount = 0
  let excludedCount = 0
  for (const type of ALL_RENTAL_OBJECT_TYPES) {
    const count = node.typeCounts[type] ?? 0
    if (activeTypes.has(type)) activeCount += count
    else excludedCount += count
  }
  return activeCount > 0 && excludedCount > 0
}

/** The selection minus nodes fully excluded by the type filter. Excluded
 * nodes stay latent in the underlying selection so re-enabling a type
 * restores them; this derives what apply/count actually use. */
export function filterSelectionForTypes(
  selection: PropertyTreeSelection,
  activeTypes: ReadonlySet<RentalObjectType>
): PropertyTreeSelection {
  if (!isTypeFilterActive(activeTypes)) return selection
  const next = new Map<string, PropertyTreeNode>()
  for (const [key, node] of selection) {
    if (!nodeExcludedByTypes(node, activeTypes)) next.set(key, node)
  }
  return next
}

export function nodeKey(level: PropertyTreeLevel, id: string): string {
  return `${level}:${id}`
}

export function nodeCheckState(
  selection: PropertyTreeSelection,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>
): CheckState {
  if (selection.has(node.key)) return 'checked'
  if (node.ancestors.some((key) => selection.has(key))) return 'checked'
  for (const selected of selection.values()) {
    if (selected.ancestors.includes(node.key)) return 'indeterminate'
  }
  return 'unchecked'
}

/**
 * Toggle a node. Checking selects the node itself (subsuming any selected
 * descendants). Unchecking removes the node, or — when the node is covered
 * by a selected ancestor — removes that ancestor, unchecking the branch.
 */
export function toggleNode(
  selection: PropertyTreeSelection,
  node: PropertyTreeNode
): PropertyTreeSelection {
  if (node.selectable === false) return selection
  const next = new Map(selection)

  if (next.has(node.key)) {
    next.delete(node.key)
    return next
  }

  const selectedAncestor = node.ancestors.find((key) => next.has(key))
  if (selectedAncestor) {
    next.delete(selectedAncestor)
    return next
  }

  for (const [key, selected] of next) {
    if (selected.ancestors.includes(node.key)) next.delete(key)
  }
  next.set(node.key, node)
  return next
}

/** A parent node and ALL its child nodes (the toggled node's siblings),
 * resolved lazily from loaded tree data. */
export interface ParentInfo {
  node: PropertyTreeNode
  children: PropertyTreeNode[]
}

/**
 * After a node was selected, collapse each ancestor whose children are now
 * ALL selected into the ancestor itself, cascading upward. Sibling lists are
 * looked up on demand — only the toggled node's ancestor chain is examined.
 */
export function rollUpSelection(
  selection: PropertyTreeSelection,
  node: PropertyTreeNode,
  getParent: (parentKey: string) => ParentInfo | undefined
): PropertyTreeSelection {
  const next = new Map(selection)
  for (let i = node.ancestors.length - 1; i >= 0; i--) {
    const parentKey = node.ancestors[i]
    const parent = getParent(parentKey)
    if (!parent || parent.children.length === 0) return next
    if (!parent.children.every((child) => next.has(child.key))) return next
    for (const child of parent.children) next.delete(child.key)
    next.set(parentKey, parent.node)
  }
  return next
}

/**
 * Mirror of rollUpSelection for unchecking: when the node is covered by a
 * selected ancestor, replace that ancestor with everything beneath it EXCEPT
 * the unchecked branch, expanding level by level down to the node. Returns
 * undefined when it doesn't apply (node not ancestor-covered, or a level on
 * the path can't be resolved) — callers then fall back to plain toggleNode.
 */
export function rollDownSelection(
  selection: PropertyTreeSelection,
  node: PropertyTreeNode,
  getParent: (parentKey: string) => ParentInfo | undefined
): PropertyTreeSelection | undefined {
  if (node.selectable === false) return undefined
  if (selection.has(node.key)) return undefined
  const coveredIdx = node.ancestors.findIndex((key) => selection.has(key))
  if (coveredIdx === -1) return undefined

  // Selected ancestor down to the node itself. Resolve every level before
  // mutating so an unresolvable step degrades to the old uncheck-branch.
  const path = [...node.ancestors.slice(coveredIdx), node.key]
  const parents: ParentInfo[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const parent = getParent(path[i])
    if (!parent) return undefined
    parents.push(parent)
  }

  const next = new Map(selection)
  next.delete(path[0])
  parents.forEach((parent, i) => {
    for (const child of parent.children) {
      if (child.key !== path[i + 1]) next.set(child.key, child)
    }
  })
  return next
}

/**
 * Additively select nodes (bulk "select all matches"). Nodes already covered
 * by a selected ancestor are skipped; selecting a node subsumes any selected
 * descendants — so the result is order-independent and duplicate-free.
 */
export function selectNodes(
  selection: PropertyTreeSelection,
  nodes: PropertyTreeNode[]
): PropertyTreeSelection {
  const next = new Map(selection)
  for (const node of nodes) {
    if (node.selectable === false) continue
    if (next.has(node.key)) continue
    if (node.ancestors.some((key) => next.has(key))) continue
    for (const [key, selected] of next) {
      if (selected.ancestors.includes(node.key)) next.delete(key)
    }
    next.set(node.key, node)
  }
  return next
}

/**
 * Clear every one of `nodes` in a single pass — the bulk mirror of
 * selectNodes, and the reason "avmarkera allt som visas" can't just loop
 * toggleNode: each toggle re-derives coverage from a selection the previous
 * one already changed, so unchecking a parent leaves its children uncovered
 * and the next toggle SELECTS them.
 *
 * Three things go: the nodes themselves, anything they cover, and any
 * ancestor covering them — an ancestor left behind would keep them checked.
 */
export function deselectNodes(
  selection: PropertyTreeSelection,
  nodes: PropertyTreeNode[]
): PropertyTreeSelection {
  const keys = new Set(nodes.map((node) => node.key))
  const covering = new Set<string>()
  for (const node of nodes) {
    for (const ancestor of node.ancestors) covering.add(ancestor)
  }

  const next = new Map(selection)
  for (const [key, selected] of next) {
    if (keys.has(key) || covering.has(key)) next.delete(key)
    else if (selected.ancestors.some((a) => keys.has(a))) next.delete(key)
  }
  return next
}

/** Remove any selected node matching level+value (chip removal sync). */
export function pruneSelection(
  selection: PropertyTreeSelection,
  level: PropertyTreeLevel,
  value: string
): PropertyTreeSelection {
  const next = new Map(selection)
  for (const [key, node] of next) {
    if (node.level === level && node.value === value) next.delete(key)
  }
  return next
}
