import z from 'zod'

export const XledgerProjectSchema = z.object({
  code: z.string(),
  description: z.string(),
})
