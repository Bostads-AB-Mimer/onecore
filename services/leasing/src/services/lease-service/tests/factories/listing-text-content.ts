import { Factory } from 'fishery'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type ContentBlock = z.infer<typeof leasing.v1.ContentBlockSchema>

export const ContentBlockFactory = Factory.define<ContentBlock>(() => ({
  type: 'text',
  content: 'Sample text content',
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
