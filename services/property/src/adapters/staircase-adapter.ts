import { map } from 'lodash'
import { logger } from '@onecore/utilities'

import { toBoolean, trimStrings } from '../utils/data-conversion'
import { Staircase } from '../types/staircase'

import { prisma } from './db'

// Staircase codes '00' and '99' are placeholder/synthetic entries that aren't
// real, navigable staircases. Also filtered out in the sidebar (see
// apps/property-tree/src/widgets/sidebar/ui/StaircaseList.tsx).
const PLACEHOLDER_STAIRCASE_CODES = ['00', '99']

// Domain invariant: every staircase in onecore has a building and a property.
// These codes/ids are guaranteed non-null in the returned data; the Prisma
// `where` filters below enforce it at the query layer.
type StaircasePropertyData = {
  propertyId: string
  propertyCode: string
  propertyName: string | null
  buildingId: string
  buildingCode: string
  buildingName: string | null
}

type StaircaseRow = Awaited<
  ReturnType<typeof prisma.staircase.findMany>
>[number]

type PropertyStructureRow = Awaited<
  ReturnType<typeof prisma.propertyStructure.findMany>
>[number]

function extractPropertyData(ps: PropertyStructureRow): StaircasePropertyData {
  if (!ps.propertyId || !ps.propertyCode || !ps.buildingId || !ps.buildingCode) {
    throw new Error(
      `staircase property structure ${ps.propertyObjectId} is missing required code/id fields`
    )
  }
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
  propertyData: StaircasePropertyData
): Staircase {
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
      propertyId: propertyData.propertyId,
      propertyCode: propertyData.propertyCode,
      propertyName: propertyData.propertyName,
    },
    building: {
      buildingId: propertyData.buildingId,
      buildingCode: propertyData.buildingCode,
      buildingName: propertyData.buildingName,
    },
  }
}

function requirePropertyData(
  staircase: StaircaseRow,
  propertyData: StaircasePropertyData | undefined
): StaircasePropertyData {
  if (!propertyData) {
    throw new Error(
      `missing property structure for staircase ${staircase.id} (${staircase.propertyObjectId})`
    )
  }
  return propertyData
}

async function getStaircasesByBuildingCode(
  buildingCode: string,
  staircaseCode?: string
): Promise<(Staircase & { buildingCode: string })[]> {
  const propertyStructures = await prisma.propertyStructure
    .findMany({
      where: {
        buildingCode: { contains: buildingCode },
        staircaseId: { not: null },
        residenceId: null,
        localeId: null,
        propertyId: { not: null },
        propertyCode: { not: null },
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
      requirePropertyData(
        staircase,
        propertyStructureMap.get(staircase.propertyObjectId)
      )
    ),
    buildingCode,
  }))
}

async function searchStaircases(q: string): Promise<Staircase[]> {
  try {
    const staircases = await prisma.staircase
      .findMany({
        where: {
          name: { contains: q },
          deleteMark: 0,
          code: { notIn: PLACEHOLDER_STAIRCASE_CODES },
          PropertyStructure: {
            some: {
              companyCode: '001',
              residenceId: null,
              localeId: null,
              buildingCode: { not: null },
              propertyCode: { not: null },
              propertyId: { not: null },
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
        requirePropertyData(
          staircase,
          propertyStructureMap.get(staircase.propertyObjectId)
        )
      )
    )
  } catch (err) {
    logger.error({ err }, 'staircase-adapter.searchStaircases')
    throw err
  }
}

export { getStaircasesByBuildingCode, searchStaircases }
