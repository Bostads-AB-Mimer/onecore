import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const getPropertyById = async (propertyId: string) => {
  console.log('propertyId', propertyId)
  const response = await prisma.property.findUnique({
    where: {
      propertyId: propertyId,
    },
    include: {
      propertyObject: true,
    },
  })
  return response
}

export { getPropertyById }
