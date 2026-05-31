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
  residenceCount: number | bigint
  parkingCount: number | bigint
  entranceCount: number | bigint
}

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

    const propertyCodes = costCenter.kvvAreas.flatMap((area) =>
      area.propertyLinks.map((link) => link.propertyCode)
    )
    const uniqueCodes = Array.from(new Set(propertyCodes))
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
      uniqueCodes.length === 0
        ? Promise.resolve([] as CountRow[])
        : prisma.$queryRaw<CountRow[]>`
            SELECT
              fstcode AS propertyCode,
              COUNT(DISTINCT keyobjlgh) AS residenceCount,
              COUNT(DISTINCT keyobjbps) AS parkingCount,
              COUNT(DISTINCT keyobjvan) AS entranceCount
            FROM dbo.babuf
            WHERE fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
              AND deletemark = 0
            GROUP BY fstcode
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
          const addr = addressesByProperty.get(link.propertyCode)
          const cnt = countsByProperty.get(link.propertyCode)
          return {
            code: link.propertyCode,
            designation: prop?.designation ?? null,
            tract: prop?.tract ?? null,
            addresses: addr ? Array.from(addr.values()) : [],
            aggregates: {
              residenceCount: cnt ? Number(cnt.residenceCount) : 0,
              parkingCount: cnt ? Number(cnt.parkingCount) : 0,
              entranceCount: cnt ? Number(cnt.entranceCount) : 0,
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
