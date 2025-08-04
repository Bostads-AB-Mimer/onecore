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
  reviewedAt: z.coerce.date().nullable(),
  reviewedBy: z.string().nullable(),

  expiresAt: z.union([z.null(), z.coerce.date()]),
  createdAt: z.coerce.date(),
})

export const ApplicationProfileHousingTypeSchema = z.enum([
  'LIVES_WITH_FAMILY', // Bor med familj
  'LODGER', // Inneboende
  'RENTAL', // Hyresrätt
  'SUB_RENTAL', // Andrahandskontrakt
  'OWNS_HOUSE', // Äger hus
  'OWNS_FLAT', // Äger lägenhet
  'OWNS_ROW_HOUSE', // Äger radhus
  'OTHER', // Övrigt,
])

export const ApplicationProfileSchema = z.object({
  id: z.number(),
  contactCode: z.string(),
  numAdults: z.number(),
  numChildren: z.number(),
  housingType: ApplicationProfileHousingTypeSchema.nullable(),
  housingTypeDescription: z.string().nullable(),
  landlord: z.string().nullable(),
  housingReference: ApplicationProfileHousingReferenceSchema,
  expiresAt: z.union([z.null(), z.coerce.date()]),
  createdAt: z.coerce.date(),
  lastUpdatedAt: z.union([z.null(), z.coerce.date()]),
})
