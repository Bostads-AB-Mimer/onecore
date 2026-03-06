import { z } from 'zod'

export const ContentBlockTypeSchema = z.enum([
  'preamble',
  'headline',
  'subtitle',
  'text',
  'bullet_list',
  'link',
])

// Union of all content block types
export const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('preamble'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('headline'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('subtitle'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('text'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('bullet_list'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('link'),
    name: z.string().min(1, 'Link name is required'),
    url: z.string().url('Invalid URL format'),
  }),
])

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
