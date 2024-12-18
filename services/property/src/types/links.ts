import { z } from 'zod'

export const LinkSchema = z.object({
  href: z.string().trim(),
})

export const BaseLinksSchema = z.object({
  self: LinkSchema,
})

export const CompanyLinksSchema = BaseLinksSchema.extend({
  properties: LinkSchema,
})

export const PropertyLinksSchema = BaseLinksSchema.extend({
  buildings: LinkSchema,
  parent: LinkSchema.optional(),
})

export const BuildingLinksSchema = BaseLinksSchema.extend({
  property: LinkSchema,
  residences: LinkSchema,
  staircases: LinkSchema,
  parent: LinkSchema,
})

export const StaircaseLinksSchema = BaseLinksSchema.extend({
  building: LinkSchema,
  residences: LinkSchema,
  parent: LinkSchema,
})

export const ResidenceListLinksSchema = BaseLinksSchema.extend({
  components: LinkSchema,
  parent: LinkSchema,
})

export const ResidenceLinksSchema = BaseLinksSchema.extend({
  building: LinkSchema,
  property: LinkSchema,
  rooms: LinkSchema,
  components: LinkSchema,
  parent: LinkSchema,
})

export const RoomLinksSchema = BaseLinksSchema.extend({
  residence: LinkSchema,
  building: LinkSchema,
  parent: LinkSchema,
  components: LinkSchema,
})

export const ComponentLinksSchema = BaseLinksSchema.extend({
  parent: LinkSchema,
  residence: LinkSchema,
})

export type CompanyLinks = z.infer<typeof CompanyLinksSchema>
export type PropertyLinks = z.infer<typeof PropertyLinksSchema>
export type BuildingLinks = z.infer<typeof BuildingLinksSchema>
export type StaircaseLinks = z.infer<typeof StaircaseLinksSchema>
export type ResidenceLinks = z.infer<typeof ResidenceLinksSchema>
export type RoomLinks = z.infer<typeof RoomLinksSchema>
export type ComponentLinks = z.infer<typeof ComponentLinksSchema>
