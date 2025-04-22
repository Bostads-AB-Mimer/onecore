import { Prisma } from '@prisma/client'
import { z } from 'zod'

export const CompanySchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  code: z.string(),
  name: z.string(),
  organizationNumber: z.string().nullable(),
})

export const CompanyDetailsSchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  code: z.string(),
  name: z.string(),
  organizationNumber: z.string().nullable(),
  phone: z.string().nullable(),
  fax: z.string().nullable(),
  vatNumber: z.string().nullable().optional(),
  internalExternal: z.number(),
  fTax: z.number(),
  cooperativeHousingAssociation: z.number(),
  differentiatedAdditionalCapital: z.number(),
  rentAdministered: z.number(),
  blocked: z.number(),
  rentDaysPerMonth: z.number(),
  economicPlanApproved: z.number(),
  vatObligationPercent: z.number(),
  vatRegistered: z.number(),
  energyOptimization: z.number(),
  ownedCompany: z.number(),
  interestInvoice: z.number(),
  errorReportAdministration: z.number(),
  mediaBilling: z.number(),
  ownResponsibilityForInternalMaintenance: z.number(),
  // Database returns Prisma.Decimal but we want to return a number to the client
  subletPercentage: z.preprocess(
    (val) => (val instanceof Prisma.Decimal ? val.toNumber() : val),
    z.number()
  ),
  subletFeeAmount: z.number(),
  disableQuantitiesBelowCompany: z.number(),
  timestamp: z.string(),
})

export type Company = z.infer<typeof CompanySchema>
