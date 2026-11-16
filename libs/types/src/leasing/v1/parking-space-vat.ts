import { z } from 'zod'

// Why a parking space lease created through Direkthyra or Mina sidor got VAT
// or not:
//   'housing-contract-in-area'    the tenant has a current or upcoming
//                                 housing contract in the parking space's
//                                 residential area, so no VAT
//   'no-housing-contract-in-area' the tenant has no current or upcoming
//                                 housing contract in that residential area
//                                 (or none at all), so VAT
//   'not-a-tenant'                the contact has no tenancy at all, or no
//                                 tenant in Tenfast, so VAT
export const ParkingSpaceVatReasonSchema = z.enum([
  'housing-contract-in-area',
  'no-housing-contract-in-area',
  'not-a-tenant',
])

export const ParkingSpaceVatDecisionSchema = z.object({
  includeVAT: z.boolean(),
  reason: ParkingSpaceVatReasonSchema,
})

export type ParkingSpaceVatReason = z.infer<typeof ParkingSpaceVatReasonSchema>
export type ParkingSpaceVatDecision = z.infer<
  typeof ParkingSpaceVatDecisionSchema
>

// Swedish text for staff, per reason. The reason decides VAT, so the text
// covers both.
export const ParkingSpaceVatDecisionLabel: Record<
  ParkingSpaceVatReason,
  string
> = {
  'housing-contract-in-area': 'Ingen moms – bostadskontrakt finns i området',
  'no-housing-contract-in-area': 'Moms – inget bostadskontrakt i området',
  'not-a-tenant': 'Moms – kunden är inte hyresgäst',
}
