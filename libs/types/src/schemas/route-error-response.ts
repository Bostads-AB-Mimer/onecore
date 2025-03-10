import { z } from 'zod'

export const RouteErrorResponseSchema = z.object({
  type: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  status: z.number(),
  _links: z.object({
    self: z.object({
      href: z.string(),
    }),
    link: z.object({
      href: z.string(),
      templated: z.boolean(),
    }),
  }),
})
