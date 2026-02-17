import { Prisma } from '@prisma/client'
import { map } from 'lodash'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

export type PropertyWithObject = Prisma.PropertyGetPayload<{
  include: {
    propertyObject: true
  }
}>

//todo: use actual type and mapper
const getPropertyByCode = async (
  code: string
): Promise<PropertyWithObject | null> => {// Debug log
  try {
    const result = await prisma.property.findUnique({
      where: {
        code: code,
      },
      include: {
        district: {
          select: {
            id: true,
            code: true,
            caption: true,
          },
        },
        marketArea: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        propertyObject: {
          select: {
            id: true,
            deleteMark: true,
            timestamp: true,
            objectTypeId: true,
            barcode: true,
            barcodeType: true,
            condition: true,
            conditionInspectionDate: true,
            vatAdjustmentPrinciple: true,
            energyClass: true,
            energyRegistered: true,
            energyReceived: true,
            energyIndex: true,
            heatingNature: true,
          },
        },
      },
    })

    return trimStrings(result)
  } catch (err) {
    logger.error({ err }, 'property-adapter.getPropertyByCode')
    throw err
  }
}

const getPropertyValuesByPropertyObjectId = async (
  propertyObjectId: string
) => {
  try {
    const result = await prisma.quantityValue
      .findMany({
        select: {
          value: true,
          quantityType: {
            select: {
              name: true,
              unitId: true,
            },
          },
        },
        where: {
          code: propertyObjectId,
        },
      })
      .then(trimStrings)
      .then((values) =>
        values.map((item) => ({
          value: item.value,
          unitId: item.quantityType.unitId,
          name: item.quantityType.name,
        }))
      )

    return result
  } catch (err) {
    logger.error(
      { err },
      'property-adapter.getPropertyValuesByPropertyObjectId'
    )
    throw err
  }
}

export type Property = Prisma.PropertyStructureGetPayload<{
  select: {
    id: true
    companyId: true
    companyName: true
    name: true
    code: true
    tract: true
    propertyId: true
  }
}>

//todo: use actual type and mapper
const getProperties = async (
  companyCode: string,
  tract: string | undefined
): Promise<any[]> => {
  const whereClause: Record<string, any> = {
    companyCode,
    propertyId: { not: null },
    buildingId: null,
    managementUnitId: null,
    landAreaId: null,
    roomId: null,
    maintenanceUnitId: null,
    systemId: null,
  }

  if (tract) {
    whereClause.name = { contains: tract }
  }

  const propertyStructures = await prisma.propertyStructure.findMany({
    where: whereClause,
  })

  return prisma.property
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
    })
    .then(trimStrings)
}

const searchProperties = (
  q: string
): Promise<Prisma.PropertyGetPayload<undefined>[]> => {
  try {
    return prisma.property
      .findMany({
        where: {
          designation: { contains: q },
        },
      })
      .then(trimStrings)
  } catch (err) {
    logger.error({ err }, 'property-adapter.searchProperties')
    throw err
  }
}

export {
  getPropertyByCode,
  getProperties,
  getPropertyValuesByPropertyObjectId,
  searchProperties,
}
