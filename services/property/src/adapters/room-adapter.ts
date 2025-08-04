import { map } from 'lodash'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

//todo: add types

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
    throw 'foo'
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

  return prisma.room
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
      select: {
        id: true,
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
      },
    })
    .then(trimStrings)
}

export const getRoomById = async (id: string) => {
  return prisma.room
    .findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
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
      },
    })
    .then(trimStrings)
}
