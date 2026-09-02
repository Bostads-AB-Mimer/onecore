// Selection model for the hierarchical audience picker (MIM-1938). A selection
// stores exactly the checked nodes — no ancestor/descendant expansion. Checked
// state cascades visually: a node covers its subtree, ancestors render
// indeterminate.

import type { RentalObjectType } from '@/services/api/core/rentalObjectService'

export type PropertyTreeLevel =
  | 'district'
  | 'kvvArea'
  | 'marketArea' // babya — alternative top level grouping the same properties
  | 'property'
  | 'building'
  | 'parkingArea'
  | 'staircase'
  | 'object' // single rental object; selectable only where a consumer opts in

// Object-type vocabulary, used end-to-end (rows, filters, URL params, wire
// enum). Comes from the objects endpoint so the picker can't drift from it.
export type { RentalObjectType }

export const ALL_RENTAL_OBJECT_TYPES: readonly RentalObjectType[] = [
  'residence',
  'parkingSpace',
  'facility',
  'other',
]

export interface PropertyTreeNode {
  key: string // unique, e.g. 'district:61110' or 'building:504-017'
  level: PropertyTreeLevel
  value: string // the audienceCriteria value stored for this node
  label: string // display label for chips and rows
  ancestors: string[] // ancestor keys, outermost first
  // district/kvvArea/property store names as `value` but the search scopes on
  // ids, so they carry the backing id; elsewhere `value` is already the code.
  id?: string
  selectable?: boolean // false = display-only (inherits state, not togglable)
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

export function nodeKey(level: PropertyTreeLevel, id: string): string {
  return `${level}:${id}`
}

// Parking-area codes are only unique within their property. (Staircase ids
// are already composite `<byg>-<van>` from the API; see shared/routes.)
export const parkingAreaKey = (propertyCode: string, parkingAreaCode: string) =>
  nodeKey('parkingArea', `${propertyCode}:${parkingAreaCode}`)

export function nodeCheckState(
  selection: PropertyTreeSelection,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  // Walk-derived coverage (addCoveredAncestorKeys) — required, because
  // deriving it from stored ancestors goes stale across grouping switches.
  covered: ReadonlySet<string>
): CheckState {
  if (selection.has(node.key)) return 'checked'
  if (node.ancestors.some((key) => selection.has(key))) return 'checked'
  if (covered.has(node.key)) return 'indeterminate'
  return 'unchecked'
}

/** Toggle a node: checking selects it (subsuming selected descendants);
 * unchecking removes it — or its covering ancestor, unchecking the branch. */
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

/** A parent node and ALL its children, resolved lazily from loaded tree data. */
export interface ParentInfo {
  node: PropertyTreeNode
  children: PropertyTreeNode[]
}

/** After selecting a node, collapse each ancestor whose children are now ALL
 * selected into the ancestor itself, cascading upward. */
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

/** Uncheck mirror of rollUpSelection: replace the covering ancestor with
 * everything beneath it EXCEPT the unchecked branch, level by level down to
 * the node. Undefined when it doesn't apply — callers fall back to toggleNode. */
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
      // Display-only children can't join the selection; they just lose
      // coverage, which their rows show by unchecking.
      if (child.key === path[i + 1] || child.selectable === false) continue
      next.set(child.key, child)
    }
  })
  return next
}

/** Additively select nodes (bulk "select all matches"): covered nodes are
 * skipped, selected descendants subsumed — order-independent. */
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

/** Clear every one of `nodes` in one pass — looping toggleNode won't do: each
 * toggle re-derives coverage from the previous result, so unchecking a parent
 * uncovers its children and the next toggle SELECTS them. */
export function deselectNodes(
  selection: PropertyTreeSelection,
  nodes: PropertyTreeNode[],
  getParent?: (parentKey: string) => ParentInfo | undefined
): PropertyTreeSelection {
  let next = selection

  // Expand covering ancestors first (as a single uncheck would), so branches
  // the caller never named keep their selection.
  if (getParent) {
    for (const node of nodes) {
      const rolled = rollDownSelection(next, node, getParent)
      if (rolled) next = rolled
    }
  }

  const keys = new Set(nodes.map((node) => node.key))
  const covering = new Set<string>()
  for (const node of nodes) {
    for (const ancestor of node.ancestors) covering.add(ancestor)
  }

  const out = new Map(next)
  for (const [key, selected] of out) {
    // The nodes themselves, anything they cover, and — where roll-down could
    // not resolve — the ancestor still covering them.
    if (keys.has(key) || covering.has(key)) out.delete(key)
    else if (selected.ancestors.some((a) => keys.has(a))) out.delete(key)
  }
  return out
}
