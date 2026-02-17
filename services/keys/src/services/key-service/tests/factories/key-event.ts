import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyEvent = keys.KeyEvent

/**
 * Factory for generating test KeyEvent entities.
 *
 * Usage:
 * - factory.keyEvent.build() - generates one key event with defaults
 * - factory.keyEvent.build({ type: 'FLEX', status: 'COMPLETED' }) - override specific fields
 * - factory.keyEvent.buildList(5) - generates 5 key events
 */
export const KeyEventFactory = Factory.define<KeyEvent>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  type: 'FLEX',
  status: 'COMPLETED',
  workOrderId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}))
