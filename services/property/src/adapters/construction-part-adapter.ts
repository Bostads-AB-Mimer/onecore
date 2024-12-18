import { map } from 'lodash'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query'],
})

//todo: add types
export const getConstructionPartsByBuildingCode = async (
  buildingCode: string
) => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      NOT: {
        constructionPartId: null,
      },
      residenceId: null,
      localeId: null,
    },
  })

  return prisma.constructionPart.findMany({
    where: {
      propertyObjectId: {
        in: map(propertyStructures, 'propertyObjectId'),
      },
    },
  })
}
