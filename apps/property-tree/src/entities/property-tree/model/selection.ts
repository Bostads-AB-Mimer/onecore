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

/**
 * Every key that is an ancestor of something selected — i.e. the nodes that
 * render indeterminate. Derived once per selection rather than per row: this
 * is called for every visible row, and the tree can be thousands of rows with
 * object leaves expanded. Keyed on the selection object, which is replaced
 * whenever the selection changes, so the entry can never go stale.
 */
const ancestorsOfSelected = new WeakMap<PropertyTreeSelection, Set<string>>()

function coveredAncestorKeys(
  selection: PropertyTreeSelection
): ReadonlySet<string> {
  const cached = ancestorsOfSelected.get(selection)
  if (cached) return cached

  const keys = new Set<string>()
  for (const selected of selection.values()) {
    for (const ancestor of selected.ancestors) keys.add(ancestor)
  }
  ancestorsOfSelected.set(selection, keys)
  return keys
}

export function nodeCheckState(
  selection: PropertyTreeSelection,
  node: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  // Defaults to stored ancestors; the picker passes walk-derived coverage
  // instead (addCoveredAncestorKeys) so it holds in either grouping.
  covered: ReadonlySet<string> = coveredAncestorKeys(selection)
): CheckState {
  if (selection.has(node.key)) return 'checked'
  if (node.ancestors.some((key) => selection.has(key))) return 'checked'
  if (covered.has(node.key)) return 'indeterminate'
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
      // Display-only children can't join the selection; they just lose
      // coverage, which their rows show by unchecking.
      if (child.key === path[i + 1] || child.selectable === false) continue
      next.set(child.key, child)
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
  nodes: PropertyTreeNode[],
  getParent?: (parentKey: string) => ParentInfo | undefined
): PropertyTreeSelection {
  let next = selection

  // A node covered by a selected ancestor is uncovered the way a single
  // uncheck does it — by expanding that ancestor into its other children — so
  // branches the caller never named keep their selection. Without this,
  // clearing the rows a search narrowed to would drop the whole district.
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
    // The nodes themselves, anything they cover, and — only where roll-down
    // could not resolve the branch — the ancestor still covering them, which
    // would otherwise keep them checked.
    if (keys.has(key) || covering.has(key)) out.delete(key)
    else if (selected.ancestors.some((a) => keys.has(a))) out.delete(key)
  }
  return out
}
