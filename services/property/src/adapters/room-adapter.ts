import { map } from 'lodash'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

//todo: add types

//todo: we might be able to skip using staircaseCode
export const getRooms = async (
  buildingCode: string,
  staircaseCode: string,
  residenceCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      staircaseCode: staircaseCode,
      residenceCode: residenceCode,
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
