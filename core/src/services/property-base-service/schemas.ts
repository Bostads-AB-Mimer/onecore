import { z } from 'zod'

export const PropertySchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  marketAreaId: z.string(),
  districtId: z.string(),
  propertyDesignationId: z.string(),
  valueAreaId: z.string().nullable(),
  code: z.string(),
  designation: z.string(),
  municipality: z.string(),
  tract: z.string(),
  block: z.string(),
  sector: z.string().nullable(),
  propertyIndexNumber: z.string().nullable(),
  congregation: z.string(),
  builtStatus: z.number(),
  separateAssessmentUnit: z.number(),
  consolidationNumber: z.string(),
  ownershipType: z.string(),
  registrationDate: z.string().nullable(),
  acquisitionDate: z.string().nullable(),
  isLeasehold: z.number(),
  leaseholdTerminationDate: z.string().nullable(),
  area: z.string().nullable(),
  purpose: z.string().nullable(),
  buildingType: z.string().nullable(),
  propertyTaxNumber: z.string().nullable(),
  mainPartAssessedValue: z.number(),
  includeInAssessedValue: z.number(),
  grading: z.number(),
  deleteMark: z.number(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  timestamp: z.string(),
})

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string().datetime(),
    toDate: z.string().datetime(),
  }),
})

export const ResidenceDetailsSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string().datetime(),
    toDate: z.string().datetime(),
  }),
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
    electricAllergyIntolerance: z.boolean(),
    smokeFree: z.boolean(),
    asbestos: z.boolean(),
  }),
  entrance: z.string(),
  partNo: z.number().optional().nullable(),
  part: z.string().optional().nullable(),
  residenceType: z.object({
    residenceTypeId: z.string(),
    code: z.string(),
    name: z.string().nullable(),
    roomCount: z.number().nullable(),
    kitchen: z.number(),
    systemStandard: z.number(),
    checklistId: z.string().nullable(),
    componentTypeActionId: z.string().nullable(),
    statisticsGroupSCBId: z.string().nullable(),
    statisticsGroup2Id: z.string().nullable(),
    statisticsGroup3Id: z.string().nullable(),
    statisticsGroup4Id: z.string().nullable(),
    timestamp: z.string(),
  }),
  propertyObject: z.object({
    energy: z.object({
      energyClass: z.number(),
      energyRegistered: z.string().datetime().optional(),
      energyReceived: z.string().datetime().optional(),
      energyIndex: z.number().optional(),
    }),
  }),
})

export const GetResidencesQueryParamsSchema = z.object({
  buildingCode: z.string(),
  staircaseCode: z.string().optional(),
})

export const GetPropertiesQueryParamsSchema = z.object({
  companyCode: z.string(),
  tract: z.string().optional(),
})

export type Property = z.infer<typeof PropertySchema>
export type Residence = z.infer<typeof ResidenceSchema>
export type ResidenceDetails = z.infer<typeof ResidenceDetailsSchema>
