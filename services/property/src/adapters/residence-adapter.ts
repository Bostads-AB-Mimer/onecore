import { Prisma } from '@prisma/client'
import { map } from 'lodash'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'
import { logger } from 'onecore-utilities'

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
        propertyStructures: {
          select: {
            rentalId: true
            propertyCode: true
            propertyName: true
            buildingCode: true
            buildingName: true
          }
        }
      }
    }
  }
}>

const residenceSelect: Prisma.ResidenceSelect = {
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
  const response = await prisma.residence
    .findFirst({
      where: {
        id: id,
      },
      include: {
        residenceType: true,
        propertyObject: {
          include: {
            propertyStructures: {
              select: {
                rentalId: true,
                buildingCode: true,
                buildingName: true,
                propertyCode: true,
                propertyName: true,
              },
            },
          },
        },
      },
    })
    .then(trimStrings)

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
        staircaseId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
      select: residenceSelect,
    })
    .then(trimStrings)
}

export const getResidencesByBuildingCodeAndStaircaseCode = async (
  buildingCode: string,
  staircaseCode: string
): Promise<Residence[]> => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      staircaseCode: staircaseCode,
      NOT: {
        staircaseId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
    })
    .then(trimStrings)
}

export type ResidenceSearchResult = Prisma.ResidenceGetPayload<{
  include: {
    propertyObject: {
      include: {
        propertyStructures: {
          select: {
            rentalId: true
            propertyCode: true
            propertyName: true
            buildingCode: true
            buildingName: true
          }
        }
      }
    }
  }
}>

export const searchResidences = async (
  q: string
): Promise<Array<ResidenceSearchResult>> => {
  try {
    const result = await prisma.residence.findMany({
      where: {
        propertyObject: {
          propertyStructures: { every: { rentalId: { contains: q } } },
        },
      },
      include: {
        propertyObject: {
          include: {
            propertyStructures: {
              select: {
                rentalId: true,
                propertyCode: true,
                propertyName: true,
                buildingCode: true,
                buildingName: true,
              },
              where: {
                NOT: {
                  rentalId: null,
                  propertyCode: null,
                  propertyName: null,
                  buildingCode: null,
                  buildingName: null,
                },
              },
            },
          },
        },
      },
    })

    return trimStrings(result)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.searchResidences')
    throw err
  }
}
