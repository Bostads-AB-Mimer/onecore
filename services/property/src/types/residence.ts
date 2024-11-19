import { z } from 'zod'

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  location: z.string().optional(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    residenceAdapted: z.boolean(),
    elevator: z.boolean(),
  }),
  features: z.object({
    balcony1: z
      .object({
        location: z.string(),
        type: z.string(),
      })
      .optional(),
    balcony2: z
      .object({
        location: z.string(),
        type: z.string(),
      })
      .optional(),
    patioLocation: z.string().optional(),
    hygieneFacility: z.string(),
    sauna: z.boolean(),
    extraToilet: z.boolean(),
    sharedKitchen: z.boolean(),
    petAllergyFree: z.boolean(),
    electricAllergyIntolerance: z
      .boolean()
      .describe('Is the apartment checked for electric allergy intolerance?'),
    smokeFree: z.boolean(),
    asbestos: z.boolean(),
  }),
  rooms: z.array(
    z.object({
      roomId: z.string(),
      roomCode: z.string(),
      name: z.string().optional(),
      sharedUse: z.boolean(),
      sortingOrder: z.number(),
      allowPeriodicWorks: z.boolean(),
      spaceType: z.number(),
      hasToilet: z.boolean(),
      isHeated: z.number(),
      hasThermostatValve: z.boolean(),
      orientation: z.number(),
      installationDate: z.date().optional(),
      deleteMark: z.boolean(),
      fromDate: z.date(),
      toDate: z.date(),
      availableFrom: z.date().optional(),
      availableTo: z.date().optional(),
      timestamp: z.string(),
    }),
  ),
  entrance: z.string(),
  partNo: z.number(),
  part: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.date(),
    toDate: z.date(),
  }),
  timestamp: z.string(),
  residenceType: z.object({
    code: z.string(),
    name: z.string(),
    roomCount: z.number(),
    kitchen: z.number(),
    selectionFundAmount: z.number(),
  }),
  propertyObject: z.object({
    energy: z.object({
      energyClass: z.number(),
      energyRegistered: z.date().optional(),
      energyReceived: z.date().optional(),
      energyIndex: z.number().optional(),
    }),
  }),
})

import { Prisma } from '@prisma/client'

export type Residence = z.infer<typeof ResidenceSchema>

export type ResidenceWithDetails = Prisma.ResidenceGetPayload<{
  include: {
    propertyObject: {
      include: {
        rooms: true,
        property: true,
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
          },
        },
      },
    },
  },
}>
