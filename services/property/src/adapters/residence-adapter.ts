import { PrismaClient } from '@prisma/client'

export const getLatestResidences = async () => {
  const response = await prisma.residence.findMany({
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      residenceId: true,
      objectId: true,
      propertyObject: {
        select: {
          property: {
            select: {
              propertyId: true,
              propertyCode: true,
            }
          },
          building: {
            select: {
              buildingCode: true,
            }
          }
        }
      },
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
          timestamp: true,
          systemStandard: true,
          checklistId: true,
          componentTypeActionId: true,
          statisticsGroupSCBId: true,
          statisticsGroup2Id: true,
          statisticsGroup3Id: true,
          statisticsGroup4Id: true,
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
      residenceId: id,
    },
    include: {
      residenceType: {
        select: {
          residenceTypeId: true,
          code: true,
          name: true,
          roomCount: true,
          kitchen: true,
          timestamp: true,
          systemStandard: true,
          checklistId: true,
          componentTypeActionId: true,
          statisticsGroupSCBId: true,
          statisticsGroup2Id: true,
          statisticsGroup3Id: true,
          statisticsGroup4Id: true,
          selectionFundAmount: true,
        },
      },
      propertyObject: {
        include: {
          rooms: true,
          propertyStructure: {
            include: {
              property: {
                select: {
                  propertyId: true,
                  propertyCode: true
                }
              },
              building: {
                select: {
                  buildingCode: true,
                  name: true,
                  constructionYear: true,
                  renovationYear: true,
                  valueYear: true,
                  heating: true,
                  fireRating: true,
                  insuranceClass: true,
                  insuranceValue: true,
                }
              }
            }
          },
          rentalObject: {
            select: {
              rentalObjectId: true,
              name: true,
              fromDate: true,
              toDate: true,
              timestamp: true,
              rentalObjectType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
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
      residenceId: true,
      code: true,
      name: true,
    },
  })

  return response
}
