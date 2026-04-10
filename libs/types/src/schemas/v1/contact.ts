import z from 'zod'

export const XledgerContactSchema = z.object({
  dbId: z.string(),
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
})
