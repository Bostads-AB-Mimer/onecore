import { Prisma, PrismaClient, Room } from '@prisma/client'
import { map } from 'lodash'

const prisma = new PrismaClient({
  log: ['query'],
})

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
    /*transform: (room: Room) => ({
      id: room.roomId,
      code: room.roomCode,
      name: room.name?.trim(),
      usage: {
        shared: Boolean(room.sharedUse),
        allowPeriodicWorks: Boolean(room.allowPeriodicWorks),
        spaceType: room.spaceType,
      },
      features: {
        hasToilet: Boolean(room.hasToilet),
        isHeated: Boolean(room.isHeated),
        hasThermostatValve: Boolean(room.hasThermostatValve),
        orientation: room.orientation,
      },
      dates: {
        installation: room.installationDate,
        from: room.fromDate,
        to: room.toDate,
        availableFrom: room.availableFrom,
        availableTo: room.availableTo,
      },
      sortingOrder: room.sortingOrder,
      deleted: Boolean(room.deleteMark),
      timestamp: room.timestamp,
      roomType: room.roomTypeId,
    }),*/
  })
}
