import { map } from 'lodash'
import { Prisma } from '@prisma/client'
import { logger } from 'onecore-utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'

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
      }
    }
  }
}>

const getBuildings = async (
  propertyCode: string
): Promise<BuildingWithRelations[]> => {
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
          },
        },
      },
    })
    .then(trimStrings)
}

const getBuildingById = async (
  id: string
): Promise<BuildingWithRelations | null> => {
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
          },
        },
      },
    })
    .then(trimStrings)
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
    property: { name: string | null; code: string; id: string }
  })[]
> => {
  try {
    const buildings = await prisma.building
      .findMany({
        where: {
          name: { contains: q },
        },
        include: {
          buildingType: true,
          marketArea: true,
          propertyDesignation: true,
          district: true,
          propertyObject: {
            include: {
              property: true,
            },
          },
        },
      })
      .then(trimStrings)

    const ps = await prisma.propertyStructure
      .findMany({
        where: {
          propertyObjectId: { in: map(buildings, 'propertyObjectId') },
        },
      })
      .then(trimStrings)

    assert(ps, 'Property structure not found')
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

      assert(property, 'Property not found')
      return {
        ...b,
        property: {
          id: property.id,
          code: property.code,
          name: property.designation,
        },
      }
    })

    return mappedBuildings
  } catch (err) {
    logger.error({ err }, 'building-adapter.searchBuildings')
    throw err
  }
}

export { getBuildings, getBuildingById, searchBuildings }
