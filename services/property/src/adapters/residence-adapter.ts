import { Prisma } from '@prisma/client'
import { map } from 'lodash'
import { logger } from '@onecore/utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'
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
        rentalInformation: { include: { rentalInformationType: true } }
        rentalBlocks: {
          include: {
            blockReason: true
          }
        }
        propertyStructures: {
          select: {
            rentalId: true
            propertyCode: true
            propertyName: true
            buildingCode: true
            buildingName: true
            staircaseCode: true
          }
        }
      }
    }
    comments: {
      where: {
        template: {
          type: 'balgh'
          caption: 'Anläggningsid'
        }
      }
      select: {
        text: true
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

export const getResidenceByRentalId = async (rentalId: string) => {
  try {
    const propertyStructure = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
      },
      select: {
        buildingCode: true,
        buildingName: true,
        propertyCode: true,
        propertyName: true,
        propertyId: true,
        buildingId: true,
        staircaseCode: true,
        rentalId: true,
        staircase: {
          select: {
            id: true,
            code: true,
            name: true,
            floorPlan: true,
            accessibleByElevator: true,
            deleteMark: true,
            fromDate: true,
            toDate: true,
            timestamp: true,
          },
        },
        propertyObject: {
          select: {
            rentalInformation: {
              select: {
                apartmentNumber: true,
                rentalInformationType: { select: { name: true, code: true } },
              },
            },
            residence: {
              select: {
                id: true,
                elevator: true,
                floor: true,
                deleted: true,
                code: true,
                hygieneFacility: true,
                name: true,
                wheelchairAccessible: true,
                residenceType: {
                  select: {
                    code: true,
                    name: true,
                    roomCount: true,
                    kitchen: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    assert(propertyStructure, 'property-structure-not-found')
    assert(propertyStructure.propertyObject, 'property-object-not-found')
    assert(propertyStructure.propertyObject.residence, 'residence-not-found')
    assert(
      propertyStructure.propertyObject.rentalInformation,
      'rentalinformation-not-found'
    )

    const {
      propertyObject: { residence, rentalInformation },
      staircase,
    } = propertyStructure

    return trimStrings({
      ...propertyStructure,
      propertyObject: { residence, rentalInformation },
      staircase,
    })
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getResidenceByRentalId')
    throw err
  }
}

export const getResidenceById = async (
  id: string,
  options?: { includeActiveBlocksOnly?: boolean }
): Promise<ResidenceWithRelations | null> => {
  const includeActiveBlocksOnly = options?.includeActiveBlocksOnly ?? false

  const response = await prisma.residence
    .findFirst({
      where: {
        id: id,
      },
      include: {
        residenceType: true,
        propertyObject: {
          include: {
            rentalInformation: { include: { rentalInformationType: true } },
            rentalBlocks: {
              ...(includeActiveBlocksOnly && {
                where: {
                  fromDate: {
                    lte: new Date(),
                  },
                  OR: [
                    {
                      toDate: {
                        gte: new Date(),
                      },
                    },
                    {
                      toDate: null as any,
                    },
                  ],
                },
              }),
              include: {
                blockReason: true,
              },
            },
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
        comments: {
          where: {
            template: {
              type: 'balgh',
              caption: 'Anläggningsid',
            },
          },
          select: {
            text: true,
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

export const getResidenceSummariesByBuildingCodeAndStaircaseCode = async (
  buildingCode: string,
  staircaseCode?: string
) => {
  const residences = await prisma.propertyStructure
    .findMany({
      select: {
        rentalId: true,
        buildingCode: true,
        buildingName: true,
        staircaseCode: true,
        staircaseName: true,
        propertyObject: {
          select: {
            /*
            rentalInformation: {
              select: {
                apartmentNumber: true,
                rentalInformationType: { select: { name: true, code: true } },
              },
            },
            */
            quantityValues: {
              where: {
                quantityTypeId: 'BOA',
              },
              select: {
                value: true,
                quantityTypeId: true,
                quantityType: { select: { name: true, unitId: true } },
              },
            },
            residence: {
              select: {
                id: true,
                elevator: true,
                floor: true,
                deleted: true,
                code: true,
                hygieneFacility: true,
                name: true,
                wheelchairAccessible: true,
                fromDate: true,
                toDate: true,
                residenceType: {
                  select: {
                    code: true,
                    name: true,
                    roomCount: true,
                    kitchen: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        roomId: null,
        propertyObject: { objectTypeId: 'balgh' },
        buildingCode: {
          contains: buildingCode,
        },
        ...(staircaseCode && { staircaseCode: staircaseCode }),
        NOT: [{ staircaseId: null }, { residenceId: null }, { rentalId: null }],
        localeId: null,
      },
    })
    .then(trimStrings)

  return residences
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

export const getResidenceSizeByRentalId = async (rentalId: string) => {
  try {
    // Get property structure information for the residence
    const propertyInfo = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
        NOT: { propertyCode: null },
      },
      select: {
        name: true,
        propertyObject: {
          select: {
            id: true,
          },
        },
      },
    })

    if (propertyInfo === null) {
      logger.warn(
        'residence-adapter.getResidenceSizeByRentalId: No property structure found for rentalId'
      )
      return null
    }

    // Get area size for the property object
    const areaSize = await prisma.quantityValue.findFirst({
      where: {
        code: propertyInfo.propertyObject.id,
        quantityTypeId: 'BOA',
      },
    })

    return areaSize
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getResidenceSizeById')
    throw err
  }
}

export const searchResidences = async (
  q: string,
  searchFields: string[]
): Promise<Array<ResidenceSearchResult>> => {
  try {
    const result = await prisma.residence.findMany({
      where: {
        propertyObject: {
          propertyStructures: {
            every: {
              OR: searchFields.map((field) => ({
                [field]: { contains: q },
              })),
            },
          },
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
      take: 10,
    })

    return trimStrings(result)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.searchResidences')
    throw err
  }
}

export const getRentalBlocksByRentalId = async (
  rentalId: string,
  options?: { includeActiveBlocksOnly?: boolean }
) => {
  try {
    const includeActiveBlocksOnly = options?.includeActiveBlocksOnly ?? false

    // First find the propertyObjectId from the rentalId
    const propertyStructure = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
      },
      select: {
        propertyObjectId: true,
      },
    })

    if (!propertyStructure) {
      return null
    }

    // Get rental blocks for this property object
    const rentalBlocks = await prisma.rentalBlock.findMany({
      where: {
        propertyObjectId: propertyStructure.propertyObjectId,
        ...(includeActiveBlocksOnly && {
          fromDate: {
            lte: new Date(),
          },
          OR: [
            {
              toDate: {
                gte: new Date(),
              },
            },
            {
              toDate: null as any,
            },
          ],
        }),
      },
      include: {
        blockReason: true,
      },
      orderBy: {
        fromDate: 'desc',
      },
    })

    return trimStrings(rentalBlocks)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getRentalBlocksByRentalId')
    throw err
  }
}
