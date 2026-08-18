import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterTreeProperty } from '@src/types/cost-center'
import type { RentalObjectSummary } from '@src/types/rental-object'

import { prisma } from './db'
import { getRentalObjectsByPropertyCodes } from './rental-object-adapter'

// Everything below the property level of a property tree: buildings (with
// their trapphus and per-type counts), parkeringsområden and the property's
// own aggregates. Shared by every grouping — cost center, marknadsområde,
// företag — since only the levels ABOVE property differ between them.

type BuildingRow = {
  propertyCode: string
  buildingCode: string
  buildingName: string | null
  buildingTypeCode: string | null
  buildingTypeName: string | null
}

type CountRow = {
  propertyCode: string
  residenceCount: number | bigint
  parkingCount: number | bigint
  entranceCount: number | bigint
  facilityCount: number | bigint
  otherCount: number | bigint
}

type ParkingAreaRow = {
  propertyCode: string
  code: string
  name: string | null
  parkingCount: number | bigint
}

type StaircaseRow = {
  propertyCode: string
  buildingCode: string
  code: string
  name: string | null
  residenceCount: number | bigint
  parkingCount: number | bigint
  facilityCount: number | bigint
  otherCount: number | bigint
}

type BuildingCountRow = {
  propertyCode: string
  buildingCode: string
  residenceCount: number | bigint
  parkingCount: number | bigint
  facilityCount: number | bigint
  otherCount: number | bigint
}

const emptyProperty = (code: string): CostCenterTreeProperty => ({
  code,
  designation: null,
  tract: null,
  buildings: [],
  parkingAreas: [],
  aggregates: {
    residenceCount: 0,
    parkingCount: 0,
    entranceCount: 0,
    facilityCount: 0,
    otherCount: 0,
  },
})

const fetchPropertySubtrees = async (
  uniqueCodes: string[]
): Promise<Map<string, CostCenterTreeProperty>> => {
  const out = new Map<string, CostCenterTreeProperty>()
  const startedAt = Date.now()
  const codesJson = JSON.stringify(uniqueCodes)

  try {
    const [
      properties,
      buildingRows,
      staircaseRows,
      buildingCountRows,
      parkingAreaRows,
      countRows,
    ] = await Promise.all([
      // findMany stays here despite the warning below: bafst.code is unique
      // and indexed, so each bound element is one seek. What made the babuf
      // queries slow was the row volume behind each element, not the binding.
      prisma.property
        .findMany({
          where: { code: { in: uniqueCodes } },
          select: { code: true, designation: true, tract: true },
        })
        .then(trimStrings),
      // Raw SQL + OPENJSON IN-list: Prisma's per-element parameter binding on
      // a 65-code IN(?,?,...) dominated wall-clock (3s → 388ms after this).
      // Do NOT "tidy" back into prisma.propertyStructure.findMany.
      prisma.$queryRaw<BuildingRow[]>`
        SELECT DISTINCT
          s.fstcode     AS propertyCode,
          s.bygcode     AS buildingCode,
          s.bygcaption  AS buildingName,
          t.code        AS buildingTypeCode,
          t.caption     AS buildingTypeName
        FROM dbo.babuf s
        LEFT JOIN dbo.babyg b ON b.keycmobj = s.keyobjbyg
        LEFT JOIN dbo.babyt t ON t.keybabyt = b.keybabyt
        WHERE s.fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
          AND s.deletemark = 0
          AND s.bygcode IS NOT NULL
      `.then(trimStrings),
      // Trapphus (vancode) per building, with per-type object counts.
      // Parking is counted too: the '99' catch-all code is where a building's
      // entrance-less parking hangs, and without it those rows show zero.
      prisma.$queryRaw<StaircaseRow[]>`
        SELECT
          s.fstcode AS propertyCode,
          s.bygcode AS buildingCode,
          s.vancode AS code,
          MAX(s.vancaption) AS name,
          COUNT(DISTINCT s.keyobjlgh) AS residenceCount,
          COUNT(DISTINCT s.keyobjbps) AS parkingCount,
          COUNT(DISTINCT s.keyobjlok) AS facilityCount,
          COUNT(DISTINCT s.keyobjhyr) AS otherCount
        FROM dbo.babuf s
        WHERE s.fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
          AND s.deletemark = 0
          AND s.bygcode IS NOT NULL
          AND s.vancode IS NOT NULL
        GROUP BY s.fstcode, s.bygcode, s.vancode
      `.then(trimStrings),
      // Per-type object counts per building (covers staircase-less objects
      // too — the staircase query above misses those).
      prisma.$queryRaw<BuildingCountRow[]>`
        SELECT
          s.fstcode AS propertyCode,
          s.bygcode AS buildingCode,
          COUNT(DISTINCT s.keyobjlgh) AS residenceCount,
          COUNT(DISTINCT s.keyobjbps) AS parkingCount,
          COUNT(DISTINCT s.keyobjlok) AS facilityCount,
          COUNT(DISTINCT s.keyobjhyr) AS otherCount
        FROM dbo.babuf s
        WHERE s.fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
          AND s.deletemark = 0
          AND s.bygcode IS NOT NULL
        GROUP BY s.fstcode, s.bygcode
      `.then(trimStrings),
      // Markområden (bayta) containing parking spaces — the parking sibling
      // of the buildings query above.
      prisma.$queryRaw<ParkingAreaRow[]>`
        SELECT
          s.fstcode AS propertyCode,
          s.ytacode AS code,
          MAX(s.ytacaption) AS name,
          COUNT(DISTINCT s.keyobjbps) AS parkingCount
        FROM dbo.babuf s
        WHERE s.fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
          AND s.deletemark = 0
          AND s.ytacode IS NOT NULL
          AND s.keyobjbps IS NOT NULL
        GROUP BY s.fstcode, s.ytacode
      `.then(trimStrings),
      prisma.$queryRaw<CountRow[]>`
        SELECT
          fstcode AS propertyCode,
          COUNT(DISTINCT keyobjlgh) AS residenceCount,
          COUNT(DISTINCT keyobjbps) AS parkingCount,
          COUNT(DISTINCT keyobjvan) AS entranceCount,
          COUNT(DISTINCT keyobjlok) AS facilityCount,
          COUNT(DISTINCT keyobjhyr) AS otherCount
        FROM dbo.babuf
        WHERE fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
          AND deletemark = 0
        GROUP BY fstcode
      `.then(trimStrings),
    ])

    logger.info(
      { ms: Date.now() - startedAt, properties: uniqueCodes.length },
      'property-subtree-adapter.buildPropertySubtrees timing'
    )

    const propertyByCode = new Map(properties.map((p) => [p.code, p]))

    type BuildingOut = CostCenterTreeProperty['buildings'][number]
    type StaircaseOut = BuildingOut['staircases']

    // propertyCode:buildingCode → staircases
    const staircasesByBuilding = new Map<string, StaircaseOut>()
    for (const s of staircaseRows) {
      if (!s.propertyCode || !s.buildingCode || !s.code) continue
      const key = `${s.propertyCode}:${s.buildingCode}`
      const list = staircasesByBuilding.get(key) ?? []
      list.push({
        code: s.code,
        name: s.name ?? null,
        residenceCount: Number(s.residenceCount),
        parkingCount: Number(s.parkingCount),
        facilityCount: Number(s.facilityCount),
        otherCount: Number(s.otherCount),
      })
      staircasesByBuilding.set(key, list)
    }

    const buildingCountsByBuilding = new Map(
      buildingCountRows.map((c) => [`${c.propertyCode}:${c.buildingCode}`, c])
    )

    const buildingsByProperty = new Map<string, Map<string, BuildingOut>>()
    for (const b of buildingRows) {
      if (!b.propertyCode || !b.buildingCode) continue
      let perProp = buildingsByProperty.get(b.propertyCode)
      if (!perProp) {
        perProp = new Map()
        buildingsByProperty.set(b.propertyCode, perProp)
      }
      if (!perProp.has(b.buildingCode)) {
        const key = `${b.propertyCode}:${b.buildingCode}`
        const counts = buildingCountsByBuilding.get(key)
        perProp.set(b.buildingCode, {
          buildingCode: b.buildingCode,
          buildingName: b.buildingName ?? null,
          buildingType:
            b.buildingTypeCode !== null || b.buildingTypeName !== null
              ? {
                  code: b.buildingTypeCode ?? null,
                  name: b.buildingTypeName ?? null,
                }
              : null,
          staircases: staircasesByBuilding.get(key) ?? [],
          residenceCount: counts ? Number(counts.residenceCount) : 0,
          parkingCount: counts ? Number(counts.parkingCount) : 0,
          facilityCount: counts ? Number(counts.facilityCount) : 0,
          otherCount: counts ? Number(counts.otherCount) : 0,
        })
      }
    }

    const parkingAreasByProperty = new Map<
      string,
      CostCenterTreeProperty['parkingAreas']
    >()
    for (const pa of parkingAreaRows) {
      if (!pa.propertyCode || !pa.code) continue
      const list = parkingAreasByProperty.get(pa.propertyCode) ?? []
      list.push({
        code: pa.code,
        name: pa.name ?? null,
        parkingCount: Number(pa.parkingCount),
      })
      parkingAreasByProperty.set(pa.propertyCode, list)
    }

    const countsByProperty = new Map(countRows.map((c) => [c.propertyCode, c]))

    for (const code of uniqueCodes) {
      const prop = propertyByCode.get(code)
      const bld = buildingsByProperty.get(code)
      const cnt = countsByProperty.get(code)
      out.set(code, {
        code,
        designation: prop?.designation ?? null,
        tract: prop?.tract ?? null,
        buildings: bld ? Array.from(bld.values()) : [],
        parkingAreas: parkingAreasByProperty.get(code) ?? [],
        aggregates: {
          residenceCount: cnt ? Number(cnt.residenceCount) : 0,
          parkingCount: cnt ? Number(cnt.parkingCount) : 0,
          entranceCount: cnt ? Number(cnt.entranceCount) : 0,
          facilityCount: cnt ? Number(cnt.facilityCount) : 0,
          otherCount: cnt ? Number(cnt.otherCount) : 0,
        },
      })
    }
    return out
  } catch (err) {
    logger.error(
      { err, properties: uniqueCodes.length },
      'property-subtree-adapter.fetchPropertySubtrees'
    )
    throw err
  }
}

// Per-property cache. Keyed by property code rather than by tree, so every
// grouping (cost center, marknadsområde, företag) shares the same entries —
// the second view over the same stock costs nothing. Xpand structure changes
// perhaps yearly, so an hour stale is acceptable.
const SUBTREE_CACHE_TTL_MS = 60 * 60 * 1000

// Both halves of a property share one entry: the structure the tree renders,
// and every rental object under it (clients filter and count those locally).
// One refresh fills both, but each is awaited on its own — the tree must not
// wait for the object query.
interface PropertyCacheEntry {
  subtree: Promise<CostCenterTreeProperty>
  objects: Promise<RentalObjectSummary[]>
  expiresAt: number
}

const subtreeCache = new Map<string, PropertyCacheEntry>()

export const clearPropertySubtreeCache = (): void => {
  subtreeCache.clear()
}

/**
 * Make sure every code has a live entry, refreshing the whole requested set in
 * one round when any of them is missing or stale (see buildPropertySubtrees).
 */
const ensureCached = (uniqueCodes: string[], now: number): void => {
  const needsRefresh = uniqueCodes.some((code) => {
    const hit = subtreeCache.get(code)
    return !hit || hit.expiresAt <= now
  })
  if (!needsRefresh) return

  // One shared batch per half; each code reads its own entry out of them, so
  // concurrent callers with overlapping sets share the round trips.
  const subtreeBatch = fetchPropertySubtrees(uniqueCodes)
  const objectBatch = getRentalObjectsByPropertyCodes(uniqueCodes).then(
    (rows) => {
      const byProperty = new Map<string, RentalObjectSummary[]>()
      for (const row of rows) {
        if (!row.propertyCode) continue
        const list = byProperty.get(row.propertyCode) ?? []
        list.push(row)
        byProperty.set(row.propertyCode, list)
      }
      return byProperty
    }
  )
  // A tree-only request awaits neither object promise, so an object query that
  // rejects would surface as an unhandled rejection and take the process down.
  subtreeBatch.catch(() => undefined)
  objectBatch.catch(() => undefined)

  const expiresAt = now + SUBTREE_CACHE_TTL_MS
  for (const code of uniqueCodes) {
    // Don't cache failures — the next request should retry.
    const onError = (err: unknown) => {
      subtreeCache.delete(code)
      throw err
    }
    const subtree = subtreeBatch.then(
      (m) => m.get(code) ?? emptyProperty(code),
      onError
    )
    const objects = objectBatch.then((m) => m.get(code) ?? [], onError)
    subtree.catch(() => undefined)
    objects.catch(() => undefined)
    subtreeCache.set(code, { subtree, objects, expiresAt })
  }
}

/**
 * Build the property-and-below part of a tree for the given property codes,
 * serving cached entries where possible. Returns one entry per requested code.
 *
 * Refresh is batched: if ANY requested code is missing or stale the whole
 * requested set is refetched in one round of queries and given a common new
 * expiry. Six queries over 60 codes cost about the same as over 2, so topping
 * up individually would trade one cheap refresh for many nearly-as-expensive
 * ones — and rewriting every expiry together keeps sets from fragmenting into
 * a state where something is always slightly stale.
 */
export const buildPropertySubtrees = async (
  propertyCodes: string[]
): Promise<Map<string, CostCenterTreeProperty>> => {
  const uniqueCodes = Array.from(new Set(propertyCodes))
  const out = new Map<string, CostCenterTreeProperty>()
  if (uniqueCodes.length === 0) return out

  ensureCached(uniqueCodes, Date.now())

  await Promise.all(
    uniqueCodes.map(async (code) => {
      const hit = subtreeCache.get(code)
      out.set(code, hit ? await hit.subtree : emptyProperty(code))
    })
  )
  return out
}

/**
 * Every rental object of the given properties, from the same cache and the
 * same refresh as the subtrees above. Flat and rental-id ordered per property:
 * the client groups them itself.
 */
export const buildPropertyObjects = async (
  propertyCodes: string[]
): Promise<RentalObjectSummary[]> => {
  const uniqueCodes = Array.from(new Set(propertyCodes))
  if (uniqueCodes.length === 0) return []

  ensureCached(uniqueCodes, Date.now())

  const perProperty = await Promise.all(
    uniqueCodes.map(async (code) => {
      const hit = subtreeCache.get(code)
      return hit ? await hit.objects : []
    })
  )
  return perProperty.flat()
}
