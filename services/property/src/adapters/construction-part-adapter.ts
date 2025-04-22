import { map } from 'lodash'
import { PrismaClient } from '@prisma/client'

import { trimStrings } from '@src/utils/data-conversion'

const prisma = new PrismaClient({
  log: ['query'],
})

export const getConstructionPartsByBuildingCode = async (
  buildingCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      residenceId: null,
      localeId: null,
    },
  })

  return prisma.constructionPart
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
    })
    .then(trimStrings)
}
