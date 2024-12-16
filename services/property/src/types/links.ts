import { z } from 'zod'

export const LinkSchema = z.object({
  href: z.string(),
})

export const BaseLinksSchema = z.object({
  self: LinkSchema,
})

export const ResidenceLinksSchema = BaseLinksSchema.extend({
  building: LinkSchema.optional(),
  property: LinkSchema.optional(),
  rooms: LinkSchema,
  components: LinkSchema,
  parent: LinkSchema.optional(),
})

export type ResidenceLinks = z.infer<typeof ResidenceLinksSchema>
