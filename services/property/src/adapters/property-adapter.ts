import { PrismaClient, Prisma } from '@prisma/client'
const prisma = new PrismaClient({
  log: ['query'],
})

export type PropertyWithObject = Prisma.PropertyGetPayload<{
  include: {
    propertyObject: true
  }
}>

export type PropertyBasicInfo = Prisma.PropertyStructureGetPayload<{
  select: {
    id: true
    companyId: true
    companyName: true
    name: true
    code: true
    propertyId: true //this is a cmobj pointing to bafst. you would join on keycmobj in bafst to get actual property data.
  }
}>

const getPropertyById = async (
  propertyId: string
): Promise<PropertyWithObject | null> => {
  // we could use code instead of propertyObjectId but code is not unique so we would have to use findMany
  const response = await prisma.property.findUnique({
    where: {
      propertyObjectId: propertyId,
    },
    include: {
      propertyObject: {
        select: {
          propertyObjectId: true,
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

const getProperties = async (
  companyCode: string,
  tract: string | undefined
): Promise<PropertyBasicInfo[]> => {
  // ideally we would like to look up every actual property
  // but that would require a join with bafst based on the result of below query
  // the join would be performed on keyobjfst
  // we could then get the actual property data from bafst
  if (tract) {
    return prisma.propertyStructure.findMany({
      where: {
        name: { contains: tract },
        companyCode: companyCode,
        propertyId: { not: null },
        buildingId: null,
        managementUnitId: null,
        landAreaId: null,
        roomId: null,
        maintenanceUnitId: null,
        systemId: null,
      },
      select: {
        id: true,
        companyId: true,
        companyName: true,
        name: true,
        code: true,
        propertyId: true,
      },
    })
  }
  return prisma.propertyStructure.findMany({
    where: {
      companyCode: companyCode,
      propertyId: { not: null },
      buildingId: null,
      managementUnitId: null,
      landAreaId: null,
      roomId: null,
      maintenanceUnitId: null,
      systemId: null,
    },
    select: {
      id: true,
      companyId: true,
      companyName: true,
      name: true,
      code: true,
      propertyId: true,
    },
  })
}

export { getPropertyById, getProperties }
