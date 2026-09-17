import { leasing } from '@onecore/types'
import { z } from 'zod'

import { ContentBlock } from '../components/ContentBlockEditor'

export type ApiContentBlock = z.infer<typeof leasing.v1.ContentBlockSchema>

// Local-only id for blocks created in the editor (drag-and-drop tracking and
// React keys). Never sent to the API.
export const createBlockId = () => `block-${Date.now()}-${Math.random()}`

// Adds a stable local id to each block so it can be tracked in drag-and-drop
// lists and React keys. The id is not sent back to the API.
export const fromApiBlocks = (blocks: ApiContentBlock[]): ContentBlock[] =>
  blocks.map((block, index) => ({
    ...block,
    id: `block-${index}`,
  }))

// Strips the local id and builds the correct shape per block type before
// sending blocks to the API.
export const toApiBlocks = (blocks: ContentBlock[]): ApiContentBlock[] =>
  blocks.map((block) => {
    if (block.type === 'link') {
      return {
        type: block.type,
        name: block.name || '',
        url: block.url || '',
      }
    } else {
      return {
        type: block.type,
        content: block.content || '',
      }
    }
  })

// A block that would fail validation on save: an empty text block, or a link
// block missing its name or a valid URL.
export const isInvalidBlock = (block: ContentBlock): boolean => {
  if (block.type === 'link') {
    // Link blocks need both name and valid URL
    if (!block.name?.trim() || !block.url?.trim()) return true
    try {
      new URL(block.url)
      return false
    } catch {
      return true
    }
  }
  // Text blocks need content
  return !block.content?.trim()
}

export const hasInvalidBlock = (blocks: ContentBlock[]): boolean =>
  blocks.some(isInvalidBlock)
