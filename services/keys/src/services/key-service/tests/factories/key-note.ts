import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyNote = keys.KeyNote

/**
 * Factory for generating test KeyNote entities.
 *
 * Usage:
 * - factory.keyNote.build() - generates one key note with defaults
 * - factory.keyNote.build({ rentalObjectCode: 'A001' }) - override specific fields
 * - factory.keyNote.buildList(5) - generates 5 key notes
 */
export const KeyNoteFactory = Factory.define<KeyNote>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  rentalObjectCode: `ROC${String(sequence).padStart(4, '0')}`,
  description: `Test note ${sequence}`,
  // Note: key_notes table does not have createdAt or updatedAt columns
}))
