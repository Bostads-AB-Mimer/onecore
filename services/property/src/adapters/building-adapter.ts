import { map } from 'lodash'
import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from 'onecore-utilities'

const prisma = new PrismaClient({})

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
      floorId: null,
    },
  })

  return prisma.building.findMany({
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
}

const getBuildingById = async (
  id: string
): Promise<BuildingWithRelations | null> => {
  return prisma.building.findFirst({
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
}

const searchBuildings = (q: string): Promise<BuildingWithRelations[]> => {
  try {
    return prisma.building.findMany({
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
  } catch (err) {
    logger.error({ err }, 'building-adapter.searchBuildings')
    throw err
  }
}

export { getBuildings, getBuildingById, searchBuildings }
