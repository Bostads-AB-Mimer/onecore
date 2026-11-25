import { z } from 'zod'

// The day to give the rent total for, as yyyy-mm-dd: the day a new tenant
// would move in. Rent rows can start or end before then, so the rent that day
// can differ from the rent of today.
export const RentAtSchema = z.string().date()

export const RentalObjectAvailabilityQuerySchema = z.object({
  rentAt: RentAtSchema.optional(),
})

export const RentalObjectAvailabilitiesRequestSchema = z.object({
  rentalObjectCodes: z.array(z.string()).optional(),
  // rentAt per rental object code. Codes left out get the rent of today.
  rentAtByRentalObjectCode: z.record(RentAtSchema).optional(),
})

export type RentalObjectAvailabilitiesRequest = z.infer<
  typeof RentalObjectAvailabilitiesRequestSchema
>
