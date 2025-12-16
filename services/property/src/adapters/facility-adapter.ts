import { logger } from '@onecore/utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

export async function searchFacilities(q: string) {
  /**
   * Searches for facilities by rental id
   */
  const facilities = await prisma.propertyStructure.findMany({
    select: {
      rentalId: true,
      companyCode: true,
      companyName: true,
      propertyCode: true,
      propertyName: true,
      buildingCode: true,
      buildingName: true,
      propertyObject: {
        select: {
          facility: {
            select: {
              propertyObjectId: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
    where: {
      companyCode: '001',
      propertyObject: {
        objectTypeId: 'balok',
        facility: {
          isNot: null,
        },
      },
      rentalId: {
        contains: q,
      },
    },
    take: 10,
  })

  return facilities
    .filter(
      (f) => f.propertyObject?.facility !== null && f.rentalId !== null
    )
    .map((f) => ({
      id: f.rentalId!,
      rentalId: f.rentalId!,
      name: f.propertyObject.facility!.name,
      code: f.propertyObject.facility!.code,
      property: {
        code: f.propertyCode,
        name: f.propertyName,
      },
      building: {
        code: f.buildingCode ?? null,
        name: f.buildingName ?? null,
      },
    }))
}

const getAreasByPropertyObjectIds = async (
  propertyObjectIds: string[]
): Promise<Map<string, number>> => {
  if (propertyObjectIds.length === 0) return new Map()

  const areas = await prisma.quantityValue.findMany({
    where: { code: { in: propertyObjectIds } },
  })

  return new Map(areas.map((area) => [area.code, area.value]))
}

export const getFacilityByRentalId = async (rentalId: string) => {
  try {
    const result = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balok' },
      },
      include: {
        propertyObject: {
          include: {
            facility: {
              include: { facilityType: true },
            },
            rentalInformation: {
              include: {
                rentalInformationType: true,
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

    // Get area for this facility
    const areaSizeMap = await getAreasByPropertyObjectIds([
      result.propertyObject.facility.propertyObjectId,
    ])
    const areaSize =
      areaSizeMap.get(result.propertyObject.facility.propertyObjectId) ?? null

    const facility = {
      id: result.propertyObject.facility.id,
      code: result.propertyObject.facility.code,
      name: result.propertyObject.facility.name ?? null,
      entrance: result.propertyObject.facility.entrance ?? null,
      deleted: Boolean(result.propertyObject.facility.deleteMark),
      type: {
        code: result.propertyObject.facility.facilityType?.code || '',
        name: result.propertyObject.facility.facilityType?.name || null,
      },
      areaSize,
      building: {
        id: result.buildingId,
        code: result.buildingCode,
        name: result.buildingName,
      },
      property: {
        id: result.propertyId,
        code: result.propertyCode,
        name: result.propertyName,
      },
      rentalInformation: {
        rentalId: result.rentalId,
        apartmentNumber:
          result.propertyObject.rentalInformation.apartmentNumber,
        type: {
          code:
            result.propertyObject.rentalInformation.rentalInformationType
              ?.code || '',
          name:
            result.propertyObject.rentalInformation.rentalInformationType
              ?.name || null,
        },
      },
    }

    return trimStrings(facility)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'property-structure-not-found' ||
        err.message === 'property-object-not-found' ||
        err.message === 'facility-not-found' ||
        err.message === 'rentalinformation-not-found' ||
        err.message.includes('rental-information-not-found'))
    ) {
      return null
    }

    logger.error({ err }, 'facility-adapter.getFacilityByRentalId')
    throw err
  }
}

export const getFacilitiesByPropertyCode = async (propertyCode: string) => {
  try {
    const result = await prisma.propertyStructure.findMany({
      where: {
        propertyCode,
        propertyObject: { objectTypeId: 'balok' },
      },
      include: {
        propertyObject: {
          include: {
            facility: {
              include: { facilityType: true },
            },
            rentalInformation: {
              include: {
                rentalInformationType: true,
              },
            },
          },
        },
      },
    })

    assert(result.length > 0, 'property-structure-not-found')

    result.forEach((item, index) => {
      assert(item.propertyObject, `property-object-not-found-at-index-${index}`)
      if (item.propertyObject.facility) {
        assert(
          item.propertyObject.facility,
          `facility-not-found-at-index-${index}`
        )
      }
      if (item.propertyObject.rentalInformation) {
        assert(
          item.propertyObject.rentalInformation,
          `rental-information-not-found-at-index-${index}`
        )
      }
    })

    // Get areas for all facilities
    const propertyObjectIds = result
      .filter((item) => item.propertyObject.facility)
      .map((item) => item.propertyObject.facility!.propertyObjectId)

    const areaSizeMap = await getAreasByPropertyObjectIds(propertyObjectIds)

    const facilities = result
      .filter((item) => item.propertyObject.facility)
      .map((item) => ({
        id: item.propertyObject.facility!.id,
        code: item.propertyObject.facility!.code,
        name: item.propertyObject.facility!.name ?? null,
        entrance: item.propertyObject.facility!.entrance ?? null,
        deleted: Boolean(item.propertyObject.facility!.deleteMark),
        type: {
          code: item.propertyObject.facility!.facilityType?.code,
          name: item.propertyObject.facility!.facilityType?.name || null,
        },
        areaSize:
          areaSizeMap.get(item.propertyObject.facility!.propertyObjectId) ??
          null,
        building: {
          id: item.buildingId,
          code: item.buildingCode,
          name: item.buildingName,
        },
        property: {
          id: item.propertyId,
          code: item.propertyCode,
          name: item.propertyName,
        },
        rentalInformation: item.propertyObject.rentalInformation
          ? {
              rentalId: item.rentalId,
              apartmentNumber:
                item.propertyObject.rentalInformation.apartmentNumber || null,
              type: {
                code:
                  item.propertyObject.rentalInformation.rentalInformationType
                    ?.code || '',
                name:
                  item.propertyObject.rentalInformation.rentalInformationType
                    ?.name || null,
              },
            }
          : null,
      }))

    return trimStrings(facilities)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'property-structure-not-found' ||
        err.message.includes('property-object-not-found') ||
        err.message.includes('facility-not-found') ||
        err.message.includes('rental-information-not-found'))
    ) {
      return null
    }

    logger.error({ err }, 'facility-adapter.getFacilitiesByPropertyCode')
    throw err
  }
}

export const getFacilitiesByBuildingCode = async (buildingCode: string) => {
  try {
    const result = await prisma.propertyStructure.findMany({
      where: {
        buildingCode,
        propertyObject: { objectTypeId: 'balok' },
      },
      include: {
        propertyObject: {
          include: {
            facility: {
              include: { facilityType: true },
            },
            rentalInformation: {
              include: {
                rentalInformationType: true,
              },
            },
          },
        },
      },
    })

    assert(result.length > 0, 'property-structure-not-found')

    result.forEach((item, index) => {
      assert(item.propertyObject, `property-object-not-found-at-index-${index}`)
      if (item.propertyObject.facility) {
        assert(
          item.propertyObject.facility,
          `facility-not-found-at-index-${index}`
        )
      }
      if (item.propertyObject.rentalInformation) {
        assert(
          item.propertyObject.rentalInformation,
          `rental-information-not-found-at-index-${index}`
        )
      }
    })

    // Get areas for all facilities
    const propertyObjectIds = result
      .filter((item) => item.propertyObject.facility)
      .map((item) => item.propertyObject.facility!.propertyObjectId)

    const areaSizeMap = await getAreasByPropertyObjectIds(propertyObjectIds)

    const facilities = result
      .filter((item) => item.propertyObject.facility)
      .map((item) => ({
        id: item.propertyObject.facility!.id,
        code: item.propertyObject.facility!.code,
        name: item.propertyObject.facility!.name ?? null,
        entrance: item.propertyObject.facility!.entrance ?? null,
        deleted: Boolean(item.propertyObject.facility!.deleteMark),
        type: {
          code: item.propertyObject.facility!.facilityType?.code,
          name: item.propertyObject.facility!.facilityType?.name || null,
        },
        areaSize:
          areaSizeMap.get(item.propertyObject.facility!.propertyObjectId) ??
          null,
        building: {
          id: item.buildingId,
          code: item.buildingCode,
          name: item.buildingName,
        },
        property: {
          id: item.propertyId,
          code: item.propertyCode,
          name: item.propertyName,
        },
        rentalInformation: item.propertyObject.rentalInformation
          ? {
              rentalId: item.rentalId,
              apartmentNumber:
                item.propertyObject.rentalInformation.apartmentNumber || null,
              type: {
                code:
                  item.propertyObject.rentalInformation.rentalInformationType
                    ?.code || '',
                name:
                  item.propertyObject.rentalInformation.rentalInformationType
                    ?.name || null,
              },
            }
          : null,
      }))

    return trimStrings(facilities)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'property-structure-not-found' ||
        err.message.includes('property-object-not-found') ||
        err.message.includes('facility-not-found') ||
        err.message.includes('rental-information-not-found'))
    ) {
      return null
    }

    logger.error({ err }, 'facility-adapter.getFacilitiesByBuildingCode')
    throw err
  }
}
