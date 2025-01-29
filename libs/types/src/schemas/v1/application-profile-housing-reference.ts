import { z } from 'zod'

export const HousingReferenceReviewStatusSchema = z.enum([
  'APPROVED',
  'REJECTED',
  'CONTACTED_UNREACHABLE',
  'PENDING',
  'REFERENCE_NOT_REQUIRED',
])

export const HousingReferenceReasonRejectedSchema = z.enum([
  'DISTURBANCE',
  'LATE_RENT_PAYMENT',
  'DEBT_TO_LANDLORD',
  'MISMANAGEMENT',
])

export const ApplicationProfileHousingReferenceSchema = z.object({
  id: z.number(),
  applicationProfileId: z.number(),
  phone: z.string().nullable(), // TODO: Should parse as phone number
  email: z.string().nullable(), // TODO: Should parse as email
  reviewStatus: HousingReferenceReviewStatusSchema,
  comment: z.string().nullable(),
  reasonRejected: HousingReferenceReasonRejectedSchema.nullable(),
  lastAdminUpdatedAt: z.union([z.null(), z.coerce.date()]),
  lastAdminUpdatedBy: z.string().nullable(),
  lastApplicantUpdatedAt: z.union([z.null(), z.coerce.date()]),

  expiresAt: z.union([z.null(), z.coerce.date()]),
  createdAt: z.coerce.date(),
})
