import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { CostCenterSummary, CostCenterTree } from '@src/types/cost-center'

import { prisma } from './db'

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

    const [properties, structures] = await Promise.all([
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
        ? Promise.resolve(
            [] as Array<{
              propertyCode: string | null
              buildingCode: string | null
              buildingName: string | null
              residenceId: string | null
              parkingSpaceId: string | null
              staircaseId: string | null
            }>
          )
        : prisma.propertyStructure
            .findMany({
              where: { propertyCode: { in: uniqueCodes }, deleteMark: 0 },
              select: {
                propertyCode: true,
                buildingCode: true,
                buildingName: true,
                residenceId: true,
                parkingSpaceId: true,
                staircaseId: true,
              },
            })
            .then(trimStrings),
    ])

    const propertyByCode = new Map(properties.map((p) => [p.code, p]))

    type Aggregates = {
      addresses: Map<
        string,
        { buildingCode: string; buildingName: string | null }
      >
      residenceIds: Set<string>
      parkingIds: Set<string>
      staircaseIds: Set<string>
    }
    const aggByCode = new Map<string, Aggregates>()
    const getAgg = (code: string): Aggregates => {
      let a = aggByCode.get(code)
      if (!a) {
        a = {
          addresses: new Map(),
          residenceIds: new Set(),
          parkingIds: new Set(),
          staircaseIds: new Set(),
        }
        aggByCode.set(code, a)
      }
      return a
    }

    for (const s of structures) {
      if (!s.propertyCode) continue
      const a = getAgg(s.propertyCode)
      if (s.buildingCode && !a.addresses.has(s.buildingCode)) {
        a.addresses.set(s.buildingCode, {
          buildingCode: s.buildingCode,
          buildingName: s.buildingName ?? null,
        })
      }
      if (s.residenceId) a.residenceIds.add(s.residenceId)
      if (s.parkingSpaceId) a.parkingIds.add(s.parkingSpaceId)
      if (s.staircaseId) a.staircaseIds.add(s.staircaseId)
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
        properties: area.propertyLinks.map((link) => {
          const prop = propertyByCode.get(link.propertyCode)
          const agg = aggByCode.get(link.propertyCode)
          return {
            code: link.propertyCode,
            designation: prop?.designation ?? null,
            tract: prop?.tract ?? null,
            addresses: agg
              ? Array.from(agg.addresses.values()).map((b) => ({
                  buildingCode: b.buildingCode,
                  buildingName: b.buildingName,
                  address: b.buildingName,
                }))
              : [],
            aggregates: {
              residenceCount: agg?.residenceIds.size ?? 0,
              parkingCount: agg?.parkingIds.size ?? 0,
              entranceCount: agg?.staircaseIds.size ?? 0,
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
