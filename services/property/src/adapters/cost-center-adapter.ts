import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { prisma } from './db'

type AddressRow = {
  propertyCode: string
  buildingCode: string
  buildingName: string | null
  buildingTypeCode: string | null
  buildingTypeName: string | null
}

type CountRow = {
  propertyCode: string
  buildingCode: string | null
  residenceCount: number | bigint
  parkingCount: number | bigint
  entranceCount: number | bigint
}

/** Which buildings of a property one tree node covers: an exception area gets
 * exactly its excepted buildings, the default area gets everything else
 * (including markyta stock, which has no building). */
type BuildingSide =
  | { include: ReadonlySet<string> }
  | { exclude: ReadonlySet<string> | undefined }

const sideKeeps = (side: BuildingSide, buildingCode: string | null): boolean =>
  'include' in side
    ? buildingCode !== null && side.include.has(buildingCode)
    : buildingCode === null || !side.exclude?.has(buildingCode)

export const getCostCenterTreeById = async (
  id: string
): Promise<CostCenterTree | null> => {
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

    const linkedAreaByProperty = new Map<string, string>()
    for (const area of costCenter.kvvAreas) {
      for (const link of area.propertyLinks) {
        linkedAreaByProperty.set(link.propertyCode, area.id)
      }
    }
    const areaIds = costCenter.kvvAreas.map((area) => area.id)
    const linkedCodes = Array.from(linkedAreaByProperty.keys())

    // Split-property exceptions touching this cost center: rows pointing into
    // its areas (foreign properties contribute a pruned node) and rows moving
    // parts of its linked properties elsewhere (their nodes lose those parts).
    // v1 stores only building rows; the filter keeps later objectTypes from
    // silently mangling the tree before it learns them.
    const exceptionRows = await prisma.onecoreKvvAreaException
      .findMany({
        where: {
          objectType: 'building',
          OR: [
            { kvvAreaId: { in: areaIds } },
            { propertyCode: { in: linkedCodes } },
          ],
        },
      })
      .then(trimStrings)

    // A row pointing at the property's own default area is a no-op.
    const exceptions = exceptionRows.filter(
      (row) => linkedAreaByProperty.get(row.propertyCode) !== row.kvvAreaId
    )

    const excludedByProperty = new Map<string, Set<string>>()
    const inboundByArea = new Map<string, Map<string, Set<string>>>()
    for (const row of exceptions) {
      let excluded = excludedByProperty.get(row.propertyCode)
      if (!excluded) {
        excluded = new Set()
        excludedByProperty.set(row.propertyCode, excluded)
      }
      excluded.add(row.code)

      if (!areaIds.includes(row.kvvAreaId)) continue
      let perArea = inboundByArea.get(row.kvvAreaId)
      if (!perArea) {
        perArea = new Map()
        inboundByArea.set(row.kvvAreaId, perArea)
      }
      let buildings = perArea.get(row.propertyCode)
      if (!buildings) {
        buildings = new Set()
        perArea.set(row.propertyCode, buildings)
      }
      buildings.add(row.code)
    }

    const uniqueCodes = Array.from(
      new Set([...linkedCodes, ...exceptions.map((row) => row.propertyCode)])
    )
    const codesJson = JSON.stringify(uniqueCodes)

    const [properties, addressRows, countRows] = await Promise.all([
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
        ? Promise.resolve([] as AddressRow[])
        : prisma.$queryRaw<AddressRow[]>`
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
      // Grouped per building so split properties can be summed per side; the
      // NULL-building group is markyta stock, which follows the default side.
      uniqueCodes.length === 0
        ? Promise.resolve([] as CountRow[])
        : prisma.$queryRaw<CountRow[]>`
            SELECT
              fstcode AS propertyCode,
              bygcode AS buildingCode,
              COUNT(DISTINCT keyobjlgh) AS residenceCount,
              COUNT(DISTINCT keyobjbps) AS parkingCount,
              COUNT(DISTINCT keyobjvan) AS entranceCount
            FROM dbo.babuf
            WHERE fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
              AND deletemark = 0
            GROUP BY fstcode, bygcode
          `.then(trimStrings),
    ])

    const propertyByCode = new Map(properties.map((p) => [p.code, p]))

    type AddressOut = {
      buildingCode: string
      buildingName: string | null
      buildingType: { code: string | null; name: string | null } | null
    }
    const addressesByProperty = new Map<string, Map<string, AddressOut>>()
    for (const a of addressRows) {
      if (!a.propertyCode || !a.buildingCode) continue
      let perProp = addressesByProperty.get(a.propertyCode)
      if (!perProp) {
        perProp = new Map()
        addressesByProperty.set(a.propertyCode, perProp)
      }
      if (!perProp.has(a.buildingCode)) {
        perProp.set(a.buildingCode, {
          buildingCode: a.buildingCode,
          buildingName: a.buildingName ?? null,
          buildingType:
            a.buildingTypeCode !== null || a.buildingTypeName !== null
              ? {
                  code: a.buildingTypeCode ?? null,
                  name: a.buildingTypeName ?? null,
                }
              : null,
        })
      }
    }

    const countsByProperty = new Map<string, CountRow[]>()
    for (const row of countRows) {
      const perProp = countsByProperty.get(row.propertyCode)
      if (perProp) perProp.push(row)
      else countsByProperty.set(row.propertyCode, [row])
    }

    const buildPropertyNode = (propertyCode: string, side: BuildingSide) => {
      const prop = propertyByCode.get(propertyCode)
      const addr = addressesByProperty.get(propertyCode)
      const addresses = addr
        ? Array.from(addr.values()).filter((a) =>
            sideKeeps(side, a.buildingCode)
          )
        : []

      const aggregates = {
        residenceCount: 0,
        parkingCount: 0,
        entranceCount: 0,
      }
      for (const cnt of countsByProperty.get(propertyCode) ?? []) {
        if (!sideKeeps(side, cnt.buildingCode)) continue
        aggregates.residenceCount += Number(cnt.residenceCount)
        aggregates.parkingCount += Number(cnt.parkingCount)
        aggregates.entranceCount += Number(cnt.entranceCount)
      }

      return {
        code: propertyCode,
        designation: prop?.designation ?? null,
        tract: prop?.tract ?? null,
        addresses,
        aggregates,
        ...(excludedByProperty.has(propertyCode) ? { partial: true } : {}),
      }
    }

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
        properties: [
          ...area.propertyLinks.map((link) =>
            buildPropertyNode(link.propertyCode, {
              exclude: excludedByProperty.get(link.propertyCode),
            })
          ),
          ...Array.from(inboundByArea.get(area.id) ?? []).map(
            ([propertyCode, buildings]) =>
              buildPropertyNode(propertyCode, { include: buildings })
          ),
        ],
      })),
    }
  } catch (err) {
    logger.error({ err, id }, 'cost-center-adapter.getCostCenterTreeById')
    throw err
  }
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
