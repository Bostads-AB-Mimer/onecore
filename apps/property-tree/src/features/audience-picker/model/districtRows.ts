// Pure row-flattening for the picker tree: which rows of a district are
// visible given manual expansion and the active search query, and how search
// filters branches and auto-expands down to the deepest matching level.

import type {
  CostCenterSummary,
  CostCenterTree,
  CostCenterTreeBuilding,
  CostCenterTreeProperty,
} from '../hooks/useAudienceTreeData'
import type { AudienceNode, AudienceObjectType, ParentInfo } from './selection'
import { nodeExcludedByTypes, nodeKey } from './selection'

export const MIN_SEARCH_LENGTH = 2

type TypeCounts = Record<AudienceObjectType, number>

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
  properties: { aggregates: CostCenterTreeProperty['aggregates'] }[]
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

const staircaseTypeCounts = (
  s: CostCenterTreeBuilding['staircases'][number]
): TypeCounts => ({
  residence: s.residenceCount,
  parkingSpace: 0,
  facility: s.facilityCount,
  other: s.otherCount,
})

const parkingAreaTypeCounts = (parkingCount: number): TypeCounts => ({
  residence: 0,
  parkingSpace: parkingCount,
  facility: 0,
  other: 0,
})

export interface NodeRowSpec {
  kind: 'node'
  node: AudienceNode
  depth: number
  expandable: boolean
  expanded: boolean
  loading?: boolean
  code: string
  count?: number
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

/** Marker for the property-level object groups (bilplatser without building). */
export interface PropertyExtrasSpec {
  kind: 'propertyExtras'
  key: string
  propertyCode: string
  /** The property node — parent of these objects, same pattern as
   * buildingNode/parkingAreaNode further down the tree. */
  propertyNode: AudienceNode
  depth: number
}

/** Marker for a building's staircase-less object groups (bilplatser/lokaler). */
export interface BuildingExtrasSpec {
  kind: 'buildingExtras'
  key: string
  buildingNode: AudienceNode
  propertyCode: string
  propertyDesignation: string
  depth: number
  /** Trapphus rows precede these; when true the category header is kept so
   * loose objects don't sit at the same level as the trapphus. */
  hasStaircases: boolean
}

export type RowSpec = NodeRowSpec | PropertyExtrasSpec | BuildingExtrasSpec

const matches = (q: string, ...parts: (string | null | undefined)[]) =>
  parts.some((p) => p?.toLowerCase().includes(q))

const staircaseComposite = (buildingCode: string, staircaseCode: string) =>
  `${buildingCode}-${staircaseCode}`

/** KVV-areas are known by their responsible person; the code is already shown
 * in the Kod column. Display only — the stored criterion is always the code. */
export const kvvAreaLabel = (
  kvv: CostCenterTree['kvvAreas'][number]
): string => {
  const responsible = [kvv.responsible?.firstName, kvv.responsible?.lastName]
    .filter(Boolean)
    .join(' ')
  return responsible || kvv.name || kvv.code
}

// Node builders shared by findParentInfo and collectDescendantNodes; take
// their ancestor context explicitly.
const kvvNodeOf = (
  districtKey: string,
  kvv: CostCenterTree['kvvAreas'][number]
): AudienceNode => ({
  key: nodeKey('kvvArea', kvv.code),
  level: 'kvvArea',
  value: kvv.code,
  label: kvvAreaLabel(kvv),
  ancestors: [districtKey],
  typeCounts: sumTypeCounts(kvv.properties),
})

const propNodeOf = (
  districtKey: string,
  kvvKey: string,
  p: CostCenterTreeProperty
): AudienceNode => ({
  key: nodeKey('property', p.code),
  level: 'property',
  value: p.designation ?? p.code,
  label: p.designation ?? p.code,
  ancestors: [districtKey, kvvKey],
  typeCounts: aggregateTypeCounts(p.aggregates),
})

const buildingNodeOf = (
  propAncestors: string[],
  b: CostCenterTreeBuilding
): AudienceNode => ({
  key: nodeKey('building', b.buildingCode),
  level: 'building',
  value: b.buildingCode,
  label: b.buildingName ?? b.buildingCode,
  ancestors: propAncestors,
  typeCounts: aggregateTypeCounts(b),
})

const staircaseNodeOf = (
  buildingAncestors: string[],
  buildingCode: string,
  s: CostCenterTreeBuilding['staircases'][number]
): AudienceNode => {
  const composite = staircaseComposite(buildingCode, s.code)
  return {
    key: nodeKey('staircase', composite),
    level: 'staircase',
    value: composite,
    label: s.name ?? composite,
    ancestors: buildingAncestors,
    typeCounts: staircaseTypeCounts(s),
  }
}

const parkingAreaNodeOf = (
  propAncestors: string[],
  pa: CostCenterTreeProperty['parkingAreas'][number]
): AudienceNode => ({
  key: nodeKey('parkingArea', pa.code),
  level: 'parkingArea',
  value: pa.code,
  label: pa.name ?? pa.code,
  ancestors: propAncestors,
  typeCounts: parkingAreaTypeCounts(pa.parkingCount),
})

/**
 * Resolve a parent node and its full child-key list by key, for selection
 * roll-up. All selectable levels (incl. a building's trapphus) live in the
 * tree, so this is a pure tree walk. Apartment→trapphus roll-up (MIM-1924)
 * will extend the panel's resolver with object data instead.
 */
export function findParentInfo(
  district: CostCenterSummary,
  tree: CostCenterTree,
  parentKey: string
): ParentInfo | undefined {
  const districtKey = nodeKey('district', district.code)
  const kvvNode = (kvv: CostCenterTree['kvvAreas'][number]) =>
    kvvNodeOf(districtKey, kvv)
  const propNode = (p: CostCenterTreeProperty, kvvKey: string) =>
    propNodeOf(districtKey, kvvKey, p)
  const buildingNode = (b: CostCenterTreeBuilding, propAncestors: string[]) =>
    buildingNodeOf(propAncestors, b)

  if (parentKey === districtKey) {
    return {
      node: {
        key: districtKey,
        level: 'district',
        value: district.name,
        label: district.name,
        ancestors: [],
        typeCounts: sumTypeCounts(tree.kvvAreas.flatMap((k) => k.properties)),
      },
      children: tree.kvvAreas.map(kvvNode),
    }
  }
  for (const kvv of tree.kvvAreas) {
    const kvvKey = nodeKey('kvvArea', kvv.code)
    if (parentKey === kvvKey) {
      return {
        node: kvvNode(kvv),
        children: kvv.properties.map((p) => propNode(p, kvvKey)),
      }
    }
    for (const p of kvv.properties) {
      const propKey = nodeKey('property', p.code)
      const propAncestors = [districtKey, kvvKey, propKey]
      if (parentKey === propKey) {
        return {
          node: propNode(p, kvvKey),
          children: [
            ...p.buildings.map((b) => buildingNode(b, propAncestors)),
            ...p.parkingAreas.map((pa) => parkingAreaNodeOf(propAncestors, pa)),
          ],
        }
      }
      for (const b of p.buildings) {
        const buildingKey = nodeKey('building', b.buildingCode)
        if (parentKey !== buildingKey) continue
        return {
          node: buildingNode(b, propAncestors),
          children: b.staircases.map((s) =>
            staircaseNodeOf([...propAncestors, buildingKey], b.buildingCode, s)
          ),
        }
      }
    }
  }
  return undefined
}

/** Hard ceiling for one apply's total criteria (selection + descendants). */
export const MAX_EXPANDED_CRITERIA = 250

/**
 * All descendant tree nodes beneath `parentKey` ("inkludera underliggande
 * nivåer"), pruned by the type filter — a child with no objects of the
 * active types is skipped. Returns undefined when the key isn't in this
 * district's tree (caller tries the next district). Trapphus/parkeringsområden
 * are leaves — callers skip them instead of calling this.
 */
export function collectDescendantNodes(
  district: CostCenterSummary,
  tree: CostCenterTree,
  parentKey: string,
  activeTypes: ReadonlySet<AudienceObjectType>
): AudienceNode[] | undefined {
  const districtKey = nodeKey('district', district.code)
  const out: AudienceNode[] = []
  const push = (node: AudienceNode) => {
    if (!nodeExcludedByTypes(node, activeTypes)) out.push(node)
  }
  const underBuilding = (
    b: CostCenterTreeBuilding,
    propAncestors: string[]
  ) => {
    const ancestors = [...propAncestors, nodeKey('building', b.buildingCode)]
    for (const s of b.staircases) {
      push(staircaseNodeOf(ancestors, b.buildingCode, s))
    }
  }
  const underProperty = (p: CostCenterTreeProperty, kvvKey: string) => {
    const propAncestors = [districtKey, kvvKey, nodeKey('property', p.code)]
    for (const b of p.buildings) {
      push(buildingNodeOf(propAncestors, b))
      underBuilding(b, propAncestors)
    }
    for (const pa of p.parkingAreas) push(parkingAreaNodeOf(propAncestors, pa))
  }
  const underKvv = (kvv: CostCenterTree['kvvAreas'][number]) => {
    const kvvKey = nodeKey('kvvArea', kvv.code)
    for (const p of kvv.properties) {
      push(propNodeOf(districtKey, kvvKey, p))
      underProperty(p, kvvKey)
    }
  }

  if (parentKey === districtKey) {
    for (const kvv of tree.kvvAreas) {
      push(kvvNodeOf(districtKey, kvv))
      underKvv(kvv)
    }
    return out
  }
  for (const kvv of tree.kvvAreas) {
    if (parentKey === nodeKey('kvvArea', kvv.code)) {
      underKvv(kvv)
      return out
    }
    const kvvKey = nodeKey('kvvArea', kvv.code)
    for (const p of kvv.properties) {
      if (parentKey === nodeKey('property', p.code)) {
        underProperty(p, kvvKey)
        return out
      }
      for (const b of p.buildings) {
        if (parentKey === nodeKey('building', b.buildingCode)) {
          underBuilding(b, [districtKey, kvvKey, nodeKey('property', p.code)])
          return out
        }
      }
    }
  }
  return undefined
}

interface BuildingResult {
  building: CostCenterTreeBuilding
  selfMatch: boolean
  matchingStaircases: CostCenterTreeBuilding['staircases']
}

const NO_KEYS: ReadonlySet<string> = new Set()

export function buildDistrictRows(
  district: CostCenterSummary,
  tree: CostCenterTree | undefined,
  loading: boolean,
  q: string,
  expanded: ReadonlySet<string>,
  /** Manual collapses that override auto-expansion (search / expand-all). */
  collapsed: ReadonlySet<string> = NO_KEYS,
  /** Header expand-all: opens district + kvv levels (tree data only). */
  expandAllStructure = false
): RowSpec[] {
  const searchActive = q.length >= MIN_SEARCH_LENGTH
  const isOpen = (key: string, autoExpand: boolean) =>
    !collapsed.has(key) && (expanded.has(key) || autoExpand)
  const districtKey = nodeKey('district', district.code)
  const districtNode: AudienceNode = {
    key: districtKey,
    level: 'district',
    value: district.name,
    label: district.name,
    ancestors: [],
    typeCounts: tree
      ? sumTypeCounts(tree.kvvAreas.flatMap((k) => k.properties))
      : undefined,
  }

  const kvvResults = (tree?.kvvAreas ?? []).map((kvv) => {
    const kvvKey = nodeKey('kvvArea', kvv.code)
    const propResults = kvv.properties.map((p) => {
      const propKey = nodeKey('property', p.code)
      const buildingResults: BuildingResult[] = p.buildings.map((b) => ({
        building: b,
        // Type is shown in the Typ column, so it's searchable too ("garage").
        selfMatch:
          searchActive &&
          matches(q, b.buildingName, b.buildingCode, b.buildingType?.name),
        matchingStaircases: searchActive
          ? b.staircases.filter((s) =>
              matches(q, s.name, staircaseComposite(b.buildingCode, s.code))
            )
          : [],
      }))
      const visibleBuildings = buildingResults.filter(
        (r) => r.selfMatch || r.matchingStaircases.length > 0
      )
      const matchingParkingAreas = searchActive
        ? p.parkingAreas.filter((pa) => matches(q, pa.name, pa.code))
        : []
      const selfMatch =
        searchActive && matches(q, p.designation, p.tract, p.code)
      return {
        property: p,
        key: propKey,
        selfMatch,
        buildingResults,
        visibleBuildings,
        matchingParkingAreas,
        visible:
          !searchActive ||
          selfMatch ||
          visibleBuildings.length > 0 ||
          matchingParkingAreas.length > 0,
      }
    })
    // Includes the label so searching the responsible's name finds the area.
    const selfMatch =
      searchActive && matches(q, kvvAreaLabel(kvv), kvv.name, kvv.code)
    const anyPropVisible = propResults.some((r) => r.visible)
    return {
      kvv,
      key: kvvKey,
      selfMatch,
      propResults,
      visible: !searchActive || selfMatch || (searchActive && anyPropVisible),
    }
  })

  const districtMatch = searchActive && matches(q, district.name, district.code)
  const anyKvvVisible = searchActive && kvvResults.some((r) => r.visible)
  if (searchActive && !districtMatch && !anyKvvVisible) return []

  const rows: RowSpec[] = []
  const treeResidences = (tree?.kvvAreas ?? []).reduce(
    (sum, a) =>
      sum + a.properties.reduce((s, p) => s + p.aggregates.residenceCount, 0),
    0
  )

  const districtAutoExpand =
    (searchActive && anyKvvVisible) || expandAllStructure
  const districtExpanded = isOpen(districtKey, districtAutoExpand)
  rows.push({
    kind: 'node',
    node: districtNode,
    depth: 0,
    expandable: true,
    expanded: districtExpanded,
    loading: districtExpanded && loading,
    code: district.code,
    count: tree ? treeResidences : undefined,
    matched: districtMatch,
  })
  if (!districtExpanded || !tree) return rows

  for (const kvvResult of kvvResults) {
    // Under a matched district with no deeper matches, show the full subtree.
    const showAllUnderDistrict = searchActive && districtMatch && !anyKvvVisible
    if (searchActive && !kvvResult.visible && !showAllUnderDistrict) continue

    const { kvv, key: kvvKey } = kvvResult
    const kvvNode: AudienceNode = {
      key: kvvKey,
      level: 'kvvArea',
      value: kvv.code,
      label: kvvAreaLabel(kvv),
      ancestors: [districtKey],
      typeCounts: sumTypeCounts(kvv.properties),
    }
    const visibleProps = kvvResult.propResults.filter((r) => r.visible)
    const kvvAutoExpand =
      searchActive &&
      kvvResult.propResults.some(
        (r) =>
          r.selfMatch ||
          r.visibleBuildings.length > 0 ||
          r.matchingParkingAreas.length > 0
      )
    const kvvExpanded = isOpen(kvvKey, kvvAutoExpand || expandAllStructure)
    rows.push({
      kind: 'node',
      node: kvvNode,
      depth: 1,
      expandable: true,
      expanded: kvvExpanded,
      code: kvv.code,
      count: kvv.properties.reduce(
        (s, p) => s + p.aggregates.residenceCount,
        0
      ),
      matched: kvvResult.selfMatch,
    })
    if (!kvvExpanded) continue

    // A branch whose match sits at this level or above expands to everything
    // beneath it; otherwise only matching sub-branches are shown.
    const propsToShow =
      !searchActive ||
      showAllUnderDistrict ||
      (visibleProps.length === 0 && kvvResult.selfMatch)
        ? kvvResult.propResults
        : visibleProps

    for (const propResult of propsToShow) {
      pushPropertyRows(rows, propResult, kvvNode, isOpen, searchActive)
    }
  }
  return rows
}

function pushPropertyRows(
  rows: RowSpec[],
  propResult: {
    property: CostCenterTreeProperty
    key: string
    selfMatch: boolean
    buildingResults: BuildingResult[]
    visibleBuildings: BuildingResult[]
    matchingParkingAreas: CostCenterTreeProperty['parkingAreas']
  },
  kvvNode: AudienceNode,
  isOpen: (key: string, autoExpand: boolean) => boolean,
  searchActive: boolean
) {
  const { property: p, key: propKey } = propResult
  const designation = p.designation ?? p.code
  const propNode: AudienceNode = {
    key: propKey,
    level: 'property',
    value: designation,
    label: designation,
    ancestors: [...kvvNode.ancestors, kvvNode.key],
    typeCounts: aggregateTypeCounts(p.aggregates),
  }
  const childMatches =
    propResult.visibleBuildings.length > 0 ||
    propResult.matchingParkingAreas.length > 0
  const propExpanded = isOpen(propKey, searchActive && childMatches)
  rows.push({
    kind: 'node',
    node: propNode,
    depth: 2,
    expandable: true,
    expanded: propExpanded,
    code: p.code,
    count: p.aggregates.residenceCount,
    matched: propResult.selfMatch,
  })
  if (!propExpanded) return

  // When the search matched specific children, show only those; a match on
  // the property itself (or no search) shows everything beneath it.
  const buildingsToShow =
    searchActive && childMatches
      ? propResult.visibleBuildings
      : propResult.buildingResults
  const parkingAreasToShow =
    searchActive && childMatches
      ? propResult.matchingParkingAreas
      : p.parkingAreas
  const matchedParkingAreas = new Set(propResult.matchingParkingAreas)

  for (const br of buildingsToShow) {
    const b = br.building
    const buildingKey = nodeKey('building', b.buildingCode)
    const buildingNode: AudienceNode = {
      key: buildingKey,
      level: 'building',
      value: b.buildingCode,
      label: b.buildingName ?? b.buildingCode,
      ancestors: [...propNode.ancestors, propNode.key],
      typeCounts: aggregateTypeCounts(b),
    }
    const buildingAutoExpand = searchActive && br.matchingStaircases.length > 0
    const buildingExpanded = isOpen(buildingKey, buildingAutoExpand)
    rows.push({
      kind: 'node',
      node: buildingNode,
      depth: 3,
      expandable: true,
      expanded: buildingExpanded,
      code: b.buildingCode,
      typeLabel: b.buildingType?.name ?? undefined,
      matched: br.selfMatch,
      propertyCode: p.code,
      propertyDesignation: designation,
    })
    if (!buildingExpanded) continue

    const staircasesToShow =
      searchActive && br.matchingStaircases.length > 0
        ? br.matchingStaircases
        : b.staircases
    const matchedStaircases = new Set(br.matchingStaircases)

    for (const s of staircasesToShow) {
      const composite = staircaseComposite(b.buildingCode, s.code)
      rows.push({
        kind: 'node',
        node: {
          key: nodeKey('staircase', composite),
          level: 'staircase',
          value: composite,
          label: s.name ?? composite,
          ancestors: [...buildingNode.ancestors, buildingNode.key],
          typeCounts: staircaseTypeCounts(s),
        },
        depth: 4,
        // Trapphus expand into their objects (display-only rows).
        expandable: true,
        expanded: isOpen(nodeKey('staircase', composite), false),
        code: composite,
        count: s.residenceCount + s.facilityCount + s.otherCount,
        matched: matchedStaircases.has(s),
        propertyCode: p.code,
        propertyDesignation: designation,
        buildingCode: b.buildingCode,
        staircaseCode: s.code,
      })
    }

    // The building's staircase-less object groups (bilplatser/lokaler).
    // Skipped during search — same object-lookup guard as propertyExtras.
    if (!searchActive) {
      rows.push({
        kind: 'buildingExtras',
        key: `bextras:${buildingKey}`,
        buildingNode,
        propertyCode: p.code,
        propertyDesignation: designation,
        depth: 4,
        hasStaircases: b.staircases.length > 0,
      })
    }
  }

  for (const pa of parkingAreasToShow) {
    const parkingAreaKey = nodeKey('parkingArea', pa.code)
    rows.push({
      kind: 'node',
      node: {
        key: parkingAreaKey,
        level: 'parkingArea',
        value: pa.code,
        label: pa.name ?? pa.code,
        ancestors: [...propNode.ancestors, propNode.key],
        typeCounts: parkingAreaTypeCounts(pa.parkingCount),
      },
      depth: 3,
      // Parking areas expand into their spaces (display-only rows).
      expandable: true,
      expanded: isOpen(parkingAreaKey, false),
      code: pa.code,
      count: pa.parkingCount,
      matched: matchedParkingAreas.has(pa),
      propertyCode: p.code,
      propertyDesignation: designation,
    })
  }

  // Property-level object groups (objects with neither building nor parking
  // area). Skipped during search to avoid firing object lookups for every
  // matched property.
  if (!searchActive) {
    rows.push({
      kind: 'propertyExtras',
      key: `extras:${propKey}`,
      propertyCode: p.code,
      propertyNode: propNode,
      depth: 3,
    })
  }
}
