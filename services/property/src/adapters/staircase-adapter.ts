import { map } from 'lodash'
import { PrismaClient } from '@prisma/client'
import { toBoolean } from '../utils/data-conversion'

const prisma = new PrismaClient({
  log: ['query'],
})

async function getStaircasesByBuildingCode(buildingCode: string) {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      NOT: {
        floorId: null,
      },
      residenceId: null,
      localeId: null,
    },
  })

  const staircases = await prisma.staircase.findMany({
    where: {
      objectID: {
        in: map(propertyStructures, 'objectId'),
      },
    },
  })

  return staircases.map((staircase) => ({
    id: staircase.id,
    code: staircase.code,
    name: staircase.name,
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
  }))
}

export { getStaircasesByBuildingCode }
