import { Prisma } from '@prisma/client'
import { map } from 'lodash'

import { Room } from '@src/types/room'
import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

const roomSelect = {
  id: true,
  propertyObjectId: true,
  code: true,
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
} satisfies Prisma.RoomSelect

type RoomRecord = Prisma.RoomGetPayload<{ select: typeof roomSelect }>

function mapToRoom(v: RoomRecord): Room {
  return {
    ...v,
    deleted: Boolean(v.deleteMark),
    dates: {
      availableFrom: v.availableFrom,
      availableTo: v.availableTo,
      from: v.fromDate,
      to: v.toDate,
      installation: v.installationDate,
    },
    features: {
      hasThermostatValve: Boolean(v.hasThermostatValve),
      hasToilet: Boolean(v.hasToilet),
      isHeated: Boolean(v.isHeated),
      orientation: v.orientation,
    },
    usage: {
      allowPeriodicWorks: Boolean(v.allowPeriodicWorks),
      shared: Boolean(v.sharedUse),
      spaceType: v.spaceType,
    },
  }
}

export const getRoomById = async (id: string) => {
  return prisma.room
    .findUnique({
      where: {
        id: id,
      },
      select: roomSelect,
    })
    .then(trimStrings)
}

async function getRoomsByPropertyObjectIds(
  propertyObjectIds: string[]
): Promise<Room[]> {
  const rooms = await prisma.room
    .findMany({
      where: {
        propertyObjectId: {
          in: propertyObjectIds,
        },
      },
      select: roomSelect,
    })
    .then(trimStrings)

  return rooms.map(mapToRoom)
}

export async function getRooms(residenceId: string) {
  const residence = await prisma.residence
    .findFirst({
      where: {
        id: residenceId,
      },
      include: {
        residenceType: true,
        propertyObject: {
          include: {
            property: true,
            building: true,
            propertyStructures: {
              select: {
                rentalId: true,
              },
            },
          },
        },
      },
    })
    .then(trimStrings)

  if (!residence) {
    throw new Error(`Residence not found: ${residenceId}`)
  }

  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      residenceId: residence.propertyObjectId,
      NOT: {
        staircaseId: null,
        residenceId: null,
        roomId: null,
      },
      localeId: null,
    },
  })

  return getRoomsByPropertyObjectIds(
    map(propertyStructures, 'propertyObjectId')
  )
}

export async function getRoomsByFacilityId(facilityId: string) {
  const facility = await prisma.facility
    .findFirst({
      where: {
        id: facilityId,
      },
    })
    .then(trimStrings)

  if (!facility) {
    return []
  }

  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      localeId: facility.propertyObjectId,
      NOT: {
        roomId: null,
      },
    },
  })

  return getRoomsByPropertyObjectIds(
    map(propertyStructures, 'propertyObjectId')
  )
}
