import { map } from 'lodash'
import { logger } from '@onecore/utilities'

import { toBoolean, trimStrings } from '../utils/data-conversion'

import { prisma } from './db'

//todo: add types

type StaircasePropertyData = {
  propertyId: string | null
  propertyCode: string | null
  propertyName: string | null
  buildingId: string | null
  buildingCode: string | null
  buildingName: string | null
}

type StaircaseRow = Awaited<
  ReturnType<typeof prisma.staircase.findMany>
>[number]

type PropertyStructureRow = Awaited<
  ReturnType<typeof prisma.propertyStructure.findMany>
>[number]

function extractPropertyData(ps: PropertyStructureRow): StaircasePropertyData {
  return {
    propertyId: ps.propertyId,
    propertyCode: ps.propertyCode,
    propertyName: ps.propertyName,
    buildingId: ps.buildingId,
    buildingCode: ps.buildingCode,
    buildingName: ps.buildingName,
  }
}

function mapStaircase(
  staircase: StaircaseRow,
  propertyData: StaircasePropertyData | undefined
) {
  return {
    id: staircase.id,
    code: staircase.code,
    name: staircase.name,
    features: {
      floorPlan: staircase.floorPlan,
      accessibleByElevator: toBoolean(staircase.accessibleByElevator),
    },
    dates: {
      from: staircase.fromDate,
      to: staircase.toDate,
    },
    deleted: toBoolean(staircase.deleteMark),
    timestamp: staircase.timestamp,
    property: {
      propertyId: propertyData?.propertyId ?? null,
      propertyCode: propertyData?.propertyCode ?? null,
      propertyName: propertyData?.propertyName ?? null,
    },
    building: {
      buildingId: propertyData?.buildingId ?? null,
      buildingCode: propertyData?.buildingCode ?? null,
      buildingName: propertyData?.buildingName ?? null,
    },
  }
}

async function getStaircasesByBuildingCode(
  buildingCode: string,
  staircaseCode?: string
) {
  const propertyStructures = await prisma.propertyStructure
    .findMany({
      where: {
        buildingCode: {
          contains: buildingCode,
        },
        NOT: {
          staircaseId: null,
        },
        residenceId: null,
        localeId: null,
        ...(staircaseCode ? { staircaseCode } : {}),
      },
    })
    .then(trimStrings)

  const staircases = await prisma.staircase
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
    })
    .then(trimStrings)

  const propertyStructureMap = new Map(
    propertyStructures.map((ps) => [
      ps.propertyObjectId,
      extractPropertyData(ps),
    ])
  )

  return staircases.map((staircase) => ({
    ...mapStaircase(
      staircase,
      propertyStructureMap.get(staircase.propertyObjectId)
    ),
    buildingCode,
  }))
}

// Staircase codes '00' and '99' are placeholder/synthetic entries not shown in
// the UI sidebar (see apps/property-tree/src/widgets/sidebar/ui/StaircaseList.tsx).
// We exclude them from global search results to stay consistent.
const EXCLUDED_STAIRCASE_CODES = ['00', '99']

async function searchStaircases(q: string) {
  try {
    const staircases = await prisma.staircase
      .findMany({
        where: {
          name: { contains: q },
          deleteMark: 0,
          code: { notIn: EXCLUDED_STAIRCASE_CODES },
          // Require a staircase-level PropertyStructure row with a non-null
          // buildingCode so search results are guaranteed to be navigable.
          PropertyStructure: {
            some: {
              companyCode: '001',
              residenceId: null,
              localeId: null,
              buildingCode: { not: null },
            },
          },
        },
        take: 10,
      })
      .then(trimStrings)

    if (staircases.length === 0) {
      return []
    }

    const propertyStructures = await prisma.propertyStructure
      .findMany({
        where: {
          staircaseId: { in: map(staircases, 'propertyObjectId') },
          residenceId: null,
          localeId: null,
        },
      })
      .then(trimStrings)

    const propertyStructureMap = new Map(
      propertyStructures
        .filter((ps): ps is PropertyStructureRow & { staircaseId: string } =>
          Boolean(ps.staircaseId)
        )
        .map((ps) => [ps.staircaseId, extractPropertyData(ps)])
    )

    return staircases.map((staircase) =>
      mapStaircase(
        staircase,
        propertyStructureMap.get(staircase.propertyObjectId)
      )
    )
  } catch (err) {
    logger.error({ err }, 'staircase-adapter.searchStaircases')
    throw err
  }
}

export { getStaircasesByBuildingCode, searchStaircases }
