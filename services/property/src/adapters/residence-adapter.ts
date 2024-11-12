import { PrismaClient } from '@prisma/client'

export const getLatestResidences = async () => {
  const response = await prisma.residence.findMany({
    orderBy: {
      timestamp: 'desc',
      propertyObject: {
        select: {
          barcode: true,
          condition: true,
          energyClass: true,
          energyIndex: true,
          heatingNature: true,
        },
      },
    },
    select: {
      residenceId: true,
      objectId: true,
      residenceTypeId: true,
      code: true,
      name: true,
      location: true,
      wheelchairAccessible: true,
      residenceAdapted: true,
      serviceApartment: true,
      balcony1Location: true,
      balcony2Location: true,
      balcony1Type: true,
      balcony2Type: true,
      patioLocation: true,
      hygieneFacility: true,
      sauna: true,
      extraToilet: true,
      sharedKitchen: true,
      petAllergyFree: true,
      electricAllergyIntolerance: true,
      smokeFree: true,
      elevator: true,
      asbestos: true,
      entrance: true,
      hluFundAvailableAmount: true,
      hluFundMaxAmount: true,
      hluDiscountStartDate: true,
      partNo: true,
      part: true,
      deleted: true,
      fromDate: true,
      toDate: true,
      timestamp: true,
      residenceType: {
        select: {
          residenceTypeId: true,
          code: true,
          name: true,
          roomCount: true,
          kitchen: true,
          selectionFundAmount: true,
        },
      },
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
