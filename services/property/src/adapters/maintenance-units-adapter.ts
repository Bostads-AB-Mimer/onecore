import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import { MaintenanceUnit } from '@src/types/maintenance-unit'

export const getMaintenanceUnitsByBuildingCode = async (
  buildingCode: string
): Promise<MaintenanceUnit[]> => {
  // Use buildingCode to find the propertyCode first
  const propertyStructure = await prisma.propertyStructure
    .findFirst({
      where: {
        buildingCode: buildingCode,
        NOT: {
          buildingCode: null,
          propertyCode: null,
          propertyName: null,
        },
      },
      select: {
        propertyId: true,
        propertyCode: true,
        propertyName: true,
        buildingId: true,
        buildingCode: true,
        buildingName: true,
      },
    })
    .then(trimStrings)

  if (!propertyStructure) {
    console.error(`No property found for building code: ${buildingCode}`)
    return []
  }

  const maintenanceUnits = await prisma.maintenanceUnit.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      maintenanceUnitType: {
        select: {
          name: true,
        },
      },
    },
    where: {
      propertyStructures: {
        some: {
          propertyCode: propertyStructure?.propertyCode,
        },
      },
    },
  })

  return trimStrings(maintenanceUnits).map((item) => {
    return {
      id: item.id,
      code: item.code,
      caption: item.name,
      type: item.maintenanceUnitType?.name ?? null,
      property: {
        id: propertyStructure?.propertyId,
        code: propertyStructure?.propertyCode,
        name: propertyStructure?.propertyName,
      },
      building: {
        id: propertyStructure?.buildingId ?? null,
        code: propertyStructure?.buildingCode ?? null,
        name: propertyStructure?.buildingName ?? null,
      },
    }
  })
}

export const getMaintenanceUnitsByRentalId = async (rentalId: string) => {
  /**
   *  Get property structure info for the given rental ID
   *  In order to extract propertyObjectId and other details used in response
   */
  const rentalPropertyInfo = await prisma.propertyStructure.findFirst({
    select: {
      rentalId: true,
      propertyCode: true,
      propertyName: true,
      propertyObjectId: true,
      buildingId: true,
      buildingCode: true,
      buildingName: true,
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

  // Grab related maintenance units with propertyObjectId
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

  // Trim strings and map the results to the desired structure
  const rentalPropertyInfoTrimmed = trimStrings(rentalPropertyInfo)
  const maintenanceUnitPropertyStructuresMapped = trimStrings(
    rentalPropertyToMaintenanceUnit
  ).map((item) => {
    return {
      id: item?.maintenanceUnit?.id,
      rentalPropertyId: rentalPropertyInfoTrimmed.rentalId,
      code: item.maintenanceUnit?.code,
      caption: item?.maintenanceUnit?.name,
      type: item.maintenanceUnit?.maintenanceUnitType?.name,
      property: {
        id: rentalPropertyInfoTrimmed.propertyObjectId,
        code: rentalPropertyInfoTrimmed.propertyCode,
        name: rentalPropertyInfoTrimmed.propertyName,
      },
      building: {
        id: rentalPropertyInfoTrimmed.buildingId,
        code: rentalPropertyInfoTrimmed.buildingCode,
        name: rentalPropertyInfoTrimmed.buildingName,
      },
      //estateCode: rentalPropertyInfoTrimmed.propertyCode,
      //estate: rentalPropertyInfoTrimmed.propertyName,
    }
  })

  return maintenanceUnitPropertyStructuresMapped
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
    select: {
      id: true,
      code: true,
      name: true,
      maintenanceUnitType: {
        select: {
          name: true,
        },
      },
      propertyStructures: {
        select: {
          propertyId: true,
          propertyCode: true,
          propertyName: true,
          buildingId: true,
          buildingCode: true,
          buildingName: true,
        },
      },
    },
  })

  return trimStrings(maintenanceUnits).map((item) => {
    return {
      id: item.id,
      code: item.code,
      caption: item.name,
      type: item.maintenanceUnitType?.name ?? null,
      property: {
        id: item.propertyStructures[0]?.propertyId ?? null,
        code: item.propertyStructures[0]?.propertyCode ?? null,
        name: item.propertyStructures[0]?.propertyName ?? null,
      },
      building: {
        id: item.propertyStructures[0]?.buildingId ?? null,
        code: item.propertyStructures[0]?.buildingCode ?? null,
        name: item.propertyStructures[0]?.buildingName ?? null,
      },
      //estateCode: item.propertyStructures[0]?.propertyCode ?? null,
      //estate: item.propertyStructures[0]?.propertyName ?? null,
    }
  })
}
