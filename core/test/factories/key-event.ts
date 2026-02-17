import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyEvent = keys.KeyEvent

export const KeyEventFactory = Factory.define<KeyEvent>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  keys: JSON.stringify(['00000000-0000-0000-0000-000000000001']),
  type: 'FLEX',
  status: 'COMPLETED',
  workOrderId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}))
