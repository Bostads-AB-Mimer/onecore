import { PrismaClient, Prisma } from '@prisma/client'
import { map } from 'lodash'
const prisma = new PrismaClient({})

export type PropertyWithObject = Prisma.PropertyGetPayload<{
  include: {
    propertyObject: true
  }
}>
//todo: use actual type and mapper
const getPropertyById = async (
  id: string
): Promise<PropertyWithObject | null> => {
  const response = await prisma.property.findUnique({
    where: {
      id: id,
    },
    include: {
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
  return response
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
    NOT: {
      propertyId: null,
    },
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

  return prisma.property.findMany({
    where: {
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
  })
}

export { getPropertyById, getProperties }
