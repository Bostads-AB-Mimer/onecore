import { z } from 'zod'

export const LeaseHomeInsuranceSchema = z.object({
  monthlyAmount: z.number(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const LeaseHomeInsuranceOfferSchema = z.object({
  monthlyAmount: z.number(),
})
