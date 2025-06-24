import { z } from 'zod'

export const MetadataSchema = z.object({
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

export function createGenericResponseSchema<T>(schema: z.ZodType<T>) {
  return z
    .object({
      content: schema,
    })
    .merge(MetadataSchema)
}
