import { z } from 'zod'

export const ContentBlockTypeSchema = z.enum([
  'preamble',
  'headline',
  'subtitle',
  'text',
  'bullet_list',
  'bold_text',
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
    type: z.literal('bold_text'),
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

// Bulk existence check: which of the given rental object codes have listing
// text. The response is the matching subset of codes. The leasing adapter
// batches the lookup internally, so callers need not chunk the list.
export const ListingTextContentExistenceRequestSchema = z.object({
  rentalObjectCodes: z.array(z.string()).min(1),
})

// Market-area text: one template per Xpand market area (babya), attached
// read-only to every housing listing in that area after the object-specific
// text. Keyed by the market area code (e.g. "VAL" for Vallby).
export const ListingAreaTextContentSchema = z.object({
  id: z.string().uuid(),
  marketAreaCode: z.string(),
  contentBlocks: z.array(ContentBlockSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const CreateListingAreaTextContentRequestSchema =
  ListingAreaTextContentSchema.pick({
    marketAreaCode: true,
    contentBlocks: true,
  })

export const UpdateListingAreaTextContentRequestSchema =
  ListingAreaTextContentSchema.pick({
    contentBlocks: true,
  }).partial()

// Composed lookup for a rental object as returned by the internal-portal
// backend: the object-specific text plus the market-area text of the
// property it belongs to. `marketArea`/`areaContent` are only resolved for
// housing; parking spaces and commercial spaces always get null.
export const ListingTextContentLookupSchema = z.object({
  content: ListingTextContentSchema.nullable(),
  marketArea: z
    .object({
      code: z.string(),
      name: z.string().nullable(),
    })
    .nullable(),
  areaContent: ListingAreaTextContentSchema.nullable(),
})
