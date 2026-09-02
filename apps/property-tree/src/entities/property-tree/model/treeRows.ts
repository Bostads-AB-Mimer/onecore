// Pure row-flattening for the picker tree: which rows of a district are
// visible given manual expansion and the active search query, and how search
// filters branches and auto-expands down to the deepest matching level.

import type {
  PropertyTree,
  PropertyTreeDataNode,
  PropertyTreeGroup,
  PropertyTreeRoot,
  TreeGrouping,
} from '../hooks/usePropertyTreeData'
import type {
  ParentInfo,
  PropertyTreeLevel,
  PropertyTreeNode,
  RentalObjectType,
} from './selection'
import { ALL_RENTAL_OBJECT_TYPES, nodeKey, parkingAreaKey } from './selection'

/**
 * How each grouping maps onto picker levels — the one place to edit when a
 * grouping is added.
 *
 * `hasGroups`: only cost centres have a real intermediate level (KVV-areas).
 * Marknadsområde emits a single group mirroring its root, which is not
 * rendered as a row of its own.
 * `rootValue`: the criterion stored for the root — districts are filtered by
 * name, marknadsområden by code (babya.code).
 */
const GROUPINGS: Record<
  TreeGrouping,
  {
    rootLevel: PropertyTreeLevel
    hasGroups: boolean
    rootValue: (root: PropertyTreeRoot) => string
  }
> = {
  costCenter: {
    rootLevel: 'district',
    hasGroups: true,
    rootValue: (root) => root.name,
  },
  marketArea: {
    rootLevel: 'marketArea',
    hasGroups: false,
    rootValue: (root) => root.code,
  },
}

/** The key of a root's row — also what the picker checks for expansion. */
export const rootKeyOf = (root: PropertyTreeRoot) => {
  const g = GROUPINGS[root.grouping]
  return nodeKey(g.rootLevel, g.rootValue(root))
}

// Four, not two: search flips every root into "loaded", which fires a full
// tree fetch (object leaves included) per district or marknadsområde. Two
// characters made that happen on the second keystroke of any word.
export const MIN_SEARCH_LENGTH = 4

export interface NodeRowSpec {
  kind: 'node'
  node: PropertyTreeNode
  depth: number
  expanded: boolean
  loading?: boolean
  code: string
  /** Overrides the level label in the Typ column (e.g. a building's
   * "Centralgarage" instead of the generic "Byggnad"). */
  typeLabel?: string
  /** True when this node itself matched the active search query. */
  matched?: boolean
  /** The fastighetsbeteckning rows below property level carry, so object
   * leaves can key their tenant lookup. */
  propertyDesignation?: string
}

/**
 * One rental object. Emitted by the same walk as every other level — the only
 * thing it can't carry is its tenants, which are fetched per property and
 * joined when the row is drawn.
 */
export interface ObjectRowSpec {
  kind: 'object'
  node: PropertyTreeNode
  object: RentalObject
  depth: number
  /** Key for the per-property tenant lookup. */
  propertyDesignation?: string
}

export type RowSpec = NodeRowSpec | ObjectRowSpec

const matches = (q: string, ...parts: (string | null | undefined)[]) =>
  parts.some((p) => p?.toLowerCase().includes(q))

/** KVV-areas are known by their responsible person; the code is already shown
 * in the Kod column. Display only — the stored criterion is always the code. */
export const groupLabel = (group: PropertyTreeGroup): string => {
  const responsible = [
    group.responsible?.firstName,
    group.responsible?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
  return responsible || group.name || group.code
}

// Roll-up walks the ancestor chain, so a single toggle resolves several
// parents against the same tree. Cache per tree object — each one belongs to
// exactly one root, and react-query hands back the same reference until it
// refetches.
const walkTreeCache = new WeakMap<PropertyTree, WalkNode>()

export function walkTreeFor(
  root: PropertyTreeRoot,
  tree: PropertyTree
): WalkNode {
  const cached = walkTreeCache.get(tree)
  if (cached) return cached
  const walk = buildWalkTree(root, tree)
  walkTreeCache.set(tree, walk)
  return walk
}

// key → walk node, one build per walk: every resolve (roll-up, roll-down,
// descendants) is then a lookup instead of a depth-first search.
const walkIndexCache = new WeakMap<WalkNode, ReadonlyMap<string, WalkNode>>()

function walkIndexFor(walk: WalkNode): ReadonlyMap<string, WalkNode> {
  const cached = walkIndexCache.get(walk)
  if (cached) return cached
  const index = new Map<string, WalkNode>()
  const visit = (n: WalkNode) => {
    index.set(n.node.key, n)
    for (const child of n.children) visit(child)
  }
  visit(walk)
  walkIndexCache.set(walk, index)
  return index
}

function findWalkNode(walk: WalkNode, key: string): WalkNode | undefined {
  return walkIndexFor(walk).get(key)
}

/**
 * Resolve a node and all of its children by key, for selection roll-up and
 * roll-down. Every selectable level lives in the tree, so this is a pure walk.
 * Apartment→trapphus roll-up (MIM-1924) will extend the panel's resolver with
 * object data instead.
 */
export function findParentInfo(
  root: PropertyTreeRoot,
  tree: PropertyTree,
  parentKey: string
): ParentInfo | undefined {
  const hit = findWalkNode(walkTreeFor(root, tree), parentKey)
  if (!hit) return undefined
  return { node: hit.node, children: hit.children.map((c) => c.node) }
}

/** Hard ceiling for one apply's total criteria (selection + descendants). */
export const MAX_EXPANDED_CRITERIA = 250

/**
 * All descendant nodes beneath `parentKey` ("inkludera underliggande nivåer"),
 * pruned by the type filter — a child with no objects of the active types is
 * skipped, though its own descendants are still considered. Returns undefined
 * when the key isn't in this tree, so the caller can try the next root.
 */
export function collectDescendantNodes(
  root: PropertyTreeRoot,
  tree: PropertyTree,
  parentKey: string,
  isExcluded: (node: PropertyTreeNode) => boolean
): PropertyTreeNode[] | undefined {
  const hit = findWalkNode(walkTreeFor(root, tree), parentKey)
  if (!hit) return undefined

  const out: PropertyTreeNode[] = []
  const collect = (walk: WalkNode) => {
    for (const child of walk.children) {
      // Levels only: a criterion pinned to a level keeps covering objects
      // added later, and per-object criteria would swamp the criteria cap.
      if (child.object) continue
      if (!isExcluded(child.node)) out.push(child.node)
      collect(child)
    }
  }
  collect(hit)
  return out
}

/** Add this walk's ancestors of every selected key found under the root to
 * `out` (found keys go to `resolved`). Walk-derived rather than stored
 * ancestors: sub-root keys are shared across groupings, so a property picked
 * under Distrikt must still mark its marknadsområde. */
export function addCoveredAncestorKeys(
  root: PropertyTreeRoot,
  tree: PropertyTree,
  selection: ReadonlyMap<string, unknown>,
  out: Set<string>,
  resolved: Set<string>
): void {
  const index = walkIndexFor(walkTreeFor(root, tree))
  for (const key of selection.keys()) {
    const hit = index.get(key)
    if (!hit) continue
    resolved.add(key)
    for (const ancestor of hit.node.ancestors) out.add(ancestor)
  }
}

// ---------------------------------------------------------------- walking

/**
 * A tree node reduced to what the row walker needs: identity, the text that
 * makes it findable, extra row fields, and its children.
 *
 * Building this is the only level-specific part. Everything after it — search
 * matching, which branches stay visible, auto-expansion, collapse overrides
 * and depth — is uniform, so it lives in one recursive pass instead of being
 * repeated per level.
 */
export interface WalkNode {
  node: PropertyTreeNode
  code: string
  searchText: (string | null | undefined)[]
  /** Level-specific row fields (typeLabel, and the codes object lookups need). */
  row?: Partial<NodeRowSpec>
  /** Whether the header's expand-all opens this level. Structural levels only,
   * so expanding everything never floods the table with object rows. */
  expandOnAll: boolean
  children: WalkNode[]
  /** Set on rental-object leaves. They join the walk tree so search, roll-up
   * and roll-down treat them like any other level; the rows themselves are
   * still drawn by OccupantRows, which owns the tenant join and the category
   * grouping. */
  object?: RentalObject
}

const isObjectType = (
  type: PropertyTreeDataNode['type']
): type is RentalObjectType =>
  (ALL_RENTAL_OBJECT_TYPES as readonly string[]).includes(type)

/** One rental-object leaf: the tree endpoint's node with its type narrowed
 * to the object types (the walk checks the enum once, at leaf detection).
 * `code` is the rentalId, `name` the postal address. */
export type RentalObject = Omit<PropertyTreeDataNode, 'type' | 'children'> & {
  type: RentalObjectType
}

/** An object as a node under its parent; selectable=false keeps it display-only. */
export function objectNode(
  object: RentalObject,
  parent: Pick<PropertyTreeNode, 'key' | 'ancestors'>,
  selectable = true
): PropertyTreeNode {
  return {
    key: nodeKey('object', object.code),
    level: 'object',
    value: object.code,
    label: object.code,
    ancestors: [...parent.ancestors, parent.key],
    ...(selectable ? {} : { selectable: false }),
  }
}

/** Rental objects hang under the node they are drawn beneath. */
const objectLeaf = (
  object: RentalObject,
  parent: PropertyTreeNode,
  propertyDesignation: string
): WalkNode => ({
  node: objectNode(object, parent),
  code: object.code,
  // code = rentalId, name = postal address.
  searchText: [object.code, object.name, object.subtypeName],
  expandOnAll: false,
  children: [],
  object,
  row: { propertyDesignation },
})

function buildWalkTree(
  root: PropertyTreeRoot,
  tree: PropertyTree | undefined
): WalkNode {
  const grouping = GROUPINGS[root.grouping]
  const rootKey = rootKeyOf(root)
  const groups = tree?.groups ?? []

  const propertyWalk = (
    p: PropertyTreeDataNode,
    ancestors: string[]
  ): WalkNode => {
    const designation = p.name ?? p.code
    const propKey = nodeKey('property', p.code)
    const propNode: PropertyTreeNode = {
      key: propKey,
      level: 'property',
      // Criteria store the fastighetsbeteckning, but every query matches on
      // fstcode — hence both, with `id` as the identifier.
      value: designation,
      label: designation,
      ancestors,
      id: p.code,
    }
    // Object leaves key their tenant lookup on the property's designation.
    const propertyContext = { propertyDesignation: designation }

    /** One node below the property — the levels only differ in how their
     * picker key is built (property-scoped markyta). */
    const childWalk = (
      n: PropertyTreeDataNode,
      parent: PropertyTreeNode
    ): WalkNode => {
      if (isObjectType(n.type)) {
        return objectLeaf({ ...n, type: n.type }, parent, designation)
      }
      const ancestors = [...parent.ancestors, parent.key]
      const walkChildren = (node: PropertyTreeNode) =>
        (n.children ?? []).map((c) => childWalk(c, node))
      switch (n.type) {
        case 'building': {
          const node: PropertyTreeNode = {
            key: nodeKey('building', n.code),
            level: 'building',
            value: n.code,
            label: n.name ?? n.code,
            ancestors,
          }
          return {
            node,
            code: n.code,
            // Type is shown in the Typ column, so it's searchable ("garage").
            searchText: [n.name, n.code, n.subtypeName],
            row: { ...propertyContext, typeLabel: n.subtypeName ?? undefined },
            expandOnAll: false,
            children: walkChildren(node),
          }
        }
        case 'staircase': {
          // The code arrives as the canonical `<bygcode>-<vancode>` composite.
          const node: PropertyTreeNode = {
            key: nodeKey('staircase', n.code),
            level: 'staircase',
            value: n.code,
            label: n.name ?? n.code,
            ancestors,
          }
          return {
            node,
            code: n.code,
            searchText: [n.name, n.code],
            row: propertyContext,
            expandOnAll: false,
            children: walkChildren(node),
          }
        }
        case 'parkingArea': {
          const node: PropertyTreeNode = {
            // Property-scoped: one physical parkeringsområde can be split
            // between two fastigheter, and then its code alone isn't unique.
            key: parkingAreaKey(p.code, n.code),
            level: 'parkingArea',
            value: n.code,
            label: n.name ?? n.code,
            ancestors,
          }
          return {
            node,
            code: n.code,
            searchText: [n.name, n.code],
            row: propertyContext,
            expandOnAll: false,
            children: walkChildren(node),
          }
        }
        // 'property' below a property never occurs; walk it as one anyway
        // rather than dropping data.
        case 'property':
          return propertyWalk(n, ancestors)
      }
    }

    return {
      node: propNode,
      code: p.code,
      searchText: [p.name, p.code],
      expandOnAll: false,
      children: (p.children ?? []).map((c) => childWalk(c, propNode)),
    }
  }

  return {
    node: {
      key: rootKey,
      level: grouping.rootLevel,
      value: grouping.rootValue(root),
      label: root.name,
      ancestors: [],
      id: root.id,
    },
    code: root.code,
    searchText: [root.name, root.code],
    expandOnAll: true,
    children: grouping.hasGroups
      ? groups.map((g): WalkNode => {
          const groupKey = nodeKey('kvvArea', g.code)
          return {
            node: {
              key: groupKey,
              level: 'kvvArea',
              value: g.code,
              label: groupLabel(g),
              ancestors: [rootKey],
              id: g.id,
            },
            code: g.code,
            // The label is included so searching the responsible person's
            // name finds their area.
            searchText: [groupLabel(g), g.name, g.code],
            expandOnAll: true,
            children: g.properties.map((p) =>
              propertyWalk(p, [rootKey, groupKey])
            ),
          }
        })
      : // No intermediate level: the synthetic group isn't a row, so its
        // properties hang straight off the root.
        groups.flatMap((g) =>
          g.properties.map((p) => propertyWalk(p, [rootKey]))
        ),
  }
}

interface Analysis {
  walk: WalkNode
  selfMatch: boolean
  children: Analysis[]
  anyChildVisible: boolean
  visible: boolean
}

/** Match the query down the tree once: a branch survives if it matches itself
 * or has a surviving descendant. */
function analyse(walk: WalkNode, q: string, searchActive: boolean): Analysis {
  const children = walk.children.map((c) => analyse(c, q, searchActive))
  const anyChildVisible = children.some((c) => c.visible)
  const selfMatch = searchActive && matches(q, ...walk.searchText)
  return {
    walk,
    selfMatch,
    children,
    anyChildVisible,
    visible: !searchActive || selfMatch || anyChildVisible,
  }
}

const NO_OVERRIDES: ReadonlyMap<string, boolean> = new Map()

/** What the walk needs beyond the tree itself. An options object rather than
 * positional arguments: the flags say nothing at the call site otherwise. */
export interface TreeRowOptions {
  query: string
  /** Manual open/close per key; absent = follow auto-expansion. */
  overrides?: ReadonlyMap<string, boolean>
  /** Draws the "Laddar..." row under a root whose tree is still arriving. */
  loading?: boolean
  /** Header expand-all: opens the structural levels (tree data only). */
  expandAllStructure?: boolean
}

export function buildTreeRows(
  root: PropertyTreeRoot,
  tree: PropertyTree | undefined,
  {
    query,
    overrides = NO_OVERRIDES,
    loading = false,
    expandAllStructure = false,
  }: TreeRowOptions
): RowSpec[] {
  const searchActive = query.length >= MIN_SEARCH_LENGTH
  const isOpen = (key: string, autoExpand: boolean) =>
    overrides.get(key) ?? autoExpand

  // Through the cache: this runs per root per render, and the walk carries an
  // object leaf per rental object.
  const walk = tree ? walkTreeFor(root, tree) : buildWalkTree(root, tree)
  const analysis = analyse(walk, query, searchActive)
  if (searchActive && !analysis.visible) return []

  const rows: RowSpec[] = []

  const emit = (a: Analysis, depth: number, showAll: boolean) => {
    const { walk } = a
    if (walk.object) {
      rows.push({
        kind: 'object',
        node: walk.node,
        object: walk.object,
        depth,
        propertyDesignation: walk.row?.propertyDesignation,
      })
      return
    }
    // A self-matching node stays collapsed: its own row already represents
    // the hit, and street searches match a building AND its every address.
    const autoExpand =
      (searchActive && a.anyChildVisible && !a.selfMatch) ||
      (expandAllStructure && walk.expandOnAll)
    const isExpanded = isOpen(walk.node.key, autoExpand)

    rows.push({
      kind: 'node',
      node: walk.node,
      depth,
      expanded: isExpanded,
      ...(depth === 0 ? { loading: isExpanded && loading } : {}),
      code: walk.code,
      matched: a.selfMatch,
      ...walk.row,
    })
    if (!isExpanded) return

    // A branch whose match sits at this level or above shows everything
    // beneath it; otherwise only the matching sub-branches are shown.
    const showAllHere = showAll || !searchActive || !a.anyChildVisible
    for (const child of a.children) {
      if (searchActive && !child.visible && !showAllHere) continue
      emit(child, depth + 1, showAllHere)
    }
  }

  emit(analysis, 0, false)
  return rows
}
