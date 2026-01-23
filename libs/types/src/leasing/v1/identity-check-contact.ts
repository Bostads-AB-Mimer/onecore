import { z } from 'zod'

export const IdentityCheckContactSchema = z.object({
  contactCode: z.string(),
  nationalRegistrationNumber: z.string(),
})

export type IdentityCheckContact = z.infer<typeof IdentityCheckContactSchema>
