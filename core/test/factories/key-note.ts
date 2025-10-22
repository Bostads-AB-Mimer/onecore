import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyNote = keys.v1.KeyNote

export const KeyNoteFactory = Factory.define<KeyNote>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  rentalObjectCode: `123-456-789/${sequence}`,
  description: `Note about keys for rental object ${sequence}`,
}))
