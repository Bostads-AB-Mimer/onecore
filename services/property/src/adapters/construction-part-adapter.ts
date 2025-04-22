import { map } from 'lodash'

import { trimStrings } from '@src/utils/data-conversion'

import { prisma } from './db'

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
