import { property } from '@onecore/types'
import { z } from 'zod'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here.
export const {
  RENTAL_OBJECT_TYPES,
  RentalObjectTypeSchema,
} = property
export type RentalObjectType = property.RentalObjectType

// One rental object (balgh/babps/balok/bahyr structure row) — what it is,
// where it sits (building/staircase) and its postal address. subtypeName is
// the Xpand type caption ("3 rum och kök", "Garage", "3 G Antenner"...).
export const RentalObjectSummarySchema = z.object({
  rentalId: z.string(),
  type: RentalObjectTypeSchema,
  code: z.string().nullable(),
  name: z.string().nullable(),
  subtypeName: z.string().nullable(),
  address: z.string().nullable(),
  buildingCode: z.string().nullable(),
  // staircaseName rides on rows because trapphus groups are derived from
  // them; building/parkingArea names live on their tree nodes instead.
  staircaseCode: z.string().nullable(),
  staircaseName: z.string().nullable(),
  parkingAreaCode: z.string().nullable(),
})

export type RentalObjectSummary = z.infer<typeof RentalObjectSummarySchema>

export const GetRentalObjectsQueryParamsSchema = z
  .object({
    propertyCode: z.string().min(1).optional(),
    buildingCode: z.string().min(1).optional(),
    exclude: z
      .union([RentalObjectTypeSchema, z.array(RentalObjectTypeSchema)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
  })
  .refine((q) => !!q.propertyCode !== !!q.buildingCode, {
    message: 'Provide exactly one of propertyCode or buildingCode.',
  })

export type GetRentalObjectsQueryParams = z.infer<
  typeof GetRentalObjectsQueryParamsSchema
>
