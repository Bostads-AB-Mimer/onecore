import { map } from 'lodash'
import { Prisma } from '@prisma/client'
import { logger } from 'onecore-utilities'

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

const getBuildingById = (id: string): Promise<BuildingWithRelations | null> => {
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

const searchBuildings = (q: string): Promise<BuildingWithRelations[]> => {
  try {
    return prisma.building
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
  } catch (err) {
    logger.error({ err }, 'building-adapter.searchBuildings')
    throw err
  }
}

export { getBuildings, getBuildingById, searchBuildings }
