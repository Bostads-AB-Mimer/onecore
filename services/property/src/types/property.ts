import { z } from 'zod'

export const propertiesQueryParamsSchema = z.object({
  companyCode: z.string().min(3, {
    message: 'companyCode is required and must be a non-empty string.',
  }),
  tract: z.string().optional(),
})

export const PropertyDesignationSchema = z.object({
  propertyDesignationId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  timestamp: z.string(),
})

export const PropertySchema = z.object({
  id: z.string().trim(),
  propertyObjectId: z.string().trim(),
  marketAreaId: z.string().trim(),
  districtId: z.string().trim(),
  propertyDesignationId: z.string().trim(),
  valueAreaId: z.string().nullable(),
  code: z.string(),
  designation: z.string(),
  municipality: z.string().describe('Kommun'),
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
  fromDate: z.date(),
  toDate: z.date(),
  timestamp: z.string(),
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
  municipality: z.string().describe('Municipality=kommun'),
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
  fromDate: z.date(),
  toDate: z.date(),
  timestamp: z.string(),
  propertyObject: z.object({
    id: z.string().trim(),
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
})

export type PropertyDesignation = z.infer<typeof PropertyDesignationSchema>

export type PropertyDetails = z.infer<typeof PropertyDetailsSchema>

export type Property = z.infer<typeof PropertySchema>
