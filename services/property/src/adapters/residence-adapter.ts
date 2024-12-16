import { Prisma, PrismaClient } from '@prisma/client'
import { map } from 'lodash'

const prisma = new PrismaClient({})

//todo: add types

export type ResidenceWithRelations = Prisma.ResidenceGetPayload<{
  include: {
    residenceType: true
    propertyObject: {
      include: {
        property: true
        building: true
      }
    }
  }
}>

export const getResidenceById = async (
  id: string
): Promise<ResidenceWithRelations | null> => {
  const response = await prisma.residence.findFirst({
    where: {
      id: id,
    },
    include: {
      residenceType: true,
      propertyObject: {
        include: {
          property: true,
          building: true,
        },
      },
    },
  })

  return response
}

export const getResidencesByBuildingCode = async (buildingCode: string) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      NOT: {
        floorId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence.findMany({
    where: {
      objectId: {
        in: map(propertyStructures, 'objectId'),
      },
    },
  })
}

export const getResidencesByBuildingCodeAndFloorCode = async (
  buildingCode: string,
  floorCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      floorCode: floorCode,
      NOT: {
        floorId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence.findMany({
    where: {
      objectId: {
        in: map(propertyStructures, 'objectId'),
      },
    },
  })
}
