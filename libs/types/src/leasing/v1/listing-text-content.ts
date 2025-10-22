import { z } from 'zod'

export const ContentBlockTypeSchema = z.enum([
  'preamble',
  'headline',
  'subtitle',
  'text',
  'bullet_list',
])

export const ContentBlockSchema = z.object({
  type: ContentBlockTypeSchema,
  content: z.string(),
})

export const ListingTextContentSchema = z.object({
  id: z.string().uuid(),
  rentalObjectCode: z.string(),
  contentBlocks: z.array(ContentBlockSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const CreateListingTextContentRequestSchema =
  ListingTextContentSchema.pick({
    rentalObjectCode: true,
    contentBlocks: true,
  })

export const UpdateListingTextContentRequestSchema =
  ListingTextContentSchema.pick({
    contentBlocks: true,
  }).partial()
