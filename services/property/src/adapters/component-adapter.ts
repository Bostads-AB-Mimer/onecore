import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query'],
})

export const getComponentByMaintenanceUnitCode = async (
  maintenanceUnitCode: string
) => {
  console.log('maintenanceUnitCode', maintenanceUnitCode)
  const response = await prisma.component.findMany({
    where: {
      propertyStructures: {
        some: {
          maintenanceUnitByCode: {
            maintenanceUnitCode,
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
      propertyStructures: {
        select: {
          maintenanceUnitByCode: {
            select: {
              maintenanceUnitId: true,
              maintenanceUnitCode: true,
              name: true,
            },
          },
        },
      },
    },
  })

  return response
}
