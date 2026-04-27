import { z } from 'zod'

export const HomeInsuranceExportRowSchema = z.object({
  leaseId: z.string(),
  leaseStatus: z.string(),
  leaseFromDate: z.coerce.date(),
  leaseToDate: z.coerce.date().nullable(),
  rentalObjectCode: z.string(),
  numberOfRooms: z.number().nullable(),
  squareMeters: z.number().nullable(),
  rowFromDate: z.coerce.date(),
  rowToDate: z.coerce.date().nullable(),
  annualRent: z.number(),
  articleText: z.string(),
  nationalIdNumber: z.string(),
  fullName: z.string(),
  address: z.string(),
  phoneNumber: z.string(),
  email: z.string().nullable(),
})

export type HomeInsuranceExportRow = z.infer<typeof HomeInsuranceExportRowSchema>

export const HomeInsuranceExportResponseSchema = z.object({
  content: z.array(HomeInsuranceExportRowSchema),
})
