import { z } from 'zod'

export const ResidenceDetailsSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  location: z.string(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    residenceAdapted: z.boolean(),
    elevator: z.boolean(),
  }),
  features: z.object({
    balcony1: z.object({
      location: z.string(),
      type: z.string(),
    }),
    balcony2: z.object({
      location: z.string(),
      type: z.string(),
    }),
    patioLocation: z.string(),
    hygieneFacility: z.string(),
    sauna: z.boolean(),
    extraToilet: z.boolean(),
    sharedKitchen: z.boolean(),
    petAllergyFree: z.boolean(),
    electricAllergyIntolerance: z.boolean(),
    smokeFree: z.boolean(),
    asbestos: z.boolean(),
  }),
  entrance: z.string(),
  partNo: z.number(),
  part: z.string(),
  residenceType: z.object({
    residenceTypeId: z.string(),
    code: z.string(),
    name: z.string(),
    roomCount: z.number(),
    kitchen: z.number(),
    systemStandard: z.number(),
    checklistId: z.string(),
    componentTypeActionId: z.string(),
    statisticsGroupSCBId: z.string(),
    statisticsGroup2Id: z.string(),
    statisticsGroup3Id: z.string(),
    statisticsGroup4Id: z.string(),
    timestamp: z.string(),
  }),
  propertyObject: z.object({
    energy: z.object({
      energyClass: z.number(),
      energyRegistered: z.string(),
      energyReceived: z.string(),
      energyIndex: z.number(),
    }),
  }),
})

export type ResidenceDetails = z.infer<typeof ResidenceDetailsSchema>
