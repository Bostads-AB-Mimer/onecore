import { z } from 'zod'

export const LfInsuranceExportRowSchema = z.object({
  leaseId: z.string(),
  leaseStatus: z.string(),
  leaseFromDate: z.coerce.date(),
  leaseToDate: z.coerce.date().nullable(),
  rentalObjectCode: z.string(),
  numberOfRooms: z.number().nullable(),
  squareMeters: z.number().nullable(),
  rowFromDate: z.string(),
  rowToDate: z.string().nullable(),
  annualRent: z.number(),
  articleText: z.string(),
  nationalIdNumber: z.string(),
  fullName: z.string(),
  address: z.string(),
  phoneNumber: z.string(),
  email: z.string().nullable(),
})

export type LfInsuranceExportRow = z.infer<typeof LfInsuranceExportRowSchema>

export const LfInsuranceExportResponseSchema = z.object({
  content: z.array(LfInsuranceExportRowSchema),
})
