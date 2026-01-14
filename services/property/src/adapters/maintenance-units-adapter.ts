import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import { MaintenanceUnit } from '@src/types/maintenance-unit'

const maintenanceUnitBaseSelect = {
  id: true,
  code: true,
  name: true,
  maintenanceUnitType: {
    select: { name: true },
  },
} as const

const maintenanceUnitWithPropertySelect = {
  ...maintenanceUnitBaseSelect,
  propertyStructures: {
    select: {
      propertyCode: true,
      propertyName: true,
    },
  },
} as const

type PropertyInfo = { propertyCode: string | null; propertyName: string | null }

const mapToMaintenanceUnit = (
  item: {
    id: string
    code: string
    name: string | null
    maintenanceUnitType: { name: string | null } | null
  },
  property: PropertyInfo | null
): MaintenanceUnit => ({
  id: item.id,
  code: item.code,
  caption: item.name,
  type: item.maintenanceUnitType?.name ?? null,
  estateCode: property?.propertyCode ?? null,
  estate: property?.propertyName ?? null,
})

export const getMaintenanceUnitsByBuildingCode = async (
  buildingCode: string
): Promise<MaintenanceUnit[]> => {
  const propertyStructure = await prisma.propertyStructure.findFirst({
    where: {
      buildingCode: buildingCode,
      NOT: {
        buildingCode: null,
        propertyCode: null,
        propertyName: null,
      },
    },
    select: {
      propertyCode: true,
      propertyName: true,
    },
  })

  if (!propertyStructure) {
    console.error(`No property found for building code: ${buildingCode}`)
    return []
  }

  const maintenanceUnits = await prisma.maintenanceUnit.findMany({
    select: maintenanceUnitBaseSelect,
    where: {
      propertyStructures: {
        some: {
          propertyCode: propertyStructure.propertyCode,
        },
      },
    },
  })

  return trimStrings(maintenanceUnits).map((item) =>
    mapToMaintenanceUnit(item, propertyStructure)
  )
}

export const getMaintenanceUnitsByRentalId = async (
  rentalId: string
): Promise<MaintenanceUnit[]> => {
  const rentalPropertyInfo = await prisma.propertyStructure.findFirst({
    select: {
      rentalId: true,
      propertyCode: true,
      propertyName: true,
      propertyObjectId: true,
    },
    where: {
      rentalId: rentalId,
      roomCode: null,
      NOT: {
        propertyCode: null,
        propertyName: null,
        buildingCode: null,
        buildingName: null,
      },
    },
  })

  if (!rentalPropertyInfo) {
    console.error(`No property found for rental ID: ${rentalId}`)
    return []
  }

  const rentalPropertyToMaintenanceUnit =
    await prisma.residenceToMaintenanceUnitRelation.findMany({
      include: {
        maintenanceUnit: {
          include: {
            maintenanceUnitType: true,
          },
        },
      },
      where: {
        residencePropertyObjectId: rentalPropertyInfo.propertyObjectId,
      },
    })

  const propertyInfo = trimStrings(rentalPropertyInfo)
  return trimStrings(rentalPropertyToMaintenanceUnit)
    .filter((item) => item.maintenanceUnit)
    .map((item) => ({
      ...mapToMaintenanceUnit(item.maintenanceUnit!, propertyInfo),
      rentalPropertyId: propertyInfo.rentalId ?? undefined,
    }))
}

export const getMaintenanceUnitsByPropertyCode = async (
  propertyCode: string
): Promise<MaintenanceUnit[]> => {
  const maintenanceUnits = await prisma.maintenanceUnit.findMany({
    where: {
      propertyStructures: {
        some: {
          propertyCode: propertyCode,
        },
      },
    },
    select: maintenanceUnitWithPropertySelect,
  })

  return trimStrings(maintenanceUnits).map((item) =>
    mapToMaintenanceUnit(item, item.propertyStructures[0] ?? null)
  )
}

export const getMaintenanceUnitByCode = async (
  code: string
): Promise<MaintenanceUnit | null> => {
  const maintenanceUnit = await prisma.maintenanceUnit.findUnique({
    where: { code },
    select: maintenanceUnitWithPropertySelect,
  })

  if (!maintenanceUnit) {
    return null
  }

  const trimmed = trimStrings(maintenanceUnit)
  return mapToMaintenanceUnit(trimmed, trimmed.propertyStructures[0] ?? null)
}

export const searchMaintenanceUnits = async (
  q: string
): Promise<MaintenanceUnit[]> => {
  const maintenanceUnits = await prisma.maintenanceUnit.findMany({
    where: {
      code: { contains: q },
    },
    select: maintenanceUnitWithPropertySelect,
    take: 10,
  })

  return trimStrings(maintenanceUnits).map((item) =>
    mapToMaintenanceUnit(item, item.propertyStructures[0] ?? null)
  )
}
