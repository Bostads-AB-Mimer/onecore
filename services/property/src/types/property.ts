import { z } from 'zod'

export const PropertyDesignationSchema = z.object({
  propertyDesignationId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  timestamp: z.string(),
})

export const PropertySchema = z.object<z.ZodRawShape>({
  id: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  name: z.string(),
  code: z.string(),
  propertyId: z.string(),
  _links: z.object({
    self: z.object({
      href: z.string(),
    }),
  }),
})

export const PropertyDetailsSchema = z.object({
  id: z.string().trim(),
  propertyObjectId: z.string().trim(),
  marketAreaId: z.string().trim(),
  districtId: z.string().trim(),
  propertyDesignationId: z.string().trim(),
  valueAreaId: z.string().nullable(),
  code: z.string(),
  designation: z.string(),
  municipality: z.string(),
  tract: z.string(),
  block: z.string(),
  sector: z.string().nullable(),
  propertyIndexNumber: z.string().nullable(),
  congregation: z.string(),
  builtStatus: z.number().int(),
  separateAssessmentUnit: z.number().int(),
  consolidationNumber: z.string(),
  ownershipType: z.string(),
  registrationDate: z.string().nullable(),
  acquisitionDate: z.string().nullable(),
  isLeasehold: z.number().int(),
  leaseholdTerminationDate: z.string().nullable(),
  area: z.string().nullable(),
  purpose: z.string().nullable(),
  buildingType: z.string().nullable(),
  propertyTaxNumber: z.string().nullable(),
  mainPartAssessedValue: z.number().int(),
  includeInAssessedValue: z.number().int(),
  grading: z.number().int(),
  deleteMark: z.number().int(),
  fromDate: z.string(),
  toDate: z.string(),
  timestamp: z.string(),
  propertyObject: z.object({
    propertyObjectId: z.string().trim(),
    deleteMark: z.number().int(),
    timestamp: z.string(),
    objectTypeId: z.string().trim(),
    barcode: z.string().nullable(),
    barcodeType: z.number().int(),
    condition: z.number().int(),
    conditionInspectionDate: z.string().nullable(),
    vatAdjustmentPrinciple: z.number().int(),
    energyClass: z.number().int(),
    energyRegistered: z.string().nullable(),
    energyReceived: z.string().nullable(),
    energyIndex: z.string().nullable(),
    heatingNature: z.number().int(),
  }),
  _links: z.object({
    self: z.object({
      href: z.string(),
    }),
    buildings: z.object({
      href: z.string(),
    }),
  }),
})

export type PropertyDesignation = z.infer<typeof PropertyDesignationSchema>

export type PropertyDetails = z.infer<typeof PropertyDetailsSchema>

export type Property = z.infer<typeof PropertySchema>
