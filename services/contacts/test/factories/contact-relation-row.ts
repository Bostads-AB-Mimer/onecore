import { Factory } from 'fishery'
import { DbContactRelationRow } from '@src/adapters/contact-relations'
import { IMPORT_ACTOR } from '@src/scripts/import-contact-relations/import'

export const DbContactRelationRowFactory = Factory.define<DbContactRelationRow>(
  ({ sequence }) => ({
    id: `row-${sequence}`,
    subject_contact_code: `P${String(sequence).padStart(6, '0')}`,
    related_contact_code: `Q${String(sequence).padStart(6, '0')}`,
    role_type: 'god_man',
    created_at: new Date('2026-09-01T00:00:00Z'),
    created_by: IMPORT_ACTOR,
    deleted_at: null,
    deleted_by: null,
  })
)
