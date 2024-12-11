import { Prisma, PrismaClient, Room } from '@prisma/client'
import { map } from 'lodash'

const prisma = new PrismaClient({
  log: ['query'],
})

//todo: add types

//todo: we might be able to skip using floorCode
export const getRooms = async (
  buildingCode: string,
  floorCode: string,
  residenceCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      floorCode: floorCode,
      residenceCode: residenceCode,
      NOT: {
        floorId: null,
        residenceId: null,
        roomId: null,
      },
      localeId: null,
    },
  })

  return prisma.room.findMany({
    where: {
      propertyObjectId: {
        in: map(propertyStructures, 'objectId'),
      },
    },
    select: {
      roomId: true,
      roomCode: true,
      name: true,
      sharedUse: true,
      sortingOrder: true,
      allowPeriodicWorks: true,
      spaceType: true,
      hasToilet: true,
      isHeated: true,
      hasThermostatValve: true,
      orientation: true,
      installationDate: true,
      deleteMark: true,
      fromDate: true,
      toDate: true,
      availableFrom: true,
      availableTo: true,
      timestamp: true,
      roomType: true,
    },
  })
}
