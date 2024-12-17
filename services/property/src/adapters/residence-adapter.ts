import { Prisma, PrismaClient } from '@prisma/client'
import { map } from 'lodash'

const prisma = new PrismaClient({})

//todo: add types

export type Residence = Prisma.ResidenceGetPayload<{
  select: {
    id: true
    code: true
    name: true
    deleted: true
    fromDate: true
    toDate: true
  }
}>

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

const residenceSelect = {
  id: true,
  code: true,
  name: true,
  deleted: true,
  fromDate: true,
  toDate: true,
}

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

export const getResidencesByBuildingCode = async (
  buildingCode: string
): Promise<Residence[]> => {
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
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
    select: residenceSelect,
  })
}

export const getResidencesByBuildingCodeAndFloorCode = async (
  buildingCode: string,
  floorCode: string
): Promise<Residence[]> => {
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
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
  })
}
