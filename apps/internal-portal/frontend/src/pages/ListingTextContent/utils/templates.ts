import type { RentalPropertyInfo } from '@onecore/types'

import type { ContentBlock } from '../components/ContentBlockEditor'
import type {
  ListingTextTemplate,
  TemplateBlock,
} from '../templates/listingTextTemplates'
import { createBlockId } from './contentBlocks'

// Bounds for the "Antal rum" field. The upper bound is a UI sanity cap, not a
// business rule.
export const MIN_ROOM_COUNT = 1
export const MAX_ROOM_COUNT = 15
// Suggested when the rental object has no usable room count.
export const DEFAULT_ROOM_COUNT = 3

export const isValidRoomCount = (count: number): boolean =>
  Number.isInteger(count) && count >= MIN_ROOM_COUNT && count <= MAX_ROOM_COUNT

// Suggests a room count from the rental object. Only apartments carry one, and
// a value outside the field's bounds is treated as unknown.
export const roomCountFromProperty = (
  property: RentalPropertyInfo['property'] | undefined
): number | undefined => {
  if (!property || !('roomCount' in property)) return undefined

  const count = property.roomCount
  return count != null && isValidRoomCount(count) ? count : undefined
}

const toContentBlock = (block: TemplateBlock): ContentBlock => ({
  id: createBlockId(),
  type: block.type,
  content: block.content ?? '',
  placeholder: block.placeholder,
})

// Expands a template into editor blocks: the fixed blocks, then the room
// section repeated `roomCount` times. Templates without a room section ignore
// `roomCount`.
export const buildBlocksFromTemplate = (
  template: ListingTextTemplate,
  roomCount: number
): ContentBlock[] => {
  const fixedBlocks = template.blocks.map(toContentBlock)
  const { roomSection } = template

  if (!roomSection) return fixedBlocks

  const roomBlocks = Array.from({ length: roomCount }).flatMap(() =>
    roomSection.blocks.map(toContentBlock)
  )

  return [...fixedBlocks, ...roomBlocks]
}
