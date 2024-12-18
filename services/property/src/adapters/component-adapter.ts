import { PrismaClient } from '@prisma/client'
import { map } from 'lodash'

const prisma = new PrismaClient({})

//todo: add types
export const getComponents = async (
  buildingCode: string,
  floorCode: string,
  residenceCode: string,
  roomCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      floorCode: floorCode,
      residenceCode: residenceCode,
      roomCode: roomCode,
      NOT: {
        componentId: null,
      },
      localeId: null,
    },
  })
  return prisma.component.findMany({
    where: {
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
  })
}

export const getComponentById = async (id: string) => {
  return prisma.component.findUnique({
    where: {
      id: id,
    },
  })
}
