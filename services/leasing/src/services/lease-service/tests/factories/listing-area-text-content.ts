import { Factory } from 'fishery'
import { leasing } from '@onecore/types'
import { z } from 'zod'

type ListingAreaTextContent = z.infer<
  typeof leasing.v1.ListingAreaTextContentSchema
>

export const ListingAreaTextContentFactory =
  Factory.define<ListingAreaTextContent>(({ sequence }) => ({
    id: `${sequence}-${Math.random().toString(36).substring(7)}`,
    marketAreaCode: `MA${sequence}`,
    contentBlocks: [
      { type: 'headline', content: 'Test Headline' },
      { type: 'text', content: 'Test text content' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
