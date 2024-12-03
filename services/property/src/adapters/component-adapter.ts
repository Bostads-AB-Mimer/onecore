import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query'],
})

export const getComponentByMaintenanceUnitCode = async (
  maintenanceUnitCode: string
) => {
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

  return response.map((component) => ({
    id: component.id,
    code: component.code,
    name: component.name,
    details: {
      manufacturer: component.manufacturer,
      typeDesignation: component.typeDesignation,
    },
    dates: {
      installation: component.installationDate,
      warrantyEnd: component.warrantyEndDate,
    },
    classification: {
      componentType: {
        code: component.componentType?.componentTypeCode ?? '',
        name: component.componentType?.name ?? '',
      },
      category: {
        code: component.componentCategory?.code ?? '',
        name: component.componentCategory?.name ?? '',
      },
    },
    maintenanceUnits: component.propertyStructures.map((ps) => ({
      id: ps.maintenanceUnitByCode?.maintenanceUnitId ?? '',
      code: ps.maintenanceUnitByCode?.maintenanceUnitCode ?? '',
      name: ps.maintenanceUnitByCode?.name ?? '',
    })),
  }))
}
