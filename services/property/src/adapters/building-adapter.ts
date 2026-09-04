import { map } from 'lodash'
import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'

import { OPERATING_COMPANY_CODES } from './company-scope'
import { prisma } from './db'

export type BuildingWithRelations = Prisma.BuildingGetPayload<{
  include: {
    buildingType: true
    marketArea: true
    propertyDesignation: true
    district: true
    propertyObject: {
      include: {
        property: true
        quantityValues: {
          include: {
            quantityType: true
          }
        }
      }
    }
  }
}>

export type BuildingProperty = {
  id?: string
  code: string
  name: string | null
}

export type BuildingWithProperty = BuildingWithRelations & {
  property: BuildingProperty | null
}

// A building's property is not a relation in Xpand, but the property-structure
// row (babuf) carries fstcode/fstcaption inline, so one lookup is enough —
// no second hop to bafst. `propertyObjectId` is unique on babuf.
// The bafst `id` (uuid) is deliberately not resolved here: no consumer reads it
// (Odoo stamps errands with the property *code*), and fetching it would double
// the queries on a latency-sensitive path — Odoo calls this on every form open
// for building-level errands.
const resolveBuildingProperty = async (
  buildingObjectId: string
): Promise<BuildingProperty | null> => {
  const structure = await prisma.propertyStructure
    .findUnique({
      where: { propertyObjectId: buildingObjectId, deleteMark: 0 },
      select: { propertyCode: true, propertyName: true },
    })
    .then(trimStrings)

  if (!structure?.propertyCode) return null

  return { code: structure.propertyCode, name: structure.propertyName ?? null }
}

const withProperty = async (
  building: BuildingWithRelations | null
): Promise<BuildingWithProperty | null> => {
  if (!building) return null
  const property = await resolveBuildingProperty(building.propertyObjectId)
  return { ...building, property }
}

const getBuildings = async (
  propertyCode: string
): Promise<BuildingWithRelations[]> => {
  try {
    const propertyStructures = await prisma.propertyStructure.findMany({
      where: {
        propertyCode: {
          contains: propertyCode,
        },
        NOT: {
          buildingId: null,
        },
        staircaseId: null,
      },
    })

    return prisma.building
      .findMany({
        where: {
          propertyObjectId: {
            in: map(propertyStructures, 'propertyObjectId'),
          },
        },
        include: {
          buildingType: true,
          marketArea: true,
          district: true,
          propertyDesignation: true,
          propertyObject: {
            include: {
              property: true,
              quantityValues: {
                include: {
                  quantityType: true,
                },
              },
            },
          },
        },
      })
      .then(trimStrings)
  } catch (err) {
    logger.error({ err, propertyCode }, 'building-adapter.getBuildings')
    throw err
  }
}

const getBuildingById = async (
  id: string
): Promise<BuildingWithProperty | null> => {
  try {
    return prisma.building
      .findFirst({
        where: {
          id: id,
        },
        include: {
          buildingType: true,
          marketArea: true,
          propertyDesignation: true,
          district: true,
          propertyObject: {
            include: {
              property: true,
              quantityValues: {
                include: {
                  quantityType: true,
                },
              },
            },
          },
        },
      })
      .then(trimStrings)
      .then(withProperty)
  } catch (err) {
    logger.error({ err, id }, 'building-adapter.getBuildingById')
    throw err
  }
}

const getBuildingByCode = async (
  code: string
): Promise<BuildingWithProperty | null> => {
  try {
    return prisma.building
      .findFirst({
        where: {
          buildingCode: code,
        },
        include: {
          buildingType: true,
          marketArea: true,
          propertyDesignation: true,
          district: true,
          propertyObject: {
            include: {
              property: true,
              quantityValues: {
                include: {
                  quantityType: true,
                },
              },
            },
          },
        },
      })
      .then(trimStrings)
      .then(withProperty)
  } catch (err) {
    logger.error({ err, code }, 'building-adapter.getBuildingByCode')
    throw err
  }
}

/**
 * Searches buildings by name
 * At the moment this function has an "under investigation" approach to fetchin
 * property based on building.
 * We currently fetch property id (and name and code) based on the building id.
 * We do this via property structure (babuf).
 * 1. Find the buildings ID by name
 * 2. Find property structure by building property object ID
 * 3. Find property by property structure property ID
 * 4. Map the buildings and add the property information
 *
 * This is the shortest way to get the property id that _i currently know of_.
 * Keeping this implementation while we learn more about the database structure
 *
 */
const searchBuildings = async (
  q: string
): Promise<
  (BuildingWithRelations & {
    property: { name: string | null; code: string; id: string } | null
  })[]
> => {
  try {
    const buildings = await prisma.building
      .findMany({
        where: {
          name: { contains: q },
          propertyObject: {
            propertyStructures: {
              some: {
                companyCode: { in: [...OPERATING_COMPANY_CODES] },
              },
            },
          },
        },
        include: {
          buildingType: true,
          marketArea: true,
          propertyDesignation: true,
          district: true,
          propertyObject: {
            include: {
              property: true,
              quantityValues: {
                include: {
                  quantityType: true,
                },
              },
            },
          },
        },
        orderBy: { buildingCode: 'asc' },
        take: 10,
      })
      .then(trimStrings)

    const ps = await prisma.propertyStructure
      .findMany({
        where: {
          propertyObjectId: { in: map(buildings, 'propertyObjectId') },
        },
      })
      .then(trimStrings)

    const properties = await prisma.property
      .findMany({
        where: {
          propertyObjectId: {
            in: ps.map((p) => p.propertyId).filter(Boolean) as string[],
          },
        },
      })
      .then(trimStrings)

    const mappedBuildings = buildings.map((b) => {
      const propertyStructure = ps.find(
        (p) => p.propertyObjectId === b.propertyObjectId
      )
      const property = properties.find(
        (p) => p.propertyObjectId === propertyStructure?.propertyId
      )

      return {
        ...b,
        property: property
          ? {
              id: property.id,
              code: property.code,
              name: property.designation,
            }
          : null,
      }
    })

    return mappedBuildings
  } catch (err) {
    logger.error({ err }, 'building-adapter.searchBuildings')
    throw err
  }
}

export { getBuildings, getBuildingById, getBuildingByCode, searchBuildings }
