import { map } from 'lodash'
import { toBoolean, trimStrings } from '../utils/data-conversion'

import { prisma } from './db'

//todo: add types

async function getStaircasesByBuildingCode(buildingCode: string) {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      NOT: {
        staircaseId: null,
      },
      residenceId: null,
      localeId: null,
    },
  })

  const staircases = await prisma.staircase.findMany({
    where: {
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
  })

  const propertyStructureMap = new Map(
    propertyStructures.map(trimStrings).map((ps) => [
      ps.propertyObjectId,
      {
        propertyId: ps.propertyId,
        propertyCode: ps.propertyCode,
        propertyName: ps.propertyName,
        buildingId: ps.buildingId,
        buildingCode: ps.buildingCode,
        buildingName: ps.buildingName,
      },
    ])
  )

  return staircases.map(trimStrings).map((staircase) => {
    const propertyData = propertyStructureMap.get(staircase.propertyObjectId)

    return {
      id: staircase.id,
      code: staircase.code,
      name: staircase.name,
      buildingCode: buildingCode,
      features: {
        floorPlan: staircase.floorPlan,
        accessibleByElevator: toBoolean(staircase.accessibleByElevator),
      },
      dates: {
        from: staircase.fromDate,
        to: staircase.toDate,
      },
      deleted: toBoolean(staircase.deleteMark),
      timestamp: staircase.timestamp,
      property: {
        propertyId: propertyData?.propertyId,
        propertyCode: propertyData?.propertyCode,
        propertyName: propertyData?.propertyName,
      },
      building: {
        buildingId: propertyData?.buildingId,
        buildingCode: propertyData?.buildingCode,
        buildingName: propertyData?.buildingName,
      },
    }
  })
}

export { getStaircasesByBuildingCode }
