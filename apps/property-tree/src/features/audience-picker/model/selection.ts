// Selection model for the hierarchical audience picker (MIM-1938).
// A selection stores exactly the nodes the user checked — no ancestor or
// descendant expansion. Checked state cascades visually: a selected node
// covers its whole subtree, and every ancestor of a selected node renders
// as indeterminate.

import type { RentalObjectType } from '@/services/api/core/rentalObjectService'

export type AudienceLevel =
  | 'district'
  | 'kvvArea'
  | 'property'
  | 'building'
  | 'parkingArea'
  | 'staircase'

// Object-type vocabulary, used end-to-end (rows, filter buttons, URL params,
// audienceObjectTypes wire enum). Swedish only at the label layer. Derived
// from the objects endpoint so the picker can't drift from what it returns.
export type AudienceObjectType = RentalObjectType

export const ALL_AUDIENCE_OBJECT_TYPES: readonly AudienceObjectType[] = [
  'residence',
  'parkingSpace',
  'facility',
  'other',
]

export interface AudienceNode {
  /** Unique node key, e.g. 'district:61110' or 'building:504-017'. */
  key: string
  level: AudienceLevel
  /** The audienceCriteria value stored for this node (name/code per level). */
  value: string
  /** Display label for chips and rows. */
  label: string
  /** Keys of the node's ancestors, outermost first. */
  ancestors: string[]
  /** false = display-only (inherits checked state but cannot be toggled). */
  selectable?: boolean
  /** Object counts per type, for the object-type filter's greying/exclusion.
   * Undefined (tree not loaded yet) = never excluded. */
  typeCounts?: Record<AudienceObjectType, number>
}

export type AudienceSelection = ReadonlyMap<string, AudienceNode>

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

export const emptySelection: AudienceSelection = new Map()

/** True when the type filter restricts anything (a strict subset is active). */
export function isTypeFilterActive(
  activeTypes: ReadonlySet<AudienceObjectType>
): boolean {
  return activeTypes.size < ALL_AUDIENCE_OBJECT_TYPES.length
}

/** An excluded object type: greyed rows, never selectable. */
export function objectTypeExcluded(
  activeTypes: ReadonlySet<AudienceObjectType>,
  type: AudienceObjectType
): boolean {
  return isTypeFilterActive(activeTypes) && !activeTypes.has(type)
}

/** True when ALL of the node's objects are of excluded types — the node is
 * rendered greyed/unchecked and dropped from the applied criteria. */
export function nodeExcludedByTypes(
  node: Pick<AudienceNode, 'typeCounts'>,
  activeTypes: ReadonlySet<AudienceObjectType>
): boolean {
  if (!isTypeFilterActive(activeTypes) || !node.typeCounts) return false
  for (const type of activeTypes) {
    if ((node.typeCounts[type] ?? 0) > 0) return false
  }
  return true
}

/** True when the node holds objects BOTH inside and outside the active types.
 * A selected node then renders indeterminate — "checked" would claim its
 * greyed (excluded) members too. Display-only; the selection is untouched. */
export function nodePartiallyExcludedByTypes(
  node: Pick<AudienceNode, 'typeCounts'>,
  activeTypes: ReadonlySet<AudienceObjectType>
): boolean {
  if (!isTypeFilterActive(activeTypes) || !node.typeCounts) return false
  let activeCount = 0
  let excludedCount = 0
  for (const type of ALL_AUDIENCE_OBJECT_TYPES) {
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
  selection: AudienceSelection,
  activeTypes: ReadonlySet<AudienceObjectType>
): AudienceSelection {
  if (!isTypeFilterActive(activeTypes)) return selection
  const next = new Map<string, AudienceNode>()
  for (const [key, node] of selection) {
    if (!nodeExcludedByTypes(node, activeTypes)) next.set(key, node)
  }
  return next
}

export function nodeKey(level: AudienceLevel, id: string): string {
  return `${level}:${id}`
}

export function nodeCheckState(
  selection: AudienceSelection,
  node: Pick<AudienceNode, 'key' | 'ancestors'>
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
  selection: AudienceSelection,
  node: AudienceNode
): AudienceSelection {
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
  node: AudienceNode
  children: AudienceNode[]
}

/**
 * After a node was selected, collapse each ancestor whose children are now
 * ALL selected into the ancestor itself, cascading upward. Sibling lists are
 * looked up on demand — only the toggled node's ancestor chain is examined.
 */
export function rollUpSelection(
  selection: AudienceSelection,
  node: AudienceNode,
  getParent: (parentKey: string) => ParentInfo | undefined
): AudienceSelection {
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
  selection: AudienceSelection,
  node: AudienceNode,
  getParent: (parentKey: string) => ParentInfo | undefined
): AudienceSelection | undefined {
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
  selection: AudienceSelection,
  nodes: AudienceNode[]
): AudienceSelection {
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

/** Remove any selected node matching level+value (chip removal sync). */
export function pruneSelection(
  selection: AudienceSelection,
  level: AudienceLevel,
  value: string
): AudienceSelection {
  const next = new Map(selection)
  for (const [key, node] of next) {
    if (node.level === level && node.value === value) next.delete(key)
  }
  return next
}

export interface AudienceCriteriaValues {
  districtNames: string[]
  kvvAreaCodes: string[]
  property: string[]
  buildingCodes: string[]
  parkingAreaCodes: string[]
  // Composite buildingCode-staircaseCode (e.g. '504-017-01').
  staircaseCodes: string[]
  // [] = all types (no restriction). Set by the panel's type filter, not
  // derived from selected nodes.
  objectTypes: AudienceObjectType[]
}

const LEVEL_TO_CRITERIA_KEY: Record<
  AudienceLevel,
  Exclude<keyof AudienceCriteriaValues, 'objectTypes'>
> = {
  district: 'districtNames',
  kvvArea: 'kvvAreaCodes',
  property: 'property',
  building: 'buildingCodes',
  parkingArea: 'parkingAreaCodes',
  staircase: 'staircaseCodes',
}

/** Map a selection to audienceCriteria values, keyed by the level checked. */
export function selectionToCriteria(
  selection: AudienceSelection
): AudienceCriteriaValues {
  const out: AudienceCriteriaValues = {
    districtNames: [],
    kvvAreaCodes: [],
    property: [],
    buildingCodes: [],
    parkingAreaCodes: [],
    staircaseCodes: [],
    objectTypes: [],
  }
  for (const node of selection.values()) {
    out[LEVEL_TO_CRITERIA_KEY[node.level]].push(node.value)
  }
  return out
}
