import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { prisma } from './db'

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

export const getCostCenterTreeById = async (
  id: string
): Promise<CostCenterTree | null> => {
  const startedAt = Date.now()
  try {
    const costCenter = await prisma.onecoreCostCenter
      .findUnique({
        where: { id },
        include: {
          kvvAreas: {
            include: { propertyLinks: true },
          },
        },
      })
      .then(trimStrings)

    if (!costCenter) return null

    const propertyCodes = costCenter.kvvAreas.flatMap((area) =>
      area.propertyLinks.map((link) => link.propertyCode)
    )
    const uniqueCodes = Array.from(new Set(propertyCodes))
    const codesJson = JSON.stringify(uniqueCodes)

    const [
      properties,
      buildingRows,
      staircaseRows,
      buildingCountRows,
      parkingAreaRows,
      countRows,
    ] = await Promise.all([
        uniqueCodes.length === 0
          ? Promise.resolve(
              [] as Array<{
                code: string
                designation: string | null
                tract: string | null
              }>
            )
          : prisma.property
              .findMany({
                where: { code: { in: uniqueCodes } },
                select: { code: true, designation: true, tract: true },
              })
              .then(trimStrings),
        // Raw SQL + OPENJSON IN-list: Prisma's per-element parameter binding on
        // a 65-code IN(?,?,...) dominated wall-clock (3s → 388ms after this).
        // Do NOT "tidy" back into prisma.propertyStructure.findMany.
        uniqueCodes.length === 0
          ? Promise.resolve([] as BuildingRow[])
          : prisma.$queryRaw<BuildingRow[]>`
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
        uniqueCodes.length === 0
          ? Promise.resolve([] as StaircaseRow[])
          : prisma.$queryRaw<StaircaseRow[]>`
              SELECT
                s.fstcode AS propertyCode,
                s.bygcode AS buildingCode,
                s.vancode AS code,
                MAX(s.vancaption) AS name,
                COUNT(DISTINCT s.keyobjlgh) AS residenceCount,
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
        uniqueCodes.length === 0
          ? Promise.resolve([] as BuildingCountRow[])
          : prisma.$queryRaw<BuildingCountRow[]>`
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
        uniqueCodes.length === 0
          ? Promise.resolve([] as ParkingAreaRow[])
          : prisma.$queryRaw<ParkingAreaRow[]>`
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
        uniqueCodes.length === 0
          ? Promise.resolve([] as CountRow[])
          : prisma.$queryRaw<CountRow[]>`
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
      { id, ms: Date.now() - startedAt, properties: uniqueCodes.length },
      'cost-center-adapter.getCostCenterTreeById timing'
    )

    const propertyByCode = new Map(properties.map((p) => [p.code, p]))

    type StaircaseOut = {
      code: string
      name: string | null
      residenceCount: number
      facilityCount: number
      otherCount: number
    }
    // propertyCode → buildingCode → staircases
    const staircasesByBuilding = new Map<string, StaircaseOut[]>()
    for (const s of staircaseRows) {
      if (!s.propertyCode || !s.buildingCode || !s.code) continue
      const key = `${s.propertyCode}:${s.buildingCode}`
      const list = staircasesByBuilding.get(key) ?? []
      list.push({
        code: s.code,
        name: s.name ?? null,
        residenceCount: Number(s.residenceCount),
        facilityCount: Number(s.facilityCount),
        otherCount: Number(s.otherCount),
      })
      staircasesByBuilding.set(key, list)
    }

    const buildingCountsByBuilding = new Map(
      buildingCountRows.map((c) => [`${c.propertyCode}:${c.buildingCode}`, c])
    )

    type BuildingOut = {
      buildingCode: string
      buildingName: string | null
      buildingType: { code: string | null; name: string | null } | null
      staircases: StaircaseOut[]
      residenceCount: number
      parkingCount: number
      facilityCount: number
      otherCount: number
    }
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
      { code: string; name: string | null; parkingCount: number }[]
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

    return {
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      leadKeycloakUserId: costCenter.leadKeycloakUserId ?? null,
      deputyKeycloakUserId: costCenter.deputyKeycloakUserId ?? null,
      kvvAreas: costCenter.kvvAreas.map((area) => ({
        id: area.id,
        code: area.code,
        name: area.name ?? null,
        responsibleKeycloakUserId: area.responsibleKeycloakUserId ?? null,
        properties: area.propertyLinks.map((link) => {
          const prop = propertyByCode.get(link.propertyCode)
          const bld = buildingsByProperty.get(link.propertyCode)
          const cnt = countsByProperty.get(link.propertyCode)
          return {
            code: link.propertyCode,
            designation: prop?.designation ?? null,
            tract: prop?.tract ?? null,
            buildings: bld ? Array.from(bld.values()) : [],
            parkingAreas: parkingAreasByProperty.get(link.propertyCode) ?? [],
            aggregates: {
              residenceCount: cnt ? Number(cnt.residenceCount) : 0,
              parkingCount: cnt ? Number(cnt.parkingCount) : 0,
              entranceCount: cnt ? Number(cnt.entranceCount) : 0,
              facilityCount: cnt ? Number(cnt.facilityCount) : 0,
              otherCount: cnt ? Number(cnt.otherCount) : 0,
            },
          }
        }),
      })),
    }
  } catch (err) {
    logger.error({ err, id }, 'cost-center-adapter.getCostCenterTreeById')
    throw err
  }
}

// Tree cache (module-level, per-process). Cost center structure changes
// roughly monthly, so serving entries up to an hour stale is acceptable.
const TREE_CACHE_TTL_MS = 60 * 60 * 1000

const treeCache = new Map<
  string,
  { promise: Promise<CostCenterTree | null>; expiresAt: number }
>()

export const clearCostCenterTreeCache = (): void => {
  treeCache.clear()
}

// Caches the in-flight promise so concurrent misses share one DB round trip.
// Errors and not-found are evicted rather than cached: errors so a failure
// isn't served for an hour, nulls to keep the map bounded to real ids.
export const getCostCenterTreeByIdCached = (
  id: string
): Promise<CostCenterTree | null> => {
  const hit = treeCache.get(id)
  if (hit && hit.expiresAt > Date.now()) return hit.promise

  const promise = getCostCenterTreeById(id).then(
    (tree) => {
      if (tree === null) treeCache.delete(id)
      return tree
    },
    (err) => {
      treeCache.delete(id)
      throw err
    }
  )
  treeCache.set(id, { promise, expiresAt: Date.now() + TREE_CACHE_TTL_MS })
  return promise
}

export const listCostCenters = async (): Promise<CostCenterSummary[]> => {
  try {
    const rows = await prisma.onecoreCostCenter
      .findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      })
      .then(trimStrings)
    return rows
  } catch (err) {
    logger.error({ err }, 'cost-center-adapter.listCostCenters')
    throw err
  }
}
