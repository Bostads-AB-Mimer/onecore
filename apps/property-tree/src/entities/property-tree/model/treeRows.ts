// Pure row-flattening for the picker tree: which rows of a district are
// visible given manual expansion and the active search query, and how search
// filters branches and auto-expands down to the deepest matching level.

import type {
  PropertyTree,
  PropertyTreeGroup,
  PropertyTreeProperty,
  PropertyTreeRoot,
  TreeGrouping,
} from '../hooks/usePropertyTreeData'
import type { RentalObject } from './facets'
import { objectNode } from './facets'
import type {
  ParentInfo,
  PropertyTreeLevel,
  PropertyTreeNode,
  RentalObjectType,
} from './selection'
import { nodeKey } from './selection'

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

// Four, not two: search flips every root into "loaded", which fires a tree
// and an object fetch per district or marknadsområde. Two characters made
// that happen on the second keystroke of any word.
export const MIN_SEARCH_LENGTH = 4

type TypeCounts = Record<RentalObjectType, number>

const aggregateTypeCounts = (a: {
  residenceCount: number
  parkingCount: number
  facilityCount: number
  otherCount: number
}): TypeCounts => ({
  residence: a.residenceCount,
  parkingSpace: a.parkingCount,
  facility: a.facilityCount,
  other: a.otherCount,
})

const sumTypeCounts = (
  properties: { aggregates: PropertyTreeProperty['aggregates'] }[]
): TypeCounts => {
  const sum: TypeCounts = {
    residence: 0,
    parkingSpace: 0,
    facility: 0,
    other: 0,
  }
  for (const p of properties) {
    sum.residence += p.aggregates.residenceCount
    sum.parkingSpace += p.aggregates.parkingCount
    sum.facility += p.aggregates.facilityCount
    sum.other += p.aggregates.otherCount
  }
  return sum
}

// Parkeringsområden hold nothing but parking, so they have no count row of
// their own to read.
const parkingAreaTypeCounts = (parkingCount: number): TypeCounts => ({
  residence: 0,
  parkingSpace: parkingCount,
  facility: 0,
  other: 0,
})

export interface NodeRowSpec {
  kind: 'node'
  node: PropertyTreeNode
  depth: number
  expandable: boolean
  expanded: boolean
  loading?: boolean
  code: string
  /** Overrides the level label in the Typ column (e.g. a building's
   * "Centralgarage" instead of the generic "Byggnad"). */
  typeLabel?: string
  /** True when this node itself matched the active search query. */
  matched?: boolean
  /** Property context (drives object/tenant lookups below tree level). */
  propertyCode?: string
  propertyDesignation?: string
  /** Set on staircase rows: the raw codes needed to filter their objects. */
  buildingCode?: string
  staircaseCode?: string
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
  matched?: boolean
}

export type RowSpec = NodeRowSpec | ObjectRowSpec

const matches = (q: string, ...parts: (string | null | undefined)[]) =>
  parts.some((p) => p?.toLowerCase().includes(q))

const staircaseComposite = (buildingCode: string, staircaseCode: string) =>
  `${buildingCode}-${staircaseCode}`

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
const walkTreeCache = new WeakMap<
  PropertyTree,
  WeakMap<ReadonlyMap<string, RentalObject[]>, WalkNode>
>()

const NO_OBJECTS: ReadonlyMap<string, RentalObject[]> = new Map()

function walkTreeFor(
  root: PropertyTreeRoot,
  tree: PropertyTree,
  objectsByParent: ReadonlyMap<string, RentalObject[]> = NO_OBJECTS
): WalkNode {
  // Keyed on both: the same tree yields a different walk once its objects
  // have arrived.
  const byObjects = walkTreeCache.get(tree) ?? new WeakMap()
  walkTreeCache.set(tree, byObjects)
  const cached = byObjects.get(objectsByParent)
  if (cached) return cached
  const walk = buildWalkTree(root, tree, objectsByParent)
  byObjects.set(objectsByParent, walk)
  return walk
}

/** Depth-first search for one node of the walk tree. */
function findWalkNode(walk: WalkNode, key: string): WalkNode | undefined {
  if (walk.node.key === key) return walk
  for (const child of walk.children) {
    const hit = findWalkNode(child, key)
    if (hit) return hit
  }
  return undefined
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
      if (!isExcluded(child.node)) out.push(child.node)
      collect(child)
    }
  }
  collect(hit)
  return out
}

/**
 * The property keys under each node above the property level. Objects name
 * their property but not the levels above it, so those nodes' counts are
 * summed from their properties'.
 */
export function ancestorPropertyKeys(
  root: PropertyTreeRoot,
  tree: PropertyTree
): { key: string; propertyKeys: string[] }[] {
  const walk = walkTreeFor(root, tree)
  const propertyKeysUnder = (node: WalkNode): string[] =>
    node.node.level === 'property'
      ? [node.node.key]
      : node.children.flatMap(propertyKeysUnder)

  const out = [{ key: walk.node.key, propertyKeys: propertyKeysUnder(walk) }]
  for (const child of walk.children) {
    if (child.node.level === 'property') continue
    out.push({ key: child.node.key, propertyKeys: propertyKeysUnder(child) })
  }
  return out
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
interface WalkNode {
  node: PropertyTreeNode
  code: string
  searchText: (string | null | undefined)[]
  /** Level-specific row fields (typeLabel, and the codes object lookups need). */
  row?: Partial<NodeRowSpec>
  /** Whether the header's expand-all opens this level. Structural levels only,
   * so expanding everything never triggers per-property object fetches. */
  expandOnAll: boolean
  children: WalkNode[]
  /** Set on rental-object leaves. They join the walk tree so search, roll-up
   * and roll-down treat them like any other level; the rows themselves are
   * still drawn by OccupantRows, which owns the tenant join and the category
   * grouping. */
  object?: RentalObject
}

/** Rental objects hang under the node they are drawn beneath. */
const objectLeaf = (
  object: RentalObject,
  parent: PropertyTreeNode,
  propertyDesignation: string
): WalkNode => ({
  node: objectNode(object, parent),
  code: object.rentalId,
  searchText: [
    object.rentalId,
    object.code,
    object.address,
    object.subtypeName,
  ],
  expandOnAll: false,
  children: [],
  object,
  row: { propertyDesignation },
})

function buildWalkTree(
  root: PropertyTreeRoot,
  tree: PropertyTree | undefined,
  objectsByParent: ReadonlyMap<string, RentalObject[]>
): WalkNode {
  const leavesOf = (
    parent: PropertyTreeNode,
    propertyDesignation: string
  ): WalkNode[] =>
    (objectsByParent.get(parent.key) ?? []).map((o) =>
      objectLeaf(o, parent, propertyDesignation)
    )
  const grouping = GROUPINGS[root.grouping]
  const rootKey = rootKeyOf(root)
  const groups = tree?.groups ?? []

  const propertyWalk = (
    p: PropertyTreeProperty,
    ancestors: string[]
  ): WalkNode => {
    const designation = p.designation ?? p.code
    const propKey = nodeKey('property', p.code)
    const propAncestors = [...ancestors, propKey]
    const propNode: PropertyTreeNode = {
      key: propKey,
      level: 'property',
      // Criteria store the fastighetsbeteckning, but every query matches on
      // fstcode — hence both, with `id` as the identifier.
      value: designation,
      label: designation,
      ancestors,
      id: p.code,
      typeCounts: aggregateTypeCounts(p.aggregates),
    }
    // Everything below a property needs to know which property it belongs to,
    // so the object lookups under trapphus and parkeringsområden can run.
    const propertyContext = {
      propertyCode: p.code,
      propertyDesignation: designation,
    }

    const buildings = p.buildings.map((b): WalkNode => {
      const buildingKey = nodeKey('building', b.buildingCode)
      const buildingAncestors = [...propAncestors, buildingKey]
      const buildingNode: PropertyTreeNode = {
        key: buildingKey,
        level: 'building',
        value: b.buildingCode,
        label: b.buildingName ?? b.buildingCode,
        ancestors: propAncestors,
        typeCounts: aggregateTypeCounts(b),
      }
      return {
        node: buildingNode,
        code: b.buildingCode,
        // Type is shown in the Typ column, so it's searchable too ("garage").
        searchText: [b.buildingName, b.buildingCode, b.buildingType?.name],
        row: {
          ...propertyContext,
          typeLabel: b.buildingType?.name ?? undefined,
        },
        expandOnAll: false,
        children: [
          ...leavesOf(buildingNode, designation),
          ...b.staircases.map((s): WalkNode => {
            const composite = staircaseComposite(b.buildingCode, s.code)
            const staircaseNode: PropertyTreeNode = {
              key: nodeKey('staircase', composite),
              level: 'staircase',
              value: composite,
              label: s.name ?? composite,
              ancestors: buildingAncestors,
              typeCounts: aggregateTypeCounts(s),
            }
            return {
              node: staircaseNode,
              code: composite,
              searchText: [s.name, composite],
              row: {
                ...propertyContext,
                buildingCode: b.buildingCode,
                staircaseCode: s.code,
              },
              expandOnAll: false,
              children: leavesOf(staircaseNode, designation),
            }
          }),
        ],
      }
    })

    const parkingAreas = p.parkingAreas.map(
      (pa): WalkNode => ({
        node: {
          // Property-scoped: one physical parkeringsområde can be split
          // between two fastigheter, and then its code alone isn't unique.
          key: nodeKey('parkingArea', `${p.code}:${pa.code}`),
          level: 'parkingArea',
          value: pa.code,
          label: pa.name ?? pa.code,
          ancestors: propAncestors,
          typeCounts: parkingAreaTypeCounts(pa.parkingCount),
        },
        code: pa.code,
        searchText: [pa.name, pa.code],
        row: propertyContext,
        expandOnAll: false,
        children: [],
      })
    )

    return {
      node: propNode,
      code: p.code,
      searchText: [p.designation, p.tract, p.code],
      expandOnAll: false,
      children: [...buildings, ...parkingAreas],
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
      typeCounts: tree
        ? sumTypeCounts(groups.flatMap((g) => g.properties))
        : undefined,
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
              typeCounts: sumTypeCounts(g.properties),
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

const NO_KEYS: ReadonlySet<string> = new Set()

/** What the walk needs beyond the tree itself. An options object rather than
 * eight positional arguments: the flags are all booleans and sets, and at the
 * call site `false, query, expanded, collapsed, true` said nothing. */
export interface TreeRowOptions {
  query: string
  expanded: ReadonlySet<string>
  /** Draws the "Laddar..." row under a root whose tree is still arriving. */
  loading?: boolean
  /** Manual collapses that override auto-expansion (search / expand-all). */
  collapsed?: ReadonlySet<string>
  /** Header expand-all: opens the structural levels (tree data only). */
  expandAllStructure?: boolean
  /** The rental objects of this root, grouped by the node they hang under.
   * They join the walk tree, so searching an objektnummer works the same way
   * searching a byggnad does. */
  objectsByParent?: ReadonlyMap<string, RentalObject[]>
}

export function buildTreeRows(
  root: PropertyTreeRoot,
  tree: PropertyTree | undefined,
  {
    query,
    expanded,
    loading = false,
    collapsed = NO_KEYS,
    expandAllStructure = false,
    objectsByParent = NO_OBJECTS,
  }: TreeRowOptions
): RowSpec[] {
  const searchActive = query.length >= MIN_SEARCH_LENGTH
  const isOpen = (key: string, autoExpand: boolean) =>
    !collapsed.has(key) && (expanded.has(key) || autoExpand)

  // Through the cache: this runs per root per render, and the walk carries an
  // object leaf per rental object.
  const walk = tree
    ? walkTreeFor(root, tree, objectsByParent)
    : buildWalkTree(root, tree, objectsByParent)
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
        matched: a.selfMatch,
      })
      return
    }
    const autoExpand =
      (searchActive && a.anyChildVisible) ||
      (expandAllStructure && walk.expandOnAll)
    const isExpanded = isOpen(walk.node.key, autoExpand)

    rows.push({
      kind: 'node',
      node: walk.node,
      depth,
      expandable: true,
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
