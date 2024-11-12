import { PrismaClient } from '@prisma/client'

export const getLatestResidences = async () => {
  const response = await prisma.residence.findMany({
    orderBy: {
      timestamp: 'desc',
    },
    take: 10, // Adjust the number of residences to fetch as needed
  })

  return response
}

export const getResidenceById = async (id: string) => {
  const response = await prisma.residence.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      name: true,
      roomCount: true,
      kitchen: true,
      selectionFundAmount: true,
    },
  })

  return response
}

const prisma = new PrismaClient({
  log: ['query'],
})

export const getResidencesByType = async (residenceTypeId: string) => {
  console.log('residenceTypeId', residenceTypeId)
  const response = await prisma.residence.findMany({
    where: {
      residenceTypeId,
    },
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      code: true,
      name: true,
      roomCount: true,
      kitchen: true,
      selectionFundAmount: true,
    },
  })

  return response
}
