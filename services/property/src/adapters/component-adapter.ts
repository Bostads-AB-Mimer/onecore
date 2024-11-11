import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getComponentByMaintenanceUnitCode = async (
  maintenanceUnitCode: string,
) => {
  console.log('maintenanceUnitCode', maintenanceUnitCode)
  const response = await prisma.component.findMany({
    take: 10,
    where: {
      propertyObject: {
        propertyStructure: {
          some: {
            maintenanceUnit: {
              //maintenanceUnitCode, // test: 703T01
            },
          },
        },
      },
    },
    orderBy: {
      installationDate: 'desc',
    },
    select: {
      id: true,
      code: true,
      name: true,
      manufacturer: true,
      typeDesignation: true,
      installationDate: true,
      warrantyEndDate: true,
      componentType: {
        select: {
          componentTypeCode: true,
          name: true,
        },
      },
      componentCategory: {
        select: {
          code: true,
          name: true,
        },
      },
      propertyObject: {
        select: {
          propertyStructure: {
            select: {
              maintenanceUnitId: true,
              maintenanceUnitCode: true,
              maintenanceUnitName: true,
            },
          },
        },
      },
    },
  })

  return response
}
