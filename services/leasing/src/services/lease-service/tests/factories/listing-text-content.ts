import { Factory } from 'fishery'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type ContentBlock = z.infer<typeof leasing.v1.ContentBlockSchema>

// Factory for text-based content blocks
export const TextContentBlockFactory = Factory.define<
  Extract<ContentBlock, { type: 'text' }>
>(() => ({
  type: 'text',
  content: 'Sample text content',
}))

// Factory for link content blocks
export const LinkContentBlockFactory = Factory.define<
  Extract<ContentBlock, { type: 'link' }>
>(({ sequence }) => ({
  type: 'link',
  name: `Link ${sequence}`,
  url: `https://example.com/link-${sequence}`,
}))

export const ListingTextContentFactory = Factory.define<ListingTextContent>(
  ({ sequence }) => ({
    id: `${sequence}-${Math.random().toString(36).substring(7)}`,
    rentalObjectCode: `R${sequence + 1000}`,
    contentBlocks: [
      { type: 'headline', content: 'Test Headline' },
      { type: 'text', content: 'Test text content' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  })
)
