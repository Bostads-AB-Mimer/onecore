import { z } from 'zod'

export const LeaseChangeSchema = z.object({
  leaseId: z.string(),
  contactCode: z.string(),
  rentalObjectId: z.string(),
  action: z.enum(['create', 'terminate', 'void']),
  timestamp: z.date(),
})

export type LeaseChange = z.infer<typeof LeaseChangeSchema>
