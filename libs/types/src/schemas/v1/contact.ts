import z from 'zod'

export const XledgerContactSchema = z.object({
  dbId: z.string(),
  fullName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
})
