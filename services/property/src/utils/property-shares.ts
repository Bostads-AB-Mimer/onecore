import type { CostCenterTreeProperty } from '@src/types/cost-center'
import type {
  PropertyTreeChildNode,
  PropertyTreeNode,
} from '@src/types/property-tree'

// Split properties (MIM-1997): a building can carry a KVV-area exception
// moving it out of its property's area. Membership then hands out SHARES of a
// property — the default area keeps everything but the excepted buildings
// (markyta stock and building-less objects included), each exception area
// gets exactly its buildings. Everything here is pure post-processing over
// the shared per-property cache, so no query changes per side.

/** Which buildings of a property one share covers. Absent = the whole property. */
export type BuildingSide =
  { include: ReadonlySet<string> } | { exclude: ReadonlySet<string> }

export type PropertyShare = {
  propertyCode: string
  buildings?: BuildingSide
}

export type KvvAreaExceptionRow = {
  kvvAreaId: string
  propertyCode: string
  code: string
}

type LinkedArea = { id: string; propertyCodes: string[] }

export const sideKeeps = (
  side: BuildingSide | undefined,
  buildingCode: string | null
): boolean => {
  if (!side) return true
  return 'include' in side
    ? buildingCode !== null && side.include.has(buildingCode)
    : buildingCode === null || !side.exclude.has(buildingCode)
}

const isPartial = (side: BuildingSide | undefined): boolean =>
  !!side && ('include' in side || side.exclude.size > 0)

/**
 * The shares each area holds, from its property links plus the exception rows
 * touching those areas or properties. A row pointing at the property's own
 * default area is a no-op. Inbound shares come after linked ones, sorted by
 * property code so the output is stable.
 */
export const resolvePropertyShares = (
  areas: LinkedArea[],
  exceptions: KvvAreaExceptionRow[]
): Map<string, PropertyShare[]> => {
  const linkedAreaByProperty = new Map<string, string>()
  for (const area of areas) {
    for (const code of area.propertyCodes)
      linkedAreaByProperty.set(code, area.id)
  }
  const areaIds = new Set(areas.map((area) => area.id))

  const excludedByProperty = new Map<string, Set<string>>()
  const inboundByArea = new Map<string, Map<string, Set<string>>>()
  for (const row of exceptions) {
    if (linkedAreaByProperty.get(row.propertyCode) === row.kvvAreaId) continue

    const excluded = excludedByProperty.get(row.propertyCode) ?? new Set()
    excluded.add(row.code)
    excludedByProperty.set(row.propertyCode, excluded)

    if (!areaIds.has(row.kvvAreaId)) continue
    const perArea = inboundByArea.get(row.kvvAreaId) ?? new Map()
    const buildings = perArea.get(row.propertyCode) ?? new Set<string>()
    buildings.add(row.code)
    perArea.set(row.propertyCode, buildings)
    inboundByArea.set(row.kvvAreaId, perArea)
  }

  return new Map(
    areas.map((area) => {
      const linked = area.propertyCodes.map((propertyCode): PropertyShare => {
        const exclude = excludedByProperty.get(propertyCode)
        return exclude
          ? { propertyCode, buildings: { exclude } }
          : { propertyCode }
      })
      const inbound = Array.from(inboundByArea.get(area.id) ?? [])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([propertyCode, include]): PropertyShare => ({
          propertyCode,
          buildings: { include },
        }))
      return [area.id, [...linked, ...inbound]]
    })
  )
}

/** Sum of the given buildings' counts; entrances are their trapphus. */
const sumBuildings = (buildings: CostCenterTreeProperty['buildings']) =>
  buildings.reduce(
    (acc, b) => ({
      residenceCount: acc.residenceCount + b.residenceCount,
      parkingCount: acc.parkingCount + b.parkingCount,
      entranceCount: acc.entranceCount + b.staircases.length,
      facilityCount: acc.facilityCount + b.facilityCount,
      otherCount: acc.otherCount + b.otherCount,
    }),
    {
      residenceCount: 0,
      parkingCount: 0,
      entranceCount: 0,
      facilityCount: 0,
      otherCount: 0,
    }
  )

/**
 * One share of a cached management-tree subtree. An include side is only its
 * buildings; an exclude side keeps the parkeringsområden and the property
 * totals minus the removed buildings (every object sits in at most one
 * building, so the counts are additive).
 */
export const splitPropertySubtree = (
  subtree: CostCenterTreeProperty,
  side: BuildingSide | undefined
): CostCenterTreeProperty => {
  if (!isPartial(side)) return subtree

  const kept = subtree.buildings.filter((b) => sideKeeps(side, b.buildingCode))
  const aggregates = (() => {
    if (side && 'include' in side) return sumBuildings(kept)
    const removed = sumBuildings(
      subtree.buildings.filter((b) => !sideKeeps(side, b.buildingCode))
    )
    const total = subtree.aggregates
    // entranceCount assumes every keyobjvan row has a vancode; a null one
    // would leave the remainder high by that entrance (data error in Xpand).
    return {
      residenceCount: total.residenceCount - removed.residenceCount,
      parkingCount: total.parkingCount - removed.parkingCount,
      entranceCount: total.entranceCount - removed.entranceCount,
      facilityCount: total.facilityCount - removed.facilityCount,
      otherCount: total.otherCount - removed.otherCount,
    }
  })()

  return {
    ...subtree,
    buildings: kept,
    parkingAreas: side && 'include' in side ? [] : subtree.parkingAreas,
    aggregates,
    partial: true,
  }
}

/** Same split over a uniform property-tree node: building children follow the
 * side, everything else (parkeringsområden, loose objects) is default-side. */
export const splitPropertyTreeNode = (
  node: PropertyTreeNode,
  side: BuildingSide | undefined
): PropertyTreeNode => {
  if (!isPartial(side)) return node

  const keeps = (child: PropertyTreeChildNode) =>
    child.type === 'building'
      ? sideKeeps(side, child.code)
      : sideKeeps(side, null)

  return {
    ...node,
    children: (node.children ?? []).filter(keeps),
    partial: true,
  }
}
