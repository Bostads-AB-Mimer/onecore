import { logger } from 'onecore-utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

export const getFacilityByRentalId = async (rentalId: string) => {
  try {
    const result = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balok' },
      },
      select: {
        buildingCode: true,
        buildingName: true,
        propertyCode: true,
        propertyName: true,
        propertyId: true,
        buildingId: true,
        rentalId: true,
        propertyObject: {
          select: {
            rentalInformation: {
              select: {
                apartmentNumber: true,
                rentalInformationType: { select: { name: true, code: true } },
              },
            },
            facility: {
              select: {
                id: true,
                location: true,
                entrance: true,
                usage: true,
                name: true,
                code: true,
                propertyObjectId: true,
                availableFrom: true,
                availableTo: true,
                deleteMark: true,
                facilityType: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    })

    assert(result, 'property-structure-not-found')
    assert(result.propertyObject, 'property-object-not-found')
    assert(result.propertyObject.facility, 'facility-not-found')
    assert(
      result.propertyObject.rentalInformation,
      'rentalinformation-not-found'
    )

    const {
      propertyObject: { facility, rentalInformation },
    } = result

    return trimStrings({
      ...result,
      propertyObject: { facility, rentalInformation },
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'property-structure-not-found' ||
        err.message === 'property-object-not-found' ||
        err.message === 'facility-not-found' ||
        err.message === 'rentalinformation-not-found')
    ) {
      return null
    }

    logger.error({ err }, 'facility-adapter.getFacilityByRentalId')
    throw err
  }
}

export const getFacilitySizeByRentalId = async (rentalId: string) => {
  try {
    const propertyInfo = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balok' },
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
        'residence-adapter.getFacilitySizeByRentalId: No property structure found for rentalId'
      )
      return null
    }

    const areaSize = await prisma.quantityValue.findFirst({
      where: {
        code: propertyInfo.propertyObject.id,
      },
    })

    return areaSize
  } catch (err) {
    logger.error({ err }, 'facility-adapter.getFacilitySizeByRentalId')
    throw err
  }
}
